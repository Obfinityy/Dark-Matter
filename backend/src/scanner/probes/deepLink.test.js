// Deep-link / URL-scheme probe tests (row #510 [High] Deep-link /
// URL-scheme hijacking + unvalidated deep-link parameters,
// CWE-939; phase 113, 'deep-link').
//
// A finding fires ONLY on an observed parameter flow: a custom
// scheme (or javascript:) carried into a navigation sink by a
// URL-derived parameter. A bare scheme string with no parameter
// handling, a parameter that reaches an https: sink, and a
// commented-out flow all stay quiet.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  probeDeepLink,
  extractSchemeLiterals,
  isCustomScheme,
  extractParamNames,
  findTaintedVars,
  findSchemeVars,
  scanDeepLinkFlows,
  blankStringsAndComments,
  __deepLinkMeta,
} from './deepLink.js';
import { verifyFindings } from '../verifier.js';

const PAGE = 'https://example.com/app?url=https://example.com/';

// A planted deep-link flow: URL parameter -> tainted variable ->
// scheme variable -> location.href sink.
const FLOW_BODY = `
const target = new URLSearchParams(location.search).get('url');
const link = 'myapp://open?url=' + target;
location.href = link;
`;

// Inline parameter read + inline scheme in the sink argument.
const INLINE_FLOW_BODY = `
location.href = 'myapp://open?url=' + new URLSearchParams(location.search).get('url');
`;

// A javascript: value built from a URL parameter.
const JAVASCRIPT_FLOW_BODY = `
const u = new URLSearchParams(location.search).get('link');
location.href = 'javascript:' + u;
`;

// An intent:// link opened from a URL parameter.
const INTENT_FLOW_BODY = `
const q = new URLSearchParams(location.search).get('target');
window.open('intent://scan/?u=' + q);
`;

// Nonsense control: a custom scheme with no parameter handling.
const BARE_SCHEME_BODY = `
const link = 'myapp://home';
document.getElementById('home').href = link;
`;

// A parameter reaching an https: sink — not a deep link.
const HTTPS_FLOW_BODY = `
const q = new URLSearchParams(location.search).get('q');
location.href = 'https://example.com/search?q=' + q;
`;

function mockFetchPage(bodiesByUrl) {
  return async (url) => {
    const body = bodiesByUrl[url];
    if (body === undefined) return { status: 404, body: '' };
    return { status: 200, body };
  };
}

// ---- pure helpers ------------------------------------------------------------

test('DL-1: extractSchemeLiterals finds custom schemes, excludes web schemes', () => {
  const found = extractSchemeLiterals(`
    const a = 'myapp://open?x=1';
    const b = 'https://example.com/x';
    const c = 'intent://scan/#Intent;scheme=myapp;end';
    const d = "javascript:alert(1)";
    const e = 'mailto:someone@example.com';
  `);
  assert.deepEqual(
    found.map((f) => f.scheme),
    ['myapp', 'intent', 'javascript'],
  );
});

test('DL-2: isCustomScheme classifies schemes', () => {
  assert.equal(isCustomScheme('myapp'), true);
  assert.equal(isCustomScheme('intent'), true);
  assert.equal(isCustomScheme('javascript'), true);
  assert.equal(isCustomScheme('https'), false);
  assert.equal(isCustomScheme('mailto'), false);
  assert.equal(isCustomScheme('tel'), false);
});

test('DL-3: extractParamNames reads query-param accessors', () => {
  assert.deepEqual(
    extractParamNames(`new URLSearchParams(location.search).get('url'); getQueryParam("next");`),
    ['url', 'next'],
  );
});

test('DL-4: findTaintedVars tracks a URL parameter through an intermediate variable', () => {
  const tainted = findTaintedVars(`
    const target = new URLSearchParams(location.search).get('url');
    const link = 'myapp://open?url=' + target;
  `);
  assert.equal(tainted.get('target'), 'url');
  assert.equal(tainted.get('link'), 'url');
});

test('DL-5: findSchemeVars tracks variables assigned from a scheme literal', () => {
  const vars = findSchemeVars(FLOW_BODY);
  assert.ok(vars.has('link'));
  assert.ok(!vars.has('target'));
});

test('DL-6: blankStringsAndComments blanks commented-out code and strings', () => {
  const blanked = blankStringsAndComments(`
    // location.href = 'myapp://x' + target;
    const target = new URLSearchParams(location.search).get('url');
    /* location.href = link; */
    location.href = link;
  `);
  assert.ok(!blanked.includes('myapp://x'));
  assert.ok(blanked.includes('location.href = link;'));
  assert.ok(blanked.includes('URLSearchParams'));
});

// ---- flow scanning -----------------------------------------------------------

test('DL-7: planted myapp flow confirms with scheme, param and sink', () => {
  const scan = scanDeepLinkFlows(FLOW_BODY);
  assert.equal(scan.flows.length, 1);
  assert.equal(scan.flows[0].scheme, 'myapp');
  assert.equal(scan.flows[0].param, 'url');
  assert.equal(scan.flows[0].sinkKind, 'location-href-assign');
  assert.deepEqual(scan.schemesFound, ['myapp']);
});

test('DL-8: inline parameter read + inline scheme confirms', () => {
  const scan = scanDeepLinkFlows(INLINE_FLOW_BODY);
  assert.equal(scan.flows.length, 1);
  assert.equal(scan.flows[0].scheme, 'myapp');
  assert.equal(scan.flows[0].param, 'url');
});

test('DL-9: javascript: value from a parameter confirms', () => {
  const scan = scanDeepLinkFlows(JAVASCRIPT_FLOW_BODY);
  assert.equal(scan.flows.length, 1);
  assert.equal(scan.flows[0].scheme, 'javascript');
  assert.equal(scan.flows[0].param, 'link');
});

test('DL-10: intent:// opened from a parameter confirms', () => {
  const scan = scanDeepLinkFlows(INTENT_FLOW_BODY);
  assert.equal(scan.flows.length, 1);
  assert.equal(scan.flows[0].scheme, 'intent');
  assert.equal(scan.flows[0].param, 'target');
  assert.equal(scan.flows[0].sinkKind, 'window-open');
});

test('DL-11: bare scheme with no parameter handling stays quiet', () => {
  const scan = scanDeepLinkFlows(BARE_SCHEME_BODY);
  assert.equal(scan.flows.length, 0);
  assert.deepEqual(scan.schemesFound, ['myapp']);
});

test('DL-12: parameter reaching an https: sink stays quiet', () => {
  const scan = scanDeepLinkFlows(HTTPS_FLOW_BODY);
  assert.equal(scan.flows.length, 0);
});

test('DL-13: parameter that never reaches a scheme sink stays quiet', () => {
  const scan = scanDeepLinkFlows(`
    const q = new URLSearchParams(location.search).get('q');
    document.getElementById('out').textContent = q;
    const link = 'myapp://home';
  `);
  assert.equal(scan.flows.length, 0);
});

test('DL-14: commented-out flow stays quiet', () => {
  const scan = scanDeepLinkFlows(`
    // const target = new URLSearchParams(location.search).get('url');
    // const link = 'myapp://open?url=' + target;
    // location.href = link;
  `);
  assert.equal(scan.flows.length, 0);
});

test('DL-15: untainted variable named like a parameter stays quiet', () => {
  const scan = scanDeepLinkFlows(`
    const url = 'myapp://open?x=1';
    location.href = url;
  `);
  assert.equal(scan.flows.length, 0);
});

test('DL-16: probe meta names the phase and all depths', () => {
  assert.deepEqual(__deepLinkMeta.phases, ['deep-link']);
  assert.deepEqual(__deepLinkMeta.depth, ['quick', 'standard', 'deep']);
});

// ---- probe behaviour ---------------------------------------------------------

test('DL-17: planted inline flow files one confirmed finding', async () => {
  const findings = await probeDeepLink(PAGE, { bundles: [], inline: [FLOW_BODY] }, {});
  assert.equal(findings.length, 1);
  assert.equal(findings[0].class, 'deep_link_hijack');
  assert.equal(findings[0].severity, 'high');
  assert.equal(findings[0].parameter, 'url');
  assert.match(findings[0].title, /myapp:\/\//);
  assert.ok(findings[0].evidence.signalCorrelated);
  assert.match(findings[0].evidence.response, /myapp/);
  assert.match(findings[0].evidence.response, /'url'/);
  const { confirmed } = verifyFindings(findings);
  assert.equal(confirmed.filter((f) => f.class === 'deep_link_hijack').length, 1);
});

test('DL-18: javascript: flow files a javascript: finding', async () => {
  const findings = await probeDeepLink(PAGE, { bundles: [], inline: [JAVASCRIPT_FLOW_BODY] }, {});
  assert.equal(findings.length, 1);
  assert.match(findings[0].title, /javascript:/);
});

test('DL-19: clean inline bodies stay quiet', async () => {
  const findings = await probeDeepLink(
    PAGE,
    { bundles: [], inline: [BARE_SCHEME_BODY, HTTPS_FLOW_BODY] },
    {},
  );
  assert.equal(findings.length, 0);
});

test('DL-20: bundle flow fires via the fetchPage seam; vendor bundle is skipped', async () => {
  const fetchPage = mockFetchPage({
    'https://example.com/app.js': FLOW_BODY,
    'https://example.com/static/vendor.bundle.js': FLOW_BODY,
  });
  const findings = await probeDeepLink(
    PAGE,
    { bundles: ['https://example.com/app.js', 'https://example.com/static/vendor.bundle.js'], inline: [] },
    { fetchPage },
  );
  assert.equal(findings.length, 1);
  assert.equal(findings[0].url, 'https://example.com/app.js');
});

test('DL-21: vendor-only targets stay quiet', async () => {
  const fetchPage = mockFetchPage({
    'https://example.com/static/vendor.bundle.js': FLOW_BODY,
  });
  const diag = {};
  const findings = await probeDeepLink(
    PAGE,
    { bundles: ['https://example.com/static/vendor.bundle.js'], inline: [] },
    { fetchPage, diagnostics: diag },
  );
  assert.equal(findings.length, 0);
  assert.equal(diag.flowsConfirmed, 0);
});

test('DL-22: diagnostics record the flow', async () => {
  const diag = {};
  await probeDeepLink(PAGE, { bundles: [], inline: [FLOW_BODY] }, { diagnostics: diag });
  assert.equal(diag.flowsConfirmed, 1);
  assert.deepEqual(diag.schemesFound, ['myapp']);
  assert.equal(diag.sinksFound, 1);
  assert.deepEqual(diag.paramReads, ['url']);
});

test('DL-23: no targets means no findings', async () => {
  const findings = await probeDeepLink(PAGE, { bundles: [], inline: [] }, {});
  assert.equal(findings.length, 0);
});

test('DL-24: invalid page URL stays quiet and never throws', async () => {
  const findings = await probeDeepLink('not a url', { bundles: [], inline: [FLOW_BODY] }, {});
  assert.equal(findings.length, 0);
});
