// Dark Matter scanner — transport-level 429 / Retry-After back-off tests (10 Nov 2026).
//
// GitHub's bug bounty rules allow automated tools only while they do not
// produce excessive traffic, and answer throttling with an honest HTTP 429
// + Retry-After. These tests pin the transport-level guard that makes the
// scanner respect that signal:
//
// - A 429 (or a Retry-After header on any status) pauses FURTHER
//   requests to THAT host for the Retry-After duration (capped at 60s),
//   then resumes; without a header the wait is the 5s default.
// - The 429 response itself is returned UNTOUCHED, so the probes'
//   throttle-signal verdicts keep seeing the status they judge on.
// - The pause is per-host: a 429 on one host never delays another.
// - Every wait is bounded (one wait per request, capped) — no loop.
// - withThrottledFetch restores globalThis.fetch even when the scan
//   throws, and a runScan started under the guard really engages it.
//
// No network, no real waiting: the clock (now/sleep) is fake, so the
// waits advance instantly and the tests stay deterministic.
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseRetryAfterSeconds,
  createThrottledFetch,
  installThrottledFetch,
  withThrottledFetch,
} from './httpBackoff.js';
import { runScan } from './index.js';

const realFetch = globalThis.fetch;

// Fake clock: sleep advances time instantly instead of waiting.
function makeClock() {
  let nowMs = 0;
  const sleeps = [];
  return {
    now: () => nowMs,
    sleep: async (ms) => {
      sleeps.push(ms);
      nowMs += ms;
    },
    sleeps,
    get nowMs() {
      return nowMs;
    },
  };
}

function makeResponse(status, headers = {}) {
  return { status, headers, text: async () => '' };
}

function makeBaseFetch(handler) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push(String(url));
    return handler(url, init, calls.length);
  };
  fn.calls = calls;
  return fn;
}

describe('parseRetryAfterSeconds', () => {
  it('reads delay-seconds from a Headers instance', () => {
    assert.equal(parseRetryAfterSeconds(new Headers({ 'retry-after': '120' })), 120);
  });

  it('reads delay-seconds from a plain object, any key casing', () => {
    assert.equal(parseRetryAfterSeconds({ 'Retry-After': '7' }), 7);
    assert.equal(parseRetryAfterSeconds({ 'RETRY-AFTER': '3' }), 3);
  });

  it('reads an HTTP-date as the delta from now', () => {
    const nowMs = Date.parse('2026-11-10T12:00:00.000Z');
    const date = new Date(nowMs + 10_000).toUTCString();
    assert.equal(parseRetryAfterSeconds({ 'retry-after': date }, nowMs), 10);
  });

  it('returns null for a missing, empty, or garbage value', () => {
    assert.equal(parseRetryAfterSeconds(new Headers()), null);
    assert.equal(parseRetryAfterSeconds({}), null);
    assert.equal(parseRetryAfterSeconds(null), null);
    assert.equal(parseRetryAfterSeconds({ 'retry-after': '' }), null);
    assert.equal(parseRetryAfterSeconds({ 'retry-after': 'soon' }), null);
    assert.equal(parseRetryAfterSeconds({ 'retry-after': '-5' }), null);
  });

  it('returns 0 for an HTTP-date in the past, never negative', () => {
    const nowMs = Date.parse('2026-11-10T12:00:00.000Z');
    assert.equal(
      parseRetryAfterSeconds({ 'retry-after': 'Wed, 21 Oct 2015 07:28:00 GMT' }, nowMs),
      0
    );
  });
});

describe('createThrottledFetch', () => {
  it('returns the 429 response untouched and waits Retry-After before the next same-host request', async () => {
    const clock = makeClock();
    const base = makeBaseFetch(() =>
      makeResponse(429, { 'retry-after': '2' })
    );
    const fetchFn = createThrottledFetch(base, { now: clock.now, sleep: clock.sleep });
    const first = await fetchFn('http://a.example.com/x');
    assert.equal(first.status, 429, 'probe must still see the 429');
    assert.deepEqual(clock.sleeps, [], 'the 429 itself is not delayed');
    const second = await fetchFn('http://a.example.com/y');
    assert.equal(second.status, 429);
    assert.deepEqual(clock.sleeps, [2000], 'next request waits the Retry-After value');
    assert.deepEqual(base.calls, ['http://a.example.com/x', 'http://a.example.com/y']);
  });

  it('caps the wait at 60s when Retry-After is larger', async () => {
    const clock = makeClock();
    const base = makeBaseFetch(() => makeResponse(429, { 'retry-after': '300' }));
    const fetchFn = createThrottledFetch(base, { now: clock.now, sleep: clock.sleep });
    await fetchFn('http://a.example.com/x');
    await fetchFn('http://a.example.com/y');
    assert.deepEqual(clock.sleeps, [60000]);
  });

  it('waits the 5s default on a 429 with no Retry-After header', async () => {
    const clock = makeClock();
    const base = makeBaseFetch(() => makeResponse(429, {}));
    const fetchFn = createThrottledFetch(base, { now: clock.now, sleep: clock.sleep });
    await fetchFn('http://a.example.com/x');
    await fetchFn('http://a.example.com/y');
    assert.deepEqual(clock.sleeps, [5000]);
  });

  it('pauses on a Retry-After header even when the status is not 429', async () => {
    const clock = makeClock();
    const base = makeBaseFetch(() => makeResponse(200, { 'retry-after': '3' }));
    const fetchFn = createThrottledFetch(base, { now: clock.now, sleep: clock.sleep });
    const first = await fetchFn('http://a.example.com/x');
    assert.equal(first.status, 200, 'a 200 is still a 200');
    await fetchFn('http://a.example.com/y');
    assert.deepEqual(clock.sleeps, [3000]);
  });

  it('falls back to the default when Retry-After is unparsable', async () => {
    const clock = makeClock();
    const base = makeBaseFetch(() => makeResponse(429, { 'retry-after': 'soon' }));
    const fetchFn = createThrottledFetch(base, { now: clock.now, sleep: clock.sleep });
    await fetchFn('http://a.example.com/x');
    await fetchFn('http://a.example.com/y');
    assert.deepEqual(clock.sleeps, [5000]);
  });

  it('isolates hosts: a 429 on one host never delays another', async () => {
    const clock = makeClock();
    const base = makeBaseFetch((url) =>
      String(url).includes('a.example.com')
        ? makeResponse(429, { 'retry-after': '30' })
        : makeResponse(200, {})
    );
    const fetchFn = createThrottledFetch(base, { now: clock.now, sleep: clock.sleep });
    await fetchFn('http://a.example.com/x');
    await fetchFn('http://b.example.com/x');
    assert.deepEqual(clock.sleeps, [], 'other host proceeds immediately');
    await fetchFn('http://a.example.com/y');
    assert.deepEqual(clock.sleeps, [30000], 'throttled host still waits');
    await fetchFn('http://b.example.com/y');
    assert.deepEqual(clock.sleeps, [30000], 'other host still unaffected');
  });

  it('resumes after the pause with no further waiting', async () => {
    const clock = makeClock();
    let n = 0;
    const base = makeBaseFetch(() => {
      n += 1;
      return n === 1 ? makeResponse(429, { 'retry-after': '2' }) : makeResponse(200, {});
    });
    const fetchFn = createThrottledFetch(base, { now: clock.now, sleep: clock.sleep });
    await fetchFn('http://a.example.com/1');
    await fetchFn('http://a.example.com/2');
    assert.deepEqual(clock.sleeps, [2000]);
    await fetchFn('http://a.example.com/3');
    assert.deepEqual(clock.sleeps, [2000], 'no second wait once the pause elapsed');
  });

  it('propagates a base-fetch throw and records no back-off', async () => {
    const clock = makeClock();
    const base = makeBaseFetch(() => {
      throw new Error('mock network down');
    });
    const fetchFn = createThrottledFetch(base, { now: clock.now, sleep: clock.sleep });
    await assert.rejects(() => fetchFn('http://a.example.com/x'), /mock network down/);
    await assert.rejects(() => fetchFn('http://a.example.com/y'), /mock network down/);
    assert.deepEqual(clock.sleeps, [], 'a failed request sets no pause');
  });

  it('throws at creation when the base fetch is not a function', () => {
    assert.throws(() => createThrottledFetch(null), /needs a fetch function/);
  });
});

describe('installThrottledFetch / withThrottledFetch', () => {
  let saved;
  beforeEach(() => {
    saved = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = saved;
  });

  it('installs the wrapper and restores the previous fetch', () => {
    const stub = async () => makeResponse(200, {});
    globalThis.fetch = stub;
    const restore = installThrottledFetch();
    assert.notEqual(globalThis.fetch, stub, 'fetch is wrapped while installed');
    restore();
    assert.equal(globalThis.fetch, stub, 'fetch is restored');
    restore();
    assert.equal(globalThis.fetch, stub, 'restore is idempotent');
  });

  it('withThrottledFetch returns the value and restores afterwards', async () => {
    const stub = async () => makeResponse(200, {});
    globalThis.fetch = stub;
    const value = await withThrottledFetch(async () => 'done');
    assert.equal(value, 'done');
    assert.equal(globalThis.fetch, stub);
  });

  it('withThrottledFetch restores even when fn throws', async () => {
    const stub = async () => makeResponse(200, {});
    globalThis.fetch = stub;
    await assert.rejects(
      () => withThrottledFetch(async () => { throw new Error('scan blew up'); }),
      /scan blew up/
    );
    assert.equal(globalThis.fetch, stub, 'a throwing scan never leaks the wrapper');
  });

  it('nested installs unwind in order', async () => {
    const stub = async () => makeResponse(200, {});
    globalThis.fetch = stub;
    const restoreOuter = installThrottledFetch();
    const outerWrapped = globalThis.fetch;
    const restoreInner = installThrottledFetch();
    assert.notEqual(globalThis.fetch, outerWrapped);
    restoreInner();
    assert.equal(globalThis.fetch, outerWrapped, 'inner restore returns the outer wrapper');
    restoreOuter();
    assert.equal(globalThis.fetch, stub);
  });
});

describe('runScan engages the back-off', () => {
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('a 429ing target makes runScan wait the Retry-After before further requests', async () => {
    const clock = makeClock();
    // Every request to the target answers 429 with Retry-After: 2.
    const stub = async () => ({
      status: 429,
      headers: new Headers({ 'retry-after': '2' }),
      text: async () => '',
    });
    globalThis.fetch = stub;
    const result = await runScan(
      {
        target: 'http://example.com/',
        confirmedAuthorized: true,
        phases: ['fingerprint', 'headers'],
      },
      { timeoutMs: 5000, httpBackoff: { now: clock.now, sleep: clock.sleep } }
    );
    assert.ok(result, 'the scan completes even when the target throttles every request');
    assert.ok(
      clock.sleeps.length >= 1 && clock.sleeps.every((ms) => ms === 2000),
      `expected at least one 2000ms back-off wait, got ${JSON.stringify(clock.sleeps)}`
    );
    assert.equal(globalThis.fetch, stub, 'runScan restores the fetch it found');
  });
});
