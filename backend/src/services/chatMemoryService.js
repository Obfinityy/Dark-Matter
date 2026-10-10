/**
 * chatMemoryService.js — per-conversation memory on the user's local device.
 *
 * Each chat (Hunt chat, Infinity AI chat) has its own isolated memory.
 * Opening Chat 1 loads Chat 1's memory; opening Chat 2 loads Chat 2's.
 * Stored as JSON files on the local machine's secondary storage — unlimited,
 * private, never leaves the device.
 *
 * Memory per conversation:
 *   - messages: [{ role: 'user'|'assistant', content, timestamp }]
 *   - context: { huntId, target, findings summary, ... } — whatever the brain needs
 *   - updatedAt
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const MEMORY_DIR = path.join(os.homedir(), '.infinity-ai', 'chat-memory');

// Max messages kept per conversation (older ones summarized, not deleted silently)
const MAX_MESSAGES = 200;

/**
 * Sanitize a path segment (userId or chatId) to prevent path traversal.
 * Returns '' when nothing safe remains.
 */
function safeSegment(value) {
  return String(value || '')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 64);
}

function ensureDir(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {
    /* ignore */
  }
}

/**
 * Per-user memory path: memory/<userId>/<chatId>.json.
 * Namespacing by userId guarantees one user can never read, list, or delete
 * another user's chats, even when chatIds collide or are guessed.
 */
function memoryPath(userId, chatId) {
  const safeUser = safeSegment(userId);
  const safeChat = safeSegment(chatId);
  if (!safeUser) throw new Error('Invalid userId');
  if (!safeChat) throw new Error('Invalid chatId');
  return path.join(MEMORY_DIR, safeUser, `${safeChat}.json`);
}

function userDir(userId) {
  const safeUser = safeSegment(userId);
  if (!safeUser) throw new Error('Invalid userId');
  return path.join(MEMORY_DIR, safeUser);
}

function blankMemory(chatId) {
  return {
    chatId,
    messages: [],
    context: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/** Load a user's conversation memory. Returns blank memory if none exists. */
export function loadMemory(userId, chatId) {
  ensureDir(userDir(userId));
  try {
    const raw = fs.readFileSync(memoryPath(userId, chatId), 'utf8');
    const mem = JSON.parse(raw);
    if (!Array.isArray(mem.messages)) mem.messages = [];
    if (!mem.context || typeof mem.context !== 'object') mem.context = {};
    return mem;
  } catch {
    return blankMemory(chatId);
  }
}

/** Save a user's conversation memory. */
export function saveMemory(userId, chatId, memory) {
  ensureDir(userDir(userId));
  memory.updatedAt = new Date().toISOString();
  // Trim old messages (keep the most recent)
  if (memory.messages.length > MAX_MESSAGES) {
    memory.messages = memory.messages.slice(-MAX_MESSAGES);
  }
  fs.writeFileSync(memoryPath(userId, chatId), JSON.stringify(memory, null, 2), 'utf8');
  return memory;
}

/** Append a message to a user's conversation memory. */
export function appendMessage(userId, chatId, role, content, extra = {}) {
  const mem = loadMemory(userId, chatId);
  mem.messages.push({
    role,
    content: String(content || ''),
    timestamp: new Date().toISOString(),
    ...extra,
  });
  return saveMemory(userId, chatId, mem);
}

/** Update context (hunt info, findings, etc.) for a user's conversation. */
export function updateContext(userId, chatId, contextPatch) {
  const mem = loadMemory(userId, chatId);
  mem.context = { ...mem.context, ...contextPatch };
  return saveMemory(userId, chatId, mem);
}

/** Get recent messages for prompt building (last N). */
export function getRecentMessages(userId, chatId, limit = 20) {
  const mem = loadMemory(userId, chatId);
  return mem.messages.slice(-limit);
}

/** Delete a user's conversation memory. */
export function clearMemory(userId, chatId) {
  try {
    fs.unlinkSync(memoryPath(userId, chatId));
    return true;
  } catch {
    return false;
  }
}

/** List the calling user's conversation IDs with memory (never another user's). */
export function listChats(userId) {
  ensureDir(userDir(userId));
  try {
    return fs
      .readdirSync(userDir(userId))
      .filter(f => f.endsWith('.json'))
      .map(f => f.slice(0, -5));
  } catch {
    return [];
  }
}
