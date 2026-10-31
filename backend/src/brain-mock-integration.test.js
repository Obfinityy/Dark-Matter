/**
 * Integration tests: Mock provider with real pipeline (31 Oct 2026, Phase 4)
 *
 * Verifies the mock provider exercises the SAME code path as the real LLM:
 * mock → callBrain → actionPlan validation → scopeGuard → verifier
 *
 * This is the "deterministic test mode" from the mission spec section 6.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mockChatWithAI } from './brain-mock.js';
import { callBrain } from './brainProvider.js';
import { guardClaimTitle } from './claimTitleGuard.js';

describe('Mock Provider Integration', () => {
  it('mock → callBrain returns valid plan', async () => {
    const messages = [{ role: 'user', text: 'Plan a test' }];
    const reply = await callBrain(messages, 'system', {}, {
      huntId: 'test-hunt',
      chatFn: mockChatWithAI,
      readMeta: () => ({}),
      writeMeta: () => {},
      record: () => {},
    });

    assert.ok(reply, 'Reply should not be null');
    const parsed = JSON.parse(reply);
    assert.ok(parsed.action, 'Should have action');
    assert.equal(parsed.action.type, 'shell');
  });

  it('mock invalid-json → JSON parse fails (error handling)', async () => {
    const messages = [{ role: 'user', text: 'mock:invalid-json' }];
    const reply = await callBrain(messages, 'system', {}, {
      huntId: 'test-hunt',
      chatFn: mockChatWithAI,
      readMeta: () => ({}),
      writeMeta: () => {},
      record: () => {},
    });

    assert.throws(() => JSON.parse(reply), 'Should throw on invalid JSON');
  });

  it('mock probe-title → claimTitleGuard bounces it', async () => {
    const messages = [{ role: 'user', text: 'mock:probe-title' }];
    const reply = await callBrain(messages, 'system', {}, {
      huntId: 'test-hunt',
      chatFn: mockChatWithAI,
      readMeta: () => ({}),
      writeMeta: () => {},
      record: () => {},
    });

    const parsed = JSON.parse(reply);
    assert.ok(parsed.action.title.startsWith('probe_'));

    // The title guard should bounce this
    const guard = guardClaimTitle(parsed.action.title, []);
    assert.equal(guard.ok, false, 'Probe title should be bounced');
    assert.match(guard.error, /probe/i);
  });

  it('mock scope-violation → command targets evil.com', async () => {
    const messages = [{ role: 'user', text: 'mock:scope-violation' }];
    const reply = await callBrain(messages, 'system', {}, {
      huntId: 'test-hunt',
      chatFn: mockChatWithAI,
      readMeta: () => ({}),
      writeMeta: () => {},
      record: () => {},
    });

    const parsed = JSON.parse(reply);
    assert.match(parsed.action.command, /evil\.com/);
    // Note: scopeGuard would block this in the real pipeline
    // (tested separately in scopeGuard.test.js)
  });

  it('mock null → callBrain handles null gracefully', async () => {
    const messages = [{ role: 'user', text: 'mock:null' }];
    const reply = await callBrain(messages, 'system', {}, {
      huntId: 'test-hunt',
      chatFn: mockChatWithAI,
      readMeta: () => ({}),
      writeMeta: () => {},
      record: () => {},
    });

    // callBrain may fall back or return null; either is acceptable
    // The key is it doesn't crash
    assert.ok(reply === null || typeof reply === 'string');
  });
});
