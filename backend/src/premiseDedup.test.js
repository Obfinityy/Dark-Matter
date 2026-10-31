/**
 * premiseDedup.test.js — regression tests for audit R-05.
 *
 * Every hypothesis string below is verbatim (truncated to 90 chars where
 * noted) from the live hunt h_6e909d3c1965 reasoning.jsonl, iters 51–81,
 * 31 Oct 2026 — the exact re-circling patterns the text-keyed ledger
 * failed to catch. If any of these stop mapping to the same premise key,
 * the brain's rewording loop is back.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractPremise,
  premiseKey,
  premisesEquivalent,
  groupRowsByPremise,
  UNKNOWN_PREMISE_KEY,
} from './premiseDedup.js';

const SQLI_LOGIN_VARIANTS = [
  // verbatim live wordings (hypothesis | action)
  ['Login endpoint may be vulnerable to SQL injection', 'SQLi authentication bypass on login'],
  ['If the query is not properly sanitized, an SQL error will be thrown, indicating', 'sql_injection_login'],
  ['An SQL injection that allows bypassing authentication by manipulating the login', 'sql_injection_login'],
  ['If the query is not properly sanitized, the authentication will be bypassed.', 'sql_injection_login'],
  ['If the query is not properly sanitized, authentication will be bypassed.', 'sql_injection_login'],
  ['Verify if SQL injection can bypass authentication on the login form by sending a', 'SQLi authentication bypass on login'],
  ['Check if the login form accepts SQLi on the username field.', 'model_raw_plan'],
  ['The login form may accept SQLi on the username field, allowing a bypass of authe', 'SQLi authentication bypass on login'],
  ['If the query is not properly sanitized, an SQL error will be thrown, indicating', 'login_page_sql'],
];

const SESSION_VARIANTS = [
  ['If the session ID is not properly validated, an attacker can impersonate any use', 'manipulate_session'],
  ['Session IDs look predictable and may allow impersonation', 'manipulate_session'],
];

describe('premiseDedup — R-05 regression', () => {
  it('all live SQLi-login rewordings map to the same premise key', () => {
    const keys = new Set(
      SQLI_LOGIN_VARIANTS.map(([hypothesis, action]) =>
        premiseKey(extractPremise({ hypothesis, action }))),
    );
    assert.equal(keys.size, 1, `expected one premise key, got ${[...keys]}`);
    assert.equal([...keys][0], 'sqli|login');
  });

  it('all live session-probe rewordings map to the same premise key', () => {
    const keys = new Set(
      SESSION_VARIANTS.map(([hypothesis, action]) =>
        premiseKey(extractPremise({ hypothesis, action }))),
    );
    assert.equal(keys.size, 1);
    assert.equal([...keys][0], 'session|unknown');
  });

  it('premisesEquivalent: renamed labels, reordered args, different prose', () => {
    const a = { hypothesis: 'Login endpoint may be vulnerable to SQL injection', action: 'x', test: 'y' };
    const b = { test: 'Check if the login form accepts SQLi on the username field.', hypothesis: 'z', action: 'w' };
    assert.ok(premisesEquivalent(a, b), 'field order and wording must not matter');
  });

  it('does NOT suppress a whole class: sqli@login retired != sqli@search', () => {
    const loginProbe = { hypothesis: 'SQL injection on the login form', action: 'sql_injection_login' };
    const searchProbe = { hypothesis: 'SQL injection in the search parameter', action: 'sqli_search' };
    assert.ok(!premisesEquivalent(loginProbe, searchProbe), 'different sinks must stay distinct premises');
    assert.equal(premiseKey(extractPremise(searchProbe)), 'sqli|search');
  });

  it('does NOT conflate classes on the same sink', () => {
    const sqli = { hypothesis: 'SQL injection on login', action: 'a' };
    const xss = { hypothesis: 'Reflected XSS on the login form', action: 'b' };
    assert.ok(!premisesEquivalent(sqli, xss));
  });

  it('unknown|unknown never matches (falls back to text filters)', () => {
    const a = { hypothesis: '', action: '' };
    const b = { hypothesis: '   ', action: '' };
    assert.equal(premiseKey(extractPremise(a)), UNKNOWN_PREMISE_KEY);
    assert.ok(!premisesEquivalent(a, b));
    assert.ok(!premisesEquivalent(a, { hypothesis: 'SQL injection on login' }));
  });

  it('technique-first ordering: "SQLi authentication bypass" is sqli, not generic authbypass', () => {
    const p = extractPremise({ hypothesis: 'SQLi authentication bypass on login' });
    assert.equal(p.vulnClass, 'sqli');
  });

  it('groupRowsByPremise: reworded failures accumulate toward one toll', () => {
    const rows = [
      ...SQLI_LOGIN_VARIANTS.slice(0, 6).map(([hypothesis, action]) => ({
        hypothesis, action, result: 'no assessment',
      })),
    ];
    const grouped = groupRowsByPremise(rows);
    const entry = grouped.get('sqli|login');
    assert.ok(entry, 'sqli|login premise must exist');
    assert.equal(entry.failed, 6, 'all rewordings must count toward the same toll');
    assert.equal(entry.verified, 0);
  });

  it('groupRowsByPremise: skips hypothesis-retirement rows (no feedback loop)', () => {
    const rows = [
      { hypothesis: 'Login endpoint may be vulnerable to SQL injection', action: 'hypothesis-retirement', result: 'RETIRED: x' },
      { hypothesis: 'Login endpoint may be vulnerable to SQL injection', action: 'probe', result: 'no assessment' },
    ];
    const grouped = groupRowsByPremise(rows);
    assert.equal(grouped.get('sqli|login').failed, 1);
  });

  it('groupRowsByPremise: VERIFIED rows count as verified, not failed', () => {
    const rows = [
      { hypothesis: 'SQL injection on login', action: 'probe', result: 'VERIFIED: sql_injection_login' },
      { hypothesis: 'SQL injection on login page', action: 'probe', result: 'no assessment' },
    ];
    const grouped = groupRowsByPremise(rows);
    const e = grouped.get('sqli|login');
    assert.equal(e.verified, 1);
    assert.equal(e.failed, 1);
  });

  it('sink extracted from action slug when hypothesis names no sink', () => {
    const p = extractPremise({ hypothesis: 'If the query is not properly sanitized', action: 'sql_injection_login' });
    assert.equal(p.sink, 'login', 'action slug must ground the sink');
  });

  it('conservative unknown sink: (sqli, unknown) does not match (sqli, login)', () => {
    const a = { hypothesis: 'Blind SQL injection via timing', action: 'probe' };
    const b = { hypothesis: 'SQL injection on the login form', action: 'probe' };
    assert.ok(!premisesEquivalent(a, b));
  });
});
