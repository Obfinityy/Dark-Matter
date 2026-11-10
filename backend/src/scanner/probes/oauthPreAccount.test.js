// Pre-account hijacking probe tests (row #488 [High] CWE-287;
// phase 'oauth-pre-account').
//
// The fake lab mirrors the lab's open registration, password login
// and magic-link flows. In 'vulnerable' mode the attacker password
// keeps working after the victim signs in via magic link; in
// 'secure' mode claiming the account invalidates the unverified
// password. The probe must fire only on the vulnerable lab.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  probeOauthPreAccount,
  assessPreAccountHijack,
  __oauthPreAccountMeta,
} from './oauthPreAccount.js';
import { verifyFindings } from '../verifier.js';

const LAB = 'http://localhost:3620';
const LAB_TARGETS = ['localhost:3620'];

function res(obj, status = 200) {
  return { status, text: async () => JSON.stringify(obj) };
}

function fakeLab(mode) {
  const users = new Map(); // email -> { password, claimed }
  return async (url, init = {}) => {
    const u = new URL(String(url));
    const body = init.body ? JSON.parse(init.body) : {};
    if (u.pathname === '/api/auth/register' && init.method === 'POST') {
      users.set(body.email, { password: body.password, claimed: false });
      return res({ userId: 1, email: body.email, verified: false, emailVerificationRequired: false }, 201);
    }
    if (u.pathname === '/api/auth/login' && init.method === 'POST') {
      const rec = users.get(body.email);
      if (!rec) return res({ error: 'invalid credentials' }, 401);
      if (mode === 'secure' && rec.claimed && body.password === rec.password) {
        return res({ error: 'password invalidated on claim — reset required' }, 401);
      }
      if (rec.password === body.password) return res({ sessionToken: 'sess-1', email: body.email, userId: 1 });
      return res({ error: 'invalid credentials' }, 401);
    }
    if (u.pathname === '/api/auth/magic-link' && init.method === 'POST') {
      return res({ email: body.email, token: 'ml-0001-x', expiresIn: null, singleUse: false });
    }
    if (u.pathname === '/api/auth/magic-link/redeem') {
      const email = [...users.keys()][0];
      if (email) users.get(email).claimed = true;
      return res({ sessionToken: 'sess-ml-1', email, tokenKind: 'magic-link', redeemedCount: 1 });
    }
    return res({ error: 'not found' }, 404);
  };
}

// ---- pure helpers ------------------------------------------------------------

test('PA-1: assessPreAccountHijack confirms password working before and after', () => {
  const v = assessPreAccountHijack({
    loginBefore: { status: 200, json: { sessionToken: 's1' } },
    loginAfter: { status: 200, json: { sessionToken: 's2' } },
    wrongLogin: { status: 401, json: {} },
  });
  assert.equal(v.verdict, 'confirmed');
});

test('PA-2: assessPreAccountHijack rejects when the password stops working after claim', () => {
  const v = assessPreAccountHijack({
    loginBefore: { status: 200, json: { sessionToken: 's1' } },
    loginAfter: { status: 401, json: {} },
    wrongLogin: { status: 401, json: {} },
  });
  assert.equal(v.verdict, 'rejected');
});

test('PA-3: assessPreAccountHijack is unconfirmed when the wrong password also logs in', () => {
  const v = assessPreAccountHijack({
    loginBefore: { status: 200, json: { sessionToken: 's1' } },
    loginAfter: { status: 200, json: { sessionToken: 's2' } },
    wrongLogin: { status: 200, json: { sessionToken: 's3' } },
  });
  assert.equal(v.verdict, 'unconfirmed');
});

test('PA-4: probe meta names the phase and standard/deep depths', () => {
  assert.deepEqual(__oauthPreAccountMeta.phases, ['oauth-pre-account']);
  assert.deepEqual(__oauthPreAccountMeta.depth, ['standard', 'deep']);
});

// ---- probe behaviour ---------------------------------------------------------

test('PA-5: vulnerable lab fires one high finding', async () => {
  const diag = {};
  const findings = await probeOauthPreAccount(LAB, [], {
    fetchFn: fakeLab('vulnerable'),
    labTargets: LAB_TARGETS,
    diagnostics: diag,
  });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].class, 'oauth_pre_account_hijacking');
  assert.equal(findings[0].severity, 'high');
  assert.equal(diag.verdict, 'confirmed');
  assert.ok(findings[0].evidence.signalCorrelated);
  const { confirmed } = verifyFindings(findings);
  assert.equal(confirmed.length, 1);
});

test('PA-6: secure lab (password invalidated on claim) stays quiet', async () => {
  const findings = await probeOauthPreAccount(LAB, [], {
    fetchFn: fakeLab('secure'),
    labTargets: LAB_TARGETS,
  });
  assert.equal(findings.length, 0);
});

test('PA-7: non-lab target is gated off without any request', async () => {
  let calls = 0;
  const fetchFn = async () => {
    calls += 1;
    return res({});
  };
  const findings = await probeOauthPreAccount('http://example.com/', [], {
    fetchFn,
    labTargets: LAB_TARGETS,
  });
  assert.equal(findings.length, 0);
  assert.equal(calls, 0);
});

test('PA-8: magic-link sign-in failing means no finding', async () => {
  const fetchFn = async (url, init = {}) => {
    const u = new URL(String(url));
    if (u.pathname === '/api/auth/register') return res({ userId: 1 }, 201);
    if (u.pathname === '/api/auth/login') return res({ sessionToken: 's1' });
    if (u.pathname === '/api/auth/magic-link') return res({ error: 'mail disabled' }, 500);
    return res({ error: 'not found' }, 404);
  };
  const findings = await probeOauthPreAccount(LAB, [], { fetchFn, labTargets: LAB_TARGETS });
  assert.equal(findings.length, 0);
});
