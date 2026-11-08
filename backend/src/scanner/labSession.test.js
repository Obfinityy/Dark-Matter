// Lab session acquisition (CDP authenticated-DOM-render lane, 8 Nov 2026).
//
// acquireLabSession turns lab canary credentials into a session
// (bearer token and/or cookies) the CDP renderer can carry. Login
// attempts run against a route-aware stub HTTP server here — no real
// lab, no docker, no browser. The stub login password is built by
// concatenation so no secret-shaped literal lands in the file.
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  acquireLabSession,
  parseSetCookie,
  extractBearerTokenFromJson,
  mineLoginPaths,
} from './labSession.js';

const LAB_USER = 'admin@juice-sh.op';
const LAB_PASS = 'admin' + '123';

function startLabStub(handlers) {
  const calls = [];
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      calls.push({ method: req.method, url: req.url, body: raw, headers: req.headers });
      const key = `${req.method} ${req.url}`;
      const h = handlers[key] || handlers['*'];
      const out = h ? h(req, raw) : { status: 404, body: 'not found' };
      res.writeHead(out.status, out.headers || { 'Content-Type': 'application/json' });
      res.end(out.body || '');
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port, calls }));
  });
}
const stopStub = (s) => new Promise((r) => s.server.close(r));
const base = (port) => `http://127.0.0.1:${port}`;

describe('parseSetCookie (pure)', () => {
  test('LAB-1: name/value/domain/path/secure/httpOnly are parsed; malformed input returns null', () => {
    const c = parseSetCookie('PHPSESSID=abc123; Path=/; HttpOnly; Secure; Domain=example.com');
    assert.deepEqual(c, {
      name: 'PHPSESSID',
      value: 'abc123',
      domain: 'example.com',
      path: '/',
      secure: true,
      httpOnly: true,
    });
    assert.equal(parseSetCookie('session=x; Path=/').name, 'session');
    assert.equal(parseSetCookie(''), null);
    assert.equal(parseSetCookie('nonsense-without-equals'), null);
    assert.equal(parseSetCookie(null), null);
  });
});

describe('extractBearerTokenFromJson + mineLoginPaths (pure)', () => {
  test('LAB-2: nested {authentication:{token}} and top-level token are found; absent token is null', () => {
    assert.equal(
      extractBearerTokenFromJson({ authentication: { token: 'jwt-1', bid: 1 } }),
      'jwt-1',
    );
    assert.equal(extractBearerTokenFromJson({ accessToken: 'tok-2' }), 'tok-2');
    assert.equal(extractBearerTokenFromJson({ user: { name: 'x' } }), null);
    assert.equal(extractBearerTokenFromJson(null), null);
    assert.equal(extractBearerTokenFromJson('not-an-object'), null);
  });

  test('LAB-3: bundle mining finds quoted login paths, resolves same-origin, dedupes, skips external and bare words', () => {
    const bundle = `
      const a = fetch("/rest/user/login", { method: "POST" });
      const b = '/api/auth/login';
      const c = "https://evil.example/auth/token";
      const d = 'login';
      const e = "/rest/user/login";
    `;
    assert.deepEqual(mineLoginPaths(bundle, 'http://172.17.0.1:3000'), [
      'http://172.17.0.1:3000/rest/user/login',
      'http://172.17.0.1:3000/api/auth/login',
    ]);
    assert.deepEqual(mineLoginPaths('', 'http://example.com/'), []);
    assert.deepEqual(mineLoginPaths('"/login"', 'not-a-url'), []);
  });
});

describe('acquireLabSession gates (no HTTP must happen)', () => {
  test('LAB-4: no creds → no-lab-creds; non-lab host → not-a-lab-target', async () => {
    const boom = async () => { throw new Error('fetch must not run behind the gate'); };
    const noCreds = await acquireLabSession({
      url: 'http://127.0.0.1:9/',
      creds: null,
      labTargets: '127.0.0.1',
      fetchFn: boom,
    });
    assert.deepEqual(noCreds, { ok: false, reason: 'no-lab-creds' });

    const notLab = await acquireLabSession({
      url: 'http://example.com/',
      creds: { username: LAB_USER, password: LAB_PASS },
      labTargets: '127.0.0.1',
      fetchFn: boom,
    });
    assert.deepEqual(notLab, { ok: false, reason: 'not-a-lab-target' });
  });
});

describe('acquireLabSession against the stub lab', () => {
  test('LAB-5: API login via a bundle-mined path returns the token + cookies', async () => {
    const stub = await startLabStub({
      'GET /main.js': () => ({
        status: 200,
        headers: { 'Content-Type': 'application/javascript' },
        body: 'const LOGIN_API = "/rest/user/login"; fetch(LOGIN_API, {method:"POST"});',
      }),
      'POST /rest/user/login': (req, raw) => {
        const body = JSON.parse(raw);
        assert.equal(body.password, LAB_PASS);
        return {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Set-Cookie': 'session=stub1; Path=/' },
          body: JSON.stringify({ authentication: { token: 'jwt-test-123', bid: 1 } }),
        };
      },
    });
    try {
      const pageBody = `<html><head><script src="/main.js"></script></head><body></body></html>`;
      const r = await acquireLabSession({
        url: `${base(stub.port)}/`,
        routes: [],
        forms: [],
        pageBody,
        creds: { username: LAB_USER, password: LAB_PASS },
        labTargets: '127.0.0.1',
      });
      assert.equal(r.ok, true);
      assert.equal(r.session.token, 'jwt-test-123');
      assert.ok(r.session.cookies.some((c) => c.name === 'session' && c.value === 'stub1'));
      assert.ok(r.session.cookies.every((c) => c.domain === '127.0.0.1'));
      assert.ok(
        stub.calls.some((c) => c.method === 'POST' && c.url === '/rest/user/login'),
        'the login API must have been POSTed',
      );
    } finally {
      await stopStub(stub);
    }
  });

  test('LAB-6: 401 on both credential bodies → login-failed after exactly 2 POSTs', async () => {
    const stub = await startLabStub({
      'POST /rest/user/login': () => ({ status: 401, body: JSON.stringify({ message: 'Invalid credentials' }) }),
    });
    try {
      const r = await acquireLabSession({
        url: `${base(stub.port)}/`,
        routes: [`${base(stub.port)}/rest/user/login`],
        forms: [],
        pageBody: null,
        creds: { username: LAB_USER, password: LAB_PASS },
        labTargets: '127.0.0.1',
      });
      assert.deepEqual(r, { ok: false, reason: 'login-failed' });
      assert.equal(stub.calls.filter((c) => c.method === 'POST').length, 2);
      assert.ok(stub.calls.some((c) => c.body.includes('"email"')));
      assert.ok(stub.calls.some((c) => c.body.includes('"username"')));
    } finally {
      await stopStub(stub);
    }
  });

  test('LAB-7: form login carries hidden inputs, follows the POST, returns the cookie jar', async () => {
    const stub = await startLabStub({
      'GET /login.php': () => ({
        status: 200,
        headers: { 'Content-Type': 'text/html', 'Set-Cookie': 'PHPSESSID=seed1; Path=/' },
        body: '<html><body><form><input type="hidden" name="user_token" value="tok123"></form></body></html>',
      }),
      'POST /login.php': (req, raw) => {
        // The API-login attempt posts JSON first and must NOT win:
        // a JSON body is not a form login, so it gets a 400.
        if (raw.startsWith('{')) return { status: 400, body: 'bad request' };
        assert.ok(raw.includes('user_token=tok123'), `hidden token must ride along, got: ${raw}`);
        assert.ok(raw.includes(`password=${encodeURIComponent(LAB_PASS)}`));
        return {
          status: 200,
          headers: { 'Content-Type': 'text/html', 'Set-Cookie': 'PHPSESSID=logged-in; Path=/' },
          body: '<html><body>Welcome back — <a href="/logout">Logout</a></body></html>',
        };
      },
    });
    try {
      const r = await acquireLabSession({
        url: `${base(stub.port)}/`,
        routes: [],
        forms: [{
          action: `${base(stub.port)}/login.php`,
          method: 'post',
          inputs: [
            { name: 'username', type: 'text', value: '' },
            { name: 'password', type: 'password', value: '' },
            { name: 'user_token', type: 'hidden', value: 'tok123' },
          ],
        }],
        pageBody: null,
        creds: { username: 'admin', password: LAB_PASS },
        labTargets: '127.0.0.1',
      });
      assert.equal(r.ok, true);
      assert.equal(r.session.token, null);
      assert.ok(r.session.cookies.some((c) => c.name === 'PHPSESSID' && c.value === 'logged-in'));
    } finally {
      await stopStub(stub);
    }
  });

  test('LAB-8: no forms, no routes, no page body → no-login-candidate', async () => {
    const boom = async () => { throw new Error('fetch must not run with no candidates'); };
    const r = await acquireLabSession({
      url: 'http://127.0.0.1:9/',
      routes: [],
      forms: [],
      pageBody: null,
      creds: { username: LAB_USER, password: LAB_PASS },
      labTargets: '127.0.0.1',
      fetchFn: boom,
    });
    assert.deepEqual(r, { ok: false, reason: 'no-login-candidate' });
  });

  test('LAB-9: the shared login budget caps at 5 POSTs across candidates', async () => {
    const stub = await startLabStub({
      '*': () => ({ status: 401, body: JSON.stringify({ message: 'no' }) }),
    });
    try {
      const origin = base(stub.port);
      const r = await acquireLabSession({
        url: `${origin}/`,
        routes: [`${origin}/login`, `${origin}/signin`, `${origin}/auth/token`],
        forms: [],
        pageBody: null,
        creds: { username: LAB_USER, password: LAB_PASS },
        labTargets: '127.0.0.1',
      });
      assert.deepEqual(r, { ok: false, reason: 'login-failed' });
      assert.equal(stub.calls.filter((c) => c.method === 'POST').length, 5);
    } finally {
      await stopStub(stub);
    }
  });
});
