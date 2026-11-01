import test from 'node:test';
import assert from 'node:assert/strict';
import { isInScope } from '../src/hunt-intel/scopeIntel.js';

test('hunt-intel scope gate handles bare hosts, wildcard assets, and path boundaries', () => {
  const scope = { inScope: ['*.example.com/api'], outOfScope: ['admin.example.com'] };
  assert.equal(isInScope('api.example.com/api/users', scope), true);
  assert.equal(isInScope('api.example.com/apix', scope), false);
  assert.equal(isInScope('api.example.com', scope), false);
  assert.equal(isInScope('https://example.com.attacker.test/api', scope), false);
  assert.equal(isInScope('https://admin.example.com/api', scope), false);
  assert.equal(isInScope('api.example.com/api', null), false);
});
