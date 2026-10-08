/**
 * Tests for VM-session hunt wiring (VM control design §6/§7):
 *  - targetScope allowlist gate
 *  - toolRunner routes shell-type tool actions to POST /vm/exec when a VM
 *    session is attached, and blocks out-of-scope targets without touching
 *    the runner
 *  - non-VM paths are unchanged (spawnFn still used)
 *  - huntRunner.withVmScope resolves the declared target as the gate scope
 *
 * All network is mocked: global fetch is replaced with a fake VM runner.
 * No QEMU, no binaries, no models.
 */
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

import { createToolRunner } from '../src/hunt/toolRunner.js';
import { createTargetScope, normalizeHost, hostOfTarget } from '../src/hunt/targetScope.js';
import { withVmScope } from '../src/hunt/huntRunner.js';

const quiet = { log: () => {}, warn: () => {}, info: () => {}, error: () => {} };

const realFetch = globalThis.fetch;

function mockFetch(handler) {
  const calls = [];
  globalThis.fetch = async (url, opts) => {
    calls.push({ url, opts });
    return handler(url, opts);
  };
  return calls;
}

afterEach(() => {
  globalThis.fetch = realFetch;
});

function vmOkResponse({ stdout = '', stderr = '', exit_code = 0, timed_out = false } = {}) {
  return {
    ok: true,
    json: async () => ({ exit_code, stdout, stderr, timed_out }),
  };
}

// ---------------------------------------------------------------- targetScope

describe('targetScope allowlist gate', () => {
  it('normalizes URLs to bare hosts', () => {
    assert.equal(normalizeHost('https://shop.example.com:8443/path?q=1'), 'shop.example.com');
    assert.equal(normalizeHost('10.0.2.15'), '10.0.2.15');
    assert.equal(normalizeHost('[::1]:8080'), '::1');
    assert.equal(hostOfTarget('http://example.com/x'), 'example.com');
  });

  it('allows the exact declared host and its subdomains', () => {
    const scope = createTargetScope(['example.com']);
    assert.ok(scope.allows('example.com'));
    assert.ok(scope.allows('sub.example.com'));
    assert.ok(scope.allows('deep.sub.example.com'));
  });

  it('denies unrelated hosts', () => {
    const scope = createTargetScope(['example.com']);
    assert.ok(!scope.allows('evil.com'));
    assert.ok(!scope.allows('example.com.evil.com'));
    assert.ok(!scope.allows('notexample.com'));
  });

  it('always allows safe-local ranges (VM sandbox networking)', () => {
    const scope = createTargetScope(['example.com']);
    for (const h of ['localhost', '127.0.0.1', '10.0.2.15', '192.168.1.10', '172.16.5.5', '::1']) {
      assert.ok(scope.allows(h), `expected ${h} to be allowed`);
    }
  });

  it('accepts an array of declared targets', () => {
    const scope = createTargetScope(['https://a.example.com', '10.0.2.15']);
    assert.deepEqual(scope.hosts.sort(), ['10.0.2.15', 'a.example.com']);
    assert.ok(scope.allows('b.a.example.com'));
    assert.ok(!scope.allows('b.example.com'));
  });
});

// ------------------------------------------------- toolRunner VM routing

describe('toolRunner VM routing', () => {
  it('POSTs the tool command to /vm/exec with the session id', async () => {
    const calls = mockFetch(async () => vmOkResponse({
      stdout: '{"host":"a.example.com","source":"crtsh"}\n{"host":"b.example.com"}\n',
    }));
    const runner = createToolRunner({ logger: quiet, vm: { sessionId: 'sess-1', targets: ['example.com'] } });
    const res = await runner.runTool('subfinder', 'example.com', { profile: 'fast' });

    assert.equal(calls.length, 1);
    assert.ok(calls[0].url.endsWith('/vm/exec'), `unexpected url ${calls[0].url}`);
    const body = JSON.parse(calls[0].opts.body);
    assert.equal(body.sessionId, 'sess-1');
    assert.match(body.command, /subfinder/);
    assert.match(body.command, /-d/);
    assert.match(body.command, /example\.com/);
    assert.equal(res.tool, 'subfinder');
    assert.equal(res.records.length, 2);
    assert.equal(res.records[0].host, 'a.example.com');
    assert.equal(res.blocked, undefined);
    assert.equal(res.skipped, false);
  });

  it('pipes stdin-fed tool targets through printf', async () => {
    const calls = mockFetch(async () => vmOkResponse({
      stdout: '{"host":"a.example.com","a":["1.2.3.4"]}\n',
    }));
    const runner = createToolRunner({ logger: quiet, vm: { sessionId: 'sess-2', targets: ['example.com'] } });
    const res = await runner.runTool('dnsx', 'a.example.com', { profile: 'fast' });
    assert.equal(calls.length, 1);
    const body = JSON.parse(calls[0].opts.body);
    assert.match(body.command, /printf '%s\\n'/);
    assert.match(body.command, /\|/);
    assert.match(body.command, /dnsx/);
    assert.equal(res.records.length, 1);
  });

  it('blocks out-of-scope targets without touching the runner', async () => {
    const calls = mockFetch(async () => vmOkResponse({}));
    const runner = createToolRunner({ logger: quiet, vm: { sessionId: 'sess-3', targets: ['example.com'] } });
    const res = await runner.runTool('subfinder', 'evil.com', { profile: 'fast' });
    assert.equal(calls.length, 0);
    assert.equal(res.blocked, true);
    assert.equal(res.records.length, 0);
    assert.match(res.error, /outside the authorized hunt scope/);
  });

  it('sends the bearer token when provided', async () => {
    const calls = mockFetch(async () => vmOkResponse({}));
    const runner = createToolRunner({
      logger: quiet,
      vm: { sessionId: 'sess-4', targets: ['example.com'], token: 'tok-abc', baseUrl: 'http://127.0.0.1:4100' },
    });
    await runner.runTool('subfinder', 'example.com');
    assert.equal(calls[0].opts.headers.authorization, 'Bearer tok-abc');
  });

  it('returns an error result (no throw) when the runner is unreachable', async () => {
    mockFetch(async () => { throw new Error('connection refused'); });
    const runner = createToolRunner({ logger: quiet, vm: { sessionId: 'sess-5', targets: ['example.com'] } });
    const res = await runner.runTool('subfinder', 'example.com');
    assert.match(res.error, /VM runner exec failed/);
    assert.equal(res.records.length, 0);
  });

  it('keeps the local spawn path when no VM session is attached', async () => {
    const spawned = [];
    const fakeSpawn = (bin, argv) => {
      spawned.push({ bin, argv });
      const child = new EventEmitter();
      setImmediate(() => child.emit('exit', 0));
      return child;
    };
    const runner = createToolRunner({ spawnFn: fakeSpawn, logger: quiet });
    // isAvailable probes `<bin> -version` via spawnFn
    assert.equal(await runner.isAvailable('subfinder'), true);
    assert.equal(spawned.length, 1);
    assert.equal(spawned[0].bin, 'subfinder');
  });
});

// ------------------------------------------------------- huntRunner wiring

describe('huntRunner VM scope wiring', () => {
  it('resolves the declared target as vm.targets when missing', () => {
    const out = withVmScope({ vm: { sessionId: 's1' } }, 'https://shop.example.com/');
    assert.deepEqual(out.vm.targets, ['https://shop.example.com/']);
    assert.equal(out.vm.sessionId, 's1');
  });

  it('keeps an explicitly declared vm scope untouched', () => {
    const out = withVmScope({ vm: { sessionId: 's1', targets: ['a.com'] } }, 'b.com');
    assert.deepEqual(out.vm.targets, ['a.com']);
  });

  it('leaves non-VM runner options alone', () => {
    assert.deepEqual(withVmScope({}, 'a.com'), {});
    assert.deepEqual(withVmScope({ spawnFn: 1 }, 'a.com'), { spawnFn: 1 });
    assert.deepEqual(withVmScope(null, 'a.com'), {});
  });
});
