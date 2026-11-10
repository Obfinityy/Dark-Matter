// OAuth forced profile linking probe tests (row #490 [High]
// CWE-352; phase 'oauth-forced-linking').
//
// The fake lab mirrors the lab's register/login, IdP registration,
// authorize and link endpoints plus the users list. In 'vulnerable'
// mode any valid code links into the caller's session (no CSRF,
// no state); in 'secure' mode a code for a different identity than
// the session owner is refused. The probe must fire only on the
// vulnerable lab, and only when the users list confirms the foreign
// identity landed on the victim.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  probeOauthForcedLinking,
  assessForcedLinking,
  __oauthForcedLinkingMeta,
} from './oauthForcedLinking.js';
import { verifyFindings } from '../verifier.js';

const LAB = 'http://localhost:3620';
const LAB_TARGETS = ['localhost:3620'];

function res(obj, status = 200) {
  return { status, text: async () => JSON.stringify(obj) };
}

function fakeLab(mode) {
  const users = new Map(); // email -> { linkedIdentities: [] }
  const codes = new Map(); // code -> email
  let seq = 0;
  return async (url, init = {}) => {
    const u = new URL(String(url));
    const body = init.body ? JSON.parse(init.body) : {};
    if (u.pathname === '/api/auth/register' && init.method === 'POST') {
      users.set(body.email, { email: body.email, linkedIdentities: [] });
      return res({ userId: 1, email: body.email, verified: false }, 201);
    }
    if (u.pathname === '/api/auth/login' && init.method === 'POST') {
      return res({ sessionToken: 'sess-victim', email: body.email, userId: 1 });
    }
    const idpReg = u.pathname.match(/^\/idp\/([^/]+)\/register$/);
    if (idpReg && init.method === 'POST') return res({ idp: idpReg[1], email: body.email, verified: false }, 201);
    if (u.pathname === '/oauth/authorize') {
      seq += 1;
      const code = `code-${seq}`;
      codes.set(code, u.searchParams.get('email'));
      return res({ code, state: `st-${seq}`, email: u.searchParams.get('email') });
    }
    if (u.pathname === '/oauth/link' && init.method === 'POST') {
      const owner = codes.get(body.code);
      if (!owner) return res({ error: 'invalid code' }, 400);
      // The victim session is always 'sess-victim'; its owner is the
      // first registered user (the victim).
      const victimEmail = [...users.keys()][0];
      if (mode === 'secure' && owner !== victimEmail) {
        return res({ error: 'cannot link an identity that is not your own' }, 403);
      }
      const victim = users.get(victimEmail);
      victim.linkedIdentities.push({ idp: 'idp-quick', email: owner });
      return res({ email: victimEmail, linked: { idp: 'idp-quick', email: owner }, linkedIdentities: victim.linkedIdentities, csrfChecked: false, stateChecked: false });
    }
    if (u.pathname === '/api/users') {
      return res({ users: [...users.values()].map((x) => ({ email: x.email, linkedIdentities: x.linkedIdentities })) });
    }
    return res({ error: 'not found' }, 404);
  };
}

// ---- pure helpers ------------------------------------------------------------

test('FL-1: assessForcedLinking confirms the full matrix', () => {
  const v = assessForcedLinking({
    ownLink: { status: 200, json: {} },
    attackLink: { status: 200, json: { csrfChecked: false, stateChecked: false } },
    bogusLink: { status: 400, json: {} },
    victimLinked: [{ idp: 'idp-quick', email: 'attacker@example.com' }],
    attackerEmail: 'attacker@example.com',
  });
  assert.equal(v.verdict, 'confirmed');
});

test('FL-2: assessForcedLinking rejects when the foreign link is refused', () => {
  const v = assessForcedLinking({
    ownLink: { status: 200, json: {} },
    attackLink: { status: 403, json: {} },
    bogusLink: { status: 400, json: {} },
    victimLinked: [],
    attackerEmail: 'attacker@example.com',
  });
  assert.equal(v.verdict, 'rejected');
});

test('FL-3: assessForcedLinking is unconfirmed when the users list shows no foreign identity', () => {
  const v = assessForcedLinking({
    ownLink: { status: 200, json: {} },
    attackLink: { status: 200, json: {} },
    bogusLink: { status: 400, json: {} },
    victimLinked: [{ idp: 'idp-quick', email: 'victim@example.com' }],
    attackerEmail: 'attacker@example.com',
  });
  assert.equal(v.verdict, 'unconfirmed');
});

test('FL-4: probe meta names the phase and standard/deep depths', () => {
  assert.deepEqual(__oauthForcedLinkingMeta.phases, ['oauth-forced-linking']);
  assert.deepEqual(__oauthForcedLinkingMeta.depth, ['standard', 'deep']);
});

// ---- probe behaviour ---------------------------------------------------------

test('FL-5: vulnerable lab fires one high finding', async () => {
  const diag = {};
  const findings = await probeOauthForcedLinking(LAB, [], {
    fetchFn: fakeLab('vulnerable'),
    labTargets: LAB_TARGETS,
    diagnostics: diag,
  });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].class, 'oauth_forced_profile_linking');
  assert.equal(findings[0].severity, 'high');
  assert.equal(diag.verdict, 'confirmed');
  assert.match(findings[0].evidence.response, /csrfChecked:false/);
  const { confirmed } = verifyFindings(findings);
  assert.equal(confirmed.length, 1);
});

test('FL-6: secure lab (foreign link refused) stays quiet', async () => {
  const findings = await probeOauthForcedLinking(LAB, [], {
    fetchFn: fakeLab('secure'),
    labTargets: LAB_TARGETS,
  });
  assert.equal(findings.length, 0);
});

test('FL-7: non-lab target is gated off without any request', async () => {
  let calls = 0;
  const fetchFn = async () => {
    calls += 1;
    return res({});
  };
  const findings = await probeOauthForcedLinking('http://example.com/', [], {
    fetchFn,
    labTargets: LAB_TARGETS,
  });
  assert.equal(findings.length, 0);
  assert.equal(calls, 0);
});
