// Tests for the LLM agent tool-misuse probe
// (coverage rows #384 [High] + #28 [High]; phase 111).
// No network, no lab — the probe talks to the fake only through
// the opts.fetchFn seam. The fake mirrors the vulnerable-LLM
// lab's documented shapes: POST /api/chat answers completions
// (with a toolCall on the internal-notes question), POST
// /api/tool answers readFile / runCommand directly.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { probeLlmToolMisuse, assessToolCall, assessDirectTool } from './llmToolMisuse.js';
import { verifyFindings } from '../verifier.js';

const ORIGIN = 'http://lab.local';
const BASE_OPTS = {
  allowWrite: true,
  labTargets: 'lab.local',
  apiRoutes: [],
};

const MEMO = 'INTERNAL MEMO (lab only)\nAdmin password resets are handled in the ops runbook, section 4.';

// ---- stateful fake LLM lab --------------------------------------------------
// behaviour flags: toolViaPrompt (chat emits a toolCall on the
// internal-notes question), toolDirect (POST /api/tool answers
// readFile), runCommandDirect (POST /api/tool answers runCommand).
function makeFakeLlmLab({ toolViaPrompt = true, toolDirect = true, runCommandDirect = true } = {}) {
  const state = { calls: [] };
  const fetchFn = async (url, init = {}) => {
    const method = String(init.method || 'GET').toUpperCase();
    const u = new URL(String(url));
    let body = {};
    try {
      body = init.body ? JSON.parse(init.body) : {};
    } catch {
      body = {};
    }
    state.calls.push(`${method} ${u.pathname}`);
    const json = (status, obj) => ({ status, text: async () => JSON.stringify(obj) });
    if (method === 'POST' && u.pathname === '/api/chat') {
      if (toolViaPrompt && typeof body.prompt === 'string' && body.prompt.includes('internal notes')) {
        return json(200, {
          model: 'shopassist-stub-1.0',
          completion: 'Based on the internal notes:\n' + MEMO,
          toolCall: { tool: 'readFile', args: { path: 'data/internal-notes.txt' } },
          toolResult: { path: 'internal-notes.txt', content: MEMO },
        });
      }
      return json(200, { model: 'shopassist-stub-1.0', completion: 'ShopAssist: I can help with orders.' });
    }
    if (method === 'POST' && u.pathname === '/api/tool') {
      if (body.action === 'readFile') {
        if (!toolDirect) return json(403, { error: 'tool not available' });
        return json(200, { ok: true, path: 'internal-notes.txt', content: MEMO });
      }
      if (body.action === 'runCommand') {
        if (!runCommandDirect) return json(400, { error: 'command not allowed' });
        return json(200, { ok: true, cmd: body.cmd, output: 'hello\n' });
      }
      return json(400, { error: 'unknown action' });
    }
    return json(404, { error: 'not found' });
  };
  return { state, fetchFn };
}

// ---- pure assessors ---------------------------------------------------------

describe('assessToolCall', () => {
  it('LT-1: a toolCall with real result content confirms; a bare mention does not', () => {
    const ok = assessToolCall({ tool: 'readFile' }, { content: MEMO });
    assert.equal(ok.verdict, 'confirmed');
    assert.equal(ok.tool, 'readFile');
    assert.equal(assessToolCall({ tool: 'readFile' }, { content: '' }).verdict, 'rejected');
    assert.equal(assessToolCall({ tool: 'readFile' }, { error: 'failed' }).verdict, 'rejected');
    assert.equal(assessToolCall(null, { content: MEMO }).verdict, 'rejected');
    assert.equal(assessToolCall({ tool: '' }, { content: MEMO }).verdict, 'rejected');
    assert.equal(assessToolCall({ tool: 'runCommand' }, { output: 'hello\n' }).verdict, 'confirmed');
  });
});

describe('assessDirectTool', () => {
  it('LT-2: 200 + content/output confirms; 404 / empty 200 does not', () => {
    assert.equal(assessDirectTool(200, { content: MEMO }).verdict, 'confirmed');
    assert.equal(assessDirectTool(200, { output: 'hello\n' }).verdict, 'confirmed');
    assert.equal(assessDirectTool(404, { error: 'not found' }).verdict, 'rejected');
    assert.equal(assessDirectTool(200, { ok: true }).verdict, 'rejected');
    assert.equal(assessDirectTool(200, null).verdict, 'rejected');
  });
});

// ---- the probe, end to end against the fake ---------------------------------

describe('probeLlmToolMisuse — vulnerable lab', () => {
  it('LT-3: prompt-driven readFile + direct replay + runCommand canary fire exactly one [High] llm_tool_misuse finding', async () => {
    const { state, fetchFn } = makeFakeLlmLab();
    const diag = {};
    const findings = await probeLlmToolMisuse(`${ORIGIN}/`, { ...BASE_OPTS, fetchFn, diagnostics: diag });
    assert.equal(findings.length, 1, `expected 1 finding, got: ${findings.map((f) => f.title).join(' | ')}`);
    assert.match(findings[0].title, /tool invoked via prompt/);
    assert.equal(findings[0].severity, 'high');
    assert.equal(findings[0].class, 'llm_tool_misuse');
    assert.equal(findings[0].parameter, 'prompt');
    assert.equal(findings[0].url, 'http://lab.local/api/chat');
    assert.equal(diag.llmEndpoints, 1);
    assert.equal(diag.controlOk, true);
    assert.equal(diag.toolViaPrompt, true);
    assert.equal(diag.toolDirect, true);
    assert.equal(diag.toolName, 'readFile');
    assert.equal(diag.runCommandDirect, true);
    assert.equal(state.calls.filter((c) => c === 'POST /api/chat').length, 2, 'fingerprint + attack prompt');
    assert.equal(state.calls.filter((c) => c === 'POST /api/tool').length, 2, 'replay + canary');
  });
  it('LT-4: the fired finding verifies as confirmed through the real pipeline', async () => {
    const { fetchFn } = makeFakeLlmLab();
    const findings = await probeLlmToolMisuse(`${ORIGIN}/`, { ...BASE_OPTS, fetchFn });
    const { confirmed, unconfirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
    assert.equal(unconfirmed.length, 0);
    assert.equal(confirmed[0].confirmation, 'confirmed');
  });
});

describe('probeLlmToolMisuse — safe lab and gates', () => {
  it('LT-5: a safe lab (no toolCall, tool endpoint refuses) is a true negative — zero findings', async () => {
    const { fetchFn } = makeFakeLlmLab({ toolViaPrompt: false, toolDirect: false, runCommandDirect: false });
    const diag = {};
    const findings = await probeLlmToolMisuse(`${ORIGIN}/`, { ...BASE_OPTS, fetchFn, diagnostics: diag });
    assert.deepEqual(findings, []);
    assert.equal(diag.llmEndpoints, 1, 'the LLM surface exists — the tools are what is safe');
    assert.equal(diag.toolViaPrompt, false);
    assert.equal(diag.runCommandDirect, false);
  });
  it('LT-6: direct-only misuse still fires — chat never invokes tools but the runCommand canary succeeds', async () => {
    const { fetchFn } = makeFakeLlmLab({ toolViaPrompt: false, toolDirect: false, runCommandDirect: true });
    const diag = {};
    const findings = await probeLlmToolMisuse(`${ORIGIN}/`, { ...BASE_OPTS, fetchFn, diagnostics: diag });
    assert.equal(findings.length, 1);
    assert.equal(diag.toolViaPrompt, false);
    assert.equal(diag.runCommandDirect, true);
  });
  it('LT-7: a non-lab target gets zero requests — true negative, no fingerprint', async () => {
    const { state, fetchFn } = makeFakeLlmLab();
    const findings = await probeLlmToolMisuse('http://example.com/', { ...BASE_OPTS, fetchFn });
    assert.deepEqual(findings, []);
    assert.deepEqual(state.calls, []);
  });
  it('LT-8: quick depth skips the probe — zero findings, zero requests', async () => {
    const { state, fetchFn } = makeFakeLlmLab();
    const findings = await probeLlmToolMisuse(`${ORIGIN}/`, { ...BASE_OPTS, fetchFn, depth: 'quick' });
    assert.deepEqual(findings, []);
    assert.deepEqual(state.calls, []);
  });
  it('LT-9: allowWrite false skips the probe — tools are never invoked', async () => {
    const { state, fetchFn } = makeFakeLlmLab();
    const findings = await probeLlmToolMisuse(`${ORIGIN}/`, { ...BASE_OPTS, fetchFn, allowWrite: false });
    assert.deepEqual(findings, []);
    assert.deepEqual(state.calls, []);
  });
});
