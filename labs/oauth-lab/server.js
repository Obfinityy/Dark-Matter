// oauth-lab — deliberately vulnerable OAuth / OIDC / SSO lab target (LAB ONLY).
//
// A DETERMINISTIC stub identity provider + relying party: Node stdlib
// only, no dependencies, no external IdP, no real email, $0 spend. It
// behaves like a real OAuth/OIDC deployment for probe purposes: magic
// links, open registration, two IdPs, authorization-code flow, dynamic
// client registration, refresh tokens and WebAuthn. The planted
// behaviours below are the test surface — they are documented, not
// hidden. This is a lab, not a product.
//
// Planted vulnerabilities (see README.md for the row mapping):
//   1. Magic-link tokens never expire, are not single-use, and an
//      OAuth `state` value is redeemable as a magic link (#487).
//   2. Open registration with no email verification, so an attacker
//      can pre-register a victim's email with an attacker password
//      and keep password access after the victim signs in (#488).
//   3. IdP `idp-quick` never verifies email, and the relying party
//      trusts its email claim anyway (#489).
//   4. OAuth account linking has no CSRF / state check, so an
//      attacker code can be linked into a victim's session (#490).
//   5. The authorization-code callback never validates `state`,
//      so an attacker-obtained code logs the caller in as the
//      attacker (#491).
//   6. Multi-IdP issuer confusion: a code from ANY IdP redeems at
//      the token endpoint and the callback, and the `iss` claim is
//      never validated against the IdP the flow started with (#492).
//   7. Open dynamic client registration fetches `jwks_uri` /
//      `logo_uri` server-side with no allowlist (#493).
//   8. Refresh tokens are never rotated and never revoked on reuse
//      (#497).
//   9. WebAuthn assertion checks nothing: any challenge, any
//      origin, no signature or counter verification (#502).
//
// Safety rails (non-negotiable — see README.md):
//   - No real email: magic links are returned in the API response.
//   - No external IdP: both IdPs are namespaces in this server.
//   - No real credentials: the single seeded login is a documented
//     fixture (lab-user@example.com / lab-pass); all tokens are
//     deterministic counter-derived fake strings.
//   - The one server-side fetch (dynamic registration) REFUSES the
//     EC2 instance-metadata address 169.254.169.254 and is logged.
//   - No child_process, no shell, no eval anywhere in this file.
//   - The container binds 0.0.0.0:3620 only inside its own
//     container; on EC2 the port is published on 172.17.0.1 (lab
//     network), never on the public interface.
'use strict';

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 3620);
const HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR = path.join(__dirname, 'data');
const MAX_BODY_BYTES = 64 * 1024;

// ---------------------------------------------------------------- seed data
// Loaded from data/seed.json. One documented lab login; pre-registered
// at both IdPs so the OAuth happy path works out of the box.
const seed = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'seed.json'), 'utf8'));
const IDPS = new Map(seed.idps.map((d) => [d.id, d]));

// ---------------------------------------------------------------- state
// In-memory only; a restart resets every account, token and session.
// All tokens are deterministic counter-derived fake strings (the same
// fixture class as the scanner's `dmprobe*` / `lab-pass` fixtures) —
// no randomness, no real secrets.
let seq = 0;
function nextToken(prefix) {
  seq += 1;
  const hex = ((seq * 0x9e3779b1) >>> 0).toString(16).padStart(8, '0');
  return `${prefix}-${String(seq).padStart(4, '0')}-${hex}`;
}

const users = new Map(); // email -> { userId, email, password, verified, authMethods:Set, linkedIdentities:[], createdVia }
const idpIdentities = new Map(); // `${idpId}:${email}` -> { idpId, email, password, verified, verificationCode }
const sessions = new Map(); // sessionToken -> { email, userId, via }
const codes = new Map(); // code -> { email, idpId, state, used }
const tokens = new Map(); // unified token store: magic-link tokens AND oauth states (PLANTED #487: redeem accepts both kinds)
const refreshTokens = new Map(); // refreshToken -> { email, idpId, reuseCount }
const webauthnCreds = new Map(); // `${email}:${credentialId}` -> { email, credentialId, publicKey, signCount }
const fetchLog = []; // every server-side fetch attempt (PLANTED #493 observable)
let nextUserId = 1;

function createUser(email, password, createdVia) {
  const user = {
    userId: nextUserId++,
    email,
    password: password || null,
    verified: false,
    authMethods: new Set(password ? ['password'] : []),
    linkedIdentities: [],
    createdVia,
  };
  users.set(email, user);
  return user;
}
function publicUser(u) {
  return {
    userId: u.userId,
    email: u.email,
    verified: u.verified,
    authMethods: [...u.authMethods],
    linkedIdentities: u.linkedIdentities,
    createdVia: u.createdVia,
  };
}
function mintSession(email, via) {
  const user = users.get(email);
  const token = nextToken('sess');
  sessions.set(token, { email, userId: user ? user.userId : null, via });
  return token;
}

// Seed: the documented lab login, pre-registered at both IdPs.
for (const su of seed.users) {
  const u = createUser(su.email, su.password, 'seed');
  u.authMethods.add('password');
  for (const idpId of IDPS.keys()) {
    const idp = IDPS.get(idpId);
    idpIdentities.set(`${idpId}:${su.email}`, {
      idpId,
      email: su.email,
      password: su.password,
      // idp-acme: seeded identity is verified (the control). idp-quick:
      // verified is meaningless — it never verifies anyone (#489).
      verified: idp.verifiesEmail,
      verificationCode: null,
    });
  }
}

// ---------------------------------------------------------------- helpers
function base64url(str) {
  return Buffer.from(str, 'utf8').toString('base64url');
}
function fakeJwt(payload) {
  const header = base64url(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const body = base64url(JSON.stringify(payload));
  return `${header}.${body}.`;
}
function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(body);
}
function sendHtml(res, status, html) {
  res.writeHead(status, { 'content-type': 'text/html; charset=utf-8' });
  res.end(html);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('invalid json'));
      }
    });
    req.on('error', reject);
  });
}
function sessionFrom(req, body) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  const url = new URL(req.url, 'http://oauth-lab');
  if (url.searchParams.get('session')) return url.searchParams.get('session');
  if (body && body.session) return body.session;
  return null;
}
function requireSession(req, body) {
  const token = sessionFrom(req, body);
  if (!token) return { error: 'missing session (Authorization: Bearer <sessionToken> or ?session=)' };
  const s = sessions.get(token);
  if (!s) return { error: 'unknown session' };
  return { sessionToken: token, session: s };
}
function baseUrl(req) {
  return `http://${req.headers.host || `oauth-lab:${PORT}`}`;
}

// ---------------------------------------------------------------- SSRF fetch
// PLANTED #493: dynamic client registration fetches jwks_uri / logo_uri
// server-side. One guard only, and it is documented: the EC2 instance
// metadata address is refused (it is never a legitimate jwks/logo host
// and a probe must not be able to reach cloud credentials through this
// lab). Every attempt — success, failure, blocked — is logged to
// fetchLog, which is the probe's observable.
const FETCH_TIMEOUT_MS = 2000;
const FETCH_MAX_BYTES = 8192;
function serverFetch(rawUrl, source) {
  const entry = { url: rawUrl, source, status: null, error: null, bytes: 0, at: new Date().toISOString(), blocked: false };
  return new Promise((resolve) => {
    let u;
    try {
      u = new URL(rawUrl);
    } catch {
      entry.error = 'invalid-url';
      fetchLog.push(entry);
      return resolve(entry);
    }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      entry.error = 'unsupported-protocol';
      fetchLog.push(entry);
      return resolve(entry);
    }
    if (u.hostname === '169.254.169.254') {
      entry.error = 'blocked-metadata-ip';
      entry.blocked = true;
      fetchLog.push(entry);
      return resolve(entry);
    }
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.get(rawUrl, { timeout: FETCH_TIMEOUT_MS }, (res) => {
      let bytes = 0;
      res.on('data', (c) => {
        bytes += c.length;
        if (bytes > FETCH_MAX_BYTES) res.destroy();
      });
      res.on('end', () => {
        entry.status = res.statusCode;
        entry.bytes = bytes;
        fetchLog.push(entry);
        resolve(entry);
      });
    });
    req.on('timeout', () => {
      req.destroy();
      entry.error = 'timeout';
      fetchLog.push(entry);
      resolve(entry);
    });
    req.on('error', (e) => {
      entry.error = e.code || 'fetch-error';
      fetchLog.push(entry);
      resolve(entry);
    });
  });
}

// ---------------------------------------------------------------- handlers
function handleIndex(req, res) {
  const html = `<!doctype html>
<html><head><title>OAuth Lab — Dark Matter</title></head><body>
<h1>OAuth / OIDC / SSO Lab</h1>
<p>Deliberately vulnerable identity lab for the Dark Matter scanner (scout rows #487-#493, #497, #502). See <a href="/README">README</a> — endpoints are also listed at <a href="/api/routes">/api/routes</a>.</p>
<h2>Passwordless</h2>
<ul>
<li><a href="/api/auth/magic-link">POST /api/auth/magic-link</a> — request a magic link (returned in the response, no email)</li>
<li><a href="/api/auth/magic-link/redeem">GET /api/auth/magic-link/redeem?token=...</a> — redeem a magic link (or an OAuth state)</li>
<li><a href="/api/auth/register">POST /api/auth/register</a> — open registration, no email verification</li>
<li><a href="/api/auth/login">POST /api/auth/login</a> — password login</li>
<li><a href="/api/auth/me">GET /api/auth/me</a> — who am I (Bearer session)</li>
</ul>
<h2>OAuth / OIDC</h2>
<ul>
<li><a href="/oauth/authorize">GET /oauth/authorize</a> — ?response_type=code&amp;client_id=lab-client&amp;redirect_uri=...&amp;idp=idp-acme|idp-quick&amp;email=...&amp;state=...</li>
<li><a href="/oauth/token">POST /oauth/token</a> — authorization_code / refresh_token grants</li>
<li><a href="/oauth/callback">GET /oauth/callback?code=...&amp;state=...</a> — login callback (state never validated)</li>
<li><a href="/oauth/link">POST /oauth/link</a> — link an OAuth identity to the current session</li>
<li><a href="/oauth/register">POST /oauth/register</a> — open dynamic client registration (fetches jwks_uri / logo_uri)</li>
<li><a href="/.well-known/openid-configuration?idp=idp-acme">GET /.well-known/openid-configuration</a> — discovery (per IdP)</li>
</ul>
<h2>IdPs</h2>
<ul>
<li><a href="/idp/idp-acme/register">POST /idp/idp-acme/register</a> — Acme IdP (verifies email)</li>
<li><a href="/idp/idp-quick/register">POST /idp/idp-quick/register</a> — QuickIdP (never verifies email)</li>
</ul>
<h2>WebAuthn</h2>
<ul>
<li><a href="/webauthn/register/begin">POST /webauthn/register/begin</a> / <a href="/webauthn/register/finish">POST /webauthn/register/finish</a></li>
<li><a href="/webauthn/authenticate/begin">POST /webauthn/authenticate/begin</a> / <a href="/webauthn/authenticate/finish">POST /webauthn/authenticate/finish</a></li>
</ul>
<h2>Admin / observability</h2>
<ul>
<li><a href="/api/users">GET /api/users</a> — users + linked identities</li>
<li><a href="/api/admin/fetch-log">GET /api/admin/fetch-log</a> — server-side fetch attempts (SSRF observable)</li>
<li><a href="/health">GET /health</a></li>
</ul>
</body></html>`;
  sendHtml(res, 200, html);
}

function handleHealth(req, res) {
  sendJson(res, 200, {
    ok: true,
    service: 'oauth-lab',
    port: PORT,
    flows: ['magic-link', 'open-registration', 'oauth', 'oidc', 'dynamic-registration', 'refresh-token', 'webauthn'],
    idps: [...IDPS.keys()],
    users: users.size,
  });
}

function handleRoutes(req, res) {
  sendJson(res, 200, {
    routes: [
      'GET /', 'GET /health', 'GET /api/routes', 'GET /api/users',
      'GET /.well-known/openid-configuration?idp=<id>',
      'GET /idp/:idp/.well-known/openid-configuration',
      'POST /api/auth/register', 'POST /api/auth/login',
      'POST /api/auth/magic-link', 'GET|POST /api/auth/magic-link/redeem',
      'GET /api/auth/me',
      'POST /idp/:idp/register', 'POST /idp/idp-acme/verify',
      'GET /oauth/authorize', 'POST /oauth/token', 'GET /oauth/callback',
      'POST /oauth/link', 'POST /oauth/register',
      'GET /api/admin/fetch-log',
      'POST /webauthn/register/begin', 'POST /webauthn/register/finish',
      'POST /webauthn/authenticate/begin', 'POST /webauthn/authenticate/finish',
    ],
  });
}

function handleDiscovery(req, res, idpId) {
  const idp = IDPS.get(idpId);
  if (!idp) return sendJson(res, 404, { error: 'unknown idp', idps: [...IDPS.keys()] });
  const base = baseUrl(req);
  sendJson(res, 200, {
    issuer: `${base}/idp/${idpId}`,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/oauth/token`,
    userinfo_endpoint: `${base}/api/auth/me`,
    jwks_uri: `${base}/idp/${idpId}/jwks.json`,
    registration_endpoint: `${base}/oauth/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['none'],
    claims_supported: ['sub', 'email', 'email_verified', 'iss', 'aud', 'exp', 'iat'],
    email_verified_by_idp: idp.verifiesEmail,
  });
}

// --- passwordless / registration ---------------------------------------
// PLANTED #488: open registration, no email verification step exists at
// all. An attacker can register a victim's email with an attacker
// password; the account is live immediately.
function handleRegister(req, res, body) {
  const { email, password } = body;
  if (!email || !password) return sendJson(res, 400, { error: 'email and password required' });
  if (users.has(email)) return sendJson(res, 400, { error: 'email already registered' });
  const u = createUser(email, password, 'register');
  sendJson(res, 201, { userId: u.userId, email: u.email, verified: false, emailVerificationRequired: false });
}

function handleLogin(req, res, body) {
  const { email, password } = body;
  if (!email || !password) return sendJson(res, 400, { error: 'email and password required' });
  const u = users.get(email);
  if (!u || u.password !== password) return sendJson(res, 401, { error: 'invalid credentials' });
  const sessionToken = mintSession(email, 'password');
  sendJson(res, 200, { sessionToken, email: u.email, userId: u.userId });
}

// PLANTED #487 (a): magic-link tokens never expire and are not
// single-use. The token is returned in the response — there is no
// real email in this lab, by design.
function handleMagicLink(req, res, body) {
  const { email } = body;
  if (!email) return sendJson(res, 400, { error: 'email required' });
  const token = nextToken('ml');
  tokens.set(token, { kind: 'magic-link', email, redeemedCount: 0 });
  sendJson(res, 200, {
    email,
    token,
    magicLink: `/api/auth/magic-link/redeem?token=${token}`,
    expiresIn: null,
    singleUse: false,
  });
}

// PLANTED #487 (b): redeem looks the token up in the UNIFIED token
// store, which also holds OAuth `state` values — so a state value is
// redeemable as a magic link (CVE-2026-114607 shape). Redeeming never
// invalidates the token: no expiry, no single-use.
function handleMagicLinkRedeem(req, res, body, query) {
  const token = query.get('token') || body.token;
  if (!token) return sendJson(res, 400, { error: 'token required' });
  const rec = tokens.get(token);
  if (!rec) return sendJson(res, 400, { error: 'invalid token' });
  rec.redeemedCount += 1;
  let u = users.get(rec.email);
  if (!u) {
    // First sign-in completes the account — this is what lets a
    // pre-registered attacker password survive the victim's
    // magic-link sign-in (#488).
    u = createUser(rec.email, null, 'magic-link');
  }
  u.authMethods.add('magic-link');
  const sessionToken = mintSession(rec.email, 'magic-link');
  sendJson(res, 200, {
    sessionToken,
    email: rec.email,
    userId: u.userId,
    tokenKind: rec.kind,
    redeemedCount: rec.redeemedCount,
    expiresIn: null,
  });
}

function handleMe(req, res, body) {
  const r = requireSession(req, body);
  if (r.error) return sendJson(res, 401, { error: r.error });
  const u = users.get(r.session.email);
  if (!u) return sendJson(res, 404, { error: 'user not found' });
  sendJson(res, 200, publicUser(u));
}

function handleUsers(req, res) {
  sendJson(res, 200, { users: [...users.values()].map(publicUser) });
}

// --- IdPs ---------------------------------------------------------------
// PLANTED #489: idp-quick never verifies email — registration is
// immediately usable as an OAuth identity. idp-acme is the control:
// it issues a verification code (returned here, simulating email
// delivery) and authorize refuses unverified identities there.
function handleIdpRegister(req, res, idpId, body) {
  const idp = IDPS.get(idpId);
  if (!idp) return sendJson(res, 404, { error: 'unknown idp', idps: [...IDPS.keys()] });
  const { email, password } = body;
  if (!email || !password) return sendJson(res, 400, { error: 'email and password required' });
  const key = `${idpId}:${email}`;
  if (idpIdentities.has(key)) return sendJson(res, 400, { error: 'identity already registered at this IdP' });
  const rec = { idpId, email, password, verified: false, verificationCode: null };
  if (idp.verifiesEmail) {
    rec.verificationCode = nextToken('vc');
  } else {
    // idp-quick: no verification step exists at all.
    rec.verified = false;
  }
  idpIdentities.set(key, rec);
  sendJson(res, 201, {
    idp: idpId,
    email,
    verified: rec.verified,
    verificationCode: rec.verificationCode,
    verificationNote: idp.verifiesEmail
      ? 'verification code returned in this response (simulated email delivery)'
      : 'this IdP never verifies email — identity is usable immediately',
  });
}

function handleIdpVerify(req, res, idpId, body) {
  const idp = IDPS.get(idpId);
  if (!idp) return sendJson(res, 404, { error: 'unknown idp' });
  if (!idp.verifiesEmail) {
    return sendJson(res, 400, { error: 'this IdP has no verification step', verified: false });
  }
  const { email, code } = body;
  const rec = idpIdentities.get(`${idpId}:${email}`);
  if (!rec) return sendJson(res, 404, { error: 'identity not found at this IdP' });
  if (rec.verificationCode !== code) return sendJson(res, 400, { error: 'wrong verification code' });
  rec.verified = true;
  sendJson(res, 200, { idp: idpId, email, verified: true });
}

// --- OAuth / OIDC --------------------------------------------------------
// The `email` query param is the SIMULATED IdP session: in a real
// deployment the user would authenticate at the IdP in their browser;
// this lab has no IdP login page, so the caller names the IdP
// identity the flow runs as. That is a lab simplification, documented
// here — the planted flaws are in what the RP does with the result,
// not in the simulation.
function handleAuthorize(req, res, query) {
  const idpId = query.get('idp') || 'idp-acme';
  const idp = IDPS.get(idpId);
  if (!idp) return sendJson(res, 404, { error: 'unknown idp', idps: [...IDPS.keys()] });
  const email = query.get('email');
  if (!email) return sendJson(res, 400, { error: 'email required (simulated IdP session)' });
  const ident = idpIdentities.get(`${idpId}:${email}`);
  if (!ident) return sendJson(res, 404, { error: 'no such identity at this IdP — register it first via POST /idp/:idp/register' });
  if (idp.verifiesEmail && !ident.verified) {
    return sendJson(res, 403, { error: 'email not verified at this IdP', idp: idpId, email });
  }
  const code = nextToken('code');
  const state = query.get('state') || nextToken('st');
  codes.set(code, { email, idpId, state, used: false });
  // PLANTED #487 (c): the state value is stored in the SAME unified
  // token store as magic links, so it is redeemable at
  // /api/auth/magic-link/redeem.
  tokens.set(state, { kind: 'oauth-state', email, redeemedCount: 0 });
  const redirectUri = query.get('redirect_uri') || `${baseUrl(req)}/oauth/callback`;
  const sep = redirectUri.includes('?') ? '&' : '?';
  sendJson(res, 200, {
    code,
    state,
    idp: idpId,
    email,
    redirect_uri: redirectUri,
    redirect: `${redirectUri}${sep}code=${code}&state=${state}`,
  });
}

function issueTokens(req, email, idpId, clientId) {
  const accessToken = nextToken('at');
  const refreshToken = nextToken('rt');
  refreshTokens.set(refreshToken, { email, idpId, reuseCount: 0 });
  const ident = idpIdentities.get(`${idpId}:${email}`);
  const now = Math.floor(Date.now() / 1000);
  const idToken = fakeJwt({
    iss: `${baseUrl(req)}/idp/${idpId}`,
    sub: email,
    email,
    email_verified: ident ? ident.verified : false,
    aud: clientId || 'lab-client',
    iat: now,
    exp: now + 3600,
  });
  return { accessToken, refreshToken, idToken };
}

function handleToken(req, res, body) {
  const grant = body.grant_type;
  if (grant === 'authorization_code') {
    const { code } = body;
    if (!code) return sendJson(res, 400, { error: 'code required' });
    const rec = codes.get(code);
    if (!rec) return sendJson(res, 400, { error: 'invalid code' });
    if (rec.used) return sendJson(res, 400, { error: 'code already used' });
    rec.used = true;
    // PLANTED #492: the token endpoint redeems a code from ANY IdP
    // and the id_token's `iss` is whatever IdP issued the code. The
    // RP never checks `iss` against the IdP the flow started with.
    const t = issueTokens(req, rec.email, rec.idpId, body.client_id);
    return sendJson(res, 200, {
      access_token: t.accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: t.refreshToken,
      id_token: t.idToken,
      issued_by_idp: rec.idpId,
      issuer_validated: false,
    });
  }
  if (grant === 'refresh_token') {
    const { refresh_token: rt } = body;
    if (!rt) return sendJson(res, 400, { error: 'refresh_token required' });
    const rec = refreshTokens.get(rt);
    if (!rec) return sendJson(res, 400, { error: 'invalid refresh token' });
    // PLANTED #497: the refresh token is NEVER rotated and NEVER
    // revoked on reuse — the same token works again and again.
    rec.reuseCount += 1;
    const accessToken = nextToken('at');
    return sendJson(res, 200, {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: rt,
      rotated: false,
      refreshReuseCount: rec.reuseCount,
    });
  }
  return sendJson(res, 400, { error: 'unsupported grant_type', supported: ['authorization_code', 'refresh_token'] });
}

// PLANTED #491: the callback NEVER validates `state` — no state is
// stored for comparison, any value (including a missing one) is
// accepted. An attacker-obtained code therefore logs the caller in
// as the code's owner. If the caller arrives with an existing
// session, that session is OVERWRITTEN to the code owner's identity
// (the observable for code injection: the victim's session token now
// resolves to the attacker via GET /api/auth/me).
function handleCallback(req, res, query, body) {
  const code = query.get('code');
  const state = query.get('state');
  if (!code) return sendJson(res, 400, { error: 'code required' });
  const rec = codes.get(code);
  if (!rec) return sendJson(res, 400, { error: 'invalid code' });
  if (rec.used) return sendJson(res, 400, { error: 'code already used' });
  rec.used = true;
  let u = users.get(rec.email);
  if (!u) {
    u = createUser(rec.email, null, 'oauth');
  }
  u.authMethods.add('oauth');
  if (!u.linkedIdentities.some((li) => li.idp === rec.idpId && li.email === rec.email)) {
    u.linkedIdentities.push({ idp: rec.idpId, email: rec.email });
  }
  const existing = sessionFrom(req, body);
  let sessionToken;
  if (existing && sessions.has(existing)) {
    sessions.set(existing, { email: rec.email, userId: u.userId, via: 'oauth-callback' });
    sessionToken = existing;
  } else {
    sessionToken = mintSession(rec.email, 'oauth-callback');
  }
  sendJson(res, 200, {
    sessionToken,
    email: rec.email,
    userId: u.userId,
    idp: rec.idpId,
    stateAccepted: state || null,
    stateValidated: false,
    issuerValidated: false,
  });
}

// PLANTED #490: linking has no CSRF token and no state check — any
// valid code links that OAuth identity to whoever's session calls
// this endpoint. An attacker code + a victim session links the
// attacker's social account to the victim.
function handleLink(req, res, body) {
  const r = requireSession(req, body);
  if (r.error) return sendJson(res, 401, { error: r.error });
  const { code } = body;
  if (!code) return sendJson(res, 400, { error: 'code required' });
  const rec = codes.get(code);
  if (!rec) return sendJson(res, 400, { error: 'invalid code' });
  if (rec.used) return sendJson(res, 400, { error: 'code already used' });
  rec.used = true;
  const u = users.get(r.session.email);
  if (!u.linkedIdentities.some((li) => li.idp === rec.idpId && li.email === rec.email)) {
    u.linkedIdentities.push({ idp: rec.idpId, email: rec.email });
  }
  sendJson(res, 200, {
    email: u.email,
    linked: { idp: rec.idpId, email: rec.email },
    linkedIdentities: u.linkedIdentities,
    csrfChecked: false,
    stateChecked: false,
  });
}

// PLANTED #493: open dynamic client registration (RFC 7591) with no
// authentication, and the server FETCHES jwks_uri / logo_uri
// server-side. The fetch attempts are logged to /api/admin/fetch-log.
async function handleClientRegister(req, res, body) {
  const clientId = nextToken('cid');
  const clientSecret = nextToken('cs');
  const fetched = [];
  for (const source of ['jwks_uri', 'logo_uri', 'sector_identifier_uri']) {
    if (body[source]) {
      fetched.push(await serverFetch(body[source], source));
    }
  }
  sendJson(res, 201, {
    client_id: clientId,
    client_secret: clientSecret,
    client_name: body.client_name || null,
    redirect_uris: body.redirect_uris || [],
    fetched,
  });
}

function handleFetchLog(req, res) {
  sendJson(res, 200, { fetches: fetchLog });
}

// --- WebAuthn ------------------------------------------------------------
// PLANTED #502: the finish endpoints check NOTHING — any challenge
// (stale, wrong, never issued), any origin, no signature
// verification, no signature-counter check. The response says so
// explicitly so a probe can observe the missing validation directly.
function handleWaRegisterBegin(req, res, body) {
  const { email } = body;
  if (!email) return sendJson(res, 400, { error: 'email required' });
  if (!users.has(email)) createUser(email, null, 'webauthn');
  const challenge = nextToken('ch');
  sendJson(res, 200, { challenge, rpId: 'oauth-lab', userId: users.get(email).userId });
}

function handleWaRegisterFinish(req, res, body) {
  const { email, credentialId, publicKey, challenge } = body;
  if (!email || !credentialId) return sendJson(res, 400, { error: 'email and credentialId required' });
  const key = `${email}:${credentialId}`;
  webauthnCreds.set(key, { email, credentialId, publicKey: publicKey || 'lab-fake-public-key', signCount: 0 });
  const u = users.get(email);
  if (u) u.authMethods.add('webauthn');
  sendJson(res, 200, {
    ok: true,
    credentialId,
    challengeAccepted: challenge || null,
    challengeChecked: false,
  });
}

function handleWaAuthBegin(req, res, body) {
  const { email } = body;
  if (!email) return sendJson(res, 400, { error: 'email required' });
  const challenge = nextToken('ch');
  const allowCredentials = [...webauthnCreds.values()]
    .filter((c) => c.email === email)
    .map((c) => c.credentialId);
  sendJson(res, 200, { challenge, rpId: 'oauth-lab', allowCredentials });
}

function handleWaAuthFinish(req, res, body) {
  const { email, credentialId, challenge, origin, signature } = body;
  if (!email || !credentialId) return sendJson(res, 400, { error: 'email and credentialId required' });
  const cred = webauthnCreds.get(`${email}:${credentialId}`);
  if (!cred) return sendJson(res, 404, { error: 'unknown credential for this user' });
  // Nothing below is verified: challenge, origin, signature and the
  // signature counter are all accepted as presented.
  const sessionToken = mintSession(email, 'webauthn');
  sendJson(res, 200, {
    sessionToken,
    email,
    credentialId,
    originAccepted: origin || null,
    challengeAccepted: challenge || null,
    signatureReceived: Boolean(signature),
    originChecked: false,
    challengeChecked: false,
    signatureChecked: false,
    signCountChecked: false,
  });
}

// ---------------------------------------------------------------- router
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://oauth-lab');
    const pathname = url.pathname;
    const query = url.searchParams;
    const method = req.method;
    let body = {};
    if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
      body = await readBody(req);
    }

    if (method === 'GET' && pathname === '/') return handleIndex(req, res);
    if (method === 'GET' && pathname === '/health') return handleHealth(req, res);
    if (method === 'GET' && pathname === '/api/routes') return handleRoutes(req, res);
    if (method === 'GET' && pathname === '/api/users') return handleUsers(req, res);
    if (method === 'GET' && pathname === '/api/admin/fetch-log') return handleFetchLog(req, res);
    if (method === 'GET' && pathname === '/.well-known/openid-configuration') {
      return handleDiscovery(req, res, query.get('idp') || 'idp-acme');
    }
    if (method === 'GET' && pathname === '/api/auth/me') return handleMe(req, res, body);
    if (method === 'POST' && pathname === '/api/auth/register') return handleRegister(req, res, body);
    if (method === 'POST' && pathname === '/api/auth/login') return handleLogin(req, res, body);
    if (method === 'POST' && pathname === '/api/auth/magic-link') return handleMagicLink(req, res, body);
    if ((method === 'GET' || method === 'POST') && pathname === '/api/auth/magic-link/redeem') {
      return handleMagicLinkRedeem(req, res, body, query);
    }
    if (method === 'GET' && pathname === '/oauth/authorize') return handleAuthorize(req, res, query);
    if (method === 'POST' && pathname === '/oauth/token') return handleToken(req, res, body);
    if (method === 'GET' && pathname === '/oauth/callback') return handleCallback(req, res, query, body);
    if (method === 'POST' && pathname === '/oauth/link') return handleLink(req, res, body);
    if (method === 'POST' && pathname === '/oauth/register') return handleClientRegister(req, res, body);
    if (method === 'POST' && pathname === '/webauthn/register/begin') return handleWaRegisterBegin(req, res, body);
    if (method === 'POST' && pathname === '/webauthn/register/finish') return handleWaRegisterFinish(req, res, body);
    if (method === 'POST' && pathname === '/webauthn/authenticate/begin') return handleWaAuthBegin(req, res, body);
    if (method === 'POST' && pathname === '/webauthn/authenticate/finish') return handleWaAuthFinish(req, res, body);

    const idpWellKnown = pathname.match(/^\/idp\/([^/]+)\/\.well-known\/openid-configuration$/);
    if (method === 'GET' && idpWellKnown) return handleDiscovery(req, res, idpWellKnown[1]);
    const idpRegister = pathname.match(/^\/idp\/([^/]+)\/register$/);
    if (method === 'POST' && idpRegister) return handleIdpRegister(req, res, idpRegister[1], body);
    const idpVerify = pathname.match(/^\/idp\/([^/]+)\/verify$/);
    if (method === 'POST' && idpVerify) return handleIdpVerify(req, res, idpVerify[1], body);

    sendJson(res, 404, { error: 'not found', routes: '/api/routes' });
  } catch (e) {
    sendJson(res, 400, { error: e.message || 'bad request' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`oauth-lab listening on ${HOST}:${PORT}`);
});
