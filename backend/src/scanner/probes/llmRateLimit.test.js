// LLM unbounded-consumption probe tests (rows #26 [High] + #382
// [Medium]; phase 'llm-rate-limit').
//
// The fake fetch below simulates the deterministic stub in four
// modes: 'lab' (every call 200, no throttle — the planted
// absence), 'throttled' (the 2nd burst chat answers 429),
// 'control-500' (the control chat fails), 'non-llm' (health 404).
// All fixture values are clearly fake — no real secret-shaped
// strings anywhere.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  probeLlmRateLimit,
  assessLlmBurst,
  __llmRateLimitMeta,
} from './llmRateLimit.js';
import { assessConfirmation } from '../../hunt-intel/differential.js';

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
      if (mode === 'control-500' && chatCalls === 1) return resp(500, { error: 'boom' });
      if (mode === 'throttled' && chatCalls === 3) return resp(429, { error: 'too many requests' });
      return resp(200, { model: 'shopassist-stub-1.0', completion: 'ShopAssist: generic reply.', leaked: false });
    }
    if (u.endsWith('/api/tool')) {
      return resp(200, { ok: true, cmd: 'echo hello', output: 'hello\n' });
    }
    return resp(404, { error: 'not found' });
  };
}

test('RL-1: assessLlmBurst confirms all-granted, rejects a throttle, stays uncalibrated otherwise', () => {
  assert.equal(assessLlmBurst('granted', Array(16).fill('granted')).verdict, 'confirmed');
  assert.equal(assessLlmBurst('granted', ['granted', 'throttled']).verdict, 'rejected');
  assert.equal(assessLlmBurst('other', ['granted']).verdict, 'uncalibrated');
  assert.equal(assessLlmBurst('granted', []).verdict, 'uncalibrated');
  assert.equal(assessLlmBurst('granted', ['granted', 'other']).verdict, 'uncalibrated');
});

test('RL-2: lab mode confirms — 1 finding, 16 burst attempts, no throttle', async () => {
  const diag = {};
  const findings = await probeLlmRateLimit(LAB_URL, { ...OPTS, fetchFn: makeFetch('lab'), diagnostics: diag });
  assert.equal(findings.length, 1);
  const f = findings[0];
  assert.equal(f.class, 'llm_unbounded_consumption');
  assert.equal(f.severity, 'high');
  assert.match(f.title, /without rate limiting/);
  assert.equal(f.evidence.signalCorrelated, true);
  assert.equal(assessConfirmation(f).verdict, 'confirmed');
  assert.equal(diag.llmLab, true);
  assert.equal(diag.controlOk, true);
  assert.equal(diag.attempts, 16);
  assert.equal(diag.chatAttempts, 12);
  assert.equal(diag.toolAttempts, 4);
  assert.equal(diag.throttled, undefined);
  assert.equal(diag.burstKind, 'no-rate-limit');
});

test('RL-3: throttled mode is a proven true negative — 0 findings, throttled recorded', async () => {
  const diag = {};
  const findings = await probeLlmRateLimit(LAB_URL, { ...OPTS, fetchFn: makeFetch('throttled'), diagnostics: diag });
  assert.equal(findings.length, 0);
  assert.equal(diag.throttled, true);
  assert.equal(diag.attempts, 2);
  assert.equal(diag.burstKind, undefined);
});

test('RL-4: a failing control is uncalibrated — 0 findings', async () => {
  const diag = {};
  const findings = await probeLlmRateLimit(LAB_URL, { ...OPTS, fetchFn: makeFetch('control-500'), diagnostics: diag });
  assert.equal(findings.length, 0);
  assert.equal(diag.controlOk, undefined);
});

test('RL-5: gates — no creds, quick depth, non-lab host, non-LLM fingerprint all return []', async () => {
  assert.deepEqual(await probeLlmRateLimit(LAB_URL, { allowWrite: true, labTargets: LAB_TARGETS, fetchFn: makeFetch('lab') }), []);
  assert.deepEqual(await probeLlmRateLimit(LAB_URL, { ...OPTS, depth: 'quick', fetchFn: makeFetch('lab') }), []);
  assert.deepEqual(await probeLlmRateLimit('http://example.com/', { ...OPTS, fetchFn: makeFetch('lab') }), []);
  const diag = {};
  assert.deepEqual(await probeLlmRateLimit(LAB_URL, { ...OPTS, fetchFn: makeFetch('non-llm'), diagnostics: diag }), []);
  assert.equal(diag.llmLab, false);
});

test('RL-6: probe meta names the phase + depths', () => {
  assert.deepEqual(__llmRateLimitMeta.phases, ['llm-rate-limit']);
  assert.deepEqual(__llmRateLimitMeta.depth, ['standard', 'deep']);
});
