/**
 * Tests for the agent permission-mode service (night-rebuild gap I44):
 * ask-every-time vs full-control, plus the middleware-friendly check
 * other workers use to decide whether to prompt before acting.
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  PERMISSION_MODES,
  isValidPermissionMode,
  getPermissionMode,
  setPermissionMode,
  requiresPrompt,
  _clearPermissionStore,
} from '../src/services/permissionService.js';

describe('permissionService', () => {
  beforeEach(() => {
    _clearPermissionStore();
  });

  it('exposes exactly the two contract modes', () => {
    assert.equal(PERMISSION_MODES.ASK, 'ask');
    assert.equal(PERMISSION_MODES.FULL, 'full');
    assert.ok(isValidPermissionMode('ask'));
    assert.ok(isValidPermissionMode('full'));
    assert.ok(!isValidPermissionMode('always'));
    assert.ok(!isValidPermissionMode(''));
    assert.ok(!isValidPermissionMode(undefined));
  });

  it('defaults to "ask" (safe) for unknown users', () => {
    assert.equal(getPermissionMode('user-123'), 'ask');
    assert.equal(getPermissionMode('nobody'), 'ask');
  });

  it('stores and returns a per-user mode', () => {
    setPermissionMode('user-1', 'full');
    setPermissionMode('user-2', 'ask');
    assert.equal(getPermissionMode('user-1'), 'full');
    assert.equal(getPermissionMode('user-2'), 'ask');
  });

  it('setPermissionMode returns the stored mode', () => {
    assert.equal(setPermissionMode('user-9', 'full'), 'full');
  });

  it('rejects invalid modes with a coded error', () => {
    assert.throws(() => setPermissionMode('user-1', 'always'), (err) => {
      assert.equal(err.code, 'INVALID_PERMISSION_MODE');
      return true;
    });
    assert.throws(() => setPermissionMode('user-1', ''), /Invalid permission mode/);
    // A rejected write must not clobber the previous value.
    setPermissionMode('user-1', 'full');
    assert.throws(() => setPermissionMode('user-1', 'bogus'));
    assert.equal(getPermissionMode('user-1'), 'full');
  });

  it('requiresPrompt follows the user mode (middleware-friendly check)', () => {
    assert.equal(requiresPrompt('user-1'), true, 'default ask → prompt');
    setPermissionMode('user-1', 'full');
    assert.equal(requiresPrompt('user-1'), false, 'full → no prompt');
    setPermissionMode('user-1', 'ask');
    assert.equal(requiresPrompt('user-1'), true, 'ask → prompt');
  });

  it('requiresPrompt accepts a future actionType without changing behavior', () => {
    setPermissionMode('user-1', 'full');
    assert.equal(requiresPrompt('user-1', 'tool'), false);
    assert.equal(requiresPrompt('user-1', 'system'), false);
    assert.equal(requiresPrompt('user-1', 'computer'), false);
    assert.equal(requiresPrompt('unknown-user', 'computer'), true);
  });

  it('user ids are isolated from each other', () => {
    setPermissionMode('alice', 'full');
    assert.equal(getPermissionMode('bob'), 'ask');
    assert.equal(requiresPrompt('bob'), true);
    assert.equal(requiresPrompt('alice'), false);
  });
});
