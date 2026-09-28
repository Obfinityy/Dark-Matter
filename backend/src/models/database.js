import { MongoClient } from 'mongodb';

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
      // Report indexes
      this.collection('reports').createIndex({ assessmentId: 1, version: -1 }),
      this.collection('reports').createIndex({ userId: 1, createdAt: -1 })
    ]);
  }

  collection(name) {
    if (!this.db) throw new Error('Mongo database has not been initialized');
    return this.db.collection(name);
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

  async close() {}
}
