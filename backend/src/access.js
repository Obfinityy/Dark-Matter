// Dark Matter — paid access window (UPI activation, owner order 25 Oct 2026).
//
// A Rs 10,000 UPI payment buys ONE DAY of account access, counted from the
// moment the admin verifies the claim. The window lives on the user record
// as `accessUntil` (ISO timestamp). While the window is active the user can
// hunt without spending credits — the day is already paid for. When it
// lapses, the normal credit rules resume (and the user pays again to renew).
//
// The free verification path (admin approve) does NOT set a window: an
// approved user without a window still needs credits to hunt, exactly as
// before. Only a verified payment claim grants a window.

import { readUsers, writeUsers } from './store.js';

export const ACCESS_DAY_MS = 24 * 3600 * 1000;

/** True when the user's access window exists and has not lapsed. */
export function hasActiveAccess(userRecord) {
  if (!userRecord || !userRecord.accessUntil) return false;
  const until = new Date(userRecord.accessUntil).getTime();
  return Number.isFinite(until) && until > Date.now();
}

/** Same check by user id (reads the user store). */
export function hasActiveAccessById(userId) {
  if (!userId) return false;
  try {
    const users = readUsers();
    const user = Object.values(users).find((u) => u && u.id === userId);
    return hasActiveAccess(user);
  } catch {
    return false;
  }
}

/**
 * Grant (or renew) an access window: approves the account and sets
 * accessUntil. Returns the new accessUntil ISO string.
 * Callers must persist via writeUsers — this helper mutates the record
 * object in place and returns it; it does NOT write the store itself,
 * so tests can assert the mutation without touching the file.
 * FIX (#345): renewals STACK onto a still-active window instead of
 * discarding it — a user with 20h left who pays again keeps those 20h
 * plus the new days. An expired (or invalid) window restarts from now.
 */
export function grantAccess(userRecord, days = 1) {
  if (!userRecord) throw new Error('No user record to activate.');
  const n = Number(days);
  if (!Number.isFinite(n) || n <= 0) throw new Error('Access days must be positive.');
  const existing = new Date(userRecord.accessUntil || 0).getTime();
  const base = Number.isFinite(existing) && existing > Date.now() ? existing : Date.now();
  const until = new Date(base + n * ACCESS_DAY_MS).toISOString();
  userRecord.approved = true;
  userRecord.approvedAt = new Date().toISOString();
  userRecord.accessUntil = until;
  return until;
}

/** Convenience: grant + persist. Returns the new accessUntil ISO string. */
export function grantAccessPersisted(userRecord, days = 1) {
  const until = grantAccess(userRecord, days);
  const users = readUsers();
  const key = Object.keys(users).find((k) => users[k] && users[k].id === userRecord.id);
  if (key) {
    users[key] = userRecord;
    writeUsers(users);
  }
  return until;
}
