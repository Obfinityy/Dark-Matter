/**
 * Vercel serverless entry for the Dark-Matter backend (stateless).
 *
 * What works here:
 *   ✅  Health + agent info (no database needed)
 *   ✅  Auth — POST /api/v1/auth/register, POST /api/v1/auth/login,
 *       GET /api/v1/auth/me, POST /api/v1/auth/logout — backed by MongoDB
 *       Atlas (MONGO_URL env var). Password hashing (scrypt) and the HS256
 *       JWT format are byte-compatible with the local backend, so ONE
 *       database serves both: an account created on Vercel logs in fine on
 *       localhost via `npm start`, and vice versa.
 *   ❌  Everything stateful (hunts, model runner, computer control, SSE
 *       streams, reports) needs the persistent local backend.
 *
 * Env vars (Vercel dashboard → this project → Environment Variables):
 *   MONGO_URL   — MongoDB Atlas connection string (required for auth)
 *   MONGO_DB_NAME — database name (default: darkmatter)
 *   JWT_SECRET  — HMAC secret for JWTs (REQUIRED in production; without it
 *                 every cold start mints a new key and all sessions die)
 */

import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { MongoClient } from 'mongodb';

const scrypt = promisify(crypto.scrypt);
const JWT_DAYS = 7;

// ─── CORS ─────────────────────────────────────────────────────────────
// Echo the request origin (never '*') so browsers accept responses when the
// frontend sends credentials/Authorization headers cross-origin.
function corsHeaders(req) {
  const origin = req?.headers?.origin || '*';
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origin,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Credentials': 'true'
  };
}

function send(res, status, data, req) {
  for (const [k, v] of Object.entries(corsHeaders(req))) res.setHeader(k, v);
  if (status === 204) return res.status(204).end();
  return res.status(status).json(data);
}

function httpError(statusCode, message, code = 'REQUEST_FAILED') {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  throw err;
}

// ─── Minimal HS256 JWT (node:crypto only — same format as local backend) ──
function base64urlEncode(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(input) {
  const text = String(input).replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(text + '='.repeat((4 - (text.length % 4)) % 4), 'base64');
}

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  // Dev fallback only: tokens die with the process. Set JWT_SECRET in prod.
  console.warn('[api] JWT_SECRET is not set — using an ephemeral signing key.');
  if (!globalThis.__dmEphemeralJwt) globalThis.__dmEphemeralJwt = crypto.randomBytes(32).toString('hex');
  return globalThis.__dmEphemeralJwt;
}

function signJwt(payload) {
  const header = base64urlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64urlEncode(JSON.stringify(payload));
  const signature = crypto.createHmac('sha256', jwtSecret()).update(`${header}.${body}`).digest();
  return `${header}.${body}.${base64urlEncode(signature)}`;
}

function verifyJwt(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  const expected = crypto.createHmac('sha256', jwtSecret()).update(`${header}.${body}`).digest();
  let actual;
  try {
    actual = base64urlDecode(signature);
  } catch {
    return null;
  }
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;
  try {
    const payload = JSON.parse(base64urlDecode(body).toString('utf8'));
    if (payload.exp && Date.now() / 1000 > payload.exp) return null; // expired
    return payload;
  } catch {
    return null;
  }
}

function issueJwt(user) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = new Date((issuedAt + JWT_DAYS * 86_400) * 1000);
  const token = signJwt({ sub: user.id, iat: issuedAt, exp: issuedAt + JWT_DAYS * 86_400 });
  return { token, expiresAt: expiresAt.toISOString() };
}

// ─── Password hashing (scrypt — identical format to the local backend) ──
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = await scrypt(password, salt, 64);
  return `${salt}:${derived.toString('hex')}`;
}

async function verifyPassword(password, encoded) {
  const [salt, expectedHex] = String(encoded || '').split(':');
  if (!salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, 'hex');
  const actual = await scrypt(password, salt, expected.length);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

// ─── MongoDB (lazy, cached across warm invocations) ───────────────────
let clientPromise = null;
let indexesEnsured = false;

async function usersCollection() {
  const url = process.env.MONGO_URL;
  if (!url) httpError(503, 'Account database is not configured on this backend.', 'DB_NOT_CONFIGURED');
  if (!clientPromise) {
    const pending = new MongoClient(url, { maxPoolSize: 3, serverSelectionTimeoutMS: 8000 }).connect();
    clientPromise = pending.catch((err) => {
      if (clientPromise === pending) clientPromise = null; // let the next call retry
      throw err;
    });
  }
  let client;
  try {
    client = await clientPromise;
  } catch {
    httpError(503, 'Account database is unreachable right now. Try again in a moment.', 'DB_UNREACHABLE');
  }
  const db = client.db(process.env.MONGO_DB_NAME || 'darkmatter');
  const users = db.collection('users');
  if (!indexesEnsured) {
    indexesEnsured = true;
    try {
      await Promise.all([
        users.createIndex({ email: 1 }, { unique: true }),
        users.createIndex({ username: 1 }, { unique: true, sparse: true })
      ]);
    } catch { /* indexes may already exist — not fatal */ }
  }
  return users;
}

// ─── Validation (same rules as the local backend) ─────────────────────
const normalizeEmail = (v) => String(v || '').trim().toLowerCase();
const normalizeUsername = (v) => String(v || '').trim().toLowerCase();
const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const validUsername = (u) => /^[a-z0-9_-]{3,30}$/.test(u);
const publicUser = (u) => ({ id: u.id, email: u.email, username: u.username || null, name: u.name, createdAt: u.createdAt });

// ─── Body parsing (Vercel pre-parses JSON into req.body; stream fallback) ──
async function readJsonBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') {
      try { return req.body ? JSON.parse(req.body) : {}; } catch { return {}; }
    }
    if (typeof req.body === 'object') return req.body;
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString('utf8');
  try { return text ? JSON.parse(text) : {}; } catch { return {}; }
}

function bearerToken(req, url) {
  const header = req.headers?.authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (match) return match[1].trim();
  return url.searchParams.get('accessToken') || null;
}

// ─── Auth route handlers ──────────────────────────────────────────────
async function handleRegister(req, res, url) {
  const body = await readJsonBody(req);
  const email = normalizeEmail(body.email);
  const password = String(body.password || '');
  const name = String(body.name || '').trim().slice(0, 120);
  const username = normalizeUsername(body.username || '');

  if (!validEmail(email)) httpError(400, 'Enter a valid email address', 'INVALID_EMAIL');
  if (password.length < 8) httpError(400, 'Password must be at least 8 characters', 'WEAK_PASSWORD');
  if (name.length < 2) httpError(400, 'Name must be at least 2 characters', 'INVALID_NAME');
  if (username) {
    if (!validUsername(username)) httpError(400, 'Username must be 3-30 lowercase letters, digits, _ or -', 'INVALID_USERNAME');
  }

  const users = await usersCollection();
  if (await users.findOne({ email })) httpError(409, 'An account with this email already exists', 'EMAIL_IN_USE');
  if (username && await users.findOne({ username })) httpError(409, 'That username is already taken', 'USERNAME_IN_USE');

  const now = new Date().toISOString();
  const doc = {
    id: `user_${crypto.randomUUID()}`,
    email,
    name,
    passwordHash: await hashPassword(password),
    createdAt: now,
    updatedAt: now
  };
  if (username) doc.username = username;

  try {
    await users.insertOne(doc);
  } catch (error) {
    if (error?.code === 11000) {
      if (await users.findOne({ email })) httpError(409, 'An account with this email already exists', 'EMAIL_IN_USE');
      httpError(409, 'That username is already taken', 'USERNAME_IN_USE');
    }
    throw error;
  }

  const user = publicUser(doc);
  const jwt = issueJwt(user);
  return send(res, 201, { user, jwt: jwt.token, jwtExpiresAt: jwt.expiresAt }, req);
}

async function handleLogin(req, res, url) {
  const body = await readJsonBody(req);
  const login = String(body.login || body.email || body.username || '');
  const password = String(body.password || '');

  const users = await usersCollection();
  const doc = login.includes('@')
    ? await users.findOne({ email: normalizeEmail(login) })
    : await users.findOne({ username: normalizeUsername(login) });

  if (!doc || !(await verifyPassword(password, doc.passwordHash))) {
    httpError(401, 'Username/email or password is incorrect', 'INVALID_CREDENTIALS');
  }

  const user = publicUser(doc);
  const jwt = issueJwt(user);
  return send(res, 200, { user, jwt: jwt.token, jwtExpiresAt: jwt.expiresAt }, req);
}

async function handleMe(req, res, url) {
  const payload = verifyJwt(bearerToken(req, url));
  if (!payload?.sub) httpError(401, 'Not signed in', 'UNAUTHENTICATED');
  const users = await usersCollection();
  const doc = await users.findOne({ id: payload.sub });
  if (!doc) httpError(401, 'Account no longer exists', 'USER_NOT_FOUND');
  return send(res, 200, { user: publicUser(doc) }, req);
}

async function handleLogout(req, res) {
  // Stateless JWTs: nothing to revoke server-side. The client drops its token.
  return send(res, 204, null, req);
}

// ─── Main handler ─────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    for (const [k, v] of Object.entries(corsHeaders(req))) res.setHeader(k, v);
    return res.status(200).end();
  }

  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname;
  const method = req.method || 'GET';

  try {
    // Health check
    if (path === '/health' || path === '/api/v1/health') {
      return send(res, 200, { status: 'ok', service: 'darkmatter-backend', mode: 'vercel-serverless', timestamp: new Date().toISOString() }, req);
    }

    // Agent info
    if (path === '/api/v1/agent') {
      return send(res, 200, {
        name: 'Elite Bug Bounty Expert',
        role: 'authorized-security-research-agent',
        capabilities: ['authorized target intake', 'passive subdomain enumeration'],
        restrictions: ['explicit authorization required', 'only declared scope is used'],
        mode: 'vercel-serverless-limited',
        note: 'Full agent capabilities require the local backend (npm start).'
      }, req);
    }

    // Auth (MongoDB-backed)
    if (path === '/api/v1/auth/register' && method === 'POST') return await handleRegister(req, res, url);
    if (path === '/api/v1/auth/login' && method === 'POST') return await handleLogin(req, res, url);
    if (path === '/api/v1/auth/me' && method === 'GET') return await handleMe(req, res, url);
    if (path === '/api/v1/auth/logout' && method === 'POST') return await handleLogout(req, res);

    // Everything else: explain the limitation
    return send(res, 404, {
      error: {
        code: 'NOT_AVAILABLE_ON_SERVERLESS',
        message: 'This endpoint needs the persistent local backend. In Settings, switch the backend to Localhost (run `npm start` in backend/).'
      },
      available: ['/health', '/api/v1/health', '/api/v1/agent', 'POST /api/v1/auth/register', 'POST /api/v1/auth/login', 'GET /api/v1/auth/me', 'POST /api/v1/auth/logout'],
      path
    }, req);
  } catch (error) {
    if (error?.statusCode) {
      return send(res, error.statusCode, { error: { code: error.code || 'REQUEST_FAILED', message: error.message } }, req);
    }
    console.error('[api] unexpected error:', error);
    return send(res, 500, { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Try again.' } }, req);
  }
}
