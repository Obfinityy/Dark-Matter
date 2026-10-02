/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  ⚠️  LOCAL TEST FIXTURE ONLY — NEVER DEPLOY, NEVER EXPOSE, NEVER TEST
 *      ANYTHING BUT 127.0.0.1 WITH THIS APP.
 *
 *  A deliberately vulnerable Express app used ONLY to prove the Dark-Matter
 *  hunt pipeline (recon → detect → evidence → finding) against a target we
 *  own, on loopback, in automated tests. It exists so the hunt-proof worker
 *  can assert real findings without ever touching an external target.
 *
 *  Intentional vulnerabilities (the whole point of the fixture):
 *    (a) Reflected XSS — GET /search?q= reflects the query unescaped.
 *    (b) SQL injection — POST /login interpolates credentials into a fake
 *        SQL string evaluated naively (in-memory "db", string matching only,
 *        no real database). `' OR '1'='1` bypasses auth.
 *    (c) IDOR — GET /api/users/:id returns any user's record with no
 *        authorization check.
 *    (d) Stored XSS — POST /api/comments stores {author,text}; GET /comments
 *        renders every comment unescaped, so a payload persists.
 *    (e) Session cookie without HttpOnly — a successful POST /login sets a
 *        `session` cookie readable from JS (deliberately insecure: this is
 *        what the theft chain steals). GET /api/me honors the cookie.
 *    (f) Chain demo — the (d)+(e) pair proves an end-to-end attack path:
 *        stored XSS → session cookie theft → authenticated access as the
 *        victim. POST /api/beacon is the proof-only exfiltration sink
 *        (logs the stolen cookie, returns 200).
 *
 *  Binds ONLY to 127.0.0.1 (loopback). Port 4555 (configurable via PORT env,
 *  but keep 4555 — the hunt tests assume it).
 * ═══════════════════════════════════════════════════════════════════════════
 */

import express from 'express';

const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT || 4555);

// ── Fake in-memory "database" ─────────────────────────────────────────────
// Plain JS objects on purpose: the SQLi is simulated by naive string
// evaluation of an interpolated query, not by a real database driver.
const USERS = [
  { id: 1, username: 'alice', password: 'alice-secret-pw', email: 'alice@example.local', role: 'admin', ssn: '000-11-1111' },
  { id: 2, username: 'bob', password: 'bob-secret-pw', email: 'bob@example.local', role: 'user', ssn: '000-22-2222' },
  { id: 3, username: 'carol', password: 'carol-secret-pw', email: 'carol@example.local', role: 'user', ssn: '000-33-3333' },
];

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Deliberately naive session store: token → userId. The token is handed to
// the browser as a non-HttpOnly cookie so the XSS→theft chain is demonstrable.
const SESSIONS = new Map();

// Refuse non-loopback connections as a second layer of defense.
app.use((req, res, next) => {
  const remote = req.socket.remoteAddress || '';
  if (remote !== '127.0.0.1' && remote !== '::1' && remote !== '::ffff:127.0.0.1') {
    return res.status(403).send('fixture only serves loopback');
  }
  next();
});

app.get('/', (req, res) => {
  res.send(`<html><body><h1>Acme Local Fixture</h1>
    <form action="/search" method="get"><input name="q"/><button>Search</button></form>
    <form action="/login" method="post"><input name="username"/><input name="password" type="password"/><button>Login</button></form>
    <a href="/api/users/1">user api</a>
  </body></html>`);
});

// ── (a) Reflected XSS — query reflected into HTML with NO escaping ─────────
app.get('/search', (req, res) => {
  const q = req.query.q ?? '';
  // INTENTIONALLY VULNERABLE: raw interpolation into the response body.
  res.send(`<html><body><h1>Results for: ${q}</h1><p>No results.</p></body></html>`);
});

// ── (b) SQL injection — naive string-interpolated "query" ──────────────────
function fakeSqlLogin(username, password) {
  // INTENTIONALLY VULNERABLE: credentials interpolated into a SQL string,
  // evaluated by naive string matching instead of a real DB. The classic
  // `' OR '1'='1` payload short-circuits the password check.
  const query = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;
  const lowered = query.toLowerCase();
  const injectionBypass = lowered.includes(`' or '1'='1`) || lowered.includes(`" or "1"="1`)
    || lowered.includes(`' or 1=1`) || /'\s*or\s+/i.test(query);
  if (injectionBypass) {
    return { user: USERS[0], query }; // attacker lands on the first (admin) row
  }
  const user = USERS.find((u) => u.username === username && u.password === password);
  return { user: user || null, query };
}

app.post('/login', (req, res) => {
  const { username = '', password = '' } = req.body || {};
  const { user, query } = fakeSqlLogin(String(username), String(password));
  if (user) {
    // INTENTIONALLY INSECURE (e): the session cookie is NOT HttpOnly on
    // purpose — a stored/reflected XSS payload can read document.cookie
    // and steal it. This is what the (d)+(e) chain demo proves.
    const token = `sess-${user.id}-${Date.now().toString(36)}`;
    SESSIONS.set(token, user.id);
    res.setHeader('Set-Cookie', `session=${token}; Path=/; SameSite=Lax`);
    return res.json({ ok: true, message: `Welcome back, ${user.username}!`, role: user.role, debugQuery: query });
  }
  return res.status(401).json({ ok: false, message: 'Invalid credentials', debugQuery: query });
});

// ── (e) session-authenticated endpoint — honors the stolen cookie ──────────
function userFromCookie(req) {
  const header = req.headers.cookie || '';
  const token = header.split(';').map((p) => p.trim()).find((p) => p.startsWith('session='))?.slice('session='.length);
  const userId = token && SESSIONS.get(token);
  return USERS.find((u) => u.id === userId) || null;
}

app.get('/api/me', (req, res) => {
  const user = userFromCookie(req);
  if (!user) return res.status(401).json({ error: 'not logged in' });
  res.json({ id: user.id, username: user.username, email: user.email, role: user.role });
});

// ── (d) Stored XSS — comments persisted and rendered raw ──────────────────
const COMMENTS = [];
app.post('/api/comments', (req, res) => {
  const { author = 'anon', text = '' } = req.body || {};
  const comment = { id: COMMENTS.length + 1, author: String(author), text: String(text), at: new Date().toISOString() };
  COMMENTS.push(comment);
  res.status(201).json(comment);
});

app.get('/comments', (req, res) => {
  // INTENTIONALLY VULNERABLE: every stored comment is interpolated into the
  // page with no escaping — a payload posted once runs for every visitor.
  const items = COMMENTS.map((c) => `<div class="comment"><b>${c.author}</b>: ${c.text}</div>`).join('\n');
  res.send(`<html><body><h1>Guestbook</h1>${items}<form action="/api/comments" method="post"><input name="author"/><input name="text"/><button>Post</button></form></body></html>`);
});

// ── (f) Chain demo: proof-only exfiltration sink + narrative page ──────────
// POST /api/beacon receives the "stolen" session cookie from the XSS
// payload. Proof-only: it logs it server-side and returns 200.
const BEACONS = [];
app.post('/api/beacon', (req, res) => {
  BEACONS.push({ at: new Date().toISOString(), stolen: req.body?.stolen || null, ua: req.headers['user-agent'] || null });
  res.json({ ok: true });
});
// Test-only readout of what the beacon captured.
app.get('/api/beacon', (req, res) => res.json({ beacons: BEACONS }));

app.get('/poc-chain', (req, res) => {
  res.send(`<html><body><h1>Proof-only chain demo: stored XSS → session theft</h1>
    <ol>
      <li>Attacker logs in via SQLi (POST /login, <code>' OR '1'='1</code>) — lands as admin.</li>
      <li>Attacker posts a comment (POST /api/comments) containing
        <code>&lt;script&gt;fetch('/api/beacon',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({stolen:document.cookie})})&lt;/script&gt;</code></li>
      <li>Victim visits GET /comments — the payload runs, <code>document.cookie</code> (the non-HttpOnly <code>session</code> cookie) is exfiltrated to /api/beacon.</li>
      <li>Attacker replays the stolen cookie against GET /api/me — authenticated access as the victim.</li>
    </ol>
    <p>Local fixture only (127.0.0.1). No real users, no real data.</p>
  </body></html>`);
});

app.get('/health', (req, res) => res.json({ ok: true, fixture: 'vuln-app' }));

// ── (c) IDOR — no authorization check on object reference ──────────────────
app.get('/api/users/:id', (req, res) => {
  const user = USERS.find((u) => u.id === Number(req.params.id));
  if (!user) return res.status(404).json({ error: 'not found' });
  // INTENTIONALLY VULNERABLE: returns the full record (incl. password + ssn)
  // for ANY id, with zero authn/authz.
  res.json({ id: user.id, username: user.username, email: user.email, role: user.role, password: user.password, ssn: user.ssn });
});

app.get('/health', (req, res) => res.json({ ok: true, fixture: 'vuln-app' }));

const server = app.listen(PORT, HOST, () => {
  console.log(`[vuln-fixture] listening on http://${HOST}:${PORT} (LOCAL ONLY)`);
  // Signal readiness to a parent test process.
  if (process.send) process.send('ready');
});

// Graceful shutdown for the test harness.
process.on('SIGTERM', () => server.close(() => process.exit(0)));
