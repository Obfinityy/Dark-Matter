// Tests for the MFA-bypass probe
// (coverage rows #46 [Critical] MFA Bypass and #327 [Critical] Auth
// — 2FA bypass via direct endpoint access; BIZ-12 OTP Reuse; phase
// 149). No network, no lab — the probe talks to the shop only
// through the opts.fetchFn seam, stubbed here by a stateful fake
// Juice Shop: login, 2FA status/setup/verify/disable, a protected
// /api/Users list, a password-change route and a recovery-code
// route. Behaviour flags flip the fake between a vulnerable shop
// and a safe one.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  probeMfaBypass,
  base32Decode,
  totpCode,
  findMfaPending,
  findSetupSecret,
  mfaRouteSet,
  assessProtectedResponse,
  assessVerifyOutcome,
  assessSensitiveResponse,
  assessSetupResponse,
} from './mfaBypass.js';
import { verifyFindings } from '../verifier.js';

const ORIGIN = 'http://lab.local';
const SECRET = 'JBSWY3DPEHPK3PXP'; // base32 of ASCII 'Hello!\xde\xad\xbe\xef'
const ROUTES = [
  'http://lab.local/rest/2fa/verify',
  'http://lab.local/rest/2fa/status',
  'http://lab.local/rest/2fa/setup',
  'http://lab.local/rest/2fa/disable',
  'http://lab.local/rest/user/login',
  'http://lab.local/rest/user/change-password',
  'http://lab.local/rest/user/whoami',
  'http://lab.local/api/Users',
  'http://lab.local/rest/recovery-code/verify',
  'http://other.local/rest/2fa/verify',
];

const BASE_OPTS = {
  labCreds: { username: 'canary@lab.local', password: 'canary-pass' },
  allowWrite: true,
  labTargets: 'lab.local',
  apiRoutes: ROUTES,
};

// ---- stateful fake Juice ----------------------------------------------------
// behaviour flags:
//   pending: login returns a token + tmpToken (2FA enabled on the account)
//   pendingSafe: as pending, but protected/sensitive routes refuse pre-MFA creds
//   directAccessVulnerable: /api/Users grants pre-MFA creds (token + tmpToken)
//   sensitivePreMfa: change-password grants a pre-MFA credential
//   enrolledNotChallenged: status setup:true, login returns a full token, no tmpToken
//   discloseSecret: status discloses the TOTP secret + setupToken
//   enrollWrongCodeAccepted: setup accepts initialToken '000000'
//   reuseBug: a used code verifies a second time
//   windowBug: codes two steps out verify
//   recoveryNoThrottle: the recovery route answers 10 wrong codes ordinarily
//   verifyNotEnabled: verify answers '2FA is not enabled'
function makeFakeJuice(behavior = {}) {
  const state = {
    setup: Boolean(behavior.enrolledNotChallenged),
    secret: SECRET,
    setupToken: 'setup-tok-1',
    tmpCounter: 0,
    usedCodes: new Set(),
    calls: [],
    bodies: [],
    verifyCount: 0,
    posts: 0,
  };
  const codeAt = (unixSec) => totpCode(state.secret, unixSec);
  const codeValid = (code, nowSec, windowSteps) => {
    for (let d = -windowSteps; d <= windowSteps; d += 1) {
      if (totpCode(state.secret, nowSec + d * 30) === code) return true;
    }
    return false;
  };
  const fetchFn = async (url, init = {}) => {
    const method = String(init.method || 'GET').toUpperCase();
    const u = new URL(String(url));
    let body = null;
    try {
      body = init.body ? JSON.parse(init.body) : null;
    } catch {
      body = null;
    }
    state.calls.push(`${method} ${u.pathname}`);
    state.bodies.push(body);
    if (method === 'POST') state.posts += 1;
    const auth = init.headers && init.headers.Authorization ? String(init.headers.Authorization).replace(/^Bearer /, '') : null;
    const json = (status, obj) => ({ status, text: async () => JSON.stringify(obj) });
    const nowSec = Math.floor(Date.now() / 1000);
    if (method === 'POST' && u.pathname === '/rest/user/login') {
      if (behavior.loginFails401) {
        return json(401, { status: 'error', message: 'Invalid credentials' });
      }
      if (behavior.pendingHttp401) {
        // Juice shape: an MFA-pending login answers HTTP 401 with
        // totp_token_required + tmpToken and NO Bearer token.
        state.tmpCounter += 1;
        return json(401, {
          status: 'totp_token_required',
          data: { tmpToken: `tmp-${state.tmpCounter}` },
        });
      }
      if (behavior.enrolledNotChallenged) {
        return json(200, { status: 'success', authentication: { token: 'tok-full', umail: 'canary@lab.local' } });
      }
      if (state.setup || behavior.pending) {
        state.tmpCounter += 1;
        return json(200, {
          status: 'totp_token_required',
          data: { tmpToken: `tmp-${state.tmpCounter}` },
          authentication: { token: 'tok-pre', umail: 'canary@lab.local' },
        });
      }
      if (behavior.enrolledNotChallenged) {
        return json(200, { status: 'success', authentication: { token: 'tok-full', umail: 'canary@lab.local' } });
      }
      return json(200, { status: 'success', authentication: { token: 'tok-full', umail: 'canary@lab.local' } });
    }
    if (method === 'GET' && u.pathname === '/rest/2fa/status') {
      return json(200, {
        setup: state.setup,
        ...(behavior.discloseSecret
          ? { secret: state.secret, setupToken: state.setupToken, email: 'canary@lab.local' }
          : {}),
      });
    }
    if (method === 'POST' && u.pathname === '/rest/2fa/setup') {
      if (behavior.enrollWrongCodeAccepted) {
        state.setup = true;
        return json(200, {});
      }
      if (body && body.setupToken === state.setupToken && codeValid(String(body.initialToken || ''), nowSec, 1)) {
        state.setup = true;
        return json(200, {});
      }
      return json(400, { status: 'error', message: 'Invalid code' });
    }
    if (method === 'POST' && u.pathname === '/rest/2fa/disable') {
      if (body && body.password === 'canary-pass') {
        state.setup = false;
        return json(200, { status: 'success' });
      }
      return json(401, { status: 'error', message: 'Invalid password' });
    }
    if (method === 'POST' && u.pathname === '/rest/2fa/verify') {
      state.verifyCount += 1;
      if (behavior.verifyNotEnabled) {
        return json(400, { status: 'error', message: '2FA is not enabled for this user' });
      }
      const code = String((body && body.totpToken) || '');
      if (!body || !body.tmpToken || !String(body.tmpToken).startsWith('tmp-')) {
        return json(400, { status: 'error', message: 'tmpToken is invalid' });
      }
      const windowSteps = behavior.windowBug ? 2 : 1;
      if (!codeValid(code, nowSec, windowSteps)) {
        return json(401, { status: 'error', message: 'Invalid code' });
      }
      if (state.usedCodes.has(code) && !behavior.reuseBug) {
        return json(400, { status: 'error', message: 'code already used' });
      }
      state.usedCodes.add(code);
      return json(200, { status: 'success', authentication: { token: 'tok-full' } });
    }
    if (method === 'GET' && u.pathname === '/api/Users') {
      if (!auth) return json(401, { status: 'error', message: 'Unauthorized' });
      if (auth === 'tok-full') return json(200, { status: 'success', data: [{ id: 1, email: 'a@b.c', role: 'admin' }] });
      if (behavior.directAccessVulnerable && (auth === 'tok-pre' || String(auth).startsWith('tmp-'))) {
        return json(200, { status: 'success', data: [{ id: 1, email: 'a@b.c', role: 'admin' }] });
      }
      return json(401, { status: 'error', message: 'Unauthorized' });
    }
    if (method === 'GET' && u.pathname === '/rest/user/whoami') {
      return json(200, { user: {} });
    }
    if (method === 'POST' && u.pathname === '/rest/user/change-password') {
      if (behavior.sensitivePreMfa && (auth === 'tok-pre' || String(auth || '').startsWith('tmp-'))) {
        return json(200, { status: 'success', message: 'Password changed' });
      }
      if (auth === 'tok-full') return json(200, { status: 'success', message: 'Password changed' });
      return json(401, { status: 'error', message: 'Unauthorized' });
    }
    if (method === 'POST' && u.pathname === '/rest/recovery-code/verify') {
      if (behavior.recoveryNoThrottle) {
        return json(401, { status: 'error', message: 'Invalid recovery code' });
      }
      return json(429, { status: 'error', message: 'Too many requests' });
    }
    return json(404, { status: 'error', message: 'not found' });
  };
  return { state, fetchFn };
}

// ---- pure helpers -----------------------------------------------------------

describe('totpCode + base32Decode', () => {
  it('MFB-1: RFC 6238 vectors pin the TOTP exactly', () => {
    // Secret is ASCII '12345678901234567890' in base32.
    const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
    assert.equal(totpCode(secret, 59), '287082');
    assert.equal(totpCode(secret, 1111111109), '081804');
    assert.equal(totpCode(secret, 1111111111), '050471');
    assert.equal(totpCode(secret, 1234567890), '005924');
  });
  it('MFB-2: base32 decodes the RFC secret byte-exact', () => {
    assert.equal(base32Decode('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ').toString('ascii'), '12345678901234567890');
    // 'ascii' masks the high bit, so compare the DEADBEEF tail as bytes.
    assert.deepEqual(
      [...base32Decode('JBSWY3DPEHPK3PXP')],
      [0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x21, 0xde, 0xad, 0xbe, 0xef]
    );
  });
});

describe('findMfaPending + findSetupSecret + mfaRouteSet', () => {
  it('MFB-3: MFA-pending is a tmpToken or a totp_token_required status', () => {
    assert.equal(findMfaPending({ authentication: { tmpToken: 'tmp-1', token: 't' } }).pending, true);
    assert.equal(findMfaPending({ status: 'totp_token_required', data: { tmpToken: 'tmp-1' } }).pending, true);
    assert.equal(findMfaPending({ status: 'success', authentication: { token: 't' } }).pending, false);
    assert.equal(findMfaPending(null).pending, false);
    assert.equal(findMfaPending({ authentication: { token: 't' } }).tmpToken, null);
  });
  it('MFB-4: status facts are pulled flat or one level deep', () => {
    assert.deepEqual(findSetupSecret({ setup: false, secret: 'S', setupToken: 'ST' }), {
      setup: false,
      secret: 'S',
      setupToken: 'ST',
    });
    assert.deepEqual(findSetupSecret({ data: { setup: true, secret: 'S2' } }), {
      setup: true,
      secret: 'S2',
      setupToken: null,
    });
    assert.deepEqual(findSetupSecret(null), { setup: null, secret: null, setupToken: null });
  });
  it('MFB-5: route mining picks verify/status/setup/disable/recovery/protected/sensitive, ignores cross-origin', () => {
    const rs = mfaRouteSet(ROUTES, ORIGIN);
    assert.equal(rs.verify, 'http://lab.local/rest/2fa/verify');
    assert.equal(rs.status, 'http://lab.local/rest/2fa/status');
    assert.equal(rs.setup, 'http://lab.local/rest/2fa/setup');
    assert.equal(rs.disable, 'http://lab.local/rest/2fa/disable');
    assert.equal(rs.recovery, 'http://lab.local/rest/recovery-code/verify');
    assert.ok(rs.protected.includes('http://lab.local/api/Users'));
    assert.ok(rs.sensitive.includes('http://lab.local/rest/user/change-password'));
    assert.ok(!Object.values(rs).flat().some((v) => typeof v === 'string' && v.includes('other.local')));
  });
});

describe('assessors', () => {
  it('MFB-6: protected replay needs a refused control and a substantive granted body', () => {
    const anon = '{"user":{}}';
    assert.equal(assessProtectedResponse(401, { status: 'error' }, null).kind, 'refused');
    assert.equal(
      assessProtectedResponse(200, { status: 'success', data: [{ id: 1, email: 'a@b.c' }] }, anon).kind,
      'granted'
    );
    assert.equal(assessProtectedResponse(200, { user: {} }, anon).kind, 'same-as-anonymous');
    assert.equal(assessProtectedResponse(200, { status: 'success', data: [] }, null).kind, 'same-as-anonymous');
    assert.equal(
      assessProtectedResponse(200, { status: 'error', message: 'Unauthorized' }, null).kind,
      'refused'
    );
  });
  it('MFB-7: verify outcomes — success, wrong-code, tmp-token-invalid, throttle, uncalibrated', () => {
    assert.equal(assessVerifyOutcome(200, { status: 'success', authentication: { token: 't' } }).kind, 'success');
    assert.equal(assessVerifyOutcome(401, { status: 'error', message: 'Invalid code' }).kind, 'wrong-code');
    assert.equal(
      assessVerifyOutcome(400, { status: 'error', message: 'tmpToken is invalid' }).kind,
      'tmp-token-invalid'
    );
    assert.equal(assessVerifyOutcome(429, { status: 'error' }).kind, 'throttle');
    assert.equal(
      assessVerifyOutcome(400, { status: 'error', message: '2FA is not enabled for this user' }).kind,
      'uncalibrated'
    );
    assert.equal(assessVerifyOutcome(500, { status: 'error' }).kind, 'other');
  });
  it('MFB-8: sensitive/setup responses — success only on a 2xx success marker', () => {
    assert.equal(assessSensitiveResponse(200, { status: 'success', message: 'Password changed' }).kind, 'success');
    assert.equal(assessSensitiveResponse(401, { status: 'error', message: 'Unauthorized' }).kind, 'refused');
    assert.equal(assessSensitiveResponse(400, { status: 'error', message: 'newPassword is required' }).kind, 'rejected');
    assert.equal(assessSensitiveResponse(200, { user: {} }).kind, 'other');
    assert.equal(assessSetupResponse(200).kind, 'success');
    assert.equal(assessSetupResponse(400).kind, 'rejected');
    assert.equal(assessSetupResponse(404).kind, 'uncalibrated');
    assert.equal(assessSetupResponse(500).kind, 'other');
  });
});

// ---- the probe, end to end against the fake ---------------------------------

describe('probeMfaBypass — direct endpoint access (L1)', () => {
  it('MFB-9: a pre-MFA credential that opens /api/Users fires exactly one [Critical] auth_mfa_bypass finding', async () => {
    const { fetchFn } = makeFakeJuice({ pending: true, directAccessVulnerable: true });
    const diag = {};
    const findings = await probeMfaBypass('http://lab.local/', { ...BASE_OPTS, fetchFn, diagnostics: diag });
    assert.equal(findings.length, 1, `expected 1 finding, got: ${findings.map((f) => f.title).join(' | ')}`);
    assert.match(findings[0].title, /MFA step skippable/);
    assert.equal(findings[0].severity, 'critical');
    assert.equal(findings[0].class, 'auth_mfa_bypass');
    assert.equal(findings[0].evidence.bypassWorks, true);
    assert.equal(diag.controlOk, true);
    assert.ok(diag.attempts >= 1, `expected >=1 POST (login), got ${diag.attempts}`);
  });
  it('MFB-10: the fired L1 finding verifies as confirmed through the real pipeline', async () => {
    const { fetchFn } = makeFakeJuice({ pending: true, directAccessVulnerable: true });
    const findings = await probeMfaBypass('http://lab.local/', { ...BASE_OPTS, fetchFn });
    const { confirmed, unconfirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
    assert.equal(unconfirmed.length, 0);
    assert.equal(confirmed[0].confirmation, 'confirmed');
  });
  it('MFB-11: a pending session whose protected routes refuse pre-MFA creds is a true negative', async () => {
    const { state, fetchFn } = makeFakeJuice({ pending: true, pendingSafe: true, discloseSecret: false });
    const findings = await probeMfaBypass('http://lab.local/', { ...BASE_OPTS, fetchFn });
    assert.deepEqual(findings, []);
    assert.equal(state.setup, false, 'safe shop must be left un-enrolled');
  });
  it('MFB-22: a pending login answering HTTP 401 (Juice shape, no Bearer token) still yields the tmpToken and fires L1', async () => {
    const { fetchFn } = makeFakeJuice({ pending: true, pendingHttp401: true, directAccessVulnerable: true });
    const diag = {};
    const findings = await probeMfaBypass('http://lab.local/', { ...BASE_OPTS, fetchFn, diagnostics: diag });
    assert.equal(findings.length, 1, `expected 1 finding, got: ${findings.map((f) => f.title).join(' | ')}`);
    assert.match(findings[0].title, /MFA step skippable/);
    assert.equal(findings[0].severity, 'critical');
    assert.equal(findings[0].class, 'auth_mfa_bypass');
    assert.equal(diag.controlOk, true);
  });
  it('MFB-23: a plain 401 login (wrong creds, no pending signal) is silent, not a crash', async () => {
    const { fetchFn } = makeFakeJuice({ loginFails401: true });
    const findings = await probeMfaBypass('http://lab.local/', { ...BASE_OPTS, fetchFn });
    assert.deepEqual(findings, []);
  });
});

describe('probeMfaBypass — enrolled but never challenged (L0)', () => {
  it('MFB-12: 2FA enrolled yet login issues a full token with no challenge fires one [Critical] finding', async () => {
    const { fetchFn } = makeFakeJuice({ enrolledNotChallenged: true, discloseSecret: false });
    const findings = await probeMfaBypass('http://lab.local/', { ...BASE_OPTS, fetchFn });
    assert.equal(findings.length, 1, `expected 1 finding, got: ${findings.map((f) => f.title).join(' | ')}`);
    assert.match(findings[0].title, /MFA step skippable/);
    assert.equal(findings[0].class, 'auth_mfa_bypass');
  });
});

describe('probeMfaBypass — sensitive action without MFA (L2)', () => {
  it('MFB-13: a password change accepted pre-MFA fires one [Critical] auth_mfa_bypass finding', async () => {
    const { fetchFn } = makeFakeJuice({ pending: true, sensitivePreMfa: true });
    const findings = await probeMfaBypass('http://lab.local/', { ...BASE_OPTS, fetchFn });
    assert.equal(findings.length, 1, `expected 1 finding, got: ${findings.map((f) => f.title).join(' | ')}`);
    assert.match(findings[0].title, /MFA not enforced on a sensitive action/);
    assert.equal(findings[0].severity, 'critical');
  });
});

describe('probeMfaBypass — enrollment-mediated legs (L3/L6/L7)', () => {
  it('MFB-14: OTP reuse — a consumed code verifies a second time, one [High] auth_otp_reuse finding, lab restored', async () => {
    const { state, fetchFn } = makeFakeJuice({ discloseSecret: true, reuseBug: true });
    const diag = {};
    const findings = await probeMfaBypass('http://lab.local/', { ...BASE_OPTS, fetchFn, diagnostics: diag });
    assert.equal(findings.length, 1, `expected 1 finding, got: ${findings.map((f) => f.title).join(' | ')}`);
    assert.match(findings[0].title, /OTP reuse/);
    assert.equal(findings[0].severity, 'high');
    assert.equal(findings[0].class, 'auth_otp_reuse');
    assert.equal(diag.enrolled, true);
    assert.equal(diag.restoreOk, true);
    assert.equal(state.setup, false, '2FA must be disabled again after the probe');
    const { confirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
  });
  it('MFB-15: enrollment with a wrong code fires one [Critical] finding and the lab is restored', async () => {
    const { state, fetchFn } = makeFakeJuice({ discloseSecret: true, enrollWrongCodeAccepted: true });
    const diag = {};
    const findings = await probeMfaBypass('http://lab.local/', { ...BASE_OPTS, fetchFn, diagnostics: diag });
    assert.equal(findings.length, 1, `expected 1 finding, got: ${findings.map((f) => f.title).join(' | ')}`);
    assert.match(findings[0].title, /enrollment bypass/);
    assert.equal(findings[0].severity, 'critical');
    assert.equal(diag.enrolled, true);
    assert.equal(diag.restoreOk, true);
    assert.equal(state.setup, false);
  });
  it('MFB-16: a code two steps out verifies — one [Medium] auth_mfa_window finding, lab restored', async () => {
    const { state, fetchFn } = makeFakeJuice({ discloseSecret: true, windowBug: true });
    const diag = {};
    const findings = await probeMfaBypass('http://lab.local/', { ...BASE_OPTS, fetchFn, diagnostics: diag });
    assert.equal(findings.length, 1, `expected 1 finding, got: ${findings.map((f) => f.title).join(' | ')}`);
    assert.match(findings[0].title, /Overly broad TOTP validity window/);
    assert.equal(findings[0].severity, 'medium');
    assert.equal(findings[0].class, 'auth_mfa_window');
    assert.equal(diag.restoreOk, true);
    assert.equal(state.setup, false);
  });
  it('MFB-17: a correct shop — no reuse, no wide window, no bypass — fires nothing and leaves 2FA off', async () => {
    const { state, fetchFn } = makeFakeJuice({ discloseSecret: true });
    const diag = {};
    const findings = await probeMfaBypass('http://lab.local/', { ...BASE_OPTS, fetchFn, diagnostics: diag });
    assert.deepEqual(findings, []);
    assert.equal(diag.enrolled, true, 'the probe enrolls to test, then restores');
    assert.equal(diag.restoreOk, true);
    assert.equal(state.setup, false);
  });
});

describe('probeMfaBypass — recovery oracle (L5) and gates', () => {
  it('MFB-18: a recovery route with no throttle fires one [High] finding', async () => {
    const { fetchFn } = makeFakeJuice({ recoveryNoThrottle: true });
    const diag = {};
    const findings = await probeMfaBypass('http://lab.local/', { ...BASE_OPTS, fetchFn, diagnostics: diag });
    assert.equal(findings.length, 1, `expected 1 finding, got: ${findings.map((f) => f.title).join(' | ')}`);
    assert.match(findings[0].title, /Recovery-code verification/);
    assert.equal(findings[0].severity, 'high');
    assert.equal(diag.attempts, 11, `expected 1 login + 10 recovery POSTs, got ${diag.attempts}`);
  });
  it('MFB-19: no 2FA surface at all yields zero findings and zero logins', async () => {
    const { state, fetchFn } = makeFakeJuice();
    const routes = ROUTES.filter((r) => !r.includes('/2fa'));
    const findings = await probeMfaBypass('http://lab.local/', { ...BASE_OPTS, fetchFn, apiRoutes: routes });
    assert.deepEqual(findings, []);
    assert.ok(!state.calls.some((c) => c.startsWith('POST /rest/user/login')), 'no login without a 2FA surface');
  });
  it('MFB-20: no lab creds, no write, non-lab host, quick depth, or no routes — all silent', async () => {
    const { fetchFn } = makeFakeJuice({ pending: true, directAccessVulnerable: true });
    assert.deepEqual(await probeMfaBypass('http://lab.local/', { ...BASE_OPTS, fetchFn, labCreds: null }), []);
    assert.deepEqual(await probeMfaBypass('http://lab.local/', { ...BASE_OPTS, fetchFn, allowWrite: false }), []);
    assert.deepEqual(await probeMfaBypass('http://lab.local/', { ...BASE_OPTS, fetchFn, labTargets: 'other.local' }), []);
    assert.deepEqual(await probeMfaBypass('http://lab.local/', { ...BASE_OPTS, fetchFn, depth: 'quick' }), []);
    assert.deepEqual(await probeMfaBypass('http://lab.local/', { ...BASE_OPTS, fetchFn, apiRoutes: [] }), []);
  });
  it('MFB-21: verify answering 2FA-not-enabled is uncalibrated — zero findings', async () => {
    const { fetchFn } = makeFakeJuice({ pending: true, verifyNotEnabled: true });
    const findings = await probeMfaBypass('http://lab.local/', { ...BASE_OPTS, fetchFn });
    assert.deepEqual(findings, []);
  });
});
