// WebAuthn origin / challenge validation probe tests (row #502
// [High] CWE-347; phase 'webauthn').
//
// The fake lab mirrors the lab's WebAuthn begin/finish endpoints.
// In 'vulnerable' mode finish accepts any challenge, any origin and
// any signature and reports the checks as false; in 'secure' mode a
// stale challenge or a wrong origin is rejected. The probe must fire
// only on the vulnerable lab, and only when the minted session
// resolves.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  probeWebauthn,
  assessWebauthn,
  __webauthnMeta,
} from './webauthn.js';
import { verifyFindings } from '../verifier.js';

const LAB = 'http://localhost:3620';
const LAB_TARGETS = ['localhost:3620'];

function res(obj, status = 200) {
  return { status, text: async () => JSON.stringify(obj) };
}

function fakeLab(mode) {
  const creds = new Map(); // credentialId -> email
  return async (url, init = {}) => {
    const u = new URL(String(url));
    const body = init.body ? JSON.parse(init.body) : {};
    if (u.pathname === '/webauthn/register/begin' && init.method === 'POST') {
      return res({ challenge: 'ch-real-1', rpId: 'oauth-lab', userId: 1 });
    }
    if (u.pathname === '/webauthn/register/finish' && init.method === 'POST') {
      if (mode === 'secure' && body.challenge !== 'ch-real-1') {
        return res({ error: 'challenge mismatch' }, 400);
      }
      creds.set(body.credentialId, body.email);
      return res({ ok: true, credentialId: body.credentialId, challengeAccepted: body.challenge, challengeChecked: mode === 'secure' });
    }
    if (u.pathname === '/webauthn/authenticate/begin' && init.method === 'POST') {
      return res({ challenge: 'ch-real-2', rpId: 'oauth-lab', allowCredentials: [...creds.keys()] });
    }
    if (u.pathname === '/webauthn/authenticate/finish' && init.method === 'POST') {
      if (!creds.has(body.credentialId)) return res({ error: 'unknown credential for this user' }, 404);
      if (mode === 'secure' && (body.challenge !== 'ch-real-2' || body.origin !== 'http://localhost:3620')) {
        return res({ error: 'challenge or origin mismatch' }, 400);
      }
      return res({
        sessionToken: 'sess-wa-1',
        email: body.email,
        credentialId: body.credentialId,
        originAccepted: body.origin,
        challengeAccepted: body.challenge,
        signatureReceived: Boolean(body.signature),
        originChecked: false,
        challengeChecked: false,
        signatureChecked: false,
        signCountChecked: false,
      });
    }
    if (u.pathname === '/api/auth/me') {
      const auth = (init.headers && init.headers.Authorization) || '';
      if (auth === 'Bearer sess-wa-1') return res({ email: 'lab-user@example.com', userId: 1 });
      return res({ error: 'unknown session' }, 401);
    }
    return res({ error: 'not found' }, 404);
  };
}

// ---- pure helpers ------------------------------------------------------------

test('WA-1: assessWebauthn confirms a forged ceremony that resolves', () => {
  const v = assessWebauthn({
    authFinish: {
      status: 200,
      json: { sessionToken: 'sess-1', originAccepted: 'https://evil.example.com', originChecked: false, challengeChecked: false, signatureChecked: false },
    },
    sessionMe: { status: 200, json: { email: 'lab-user@example.com' } },
    bogusCred: { status: 404, json: {} },
    registerFinish: { status: 200, json: { challengeChecked: false } },
  });
  assert.equal(v.verdict, 'confirmed');
});

test('WA-2: assessWebauthn rejects when the forged finish is refused', () => {
  const v = assessWebauthn({
    authFinish: { status: 400, json: { error: 'challenge mismatch' } },
    sessionMe: null,
    bogusCred: { status: 404, json: {} },
    registerFinish: { status: 200, json: {} },
  });
  assert.equal(v.verdict, 'rejected');
});

test('WA-3: assessWebauthn is unconfirmed when the minted session does not resolve', () => {
  const v = assessWebauthn({
    authFinish: {
      status: 200,
      json: { sessionToken: 'sess-1', originAccepted: 'https://evil.example.com', originChecked: false, challengeChecked: false, signatureChecked: false },
    },
    sessionMe: { status: 401, json: {} },
    bogusCred: { status: 404, json: {} },
    registerFinish: { status: 200, json: {} },
  });
  assert.equal(v.verdict, 'unconfirmed');
});

test('WA-4: probe meta names the phase and standard/deep depths', () => {
  assert.deepEqual(__webauthnMeta.phases, ['webauthn']);
  assert.deepEqual(__webauthnMeta.depth, ['standard', 'deep']);
});

// ---- probe behaviour ---------------------------------------------------------

test('WA-5: vulnerable lab fires one high finding', async () => {
  const diag = {};
  const findings = await probeWebauthn(LAB, [], {
    fetchFn: fakeLab('vulnerable'),
    labTargets: LAB_TARGETS,
    diagnostics: diag,
  });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].class, 'webauthn_validation_missing');
  assert.equal(findings[0].severity, 'high');
  assert.equal(diag.verdict, 'confirmed');
  assert.match(findings[0].evidence.response, /evil\.example\.com/);
  const { confirmed } = verifyFindings(findings);
  assert.equal(confirmed.length, 1);
});

test('WA-6: secure lab (challenge/origin checked) stays quiet', async () => {
  const findings = await probeWebauthn(LAB, [], {
    fetchFn: fakeLab('secure'),
    labTargets: LAB_TARGETS,
  });
  assert.equal(findings.length, 0);
});

test('WA-7: non-lab target is gated off without any request', async () => {
  let calls = 0;
  const fetchFn = async () => {
    calls += 1;
    return res({});
  };
  const findings = await probeWebauthn('http://example.com/', [], {
    fetchFn,
    labTargets: LAB_TARGETS,
  });
  assert.equal(findings.length, 0);
  assert.equal(calls, 0);
});
