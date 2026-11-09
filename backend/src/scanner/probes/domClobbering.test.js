// Dark Matter rule-based scanner — DOM Clobbering tests
// (coverage row #89 [Medium] DOM Clobbering, Technique (no single
// CVE) | PortSwigger DOM; phase 99 'dom-clobbering').
//
// The probe has two tiers: a static mine (sink-feeding global reads
// in first-party code) and — only when one exists — a CDP clobber
// drive in a real browser. Tests cover the mine and the drive with
// fake fetchPage / fake runner / fake CDP seams; no docker, no
// network. Fixtures are built by concatenation, never single
// literals (the repo's secret-shape rule), and every fake is
// per-test so no state leaks between tests.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  probeDomClobbering,
  driveClobberExecution,
  findClobberSinks,
  findShippedClobberNames,
  assessClobberFlow,
  assessDriveResult,
  declaredNames,
  clobberElement,
  canaryUrl,
  consumptionProbeExpr,
  __domClobberMeta,
} from './domClobbering.js';
import { assessConfirmation } from '../../hunt-intel/differential.js';

const LAB_URL = 'http://172.17.0.1:3000/';
const BUNDLE_URL = 'http://172.17.0.1:3000/main.js';
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

const BUNDLE_SRC =
  'const img = document.querySelector(' + "'#avatar');\n" +
  'img.src = window.avatarUrl;\n';

const BUNDLE_HREF_BARE =
  'const a = document.querySelector(' + "'#link');\n" +
  'a.href = profileUrl;\n';

const BUNDLE_INNERHTML =
  'const el = document.querySelector(' + "'#bio');\n" +
  'el.innerHTML = window.userBio;\n';

const BUNDLE_DECLARED =
  'const avatarUrl = ' + "'/img.png';\n" +
  'const img = document.querySelector(' + "'#avatar');\n" +
  'img.src = avatarUrl;\n';

const BUNDLE_BUILTIN =
  'const img = document.querySelector(' + "'#avatar');\n" +
  'img.src = document.baseURI;\n';

const BUNDLE_EVAL =
  'eval(window.config);\n';

const HTML_SHIPPED =
  '<html><body>' +
  '<a id="avatarUrl" href="/x"></a>' +
  '<form name="profileUrl"></form>' +
  '</body></html>';

// ---- fakes -----------------------------------------------------------------

// Fake fetchPage: serves one bundle body per URL.
function fakeFetchPage(bodiesByUrl) {
  return async (url) => {
    const body = Object.prototype.hasOwnProperty.call(bodiesByUrl, url) ? bodiesByUrl[url] : null;
    if (body === null) return { status: 404, body: '' };
    return { status: 200, body };
  };
}

// Fake CDP client. `mode` decides what the clobber observes:
//   'clobber-only'  — the element clobbers window.<name> but no sink
//                     consumes it (the central negative case).
//   'consume-url'   — a sink copies the canary URL onto another
//                     element's src/href.
//   'consume-nav'   — a sink navigates the browser to the canary.
//   'consume-html'  — a sink re-inserts the element's markup so its
//                     id appears twice in the live DOM.
//   'noclobber'     — the injected element never resolves as
//                     window.<name>.
//   'noinject'      — the crafted element cannot be injected.
function fakeCdpClient(mode) {
  let currentUrl = '';
  const navigations = [];
  return {
    navigations,
    async newTarget() {
      return { webSocketDebuggerUrl: 'ws://127.0.0.1:9222/devtools/page/FAKE' };
    },
    async attach() {},
    async send() {
      return {};
    },
    async navigate(url) {
      currentUrl = String(url);
      navigations.push(currentUrl);
      return {};
    },
    async evaluate(expr) {
      const text = String(expr);
      if (text.includes('insertAdjacentHTML')) {
        return mode !== 'noinject';
      }
      if (text.includes('urlConsumed')) {
        if (mode === 'consume-url') return { urlConsumed: true, navigated: false, htmlDuplicated: false, signal: 'url' };
        if (mode === 'consume-nav') return { urlConsumed: false, navigated: true, htmlDuplicated: false, signal: 'navigation' };
        if (mode === 'consume-html') return { urlConsumed: false, navigated: false, htmlDuplicated: true, signal: 'html' };
        return { urlConsumed: false, navigated: false, htmlDuplicated: false, signal: null };
      }
      if (text.includes('tagName') && text.includes('window.')) {
        return mode !== 'noclobber';
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
  const findings = await probeDomClobbering(LAB_URL, targets, labOpts({
    fetchPage: fakeFetchPage({ [BUNDLE_URL]: extra.bundleBody || BUNDLE_CLEAN }),
    pageBody: extra.pageBody || '<html><body></body></html>',
    runner: fakeRunner(calls),
    cdpConnect: fakeCdpConnect(mode),
    diagnostics: diag,
  }));
  return { findings, diag, calls };
}

describe('domClobbering — tier-1 mine (pure)', () => {
  it('CLOB-1: finds src, href, innerHTML and eval sinks with global names and line numbers', () => {
    const sinks = findClobberSinks(BUNDLE_SRC + BUNDLE_HREF_BARE + BUNDLE_INNERHTML + BUNDLE_EVAL);
    assert.equal(sinks.length, 4);
    assert.deepEqual(sinks.map((s) => s.globalName), ['avatarUrl', 'profileUrl', 'userBio', 'config']);
    assert.deepEqual(sinks.map((s) => s.kind), ['src-assignment', 'src-assignment', 'innerHTML', 'eval']);
    assert.ok(sinks.every((s) => typeof s.snippet === 'string' && s.snippet.length > 0));
    assert.ok(sinks.every((s) => s.nearSink === true));
  });

  it('CLOB-2: clean code has no sinks', () => {
    assert.deepEqual(findClobberSinks(BUNDLE_CLEAN), []);
    assert.deepEqual(findClobberSinks(''), []);
    assert.deepEqual(findClobberSinks(null), []);
  });

  it('CLOB-3: locally declared names are not clobberable globals', () => {
    assert.deepEqual(findClobberSinks(BUNDLE_DECLARED), []);
    assert.deepEqual([...declaredNames(BUNDLE_DECLARED)], ['avatarUrl', 'img']);
  });

  it('CLOB-4: builtins (document, window, location) are not clobberable globals', () => {
    assert.deepEqual(findClobberSinks(BUNDLE_BUILTIN), []);
  });

  it('CLOB-5: findShippedClobberNames extracts id= and name= from served HTML', () => {
    assert.deepEqual(findShippedClobberNames(HTML_SHIPPED), ['avatarUrl', 'profileUrl']);
    assert.deepEqual(findShippedClobberNames(''), []);
    assert.deepEqual(findShippedClobberNames(null), []);
  });

  it('CLOB-6: assessClobberFlow drives only when a sink exists, shipped globals first', () => {
    assert.deepEqual(assessClobberFlow([], []), {
      clobberSinks: 0, clobberNearSink: 0, drive: false, globals: [],
    });
    const flow = assessClobberFlow(findClobberSinks(BUNDLE_SRC + BUNDLE_HREF_BARE), ['profileUrl']);
    assert.equal(flow.clobberSinks, 2);
    assert.equal(flow.drive, true);
    assert.deepEqual(flow.globals, ['profileUrl', 'avatarUrl']);
  });

  it('CLOB-7: clobberElement builds an anchor whose id is the global and href is the canary', () => {
    const rid = 'a1b2c3d4';
    assert.equal(clobberElement('avatarUrl', rid), '<a id="avatarUrl" href="https://evil.example/__dmclob_a1b2c3d4"></a>');
    assert.equal(canaryUrl(rid), 'https://evil.example/__dmclob_a1b2c3d4');
  });

  it('CLOB-8: consumptionProbeExpr carries the canary URL and the global name', () => {
    const expr = consumptionProbeExpr('avatarUrl', 'a1b2c3d4');
    assert.ok(expr.includes('https://evil.example/__dmclob_a1b2c3d4'));
    assert.ok(expr.includes('avatarUrl'));
    assert.ok(expr.includes('urlConsumed') && expr.includes('navigated') && expr.includes('htmlDuplicated'));
  });

  it('CLOB-9: assessDriveResult — clobber without consumption is never a finding', () => {
    assert.equal(assessDriveResult({ clobbered: false, consumed: false }).verdict, 'not-clobbered');
    assert.equal(assessDriveResult({ clobbered: true, consumed: false }).verdict, 'not-executed');
    assert.equal(assessDriveResult({ clobbered: true, consumed: true }).verdict, 'confirmed');
  });
});

describe('domClobbering — gates (fail-closed)', () => {
  it('CLOB-10: no labCreds → no findings and fetchPage never called', async () => {
    let fetched = 0;
    const findings = await probeDomClobbering(LAB_URL, { bundles: [BUNDLE_URL], inline: [] }, {
      allowWrite: true,
      labTargets: LAB_TARGETS,
      fetchPage: async () => { fetched += 1; return { status: 200, body: BUNDLE_SRC }; },
    });
    assert.deepEqual(findings, []);
    assert.equal(fetched, 0);
  });

  it('CLOB-11: allowWrite false → no findings', async () => {
    // Control: the same fixture WOULD fire with allowWrite true, so
    // the gate is what blocks the finding here.
    const { findings: control } = await probeWithFakeCdp('consume-url', { bundles: [BUNDLE_URL], inline: [] }, { bundleBody: BUNDLE_SRC });
    assert.equal(control.length, 1);
    const gated = await probeDomClobbering(LAB_URL, { bundles: [BUNDLE_URL], inline: [] }, labOpts({
      allowWrite: false,
      fetchPage: fakeFetchPage({ [BUNDLE_URL]: BUNDLE_SRC }),
    }));
    assert.deepEqual(gated, []);
  });

  it('CLOB-12: non-lab target → no findings', async () => {
    const findings = await probeDomClobbering('https://example.com/', { bundles: [BUNDLE_URL], inline: [] }, labOpts({
      fetchPage: fakeFetchPage({ [BUNDLE_URL]: BUNDLE_SRC }),
      runner: fakeRunner([]),
      cdpConnect: fakeCdpConnect('consume-url'),
    }));
    assert.deepEqual(findings, []);
  });

  it('CLOB-13: depth quick → no findings', async () => {
    const findings = await probeDomClobbering(LAB_URL, { bundles: [BUNDLE_URL], inline: [] }, labOpts({
      depth: 'quick',
      fetchPage: fakeFetchPage({ [BUNDLE_URL]: BUNDLE_SRC }),
      runner: fakeRunner([]),
      cdpConnect: fakeCdpConnect('consume-url'),
    }));
    assert.deepEqual(findings, []);
  });
});

describe('domClobbering — probe outcomes (fake CDP drive)', () => {
  it('CLOB-14: true negative — bundle with no sink-feeding reads → no findings, no drive', async () => {
    const { findings, diag, calls } = await probeWithFakeCdp('clobber-only', { bundles: [BUNDLE_URL], inline: [] }, { bundleBody: BUNDLE_CLEAN });
    assert.deepEqual(findings, []);
    assert.equal(diag.clobberSinks, 0);
    assert.equal(diag.clobberNearSink, 0);
    assert.equal(diag.driveAttempted, undefined);
    assert.equal(calls.length, 0);
  });

  it('CLOB-15: clobbered but no sink consumes it → no finding, drive attempted (the central negative case)', async () => {
    const { findings, diag, calls } = await probeWithFakeCdp('clobber-only', { bundles: [BUNDLE_URL], inline: [] }, { bundleBody: BUNDLE_SRC });
    assert.deepEqual(findings, []);
    assert.equal(diag.clobberSinks, 1);
    assert.equal(diag.clobberNearSink, 1);
    assert.equal(diag.driveAttempted, true);
    assert.equal(diag.driveExecuted, false);
    assert.ok(calls.some((a) => a[0] === 'run'), 'the drive must have started a browser');
    assert.ok(calls.some((a) => a[0] === 'rm'), 'the drive must have removed the container');
  });

  it('CLOB-16: URL consumption — sink copies the canary onto another element → exactly one medium finding', async () => {
    const { findings, diag } = await probeWithFakeCdp('consume-url', { bundles: [BUNDLE_URL], inline: [] }, { bundleBody: BUNDLE_SRC, pageBody: HTML_SHIPPED });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].class, 'dom_sink');
    assert.equal(findings[0].severity, 'medium');
    assert.equal(findings[0].id, 'dom-clobbering');
    assert.equal(findings[0].parameter, 'window.avatarUrl');
    assert.match(findings[0].title, /DOM Clobbering/);
    assert.match(findings[0].evidence.request, /<a id="avatarUrl" href="https:\/\/evil\.example\/__dmclob_/);
    assert.match(findings[0].evidence.request, /url/);
    assert.match(findings[0].evidence.response, /resolved to the injected anchor/);
    assert.match(findings[0].evidence.response, /src-assignment/);
    assert.equal(diag.clobberSinks, 1);
    assert.equal(diag.driveAttempted, true);
    assert.equal(diag.driveExecuted, true);
  });

  it('CLOB-17: navigation consumption → finding names the navigation signal', async () => {
    const { findings } = await probeWithFakeCdp('consume-nav', { bundles: [BUNDLE_URL], inline: [] }, { bundleBody: BUNDLE_HREF_BARE });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].parameter, 'window.profileUrl');
    assert.match(findings[0].evidence.request, /navigation/);
  });

  it('CLOB-18: HTML consumption → finding names the html signal', async () => {
    const { findings } = await probeWithFakeCdp('consume-html', { bundles: [BUNDLE_URL], inline: [] }, { bundleBody: BUNDLE_INNERHTML });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].parameter, 'window.userBio');
    assert.match(findings[0].evidence.request, /html/);
  });

  it('CLOB-19: element never resolves as window.<name> → no finding', async () => {
    const { findings, diag } = await probeWithFakeCdp('noclobber', { bundles: [BUNDLE_URL], inline: [] }, { bundleBody: BUNDLE_SRC });
    assert.deepEqual(findings, []);
    assert.equal(diag.driveAttempted, true);
    assert.equal(diag.driveExecuted, false);
  });

  it('CLOB-20: browser fails to start → no findings, never throws', async () => {
    const diag = {};
    const findings = await probeDomClobbering(LAB_URL, { bundles: [BUNDLE_URL], inline: [] }, labOpts({
      fetchPage: fakeFetchPage({ [BUNDLE_URL]: BUNDLE_SRC }),
      runner: failingRunner(),
      cdpConnect: fakeCdpConnect('consume-url'),
      diagnostics: diag,
    }));
    assert.deepEqual(findings, []);
    assert.equal(diag.driveAttempted, true);
    assert.equal(diag.driveExecuted, false);
  });

  it('CLOB-21: assessConfirmation judges a probe finding confirmed (default protocol)', async () => {
    const { findings } = await probeWithFakeCdp('consume-url', { bundles: [BUNDLE_URL], inline: [] }, { bundleBody: BUNDLE_SRC });
    assert.equal(findings.length, 1);
    const { verdict } = assessConfirmation(findings[0]);
    assert.equal(verdict, 'confirmed');
  });

  it('CLOB-22: class is dom_sink, never contains xss (no xss_reflected routing trap)', async () => {
    const { findings } = await probeWithFakeCdp('consume-url', { bundles: [BUNDLE_URL], inline: [] }, { bundleBody: BUNDLE_SRC });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].class, 'dom_sink');
    assert.ok(!String(findings[0].class).includes('xss'));
  });

  it('CLOB-23: crafted element cannot be injected → uncalibrated, no finding', async () => {
    const { findings, diag } = await probeWithFakeCdp('noinject', { bundles: [BUNDLE_URL], inline: [] }, { bundleBody: BUNDLE_SRC });
    assert.deepEqual(findings, []);
    assert.equal(diag.driveAttempted, true);
    assert.equal(diag.driveExecuted, false);
  });
});

describe('domClobbering — drive helper', () => {
  it('CLOB-24: driveClobberExecution returns the driven rid and canary for verbatim evidence', async () => {
    const calls = [];
    const out = await driveClobberExecution(LAB_URL, ['avatarUrl'], {
      runner: fakeRunner(calls),
      cdpConnect: fakeCdpConnect('consume-url'),
    });
    assert.equal(out.attempted, true);
    assert.equal(out.executed, true);
    assert.equal(out.clobbered, true);
    assert.equal(out.shape, 'url');
    assert.equal(out.globalName, 'avatarUrl');
    assert.match(out.rid, /^[0-9a-f]{8}$/);
    assert.equal(out.canary, `https://evil.example/__dmclob_${out.rid}`);
    assert.ok(calls.some((a) => a[0] === 'run'));
    assert.ok(calls.some((a) => a[0] === 'rm'));
  });

  it('CLOB-25: driveClobberExecution never throws when the runner fails', async () => {
    const out = await driveClobberExecution(LAB_URL, ['avatarUrl'], {
      runner: failingRunner(),
      cdpConnect: fakeCdpConnect('consume-url'),
    });
    assert.equal(out.executed, false);
    assert.ok(typeof out.error === 'string' && out.error.length > 0);
  });
});

describe('domClobbering — registration metadata', () => {
  it('CLOB-meta: phase 99 registration metadata', () => {
    assert.deepEqual(__domClobberMeta, { phases: ['dom-clobbering'], depth: ['standard', 'deep'] });
  });
});
