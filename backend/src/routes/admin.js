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
  return {
    id: u.id,
    username: u.username,
    role: u.role || 'user',
    control: u.control || 'minimal',
    createdAt: u.createdAt,
    createdBy: u.createdBy || null,
  };
}

router.get('/users', requireAdmin, (req, res) => {
  const users = readUsers();
  res.json({ ok: true, users: Object.values(users).map(publicUser) });
});

// ---- All hunts on the backend (admin sees everything).
// GET /api/v1/admin/hunts -> [{huntId, target, state, mode, userId, createdAt, iteration}]
router.get('/hunts', requireAdmin, async (req, res) => {
  const { listHuntMetas } = await import('../store.js');
  const hunts = listHuntMetas().map((m) => ({
    huntId: m.huntId,
    target: m.target,
    state: m.state,
    mode: m.mode,
    userId: m.userId || null,
    createdAt: m.createdAt || null,
    iteration: m.iteration || 0,
    checkpointAt: m.checkpointAt || null,
  }));
  // Running/paused first, then by recency.
  hunts.sort((a, b) => {
    const rank = (s) => (s === 'running' ? 0 : s === 'paused' ? 1 : 2);
    if (rank(a.state) !== rank(b.state)) return rank(a.state) - rank(b.state);
    return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
  });
  res.json({ ok: true, hunts });
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

export default router;
