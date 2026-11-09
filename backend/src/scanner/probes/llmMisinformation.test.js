// Tests for the LLM misinformation probe
// (coverage rows #21 [Medium] + #381 [Medium]; phase 114).
// No network, no lab — the probe talks to the fake only through
// the opts.fetchFn seam. The fake mirrors the vulnerable-LLM
// lab's documented shapes: POST /api/chat answers the refund
// question from the false document, GET /api/rag returns both
// refund documents (false + true).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { probeLlmMisinformation, assessMisinformation } from './llmMisinformation.js';
import { verifyFindings } from '../verifier.js';

const ORIGIN = 'http://lab.local';
const BASE_OPTS = {
  labTargets: 'lab.local',
  apiRoutes: [],
};

// ---- fake LLM lab -----------------------------------------------------------
// behaviour flags: chatDays (what the chat answer states),
// ragDays (what the retrieval surface returns), ragOk.
function makeFakeLlmLab({ chatDays = 365, ragDays = [365, 30], ragOk = true } = {}) {
  const state = { calls: [] };
  const fetchFn = async (url, init = {}) => {
    const method = String(init.method || 'GET').toUpperCase();
    const u = new URL(String(url));
    state.calls.push(`${method} ${u.pathname}`);
    const json = (status, obj) => ({ status, text: async () => JSON.stringify(obj) });
    if (method === 'POST' && u.pathname === '/api/chat') {
      let body = {};
      try {
        body = init.body ? JSON.parse(init.body) : {};
      } catch {
        body = {};
      }
      if (typeof body.prompt === 'string' && body.prompt.includes('refund')) {
        return json(200, {
          model: 'shopassist-stub-1.0',
          completion: `Based on the store knowledge base:\nAcme Store offers a ${chatDays}-day no-questions-asked refund on all items.`,
        });
      }
      return json(200, { model: 'shopassist-stub-1.0', completion: 'ShopAssist: I can help with orders.' });
    }
    if (method === 'GET' && u.pathname === '/api/rag') {
      if (!ragOk) return json(404, { error: 'not found' });
      return json(200, {
        query: 'refund policy',
        results: ragDays.map((d) => ({ id: `refund-${d}`, score: 1, text: `Refund policy: ${d} days.` })),
      });
    }
    return json(404, { error: 'not found' });
  };
  return { state, fetchFn };
}

// ---- pure assessor ----------------------------------------------------------

describe('assessMisinformation', () => {
  it('LM-1: a contradicting duration confirms; a matching one rejects; missing sides are unconfirmed', () => {
    const c = assessMisinformation(365, [365, 30]);
    assert.equal(c.verdict, 'confirmed');
    assert.deepEqual(c.contradicting, [30]);
    assert.equal(assessMisinformation(30, [30]).verdict, 'rejected');
    assert.equal(assessMisinformation(30, [365, 30]).verdict, 'confirmed');
    assert.equal(assessMisinformation(null, [30]).verdict, 'unconfirmed');
    assert.equal(assessMisinformation(365, []).verdict, 'unconfirmed');
    assert.equal(assessMisinformation(365, null).verdict, 'unconfirmed');
  });
});

// ---- the probe, end to end against the fake ---------------------------------

describe('probeLlmMisinformation — vulnerable lab', () => {
  it('LM-2: the chat states 365 days while the store returns 30 — exactly one [Medium] llm_misinformation finding', async () => {
    const { state, fetchFn } = makeFakeLlmLab();
    const diag = {};
    const findings = await probeLlmMisinformation(`${ORIGIN}/`, { ...BASE_OPTS, fetchFn, diagnostics: diag });
    assert.equal(findings.length, 1, `expected 1 finding, got: ${findings.map((f) => f.title).join(' | ')}`);
    assert.match(findings[0].title, /contradicted by its own knowledge base/);
    assert.equal(findings[0].severity, 'medium');
    assert.equal(findings[0].class, 'llm_misinformation');
    assert.equal(findings[0].parameter, 'prompt');
    assert.equal(diag.llmEndpoints, 1);
    assert.equal(diag.chatDays, 365);
    assert.deepEqual(diag.ragDays, [365, 30]);
    assert.equal(diag.contradiction, true);
    assert.equal(state.calls.filter((c) => c === 'POST /api/chat').length, 2, 'fingerprint + policy question');
    assert.equal(state.calls.filter((c) => c === 'GET /api/rag').length, 1);
  });
  it('LM-3: the fired finding verifies as confirmed through the real pipeline', async () => {
    const { fetchFn } = makeFakeLlmLab();
    const findings = await probeLlmMisinformation(`${ORIGIN}/`, { ...BASE_OPTS, fetchFn });
    const { confirmed, unconfirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
    assert.equal(unconfirmed.length, 0);
    assert.equal(confirmed[0].confirmation, 'confirmed');
  });
});

describe('probeLlmMisinformation — grounded answer and gates', () => {
  it('LM-4: a grounded answer (30 days, matching the store) is a true negative — zero findings', async () => {
    const { fetchFn } = makeFakeLlmLab({ chatDays: 30, ragDays: [30] });
    const diag = {};
    const findings = await probeLlmMisinformation(`${ORIGIN}/`, { ...BASE_OPTS, fetchFn, diagnostics: diag });
    assert.deepEqual(findings, []);
    assert.equal(diag.chatDays, 30);
    assert.equal(diag.contradiction, false);
  });
  it('LM-5: an unreachable retrieval surface is uncalibrated — zero findings', async () => {
    const { fetchFn } = makeFakeLlmLab({ ragOk: false });
    const findings = await probeLlmMisinformation(`${ORIGIN}/`, { ...BASE_OPTS, fetchFn });
    assert.deepEqual(findings, []);
  });
  it('LM-6: a non-lab target gets zero requests', async () => {
    const { state, fetchFn } = makeFakeLlmLab();
    const findings = await probeLlmMisinformation('http://example.com/', { ...BASE_OPTS, fetchFn });
    assert.deepEqual(findings, []);
    assert.deepEqual(state.calls, []);
  });
  it('LM-7: quick depth skips the probe — zero findings, zero requests', async () => {
    const { state, fetchFn } = makeFakeLlmLab();
    const findings = await probeLlmMisinformation(`${ORIGIN}/`, { ...BASE_OPTS, fetchFn, depth: 'quick' });
    assert.deepEqual(findings, []);
    assert.deepEqual(state.calls, []);
  });
});
