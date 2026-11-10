// Shared LLM-lab helper tests (llmLab.js).
//
// Pure helpers + fetch seams, all stubbed — no network, no lab.
// Fixture values are clearly fake ('lab-user', 'fake-...' style).

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LLM_MODEL,
  parseJson,
  hasRetryAfter,
  hasThrottleSignal,
  assessLlmResponse,
  llmGate,
  isLlmLab,
  llmChat,
  llmRag,
  llmModelCard,
  llmIndex,
} from './llmLab.js';

const LAB_URL = 'http://172.17.0.1:3600/';
const LAB_TARGETS = ['172.17.0.1:3000', '172.17.0.1:3100', '172.17.0.1:3600'];
const CREDS = { username: 'lab-user', password: 'lab-pass' };

const resp = (status, obj, headers) => ({
  status,
  text: async () => (typeof obj === 'string' ? obj : JSON.stringify(obj)),
  headers: headers || { get: () => null },
});

test('LLM-1: parseJson returns objects, null on bad input', () => {
  assert.deepEqual(parseJson('{"a":1}'), { a: 1 });
  assert.equal(parseJson('not json'), null);
  assert.deepEqual(parseJson('[1,2]'), [1, 2]);
  assert.equal(parseJson(''), null);
});

test('LLM-2: hasRetryAfter reads Headers-like, plain objects, null', () => {
  assert.equal(hasRetryAfter({ get: (k) => (k === 'retry-after' ? '5' : null) }), true);
  assert.equal(hasRetryAfter({ 'Retry-After': '5' }), true);
  assert.equal(hasRetryAfter({ 'x-other': '1' }), false);
  assert.equal(hasRetryAfter(null), false);
});

test('LLM-3: hasThrottleSignal catches 429, refusal text, Retry-After', () => {
  assert.equal(hasThrottleSignal(429, '{}', null), true);
  assert.equal(hasThrottleSignal(200, '{"error":"too many requests"}', null), true);
  assert.equal(hasThrottleSignal(200, '{"error":"rate limit exceeded"}', null), true);
  assert.equal(hasThrottleSignal(200, '{}', { 'Retry-After': '10' }), true);
  assert.equal(hasThrottleSignal(200, '{"ok":true}', null), false);
});

test('LLM-4: assessLlmResponse grants 2xx JSON, throttles signals, others the rest', () => {
  assert.equal(assessLlmResponse(200, '{"completion":"hi"}', null).kind, 'granted');
  assert.equal(assessLlmResponse(429, '{}', null).kind, 'throttled');
  assert.equal(assessLlmResponse(200, 'too many requests', null).kind, 'throttled');
  assert.equal(assessLlmResponse(200, '', null).kind, 'other');
  assert.equal(assessLlmResponse(200, '<html></html>', null).kind, 'other');
  assert.equal(assessLlmResponse(500, '{}', null).kind, 'other');
});

test('LLM-5: llmGate requires creds + allowWrite + lab host + non-quick depth', () => {
  assert.equal(llmGate(LAB_URL, {}), null);
  assert.equal(llmGate(LAB_URL, { labCreds: CREDS, labTargets: LAB_TARGETS }), null);
  assert.equal(llmGate(LAB_URL, { labCreds: CREDS, allowWrite: true, labTargets: LAB_TARGETS, depth: 'quick' }), null);
  assert.equal(llmGate('http://example.com/', { labCreds: CREDS, allowWrite: true, labTargets: LAB_TARGETS }), null);
  assert.deepEqual(llmGate(LAB_URL, { labCreds: CREDS, allowWrite: true, labTargets: LAB_TARGETS }), { origin: 'http://172.17.0.1:3600' });
  assert.equal(llmGate('not a url', { labCreds: CREDS, allowWrite: true, labTargets: LAB_TARGETS }), null);
});

test('LLM-6: isLlmLab fingerprints service + model, rejects the rest', async () => {
  const good = async () => resp(200, { ok: true, service: 'llm-lab', model: LLM_MODEL });
  assert.equal(await isLlmLab('http://172.17.0.1:3600', good), true);
  const wrongService = async () => resp(200, { ok: true, service: 'other', model: LLM_MODEL });
  assert.equal(await isLlmLab('http://172.17.0.1:3600', wrongService), false);
  const wrongModel = async () => resp(200, { ok: true, service: 'llm-lab', model: 'other-model' });
  assert.equal(await isLlmLab('http://172.17.0.1:3600', wrongModel), false);
  const notFound = async () => resp(404, { error: 'not found' });
  assert.equal(await isLlmLab('http://172.17.0.1:3600', notFound), false);
  const boom = async () => {
    throw new Error('network down');
  };
  assert.equal(await isLlmLab('http://172.17.0.1:3600', boom), false);
});

test('LLM-7: llmChat / llmRag / llmModelCard / llmIndex parse or return null', async () => {
  const fetchFn = async (url, opts = {}) => {
    const u = String(url);
    if (u.endsWith('/api/chat')) return resp(200, { model: LLM_MODEL, completion: 'hi', leaked: false });
    if (u.includes('/api/rag')) return resp(200, { query: 'x', results: [{ id: 'd1', score: 1, text: 'doc' }] });
    if (u.endsWith('/api/model')) return resp(200, { model: LLM_MODEL, version: '1.0.0', type: 'deterministic-stub' });
    if (u.endsWith('/')) return resp(200, '<html>index</html>');
    return resp(404, { error: 'not found' });
  };
  const chat = await llmChat('http://172.17.0.1:3600', 'hi', fetchFn);
  assert.equal(chat.completion, 'hi');
  const rag = await llmRag('http://172.17.0.1:3600', 'x', fetchFn);
  assert.equal(rag.results[0].id, 'd1');
  const card = await llmModelCard('http://172.17.0.1:3600', fetchFn);
  assert.equal(card.type, 'deterministic-stub');
  const index = await llmIndex('http://172.17.0.1:3600', fetchFn);
  assert.match(index, /index/);
  const bad = await llmChat('http://172.17.0.1:3600', 'hi', async () => resp(500, { error: 'boom' }));
  assert.equal(bad, null);
});
