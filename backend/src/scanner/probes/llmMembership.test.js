// LLM membership-inference probe tests (row #514 [Low];
// phase 'llm-membership-inference').
//
// The fake fetch below simulates the deterministic stub in three
// modes: 'lab' (identical prompts get identical completions, no
// confidence field, member keyword retrieves, nonsense keyword
// does not — unprovable on this lab), 'nondeterministic' (the
// same prompt answers differently), 'non-llm' (health 404). This
// probe carries no finding branch by design — the tests assert
// the recorded signals. All fixture values are clearly fake.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  probeLlmMembership,
  assessDeterminism,
  hasConfidenceSignal,
  assessMembership,
  __llmMembershipMeta,
} from './llmMembership.js';

const LAB_URL = 'http://172.17.0.1:3600/';
const LAB_TARGETS = ['172.17.0.1:3000', '172.17.0.1:3100', '172.17.0.1:3600'];
const CREDS = { username: 'lab-user', password: 'lab-pass' };
const OPTS = { labCreds: CREDS, allowWrite: true, labTargets: LAB_TARGETS };

const resp = (status, obj) => ({
  status,
  text: async () => (typeof obj === 'string' ? obj : JSON.stringify(obj)),
  headers: { get: () => null },
});

function makeFetch(mode) {
  let chatCalls = 0;
  return async (url, opts = {}) => {
    const u = String(url);
    if (u.endsWith('/health')) {
      return mode === 'non-llm' ? resp(404, { error: 'not found' }) : resp(200, { ok: true, service: 'llm-lab', model: 'shopassist-stub-1.0' });
    }
    if (u.endsWith('/api/chat')) {
      chatCalls += 1;
      if (mode === 'nondeterministic') {
        return resp(200, { model: 'shopassist-stub-1.0', completion: `variant reply ${chatCalls}`, leaked: false });
      }
      return resp(200, { model: 'shopassist-stub-1.0', completion: 'ShopAssist: I can help with orders, shipping, refunds and account questions.', leaked: false, trigger: null, retrieved: null, toolCall: null, toolResult: null });
    }
    if (u.includes('/api/rag')) {
      const q = decodeURIComponent(u.split('q=')[1] || '');
      if (q.includes('customer')) return resp(200, { query: q, results: [{ id: 'customer-record', score: 2, text: 'doc' }] });
      return resp(200, { query: q, results: [] });
    }
    return resp(404, { error: 'not found' });
  };
}

test('MI-1: assessDeterminism needs identical non-empty completions', () => {
  assert.equal(assessDeterminism('same reply', 'same reply'), true);
  assert.equal(assessDeterminism('reply one', 'reply two'), false);
  assert.equal(assessDeterminism('', ''), false);
});

test('MI-2: hasConfidenceSignal spots confidence-shaped fields only', () => {
  assert.equal(hasConfidenceSignal({ completion: 'hi', confidence: 0.9 }), true);
  assert.equal(hasConfidenceSignal({ completion: 'hi', logprobs: [] }), true);
  assert.equal(hasConfidenceSignal({ model: 'x', completion: 'hi', leaked: false }), false);
  assert.equal(hasConfidenceSignal(null), false);
});

test('MI-3: assessMembership rejects the deterministic no-signal case, stays uncalibrated otherwise', () => {
  const good = { deterministic: true, confidenceSignal: false, memberRetrievable: true, nonMemberEmpty: true };
  assert.equal(assessMembership(good).verdict, 'rejected');
  assert.equal(assessMembership({ ...good, deterministic: false }).verdict, 'uncalibrated');
  assert.equal(assessMembership({ ...good, confidenceSignal: true }).verdict, 'uncalibrated');
  assert.equal(assessMembership({ ...good, memberRetrievable: false }).verdict, 'uncalibrated');
});

test('MI-4: lab mode is unprovable — 0 findings, signals recorded', async () => {
  const diag = {};
  const findings = await probeLlmMembership(LAB_URL, { ...OPTS, fetchFn: makeFetch('lab'), diagnostics: diag });
  assert.equal(findings.length, 0);
  assert.equal(diag.llmLab, true);
  assert.equal(diag.deterministic, true);
  assert.equal(diag.confidenceSignal, false);
  assert.equal(diag.memberRetrievable, true);
  assert.equal(diag.nonMemberEmpty, true);
  assert.equal(diag.verdict, 'unprovable-no-confidence-signal');
});

test('MI-5: nondeterministic mode is uncalibrated — 0 findings, deterministic false', async () => {
  const diag = {};
  const findings = await probeLlmMembership(LAB_URL, { ...OPTS, fetchFn: makeFetch('nondeterministic'), diagnostics: diag });
  assert.equal(findings.length, 0);
  assert.equal(diag.deterministic, false);
  assert.equal(diag.verdict, 'uncalibrated');
});

test('MI-6: gates — no creds, quick depth, non-lab host, non-LLM fingerprint all return []', async () => {
  assert.deepEqual(await probeLlmMembership(LAB_URL, { allowWrite: true, labTargets: LAB_TARGETS, fetchFn: makeFetch('lab') }), []);
  assert.deepEqual(await probeLlmMembership(LAB_URL, { ...OPTS, depth: 'quick', fetchFn: makeFetch('lab') }), []);
  assert.deepEqual(await probeLlmMembership('http://example.com/', { ...OPTS, fetchFn: makeFetch('lab') }), []);
  const diag = {};
  assert.deepEqual(await probeLlmMembership(LAB_URL, { ...OPTS, fetchFn: makeFetch('non-llm'), diagnostics: diag }), []);
  assert.equal(diag.llmLab, false);
});

test('MI-7: probe meta names the phase + depths', () => {
  assert.deepEqual(__llmMembershipMeta.phases, ['llm-membership-inference']);
  assert.deepEqual(__llmMembershipMeta.depth, ['standard', 'deep']);
});
