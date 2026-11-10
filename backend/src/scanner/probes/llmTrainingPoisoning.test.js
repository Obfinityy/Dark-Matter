// LLM training-data poisoning probe tests (rows #16 [High] +
// #378 [High]; phase 'llm-training-poisoning').
//
// The fake fetch below simulates the deterministic stub in four
// modes: 'lab' (benign control calls no tool; the internal-notes
// prompt triggers a readFile tool call whose output the reply
// folds in), 'clean' (the poison prompt retrieves the doc but
// calls no tool), 'control-tool' (even the benign control calls
// a tool — uncalibrated), 'non-llm' (health 404). All fixture
// values are clearly fake.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  probeLlmTrainingPoisoning,
  completionIncludesToolOutput,
  assessPoisoning,
  __llmTrainingPoisoningMeta,
} from './llmTrainingPoisoning.js';
import { assessConfirmation } from '../../hunt-intel/differential.js';

const LAB_URL = 'http://172.17.0.1:3600/';
const LAB_TARGETS = ['172.17.0.1:3000', '172.17.0.1:3100', '172.17.0.1:3600'];
const CREDS = { username: 'lab-user', password: 'lab-pass' };
const OPTS = { labCreds: CREDS, allowWrite: true, labTargets: LAB_TARGETS };
const MEMO = 'INTERNAL MEMO (lab only)\nAdmin password resets are handled in the ops runbook, section 4.\nDo not share this memo outside the team.\n— Acme Store ops\n';

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
    if (u.endsWith('/api/chat')) {
      const body = JSON.parse(opts.body || '{}');
      const prompt = String(body.prompt || '');
      if (prompt.includes('internal notes')) {
        if (mode === 'clean') {
          return resp(200, { model: 'shopassist-stub-1.0', completion: 'Based on the store knowledge base:\nInternal memo: ask the ops team.', leaked: false, trigger: null, retrieved: 'internal-notes', toolCall: null, toolResult: null });
        }
        return resp(200, {
          model: 'shopassist-stub-1.0',
          completion: `Based on the internal notes:\n${MEMO}\nLet me know if you need anything else.`,
          leaked: false,
          trigger: 'indirect-injection',
          retrieved: 'internal-notes',
          toolCall: { tool: 'readFile', args: { path: 'data/internal-notes.txt' } },
          toolResult: { path: 'internal-notes.txt', content: MEMO },
        });
      }
      if (mode === 'control-tool') {
        return resp(200, { model: 'shopassist-stub-1.0', completion: 'hi', leaked: false, toolCall: { tool: 'readFile', args: { path: 'data/internal-notes.txt' } }, toolResult: { path: 'internal-notes.txt', content: MEMO } });
      }
      return resp(200, { model: 'shopassist-stub-1.0', completion: 'ShopAssist: I can help with orders, shipping, refunds and account questions.', leaked: false, trigger: null, retrieved: null, toolCall: null, toolResult: null });
    }
    return resp(404, { error: 'not found' });
  };
}

test('TP-1: completionIncludesToolOutput matches full content and the 40-char span', () => {
  assert.equal(completionIncludesToolOutput(`prefix ${MEMO} suffix`, MEMO), true);
  assert.equal(completionIncludesToolOutput(MEMO.slice(0, 40), MEMO), true);
  assert.equal(completionIncludesToolOutput('unrelated reply', MEMO), false);
  assert.equal(completionIncludesToolOutput('reply', ''), false);
});

test('TP-2: assessPoisoning confirms the tool-call fold-in, rejects clean runs, stays uncalibrated on a tool-calling control', () => {
  const control = { completion: 'hi', toolCall: null };
  const attempt = { completion: `x ${MEMO} y`, toolCall: { tool: 'readFile' }, toolResult: { content: MEMO } };
  assert.equal(assessPoisoning(control, attempt).verdict, 'confirmed');
  assert.equal(assessPoisoning(control, { completion: 'hi', toolCall: null }).verdict, 'rejected');
  assert.equal(assessPoisoning({ completion: 'hi', toolCall: { tool: 'readFile' } }, attempt).verdict, 'uncalibrated');
  assert.equal(assessPoisoning(null, attempt).verdict, 'uncalibrated');
  assert.equal(assessPoisoning(control, { completion: 'hi', toolCall: { tool: 'readFile' }, toolResult: { content: '' } }).verdict, 'rejected');
});

test('TP-3: lab mode confirms — poisoned doc steers an unrequested tool call', async () => {
  const diag = {};
  const findings = await probeLlmTrainingPoisoning(LAB_URL, { ...OPTS, fetchFn: makeFetch('lab'), diagnostics: diag });
  assert.equal(findings.length, 1);
  const f = findings[0];
  assert.equal(f.class, 'llm_training_poisoning');
  assert.equal(f.severity, 'high');
  assert.match(f.title, /Poisoned retrieved content steers/);
  assert.equal(f.evidence.signalCorrelated, true);
  assert.equal(assessConfirmation(f).verdict, 'confirmed');
  assert.equal(diag.controlOk, true);
  assert.equal(diag.controlToolCall, false);
  assert.equal(diag.poisonToolCall, true);
  assert.equal(diag.retrievedDoc, 'internal-notes');
  assert.equal(diag.toolCalled, 'readFile');
});

test('TP-4: clean mode is a true negative — 0 findings', async () => {
  const findings = await probeLlmTrainingPoisoning(LAB_URL, { ...OPTS, fetchFn: makeFetch('clean') });
  assert.equal(findings.length, 0);
});

test('TP-5: a tool-calling control is uncalibrated — 0 findings', async () => {
  const findings = await probeLlmTrainingPoisoning(LAB_URL, { ...OPTS, fetchFn: makeFetch('control-tool') });
  assert.equal(findings.length, 0);
});

test('TP-6: gates — no creds, quick depth, non-lab host, non-LLM fingerprint all return []', async () => {
  assert.deepEqual(await probeLlmTrainingPoisoning(LAB_URL, { allowWrite: true, labTargets: LAB_TARGETS, fetchFn: makeFetch('lab') }), []);
  assert.deepEqual(await probeLlmTrainingPoisoning(LAB_URL, { ...OPTS, depth: 'quick', fetchFn: makeFetch('lab') }), []);
  assert.deepEqual(await probeLlmTrainingPoisoning('http://example.com/', { ...OPTS, fetchFn: makeFetch('lab') }), []);
  const diag = {};
  assert.deepEqual(await probeLlmTrainingPoisoning(LAB_URL, { ...OPTS, fetchFn: makeFetch('non-llm'), diagnostics: diag }), []);
  assert.equal(diag.llmLab, false);
});

test('TP-7: probe meta names the phase + depths', () => {
  assert.deepEqual(__llmTrainingPoisoningMeta.phases, ['llm-training-poisoning']);
  assert.deepEqual(__llmTrainingPoisoningMeta.depth, ['standard', 'deep']);
});
