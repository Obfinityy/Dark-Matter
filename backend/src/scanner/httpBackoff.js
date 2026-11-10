// Dark Matter rule-based scanner — transport-level 429 / Retry-After back-off (10 Nov 2026).
//
// GitHub's bug bounty rules allow automated tools only while they do not
// produce excessive traffic, and answer throttling with an honest HTTP 429
// + Retry-After instead of a bot-wall page. The scanner therefore pauses
// its own requests to a host that just throttled it, per host, instead of
// hammering through the limit.
//
// There was no shared HTTP layer to put this in. First-hand count at
// b228852b: probes call the global fetch directly (90 bare fetch( sites
// across 65 probe files) or through the two optional seams (opts.fetchFn
// in 38 files, fingerprint.fetchPage in 27). The narrowest point that
// covers ALL probe traffic is the scan entry: runScan installs this
// wrapper on globalThis.fetch for the duration of one scan and restores
// the previous fetch in a finally, so nested scans restore correctly
// and a throwing scan never leaks the wrapper.
//
// This is transport timing only, never status hiding:
// - The 429 response is returned to the probe UNTOUCHED, so the
//   probes' throttle-signal verdicts keep seeing the status they judge
//   on (credentialStuffing assessLoginResponse, llmRateLimit,
//   quotaBypass, graphql batching, llmLab hasThrottleSignal).
// - The 429'd request itself is NEVER retried: retrying would burn
//   extra requests against a throttling server and would hide the
//   throttle signal from probes that stop on first sight of it
//   (credentialStuffing returns [] the moment a throttle appears).
//   Only FURTHER requests to that host pause, for the Retry-After
//   duration, then resume.
// - Per-host isolation: a 429 on github.com pauses github.com only.
// - Every wait is bounded: Retry-After is capped at 60s, the default
//   wait without a header is 5s, and a request waits at most once
//   before it is sent — there is no wait loop.

const DEFAULT_BACKOFF_MS = 5000;
const MAX_BACKOFF_MS = 60000;

// Parse a Retry-After value into seconds, or null when it carries no
// usable wait. Accepts a Headers instance, a plain object (any key
// casing), or nothing. Two forms per RFC 9110: delay-seconds ("120")
// and an HTTP-date ("Wed, 21 Oct 2015 07:28:00 GMT"). A date in the
// past means no wait (0), never a negative one. Pure.
export function parseRetryAfterSeconds(headers, nowMs = Date.now()) {
  if (!headers) return null;
  let raw = null;
  try {
    if (typeof headers.get === 'function') {
      raw = headers.get('retry-after');
    } else if (typeof headers === 'object') {
      for (const [key, value] of Object.entries(headers)) {
        if (key.toLowerCase() === 'retry-after') {
          raw = value;
          break;
        }
      }
    }
  } catch {
    return null;
  }
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  if (text === '') return null;
  if (/^\d+$/.test(text)) return Number(text);
  // HTTP-date form (IMF-fixdate / RFC 850 / asctime): it must look like
  // a date — a weekday or a day number first. Date.parse alone is too
  // lenient ('-5' parses as a year in V8), so gate on the shape and
  // only then parse.
  if (!/^(?:[A-Za-z]{3},\s|\d{1,2}\s)/.test(text)) return null;
  const dateMs = Date.parse(text);
  if (Number.isNaN(dateMs)) return null;
  return Math.max(0, Math.ceil((dateMs - nowMs) / 1000));
}

function hostOf(url) {
  try {
    const raw =
      typeof url === 'string'
        ? url
        : url && typeof url.url === 'string'
          ? url.url
          : '';
    if (!raw) return null;
    return new URL(raw).host || null;
  } catch {
    return null;
  }
}

// Wrap a fetch implementation with per-host 429 / Retry-After back-off.
// `now` and `sleep` are injectable so tests can drive the clock
// without real waiting; production uses Date.now + setTimeout. The
// returned function has the same (url, init) => Response shape as
// fetch, so it drops in wherever fetch is used.
export function createThrottledFetch(baseFetch, options = {}) {
  if (typeof baseFetch !== 'function') {
    throw new TypeError('createThrottledFetch needs a fetch function');
  }
  const defaultBackoffMs = Math.max(
    0,
    Number(options.defaultBackoffMs ?? DEFAULT_BACKOFF_MS) || 0
  );
  const maxBackoffMs = Math.max(
    0,
    Number(options.maxBackoffMs ?? MAX_BACKOFF_MS) || 0
  );
  const now = typeof options.now === 'function' ? options.now : () => Date.now();
  const sleep =
    typeof options.sleep === 'function'
      ? options.sleep
      : (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // host -> epoch ms at which requests to that host may resume.
  const pausedUntil = new Map();

  return async function throttledFetch(url, init) {
    const host = hostOf(url);
    if (host) {
      const resumeAt = pausedUntil.get(host);
      if (resumeAt !== undefined) {
        const waitMs = resumeAt - now();
        if (waitMs > 0) {
          await sleep(waitMs);
        } else {
          pausedUntil.delete(host);
        }
      }
    }
    const res = await baseFetch(url, init);
    // Bookkeeping must never break the request path: a stub response
    // without headers, or a header object we cannot read, just means
    // no back-off is recorded. The response is returned untouched.
    try {
      const seconds = parseRetryAfterSeconds(res && res.headers, now());
      if ((res && res.status === 429) || seconds !== null) {
        const waitMs =
          seconds === null
            ? defaultBackoffMs
            : Math.min(Math.max(0, seconds) * 1000, maxBackoffMs);
        if (host && waitMs > 0) pausedUntil.set(host, now() + waitMs);
      }
    } catch {
      // Ignore: no back-off recorded, response still returned below.
    }
    return res;
  };
}

// Install the throttled wrapper on globalThis.fetch and return a
// restore function. The restore is idempotent and returns the fetch
// that was current at install time, so nested installs unwind in
// order. Never throws after install.
export function installThrottledFetch(baseFetch = globalThis.fetch, options = {}) {
  const previousFetch = globalThis.fetch;
  const wrapped = createThrottledFetch(baseFetch, options);
  globalThis.fetch = wrapped;
  let restored = false;
  return () => {
    if (!restored) {
      restored = true;
      globalThis.fetch = previousFetch;
    }
  };
}

// Run fn with the throttled wrapper installed, restoring the previous
// fetch in a finally even when fn throws. Returns fn's value.
export async function withThrottledFetch(fn, baseFetch = globalThis.fetch, options = {}) {
  const restore = installThrottledFetch(baseFetch, options);
  try {
    return await fn();
  } finally {
    restore();
  }
}
