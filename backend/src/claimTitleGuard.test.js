// claimTitleGuard — unit tests (node --test).
// Guards the 31-Oct-2026 incident: brain filed "model_raw_plan" (its own
// raw-plan test slug) as a MEDIUM finding, and "sql_injection_login"
// verified twice.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normaliseTitle,
  findPlanWrapperEcho,
  findVerifiedDuplicate,
  isProbeNameTitle,
  guardClaimTitle,
} from './claimTitleGuard.js';

const RAW_PLAN_TEXT =
  'model raw plan: ```json\n[\n  {\n    "test": "model_raw_plan",\n' +
  '    "command": "curl -s \'http://172.17.0.1:3100/login.php\' -d \'username=1 OR 1=1\'",\n' +
  '    "why": "Check if SQL injection can bypass authentication."\n  }\n]\n```';
const RAW_PLAN_HUMAN =
  'Test: model_raw_plan — Check if SQL injection can bypass authentication on the login form.';

const thinkingEvents = [
  { type: 'thinking', text: RAW_PLAN_TEXT, cachedAt: '2026-10-31T02:08:29.469Z' },
  { type: 'thinking', text: RAW_PLAN_HUMAN, cachedAt: '2026-10-31T02:08:29.574Z' },
];

const verifiedEvents = [
  {
    type: 'finding', title: 'sql_injection_login', severity: 'medium',
    verified: true, evidence: { request: 'curl login.php' },
  },
];

test('normaliseTitle collapses snake_case and spacing', () => {
  assert.equal(normaliseTitle('sql_injection_login'), 'sql injection login');
  assert.equal(normaliseTitle('  SQL-Injection__Login  '), 'sql injection login');
});

test('plan-wrapper echo: "model_raw_plan" bounced when it came from the raw plan', () => {
  const r = guardClaimTitle('model_raw_plan', thinkingEvents);
  assert.equal(r.ok, false);
  assert.equal(r.error, 'claim_title_is_plan_name');
  assert.match(r.message, /test-name from your own raw plan/);
});

test('plan-wrapper echo does NOT fire without a raw-plan dump in events', () => {
  const r = guardClaimTitle('model_raw_plan', []);
  assert.equal(r.ok, true);
});

test('genuine snake_case title passes when no raw plan mentions it', () => {
  const r = guardClaimTitle('sql_injection_login', thinkingEvents);
  assert.equal(r.ok, true);
});

test('duplicate verified title bounced', () => {
  const r = guardClaimTitle('sql_injection_login', verifiedEvents);
  assert.equal(r.ok, false);
  assert.equal(r.error, 'claim_duplicate');
  assert.match(r.message, /already a VERIFIED finding/);
});

test('duplicate check is normalisation-insensitive', () => {
  const r = guardClaimTitle('SQL Injection Login', verifiedEvents);
  assert.equal(r.ok, false);
  assert.equal(r.error, 'claim_duplicate');
});

test('unverified claim with same title does NOT bounce (still under review)', () => {
  const ev = [{ type: 'finding', title: 'sql_injection_login', verified: false }];
  assert.equal(guardClaimTitle('sql_injection_login', ev).ok, true);
});

test('new genuine title passes', () => {
  const ev = thinkingEvents.concat(verifiedEvents);
  const r = guardClaimTitle('Reflected XSS in search field', ev);
  assert.equal(r.ok, true);
});

test('plan echo still fires for a never-verified plan slug alongside a verified one', () => {
  const ev = thinkingEvents.concat(verifiedEvents);
  const r = guardClaimTitle('model_raw_plan', ev);
  assert.equal(r.ok, false);
  assert.equal(r.error, 'claim_title_is_plan_name');
});

test('INCIDENT EXACT: verified plan-slug claim gets the duplicate diagnosis, not the echo one', () => {
  // The real hunt verified "model_raw_plan" as MEDIUM — a re-file must be
  // told "already verified", not "that is your plan label".
  const ev = thinkingEvents.concat([
    { type: 'finding', title: 'model_raw_plan', severity: 'medium', verified: true },
  ]);
  const r = guardClaimTitle('model_raw_plan', ev);
  assert.equal(r.ok, false);
  assert.equal(r.error, 'claim_duplicate');
  assert.match(r.message, /already a VERIFIED finding/);
});

test('INCIDENT EXACT: re-filed verified vuln title gets duplicate diagnosis even when it echoes a raw plan', () => {
  // "sql_injection_login" appears as a test-name in the brain's raw plans
  // AND is verified twice on the hunt — the duplicate reason is the
  // accurate, actionable one.
  const rawPlanWithSlug = thinkingEvents.concat([
    { type: 'thinking', text: 'model raw plan: ```json\n[{"test": "sql_injection_login", "command": "curl login.php"}]\n```' },
  ]);
  const r = guardClaimTitle('sql_injection_login', rawPlanWithSlug.concat(verifiedEvents));
  assert.equal(r.ok, false);
  assert.equal(r.error, 'claim_duplicate');
});

// P0 (31 Oct 2026): probe/test names must never become verified findings.
// Regression tests for the h_6e909d3c1965 incident where probe_session_handling,
// probe_username_handling, probe_special_chars_login, and probe_php_session
// were stamped verified:true and counted as MEDIUM vulnerabilities.

test('isProbeNameTitle: detects probe_ prefix', () => {
  assert.equal(isProbeNameTitle('probe_session_handling'), true);
  assert.equal(isProbeNameTitle('probe_username_handling'), true);
  assert.equal(isProbeNameTitle('probe_special_chars_login'), true);
  assert.equal(isProbeNameTitle('probe_php_session'), true);
  assert.equal(isProbeNameTitle('PROBE_SESSION_HANDLING'), true);
});

test('isProbeNameTitle: detects _probe_ and _test patterns', () => {
  assert.equal(isProbeNameTitle('session_probe_test'), true);
  assert.equal(isProbeNameTitle('login_test'), true);
  assert.equal(isProbeNameTitle('test_sql_injection'), true);
});

test('isProbeNameTitle: allows genuine vulnerability titles', () => {
  assert.equal(isProbeNameTitle('sql_injection_login'), false);
  assert.equal(isProbeNameTitle('Reflected XSS'), false);
  assert.equal(isProbeNameTitle('Command Injection'), false);
  assert.equal(isProbeNameTitle('SQL injection in login form'), false);
  assert.equal(isProbeNameTitle(''), false);
});

test('guardClaimTitle: bounces probe-name titles', () => {
  for (const t of ['probe_session_handling', 'probe_username_handling', 'probe_special_chars_login', 'probe_php_session']) {
    const r = guardClaimTitle(t, []);
    assert.equal(r.ok, false, t);
    assert.equal(r.error, 'claim_title_is_probe_name', t);
  }
});

test('guardClaimTitle: probe-name check runs after duplicate and plan-echo', () => {
  // A probe name that is ALSO a duplicate gets the duplicate error (more accurate)
  const verifiedEvents = [{ type: 'finding', title: 'probe_session_handling', verified: true }];
  const r = guardClaimTitle('probe_session_handling', verifiedEvents);
  assert.equal(r.ok, false);
  assert.equal(r.error, 'claim_duplicate');
});
