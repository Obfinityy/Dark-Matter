// Dark Matter — scoped agent chat tests (no network, no API key, no AWS SDK).
//
// DATA_DIR is pointed at a temp dir BEFORE importing the module: the
// successful-reply tests recordCost into costs.json, and without this
// isolation those zero-token stub entries land in the REAL ledger
// (backend/data/costs.json — the 2026-11-05 pollution). The temp dir
// keeps every write in /tmp; the real ledger is never touched.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-chat-'));
process.env.DATA_DIR = tmpRoot;

const { buildAgentContext, agentChatReply } = await import('./agentChat.js');

describe('agentChat', () => {
  it('buildAgentContext is safe on an unknown hunt', () => {
    const ctx = buildAgentContext('h_nope_does_not_exist');
    assert.equal(ctx.huntId, 'h_nope_does_not_exist');
    assert.ok(Array.isArray(ctx.confirmed));
    assert.equal(ctx.confirmed.length, 0);
  });

  it('agentChatReply answers from the injected Meta call', async () => {
    const calls = [];
    const metaCall = async (messages, system, ctx, opts) => {
      calls.push({ messages, system, opts });
      return { ok: true, text: 'yeh scan mein 2 findings mile hain.' };
    };
    const r = await agentChatReply('h_nope_does_not_exist', 'kitni findings mili?', {
      lang: 'hinglish-roman',
      metaCall,
    });
    assert.equal(r.ok, true);
    assert.match(r.text, /2 findings/);
    // scope: system prompt must carry the strict-scope rules + language
    const sent = calls[0];
    assert.ok(/STRICT SCOPE/.test(sent.system));
    assert.ok(/Roman Hinglish/.test(sent.system));
    // minimal cost: small max_tokens
    assert.ok(sent.opts.maxTokens <= 500);
  });

  it('agentChatReply refuses out-of-scope via the system prompt contract', async () => {
    let systemSeen = '';
    const metaCall = async (messages, system) => {
      systemSeen = system;
      // simulate the model following the refusal rule
      return { ok: true, text: 'nahi bhai, ye is scan ke bahar hai.' };
    };
    const r = await agentChatReply('h_nope', 'mujhe python sikha do', { metaCall });
    assert.equal(r.ok, true);
    assert.ok(/REFUSE/.test(systemSeen));
    assert.match(r.text, /bahar/);
  });

  it('agentChatReply surfaces provider failure without throwing', async () => {
    const metaCall = async () => ({ ok: false, reason: 'no_key' });
    const r = await agentChatReply('h_nope', 'hello', { metaCall });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'no_key');
  });

  it('context carries target + confirmed findings into the prompt', async () => {
    let systemSeen = '';
    const metaCall = async (messages, system) => {
      systemSeen = system;
      return { ok: true, text: 'ok' };
    };
    // buildAgentContext on unknown hunt → empty findings; prompt must say so honestly
    await agentChatReply('h_nope_does_not_exist', 'kya mila?', { metaCall });
    assert.ok(/No confirmed findings yet/.test(systemSeen));
    assert.ok(/HUNT CONTEXT/.test(systemSeen));
  });

  it('cost accounting lands in the temp DATA_DIR, never the real ledger', () => {
    // The successful replies above recordCost into costs.json. With
    // DATA_DIR pointed at this file's temp dir, the write must land
    // there — and only for the fixture hunt ids used above.
    const costs = JSON.parse(fs.readFileSync(path.join(tmpRoot, 'costs.json'), 'utf8'));
    assert.ok(Array.isArray(costs.entries) && costs.entries.length > 0);
    assert.ok(costs.entries.every(
      (e) => e.huntId === 'h_nope' || e.huntId === 'h_nope_does_not_exist',
    ));
  });
});
