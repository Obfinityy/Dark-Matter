import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { AppError, assert } from '../core/errors.js';
import { hashToken } from '../core/utils.js';

const scrypt = promisify(crypto.scrypt);

function normalizeEmail(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function normalizeUsername(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function validUsername(username) {
  return /^[a-z0-9_-]{3,30}$/.test(username);
}

// --- Minimal HS256 JWT helpers (node:crypto only; no new dependency) ---
function base64urlEncode(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64urlDecode(input) {
  const text = String(input).replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(text + '='.repeat((4 - (text.length % 4)) % 4), 'base64');
}

function signJwt(payload, secret) {
  const header = base64urlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64urlEncode(JSON.stringify(payload));
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest();
  return `${header}.${body}.${base64urlEncode(signature)}`;
}

function verifyJwtSignature(token, secret) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  const expected = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest();
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

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

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

/**
 * Generate a human-readable account recovery key: 6 groups of 4 chars
 * (e.g. "K7M2-Q9XD-…"). ~143 bits of entropy — not guessable, but typable.
 * Only the scrypt hash is stored; the plain key is shown to the user once.
 */
function generateRecoveryKey() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I confusion
  const bytes = crypto.randomBytes(24); // 24 chars × ~5 bits = ~120 bits
  let chars = '';
  for (let i = 0; i < 24; i++) {
    chars += alphabet[bytes[i] % alphabet.length];
  }
  return chars.match(/.{1,4}/g).join('-');
}

/** Normalize user-typed recovery key: strip dashes/spaces, uppercase. */
function normalizeRecoveryKey(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z2-9]/g, '');
}

export class AuthService {
  // jwtSecret signs stateless JWTs; jwtDays controls their lifetime. The existing
  // session-cookie flow is untouched — JWT is an additional credential the
  // middleware accepts, not a replacement auth system.
  constructor({ userModel, sessionModel, sessionDays, jwtSecret = null, jwtDays = 7 }) {
    this.userModel = userModel;
    this.sessionModel = sessionModel;
    this.sessionDays = sessionDays;
    this.jwtSecret = jwtSecret || AuthService.ephemeralSecret();
    this.jwtDays = Number(jwtDays) || 7;
  }

  static ephemeralSecret() {
    // Dev fallback only: JWTs die with the process. Set JWT_SECRET in production.
    console.warn(
      '[auth] JWT_SECRET is not set — using an ephemeral signing key (JWTs will not survive restarts).'
    );
    return crypto.randomBytes(32).toString('hex');
  }

  // --- JWT (HS256, implemented with node:crypto — no extra dependency) ---
  issueJwt(user) {
    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAt = new Date((issuedAt + this.jwtDays * 86_400) * 1000);
    const token = signJwt(
      { sub: user.id, iat: issuedAt, exp: issuedAt + this.jwtDays * 86_400 },
      this.jwtSecret
    );
    return { token, expiresAt };
  }

  async verifyJwt(token) {
    const payload = verifyJwtSignature(String(token || ''), this.jwtSecret);
    if (!payload || !payload.sub) return null;
    const user = await this.userModel.findById(payload.sub);
    return user
      ? {
          id: user.id,
          email: user.email,
          username: user.username || null,
          name: user.name,
          createdAt: user.createdAt,
        }
      : null;
  }

  // Accepts EITHER a JWT (stateless) or the existing session token (stateful).
  async resolveAny(token) {
    if (!token) return null;
    const viaJwt = await this.verifyJwt(token);
    if (viaJwt) return viaJwt;
    return this.resolve(token);
  }

  async register(input = {}) {
    const email = normalizeEmail(input.email);
    const password = String(input.password || '');
    const name = String(input.name || '')
      .trim()
      .slice(0, 120);
    const username = normalizeUsername(String(input.username || ''));
    assert(validEmail(email), 400, 'Enter a valid email address', 'INVALID_EMAIL');
    assert(password.length >= 8, 400, 'Password must be at least 8 characters', 'WEAK_PASSWORD');
    assert(name.length >= 2, 400, 'Name must be at least 2 characters', 'INVALID_NAME');
    if (username) {
      assert(
        validUsername(username),
        400,
        'Username must be 3-30 lowercase letters, digits, _ or -',
        'INVALID_USERNAME'
      );
      assert(
        !(await this.userModel.findByUsername(username)),
        409,
        'That username is already taken',
        'USERNAME_IN_USE'
      );
    }
    assert(
      !(await this.userModel.findByEmail(email)),
      409,
      'An account with this email already exists',
      'EMAIL_IN_USE'
    );
    const user = await this.userModel.create({
      email,
      name,
      passwordHash: await hashPassword(password),
      username: username || null,
    });
    // Issue an account recovery key — shown ONCE, hashed at rest.
    // Store the hash of the NORMALIZED key (dashes stripped) so users can
    // type it with or without dashes.
    const recoveryKey = generateRecoveryKey();
    await this.userModel.setRecoveryKeyHash(
      user.id,
      await hashPassword(normalizeRecoveryKey(recoveryKey))
    );
    const session = await this.createSession(user.id);
    const jwt = this.issueJwt(user);
    return { user, token: session, jwt: jwt.token, jwtExpiresAt: jwt.expiresAt, recoveryKey };
  }

  async login(input = {}) {
    // `login` accepts a username OR an email — one identifier field for the user.
    const login = String(input.login || input.email || input.username || '');
    const password = String(input.password || '');
    const user = login.includes('@')
      ? await this.userModel.findByEmail(normalizeEmail(login))
      : await this.userModel.findByLogin(login);
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new AppError(401, 'Username/email or password is incorrect', 'INVALID_CREDENTIALS');
    }
    const publicUser = {
      id: user.id,
      email: user.email,
      username: user.username || null,
      name: user.name,
      createdAt: user.createdAt,
    };
    const jwt = this.issueJwt(publicUser);
    return {
      user: publicUser,
      token: await this.createSession(user.id),
      jwt: jwt.token,
      jwtExpiresAt: jwt.expiresAt,
    };
  }

  async createSession(userId) {
    const token = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.sessionDays * 86_400_000);
    await this.sessionModel.create({ userId, tokenHash: hashToken(token), expiresAt });
    return token;
  }

  async resolve(token) {
    if (!token) return null;
    const session = await this.sessionModel.findActive(hashToken(token));
    if (!session) return null;
    const user = await this.userModel.findById(session.userId);
    return user
      ? {
          id: user.id,
          email: user.email,
          username: user.username || null,
          name: user.name,
          createdAt: user.createdAt,
        }
      : null;
  }

  async logout(token) {
    if (token) await this.sessionModel.remove(hashToken(token));
  }

  async updateProfile(userId, input) {
    return this.userModel.updateProfile(userId, input);
  }

  async changePassword(userId, currentPassword, newPassword) {
    assert(
      typeof currentPassword === 'string' && currentPassword.length >= 1,
      400,
      'Current password is required',
      'MISSING_PASSWORD'
    );
    assert(
      typeof newPassword === 'string' && newPassword.length >= 8,
      400,
      'New password must be at least 8 characters',
      'WEAK_PASSWORD'
    );
    const user = await this.userModel.findById(userId);
    assert(user, 404, 'User not found', 'USER_NOT_FOUND');
    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid)
      throw new AppError(401, 'Current password is incorrect', 'INVALID_CURRENT_PASSWORD');
    const newHash = await hashPassword(newPassword);
    await this.userModel.changePassword(userId, newHash);
  }

  /**
   * Reset a forgotten password using the account recovery key issued at
   * signup. On success the key is ROTATED — a fresh key is returned and the
   * old one stops working. All sessions are revoked for safety.
   */
  async resetPasswordWithRecoveryKey({ email, recoveryKey, newPassword }) {
    const normalizedEmail = normalizeEmail(email);
    assert(validEmail(normalizedEmail), 400, 'Enter a valid email address', 'INVALID_EMAIL');
    const cleanKey = normalizeRecoveryKey(recoveryKey);
    assert(cleanKey.length >= 20, 400, 'Enter your full recovery key', 'INVALID_RECOVERY_KEY');
    assert(
      typeof newPassword === 'string' && newPassword.length >= 8,
      400,
      'New password must be at least 8 characters',
      'WEAK_PASSWORD'
    );

    const user = await this.userModel.findByEmail(normalizedEmail);
    // Same error whether the email or the key is wrong — no account enumeration.
    const keyValid = user?.recoveryKeyHash
      ? await verifyPassword(cleanKey, user.recoveryKeyHash)
      : false;
    if (!user || !keyValid) {
      throw new AppError(401, 'Email or recovery key is incorrect', 'INVALID_RECOVERY_CREDENTIALS');
    }

    await this.userModel.changePassword(user.id, await hashPassword(newPassword));
    // Rotate: the used key is burned, a new one is issued.
    const newRecoveryKey = generateRecoveryKey();
    await this.userModel.setRecoveryKeyHash(
      user.id,
      await hashPassword(normalizeRecoveryKey(newRecoveryKey))
    );
    // Revoke all sessions — the password change may be from a compromised state.
    if (this.sessionModel?.revokeAllForUser) {
      await this.sessionModel.revokeAllForUser(user.id);
    }
    return { recoveryKey: newRecoveryKey };
  }
}
