// LLM model-extraction probe tests (rows #22 [Medium] + #383
// [Medium]; phase 'llm-model-extraction').
//
// The fake fetch below simulates the deterministic stub in three
// modes: 'lab' (model card says deterministic-stub, no weights;
// both extraction prompts get the generic completion — the true
// negative), 'disclosing' (one prompt gets a completion carrying
// a parameter count — the defensive firing branch), 'non-llm'
// (health 404). All fixture values are clearly fake.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  probeLlmModelExtraction,
  assessModelCard,
  assessExtractionDisclosure,
  assessModelExtraction,
  __llmModelExtractionMeta,
} from './llmModelExtraction.js';
import { assessConfirmation } from '../../hunt-intel/differential.js';

const LAB_URL = 'http://172.17.0.1:3600/';
const LAB_TARGETS = ['172.17.0.1:3000', '172.17.0.1:3100', '172.17.0.1:3600'];
const CREDS = { username: 'lab-user', password: 'lab-pass' };
const OPTS = { labCreds: CREDS, allowWrite: true, labTargets: LAB_TARGETS };
const CARD = { model: 'shopassist-stub-1.0', version: '1.0.0', type: 'deterministic-stub', note: 'No weights — model-extraction rows (#22 / #383) are not plantable here.' };

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
    if (u.endsWith('/api/chat')) {
      const body = JSON.parse(opts.body || '{}');
      if (mode === 'disclosing' && String(body.prompt || '').includes('weights')) {
        return resp(200, { model: 'shopassist-stub-1.0', completion: 'My model has 2 billion parameters across 24 layers.', leaked: false });
      }
      return resp(200, { model: 'shopassist-stub-1.0', completion: 'ShopAssist: I can help with orders, shipping, refunds and account questions.', leaked: false });
    }
    return resp(404, { error: 'not found' });
  };
}

test('ME-1: assessModelCard spots the no-weights stub', () => {
  assert.deepEqual(assessModelCard(CARD), { isStub: true, noWeights: true });
  assert.deepEqual(assessModelCard({ type: 'real-model', note: '' }), { isStub: false, noWeights: false });
  assert.deepEqual(assessModelCard(null), { isStub: false, noWeights: false });
});

test('ME-2: assessExtractionDisclosure matches weight-shaped content only', () => {
  assert.equal(assessExtractionDisclosure('My model has 2 billion parameters.'), true);
  assert.equal(assessExtractionDisclosure('weights: [0.1, 0.2]'), true);
  assert.equal(assessExtractionDisclosure('parameter count: 12345'), true);
  assert.equal(assessExtractionDisclosure('ShopAssist: I can help with orders.'), false);
  assert.equal(assessExtractionDisclosure(''), false);
});

test('ME-3: assessModelExtraction confirms a disclosure, rejects a clean run, stays uncalibrated without a card', () => {
  assert.equal(assessModelExtraction(CARD, [false, true]).verdict, 'confirmed');
  assert.equal(assessModelExtraction(CARD, [false, false]).verdict, 'rejected');
  assert.equal(assessModelExtraction(null, [false]).verdict, 'uncalibrated');
  assert.equal(assessModelExtraction(CARD, []).verdict, 'uncalibrated');
});

test('ME-4: lab mode is a true negative by design — 0 findings, evidence recorded', async () => {
  const diag = {};
  const findings = await probeLlmModelExtraction(LAB_URL, { ...OPTS, fetchFn: makeFetch('lab'), diagnostics: diag });
  assert.equal(findings.length, 0);
  assert.equal(diag.llmLab, true);
  assert.equal(diag.modelType, 'deterministic-stub');
  assert.equal(diag.modelVersion, '1.0.0');
  assert.equal(diag.noWeights, true);
  assert.equal(diag.extractionAttempts, 2);
  assert.equal(diag.weightsDisclosed, false);
});

test('ME-5: disclosing mode confirms — the defensive firing branch', async () => {
  const diag = {};
  const findings = await probeLlmModelExtraction(LAB_URL, { ...OPTS, fetchFn: makeFetch('disclosing'), diagnostics: diag });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].class, 'llm_model_extraction');
  assert.equal(findings[0].severity, 'medium');
  assert.equal(assessConfirmation(findings[0]).verdict, 'confirmed');
  assert.equal(diag.weightsDisclosed, true);
});

test('ME-6: gates — no creds, quick depth, non-lab host, non-LLM fingerprint all return []', async () => {
  assert.deepEqual(await probeLlmModelExtraction(LAB_URL, { allowWrite: true, labTargets: LAB_TARGETS, fetchFn: makeFetch('lab') }), []);
  assert.deepEqual(await probeLlmModelExtraction(LAB_URL, { ...OPTS, depth: 'quick', fetchFn: makeFetch('lab') }), []);
  assert.deepEqual(await probeLlmModelExtraction('http://example.com/', { ...OPTS, fetchFn: makeFetch('lab') }), []);
  const diag = {};
  assert.deepEqual(await probeLlmModelExtraction(LAB_URL, { ...OPTS, fetchFn: makeFetch('non-llm'), diagnostics: diag }), []);
  assert.equal(diag.llmLab, false);
});

test('ME-7: probe meta names the phase + depths', () => {
  assert.deepEqual(__llmModelExtractionMeta.phases, ['llm-model-extraction']);
  assert.deepEqual(__llmModelExtractionMeta.depth, ['standard', 'deep']);
});
