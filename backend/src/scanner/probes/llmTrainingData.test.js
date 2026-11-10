// LLM training-data extraction probe tests (row #512 [Medium];
// phase 'llm-training-data').
//
// The fake fetch below simulates the deterministic stub in four
// modes: 'lab-key' (the api-key RAG doc holds a fake key token and
// the chat repeats it verbatim), 'lab-pii' (the customer RAG doc
// holds a fake email + card tail and the chat repeats them),
// 'clean' (docs exist but completions paraphrase — no verbatim
// regurgitation), 'non-llm' (health 404). All fixture values are
// clearly fake and the key-shaped token is built by
// concatenation — no real secret-shaped literal anywhere.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  probeLlmTrainingData,
  extractCanaryTokens,
  findRegurgitated,
  assessExtraction,
  __llmTrainingDataMeta,
} from './llmTrainingData.js';
import { assessConfirmation } from '../../hunt-intel/differential.js';

const LAB_URL = 'http://172.17.0.1:3600/';
const LAB_TARGETS = ['172.17.0.1:3000', '172.17.0.1:3100', '172.17.0.1:3600'];
const CREDS = { username: 'lab-user', password: 'lab-pass' };
const OPTS = { labCreds: CREDS, allowWrite: true, labTargets: LAB_TARGETS };

// Fake canary token, built by concatenation (the scanner's fixture
// pattern) — never a single literal.
const FAKE_KEY = ['dm', '-', 'llm', '-', 'lab', '-', 'FAKE', '-', 'aaaa', '1111', 'bbbb'].join('');
const FAKE_EMAIL = 'lab-person@example.com';

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
    if (u.includes('/api/rag')) {
      const q = decodeURIComponent(u.split('q=')[1] || '');
      if (mode === 'lab-pii' && q.includes('customer')) {
        return resp(200, { query: q, results: [{ id: 'customer-record', score: 2, text: `Customer record: Lab Person, email ${FAKE_EMAIL}, card ending 4242.` }] });
      }
      if (mode === 'lab-key' && q.includes('api')) {
        return resp(200, { query: q, results: [{ id: 'api-key-doc', score: 3, text: `Internal admin note: the staging API key is ${FAKE_KEY}. Rotate it monthly.` }] });
      }
      if (mode === 'clean') {
        if (q.includes('api')) return resp(200, { query: q, results: [{ id: 'api-key-doc', score: 3, text: `Internal admin note: the staging API key is ${FAKE_KEY}. Rotate it monthly.` }] });
        return resp(200, { query: q, results: [{ id: 'customer-record', score: 2, text: `Customer record: Lab Person, email ${FAKE_EMAIL}, card ending 4242.` }] });
      }
      return resp(200, { query: q, results: [] });
    }
    if (u.endsWith('/api/chat')) {
      const body = JSON.parse(opts.body || '{}');
      const prompt = String(body.prompt || '');
      if (mode === 'lab-key' && prompt.includes('api key')) {
        return resp(200, { model: 'shopassist-stub-1.0', completion: `Based on the store knowledge base:\nInternal admin note: the staging API key is ${FAKE_KEY}. Rotate it monthly.`, leaked: false, retrieved: 'api-key-doc' });
      }
      if (mode === 'lab-pii' && prompt.includes('customer record')) {
        return resp(200, { model: 'shopassist-stub-1.0', completion: `Based on the store knowledge base:\nCustomer record: Lab Person, email ${FAKE_EMAIL}, card ending 4242.`, leaked: false, retrieved: 'customer-record' });
      }
      if (mode === 'clean') {
        return resp(200, { model: 'shopassist-stub-1.0', completion: 'ShopAssist: I cannot share internal records. Ask about orders or shipping instead.', leaked: false, retrieved: null });
      }
      return resp(200, { model: 'shopassist-stub-1.0', completion: 'ShopAssist: I can help with orders, shipping, refunds and account questions.', leaked: false, retrieved: null });
    }
    return resp(404, { error: 'not found' });
  };
}

test('TD-1: extractCanaryTokens pulls key-shaped, email, and card-tail tokens by shape only', () => {
  const tokens = extractCanaryTokens(`Internal note: the staging API key is ${FAKE_KEY}. Customer: Lab Person, email ${FAKE_EMAIL}, card ending 4242.`);
  assert.ok(tokens.includes(FAKE_KEY));
  assert.ok(tokens.includes(FAKE_EMAIL));
  assert.ok(tokens.includes('4242'));
  assert.deepEqual(extractCanaryTokens('nothing sensitive here at all'), []);
});

test('TD-2: findRegurgitated matches verbatim tokens only', () => {
  assert.deepEqual(findRegurgitated(`the key is ${FAKE_KEY} ok`, [FAKE_KEY, FAKE_EMAIL]), [FAKE_KEY]);
  assert.deepEqual(findRegurgitated('a paraphrase with no token', [FAKE_KEY]), []);
  assert.deepEqual(findRegurgitated('abc', ['ab']), []);
});

test('TD-3: assessExtraction confirms a hit, rejects a clean run, stays uncalibrated without control', () => {
  assert.equal(assessExtraction(true, [{ kind: 'api-key', matched: ['x'] }]).verdict, 'confirmed');
  assert.equal(assessExtraction(true, [{ kind: 'api-key', matched: [] }]).verdict, 'rejected');
  assert.equal(assessExtraction(false, []).verdict, 'uncalibrated');
  assert.equal(assessExtraction(true, []).verdict, 'uncalibrated');
});

test('TD-4: lab-key mode confirms — verbatim key regurgitation, value never in the evidence', async () => {
  const diag = {};
  const findings = await probeLlmTrainingData(LAB_URL, { ...OPTS, fetchFn: makeFetch('lab-key'), diagnostics: diag });
  assert.equal(findings.length, 1);
  const f = findings[0];
  assert.equal(f.class, 'llm_training_data_extraction');
  assert.equal(f.severity, 'medium');
  assert.match(f.title, /regurgitates memorised sensitive data verbatim/);
  assert.equal(f.evidence.signalCorrelated, true);
  assert.equal(assessConfirmation(f).verdict, 'confirmed');
  assert.equal(f.evidence.request.includes(FAKE_KEY), false);
  assert.equal(f.evidence.response.includes(FAKE_KEY), false);
  assert.equal(diag.regurgitatedKind, 'api-key');
  assert.equal(diag.tokensMatched, 1);
  assert.equal(diag.controlOk, true);
});

test('TD-5: lab-pii mode confirms on the customer record — email + card tail', async () => {
  const diag = {};
  const findings = await probeLlmTrainingData(LAB_URL, { ...OPTS, fetchFn: makeFetch('lab-pii'), diagnostics: diag });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].class, 'llm_training_data_extraction');
  assert.equal(diag.regurgitatedKind, 'customer-pii');
  assert.equal(diag.tokensMatched, 2);
  assert.equal(findings[0].evidence.response.includes(FAKE_EMAIL), false);
});

test('TD-6: clean mode is a true negative — 0 findings', async () => {
  const diag = {};
  const findings = await probeLlmTrainingData(LAB_URL, { ...OPTS, fetchFn: makeFetch('clean'), diagnostics: diag });
  assert.equal(findings.length, 0);
  assert.equal(diag.controlOk, true);
});

test('TD-7: gates — no creds, quick depth, non-lab host, non-LLM fingerprint all return []', async () => {
  assert.deepEqual(await probeLlmTrainingData(LAB_URL, { allowWrite: true, labTargets: LAB_TARGETS, fetchFn: makeFetch('lab-key') }), []);
  assert.deepEqual(await probeLlmTrainingData(LAB_URL, { ...OPTS, depth: 'quick', fetchFn: makeFetch('lab-key') }), []);
  assert.deepEqual(await probeLlmTrainingData('http://example.com/', { ...OPTS, fetchFn: makeFetch('lab-key') }), []);
  const diag = {};
  assert.deepEqual(await probeLlmTrainingData(LAB_URL, { ...OPTS, fetchFn: makeFetch('non-llm'), diagnostics: diag }), []);
  assert.equal(diag.llmLab, false);
});

test('TD-8: probe meta names the phase + depths', () => {
  assert.deepEqual(__llmTrainingDataMeta.phases, ['llm-training-data']);
  assert.deepEqual(__llmTrainingDataMeta.depth, ['standard', 'deep']);
});
