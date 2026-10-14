// Chat title sync — so renames (and chat order) follow the account across
// browsers/devices. Titles only (not message bodies): hunts already live
// on the backend; plain chats stay on-device.
//
//   GET  /api/v1/chats        -> [{id, title, updatedAt}] for this user
//   POST /api/v1/chats/sync   {chats:[{id,title,updatedAt}]} -> merged list
//
// Merge rule: last write wins by updatedAt (per chat id).

import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { dataDir } from '../store.js';
import { requireAuth } from './auth.js';

const router = Router();

function chatsFile(userId) {
  return path.join(dataDir(), 'chats', `${String(userId)}.json`);
}

function readTitles(userId) {
  try {
    const raw = fs.readFileSync(chatsFile(userId), 'utf8');
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeTitles(userId, list) {
  const dir = path.join(dataDir(), 'chats');
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `${String(userId)}.json.tmp`);
  fs.writeFileSync(tmp, JSON.stringify(list, null, 1));
  fs.renameSync(tmp, chatsFile(userId));
}

function clean(c) {
  if (!c || typeof c.id !== 'string' || !c.id) return null;
  return {
    id: c.id.slice(0, 64),
    title: String(c.title || 'Untitled chat').slice(0, 120),
    updatedAt: String(c.updatedAt || new Date().toISOString()),
  };
}

router.get('/', requireAuth, (req, res) => {
  res.json({ ok: true, chats: readTitles(req.user.id) });
});

router.post('/sync', requireAuth, (req, res) => {
  const incoming = Array.isArray(req.body && req.body.chats)
    ? req.body.chats.map(clean).filter(Boolean)
    : [];
  const merged = new Map();
  for (const c of readTitles(req.user.id)) merged.set(c.id, c);
  for (const c of incoming) {
    const prev = merged.get(c.id);
    if (!prev || String(c.updatedAt) >= String(prev.updatedAt || '')) {
      merged.set(c.id, c);
    }
  }
  const list = [...merged.values()]
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    .slice(0, 500);
  writeTitles(req.user.id, list);
  res.json({ ok: true, chats: list });
});

export default router;
