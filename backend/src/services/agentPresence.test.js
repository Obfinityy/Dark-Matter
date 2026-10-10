/**
 * agentPresence.test.js — the heartbeat registry behind
 * GET /api/v1/agent/status.
 *
 *  - a fresh heartbeat → connected, with runner + timestamp;
 *  - unknown user → not connected, null timestamp;
 *  - stale heartbeat (older than HEARTBEAT_TTL_MS) → not connected, but the
 *    last-seen timestamp is preserved for the UI.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  HEARTBEAT_TTL_MS,
  recordHeartbeat,
  getAgentPresence,
  clearAgentPresence,
} from './agentPresence.js';

describe('agentPresence', () => {
  test('fresh heartbeat → connected with runner and timestamp', () => {
    const userId = `u_${Date.now()}_a`;
    const record = recordHeartbeat(userId, { pollerId: 'oracle-vm-1', runner: 'oracle' });
    assert.ok(record.lastHeartbeatAt);
    const presence = getAgentPresence(userId);
    assert.equal(presence.connected, true);
    assert.equal(presence.runner, 'oracle');
    assert.equal(presence.lastHeartbeatAt, record.lastHeartbeatAt);
    clearAgentPresence(userId);
  });

  test('unknown user → not connected, nulls', () => {
    const presence = getAgentPresence(`u_${Date.now()}_nobody`);
    assert.equal(presence.connected, false);
    assert.equal(presence.lastHeartbeatAt, null);
    assert.equal(presence.runner, null);
  });

  test('stale heartbeat → not connected, last-seen preserved', () => {
    const userId = `u_${Date.now()}_stale`;
    const record = recordHeartbeat(userId, { pollerId: 'p1', runner: 'local' });
    const presence = getAgentPresence(userId, Date.now() + HEARTBEAT_TTL_MS + 1000);
    assert.equal(presence.connected, false);
    assert.equal(presence.lastHeartbeatAt, record.lastHeartbeatAt);
    assert.equal(presence.runner, null);
    clearAgentPresence(userId);
  });

  test('unknown runner value normalizes to null', () => {
    const userId = `u_${Date.now()}_r`;
    recordHeartbeat(userId, { pollerId: 'p1', runner: 'mars' });
    const presence = getAgentPresence(userId);
    assert.equal(presence.connected, true);
    assert.equal(presence.runner, null);
    clearAgentPresence(userId);
  });

  test('recordHeartbeat requires a userId', () => {
    assert.throws(() => recordHeartbeat(null), /requires a userId/);
  });
});
