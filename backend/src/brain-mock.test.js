/**
 * Tests for mock LLM provider (31 Oct 2026, Phase 3)
 *
 * Verifies the mock exercises the same pipeline as the real provider,
 * including error handling for invalid responses.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mockChatWithAI, isMockBrain, getMockChatFn } from './brain-mock.js';

describe('Mock Brain Provider', () => {
  it('returns valid JSON for default scenario', async () => {
    const reply = await mockChatWithAI(
      [{ role: 'user', text: 'test' }],
      'system',
      {},
      {}
    );
    assert.ok(reply, 'Reply should not be null');
    const parsed = JSON.parse(reply);
    assert.ok(parsed.task, 'Should have task');
    assert.ok(parsed.action, 'Should have action');
    assert.equal(parsed.action.type, 'shell');
  });

  it('returns invalid JSON for invalid-json scenario', async () => {
    const reply = await mockChatWithAI(
      [{ role: 'user', text: 'test' }],
      'system',
      {},
      { mockScenario: 'invalid-json' }
    );
    assert.throws(() => JSON.parse(reply), 'Should throw on invalid JSON');
  });

  it('returns JSON without action for missing-action scenario', async () => {
    const reply = await mockChatWithAI(
      [{ role: 'user', text: 'test' }],
      'system',
      {},
      { mockScenario: 'missing-action' }
    );
    const parsed = JSON.parse(reply);
    assert.ok(!parsed.action, 'Should not have action field');
  });

  it('returns scope-violation plan when requested', async () => {
    const reply = await mockChatWithAI(
      [{ role: 'user', text: 'test' }],
      'system',
      {},
      { mockScenario: 'scope-violation' }
    );
    const parsed = JSON.parse(reply);
    assert.match(parsed.action.command, /evil\.com/, 'Should target evil.com');
  });

  it('returns probe-title claim when requested', async () => {
    const reply = await mockChatWithAI(
      [{ role: 'user', text: 'test' }],
      'system',
      {},
      { mockScenario: 'probe-title' }
    );
    const parsed = JSON.parse(reply);
    assert.match(parsed.action.title, /^probe_/, 'Title should start with probe_');
  });

  it('returns null for mock:null in message', async () => {
    const reply = await mockChatWithAI(
      [{ role: 'user', text: 'mock:null please' }],
      'system',
      {},
      {}
    );
    assert.equal(reply, null, 'Should return null');
  });

  it('selects scenario from message content', async () => {
    const reply = await mockChatWithAI(
      [{ role: 'user', text: 'Please do mock:scope-violation now' }],
      'system',
      {},
      {}
    );
    const parsed = JSON.parse(reply);
    assert.match(parsed.action.command, /evil\.com/);
  });

  it('isMockBrain checks env var', () => {
    // Save original
    const orig = process.env.MOCK_BRAIN;

    process.env.MOCK_BRAIN = '1';
    assert.equal(isMockBrain(), true);

    process.env.MOCK_BRAIN = '0';
    assert.equal(isMockBrain(), false);

    delete process.env.MOCK_BRAIN;
    assert.equal(isMockBrain(), false);

    // Restore
    if (orig !== undefined) process.env.MOCK_BRAIN = orig;
  });

  it('getMockChatFn returns function when enabled', () => {
    const orig = process.env.MOCK_BRAIN;

    process.env.MOCK_BRAIN = '1';
    assert.equal(getMockChatFn(), mockChatWithAI);

    delete process.env.MOCK_BRAIN;
    assert.equal(getMockChatFn(), null);

    if (orig !== undefined) process.env.MOCK_BRAIN = orig;
  });
});
