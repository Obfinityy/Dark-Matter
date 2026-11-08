// Dark Matter rule-based scanner — DOM XSS via location.hash tests
// (coverage row #275 [High] XSS — DOM via location.hash / fragment,
// CWE-79 | PortSwigger DOM XSS; phase 91 'dom-xss-location-hash').
//
// The probe has two tiers: a static mine (location.hash reads in
// first-party code) and — only when a read exists — a CDP execution
// drive in a real browser. Tests cover the mine and the drive with
// fake fetchPage / fake runner / fake CDP seams; no docker, no
// network. Fixtures are built by concatenation, never single
// literals (the repo's secret-shape rule), and every fake is
// per-test so no state leaks between tests.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  probeDomXssLocationHash,
  driveHashExecution,
  findHashReads,
  assessHashFlow,
  assessDriveResult,
  flagName,
  controlHash,
  evalCanaryHash,
  markupCanaryHash,
} from './domXssLocationHash.js';
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

const BUNDLE_SAFE =
  'const h = location.hash.slice(1);\n' +
  'const el = document.querySelector(' + "'#out');\n" +
  'el.textContent = h;\n';

const BUNDLE_INNERHTML =
  'const h = decodeURIComponent(location.hash.slice(1));\n' +
  'const el = document.querySelector(' + "'#out');\n" +
  'el.innerHTML = h;\n';

const BUNDLE_EVAL =
  'const h = location.hash.slice(1);\n' +
  'eval(h);\n';

const BUNDLE_WRITE =
  'document.write(location.hash);\n';

const BUNDLE_BRACKET =
  'const h = location[' + "'hash']" + ';\n' +
  'const el = document.querySelector(' + "'#out');\n" +
  'el.textContent = h;\n';

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
//   'noexec'         — nothing executes, nothing reflected.
//   'exec-eval'      — the eval-family canary executes, markup does not.
//   'exec-markup'    — the markup canary executes, eval does not.
//   'reflected-only' — the flag name appears in the DOM as text, but
//                      the flag is never set (sunk, not executed).
//   'control-flag'   — even the control fragment sets the flag
//                      (contaminated oracle).
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
      if (expr === 'location.hash') {
        const i = currentUrl.indexOf('#');
        return i >= 0 ? currentUrl.slice(i) : '';
      }
      const flagMatch = /^window\.(__dmHashXss_[0-9a-f]+) === 1$/.exec(String(expr));
      if (flagMatch) {
        const flag = flagMatch[1];
        const frag = currentUrl.indexOf('#') >= 0 ? currentUrl.slice(currentUrl.indexOf('#') + 1) : '';
        if (mode === 'control-flag') return true;
        if (mode === 'exec-eval') return frag === `window.${flag}=1`;
        if (mode === 'exec-markup') return frag === `<img src=x onerror="window.${flag}=1">`;
        return false;
      }
      if (String(expr).startsWith('document.documentElement.outerHTML.includes(')) {
        return mode === 'exec-markup' || mode === 'reflected-only';
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
  const findings = await probeDomXssLocationHash(LAB_URL, targets, labOpts({
    fetchPage: fakeFetchPage({ [BUNDLE_URL]: extra.bundleBody || BUNDLE_CLEAN }),
    runner: fakeRunner(calls),
    cdpConnect: fakeCdpConnect(mode),
    diagnostics: diag,
  }));
  return { findings, diag, calls };
}

describe('domXssLocationHash — tier-1 mine (pure)', () => {
  it('HASH-1: finds dot, qualified and bracket location.hash reads with line numbers', () => {
    const body =
      'const a = location.hash;\n' +
      'const b = window.location.hash;\n' +
      'const c = location[' + "'hash']" + ';\n';
    const reads = findHashReads(body);
    assert.equal(reads.length, 3);
    assert.deepEqual(reads.map((r) => r.line), [1, 2, 3]);
    assert.ok(reads.every((r) => typeof r.snippet === 'string' && r.snippet.length > 0));
  });

  it('HASH-2: clean code has no reads', () => {
    assert.deepEqual(findHashReads(BUNDLE_CLEAN), []);
    assert.deepEqual(findHashReads(''), []);
    assert.deepEqual(findHashReads(null), []);
  });

  it('HASH-3: a read near innerHTML is classified as near-sink', () => {
    const reads = findHashReads(BUNDLE_INNERHTML);
    assert.equal(reads.length, 1);
    assert.equal(reads[0].nearSink, true);
    assert.equal(reads[0].sinkKind, 'innerHTML');
  });

  it('HASH-4: a read into textContent only is classified as safe-only', () => {
    const reads = findHashReads(BUNDLE_SAFE);
    assert.equal(reads.length, 1);
    assert.equal(reads[0].nearSink, false);
    assert.equal(reads[0].safeOnly, true);
    assert.equal(reads[0].sinkKind, 'textContent');
  });

  it('HASH-5: decodeURIComponent(location.hash) is found as a read', () => {
    const reads = findHashReads(BUNDLE_INNERHTML);
    assert.equal(reads.length, 1);
    assert.ok(reads[0].snippet.includes('decodeURIComponent'));
  });

  it('HASH-6: a read near document.write is classified as near-sink', () => {
    const reads = findHashReads(BUNDLE_WRITE);
    assert.equal(reads.length, 1);
    assert.equal(reads[0].nearSink, true);
    assert.equal(reads[0].sinkKind, 'document.write');
  });

  it('HASH-7: assessHashFlow drives only when a read exists', () => {
    assert.deepEqual(assessHashFlow([]), { reads: 0, nearSink: 0, drive: false });
    const reads = findHashReads(BUNDLE_SAFE);
    assert.deepEqual(assessHashFlow(reads), { reads: 1, nearSink: 0, drive: true });
    assert.deepEqual(assessHashFlow(findHashReads(BUNDLE_INNERHTML)), { reads: 1, nearSink: 1, drive: true });
  });

  it('HASH-8: canary builders — eval shape has no percent-encoded chars, markup carries the flag', () => {
    const rid = 'a1b2c3d4';
    assert.equal(flagName(rid), '__dmHashXss_a1b2c3d4');
    assert.equal(controlHash(rid), 'dmcontrol-a1b2c3d4');
    const evalHash = evalCanaryHash(rid);
    assert.equal(evalHash, 'window.__dmHashXss_a1b2c3d4=1');
    assert.ok(!/[<>"` ]/.test(evalHash), 'eval canary must not need URL decoding');
    const markupHash = markupCanaryHash(rid);
    assert.ok(markupHash.includes('<img src=x onerror="window.__dmHashXss_a1b2c3d4=1">'));
    assert.ok(!controlHash(rid).includes('<'));
  });

  it('HASH-9: assessDriveResult — control flag and lost fragment are uncalibrated, canary flag confirms', () => {
    assert.equal(assessDriveResult({ controlFlag: true, canaryFlag: true, hashSurvived: true }).verdict, 'uncalibrated');
    assert.equal(assessDriveResult({ controlFlag: false, canaryFlag: false, hashSurvived: false }).verdict, 'uncalibrated');
    assert.equal(assessDriveResult({ controlFlag: false, canaryFlag: true, hashSurvived: true }).verdict, 'confirmed');
    assert.equal(assessDriveResult({ controlFlag: false, canaryFlag: false, hashSurvived: true }).verdict, 'not-executed');
  });
});

describe('domXssLocationHash — gates (fail-closed)', () => {
  it('HASH-10: no labCreds → no findings and fetchPage never called', async () => {
    let fetched = 0;
    const findings = await probeDomXssLocationHash(LAB_URL, { bundles: [BUNDLE_URL], inline: [] }, {
      allowWrite: true,
      labTargets: LAB_TARGETS,
      fetchPage: async () => { fetched += 1; return { status: 200, body: BUNDLE_INNERHTML }; },
    });
    assert.deepEqual(findings, []);
    assert.equal(fetched, 0);
  });

  it('HASH-11: allowWrite false → no findings', async () => {
    // Control: the same fixture WOULD fire with allowWrite true, so
    // the gate is what blocks the finding here.
    const { findings: control } = await probeWithFakeCdp('exec-markup', { bundles: [BUNDLE_URL], inline: [] }, { bundleBody: BUNDLE_INNERHTML });
    assert.equal(control.length, 1);
    const gated = await probeDomXssLocationHash(LAB_URL, { bundles: [BUNDLE_URL], inline: [] }, labOpts({
      allowWrite: false,
      fetchPage: fakeFetchPage({ [BUNDLE_URL]: BUNDLE_INNERHTML }),
    }));
    assert.deepEqual(gated, []);
  });

  it('HASH-12: non-lab target → no findings', async () => {
    const findings = await probeDomXssLocationHash('https://example.com/', { bundles: [BUNDLE_URL], inline: [] }, labOpts({
      fetchPage: fakeFetchPage({ [BUNDLE_URL]: BUNDLE_INNERHTML }),
      runner: fakeRunner([]),
      cdpConnect: fakeCdpConnect('exec-markup'),
    }));
    assert.deepEqual(findings, []);
  });

  it('HASH-13: depth quick → no findings', async () => {
    const findings = await probeDomXssLocationHash(LAB_URL, { bundles: [BUNDLE_URL], inline: [] }, labOpts({
      depth: 'quick',
      fetchPage: fakeFetchPage({ [BUNDLE_URL]: BUNDLE_INNERHTML }),
      runner: fakeRunner([]),
      cdpConnect: fakeCdpConnect('exec-markup'),
    }));
    assert.deepEqual(findings, []);
  });
});

describe('domXssLocationHash — probe outcomes (fake CDP drive)', () => {
  it('HASH-14: true negative — bundle with no hash reads → no findings, no drive', async () => {
    const { findings, diag, calls } = await probeWithFakeCdp('noexec', { bundles: [BUNDLE_URL], inline: [] }, { bundleBody: BUNDLE_CLEAN });
    assert.deepEqual(findings, []);
    assert.equal(diag.hashReads, 0);
    assert.equal(diag.hashNearSink, 0);
    assert.equal(diag.driveAttempted, undefined);
    assert.equal(calls.length, 0);
  });

  it('HASH-15: hash read into a safe sink only → drive attempted, no execution, no finding', async () => {
    const { findings, diag, calls } = await probeWithFakeCdp('noexec', { bundles: [BUNDLE_URL], inline: [] }, { bundleBody: BUNDLE_SAFE });
    assert.deepEqual(findings, []);
    assert.equal(diag.hashReads, 1);
    assert.equal(diag.hashNearSink, 0);
    assert.equal(diag.driveAttempted, true);
    assert.equal(diag.driveExecuted, false);
    assert.ok(calls.some((a) => a[0] === 'run'), 'the drive must have started a browser');
    assert.ok(calls.some((a) => a[0] === 'rm'), 'the drive must have removed the container');
  });

  it('HASH-16: execution shape — hash reaches innerHTML and the markup canary executes → exactly one high finding', async () => {
    const { findings, diag } = await probeWithFakeCdp('exec-markup', { bundles: [BUNDLE_URL], inline: [] }, { bundleBody: BUNDLE_INNERHTML });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].class, 'dom_sink');
    assert.equal(findings[0].severity, 'high');
    assert.equal(findings[0].id, 'dom-hash-xss');
    assert.match(findings[0].title, /location\.hash/);
    assert.match(findings[0].evidence.request, /markup/);
    assert.match(findings[0].evidence.request, /<img src=x onerror=/);
    assert.match(findings[0].evidence.response, /window\.__dmHashXss_[0-9a-f]+ === 1/);
    assert.match(findings[0].evidence.response, /innerHTML/);
    assert.equal(diag.hashReads, 1);
    assert.equal(diag.hashNearSink, 1);
    assert.equal(diag.driveAttempted, true);
    assert.equal(diag.driveExecuted, true);
  });

  it('HASH-17: eval-family canary executes first — finding names the eval shape', async () => {
    const { findings } = await probeWithFakeCdp('exec-eval', { bundles: [BUNDLE_URL], inline: [] }, { bundleBody: BUNDLE_EVAL });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].class, 'dom_sink');
    assert.equal(findings[0].severity, 'high');
    assert.match(findings[0].evidence.request, /eval/);
    assert.match(findings[0].evidence.request, /window\.__dmHashXss_[0-9a-f]+=1/);
  });

  it('HASH-18: no-hash-read page (empty targets) → no findings, no drive', async () => {
    const { findings, diag, calls } = await probeWithFakeCdp('noexec', { bundles: [], inline: [] });
    assert.deepEqual(findings, []);
    assert.equal(diag.hashReads, 0);
    assert.equal(calls.length, 0);
  });

  it('HASH-19: literal / non-executing sink — flag reflected as text but never set → no finding', async () => {
    const { findings, diag } = await probeWithFakeCdp('reflected-only', { bundles: [BUNDLE_URL], inline: [] }, { bundleBody: BUNDLE_INNERHTML });
    assert.deepEqual(findings, []);
    assert.equal(diag.driveAttempted, true);
    assert.equal(diag.driveExecuted, false);
  });

  it('HASH-20: browser fails to start → no findings, never throws', async () => {
    const diag = {};
    const findings = await probeDomXssLocationHash(LAB_URL, { bundles: [BUNDLE_URL], inline: [] }, labOpts({
      fetchPage: fakeFetchPage({ [BUNDLE_URL]: BUNDLE_INNERHTML }),
      runner: failingRunner(),
      cdpConnect: fakeCdpConnect('exec-markup'),
      diagnostics: diag,
    }));
    assert.deepEqual(findings, []);
    assert.equal(diag.driveAttempted, true);
    assert.equal(diag.driveExecuted, false);
  });

  it('HASH-21: assessConfirmation judges a probe finding confirmed (default protocol)', async () => {
    const { findings } = await probeWithFakeCdp('exec-markup', { bundles: [BUNDLE_URL], inline: [] }, { bundleBody: BUNDLE_INNERHTML });
    assert.equal(findings.length, 1);
    const { verdict } = assessConfirmation(findings[0]);
    assert.equal(verdict, 'confirmed');
  });

  it('HASH-22: class is dom_sink, never contains xss (no xss_reflected routing trap)', async () => {
    const { findings } = await probeWithFakeCdp('exec-markup', { bundles: [BUNDLE_URL], inline: [] }, { bundleBody: BUNDLE_INNERHTML });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].class, 'dom_sink');
    assert.ok(!String(findings[0].class).includes('xss'));
  });

  it('HASH-23: control fragment sets the flag → uncalibrated, no finding', async () => {
    const { findings, diag } = await probeWithFakeCdp('control-flag', { bundles: [BUNDLE_URL], inline: [] }, { bundleBody: BUNDLE_INNERHTML });
    assert.deepEqual(findings, []);
    assert.equal(diag.driveAttempted, true);
    assert.equal(diag.driveExecuted, false);
  });
});

describe('domXssLocationHash — drive helper', () => {
  it('HASH-24: driveHashExecution returns the driven rid and flag for verbatim evidence', async () => {
    const calls = [];
    const out = await driveHashExecution(LAB_URL, {
      runner: fakeRunner(calls),
      cdpConnect: fakeCdpConnect('exec-markup'),
    });
    assert.equal(out.attempted, true);
    assert.equal(out.executed, true);
    assert.equal(out.shape, 'markup');
    assert.match(out.rid, /^[0-9a-f]{8}$/);
    assert.equal(out.flag, `__dmHashXss_${out.rid}`);
    assert.ok(calls.some((a) => a[0] === 'run'));
    assert.ok(calls.some((a) => a[0] === 'rm'));
  });

  it('HASH-25: driveHashExecution never throws when the runner fails', async () => {
    const out = await driveHashExecution(LAB_URL, {
      runner: failingRunner(),
      cdpConnect: fakeCdpConnect('exec-markup'),
    });
    assert.equal(out.executed, false);
    assert.ok(typeof out.error === 'string' && out.error.length > 0);
  });
});
