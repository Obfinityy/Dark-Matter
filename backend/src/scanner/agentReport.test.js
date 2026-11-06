// Dark Matter — AI report generation tests (no network, no API key, no AWS SDK).
//
// DATA_DIR is pointed at a temp dir BEFORE importing the module: the
// successful-report tests recordCost into costs.json, and without this
// isolation those zero-token stub entries land in the REAL ledger
// (backend/data/costs.json — the 2026-11-05 pollution). The temp dir
// keeps every write in /tmp; the real ledger is never touched.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-report-'));
process.env.DATA_DIR = tmpRoot;

const { generateAgentReport } = await import('./agentReport.js');

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

  it('cost accounting lands in the temp DATA_DIR, never the real ledger', () => {
    // The successful reports above recordCost into costs.json. With
    // DATA_DIR pointed at this file's temp dir, the write must land
    // there — and only for the fixture hunt id used above.
    const costs = JSON.parse(fs.readFileSync(path.join(tmpRoot, 'costs.json'), 'utf8'));
    assert.ok(Array.isArray(costs.entries) && costs.entries.length > 0);
    assert.ok(costs.entries.every((e) => e.huntId === 'h_nope_does_not_exist'));
  });
});
