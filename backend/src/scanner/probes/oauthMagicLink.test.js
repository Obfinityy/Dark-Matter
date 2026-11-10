// Magic-link token flaws probe tests (row #487 [High] CWE-307/798;
// phase 'oauth-magic-link').
//
// The fake lab below mirrors labs/oauth-lab/server.js for the
// endpoints this probe touches, in two modes: 'vulnerable' (tokens
// never expire, redeem twice, OAuth states redeem as magic links)
// and 'secure' (single-use tokens with expiry, states are not magic
// links). The probe must fire both findings on the vulnerable lab
// and stay quiet on the secure lab, on a non-lab target, and when a
// leg fails.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  probeOauthMagicLink,
  assessMagicLinkReplay,
  assessStateAsMagicLink,
  __oauthMagicLinkMeta,
} from './oauthMagicLink.js';
import { verifyFindings } from '../verifier.js';

const LAB = 'http://localhost:3620';
const LAB_TARGETS = ['localhost:3620'];

function res(obj, status = 200) {
  return { status, text: async () => JSON.stringify(obj) };
}

// Minimal fake lab: magic-link issue/redeem + authorize.
function fakeLab(mode) {
  const redeemed = new Map(); // token -> count
  return async (url, init = {}) => {
    const u = new URL(String(url));
    const body = init.body ? JSON.parse(init.body) : {};
    if (u.pathname === '/api/auth/magic-link' && init.method === 'POST') {
      const token = 'ml-0001-deadbeef';
      redeemed.set(token, 0);
      return res(
        mode === 'vulnerable'
          ? { email: body.email, token, magicLink: `/api/auth/magic-link/redeem?token=${token}`, expiresIn: null, singleUse: false }
          : { email: body.email, token, magicLink: `/api/auth/magic-link/redeem?token=${token}`, expiresIn: 300, singleUse: true }
      );
    }
    if (u.pathname === '/api/auth/magic-link/redeem') {
      const token = u.searchParams.get('token');
      if (token === 'st-0001-deadbeef') {
        if (mode === 'vulnerable') {
          return res({ sessionToken: 'sess-state-1', email: 'lab-user@example.com', tokenKind: 'oauth-state', redeemedCount: 1 });
        }
        return res({ error: 'invalid token' }, 400);
      }
      if (token === 'ml-0001-deadbeef') {
        const count = (redeemed.get(token) || 0) + 1;
        redeemed.set(token, count);
        if (mode === 'secure' && count > 1) return res({ error: 'token already used' }, 400);
        return res({ sessionToken: `sess-ml-${count}`, email: 'dm-magic-x@example.com', tokenKind: 'magic-link', redeemedCount: count, expiresIn: null });
      }
      return res({ error: 'invalid token' }, 400);
    }
    if (u.pathname === '/oauth/authorize') {
      return res({ code: 'code-0001-x', state: 'st-0001-deadbeef', idp: 'idp-acme', email: 'lab-user@example.com' });
    }
    return res({ error: 'not found' }, 404);
  };
}

// ---- pure helpers ------------------------------------------------------------

test('ML-1: assessMagicLinkReplay confirms a full replay matrix', () => {
  const v = assessMagicLinkReplay({
    first: { status: 200, json: { sessionToken: 'sess-1', redeemedCount: 1 } },
    second: { status: 200, json: { sessionToken: 'sess-2', redeemedCount: 2 } },
    bogus: { status: 400, json: { error: 'invalid token' } },
  });
  assert.equal(v.verdict, 'confirmed');
});

test('ML-2: assessMagicLinkReplay rejects a single-use token', () => {
  const v = assessMagicLinkReplay({
    first: { status: 200, json: { sessionToken: 'sess-1', redeemedCount: 1 } },
    second: { status: 400, json: { error: 'token already used' } },
    bogus: { status: 400, json: {} },
  });
  assert.equal(v.verdict, 'rejected');
});

test('ML-3: assessMagicLinkReplay is unconfirmed when the nonsense token also redeems', () => {
  const v = assessMagicLinkReplay({
    first: { status: 200, json: { sessionToken: 'sess-1', redeemedCount: 1 } },
    second: { status: 200, json: { sessionToken: 'sess-2', redeemedCount: 2 } },
    bogus: { status: 200, json: { sessionToken: 'sess-bogus' } },
  });
  assert.equal(v.verdict, 'unconfirmed');
});

test('ML-4: assessStateAsMagicLink confirms an oauth-state redeem', () => {
  const v = assessStateAsMagicLink({
    stateRedeem: { status: 200, json: { sessionToken: 'sess-1', tokenKind: 'oauth-state' } },
    bogus: { status: 400, json: {} },
  });
  assert.equal(v.verdict, 'confirmed');
});

test('ML-5: assessStateAsMagicLink rejects when the state does not redeem', () => {
  const v = assessStateAsMagicLink({
    stateRedeem: { status: 400, json: { error: 'invalid token' } },
    bogus: { status: 400, json: {} },
  });
  assert.equal(v.verdict, 'rejected');
});

test('ML-6: probe meta names the phase and standard/deep depths', () => {
  assert.deepEqual(__oauthMagicLinkMeta.phases, ['oauth-magic-link']);
  assert.deepEqual(__oauthMagicLinkMeta.depth, ['standard', 'deep']);
});

// ---- probe behaviour ---------------------------------------------------------

test('ML-7: vulnerable lab fires both findings (replay + state confusion)', async () => {
  const diag = {};
  const findings = await probeOauthMagicLink(LAB, [], {
    fetchFn: fakeLab('vulnerable'),
    labTargets: LAB_TARGETS,
    diagnostics: diag,
  });
  assert.equal(findings.length, 2);
  const classes = findings.map((f) => f.class).sort();
  assert.deepEqual(classes, ['oauth_magic_link_replay', 'oauth_magic_link_state_confusion']);
  assert.ok(findings.every((f) => f.severity === 'high'));
  assert.ok(findings.every((f) => f.evidence.signalCorrelated));
  assert.equal(diag.replayVerdict, 'confirmed');
  assert.equal(diag.stateVerdict, 'confirmed');
  const { confirmed } = verifyFindings(findings);
  assert.equal(confirmed.length, 2);
});

test('ML-8: secure lab stays quiet', async () => {
  const findings = await probeOauthMagicLink(LAB, [], {
    fetchFn: fakeLab('secure'),
    labTargets: LAB_TARGETS,
  });
  assert.equal(findings.length, 0);
});

test('ML-9: non-lab target is gated off without any request', async () => {
  let calls = 0;
  const fetchFn = async () => {
    calls += 1;
    return res({});
  };
  const findings = await probeOauthMagicLink('http://example.com/', [], {
    fetchFn,
    labTargets: LAB_TARGETS,
  });
  assert.equal(findings.length, 0);
  assert.equal(calls, 0);
});

test('ML-10: quick depth is skipped', async () => {
  const findings = await probeOauthMagicLink(LAB, [], {
    fetchFn: fakeLab('vulnerable'),
    labTargets: LAB_TARGETS,
    depth: 'quick',
  });
  assert.equal(findings.length, 0);
});

test('ML-11: network errors never crash the probe', async () => {
  const findings = await probeOauthMagicLink(LAB, [], {
    fetchFn: async () => {
      throw new Error('network down');
    },
    labTargets: LAB_TARGETS,
  });
  assert.equal(findings.length, 0);
});
