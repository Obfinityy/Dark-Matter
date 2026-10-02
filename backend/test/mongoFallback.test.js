/**
 * mongoFallback.test — unreachable MONGO_URL must not kill a non-production
 * boot; createApp degrades to the in-memory database with a warning.
 *
 * NOTE: env is set BEFORE any module is imported (all imports below are
 * dynamic) because config.js snapshots process.env at import time.
 */
process.env.MONGO_URL = 'mongodb://127.0.0.1:1/?serverSelectionTimeoutMS=500';
process.env.NODE_ENV = 'test';

import test from 'node:test';
import assert from 'node:assert/strict';

test('unreachable MONGO_URL falls back to the in-memory database', async () => {
  const { createApp } = await import('../src/app.js');
  const app = await createApp({});
  assert.equal(app.locals.databaseKind, 'memory');
  await app.locals.shutdown?.();
});
