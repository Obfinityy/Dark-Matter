// Auth routes — SIGNUP WITH ADMIN APPROVAL for Dark Matter.
//
//   POST /api/v1/auth/signup   {username, password} -> {ok, message} (pending approval)
//   POST /api/v1/auth/login    {username, password} -> {ok, token, user} (approved users only)
//   GET  /api/v1/auth/me                           -> {ok, user} (Bearer)
//
// Users sign up freely, but CANNOT use the service until the admin approves
// them. Unapproved users see a "waiting for approval" screen.
// Admin approves via POST /api/v1/admin/users/:id/approve.
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

export function verifyToken(token) {
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

// ---- Terminal tickets (Live Terminal PiP) --------------------------------
// Short-lived (60s) tickets bound to (user, hunt), signed with the same
// HS256 secret as login tokens. This deliberately uses NO jsonwebtoken
// dependency: it was never installed, so the old ticket route always
// 500'd with 'jwt_not_available' and every Live Terminal rendered blank.
export function issueTerminalTicket(userId, username, huntId) {
  const now = Math.floor(Date.now() / 1000);
  return signToken({
    sub: userId,
    username,
    type: 'terminal',
    huntId,
    iat: now,
    exp: now + 60,
  });
}

export function verifyTerminalTicket(token) {
  const payload = verifyToken(token);
  if (!payload || payload.type !== 'terminal' || !payload.huntId) return null;
  return payload;
}

// ---- Machine-control tickets (Take Control of This Machine) ------------
// Short-lived (60s) tickets bound to (user, hunt), same HS256 secret
// as login tokens, type 'control' so a terminal ticket can never open
// a control channel (and vice versa). Only issuable while the caller
// holds the control lock for the hunt (see routes/hunts.js).
export function issueControlTicket(userId, username, huntId) {
  const now = Math.floor(Date.now() / 1000);
  return signToken({
    sub: userId,
    username,
    type: 'control',
    huntId,
    iat: now,
    exp: now + 60,
  });
}

export function verifyControlTicket(token) {
  const payload = verifyToken(token);
  if (!payload || payload.type !== 'control' || !payload.huntId) return null;
  return payload;
}

// ---- Password hashing (scrypt) ----------------------------------------------

export function hashPassword(password) {
  const saltBuf = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, saltBuf, 64).toString('hex');
  return { salt: saltBuf.toString('hex'), hash };
}

export function verifyPassword(password, saltHex, hashHex) {
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
  const existing = users[adminUser];
  if (existing) {
    // If the env hash rotated, adopt the new credentials instead of keeping stale ones.
    if (existing.passHash !== adminHash || existing.salt !== adminSalt) {
      existing.passHash = adminHash;
      existing.salt = adminSalt;
      writeUsers(users);
      console.log(`[auth] Admin credentials rotated from env: ${adminUser}`);
    }
    return existing;
  }
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
    approved: u.approved !== false, // default true for legacy/admin-created users
    accessUntil: u.accessUntil || null, // paid access window (UPI activation); null = none
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
  // FIX (#323): never trust the token's snapshot alone — re-read the
  // user store on every request, so blocks, approval revocations, and
  // role/control changes take effect immediately instead of living on
  // inside a valid 30-day token.
  let user = null;
  try {
    const users = readUsers();
    user = Object.values(users).find((u) => u && u.id === payload.sub) || null;
  } catch { user = null; }
  if (!user) return authRequired(res);
  if (user.approved === false) {
    return res.status(403).json({ ok: false, error: 'pending_approval', message: 'Your account is waiting for admin approval.' });
  }
  const isBlocked = user.blockedUntil === null || (user.blockedUntil && new Date(user.blockedUntil) > new Date());
  if (isBlocked) {
    return res.status(403).json({ ok: false, error: 'account_blocked', message: 'Your account is blocked. Contact the administrator.' });
  }
  req.user = {
    id: user.id,
    username: user.username || payload.username,
    role: user.role || 'user',
    control: user.control || 'minimal',
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

/** Authorization for the private hunt-event WebSocket (HTTP upgrade bypasses Express). */
export function canAccessHuntStream(payload, meta) {
  if (!payload || !meta || !payload.sub) return false;
  if (meta.userId) return String(meta.userId) === String(payload.sub);
  return payload.role === 'admin';
}

// Bound expensive password hashing against unauthenticated request floods.
// req.ip is Express's socket-derived address (trust proxy is not enabled here).
export function createIpRateLimiter({ limit, windowMs, now = Date.now, maxKeys = 10000 }) {
  const buckets = new Map();
  return function rateLimit(req, res, next) {
    const key = String(req.ip || req.socket?.remoteAddress || 'unknown').slice(0, 128);
    const time = now();
    let bucket = buckets.get(key);
    if (!bucket || time - bucket.startedAt >= windowMs) {
      bucket = { startedAt: time, count: 0 };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (buckets.size > maxKeys) {
      for (const [ip, entry] of buckets) {
        if (time - entry.startedAt >= windowMs) buckets.delete(ip);
      }
      while (buckets.size > maxKeys) buckets.delete(buckets.keys().next().value);
    }
    if (bucket.count > limit) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((bucket.startedAt + windowMs - time) / 1000))));
      return res.status(429).json({ ok: false, error: 'rate_limited', message: 'Too many attempts. Please try again later.' });
    }
    next();
  };
}

const limitLoginAttempts = createIpRateLimiter({ limit: 10, windowMs: 15 * 60 * 1000 });
const limitSignupAttempts = createIpRateLimiter({ limit: 5, windowMs: 15 * 60 * 1000 });

// ---- Routes -------------------------------------------------------------------

// Public signup — creates a PENDING account. The user CANNOT log in or use
// the service until an admin approves them.
router.post('/signup', limitSignupAttempts, (req, res) => {
  const { username, password } = req.body || {};
  const cleanUsername = String(username || '').trim().toLowerCase();
  if (!cleanUsername || cleanUsername.length < 3) {
    return res.status(400).json({ ok: false, error: 'invalid_username', message: 'Username must be at least 3 characters.' });
  }
  if (!/^[a-z0-9_]+$/.test(cleanUsername)) {
    return res.status(400).json({ ok: false, error: 'invalid_username', message: 'Username can only contain letters, numbers and underscore.' });
  }
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ ok: false, error: 'weak_password', message: 'Password must be at least 8 characters.' });
  }
  const users = readUsers();
  if (users[cleanUsername]) {
    return res.status(409).json({ ok: false, error: 'username_taken', message: 'This username is already taken.' });
  }
  const { salt, hash } = hashPassword(password);
  const id = crypto.randomUUID();
  users[cleanUsername] = {
    id,
    username: cleanUsername,
    salt,
    passHash: hash,
    role: 'user',
    control: 'minimal',
    approved: false, // <-- needs admin approval
    createdAt: new Date().toISOString(),
  };
  writeUsers(users);
  console.log(`[auth] SIGNUP pending approval: ${cleanUsername}`);
  res.status(201).json({ ok: true, message: 'Account created. Waiting for admin approval.' });
});

// Login only. There is NO public signup — accounts are created by the admin.
router.post('/login', limitLoginAttempts, (req, res) => {
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
  // Approval gate: pending users cannot log in until admin approves.
  if (user.approved === false) {
    return res.status(403).json({
      ok: false,
      error: 'pending_approval',
      message: 'Your account is waiting for admin approval. Please check back later.',
    });
  }
  // Check if user is blocked
  const isBlocked = user.blockedUntil === null || (user.blockedUntil && new Date(user.blockedUntil) > new Date());
  if (isBlocked) {
    const msg = user.blockedUntil === null
      ? 'Your account has been permanently blocked. Contact the administrator.'
      : `Your account is blocked until ${new Date(user.blockedUntil).toLocaleString()}. Contact the administrator.`;
    return res.status(403).json({ ok: false, error: 'account_blocked', message: msg });
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
