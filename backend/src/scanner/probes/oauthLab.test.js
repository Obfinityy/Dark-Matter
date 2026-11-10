// Tests for the OAuth lab flows probe (rows #487-#493, #497, #502).
// Positive leg: the REAL oauth-lab server is spawned as a child
// process on a scratch port (same pattern as labs/llm-lab/
// server.test.js) — every row must fire exactly once with the
// evidence contract. Negative leg: a compact fixed-behaviour stub
// (same endpoints, correct semantics — single-use magic links,
// verified-only IdPs, state-validating callback, rotating refresh
// tokens, challenge-checking WebAuthn) — the probe must report
// ZERO findings against it. The stub is the honest negative: a
// probe that fires on a fixed lab is a false-positive machine.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { probeOauthLab, decodeJwtPayload } from './oauthLab.js';
import { verifyFindings } from '../verifier.js';

const LAB_PORT = 3698;
const LAB_URL = `http://127.0.0.1:${LAB_PORT}/`;
const LAB_PATH = fileURLToPath(new URL('../../../../labs/oauth-lab/server.js', import.meta.url));

let labProc = null;

async function waitForHealth(url, tries = 50) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

before(async () => {
  labProc = spawn(process.execPath, [LAB_PATH], {
    env: { ...process.env, PORT: String(LAB_PORT) },
    stdio: 'ignore',
  });
  const up = await waitForHealth(`${LAB_URL}health`);
  assert.ok(up, 'real oauth-lab must answer /health before tests run');
});

after(() => {
  if (labProc && !labProc.killed) labProc.kill('SIGTERM');
});

const EXPECTED = [
  { cls: 'oauth_magic_link_replay', sev: 'high' },
  { cls: 'oauth_state_as_magic_link', sev: 'high' },
  { cls: 'oauth_preaccount_hijack', sev: 'high' },
  { cls: 'oauth_unverified_email_idp', sev: 'high' },
  { cls: 'oauth_forced_linking', sev: 'high' },
  { cls: 'oauth_code_injection', sev: 'high' },
  { cls: 'oauth_idp_mixup', sev: 'high' },
  { cls: 'oauth_ssrf_dynamic_registration', sev: 'high' },
  { cls: 'oauth_refresh_token_reuse', sev: 'medium' },
  { cls: 'oauth_webauthn_no_validation', sev: 'high' },
];

test('real oauth-lab: all 10 classes fire exactly once, evidence contract holds', { timeout: 60000 }, async () => {
  const findings = await probeOauthLab(LAB_URL, { labTargets: '127.0.0.1', depth: 'standard' });
  for (const { cls, sev } of EXPECTED) {
    const hits = findings.filter((f) => f.class === cls);
    assert.equal(hits.length, 1, `${cls} must fire exactly once (got ${hits.length})`);
    assert.equal(hits[0].severity, sev, `${cls} severity must be ${sev}`);
    assert.equal(typeof hits[0].title, 'string');
    assert.ok(hits[0].title.length > 10, `${cls} title must be descriptive`);
    assert.equal(typeof hits[0].url, 'string');
    assert.ok(hits[0].url.startsWith('http://127.0.0.1:3698/'), `${cls} url must point at the lab`);
    assert.equal(typeof hits[0].parameter, 'string');
    assert.ok(hits[0].parameter.length > 0, `${cls} must name the parameter`);
    assert.equal(typeof hits[0].id, 'string');
    assert.ok(hits[0].id.startsWith('oauth-lab-'), `${cls} id must carry the oauth-lab prefix`);
    const ev = hits[0].evidence;
    assert.equal(typeof ev.request, 'string');
    assert.ok(ev.request.length > 10, `${cls} evidence.request must describe the request`);
    assert.equal(typeof ev.response, 'string');
    assert.ok(ev.response.length > 10, `${cls} evidence.response must quote the response`);
    assert.equal(typeof ev.impact_demo, 'string');
    assert.ok(ev.impact_demo.length > 10, `${cls} evidence.impact_demo must state the impact`);
    assert.equal(ev.signalCorrelated, true, `${cls} evidence must be signal-correlated`);
  }
  assert.equal(findings.length, EXPECTED.length, `no extra findings (got ${findings.map((f) => f.class).join(', ')})`);
  // Token redaction: the token-carrying findings must never print a
  // full token — at least 6 evidences must carry the <redacted>
  // marker (replay, state, pre-account, unverified, code-injection,
  // refresh, webauthn).
  const redacted = findings.filter((f) => JSON.stringify(f.evidence).includes('<redacted>')).length;
  assert.ok(redacted >= 6, `at least 6 findings must redact tokens (got ${redacted})`);
});

test('#493 verifier path: the finding AS PUSHED confirms through the real verifyFindings', { timeout: 60000 }, async () => {
  // Regression test for the 10 Nov website re-proof (h_39495d4e18d1):
  // the probe pushed the #493 finding but the verifier left it
  // unconfirmed — assessConfirmation routes class
  // 'oauth_ssrf_dynamic_registration' to the SSRF protocol, which
  // judges ONLY on evidence.oobHit, and the probe never set it.
  // The fix is probe-side (oobHit: true in the #493 evidence); this
  // test feeds the finding exactly as the probe pushes it through
  // the real verifier (no mocks of the judge) and asserts it lands
  // confirmed. It MUST fail on unfixed code.
  const findings = await probeOauthLab(LAB_URL, { labTargets: '127.0.0.1', depth: 'standard' });
  const f493 = findings.find((f) => f.class === 'oauth_ssrf_dynamic_registration');
  assert.ok(f493, '#493 finding must be pushed by the probe against the real lab');
  assert.equal(f493.evidence.oobHit, true, '#493 evidence must assert the observed out-of-band hit');
  const { confirmed, unconfirmed } = verifyFindings([f493]);
  assert.equal(unconfirmed.length, 0, `#493 must not be unconfirmed, got ${JSON.stringify(unconfirmed.map((f) => f.confirmation))}`);
  assert.equal(confirmed.length, 1, '#493 must confirm exactly once');
  assert.equal(confirmed[0].confirmation, 'confirmed');
  assert.equal(confirmed[0].class, 'oauth_ssrf_dynamic_registration');
});

test('decodeJwtPayload reads the id_token email_verified claim', () => {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const jwt = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ iss: 'http://127.0.0.1:3698/idp/idp-quick', email_verified: false })}.`;
  const payload = decodeJwtPayload(jwt);
  assert.equal(payload.email_verified, false);
  assert.ok(payload.iss.includes('/idp/idp-quick'));
  assert.equal(decodeJwtPayload('not-a-jwt'), null);
  assert.equal(decodeJwtPayload(''), null);
});

test('gates: non-lab host returns [] without firing', { timeout: 30000 }, async () => {
  const findings = await probeOauthLab(LAB_URL, { labTargets: 'lab.local', depth: 'standard' });
  assert.deepEqual(findings, []);
});

test('gates: quick depth returns []', { timeout: 30000 }, async () => {
  const findings = await probeOauthLab(LAB_URL, { labTargets: '127.0.0.1', depth: 'quick' });
  assert.deepEqual(findings, []);
});

// ---- Fixed-behaviour stub: same endpoints, correct semantics. ----
function fakeJwt(payload) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64(payload)}.`;
}

function fixedLabServer() {
  const users = new Map(); // email -> { password, linkedIdentities: [] }
  const sessions = new Map(); // session -> email
  const magic = new Map(); // token -> { email, redeemed }
  const idpUsers = new Map(); // "idp:email" -> { password, verified, code }
  const codes = new Map(); // code -> { idp, email, used }
  const states = new Map(); // state -> { idp, email }
  const refresh = new Map(); // token -> { email, used }
  const wbn = new Map(); // email -> { challenge, credId }
  let n = 0;
  const tok = (p) => `${p}-${++n}-${Math.random().toString(36).slice(2, 8)}`;
  const send = (res, status, obj) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(obj));
  };
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      let data = {};
      try { data = body ? JSON.parse(body) : {}; } catch { data = {}; }
      const u = new URL(req.url, 'http://127.0.0.1');
      const seg = u.pathname.split('/').filter(Boolean);
      const auth = (req.headers.authorization || '').replace(/^Bearer /, '');
      // --- health / admin ---
      if (req.method === 'GET' && u.pathname === '/health') return send(res, 200, { ok: true, service: 'oauth-lab' });
      if (req.method === 'GET' && u.pathname === '/api/admin/fetch-log') return send(res, 200, { fetches: [] });
      if (req.method === 'GET' && u.pathname === '/api/users') {
        return send(res, 200, { users: [...users.entries()].map(([email, v]) => ({ email, linkedIdentities: v.linkedIdentities })) });
      }
      // --- local auth ---
      if (req.method === 'POST' && u.pathname === '/api/auth/register') {
        users.set(data.email, { password: data.password, linkedIdentities: [] });
        return send(res, 201, { userId: tok('u'), email: data.email, verified: false });
      }
      if (req.method === 'POST' && u.pathname === '/api/auth/login') {
        const usr = users.get(data.email);
        if (usr && usr.password && usr.password === data.password) {
          const s = tok('sess');
          sessions.set(s, data.email);
          return send(res, 200, { sessionToken: s });
        }
        return send(res, 401, { error: 'invalid credentials' });
      }
      if (req.method === 'POST' && u.pathname === '/api/auth/magic-link') {
        const t = tok('ml');
        magic.set(t, { email: data.email, redeemed: false });
        return send(res, 200, { token: t, expiresIn: 900, singleUse: true });
      }
      if (req.method === 'GET' && u.pathname === '/api/auth/magic-link/redeem') {
        const m = magic.get(u.searchParams.get('token') || '');
        if (!m) return send(res, 400, { error: 'invalid token' });
        if (m.redeemed) return send(res, 400, { error: 'token already used' }); // FIXED #487a
        m.redeemed = true;
        // FIXED #488: magic-link completion clears the pre-registration
        // password — the account must be re-secured by its owner.
        const usr = users.get(m.email);
        if (usr) usr.password = null;
        const s = tok('sess');
        sessions.set(s, m.email);
        return send(res, 200, { sessionToken: s, email: m.email, tokenKind: 'magic-link', redeemedCount: 1 });
      }
      if (req.method === 'GET' && u.pathname === '/api/auth/me') {
        const email = sessions.get(u.searchParams.get('session') || '');
        if (!email) return send(res, 401, { error: 'invalid session' });
        return send(res, 200, { email, verified: true });
      }
      // --- IdPs: BOTH verify email (FIXED #489 — quick verifies too) ---
      if (req.method === 'POST' && seg[0] === 'idp' && seg[2] === 'register') {
        const code = tok('vc');
        idpUsers.set(`${seg[1]}:${data.email}`, { password: data.password, verified: false, code });
        return send(res, 201, { verified: false, verificationCode: code });
      }
      if (req.method === 'POST' && seg[0] === 'idp' && seg[2] === 'verify') {
        const rec = idpUsers.get(`${seg[1]}:${data.email}`);
        if (rec && rec.code === data.code) {
          rec.verified = true;
          return send(res, 200, { verified: true });
        }
        return send(res, 400, { error: 'invalid verification code' });
      }
      // --- OAuth ---
      if (req.method === 'GET' && u.pathname === '/oauth/authorize') {
        const idp = u.searchParams.get('idp');
        const email = u.searchParams.get('email');
        const rec = idpUsers.get(`${idp}:${email}`);
        if (!rec) return send(res, 404, { error: 'identity not found' });
        if (!rec.verified) return send(res, 403, { error: 'email not verified at this IdP' });
        const code = tok('ac');
        codes.set(code, { idp, email, used: false });
        const state = u.searchParams.get('state') || tok('st');
        states.set(state, { idp, email });
        return send(res, 200, { code, state, redirect: `${u.searchParams.get('redirect_uri')}?code=${code}&state=${state}` });
      }
      if (req.method === 'POST' && u.pathname === '/oauth/token') {
        if (data.grant_type === 'authorization_code') {
          const c = codes.get(data.code);
          if (!c || c.used) return send(res, 400, { error: 'invalid or used code' });
          c.used = true;
          const rt = tok('rt');
          refresh.set(rt, { email: c.email, used: false });
          return send(res, 200, {
            access_token: tok('at'),
            refresh_token: rt,
            id_token: fakeJwt({ iss: `http://127.0.0.1/idp/${c.idp}`, email: c.email, email_verified: true }),
            issued_by_idp: c.idp,
            issuer_validated: true, // FIXED #492
          });
        }
        if (data.grant_type === 'refresh_token') {
          const r = refresh.get(data.refresh_token);
          if (!r) return send(res, 400, { error: 'invalid refresh token' });
          if (r.used) return send(res, 400, { error: 'refresh token revoked' }); // FIXED #497
          r.used = true;
          const rt = tok('rt');
          refresh.set(rt, { email: r.email, used: false });
          return send(res, 200, { access_token: tok('at'), refresh_token: rt, rotated: true, refreshReuseCount: 1 });
        }
        return send(res, 400, { error: 'unsupported grant type' });
      }
      if (req.method === 'GET' && u.pathname === '/oauth/callback') {
        const st = states.get(u.searchParams.get('state') || '');
        if (!st) return send(res, 400, { error: 'invalid state' }); // FIXED #491
        const c = codes.get(u.searchParams.get('code') || '');
        if (!c || c.used) return send(res, 400, { error: 'invalid or used code' });
        c.used = true;
        const session = u.searchParams.get('session');
        const s = session && sessions.has(session) ? session : tok('sess');
        sessions.set(s, c.email); // overwrite only on a VALID state
        return send(res, 200, { sessionToken: s, email: c.email, stateAccepted: true, stateValidated: true, issuerValidated: true });
      }
      if (req.method === 'POST' && u.pathname === '/oauth/link') {
        const st = states.get(data.state || '');
        if (!st) return send(res, 400, { error: 'missing or invalid state' }); // FIXED #490
        const c = codes.get(data.code);
        const email = sessions.get(auth);
        if (!c || c.used || !email) return send(res, 400, { error: 'invalid link request' });
        c.used = true;
        const usr = users.get(email);
        if (usr) usr.linkedIdentities.push({ idp: c.idp, email: c.email });
        return send(res, 200, { email, linked: { idp: c.idp, email: c.email }, linkedIdentities: usr ? usr.linkedIdentities : [], csrfChecked: true, stateChecked: true });
      }
      if (req.method === 'POST' && u.pathname === '/oauth/register') {
        return send(res, 201, { client_id: tok('cid'), client_secret: tok('cs'), fetched: [] }); // FIXED #493: no fetch
      }
      // --- WebAuthn: challenge + origin + signature enforced ---
      if (req.method === 'POST' && u.pathname === '/webauthn/register/begin') {
        const ch = tok('ch');
        wbn.set(data.email, { challenge: ch, credId: null });
        return send(res, 200, { challenge: ch });
      }
      if (req.method === 'POST' && u.pathname === '/webauthn/register/finish') {
        const w = wbn.get(data.email);
        if (!w || w.challenge !== data.challenge) return send(res, 400, { error: 'invalid challenge' }); // FIXED #502
        w.credId = data.credentialId;
        return send(res, 200, { ok: true, challengeAccepted: true, challengeChecked: true });
      }
      if (req.method === 'POST' && u.pathname === '/webauthn/authenticate/begin') {
        const ch = tok('ch');
        const w = wbn.get(data.email) || { challenge: null, credId: null };
        w.challenge = ch;
        wbn.set(data.email, w);
        return send(res, 200, { challenge: ch, allowCredentials: w.credId ? [{ id: w.credId }] : [] });
      }
      if (req.method === 'POST' && u.pathname === '/webauthn/authenticate/finish') {
        const w = wbn.get(data.email);
        if (!w || w.challenge !== data.challenge) return send(res, 400, { error: 'invalid challenge' });
        if (w.credId !== data.credentialId) return send(res, 400, { error: 'unknown credential' });
        if (data.origin !== 'http://127.0.0.1') return send(res, 400, { error: 'origin mismatch' });
        if (!data.signature) return send(res, 400, { error: 'missing signature' });
        const s = tok('sess');
        sessions.set(s, data.email);
        return send(res, 200, { sessionToken: s, originAccepted: data.origin, challengeAccepted: true, originChecked: true, challengeChecked: true, signatureChecked: true, signCountChecked: true });
      }
      return send(res, 404, { error: 'not found' });
    });
  });
  return server;
}

test('fixed-behaviour stub: zero findings (honest negative for all 10 classes)', { timeout: 60000 }, async () => {
  const server = fixedLabServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const port = server.address().port;
    const findings = await probeOauthLab(`http://127.0.0.1:${port}/`, { labTargets: '127.0.0.1', depth: 'standard' });
    assert.deepEqual(findings, [], `fixed lab must yield zero findings, got ${JSON.stringify(findings.map((f) => f.class))}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('gates: non-oauth-lab health fingerprint returns []', { timeout: 30000 }, async () => {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, service: 'other-lab' }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const port = server.address().port;
    const findings = await probeOauthLab(`http://127.0.0.1:${port}/`, { labTargets: '127.0.0.1', depth: 'standard' });
    assert.deepEqual(findings, []);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
