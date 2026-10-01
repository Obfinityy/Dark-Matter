/**
 * huntScheduleModel.js
 *
 * Persistence for scheduled hunts: the agent re-hunts a target on a cadence
 * (daily / weekly / once) without the user lifting a finger.
 *
 * One document per schedule:
 *   { id, userId, name, target, scope, objective, cadence: 'once'|'daily'|'weekly',
 *     nextRunAt, enabled, lastJobId, lastRunAt, createdAt }
 */

export class HuntScheduleModel {
  constructor(database) {
    this.collection = database.collection('hunt_schedules');
  }

  async create(schedule) {
    await this.collection.insertOne(schedule);
    return schedule;
  }

  async get(userId, id) {
    return this.collection.findOne({ id, userId });
  }

  async list(userId) {
    return this.collection.find({ userId }).sort({ nextRunAt: 1 }).toArray();
  }

  async update(userId, id, patch) {
    await this.collection.updateOne({ id, userId }, { $set: patch });
    return this.collection.findOne({ id, userId });
  }

  async remove(userId, id) {
    const result = await this.collection.deleteOne({ id, userId });
    return result.deletedCount > 0;
  }

  /** All enabled schedules whose next run is due, across users. */
  async due(now = new Date()) {
    const ts = now instanceof Date ? now.getTime() : new Date(now).getTime();
    const all = await this.collection.find({ enabled: true }).toArray();
    return all.filter((s) => s.nextRunAt && new Date(s.nextRunAt).getTime() <= ts);
  }
}
