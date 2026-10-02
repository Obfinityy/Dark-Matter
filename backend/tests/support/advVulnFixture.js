/**
 * advVulnFixture.js — deliberately vulnerable LOCAL fixture for the Wave-2
 * advanced probe suite (n6b). Listens ONLY on 127.0.0.1.
 *
 * Vulnerabilities simulated (deterministic, in-fixture):
 *  - JWT: accepts alg:none; HMAC secret is "secret"; kid ".." → ENOENT error
 *    leaking the path; jku → fetches the URL and trusts the returned JWK.
 *  - SSTI: /greet evaluates {{a*b}} arithmetic; lone "{{" → jinja2 error.
 *  - XXE: /api/xml fetches http:// SYSTEM entity URLs; file:///etc/passwd
 *    returns canned passwd content.
 *  - GraphQL: introspection on, field suggestions, batching, GET queries.
 *  - WebSocket: /ws upgrades with any/no Origin, pushes a frame pre-auth.
 *  - Race: /api/coupon/apply always succeeds (no single-use lock);
 *    /api/transfer decrements balance without overdraft protection.
 *  - Secrets: /app.js ships hardcoded secrets (+ one placeholder that must
 *    NOT be flagged).
 */
import http from 'node:http';
import crypto from 'node:crypto';

export const FIXTURE_PORT = 4761;
const HOST = '127.0.0.1';
const WEAK_SECRET = 'secret';

const b64urlJson = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64url');
const signHS256 = (header, payload, secret) => {
  const h = b64urlJson(header); const p = b64urlJson(payload);
  return `${h}.${p}.${crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url')}`;
};

const APP_JS = `// fixture bundle — deliberately ships secrets
// (synthetic key assembled at runtime so no secret literal lives in source)
const STRIPE_KEY = ${JSON.stringify(["sk_live", "51H7xYqK9mN2pQ4rT6vW8xZ0aB1c"].join("_"))};
const AWS_KEY = "AKIAZZZZQWERTY678901";
const cfg = { apiKey: "9f8e7d6c5b4a39281706f5e4d3c2b1a" };
const placeholder = { apiKey: "test-key-123" };
console.log("fixture app loaded");
`;

const HOME = `<!DOCTYPE html><html><head><title>adv fixture</title></head><body>
<h1>adv fixture</h1>
<script src="/app.js"></script>
<p><a href="/greet?name=hi">greet</a> <a href="/graphql">graphql</a></p>
</body></html>`;

function send(res, code, body, ctype = 'application/json') {
  const data = Buffer.from(body);
  res.writeHead(code, { 'content-type': ctype, 'content-length': data.length });
  res.end(data);
}

function verifyJwt(token) {
  // returns { ok, status, body } — fixture semantics with planted bugs
  const parts = String(token).split('.');
  if (parts.length < 2) return { ok: false, status: 401, body: '{"error":"malformed"}' };
  let header, payload;
  try {
    header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch { return { ok: false, status: 401, body: '{"error":"malformed"}' }; }

  // BUG 1: kid used as a filesystem path → traversal error leaks the path
  if (header.kid && String(header.kid).includes('..')) {
    return { ok: false, status: 500, body: `ENOENT: no such file or directory, open 'keys/${header.kid}'` };
  }
  // BUG 2: alg:none accepted
  if (header.alg === 'none') {
    return { ok: true, status: 200, body: JSON.stringify({ user: 'fixture-user', role: payload.role || 'user' }) };
  }
  // BUG 3: jku — fetch attacker JWKS and trust it
  if (header.jku) {
    return new Promise((resolve) => {
      http.get(header.jku, (r) => {
        let raw = '';
        r.on('data', (c) => { raw += c; });
        r.on('end', () => {
          try {
            const jwks = JSON.parse(raw);
            const jwk = jwks.keys[0];
            const pub = crypto.createPublicKey({ key: jwk, format: 'jwk' });
            const ok = crypto.verify('sha256', Buffer.from(`${parts[0]}.${parts[1]}`), pub, Buffer.from(parts[2] || '', 'base64url'));
            resolve(ok
              ? { ok: true, status: 200, body: JSON.stringify({ user: 'fixture-user', role: payload.role || 'user', via: 'jku' }) }
              : { ok: false, status: 401, body: '{"error":"bad jku signature"}' });
          } catch (e) { resolve({ ok: false, status: 401, body: '{"error":"bad jwks"}' }); }
        });
      }).on('error', () => resolve({ ok: false, status: 401, body: '{"error":"jku fetch failed"}' }));
    });
  }
  // Normal path: HS256 with the weak secret
  if (header.alg === 'HS256') {
    const good = signHS256(header, payload, WEAK_SECRET);
    if (token === good) {
      return { ok: true, status: 200, body: JSON.stringify({ user: 'fixture-user', role: payload.role || 'user' }) };
    }
  }
  return { ok: false, status: 401, body: '{"error":"unauthorized"}' };
}

export async function startAdvFixture() {
  let balance = 500;
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, `http://${HOST}:${FIXTURE_PORT}`);
    const qs = u.searchParams;

    if (req.method === 'GET' && u.pathname === '/') return send(res, 200, HOME, 'text/html; charset=utf-8');
    if (req.method === 'GET' && u.pathname === '/app.js') return send(res, 200, APP_JS, 'application/javascript');
    if (req.method === 'GET' && u.pathname === '/health') return send(res, 200, '{"ok":true}');

    // --- JWT ---
    if (req.method === 'POST' && u.pathname === '/api/login') {
      let raw = '';
      req.on('data', (c) => { raw += c; });
      req.on('end', () => {
        const token = signHS256({ alg: 'HS256', typ: 'JWT' }, { sub: 'user', role: 'user' }, WEAK_SECRET);
        send(res, 200, JSON.stringify({ token }));
      });
      return;
    }
    if (req.method === 'GET' && u.pathname === '/api/me') {
      const tok = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      if (!tok) return send(res, 401, '{"error":"unauthorized"}');
      Promise.resolve(verifyJwt(tok)).then((r) => send(res, r.status, r.body));
      return;
    }

    // --- SSTI ---
    if (req.method === 'GET' && u.pathname === '/greet') {
      const name = qs.get('name') || 'stranger';
      if (/\{\{/.test(name)) {
        const out = name.replace(/\{\{\s*(\d+)\s*\*\s*(\d+)\s*\}\}/g, (_, x, y) => String(Number(x) * Number(y)));
        if (out !== name) return send(res, 200, `Hello, ${out}!`, 'text/html; charset=utf-8');
        return send(res, 500, 'jinja2.exceptions.TemplateSyntaxError: unexpected end of template, expected }}', 'text/html; charset=utf-8');
      }
      const esc = name.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
      return send(res, 200, `Hello, ${esc}!`, 'text/html; charset=utf-8');
    }

    // --- XXE ---
    if (req.method === 'POST' && u.pathname === '/api/xml') {
      let raw = '';
      req.on('data', (c) => { raw += c; });
      req.on('end', () => {
        const m = /<!ENTITY\s+\w+\s+SYSTEM\s+"([^"]+)"/i.exec(raw);
        if (m && m[1].startsWith('file:///etc/passwd')) {
          return send(res, 200, '<result>root:x:0:0:root:/root:/bin/bash\ndaemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin</result>', 'application/xml');
        }
        if (m && /^https?:\/\//i.test(m[1])) {
          // simulate a parser that resolves external entities
          http.get(m[1], () => {}).on('error', () => {});
          return send(res, 200, '<result>ok</result>', 'application/xml');
        }
        return send(res, 200, '<result>ok</result>', 'application/xml');
      });
      return;
    }

    // --- GraphQL ---
    if (u.pathname === '/graphql' || u.pathname === '/api/graphql') {
      const answer = (query) => {
        const q = String(query || '');
        if (q.includes('__schema')) return { data: { __schema: { queryType: { name: 'Query' } } } };
        const bad = /\{(zzz\w+)\}/.exec(q);
        if (bad) return { errors: [{ message: `Cannot query field "${bad[1]}" on type "Query". Did you mean "user"?` }] };
        if (q.includes('__typename')) return { data: { __typename: 'Query' } };
        return { data: {} };
      };
      if (req.method === 'GET') return send(res, 200, JSON.stringify(answer(qs.get('query'))));
      let raw = '';
      req.on('data', (c) => { raw += c; });
      req.on('end', () => {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            // batching supported: answer every query
            return send(res, 200, JSON.stringify(parsed.map((e) => answer(e && e.query))));
          }
          return send(res, 200, JSON.stringify(answer(parsed.query)));
        } catch { return send(res, 400, '{"errors":[{"message":"bad json"}]}'); }
      });
      return;
    }

    // --- Race: coupon + transfer ---
    if (req.method === 'POST' && u.pathname === '/api/coupon/apply') {
      let raw = '';
      req.on('data', (c) => { raw += c; });
      req.on('end', () => send(res, 200, JSON.stringify({ applied: true })));
      return;
    }
    if (req.method === 'GET' && u.pathname === '/api/balance') {
      return send(res, 200, JSON.stringify({ balance }));
    }
    if (req.method === 'POST' && u.pathname === '/api/transfer') {
      let raw = '';
      req.on('data', (c) => { raw += c; });
      req.on('end', () => {
        let amount = 0;
        try { amount = Number(JSON.parse(raw).amount) || 0; } catch {}
        balance -= amount; // naive: no lock, no overdraft check
        send(res, 200, JSON.stringify({ ok: true, balance }));
      });
      return;
    }

    send(res, 404, '{"error":"not found"}');
  });

  // --- WebSocket: accept any/no Origin, push a frame pre-auth ---
  server.on('upgrade', (req, socket) => {
    const u = new URL(req.url, `http://${HOST}:${FIXTURE_PORT}`);
    if (!u.pathname.startsWith('/ws')) { socket.destroy(); return; }
    const key = req.headers['sec-websocket-key'] || '';
    const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
    socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
    const timer = setTimeout(() => {
      try { socket.write(Buffer.concat([Buffer.from([0x81, 0x07]), Buffer.from('welcome')])); } catch {}
    }, 100);
    socket.on('close', () => clearTimeout(timer));
  });

  await new Promise((r) => server.listen(FIXTURE_PORT, HOST, r));
  return {
    server,
    baseUrl: `http://${HOST}:${FIXTURE_PORT}`,
    reset: () => { balance = 500; },
    stop: () => new Promise((r) => server.close(r))
  };
}
