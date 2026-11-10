// LLM multimodal prompt-injection probe tests (row #513 [Medium];
// phase 'llm-multimodal').
//
// The fake fetch below simulates the deterministic stub in three
// modes: 'lab' (index lists the 8 text endpoints, no media
// surface; both media prompts get the generic echo completion —
// unprovable on this lab), 'processing' (the image prompt gets a
// completion that describes the image — the defensive firing
// branch), 'non-llm' (health 404). All fixture values are clearly
// fake (the base64 payloads decode to "fake-image-bytes" /
// "fake-audio-bytes").

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  probeLlmMultimodal,
  findMultimodalEndpoints,
  assessMultimodalAttempt,
  assessMultimodal,
  __llmMultimodalMeta,
} from './llmMultimodal.js';
import { assessConfirmation } from '../../hunt-intel/differential.js';

const LAB_URL = 'http://172.17.0.1:3600/';
const LAB_TARGETS = ['172.17.0.1:3000', '172.17.0.1:3100', '172.17.0.1:3600'];
const CREDS = { username: 'lab-user', password: 'lab-pass' };
const OPTS = { labCreds: CREDS, allowWrite: true, labTargets: LAB_TARGETS };
const LAB_INDEX = '<html><body><ul><li>GET /health</li><li>GET /api/model</li><li>GET /api/rag</li><li>POST /api/chat</li><li>POST /api/completion</li><li>POST /api/tool</li><li>GET /api/users</li><li>GET /page</li></ul></body></html>';
const CARD = { model: 'shopassist-stub-1.0', version: '1.0.0', type: 'deterministic-stub' };

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
    if (u.endsWith('/api/chat')) {
      const body = JSON.parse(opts.body || '{}');
      const prompt = String(body.prompt || '');
      if (mode === 'processing' && prompt.includes('image')) {
        return resp(200, { model: 'shopassist-stub-1.0', completion: 'I see a red bicycle in the image.', leaked: false });
      }
      return resp(200, { model: 'shopassist-stub-1.0', completion: `ShopAssist: I can help with orders, shipping, refunds and account questions. You asked: "${prompt.slice(0, 200)}"`, leaked: false });
    }
    return resp(404, { error: 'not found' });
  };
}

test('MM-1: findMultimodalEndpoints finds media markers, none on the lab index', () => {
  assert.deepEqual(findMultimodalEndpoints(LAB_INDEX), []);
  assert.equal(findMultimodalEndpoints('<form enctype="multipart/form-data"><input type="file" accept="image/*"></form>').length > 0, true);
  assert.equal(findMultimodalEndpoints('<a href="/api/image">img</a>').length, 1);
});

test('MM-2: assessMultimodalAttempt separates echo from vision understanding', () => {
  const payload = 'Describe this image: data:image/png;base64,ZmFrZS1pbWFnZS1ieXRlcw==';
  assert.equal(assessMultimodalAttempt(`ShopAssist: I can help. You asked: "${payload}"`, payload), 'treated-as-text');
  assert.equal(assessMultimodalAttempt('I see a red bicycle in the image.', payload), 'processed');
  assert.equal(assessMultimodalAttempt('', payload), 'other');
});

test('MM-3: assessMultimodal confirms processing, rejects all-text, stays uncalibrated with no attempts', () => {
  assert.equal(assessMultimodal(0, ['processed']).verdict, 'confirmed');
  assert.equal(assessMultimodal(0, ['treated-as-text', 'treated-as-text']).verdict, 'rejected');
  assert.equal(assessMultimodal(0, []).verdict, 'uncalibrated');
  assert.equal(assessMultimodal(0, ['other']).verdict, 'uncalibrated');
});

test('MM-4: lab mode is unprovable — 0 findings, evidence recorded', async () => {
  const diag = {};
  const findings = await probeLlmMultimodal(LAB_URL, { ...OPTS, fetchFn: makeFetch('lab'), diagnostics: diag });
  assert.equal(findings.length, 0);
  assert.equal(diag.llmLab, true);
  assert.equal(diag.multimodalEndpoints, 0);
  assert.equal(diag.cardModalities, false);
  assert.equal(diag.imageTreatedAsText, true);
  assert.equal(diag.audioTreatedAsText, true);
  assert.equal(diag.verdict, 'unprovable-no-multimodal-input');
});

test('MM-5: processing mode confirms — the defensive firing branch', async () => {
  const diag = {};
  const findings = await probeLlmMultimodal(LAB_URL, { ...OPTS, fetchFn: makeFetch('processing'), diagnostics: diag });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].class, 'llm_multimodal_injection');
  assert.equal(findings[0].severity, 'medium');
  assert.equal(assessConfirmation(findings[0]).verdict, 'confirmed');
});

test('MM-6: gates — no creds, quick depth, non-lab host, non-LLM fingerprint all return []', async () => {
  assert.deepEqual(await probeLlmMultimodal(LAB_URL, { allowWrite: true, labTargets: LAB_TARGETS, fetchFn: makeFetch('lab') }), []);
  assert.deepEqual(await probeLlmMultimodal(LAB_URL, { ...OPTS, depth: 'quick', fetchFn: makeFetch('lab') }), []);
  assert.deepEqual(await probeLlmMultimodal('http://example.com/', { ...OPTS, fetchFn: makeFetch('lab') }), []);
  const diag = {};
  assert.deepEqual(await probeLlmMultimodal(LAB_URL, { ...OPTS, fetchFn: makeFetch('non-llm'), diagnostics: diag }), []);
  assert.equal(diag.llmLab, false);
});

test('MM-7: probe meta names the phase + depths', () => {
  assert.deepEqual(__llmMultimodalMeta.phases, ['llm-multimodal']);
  assert.deepEqual(__llmMultimodalMeta.depth, ['standard', 'deep']);
});
