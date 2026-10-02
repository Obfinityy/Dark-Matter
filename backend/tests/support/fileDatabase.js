/**
 * fileDatabase.js — TEST SUPPORT ONLY (not production code).
 *
 * A file-backed implementation of the same `database.collection(name)`
 * interface the app already supports (MongoDatabase / MemoryDatabase in
 * backend/src/models/database.js). Each collection persists as one JSON
 * file, written through on every mutation, so a SIGKILLed backend process
 * can be rebooted against the same directory and find all job state intact.
 *
 * Used ONLY by the hunt-proof crash-recovery tests: it lets the REAL
 * createApp()/JobManager/AgentWorker code run against durable storage in
 * this sandbox, where MongoDB is unavailable. The app code under test is
 * untouched — only the storage adapter is test-supplied, via the
 * createApp({ database }) injection point the app already exposes.
 */
import fs from 'node:fs';
import path from 'node:path';

function clone(value) {
  return value === undefined || value === null
    ? value
    : structuredClone(value);
}

// Dates must survive the JSON round-trip (MemoryDatabase keeps them via
// structuredClone; a plain JSON file would stringify them and break $gt
// date queries like SessionModel.findActive). Encode as {$date: iso}.
function encodeDates(value) {
  if (value instanceof Date) return { $date: value.toISOString() };
  if (Array.isArray(value)) return value.map(encodeDates);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encodeDates(v)]));
  }
  return value;
}

function decodeDates(value) {
  if (Array.isArray(value)) return value.map(decodeDates);
  if (value && typeof value === 'object') {
    if (typeof value.$date === 'string' && Object.keys(value).length === 1) {
      const d = new Date(value.$date);
      if (!Number.isNaN(d.getTime())) return d;
    }
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, decodeDates(v)]));
  }
  return value;
}

function equal(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
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

class FileCursor {
  constructor(values) {
    this.values = values;
  }
  sort(spec = {}) {
    const [[field, direction]] = Object.entries(spec);
    if (field) {
      this.values.sort((left, right) => {
        const a = left[field];
        const b = right[field];
        if (a === b) return 0;
        return (a > b ? 1 : -1) * direction;
      });
    }
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

class FileCollection {
  constructor(filePath) {
    this.filePath = filePath;
    this.documents = [];
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = decodeDates(JSON.parse(raw));
      if (Array.isArray(parsed)) this.documents = parsed;
    } catch {
      // missing or corrupt file → start empty (fresh dir)
    }
  }

  _persist() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(encodeDates(this.documents)));
    fs.renameSync(tmp, this.filePath);
  }

  async createIndex() {}

  find(query = {}) {
    return new FileCursor(this.documents.filter((d) => matches(d, query)));
  }

  async findOne(query = {}) {
    return clone(this.documents.find((d) => matches(d, query)) || null);
  }

  async countDocuments(query = {}) {
    return this.documents.filter((d) => matches(d, query)).length;
  }

  async insertOne(document) {
    this.documents.push(clone(document));
    this._persist();
    return { insertedId: document._id || document.id };
  }

  async updateOne(query, update, options = {}) {
    const index = this.documents.findIndex((d) => matches(d, query));
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
    this._persist();
    return { matchedCount: index === -1 ? 0 : 1, modifiedCount: 1, upsertedCount: index === -1 ? 1 : 0 };
  }

  async deleteOne(query) {
    const index = this.documents.findIndex((d) => matches(d, query));
    if (index === -1) return { deletedCount: 0 };
    this.documents.splice(index, 1);
    this._persist();
    return { deletedCount: 1 };
  }
}

export class FileDatabase {
  constructor(dir) {
    this.dir = dir;
    this.collections = new Map();
  }

  async init() {
    fs.mkdirSync(this.dir, { recursive: true });
  }

  collection(name) {
    if (!this.collections.has(name)) {
      const safe = String(name).replace(/[^a-zA-Z0-9_-]/g, '_');
      this.collections.set(name, new FileCollection(path.join(this.dir, `${safe}.json`)));
    }
    return this.collections.get(name);
  }

  async close() {}
}
