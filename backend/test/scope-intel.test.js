import test from 'node:test';
import assert from 'node:assert/strict';
import { isInScope } from '../src/hunt-intel/scopeIntel.js';

test('hunt-intel scope gate rejects absent scope and hostname substring spoofing', () => {
  assert.equal(isInScope('https://anything.example', null), false);
  const scope = { inScope: ['example.com'], outOfScope: ['admin.example.com'] };
  assert.equal(isInScope('https://www.example.com', scope), true);
  assert.equal(isInScope('https://example.com.attacker.test', scope), false);
  assert.equal(isInScope('https://admin.example.com', scope), false);
});
