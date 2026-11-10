// SSO takeover via unverified email at the IdP probe tests (row
// #489 [High] CWE-287; phase 'oauth-sso-unverified').
//
// The fake lab mirrors the lab's two IdPs: idp-quick never verifies
// email, idp-acme (control) refuses unverified identities. In
// 'vulnerable' mode the RP logs in on the idp-quick claim even
// though the id_token says email_verified:false; in 'secure' mode
// the RP refuses the unverified claim at the callback. A third mode,
// 'control-broken', lets the control IdP through too — the probe
// must stay quiet there because the oracle cannot distinguish.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  probeOauthSsoUnverified,
  assessSsoUnverified,
  __oauthSsoUnverifiedMeta,
} from './oauthSsoUnverified.js';
import { decodeJwtPayload } from './oauthShared.js';
import { verifyFindings } from '../verifier.js';

const LAB = 'http://localhost:3620';
const LAB_TARGETS = ['localhost:3620'];

function res(obj, status = 200) {
  return { status, text: async () => JSON.stringify(obj) };
}

function fakeJwt(payload) {
  const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64url');
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64(payload)}.`;
}

function fakeLab(mode) {
  let codeSeq = 0;
  return async (url, init = {}) => {
    const u = new URL(String(url));
    const body = init.body ? JSON.parse(init.body) : {};
    const idpReg = u.pathname.match(/^\/idp\/([^/]+)\/register$/);
    if (idpReg && init.method === 'POST') {
      return res({ idp: idpReg[1], email: body.email, verified: false, verificationCode: idpReg[1] === 'idp-acme' ? 'vc-1' : null }, 201);
    }
    if (u.pathname === '/oauth/authorize') {
      const idp = u.searchParams.get('idp');
      const email = u.searchParams.get('email');
      if (idp === 'idp-acme' && mode !== 'control-broken') {
        return res({ error: 'email not verified at this IdP', idp, email }, 403);
      }
      codeSeq += 1;
      return res({ code: `code-${codeSeq}`, state: `st-${codeSeq}`, idp, email });
    }
    if (u.pathname === '/oauth/token' && init.method === 'POST') {
      return res({
        access_token: 'at-1',
        token_type: 'Bearer',
        refresh_token: 'rt-1',
        id_token: fakeJwt({ iss: `${LAB}/idp/idp-quick`, sub: 'victim@example.com', email: 'victim@example.com', email_verified: false, aud: 'lab-client' }),
        issued_by_idp: 'idp-quick',
        issuer_validated: false,
      });
    }
    if (u.pathname === '/oauth/callback') {
      if (mode === 'secure') return res({ error: 'email not verified' }, 403);
      return res({ sessionToken: 'sess-1', email: 'victim@example.com', idp: 'idp-quick', stateValidated: false, issuerValidated: false });
    }
    return res({ error: 'not found' }, 404);
  };
}

// ---- pure helpers ------------------------------------------------------------

test('SU-1: assessSsoUnverified confirms the full matrix', () => {
  const v = assessSsoUnverified({
    attackLogin: { status: 200, json: { sessionToken: 's1', email: 'v@example.com' } },
    emailVerified: false,
    controlRefused: true,
  });
  assert.equal(v.verdict, 'confirmed');
});

test('SU-2: assessSsoUnverified rejects when the attack login fails', () => {
  const v = assessSsoUnverified({
    attackLogin: { status: 403, json: {} },
    emailVerified: false,
    controlRefused: true,
  });
  assert.equal(v.verdict, 'rejected');
});

test('SU-3: assessSsoUnverified is unconfirmed when the control IdP also allows it', () => {
  const v = assessSsoUnverified({
    attackLogin: { status: 200, json: { sessionToken: 's1' } },
    emailVerified: false,
    controlRefused: false,
  });
  assert.equal(v.verdict, 'unconfirmed');
});

test('SU-4: decodeJwtPayload reads the email_verified claim without verifying', () => {
  const token = fakeJwt({ iss: 'http://x/idp/idp-quick', email_verified: false });
  const payload = decodeJwtPayload(token);
  assert.equal(payload.email_verified, false);
  assert.equal(payload.iss, 'http://x/idp/idp-quick');
  assert.equal(decodeJwtPayload('not-a-jwt'), null);
});

test('SU-5: probe meta names the phase and standard/deep depths', () => {
  assert.deepEqual(__oauthSsoUnverifiedMeta.phases, ['oauth-sso-unverified']);
  assert.deepEqual(__oauthSsoUnverifiedMeta.depth, ['standard', 'deep']);
});

// ---- probe behaviour ---------------------------------------------------------

test('SU-6: vulnerable lab fires one high finding', async () => {
  const diag = {};
  const findings = await probeOauthSsoUnverified(LAB, [], {
    fetchFn: fakeLab('vulnerable'),
    labTargets: LAB_TARGETS,
    diagnostics: diag,
  });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].class, 'oauth_sso_unverified_email');
  assert.equal(findings[0].severity, 'high');
  assert.equal(diag.verdict, 'confirmed');
  assert.equal(diag.emailVerified, false);
  assert.match(findings[0].evidence.response, /email_verified:false/);
  const { confirmed } = verifyFindings(findings);
  assert.equal(confirmed.length, 1);
});

test('SU-7: secure lab (RP refuses the unverified claim) stays quiet', async () => {
  const findings = await probeOauthSsoUnverified(LAB, [], {
    fetchFn: fakeLab('secure'),
    labTargets: LAB_TARGETS,
  });
  assert.equal(findings.length, 0);
});

test('SU-8: broken control IdP stays quiet — the oracle cannot distinguish', async () => {
  const findings = await probeOauthSsoUnverified(LAB, [], {
    fetchFn: fakeLab('control-broken'),
    labTargets: LAB_TARGETS,
  });
  assert.equal(findings.length, 0);
});

test('SU-9: non-lab target is gated off without any request', async () => {
  let calls = 0;
  const fetchFn = async () => {
    calls += 1;
    return res({});
  };
  const findings = await probeOauthSsoUnverified('http://example.com/', [], {
    fetchFn,
    labTargets: LAB_TARGETS,
  });
  assert.equal(findings.length, 0);
  assert.equal(calls, 0);
});
