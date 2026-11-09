// Mutation XSS probe tests (row #116 [High] Mutation XSS (mXSS),
// CWE-79; phase 98, 'mutation-xss').
//
// The probe is two tiers: tier 1 mines first-party code for
// HTML-write assignments (innerHTML / outerHTML /
// insertAdjacentHTML / document.write) — zero sinks = proven true
// negative, no drive; tier 2 drives the pasted page in a real
// browser with a mutation canary in the query string and then in
// the fragment, and confirms ONLY when the canary executes — the
// control render leaves the window flag unset, and a canary render
// sets it in two separate renders.
//
// The fake CDP client is keyed on the last navigated URL: a URL
// containing 'dmcontrol-' is a control render, a URL containing
// '__dmmxss' is a canary render, 'dmmxss=' marks the query vector
// (the fragment vector has no query param), 'table' marks the math
// shape (the form-math shape has no table) and 'form' marks the
// form-math shape (the math shape has no form). Modes:
// 'noexec' (canary never executes), 'exec-math-query' (math shape
// executes on the query vector), 'exec-form-fragment' (form-math
// shape executes on the fragment vector), 'control-flag' (the
// control render also sets the flag), 'unstable' (the flag is set
// on alternating renders), 'nav-fail' (evaluate throws).

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  probeMutationXss,
  driveMutationXssExecution,
  findMxssJsSinks,
  assessMxssFlow,
  assessDriveResult,
  classifyMxssSink,
  canaryMath,
  canaryFormMath,
  flagName,
  flagExpr,
  controlValue,
  queryCanaryUrl,
  fragmentCanaryUrl,
  __mxssMeta,
} from './mutationXss.js';
import { assessConfirmation } from '../../hunt-intel/differential.js';

const PAGE_URL = 'http://172.17.0.1:3000/';
const BUNDLE_URL = 'http://172.17.0.1:3000/main.js';
const VENDOR_URL = 'http://172.17.0.1:3000/vendor.js';
const labOpts = {
  labCreds: { username: 'lab-user', password: 'lab-pass' },
  labTargets: ['172.17.0.1:3000'],
};

// Fixtures are built by concatenation so no single literal in this
// file is a secret-shaped string.
const BUNDLE_CLEAN =
  'function render(){ var el = document.createElement(\'div\');' +
  ' el.textContent = window.location.search; document.body.appendChild(el); }';
const BUNDLE_TEXTONLY =
  'var el = document.createElement(\'div\');' +
  ' el.textContent = location.search;';
const BUNDLE_INNERHTML =
  'var el = document.createElement(\'div\');' +
  ' el.innerHTML = location.search; document.body.appendChild(el);';
const BUNDLE_OUTERHTML =
  'var q = location.search;' +
  ' document.getElementById(\'out\').outerHTML = q;';
const BUNDLE_INSERT =
  'document.getElementById(\'out\').insertAdjacentHTML(\'beforeend\', location.hash.slice(1));';
const BUNDLE_DOCWRITE =
  'document.write(location.search);';
const BUNDLE_DOCWRITELN =
  'document.writeln(location.search);';
const BUNDLE_PLUS_EQ =
  'var el = document.createElement(\'div\');' +
  ' el.innerHTML += location.search;';
const BUNDLE_LITERAL =
  'var el = document.createElement(\'div\');' +
  ' el.innerHTML = "hello";';
const BUNDLE_SANITIZER_INPUT =
  'var clean = DOMPurify.sanitize(location.search);' +
  ' el.innerHTML = clean;';
const BUNDLE_SANITIZER_ONLY =
  'var clean = DOMPurify.sanitize(x);' +
  ' el.innerHTML = clean;';
const BUNDLE_PARSE_ONLY =
  'var doc = new DOMParser().parseFromString(x, \'text/html\');' +
  ' el.innerHTML = doc.body.innerHTML;';
const BUNDLE_PLAIN =
  'var el = document.createElement(\'div\');' +
  ' el.innerHTML = v;';
const BUNDLE_COMPARISON =
  'if (el.innerHTML == \'x\') { console.log(\'same\'); }';
const BUNDLE_FRAMEWORK =
  'function bypassSecurityTrustHtml(v) { return v; }' +
  ' var el = document.createElement(\'div\'); el.innerHTML = v;';

function makeFakeClient(mode, calls) {
  let lastUrl = '';
  let canaryReads = 0;
  return {
    get lastUrl() {
      return lastUrl;
    },
    async send() {
      return {};
    },
    async newTarget(url) {
      calls.push(['newTarget', url]);
      return { webSocketDebuggerUrl: 'ws://127.0.0.1:9222/devtools/page/1' };
    },
    async attach() {
      calls.push(['attach']);
      return true;
    },
    async navigate(url) {
      calls.push(['navigate', url]);
      lastUrl = String(url);
    },
    async evaluate(expr) {
      calls.push(['evaluate', expr]);
      if (!String(expr).includes('__dmmxss')) return null;
      if (mode === 'nav-fail') throw new Error('navigation failed');
      const url = lastUrl;
      const isControl = url.includes('dmcontrol-');
      const isCanary = url.includes('__dmmxss');
      const isQuery = url.includes('dmmxss=');
      const isMath = url.includes('table');
      const isForm = url.includes('form');
      if (isControl) {
        if (mode === 'control-flag') return 'true';
        return 'false';
      }
      if (isCanary) {
        if (mode === 'exec-math-query' && isQuery && isMath) return 'true';
        if (mode === 'exec-form-fragment' && !isQuery && isForm) return 'true';
        if (mode === 'unstable') {
          canaryReads += 1;
          return canaryReads % 2 === 1 ? 'true' : 'false';
        }
        return 'false';
      }
      return 'false';
    },
    async close() {
      calls.push(['close']);
      return true;
    },
  };
}

async function probeWithFakeCdp(mode, targets, extra = {}) {
  const calls = [];
  const runnerCalls = [];
  const diagnostics = {};
  const fake = makeFakeClient(mode, calls);
  const opts = {
    labCreds: labOpts.labCreds,
    allowWrite: true,
    labTargets: labOpts.labTargets,
    depth: 'standard',
    timeoutMs: 1,
    settleMs: 0,
    headers: {},
    pageBody: '',
    fetchPage: async () => ({ status: 200, body: BUNDLE_INNERHTML }),
    runner: async (file, args) => {
      runnerCalls.push({ file, args });
      if (args[0] === 'rm') return { ok: true, stdout: '' };
      return { ok: true, stdout: 'mxss-container\n' };
    },
    cdpConnect: async () => ({ ok: true, client: fake }),
    diagnostics,
    ...extra,
  };
  const findings = await probeMutationXss(PAGE_URL, targets, opts);
  return { findings, diagnostics, calls, runnerCalls, fake };
}

function targetsWith(bundleUrl = BUNDLE_URL) {
  return { bundles: [bundleUrl], inline: [] };
}

// ---- tier 1: the static mine (pure) -----------------------------------------

test('MXSS-1: mine finds every HTML-write sink kind', () => {
  const cases = [
    [BUNDLE_INNERHTML, 'innerHTML'],
    [BUNDLE_OUTERHTML, 'innerHTML'],
    [BUNDLE_PLUS_EQ, 'innerHTML'],
    [BUNDLE_INSERT, 'insertAdjacentHTML'],
    [BUNDLE_DOCWRITE, 'document-write'],
    [BUNDLE_DOCWRITELN, 'document-write'],
  ];
  for (const [body, kind] of cases) {
    const found = findMxssJsSinks(body);
    assert.equal(found.length, 1, `expected one ${kind} sink, got ${found.length}`);
    assert.equal(found[0].kind, kind);
    assert.ok(found[0].line >= 1);
    assert.ok(found[0].snippet.length > 0);
  }
});

test('MXSS-2: mine ignores clean code, comparisons and text writes', () => {
  assert.deepEqual(findMxssJsSinks(BUNDLE_CLEAN), []);
  assert.deepEqual(findMxssJsSinks(BUNDLE_TEXTONLY), []);
  assert.deepEqual(findMxssJsSinks(BUNDLE_COMPARISON), []);
  assert.deepEqual(findMxssJsSinks(''), []);
  assert.deepEqual(findMxssJsSinks(null), []);
});

test('MXSS-3: sink near user input is user-input, near a sanitizer/parse is mutation-surface, literal-only is safe-only', () => {
  const near = findMxssJsSinks(BUNDLE_INNERHTML);
  assert.equal(near.length, 1);
  assert.equal(near[0].nearSink, true);
  assert.equal(near[0].sinkKind, 'user-input');
  assert.equal(near[0].safeOnly, false);

  const sanitizer = findMxssJsSinks(BUNDLE_SANITIZER_ONLY);
  assert.equal(sanitizer.length, 1);
  assert.equal(sanitizer[0].nearSink, true);
  assert.equal(sanitizer[0].sinkKind, 'mutation-surface');
  assert.equal(sanitizer[0].safeOnly, false);

  const parsed = findMxssJsSinks(BUNDLE_PARSE_ONLY);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].nearSink, true);
  assert.equal(parsed[0].sinkKind, 'mutation-surface');
  assert.equal(parsed[0].safeOnly, false);

  const literal = findMxssJsSinks(BUNDLE_LITERAL);
  assert.equal(literal.length, 1);
  assert.equal(literal[0].nearSink, false);
  assert.equal(literal[0].safeOnly, true);

  const plain = findMxssJsSinks(BUNDLE_PLAIN);
  assert.equal(plain.length, 1);
  assert.equal(plain[0].nearSink, false);
  assert.equal(plain[0].sinkKind, null);
  assert.equal(plain[0].safeOnly, false);

  // A sanitizer call with no HTML insertion is a classification
  // marker, not a sink on its own.
  assert.deepEqual(findMxssJsSinks('var clean = DOMPurify.sanitize(x);'), []);
});

test('MXSS-4: assessMxssFlow drives only when a sink exists', () => {
  assert.deepEqual(assessMxssFlow([]), { mxssSinks: 0, nearSink: 0, drive: false });
  const one = findMxssJsSinks(BUNDLE_INNERHTML);
  assert.deepEqual(assessMxssFlow(one), { mxssSinks: 1, nearSink: 1, drive: true });
  const literal = findMxssJsSinks(BUNDLE_LITERAL);
  assert.deepEqual(assessMxssFlow(literal), { mxssSinks: 1, nearSink: 0, drive: true });
});

test('MXSS-5: canary builders — query and fragment URLs, control literal, flag', () => {
  assert.ok(canaryMath().includes('mglyph'), canaryMath());
  assert.ok(canaryMath().includes('__dmmxss'), canaryMath());
  assert.ok(canaryFormMath().includes('<form>'), canaryFormMath());
  assert.ok(canaryFormMath().includes('__dmmxss'), canaryFormMath());
  assert.equal(flagName(), '__dmmxss');
  assert.ok(flagExpr().includes('__dmmxss'));
  assert.equal(controlValue('abcd1234'), 'dmcontrol-abcd1234');
  const q = queryCanaryUrl(PAGE_URL, canaryMath());
  assert.ok(q.includes('dmmxss='), q);
  assert.ok(q.includes('__dmmxss'), q);
  assert.ok(q.includes('table'), q);
  const f = fragmentCanaryUrl(PAGE_URL, canaryFormMath());
  assert.ok(f.includes('#'), f);
  assert.ok(f.includes('__dmmxss'), f);
  assert.ok(!f.includes('dmmxss='), f);
  const qc = queryCanaryUrl(PAGE_URL, controlValue('abcd1234'));
  assert.ok(qc.includes('dmcontrol-abcd1234'), qc);
  assert.ok(!qc.includes('__dmmxss'), qc);
  assert.equal(queryCanaryUrl('not a url', canaryMath()), null);
  assert.equal(fragmentCanaryUrl('not a url', canaryMath()), null);
  // classifyMxssSink is exported for the blanking behaviour: the
  // sink token itself must not count as an input source.
  const cls = classifyMxssSink(BUNDLE_INNERHTML, BUNDLE_INNERHTML.indexOf('.innerHTML'), '.innerHTML ='.length);
  assert.equal(cls.sinkKind, 'user-input');
});

test('MXSS-6: assessDriveResult — control flag uncalibrated, no flag not-executed, unstable uncalibrated, clean confirm', () => {
  assert.equal(
    assessDriveResult({ controlFlag: true, canaryFlag: true, stable: true }).verdict,
    'uncalibrated',
  );
  assert.equal(
    assessDriveResult({ controlFlag: false, canaryFlag: false, stable: false }).verdict,
    'not-executed',
  );
  assert.equal(
    assessDriveResult({ controlFlag: false, canaryFlag: true, stable: false }).verdict,
    'uncalibrated',
  );
  assert.equal(
    assessDriveResult({ controlFlag: false, canaryFlag: true, stable: true }).verdict,
    'confirmed',
  );
});

// ---- gates ------------------------------------------------------------------

test('MXSS-7: no labCreds — no findings, no bundle fetch', async () => {
  let fetched = 0;
  const findings = await probeMutationXss(PAGE_URL, targetsWith(), {
    labCreds: null,
    allowWrite: true,
    labTargets: labOpts.labTargets,
    depth: 'standard',
    fetchPage: async () => {
      fetched += 1;
      return { status: 200, body: BUNDLE_INNERHTML };
    },
  });
  assert.deepEqual(findings, []);
  assert.equal(fetched, 0);
});

test('MXSS-8: allowWrite false — no findings (control with allowWrite true confirms)', async () => {
  const control = await probeWithFakeCdp('exec-math-query', targetsWith());
  assert.equal(control.findings.length, 1);
  const gated = await probeWithFakeCdp('exec-math-query', targetsWith(), { allowWrite: false });
  assert.deepEqual(gated.findings, []);
});

test('MXSS-9: non-lab target — no findings', async () => {
  const { findings } = await probeWithFakeCdp('exec-math-query', targetsWith(), {
    labTargets: ['juice.lab'],
  });
  assert.deepEqual(findings, []);
});

test('MXSS-10: depth quick — no findings', async () => {
  const { findings } = await probeWithFakeCdp('exec-math-query', targetsWith(), { depth: 'quick' });
  assert.deepEqual(findings, []);
});

// ---- probe outcomes ----------------------------------------------------------

test('MXSS-11: true negative — no HTML-write sink anywhere, no drive', async () => {
  const { findings, diagnostics, runnerCalls } = await probeWithFakeCdp('exec-math-query', targetsWith(), {
    fetchPage: async () => ({ status: 200, body: BUNDLE_CLEAN }),
    pageBody: '',
  });
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.mxssSinks, 0);
  assert.equal(diagnostics.driveAttempted, undefined);
  assert.equal(runnerCalls.length, 0);
});

test('MXSS-12: sink drives but never executes — no finding', async () => {
  const { findings, diagnostics } = await probeWithFakeCdp('noexec', targetsWith());
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.mxssSinks, 1);
  assert.equal(diagnostics.driveAttempted, true);
  assert.equal(diagnostics.driveExecuted, false);
});

test('MXSS-13: query-vector math confirm — exactly one high dom_sink finding', async () => {
  const { findings, diagnostics } = await probeWithFakeCdp('exec-math-query', targetsWith());
  assert.equal(findings.length, 1);
  const f = findings[0];
  assert.equal(f.class, 'dom_sink');
  assert.equal(f.id, 'mutation-xss-flag-execution');
  assert.equal(f.severity, 'high');
  assert.equal(f.url, PAGE_URL);
  assert.ok(f.parameter.includes('query'), f.parameter);
  assert.ok(f.parameter.includes('math'), f.parameter);
  assert.ok(f.parameter.includes('__dmmxss'), f.parameter);
  assert.ok(f.evidence.request.includes('dmmxss='), f.evidence.request);
  assert.ok(f.evidence.request.includes('__dmmxss'), f.evidence.request);
  assert.ok(f.evidence.response.includes('two separate renders'), f.evidence.response);
  assert.ok(f.evidence.response.includes('control render is clean'), f.evidence.response);
  assert.equal(f.evidence.signalCorrelated, true);
  assert.equal(diagnostics.mxssSinks, 1);
  assert.equal(diagnostics.driveExecuted, true);
});

test('MXSS-14: fragment-vector form-math confirm — finding names the fragment vector and form-math shape', async () => {
  const { findings } = await probeWithFakeCdp('exec-form-fragment', targetsWith());
  assert.equal(findings.length, 1);
  const f = findings[0];
  assert.equal(f.class, 'dom_sink');
  assert.equal(f.severity, 'high');
  assert.ok(f.parameter.includes('fragment'), f.parameter);
  assert.ok(f.parameter.includes('form-math'), f.parameter);
  assert.ok(f.evidence.request.includes('#'), f.evidence.request);
  assert.ok(f.evidence.response.includes('__dmmxss'), f.evidence.response);
});

test('MXSS-15: control render sets the flag — uncalibrated, no finding', async () => {
  const { findings, diagnostics } = await probeWithFakeCdp('control-flag', targetsWith());
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.driveAttempted, true);
  assert.equal(diagnostics.driveExecuted, false);
});

test('MXSS-16: flag set on alternating renders — uncalibrated, no finding', async () => {
  const { findings, diagnostics } = await probeWithFakeCdp('unstable', targetsWith());
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.driveAttempted, true);
  assert.equal(diagnostics.driveExecuted, false);
});

test('MXSS-17: browser fails to start, CDP evaluate throws — no findings, never throws', async () => {
  const { findings, diagnostics } = await probeWithFakeCdp('exec-math-query', targetsWith(), {
    runner: async () => ({ ok: false, stdout: '', stderr: 'docker: no such image' }),
  });
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.driveAttempted, true);
  assert.equal(diagnostics.driveExecuted, false);

  const navFail = await probeWithFakeCdp('nav-fail', targetsWith());
  assert.deepEqual(navFail.findings, []);
  assert.equal(navFail.diagnostics.driveAttempted, true);
  assert.equal(navFail.diagnostics.driveExecuted, false);
});

test('MXSS-18: assessConfirmation judges the finding confirmed', async () => {
  const { findings } = await probeWithFakeCdp('exec-math-query', targetsWith());
  assert.equal(findings.length, 1);
  const { verdict } = assessConfirmation(findings[0]);
  assert.equal(verdict, 'confirmed');
});

test('MXSS-19: finding class is dom_sink and never contains xss; severity is high', async () => {
  const { findings } = await probeWithFakeCdp('exec-math-query', targetsWith());
  assert.equal(findings.length, 1);
  assert.equal(findings[0].class, 'dom_sink');
  assert.ok(!findings[0].class.includes('xss'));
  assert.equal(findings[0].severity, 'high');
});

test('MXSS-20: vendor bundle is excluded from the mine', async () => {
  const { findings, diagnostics, runnerCalls } = await probeWithFakeCdp('exec-math-query', targetsWith(VENDOR_URL));
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.mxssSinks, 0);
  assert.equal(diagnostics.driveAttempted, undefined);
  assert.equal(runnerCalls.length, 0);
});

test('MXSS-21: framework bundle defining the sanitizer is skipped whole', async () => {
  const { findings, diagnostics } = await probeWithFakeCdp('exec-math-query', targetsWith(), {
    fetchPage: async () => ({ status: 200, body: BUNDLE_FRAMEWORK }),
  });
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.mxssSinks, 0);
  assert.equal(diagnostics.driveAttempted, undefined);
});

test('MXSS-22: a sink in an inline script counts — drive attempted with no bundles', async () => {
  const { findings, diagnostics } = await probeWithFakeCdp(
    'noexec',
    { bundles: [], inline: [BUNDLE_INNERHTML] },
    { fetchPage: async () => ({ status: 200, body: BUNDLE_CLEAN }) },
  );
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.mxssSinks, 1);
  assert.equal(diagnostics.driveAttempted, true);
});

// ---- the drive helper --------------------------------------------------------

test('MXSS-23: driveMutationXssExecution returns rid, marker, vector and shape; never throws when the runner fails', async () => {
  const calls = [];
  const fake = makeFakeClient('exec-math-query', calls);
  const out = await driveMutationXssExecution(PAGE_URL, {
    timeoutMs: 1,
    settleMs: 0,
    runner: async (file, args) => {
      if (args[0] === 'rm') return { ok: true, stdout: '' };
      return { ok: true, stdout: 'mxss-container\n' };
    },
    cdpConnect: async () => ({ ok: true, client: fake }),
  });
  assert.equal(out.attempted, true);
  assert.equal(out.executed, true);
  assert.equal(out.vector, 'query');
  assert.equal(out.shape, 'math');
  assert.match(out.rid, /^[0-9a-f]{8}$/);
  assert.equal(out.marker, '__dmmxss');
  assert.equal(out.error, null);

  const failed = await driveMutationXssExecution(PAGE_URL, {
    timeoutMs: 1,
    settleMs: 0,
    runner: async () => {
      throw new Error('docker daemon down');
    },
  });
  assert.equal(failed.executed, false);
  assert.ok(failed.error && failed.error.length > 0);
});

test('MXSS-meta: phase 98 registration metadata', () => {
  assert.deepEqual(__mxssMeta, { phases: ['mutation-xss'], depth: ['standard', 'deep'] });
});
