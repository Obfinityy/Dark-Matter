// JWT sensitive-data-in-claims probe tests (row #481 [Medium]
// JWT — sensitive data in claims (unencrypted payload),
// CWE-359 / CWE-200; phase 103, 'jwt-claims').
//
// The probe logs in with the lab credentials, takes the token the
// server itself issues, decodes the payload (base64url, no key
// needed) and walks the claims for sensitive fields. It confirms
// ONLY when a credential/secret field (password, secret, API key,
// private key, nested token, payment / national-id field) or a
// personal-data field (email, phone, address, date of birth)
// carries a non-empty value. A token whose payload holds only
// standard identifiers is a proven true negative, never a finding.
// The fake fetch below simulates a Juice-shaped lab: POST
// /rest/user/login returns {authentication: {token}} where the
// token payload nests its claims under `data` (id, email, password
// hash, role, deluxeToken, ...). Modes: 'juice' (password hash +
// email + nested token in claims), 'secret-only', 'pii-only',
// 'nested-token-only', 'clean' (standard claims only), 'opaque'
// (non-JWT token), 'login-401', 'no-token'. All fixture values are
// clearly fake ('fake-...' / 'lab-user@example.com') — no real
// secret-shaped strings anywhere.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  probeJwtClaims,
  decodeJwtPayload,
  findSensitiveClaims,
  countClaimFields,
  assessJwtClaims,
  classifyClaim,
  __jwtClaimsMeta,
} from './jwtClaims.js';
import { assessConfirmation } from '../../hunt-intel/differential.js';

const PAGE_URL = 'http://172.17.0.1:3000/';
const LOGIN_URL = 'http://172.17.0.1:3000/rest/user/login';

const b64u = (obj) =>
  Buffer.from(JSON.stringify(obj))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const makeToken = (payload, header = { alg: 'HS256', typ: 'JWT' }) =>
  `${b64u(header)}.${b64u(payload)}.fake-signature`;

const JUICE_PAYLOAD = {
  status: 'success',
  data: {
    id: 1,
    email: 'lab-user@example.com',
    password: 'fake-hash-value',
    role: 'customer',
    deluxeToken: 'fake-deluxe-token-value-123456',
    lastLoginIp: '10.0.0.9',
    profileImage: 'default.png',
  },
};

function fakeFetch(mode, payload = JUICE_PAYLOAD) {
  return async (url, init = {}) => {
    const method = String(init.method || 'GET').toUpperCase();
    const u = String(url);
    if (u === LOGIN_URL && method === 'POST') {
      if (mode === 'login-401') {
        return { status: 401, text: async () => JSON.stringify({ status: 'error' }) };
      }
      if (mode === 'no-token') {
        return { status: 200, text: async () => JSON.stringify({ status: 'success' }) };
      }
      if (mode === 'opaque') {
        return {
          status: 200,
          text: async () => JSON.stringify({ authentication: { token: 'opaque-token-value' } }),
        };
      }
      return {
        status: 200,
        text: async () => JSON.stringify({ authentication: { token: makeToken(payload) } }),
      };
    }
    return { status: 404, text: async () => JSON.stringify({ status: 'error' }) };
  };
}

const baseOpts = (over = {}) => ({
  labCreds: { username: 'lab-user', password: 'lab-pass' },
  allowWrite: true,
  labTargets: ['172.17.0.1:3000'],
  apiRoutes: [LOGIN_URL],
  depth: 'standard',
  ...over,
});

// ---- pure: decode ------------------------------------------------------------

test('JWT-C-1: decodeJwtPayload decodes a valid token, nested claims intact', () => {
  const decoded = decodeJwtPayload(makeToken(JUICE_PAYLOAD));
  assert.ok(decoded);
  assert.equal(decoded.status, 'success');
  assert.equal(decoded.data.email, 'lab-user@example.com');
  assert.equal(decoded.data.role, 'customer');
});

test('JWT-C-2: decodeJwtPayload returns null for an opaque (non-JWT) string', () => {
  assert.equal(decodeJwtPayload('opaque-token-value'), null);
  assert.equal(decodeJwtPayload(''), null);
  assert.equal(decodeJwtPayload(null), null);
});

test('JWT-C-3: decodeJwtPayload returns null for malformed base64 / JSON', () => {
  assert.equal(decodeJwtPayload('!!!.@@@.###'), null);
  assert.equal(decodeJwtPayload(`${b64u({ alg: 'HS256' })}.not-json.fake-sig`), null);
});

test('JWT-C-4: decodeJwtPayload returns null when the header carries no alg', () => {
  assert.equal(decodeJwtPayload(makeToken({ sub: '1' }, { typ: 'JWT' })), null);
});

// ---- pure: claim classification ----------------------------------------------

test('JWT-C-5: findSensitiveClaims flags the nested password hash + email (Juice shape)', () => {
  const found = findSensitiveClaims(JUICE_PAYLOAD);
  const byField = Object.fromEntries(found.map((f) => [f.field, f.tier]));
  assert.equal(byField['data.password'], 'secret');
  assert.equal(byField['data.email'], 'pii');
  assert.equal(byField['data.deluxeToken'], 'secret');
  assert.equal(found.length, 3);
  // Identifiers and inert fields are never flagged.
  assert.ok(!found.some((f) => f.field === 'data.id'));
  assert.ok(!found.some((f) => f.field === 'data.role'));
  assert.ok(!found.some((f) => f.field === 'data.lastLoginIp'));
  assert.ok(!found.some((f) => f.field === 'data.profileImage'));
});

test('JWT-C-6: findSensitiveClaims flags email + phone as pii', () => {
  const found = findSensitiveClaims({ email: 'lab-user@example.com', phone: '+1-555-0100' });
  assert.deepEqual(
    found.map((f) => f.field).sort(),
    ['email', 'phone']
  );
  assert.ok(found.every((f) => f.tier === 'pii'));
});

test('JWT-C-7: findSensitiveClaims never flags standard identifiers', () => {
  const found = findSensitiveClaims({
    sub: 'user-1',
    iss: 'https://idp.example.com',
    aud: 'shop',
    iat: 1700000000,
    exp: 1700003600,
    role: 'admin',
    id: 42,
    username: 'lab-user',
    name: 'Lab User',
  });
  assert.deepEqual(found, []);
});

test('JWT-C-8: findSensitiveClaims ignores empty / null credential values', () => {
  const found = findSensitiveClaims({ password: '', secret: null, apiKey: '   ' });
  assert.deepEqual(found, []);
});

test('JWT-C-9: findSensitiveClaims flags a long nested token value as secret', () => {
  const found = findSensitiveClaims({ data: { deluxeToken: 'fake-deluxe-token-value-123456' } });
  assert.deepEqual(found, [{ field: 'data.deluxeToken', tier: 'secret' }]);
});

test('JWT-C-10: findSensitiveClaims ignores a short token value (flag, not a credential)', () => {
  const found = findSensitiveClaims({ data: { deluxeToken: 'short' } });
  assert.deepEqual(found, []);
});

test('JWT-C-11: findSensitiveClaims flags ssn + apiKey + creditCard as secret', () => {
  const found = findSensitiveClaims({
    ssn: 'fake-ssn-value',
    apiKey: 'fake-api-key-value',
    creditCardNumber: 'fake-card-value',
  });
  assert.equal(found.length, 3);
  assert.ok(found.every((f) => f.tier === 'secret'));
});

test('JWT-C-12: findSensitiveClaims flags address + date of birth as pii', () => {
  const found = findSensitiveClaims({
    streetAddress: '1 Fake Street',
    dateOfBirth: '2000-01-01',
  });
  assert.equal(found.length, 2);
  assert.ok(found.every((f) => f.tier === 'pii'));
});

test('JWT-C-13: findSensitiveClaims returns [] for a standard-claims-only payload', () => {
  assert.deepEqual(findSensitiveClaims({ sub: '1', role: 'customer', iat: 1, exp: 2 }), []);
});

test('JWT-C-14: countClaimFields counts leaf fields, nested included', () => {
  assert.equal(countClaimFields(JUICE_PAYLOAD), 8);
  assert.equal(countClaimFields({ sub: '1' }), 1);
  assert.equal(countClaimFields({}), 0);
});

// ---- pure: oracle ------------------------------------------------------------

test('JWT-C-15: assessJwtClaims confirms with secret tier when any secret field is present', () => {
  const v = assessJwtClaims(JUICE_PAYLOAD, findSensitiveClaims(JUICE_PAYLOAD));
  assert.equal(v.verdict, 'confirmed');
  assert.equal(v.tier, 'secret');
  assert.match(v.reason, /data\.password/);
});

test('JWT-C-16: assessJwtClaims confirms with pii tier when only pii fields are present', () => {
  const v = assessJwtClaims(
    { email: 'lab-user@example.com' },
    findSensitiveClaims({ email: 'lab-user@example.com' })
  );
  assert.equal(v.verdict, 'confirmed');
  assert.equal(v.tier, 'pii');
});

test('JWT-C-17: assessJwtClaims rejects a clean token (proven true negative)', () => {
  const v = assessJwtClaims({ sub: '1', role: 'customer' }, []);
  assert.equal(v.verdict, 'rejected');
});

test('JWT-C-18: assessJwtClaims is unconfirmed with no decodable token', () => {
  assert.equal(assessJwtClaims(null, []).verdict, 'unconfirmed');
});

// ---- probe: gates (all honest []) --------------------------------------------

test('JWT-C-19: probe returns [] without labCreds', async () => {
  assert.deepEqual(
    await probeJwtClaims(PAGE_URL, baseOpts({ labCreds: null, fetchFn: fakeFetch('juice') })),
    []
  );
});

test('JWT-C-20: probe returns [] when allowWrite is not true', async () => {
  assert.deepEqual(
    await probeJwtClaims(PAGE_URL, baseOpts({ allowWrite: false, fetchFn: fakeFetch('juice') })),
    []
  );
});

test('JWT-C-21: probe returns [] on a non-lab target', async () => {
  assert.deepEqual(
    await probeJwtClaims(PAGE_URL, baseOpts({ labTargets: ['10.0.0.1:3000'], fetchFn: fakeFetch('juice') })),
    []
  );
});

test('JWT-C-22: probe returns [] on depth quick', async () => {
  assert.deepEqual(
    await probeJwtClaims(PAGE_URL, baseOpts({ depth: 'quick', fetchFn: fakeFetch('juice') })),
    []
  );
});

test('JWT-C-23: probe returns [] with no login route mined', async () => {
  assert.deepEqual(
    await probeJwtClaims(PAGE_URL, baseOpts({ apiRoutes: [], fetchFn: fakeFetch('juice') })),
    []
  );
});

test('JWT-C-24: probe returns [] when the login fails (401)', async () => {
  assert.deepEqual(await probeJwtClaims(PAGE_URL, baseOpts({ fetchFn: fakeFetch('login-401') })), []);
});

test('JWT-C-25: probe returns [] for an opaque (non-JWT) token', async () => {
  assert.deepEqual(await probeJwtClaims(PAGE_URL, baseOpts({ fetchFn: fakeFetch('opaque') })), []);
});

test('JWT-C-26: probe returns [] for a clean token — proven true negative', async () => {
  const clean = { sub: '1', role: 'customer', iat: 1700000000, exp: 1700003600 };
  assert.deepEqual(await probeJwtClaims(PAGE_URL, baseOpts({ fetchFn: fakeFetch('clean', clean) })), []);
});

test('JWT-C-27: probe returns [] when the login succeeds but carries no token', async () => {
  assert.deepEqual(await probeJwtClaims(PAGE_URL, baseOpts({ fetchFn: fakeFetch('no-token') })), []);
});

// ---- probe: confirms ----------------------------------------------------------

test('JWT-C-28: probe CONFIRMS on a Juice-shaped token — 1 finding, field names only, no values leak', async () => {
  const findings = await probeJwtClaims(PAGE_URL, baseOpts({ fetchFn: fakeFetch('juice') }));
  assert.equal(findings.length, 1);
  const f = findings[0];
  assert.equal(f.class, 'jwt_sensitive_claims');
  assert.equal(f.severity, 'medium');
  assert.equal(f.title, 'JWT payload carries sensitive data in its claims (MEDIUM)');
  assert.equal(f.url, LOGIN_URL);
  // Field names are quoted; claim values never leak into the evidence.
  assert.match(f.evidence.response, /data\.password/);
  assert.match(f.evidence.response, /data\.email/);
  assert.ok(!f.evidence.response.includes('lab-user@example.com'));
  assert.ok(!f.evidence.response.includes('fake-hash-value'));
  assert.ok(!f.evidence.response.includes('fake-deluxe-token-value-123456'));
  // The default confirmation protocol judges it on signalCorrelated.
  assert.equal(assessConfirmation(f).verdict, 'confirmed');
});

test('JWT-C-29: probe diagnostics ride the confirming run', async () => {
  const diag = {};
  const findings = await probeJwtClaims(
    PAGE_URL,
    baseOpts({ fetchFn: fakeFetch('juice'), diagnostics: diag })
  );
  assert.equal(findings.length, 1);
  assert.equal(diag.loginRoutes, 1);
  assert.equal(diag.tokenFound, true);
  assert.equal(diag.tokenJwt, true);
  assert.equal(diag.claimsScanned, 8);
  assert.equal(diag.sensitiveFields, 3);
  assert.equal(diag.tier, 'secret');
});

test('JWT-C-30: probe CONFIRMS on a secret-only token (apiKey)', async () => {
  const findings = await probeJwtClaims(
    PAGE_URL,
    baseOpts({ fetchFn: fakeFetch('secret-only', { data: { apiKey: 'fake-api-key-value' } }) })
  );
  assert.equal(findings.length, 1);
  assert.equal(findings[0].class, 'jwt_sensitive_claims');
  assert.match(findings[0].evidence.response, /data\.apiKey/);
});

test('JWT-C-31: probe CONFIRMS on a pii-only token (email + phone)', async () => {
  const findings = await probeJwtClaims(
    PAGE_URL,
    baseOpts({
      fetchFn: fakeFetch('pii-only', { email: 'lab-user@example.com', phone: '+1-555-0100' }),
    })
  );
  assert.equal(findings.length, 1);
  assert.match(findings[0].evidence.response, /email/);
  assert.ok(!findings[0].evidence.response.includes('lab-user@example.com'));
});

test('JWT-C-32: probe CONFIRMS on a nested-token-only payload (deluxeToken)', async () => {
  const findings = await probeJwtClaims(
    PAGE_URL,
    baseOpts({
      fetchFn: fakeFetch('nested-token-only', {
        data: { deluxeToken: 'fake-deluxe-token-value-123456' },
      }),
    })
  );
  assert.equal(findings.length, 1);
  assert.match(findings[0].evidence.response, /data\.deluxeToken/);
});

test('JWT-C-33: probe meta declares the jwt-claims phase, standard + deep only', () => {
  assert.deepEqual(__jwtClaimsMeta, { phases: ['jwt-claims'], depth: ['standard', 'deep'] });
});
