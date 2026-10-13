// Auth routes — real username/password authentication for Dark Matter.
//
//   POST /api/v1/auth/signup  {name, email, password} -> {ok, token, user}
//   POST /api/v1/auth/login   {email, password}       -> {ok, token, user}
//   GET  /api/v1/auth/me                              -> {ok, user} (Bearer)
//
// Storage: users live in `users.json` under the file-based data dir
// (see store.js) — keyed by lowercased email. Passwords are hashed with
// scrypt (random 16-byte salt, 64-byte key); hashes are compared with
// timingSafeEqual. Tokens are JWT HS256 built with node:crypto only —
// no new dependencies. Payload: {sub:id, email, iat, exp}, 30-day expiry.
// Secret comes from JWT_SECRET; when unset a random secret is generated
// at boot and loudly warned about (dev-only: tokens die on restart).

import { Router } from 'express';
import crypto from 'node:crypto';
import { readUsers, writeUsers } from '../store.js';

const router = Router();

// ---- JWT secret ------------------------------------------------------------

const JWT_SECRET = (() => {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 16) {
    return Buffer.from(process.env.JWT_SECRET, 'utf8');
  }
  const ephemeral = crypto.randomBytes(32);
  console.warn(
    '[auth] WARNING: JWT_SECRET is not set — using a RANDOM ephemeral secret. ' +
      'All issued tokens become invalid on restart. Set JWT_SECRET in production!'
  );
  return ephemeral;
})();

const TOKEN_TTL_SECONDS = 30 * 24 * 3600; // 30 days

function b64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

function signToken(payload) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

function verifyToken(token) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  let expected;
  try {
    expected = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  } catch {
    return null;
  }
  const a = Buffer.from(sig, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!payload || typeof payload !== 'object') return null;
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp <= now) return null;
  if (!payload.sub || !payload.email) return null;
  return payload;
}

export function issueToken(user) {
  const now = Math.floor(Date.now() / 1000);
  return signToken({ sub: user.id, email: user.email, iat: now, exp: now + TOKEN_TTL_SECONDS });
}

// ---- Password hashing (scrypt) ----------------------------------------------

function hashPassword(password) {
  const saltBuf = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, saltBuf, 64).toString('hex');
  return { salt: saltBuf.toString('hex'), hash };
}

function verifyPassword(password, saltHex, hashHex) {
  try {
    const derived = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), 64);
    const expected = Buffer.from(hashHex, 'hex');
    return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

// ---- Helpers -----------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, createdAt: u.createdAt };
}

function authRequired(res) {
  return res.status(401).json({
    ok: false,
    error: 'auth_required',
    message: 'Login required: send Authorization: Bearer <token>.',
  });
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const m = /^Bearer (.+)$/.exec(header.trim());
  if (!m) return authRequired(res);
  const payload = verifyToken(m[1]);
  if (!payload) return authRequired(res);
  req.user = { id: payload.sub, email: payload.email };
  next();
}

// ---- Routes -------------------------------------------------------------------

router.post('/signup', (req, res) => {
  const { name, email, password } = req.body || {};
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanName = String(name || '').trim();
  if (!EMAIL_RE.test(cleanEmail)) {
    return res.status(400).json({ ok: false, error: 'invalid_email', message: 'Provide a valid {email}.' });
  }
  if (typeof password !== 'string' || password.length < 8) {
    return res
      .status(400)
      .json({ ok: false, error: 'weak_password', message: 'Password must be at least 8 characters.' });
  }
  const users = readUsers();
  if (users[cleanEmail]) {
    return res
      .status(409)
      .json({ ok: false, error: 'email_taken', message: 'An account with this email already exists.' });
  }
  const { salt, hash } = hashPassword(password);
  const user = {
    id: crypto.randomUUID(),
    name: cleanName,
    email: cleanEmail,
    salt,
    passHash: hash,
    createdAt: new Date().toISOString(),
  };
  users[cleanEmail] = user;
  writeUsers(users);
  const token = issueToken(user);
  res.json({ ok: true, token, user: publicUser(user) });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  const cleanEmail = String(email || '').trim().toLowerCase();
  const users = readUsers();
  const user = users[cleanEmail];
  // Same generic response for unknown email vs wrong password (no enumeration).
  if (!user || typeof password !== 'string' || !verifyPassword(password, user.salt, user.passHash)) {
    return res.status(401).json({ ok: false, error: 'bad_credentials', message: 'Invalid email or password.' });
  }
  const token = issueToken(user);
  res.json({ ok: true, token, user: publicUser(user) });
});

router.get('/me', requireAuth, (req, res) => {
  const users = readUsers();
  const user = Object.values(users).find((u) => u.id === req.user.id);
  if (!user) {
    return res.status(401).json({ ok: false, error: 'auth_required', message: 'Account no longer exists.' });
  }
  res.json({ ok: true, user: publicUser(user) });
});

export default router;
