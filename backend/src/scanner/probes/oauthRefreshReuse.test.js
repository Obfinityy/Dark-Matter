// OAuth refresh-token reuse probe tests (row #497 [Medium] CWE-307;
// phase 'oauth-refresh-reuse').
//
// The fake lab mirrors the lab's authorize + token endpoints. In
// 'vulnerable' mode the refresh grant never rotates and never
// revokes (refreshReuseCount increments); in 'secure' mode the
// second use of the same token is rejected (rotation/revocation).
// The probe must fire only on the vulnerable lab.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  probeOauthRefreshReuse,
  assessRefreshReuse,
  __oauthRefreshReuseMeta,
} from './oauthRefreshReuse.js';
import { verifyFindings } from '../verifier.js';

const LAB = 'http://localhost:3620';
const LAB_TARGETS = ['localhost:3620'];

function res(obj, status = 200) {
  return { status, text: async () => JSON.stringify(obj) };
}

function fakeLab(mode) {
  const refreshTokens = new Map(); // token -> reuseCount
  let seq = 0;
  return async (url, init = {}) => {
    const u = new URL(String(url));
    const body = init.body ? JSON.parse(init.body) : {};
    if (u.pathname === '/oauth/authorize') {
      seq += 1;
      return res({ code: `code-${seq}`, state: `st-${seq}`, idp: 'idp-acme' });
    }
    if (u.pathname === '/oauth/token' && init.method === 'POST') {
      if (body.grant_type === 'authorization_code') {
        const rt = 'rt-0001-x';
        refreshTokens.set(rt, 0);
        return res({ access_token: 'at-1', token_type: 'Bearer', expires_in: 3600, refresh_token: rt });
      }
      if (body.grant_type === 'refresh_token') {
        const rec = refreshTokens.get(body.refresh_token);
        if (rec === undefined) return res({ error: 'invalid refresh token' }, 400);
        if (mode === 'secure') {
          // Rotated on first use: the old token is dead afterwards.
          refreshTokens.delete(body.refresh_token);
          return res({ access_token: 'at-2', token_type: 'Bearer', expires_in: 3600, refresh_token: 'rt-0002-y', rotated: true, refreshReuseCount: 0 });
        }
        const count = rec + 1;
        refreshTokens.set(body.refresh_token, count);
        return res({ access_token: 'at-2', token_type: 'Bearer', expires_in: 3600, refresh_token: body.refresh_token, rotated: false, refreshReuseCount: count });
      }
      return res({ error: 'unsupported grant_type' }, 400);
    }
    return res({ error: 'not found' }, 404);
  };
}

// ---- pure helpers ------------------------------------------------------------

test('RR-1: assessRefreshReuse confirms two uses of the same token', () => {
  const v = assessRefreshReuse({
    first: { status: 200, json: { access_token: 'at-1', refresh_token: 'rt-1', rotated: false, refreshReuseCount: 1 } },
    second: { status: 200, json: { access_token: 'at-2', refresh_token: 'rt-1', rotated: false, refreshReuseCount: 2 } },
    bogus: { status: 400, json: {} },
    originalToken: 'rt-1',
  });
  assert.equal(v.verdict, 'confirmed');
});

test('RR-2: assessRefreshReuse rejects when the second use is refused', () => {
  const v = assessRefreshReuse({
    first: { status: 200, json: { access_token: 'at-1', refresh_token: 'rt-2', rotated: true, refreshReuseCount: 0 } },
    second: { status: 400, json: { error: 'invalid refresh token' } },
    bogus: { status: 400, json: {} },
    originalToken: 'rt-1',
  });
  assert.equal(v.verdict, 'rejected');
});

test('RR-3: assessRefreshReuse rejects when the second use returns a rotated token', () => {
  const v = assessRefreshReuse({
    first: { status: 200, json: { access_token: 'at-1', refresh_token: 'rt-2', rotated: true, refreshReuseCount: 0 } },
    second: { status: 200, json: { access_token: 'at-2', refresh_token: 'rt-3', rotated: true, refreshReuseCount: 0 } },
    bogus: { status: 400, json: {} },
    originalToken: 'rt-1',
  });
  assert.equal(v.verdict, 'rejected');
});

test('RR-4: probe meta names the phase and standard/deep depths', () => {
  assert.deepEqual(__oauthRefreshReuseMeta.phases, ['oauth-refresh-reuse']);
  assert.deepEqual(__oauthRefreshReuseMeta.depth, ['standard', 'deep']);
});

// ---- probe behaviour ---------------------------------------------------------

test('RR-5: vulnerable lab fires one medium finding', async () => {
  const diag = {};
  const findings = await probeOauthRefreshReuse(LAB, [], {
    fetchFn: fakeLab('vulnerable'),
    labTargets: LAB_TARGETS,
    diagnostics: diag,
  });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].class, 'oauth_refresh_token_reuse');
  assert.equal(findings[0].severity, 'medium');
  assert.equal(diag.verdict, 'confirmed');
  assert.equal(diag.refreshReuseCount, 2);
  assert.match(findings[0].evidence.response, /rotated=false/);
  const { confirmed } = verifyFindings(findings);
  assert.equal(confirmed.length, 1);
});

test('RR-6: secure lab (rotation on use) stays quiet', async () => {
  const findings = await probeOauthRefreshReuse(LAB, [], {
    fetchFn: fakeLab('secure'),
    labTargets: LAB_TARGETS,
  });
  assert.equal(findings.length, 0);
});

test('RR-7: non-lab target is gated off without any request', async () => {
  let calls = 0;
  const fetchFn = async () => {
    calls += 1;
    return res({});
  };
  const findings = await probeOauthRefreshReuse('http://example.com/', [], {
    fetchFn,
    labTargets: LAB_TARGETS,
  });
  assert.equal(findings.length, 0);
  assert.equal(calls, 0);
});
