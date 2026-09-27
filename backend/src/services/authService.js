import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { AppError, assert } from '../core/errors.js';
import { hashToken } from '../core/utils.js';

const scrypt = promisify(crypto.scrypt);

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
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

export class AuthService {
  constructor({ userModel, sessionModel, sessionDays }) {
    this.userModel = userModel;
    this.sessionModel = sessionModel;
    this.sessionDays = sessionDays;
  }

  async register(input = {}) {
    const email = normalizeEmail(input.email);
    const password = String(input.password || '');
    const name = String(input.name || '').trim().slice(0, 120);
    assert(validEmail(email), 400, 'Enter a valid email address', 'INVALID_EMAIL');
    assert(password.length >= 8, 400, 'Password must be at least 8 characters', 'WEAK_PASSWORD');
    assert(name.length >= 2, 400, 'Name must be at least 2 characters', 'INVALID_NAME');
    assert(!(await this.userModel.findByEmail(email)), 409, 'An account with this email already exists', 'EMAIL_IN_USE');
    const user = await this.userModel.create({ email, name, passwordHash: await hashPassword(password) });
    return { user, token: await this.createSession(user.id) };
  }

  async login(input = {}) {
    const email = normalizeEmail(input.email);
    const password = String(input.password || '');
    const user = await this.userModel.findByEmail(email);
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new AppError(401, 'Email or password is incorrect', 'INVALID_CREDENTIALS');
    }
    return { user: { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt }, token: await this.createSession(user.id) };
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
    return user ? { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt } : null;
  }

  async logout(token) {
    if (token) await this.sessionModel.remove(hashToken(token));
  }

  async updateProfile(userId, input) {
    return this.userModel.updateProfile(userId, input);
  }
}
