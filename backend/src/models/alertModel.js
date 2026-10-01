/**
 * alertModel.js
 *
 * Persistence for the alert center: critical findings, hunt completions,
 * scheduled-hunt starts, and queue advances. One document per alert.
 */

export class AlertModel {
  constructor(database) {
    this.collection = database.collection('alerts');
  }

  async create(alert) {
    await this.collection.insertOne(alert);
    return alert;
  }

  async list(userId, { unreadOnly = false, limit = 50 } = {}) {
    const query = { userId };
    if (unreadOnly) query.read = false;
    return this.collection.find(query).sort({ createdAt: -1 }).limit(limit).toArray();
  }

  async markRead(userId, alertId) {
    await this.collection.updateOne({ id: alertId, userId }, { $set: { read: true } });
    return this.collection.findOne({ id: alertId, userId });
  }

  async markAllRead(userId) {
    const unread = await this.collection.find({ userId, read: false }).toArray();
    for (const alert of unread) {
      await this.collection.updateOne({ id: alert.id }, { $set: { read: true } });
    }
    return unread.length;
  }
}
