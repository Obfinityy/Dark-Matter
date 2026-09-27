import { AppError, assert } from '../core/errors.js';
import { id, now } from '../core/utils.js';

function publicUser(user) {
  return { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt };
}

export class UserModel {
  constructor(database) {
    this.collection = database.collection('users');
  }

  async create({ email, name, passwordHash }) {
    const user = {
      id: id('user'),
      email,
      name,
      passwordHash,
      createdAt: now(),
      updatedAt: now()
    };
    try {
      await this.collection.insertOne(user);
    } catch (error) {
      if (error?.code === 11000) throw new AppError(409, 'An account with this email already exists', 'EMAIL_IN_USE');
      throw error;
    }
    return publicUser(user);
  }

  async findByEmail(email) {
    return this.collection.findOne({ email });
  }

  async findById(userId) {
    return this.collection.findOne({ id: userId });
  }

  async updateProfile(userId, input = {}) {
    const name = String(input.name || '').trim().slice(0, 120);
    assert(name.length >= 2, 400, 'Name must be at least 2 characters', 'INVALID_PROFILE');
    await this.collection.updateOne({ id: userId }, { $set: { name, updatedAt: now() } });
    const user = await this.findById(userId);
    assert(user, 404, 'User not found', 'USER_NOT_FOUND');
    return publicUser(user);
  }
}
