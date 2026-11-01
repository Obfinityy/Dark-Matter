import test from 'node:test';
import assert from 'node:assert/strict';
import { isInScope, isPrivateIP, parseScope, validateTargetSSRF, validateTargetAsync } from '../src/scopeParser.js';

test('scope gate honors explicitly enumerated assets', () => {
  const scope = parseScope('primary.example', 'In scope: primary.example, api.example.net, *.cdn.example.net\nOut of scope: staging.example.net');
  assert.equal(isInScope('https://api.example.net/v1', scope), true);
  assert.equal(isInScope('https://img.cdn.example.net/a.png', scope), true);
  assert.equal(isInScope('https://staging.example.net', scope), false);
  assert.equal(isInScope('https://unlisted.example.org', scope), false);
});

test('scope gate fails closed for missing scope, malformed input, and exclusions', () => {
  assert.equal(isInScope('https://example.com', null), false);
  const scope = parseScope('example.com', 'In scope: *.example.com\nOut of scope: admin.example.com');
  assert.equal(isInScope('not a valid URL %%', scope), false);
  assert.equal(isInScope('https://admin.example.com', scope), false);
  assert.equal(isInScope('https://sub.admin.example.com', scope), false);
});

test('SSRF validation rejects private IPv4, IPv6, credentials, and non-HTTP schemes', () => {
  for (const target of ['http://127.0.0.1', 'http://10.0.0.2', 'http://169.254.169.254', 'http://[::1]', 'http://[fd00::1]', 'http://[::ffff:127.0.0.1]', 'http://user:pass@example.com', 'file:///etc/passwd']) {
    assert.equal(validateTargetSSRF(target).valid, false, target);
  }
  assert.equal(validateTargetSSRF('https://example.com').valid, true);
});

test('private IP detection validates IPv4 octets and IPv6 private ranges', () => {
  assert.equal(isPrivateIP('192.168.1.1'), true);
  assert.equal(isPrivateIP('172.32.0.1'), false);
  assert.equal(isPrivateIP('999.1.1.1'), false);
  assert.equal(isPrivateIP('::1'), true);
  assert.equal(isPrivateIP('::ffff:127.0.0.1'), true);
  assert.equal(isPrivateIP('::ffff:7f00:1'), true);
  assert.equal(isPrivateIP('2001:db8::1'), false);
});


test('DNS-aware SSRF validation blocks private literals before lookup', async () => {
  for (const target of ['http://127.0.0.1', 'http://[::1]', 'http://169.254.169.254', 'http://localhost']) {
    assert.equal((await validateTargetAsync(target)).valid, false, target);
  }
});

test('explicit host assets do not implicitly authorize nested subdomains', () => {
  const scope = parseScope('primary.example', 'In scope: api.example.net, *.cdn.example.net');
  assert.equal(isInScope('https://api.example.net', scope), true);
  assert.equal(isInScope('https://nested.api.example.net', scope), false);
  assert.equal(isInScope('https://cdn.example.net', scope), false);
  assert.equal(isInScope('https://img.cdn.example.net', scope), true);
  assert.equal(isInScope('https://nested.img.cdn.example.net', scope), true);
});
