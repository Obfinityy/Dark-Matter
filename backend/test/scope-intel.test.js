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

test('scope-intel requires exact hosts unless wildcard is explicit', () => {
  const scope = { inScope: ['api.example.com', '*.cdn.example.com'] };
  assert.equal(isInScope('api.example.com', scope), true);
  assert.equal(isInScope('nested.api.example.com', scope), false);
  assert.equal(isInScope('cdn.example.com', scope), false);
  assert.equal(isInScope('img.cdn.example.com', scope), true);
});
