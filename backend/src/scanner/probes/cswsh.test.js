// Tests for the CSWSH probe (row #92) — pure mining/oracle helpers
// plus live-socket tests against a local TCP server that speaks the
// RFC 6455 handshake. No external network: everything is 127.0.0.1.
// The server takes a per-test handler so each oracle branch (open /
// origin-enforcing / auth-required / app-layer-auth / bad accept)
// is exercised against a real socket, not a stubbed transport.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import net from 'node:net';
import {
  probeCswsh,
  matchWsBundleHints,
  WS_PATHS,
  TOKEN_IN_URL_RE,
  extractWsUrls,
  resolveWsUrl,
  cookiesToHeader,
  assessOriginCheck,
  assessCookieAuth,
  assessSensitivePush,
} from './cswsh.js';

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function wsAccept(key) {
  return crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
}

// Minimal WebSocket server for tests. handler({ method, path, headers })
// returns { status, frame?, badAccept?, statusText? }; a frame is sent
// as one unmasked text frame immediately after the 101.
function startWsServer(handler) {
  const sockets = new Set();
  const server = net.createServer((sock) => {
    sockets.add(sock);
    sock.on('close', () => sockets.delete(sock));
    sock.on('error', () => {});
    let buf = Buffer.alloc(0);
    let handled = false;
    sock.on('data', (chunk) => {
      if (handled) return;
      buf = Buffer.concat([buf, chunk]);
      const idx = buf.indexOf('\r\n\r\n');
      if (idx === -1) return;
      handled = true;
      const head = buf.slice(0, idx).toString('latin1');
      const lines = head.split('\r\n');
      const parts = (lines[0] || '').split(' ');
      const headers = {};
      for (const line of lines.slice(1)) {
        const c = line.indexOf(':');
        if (c > 0) headers[line.slice(0, c).trim().toLowerCase()] = line.slice(c + 1).trim();
      }
      const res = handler({ method: parts[0], path: parts[1] || '/', headers });
      if (res.status === 101) {
        const accept = res.badAccept ? 'wrong-accept-value' : wsAccept(headers['sec-websocket-key'] || '');
        sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
        if (res.frame) {
          const payload = Buffer.from(res.frame, 'utf8');
          const header = payload.length < 126
            ? Buffer.from([0x81, payload.length])
            : Buffer.from([0x81, 126, (payload.length >> 8) & 0xff, payload.length & 0xff]);
          sock.write(Buffer.concat([header, payload]));
        }
      } else {
        sock.write(`HTTP/1.1 ${res.status} ${res.statusText || 'Error'}\r\nContent-Length: 0\r\nConnection: close\r\n\r\n`);
        sock.end();
      }
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve({
      server,
      port: server.address().port,
      stop: async () => {
        for (const s of sockets) { try { s.destroy(); } catch {} }
        await new Promise((r) => server.close(r));
      },
    }));
  });
}

const hasSessionCookie = (headers) => /(?:^|;\s*)session=/.test(headers.cookie || '');
// Only `allowed` paths (query stripped) upgrade; everything else 404s.
// Without this the test server would "own" all six known paths and
// every test would see three discovered endpoints.
function onlyPaths(allowed, handler) {
  const set = new Set(allowed);
  return (req) => (set.has(String(req.path || '').split('?')[0]) ? handler(req) : { status: 404, statusText: 'Not Found' });
}
// Accepts every Origin, no auth; pushes `frame` (if any) on connect.
const openHandler = (frame) => () => ({ status: 101, frame });
// 404 on every path — no WebSocket surface at all.
const closedHandler = () => ({ status: 404, statusText: 'Not Found' });
// Only the page's own origin upgrades; anything else gets 403.
// (The legit Origin is the request's own Host under http.)
const originEnforcingHandler = () => ({ headers }) =>
  (headers.origin || '') === `http://${headers.host || ''}` ? { status: 101 } : { status: 403, statusText: 'Forbidden' };
// The control must carry the session cookie; without it, 401.
const authRequiredHandler = (frame) => ({ headers }) =>
  hasSessionCookie(headers) ? { status: 101, frame } : { status: 401, statusText: 'Unauthorized' };
// Accepts every Origin, pushes `frame` only on sockets carrying the session.
const cookiePushHandler = (frame) => ({ headers }) =>
  ({ status: 101, frame: hasSessionCookie(headers) ? frame : undefined });
// Accepts every Origin but greets every socket with an auth demand.
const appLayerAuthHandler = () => ({ status: 101, frame: 'please send auth token to continue' });
// Upgrades the evil Origin but rejects the legit one (broken server).
const evilOnlyHandler = () => ({ headers }) =>
  (headers.origin || '') === `http://${headers.host || ''}` ? { status: 403, statusText: 'Forbidden' } : { status: 101 };
// 101 with a wrong Sec-WebSocket-Accept (broken handshake).
const badAcceptHandler = () => ({ status: 101, badAccept: true });
// Only the token-bearing path upgrades (T3 / quick tests).
const tokenPathHandler = ({ path }) => (path === '/ws?token=abc123' ? { status: 101 } : { status: 404, statusText: 'Not Found' });

const LIVE_OPTS = { timeoutMs: 2000, frameWaitMs: 80 };
const NO_TARGETS = { bundles: [], inline: [] };

describe('cswsh probe', () => {
  // ---- pure: mining -------------------------------------------------
  it('extractWsUrls mines a bare wss:// literal', () => {
    const urls = extractWsUrls('const s = "wss://chat.example.com/ws";', 'http://example.com/');
    assert.deepEqual(urls, ['wss://chat.example.com/ws']);
  });

  it('extractWsUrls resolves a new WebSocket() relative path against the page origin', () => {
    const urls = extractWsUrls('const s = new WebSocket("/live");', 'http://example.com/app/page');
    assert.deepEqual(urls, ['ws://example.com/live']);
    const secure = extractWsUrls("const s = new WebSocket('/live');", 'https://example.com/');
    assert.deepEqual(secure, ['wss://example.com/live']);
  });

  it('extractWsUrls resolves a protocol-relative constructor arg', () => {
    const urls = extractWsUrls('new WebSocket("//ws.example.com/feed")', 'https://example.com/');
    assert.deepEqual(urls, ['wss://ws.example.com/feed']);
  });

  it('extractWsUrls does not mine a variable or template constructor arg', () => {
    assert.deepEqual(extractWsUrls('new WebSocket(url);', 'http://example.com/'), []);
    assert.deepEqual(extractWsUrls('new WebSocket(`wss://x/ws/${id}`);', 'http://example.com/'), []);
  });

  it('extractWsUrls dedupes and trims trailing punctuation', () => {
    const body = 'new WebSocket("ws://a.test/ws"); const u = "ws://a.test/ws"; fetch("ws://a.test/ws");';
    assert.deepEqual(extractWsUrls(body, 'http://a.test/'), ['ws://a.test/ws']);
  });

  it('extractWsUrls ignores non-WebSocket URLs', () => {
    assert.deepEqual(extractWsUrls('fetch("https://api.example.com/data");', 'http://example.com/'), []);
  });

  it('resolveWsUrl returns null for bare relative paths and bad pages', () => {
    assert.equal(resolveWsUrl('socket', 'http://example.com/'), null);
    assert.equal(resolveWsUrl('/ws', 'not-a-url'), null);
    assert.equal(resolveWsUrl('', 'http://example.com/'), null);
  });

  // ---- pure: session cookies ----------------------------------------
  it('cookiesToHeader builds one Cookie header from a lab session', () => {
    assert.equal(
      cookiesToHeader({ token: 't', cookies: [{ name: 'session', value: 'abc' }, { name: 'x', value: '1' }] }),
      'session=abc; x=1'
    );
    assert.equal(cookiesToHeader({ token: 't', cookies: [] }), '');
    assert.equal(cookiesToHeader(null), '');
    assert.equal(cookiesToHeader('session=abc'), 'session=abc');
  });

  // ---- pure: oracle verdicts ----------------------------------------
  it('assessOriginCheck needs the control to upgrade', () => {
    assert.equal(assessOriginCheck({ controlUp: true, evilUp: true }).verdict, 'confirmed');
    assert.equal(assessOriginCheck({ controlUp: true, evilUp: false }).verdict, 'not-vulnerable');
    assert.equal(assessOriginCheck({ controlUp: false, evilUp: true }).verdict, 'uncalibrated');
    assert.equal(assessOriginCheck({ controlUp: false, evilUp: false }).verdict, 'uncalibrated');
  });

  it('assessCookieAuth confirms only on extra data without an auth challenge', () => {
    const confirmed = assessCookieAuth({ authFrames: 'x'.repeat(60), anonFrames: '' });
    assert.equal(confirmed.verdict, 'confirmed');
    const challenged = assessCookieAuth({ authFrames: 'please login first', anonFrames: 'please login first' });
    assert.equal(challenged.verdict, 'app-layer-auth');
    const same = assessCookieAuth({ authFrames: 'hello', anonFrames: 'hello' });
    assert.equal(same.verdict, 'not-vulnerable');
  });

  it('assessSensitivePush needs two stable runs the anonymous socket lacks', () => {
    const runs = [
      { auth: 'email a@b.c balance 250', anon: '' },
      { auth: 'email a@b.c balance 250', anon: '' },
    ];
    const hit = assessSensitivePush(runs);
    assert.equal(hit.verdict, 'confirmed');
    assert.equal(hit.severity, 'high'); // 'balance' is credential-grade
    const emailOnly = assessSensitivePush([
      { auth: 'contact email a@b.c', anon: '' },
      { auth: 'contact email a@b.c', anon: '' },
    ]);
    assert.equal(emailOnly.verdict, 'confirmed');
    assert.equal(emailOnly.severity, 'medium');
    const unstable = assessSensitivePush([
      { auth: 'email a@b.c', anon: '' },
      { auth: 'balance 9', anon: '' },
    ]);
    assert.equal(unstable.verdict, 'not-vulnerable');
    const leaked = assessSensitivePush([
      { auth: 'email a@b.c', anon: 'email a@b.c' },
      { auth: 'email a@b.c', anon: 'email a@b.c' },
    ]);
    assert.equal(leaked.verdict, 'not-vulnerable');
    assert.equal(assessSensitivePush([{ auth: 'email a@b.c', anon: '' }]).verdict, 'not-vulnerable');
  });

  // ---- kept from the original suite ----------------------------------
  it('Sec-WebSocket-Accept canary math matches RFC 6455', () => {
    // Known-answer test: key "dGhlIHNhbXBsZSBub25jZQ==" must accept as
    // "s3pPLMBiTxaQ9kYGzzhZRbK+xOo=" (RFC 6455 section 1.3).
    const key = 'dGhlIHNhbXBsZSBub25jZQ==';
    const accept = crypto.createHash('sha1')
      .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
      .digest('base64');
    assert.equal(accept, 's3pPLMBiTxaQ9kYGzzhZRbK+xOo=');
  });

  it('matches WebSocket bundle hints', () => {
    const hits = matchWsBundleHints('const s = new WebSocket("wss://x.test/ws"); // socket.io fallback');
    assert.ok(hits.length >= 2, `expected >=2 hints, got ${hits.length}`);
  });

  it('returns no hits on plain HTML', () => {
    const hits = matchWsBundleHints('<html><body>hello</body></html>');
    assert.deepEqual(hits, []);
  });

  it('detects token-in-URL pattern', () => {
    assert.ok(TOKEN_IN_URL_RE.test('wss://x.test/ws?token=abc123'));
    assert.ok(TOKEN_IN_URL_RE.test('wss://x.test/ws?access_token=abc'));
    assert.ok(!TOKEN_IN_URL_RE.test('wss://x.test/ws?foo=bar'));
  });

  it('probes at most 6 known paths', () => {
    assert.ok(WS_PATHS.length <= 6, `expected <=6 paths, got ${WS_PATHS.length}`);
    assert.ok(WS_PATHS.includes('/ws'));
  });

  it('rejects malformed URLs without throwing', async () => {
    const findings = await probeCswsh('not-a-url', NO_TARGETS, { timeoutMs: 500, depth: 'quick' });
    assert.deepEqual(findings, []);
  });

  it('returns empty array when no WebSocket endpoint found', async () => {
    // No server listens on this port, so every handshake fails fast.
    const findings = await probeCswsh('http://127.0.0.1:1/', NO_TARGETS, { timeoutMs: 800, depth: 'quick' });
    assert.deepEqual(findings, []);
  });

  // ---- live: T1 origin check -----------------------------------------
  it('T1 fires Medium on an open socket mined from inline code', async () => {
    const { server, port, stop } = await startWsServer(onlyPaths(['/ws'], openHandler()));
    try {
      const pageUrl = `http://127.0.0.1:${port}/`;
      const targets = { bundles: [], inline: [`const s = new WebSocket("ws://127.0.0.1:${port}/ws");`] };
      const diag = {};
      const findings = await probeCswsh(pageUrl, targets, { ...LIVE_OPTS, diagnostics: diag });
      assert.equal(findings.length, 1, JSON.stringify(findings));
      assert.equal(findings[0].class, 'cswsh_origin_missing');
      assert.equal(findings[0].severity, 'medium');
      assert.equal(findings[0].url, `ws://127.0.0.1:${port}/ws`);
      assert.equal(diag.wsSinks, 1);
      assert.equal(diag.wsEndpoints, 1);
      assert.equal(diag.driveAttempted, true);
      assert.equal(diag.driveExecuted, true);
      assert.equal(diag.sessionOk, false);
    } finally {
      await stop(server);
    }
  });

  it('T1 does not fire when the server enforces Origin', async () => {
    const { server, port, stop } = await startWsServer(onlyPaths(['/ws'], originEnforcingHandler()));
    try {
      const pageUrl = `http://127.0.0.1:${port}/`;
      const diag = {};
      const findings = await probeCswsh(pageUrl, NO_TARGETS, { ...LIVE_OPTS, diagnostics: diag });
      assert.deepEqual(findings, []);
      assert.equal(diag.wsEndpoints, 1); // control upgraded — endpoint is real
      assert.equal(diag.driveExecuted, true); // attack ran and was rejected
    } finally {
      await stop(server);
    }
  });

  it('T1 does not fire when the control cannot upgrade but evil could', async () => {
    const { server, port, stop } = await startWsServer(onlyPaths(['/ws'], evilOnlyHandler()));
    try {
      const pageUrl = `http://127.0.0.1:${port}/`;
      const targets = { bundles: [], inline: [`new WebSocket("ws://127.0.0.1:${port}/ws")`] };
      const diag = {};
      const findings = await probeCswsh(pageUrl, targets, { ...LIVE_OPTS, diagnostics: diag });
      assert.deepEqual(findings, []); // control-first: no control, no finding
      assert.equal(diag.wsEndpoints, 0);
      assert.equal(diag.driveExecuted, false);
    } finally {
      await stop(server);
    }
  });

  it('no finding and no endpoint when every known path 404s', async () => {
    const { server, port, stop } = await startWsServer(closedHandler);
    try {
      const diag = {};
      const findings = await probeCswsh(`http://127.0.0.1:${port}/`, NO_TARGETS, { ...LIVE_OPTS, diagnostics: diag });
      assert.deepEqual(findings, []);
      assert.equal(diag.wsSinks, 0);
      assert.equal(diag.wsEndpoints, 0);
      assert.equal(diag.driveAttempted, true);
      assert.equal(diag.driveExecuted, false);
    } finally {
      await stop(server);
    }
  });

  it('a bad Sec-WebSocket-Accept never confirms an endpoint', async () => {
    const { server, port, stop } = await startWsServer(onlyPaths(['/ws'], badAcceptHandler));
    try {
      const diag = {};
      const findings = await probeCswsh(`http://127.0.0.1:${port}/`, NO_TARGETS, { ...LIVE_OPTS, diagnostics: diag });
      assert.deepEqual(findings, []);
      assert.equal(diag.wsEndpoints, 0);
    } finally {
      await stop(server);
    }
  });

  // ---- live: T2 / T3 / T4 ---------------------------------------------
  it('T2 fires High when the evil-Origin socket serves the session', async () => {
    const { server, port, stop } = await startWsServer(onlyPaths(['/ws'], cookiePushHandler('welcome back, live feed update number 1234567890')));
    try {
      const pageUrl = `http://127.0.0.1:${port}/`;
      const session = { token: 't', cookies: [{ name: 'session', value: 'abc' }] };
      const diag = {};
      const findings = await probeCswsh(pageUrl, NO_TARGETS, { ...LIVE_OPTS, session, diagnostics: diag });
      const classes = findings.map((f) => f.class).sort();
      assert.deepEqual(classes, ['cswsh_cookie_auth', 'cswsh_origin_missing']);
      assert.equal(findings.find((f) => f.class === 'cswsh_cookie_auth').severity, 'high');
      assert.equal(diag.sessionOk, true);
    } finally {
      await stop(server);
    }
  });

  it('T2 does not fire without a session even on an open socket', async () => {
    const { server, port, stop } = await startWsServer(onlyPaths(['/ws'], cookiePushHandler('welcome back, live feed update number 1234567890')));
    try {
      const findings = await probeCswsh(`http://127.0.0.1:${port}/`, NO_TARGETS, { ...LIVE_OPTS });
      assert.equal(findings.length, 1);
      assert.equal(findings[0].title, 'WebSocket handshake missing Origin validation — CSWSH possible');
      assert.deepEqual(findings.map((f) => f.class), ['cswsh_origin_missing']);
    } finally {
      await stop(server);
    }
  });

  it('T3 fires Low on a token-bearing mined URL', async () => {
    const { server, port, stop } = await startWsServer(tokenPathHandler);
    try {
      const pageUrl = `http://127.0.0.1:${port}/`;
      const targets = { bundles: [], inline: [`new WebSocket("ws://127.0.0.1:${port}/ws?token=abc123")`] };
      const findings = await probeCswsh(pageUrl, targets, { ...LIVE_OPTS });
      const classes = findings.map((f) => f.class).sort();
      assert.deepEqual(classes, ['cswsh_origin_missing', 'cswsh_token_in_url']);
      assert.equal(findings.find((f) => f.class === 'cswsh_token_in_url').severity, 'low');
      assert.ok(!JSON.stringify(findings).includes('abc123'), 'token value must be redacted');
    } finally {
      await stop(server);
    }
  });

  it('T4 fires High when the authenticated socket stably pushes sensitive data', async () => {
    const { server, port, stop } = await startWsServer(onlyPaths(['/ws'], cookiePushHandler('account email user@example.com balance 250')));
    try {
      const pageUrl = `http://127.0.0.1:${port}/`;
      const session = { token: 't', cookies: [{ name: 'session', value: 'abc' }] };
      const findings = await probeCswsh(pageUrl, NO_TARGETS, { ...LIVE_OPTS, session });
      const classes = findings.map((f) => f.class).sort();
      assert.deepEqual(classes, ['cswsh_cookie_auth', 'cswsh_origin_missing', 'cswsh_sensitive_push']);
      assert.equal(findings.find((f) => f.class === 'cswsh_sensitive_push').severity, 'high');
    } finally {
      await stop(server);
    }
  });

  it('app-layer auth yields the Medium variant, not the full-hijack finding', async () => {
    const { server, port, stop } = await startWsServer(onlyPaths(['/ws'], appLayerAuthHandler));
    try {
      const session = { token: 't', cookies: [{ name: 'session', value: 'abc' }] };
      const findings = await probeCswsh(`http://127.0.0.1:${port}/`, NO_TARGETS, { ...LIVE_OPTS, session });
      assert.equal(findings.length, 2);
      assert.ok(findings.some((f) => f.title === 'WebSocket handshake missing Origin validation — CSWSH possible'));
      assert.ok(findings.some((f) => f.title === 'WebSocket missing Origin check but requires application-layer auth'));
      assert.ok(findings.every((f) => f.severity === 'medium'));
    } finally {
      await stop(server);
    }
  });

  it('quick depth runs T1 only', async () => {
    const { server, port, stop } = await startWsServer(tokenPathHandler);
    try {
      const pageUrl = `http://127.0.0.1:${port}/`;
      const targets = { bundles: [], inline: [`new WebSocket("ws://127.0.0.1:${port}/ws?token=abc123")`] };
      const findings = await probeCswsh(pageUrl, targets, { ...LIVE_OPTS, depth: 'quick' });
      assert.equal(findings.length, 1);
      assert.equal(findings[0].title, 'WebSocket handshake missing Origin validation — CSWSH possible');
      assert.deepEqual(findings.map((f) => f.class), ['cswsh_origin_missing']);
    } finally {
      await stop(server);
    }
  });

  it('an auth-required endpoint is found with a session but yields no finding', async () => {
    const { server, port, stop } = await startWsServer(onlyPaths(['/ws'], authRequiredHandler()));
    try {
      const pageUrl = `http://127.0.0.1:${port}/`;
      const session = { token: 't', cookies: [{ name: 'session', value: 'abc' }] };
      const diag = {};
      const findings = await probeCswsh(pageUrl, NO_TARGETS, { ...LIVE_OPTS, session, diagnostics: diag });
      assert.deepEqual(findings, []);
      assert.equal(diag.wsEndpoints, 1); // discovered via the authenticated control
      assert.equal(diag.driveExecuted, true);
      const diagAnon = {};
      const anon = await probeCswsh(pageUrl, NO_TARGETS, { ...LIVE_OPTS, diagnostics: diagAnon });
      assert.deepEqual(anon, []);
      assert.equal(diagAnon.wsEndpoints, 0); // invisible without the session
    } finally {
      await stop(server);
    }
  });

  // ---- live: mining through the bundle seam ---------------------------
  it('mining counts a bundle endpoint but a dead server yields no finding', async () => {
    const { server, port, stop } = await startWsServer(closedHandler);
    try {
      const pageUrl = `http://127.0.0.1:${port}/`;
      const fetchPage = async (u) => (u.endsWith('/app.js')
        ? { status: 200, body: `new WebSocket("ws://127.0.0.1:${port}/ws")` }
        : { status: 404, body: '' });
      const diag = {};
      const findings = await probeCswsh(pageUrl, { bundles: [`http://127.0.0.1:${port}/app.js`], inline: [] }, { ...LIVE_OPTS, fetchPage, diagnostics: diag });
      assert.deepEqual(findings, []);
      assert.equal(diag.wsSinks, 1);
      assert.equal(diag.wsEndpoints, 0);
    } finally {
      await stop(server);
    }
  });

  it('vendor bundles are not mined', async () => {
    const { server, port, stop } = await startWsServer(closedHandler);
    try {
      const pageUrl = `http://127.0.0.1:${port}/`;
      const fetchPage = async () => ({ status: 200, body: `new WebSocket("ws://127.0.0.1:${port}/ws")` });
      const diag = {};
      const findings = await probeCswsh(pageUrl, { bundles: [`http://127.0.0.1:${port}/vendor.js`], inline: [] }, { ...LIVE_OPTS, fetchPage, diagnostics: diag });
      assert.deepEqual(findings, []);
      assert.equal(diag.wsSinks, 0);
    } finally {
      await stop(server);
    }
  });

  it('a failing bundle fetch never throws', async () => {
    const { server, port, stop } = await startWsServer(closedHandler);
    try {
      const fetchPage = async () => { throw new Error('boom'); };
      const findings = await probeCswsh(`http://127.0.0.1:${port}/`, { bundles: ['http://127.0.0.1:1/app.js'], inline: [] }, { ...LIVE_OPTS, fetchPage });
      assert.deepEqual(findings, []);
    } finally {
      await stop(server);
    }
  });
});
