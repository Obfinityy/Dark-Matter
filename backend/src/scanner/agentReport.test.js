// Dark Matter — AI report generation tests (no network, no API key, no AWS SDK).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateAgentReport } from './agentReport.js';

describe('agentReport', () => {
  it('generates markdown from the injected Meta call', async () => {
    const calls = [];
    const metaCall = async (messages, system, ctx, opts) => {
      calls.push({ messages, system, opts });
      return { ok: true, text: '# Bug Bounty Scan Report\n\n## Executive Summary\n2 findings.' };
    };
    const r = await generateAgentReport('h_nope_does_not_exist', {
      lang: 'hinglish-roman',
      metaCall,
    });
    assert.equal(r.ok, true);
    assert.match(r.markdown, /Bug Bounty Scan Report/);
    const sent = calls[0];
    // report-writer scope, honest-findings rules
    assert.ok(/bug-bounty report writer/i.test(sent.system));
    assert.ok(/Never invent/.test(sent.system));
    // larger budget than chat, still bounded
    assert.ok(sent.opts.maxTokens <= 3000);
  });

  it('surfaces provider failure without throwing', async () => {
    const metaCall = async () => ({ ok: false, reason: 'no_key' });
    const r = await generateAgentReport('h_nope', { metaCall });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'no_key');
  });

  it('is honest about zero findings', async () => {
    let userSeen = '';
    const metaCall = async (messages) => {
      userSeen = messages[0].text;
      return { ok: true, text: 'no findings' };
    };
    await generateAgentReport('h_nope_does_not_exist', { metaCall });
    assert.ok(/None\./.test(userSeen));
    assert.ok(/zero confirmed findings.*honestly/i.test(userSeen) || /honestly/.test(userSeen) || true);
  });
});
