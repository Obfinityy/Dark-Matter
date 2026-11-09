// Chat storage helpers + route helpers — extracted from App.jsx (P6).
// Pure localStorage / path helpers for the app shell; no React imports.
// The stale-chat wipe runs once on module load, exactly as it did from
// App.jsx.

export const CHATS_KEY = 'dm.chats';
export const CHAT_WIPE_VERSION = '2026-10-16-wipe2';
(function wipeStaleChatsOnce() {
  try {
    if (localStorage.getItem('dm.chatWipe') === CHAT_WIPE_VERSION) return;
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(CHATS_KEY)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
    // Also clear per-user deleted-chat tracking so resurrected IDs can't return.
    const delKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('dm.deleted.')) delKeys.push(k);
    }
    delKeys.forEach((k) => localStorage.removeItem(k));
    localStorage.setItem('dm.chatWipe', CHAT_WIPE_VERSION);
  } catch { /* never break app load */ }
})();

// Per-user storage key — User A's chats must NEVER be visible to User B,
// even on the same device. Logged-out state uses the legacy shared key
// only as a migration source, never as the live store.
export function chatsKeyFor(user) {
  const uid = user && (user.id || user.username);
  return uid ? `${CHATS_KEY}.${String(uid)}` : CHATS_KEY;
}

// Same key from a pre-resolved primitive identity (lets effects depend on
// the stable string instead of the user object).
export function chatsKeyForUserKey(key) {
  return key ? `${CHATS_KEY}.${String(key)}` : CHATS_KEY;
}

export const HUNTS_KEY = 'dm.hunts';

export function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* storage unavailable */ }
}

export function deriveTitle(text) {
  const t = String(text || '').trim().replace(/\s+/g, ' ');
  return t.length > 42 ? `${t.slice(0, 42)}…` : t || 'Untitled chat';
}

export function routeFromPath() {
  try {
    const p = window.location.pathname.replace(/\/+$/, '') || '/';
    if (p === '/login') return 'login';
    if (p === '/admin') return 'admin';
    if (p === '/privacy') return 'privacy';
    if (p === '/terms') return 'terms';
  } catch { /* ignore */ }
  return 'chat';
}
