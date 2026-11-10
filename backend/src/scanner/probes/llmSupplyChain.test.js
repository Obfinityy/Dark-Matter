// LLM supply-chain probe tests (rows #15 [High] + #377 [High];
// phase 'llm-supply-chain').
//
// The fake fetch below simulates the deterministic stub in two
// modes: 'lab' (model card says deterministic-stub, index lists
// the 8 text endpoints — no supply chain, true negative by
// design) and 'non-llm' (health 404). This probe carries no
// finding branch by design — the tests assert the recorded
// evidence. All fixture values are clearly fake.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  probeLlmSupplyChain,
  findSupplyChainSurface,
  assessSupplyChain,
  __llmSupplyChainMeta,
} from './llmSupplyChain.js';

const LAB_URL = 'http://172.17.0.1:3600/';
const LAB_TARGETS = ['172.17.0.1:3000', '172.17.0.1:3100', '172.17.0.1:3600'];
const CREDS = { username: 'lab-user', password: 'lab-pass' };
const OPTS = { labCreds: CREDS, allowWrite: true, labTargets: LAB_TARGETS };
const CARD = { model: 'shopassist-stub-1.0', version: '1.0.0', type: 'deterministic-stub', note: 'No weights — model-extraction rows (#22 / #383) are not plantable here.' };
const LAB_INDEX = '<html><body><ul><li>GET /health</li><li>GET /api/model</li><li>GET /api/rag</li><li>POST /api/chat</li><li>POST /api/completion</li><li>POST /api/tool</li><li>GET /api/users</li><li>GET /page</li></ul></body></html>';

const resp = (status, obj) => ({
  status,
  text: async () => (typeof obj === 'string' ? obj : JSON.stringify(obj)),
  headers: { get: () => null },
});

function makeFetch(mode) {
  return async (url, opts = {}) => {
    const u = String(url);
    if (u.endsWith('/health')) {
      return mode === 'non-llm' ? resp(404, { error: 'not found' }) : resp(200, { ok: true, service: 'llm-lab', model: 'shopassist-stub-1.0' });
    }
    if (u.endsWith('/api/model')) return resp(200, CARD);
    if (u === 'http://172.17.0.1:3600/') return resp(200, LAB_INDEX);
    return resp(404, { error: 'not found' });
  };
}

test('SC-1: findSupplyChainSurface finds plugin/download/registry markers, none on the lab', () => {
  assert.deepEqual(findSupplyChainSurface(LAB_INDEX, CARD), []);
  assert.equal(findSupplyChainSurface('<a href="/api/plugins">plugins</a>', CARD).length, 1);
  assert.equal(findSupplyChainSurface('', { source: 'huggingface' }).length, 1);
});

test('SC-2: assessSupplyChain rejects the stub with zero markers, stays uncalibrated otherwise', () => {
  assert.equal(assessSupplyChain(CARD, 0).verdict, 'rejected');
  assert.equal(assessSupplyChain(null, 0).verdict, 'uncalibrated');
  assert.equal(assessSupplyChain(CARD, 2).verdict, 'uncalibrated');
  assert.equal(assessSupplyChain({ type: 'real-model' }, 0).verdict, 'uncalibrated');
});

test('SC-3: lab mode is a true negative by design — 0 findings, evidence recorded', async () => {
  const diag = {};
  const findings = await probeLlmSupplyChain(LAB_URL, { ...OPTS, fetchFn: makeFetch('lab'), diagnostics: diag });
  assert.equal(findings.length, 0);
  assert.equal(diag.llmLab, true);
  assert.equal(diag.modelType, 'deterministic-stub');
  assert.equal(diag.thirdPartyModel, false);
  assert.equal(diag.supplyChainEndpoints, 0);
  assert.equal(diag.verdict, 'no-supply-chain-surface');
});

test('SC-4: gates — no creds, quick depth, non-lab host, non-LLM fingerprint all return []', async () => {
  assert.deepEqual(await probeLlmSupplyChain(LAB_URL, { allowWrite: true, labTargets: LAB_TARGETS, fetchFn: makeFetch('lab') }), []);
  assert.deepEqual(await probeLlmSupplyChain(LAB_URL, { ...OPTS, depth: 'quick', fetchFn: makeFetch('lab') }), []);
  assert.deepEqual(await probeLlmSupplyChain('http://example.com/', { ...OPTS, fetchFn: makeFetch('lab') }), []);
  const diag = {};
  assert.deepEqual(await probeLlmSupplyChain(LAB_URL, { ...OPTS, fetchFn: makeFetch('non-llm'), diagnostics: diag }), []);
  assert.equal(diag.llmLab, false);
});

test('SC-5: probe meta names the phase + depths', () => {
  assert.deepEqual(__llmSupplyChainMeta.phases, ['llm-supply-chain']);
  assert.deepEqual(__llmSupplyChainMeta.depth, ['standard', 'deep']);
});
