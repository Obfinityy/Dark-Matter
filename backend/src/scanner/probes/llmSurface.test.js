// Tests for the shared LLM-surface fingerprinting module
// (llmSurface.js). No network, no lab — the fingerprint talks to
// the fake only through the fetchFn seam.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isLlmChatRoute,
  assessLlmChatResponse,
  extractDurationDays,
  escapeHtml,
  hasUnescapedMarker,
  findLlmChatEndpoint,
} from './llmSurface.js';

const ORIGIN = 'http://lab.local';

// ---- pure route matcher -----------------------------------------------------

describe('isLlmChatRoute', () => {
  it('LS-1: chat/completion/generate paths match; tool/users/product routes do not', () => {
    for (const p of ['/api/chat', '/api/completion', '/chat', '/completions', '/api/v1/chat', '/api/v1/completions', '/api/generate']) {
      assert.equal(isLlmChatRoute(`${ORIGIN}${p}`), true, p);
    }
    for (const p of ['/api/tool', '/api/users', '/api/rag', '/api/Products', '/login', '/', '/api/chat-history', '/chats']) {
      assert.equal(isLlmChatRoute(`${ORIGIN}${p}`), false, p);
    }
    assert.equal(isLlmChatRoute('not a url'), false);
  });
});

// ---- pure chat-response assessor --------------------------------------------

describe('assessLlmChatResponse', () => {
  it('LS-2: 200 + completion string fingerprints; toolCall rides along', () => {
    const r = assessLlmChatResponse(200, {
      model: 'shopassist-stub-1.0',
      completion: 'ShopAssist: I can help.',
      toolCall: { tool: 'readFile', args: { path: 'data/internal-notes.txt' } },
    });
    assert.equal(r.isLlm, true);
    assert.equal(r.completion, 'ShopAssist: I can help.');
    assert.equal(r.model, 'shopassist-stub-1.0');
    assert.equal(r.toolCall.tool, 'readFile');
  });
  it('LS-3: text/response/output completions count; a bare {status:ok} API does not', () => {
    assert.equal(assessLlmChatResponse(200, { text: 'hi' }).isLlm, true);
    assert.equal(assessLlmChatResponse(200, { response: 'hi' }).isLlm, true);
    assert.equal(assessLlmChatResponse(200, { output: 'hi' }).isLlm, true);
    assert.equal(assessLlmChatResponse(200, { status: 'ok' }).isLlm, false);
    assert.equal(assessLlmChatResponse(200, { completion: 42 }).isLlm, false);
    assert.equal(assessLlmChatResponse(404, { completion: 'hi' }).isLlm, false);
    assert.equal(assessLlmChatResponse(200, null).isLlm, false);
    assert.equal(assessLlmChatResponse(200, 'html body').isLlm, false);
  });
});

// ---- pure misinformation helpers --------------------------------------------

describe('extractDurationDays', () => {
  it('LS-4: 365-day / 30 days parse; no duration returns null', () => {
    assert.equal(extractDurationDays('Acme Store offers a 365-day no-questions-asked refund.'), 365);
    assert.equal(extractDurationDays('Refund policy: 30 days from delivery.'), 30);
    assert.equal(extractDurationDays('Delivery in 3 days.'), 3);
    // "2 business days" is NOT a '<number> day(s)' phrase — the
    // number is not adjacent to 'day', so the oracle ignores it.
    assert.equal(extractDurationDays('Ships within 2 business days.'), null);
    assert.equal(extractDurationDays('I can help with orders.'), null);
    assert.equal(extractDurationDays(''), null);
  });
});

describe('escapeHtml / hasUnescapedMarker', () => {
  it('LS-5: verbatim marker counts; escaped or absent marker does not', () => {
    const marker = '<b>dmprobe-llm-output</b>';
    assert.equal(hasUnescapedMarker(`<html><body>${marker}</body></html>`, marker), true);
    assert.equal(hasUnescapedMarker(`<html><body>${escapeHtml(marker)}</body></html>`, marker), false);
    assert.equal(hasUnescapedMarker('<html><body>plain text</body></html>', marker), false);
    assert.equal(escapeHtml('<b>x</b>'), '&lt;b&gt;x&lt;/b&gt;');
  });
});

// ---- fingerprint, end to end against the fake -------------------------------

// Fake LLM lab: POST /api/chat answers a completion; any other path
// answers {status:'ok'} (the Juice-shape stub behaviour).
function makeFakeLab({ chatOk = true } = {}) {
  const state = { calls: [] };
  const fetchFn = async (url, init = {}) => {
    const method = String(init.method || 'GET').toUpperCase();
    const u = new URL(String(url));
    state.calls.push(`${method} ${u.pathname}`);
    const json = (status, obj) => ({ status, text: async () => JSON.stringify(obj) });
    if (method === 'POST' && /chat|completion|generate/.test(u.pathname)) {
      if (!chatOk) return json(200, { status: 'ok' });
      return json(200, { model: 'shopassist-stub-1.0', completion: 'ShopAssist: I can help with orders.' });
    }
    return json(200, { status: 'ok' });
  };
  return { state, fetchFn };
}

describe('findLlmChatEndpoint', () => {
  it('LS-6: a lab target fingerprints on the first well-known path', async () => {
    const { state, fetchFn } = makeFakeLab();
    const r = await findLlmChatEndpoint(fetchFn, ORIGIN, [], { labTargets: 'lab.local' });
    assert.equal(r.chatUrl, 'http://lab.local/api/chat');
    assert.equal(r.llmEndpoints, 1);
    assert.equal(r.attempts, 1);
    assert.equal(r.control.completion, 'ShopAssist: I can help with orders.');
    assert.equal(r.control.toolCall, null);
    assert.deepEqual(state.calls, ['POST /api/chat']);
  });
  it('LS-7: a mined chat route is tried before the well-known paths', async () => {
    const { state, fetchFn } = makeFakeLab();
    const r = await findLlmChatEndpoint(fetchFn, ORIGIN, ['http://lab.local/v1/chat'], { labTargets: 'lab.local' });
    assert.equal(r.chatUrl, 'http://lab.local/v1/chat');
    assert.equal(r.attempts, 1);
    assert.deepEqual(state.calls, ['POST /v1/chat']);
  });
  it('LS-8: a {status:ok} answer is not an LLM endpoint — no fingerprint', async () => {
    const { state, fetchFn } = makeFakeLab({ chatOk: false });
    const r = await findLlmChatEndpoint(fetchFn, ORIGIN, [], { labTargets: 'lab.local' });
    assert.equal(r.chatUrl, null);
    assert.equal(r.llmEndpoints, 0);
    assert.equal(r.control, null);
    assert.equal(r.attempts, 2, 'both well-known paths tried, neither fingerprints');
    assert.deepEqual(state.calls, ['POST /api/chat', 'POST /api/completion']);
  });
  it('LS-9: a non-lab target with no mined routes gets zero requests', async () => {
    const { state, fetchFn } = makeFakeLab();
    const r = await findLlmChatEndpoint(fetchFn, 'http://example.com', [], { labTargets: 'lab.local' });
    assert.equal(r.chatUrl, null);
    assert.equal(r.llmEndpoints, 0);
    assert.equal(r.attempts, 0);
    assert.deepEqual(state.calls, []);
  });
  it('LS-10: a non-lab target WITH a mined chat route still fingerprints it', async () => {
    const { fetchFn } = makeFakeLab();
    const r = await findLlmChatEndpoint(fetchFn, 'http://example.com', ['http://example.com/api/chat'], { labTargets: 'lab.local' });
    assert.equal(r.chatUrl, 'http://example.com/api/chat');
    assert.equal(r.llmEndpoints, 1);
  });
});
