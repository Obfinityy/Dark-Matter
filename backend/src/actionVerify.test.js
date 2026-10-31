// Tests for actionVerify.js — Mission Stage 2: explicit action verification.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseExpectation, verifyExpectation } from './actionVerify.js';

test('parseExpectation: splits clauses and types them', () => {
  const cs = parseExpectation('url contains /dashboard; text contains Welcome');
  assert.equal(cs.length, 2);
  assert.equal(cs[0].type, 'url_contains');
  assert.equal(cs[0].arg, '/dashboard');
  assert.equal(cs[1].type, 'text_contains');
  assert.equal(cs[1].arg, 'Welcome');
});

test('parseExpectation: bare text defaults to text_contains', () => {
  const cs = parseExpectation('dashboard loaded');
  assert.equal(cs.length, 1);
  assert.equal(cs[0].type, 'text_contains');
  assert.equal(cs[0].arg, 'dashboard loaded');
});

test('parseExpectation: strips quotes and is case-insensitive on prefix', () => {
  const cs = parseExpectation(`URL CONTAINS "/Login"`);
  assert.equal(cs[0].type, 'url_contains');
  assert.equal(cs[0].arg, '/Login');
});

test('parseExpectation: empty expectation yields no clauses', () => {
  assert.deepEqual(parseExpectation(''), []);
  assert.deepEqual(parseExpectation('  ;  '), []);
  assert.deepEqual(parseExpectation(null), []);
});

test('verifyExpectation: url_contains passes and fails', () => {
  const ok = verifyExpectation({ expect: 'url contains /dashboard', pageUrl: 'http://x/dashboard?y=1' });
  assert.equal(ok.checked, true);
  assert.equal(ok.verified, true);
  const bad = verifyExpectation({ expect: 'url contains /admin', pageUrl: 'http://x/dashboard' });
  assert.equal(bad.checked, true);
  assert.equal(bad.verified, false);
  assert.match(bad.evidence, /url contains \/admin/);
});

test('verifyExpectation: url_is normalises trailing slash and case', () => {
  const ok = verifyExpectation({ expect: 'url is HTTP://X/Login/', pageUrl: 'http://x/login' });
  assert.equal(ok.verified, true);
});

test('verifyExpectation: text_contains checks observation text', () => {
  const ok = verifyExpectation({ expect: 'text contains Welcome, admin', observation: 'Page says: welcome, ADMIN panel' });
  assert.equal(ok.verified, true);
  const bad = verifyExpectation({ expect: 'text contains goodbye', observation: 'Page says: welcome' });
  assert.equal(bad.verified, false);
});

test('verifyExpectation: text_absent and url_not', () => {
  const ok = verifyExpectation({ expect: 'text absent error; url not /login', observation: 'all good', pageUrl: 'http://x/home' });
  assert.equal(ok.verified, true);
  const bad = verifyExpectation({ expect: 'text absent error', observation: 'Error: bad request' });
  assert.equal(bad.verified, false);
});

test('verifyExpectation: multiple clauses all must pass', () => {
  const r = verifyExpectation({
    expect: 'url contains /dashboard; text contains welcome; text absent error',
    pageUrl: 'http://x/dashboard',
    observation: 'welcome back, no issues',
  });
  assert.equal(r.verified, true);
  assert.equal(r.checks.length, 3);
});

test('verifyExpectation: no expectation means not checked', () => {
  const r = verifyExpectation({ observation: 'anything' });
  assert.equal(r.checked, false);
});

test('verifyExpectation: never throws on garbage input', () => {
  const r = verifyExpectation({ expect: ';;', observation: null, pageUrl: undefined });
  assert.equal(r.checked, false);
  const r2 = verifyExpectation(null);
  assert.equal(r2.checked, false);
});
