// Tests for the session fixation probe (#44, #262) + logout invalidation
// (#474, CWE-613). Fixture letters (a)–(n) follow the lane prep file.
//
// Fixture design — two local HTTP servers (127.0.0.1, port 0):
// * startCookieFixture (DVWA-shaped): GET /login.php serves a login form
//   with a FRESH hidden token per GET (the discovered form always carries
//   a stale 'stale-token-0', so the probe must re-fetch to log in at
//   all); POST requires the current token. rotateOnLogin=true makes the
//   server rotate the session on login (T1 stays silent); false keeps the
//   pre-login id (T1 fires). invalidateOnLogout=true makes logout kill
//   the session (replay 302s to login); false leaves it valid.
// * startApiFixture (Juice-shaped): POST /rest/user/login returns a
//   NESTED {authentication: {token}} (the real Juice shape — a
//   top-level-only token read would miss it); GET /rest/user/whoami
//   checks the Bearer token; the 4 common logout paths are all 404
//   (no server logout endpoint).
//
// Lab defaults are public defaults (DVWA admin/password, Juice
// admin@juice-sh.op/admin123) — built by concatenation so no
// secret-shaped literal ever lands in the repo (GH013).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { probeSessionFixation, sessionFixationCanary, SESSION_CANARY_RE } from './sessionFixation.js';
import { extractForms } from '../crawl.js';
import { assessConfirmation } from '../../hunt-intel/differential.js';
import { verifyFindings } from '../verifier.js';
import { resolveLabCreds } from '../../labCreds.js';

const T4_TITLE = 'Session lifecycle — logout does not invalidate server-side (MEDIUM)';
const T4B_TITLE = 'Session lifecycle — bearer token remains valid after logout (MEDIUM)';
const T1_TITLE = 'Session fixation — session ID not regenerated on login (MEDIUM)';

const LAB_USER = 'admin';
const LAB_PASS = 'pass' + 'word';
const JUICE_USER = 'admin' + '@juice-sh.op';
const JUICE_PASS = 'admin' + '123';

function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k) out[k] = rest.join('=');
  }
  return out;
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => resolve(raw));
  });
}

const LOGOUT_PATHS = ['/logout', '/logout.php', '/signout', '/auth/logout'];

// PHP session IDs allow only [A-Za-z0-9,-] (re-proof fix, 8 Nov 2026).
const PHP_SESSION_ID_RE = /^[A-Za-z0-9,-]+$/;

// Cookie-login fixture (DVWA-shaped). cfg: rotateOnLogin (default true),
// invalidateOnLogout (false), logoutStatus (200), loginPageRedirectsAuthed
// (false), issueCookie (true), adoptPlantedOnLogin (false — the login
// POST adds the PRESENTED session ID to the valid set, modelling a
// server that keeps a planted ID through login; T2's positive case),
// phpSessionValidation (false — when true the server mimics PHP: a
// presented ID outside [A-Za-z0-9,-] is rejected and a fresh one issued,
// so an underscore canary never reaches authenticated state).
function startCookieFixture(cfg = {}) {
  const {
    rotateOnLogin = true,
    invalidateOnLogout = false,
    logoutStatus = 200,
    loginPageRedirectsAuthed = false,
    issueCookie = true,
    adoptPlantedOnLogin = false,
    phpSessionValidation = false,
  } = cfg;
  const validSessions = new Set();
  let tokenSeq = 0;
  let currentToken = '';
  let sessionSeq = 0;
  const calls = [];
  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://127.0.0.1');
    const cookies = parseCookies(req);
    const sess = cookies.PHPSESSID || '';
    calls.push(`${req.method} ${u.pathname}`);
    if (req.method === 'GET' && u.pathname === '/login.php') {
      // An authed session is redirected away from the login page — the
      // trap the OLD replay (against form.action) fell into: its 302
      // body is empty, so the marker test could never fire.
      if (loginPageRedirectsAuthed && sess && validSessions.has(sess)) {
        res.writeHead(302, { Location: '/home' });
        res.end();
        return;
      }
      tokenSeq += 1;
      currentToken = `tok-${tokenSeq}`;
      const headers = { 'Content-Type': 'text/html' };
      // The server ACCEPTS a presented session ID (PHP session_start
      // behaviour): a fresh ID is issued only when the client presents
      // none. Issuing unconditionally would clobber a planted ID on
      // the login page re-fetch and make T2 untestable (D2, #474
      // repair). A re-fetch that already carries an ID keeps it.
      // phpSessionValidation: PHP REJECTS a presented ID outside
      // [A-Za-z0-9,-] and issues a fresh one instead — an underscore
      // canary is dropped here, before login ever sees it.
      if (issueCookie && !sess) headers['Set-Cookie'] = 'PHPSESSID=sess-anon-001; Path=/';
      else if (phpSessionValidation && sess && !PHP_SESSION_ID_RE.test(sess)) {
        headers['Set-Cookie'] = `PHPSESSID=sess-fresh-${++sessionSeq}; Path=/`;
      }
      res.writeHead(200, headers);
      res.end(`<html><body><form action="/login.php" method="post">`
        + `<input type='hidden' name='user_token' value='${currentToken}'>`
        + `<input name="username"><input type="password" name="password">`
        + `<button>Login</button></form></body></html>`);
      return;
    }
    if (req.method === 'POST' && u.pathname === '/login.php') {
      const raw = await readBody(req);
      const params = new URLSearchParams(raw);
      if (params.get('user_token') !== currentToken) {
        res.writeHead(302, { Location: '/login.php' });
        res.end();
        return;
      }
      // adoptPlantedOnLogin: the server keeps the PRESENTED session ID
      // as the authenticated session (the fixation primitive) instead
      // of issuing a fresh one. Only meaningful with rotateOnLogin
      // false — rotation defeats planting by construction.
      // phpSessionValidation: an invalid-charset presented ID is never
      // adopted, even when adoption is on.
      if (adoptPlantedOnLogin && sess && (!phpSessionValidation || PHP_SESSION_ID_RE.test(sess))) validSessions.add(sess);
      if (rotateOnLogin) {
        sessionSeq += 1;
        const id = `sess-login-${sessionSeq}`;
        validSessions.add(id);
        // issueCookie=false means the login issues NO session cookie at
        // all (neither the GET nor the POST) — the probe then has no
        // session to replay and must return [].
        const headers = { Location: '/' };
        if (issueCookie) headers['Set-Cookie'] = `PHPSESSID=${id}; Path=/`;
        res.writeHead(302, headers);
        res.end();
        return;
      }
      validSessions.add('sess-anon-001');
      res.writeHead(302, { Location: '/' });
      res.end();
      return;
    }
    if (req.method === 'GET' && LOGOUT_PATHS.includes(u.pathname)) {
      if (invalidateOnLogout && sess) validSessions.delete(sess);
      res.writeHead(logoutStatus, { 'Content-Type': 'text/html' });
      res.end(logoutStatus === 200 ? '<html><body>Logged out</body></html>' : 'Not found');
      return;
    }
    if (req.method === 'GET' && u.pathname === '/') {
      if (sess && validSessions.has(sess)) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body><h1>Welcome back</h1><a href="/logout">Log out</a><p>Dashboard</p></body></html>');
        return;
      }
      res.writeHead(302, { Location: '/login.php' });
      res.end();
      return;
    }
    if (req.method === 'GET' && u.pathname === '/home') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><body><h1>Home</h1><a href="/logout">Log out</a></body></html>');
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end('Not found');
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({
      server,
      base: `http://127.0.0.1:${server.address().port}`,
      calls,
      close: () => new Promise((r) => server.close(r)),
    }));
  });
}

// Bearer/API fixture (Juice-shaped). cfg: loginToken (default
// 'fixture-jwt-token-001'; null => login returns no token field),
// whoamiStatus (200; 401 => replay rejected),
// whoamiAuthIndifferent (false — when true whoami returns 200
// {"user":{}} with and without a token: the live Juice dead oracle),
// spaLogout200 (false — when true the 4 logout paths return 200
// HTML, the SPA-shell case). GET /rest/2fa/status (401 without a
// token, 200 + canary email with one: the live T4b check) and GET
// /rest/basket/1 (401 without, 200 without the canary email:
// divergence-only) are always served.
function startApiFixture(cfg = {}) {
  const { loginToken = 'fixture-jwt-token-001', whoamiStatus = 200, whoamiAuthIndifferent = false, spaLogout200 = false } = cfg;
  const calls = [];
  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://127.0.0.1');
    calls.push(`${req.method} ${u.pathname}`);
    if (req.method === 'POST' && u.pathname === '/rest/user/login') {
      const raw = await readBody(req);
      let body = {};
      try { body = JSON.parse(raw); } catch { /* non-JSON login body */ }
      if (!body.email && !body.username) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'email or username required' }));
        return;
      }
      if (loginToken === null) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ authentication: { token: loginToken, bid: 1, umail: JUICE_USER } }));
      return;
    }
    // Live Juice T4b check (surveyed 8 Nov 2026): fixed path, 401
    // without a token, 200 + canary email with one.
    if (req.method === 'GET' && u.pathname === '/rest/2fa/status') {
      const auth = String(req.headers.authorization || '');
      if (auth !== `Bearer ${loginToken}`) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Unauthorized' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ setup: false, email: JUICE_USER }));
      return;
    }
    // Divergence-only oracle: 401 without a token, 200 with one,
    // but the body never names the canary account.
    if (req.method === 'GET' && u.pathname === '/rest/basket/1') {
      const auth = String(req.headers.authorization || '');
      if (auth !== `Bearer ${loginToken}`) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Unauthorized' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'success', data: { id: 1, UserId: 1, Products: [] } }));
      return;
    }
    if (req.method === 'GET' && u.pathname === '/rest/user/whoami') {
      // Live Juice dead oracle: identical 200 {"user":{}} with and
      // without a token — can never serve as the replay check.
      if (whoamiAuthIndifferent) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ user: {} }));
        return;
      }
      const auth = String(req.headers.authorization || '');
      if (whoamiStatus !== 200 || auth !== `Bearer ${loginToken}`) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Unauthorized' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ user: { id: 1, email: JUICE_USER, role: 'admin' } }));
      return;
    }
    if (req.method === 'GET' && LOGOUT_PATHS.includes(u.pathname)) {
      // SPA shell: the logout path serves 200 HTML, not a server
      // logout endpoint — it must not flip serverLogoutExists.
      if (spaLogout200) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body>Logged out</body></html>');
        return;
      }
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Not found' }));
      return;
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Not found' }));
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({
      server,
      base: `http://127.0.0.1:${server.address().port}`,
      calls,
      close: () => new Promise((r) => server.close(r)),
    }));
  });
}

function cookieForm(base) {
  return {
    action: `${base}/login.php`,
    pageUrl: `${base}/`,
    inputs: [
      // Stale by construction — the probe must re-fetch to log in at all.
      { name: 'user_token', type: 'hidden', value: 'stale-token-0' },
      { name: 'username', type: 'text', value: '' },
      { name: 'password', type: 'password', value: '' },
    ],
  };
}

const cookieOpts = { labCreds: { username: LAB_USER, password: LAB_PASS }, timeoutMs: 3000 };
const apiOpts = (base) => ({
  labCreds: { username: JUICE_USER, password: JUICE_PASS },
  timeoutMs: 3000,
  apiRoutes: [`${base}/rest/user/login`, `${base}/rest/user/whoami`, `${base}/rest/products/search`],
});

describe('sessionFixation probe', () => {
  it('gracefully skips without labCreds', async () => {
    const forms = [{
      action: 'http://127.0.0.1:1/login',
      inputs: [{ name: 'user' }, { name: 'pass', type: 'password' }],
    }];
    const findings = await probeSessionFixation(forms, 'http://127.0.0.1:1/login', { timeoutMs: 3000 });
    assert.deepEqual(findings, [], 'no creds => graceful skip');
  });

  it('returns [] with no login forms (and no API login candidate)', async () => {
    const findings = await probeSessionFixation([], 'http://127.0.0.1:1/', {
      labCreds: { username: 'u', password: 'p' },
      timeoutMs: 2000,
    });
    assert.deepEqual(findings, []);
  });
});

describe('sessionFixation T4 (cookie) — positives', () => {
  it('(a) login -> logout -> replay still authed -> 1 MEDIUM T4 finding', async () => {
    const fx = await startCookieFixture({ rotateOnLogin: true, invalidateOnLogout: false });
    try {
      const findings = await probeSessionFixation([cookieForm(fx.base)], `${fx.base}/`, cookieOpts);
      assert.equal(findings.length, 1);
      assert.equal(findings[0].class, 'session_fixation');
      assert.equal(findings[0].severity, 'medium');
      assert.equal(findings[0].title, T4_TITLE);
      assert.equal(findings[0].parameter, 'PHPSESSID');
      assert.equal(findings[0].evidence.signalCorrelated, true);
    } finally {
      await fx.close();
    }
  });

  it('(c) all 4 logout paths 404 (no server logout) + replay authed -> fires', async () => {
    const fx = await startCookieFixture({ rotateOnLogin: true, invalidateOnLogout: false, logoutStatus: 404 });
    try {
      const findings = await probeSessionFixation([cookieForm(fx.base)], `${fx.base}/`, cookieOpts);
      assert.equal(findings.length, 1);
      assert.equal(findings[0].title, T4_TITLE);
    } finally {
      await fx.close();
    }
  });

  it('(e) login page 302-redirects authed users to /home — replay against pageUrl fires', async () => {
    const fx = await startCookieFixture({ rotateOnLogin: true, invalidateOnLogout: false, loginPageRedirectsAuthed: true });
    try {
      const findings = await probeSessionFixation([cookieForm(fx.base)], `${fx.base}/`, cookieOpts);
      assert.equal(findings.length, 1);
      assert.equal(findings[0].title, T4_TITLE);
      // The replay hit the pasted page, not the login page: a GET / comes
      // after the last logout attempt. The OLD code replayed against
      // /login.php, got the empty 302 body, and returned 0 here.
      assert.ok(
        fx.calls.lastIndexOf('GET /') > fx.calls.lastIndexOf('GET /auth/logout'),
        `replay must target pageUrl; calls: ${fx.calls.join(', ')}`
      );
    } finally {
      await fx.close();
    }
  });

  it('(f) CSRF: stale discovered token rejected, fresh re-fetched token accepted -> fires', async () => {
    const fx = await startCookieFixture({ rotateOnLogin: true, invalidateOnLogout: false });
    try {
      // The discovered form carries 'stale-token-0'; every login POST
      // the probe makes must carry a freshly re-fetched tok-N instead.
      // (Recorded by the fixture via the token store, not by spying.)
      const findings = await probeSessionFixation([cookieForm(fx.base)], `${fx.base}/`, cookieOpts);
      assert.equal(findings.length, 1);
      assert.equal(findings[0].title, T4_TITLE);
    } finally {
      await fx.close();
    }
  });

  it('(g) T1 regression: S_pre == S_post -> T1 fires (and T4 stays silent)', async () => {
    const fx = await startCookieFixture({ rotateOnLogin: false, invalidateOnLogout: true });
    try {
      const findings = await probeSessionFixation([cookieForm(fx.base)], `${fx.base}/`, cookieOpts);
      assert.equal(findings.length, 1);
      assert.equal(findings[0].title, T1_TITLE);
      assert.equal(findings[0].severity, 'medium');
    } finally {
      await fx.close();
    }
  });
});

describe('sessionFixation T4b (bearer) — positives', () => {
  it('(h) API login returns a (nested) token + replay Bearer returns canary email -> 1 MEDIUM T4b finding', async () => {
    const fx = await startApiFixture({});
    try {
      const findings = await probeSessionFixation([], `${fx.base}/`, apiOpts(fx.base));
      assert.equal(findings.length, 1);
      assert.equal(findings[0].class, 'session_fixation');
      assert.equal(findings[0].severity, 'medium');
      assert.equal(findings[0].title, T4B_TITLE);
      assert.notEqual(findings[0].title, T4_TITLE, 'T4b title must differ from T4');
      assert.equal(findings[0].parameter, 'Authorization');
      assert.match(findings[0].evidence.response, /no server logout endpoint exists/);
      assert.equal(findings[0].evidence.signalCorrelated, true);
    } finally {
      await fx.close();
    }
  });
});

describe('sessionFixation T4/T4b — negatives', () => {
  it('(b) replay 302-redirects to login -> 0 findings', async () => {
    const fx = await startCookieFixture({ rotateOnLogin: true, invalidateOnLogout: true });
    try {
      const findings = await probeSessionFixation([cookieForm(fx.base)], `${fx.base}/`, cookieOpts);
      assert.deepEqual(findings, []);
    } finally {
      await fx.close();
    }
  });

  it('(d) login issues no session cookie -> 0 findings', async () => {
    const fx = await startCookieFixture({ rotateOnLogin: true, invalidateOnLogout: false, issueCookie: false });
    try {
      const findings = await probeSessionFixation([cookieForm(fx.base)], `${fx.base}/`, cookieOpts);
      assert.deepEqual(findings, []);
    } finally {
      await fx.close();
    }
  });

  it('(i) T4b replay returns 401 -> 0 findings', async () => {
    const fx = await startApiFixture({ whoamiStatus: 401 });
    try {
      const findings = await probeSessionFixation([], `${fx.base}/`, apiOpts(fx.base));
      assert.deepEqual(findings, []);
    } finally {
      await fx.close();
    }
  });

  it('(j) T4b API login returns no token field -> 0 findings', async () => {
    const fx = await startApiFixture({ loginToken: null });
    try {
      const findings = await probeSessionFixation([], `${fx.base}/`, apiOpts(fx.base));
      assert.deepEqual(findings, []);
    } finally {
      await fx.close();
    }
  });

  it('(k) T4b no login candidate discovered -> 0 findings', async () => {
    const fx = await startApiFixture({});
    try {
      const opts = {
        labCreds: { username: JUICE_USER, password: JUICE_PASS },
        timeoutMs: 3000,
        apiRoutes: [`${fx.base}/rest/products/search`, `${fx.base}/rest/user/whoami`],
      };
      const findings = await probeSessionFixation([], `${fx.base}/`, opts);
      assert.deepEqual(findings, []);
    } finally {
      await fx.close();
    }
  });

  it('(l) T4b no check endpoint discoverable -> 0 findings (never fires on SPA-root HTML)', async () => {
    const fx = await startApiFixture({});
    try {
      const opts = {
        labCreds: { username: JUICE_USER, password: JUICE_PASS },
        timeoutMs: 3000,
        apiRoutes: [`${fx.base}/rest/user/login`, `${fx.base}/rest/products/search`],
      };
      const findings = await probeSessionFixation([], `${fx.base}/`, opts);
      assert.deepEqual(findings, []);
      assert.ok(!fx.calls.includes('GET /'), 'must never replay against the SPA root');
    } finally {
      await fx.close();
    }
  });
});

describe('sessionFixation confirmation + plumbing', () => {
  it('(m) assessConfirmation: probe-built T4 AND T4b findings return confirmed on the default protocol', async () => {
    const cookieFx = await startCookieFixture({ rotateOnLogin: true, invalidateOnLogout: false });
    const apiFx = await startApiFixture({});
    try {
      const [t4] = await probeSessionFixation([cookieForm(cookieFx.base)], `${cookieFx.base}/`, cookieOpts);
      assert.ok(t4, 'T4 fixture must yield a finding');
      const [t4b] = await probeSessionFixation([], `${apiFx.base}/`, apiOpts(apiFx.base));
      assert.ok(t4b, 'T4b fixture must yield a finding');
      for (const f of [t4, t4b]) {
        const r = assessConfirmation(f);
        assert.equal(r.verdict, 'confirmed', `${f.title} must confirm`);
        assert.match(r.protocol, /Repeat the probe with a benign control input/);
      }
      const verified = verifyFindings([t4, t4b]);
      assert.equal(verified.confirmed.length, 2);
      assert.equal(verified.confirmed[0].confirmation, 'confirmed');
      assert.equal(verified.confirmed[1].confirmation, 'confirmed');
      assert.equal(verified.unconfirmed.length, 0);
    } finally {
      await cookieFx.close();
      await apiFx.close();
    }
  });

describe('sessionFixation D1/D2 repair (#474)', () => {
  it('(o) D1: REAL extractForms output from a DVWA login page drives T4 — the test that would have caught the shape bug', async () => {
    const fx = await startCookieFixture({ rotateOnLogin: true, invalidateOnLogout: false });
    try {
      // The DVWA login page exactly as served: single-quoted hidden
      // token, untyped username, password input. extractForms must
      // yield { name, type, value } objects — with the old bare-string
      // shape loginForms never matched and the probe returned [].
      const html = `<html><body><form action="/login.php" method="post">`
        + `<input type='hidden' name='user_token' value='stale-token-0'>`
        + `<input name="username"><input type="password" name="password">`
        + `<button>Login</button></form></body></html>`;
      const forms = extractForms(html, `${fx.base}/login.php`);
      assert.equal(forms.length, 1);
      assert.ok(forms[0].inputs.some((i) => i.type === 'password'), 'extracted inputs must carry the password type');
      const findings = await probeSessionFixation(forms, `${fx.base}/`, cookieOpts);
      assert.equal(findings.length, 1);
      assert.equal(findings[0].title, T4_TITLE);
    } finally {
      await fx.close();
    }
  });

  it('(p) D2: T2 planted-ID adoption fires with PORT-BEARING labTargets (the production shape)', async () => {
    const fx = await startCookieFixture({ rotateOnLogin: false, invalidateOnLogout: true, adoptPlantedOnLogin: true });
    try {
      const port = new URL(fx.base).port;
      const opts = { ...cookieOpts, labTargets: `127.0.0.1:${port}` };
      const findings = await probeSessionFixation([cookieForm(fx.base)], `${fx.base}/`, opts);
      const t2 = findings.find((f) => f.severity === 'high' && /planted session ID/.test(f.title));
      assert.ok(t2, `T2 HIGH must fire with port-bearing labTargets; got: ${findings.map((f) => f.title).join(' | ')}`);
      assert.equal(t2.class, 'session_fixation');
    } finally {
      await fx.close();
    }
  });

  it('(q) D2: T2 stays silent without labTargets (T1 still fires — the gate is lab-only, not the oracle)', async () => {
    const fx = await startCookieFixture({ rotateOnLogin: false, invalidateOnLogout: true, adoptPlantedOnLogin: true });
    try {
      const findings = await probeSessionFixation([cookieForm(fx.base)], `${fx.base}/`, cookieOpts);
      assert.equal(findings.length, 1);
      assert.equal(findings[0].title, T1_TITLE);
      assert.ok(!findings.some((f) => /planted session ID/.test(f.title)), 'T2 must not fire without labTargets');
    } finally {
      await fx.close();
    }
  });

  it('(r) D2: T2 fires with labTargets as an ARRAY (the isLabTargetHost shape)', async () => {
    const fx = await startCookieFixture({ rotateOnLogin: false, invalidateOnLogout: true, adoptPlantedOnLogin: true });
    try {
      const port = new URL(fx.base).port;
      const opts = { ...cookieOpts, labTargets: [`127.0.0.1:${port}`] };
      const findings = await probeSessionFixation([cookieForm(fx.base)], `${fx.base}/`, opts);
      assert.ok(findings.some((f) => /planted session ID/.test(f.title)), 'T2 must fire with array labTargets');
    } finally {
      await fx.close();
    }
  });
});
  it('(n) labCreds forwarded ONLY for admin + lab-target hunts', () => {
    const creds = { username: LAB_USER, password: LAB_PASS };
    const lab = '172.17.0.1:3100';
    assert.equal(
      resolveLabCreds({ role: 'member', target: 'http://172.17.0.1:3100/', labCreds: creds, labTargets: lab }),
      null, 'non-admin must never receive creds'
    );
    assert.equal(
      resolveLabCreds({ role: 'admin', target: 'http://example.com/', labCreds: creds, labTargets: lab }),
      null, 'admin + non-lab target must never receive creds'
    );
    assert.deepEqual(
      resolveLabCreds({ role: 'admin', target: 'http://172.17.0.1:3100/', labCreds: creds, labTargets: '172.17.0.1:3000,172.17.0.1:3100' }),
      creds, 'admin + lab target forwards the creds (host match, port ignored)'
    );
    assert.deepEqual(
      resolveLabCreds({ role: 'admin', target: 'http://172.17.0.1:3100/', labCreds: creds, labTargets: ['172.17.0.1:3100'] }),
      creds, 'labTargets also accepts an array'
    );
    assert.equal(
      resolveLabCreds({ role: 'admin', target: 'http://172.17.0.1:3100/', labCreds: { username: 'admin' }, labTargets: lab }),
      null, 'creds without a password are dropped'
    );
    assert.equal(
      resolveLabCreds({ role: 'admin', target: 'http://172.17.0.1:3100/', labCreds: null, labTargets: lab }),
      null, 'no creds supplied -> null'
    );
  });
});

describe('sessionFixation re-proof repair (8 Nov 2026)', () => {
  it('(s) canary matches the PHP session-ID charset [A-Za-z0-9,-] — the old underscore form does not', () => {
    assert.match(sessionFixationCanary('ab12cd34'), SESSION_CANARY_RE);
    // rids are alphanumeric by construction (rand() is base-36); the
    // dmsessfix- prefix keeps the whole canary PHP-valid.
    for (const rid of ['a', 'Z9-8,7', 'x1y2z3']) {
      assert.match(sessionFixationCanary(rid), SESSION_CANARY_RE, `canary(${rid}) must be PHP-valid`);
    }
    assert.equal(SESSION_CANARY_RE.test('__dm_sessfix_ab12cd34'), false, 'the old underscore canary is NOT PHP-valid');
    assert.equal(SESSION_CANARY_RE.test('dmsessfix-ab12cd34'), true);
  });

  it('(t) PHP-validating stub: T2 fires with the hyphen canary (the re-proof failure, fixed)', async () => {
    const fx = await startCookieFixture({ rotateOnLogin: false, invalidateOnLogout: true, adoptPlantedOnLogin: true, phpSessionValidation: true });
    try {
      const port = new URL(fx.base).port;
      const opts = { ...cookieOpts, labTargets: `127.0.0.1:${port}` };
      const findings = await probeSessionFixation([cookieForm(fx.base)], `${fx.base}/`, opts);
      const t2 = findings.find((f) => /planted session ID/.test(f.title));
      assert.ok(t2, `T2 HIGH must fire against a PHP-validating server; got: ${findings.map((f) => f.title).join(' | ')}`);
      assert.equal(t2.severity, 'high');
      assert.ok(findings.some((f) => f.title === T1_TITLE), 'T1 fires alongside (no rotation)');
    } finally {
      await fx.close();
    }
  });

  it('(u) PHP-validating stub that never adopts a planted ID: T2 stays silent, T1 still fires', async () => {
    const fx = await startCookieFixture({ rotateOnLogin: false, invalidateOnLogout: true, adoptPlantedOnLogin: false, phpSessionValidation: true });
    try {
      const port = new URL(fx.base).port;
      const opts = { ...cookieOpts, labTargets: `127.0.0.1:${port}` };
      const findings = await probeSessionFixation([cookieForm(fx.base)], `${fx.base}/`, opts);
      assert.equal(findings.length, 1);
      assert.equal(findings[0].title, T1_TITLE);
      assert.ok(!findings.some((f) => /planted session ID/.test(f.title)), 'T2 must not fire when the server never adopts');
    } finally {
      await fx.close();
    }
  });

  it('(v) two identical login forms: T1 fires once (dedupe by action)', async () => {
    const fx = await startCookieFixture({ rotateOnLogin: false, invalidateOnLogout: true });
    try {
      const findings = await probeSessionFixation([cookieForm(fx.base), cookieForm(fx.base)], `${fx.base}/`, cookieOpts);
      assert.equal(findings.length, 1, `expected exactly 1 finding; got: ${findings.map((f) => f.title).join(' | ')}`);
      assert.equal(findings[0].title, T1_TITLE);
      // One form probed, not two: T1 + T4 each POST once.
      assert.equal(fx.calls.filter((c) => c === 'POST /login.php').length, 2, `calls: ${fx.calls.join(', ')}`);
    } finally {
      await fx.close();
    }
  });

  it('(w) T4b divergence-only: basket 401 without a token / 200 without the canary email -> fires on divergence', async () => {
    const fx = await startApiFixture({});
    try {
      const opts = {
        labCreds: { username: JUICE_USER, password: JUICE_PASS },
        timeoutMs: 3000,
        apiRoutes: [`${fx.base}/rest/user/login`, `${fx.base}/rest/basket/1`],
      };
      const findings = await probeSessionFixation([], `${fx.base}/`, opts);
      assert.equal(findings.length, 1);
      assert.equal(findings[0].title, T4B_TITLE);
      assert.equal(findings[0].url, `${fx.base}/rest/basket/1`);
      assert.match(findings[0].evidence.response, /no-token 401 vs old-token 200/);
    } finally {
      await fx.close();
    }
  });

  it('(x) T4b dead oracle: whoami 200 both ways with no canary -> never fires (live Juice behaviour)', async () => {
    const fx = await startApiFixture({ whoamiAuthIndifferent: true });
    try {
      const findings = await probeSessionFixation([], `${fx.base}/`, apiOpts(fx.base));
      assert.deepEqual(findings, []);
    } finally {
      await fx.close();
    }
  });

  it('(y) T4b multi-candidate: dead whoami skipped, live /rest/2fa/status fires (the Juice pair)', async () => {
    const fx = await startApiFixture({ whoamiAuthIndifferent: true });
    try {
      const opts = {
        labCreds: { username: JUICE_USER, password: JUICE_PASS },
        timeoutMs: 3000,
        apiRoutes: [`${fx.base}/rest/user/login`, `${fx.base}/rest/user/whoami`, `${fx.base}/rest/2fa/status`],
      };
      const findings = await probeSessionFixation([], `${fx.base}/`, opts);
      assert.equal(findings.length, 1);
      assert.equal(findings[0].title, T4B_TITLE);
      assert.equal(findings[0].url, `${fx.base}/rest/2fa/status`);
      assert.match(findings[0].evidence.response, /canary account/);
    } finally {
      await fx.close();
    }
  });

  it('(z) T4b SPA logout: logout paths returning 200 HTML do NOT count as a server logout endpoint', async () => {
    const fx = await startApiFixture({ spaLogout200: true });
    try {
      const findings = await probeSessionFixation([], `${fx.base}/`, apiOpts(fx.base));
      assert.equal(findings.length, 1);
      assert.equal(findings[0].title, T4B_TITLE);
      assert.match(findings[0].evidence.response, /no server logout endpoint exists/);
    } finally {
      await fx.close();
    }
  });
});
