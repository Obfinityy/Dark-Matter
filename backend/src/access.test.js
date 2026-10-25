// Paid access window — unit tests (node --test).
// DATA_DIR is pointed at a temp dir BEFORE importing the module, because
// config.js reads it at module-eval time.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-access-test-'));
process.env.DATA_DIR = tmp;
const { hasActiveAccess, hasActiveAccessById, grantAccess, ACCESS_DAY_MS } = await import('./access.js');
const { writeUsers, readUsers } = await import('./store.js');

const DAY = 24 * 3600 * 1000;

test('hasActiveAccess: future window active, past/missing/invalid inactive', () => {
  const now = Date.now();
  assert.equal(hasActiveAccess({ accessUntil: new Date(now + DAY).toISOString() }), true);
  assert.equal(hasActiveAccess({ accessUntil: new Date(now - 1000).toISOString() }), false);
  assert.equal(hasActiveAccess({}), false);
  assert.equal(hasActiveAccess(null), false);
  assert.equal(hasActiveAccess({ accessUntil: 'not-a-date' }), false);
  assert.equal(hasActiveAccess({ accessUntil: new Date(now).toISOString() }), false); // lapses at the instant
});

test('grantAccess approves and sets accessUntil to now + 1 day', () => {
  const user = { id: 'u1', username: 'alice', approved: false };
  const before = Date.now();
  const until = grantAccess(user, 1);
  const after = Date.now();
  assert.equal(user.approved, true);
  assert.ok(user.approvedAt);
  const untilMs = new Date(until).getTime();
  assert.ok(untilMs >= before + DAY && untilMs <= after + DAY);
  assert.equal(until, user.accessUntil);
  assert.equal(hasActiveAccess(user), true);
});

test('grantAccess honours a custom day count and rejects bad input', () => {
  const user = { id: 'u2', username: 'bob', approved: false };
  const until = grantAccess(user, 2);
  assert.ok(new Date(until).getTime() - Date.now() > DAY);
  assert.throws(() => grantAccess(user, 0), /positive/);
  assert.throws(() => grantAccess(user, -1), /positive/);
  assert.throws(() => grantAccess(null, 1), /No user record/);
});

test('ACCESS_DAY_MS is exactly 24 hours', () => {
  assert.equal(ACCESS_DAY_MS, DAY);
});

test('hasActiveAccessById reads the user store', () => {
  writeUsers({
    carol: { id: 'u3', username: 'carol', approved: true, accessUntil: new Date(Date.now() + DAY).toISOString() },
    dave: { id: 'u4', username: 'dave', approved: true, accessUntil: new Date(Date.now() - 1000).toISOString() },
  });
  assert.equal(hasActiveAccessById('u3'), true);
  assert.equal(hasActiveAccessById('u4'), false);
  assert.equal(hasActiveAccessById('nope'), false);
  assert.equal(hasActiveAccessById(null), false);
  assert.equal(readUsers().carol.username, 'carol');
});
