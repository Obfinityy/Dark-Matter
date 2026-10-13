// Auth routes — INVITE-ONLY for Dark Matter.
//
//   POST /api/v1/auth/login   {username, password} -> {ok, token, user}
//   GET  /api/v1/auth/me                          -> {ok, user} (Bearer)
//
// NO public signup. Only the admin creates accounts via /api/v1/admin/users.
// Users are keyed by lowercased username. Passwords hashed with scrypt.
// Tokens are JWT HS256 (node:crypto only). Payload: {sub:id, username, role,
// control, iat, exp}, 30-day expiry.
//
// Admin bootstrap: set ADMIN_USERNAME + ADMIN_PASSWORD_HASH + ADMIN_PASSWORD_SALT
// env vars. On first boot with no users, the admin account is created.

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
  if (!payload.sub || !payload.username) return null;
  return payload;
}

export function issueToken(user) {
  const now = Math.floor(Date.now() / 1000);
  return signToken({
    sub: user.id,
    username: user.username,
    role: user.role || 'user',
    control: user.control || 'minimal',
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
  });
}

// ---- Password hashing (scrypt) ----------------------------------------------

export function hashPassword(password) {
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

// ---- Admin bootstrap ----------------------------------------------------------

export function ensureAdmin() {
  const adminUser = (process.env.ADMIN_USERNAME || '').trim().toLowerCase();
  const adminHash = (process.env.ADMIN_PASSWORD_HASH || '').trim();
  const adminSalt = (process.env.ADMIN_PASSWORD_SALT || '').trim();
  if (!adminUser || !adminHash || !adminSalt) {
    console.warn('[auth] ADMIN_USERNAME / ADMIN_PASSWORD_HASH / ADMIN_PASSWORD_SALT not set — no admin account.');
    return null;
  }
  const users = readUsers();
  if (users[adminUser]) return users[adminUser]; // already exists
  const admin = {
    id: crypto.randomUUID(),
    username: adminUser,
    salt: adminSalt,
    passHash: adminHash,
    role: 'admin',
    control: 'maximum',
    createdAt: new Date().toISOString(),
    createdBy: 'bootstrap',
  };
  users[adminUser] = admin;
  writeUsers(users);
  console.log(`[auth] Admin account created: ${adminUser}`);
  return admin;
}

// ---- Helpers -----------------------------------------------------------------

function publicUser(u) {
  return {
    id: u.id,
    username: u.username,
    role: u.role || 'user',
    control: u.control || 'minimal',
    createdAt: u.createdAt,
  };
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
  req.user = {
    id: payload.sub,
    username: payload.username,
    role: payload.role || 'user',
    control: payload.control || 'minimal',
  };
  next();
}

export function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        ok: false,
        error: 'admin_required',
        message: 'Admin access required.',
      });
    }
    next();
  });
}

// ---- Routes -------------------------------------------------------------------

// Login only. There is NO public signup — accounts are created by the admin.
router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  const cleanUsername = String(username || '').trim().toLowerCase();
  if (!cleanUsername || typeof password !== 'string') {
    return res.status(400).json({ ok: false, error: 'missing_credentials', message: 'Provide {username} and {password}.' });
  }
  const users = readUsers();
  const user = users[cleanUsername];
  if (!user || !verifyPassword(password, user.salt, user.passHash)) {
    return res.status(401).json({ ok: false, error: 'invalid_login', message: 'Invalid username or password.' });
  }
  const token = issueToken(user);
  res.json({ ok: true, token, user: publicUser(user) });
});

router.get('/me', requireAuth, (req, res) => {
  const users = readUsers();
  const user = Object.values(users).find((u) => u.id === req.user.id);
  if (!user) return authRequired(res);
  res.json({ ok: true, user: publicUser(user) });
});

export default router;
