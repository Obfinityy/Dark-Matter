/**
 * userModel — database model for user.
 * Schema definition and data-access methods for user records.
 * Part of: Infinity AI / Dark-Matter backend (database models).
 */

import { AppError, assert } from '../core/errors.js';
import { id, now } from '../core/utils.js';

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    username: user.username || null,
    name: user.name,
    createdAt: user.createdAt,
  };
}

function normalizeEmail(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

/**
 * Normalize Username.
 * @param {*} value
 * @returns {*} Result.
 */
export function normalizeUsername(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

/**
 * Valid Username.
 * @param {*} username
 * @returns {*} Result.
 */
export function validUsername(username) {
  // 3-30 chars: letters, digits, underscore, dash. Stable for login + display.
  return /^[a-z0-9_-]{3,30}$/.test(username);
}

/** Database model for user. */
export class UserModel {
  constructor(database) {
    this.collection = database.collection('users');
  }

  async create({ email, name, passwordHash, username = null }) {
    const user = {
      id: id('user'),
      email,
      name,
      passwordHash,
      createdAt: now(),
      updatedAt: now(),
    };
    if (username) user.username = username;
    try {
      await this.collection.insertOne(user);
    } catch (error) {
      if (error?.code === 11000) {
        // Keep the 409 human-readable; the sparse unique index fires on either field.
        const existing = await this.findByEmail(email);
        if (existing)
          throw new AppError(409, 'An account with this email already exists', 'EMAIL_IN_USE');
        throw new AppError(409, 'That username is already taken', 'USERNAME_IN_USE');
      }
      throw error;
    }
    return publicUser(user);
  }

  async findByEmail(email) {
    return this.collection.findOne({ email });
  }

  async findByUsername(username) {
    return this.collection.findOne({ username: normalizeUsername(username) });
  }

  // Login entry point: one identifier field accepts either a username or an email.
  async findByLogin(login) {
    const value = String(login || '').trim();
    if (!value) return null;
    if (value.includes('@')) return this.findByEmail(normalizeEmail(value));
    return this.findByUsername(value);
  }

  async findById(userId) {
    return this.collection.findOne({ id: userId });
  }

  /**
   * Persist a verified subscription. Called after Razorpay payment verification
   * so the plan survives localStorage clears and device switches.
   */
  async setSubscription(userId, { tierId, paymentId, orderId }) {
    const subscription = {
      tierId: String(tierId || '').toLowerCase(),
      paymentId: paymentId || null,
      orderId: orderId || null,
      activatedAt: now(),
      status: 'active',
    };
    await this.collection.updateOne({ id: userId }, { $set: { subscription, updatedAt: now() } });
    return subscription;
  }

  async getSubscription(userId) {
    const user = await this.findById(userId);
    return user?.subscription || null;
  }

  /**
   * Store the scrypt hash of the account recovery key. Only the hash is
   * persisted — the plain key is shown to the user once and never stored.
   */
  async setRecoveryKeyHash(userId, keyHash) {
    await this.collection.updateOne(
      { id: userId },
      { $set: { recoveryKeyHash: keyHash, recoveryKeySetAt: now(), updatedAt: now() } }
    );
  }

  async updateProfile(userId, input = {}) {
    const name = String(input.name || '')
      .trim()
      .slice(0, 120);
    assert(name.length >= 2, 400, 'Name must be at least 2 characters', 'INVALID_PROFILE');
    await this.collection.updateOne({ id: userId }, { $set: { name, updatedAt: now() } });
    const user = await this.findById(userId);
    assert(user, 404, 'User not found', 'USER_NOT_FOUND');
    return publicUser(user);
  }

  async changePassword(userId, newPasswordHash) {
    await this.collection.updateOne(
      { id: userId },
      { $set: { passwordHash: newPasswordHash, updatedAt: now() } }
    );
  }
}
