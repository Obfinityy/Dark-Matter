// Admin portal API — invite-only user management.
//
//   GET    /api/v1/admin/users        -> list users (no password hashes)
//   POST   /api/v1/admin/users        {username, password, control} -> create
//   PUT    /api/v1/admin/users/:id    {control} -> change control level
//   DELETE /api/v1/admin/users/:id    -> delete user
//
// All routes require admin role. Control levels:
//   minimal — Normal/Medium hunt modes, 1 concurrent hunt
//   maximum — all modes, 5 concurrent hunts

import { Router } from 'express';
import crypto from 'node:crypto';
import { readUsers, writeUsers } from '../store.js';
import { requireAdmin, hashPassword } from './auth.js';

const router = Router();

const VALID_CONTROLS = ['minimal', 'maximum'];
const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;

function publicUser(u) {
  const isBlocked = u.blockedUntil === null || (u.blockedUntil && new Date(u.blockedUntil) > new Date());
  return {
    id: u.id,
    username: u.username,
    role: u.role || 'user',
    control: u.control || 'minimal',
    createdAt: u.createdAt,
    createdBy: u.createdBy || null,
    blocked: !!isBlocked,
    blockedUntil: u.blockedUntil || null,
    blockedAt: u.blockedAt || null,
    approved: u.approved !== false,
    approvedAt: u.approvedAt || null,
  };
}

router.get('/users', requireAdmin, (req, res) => {
  const users = readUsers();
  res.json({ ok: true, users: Object.values(users).map(publicUser) });
});

// ---- All hunts on the backend (admin sees everything).
// GET /api/v1/admin/hunts -> [{huntId, target, state, mode, userId, username, createdAt, iteration, elapsed, findings}]
router.get('/hunts', requireAdmin, async (req, res) => {
  const { listHuntMetas, readUsers } = await import('../store.js');
  const users = readUsers();
  const userMap = {};
  for (const [username, u] of Object.entries(users)) {
    userMap[u.id] = username;
  }
  const hunts = listHuntMetas().map((m) => {
    // Calculate elapsed time
    let elapsed = null;
    if (m.createdAt) {
      const start = new Date(m.createdAt).getTime();
      const end = m.endedAt ? new Date(m.endedAt).getTime() : Date.now();
      elapsed = Math.floor((end - start) / 1000);
    }
    return {
      huntId: m.huntId,
      target: m.target,
      state: m.state,
      mode: m.mode,
      userId: m.userId || null,
      username: (m.userId && userMap[m.userId]) || 'unknown',
      createdAt: m.createdAt || null,
      iteration: m.iteration || 0,
      checkpointAt: m.checkpointAt || null,
      elapsedSec: elapsed,
      findings: m.findingsCount || 0,
      scope: m.scope || null,
    };
  });
  // Running/paused first, then by recency.
  hunts.sort((a, b) => {
    const rank = (s) => (s === 'running' ? 0 : s === 'paused' ? 1 : 2);
    if (rank(a.state) !== rank(b.state)) return rank(a.state) - rank(b.state);
    return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
  });
  // Also get queue
  let queue = [];
  try {
    const { getQueue } = await import('../store.js');
    queue = getQueue() || [];
  } catch { /* no queue */ }
  res.json({ ok: true, hunts, queue, queueCount: queue.length });
});

// ---- Hunt queue management (admin) ----
router.get('/queue', requireAdmin, async (req, res) => {
  const { readQueue } = await import('../store.js');
  const queue = readQueue()
    .sort((a, b) => (b.priority - a.priority) || (a.createdAt < b.createdAt ? -1 : 1));
  res.json({ ok: true, queue });
});

router.put('/queue/:queueId/priority', requireAdmin, async (req, res) => {
  const { setQueuePriority } = await import('../store.js');
  const { priority } = req.body || {};
  const ok = setQueuePriority(req.params.queueId, priority);
  if (!ok) return res.status(404).json({ ok: false, error: 'not_found' });
  res.json({ ok: true, message: 'Priority updated.' });
});

router.delete('/queue/:queueId', requireAdmin, async (req, res) => {
  const { removeFromQueue } = await import('../store.js');
  const ok = removeFromQueue(req.params.queueId, null, true);
  if (!ok) return res.status(404).json({ ok: false, error: 'not_found' });
  res.json({ ok: true, message: 'Removed from queue.' });
});

router.post('/users', requireAdmin, (req, res) => {
  const { username, password, control } = req.body || {};
  const cleanUsername = String(username || '').trim().toLowerCase();
  if (!USERNAME_RE.test(cleanUsername)) {
    return res.status(400).json({
      ok: false,
      error: 'invalid_username',
      message: 'Username: 3-32 chars, lowercase letters, numbers, . _ -',
    });
  }
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({
      ok: false,
      error: 'weak_password',
      message: 'Password must be at least 8 characters.',
    });
  }
  const cleanControl = VALID_CONTROLS.includes(control) ? control : 'minimal';
  const users = readUsers();
  if (users[cleanUsername]) {
    return res.status(409).json({ ok: false, error: 'username_taken', message: 'Username already exists.' });
  }
  const { salt, hash } = hashPassword(password);
  const user = {
    id: crypto.randomUUID(),
    username: cleanUsername,
    salt,
    passHash: hash,
    role: 'user',
    control: cleanControl,
    createdAt: new Date().toISOString(),
    createdBy: req.user.username,
  };
  users[cleanUsername] = user;
  writeUsers(users);
  res.status(201).json({ ok: true, user: publicUser(user) });
});

router.put('/users/:id', requireAdmin, (req, res) => {
  const { control } = req.body || {};
  if (!VALID_CONTROLS.includes(control)) {
    return res.status(400).json({
      ok: false,
      error: 'invalid_control',
      message: 'Control must be "minimal" or "maximum".',
    });
  }
  const users = readUsers();
  const user = Object.values(users).find((u) => u.id === req.params.id);
  if (!user) {
    return res.status(404).json({ ok: false, error: 'not_found', message: 'User not found.' });
  }
  if (user.role === 'admin') {
    return res.status(400).json({ ok: false, error: 'cannot_demote_admin', message: 'Admin control cannot be changed.' });
  }
  user.control = control;
  writeUsers(users);
  res.json({ ok: true, user: publicUser(user) });
});

router.delete('/users/:id', requireAdmin, (req, res) => {
  const users = readUsers();
  const key = Object.keys(users).find((k) => users[k].id === req.params.id);
  if (!key) {
    return res.status(404).json({ ok: false, error: 'not_found', message: 'User not found.' });
  }
  if (users[key].role === 'admin') {
    return res.status(400).json({ ok: false, error: 'cannot_delete_admin', message: 'Admin cannot be deleted.' });
  }
  delete users[key];
  writeUsers(users);
  res.json({ ok: true, deleted: req.params.id });
});

// Block a user for a duration (1/2/3 days, custom hours, or permanent).
// POST /api/v1/admin/users/:id/block { durationHours | permanent: true }
// Blocked users cannot log in until the block expires.
router.post('/users/:id/block', requireAdmin, (req, res) => {
  const { durationHours, permanent } = req.body || {};
  const users = readUsers();
  const user = Object.values(users).find((u) => u.id === req.params.id);
  if (!user) {
    return res.status(404).json({ ok: false, error: 'not_found', message: 'User not found.' });
  }
  if (user.role === 'admin') {
    return res.status(400).json({ ok: false, error: 'cannot_block_admin', message: 'Admin cannot be blocked.' });
  }
  if (permanent) {
    user.blockedUntil = null; // null = permanent block
    user.blockedAt = new Date().toISOString();
    user.blockReason = 'Blocked permanently by admin';
  } else {
    const hours = Number(durationHours);
    if (!hours || hours < 1 || hours > 8760) {
      return res.status(400).json({ ok: false, error: 'invalid_duration', message: 'Duration must be 1-8760 hours.' });
    }
    user.blockedUntil = new Date(Date.now() + hours * 3600 * 1000).toISOString();
    user.blockedAt = new Date().toISOString();
    user.blockReason = `Blocked for ${hours} hours by admin`;
  }
  writeUsers(users);
  res.json({ ok: true, user: publicUser(user) });
});

// Unblock a user.
router.post('/users/:id/unblock', requireAdmin, (req, res) => {
  const users = readUsers();
  const user = Object.values(users).find((u) => u.id === req.params.id);
  if (!user) {
    return res.status(404).json({ ok: false, error: 'not_found', message: 'User not found.' });
  }
  delete user.blockedUntil;
  delete user.blockedAt;
  delete user.blockReason;
  writeUsers(users);
  res.json({ ok: true, user: publicUser(user) });
});

// Approve a pending signup (admin). The user can log in and use the service after this.
// POST /api/v1/admin/users/:id/approve
router.post('/users/:id/approve', requireAdmin, (req, res) => {
  const users = readUsers();
  const user = Object.values(users).find((u) => u.id === req.params.id);
  if (!user) {
    return res.status(404).json({ ok: false, error: 'not_found', message: 'User not found.' });
  }
  user.approved = true;
  user.approvedAt = new Date().toISOString();
  writeUsers(users);
  console.log(`[admin] APPROVED user: ${user.username}`);
  res.json({ ok: true, user: publicUser(user) });
});

// Reject a pending signup (admin) — deletes the account.
// POST /api/v1/admin/users/:id/reject
router.post('/users/:id/reject', requireAdmin, (req, res) => {
  const users = readUsers();
  const entry = Object.entries(users).find(([, u]) => u.id === req.params.id);
  if (!entry) {
    return res.status(404).json({ ok: false, error: 'not_found', message: 'User not found.' });
  }
  const [username, user] = entry;
  if (user.approved !== false) {
    return res.status(400).json({ ok: false, error: 'not_pending', message: 'Only pending signups can be rejected.' });
  }
  delete users[username];
  writeUsers(users);
  console.log(`[admin] REJECTED signup: ${username}`);
  res.json({ ok: true, message: `Signup rejected for ${username}.` });
});

// Change a user's password (admin).
// POST /api/v1/admin/users/:id/password { password }
router.post('/users/:id/password', requireAdmin, (req, res) => {
  const { password } = req.body || {};
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ ok: false, error: 'weak_password', message: 'Password must be at least 8 characters.' });
  }
  const users = readUsers();
  const user = Object.values(users).find((u) => u.id === req.params.id);
  if (!user) {
    return res.status(404).json({ ok: false, error: 'not_found', message: 'User not found.' });
  }
  const { salt, hash } = hashPassword(password);
  user.salt = salt;
  user.passHash = hash;
  writeUsers(users);
  res.json({ ok: true, message: 'Password updated.' });
});

export default router;
