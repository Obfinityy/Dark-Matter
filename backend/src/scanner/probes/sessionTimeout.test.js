// Session-timeout + remember-me token probe tests (rows #259 [Medium]
// No Session Timeout, CWE-613, and #475 [High] Remember-me token
// flaws, CWE-384; phase 111, 'session-timeout').
//
// The probe logs in with the lab credentials, takes the token the
// server itself issues, decodes its exp claim (base64url, no key
// needed) and judges the session lifetime offline; the same login
// transaction is inspected for a remember-me token (JSON field /
// Set-Cookie). It confirms #259 ONLY on no exp claim or a lifetime
// over 7 days, and #475 ONLY on a predictable or permanent
// remember-me token. A sane finite session lifetime, a finite-expiry
// remember-me JWT, and an opaque long remember-me token are proven
// true negatives, never findings. The fake fetch below simulates a
// Juice-shaped lab: POST /rest/user/login returns
// {authentication: {token, bid, umail}}; the no-exp fixture mirrors
// the LIVE Juice token (payload keys [data, iat, status], verified
// first-hand 9 Nov 2026 — Juice issues a JWT with NO exp claim).
// All fixture values are clearly fake ('fake-...' /
// 'lab-user@example.com') — no real secret-shaped strings anywhere.
// NOW is the live iat observed on the EC2 Juice login (9 Nov 2026).

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  probeSessionTimeout,
  assessTokenExpiry,
  findRememberMeToken,
  assessRememberMeToken,
  __sessionTimeoutMeta,
} from './sessionTimeout.js';
import { assessConfirmation } from '../../hunt-intel/differential.js';

const PAGE_URL = 'http://172.17.0.1:3000/';
const LOGIN_URL = 'http://172.17.0.1:3000/rest/user/login';
const NOW = 1794229701;
const DAY = 24 * 3600;

const b64u = (objOrStr) =>
  Buffer.from(typeof objOrStr === 'string' ? objOrStr : JSON.stringify(objOrStr))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const makeToken = (payload, header = { alg: 'HS256', typ: 'JWT' }) =>
  `${b64u(header)}.${b64u(payload)}.fake-signature`;

// Live Juice shape: payload keys [data, iat, status] — NO exp claim.
const NOEXP_PAYLOAD = {
  status: 'success',
  data: { id: 1, email: 'lab-user@example.com', role: 'customer' },
  iat: NOW,
};
const ABSURD_PAYLOAD = { ...NOEXP_PAYLOAD, exp: NOW + 30 * DAY };
const SANE_PAYLOAD = { ...NOEXP_PAYLOAD, exp: NOW + 5 * 3600 };
const EXPIRED_PAYLOAD = { ...NOEXP_PAYLOAD, exp: NOW - 10 };
const NONNUM_PAYLOAD = { ...NOEXP_PAYLOAD, exp: 'soon' };
const RM_PERMANENT_TOKEN = makeToken({ sub: '1', role: 'customer' });
const RM_FINITE_TOKEN = makeToken({ sub: '1', exp: NOW + 30 * DAY });

function fakeFetch(loginBody, { status = 200, setCookies = [] } = {}) {
  return async (url, init = {}) => {
    const method = String(init.method || 'GET').toUpperCase();
    const u = String(url);
    if (u === LOGIN_URL && method === 'POST') {
      return {
        status,
        text: async () => JSON.stringify(loginBody),
        headers: {
          getSetCookie: () => setCookies,
          get: (n) =>
            String(n).toLowerCase() === 'set-cookie' ? setCookies.join(', ') : '',
        },
      };
    }
    return {
      status: 404,
      text: async () => JSON.stringify({ status: 'error' }),
      headers: {},
    };
  };
}

const loginBody = (payload, extraAuth = {}) => ({
  authentication: { token: makeToken(payload), bid: 1, umail: 'lab-user@example.com', ...extraAuth },
});

const baseOpts = (over = {}) => ({
  labCreds: { username: 'lab-user', password: 'lab-pass' },
  allowWrite: true,
  labTargets: ['172.17.0.1:3000'],
  apiRoutes: [LOGIN_URL],
  depth: 'standard',
  ...over,
});

// ---- pure: token expiry ------------------------------------------------------

test('ST-1: assessTokenExpiry confirms a token with no exp claim (never expires)', () => {
  const v = assessTokenExpiry(NOEXP_PAYLOAD, NOW);
  assert.equal(v.verdict, 'confirmed');
  assert.equal(v.kind, 'no-expiry');
  assert.equal(v.lifetimeSecs, null);
  assert.match(v.reason, /no exp claim/);
});

test('ST-2: assessTokenExpiry confirms an absurd 30-day lifetime', () => {
  const v = assessTokenExpiry(ABSURD_PAYLOAD, NOW);
  assert.equal(v.verdict, 'confirmed');
  assert.equal(v.kind, 'absurd-lifetime');
  assert.equal(v.lifetimeSecs, 30 * DAY);
  assert.match(v.reason, /2592000s/);
});

test('ST-3: assessTokenExpiry rejects a sane 5-hour lifetime (proven true negative)', () => {
  const v = assessTokenExpiry(SANE_PAYLOAD, NOW);
  assert.equal(v.verdict, 'rejected');
  assert.equal(v.kind, null);
  assert.equal(v.lifetimeSecs, 5 * 3600);
  assert.match(v.reason, /18000s/);
});

test('ST-4: assessTokenExpiry rejects an already-expired token (dead, not no-timeout)', () => {
  const v = assessTokenExpiry(EXPIRED_PAYLOAD, NOW);
  assert.equal(v.verdict, 'rejected');
  assert.equal(v.lifetimeSecs, -10);
});

test('ST-5: assessTokenExpiry is unconfirmed with no decodable token', () => {
  assert.equal(assessTokenExpiry(null, NOW).verdict, 'unconfirmed');
});

test('ST-6: assessTokenExpiry is unconfirmed with a non-numeric exp', () => {
  const v = assessTokenExpiry(NONNUM_PAYLOAD, NOW);
  assert.equal(v.verdict, 'unconfirmed');
  assert.match(v.reason, /not a numeric timestamp/);
});

test('ST-7: assessTokenExpiry uses exp-now when iat is missing', () => {
  const v = assessTokenExpiry({ exp: NOW + 3600 }, NOW);
  assert.equal(v.verdict, 'rejected');
  assert.equal(v.lifetimeSecs, 3600);
});

test('ST-8: assessTokenExpiry rejects exactly 7 days (boundary: over 7 days confirms)', () => {
  const v = assessTokenExpiry({ iat: NOW, exp: NOW + 7 * DAY }, NOW);
  assert.equal(v.verdict, 'rejected');
  assert.equal(v.lifetimeSecs, 7 * DAY);
});

test('ST-9: assessTokenExpiry confirms 7 days + 1 second', () => {
  const v = assessTokenExpiry({ iat: NOW, exp: NOW + 7 * DAY + 1 }, NOW);
  assert.equal(v.verdict, 'confirmed');
  assert.equal(v.kind, 'absurd-lifetime');
});

// ---- pure: remember-me surface mining ----------------------------------------

test('ST-10: findRememberMeToken finds a JSON remember-me field', () => {
  const found = findRememberMeToken(
    { authentication: { token: 'fake-session-token', rememberMeToken: 'abc123' } },
    []
  );
  assert.deepEqual(found, { source: 'json', field: 'rememberMeToken', value: 'abc123' });
});

test('ST-11: findRememberMeToken finds a nested JSON remember-me field', () => {
  const found = findRememberMeToken({ data: { remember_me: 'fake-remember-token-123456' } }, []);
  assert.deepEqual(found, {
    source: 'json',
    field: 'remember_me',
    value: 'fake-remember-token-123456',
  });
});

test('ST-12: findRememberMeToken finds a token inside a remember-keyed object', () => {
  const found = findRememberMeToken(
    { authentication: { rememberMe: { token: 'fake-remember-token-123456' } } },
    []
  );
  assert.deepEqual(found, {
    source: 'json',
    field: 'rememberMe.token',
    value: 'fake-remember-token-123456',
  });
});

test('ST-13: findRememberMeToken finds a Set-Cookie remember-me cookie', () => {
  const found = findRememberMeToken(
    { authentication: { token: 'fake-session-token' } },
    ['remember_me=fake-remember-token-123456; Path=/; HttpOnly']
  );
  assert.deepEqual(found, {
    source: 'cookie',
    field: 'remember_me',
    value: 'fake-remember-token-123456',
  });
});

test('ST-14: findRememberMeToken returns null for a flag only (boolean or flag word)', () => {
  assert.equal(findRememberMeToken({ rememberMe: true }, []), null);
  assert.equal(findRememberMeToken({ rememberMe: 'true' }, []), null);
  assert.equal(findRememberMeToken({ authentication: { rememberMe: false } }, []), null);
});

test('ST-15: findRememberMeToken returns null with no surface; the session token never matches', () => {
  assert.equal(
    findRememberMeToken({ authentication: { token: 'fake-session-token' } }, []),
    null
  );
  assert.equal(findRememberMeToken({ status: 'success' }, ['session=abc; Path=/']), null);
});

// ---- pure: remember-me judgement ----------------------------------------------

test('ST-16: assessRememberMeToken confirms a numeric-only token (predictable)', () => {
  const v = assessRememberMeToken('12345678901234567890', { username: 'lab-user' });
  assert.equal(v.verdict, 'confirmed');
  assert.equal(v.kind, 'predictable');
  assert.match(v.reason, /numeric-only/);
});

test('ST-17: assessRememberMeToken confirms a too-short token (predictable)', () => {
  const v = assessRememberMeToken('abc123', { username: 'lab-user' });
  assert.equal(v.verdict, 'confirmed');
  assert.equal(v.kind, 'predictable');
  assert.match(v.reason, /6 characters/);
});

test('ST-18: assessRememberMeToken confirms a token containing the username (predictable)', () => {
  const v = assessRememberMeToken('lab-user-9f3a2b', { username: 'lab-user' });
  assert.equal(v.verdict, 'confirmed');
  assert.equal(v.kind, 'predictable');
  assert.match(v.reason, /username/);
});

test('ST-19: assessRememberMeToken confirms a token that base64-decodes to the username', () => {
  const v = assessRememberMeToken(b64u('lab-user'), { username: 'lab-user' });
  assert.equal(v.verdict, 'confirmed');
  assert.equal(v.kind, 'predictable');
  assert.match(v.reason, /base64-decodes/);
});

test('ST-20: assessRememberMeToken confirms a permanent remember-me JWT (no exp)', () => {
  const v = assessRememberMeToken(RM_PERMANENT_TOKEN, { username: 'lab-user' });
  assert.equal(v.verdict, 'confirmed');
  assert.equal(v.kind, 'permanent');
  assert.match(v.reason, /no exp claim/);
});

test('ST-21: assessRememberMeToken rejects a remember-me JWT with a finite expiry', () => {
  const v = assessRememberMeToken(RM_FINITE_TOKEN, { username: 'lab-user' });
  assert.equal(v.verdict, 'rejected');
  assert.equal(v.kind, null);
});

test('ST-22: assessRememberMeToken rejects an opaque long token (no observable flaw)', () => {
  const v = assessRememberMeToken('fake-opaque-remember-token-value-123456', {
    username: 'lab-user',
  });
  assert.equal(v.verdict, 'rejected');
  assert.equal(v.kind, null);
});

test('ST-23: assessRememberMeToken rejects a value identical to the session token', () => {
  const session = makeToken(SANE_PAYLOAD);
  const v = assessRememberMeToken(session, { sessionToken: session, username: 'lab-user' });
  assert.equal(v.verdict, 'rejected');
  assert.equal(v.kind, 'same-as-session');
});

test('ST-24: assessRememberMeToken is unconfirmed with no token to judge', () => {
  assert.equal(assessRememberMeToken('', { username: 'lab-user' }).verdict, 'unconfirmed');
  assert.equal(assessRememberMeToken(null, { username: 'lab-user' }).verdict, 'unconfirmed');
});

// ---- probe: gates (all honest []) --------------------------------------------

test('ST-25: probe returns [] without labCreds', async () => {
  assert.deepEqual(
    await probeSessionTimeout(
      PAGE_URL,
      baseOpts({ labCreds: null, fetchFn: fakeFetch(loginBody(NOEXP_PAYLOAD)) })
    ),
    []
  );
});

test('ST-26: probe returns [] when allowWrite is not true', async () => {
  assert.deepEqual(
    await probeSessionTimeout(
      PAGE_URL,
      baseOpts({ allowWrite: false, fetchFn: fakeFetch(loginBody(NOEXP_PAYLOAD)) })
    ),
    []
  );
});

test('ST-27: probe returns [] on a non-lab target', async () => {
  assert.deepEqual(
    await probeSessionTimeout(
      PAGE_URL,
      baseOpts({ labTargets: ['10.0.0.1:3000'], fetchFn: fakeFetch(loginBody(NOEXP_PAYLOAD)) })
    ),
    []
  );
});

test('ST-28: probe returns [] on depth quick', async () => {
  assert.deepEqual(
    await probeSessionTimeout(
      PAGE_URL,
      baseOpts({ depth: 'quick', fetchFn: fakeFetch(loginBody(NOEXP_PAYLOAD)) })
    ),
    []
  );
});

test('ST-29: probe returns [] with no login route mined', async () => {
  assert.deepEqual(
    await probeSessionTimeout(
      PAGE_URL,
      baseOpts({ apiRoutes: [], fetchFn: fakeFetch(loginBody(NOEXP_PAYLOAD)) })
    ),
    []
  );
});

test('ST-30: probe returns [] when the login fails (401)', async () => {
  assert.deepEqual(
    await probeSessionTimeout(
      PAGE_URL,
      baseOpts({ fetchFn: fakeFetch({ status: 'error' }, { status: 401 }) })
    ),
    []
  );
});

// ---- probe: confirms + true negatives ------------------------------------------

test('ST-31: probe CONFIRMS #259 on a Juice-shaped no-exp token — 1 finding, no value leaks', async () => {
  const token = makeToken(NOEXP_PAYLOAD);
  const diag = {};
  const findings = await probeSessionTimeout(
    PAGE_URL,
    baseOpts({ fetchFn: fakeFetch(loginBody(NOEXP_PAYLOAD)), diagnostics: diag })
  );
  assert.equal(findings.length, 1);
  const f = findings[0];
  assert.equal(f.class, 'session_no_timeout');
  assert.equal(f.severity, 'medium');
  assert.equal(f.title, 'Session token carries no expiry — it never times out (MEDIUM)');
  assert.equal(f.url, LOGIN_URL);
  assert.equal(f.parameter, 'exp');
  assert.match(f.evidence.response, /no exp claim/);
  assert.ok(!f.evidence.response.includes(token));
  assert.ok(!f.evidence.request.includes(token));
  // The default confirmation protocol judges it on signalCorrelated.
  assert.equal(assessConfirmation(f).verdict, 'confirmed');
  assert.equal(diag.loginRoutes, 1);
  assert.equal(diag.tokenFound, true);
  assert.equal(diag.tokenJwt, true);
  assert.equal(diag.expPresent, false);
  assert.equal(diag.tokenLifetimeSecs, null);
  assert.equal(diag.rememberMeSurface, false);
});

test('ST-32: probe CONFIRMS #259 on an absurd 30-day lifetime', async () => {
  const diag = {};
  const findings = await probeSessionTimeout(
    PAGE_URL,
    baseOpts({ fetchFn: fakeFetch(loginBody(ABSURD_PAYLOAD)), diagnostics: diag })
  );
  assert.equal(findings.length, 1);
  assert.equal(findings[0].class, 'session_no_timeout');
  assert.equal(
    findings[0].title,
    'Session token lifetime is absurdly long — effectively no timeout (MEDIUM)'
  );
  assert.match(findings[0].evidence.response, /2592000s/);
  assert.equal(assessConfirmation(findings[0]).verdict, 'confirmed');
  assert.equal(diag.expPresent, true);
  assert.equal(diag.tokenLifetimeSecs, 30 * DAY);
});

test('ST-33: probe returns [] on a sane 5-hour token — proven true negative', async () => {
  const diag = {};
  const findings = await probeSessionTimeout(
    PAGE_URL,
    baseOpts({ fetchFn: fakeFetch(loginBody(SANE_PAYLOAD)), diagnostics: diag })
  );
  assert.deepEqual(findings, []);
  assert.equal(diag.expPresent, true);
  assert.equal(diag.tokenLifetimeSecs, 5 * 3600);
  assert.equal(diag.rememberMeSurface, false);
});

test('ST-34: probe CONFIRMS #475 on a JSON remember-me short token (session sane)', async () => {
  const diag = {};
  const findings = await probeSessionTimeout(
    PAGE_URL,
    baseOpts({
      fetchFn: fakeFetch(loginBody(SANE_PAYLOAD, { rememberMeToken: 'abc123' })),
      diagnostics: diag,
    })
  );
  assert.equal(findings.length, 1);
  const f = findings[0];
  assert.equal(f.class, 'remember_me_token');
  assert.equal(f.severity, 'high');
  assert.equal(f.title, 'Remember-me token is predictable (HIGH)');
  assert.equal(f.url, LOGIN_URL);
  assert.equal(f.parameter, 'rememberMeToken');
  assert.match(f.evidence.response, /rememberMeToken/);
  assert.ok(!f.evidence.response.includes('abc123'));
  assert.equal(assessConfirmation(f).verdict, 'confirmed');
  assert.equal(diag.rememberMeSurface, true);
  assert.equal(diag.rememberMeKind, 'predictable');
  // The sane session token stays a true negative — only #475 fires.
  assert.equal(diag.tokenLifetimeSecs, 5 * 3600);
});

test('ST-35: probe CONFIRMS #475 on a permanent remember-me JWT (session sane)', async () => {
  const diag = {};
  const findings = await probeSessionTimeout(
    PAGE_URL,
    baseOpts({
      fetchFn: fakeFetch(loginBody(SANE_PAYLOAD, { rememberMeToken: RM_PERMANENT_TOKEN })),
      diagnostics: diag,
    })
  );
  assert.equal(findings.length, 1);
  assert.equal(findings[0].class, 'remember_me_token');
  assert.equal(findings[0].title, 'Remember-me token never expires (HIGH)');
  assert.equal(assessConfirmation(findings[0]).verdict, 'confirmed');
  assert.equal(diag.rememberMeSurface, true);
  assert.equal(diag.rememberMeKind, 'permanent');
});

test('ST-36: probe returns [] for an opaque long remember-me cookie (no observable flaw)', async () => {
  const diag = {};
  const findings = await probeSessionTimeout(
    PAGE_URL,
    baseOpts({
      fetchFn: fakeFetch(loginBody(SANE_PAYLOAD), {
        setCookies: ['remember_me=fake-opaque-remember-token-value-123456; Path=/; HttpOnly'],
      }),
      diagnostics: diag,
    })
  );
  assert.deepEqual(findings, []);
  assert.equal(diag.rememberMeSurface, true);
  assert.equal(diag.rememberMeKind, null);
});

test('ST-37: probe fires ONLY #259 when the remember-me value is the session token', async () => {
  const token = makeToken(NOEXP_PAYLOAD);
  const diag = {};
  const findings = await probeSessionTimeout(
    PAGE_URL,
    baseOpts({
      fetchFn: fakeFetch(loginBody(NOEXP_PAYLOAD, { rememberMeToken: token })),
      diagnostics: diag,
    })
  );
  assert.equal(findings.length, 1);
  assert.equal(findings[0].class, 'session_no_timeout');
  assert.equal(diag.rememberMeSurface, true);
  assert.equal(diag.rememberMeKind, 'same-as-session');
});

test('ST-38: probe fires BOTH findings — no-exp session token + predictable remember-me token', async () => {
  const findings = await probeSessionTimeout(
    PAGE_URL,
    baseOpts({
      fetchFn: fakeFetch(
        loginBody(NOEXP_PAYLOAD, { rememberMeToken: '12345678901234567890' })
      ),
    })
  );
  assert.equal(findings.length, 2);
  const classes = findings.map((f) => f.class).sort();
  assert.deepEqual(classes, ['remember_me_token', 'session_no_timeout']);
  assert.ok(findings.every((f) => assessConfirmation(f).verdict === 'confirmed'));
});

test('ST-39: probe returns [] for an opaque session token — nothing decodable to judge', async () => {
  const diag = {};
  const findings = await probeSessionTimeout(
    PAGE_URL,
    baseOpts({
      fetchFn: fakeFetch({ authentication: { token: 'opaque-token-value' } }),
      diagnostics: diag,
    })
  );
  assert.deepEqual(findings, []);
  assert.equal(diag.tokenFound, true);
  assert.equal(diag.tokenJwt, false);
  assert.equal(diag.rememberMeSurface, false);
});

test('ST-40: probe meta declares the session-timeout phase, standard + deep only', () => {
  assert.deepEqual(__sessionTimeoutMeta, { phases: ['session-timeout'], depth: ['standard', 'deep'] });
});
