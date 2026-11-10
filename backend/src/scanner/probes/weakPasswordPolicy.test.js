// Tests for the weak password policy probe
// (coverage row #55 [Medium] Weak Password Policy, CWE-521 | ASVS
// V6; phase 111).
// No network, no lab — the probe talks to the shop only through
// the opts.fetchFn seam, stubbed here by a stateful fake API:
// POST /api/Users (and /register) answer per-password: a
// vulnerable API accepts every password, a strict one accepts
// only the strong control password, a broken one refuses the
// control too. Behaviour flags flip the fake between those.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  probeWeakPasswordPolicy,
  assessRegisterResponse,
  assessWeakPasswordFlow,
} from './weakPasswordPolicy.js';
import { verifyFindings } from '../verifier.js';

const ORIGIN = 'http://lab.local';
const ROUTES = [
  'http://lab.local/api/Products',
  'http://lab.local/rest/user/login',
  'http://lab.local/api/Users',
  'http://other.local/api/Users',
];

const BASE_OPTS = {
  labCreds: { username: 'canary@lab.local', password: 'canary-pass' },
  allowWrite: true,
  labTargets: 'lab.local',
  apiRoutes: ROUTES,
};

// ---- stateful fake API ------------------------------------------------------
// registerFn(password, pathname) => { status, body } — the fake
// answers POSTs to any path with that judgement; GETs answer 404.
function makeFakeApi(registerFn) {
  const state = { calls: [] };
  const fetchFn = async (url, init = {}) => {
    const method = String(init.method || 'GET').toUpperCase();
    const u = new URL(String(url));
    let password = null;
    let email = null;
    try {
      const parsed = JSON.parse(String(init.body || '{}'));
      password = parsed.password || null;
      email = parsed.email || null;
    } catch {
      // unparseable body — the probe always sends JSON
    }
    state.calls.push({ method, pathname: u.pathname, password, email });
    if (method !== 'POST') {
      return { status: 404, text: async () => JSON.stringify({ status: 'error' }) };
    }
    const r = registerFn(password, u.pathname);
    return { status: r.status, text: async () => JSON.stringify(r.body) };
  };
  return { state, fetchFn };
}

const acceptAll = () => ({ status: 201, body: { status: 'success', data: { id: 7 } } });
const strictPolicy = (password) =>
  password === 'Dm-Strong-9xQw!z7'
    ? { status: 201, body: { status: 'success', data: { id: 7 } } }
    : { status: 400, body: { message: 'Password must be at least 8 characters long' } };
const minLength5 = (password) =>
  password === 'Dm-Strong-9xQw!z7' || password.length >= 6
    ? { status: 201, body: { status: 'success', data: { id: 7 } } }
    : { status: 400, body: { message: 'Password must be at least 5 characters long' } };
const controlRefused = () => ({ status: 400, body: { message: 'Security question is required' } });
const serverError = () => ({ status: 500, body: { status: 'error', message: 'internal error' } });

// ---- pure assessors ---------------------------------------------------------

describe('assessRegisterResponse', () => {
  it('WPP-1: a 2xx JSON answer is accepted; an empty or HTML 2xx is other', () => {
    assert.equal(assessRegisterResponse(201, '{"status":"success","data":{"id":7}}').kind, 'accepted');
    assert.equal(assessRegisterResponse(200, '{"id":7}', null).kind, 'accepted');
    assert.equal(assessRegisterResponse(201, '', null).kind, 'other');
    assert.equal(assessRegisterResponse(200, '<html><body>shop</body></html>', null).kind, 'other');
  });
  it('WPP-2: 400/409/422, refusal text and a 2xx error payload are rejected; 500/302 are other', () => {
    assert.equal(
      assessRegisterResponse(400, '{"message":"Password must be at least 8 characters long"}').kind,
      'rejected'
    );
    assert.equal(assessRegisterResponse(409, '{"message":"Email already in use"}').kind, 'rejected');
    assert.equal(assessRegisterResponse(422, '{"message":"weak password"}').kind, 'rejected');
    assert.equal(
      assessRegisterResponse(200, '{"message":"Password too short"}').kind,
      'rejected'
    );
    assert.equal(
      assessRegisterResponse(200, '{"status":"error","message":"registration failed"}').kind,
      'rejected'
    );
    assert.equal(assessRegisterResponse(200, '{"success":false}').kind, 'rejected');
    assert.equal(assessRegisterResponse(500, '{"status":"error"}').kind, 'other');
    assert.equal(assessRegisterResponse(302, '', null).kind, 'other');
  });
});

describe('assessWeakPasswordFlow', () => {
  it('WPP-3: control + trivial accepted confirms; control + trivial refused rejects; no control is uncalibrated', () => {
    assert.equal(assessWeakPasswordFlow('accepted', 'accepted').verdict, 'confirmed');
    assert.equal(assessWeakPasswordFlow('accepted', 'rejected').verdict, 'rejected');
    assert.equal(assessWeakPasswordFlow('accepted', 'other').verdict, 'uncalibrated');
    assert.equal(assessWeakPasswordFlow('rejected', 'accepted').verdict, 'uncalibrated');
    assert.equal(assessWeakPasswordFlow('other', 'other').verdict, 'uncalibrated');
  });
});

// ---- the probe, end to end against the fake ---------------------------------

describe('probeWeakPasswordPolicy — vulnerable API', () => {
  it('WPP-4: control + a 1-character password fires exactly one [Medium] weak_password_policy finding', async () => {
    const { state, fetchFn } = makeFakeApi(acceptAll);
    const diag = {};
    const findings = await probeWeakPasswordPolicy('http://lab.local/', {
      ...BASE_OPTS,
      fetchFn,
      diagnostics: diag,
    });
    assert.equal(findings.length, 1, `expected 1 finding, got: ${findings.map((f) => f.title).join(' | ')}`);
    assert.match(findings[0].title, /trivial password accepted/);
    assert.equal(findings[0].severity, 'medium');
    assert.equal(findings[0].class, 'weak_password_policy');
    assert.equal(findings[0].parameter, 'password');
    assert.equal(findings[0].url, 'http://lab.local/api/Users');
    assert.equal(diag.registerRoutes, 1);
    assert.equal(diag.controlOk, true);
    assert.equal(diag.attempts, 1, 'stops at the first accepted trivial password');
    assert.equal(diag.acceptedKind, 'single-char');
    assert.equal(diag.bypassKind, 'trivial-password-accepted');
    assert.equal(state.calls.length, 2, '1 control + 1 trivial POST');
    assert.ok(state.calls.every((c) => c.method === 'POST'), 'the probe only POSTs — no GETs');
    assert.notEqual(state.calls[0].email, state.calls[1].email, 'each attempt uses a fresh email');
    assert.equal(state.calls[0].password, 'Dm-Strong-9xQw!z7', 'the control registers first');
    assert.equal(state.calls[1].password, 'a', 'the weakest trivial password is tried first');
  });
  it('WPP-5: the fired finding verifies as confirmed through the real pipeline', async () => {
    const { fetchFn } = makeFakeApi(acceptAll);
    const findings = await probeWeakPasswordPolicy('http://lab.local/', { ...BASE_OPTS, fetchFn });
    const { confirmed, unconfirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
    assert.equal(unconfirmed.length, 0);
    assert.equal(confirmed[0].confirmation, 'confirmed');
  });
  it('WPP-6: a strict policy refuses every trivial password — zero findings, proven true negative', async () => {
    const { state, fetchFn } = makeFakeApi(strictPolicy);
    const diag = {};
    const findings = await probeWeakPasswordPolicy('http://lab.local/', {
      ...BASE_OPTS,
      fetchFn,
      diagnostics: diag,
    });
    assert.deepEqual(findings, []);
    assert.equal(diag.registerRoutes, 1);
    assert.equal(diag.controlOk, true);
    assert.equal(diag.attempts, 3, 'all three trivial passwords tried and refused');
    assert.equal(diag.acceptedKind, undefined);
    assert.equal(state.calls.length, 4, '1 control + 3 trivial POSTs');
    assert.deepEqual(
      state.calls.slice(1).map((c) => c.password),
      ['a', '123456', 'password']
    );
  });
  it('WPP-7: a 5-character minimum refuses \'a\' but accepts \'123456\' — confirms on the second trivial', async () => {
    const { state, fetchFn } = makeFakeApi(minLength5);
    const diag = {};
    const findings = await probeWeakPasswordPolicy('http://lab.local/', {
      ...BASE_OPTS,
      fetchFn,
      diagnostics: diag,
    });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].class, 'weak_password_policy');
    assert.equal(diag.controlOk, true);
    assert.equal(diag.attempts, 2);
    assert.equal(diag.acceptedKind, 'common-numeric');
    assert.equal(state.calls.length, 3, '1 control + 2 trivial POSTs, stops at the acceptance');
  });
});

describe('probeWeakPasswordPolicy — uncalibrated and multi-route', () => {
  it('WPP-8: a refused control is uncalibrated — zero findings, no trivial attempts', async () => {
    const { state, fetchFn } = makeFakeApi(controlRefused);
    const diag = {};
    const findings = await probeWeakPasswordPolicy('http://lab.local/', {
      ...BASE_OPTS,
      fetchFn,
      diagnostics: diag,
    });
    assert.deepEqual(findings, []);
    assert.equal(diag.controlOk, undefined);
    assert.equal(diag.attempts, undefined);
    assert.equal(state.calls.length, 1, 'control only — the probe never tries a trivial password');
  });
  it('WPP-9: the control falls through to a second register route and confirms there', async () => {
    const { state, fetchFn } = makeFakeApi((password, pathname) =>
      pathname === '/api/Users' ? controlRefused() : acceptAll()
    );
    const diag = {};
    const findings = await probeWeakPasswordPolicy('http://lab.local/', {
      ...BASE_OPTS,
      fetchFn,
      apiRoutes: ['http://lab.local/register', 'http://lab.local/api/Users'],
      diagnostics: diag,
    });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].url, 'http://lab.local/register');
    assert.equal(diag.registerRoutes, 2);
    assert.equal(diag.controlOk, true);
    assert.equal(diag.attempts, 1);
    assert.equal(state.calls.length, 3, 'control route 1 + control route 2 + 1 trivial POST');
  });
  it('WPP-10: a 500 on every registration is inconclusive — zero findings', async () => {
    const { state, fetchFn } = makeFakeApi(serverError);
    const diag = {};
    const findings = await probeWeakPasswordPolicy('http://lab.local/', {
      ...BASE_OPTS,
      fetchFn,
      diagnostics: diag,
    });
    assert.deepEqual(findings, []);
    assert.equal(diag.controlOk, undefined);
    assert.equal(state.calls.length, 1, 'control only — a 500 is not a control');
  });
});

describe('probeWeakPasswordPolicy — missing surface and gates', () => {
  it('WPP-11: no registration route yields zero findings', async () => {
    const { state, fetchFn } = makeFakeApi(acceptAll);
    const routes = ROUTES.filter((r) => !/Users/i.test(r));
    const diag = {};
    const findings = await probeWeakPasswordPolicy('http://lab.local/', {
      ...BASE_OPTS,
      fetchFn,
      apiRoutes: routes,
      diagnostics: diag,
    });
    assert.deepEqual(findings, []);
    assert.equal(diag.registerRoutes, 0);
    assert.equal(state.calls.length, 0, 'no route mined, no request sent');
  });
  it('WPP-12: no lab creds, no write, non-lab host, quick depth, or no routes — all silent', async () => {
    const { state, fetchFn } = makeFakeApi(acceptAll);
    assert.deepEqual(await probeWeakPasswordPolicy('http://lab.local/', { ...BASE_OPTS, fetchFn, labCreds: null }), []);
    assert.deepEqual(await probeWeakPasswordPolicy('http://lab.local/', { ...BASE_OPTS, fetchFn, allowWrite: false }), []);
    assert.deepEqual(await probeWeakPasswordPolicy('http://lab.local/', { ...BASE_OPTS, fetchFn, labTargets: 'other.local' }), []);
    assert.deepEqual(await probeWeakPasswordPolicy('http://lab.local/', { ...BASE_OPTS, fetchFn, depth: 'quick' }), []);
    assert.deepEqual(await probeWeakPasswordPolicy('http://lab.local/', { ...BASE_OPTS, fetchFn, apiRoutes: [] }), []);
    assert.equal(state.calls.length, 0, 'gated probes send no requests at all');
  });
});
