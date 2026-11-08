// Dark Matter rule-based scanner — DOM XSS via postMessage tests
// (coverage row #274 [High] XSS — DOM via postMessage, CWE-79 |
// PortSwigger DOM XSS; phase 93 'dom-postmessage').
//
// The probe has two tiers: a static mine (message listeners in
// first-party code) and — only when a listener exists — a CDP
// execution drive in a real browser. Tests cover the mine and the
// drive with fake fetchPage / fake runner / fake CDP seams; no
// docker, no network. Fixtures are built by concatenation, never
// single literals (the repo's secret-shape rule), and every fake is
// per-test so no state leaks between tests.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  probeDomPostMessage,
  drivePostMessageExecution,
  findMessageListeners,
  assessMessageFlow,
  assessDriveResult,
  flagName,
  deliveredFlagName,
  controlData,
  evalCanaryData,
  markupCanaryData,
  iframePostExpr,
} from './domPostMessage.js';
import { assessConfirmation } from '../../hunt-intel/differential.js';

const LAB_URL = 'http://172.17.0.1:3000/';
const BUNDLE_URL = 'http://172.17.0.1:3000/main.js';
const VENDOR_URL = 'http://172.17.0.1:3000/vendor.abc123.js';
const LAB_TARGETS = ['172.17.0.1'];
const LAB_CREDS = { username: 'lab-user', password: 'lab-pass' };

function labOpts(extra = {}) {
  return {
    labCreds: LAB_CREDS,
    allowWrite: true,
    labTargets: LAB_TARGETS,
    depth: 'standard',
    ...extra,
  };
}

// ---- fixtures (concatenation, never single literals) -----------------------

const BUNDLE_CLEAN =
  'const app = ' + "'demo';\n" +
  'const el = document.querySelector(' + "'#out');\n" +
  'el.textContent = ' + "'hello';\n";

const BUNDLE_SAFE =
  'window.addEventListener(' + "'message', function (e) {\n" +
  '  const el = document.querySelector(' + "'#out');\n" +
  '  el.textContent = e.data;\n' +
  '});\n';

const BUNDLE_INNERHTML =
  'window.addEventListener(' + "'message', function (e) {\n" +
  '  const el = document.querySelector(' + "'#out');\n" +
  '  el.innerHTML = e.data;\n' +
  '});\n';

const BUNDLE_EVAL =
  'window.addEventListener(' + "'message', function (e) {\n" +
  '  eval(e.data);\n' +
  '});\n';

const BUNDLE_ONMESSAGE =
  'window.onmessage = function (e) {\n' +
  '  const el = document.querySelector(' + "'#out');\n" +
  '  el.innerHTML = e.data;\n' +
  '};\n';

// ---- fakes -----------------------------------------------------------------

// Fake fetchPage: serves one bundle body per URL.
function fakeFetchPage(bodiesByUrl) {
  return async (url) => {
    const body = Object.prototype.hasOwnProperty.call(bodiesByUrl, url) ? bodiesByUrl[url] : null;
    if (body === null) return { status: 404, body: '' };
    return { status: 200, body };
  };
}

// Fake CDP client. `mode` decides what the canary observes:
//   'noexec'         — messages arrive, nothing executes.
//   'exec-eval'      — the eval-family canary executes, markup does not.
//   'exec-markup'    — the markup canary executes, eval does not.
//   'reflected-only' — the flag name appears in the DOM as text, but
//                      the flag is never set (sunk, not executed).
//   'control-flag'   — even the control message sets the flag
//                      (contaminated oracle).
//   'undelivered'    — no posted message ever arrives at the window.
function fakeCdpClient(mode) {
  const state = { delivered: false, flagSet: false };
  const navigations = [];
  const posts = [];
  return {
    navigations,
    posts,
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
      const s = String(expr);
      // Delivery-flag read.
      if (/^window\.(__dmPostMsgRx_[0-9a-f]+) === 1$/.test(s)) return state.delivered;
      // Execution-flag read.
      if (/^window\.(__dmPostMsg_[0-9a-f]+) === 1$/.test(s)) return state.flagSet;
      // Delivery-flag reset.
      if (/^window\.(__dmPostMsgRx_[0-9a-f]+) = 0$/.test(s)) {
        state.delivered = false;
        return 0;
      }
      // Delivery-listener install.
      if (s.includes('addEventListener')) return 'installed';
      // Reflected check.
      if (s.startsWith('document.documentElement.outerHTML.includes(')) {
        return mode === 'exec-markup' || mode === 'reflected-only';
      }
      // Iframe post: the payload is percent-encoded inside the
      // data: URL, so shapes are told apart by encoded markers.
      if (s.includes('data:text/html')) {
        posts.push(s);
        if (mode === 'undelivered') return 'posted';
        state.delivered = true;
        if (mode === 'control-flag') {
          state.flagSet = true;
        } else if (mode === 'exec-eval' && s.includes('window.__dmPostMsg_') && !s.includes('onerror')) {
          state.flagSet = true;
        } else if (mode === 'exec-markup' && s.includes('onerror')) {
          state.flagSet = true;
        }
        return 'posted';
      }
      return undefined;
    },
    async close() {},
  };
}

function fakeCdpConnect(mode) {
  const client = fakeCdpClient(mode);
  return async () => ({ ok: true, client });
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
  const bodies = extra.bodiesByUrl || { [BUNDLE_URL]: extra.bundleBody || BUNDLE_CLEAN };
  const findings = await probeDomPostMessage(LAB_URL, targets, labOpts({
    fetchPage: fakeFetchPage(bodies),
    runner: fakeRunner(calls),
    cdpConnect: fakeCdpConnect(mode),
    diagnostics: diag,
  }));
  return { findings, diag, calls };
}

describe('domPostMessage — tier-1 mine (pure)', () => {
  it('PM-1: finds addEventListener message + window.onmessage + bare onmessage, ignores click', () => {
    const body =
      'window.addEventListener(' + "'message', handler);\n" +
      'document.addEventListener(' + '"message", handler2);\n' +
      'window.onmessage = function (e) {};\n' +
      'onmessage = function (e) {};\n' +
      'el.addEventListener(' + "'click', handler);\n";
    const listeners = findMessageListeners(body);
    assert.equal(listeners.length, 4);
    assert.deepEqual(listeners.map((r) => r.kind), ['addEventListener', 'addEventListener', 'onmessage', 'onmessage']);
    assert.deepEqual(listeners.map((r) => r.line), [1, 2, 3, 4]);
    assert.ok(listeners.every((r) => typeof r.snippet === 'string' && r.snippet.length > 0));
  });

  it('PM-2: clean code has no listeners', () => {
    assert.deepEqual(findMessageListeners(BUNDLE_CLEAN), []);
    assert.deepEqual(findMessageListeners(''), []);
    assert.deepEqual(findMessageListeners(null), []);
  });

  it('PM-3: a listener near innerHTML is near-sink; textContent only is safe-only', () => {
    const inner = findMessageListeners(BUNDLE_INNERHTML);
    assert.equal(inner.length, 1);
    assert.equal(inner[0].nearSink, true);
    assert.equal(inner[0].sinkKind, 'innerHTML');
    const safe = findMessageListeners(BUNDLE_SAFE);
    assert.equal(safe.length, 1);
    assert.equal(safe[0].nearSink, false);
    assert.equal(safe[0].safeOnly, true);
    assert.equal(safe[0].sinkKind, 'textContent');
  });

  it('PM-4: assessMessageFlow drives only when a listener exists', () => {
    assert.deepEqual(assessMessageFlow([]), { listeners: 0, nearSink: 0, drive: false });
    const safe = findMessageListeners(BUNDLE_SAFE);
    assert.deepEqual(assessMessageFlow(safe), { listeners: 1, nearSink: 0, drive: true });
    assert.deepEqual(assessMessageFlow(findMessageListeners(BUNDLE_INNERHTML)), { listeners: 1, nearSink: 1, drive: true });
  });

  it('PM-5: canary builders — control carries no flag name, eval is plain JS, markup carries the flag', () => {
    const rid = 'a1b2c3d4';
    assert.equal(flagName(rid), '__dmPostMsg_a1b2c3d4');
    assert.equal(deliveredFlagName(rid), '__dmPostMsgRx_a1b2c3d4');
    assert.deepEqual(controlData(rid), { dmcontrol: 'a1b2c3d4' });
    assert.ok(!JSON.stringify(controlData(rid)).includes('__dmPostMsg_'));
    assert.equal(evalCanaryData(rid), 'window.__dmPostMsg_a1b2c3d4=1');
    const markup = markupCanaryData(rid);
    assert.ok(markup.includes('<img src=x onerror="window.__dmPostMsg_a1b2c3d4=1">'));
    const expr = iframePostExpr(controlData(rid));
    assert.ok(expr.includes('data:text/html,'), 'iframe post must use a data: URL document');
    assert.ok(expr.includes('parent.postMessage'), 'iframe must post to the parent window');
    assert.ok(!expr.includes('__dmPostMsg_'), 'control post must never name the execution flag');
    assert.ok(expr.includes('dmcontrol'), 'control post must carry the control marker');
  });

  it('PM-6: assessDriveResult — control flag and undelivered are uncalibrated, canary flag confirms', () => {
    assert.equal(assessDriveResult({ controlFlag: true, delivered: true, canaryFlag: true }).verdict, 'uncalibrated');
    assert.equal(assessDriveResult({ controlFlag: false, delivered: false, canaryFlag: false }).verdict, 'uncalibrated');
    assert.equal(assessDriveResult({ controlFlag: false, delivered: true, canaryFlag: true }).verdict, 'confirmed');
    assert.equal(assessDriveResult({ controlFlag: false, delivered: true, canaryFlag: false }).verdict, 'not-executed');
  });
});

describe('domPostMessage — gates (fail-closed)', () => {
  it('PM-7: no labCreds → no findings and fetchPage never called', async () => {
    let fetched = 0;
    const findings = await probeDomPostMessage(LAB_URL, { bundles: [BUNDLE_URL], inline: [] }, {
      allowWrite: true,
      labTargets: LAB_TARGETS,
      fetchPage: async () => { fetched += 1; return { status: 200, body: BUNDLE_INNERHTML }; },
    });
    assert.deepEqual(findings, []);
    assert.equal(fetched, 0);
  });

  it('PM-8: allowWrite false → no findings', async () => {
    // Control: the same fixture WOULD fire with allowWrite true, so
    // the gate is what blocks the finding here.
    const { findings: control } = await probeWithFakeCdp('exec-markup', { bundles: [BUNDLE_URL], inline: [] }, { bundleBody: BUNDLE_INNERHTML });
    assert.equal(control.length, 1);
    const gated = await probeDomPostMessage(LAB_URL, { bundles: [BUNDLE_URL], inline: [] }, labOpts({
      allowWrite: false,
      fetchPage: fakeFetchPage({ [BUNDLE_URL]: BUNDLE_INNERHTML }),
    }));
    assert.deepEqual(gated, []);
  });

  it('PM-9: non-lab target → no findings', async () => {
    const findings = await probeDomPostMessage('https://example.com/', { bundles: [BUNDLE_URL], inline: [] }, labOpts({
      fetchPage: fakeFetchPage({ [BUNDLE_URL]: BUNDLE_INNERHTML }),
      runner: fakeRunner([]),
      cdpConnect: fakeCdpConnect('exec-markup'),
    }));
    assert.deepEqual(findings, []);
  });

  it('PM-10: depth quick → no findings', async () => {
    const findings = await probeDomPostMessage(LAB_URL, { bundles: [BUNDLE_URL], inline: [] }, labOpts({
      depth: 'quick',
      fetchPage: fakeFetchPage({ [BUNDLE_URL]: BUNDLE_INNERHTML }),
      runner: fakeRunner([]),
      cdpConnect: fakeCdpConnect('exec-markup'),
    }));
    assert.deepEqual(findings, []);
  });
});

describe('domPostMessage — probe outcomes (fake CDP drive)', () => {
  it('PM-11: true negative — bundle with no listeners → no findings, no drive', async () => {
    const { findings, diag, calls } = await probeWithFakeCdp('noexec', { bundles: [BUNDLE_URL], inline: [] }, { bundleBody: BUNDLE_CLEAN });
    assert.deepEqual(findings, []);
    assert.equal(diag.listeners, 0);
    assert.equal(diag.listenersNearSink, 0);
    assert.equal(diag.driveAttempted, undefined);
    assert.equal(calls.length, 0);
  });

  it('PM-12: listener into a safe sink only → drive attempted, no execution, no finding', async () => {
    const { findings, diag, calls } = await probeWithFakeCdp('noexec', { bundles: [BUNDLE_URL], inline: [] }, { bundleBody: BUNDLE_SAFE });
    assert.deepEqual(findings, []);
    assert.equal(diag.listeners, 1);
    assert.equal(diag.listenersNearSink, 0);
    assert.equal(diag.driveAttempted, true);
    assert.equal(diag.driveExecuted, false);
    assert.ok(calls.some((a) => a[0] === 'run'), 'the drive must have started a browser');
    assert.ok(calls.some((a) => a[0] === 'rm'), 'the drive must have removed the container');
  });

  it('PM-13: execution shape — listener sinks data into innerHTML and the markup canary executes → exactly one high finding', async () => {
    const { findings, diag } = await probeWithFakeCdp('exec-markup', { bundles: [BUNDLE_URL], inline: [] }, { bundleBody: BUNDLE_INNERHTML });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].class, 'dom_sink');
    assert.equal(findings[0].severity, 'high');
    assert.equal(findings[0].id, 'dom-postmessage-xss');
    assert.match(findings[0].title, /postMessage/);
    assert.match(findings[0].evidence.request, /markup/);
    assert.match(findings[0].evidence.request, /<img src=x onerror=/);
    assert.match(findings[0].evidence.response, /window\.__dmPostMsg_[0-9a-f]+ === 1/);
    assert.match(findings[0].evidence.response, /innerHTML/);
    assert.match(findings[0].parameter, /innerHTML/);
    assert.equal(diag.listeners, 1);
    assert.equal(diag.listenersNearSink, 1);
    assert.equal(diag.driveAttempted, true);
    assert.equal(diag.driveExecuted, true);
  });

  it('PM-14: eval-family canary executes first — finding names the eval shape', async () => {
    const { findings } = await probeWithFakeCdp('exec-eval', { bundles: [BUNDLE_URL], inline: [] }, { bundleBody: BUNDLE_EVAL });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].class, 'dom_sink');
    assert.equal(findings[0].severity, 'high');
    assert.match(findings[0].evidence.request, /eval/);
    assert.match(findings[0].evidence.request, /window\.__dmPostMsg_[0-9a-f]+=1/);
  });

  it('PM-15: literal / non-executing sink — flag reflected as text but never set → no finding', async () => {
    const { findings, diag } = await probeWithFakeCdp('reflected-only', { bundles: [BUNDLE_URL], inline: [] }, { bundleBody: BUNDLE_INNERHTML });
    assert.deepEqual(findings, []);
    assert.equal(diag.driveAttempted, true);
    assert.equal(diag.driveExecuted, false);
  });

  it('PM-16: control message sets the flag → uncalibrated, no finding', async () => {
    const { findings, diag } = await probeWithFakeCdp('control-flag', { bundles: [BUNDLE_URL], inline: [] }, { bundleBody: BUNDLE_INNERHTML });
    assert.deepEqual(findings, []);
    assert.equal(diag.driveAttempted, true);
    assert.equal(diag.driveExecuted, false);
  });

  it('PM-17: message never delivered → uncalibrated, no finding', async () => {
    const { findings, diag } = await probeWithFakeCdp('undelivered', { bundles: [BUNDLE_URL], inline: [] }, { bundleBody: BUNDLE_INNERHTML });
    assert.deepEqual(findings, []);
    assert.equal(diag.driveAttempted, true);
    assert.equal(diag.driveExecuted, false);
  });

  it('PM-18: browser fails to start → no findings, never throws', async () => {
    const diag = {};
    const findings = await probeDomPostMessage(LAB_URL, { bundles: [BUNDLE_URL], inline: [] }, labOpts({
      fetchPage: fakeFetchPage({ [BUNDLE_URL]: BUNDLE_INNERHTML }),
      runner: failingRunner(),
      cdpConnect: fakeCdpConnect('exec-markup'),
      diagnostics: diag,
    }));
    assert.deepEqual(findings, []);
    assert.equal(diag.driveAttempted, true);
    assert.equal(diag.driveExecuted, false);
  });

  it('PM-19: assessConfirmation judges a probe finding confirmed (default protocol)', async () => {
    const { findings } = await probeWithFakeCdp('exec-markup', { bundles: [BUNDLE_URL], inline: [] }, { bundleBody: BUNDLE_INNERHTML });
    assert.equal(findings.length, 1);
    const { verdict } = assessConfirmation(findings[0]);
    assert.equal(verdict, 'confirmed');
  });

  it('PM-20: class is dom_sink, never contains xss (no xss_reflected routing trap)', async () => {
    const { findings } = await probeWithFakeCdp('exec-markup', { bundles: [BUNDLE_URL], inline: [] }, { bundleBody: BUNDLE_INNERHTML });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].class, 'dom_sink');
    assert.ok(!String(findings[0].class).includes('xss'));
  });

  it('PM-21: vendor bundle is excluded by filename — listener inside it never mines', async () => {
    const { findings, diag, calls } = await probeWithFakeCdp('exec-markup', { bundles: [VENDOR_URL], inline: [] }, {
      bodiesByUrl: { [VENDOR_URL]: BUNDLE_INNERHTML },
    });
    assert.deepEqual(findings, []);
    assert.equal(diag.listeners, 0);
    assert.equal(calls.length, 0);
  });

  it('PM-22: framework bundle defining the sanitizer is skipped whole', async () => {
    const frameworkBody =
      'function bypassSecurityTrustHtml(' + 'v){ return v; }\n' +
      'window.addEventListener(' + "'message', function (e) {\n" +
      '  const el = document.querySelector(' + "'#out');\n" +
      '  el.innerHTML = e.data;\n' +
      '});\n';
    const { findings, diag, calls } = await probeWithFakeCdp('exec-markup', { bundles: [BUNDLE_URL], inline: [] }, { bundleBody: frameworkBody });
    assert.deepEqual(findings, []);
    assert.equal(diag.listeners, 0);
    assert.equal(calls.length, 0);
  });

  it('PM-23: inline <script> listener counts — drive attempted with no bundles at all', async () => {
    const { findings, diag, calls } = await probeWithFakeCdp('noexec', { bundles: [], inline: [BUNDLE_INNERHTML] });
    assert.deepEqual(findings, []);
    assert.equal(diag.listeners, 1);
    assert.equal(diag.listenersNearSink, 1);
    assert.equal(diag.driveAttempted, true);
    assert.equal(diag.driveExecuted, false);
    assert.ok(calls.some((a) => a[0] === 'run'));
  });
});

describe('domPostMessage — drive helper', () => {
  it('PM-24: drivePostMessageExecution returns the driven rid and flag for verbatim evidence', async () => {
    const calls = [];
    const out = await drivePostMessageExecution(LAB_URL, {
      runner: fakeRunner(calls),
      cdpConnect: fakeCdpConnect('exec-markup'),
    });
    assert.equal(out.attempted, true);
    assert.equal(out.executed, true);
    assert.equal(out.shape, 'markup');
    assert.match(out.rid, /^[0-9a-f]{8}$/);
    assert.equal(out.flag, `__dmPostMsg_${out.rid}`);
    assert.ok(calls.some((a) => a[0] === 'run'));
    assert.ok(calls.some((a) => a[0] === 'rm'));
  });

  it('PM-25: drivePostMessageExecution never throws when the runner fails', async () => {
    const out = await drivePostMessageExecution(LAB_URL, {
      runner: failingRunner(),
      cdpConnect: fakeCdpConnect('exec-markup'),
    });
    assert.equal(out.executed, false);
    assert.ok(typeof out.error === 'string' && out.error.length > 0);
  });
});
