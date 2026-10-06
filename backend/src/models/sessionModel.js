export class SessionModel {
  constructor(database) {
    this.collection = database.collection('sessions');
  }

  async create({ userId, tokenHash, expiresAt }) {
    await this.collection.insertOne({ tokenHash, userId, expiresAt, createdAt: new Date() });
  }

  async findActive(tokenHash) {
    return this.collection.findOne({ tokenHash, expiresAt: { $gt: new Date() } });
  }

  async remove(tokenHash) {
    await this.collection.deleteOne({ tokenHash });
  }

  /** Revoke every session for a user (used after password recovery). */
  async revokeAllForUser(userId) {
    await this.collection.deleteMany({ userId });
  }
}
