// Boolean-based blind SQLi probe tests (coverage row #278 [High], CWE-89).
//
// Test-first: these tests were written before probeBooleanBlindSqli
// existed in sqliBlind.js and watched fail (missing export), then pass
// after implementation.
//
// Oracle (batch 4 fix plan): send TRUE/FALSE payload pairs per param
// (`1' AND 1=1-- -` vs `1' AND 1=2-- -`) and confirm ONLY when the
// TRUE variant's response differs from the FALSE variant's in the same
// direction across a repeat — TRUE returns the baseline page, FALSE
// changes it, and the repeat reproduces both. Volatile values (fresh
// CSRF tokens in hidden inputs) are stripped before the differential
// (oracleGuards.js, proof #18); a DB error on either leg belongs to
// the error-based probe, not this one.
import test from 'node:test';
import assert from 'node:assert/strict';
import { probeBooleanBlindSqli, booleanBlindConfirms } from './sqliBlind.js';

const realFetch = globalThis.fetch;
test.after(() => {
  globalThis.fetch = realFetch;
});

const TARGET = 'http://172.17.0.1:3000/product.php?id=1';
const LAB_TARGETS = 'http://172.17.0.1:3000';
const MYSQL_ERROR =
  "You have an error in your SQL syntax; check the manual that corresponds to your MySQL server version for the right syntax to use near ''' at line 1";

const hex32 = () => [...Array(32)].map(() => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
const page = (body) =>
  `<html><body><input type="hidden" name="user_token" value="${hex32()}"><p>${body}</p></body></html>`;

// Mock app modes:
// - vulnerable: TRUE == baseline page, FALSE changes it, repeat stable.
// - same: every variant returns the identical page.
// - flaky: round 1 diverges, round 2 FALSE returns the TRUE page.
// - error: the TRUE leg returns a DB error page.
// - volatile-only: TRUE and FALSE differ ONLY by the fresh hidden token.
function makeFetch(mode) {
  let round = 0;
  return async (url) => {
    const value = new URL(String(url)).searchParams.get('id') || '';
    if (mode === 'same') return { status: 200, text: async () => page('row 1') };
    if (mode === 'error') {
      if (value.includes('1=1')) return { status: 200, text: async () => MYSQL_ERROR };
      return { status: 200, text: async () => page('row 1') };
    }
    if (value.includes('1=2')) {
      round += 1;
      if (mode === 'flaky' && round > 1) return { status: 200, text: async () => page('row 1') };
      if (mode === 'volatile-only') return { status: 200, text: async () => page('row 1') };
      return { status: 200, text: async () => page('no rows') };
    }
    return { status: 200, text: async () => page('row 1') };
  };
}

test('B-0: the pure oracle decides all four differential cases', () => {
  const base = { baseline: 'row 1', trueBody: 'row 1', falseBody: 'no rows' };
  assert.equal(booleanBlindConfirms({ ...base, trueRepeat: 'row 1', falseRepeat: 'no rows' }), true);
  // FALSE does not change the page.
  assert.equal(booleanBlindConfirms({ ...base, falseBody: 'row 1', trueRepeat: 'row 1', falseRepeat: 'row 1' }), false);
  // TRUE does not return the baseline page.
  assert.equal(booleanBlindConfirms({ ...base, trueBody: 'other', trueRepeat: 'other', falseRepeat: 'no rows' }), false);
  // Repeat flips direction — not stable.
  assert.equal(booleanBlindConfirms({ ...base, trueRepeat: 'row 1', falseRepeat: 'row 1' }), false);
});

test('B-1: vulnerable app — one high finding', async () => {
  globalThis.fetch = makeFetch('vulnerable');
  const findings = await probeBooleanBlindSqli(TARGET, ['id'], { labTargets: LAB_TARGETS });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].class, 'sqli_boolean_blind');
  assert.equal(findings[0].severity, 'high');
  assert.equal(findings[0].evidence.booleanDiverges, true);
  assert.equal(findings[0].evidence.signalCorrelated, true);
  assert.match(findings[0].title, /Blind \(boolean-based\) SQL injection in parameter 'id'/);
});

test('B-2: TRUE and FALSE return the same page — no finding', async () => {
  globalThis.fetch = makeFetch('same');
  const findings = await probeBooleanBlindSqli(TARGET, ['id'], { labTargets: LAB_TARGETS });
  assert.equal(findings.length, 0);
});

test('B-3: repeat flips direction (flaky page) — no finding', async () => {
  globalThis.fetch = makeFetch('flaky');
  const findings = await probeBooleanBlindSqli(TARGET, ['id'], { labTargets: LAB_TARGETS });
  assert.equal(findings.length, 0, 'a direction that does not reproduce is not a channel');
});

test('B-4: DB error on the TRUE leg — the error probe owns it, no finding', async () => {
  globalThis.fetch = makeFetch('error');
  const findings = await probeBooleanBlindSqli(TARGET, ['id'], { labTargets: LAB_TARGETS });
  assert.equal(findings.length, 0);
});

test('B-5: TRUE/FALSE differ only by a fresh CSRF token — no finding', async () => {
  globalThis.fetch = makeFetch('volatile-only');
  const findings = await probeBooleanBlindSqli(TARGET, ['id'], { labTargets: LAB_TARGETS });
  assert.equal(findings.length, 0, 'volatile values must be stripped before the differential');
});

test('B-6: non-lab target — lab gate fires, zero requests sent', async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return { status: 200, text: async () => page('row 1') };
  };
  const findings = await probeBooleanBlindSqli('http://example.com/?id=1', ['id'], {});
  assert.equal(findings.length, 0);
  assert.equal(calls, 0, 'a non-lab target must receive no boolean-blind payload at all');
});
