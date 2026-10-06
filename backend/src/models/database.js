import { MongoClient } from 'mongodb';

// Every finite database operation gets a hard ceiling so a dead or hanging
// Mongo connection fails FAST instead of hanging request handlers forever
// (that hang was the Oct 2026 prod P0: every POST route blocked on a query
// with no timeout while /health still reported "mongodb"). Explicit
// per-call maxTimeMS values are always respected.
export const DEFAULT_QUERY_TIMEOUT_MS = 15_000;

// Index of the options argument for each wrapped driver method.
const OPTIONS_INDEX = {
  find: 1,
  findOne: 1,
  findOneAndUpdate: 2,
  findOneAndDelete: 1,
  updateOne: 2,
  updateMany: 2,
  replaceOne: 2,
  insertOne: 1,
  insertMany: 1,
  deleteOne: 1,
  deleteMany: 1,
  aggregate: 1,
  countDocuments: 1,
  estimatedDocumentCount: 0,
  distinct: 2,
  bulkWrite: 1
};

export function withQueryTimeout(collection, maxTimeMS = DEFAULT_QUERY_TIMEOUT_MS) {
  return new Proxy(collection, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof value !== 'function' || !(property in OPTIONS_INDEX)) return value;
      return function (...args) {
        const index = OPTIONS_INDEX[property];
        while (args.length <= index) args.push(undefined);
        if (args[index] == null || typeof args[index] !== 'object') args[index] = {};
        if (args[index].maxTimeMS == null) args[index].maxTimeMS = maxTimeMS;
        return value.apply(target, args);
      };
    }
  });
}

export class MongoDatabase {
  constructor({ mongoUrl, mongoDbName, mongoServerSelectionTimeoutMs = 10_000 }) {
    if (!mongoUrl) throw new Error('MONGO_URL is required for the backend database connection');
    this.mongoUrl = mongoUrl;
    this.mongoDbName = mongoDbName;
    this.mongoServerSelectionTimeoutMs = mongoServerSelectionTimeoutMs;
    this.client = null;
    this.db = null;
  }

  async init() {
    this.client = new MongoClient(this.mongoUrl, {
      serverSelectionTimeoutMS: this.mongoServerSelectionTimeoutMs,
      maxPoolSize: 20
    });
    await this.client.connect();
    this.db = this.client.db(this.mongoDbName);
    await Promise.all([
      this.collection('users').createIndex({ email: 1 }, { unique: true }),
      // Username login: unique + sparse so pre-username accounts (email-only) keep working.
      this.collection('users').createIndex({ username: 1 }, { unique: true, sparse: true }),
      this.collection('sessions').createIndex({ tokenHash: 1 }, { unique: true }),
      this.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      this.collection('providers').createIndex({ userId: 1, providerId: 1 }, { unique: true }),
      this.collection('targets').createIndex({ userId: 1, url: 1 }, { unique: true }),
      this.collection('scans').createIndex({ userId: 1, createdAt: -1 }),
      this.collection('events').createIndex({ scanId: 1, timestamp: 1 }),
      // Assessment system indexes
      this.collection('assessments').createIndex({ userId: 1, createdAt: -1 }),
      this.collection('assessments').createIndex({ id: 1 }, { unique: true }),
      this.collection('agent_states').createIndex({ assessmentId: 1 }, { unique: true }),
      this.collection('tool_executions').createIndex({ assessmentId: 1, startedAt: -1 }),
      this.collection('tool_executions').createIndex({ assessmentId: 1, fingerprint: 1 }),
      this.collection('findings').createIndex({ assessmentId: 1, createdAt: -1 }),
      this.collection('findings').createIndex({ userId: 1, createdAt: -1 }),
      // Hunt records: the persistent artifact store ("what have we already hunted").
      // Dedup looks up (userId, targetHash); browsing lists by (userId, completedAt).
      this.collection('hunt_records').createIndex({ userId: 1, targetHash: 1, completedAt: -1 }),
      this.collection('hunt_records').createIndex({ userId: 1, completedAt: -1 }),
      this.collection('hunt_records').createIndex({ id: 1 }, { unique: true }),
      // Report indexes
      this.collection('reports').createIndex({ assessmentId: 1, version: -1 }),
      this.collection('reports').createIndex({ userId: 1, createdAt: -1 }),
      // Infinite Chat
      this.collection('infinite_chats').createIndex({ userId: 1, updatedAt: -1 }),
      // Autonomous Bug Bounty Agent (persistent jobs)
      this.collection('agent_jobs').createIndex({ id: 1 }, { unique: true }),
      this.collection('agent_jobs').createIndex({ userId: 1, createdAt: -1 }),
      this.collection('agent_jobs').createIndex({ assessmentId: 1 }),
      this.collection('agent_jobs').createIndex({ status: 1, updatedAt: -1 }),
      // Persistent agent memory (the local AI's only memory)
      this.collection('agent_memory').createIndex({ assessmentId: 1, type: 1, createdAt: 1 }),
      this.collection('agent_memory').createIndex({ assessmentId: 1, dedupeKey: 1 }, { unique: true }),
      this.collection('agent_memory').createIndex({ userId: 1, updatedAt: -1 }),
      // Evidence store
      this.collection('evidence').createIndex({ assessmentId: 1, createdAt: 1 }),
      this.collection('evidence').createIndex({ jobId: 1, createdAt: 1 }),
      this.collection('evidence').createIndex({ findingId: 1 }),
      this.collection('evidence').createIndex({ assessmentId: 1, fingerprint: 1 }),
      // Job-scoped events (the autonomous terminal + replay)
      this.collection('events').createIndex({ scanId: 1, timestamp: -1 }),
      // InfiniteChat computer tasks
      this.collection('computer_tasks').createIndex({ id: 1 }, { unique: true }),
      this.collection('computer_tasks').createIndex({ userId: 1, conversationId: 1, createdAt: -1 }),
      this.collection('computer_tasks').createIndex({ status: 1, updatedAt: -1 }),
      // Autonomous computer-control action ledger (issue #1)
      this.collection('computer_actions').createIndex({ id: 1 }, { unique: true }),
      this.collection('computer_actions').createIndex({ jobId: 1, startedAt: 1 }),
      this.collection('computer_actions').createIndex({ assessmentId: 1, startedAt: 1 }),
      // Reasoning-cycle ledger — the brain's first-class thinking loop (issue #1)
      this.collection('reasoning_cycles').createIndex({ id: 1 }, { unique: true }),
      this.collection('reasoning_cycles').createIndex({ jobId: 1, stepNumber: 1 }),
      this.collection('reasoning_cycles').createIndex({ assessmentId: 1, createdAt: -1 }),
      // Persisted brain-provider selection — the model picker (issue #3)
      this.collection('brain_provider').createIndex({ id: 1 }, { unique: true }),
      // User-added custom models (issue #3)
      this.collection('custom_models').createIndex({ id: 1 }, { unique: true }),
      this.collection('custom_models').createIndex({ tag: 1 }, { unique: true })
    ]);
  }

  collection(name) {
    if (!this.db) throw new Error('Mongo database has not been initialized');
    return withQueryTimeout(this.db.collection(name));
  }

  // Real liveness check: runs a ping command against the server with a hard
  // timeout. /health uses this so it reports the ACTUAL database state,
  // never a cached "wired" flag while the connection is dead.
  async ping(timeoutMs = 5_000) {
    if (!this.db) return { ok: false, error: 'database not initialized' };
    const startedAt = Date.now();
    try {
      const result = await Promise.race([
        this.db.command({ ping: 1 }, { maxTimeMS: timeoutMs }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`ping timed out after ${timeoutMs}ms`)), timeoutMs)
        )
      ]);
      return { ok: result?.ok === 1, latencyMs: Date.now() - startedAt };
    } catch (error) {
      return { ok: false, latencyMs: Date.now() - startedAt, error: error?.message || String(error) };
    }
  }

  async close() {
    await this.client?.close();
  }
}

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function equal(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function matches(document, query = {}) {
  return Object.entries(query).every(([key, expected]) => {
    if (key === '$or') return expected.some((part) => matches(document, part));
    const actual = document[key];
    if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
      if ('$gt' in expected) return actual > expected.$gt;
      if ('$gte' in expected) return actual >= expected.$gte;
      if ('$in' in expected) return expected.$in.some((value) => equal(actual, value));
    }
    return equal(actual, expected);
  });
}

class MemoryCursor {
  constructor(values) {
    this.values = values;
  }

  sort(spec = {}) {
    const [[field, direction]] = Object.entries(spec);
    this.values.sort((left, right) => {
      const a = left[field];
      const b = right[field];
      if (a === b) return 0;
      return (a > b ? 1 : -1) * direction;
    });
    return this;
  }

  limit(count) {
    this.values = this.values.slice(0, count);
    return this;
  }

  async toArray() {
    return clone(this.values);
  }
}

class MemoryCollection {
  constructor() {
    this.documents = [];
  }

  async createIndex() {}

  find(query = {}) {
    return new MemoryCursor(this.documents.filter((document) => matches(document, query)));
  }

  async findOne(query = {}) {
    return clone(this.documents.find((document) => matches(document, query)) || null);
  }

  async countDocuments(query = {}) {
    return this.documents.filter((document) => matches(document, query)).length;
  }

  async insertOne(document) {
    this.documents.push(clone(document));
    return { insertedId: document._id || document.id };
  }

  async updateOne(query, update, options = {}) {
    const index = this.documents.findIndex((document) => matches(document, query));
    if (index === -1 && !options.upsert) return { matchedCount: 0, modifiedCount: 0 };
    const current = index === -1 ? { ...query } : this.documents[index];
    const next = { ...current, ...(update.$setOnInsert && index === -1 ? update.$setOnInsert : {}), ...(update.$set || {}) };
    if (update.$push) {
      for (const [key, value] of Object.entries(update.$push)) {
        if (!next[key]) next[key] = [];
        if (value && value.$each) next[key].push(...value.$each);
        else next[key].push(value);
      }
    }
    if (update.$inc) {
      for (const [key, value] of Object.entries(update.$inc)) {
        next[key] = (next[key] || 0) + value;
      }
    }
    if (update.$addToSet) {
      for (const [key, value] of Object.entries(update.$addToSet)) {
        if (!Array.isArray(next[key])) next[key] = [];
        const values = value && value.$each ? value.$each : [value];
        for (const item of values) {
          if (!next[key].some((existing) => equal(existing, item))) next[key].push(item);
        }
      }
    }
    if (index === -1) this.documents.push(clone(next));
    else this.documents[index] = clone(next);
    return { matchedCount: index === -1 ? 0 : 1, modifiedCount: 1, upsertedCount: index === -1 ? 1 : 0 };
  }

  async deleteOne(query) {
    const index = this.documents.findIndex((document) => matches(document, query));
    if (index === -1) return { deletedCount: 0 };
    this.documents.splice(index, 1);
    return { deletedCount: 1 };
  }

  async deleteMany(query) {
    const before = this.documents.length;
    this.documents = this.documents.filter((document) => !matches(document, query));
    return { deletedCount: before - this.documents.length };
  }
}

export class MemoryDatabase {
  constructor() {
    this.collections = new Map();
  }

  async init() {}

  collection(name) {
    if (!this.collections.has(name)) this.collections.set(name, new MemoryCollection());
    return this.collections.get(name);
  }

  // The in-memory store is always local, so the ping is trivially healthy.
  async ping() {
    return { ok: true, latencyMs: 0, kind: 'memory' };
  }

  async close() {}
}
