// OAuth authorization-server mix-up probe tests (row #492 [High]
// CWE-346; phase 'oauth-mixup').
//
// The fake lab mirrors the lab's discovery, authorize and token
// endpoints with two IdPs. In 'vulnerable' mode the token endpoint
// redeems a code minted at idp-quick inside a flow started at
// idp-acme and reports issuer_validated:false; in 'secure' mode a
// cross-IdP code is refused. The probe must fire only on the
// vulnerable lab.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  probeOauthMixup,
  assessMixup,
  __oauthMixupMeta,
} from './oauthMixup.js';
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
  const codes = new Map(); // code -> { email, idp }
  let seq = 0;
  return async (url, init = {}) => {
    const u = new URL(String(url));
    const body = init.body ? JSON.parse(init.body) : {};
    if (u.pathname === '/.well-known/openid-configuration') {
      const idp = u.searchParams.get('idp') || 'idp-acme';
      return res({ issuer: `${LAB}/idp/${idp}`, authorization_endpoint: `${LAB}/oauth/authorize`, token_endpoint: `${LAB}/oauth/token` });
    }
    const idpReg = u.pathname.match(/^\/idp\/([^/]+)\/register$/);
    if (idpReg && init.method === 'POST') return res({ idp: idpReg[1], email: body.email, verified: false }, 201);
    if (u.pathname === '/oauth/authorize') {
      seq += 1;
      const code = `code-${seq}`;
      codes.set(code, { email: u.searchParams.get('email'), idp: u.searchParams.get('idp') });
      return res({ code, state: `st-${seq}`, idp: u.searchParams.get('idp') });
    }
    if (u.pathname === '/oauth/token' && init.method === 'POST') {
      const rec = codes.get(body.code);
      if (!rec) return res({ error: 'invalid code' }, 400);
      if (mode === 'secure' && rec.idp !== 'idp-acme') {
        return res({ error: 'issuer mismatch — code from untrusted IdP' }, 400);
      }
      return res({
        access_token: 'at-1',
        token_type: 'Bearer',
        refresh_token: 'rt-1',
        id_token: fakeJwt({ iss: `${LAB}/idp/${rec.idp}`, sub: rec.email, email: rec.email, email_verified: false, aud: 'lab-client' }),
        issued_by_idp: rec.idp,
        issuer_validated: false,
      });
    }
    return res({ error: 'not found' }, 404);
  };
}

// ---- pure helpers ------------------------------------------------------------

test('MX-1: assessMixup confirms a cross-IdP redemption', () => {
  const tokenResp = {
    status: 200,
    json: {
      access_token: 'at-1',
      issued_by_idp: 'idp-quick',
      issuer_validated: false,
      id_token: fakeJwt({ iss: 'http://localhost:3620/idp/idp-quick' }),
    },
  };
  const v = assessMixup({
    tokenResp,
    expectedIssuer: 'http://localhost:3620/idp/idp-acme',
    bogus: { status: 400, json: {} },
  });
  assert.equal(v.verdict, 'confirmed');
});

test('MX-2: assessMixup rejects when the token endpoint refuses the cross-IdP code', () => {
  const v = assessMixup({
    tokenResp: { status: 400, json: { error: 'issuer mismatch' } },
    expectedIssuer: 'http://localhost:3620/idp/idp-acme',
    bogus: { status: 400, json: {} },
  });
  assert.equal(v.verdict, 'rejected');
});

test('MX-3: assessMixup is unconfirmed when the bogus code also redeems', () => {
  const tokenResp = {
    status: 200,
    json: {
      access_token: 'at-1',
      issued_by_idp: 'idp-quick',
      issuer_validated: false,
      id_token: fakeJwt({ iss: 'http://localhost:3620/idp/idp-quick' }),
    },
  };
  const v = assessMixup({
    tokenResp,
    expectedIssuer: 'http://localhost:3620/idp/idp-acme',
    bogus: { status: 200, json: { access_token: 'at-bogus' } },
  });
  assert.equal(v.verdict, 'unconfirmed');
});

test('MX-4: probe meta names the phase and standard/deep depths', () => {
  assert.deepEqual(__oauthMixupMeta.phases, ['oauth-mixup']);
  assert.deepEqual(__oauthMixupMeta.depth, ['standard', 'deep']);
});

// ---- probe behaviour ---------------------------------------------------------

test('MX-5: vulnerable lab fires one high finding', async () => {
  const diag = {};
  const findings = await probeOauthMixup(LAB, [], {
    fetchFn: fakeLab('vulnerable'),
    labTargets: LAB_TARGETS,
    diagnostics: diag,
  });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].class, 'oauth_idp_mixup');
  assert.equal(findings[0].severity, 'high');
  assert.equal(diag.verdict, 'confirmed');
  assert.match(findings[0].evidence.response, /issuer_validated=false/);
  const { confirmed } = verifyFindings(findings);
  assert.equal(confirmed.length, 1);
});

test('MX-6: secure lab (cross-IdP code refused) stays quiet', async () => {
  const findings = await probeOauthMixup(LAB, [], {
    fetchFn: fakeLab('secure'),
    labTargets: LAB_TARGETS,
  });
  assert.equal(findings.length, 0);
});

test('MX-7: non-lab target is gated off without any request', async () => {
  let calls = 0;
  const fetchFn = async () => {
    calls += 1;
    return res({});
  };
  const findings = await probeOauthMixup('http://example.com/', [], {
    fetchFn,
    labTargets: LAB_TARGETS,
  });
  assert.equal(findings.length, 0);
  assert.equal(calls, 0);
});
