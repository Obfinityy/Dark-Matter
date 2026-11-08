// Tests for the 2FA code brute-force probe
// (coverage row #326 [High] Auth — 2FA code brute-force (no rate
// limit), CWE-307; phase 90).
// No network, no lab — the probe talks to the shop only through
// the opts.fetchFn seam, stubbed here by a stateful fake Juice
// Shop: login returns a token (+ tmpToken when 2FA is enabled on
// the canary), POST /rest/2fa/verify checks a code. Behaviour flags
// flip the fake between a vulnerable shop and a safe one.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  probeTwoFaBruteForce,
  twoFaVerifyRoute,
  assessVerifyResponse,
  assessBruteForce,
  findTmpToken,
} from './twoFaBruteForce.js';
import { verifyFindings } from '../verifier.js';

const ORIGIN = 'http://lab.local';
const ROUTES = [
  'http://lab.local/rest/2fa/verify',
  'http://lab.local/rest/2fa/status',
  'http://lab.local/rest/2fa/setup',
  'http://lab.local/rest/user/login',
  'http://lab.local/rest/user/whoami',
  'http://other.local/rest/2fa/verify',
];

const BASE_OPTS = {
  labCreds: { username: 'canary@lab.local', password: 'canary-pass' },
  allowWrite: true,
  labTargets: 'lab.local',
  apiRoutes: ROUTES,
};

// ---- stateful fake Juice ----------------------------------------------------
// behavior flags: throttleAt (nth verify POST answers 429),
// lockoutText (nth verify POST answers 400 with a lockout message),
// notEnabled (verify answers '2FA is not enabled'), error500At
// (nth verify POST answers 500), acceptCode (verify answers 200
// success on a wrong code), loginWithTmpToken (login returns a
// tmpToken, as Juice does when 2FA is enabled on the account).
function makeFakeJuice(behavior = {}) {
  const state = { verifyCount: 0, calls: [], bodies: [], authed: [] };
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
    state.authed.push(Boolean(init.headers && init.headers.Authorization));
    const json = (status, obj) => ({ status, text: async () => JSON.stringify(obj) });
    if (method === 'POST' && u.pathname === '/rest/user/login') {
      const auth = behavior.loginWithTmpToken
        ? { token: 'tok-1', tmpToken: 'tmp-1', umail: 'canary@lab.local' }
        : { token: 'tok-1', umail: 'canary@lab.local' };
      return json(200, { status: 'success', authentication: auth });
    }
    if (method === 'POST' && u.pathname === '/rest/2fa/verify') {
      state.verifyCount += 1;
      const n = state.verifyCount;
      if (behavior.throttleAt && n === behavior.throttleAt) {
        return json(429, { status: 'error', message: 'Too many requests' });
      }
      if (behavior.lockoutText && n === behavior.lockoutText) {
        return json(400, { status: 'error', message: 'Account locked: too many failed attempts' });
      }
      if (behavior.notEnabled) {
        return json(400, { status: 'error', message: '2FA is not enabled for this user' });
      }
      if (behavior.error500At && n === behavior.error500At) {
        return json(500, { status: 'error', message: 'internal error' });
      }
      if (behavior.acceptCode) {
        return json(200, { status: 'success', authentication: { token: 'tok-2' } });
      }
      return json(401, { status: 'error', message: 'Invalid code' });
    }
    return json(404, { status: 'error', message: 'not found' });
  };
  return { state, fetchFn };
}

// ---- pure assessors ---------------------------------------------------------

describe('assessVerifyResponse', () => {
  it('TFB-1: an ordinary invalid-code answer is wrong-code', () => {
    assert.equal(assessVerifyResponse(401, { status: 'error', message: 'Invalid code' }).kind, 'wrong-code');
    assert.equal(assessVerifyResponse(400, { status: 'error', message: 'Incorrect code' }).kind, 'wrong-code');
    assert.equal(
      assessVerifyResponse(200, { status: 'error', message: 'wrong code, try again' }).kind,
      'wrong-code'
    );
  });
  it('TFB-2: throttle signals are throttle — 429, lockout text, CAPTCHA, sudden 403', () => {
    assert.equal(assessVerifyResponse(429, { status: 'error' }).kind, 'throttle');
    assert.equal(
      assessVerifyResponse(400, { status: 'error', message: 'Account locked: too many attempts' }).kind,
      'throttle'
    );
    assert.equal(
      assessVerifyResponse(400, { status: 'error', message: 'Please complete the CAPTCHA' }).kind,
      'throttle'
    );
    assert.equal(assessVerifyResponse(403, { status: 'error', message: 'forbidden' }).kind, 'throttle');
  });
  it('TFB-3: uncalibrated answers are uncalibrated — 404, 422, 2FA-not-enabled, missing field', () => {
    assert.equal(assessVerifyResponse(404, { status: 'error' }).kind, 'uncalibrated');
    assert.equal(assessVerifyResponse(422, { status: 'error' }).kind, 'uncalibrated');
    assert.equal(
      assessVerifyResponse(400, { status: 'error', message: '2FA is not enabled for this user' }).kind,
      'uncalibrated'
    );
    assert.equal(
      assessVerifyResponse(400, { status: 'error', message: 'totpToken is required' }).kind,
      'uncalibrated'
    );
  });
});

describe('assessBruteForce', () => {
  it('TFB-4: 10 wrong codes with no throttle confirms; 9 is inconclusive; throttle rejects; 0 is uncalibrated', () => {
    assert.equal(assessBruteForce(10, false).verdict, 'confirmed');
    assert.equal(assessBruteForce(9, false).verdict, 'inconclusive');
    assert.equal(assessBruteForce(4, true).verdict, 'rejected');
    assert.equal(assessBruteForce(0, false).verdict, 'uncalibrated');
  });
});

describe('twoFaVerifyRoute + findTmpToken', () => {
  it('TFB-5: the verify route is picked; status/setup and cross-origin routes are ignored', () => {
    assert.equal(twoFaVerifyRoute(ROUTES, ORIGIN), 'http://lab.local/rest/2fa/verify');
    assert.equal(
      twoFaVerifyRoute(['http://lab.local/rest/2fa/status', 'http://lab.local/rest/2fa/setup'], ORIGIN),
      null
    );
    assert.equal(twoFaVerifyRoute(['http://other.local/rest/2fa/verify'], ORIGIN), null);
    assert.equal(findTmpToken({ authentication: { tmpToken: 'tmp-1', token: 'tok-1' } }), 'tmp-1');
    assert.equal(findTmpToken({ authentication: { token: 'tok-1' } }), null);
  });
});

// ---- the probe, end to end against the fake ---------------------------------

describe('probeTwoFaBruteForce — vulnerable shop', () => {
  it('TFB-6: ten wrong codes with no throttle fires exactly one [High] auth_2fa finding', async () => {
    const { state, fetchFn } = makeFakeJuice();
    const diag = {};
    const findings = await probeTwoFaBruteForce('http://lab.local/', {
      ...BASE_OPTS,
      fetchFn,
      diagnostics: diag,
    });
    assert.equal(findings.length, 1, `expected 1 finding, got: ${findings.map((f) => f.title).join(' | ')}`);
    assert.match(findings[0].title, /repeated wrong codes without rate limiting/);
    assert.equal(findings[0].severity, 'high');
    assert.equal(findings[0].class, 'auth_2fa');
    assert.equal(diag.twoFaRoutes, 1);
    assert.equal(diag.controlOk, true);
    assert.equal(diag.attempts, 10);
    assert.equal(state.verifyCount, 10, 'exactly 10 verify POSTs');
    assert.ok(state.calls.filter((c) => c === 'POST /rest/2fa/verify').length === 10);
    assert.ok(
      state.calls
        .map((c, i) => [c, state.authed[i]])
        .filter(([c]) => c === 'POST /rest/2fa/verify')
        .every(([, a]) => a === true),
      'every verify call carries the Bearer token'
    );
    assert.ok(!state.calls.some((c) => /dmprobe/.test(c)), 'no filler id may reach the shop');
  });
  it('TFB-7: the fired finding verifies as confirmed through the real pipeline', async () => {
    const { fetchFn } = makeFakeJuice();
    const findings = await probeTwoFaBruteForce('http://lab.local/', { ...BASE_OPTS, fetchFn });
    const { confirmed, unconfirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
    assert.equal(unconfirmed.length, 0);
    assert.equal(confirmed[0].confirmation, 'confirmed');
  });
});

describe('probeTwoFaBruteForce — safe shop', () => {
  it('TFB-8: a 429 on the 4th attempt stops the probe with zero findings', async () => {
    const { state, fetchFn } = makeFakeJuice({ throttleAt: 4 });
    const diag = {};
    const findings = await probeTwoFaBruteForce('http://lab.local/', {
      ...BASE_OPTS,
      fetchFn,
      diagnostics: diag,
    });
    assert.deepEqual(findings, []);
    assert.equal(diag.controlOk, true);
    assert.equal(diag.attempts, 3);
    assert.equal(state.verifyCount, 4, 'stops on the throttle, never retries');
  });
  it('TFB-9: a lockout message stops the probe with zero findings', async () => {
    const { fetchFn } = makeFakeJuice({ lockoutText: 2 });
    const findings = await probeTwoFaBruteForce('http://lab.local/', { ...BASE_OPTS, fetchFn });
    assert.deepEqual(findings, []);
  });
  it('TFB-10: 2FA-not-enabled is uncalibrated — zero findings, control never set', async () => {
    const { fetchFn } = makeFakeJuice({ notEnabled: true });
    const diag = {};
    const findings = await probeTwoFaBruteForce('http://lab.local/', {
      ...BASE_OPTS,
      fetchFn,
      diagnostics: diag,
    });
    assert.deepEqual(findings, []);
    assert.equal(diag.controlOk, undefined);
  });
});

describe('probeTwoFaBruteForce — threshold and login', () => {
  it('TFB-11: nine wrong codes then a 500 is inconclusive — zero findings (all-10 rule)', async () => {
    const { state, fetchFn } = makeFakeJuice({ error500At: 10 });
    const findings = await probeTwoFaBruteForce('http://lab.local/', { ...BASE_OPTS, fetchFn });
    assert.deepEqual(findings, []);
    assert.equal(state.verifyCount, 10);
  });
  it('TFB-12: login with a tmpToken carries it on every verify call; finding still fires', async () => {
    const { state, fetchFn } = makeFakeJuice({ loginWithTmpToken: true });
    const findings = await probeTwoFaBruteForce('http://lab.local/', { ...BASE_OPTS, fetchFn });
    assert.equal(findings.length, 1);
    const verifyBodies = state.bodies.filter((b) => b && typeof b.totpToken === 'string');
    assert.equal(verifyBodies.length, 10);
    assert.ok(verifyBodies.every((b) => b.tmpToken === 'tmp-1'), 'tmpToken must ride every verify call');
  });
  it('TFB-13: a 200 success on a wrong code is ambiguous — zero findings, never a finding', async () => {
    const { fetchFn } = makeFakeJuice({ acceptCode: true });
    const findings = await probeTwoFaBruteForce('http://lab.local/', { ...BASE_OPTS, fetchFn });
    assert.deepEqual(findings, []);
  });
});

describe('probeTwoFaBruteForce — missing surface and gates', () => {
  it('TFB-14: no verify route yields zero findings', async () => {
    const { fetchFn } = makeFakeJuice();
    const routes = ROUTES.filter((r) => !r.includes('/verify'));
    assert.deepEqual(await probeTwoFaBruteForce('http://lab.local/', { ...BASE_OPTS, fetchFn, apiRoutes: routes }), []);
  });
  it('TFB-15: no lab creds, no write, non-lab host, quick depth, or no routes — all silent', async () => {
    const { fetchFn } = makeFakeJuice();
    assert.deepEqual(await probeTwoFaBruteForce('http://lab.local/', { ...BASE_OPTS, fetchFn, labCreds: null }), []);
    assert.deepEqual(await probeTwoFaBruteForce('http://lab.local/', { ...BASE_OPTS, fetchFn, allowWrite: false }), []);
    assert.deepEqual(await probeTwoFaBruteForce('http://lab.local/', { ...BASE_OPTS, fetchFn, labTargets: 'other.local' }), []);
    assert.deepEqual(await probeTwoFaBruteForce('http://lab.local/', { ...BASE_OPTS, fetchFn, depth: 'quick' }), []);
    assert.deepEqual(await probeTwoFaBruteForce('http://lab.local/', { ...BASE_OPTS, fetchFn, apiRoutes: [] }), []);
  });
});
