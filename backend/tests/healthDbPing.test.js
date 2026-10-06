/**
 * Tests for the Oct 2026 prod-P0 hardening (assigned by Infinity One):
 *  1. /health performs a REAL database ping with a hard timeout instead of
 *     reporting a cached "mongodb" flag while the connection is dead.
 *  2. Every finite Mongo query gets a default maxTimeMS so handlers fail
 *     fast instead of hanging forever on a dead connection.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  MongoDatabase,
  MemoryDatabase,
  withQueryTimeout,
  DEFAULT_QUERY_TIMEOUT_MS
} from '../src/models/database.js';
import { health } from '../src/controllers/healthController.js';

// ---- Fake driver collection that records the options it receives ----
function fakeCollection() {
  const calls = [];
  const target = {
    find(query, options) { calls.push(['find', options]); return 'find-cursor'; },
    findOne(query, options) { calls.push(['findOne', options]); return 'doc'; },
    findOneAndUpdate(filter, update, options) { calls.push(['findOneAndUpdate', options]); return 'doc'; },
    updateOne(filter, update, options) { calls.push(['updateOne', options]); return 'ok'; },
    deleteOne(filter, options) { calls.push(['deleteOne', options]); return 'ok'; },
    insertOne(doc, options) { calls.push(['insertOne', options]); return 'ok'; },
    aggregate(pipeline, options) { calls.push(['aggregate', options]); return 'cursor'; },
    createIndex(spec, options) { calls.push(['createIndex', options]); return 'idx'; }
  };
  return { target, calls };
}

describe('withQueryTimeout', () => {
  it('adds a default maxTimeMS to read/write operations', () => {
    const { target, calls } = fakeCollection();
    const wrapped = withQueryTimeout(target);
    wrapped.find({ a: 1 });
    wrapped.findOne({ a: 1 });
    wrapped.updateOne({ a: 1 }, { $set: { b: 2 } });
    assert.equal(calls.length, 3);
    for (const [, options] of calls) {
      assert.equal(options.maxTimeMS, DEFAULT_QUERY_TIMEOUT_MS);
    }
  });

  it('respects an explicit caller-provided maxTimeMS', () => {
    const { target, calls } = fakeCollection();
    withQueryTimeout(target).findOne({ a: 1 }, { maxTimeMS: 500 });
    assert.equal(calls[0][1].maxTimeMS, 500);
  });

  it('passes through methods that are not in the timeout table (e.g. createIndex)', () => {
    const { target, calls } = fakeCollection();
    const wrapped = withQueryTimeout(target);
    wrapped.createIndex({ email: 1 });
    assert.equal(calls.length, 1);
    assert.equal(calls[0][1], undefined);
  });
});

describe('database ping', () => {
  it('MemoryDatabase.ping reports healthy immediately', async () => {
    const db = new MemoryDatabase();
    const result = await db.ping();
    assert.equal(result.ok, true);
  });

  it('MongoDatabase.ping fails fast when the command never resolves', async () => {
    const db = new MongoDatabase({ mongoUrl: 'mongodb://localhost:27017', mongoDbName: 'test' });
    db.db = { command: () => new Promise(() => {}) }; // hangs forever
    const startedAt = Date.now();
    const result = await db.ping(200);
    assert.equal(result.ok, false);
    assert.match(result.error, /timed out/);
    assert.ok(Date.now() - startedAt < 5_000, 'ping must fail fast, not hang');
  });

  it('MongoDatabase.ping reports success with latency on a live connection', async () => {
    const db = new MongoDatabase({ mongoUrl: 'mongodb://localhost:27017', mongoDbName: 'test' });
    db.db = { command: async () => ({ ok: 1 }) };
    const result = await db.ping(2_000);
    assert.equal(result.ok, true);
    assert.ok(result.latencyMs >= 0);
  });

  it('MongoDatabase.collection returns a timeout-guarded collection', () => {
    const db = new MongoDatabase({ mongoUrl: 'mongodb://localhost:27017', mongoDbName: 'test' });
    const seen = {};
    db.db = {
      collection: (name) => ({
        findOne: (query, options) => { seen.options = options; return null; }
      })
    };
    db.collection('users').findOne({ email: 'a@b.c' });
    assert.equal(seen.options.maxTimeMS, DEFAULT_QUERY_TIMEOUT_MS);
  });
});

// ---- health controller ----
function fakeRequest(database) {
  return { app: { locals: { database, databaseKind: 'mongodb' } } };
}

function fakeResponse() {
  const res = { statusCode: 200, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res.body = payload; return res; };
  return res;
}

describe('/health real ping', () => {
  it('returns 200 with a successful ping on a live database', async () => {
    const db = new MemoryDatabase();
    const req = fakeRequest(db);
    const res = fakeResponse();
    await health(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.status, 'ok');
    assert.equal(res.body.databasePing.ok, true);
    assert.equal(res.body.databasePing.skipped, false);
  });

  it('returns 503 fast when the database ping fails (no hang)', async () => {
    const db = new MongoDatabase({ mongoUrl: 'mongodb://localhost:27017', mongoDbName: 'test' });
    db.db = { command: () => new Promise(() => {}) };
    const req = fakeRequest(db);
    const res = fakeResponse();
    const startedAt = Date.now();
    await health(req, res);
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.status, 'degraded');
    assert.equal(res.body.databasePing.ok, false);
    assert.ok(Date.now() - startedAt < 10_000, 'health must respond fast, never hang');
  });

  it('stays backward compatible when no database is wired', async () => {
    const req = { app: { locals: {} } };
    const res = fakeResponse();
    await health(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.database, 'unknown');
  });
});
