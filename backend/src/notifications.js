// Dark Matter — INSTANT FINDING NOTIFICATIONS (owner order 24 Oct 2026,
// full-human vision: on ANY verified finding, the account user AND the
// admin must know instantly — the 15-minute poll monitor is only a backup).
//
// Design notes:
// - ONE record per vulnerability, not per recipient. A record carries the
//   hunt's ownerId; at read time the owner sees their own hunts' records
//   and admins (role 'admin') see every record. No fan-out, no admin
//   list needed at write time, and a read by one person never clears
//   another's unread state (readBy is per user id).
// - Dedupe key is (huntId, title): a re-proof of an already-notified
//   title does NOT re-alert. The pipeline already dedupes its display by
//   title (panelFindings), so this matches what the user sees.
// - PoC confirmations ("PoC confirmed: X") are deliberately NOT separate
//   notifications: they confirm the SAME vulnerability whose verified
//   finding already notified. The live HuntCard already shows the PoC
//   confirmation to anyone watching that hunt.
// - Only verified findings notify. Unverified claims, curiosity queue
//   entries and retractions never reach this module (callers gate on
//   verified === true), per the 100% truth rule.
// - Best-effort throughout: a notification failure must never break a
//   hunt iteration or a verification. Callers wrap in try/catch AND this
//   module never throws (notifyFinding swallows store errors).

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from './config.js';

function storePath() {
  try {
    fs.mkdirSync(config.dataDir, { recursive: true });
  } catch { /* best-effort */ }
  return path.join(config.dataDir, 'notifications.json');
}

function readStore() {
  try {
    const raw = fs.readFileSync(storePath(), 'utf8');
    const obj = JSON.parse(raw);
    if (obj && Array.isArray(obj.notifications)) return obj;
  } catch { /* missing or corrupt -> start fresh */ }
  return { notifications: [] };
}

function writeStore(obj) {
  const p = storePath();
  const tmp = `${p}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, p);
}

/**
 * Record an instant notification for a verified finding.
 * Returns the record (new or the existing duplicate). Never throws.
 */
export function notifyFinding({ huntId, ownerId, title, severity, target }) {
  try {
    if (!huntId || !title) return null;
    const store = readStore();
    const list = store.notifications;
    const dup = list.find((n) => n.huntId === huntId && n.title === title);
    if (dup) return dup;
    const rec = {
      id: crypto.randomUUID(),
      huntId: String(huntId),
      ownerId: ownerId ? String(ownerId) : null,
      title: String(title).slice(0, 300),
      severity: severity || 'medium',
      target: target ? String(target).slice(0, 300) : null,
      createdAt: new Date().toISOString(),
      readBy: [],
    };
    list.push(rec);
    // Bound the file: keep the newest 500 (oldest drop first).
    if (list.length > 500) store.notifications = list.slice(list.length - 500);
    writeStore(store);
    return rec;
  } catch {
    return null;
  }
}

/** Notifications visible to this user, newest first. */
export function listNotificationsFor(user) {
  try {
    const list = readStore().notifications;
    const isAdmin = user && user.role === 'admin';
    const visible = isAdmin
      ? list
      : list.filter((n) => n.ownerId && user && n.ownerId === user.id);
    return [...visible].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  } catch {
    return [];
  }
}

/** Mark one notification read for one user (idempotent). Returns true if found+visible. */
export function markNotificationRead(id, user) {
  try {
    if (!id || !user) return false;
    const store = readStore();
    const rec = store.notifications.find((n) => n.id === id);
    if (!rec) return false;
    const isAdmin = user.role === 'admin';
    if (!isAdmin && !(rec.ownerId && rec.ownerId === user.id)) return false;
    if (!rec.readBy.includes(user.id)) {
      rec.readBy.push(user.id);
      writeStore(store);
    }
    return true;
  } catch {
    return false;
  }
}

export function unreadCountFor(user) {
  try {
    return listNotificationsFor(user).filter((n) => !(n.readBy || []).includes(user.id)).length;
  } catch {
    return 0;
  }
}
