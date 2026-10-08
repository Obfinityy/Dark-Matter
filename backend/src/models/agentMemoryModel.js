import crypto from 'node:crypto';
import { id, now } from '../core/utils.js';

/**
 * AgentMemoryModel — MongoDB as the local AI's persistent memory.
 *
 * The phone-hosted Gemma has no memory of its own and a finite context window.
 * DARKMATTER therefore stores everything and *retrieves* only what is relevant
 * (requirement #10, #11, #13, #43, #44).
 *
 * Memory types (requirement #13):
 *   episodic     — what happened during the assessment
 *   semantic     — durable facts about the target (technologies, behaviours)
 *   task         — what remains to be tested / the live plan
 *   target       — assets belonging to the authorized scope
 *   tool         — what a tool execution discovered
 *   finding      — validated vulnerabilities and their state
 *   conversation — what the human and the agent said to each other
 */

export const MEMORY_TYPES = Object.freeze([
  'episodic',
  'semantic',
  'task',
  'target',
  'tool',
  'finding',
  'conversation',
]);

export class AgentMemoryModel {
  constructor(database) {
    this.collection = database.collection('agent_memory');
  }

  /** Stable dedupe key: the same fact learned twice is stored once. */
  static dedupeKey({ type, assessmentId, key, content }) {
    const payload = JSON.stringify({
      type,
      assessmentId,
      key: key || null,
      content: String(content).slice(0, 500),
    });
    return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 20);
  }

  async remember(entry) {
    const type = MEMORY_TYPES.includes(entry.type) ? entry.type : 'episodic';
    const dedupeKey = AgentMemoryModel.dedupeKey({ ...entry, type });

    const existing = await this.collection.findOne({ assessmentId: entry.assessmentId, dedupeKey });
    if (existing) {
      // Reinforce rather than duplicate: bump salience and recency.
      await this.collection.updateOne(
        { id: existing.id },
        {
          $set: {
            importance: Math.min(1, (existing.importance || 0.5) + 0.1),
            updatedAt: now(),
            lastSeenAt: now(),
          },
        }
      );
      return { memory: { ...existing, reinforced: true }, deduplicated: true };
    }

    const record = {
      id: id('mem'),
      dedupeKey,
      userId: entry.userId,
      assessmentId: entry.assessmentId,
      jobId: entry.jobId || null,
      conversationId: entry.conversationId || null,
      type,
      key: entry.key || null,
      content: String(entry.content || '').slice(0, 20_000),
      structured: entry.structured || null,
      refs: {
        toolExecutionId: entry.refs?.toolExecutionId || null,
        observationId: entry.refs?.observationId || null,
        findingId: entry.refs?.findingId || null,
        evidenceId: entry.refs?.evidenceId || null,
        chunkRef: entry.refs?.chunkRef || null,
        url: entry.refs?.url || null,
      },
      importance: typeof entry.importance === 'number' ? entry.importance : 0.5,
      createdAt: now(),
      updatedAt: now(),
      lastSeenAt: now(),
    };
    await this.collection.insertOne(record);
    return { memory: record, deduplicated: false };
  }

  async rememberMany(entries = []) {
    const results = [];
    for (const entry of entries) {
      results.push(await this.remember(entry));
    }
    return results;
  }

  async listAll(assessmentId, { types = null, limit = 2000 } = {}) {
    const query = { assessmentId };
    if (types?.length) query.type = { $in: types };
    return this.collection.find(query).sort({ createdAt: 1 }).limit(limit).toArray();
  }

  async listByType(assessmentId, type, limit = 500) {
    return this.collection
      .find({ assessmentId, type })
      .sort({ createdAt: 1 })
      .limit(limit)
      .toArray();
  }

  /** Ownership-scoped read — the isolation boundary for memory. */
  async get(userId, memoryId) {
    return this.collection.findOne({ id: memoryId, userId });
  }

  async countByType(assessmentId) {
    const all = await this.listAll(assessmentId);
    const counts = {};
    for (const type of MEMORY_TYPES) counts[type] = 0;
    for (const row of all) counts[row.type] = (counts[row.type] || 0) + 1;
    return counts;
  }

  async forget(memoryId) {
    await this.collection.deleteOne({ id: memoryId });
  }

  /** Deterministic consolidation: drop superseded low-salience task entries. */
  async consolidate(assessmentId, { maxPerType = 500 } = {}) {
    let removed = 0;
    for (const type of MEMORY_TYPES) {
      const rows = await this.listByType(assessmentId, type, 5000);
      if (rows.length <= maxPerType) continue;
      const superseded = rows
        .filter(row => row.importance < 0.4)
        .sort((a, b) => new Date(a.updatedAt) - new Date(b.updatedAt));
      for (const row of superseded.slice(0, rows.length - maxPerType)) {
        await this.forget(row.id);
        removed += 1;
      }
    }
    return { removed };
  }
}
