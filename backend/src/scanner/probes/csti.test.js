// CSTI probe tests (row #190 [High] Client-Side Template Injection,
// CWE-79; phase 94, 'csti').
//
// The probe is two tiers: tier 1 mines first-party code for runtime
// template engines (zero engines = proven true negative, no drive);
// tier 2 drives the pasted page in a real browser with the template
// canary {{7*7*191}} in the query string and then in the fragment,
// and confirms ONLY when the full SSTI oracle holds on the rendered
// DOM (control clean, canary evaluates to 9352, literal absent,
// same reflection point in two renders).
//
// The fake CDP client is keyed on the last navigated URL: a URL
// containing '7*7*191' is a canary render (the '*' survives
// encodeURIComponent unescaped, so the check survives real-browser
// percent-encoding), a URL containing 'dmcontrol-' is a control
// render, and 'dmcsti=' marks the query vector (the fragment vector
// has no query param). Modes: 'noexec' (canary never evaluates),
// 'exec-query', 'exec-fragment', 'literal' (canary reflected
// literally, never evaluated), 'control-marker' (the control render
// also contains 9352), 'unstable' (9352 at a different context on
// each render), 'nav-fail' (evaluate throws).

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  probeCsti,
  driveCstiExecution,
  findTemplateEngines,
  assessTemplateFlow,
  assessDriveResult,
  canaryValue,
  controlValue,
  markerValue,
  queryCanaryUrl,
  fragmentCanaryUrl,
  __cstiMeta,
} from './csti.js';
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
const BUNDLE_ANGULAR =
  'angular.module(\'shop\', []).controller(\'Main\', function($scope) {' +
  ' document.getElementById(\'out\').innerHTML = $scope.q; });';
const BUNDLE_HANDLEBARS =
  'var tpl = Handlebars.compile(document.getElementById(\'tpl\').innerHTML);' +
  ' document.getElementById(\'out\').innerHTML = tpl({ q: location.search });';
const BUNDLE_MUSTACHE_SAFE =
  'var html = Mustache.render(\'Hello {{name}}\', { name: location.search });' +
  ' document.getElementById(\'out\').textContent = html;';
const BUNDLE_EJS =
  'var out = ejs.render(\'<%= q %>\', { q: location.search });' +
  ' document.getElementById(\'out\').innerHTML = out;';
const BUNDLE_NUNJUCKS =
  'var out = nunjucks.render(\'page.html\', { q: location.search });' +
  ' document.getElementById(\'out\').innerHTML = out;';
const BUNDLE_VUE =
  'var compiled = Vue.compile(\'<div>{{ q }}</div>\');' +
  ' document.getElementById(\'out\').innerHTML = compiled.render({ q: 1 });';
const BUNDLE_UNDERSCORE =
  'var tpl = _.template(\'<div><%= q %></div>\');' +
  ' document.getElementById(\'out\').innerHTML = tpl({ q: location.search });';
const BUNDLE_DOT =
  'var tpl = doT.template(\'<div>{{=it.q}}</div>\');' +
  ' document.getElementById(\'out\').innerHTML = tpl({ q: location.search });';
const BUNDLE_FRAMEWORK =
  'function bypassSecurityTrustHtml(v) { return v; }' +
  ' var tpl = Handlebars.compile(\'{{q}}\');' +
  ' document.getElementById(\'out\').innerHTML = tpl({ q: location.search });';
const BUNDLE_NO_ENGINE =
  'var compiled = false; var template = null;' +
  ' document.getElementById(\'out\').textContent = \'ready\';';

const HTML_NEUTRAL = '<html><body><div>shop</div></body></html>';
const HTML_CONTROL =
  '<html><body><div id="out">hello dmcontrol-abc123</div></body></html>';
const HTML_MARKER =
  '<html><body><div id="out">result: 9352</div></body></html>';
const HTML_MARKER_A =
  '<html><body><div id="a">result: 9352</div></body></html>';
const HTML_MARKER_B =
  '<html><body><div id="b">total: 9352</div></body></html>';
const HTML_LITERAL =
  '<html><body><div id="out">{{7*7*191}}</div></body></html>';

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
      if (expr !== 'document.documentElement.outerHTML') return null;
      if (mode === 'nav-fail') throw new Error('navigation failed');
      const url = lastUrl;
      const isControl = url.includes('dmcontrol-');
      const isCanary = url.includes('7*7*191');
      const isQuery = url.includes('dmcsti=');
      if (isControl) {
        if (mode === 'control-marker') return HTML_MARKER;
        return HTML_CONTROL;
      }
      if (isCanary) {
        if (mode === 'literal') return HTML_LITERAL;
        if (mode === 'exec-query' && isQuery) return HTML_MARKER;
        if (mode === 'exec-fragment' && !isQuery) return HTML_MARKER;
        if (mode === 'unstable') {
          canaryReads += 1;
          return canaryReads % 2 === 1 ? HTML_MARKER_A : HTML_MARKER_B;
        }
        return HTML_NEUTRAL;
      }
      return HTML_NEUTRAL;
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
    headers: {},
    fetchPage: async () => ({ status: 200, body: BUNDLE_ANGULAR }),
    runner: async (file, args) => {
      runnerCalls.push({ file, args });
      if (args[0] === 'rm') return { ok: true, stdout: '' };
      return { ok: true, stdout: 'csti-container\n' };
    },
    cdpConnect: async () => ({ ok: true, client: fake }),
    diagnostics,
    ...extra,
  };
  const findings = await probeCsti(PAGE_URL, targets, opts);
  return { findings, diagnostics, calls, runnerCalls, fake };
}

function targetsWith(bundleUrl = BUNDLE_URL) {
  return { bundles: [bundleUrl], inline: [] };
}

// ---- tier 1: the static mine (pure) -----------------------------------------

test('CSTI-1: mine finds every runtime template-engine kind', () => {
  const cases = [
    [BUNDLE_ANGULAR, 'angularjs'],
    [BUNDLE_HANDLEBARS, 'handlebars'],
    [BUNDLE_MUSTACHE_SAFE, 'mustache'],
    [BUNDLE_EJS, 'ejs'],
    [BUNDLE_NUNJUCKS, 'nunjucks'],
    [BUNDLE_VUE, 'vue-runtime'],
    [BUNDLE_UNDERSCORE, 'underscore'],
    [BUNDLE_DOT, 'dot'],
  ];
  for (const [body, kind] of cases) {
    const found = findTemplateEngines(body);
    assert.equal(found.length, 1, `expected one ${kind} engine, got ${found.length}`);
    assert.equal(found[0].kind, kind);
    assert.ok(found[0].line >= 1);
    assert.ok(found[0].snippet.length > 0);
  }
  // A body that merely mentions compilation is not an engine.
  assert.deepEqual(findTemplateEngines(BUNDLE_NO_ENGINE), []);
});

test('CSTI-2: clean code has no engines', () => {
  assert.deepEqual(findTemplateEngines(BUNDLE_CLEAN), []);
  assert.deepEqual(findTemplateEngines(''), []);
  assert.deepEqual(findTemplateEngines(null), []);
});

test('CSTI-3: engine near an HTML sink is near-sink, textContent only is safe-only', () => {
  const near = findTemplateEngines(BUNDLE_ANGULAR);
  assert.equal(near.length, 1);
  assert.equal(near[0].nearSink, true);
  assert.equal(near[0].sinkKind, 'innerHTML');
  assert.equal(near[0].safeOnly, false);

  const safe = findTemplateEngines(BUNDLE_MUSTACHE_SAFE);
  assert.equal(safe.length, 1);
  assert.equal(safe[0].nearSink, false);
  assert.equal(safe[0].safeOnly, true);
  assert.equal(safe[0].sinkKind, 'textContent');

  const plain = findTemplateEngines('var t = Handlebars.compile(\'{{q}}\');');
  assert.equal(plain.length, 1);
  assert.equal(plain[0].nearSink, false);
  assert.equal(plain[0].sinkKind, null);
  assert.equal(plain[0].safeOnly, false);
});

test('CSTI-4: assessTemplateFlow drives only when an engine exists', () => {
  assert.deepEqual(assessTemplateFlow([]), { engines: 0, nearSink: 0, drive: false });
  const one = findTemplateEngines(BUNDLE_ANGULAR);
  assert.deepEqual(assessTemplateFlow(one), { engines: 1, nearSink: 1, drive: true });
  const safe = findTemplateEngines(BUNDLE_MUSTACHE_SAFE);
  assert.deepEqual(assessTemplateFlow(safe), { engines: 1, nearSink: 0, drive: true });
});

test('CSTI-5: canary builders — query and fragment URLs, control literal, marker', () => {
  assert.equal(canaryValue(), '{{7*7*191}}');
  assert.equal(markerValue(), '9352');
  assert.equal(controlValue('abcd1234'), 'dmcontrol-abcd1234');
  const q = queryCanaryUrl(PAGE_URL, canaryValue());
  assert.ok(q.includes('dmcsti='), q);
  assert.ok(q.includes('%7B%7B7*7*191%7D%7D'), q);
  const f = fragmentCanaryUrl(PAGE_URL, canaryValue());
  assert.ok(f.includes('#%7B%7B7*7*191%7D%7D'), f);
  assert.ok(!f.includes('dmcsti='), f);
  const qc = queryCanaryUrl(PAGE_URL, controlValue('abcd1234'));
  assert.ok(qc.includes('dmcontrol-abcd1234'), qc);
  assert.ok(!qc.includes('9352'), qc);
  assert.equal(queryCanaryUrl('not a url', canaryValue()), null);
  assert.equal(fragmentCanaryUrl('not a url', canaryValue()), null);
});

test('CSTI-6: assessDriveResult — control marker uncalibrated, no marker not-executed, literal not-executed, unstable uncalibrated, clean confirm', () => {
  assert.equal(
    assessDriveResult({ controlMarker: true, canaryMarker: true, literalPresent: false, samePoint: true }).verdict,
    'uncalibrated',
  );
  assert.equal(
    assessDriveResult({ controlMarker: false, canaryMarker: false, literalPresent: false, samePoint: false }).verdict,
    'not-executed',
  );
  assert.equal(
    assessDriveResult({ controlMarker: false, canaryMarker: true, literalPresent: true, samePoint: true }).verdict,
    'not-executed',
  );
  assert.equal(
    assessDriveResult({ controlMarker: false, canaryMarker: true, literalPresent: false, samePoint: false }).verdict,
    'uncalibrated',
  );
  assert.equal(
    assessDriveResult({ controlMarker: false, canaryMarker: true, literalPresent: false, samePoint: true }).verdict,
    'confirmed',
  );
});

// ---- gates ------------------------------------------------------------------

test('CSTI-7: no labCreds — no findings, no bundle fetch', async () => {
  let fetched = 0;
  const findings = await probeCsti(PAGE_URL, targetsWith(), {
    labCreds: null,
    allowWrite: true,
    labTargets: labOpts.labTargets,
    depth: 'standard',
    fetchPage: async () => {
      fetched += 1;
      return { status: 200, body: BUNDLE_ANGULAR };
    },
  });
  assert.deepEqual(findings, []);
  assert.equal(fetched, 0);
});

test('CSTI-8: allowWrite false — no findings (control with allowWrite true confirms)', async () => {
  const control = await probeWithFakeCdp('exec-query', targetsWith());
  assert.equal(control.findings.length, 1);
  const gated = await probeWithFakeCdp('exec-query', targetsWith(), { allowWrite: false });
  assert.deepEqual(gated.findings, []);
});

test('CSTI-9: non-lab target — no findings', async () => {
  const { findings } = await probeWithFakeCdp('exec-query', targetsWith(), {
    labTargets: ['juice.lab'],
  });
  assert.deepEqual(findings, []);
});

test('CSTI-10: depth quick — no findings', async () => {
  const { findings } = await probeWithFakeCdp('exec-query', targetsWith(), { depth: 'quick' });
  assert.deepEqual(findings, []);
});

// ---- probe outcomes ----------------------------------------------------------

test('CSTI-11: true negative — no engine in first-party code, no drive', async () => {
  const { findings, diagnostics, runnerCalls } = await probeWithFakeCdp('exec-query', targetsWith(), {
    fetchPage: async () => ({ status: 200, body: BUNDLE_CLEAN }),
  });
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.engines, 0);
  assert.equal(diagnostics.driveAttempted, undefined);
  assert.equal(runnerCalls.length, 0);
});

test('CSTI-12: engine present but canary never evaluates — no finding, drive attempted', async () => {
  const { findings, diagnostics } = await probeWithFakeCdp('noexec', targetsWith());
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.engines, 1);
  assert.equal(diagnostics.enginesNearSink, 1);
  assert.equal(diagnostics.driveAttempted, true);
  assert.equal(diagnostics.driveExecuted, false);
});

test('CSTI-13: query-vector confirm — exactly one high dom_sink finding', async () => {
  const { findings, diagnostics } = await probeWithFakeCdp('exec-query', targetsWith());
  assert.equal(findings.length, 1);
  const f = findings[0];
  assert.equal(f.class, 'dom_sink');
  assert.equal(f.id, 'csti-template-eval');
  assert.equal(f.severity, 'high');
  assert.equal(f.url, PAGE_URL);
  assert.ok(f.parameter.includes('query'), f.parameter);
  assert.ok(f.parameter.includes('9352'), f.parameter);
  assert.ok(f.evidence.request.includes('dmcsti='), f.evidence.request);
  assert.ok(f.evidence.request.includes('9352'), f.evidence.request);
  assert.ok(f.evidence.response.includes('9352'), f.evidence.response);
  assert.ok(f.evidence.response.includes('same reflection point'), f.evidence.response);
  assert.equal(f.evidence.signalCorrelated, true);
  assert.equal(diagnostics.engines, 1);
  assert.equal(diagnostics.driveExecuted, true);
});

test('CSTI-14: fragment-vector confirm — finding names the fragment vector', async () => {
  const { findings } = await probeWithFakeCdp('exec-fragment', targetsWith());
  assert.equal(findings.length, 1);
  const f = findings[0];
  assert.equal(f.class, 'dom_sink');
  assert.equal(f.severity, 'high');
  assert.ok(f.parameter.includes('fragment'), f.parameter);
  assert.ok(f.evidence.request.includes('#'), f.evidence.request);
  assert.ok(f.evidence.response.includes('9352'), f.evidence.response);
});

test('CSTI-15: control render contains the marker — uncalibrated, no finding', async () => {
  const { findings, diagnostics } = await probeWithFakeCdp('control-marker', targetsWith());
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.driveAttempted, true);
  assert.equal(diagnostics.driveExecuted, false);
});

test('CSTI-16: marker at an unstable reflection point — uncalibrated, no finding', async () => {
  const { findings, diagnostics } = await probeWithFakeCdp('unstable', targetsWith());
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.driveAttempted, true);
  assert.equal(diagnostics.driveExecuted, false);
});

test('CSTI-17: canary reflected literally — no finding', async () => {
  const { findings, diagnostics } = await probeWithFakeCdp('literal', targetsWith());
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.engines, 1);
  assert.equal(diagnostics.driveAttempted, true);
  assert.equal(diagnostics.driveExecuted, false);
});

test('CSTI-18: browser fails to start — no findings, never throws', async () => {
  const { findings, diagnostics } = await probeWithFakeCdp('exec-query', targetsWith(), {
    runner: async () => ({ ok: false, stdout: '', stderr: 'docker: no such image' }),
  });
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.driveAttempted, true);
  assert.equal(diagnostics.driveExecuted, false);
});

test('CSTI-19: assessConfirmation judges the finding confirmed', async () => {
  const { findings } = await probeWithFakeCdp('exec-query', targetsWith());
  assert.equal(findings.length, 1);
  const { verdict } = assessConfirmation(findings[0]);
  assert.equal(verdict, 'confirmed');
});

test('CSTI-20: finding class is dom_sink and never contains xss', async () => {
  const { findings } = await probeWithFakeCdp('exec-query', targetsWith());
  assert.equal(findings.length, 1);
  assert.equal(findings[0].class, 'dom_sink');
  assert.ok(!findings[0].class.includes('xss'));
});

test('CSTI-21: vendor bundle is excluded from the mine', async () => {
  const { findings, diagnostics, runnerCalls } = await probeWithFakeCdp('exec-query', targetsWith(VENDOR_URL));
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.engines, 0);
  assert.equal(diagnostics.driveAttempted, undefined);
  assert.equal(runnerCalls.length, 0);
});

test('CSTI-22: framework bundle defining the sanitizer is skipped whole', async () => {
  const { findings, diagnostics } = await probeWithFakeCdp('exec-query', targetsWith(), {
    fetchPage: async () => ({ status: 200, body: BUNDLE_FRAMEWORK }),
  });
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.engines, 0);
  assert.equal(diagnostics.driveAttempted, undefined);
});

test('CSTI-23: an engine in an inline script counts — drive attempted with no bundles', async () => {
  const { findings, diagnostics } = await probeWithFakeCdp(
    'noexec',
    { bundles: [], inline: [BUNDLE_HANDLEBARS] },
    { fetchPage: async () => ({ status: 200, body: BUNDLE_CLEAN }) },
  );
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.engines, 1);
  assert.equal(diagnostics.driveAttempted, true);
});

// ---- the drive helper --------------------------------------------------------

test('CSTI-24: driveCstiExecution returns rid, marker and vector for verbatim evidence', async () => {
  const calls = [];
  const diagnostics = {};
  const fake = makeFakeClient('exec-query', calls);
  const out = await driveCstiExecution(PAGE_URL, {
    timeoutMs: 1,
    runner: async (file, args) => {
      if (args[0] === 'rm') return { ok: true, stdout: '' };
      return { ok: true, stdout: 'csti-container\n' };
    },
    cdpConnect: async () => ({ ok: true, client: fake }),
    diagnostics,
  });
  assert.equal(out.attempted, true);
  assert.equal(out.executed, true);
  assert.equal(out.vector, 'query');
  assert.match(out.rid, /^[0-9a-f]{8}$/);
  assert.equal(out.marker, '9352');
  assert.equal(out.error, null);
});

test('CSTI-25: drive never throws when the runner fails', async () => {
  const out = await driveCstiExecution(PAGE_URL, {
    timeoutMs: 1,
    runner: async () => {
      throw new Error('docker daemon down');
    },
  });
  assert.equal(out.executed, false);
  assert.ok(out.error && out.error.length > 0);
});

test('CSTI-meta: phase 94 registration metadata', () => {
  assert.deepEqual(__cstiMeta, { phases: ['csti'], depth: ['standard', 'deep'] });
});
