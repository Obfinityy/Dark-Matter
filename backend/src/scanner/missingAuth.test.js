// Missing authentication for critical function (#47 [Critical],
// phase 86) — probeMissingAuth unit tests.
//
// The gate is a strict 4-conjunct: (1) direct 200 only, (2) not the
// SPA catch-all, (3) authenticated-content marker AND no login form,
// (4) HTML/JSON content-type. Fixture letters (a)–(v) follow the
// lane prep file.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  probeMissingAuth,
  candidateUrls,
  isSensitiveCandidate,
  SENSITIVE_FUNCTION_SEGMENTS,
  FIXED_FUNCTION_PATHS,
} from './probes/missingAuth.js';
import { assessConfirmation } from '../hunt-intel/differential.js';
import { verifyFindings } from './verifier.js';

const PAGE = 'http://example.com/';

const html = (body, ct = 'text/html') => ({ status: 200, headers: { 'content-type': ct }, body });
const json = (body) => ({ status: 200, headers: { 'content-type': 'application/json' }, body });

// Stub fetchPage: exact-URL response map; anything unmapped is a 404.
// The random catch-all baseline path (dm-spa-check-*) returns
// `baseline` (default 404 = not a catch-all). Records every call.
function stubFetch(responses, baseline = { status: 404, headers: {}, body: '' }) {
  const calls = [];
  const fetchPage = async (url) => {
    calls.push(String(url));
    const u = String(url);
    if (u.includes('dm-spa-check-')) return baseline;
    if (Object.prototype.hasOwnProperty.call(responses, u)) {
      const r = responses[u];
      if (r instanceof Error) throw r;
      return r;
    }
    return { status: 404, headers: {}, body: '' };
  };
  return { fetchPage, calls };
}

const ADMIN_DASHBOARD_HTML = `<html><head><title>Admin</title></head><body>
<nav><a href="/logout">Log out</a></nav>
<h1>Admin Dashboard</h1><p>Welcome, administrator.</p>
</body></html>`;

const SETTINGS_HTML = `<html><body>
<nav><a href="/logout">Log out</a></nav>
<form action="/manage/settings/save" method="post">
<input name="site_name" value="Shop"><button>Save Settings</button>
</form></body></html>`;

const USER_RECORDS_JSON = JSON.stringify([
  { id: 1, username: 'alice', email: 'alice@example.com', role: 'admin' },
  { id: 2, username: 'bob', email: 'bob@example.com', role: 'user' },
]);

const LOGIN_HTML = `<html><body>
<h1>Sign in to continue</h1>
<form action="/login" method="post">
<input name="username"><input type="password" name="password">
<button>Sign in</button></form>
<a href="/logout">Log out</a>
</body></html>`;

describe('missingAuth candidate inventory', () => {
  it('exports the predefined sensitive segments and fixed paths', () => {
    // Prep says "20" but enumerates 21 segments — the enumerated list
    // governs; the count in the prep is off by one (see lane report).
    assert.equal(SENSITIVE_FUNCTION_SEGMENTS.length, 21);
    assert.equal(FIXED_FUNCTION_PATHS.length, 12);
    for (const s of ['admin', 'manage', 'console', 'setup', 'backup', 'debug', 'actuator', 'wp-admin']) {
      assert.ok(SENSITIVE_FUNCTION_SEGMENTS.includes(s), `${s} must be a sensitive segment`);
    }
  });

  it('isSensitiveCandidate matches any segment, case-insensitively, ignoring query strings', () => {
    assert.equal(isSensitiveCandidate('http://example.com/api/admin/users'), true);
    assert.equal(isSensitiveCandidate('http://example.com/Admin'), true);
    assert.equal(isSensitiveCandidate('http://example.com/ADMIN'), true);
    assert.equal(isSensitiveCandidate('http://example.com/admin?x=1'), true);
    assert.equal(isSensitiveCandidate('http://example.com/manage/settings'), true);
    assert.equal(isSensitiveCandidate('http://example.com/rest/products'), false);
    assert.equal(isSensitiveCandidate('http://example.com/api-docs'), false);
    assert.equal(isSensitiveCandidate('http://example.com/'), false);
    assert.equal(isSensitiveCandidate('not a url'), false);
  });

  it('candidateUrls: discovered first, then fixed, deduped, capped at 12', () => {
    const targets = [
      'http://example.com/rest/products',
      'http://example.com/admin',
      'http://example.com/admin',
      'http://example.com/admin/',
      'http://example.com/api-docs',
      'http://example.com/manage/settings',
    ];
    const urls = candidateUrls(PAGE, targets);
    assert.equal(urls[0], 'http://example.com/admin');
    assert.equal(urls[1], 'http://example.com/manage/settings');
    assert.equal(urls.filter((u) => u === 'http://example.com/admin').length, 1);
    assert.ok(!urls.some((u) => u.includes('rest/products')), 'non-sensitive targets are not candidates');
    assert.ok(!urls.some((u) => u.includes('api-docs')), 'public docs are not candidates');
    assert.equal(urls.length, 12);
    assert.ok(urls.includes('http://example.com/console'), 'fixed list fills the rest');
  });

  it('candidateUrls: 15 discovered candidates -> only the first 12', () => {
    const targets = [
      'admin', 'manage', 'console', 'setup', 'install', 'config', 'backup',
      'debug', 'dashboard', 'private', 'internal', 'staff', 'manager',
      'administrator', 'actuator',
    ].map((s) => `http://example.com/${s}`);
    assert.equal(candidateUrls(PAGE, targets).length, 12);
  });

  it('candidateUrls: invalid page URL -> []', () => {
    assert.deepEqual(candidateUrls('not a url', ['http://example.com/admin']), []);
    assert.deepEqual(candidateUrls('', []), []);
  });
});

describe('missingAuth firing gate — positives', () => {
  it('(a) discovered /api/admin/users returns 200 JSON user records with role fields -> fires Critical', async () => {
    const { fetchPage } = stubFetch({
      'http://example.com/api/admin/users': json(USER_RECORDS_JSON),
    });
    const findings = await probeMissingAuth(PAGE, ['http://example.com/api/admin/users'], { fetchPage });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].class, 'missing_auth');
    assert.equal(findings[0].severity, 'critical');
    assert.equal(findings[0].url, 'http://example.com/api/admin/users');
    assert.match(findings[0].title, /\/api\/admin\/users/);
    assert.equal(findings[0].evidence.signalCorrelated, true);
    assert.match(findings[0].evidence.response, /user records with role fields/);
  });

  it('(b) fixed /admin returns 200 HTML with logout link + "Admin Dashboard" -> fires', async () => {
    const { fetchPage } = stubFetch({ 'http://example.com/admin': html(ADMIN_DASHBOARD_HTML) });
    const findings = await probeMissingAuth(PAGE, [], { fetchPage });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, 'critical');
    assert.match(findings[0].title, /\/admin/);
  });

  it('(c) /manage/settings returns 200 HTML with a settings form + logout link -> fires', async () => {
    const { fetchPage } = stubFetch({ 'http://example.com/manage/settings': html(SETTINGS_HTML) });
    const findings = await probeMissingAuth(PAGE, ['http://example.com/manage/settings'], { fetchPage });
    assert.equal(findings.length, 1);
    // Either marker proves the gate: the body carries both a logout link
    // and a settings form; the probe reports the first matching marker.
    assert.match(findings[0].evidence.response, /logout\/sign-out link|settings\/admin form/);
  });

  it('(d) /console returns 200 JSON with user-management records -> fires', async () => {
    const { fetchPage } = stubFetch({
      'http://example.com/console': json(JSON.stringify({ users: [{ id: 7, name: 'root', role: 'admin' }] })),
    });
    const findings = await probeMissingAuth(PAGE, ['http://example.com/console'], { fetchPage });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].class, 'missing_auth');
  });

  it('(e) dedup: same candidate URL listed twice (discovered + fixed) -> exactly 1 finding, 1 request', async () => {
    const { fetchPage, calls } = stubFetch({ 'http://example.com/admin': html(ADMIN_DASHBOARD_HTML) });
    const findings = await probeMissingAuth(
      PAGE,
      ['http://example.com/admin', 'http://example.com/admin', 'http://example.com/admin/'],
      { fetchPage }
    );
    assert.equal(findings.length, 1);
    assert.equal(calls.filter((u) => u === 'http://example.com/admin').length, 1);
  });

  it('(f) cap: 4 firing candidates -> max 3 findings', async () => {
    const { fetchPage } = stubFetch({
      'http://example.com/admin': html(ADMIN_DASHBOARD_HTML),
      'http://example.com/manage': html(ADMIN_DASHBOARD_HTML),
      'http://example.com/console': html(ADMIN_DASHBOARD_HTML),
      'http://example.com/setup': html(ADMIN_DASHBOARD_HTML),
    });
    const findings = await probeMissingAuth(PAGE, [], { fetchPage });
    assert.equal(findings.length, 3);
  });

  it('(g) verifyFindings + assessConfirmation: probe finding returns confirmed on the default protocol', async () => {
    const { fetchPage } = stubFetch({ 'http://example.com/admin': html(ADMIN_DASHBOARD_HTML) });
    const findings = await probeMissingAuth(PAGE, [], { fetchPage });
    assert.equal(findings.length, 1);
    const r = assessConfirmation(findings[0]);
    assert.equal(r.verdict, 'confirmed');
    // Default protocol (not auth_bypass): judged on signalCorrelated.
    assert.match(r.protocol, /Repeat the probe with a benign control input/);
    const verified = verifyFindings(findings);
    assert.equal(verified.confirmed.length, 1);
    assert.equal(verified.confirmed[0].confirmation, 'confirmed');
    assert.equal(verified.unconfirmed.length, 0);
  });

  it('(p) segment match is case-insensitive: /Admin with auth markers -> fires', async () => {
    const { fetchPage } = stubFetch({ 'http://example.com/Admin': html(ADMIN_DASHBOARD_HTML) });
    const findings = await probeMissingAuth(PAGE, ['http://example.com/Admin'], { fetchPage });
    assert.equal(findings.length, 1);
    assert.match(findings[0].title, /\/Admin/);
  });

  it('(q) query strings ignored for matching: /admin?x=1 is a candidate and fires', async () => {
    const { fetchPage } = stubFetch({ 'http://example.com/admin?x=1': html(ADMIN_DASHBOARD_HTML) });
    const findings = await probeMissingAuth(PAGE, ['http://example.com/admin?x=1'], { fetchPage });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].url, 'http://example.com/admin?x=1');
  });
});

describe('missingAuth firing gate — negatives', () => {
  it('(h) 302 redirect to /login.php -> no fire', async () => {
    const { fetchPage } = stubFetch({
      'http://example.com/admin': { status: 302, headers: { location: '/login.php' }, body: '' },
    });
    assert.deepEqual(await probeMissingAuth(PAGE, [], { fetchPage }), []);
  });

  it('(i) 401 -> no fire', async () => {
    const { fetchPage } = stubFetch({
      'http://example.com/admin': { status: 401, headers: {}, body: 'Unauthorized' },
    });
    assert.deepEqual(await probeMissingAuth(PAGE, [], { fetchPage }), []);
  });

  it('(j) 403 -> no fire', async () => {
    const { fetchPage } = stubFetch({
      'http://example.com/admin': { status: 403, headers: {}, body: 'Forbidden' },
    });
    assert.deepEqual(await probeMissingAuth(PAGE, [], { fetchPage }), []);
  });

  it('(k) 200 login page (password input + "Sign in") -> no fire even with a logout link present', async () => {
    const { fetchPage } = stubFetch({ 'http://example.com/admin': html(LOGIN_HTML) });
    assert.deepEqual(await probeMissingAuth(PAGE, [], { fetchPage }), []);
  });

  it('(k2) "sign in to continue" text vetoes a 200 with admin markers', async () => {
    const body = `<html><body><h1>Admin Dashboard</h1><p>Please sign in to continue.</p></body></html>`;
    const { fetchPage } = stubFetch({ 'http://example.com/admin': html(body) });
    assert.deepEqual(await probeMissingAuth(PAGE, [], { fetchPage }), []);
  });

  it('(l) 200 SPA catch-all (random path also 200, near-identical body) -> no fire', async () => {
    const { fetchPage } = stubFetch(
      { 'http://example.com/admin': html(ADMIN_DASHBOARD_HTML) },
      html(ADMIN_DASHBOARD_HTML)
    );
    assert.deepEqual(await probeMissingAuth(PAGE, [], { fetchPage }), []);
  });

  it('(m) 200 public page under /admin with only version text, no auth markers -> no fire', async () => {
    const body = `<html><body><h1>Admin API</h1><p>version 2.4.1</p><p>Public documentation.</p></body></html>`;
    const { fetchPage } = stubFetch({ 'http://example.com/admin': html(body) });
    assert.deepEqual(await probeMissingAuth(PAGE, [], { fetchPage }), []);
  });

  it('(n) public docs page (/api-docs) -> not a candidate, never requested', async () => {
    const { fetchPage, calls } = stubFetch({});
    await probeMissingAuth(PAGE, ['http://example.com/api-docs'], { fetchPage });
    assert.ok(!calls.some((u) => u.includes('api-docs')), 'api-docs must never be requested');
  });

  it('(o) discovered /rest/products (no sensitive segment) -> not a candidate, never requested', async () => {
    const { fetchPage, calls } = stubFetch({});
    await probeMissingAuth(PAGE, ['http://example.com/rest/products'], { fetchPage });
    assert.ok(!calls.some((u) => u.includes('rest/products')), 'non-sensitive targets must never be requested');
  });

  it('(r) non-HTML/JSON content-type (image bytes) -> no fire even with marker-like body', async () => {
    const { fetchPage } = stubFetch({
      'http://example.com/admin': { status: 200, headers: { 'content-type': 'image/png' }, body: 'Admin Dashboard logout' },
    });
    assert.deepEqual(await probeMissingAuth(PAGE, [], { fetchPage }), []);
  });

  it('(r2) application/javascript content-type -> no fire', async () => {
    const { fetchPage } = stubFetch({
      'http://example.com/admin': html('Admin Dashboard logout', 'application/javascript'),
    });
    assert.deepEqual(await probeMissingAuth(PAGE, [], { fetchPage }), []);
  });

  it('(s) candidate cap: 15 candidates -> only the first 12 requested (plus 1 baseline)', async () => {
    const targets = [
      'admin', 'manage', 'console', 'setup', 'install', 'config', 'backup',
      'debug', 'dashboard', 'private', 'internal', 'staff', 'manager',
      'administrator', 'actuator',
    ].map((s) => `http://example.com/${s}`);
    const { fetchPage, calls } = stubFetch({});
    await probeMissingAuth(PAGE, targets, { fetchPage });
    const candidateCalls = calls.filter((u) => !u.includes('dm-spa-check-'));
    assert.equal(candidateCalls.length, 12);
    assert.equal(calls.length, 13);
  });

  it('(t) network error on one candidate -> skipped gracefully, other candidates still checked', async () => {
    const { fetchPage } = stubFetch({
      'http://example.com/admin': new Error('ECONNREFUSED'),
      'http://example.com/manage': html(ADMIN_DASHBOARD_HTML),
    });
    const findings = await probeMissingAuth(PAGE, [], { fetchPage });
    assert.equal(findings.length, 1);
    assert.match(findings[0].title, /\/manage/);
  });

  it('(t2) every fetch throws -> returns [] without throwing (phase stays ok:true)', async () => {
    const fetchPage = async () => {
      throw new Error('network down');
    };
    assert.deepEqual(await probeMissingAuth(PAGE, ['http://example.com/admin'], { fetchPage }), []);
  });

  it('(u) empty scanTargets -> phase still runs (fixed list requested), 0 findings on 404s', async () => {
    const { fetchPage, calls } = stubFetch({});
    const findings = await probeMissingAuth(PAGE, [], { fetchPage });
    assert.deepEqual(findings, []);
    assert.ok(calls.includes('http://example.com/admin'), 'fixed list must be requested even with no targets');
  });

  it('(v) bare word "dashboard" alone in body, no logout link, no admin content -> no fire', async () => {
    const body = `<html><body><p>Welcome to the dashboard</p></body></html>`;
    const { fetchPage } = stubFetch({ 'http://example.com/admin': html(body) });
    assert.deepEqual(await probeMissingAuth(PAGE, [], { fetchPage }), []);
  });

  it('invalid page URL -> []', async () => {
    const { fetchPage } = stubFetch({});
    assert.deepEqual(await probeMissingAuth('', [], { fetchPage }), []);
    assert.deepEqual(await probeMissingAuth('not a url', [], { fetchPage }), []);
  });

  it('finding shape: id, title, severity, url, evidence request/response/impact_demo, signalCorrelated', async () => {
    const { fetchPage } = stubFetch({ 'http://example.com/admin': html(ADMIN_DASHBOARD_HTML) });
    const [f] = await probeMissingAuth(PAGE, [], { fetchPage });
    assert.equal(f.id, 'missing-auth-admin');
    assert.equal(f.title, 'Critical function reachable without authentication — /admin');
    assert.equal(f.severity, 'critical');
    assert.equal(f.url, 'http://example.com/admin');
    assert.match(f.evidence.request, /^GET http:\/\/example\.com\/admin/);
    assert.match(f.evidence.response, /HTTP 200/);
    assert.match(f.evidence.response, /Admin Dashboard/);
    assert.match(f.evidence.impact_demo, /CWE-306/);
    assert.equal(f.evidence.signalCorrelated, true);
  });
});
