import crypto from 'crypto';

/**
 * LongContextStore — persistent storage for raw inputs, chunks, summaries,
 * and conversation task state. Backed by the existing database layer
 * (MongoDatabase in production, MemoryDatabase in tests — same interface).
 *
 * Collections introduced:
 *   lc_inputs       one record per large ingestion (metadata + raw ref)
 *   lc_chunks       individual chunks (exact content, offsets, hashes)
 *   lc_summaries    hierarchical summaries with source chunk references
 *   lc_task_state   one per conversation (rolling memory, requirements, refs)
 *
 * Every record carries userId + conversationId for strict user isolation.
 * Raw original input is NEVER replaced by summaries — summaries only
 * *reference* chunk ids.
 */

class LongContextStore {
  constructor(database) {
    this.database = database;
  }

  // ── Inputs ──────────────────────────────────────────────────────────
  async createInput(record) {
    await this.database.collection('lc_inputs').insertOne(record);
    return record;
  }

  async getInput(userId, conversationId, inputId) {
    return this.database.collection('lc_inputs').findOne({ userId, conversationId, inputId });
  }

  async listInputs(userId, conversationId, { limit = 20 } = {}) {
    return this.database
      .collection('lc_inputs')
      .find({ userId, conversationId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  }

  async updateInput(userId, conversationId, inputId, patch) {
    await this.database
      .collection('lc_inputs')
      .updateOne({ userId, conversationId, inputId }, { $set: patch });
    return this.getInput(userId, conversationId, inputId);
  }

  // ── Chunks ──────────────────────────────────────────────────────────
  async insertChunks(chunks) {
    if (!chunks.length) return;
    // Insert in modest batches to avoid huge single writes on 100MB inputs.
    const BATCH = 500;
    for (let i = 0; i < chunks.length; i += BATCH) {
      const batch = chunks.slice(i, i + BATCH);
      for (const chunk of batch) {
        await this.database.collection('lc_chunks').insertOne(chunk);
      }
    }
  }

  async getChunk(userId, conversationId, inputId, chunkId) {
    return this.database
      .collection('lc_chunks')
      .findOne({ userId, conversationId, inputId, chunkId });
  }

  async getChunks(userId, conversationId, inputId, chunkIds) {
    const out = [];
    for (const chunkId of chunkIds) {
      const chunk = await this.getChunk(userId, conversationId, inputId, chunkId);
      if (chunk) out.push(chunk);
    }
    return out;
  }

  async listChunks(userId, conversationId, inputId, { skip = 0, limit = 100 } = {}) {
    const all = await this.database
      .collection('lc_chunks')
      .find({ userId, conversationId, inputId })
      .toArray();
    all.sort((a, b) => a.chunkIndex - b.chunkIndex);
    return all.slice(skip, skip + limit);
  }

  async countChunks(userId, conversationId, inputId) {
    const all = await this.database
      .collection('lc_chunks')
      .find({ userId, conversationId, inputId })
      .toArray();
    return all.length;
  }

  /**
   * Deterministic in-database search over exact chunk content.
   * This is NOT delegated to the model — "find every occurrence of X" must be
   * answered by real search, not hallucination.
   */
  async searchChunks(userId, conversationId, terms, { limit = 40 } = {}) {
    const all = await this.database
      .collection('lc_chunks')
      .find({ userId, conversationId })
      .toArray();
    const lowered = terms.map(t => t.toLowerCase());
    const hits = [];
    for (const chunk of all) {
      const content = (chunk.content || '').toLowerCase();
      const matched = lowered.filter(t => content.includes(t));
      if (matched.length > 0) {
        hits.push({ chunk, score: matched.length, matchedTerms: matched });
      }
    }
    hits.sort((a, b) => b.score - a.score);
    return hits.slice(0, limit);
  }

  // ── Summaries ───────────────────────────────────────────────────────
  async upsertSummary(record) {
    const existing = await this.database.collection('lc_summaries').findOne({
      userId: record.userId,
      conversationId: record.conversationId,
      summaryId: record.summaryId,
    });
    if (existing) {
      await this.database
        .collection('lc_summaries')
        .updateOne(
          {
            userId: record.userId,
            conversationId: record.conversationId,
            summaryId: record.summaryId,
          },
          { $set: record }
        );
    } else {
      await this.database.collection('lc_summaries').insertOne(record);
    }
    return record;
  }

  async getSummary(userId, conversationId, summaryId) {
    return this.database.collection('lc_summaries').findOne({ userId, conversationId, summaryId });
  }

  async listSummaries(userId, conversationId, inputId) {
    const all = await this.database
      .collection('lc_summaries')
      .find({ userId, conversationId, inputId })
      .toArray();
    all.sort((a, b) => a.level - b.level || a.order - b.order);
    return all;
  }

  // ── Task state (conversation memory) ────────────────────────────────
  async getTaskState(conversationId) {
    return this.database.collection('lc_task_state').findOne({ conversationId });
  }

  async saveTaskState(conversationId, state) {
    const existing = await this.getTaskState(conversationId);
    if (existing) {
      await this.database
        .collection('lc_task_state')
        .updateOne({ conversationId }, { $set: state });
    } else {
      await this.database.collection('lc_task_state').insertOne({ ...state, conversationId });
    }
    return state;
  }
}

function newId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export { LongContextStore, newId };
