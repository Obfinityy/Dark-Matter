// Tests for the LLM insecure-output-handling probe
// (coverage row #18 [High]; phase 113).
// No network, no lab — the probe talks to the fake only through
// the opts.fetchFn seam. The fake mirrors the vulnerable-LLM
// lab's documented shapes: POST /api/chat answers a completion
// (the LLM surface), GET /page renders its text parameter.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { probeLlmOutputHandling, assessOutputHandling, OUTPUT_MARKER } from './llmOutputHandling.js';
import { escapeHtml } from './llmSurface.js';
import { verifyFindings } from '../verifier.js';

const ORIGIN = 'http://lab.local';
const BASE_OPTS = {
  labTargets: 'lab.local',
  apiRoutes: [],
};

// ---- fake LLM lab -----------------------------------------------------------
// behaviour flags: pageMode 'raw' (marker verbatim), 'escaped'
// (marker HTML-escaped), 'noecho' (marker absent).
function makeFakeLlmLab({ pageMode = 'raw' } = {}) {
  const state = { calls: [] };
  const fetchFn = async (url, init = {}) => {
    const method = String(init.method || 'GET').toUpperCase();
    const u = new URL(String(url));
    state.calls.push(`${method} ${u.pathname}`);
    const json = (status, obj) => ({ status, text: async () => JSON.stringify(obj) });
    if (method === 'POST' && u.pathname === '/api/chat') {
      return json(200, { model: 'shopassist-stub-1.0', completion: 'ShopAssist: I can help with orders.' });
    }
    if (method === 'GET' && u.pathname === '/page') {
      const text = u.searchParams.get('text') || '';
      let body;
      if (pageMode === 'raw') body = `<!doctype html><html><body>${text}</body></html>`;
      else if (pageMode === 'escaped') body = `<!doctype html><html><body>${escapeHtml(text)}</body></html>`;
      else body = '<!doctype html><html><body>plain text</body></html>';
      return { status: 200, text: async () => body };
    }
    return json(404, { error: 'not found' });
  };
  return { state, fetchFn };
}

// ---- pure assessor ----------------------------------------------------------

describe('assessOutputHandling', () => {
  it('LO-1: verbatim marker confirms; escaped or absent marker rejects', () => {
    assert.equal(assessOutputHandling(`<body>${OUTPUT_MARKER}</body>`, OUTPUT_MARKER).verdict, 'confirmed');
    assert.equal(assessOutputHandling(`<body>${escapeHtml(OUTPUT_MARKER)}</body>`, OUTPUT_MARKER).verdict, 'rejected');
    assert.equal(assessOutputHandling('<body>plain text</body>', OUTPUT_MARKER).verdict, 'rejected');
    assert.equal(assessOutputHandling('', OUTPUT_MARKER).verdict, 'rejected');
  });
});

// ---- the probe, end to end against the fake ---------------------------------

describe('probeLlmOutputHandling — vulnerable lab', () => {
  it('LO-2: the output page renders the marker raw — exactly one [High] llm_output_handling finding', async () => {
    const { state, fetchFn } = makeFakeLlmLab();
    const diag = {};
    const findings = await probeLlmOutputHandling(`${ORIGIN}/`, { ...BASE_OPTS, fetchFn, diagnostics: diag });
    assert.equal(findings.length, 1, `expected 1 finding, got: ${findings.map((f) => f.title).join(' | ')}`);
    assert.match(findings[0].title, /rendered as raw HTML without escaping/);
    assert.equal(findings[0].severity, 'high');
    assert.equal(findings[0].class, 'llm_output_handling');
    assert.equal(findings[0].parameter, 'text');
    assert.equal(diag.llmEndpoints, 1);
    assert.equal(diag.pageReflects, true);
    assert.equal(diag.markerEscaped, false);
    assert.equal(state.calls.filter((c) => c === 'POST /api/chat').length, 1, 'fingerprint only');
    assert.equal(state.calls.filter((c) => c === 'GET /page').length, 1);
  });
  it('LO-3: the fired finding verifies as confirmed through the real pipeline', async () => {
    const { fetchFn } = makeFakeLlmLab();
    const findings = await probeLlmOutputHandling(`${ORIGIN}/`, { ...BASE_OPTS, fetchFn });
    const { confirmed, unconfirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
    assert.equal(unconfirmed.length, 0);
    assert.equal(confirmed[0].confirmation, 'confirmed');
  });
});

describe('probeLlmOutputHandling — safe page and gates', () => {
  it('LO-4: an escaping page is a true negative — zero findings', async () => {
    const { fetchFn } = makeFakeLlmLab({ pageMode: 'escaped' });
    const diag = {};
    const findings = await probeLlmOutputHandling(`${ORIGIN}/`, { ...BASE_OPTS, fetchFn, diagnostics: diag });
    assert.deepEqual(findings, []);
    assert.equal(diag.pageReflects, false, 'the verbatim marker is absent — only its escaped form is present');
    assert.equal(diag.markerEscaped, true);
  });
  it('LO-5: a page that does not echo the marker is a true negative', async () => {
    const { fetchFn } = makeFakeLlmLab({ pageMode: 'noecho' });
    const findings = await probeLlmOutputHandling(`${ORIGIN}/`, { ...BASE_OPTS, fetchFn });
    assert.deepEqual(findings, []);
  });
  it('LO-6: a non-lab target gets zero requests', async () => {
    const { state, fetchFn } = makeFakeLlmLab();
    const findings = await probeLlmOutputHandling('http://example.com/', { ...BASE_OPTS, fetchFn });
    assert.deepEqual(findings, []);
    assert.deepEqual(state.calls, []);
  });
  it('LO-7: quick depth skips the probe — zero findings, zero requests', async () => {
    const { state, fetchFn } = makeFakeLlmLab();
    const findings = await probeLlmOutputHandling(`${ORIGIN}/`, { ...BASE_OPTS, fetchFn, depth: 'quick' });
    assert.deepEqual(findings, []);
    assert.deepEqual(state.calls, []);
  });
});
