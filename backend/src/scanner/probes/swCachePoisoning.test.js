// Dark Matter rule-based scanner — Service worker cache poisoning tests
// (coverage row #460 [Medium] Service worker cache poisoning, CWE-444;
// phase 111 'sw-cache-poisoning').
//
// The probe has two tiers: a static mine (worker registrations +
// cache-write sinks in first-party code) and — only when a poisonable
// sink exists — a CDP poison drive in a real browser (control render
// + poison render). Tests cover the mine and the drive with fake
// fetchPage / fake runner / fake CDP seams; no docker, no network.
// Fixtures are plain code snippets (no secrets), and every fake is
// per-test so no state leaks between tests.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  probeSwCachePoisoning,
  driveSwCachePoison,
  findSwRegistrations,
  findCacheWriteSinks,
  classifyCacheWriteSink,
  assessSwCacheFlow,
  pickVictimUrl,
  assessDriveResult,
  canaryValue,
  canaryHost,
  withQuery,
  __swCachePoisoningMeta,
} from './swCachePoisoning.js';
import { assessConfirmation } from '../../hunt-intel/differential.js';

const LAB_URL = 'http://172.17.0.1:3000/';
const BUNDLE_URL = 'http://172.17.0.1:3000/main.js';
const SW_URL = 'http://172.17.0.1:3000/sw.js';
const API_URL = 'http://172.17.0.1:3000/rest/products/search';
const LAB_TARGETS = ['172.17.0.1'];
const LAB_CREDS = { username: 'lab-user', password: 'lab-pass' };

function labOpts(extra = {}) {
  return {
    labCreds: LAB_CREDS,
    allowWrite: true,
    labTargets: LAB_TARGETS,
    depth: 'standard',
    apiRoutes: [API_URL],
    ...extra,
  };
}

// ---- fixtures ---------------------------------------------------------------

const NO_SW_BUNDLE =
  '// app bootstrap\n' +
  "fetch('/api/data').then((r) => r.json());\n";

const REG_ONLY_BUNDLE =
  "if ('serviceWorker' in navigator) {\n" +
  "  navigator.serviceWorker.register('/sw.js');\n" +
  '}\n';

const REG_VARIABLE_BUNDLE =
  'navigator.serviceWorker.register(scriptUrl);\n';

const REG_IN_STRING_BUNDLE =
  'const s = "navigator.serviceWorker.register(\'/fake.js\')";\n';

const REG_IN_COMMENT_BUNDLE =
  "// navigator.serviceWorker.register('/fake.js')\n" +
  'console.log("boot");\n';

const REG_CROSS_ORIGIN_BUNDLE =
  "navigator.serviceWorker.register('https://other.example/sw.js');\n";

const SW_PRECACHE =
  "self.addEventListener('install', (e) => {\n" +
  "  e.waitUntil(caches.open('v1').then((cache) => cache.addAll(['/index.html', '/main.js'])));\n" +
  '});\n';

const SW_FETCH_PUT =
  "self.addEventListener('fetch', (event) => {\n" +
  "  event.respondWith(caches.open('v1').then((cache) => cache.match(event.request).then((hit) => hit || fetch(event.request).then((res) => { cache.put(event.request, res.clone()); return res; }))));\n" +
  '});\n';

const SW_KEYNORM =
  "self.addEventListener('fetch', (event) => {\n" +
  "  const key = new Request(event.request.url.split('?')[0]);\n" +
  "  event.respondWith(caches.open('v1').then((cache) => cache.match(key).then((hit) => hit || fetch(event.request).then((res) => { cache.put(key, res.clone()); return res; }))));\n" +
  '});\n';

const SW_OPEN_ONLY =
  "self.addEventListener('fetch', (event) => {\n" +
  "  event.respondWith(caches.open('v1').then((cache) => cache.match(event.request)));\n" +
  '});\n';

const SW_MIXED =
  "self.addEventListener('install', (e) => {\n" +
  "  e.waitUntil(caches.open('v1').then((cache) => cache.addAll(['/index.html'])));\n" +
  '});\n' +
  "self.addEventListener('fetch', (event) => {\n" +
  "  event.respondWith(caches.open('v1').then((cache) => cache.match(event.request).then((hit) => hit || fetch(event.request).then((res) => { cache.put(event.request, res.clone()); return res; }))));\n" +
  '});\n';

// ---- fakes -----------------------------------------------------------------

// Fake fetchPage: serves one body per URL.
function fakeFetchPage(bodiesByUrl) {
  return async (url) => {
    const body = Object.prototype.hasOwnProperty.call(bodiesByUrl, url) ? bodiesByUrl[url] : null;
    if (body === null) return { status: 404, body: '' };
    return { status: 200, body };
  };
}

// Fake CDP client. `mode` decides what the poison drive observes:
//   'no-worker'    — no active service worker in either render.
//   'clean'        — worker active; no fetch ever serves the canary.
//   'poisoned'     — worker active; the poison fetch is reflected and
//                    the later victim fetch + caches.match serve it.
//   'control-flag' — even the control fetch serves the canary
//                    (contaminated oracle).
function fakeCdpClient(mode) {
  let poisoned = false;
  const navigations = [];
  const client = {
    endpoint: 'http://127.0.0.1:9222',
    navigations,
    async newTarget() {
      return { webSocketDebuggerUrl: 'ws://127.0.0.1:9222/devtools/page/FAKE' };
    },
    async attach() {},
    async send() {
      return {};
    },
    async navigate(url) {
      navigations.push(String(url));
      return {};
    },
    async evaluate(expr) {
      const text = String(expr || '');
      // Service-worker readiness probe.
      if (text.includes('serviceWorker')) {
        if (mode === 'no-worker') return { ready: false, error: 'no active service worker within 3s' };
        return { ready: true, scope: LAB_URL };
      }
      // Cache-entry read.
      if (text.includes('caches.match')) {
        if (mode === 'poisoned' && poisoned) return { cached: true, hasCanary: true, len: 99 };
        return { cached: false };
      }
      // Poison fetch, header shape (unkeyed input).
      if (text.includes('X-Forwarded-Host')) {
        if (mode === 'poisoned') {
          poisoned = true;
          return { status: 200, hasCanary: true, len: 50 };
        }
        return { status: 200, hasCanary: false, len: 50 };
      }
      // Poison fetch, query shape (the URL carries ?dmpoison=).
      if (text.includes('dmpoison=')) {
        if (mode === 'poisoned') {
          poisoned = true;
          return { status: 200, hasCanary: true, len: 50 };
        }
        return { status: 200, hasCanary: false, len: 50 };
      }
      // Control / victim fetch of the bare victim URL.
      if (mode === 'control-flag') return { status: 200, hasCanary: true, len: 50 };
      if (mode === 'poisoned' && poisoned) return { status: 200, hasCanary: true, len: 50 };
      return { status: 200, hasCanary: false, len: 50 };
    },
    async close() {},
  };
  return client;
}

function fakeCdpConnect(mode) {
  return async () => ({ ok: true, client: fakeCdpClient(mode) });
}

// Fake docker runner: 'run' starts a container, 'rm' removes it.
function fakeRunner(calls) {
  return async (_file, args) => {
    calls.push(Array.isArray(args) ? args.slice() : args);
    if (Array.isArray(args) && args[0] === 'run') return { ok: true, stdout: 'fake-container-id\n' };
    if (Array.isArray(args) && args[0] === 'rm') return { ok: true, stdout: '' };
    return { ok: true, stdout: '' };
  };
}

function failingRunner() {
  return async () => ({ ok: false, stdout: '', stderr: 'Cannot connect to the Docker daemon' });
}

// Probe with the CDP drive faked (mode selects the observed outcome).
async function probeWithFakeCdp(mode, targets, extra = {}) {
  const calls = [];
  const diag = {};
  const findings = await probeSwCachePoisoning(LAB_URL, targets, labOpts({
    fetchPage: fakeFetchPage(extra.bodies || {}),
    runner: fakeRunner(calls),
    cdpConnect: fakeCdpConnect(mode),
    diagnostics: diag,
    ...(extra.opts || {}),
  }));
  return { findings, diag, calls };
}

// ---- tier-1: registrations ---------------------------------------------------

describe('sw-cache-poisoning tier-1 mine', () => {
  it('SW-01: a literal registration is found with its script URL and line', () => {
    const regs = findSwRegistrations(REG_ONLY_BUNDLE);
    assert.equal(regs.length, 1);
    assert.equal(regs[0].url, '/sw.js');
    assert.equal(regs[0].line, 2);
  });

  it('SW-02: a variable registration has no resolvable URL', () => {
    const regs = findSwRegistrations(REG_VARIABLE_BUNDLE);
    assert.equal(regs.length, 1);
    assert.equal(regs[0].url, null);
  });

  it('SW-03: a registration inside a string or a comment never matches', () => {
    assert.equal(findSwRegistrations(REG_IN_STRING_BUNDLE).length, 0);
    assert.equal(findSwRegistrations(REG_IN_COMMENT_BUNDLE).length, 0);
  });

  it('SW-04: cache-write sinks are found with kind, handler and line', () => {
    const sinks = findCacheWriteSinks(SW_FETCH_PUT);
    assert.equal(sinks.length, 1);
    assert.equal(sinks[0].kind, 'put');
    assert.equal(sinks[0].handler, 'fetch');
    assert.equal(sinks[0].requestSource, 'event-request');
    const pre = findCacheWriteSinks(SW_PRECACHE);
    assert.equal(pre.length, 1);
    assert.equal(pre[0].kind, 'addAll');
    assert.equal(pre[0].handler, 'install');
  });

  it('SW-05: an install-handler addAll is precache', () => {
    const sinks = findCacheWriteSinks(SW_PRECACHE);
    assert.equal(classifyCacheWriteSink(sinks[0]), 'precache');
  });

  it('SW-06: a fetch-handler put of the intercepted request is a header candidate', () => {
    const sinks = findCacheWriteSinks(SW_FETCH_PUT);
    assert.equal(classifyCacheWriteSink(sinks[0]), 'candidate-header');
  });

  it('SW-07: a query-stripped put is a query candidate', () => {
    const sinks = findCacheWriteSinks(SW_KEYNORM);
    assert.equal(sinks.length, 1);
    assert.equal(sinks[0].keyNormalized, true);
    assert.equal(classifyCacheWriteSink(sinks[0]), 'candidate-query');
  });

  it('SW-08: caches.open / cache.match alone are not write sinks', () => {
    assert.equal(findCacheWriteSinks(SW_OPEN_ONLY).length, 0);
    assert.equal(findCacheWriteSinks(NO_SW_BUNDLE).length, 0);
  });

  it('SW-09: the flow verdict aggregates counts, shapes and the drive flag', () => {
    const flow = assessSwCacheFlow(
      findSwRegistrations(REG_ONLY_BUNDLE),
      [...findCacheWriteSinks(SW_MIXED)]
    );
    assert.equal(flow.swRegistered, true);
    assert.equal(flow.cacheWriteSinks, 2);
    assert.equal(flow.fetchHandlerPuts, 1);
    assert.equal(flow.precacheSinks, 1);
    assert.equal(flow.keyNormalizedSinks, 0);
    assert.equal(flow.drive, true);
    assert.deepEqual(flow.shapes, ['header']);
    const none = assessSwCacheFlow([], []);
    assert.equal(none.swRegistered, false);
    assert.equal(none.drive, false);
    assert.deepEqual(none.shapes, []);
  });

  it('SW-10: the victim URL prefers a same-origin API route, else the page URL', () => {
    assert.equal(pickVictimUrl(LAB_URL, [API_URL]), API_URL);
    assert.equal(pickVictimUrl(LAB_URL, ['https://other.example/x']), LAB_URL);
    assert.equal(pickVictimUrl(LAB_URL, []), LAB_URL);
  });

  it('SW-11: canary helpers are deterministic and safe to embed', () => {
    assert.equal(canaryValue('ab12'), 'dmpoison-ab12');
    assert.equal(canaryHost('ab12'), 'dmpoison-ab12.example');
    assert.equal(withQuery('http://172.17.0.1:3000/a', 'dmpoison', 'ab12'), 'http://172.17.0.1:3000/a?dmpoison=ab12');
  });

  it('SW-12: the drive verdict needs a clean control and a served victim', () => {
    assert.equal(assessDriveResult({ controlClean: true, victimServed: true, cachedEntry: true }).verdict, 'confirmed');
    assert.equal(assessDriveResult({ controlClean: true, victimServed: false, cachedEntry: false }).verdict, 'not-executed');
    assert.equal(assessDriveResult({ controlClean: false, victimServed: true, cachedEntry: true }).verdict, 'uncalibrated');
  });
});

// ---- the probe, no drive ------------------------------------------------------

describe('sw-cache-poisoning probe (tier 1 only)', () => {
  it('SW-13: no worker at all → no findings, swRegistered false', async () => {
    const { findings, diag } = await probeWithFakeCdp('clean', { bundles: [BUNDLE_URL], inline: [] }, {
      bodies: { [BUNDLE_URL]: NO_SW_BUNDLE },
    });
    assert.equal(findings.length, 0);
    assert.equal(diag.swRegistered, false);
    assert.equal(diag.swScripts, 0);
    assert.equal(diag.cacheWriteSinks, 0);
    assert.equal(diag.driveAttempted, undefined);
  });

  it('SW-14: precache-only worker → no findings, no drive', async () => {
    const { findings, diag } = await probeWithFakeCdp('clean', { bundles: [BUNDLE_URL], inline: [] }, {
      bodies: { [BUNDLE_URL]: REG_ONLY_BUNDLE, [SW_URL]: SW_PRECACHE },
    });
    assert.equal(findings.length, 0);
    assert.equal(diag.swRegistered, true);
    assert.equal(diag.swScripts, 1);
    assert.equal(diag.precacheSinks, 1);
    assert.equal(diag.driveAttempted, undefined);
  });

  it('SW-15: a registration in a vendor bundle is skipped', async () => {
    const vendorUrl = 'http://172.17.0.1:3000/polyfills.js';
    const { findings, diag } = await probeWithFakeCdp('clean', { bundles: [vendorUrl], inline: [] }, {
      bodies: { [vendorUrl]: REG_ONLY_BUNDLE },
    });
    assert.equal(findings.length, 0);
    assert.equal(diag.swRegistered, false);
  });

  it('SW-16: a cross-origin registration is never fetched', async () => {
    const { findings, diag } = await probeWithFakeCdp('clean', { bundles: [BUNDLE_URL], inline: [] }, {
      bodies: { [BUNDLE_URL]: REG_CROSS_ORIGIN_BUNDLE },
    });
    assert.equal(findings.length, 0);
    assert.equal(diag.swScripts, 0);
  });

  it('SW-17: a candidate sink without lab creds never drives', async () => {
    const { findings, diag } = await probeWithFakeCdp('clean', { bundles: [BUNDLE_URL], inline: [] }, {
      bodies: { [BUNDLE_URL]: REG_ONLY_BUNDLE, [SW_URL]: SW_FETCH_PUT },
      opts: { labCreds: null },
    });
    assert.equal(findings.length, 0);
    assert.equal(diag.fetchHandlerPuts, 1);
    assert.equal(diag.driveAttempted, undefined);
  });

  it('SW-18: depth quick never drives', async () => {
    const { findings, diag } = await probeWithFakeCdp('clean', { bundles: [BUNDLE_URL], inline: [] }, {
      bodies: { [BUNDLE_URL]: REG_ONLY_BUNDLE, [SW_URL]: SW_FETCH_PUT },
      opts: { depth: 'quick' },
    });
    assert.equal(findings.length, 0);
    // Tier 1 still ran (the mine is not depth-gated): the sink was
    // found, only the drive was skipped.
    assert.equal(diag.swRegistered, true);
    assert.equal(diag.fetchHandlerPuts, 1);
    assert.equal(diag.driveAttempted, undefined);
  });
});

// ---- the probe, CDP drive ------------------------------------------------------

describe('sw-cache-poisoning probe (tier 2 drive)', () => {
  it('SW-19: clean victim fetch after a reflected poison → no finding, drive attempted', async () => {
    const { findings, diag } = await probeWithFakeCdp('clean', { bundles: [BUNDLE_URL], inline: [] }, {
      bodies: { [BUNDLE_URL]: REG_ONLY_BUNDLE, [SW_URL]: SW_FETCH_PUT },
    });
    assert.equal(findings.length, 0);
    assert.equal(diag.driveAttempted, true);
    assert.equal(diag.driveExecuted, false);
  });

  it('SW-20: victim fetch serves the poisoned entry → exactly one medium finding, header shape', async () => {
    const { findings, diag } = await probeWithFakeCdp('poisoned', { bundles: [BUNDLE_URL], inline: [] }, {
      bodies: { [BUNDLE_URL]: REG_ONLY_BUNDLE, [SW_URL]: SW_FETCH_PUT },
    });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].class, 'sw_cache_poisoning');
    assert.equal(findings[0].severity, 'medium');
    assert.equal(findings[0].parameter, API_URL);
    assert.equal(diag.driveAttempted, true);
    assert.equal(diag.driveExecuted, true);
  });

  it('SW-21: a query-stripped put poisons via the query shape', async () => {
    const { findings, diag } = await probeWithFakeCdp('poisoned', { bundles: [BUNDLE_URL], inline: [] }, {
      bodies: { [BUNDLE_URL]: REG_ONLY_BUNDLE, [SW_URL]: SW_KEYNORM },
    });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].class, 'sw_cache_poisoning');
    assert.equal(diag.keyNormalizedSinks, 1);
    assert.equal(diag.driveExecuted, true);
  });

  it('SW-22: no active worker in the drive → uncalibrated, no finding', async () => {
    const { findings, diag } = await probeWithFakeCdp('no-worker', { bundles: [BUNDLE_URL], inline: [] }, {
      bodies: { [BUNDLE_URL]: REG_ONLY_BUNDLE, [SW_URL]: SW_FETCH_PUT },
    });
    assert.equal(findings.length, 0);
    assert.equal(diag.driveAttempted, true);
    assert.equal(diag.driveExecuted, false);
  });

  it('SW-23: control render serves the canary → uncalibrated, no finding', async () => {
    const { findings, diag } = await probeWithFakeCdp('control-flag', { bundles: [BUNDLE_URL], inline: [] }, {
      bodies: { [BUNDLE_URL]: REG_ONLY_BUNDLE, [SW_URL]: SW_FETCH_PUT },
    });
    assert.equal(findings.length, 0);
    assert.equal(diag.driveAttempted, true);
    assert.equal(diag.driveExecuted, false);
  });

  it('SW-24: the drive never throws when the runner fails', async () => {
    const out = await driveSwCachePoison(LAB_URL, API_URL, ['header'], {
      runner: failingRunner(),
      cdpConnect: fakeCdpConnect('poisoned'),
    });
    assert.equal(out.attempted, false);
    assert.equal(out.executed, false);
    assert.ok(out.error);
  });

  it('SW-25: a probe finding judges confirmed on the default protocol', async () => {
    const { findings } = await probeWithFakeCdp('poisoned', { bundles: [BUNDLE_URL], inline: [] }, {
      bodies: { [BUNDLE_URL]: REG_ONLY_BUNDLE, [SW_URL]: SW_FETCH_PUT },
    });
    assert.equal(findings.length, 1);
    const { verdict } = assessConfirmation(findings[0]);
    assert.equal(verdict, 'confirmed');
  });

  it('SW-26: diagnostics count every sink shape on a mixed worker', async () => {
    const { findings, diag } = await probeWithFakeCdp('clean', { bundles: [BUNDLE_URL], inline: [] }, {
      bodies: { [BUNDLE_URL]: REG_ONLY_BUNDLE, [SW_URL]: SW_MIXED },
    });
    assert.equal(findings.length, 0);
    assert.equal(diag.cacheWriteSinks, 2);
    assert.equal(diag.fetchHandlerPuts, 1);
    assert.equal(diag.precacheSinks, 1);
    assert.equal(diag.keyNormalizedSinks, 0);
    assert.equal(diag.unresolvedSinks, 0);
  });

  it('SW-27: at most 1 finding per scan even with two candidate sinks', async () => {
    const both = SW_FETCH_PUT + '\n' + SW_KEYNORM;
    const { findings } = await probeWithFakeCdp('poisoned', { bundles: [BUNDLE_URL], inline: [] }, {
      bodies: { [BUNDLE_URL]: REG_ONLY_BUNDLE, [SW_URL]: both },
    });
    assert.equal(findings.length, 1);
  });

  it('SW-28: phase metadata names the new phase and its depths', () => {
    assert.deepEqual(__swCachePoisoningMeta.phases, ['sw-cache-poisoning']);
    assert.deepEqual(__swCachePoisoningMeta.depth, ['standard', 'deep']);
  });
});
