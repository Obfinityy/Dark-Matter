// Chat title sync — so renames (and chat order) follow the account across
// browsers/devices.
//
//   GET  /api/v1/chats        -> [{id, title, updatedAt}] for this user
//   POST /api/v1/chats/sync   {chats:[{id,title,updatedAt}]} -> merged list
//
// Chat message sync — full message history per chat, so any device sees the
// same conversation. Hunt messages carry only {huntId,target,scope,mode};
// live hunt data (logs/findings/status) is fetched from /api/v1/hunts.
//
//   GET  /api/v1/chats/:id/messages -> {messages, updatedAt}
//   POST /api/v1/chats/:id/messages {messages:[...], updatedAt} -> {ok:true}
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

// ---- Message history sync ----

function safeChatId(id) {
  return String(id || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
}

function messagesFile(userId, chatId) {
  return path.join(dataDir(), 'chat-messages', String(userId), `${safeChatId(chatId)}.json`);
}

function readMessages(userId, chatId) {
  try {
    const raw = fs.readFileSync(messagesFile(userId, chatId), 'utf8');
    const obj = JSON.parse(raw);
    return {
      messages: Array.isArray(obj.messages) ? obj.messages : [],
      updatedAt: obj.updatedAt || null,
    };
  } catch {
    return { messages: [], updatedAt: null };
  }
}

function writeMessages(userId, chatId, messages, updatedAt) {
  const dir = path.join(dataDir(), 'chat-messages', String(userId));
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `${safeChatId(chatId)}.json.tmp`);
  fs.writeFileSync(tmp, JSON.stringify({ messages, updatedAt }, null, 1));
  fs.renameSync(tmp, messagesFile(userId, chatId));
}

/** Strip a message down to sync-safe fields. Hunt payloads keep only the reference. */
function cleanMessage(m) {
  if (!m || typeof m !== 'object') return null;
  const role = String(m.role || '');
  if (!['user', 'assistant', 'hunt'].includes(role)) return null;
  const out = {
    id: String(m.id || '').slice(0, 64),
    role,
    text: String(m.text || '').slice(0, 20000),
    createdAt: String(m.createdAt || new Date().toISOString()),
  };
  if (role === 'hunt' && m.hunt && typeof m.hunt === 'object') {
    out.hunt = {
      huntId: String(m.hunt.huntId || '').slice(0, 64),
      target: String(m.hunt.target || '').slice(0, 500),
      scope: String(m.hunt.scope || '').slice(0, 2000),
      mode: String(m.hunt.mode || 'normal').slice(0, 32),
    };
  }
  if (!out.id) return null;
  return out;
}

router.get('/:id/messages', requireAuth, (req, res) => {
  const chatId = safeChatId(req.params.id);
  if (!chatId) return res.status(400).json({ ok: false, error: 'bad_chat_id' });
  const { messages, updatedAt } = readMessages(req.user.id, chatId);
  res.json({ ok: true, messages, updatedAt });
});

router.post('/:id/messages', requireAuth, (req, res) => {
  const chatId = safeChatId(req.params.id);
  if (!chatId) return res.status(400).json({ ok: false, error: 'bad_chat_id' });
  const incoming = Array.isArray(req.body && req.body.messages)
    ? req.body.messages.map(cleanMessage).filter(Boolean).slice(0, 1000)
    : [];
  const updatedAt = String((req.body && req.body.updatedAt) || new Date().toISOString());
  const prev = readMessages(req.user.id, chatId);
  // Last write wins — ignore stale pushes.
  if (prev.updatedAt && String(updatedAt) < String(prev.updatedAt)) {
    return res.json({ ok: true, messages: prev.messages, updatedAt: prev.updatedAt, stale: true });
  }
  writeMessages(req.user.id, chatId, incoming, updatedAt);
  res.json({ ok: true, updatedAt });
});

export default router;
