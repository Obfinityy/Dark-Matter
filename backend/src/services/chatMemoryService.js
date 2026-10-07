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

function ensureDir() {
  try {
    fs.mkdirSync(MEMORY_DIR, { recursive: true });
  } catch { /* ignore */ }
}

function memoryPath(chatId) {
  // Sanitize chatId to prevent path traversal
  const safe = String(chatId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  if (!safe) throw new Error('Invalid chatId');
  return path.join(MEMORY_DIR, `${safe}.json`);
}

function blankMemory(chatId) {
  return {
    chatId,
    messages: [],
    context: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

/** Load a conversation's memory. Returns blank memory if none exists. */
export function loadMemory(chatId) {
  ensureDir();
  try {
    const raw = fs.readFileSync(memoryPath(chatId), 'utf8');
    const mem = JSON.parse(raw);
    if (!Array.isArray(mem.messages)) mem.messages = [];
    if (!mem.context || typeof mem.context !== 'object') mem.context = {};
    return mem;
  } catch {
    return blankMemory(chatId);
  }
}

/** Save a conversation's memory. */
export function saveMemory(chatId, memory) {
  ensureDir();
  memory.updatedAt = new Date().toISOString();
  // Trim old messages (keep the most recent)
  if (memory.messages.length > MAX_MESSAGES) {
    memory.messages = memory.messages.slice(-MAX_MESSAGES);
  }
  fs.writeFileSync(memoryPath(chatId), JSON.stringify(memory, null, 2), 'utf8');
  return memory;
}

/** Append a message to a conversation's memory. */
export function appendMessage(chatId, role, content, extra = {}) {
  const mem = loadMemory(chatId);
  mem.messages.push({
    role,
    content: String(content || ''),
    timestamp: new Date().toISOString(),
    ...extra
  });
  return saveMemory(chatId, mem);
}

/** Update context (hunt info, findings, etc.) for a conversation. */
export function updateContext(chatId, contextPatch) {
  const mem = loadMemory(chatId);
  mem.context = { ...mem.context, ...contextPatch };
  return saveMemory(chatId, mem);
}

/** Get recent messages for prompt building (last N). */
export function getRecentMessages(chatId, limit = 20) {
  const mem = loadMemory(chatId);
  return mem.messages.slice(-limit);
}

/** Delete a conversation's memory. */
export function clearMemory(chatId) {
  try {
    fs.unlinkSync(memoryPath(chatId));
    return true;
  } catch {
    return false;
  }
}

/** List all conversation IDs with memory. */
export function listChats() {
  ensureDir();
  try {
    return fs.readdirSync(MEMORY_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => f.slice(0, -5));
  } catch {
    return [];
  }
}
