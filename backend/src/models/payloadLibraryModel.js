/**
 * payloadLibraryModel.js
 *
 * The self-learning payload library: every payload the agent tries is
 * recorded with its outcome. Payloads that worked (led to a confirmed or
 * matched result) rise to the top; payloads that failed sink. The next hunt
 * — even against a different target — starts with the knowledge of what
 * worked before.
 *
 * One document per unique payload:
 *   { id, key, technique, category, payload, description, context,
 *     successes, failures, lastOutcome, lastUsedAt, createdAt }
 */

import { randomUUID } from 'node:crypto';

const MAX_RECORDS = 2000;

/** Database model for payload library. */
export class PayloadLibraryModel {
  constructor(database) {
    this.collection = database.collection('payload_library');
  }

  /**
   * Record the outcome of one payload attempt. Creates the record on first
   * sight, updates success/failure counters afterwards.
   *
   * @param {object} attempt - { technique, category, payload, description?, context? }
   * @param {'success'|'failure'|'neutral'} outcome
   */
  async recordOutcome(attempt, outcome) {
    const payload = String(attempt.payload || '').slice(0, 2000);
    if (!payload) return null;

    const key = `${attempt.technique || ''}::${attempt.category || ''}::${payload}`;
    const nowIso = new Date().toISOString();

    let record = await this.collection.findOne({ key });
    if (!record) {
      record = {
        id: randomUUID(),
        key,
        technique: attempt.technique || null,
        category: attempt.category || null,
        payload,
        description: attempt.description || null,
        context: attempt.context || null,
        successes: 0,
        failures: 0,
        lastOutcome: null,
        lastUsedAt: null,
        createdAt: nowIso,
      };
      await this.collection.insertOne(record);
      await this._evictIfNeeded();
    }

    const update = { $set: { lastOutcome: outcome, lastUsedAt: nowIso } };
    if (outcome === 'success') update.$inc = { successes: 1 };
    else if (outcome === 'failure') update.$inc = { failures: 1 };
    await this.collection.updateOne({ key }, update);
    return this.collection.findOne({ key });
  }

  async _evictIfNeeded() {
    const all = await this.collection.find({}).toArray();
    if (all.length <= MAX_RECORDS) return;
    // Evict the least useful first: lowest (successes - failures).
    all.sort((a, b) => a.successes - a.failures - (b.successes - b.failures));
    for (const victim of all.slice(0, all.length - MAX_RECORDS)) {
      await this.collection.deleteOne({ id: victim.id });
    }
  }

  /**
   * Suggest payloads for a technique/category, best first.
   * Score = successes - failures, then recency.
   */
  async suggest({ technique = null, category = null, limit = 5 } = {}) {
    const query = {};
    if (technique) query.technique = technique;
    if (category) query.category = category;
    const all = await this.collection.find(query).toArray();
    return all
      .filter(r => r.successes > 0 || r.failures === 0)
      .sort((a, b) => {
        const score = b.successes - b.failures - (a.successes - a.failures);
        if (score !== 0) return score;
        return new Date(b.lastUsedAt || 0) - new Date(a.lastUsedAt || 0);
      })
      .slice(0, limit);
  }

  async stats() {
    const all = await this.collection.find({}).toArray();
    return {
      total: all.length,
      withSuccess: all.filter(r => r.successes > 0).length,
      totalSuccesses: all.reduce((n, r) => n + r.successes, 0),
      totalFailures: all.reduce((n, r) => n + r.failures, 0),
    };
  }

  async remove(id) {
    const result = await this.collection.deleteOne({ id });
    return result.deletedCount > 0;
  }
}

export { MAX_RECORDS };
