// Dark Matter rule-based scanner — Service worker cache poisoning probe
// (coverage row #460 [Medium] Browser — Service worker cache poisoning,
// CWE-444 | PortSwigger Cache; phase 111, 'sw-cache-poisoning').
//
// ORACLE (deterministic, no judge, no LLM, $0): a service worker that
// caches a response whose body is influenced by attacker-controlled
// input — and serves that cached response to a later request that
// did NOT carry the input — poisons every later visitor of the
// cached URL. The poison needs two properties, and the probe checks
// both in two tiers:
//
//   TIER 1 — STATIC MINE (cheap, rigorous for the negative case):
//   the page's own first-party bundles + inline <script> blocks are
//   scanned for a service-worker registration
//   (`navigator.serviceWorker.register(...)`) and the registered
//   worker script is fetched and mined for cache-WRITE sinks
//   (`cache.put(` / `cache.add(` / `cache.addAll(`). Each sink is
//   classified by its handler (a `put` inside a `fetch` handler
//   caches the intercepted request's response; a `put`/`addAll`
//   inside `install` is precache of static assets) and by whether
//   the cached request's key is normalized (the query stripped
//   before the put — the response varies by query while the key
//   does not). ZERO registrations means no worker can cache
//   anything — a proven true negative, no browser needed. A
//   precache-only worker is also a true negative: static assets
//   carry no attacker input. ANY fetch-handler put or
//   key-normalized sink triggers tier 2. A window is a
//   classification, NOT a flow proof: minified code cannot be
//   dataflow-traced by a window.
//
//   TIER 2 — CDP POISON DRIVE (only when tier 1 finds a candidate
//   sink): a real headless browser (the same transient-container +
//   fixed-loopback-CDP pattern as renderDomAuthenticated / the DOM
//   trio) runs the attack in two fresh profiles:
//     (A) CONTROL RENDER: navigate the pasted page, wait for the
//         worker to become active, fetch the victim URL clean.
//         The body must NOT contain the canary — if it does, the
//         oracle is contaminated and nothing confirms.
//     (B) POISON RENDER: a fresh profile navigates the page, then
//         a POISON fetch carries the canary as unkeyed input (a
//         header the cache key never sees — `X-Forwarded-Host:
//         dmpoison-<rid>.example`) or, for a key-normalized sink,
//         as a query parameter (`?dmpoison=<rid>`). A VICTIM fetch
//         of the same bare URL follows, plus a `caches.match` read
//         of the entry itself.
//   CONFIRM only when the victim fetch serves the canary AND the
//   control render did not. The victim fetch carries no poison
//   input, so a canary in its body can only have come from the
//   worker cache — the server cannot know the canary. A poisoned
//   entry that is never served (a network-first worker) confirms
//   nothing, and the evidence says so.
//
// GATES: tier 1 is read-only GETs of the page's own same-origin
// scripts — no lab gate, same as document-domain. Tier 2 navigates
// the target's origin in a real browser with attacker input, so it
// carries the DOM-trio lab gate: labCreds + allowWrite +
// isLabTargetHost + depth !== 'quick'. BOUND: at most 5 bundles +
// 10 inline blocks mined, at most 2 worker scripts fetched, at
// most 2 browser containers per scan (control + poison), at most 2
// poison shapes, at most 1 finding per scan.
//
// VERIFICATION: the poisoned serve IS the evidence (control body
// clean, victim body carrying the canary, cache entry carrying the
// canary), so the differential verifier judges this on the default
// protocol (signalCorrelated). The class name
// 'sw_cache_poisoning' is routed by protocolFor to the default
// protocol ON PURPOSE: it contains neither 'xss' (xss_reflected
// would judge on canaryReflected, which a cache serve never
// carries) nor 'bypass' (auth_bypass, judged on bypassWorks) — the
// same trap dom_sink avoids (see domXssSinks.js). Verified by a
// unit test that calls assessConfirmation on a probe finding and
// expects 'confirmed'.
//
// HONEST LIMITS (stated up front, not discovered later):
// - The drive is ANONYMOUS (no lab session): it tests the pasted
//   page as a logged-out visitor. A worker that only activates
//   behind login is not reached — the probe reports the worker
//   inactive with driveAttempted=true and says so, never a proven
//   true negative.
// - The victim URL is the first same-origin API route the scan
//   mined, else the pasted page URL. A worker that caches only
//   some other URL is not exercised — the evidence names the
//   victim URL tried.
// - The header shape assumes the server reflects an unkeyed
//   header into the response body; the query shape assumes the
//   worker strips the query from the cache key (tier-1 flag). A
//   worker that caches a response varying by some other unkeyed
//   input (a cookie, a POST body) is not exercised — the probe
//   only ever issues GETs.
// - A service worker cache is per-browser-profile: the victim in
//   this oracle is the same browser returning later (the
//   PortSwigger shape — the victim's own browser caches the
//   poisoned response on a crafted visit and serves it on later
//   visits). Cross-profile poisoning is not what a worker cache
//   does, and the probe does not claim it.
// - Vendor / polyfill / runtime bundles are excluded by filename
//   stem, as in dom-xss-sinks: a library that registers a worker
//   is a follow-up, not this row.

import { randomBytes } from 'node:crypto';
import { isLabTargetHost } from '../../labCreds.js';
import { fetchPage } from '../fingerprint.js';
import { JS_ROUTES_MAX_BUNDLES } from '../jsRoutes.js';
import { runCmd } from '../runner.js';
import { DOM_RENDER_IMAGE } from '../domRender.js';
import { connectCdp } from '../cdpClient.js';
import {
  buildCdpContainerRunArgs,
  buildCdpContainerRmArgs,
  AUTH_RENDER_CONNECT_ATTEMPTS,
  AUTH_RENDER_CONNECT_DELAY_MS,
  AUTH_RENDER_TIMEOUT_MS,
  AUTH_RENDER_DEBUG_ENDPOINT,
} from '../authDomRender.js';
import { isVendorBundle } from './domXssSinks.js';

const MAX_BUNDLES = JS_ROUTES_MAX_BUNDLES; // 5, same cap as jsRoutes / domXssSinks
const MAX_INLINE = 10;
const MAX_SW_SCRIPTS = 2;
const MAX_FINDINGS = 1;
const WINDOW_CHARS = 300; // context window around a sink for classification
const DRIVE_SETTLE_MS = 600; // settle after the poison fetch (cache.put is async)
const SNIPPET_RADIUS = 80;

// The poison header: unkeyed input — the Cache API keys on
// (URL, method), never on headers, so a response that varies by
// this header and is cached under the bare URL is served to a
// later request that never sent it.
const POISON_HEADER = 'X-Forwarded-Host';
const POISON_PARAM = 'dmpoison';

// ---- tier-1: service-worker registrations (pure) ----------------------------

// The alternation consumes string literals (group 1) and comments
// (groups 2-3) first, so a registration mentioned inside a string
// or commented out never matches; the register branch (group 4)
// matches `navigator.serviceWorker.register(` (also bare
// `serviceWorker.register(` and `window.navigator.…`). The first
// argument is a quoted literal (groups 5-6) or, when no quote
// follows, an unresolvable expression (a variable, a call).
const REGISTER_RE =
  /("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\/\/[^\n]*)|(\/\*[\s\S]*?\*\/)|((?:\bnavigator\s*\.\s*)?serviceWorker\s*\.\s*register\s*\(\s*(?:(['"`])([^'"`\n\r]*)\5)?)/g;

function lineOf(body, offset) {
  let n = 1;
  for (let i = 0; i < offset && i < body.length; i += 1) {
    if (body[i] === '\n') n += 1;
  }
  return n;
}

function snippetAround(body, matchIndex, matchLength) {
  const start = Math.max(0, matchIndex - SNIPPET_RADIUS);
  const end = Math.min(body.length, matchIndex + matchLength + SNIPPET_RADIUS);
  let snip = body.slice(start, end).replace(/\s+/g, ' ').trim();
  if (start > 0) snip = `…${snip}`;
  if (end < body.length) snip = `${snip}…`;
  return snip.slice(0, 400);
}

// All service-worker registrations in one source body. Pure —
// exported for unit tests. `url` is the script URL literal, or
// null when the first argument is not a string literal.
export function findSwRegistrations(body) {
  const text = typeof body === 'string' ? body : '';
  if (!text) return [];
  const out = [];
  const rx = new RegExp(REGISTER_RE.source, REGISTER_RE.flags);
  let m;
  while ((m = rx.exec(text)) !== null) {
    if (m[1] !== undefined || m[2] !== undefined || m[3] !== undefined) continue;
    if (m[4] === undefined) continue;
    out.push({
      index: m.index,
      url: m[5] !== undefined ? m[6] : null,
      line: lineOf(text, m.index),
      snippet: snippetAround(text, m.index, m[4].length),
    });
  }
  return out;
}

// ---- tier-1: cache-write sinks (pure) --------------------------------------

// Cache-write calls: `cache.put(` / `cache.add(` /
// `cache.addAll(` (the receiver is conventionally named `cache`
// in worker code; `caches.open(` alone is a read path, not a
// write, and never counts). The same string/comment-consuming
// alternation as the registration scan, so a sink mentioned in a
// string or a comment never matches.
const SINK_RE =
  /("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\/\/[^\n]*)|(\/\*[\s\S]*?\*\/)|(\bcache\s*\.\s*(put|add|addAll)\s*\()/g;

// Handler markers: the closest `addEventListener('fetch' | …)`
// (or `onfetch =`) BEFORE a sink names the handler the sink runs
// in. A marker more than MARKER_WINDOW chars before the sink is
// too far to trust — the sink is 'other'.
const MARKER_RE =
  /\baddEventListener\s*\(\s*['"](fetch|install|activate|message|push|sync)['"]|\bon(fetch|install|activate)\s*=/g;
const MARKER_WINDOW = 4000;

// Query-strip patterns: the cached request's key is built with
// the query removed, so the response varies by query while the
// key does not — the query shape is poisonable.
const KEY_NORMALIZE_RES = [
  /\.split\s*\(\s*['"]\?['"]\s*\)\s*\[\s*0\s*\]/,
  /\.replace\s*\(\s*\/\\\?/,
  /new\s+URL\s*\([^)]*\)\s*\.\s*pathname\b/,
  /\.origin\s*\+[^;]{0,120}?\.pathname\b/,
];

function nearestHandler(text, sinkIndex) {
  const rx = new RegExp(MARKER_RE.source, MARKER_RE.flags);
  let last = null;
  let m;
  while ((m = rx.exec(text)) !== null) {
    if (m.index >= sinkIndex) break;
    last = { kind: m[1] || m[2], index: m.index };
  }
  if (!last || sinkIndex - last.index > MARKER_WINDOW) return 'other';
  return last.kind;
}

function windowAround(text, index) {
  const start = Math.max(0, index - WINDOW_CHARS);
  const end = Math.min(text.length, index + WINDOW_CHARS);
  return text.slice(start, end);
}

function isKeyNormalized(windowText) {
  return KEY_NORMALIZE_RES.some((re) => re.test(windowText));
}

// What request is being cached, from the window around the sink:
// the intercepted request (`event.request`), a string literal, or
// an unresolvable expression.
function requestSource(windowText) {
  if (/\bevent\s*\.\s*request\b|\b\w+\s*\.\s*request\b/.test(windowText)) return 'event-request';
  if (/(['"`])(\/|https?:)[^'"`\n\r]*\1/.test(windowText)) return 'literal';
  return 'unresolved';
}

// All cache-write sinks in one source body, each with its kind,
// handler, key-normalization flag and request source. Pure —
// exported for unit tests.
export function findCacheWriteSinks(body) {
  const text = typeof body === 'string' ? body : '';
  if (!text) return [];
  const out = [];
  const rx = new RegExp(SINK_RE.source, SINK_RE.flags);
  let m;
  while ((m = rx.exec(text)) !== null) {
    if (m[1] !== undefined || m[2] !== undefined || m[3] !== undefined) continue;
    if (m[4] === undefined) continue;
    const windowText = windowAround(text, m.index);
    out.push({
      index: m.index,
      kind: m[5],
      line: lineOf(text, m.index),
      snippet: snippetAround(text, m.index, m[4].length),
      handler: nearestHandler(text, m.index),
      keyNormalized: isKeyNormalized(windowText),
      requestSource: requestSource(windowText),
    });
  }
  return out;
}

// Classify one sink: 'candidate-header' (a fetch-handler put of
// the intercepted request — the response varies by unkeyed header
// input while the key is the bare URL), 'candidate-query' (a put
// whose key is query-stripped — the response varies by query while
// the key does not), 'precache' (an install-handler write of
// static assets — no attacker input), or 'unresolved' (any other
// write — recorded, never driven). Pure — exported for unit tests.
export function classifyCacheWriteSink(sink) {
  const s = sink || {};
  if (s.handler === 'install') return 'precache';
  if (s.keyNormalized === true) return 'candidate-query';
  if (s.handler === 'fetch' && s.kind === 'put' && s.requestSource === 'event-request') {
    return 'candidate-header';
  }
  return 'unresolved';
}

// Tier-1 verdict from registrations + sinks. Pure — exported for
// unit tests. `drive` is true when at least one sink is a poison
// candidate; `shapes` names the drive shapes in order (header
// first — the classic unkeyed-input shape — then query).
export function assessSwCacheFlow(registrations, sinks) {
  const regs = Array.isArray(registrations) ? registrations : [];
  const list = Array.isArray(sinks) ? sinks : [];
  const classified = list.map((s) => ({ ...s, verdict: classifyCacheWriteSink(s) }));
  const fetchHandlerPuts = classified.filter((s) => s.verdict === 'candidate-header').length;
  const keyNormalizedSinks = classified.filter((s) => s.verdict === 'candidate-query').length;
  const precacheSinks = classified.filter((s) => s.verdict === 'precache').length;
  const unresolvedSinks = classified.filter((s) => s.verdict === 'unresolved').length;
  const shapes = [];
  if (fetchHandlerPuts > 0) shapes.push('header');
  if (keyNormalizedSinks > 0) shapes.push('query');
  return {
    swRegistered: regs.length > 0,
    swScripts: regs.filter((r) => r && typeof r.url === 'string' && r.url).length,
    cacheWriteSinks: list.length,
    fetchHandlerPuts,
    keyNormalizedSinks,
    precacheSinks,
    unresolvedSinks,
    drive: shapes.length > 0,
    shapes,
  };
}

// Victim URL: the first same-origin API route the scan mined
// (worker data-groups cache API responses, so an API URL is the
// likeliest cached surface), else the pasted page URL itself.
// Pure — exported for unit tests.
export function pickVictimUrl(pageUrl, apiRoutes) {
  let origin = null;
  try {
    origin = new URL(pageUrl).origin;
  } catch {
    return String(pageUrl || '');
  }
  for (const route of Array.isArray(apiRoutes) ? apiRoutes : []) {
    try {
      const u = new URL(String(route), pageUrl);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') continue;
      if (u.origin !== origin) continue;
      return u.toString();
    } catch {
      continue;
    }
  }
  return String(pageUrl || '');
}

// ---- tier-2: canary helpers (pure) ------------------------------------------

export function canaryValue(rid) {
  return `dmpoison-${String(rid || '').replace(/[^A-Za-z0-9]/g, '')}`;
}

export function canaryHost(rid) {
  return `${canaryValue(rid)}.example`;
}

export function withQuery(base, param, value) {
  try {
    const x = new URL(base);
    x.searchParams.set(param, value);
    return x.toString();
  } catch {
    const sep = String(base).includes('?') ? '&' : '?';
    return `${base}${sep}${encodeURIComponent(param)}=${encodeURIComponent(value)}`;
  }
}

// Tier-2 verdict from the drive observations. Pure — exported for
// unit tests. A control render that already serves the canary
// means the oracle itself is contaminated (the control fetch
// carries no poison input, so a canary in its body means the
// drive is untrustworthy).
export function assessDriveResult({ controlClean, victimServed, cachedEntry }) {
  if (controlClean === false) {
    return { verdict: 'uncalibrated', reason: 'control render served the canary — oracle contaminated' };
  }
  if (victimServed) {
    return {
      verdict: 'confirmed',
      reason: 'a later clean fetch served the poisoned cache entry',
      cachedEntry: Boolean(cachedEntry),
    };
  }
  return { verdict: 'not-executed', reason: 'the poisoned entry was never served to a later fetch' };
}

// ---- tier-2: the CDP drive --------------------------------------------------

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// In-page expressions. evaluate() runs them with awaitPromise, so
// each is an async IIFE returning a plain JSON value.
const swReadyExpr = `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  try {
    if (!('serviceWorker' in navigator)) return { ready: false, error: 'no serviceWorker in navigator' };
    const reg = await Promise.race([navigator.serviceWorker.ready, sleep(3000).then(() => null)]);
    if (!reg) return { ready: false, error: 'no active service worker within 3s' };
    return { ready: true, scope: reg.scope || '' };
  } catch (e) { return { ready: false, error: String((e && e.message) || e).slice(0, 200) }; }
})()`;

function fetchExpr(url, canary) {
  return `(async () => {
    try {
      const r = await fetch(${JSON.stringify(url)});
      const t = await r.text();
      return { status: r.status, hasCanary: t.includes(${JSON.stringify(canary)}), len: t.length };
    } catch (e) { return { error: String((e && e.message) || e).slice(0, 200) }; }
  })()`;
}

function fetchHeaderExpr(url, canary, headerName, headerValue) {
  return `(async () => {
    try {
      const r = await fetch(${JSON.stringify(url)}, { headers: { ${JSON.stringify(headerName)}: ${JSON.stringify(headerValue)} } });
      const t = await r.text();
      return { status: r.status, hasCanary: t.includes(${JSON.stringify(canary)}), len: t.length };
    } catch (e) { return { error: String((e && e.message) || e).slice(0, 200) }; }
  })()`;
}

function cacheMatchExpr(url, canary) {
  return `(async () => {
    try {
      const m = await caches.match(${JSON.stringify(url)});
      if (!m) return { cached: false };
      const t = await m.text();
      return { cached: true, hasCanary: t.includes(${JSON.stringify(canary)}), len: t.length };
    } catch (e) { return { error: String((e && e.message) || e).slice(0, 200) }; }
  })()`;
}

async function startBrowser(runner, cdpConnect, image, timeoutMs) {
  const run = await runner('docker', buildCdpContainerRunArgs(image), { timeoutMs });
  if (!run || !run.ok || !String(run.stdout || '').trim()) {
    return {
      ok: false,
      error: String((run && run.stderr) || '').trim().slice(0, 200) || 'browser container failed to start',
    };
  }
  const containerId = String(run.stdout).trim().split(/\s+/)[0];
  let connected = null;
  let lastError = 'cdp endpoint unreachable';
  for (let i = 0; i < AUTH_RENDER_CONNECT_ATTEMPTS; i += 1) {
    const res = await cdpConnect(AUTH_RENDER_DEBUG_ENDPOINT, {});
    if (res && res.ok) {
      connected = res;
      break;
    }
    lastError = (res && res.error) || lastError;
    if (i < AUTH_RENDER_CONNECT_ATTEMPTS - 1 && AUTH_RENDER_CONNECT_DELAY_MS > 0) {
      await sleep(AUTH_RENDER_CONNECT_DELAY_MS);
    }
  }
  if (!connected) return { ok: false, error: lastError, containerId };
  const client = connected.client;
  try {
    const target = await client.newTarget('about:blank');
    await client.attach(target.webSocketDebuggerUrl);
    await client.send('Page.enable');
    await client.send('Runtime.enable');
  } catch (e) {
    return { ok: false, error: e && e.message ? String(e.message).slice(0, 200) : String(e), containerId, client };
  }
  return { ok: true, containerId, client };
}

async function stopBrowser(runner, containerId, client, timeoutMs) {
  try {
    if (client) await client.close();
  } catch {
    // close is best-effort
  }
  if (containerId) {
    try {
      await runner('docker', buildCdpContainerRmArgs(containerId), { timeoutMs: 15000 });
    } catch {
      // container removal is best-effort
    }
  }
}

/**
 * Drive the poison oracle in a real headless browser: a control
 * render in one fresh profile (the victim URL fetched clean must
 * NOT serve the canary), then a poison render in a second fresh
 * profile (a poison fetch, then a clean victim fetch plus a
 * caches.match read). Reuses the authenticated-render browser
 * pattern (transient container, fixed host-loopback CDP endpoint,
 * container removed in a finally). Anonymous: no lab session is
 * carried, so only the logged-out surface is tested.
 * opts.runner / opts.cdpConnect / opts.image are the test seams
 * (defaults mirror authDomRender). Returns { attempted, executed,
 * shape, victimUrl, error, rid, canary, controlClean,
 * cachedEntry }. Never throws.
 */
export async function driveSwCachePoison(pageUrl, victimUrl, shapes, opts = {}) {
  const rid = randomBytes(4).toString('hex');
  const canary = canaryValue(rid);
  const host = canaryHost(rid);
  const out = {
    attempted: false,
    executed: false,
    shape: null,
    victimUrl,
    error: null,
    rid,
    canary,
    controlClean: false,
    cachedEntry: false,
  };
  const runner = typeof opts.runner === 'function' ? opts.runner : runCmd;
  const cdpConnect = typeof opts.cdpConnect === 'function' ? opts.cdpConnect : connectCdp;
  const image = opts.image || DOM_RENDER_IMAGE;
  const timeoutMs =
    Number.isFinite(opts.timeoutMs) && opts.timeoutMs > 0 ? opts.timeoutMs : AUTH_RENDER_TIMEOUT_MS;
  const shapeList = (Array.isArray(shapes) ? shapes : []).filter((s) => s === 'header' || s === 'query');
  if (!shapeList.length) {
    out.error = 'no poison shape to drive';
    return out;
  }
  if (!pageUrl || !victimUrl) {
    out.error = 'no url';
    return out;
  }

  // CONTROL RENDER (fresh profile): the clean victim fetch must
  // not serve the canary. It runs first and in its own profile so
  // the clean response it may cache can never block the poison
  // fetch from reaching the network in the poison render.
  let control = await startBrowser(runner, cdpConnect, image, timeoutMs);
  if (!control.ok) {
    out.error = control.error;
    await stopBrowser(runner, control.containerId, control.client, timeoutMs);
    return out;
  }
  out.attempted = true;
  try {
    await control.client.navigate(pageUrl);
    let ready;
    try {
      ready = await control.client.evaluate(swReadyExpr);
    } catch (e) {
      out.error = `service worker check failed in control render: ${e && e.message ? String(e.message).slice(0, 200) : String(e)}`;
      return out;
    }
    if (!ready || !ready.ready) {
      out.error = `service worker not active in control render: ${(ready && ready.error) || 'unknown'}`;
      return out;
    }
    let ctl;
    try {
      ctl = await control.client.evaluate(fetchExpr(victimUrl, canary));
    } catch (e) {
      out.error = `control fetch failed: ${e && e.message ? String(e.message).slice(0, 200) : String(e)}`;
      return out;
    }
    if (ctl && ctl.error) {
      out.error = `control fetch failed: ${String(ctl.error).slice(0, 200)}`;
      return out;
    }
    if (ctl && ctl.hasCanary) {
      out.error = 'control render served the canary — oracle contaminated';
      return out;
    }
    out.controlClean = true;
  } catch (e) {
    out.error = e && e.message ? String(e.message).slice(0, 200) : String(e);
    return out;
  } finally {
    await stopBrowser(runner, control.containerId, control.client, timeoutMs);
  }

  // POISON RENDER (fresh profile): poison fetch, settle (the
  // worker's cache.put is async), then a clean victim fetch and a
  // caches.match read of the entry itself.
  let poison = await startBrowser(runner, cdpConnect, image, timeoutMs);
  if (!poison.ok) {
    out.error = poison.error;
    await stopBrowser(runner, poison.containerId, poison.client, timeoutMs);
    return out;
  }
  try {
    await poison.client.navigate(pageUrl);
    let ready;
    try {
      ready = await poison.client.evaluate(swReadyExpr);
    } catch (e) {
      out.error = `service worker check failed in poison render: ${e && e.message ? String(e.message).slice(0, 200) : String(e)}`;
      return out;
    }
    if (!ready || !ready.ready) {
      out.error = `service worker not active in poison render: ${(ready && ready.error) || 'unknown'}`;
      return out;
    }
    for (const shape of shapeList) {
      let pf;
      try {
        if (shape === 'header') {
          pf = await poison.client.evaluate(fetchHeaderExpr(victimUrl, canary, POISON_HEADER, host));
        } else {
          pf = await poison.client.evaluate(fetchExpr(withQuery(victimUrl, POISON_PARAM, rid), canary));
        }
      } catch (e) {
        continue; // a failed poison fetch is not a confirmation; try the next shape
      }
      if (pf && pf.error) continue;
      await sleep(DRIVE_SETTLE_MS);
      let victim;
      try {
        victim = await poison.client.evaluate(fetchExpr(victimUrl, canary));
      } catch (e) {
        continue;
      }
      if (victim && victim.error) continue;
      let cached = null;
      try {
        cached = await poison.client.evaluate(cacheMatchExpr(victimUrl, canary));
      } catch {
        cached = null;
      }
      out.cachedEntry = Boolean(cached && cached.cached && cached.hasCanary);
      if (victim && victim.hasCanary) {
        out.executed = true;
        out.shape = shape;
        return out;
      }
    }
    return out;
  } catch (e) {
    out.error = e && e.message ? String(e.message).slice(0, 200) : String(e);
    return out;
  } finally {
    await stopBrowser(runner, poison.containerId, poison.client, timeoutMs);
  }
}

// ---- the probe ---------------------------------------------------------------

/**
 * Probe service worker cache poisoning (#460).
 * @param {string} pageUrl — the pasted page URL (findings are filed under it).
 * @param {object} targets — { bundles: [urls], inline: [bodies] } from
 *   extractSecretTargets (runScan computes it from the page body so a
 *   script-less page skips instead of fetching).
 * @param {object} opts — { labCreds, allowWrite, labTargets, depth,
 *   timeoutMs, headers, fetchPage, runner, cdpConnect, image,
 *   apiRoutes, diagnostics }.
 *   fetchPage is the bundle/worker-script fetch seam (defaults to
 *   fingerprint.fetchPage); runner / cdpConnect / image are the
 *   CDP-drive seams; apiRoutes feeds the victim-URL pick.
 * @returns {object[]} findings (class 'sw_cache_poisoning', medium) —
 *   at most 1 per scan: a poisoned cache entry served to a later
 *   clean fetch, with a control render that did not serve it.
 */
export async function probeSwCachePoisoning(pageUrl, targets, opts = {}) {
  const findings = [];
  const diag = opts && typeof opts.diagnostics === 'object' && opts.diagnostics ? opts.diagnostics : null;
  const setDiag = (k, v) => {
    if (diag) diag[k] = v;
  };
  let origin;
  try {
    origin = new URL(pageUrl).origin;
  } catch {
    return findings;
  }
  const fetchFn = typeof opts.fetchPage === 'function' ? opts.fetchPage : fetchPage;
  const bundles = Array.isArray(targets && targets.bundles)
    ? targets.bundles.slice(0, MAX_BUNDLES)
    : [];
  const inline = Array.isArray(targets && targets.inline)
    ? targets.inline.slice(0, MAX_INLINE)
    : [];

  // TIER 1a — mine first-party code for worker registrations.
  // Vendor bundles are excluded by the same gates as domXssSinks
  // (a library registering a worker is framework code, not the
  // app's vuln). A registration inside a string or a comment never
  // matches (the miner consumes literals and comments first).
  // Each bundle is fetched ONCE and its body reused for the sink
  // mine below.
  const registrations = [];
  const bundleBodies = [];
  for (const bundleUrl of bundles) {
    if (isVendorBundle(bundleUrl)) continue;
    let res;
    try {
      res = await fetchFn(bundleUrl, opts);
    } catch {
      continue;
    }
    if (!res || res.status !== 200 || !res.body) continue;
    bundleBodies.push({ url: bundleUrl, body: res.body });
    for (const r of findSwRegistrations(res.body)) {
      registrations.push({ ...r, source: bundleUrl });
    }
  }
  inline.forEach((body, i) => {
    for (const r of findSwRegistrations(body)) {
      registrations.push({ ...r, source: `inline <script> block #${i + 1}` });
    }
  });
  // Resolve the worker script URLs same-origin (a cross-origin
  // registration is rejected by the browser, so it can never
  // cache for this origin).
  const swScriptUrls = [];
  for (const reg of registrations) {
    if (!reg.url) continue;
    try {
      const u = new URL(reg.url, pageUrl);
      if (u.origin !== origin) continue;
      const s = u.toString();
      if (!swScriptUrls.includes(s)) swScriptUrls.push(s);
    } catch {
      continue;
    }
  }
  setDiag('swRegistered', registrations.length > 0);
  setDiag('swScripts', swScriptUrls.length);

  // TIER 1b — fetch the worker scripts and mine cache-write sinks.
  // Page scripts can write window.caches too, so bundles and inline
  // blocks are mined for sinks as well (labelled by source).
  const sinks = [];
  for (const swUrl of swScriptUrls.slice(0, MAX_SW_SCRIPTS)) {
    let res;
    try {
      res = await fetchFn(swUrl, opts);
    } catch {
      continue;
    }
    if (!res || res.status !== 200 || !res.body) continue;
    for (const s of findCacheWriteSinks(res.body)) {
      sinks.push({ ...s, source: swUrl });
    }
  }
  for (const { url: bundleUrl, body } of bundleBodies) {
    for (const s of findCacheWriteSinks(body)) {
      sinks.push({ ...s, source: bundleUrl });
    }
  }
  inline.forEach((body, i) => {
    for (const s of findCacheWriteSinks(body)) {
      sinks.push({ ...s, source: `inline <script> block #${i + 1}` });
    }
  });
  const flow = assessSwCacheFlow(registrations, sinks);
  setDiag('cacheWriteSinks', flow.cacheWriteSinks);
  setDiag('fetchHandlerPuts', flow.fetchHandlerPuts);
  setDiag('keyNormalizedSinks', flow.keyNormalizedSinks);
  setDiag('precacheSinks', flow.precacheSinks);
  setDiag('unresolvedSinks', flow.unresolvedSinks);
  if (!flow.drive) return findings; // proven true negative: no poisonable cache write

  // TIER 2 — drive the poison oracle in a real browser. Lab-gated
  // like the DOM trio: the drive navigates the target's origin
  // with attacker input, so it never runs outside the lab gate.
  const creds = opts.labCreds;
  if (!creds || !creds.username || !creds.password) return findings;
  if (opts.allowWrite !== true) return findings;
  if (!isLabTargetHost(pageUrl, opts.labTargets)) return findings;
  if ((opts.depth || 'standard') === 'quick') return findings;

  const victimUrl = pickVictimUrl(pageUrl, opts.apiRoutes);
  setDiag('driveAttempted', true);
  const drive = await driveSwCachePoison(pageUrl, victimUrl, flow.shapes, opts);
  setDiag('driveExecuted', drive.executed);
  // A drive error (browser failed to start, worker never active,
  // control contaminated) leaves the oracle uncalibrated — never a
  // finding, and never a proven true negative either.
  const verdict = drive.error
    ? { verdict: 'uncalibrated', reason: drive.error }
    : assessDriveResult({
        controlClean: drive.controlClean,
        victimServed: drive.executed,
        cachedEntry: drive.cachedEntry,
      });
  if (verdict.verdict !== 'confirmed') return findings;

  const sink = sinks.find((s) => classifyCacheWriteSink(s) === 'candidate-header')
    || sinks.find((s) => classifyCacheWriteSink(s) === 'candidate-query');
  findings.push({
    class: 'sw_cache_poisoning',
    id: 'sw-cache-poisoning',
    title: 'Service worker cache poisoning — poisoned cache entry served to a later fetch (MEDIUM)',
    severity: 'medium',
    url: pageUrl,
    parameter: victimUrl,
    evidence: {
      request:
        `Control render: clean GET ${victimUrl} — body carried no canary. ` +
        `Poison render: GET ${victimUrl} with ${drive.shape === 'header' ? `${POISON_HEADER}: ${drive.canary}.example` : `?${POISON_PARAM}=${drive.rid}`} ` +
        `(canary ${drive.canary}), then a clean GET ${victimUrl} — the victim fetch served the canary from the worker cache` +
        (drive.cachedEntry ? ' (caches.match confirms the entry holds the canary)' : ' (caches.match did not confirm the entry — the serve itself is the evidence)') +
        '.',
      response:
        `Real-browser poison: after the poison fetch, a later clean fetch of ${victimUrl} returned a body containing ` +
        `the canary ${drive.canary}, served from the service worker cache — the cached response was written under ` +
        `the bare URL key while its body varied by the poison input. ` +
        (sink
          ? `Static mine found the cache-write sink in ${sink.source} (line ${sink.line}, ${sink.kind} in a ${sink.handler} handler): ${sink.snippet} `
          : 'Static mine found cache-write sinks in first-party worker code. ') +
        `The poison shape was '${drive.shape}': the cache key never sees the poison input, so every later fetch of the URL is served the poisoned entry.`,
      impact_demo:
        'Service worker cache poisoning — an attacker crafts a request whose response carries attacker content (a script, a phishing page, a defaced body) and the worker caches it under the bare URL; every later visitor of that URL is served the poisoned entry from the cache instead of a fresh server response, even after the server is fixed (the entry persists until the cache is cleared). Key the cache on the full request (including every input the response varies by), never cache responses that vary by unkeyed input, and add cache-busting / validation for cached entries (PortSwigger Web Cache Poisoning / CWE-444).',
      signalCorrelated: true,
    },
  });
  return findings;
}

export const __swCachePoisoningMeta = { phases: ['sw-cache-poisoning'], depth: ['standard', 'deep'] };
