/**
 * chatHistory — local record of Infinity AI conversations.
 *
 * The frontend generates one conversationId per Infinity AI session
 * (the backend creates the conversation on the first message). This
 * service keeps a lightweight local index so the sidebar can show
 * "chat history" and reopen / resume past conversations.
 *
 * Contract:
 *   recordConversation({ id, mode, title? }) — upsert; newest first; capped at 30.
 *   listConversations() → [{ id, mode, title, createdAt }]
 *   getConversation(id) → entry | null
 *   removeConversation(id)
 */
const STORAGE_KEY = 'dm.infinite.conversations';
const MAX_ENTRIES = 30;

function readAll() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeAll(list) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_ENTRIES)));
  } catch {
    /* storage unavailable */
  }
  // Notify the sidebar (same tab — the 'storage' event only fires cross-tab).
  try {
    window.dispatchEvent(new CustomEvent('dm:conversations-changed'));
  } catch {
    /* non-DOM environment */
  }
}

export const CONVERSATIONS_CHANGED_EVENT = 'dm:conversations-changed';

export function listConversations() {
  return readAll();
}

export function getConversation(id) {
  return readAll().find(c => c.id === id) || null;
}

export function recordConversation({ id, mode, title }) {
  if (!id) return null;
  const now = new Date().toISOString();
  const list = readAll().filter(c => c.id !== id);
  const existing = readAll().find(c => c.id === id);
  const entry = {
    id,
    mode: mode || 'chat',
    title: title || existing?.title || 'New chat',
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  writeAll([entry, ...list]);
  return entry;
}

export function removeConversation(id) {
  writeAll(readAll().filter(c => c.id !== id));
}

export function clearConversations() {
  writeAll([]);
}
