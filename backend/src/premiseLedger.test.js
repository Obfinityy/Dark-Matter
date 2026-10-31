/**
 * premiseLedger.test.js — R-05 integration: getPremiseLedger groups
 * reworded failures into one premise death, writes the retirement audit
 * row exactly once, and never retires a whole class.
 *
 * Uses a tmp DATA_DIR (set before import), no network, no Meta.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'premise-ledger-'));
process.env.DATA_DIR = tmpRoot;

const { recordReasoning, getPremiseLedger } = await import('./reasoningMemory.js');

function seed(huntId, rows) {
  fs.mkdirSync(path.join(tmpRoot, 'hunts', huntId), { recursive: true });
  for (const r of rows) recordReasoning(huntId, r);
}

// The exact live rewordings from h_6e909d3c1965 (iters 51–81) — each a
// different string, all the same (sqli|login) premise.
const REWORDINGS = [
  ['Login endpoint may be vulnerable to SQL injection', 'SQLi authentication bypass on login'],
  ['If the query is not properly sanitized, an SQL error will be thrown, indicating', 'sql_injection_login'],
  ['An SQL injection that allows bypassing authentication by manipulating the login', 'sql_injection_login'],
  ['If the query is not properly sanitized, the authentication will be bypassed.', 'sql_injection_login'],
  ['Verify if SQL injection can bypass authentication on the login form by sending a', 'SQLi authentication bypass on login'],
  ['Check if the login form accepts SQLi on the username field.', 'model_raw_plan'],
];

test('reworded failures accumulate: premise dies at the toll', () => {
  const hid = 'premise-death';
  seed(hid, REWORDINGS.slice(0, 5).map(([hypothesis, action]) => ({
    hypothesis, action, result: 'no assessment',
  })));
  const { dead, verified } = getPremiseLedger(hid);
  assert.equal(dead.length, 1, `expected exactly one dead premise, got ${dead.map((d) => d.key)}`);
  assert.equal(dead[0].key, 'sqli|login');
  assert.equal(dead[0].failed, 5);
  assert.equal(dead[0].retired, false, 'no retirement marker written by the ledger itself');
  assert.equal(verified.length, 0);
});

test('below the toll the premise stays alive', () => {
  const hid = 'premise-alive';
  seed(hid, REWORDINGS.slice(0, 4).map(([hypothesis, action]) => ({
    hypothesis, action, result: 'no assessment',
  })));
  const { dead } = getPremiseLedger(hid);
  assert.equal(dead.length, 0);
});

test('a VERIFIED premise is never dead, however many failures', () => {
  const hid = 'premise-verified';
  seed(hid, [
    ...REWORDINGS.slice(0, 5).map(([hypothesis, action]) => ({ hypothesis, action, result: 'no assessment' })),
    { hypothesis: 'SQL injection on the login form', action: 'probe', result: 'VERIFIED: sql_injection_login' },
  ]);
  const { dead, verified } = getPremiseLedger(hid);
  assert.equal(dead.length, 0, 'verified premise must not be retired');
  assert.equal(verified.length, 1);
  assert.equal(verified[0].key, 'sqli|login');
});

test('retirement marker is recognized (write-once)', () => {
  const hid = 'premise-retired-marker';
  seed(hid, [
    ...REWORDINGS.slice(0, 5).map(([hypothesis, action]) => ({ hypothesis, action, result: 'no assessment' })),
    {
      hypothesis: 'premise sqli|login retired',
      action: 'hypothesis-retirement',
      why: 'premise:sqli|login reason:death-toll(5 failures across rewordings, 0 verified)',
      result: 'RETIRED: sqli|login — forced pivot to a genuinely new premise',
    },
  ]);
  const { dead } = getPremiseLedger(hid);
  assert.equal(dead.length, 1);
  assert.equal(dead[0].retired, true, 'existing marker must be detected so the filter writes it once');
  // The marker row itself must not feed the failure count (no feedback loop)
  assert.equal(dead[0].failed, 5);
});

test('class is never retired: sqli@search stays alive when sqli@login dies', () => {
  const hid = 'premise-class-safe';
  seed(hid, [
    ...REWORDINGS.slice(0, 5).map(([hypothesis, action]) => ({ hypothesis, action, result: 'no assessment' })),
    { hypothesis: 'SQL injection in the search box', action: 'sqli_search', result: 'no assessment' },
  ]);
  const { dead } = getPremiseLedger(hid);
  assert.equal(dead.length, 1);
  assert.equal(dead[0].key, 'sqli|login');
});
