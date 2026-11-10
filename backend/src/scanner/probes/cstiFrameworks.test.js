// CSTI framework variants probe tests (rows #452–#455 [High]
// Client-Side Template Injection, CWE-94/CWE-79; phase 111,
// 'csti-frameworks').
//
// The probe is framework-gated: tier 1 fingerprints a matching
// client-side template framework (AngularJS / Vue / Knockout /
// Handlebars / React) in first-party code + the served page HTML;
// zero frameworks is a proven true negative with a 'no matching
// framework' diagnostic, no drive. Tier 2 drives the pasted page
// in a real browser with a canary — {{7*7*191}} for template
// frameworks (the #190 drive, reused), <i data-dmreact="9352">x</i>
// for React (parsed-markup oracle) — and confirms ONLY when the
// oracle holds on the rendered DOM.
//
// The fake CDP client is keyed on the decoded last navigated URL:
// a URL containing '7*7*191' is a template canary render, a URL
// containing '<i data-dmreact="9352">' is a React canary render, a
// URL containing 'dmcontrol-' is a control render, and 'dmcsti=' /
// 'dmreact=' mark the query vector (the fragment vector has no
// query param). Modes: 'noexec' (canary never evaluates),
// 'exec-query', 'exec-fragment', 'literal' (template canary
// reflected literally, never evaluated), 'control-marker' (the
// control render also contains 9352), 'unstable' (9352 at a
// different context on each render), 'exec-react-query',
// 'exec-react-fragment', 'react-literal' (React canary echoed as
// escaped text, never parsed), 'react-control-marker' (the control
// render also contains the parsed element), 'react-unstable'
// (parsed element at a different context on each render),
// 'nav-fail' (evaluate throws).

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  probeCstiFrameworks,
  driveReactHtml,
  detectFrameworks,
  assessFrameworkGate,
  assessReactDriveResult,
  reactCanaryValue,
  reactControlValue,
  reactMarkerValue,
  reactQueryCanaryUrl,
  reactFragmentCanaryUrl,
  __cstiFrameworksMeta,
} from './cstiFrameworks.js';
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
const BUNDLE_ANGULARJS =
  'angular.module(\'shop\', []).controller(\'Main\', function($scope) {' +
  ' document.getElementById(\'out\').innerHTML = $scope.q; });';
const BUNDLE_VUE =
  'var app = new Vue({ el: \'#app\', template: \'<div v-html="q"></div>\' });' +
  ' document.getElementById(\'out\').innerHTML = app.q;';
const BUNDLE_VUE_CREATEAPP =
  'Vue.createApp({ template: \'<div>{{ q }}</div>\' }).mount(\'#app\');';
const BUNDLE_KNOCKOUT =
  'ko.applyBindings({ q: ko.observable(location.search) });' +
  ' document.getElementById(\'out\').innerHTML = \'ready\';';
const BUNDLE_HANDLEBARS =
  'var tpl = Handlebars.compile(document.getElementById(\'tpl\').innerHTML);' +
  ' document.getElementById(\'out\').innerHTML = tpl({ q: location.search });';
const BUNDLE_REACT =
  'var root = ReactDOM.createRoot(document.getElementById(\'root\'));' +
  ' root.render(React.createElement(\'div\', { dangerouslySetInnerHTML: { __html: location.search } }));';
const BUNDLE_REACT_NO_SINK =
  'var root = ReactDOM.createRoot(document.getElementById(\'root\'));' +
  ' root.render(React.createElement(\'div\', null, \'hello\'));';
// Modern Angular (compiled templates): ng-version + app-root +
// compiled symbols, never angular.module / ng-app / $scope — must
// fingerprint ZERO frameworks.
const BUNDLE_MODERN_ANGULAR =
  '\'use strict\'; function ShopComponent(){ this.title = \'shop\'; }' +
  ' ShopComponent.\u0275\u0275fac = function(t){ return new (t || ShopComponent)(); };' +
  ' ShopComponent.\u0275\u0275cmp = { type: ShopComponent, selectors: [[\"app-root\"]],' +
  ' decls: 4, vars: 1, template: function(rf, ctx){ if (rf & 1) { \u0275\u0275element(0, \"h1\"); } } };' +
  ' document.querySelector(\'app-root\').setAttribute(\'ng-version\', \'17.3.0\');';
const BUNDLE_FRAMEWORK =
  'function bypassSecurityTrustHtml(v) { return v; }' +
  ' var tpl = Handlebars.compile(\'{{q}}\');' +
  ' document.getElementById(\'out\').innerHTML = tpl({ q: location.search });';
const BUNDLE_NO_FRAMEWORK =
  'var compiled = false; var template = null;' +
  ' document.getElementById(\'out\').textContent = \'ready\';';

const HTML_CLEAN = '<html><body><div>shop</div></body></html>';
const HTML_ANGULARJS_ATTRS =
  '<html ng-app="shop"><body ng-controller="Main"><div>{{ q }}</div></body></html>';
const HTML_DATABIND =
  '<html><body><div data-bind="text: q"></div></body></html>';
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
const HTML_REACT_MARKER =
  '<html><body><div id="out"><i data-dmreact="9352">x</i></div></body></html>';
const HTML_REACT_MARKER_A =
  '<html><body><div id="a"><i data-dmreact="9352">x</i></div></body></html>';
const HTML_REACT_MARKER_B =
  '<html><body><div id="b"><i data-dmreact="9352">x</i></div></body></html>';
const HTML_REACT_LITERAL =
  '<html><body><div id="out">&lt;i data-dmreact="9352"&gt;x&lt;/i&gt;</div></body></html>';

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
      const url = decodeURIComponent(lastUrl.replace(/\+/g, '%20'));
      const isControl = url.includes('dmcontrol-');
      const isTemplateCanary = url.includes('7*7*191');
      const isReactCanary = url.includes('<i data-dmreact="9352">');
      const isTemplateQuery = url.includes('dmcsti=');
      // '?dmreact=' / '&dmreact=' — the canary itself contains
      // 'data-dmreact=', which must NOT count as the query vector.
      const isReactQuery = url.includes('?dmreact=') || url.includes('&dmreact=');
      if (isControl) {
        if (mode === 'control-marker') return HTML_MARKER;
        if (mode === 'react-control-marker') return HTML_REACT_MARKER;
        return HTML_CONTROL;
      }
      if (isReactCanary) {
        if (mode === 'react-literal') return HTML_REACT_LITERAL;
        if (mode === 'exec-react-query' && isReactQuery) return HTML_REACT_MARKER;
        if (mode === 'exec-react-fragment' && !isReactQuery) return HTML_REACT_MARKER;
        if (mode === 'react-unstable') {
          canaryReads += 1;
          return canaryReads % 2 === 1 ? HTML_REACT_MARKER_A : HTML_REACT_MARKER_B;
        }
        return HTML_NEUTRAL;
      }
      if (isTemplateCanary) {
        if (mode === 'literal') return HTML_LITERAL;
        if (mode === 'exec-query' && isTemplateQuery) return HTML_MARKER;
        if (mode === 'exec-fragment' && !isTemplateQuery) return HTML_MARKER;
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
    pageBody: HTML_CLEAN,
    fetchPage: async () => ({ status: 200, body: BUNDLE_ANGULARJS }),
    runner: async (file, args) => {
      runnerCalls.push({ file, args });
      if (args[0] === 'rm') return { ok: true, stdout: '' };
      return { ok: true, stdout: 'csti-frameworks-container\n' };
    },
    cdpConnect: async () => ({ ok: true, client: fake }),
    diagnostics,
    ...extra,
  };
  const findings = await probeCstiFrameworks(PAGE_URL, targets, opts);
  return { findings, diagnostics, calls, runnerCalls, fake };
}

function targetsWith(bundleUrl = BUNDLE_URL) {
  return { bundles: [bundleUrl], inline: [] };
}

// ---- tier 1: the framework fingerprint (pure) ------------------------------

test('CF-1: detectFrameworks finds every framework kind', () => {
  const cases = [
    [BUNDLE_ANGULARJS, 'angularjs'],
    [BUNDLE_VUE, 'vue'],
    [BUNDLE_VUE_CREATEAPP, 'vue'],
    [BUNDLE_KNOCKOUT, 'knockout'],
    [BUNDLE_HANDLEBARS, 'handlebars'],
    [BUNDLE_REACT, 'react'],
  ];
  for (const [body, kind] of cases) {
    const found = detectFrameworks(body, 'test');
    assert.ok(found.length >= 1, `expected >=1 ${kind} marker, got ${found.length}`);
    assert.ok(found.some((f) => f.kind === kind), `expected a ${kind} marker`);
    assert.ok(found[0].line >= 1);
    assert.ok(found[0].snippet.length > 0);
    assert.equal(found[0].source, 'test');
  }
  // A body that merely mentions compilation is not a framework.
  assert.deepEqual(detectFrameworks(BUNDLE_NO_FRAMEWORK, 'test'), []);
});

test('CF-2: modern Angular fingerprints zero frameworks', () => {
  // ng-version + app-root + compiled symbols must NOT trip the gate:
  // Juice Shop is modern Angular, and the gate must stay shut there.
  assert.deepEqual(detectFrameworks(BUNDLE_MODERN_ANGULAR, 'test'), []);
  assert.deepEqual(detectFrameworks(BUNDLE_CLEAN, 'test'), []);
  assert.deepEqual(detectFrameworks('', 'test'), []);
  assert.deepEqual(detectFrameworks(null, 'test'), []);
});

test('CF-3: HTML attribute markers count — ng-app / ng-controller / data-bind', () => {
  const ng = detectFrameworks(HTML_ANGULARJS_ATTRS, 'page html');
  assert.ok(ng.some((f) => f.kind === 'angularjs'), 'ng-app/ng-controller must fingerprint AngularJS');
  const ko = detectFrameworks(HTML_DATABIND, 'page html');
  assert.ok(ko.some((f) => f.kind === 'knockout'), 'data-bind must fingerprint Knockout');
  assert.deepEqual(detectFrameworks(HTML_CLEAN, 'page html'), []);
});

test('CF-4: assessFrameworkGate — empty shuts the gate, React needs its sink', () => {
  assert.deepEqual(assessFrameworkGate([]), {
    detected: false,
    frameworks: 0,
    kinds: [],
    reactSink: false,
    driveTemplate: false,
    driveReact: false,
  });
  const ng = detectFrameworks(BUNDLE_ANGULARJS, 'test');
  assert.deepEqual(assessFrameworkGate(ng), {
    detected: true,
    frameworks: ng.length,
    kinds: ['angularjs'],
    reactSink: false,
    driveTemplate: true,
    driveReact: false,
  });
  // React without dangerouslySetInnerHTML: detected, but no React drive.
  const reactNoSink = detectFrameworks(BUNDLE_REACT_NO_SINK, 'test');
  const gateNoSink = assessFrameworkGate(reactNoSink);
  assert.equal(gateNoSink.detected, true);
  assert.deepEqual(gateNoSink.kinds, ['react']);
  assert.equal(gateNoSink.reactSink, false);
  assert.equal(gateNoSink.driveReact, false);
  assert.equal(gateNoSink.driveTemplate, false);
  // React with the sink: React drive warranted.
  const reactSink = detectFrameworks(BUNDLE_REACT, 'test');
  const gateSink = assessFrameworkGate(reactSink);
  assert.equal(gateSink.reactSink, true);
  assert.equal(gateSink.driveReact, true);
  // Mixed frameworks: both drives warranted, kinds in first-seen order.
  const mixed = [
    ...detectFrameworks(BUNDLE_ANGULARJS, 'a'),
    ...detectFrameworks(BUNDLE_REACT, 'b'),
  ];
  assert.deepEqual(assessFrameworkGate(mixed).kinds, ['angularjs', 'react']);
  assert.equal(assessFrameworkGate(mixed).driveTemplate, true);
  assert.equal(assessFrameworkGate(mixed).driveReact, true);
});

test('CF-5: React canary builders — query and fragment URLs, control literal, marker', () => {
  assert.equal(reactCanaryValue(), '<i data-dmreact="9352">x</i>');
  assert.equal(reactMarkerValue(), '<i data-dmreact="9352">');
  assert.equal(reactControlValue('abcd1234'), 'dmcontrol-abcd1234');
  const q = reactQueryCanaryUrl(PAGE_URL, reactCanaryValue());
  assert.ok(q.includes('dmreact='), q);
  // URLSearchParams encodes the space as '+' (form encoding).
  assert.ok(q.includes('%3Ci+data-dmreact%3D%229352%22%3Ex'), q);
  const f = reactFragmentCanaryUrl(PAGE_URL, reactCanaryValue());
  assert.ok(f.includes('#%3Ci%20data-dmreact%3D%229352%22%3Ex'), f);
  assert.ok(!f.includes('dmreact='), f);
  const qc = reactQueryCanaryUrl(PAGE_URL, reactControlValue('abcd1234'));
  assert.ok(qc.includes('dmcontrol-abcd1234'), qc);
  assert.ok(!qc.includes('9352'), qc);
  assert.equal(reactQueryCanaryUrl('not a url', reactCanaryValue()), null);
  assert.equal(reactFragmentCanaryUrl('not a url', reactCanaryValue()), null);
});

test('CF-6: assessReactDriveResult — control parsed uncalibrated, no parse not-executed, unstable uncalibrated, clean confirm', () => {
  assert.equal(
    assessReactDriveResult({ controlParsed: true, canaryParsed: true, samePoint: true }).verdict,
    'uncalibrated',
  );
  assert.equal(
    assessReactDriveResult({ controlParsed: false, canaryParsed: false, samePoint: false }).verdict,
    'not-executed',
  );
  assert.equal(
    assessReactDriveResult({ controlParsed: false, canaryParsed: true, samePoint: false }).verdict,
    'uncalibrated',
  );
  assert.equal(
    assessReactDriveResult({ controlParsed: false, canaryParsed: true, samePoint: true }).verdict,
    'confirmed',
  );
});

// ---- gates ------------------------------------------------------------------

test('CF-7: no labCreds — no findings, no bundle fetch', async () => {
  let fetched = 0;
  const findings = await probeCstiFrameworks(PAGE_URL, targetsWith(), {
    labCreds: null,
    allowWrite: true,
    labTargets: labOpts.labTargets,
    depth: 'standard',
    fetchPage: async () => {
      fetched += 1;
      return { status: 200, body: BUNDLE_ANGULARJS };
    },
  });
  assert.deepEqual(findings, []);
  assert.equal(fetched, 0);
});

test('CF-8: allowWrite false — no findings (control with allowWrite true confirms)', async () => {
  const control = await probeWithFakeCdp('exec-query', targetsWith());
  assert.equal(control.findings.length, 1);
  const gated = await probeWithFakeCdp('exec-query', targetsWith(), { allowWrite: false });
  assert.deepEqual(gated.findings, []);
});

test('CF-9: non-lab target — no findings', async () => {
  const { findings } = await probeWithFakeCdp('exec-query', targetsWith(), {
    labTargets: ['juice.lab'],
  });
  assert.deepEqual(findings, []);
});

test('CF-10: depth quick — no findings', async () => {
  const { findings } = await probeWithFakeCdp('exec-query', targetsWith(), { depth: 'quick' });
  assert.deepEqual(findings, []);
});

// ---- probe outcomes: the gate ------------------------------------------------

test('CF-11: true negative — no framework anywhere, no drive, gate diagnostic set', async () => {
  const { findings, diagnostics, runnerCalls } = await probeWithFakeCdp('exec-query', targetsWith(), {
    fetchPage: async () => ({ status: 200, body: BUNDLE_CLEAN }),
  });
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.frameworks, 0);
  assert.equal(diagnostics.frameworkKinds, '');
  assert.equal(diagnostics.frameworkDetected, false);
  assert.equal(diagnostics.skipReason, 'no matching framework');
  assert.equal(diagnostics.driveAttempted, undefined);
  assert.equal(runnerCalls.length, 0);
});

test('CF-12: modern Angular bundle — gate stays shut, true negative with diagnostic', async () => {
  const { findings, diagnostics, runnerCalls } = await probeWithFakeCdp('exec-query', targetsWith(), {
    fetchPage: async () => ({ status: 200, body: BUNDLE_MODERN_ANGULAR }),
  });
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.frameworks, 0);
  assert.equal(diagnostics.frameworkDetected, false);
  assert.equal(diagnostics.skipReason, 'no matching framework');
  assert.equal(diagnostics.driveAttempted, undefined);
  assert.equal(runnerCalls.length, 0);
});

test('CF-13: framework present but canary never evaluates — no finding, drive attempted', async () => {
  const { findings, diagnostics } = await probeWithFakeCdp('noexec', targetsWith());
  assert.deepEqual(findings, []);
  // angular.module + $scope x2: three markers, one kind.
  assert.equal(diagnostics.frameworks, 3);
  assert.equal(diagnostics.frameworkKinds, 'angularjs');
  assert.equal(diagnostics.frameworkDetected, true);
  assert.equal(diagnostics.driveAttempted, true);
  assert.equal(diagnostics.driveKind, 'template');
  assert.equal(diagnostics.driveExecuted, false);
});

// ---- probe outcomes: template frameworks --------------------------------------

test('CF-14: AngularJS query-vector confirm — exactly one high dom_sink finding (#452)', async () => {
  const { findings, diagnostics } = await probeWithFakeCdp('exec-query', targetsWith());
  assert.equal(findings.length, 1);
  const f = findings[0];
  assert.equal(f.class, 'dom_sink');
  assert.equal(f.id, 'csti-framework-angularjs');
  assert.equal(f.severity, 'high');
  assert.equal(f.url, PAGE_URL);
  assert.ok(f.title.includes('AngularJS'), f.title);
  assert.ok(f.parameter.includes('query'), f.parameter);
  assert.ok(f.parameter.includes('9352'), f.parameter);
  assert.ok(f.evidence.request.includes('dmcsti='), f.evidence.request);
  assert.ok(f.evidence.request.includes('9352'), f.evidence.request);
  assert.ok(f.evidence.response.includes('9352'), f.evidence.response);
  assert.ok(f.evidence.response.includes('same reflection point'), f.evidence.response);
  assert.ok(f.evidence.response.includes('#452'), f.evidence.response);
  assert.equal(f.evidence.signalCorrelated, true);
  assert.equal(diagnostics.frameworks, 3);
  assert.equal(diagnostics.driveExecuted, true);
});

test('CF-15: Vue fragment-vector confirm — finding names Vue and the fragment (#453)', async () => {
  const { findings } = await probeWithFakeCdp('exec-fragment', targetsWith(), {
    fetchPage: async () => ({ status: 200, body: BUNDLE_VUE }),
  });
  assert.equal(findings.length, 1);
  const f = findings[0];
  assert.equal(f.class, 'dom_sink');
  assert.equal(f.id, 'csti-framework-vue');
  assert.equal(f.severity, 'high');
  assert.ok(f.title.includes('Vue'), f.title);
  assert.ok(f.parameter.includes('fragment'), f.parameter);
  assert.ok(f.evidence.request.includes('#'), f.evidence.request);
  assert.ok(f.evidence.response.includes('#453'), f.evidence.response);
});

test('CF-16: Handlebars query confirm — Knockout/Handlebars id, row #454', async () => {
  const { findings } = await probeWithFakeCdp('exec-query', targetsWith(), {
    fetchPage: async () => ({ status: 200, body: BUNDLE_HANDLEBARS }),
  });
  assert.equal(findings.length, 1);
  const f = findings[0];
  assert.equal(f.class, 'dom_sink');
  assert.equal(f.id, 'csti-framework-knockout-handlebars');
  assert.equal(f.severity, 'high');
  assert.ok(f.title.includes('Knockout'), f.title);
  assert.ok(f.evidence.response.includes('#454'), f.evidence.response);
});

test('CF-17: Knockout-only — template drive attempted, not executed, no finding', async () => {
  // Knockout has no {{ }} surface: the drive runs (Handlebars half
  // of #454) and honestly reports not-executed.
  const { findings, diagnostics } = await probeWithFakeCdp('noexec', targetsWith(), {
    fetchPage: async () => ({ status: 200, body: BUNDLE_KNOCKOUT }),
  });
  assert.deepEqual(findings, []);
  // ko.applyBindings + ko.observable: two markers, one kind.
  assert.equal(diagnostics.frameworks, 2);
  assert.equal(diagnostics.frameworkKinds, 'knockout');
  assert.equal(diagnostics.driveAttempted, true);
  assert.equal(diagnostics.driveExecuted, false);
});

test('CF-18: template control render contains the marker — uncalibrated, no finding', async () => {
  const { findings, diagnostics } = await probeWithFakeCdp('control-marker', targetsWith());
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.driveAttempted, true);
  assert.equal(diagnostics.driveExecuted, false);
});

test('CF-19: template marker at an unstable reflection point — uncalibrated, no finding', async () => {
  const { findings, diagnostics } = await probeWithFakeCdp('unstable', targetsWith());
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.driveAttempted, true);
  assert.equal(diagnostics.driveExecuted, false);
});

test('CF-20: template canary reflected literally — no finding', async () => {
  const { findings, diagnostics } = await probeWithFakeCdp('literal', targetsWith());
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.frameworks, 3);
  assert.equal(diagnostics.driveAttempted, true);
  assert.equal(diagnostics.driveExecuted, false);
});

// ---- probe outcomes: React ---------------------------------------------------

test('CF-21: React query confirm — exactly one high dom_sink finding (#455)', async () => {
  const { findings, diagnostics } = await probeWithFakeCdp('exec-react-query', targetsWith(), {
    fetchPage: async () => ({ status: 200, body: BUNDLE_REACT }),
  });
  assert.equal(findings.length, 1);
  const f = findings[0];
  assert.equal(f.class, 'dom_sink');
  assert.equal(f.id, 'csti-framework-react');
  assert.equal(f.severity, 'high');
  assert.equal(f.url, PAGE_URL);
  assert.ok(f.title.includes('React'), f.title);
  assert.ok(f.title.includes('dangerouslySetInnerHTML'), f.title);
  assert.ok(f.parameter.includes('dmreact'), f.parameter);
  assert.ok(f.parameter.includes('query'), f.parameter);
  assert.ok(f.evidence.request.includes('dmreact='), f.evidence.request);
  assert.ok(f.evidence.response.includes('dangerouslySetInnerHTML'), f.evidence.response);
  assert.ok(f.evidence.response.includes('#455'), f.evidence.response);
  assert.equal(f.evidence.signalCorrelated, true);
  assert.equal(diagnostics.driveKind, 'react');
  assert.equal(diagnostics.driveExecuted, true);
});

test('CF-22: React fragment confirm — finding names the fragment vector', async () => {
  const { findings } = await probeWithFakeCdp('exec-react-fragment', targetsWith(), {
    fetchPage: async () => ({ status: 200, body: BUNDLE_REACT }),
  });
  assert.equal(findings.length, 1);
  const f = findings[0];
  assert.equal(f.class, 'dom_sink');
  assert.equal(f.id, 'csti-framework-react');
  assert.ok(f.parameter.includes('fragment'), f.parameter);
  assert.ok(f.evidence.request.includes('#'), f.evidence.request);
});

test('CF-23: React detected without its sink — detected, no drive, no finding', async () => {
  const { findings, diagnostics, runnerCalls } = await probeWithFakeCdp('exec-react-query', targetsWith(), {
    fetchPage: async () => ({ status: 200, body: BUNDLE_REACT_NO_SINK }),
  });
  assert.deepEqual(findings, []);
  // ReactDOM.createRoot + React.createElement: two framework markers.
  assert.equal(diagnostics.frameworks, 2);
  assert.equal(diagnostics.frameworkKinds, 'react');
  assert.equal(diagnostics.frameworkDetected, true);
  assert.equal(diagnostics.reactSink, false);
  assert.equal(diagnostics.driveAttempted, undefined);
  assert.equal(runnerCalls.length, 0);
});

test('CF-24: React canary echoed as escaped text — not executed, no finding', async () => {
  const { findings, diagnostics } = await probeWithFakeCdp('react-literal', targetsWith(), {
    fetchPage: async () => ({ status: 200, body: BUNDLE_REACT }),
  });
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.driveAttempted, true);
  assert.equal(diagnostics.driveKind, 'react');
  assert.equal(diagnostics.driveExecuted, false);
});

test('CF-25: React control render contains the parsed element — uncalibrated, no finding', async () => {
  const { findings, diagnostics } = await probeWithFakeCdp('react-control-marker', targetsWith(), {
    fetchPage: async () => ({ status: 200, body: BUNDLE_REACT }),
  });
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.driveAttempted, true);
  assert.equal(diagnostics.driveExecuted, false);
});

test('CF-26: React parsed element at an unstable reflection point — uncalibrated, no finding', async () => {
  const { findings, diagnostics } = await probeWithFakeCdp('react-unstable', targetsWith(), {
    fetchPage: async () => ({ status: 200, body: BUNDLE_REACT }),
  });
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.driveAttempted, true);
  assert.equal(diagnostics.driveExecuted, false);
});

test('CF-27: browser fails to start — no findings, never throws', async () => {
  const { findings, diagnostics } = await probeWithFakeCdp('exec-query', targetsWith(), {
    runner: async () => ({ ok: false, stdout: '', stderr: 'docker: no such image' }),
  });
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.driveAttempted, true);
  assert.equal(diagnostics.driveExecuted, false);
});

test('CF-28: assessConfirmation judges both findings confirmed', async () => {
  const tpl = await probeWithFakeCdp('exec-query', targetsWith());
  assert.equal(tpl.findings.length, 1);
  assert.equal(assessConfirmation(tpl.findings[0]).verdict, 'confirmed');
  const react = await probeWithFakeCdp('exec-react-query', targetsWith(), {
    fetchPage: async () => ({ status: 200, body: BUNDLE_REACT }),
  });
  assert.equal(react.findings.length, 1);
  assert.equal(assessConfirmation(react.findings[0]).verdict, 'confirmed');
});

test('CF-29: finding class is dom_sink and never contains xss', async () => {
  const tpl = await probeWithFakeCdp('exec-query', targetsWith());
  assert.equal(tpl.findings.length, 1);
  assert.equal(tpl.findings[0].class, 'dom_sink');
  assert.ok(!tpl.findings[0].class.includes('xss'));
  const react = await probeWithFakeCdp('exec-react-query', targetsWith(), {
    fetchPage: async () => ({ status: 200, body: BUNDLE_REACT }),
  });
  assert.equal(react.findings.length, 1);
  assert.equal(react.findings[0].class, 'dom_sink');
  assert.ok(!react.findings[0].class.includes('xss'));
});

test('CF-30: vendor bundle is excluded from the mine', async () => {
  const { findings, diagnostics, runnerCalls } = await probeWithFakeCdp('exec-query', targetsWith(VENDOR_URL));
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.frameworks, 0);
  assert.equal(diagnostics.frameworkDetected, false);
  assert.equal(diagnostics.skipReason, 'no matching framework');
  assert.equal(diagnostics.driveAttempted, undefined);
  assert.equal(runnerCalls.length, 0);
});

test('CF-31: framework bundle defining the sanitizer is skipped whole', async () => {
  const { findings, diagnostics } = await probeWithFakeCdp('exec-query', targetsWith(), {
    fetchPage: async () => ({ status: 200, body: BUNDLE_FRAMEWORK }),
  });
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.frameworks, 0);
  assert.equal(diagnostics.frameworkDetected, false);
  assert.equal(diagnostics.skipReason, 'no matching framework');
  assert.equal(diagnostics.driveAttempted, undefined);
});

test('CF-32: a framework in an inline script counts — drive attempted with no bundles', async () => {
  const { findings, diagnostics } = await probeWithFakeCdp(
    'noexec',
    { bundles: [], inline: [BUNDLE_HANDLEBARS] },
    { fetchPage: async () => ({ status: 200, body: BUNDLE_CLEAN }) },
  );
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.frameworks, 1);
  assert.equal(diagnostics.frameworkKinds, 'handlebars');
  assert.equal(diagnostics.driveAttempted, true);
});

test('CF-33: a framework in the page HTML alone counts — ng-app with no bundles', async () => {
  const { findings, diagnostics } = await probeWithFakeCdp(
    'noexec',
    { bundles: [], inline: [] },
    {
      fetchPage: async () => ({ status: 200, body: BUNDLE_CLEAN }),
      pageBody: HTML_ANGULARJS_ATTRS,
    },
  );
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.frameworks, 2);
  assert.equal(diagnostics.frameworkKinds, 'angularjs');
  assert.equal(diagnostics.frameworkDetected, true);
  assert.equal(diagnostics.driveAttempted, true);
});

// ---- the React drive helper --------------------------------------------------

test('CF-34: driveReactHtml returns rid, marker and vector for verbatim evidence', async () => {
  const calls = [];
  const fake = makeFakeClient('exec-react-query', calls);
  const out = await driveReactHtml(PAGE_URL, {
    timeoutMs: 1,
    runner: async (file, args) => {
      if (args[0] === 'rm') return { ok: true, stdout: '' };
      return { ok: true, stdout: 'csti-frameworks-container\n' };
    },
    cdpConnect: async () => ({ ok: true, client: fake }),
  });
  assert.equal(out.attempted, true);
  assert.equal(out.executed, true);
  assert.equal(out.vector, 'query');
  assert.match(out.rid, /^[0-9a-f]{8}$/);
  assert.equal(out.marker, '<i data-dmreact="9352">');
  assert.equal(out.error, null);
});

test('CF-35: React drive never throws when the runner fails', async () => {
  const out = await driveReactHtml(PAGE_URL, {
    timeoutMs: 1,
    runner: async () => {
      throw new Error('docker daemon down');
    },
  });
  assert.equal(out.executed, false);
  assert.ok(out.error && out.error.length > 0);
});

test('CF-meta: phase 111 registration metadata', () => {
  assert.deepEqual(__cstiFrameworksMeta, { phases: ['csti-frameworks'], depth: ['standard', 'deep'] });
});
