// OAuth authorization-code injection probe tests (row #491 [High]
// CWE-352; phase 'oauth-code-injection').
//
// The fake lab mirrors the lab's register/login, IdP registration,
// authorize, callback and /api/auth/me endpoints. In 'vulnerable'
// mode the callback never validates state and overwrites the
// caller's session to the code owner; in 'secure' mode a bogus state
// is rejected and a valid-state callback for the caller's own code
// leaves the session unchanged. The probe must fire only on the
// vulnerable lab.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  probeOauthCodeInjection,
  assessCodeInjection,
  __oauthCodeInjectionMeta,
} from './oauthCodeInjection.js';
import { verifyFindings } from '../verifier.js';

const LAB = 'http://localhost:3620';
const LAB_TARGETS = ['localhost:3620'];

function res(obj, status = 200) {
  return { status, text: async () => JSON.stringify(obj) };
}

function fakeLab(mode) {
  const codes = new Map(); // code -> email
  const sessions = new Map(); // session -> email
  let seq = 0;
  return async (url, init = {}) => {
    const u = new URL(String(url));
    const body = init.body ? JSON.parse(init.body) : {};
    if (u.pathname === '/api/auth/register' && init.method === 'POST') {
      return res({ userId: 1, email: body.email, verified: false }, 201);
    }
    if (u.pathname === '/api/auth/login' && init.method === 'POST') {
      seq += 1;
      const token = `sess-${seq}`;
      sessions.set(token, body.email);
      return res({ sessionToken: token, email: body.email, userId: 1 });
    }
    const idpReg = u.pathname.match(/^\/idp\/([^/]+)\/register$/);
    if (idpReg && init.method === 'POST') return res({ idp: idpReg[1], email: body.email, verified: false }, 201);
    if (u.pathname === '/oauth/authorize') {
      seq += 1;
      const code = `code-${seq}`;
      const state = `st-${seq}`;
      codes.set(code, { email: u.searchParams.get('email'), state });
      return res({ code, state, email: u.searchParams.get('email') });
    }
    if (u.pathname === '/oauth/callback') {
      const rec = codes.get(u.searchParams.get('code'));
      if (!rec) return res({ error: 'invalid code' }, 400);
      const session = u.searchParams.get('session');
      if (mode === 'secure' && u.searchParams.get('state') !== rec.state) {
        return res({ error: 'invalid state' }, 400);
      }
      if (session && sessions.has(session)) {
        sessions.set(session, rec.email);
        return res({ sessionToken: session, email: rec.email, stateValidated: mode === 'secure' });
      }
      return res({ sessionToken: 'sess-new', email: rec.email });
    }
    if (u.pathname === '/api/auth/me') {
      const token = u.searchParams.get('session');
      const email = sessions.get(token);
      if (!email) return res({ error: 'unknown session' }, 401);
      return res({ email, userId: 1, linkedIdentities: [] });
    }
    return res({ error: 'not found' }, 404);
  };
}

// ---- pure helpers ------------------------------------------------------------

test('CI-1: assessCodeInjection confirms swap + unchanged control', () => {
  const v = assessCodeInjection({
    attackMeEmail: 'attacker@example.com',
    controlMeEmail: 'victim@example.com',
    victimEmail: 'victim@example.com',
    attackerEmail: 'attacker@example.com',
  });
  assert.equal(v.verdict, 'confirmed');
});

test('CI-2: assessCodeInjection rejects when the victim session is unchanged', () => {
  const v = assessCodeInjection({
    attackMeEmail: 'victim@example.com',
    controlMeEmail: 'victim@example.com',
    victimEmail: 'victim@example.com',
    attackerEmail: 'attacker@example.com',
  });
  assert.equal(v.verdict, 'rejected');
});

test('CI-3: assessCodeInjection is unconfirmed when the control also swaps', () => {
  const v = assessCodeInjection({
    attackMeEmail: 'attacker@example.com',
    controlMeEmail: 'attacker@example.com',
    victimEmail: 'victim@example.com',
    attackerEmail: 'attacker@example.com',
  });
  assert.equal(v.verdict, 'unconfirmed');
});

test('CI-4: probe meta names the phase and standard/deep depths', () => {
  assert.deepEqual(__oauthCodeInjectionMeta.phases, ['oauth-code-injection']);
  assert.deepEqual(__oauthCodeInjectionMeta.depth, ['standard', 'deep']);
});

// ---- probe behaviour ---------------------------------------------------------

test('CI-5: vulnerable lab fires one high finding', async () => {
  const diag = {};
  const findings = await probeOauthCodeInjection(LAB, [], {
    fetchFn: fakeLab('vulnerable'),
    labTargets: LAB_TARGETS,
    diagnostics: diag,
  });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].class, 'oauth_code_injection');
  assert.equal(findings[0].severity, 'high');
  assert.equal(diag.verdict, 'confirmed');
  assert.ok(diag.attackMeEmail && diag.attackMeEmail !== diag.controlMeEmail);
  const { confirmed } = verifyFindings(findings);
  assert.equal(confirmed.length, 1);
});

test('CI-6: secure lab (state validated) stays quiet', async () => {
  const findings = await probeOauthCodeInjection(LAB, [], {
    fetchFn: fakeLab('secure'),
    labTargets: LAB_TARGETS,
  });
  assert.equal(findings.length, 0);
});

test('CI-7: non-lab target is gated off without any request', async () => {
  let calls = 0;
  const fetchFn = async () => {
    calls += 1;
    return res({});
  };
  const findings = await probeOauthCodeInjection('http://example.com/', [], {
    fetchFn,
    labTargets: LAB_TARGETS,
  });
  assert.equal(findings.length, 0);
  assert.equal(calls, 0);
});
