/**
 * targetQueueModel.js
 *
 * Persistence for the multi-target queue: the user lines up several targets,
 * the agent hunts them one after another without supervision.
 *
 * One document per queue:
 *   { id, userId, name, status: 'active'|'paused'|'complete',
 *     targets: [{ url, scope, status: 'queued'|'active'|'done'|'failed', jobId }],
 *     createdAt }
 */

/** Database model for target queue. */
export class TargetQueueModel {
  constructor(database) {
    this.collection = database.collection('target_queues');
  }

  async create(queue) {
    await this.collection.insertOne(queue);
    return queue;
  }

  async get(userId, id) {
    return this.collection.findOne({ id, userId });
  }

  async list(userId) {
    return this.collection.find({ userId }).sort({ createdAt: -1 }).toArray();
  }

  async update(userId, id, patch) {
    await this.collection.updateOne({ id, userId }, { $set: patch });
    return this.collection.findOne({ id, userId });
  }

  async remove(userId, id) {
    const result = await this.collection.deleteOne({ id, userId });
    return result.deletedCount > 0;
  }
}
