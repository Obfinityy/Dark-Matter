// Instant finding notifications — unit tests (node --test).
// DATA_DIR is pointed at a temp dir BEFORE importing the module, because
// config.js reads it at module-eval time.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-notify-test-'));
process.env.DATA_DIR = tmp;
const { notifyFinding, listNotificationsFor, markNotificationRead, unreadCountFor } =
  await import('./notifications.js');

const owner = { id: 'user-1', role: 'user' };
const other = { id: 'user-2', role: 'user' };
const admin = { id: 'admin-1', role: 'admin' };

test('notifyFinding records a verified finding for owner + admin', () => {
  const rec = notifyFinding({ huntId: 'h1', ownerId: 'user-1', title: 'SQLi in login', severity: 'critical', target: 'https://t.example' });
  assert.ok(rec && rec.id);
  assert.equal(listNotificationsFor(owner).length, 1);
  assert.equal(listNotificationsFor(admin).length, 1);
  assert.equal(listNotificationsFor(other).length, 0);
  assert.equal(unreadCountFor(owner), 1);
});

test('same title on the same hunt does not re-alert', () => {
  notifyFinding({ huntId: 'h1', ownerId: 'user-1', title: 'SQLi in login', severity: 'critical', target: 'https://t.example' });
  assert.equal(listNotificationsFor(owner).length, 1);
  notifyFinding({ huntId: 'h1', ownerId: 'user-1', title: 'XSS in search', severity: 'high', target: 'https://t.example' });
  assert.equal(listNotificationsFor(owner).length, 2);
});

test('mark read is per-user and idempotent', () => {
  const [first] = listNotificationsFor(owner);
  assert.equal(markNotificationRead(first.id, owner), true);
  assert.equal(unreadCountFor(owner), 1); // one of two read
  assert.equal(unreadCountFor(admin), 2); // admin unaffected by owner's read
  assert.equal(markNotificationRead(first.id, owner), true); // idempotent
  assert.equal(markNotificationRead(first.id, other), false); // not visible to others
  assert.equal(markNotificationRead('nope', owner), false);
});

test('notifyFinding never throws on missing fields', () => {
  assert.equal(notifyFinding({}), null);
  assert.equal(notifyFinding({ huntId: 'h2' }), null);
});
