// Tests for the credential stuffing probe
// (coverage row #42 [High] Credential Stuffing, OWASP A07:2021;
// phase 92).
// No network, no lab — the probe talks to the shop only through
// the opts.fetchFn seam, stubbed here by a stateful fake Juice
// Shop: POST /rest/user/login checks a password. Behaviour flags
// flip the fake between a vulnerable shop and a safe one.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  probeCredentialStuffing,
  assessLoginResponse,
  assessStuffing,
} from './credentialStuffing.js';
import { loginCandidates } from './sessionFixation.js';
import { verifyFindings } from '../verifier.js';

const ORIGIN = 'http://lab.local';
const ROUTES = [
  'http://lab.local/rest/user/login',
  'http://lab.local/rest/user/whoami',
  'http://lab.local/rest/saveLoginIp',
  'http://other.local/rest/user/login',
];

const BASE_OPTS = {
  labCreds: { username: 'canary@lab.local', password: 'canary-pass' },
  allowWrite: true,
  labTargets: 'lab.local',
  apiRoutes: ROUTES,
};

// ---- stateful fake Juice ----------------------------------------------------
// behavior flags: throttleAt (nth login POST answers 429),
// lockoutText (nth login POST answers 400 with a lockout message),
// userNotFound (login answers 'User not found'), error500At
// (nth login POST answers 500), acceptPassword (login answers 200
// success on a wrong password), emailShapeRejected (an {email}
// body is answered 'username is required', a {username} body is
// answered 401 invalid — tests the shape fallback).
function makeFakeJuice(behavior = {}) {
  const state = { loginCount: 0, calls: [], bodies: [] };
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
    const json = (status, obj) => ({ status, text: async () => JSON.stringify(obj) });
    if (method === 'POST' && u.pathname === '/rest/user/login') {
      state.loginCount += 1;
      const n = state.loginCount;
      if (behavior.throttleAt && n === behavior.throttleAt) {
        return json(429, { status: 'error', message: 'Too many requests' });
      }
      if (behavior.lockoutText && n === behavior.lockoutText) {
        return json(400, { status: 'error', message: 'Account locked: too many failed attempts' });
      }
      if (behavior.userNotFound) {
        return json(400, { status: 'error', message: 'User not found' });
      }
      if (behavior.error500At && n === behavior.error500At) {
        return json(500, { status: 'error', message: 'internal error' });
      }
      if (behavior.acceptPassword) {
        return json(200, { status: 'success', authentication: { token: 'tok-2' } });
      }
      if (behavior.emailShapeRejected && body && typeof body.email === 'string') {
        return json(400, { status: 'error', message: 'username is required' });
      }
      return json(401, { status: 'error', message: 'Invalid email or password.' });
    }
    return json(404, { status: 'error', message: 'not found' });
  };
  return { state, fetchFn };
}

// ---- pure assessors ---------------------------------------------------------

describe('assessLoginResponse', () => {
  it('CS-1: ordinary invalid-credential answers are invalid', () => {
    assert.equal(assessLoginResponse(401, { status: 'error', message: 'Invalid email or password.' }).kind, 'invalid');
    assert.equal(assessLoginResponse(400, { status: 'error', message: 'Login failed' }).kind, 'invalid');
    assert.equal(
      assessLoginResponse(200, { status: 'error', message: 'Invalid credentials, please try again' }).kind,
      'invalid'
    );
  });
  it('CS-2: throttle signals are throttle — 429, lockout text, CAPTCHA, sudden 403', () => {
    assert.equal(assessLoginResponse(429, { status: 'error' }).kind, 'throttle');
    assert.equal(
      assessLoginResponse(400, { status: 'error', message: 'Account locked: too many attempts' }).kind,
      'throttle'
    );
    assert.equal(
      assessLoginResponse(400, { status: 'error', message: 'Please complete the CAPTCHA' }).kind,
      'throttle'
    );
    assert.equal(assessLoginResponse(403, { status: 'error', message: 'forbidden' }).kind, 'throttle');
  });
  it('CS-3: uncalibrated answers are uncalibrated — 404, 422, valid-email format, missing field, user-not-found', () => {
    assert.equal(assessLoginResponse(404, { status: 'error' }).kind, 'uncalibrated');
    assert.equal(assessLoginResponse(422, { status: 'error' }).kind, 'uncalibrated');
    assert.equal(
      assessLoginResponse(400, { status: 'error', message: 'Please enter a valid email address' }).kind,
      'uncalibrated'
    );
    assert.equal(
      assessLoginResponse(400, { status: 'error', message: 'username is required' }).kind,
      'uncalibrated'
    );
    assert.equal(
      assessLoginResponse(400, { status: 'error', message: 'User not found' }).kind,
      'uncalibrated'
    );
  });
});

describe('assessStuffing', () => {
  it('CS-4: 10 wrong passwords with no throttle confirms; 9 is inconclusive; throttle rejects; 0 is uncalibrated', () => {
    assert.equal(assessStuffing(10, false).verdict, 'confirmed');
    assert.equal(assessStuffing(9, false).verdict, 'inconclusive');
    assert.equal(assessStuffing(4, true).verdict, 'rejected');
    assert.equal(assessStuffing(0, false).verdict, 'uncalibrated');
  });
});

describe('loginCandidates (sessionFixation.js)', () => {
  it('CS-5: the exact /login route is picked first; cross-origin routes are ignored', () => {
    assert.equal(loginCandidates(ROUTES, ORIGIN)[0], 'http://lab.local/rest/user/login');
    assert.deepEqual(loginCandidates(['http://other.local/rest/user/login'], ORIGIN), []);
    assert.deepEqual(loginCandidates([], ORIGIN), []);
  });
});

// ---- the probe, end to end against the fake ---------------------------------

describe('probeCredentialStuffing — vulnerable shop', () => {
  it('CS-6: ten wrong passwords with no throttle fires exactly one [High] auth_bruteforce finding', async () => {
    const { state, fetchFn } = makeFakeJuice();
    const diag = {};
    const findings = await probeCredentialStuffing('http://lab.local/', {
      ...BASE_OPTS,
      fetchFn,
      diagnostics: diag,
    });
    assert.equal(findings.length, 1, `expected 1 finding, got: ${findings.map((f) => f.title).join(' | ')}`);
    assert.match(findings[0].title, /repeated wrong passwords without rate limiting/);
    assert.equal(findings[0].severity, 'high');
    assert.equal(findings[0].class, 'auth_bruteforce');
    assert.equal(findings[0].parameter, 'password');
    assert.equal(diag.loginRoutes, 1);
    assert.equal(diag.controlOk, true);
    assert.equal(diag.attempts, 10);
    assert.equal(state.loginCount, 10, 'exactly 10 login POSTs');
    assert.ok(state.calls.filter((c) => c === 'POST /rest/user/login').length === 10);
    const passwords = state.bodies.map((b) => b && b.password);
    assert.equal(new Set(passwords).size, 10, 'all 10 wrong passwords are distinct');
    assert.ok(!passwords.includes('canary-pass'), 'the real password must never be sent');
    assert.ok(!state.calls.some((c) => /dmprobe/.test(c)), 'no filler id may reach the shop');
  });
  it('CS-7: the fired finding verifies as confirmed through the real pipeline', async () => {
    const { fetchFn } = makeFakeJuice();
    const findings = await probeCredentialStuffing('http://lab.local/', { ...BASE_OPTS, fetchFn });
    const { confirmed, unconfirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
    assert.equal(unconfirmed.length, 0);
    assert.equal(confirmed[0].confirmation, 'confirmed');
  });
});

describe('probeCredentialStuffing — safe shop', () => {
  it('CS-8: a 429 on the 4th attempt stops the probe with zero findings', async () => {
    const { state, fetchFn } = makeFakeJuice({ throttleAt: 4 });
    const diag = {};
    const findings = await probeCredentialStuffing('http://lab.local/', {
      ...BASE_OPTS,
      fetchFn,
      diagnostics: diag,
    });
    assert.deepEqual(findings, []);
    assert.equal(diag.controlOk, true);
    assert.equal(diag.attempts, 3);
    assert.equal(state.loginCount, 4, 'stops on the throttle, never retries');
  });
  it('CS-9: a lockout message stops the probe with zero findings', async () => {
    const { fetchFn } = makeFakeJuice({ lockoutText: 2 });
    const findings = await probeCredentialStuffing('http://lab.local/', { ...BASE_OPTS, fetchFn });
    assert.deepEqual(findings, []);
  });
  it('CS-10: user-not-found is uncalibrated — zero findings, control never set', async () => {
    const { fetchFn } = makeFakeJuice({ userNotFound: true });
    const diag = {};
    const findings = await probeCredentialStuffing('http://lab.local/', {
      ...BASE_OPTS,
      fetchFn,
      diagnostics: diag,
    });
    assert.deepEqual(findings, []);
    assert.equal(diag.controlOk, undefined);
  });
});

describe('probeCredentialStuffing — threshold, shapes, and login', () => {
  it('CS-11: nine wrong passwords then a 500 is inconclusive — zero findings (all-10 rule)', async () => {
    const { state, fetchFn } = makeFakeJuice({ error500At: 10 });
    const findings = await probeCredentialStuffing('http://lab.local/', { ...BASE_OPTS, fetchFn });
    assert.deepEqual(findings, []);
    assert.equal(state.loginCount, 10);
  });
  it('CS-12: a rejected {email} shape falls back to {username}; finding still fires', async () => {
    const { state, fetchFn } = makeFakeJuice({ emailShapeRejected: true });
    const findings = await probeCredentialStuffing('http://lab.local/', { ...BASE_OPTS, fetchFn });
    assert.equal(findings.length, 1);
    assert.equal(state.loginCount, 11, '1 rejected shape probe + 10 calibrated attempts');
    assert.ok(typeof state.bodies[0].email === 'string', 'first probe uses the {email} shape');
    assert.ok(
      state.bodies.slice(1).every((b) => typeof b.username === 'string'),
      'every later attempt uses the {username} shape'
    );
    const passwords = state.bodies.map((b) => b && b.password);
    assert.equal(new Set(passwords).size, 10, 'all 10 wrong passwords are distinct');
  });
  it('CS-13: a 200 success on a wrong password is ambiguous — zero findings, never a finding', async () => {
    const { fetchFn } = makeFakeJuice({ acceptPassword: true });
    const findings = await probeCredentialStuffing('http://lab.local/', { ...BASE_OPTS, fetchFn });
    assert.deepEqual(findings, []);
  });
});

describe('probeCredentialStuffing — missing surface and gates', () => {
  it('CS-14: no login route yields zero findings', async () => {
    const { fetchFn } = makeFakeJuice();
    const routes = ROUTES.filter((r) => !/login/i.test(r));
    assert.deepEqual(await probeCredentialStuffing('http://lab.local/', { ...BASE_OPTS, fetchFn, apiRoutes: routes }), []);
  });
  it('CS-15: no lab creds, no write, non-lab host, quick depth, or no routes — all silent', async () => {
    const { fetchFn } = makeFakeJuice();
    assert.deepEqual(await probeCredentialStuffing('http://lab.local/', { ...BASE_OPTS, fetchFn, labCreds: null }), []);
    assert.deepEqual(await probeCredentialStuffing('http://lab.local/', { ...BASE_OPTS, fetchFn, allowWrite: false }), []);
    assert.deepEqual(await probeCredentialStuffing('http://lab.local/', { ...BASE_OPTS, fetchFn, labTargets: 'other.local' }), []);
    assert.deepEqual(await probeCredentialStuffing('http://lab.local/', { ...BASE_OPTS, fetchFn, depth: 'quick' }), []);
    assert.deepEqual(await probeCredentialStuffing('http://lab.local/', { ...BASE_OPTS, fetchFn, apiRoutes: [] }), []);
  });
});
