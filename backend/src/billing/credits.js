// Dark Matter — per-user credit ledger (USD).
//
// Top-ups add credits; each hunt iteration deducts a small amount based on
// hunt mode. When the balance can't cover the next iteration, the running
// hunt auto-pauses (state: out_of_credits) and resumes after a top-up.
//
// Storage: credits.json under DATA_DIR: { [userId]: { balanceUsd, txns: [...] } }
// Money is stored as integer CENTS to avoid float drift.

import path from 'node:path';
import { dataDir } from '../store.js';
import fs from 'node:fs';

function creditsFile() {
  return path.join(dataDir(), 'credits.json');
}

function creditsBackupFile() {
  return path.join(dataDir(), 'credits.bak.json');
}

function parseCredits(raw) {
  const data = JSON.parse(raw);
  if (!data || typeof data !== 'object') throw new Error('bad credits shape');
  return data;
}

function readAll() {
  // Missing file = first run, not corruption.
  let mainRaw = null;
  try { mainRaw = fs.readFileSync(creditsFile(), 'utf8'); } catch { mainRaw = null; }
  if (mainRaw !== null) {
    try { return parseCredits(mainRaw); } catch { /* corrupt main: try backup */ }
  }
  // Corrupt main: fall back to the previous-good backup, so the next
  // write never wipes real balances (#344, same class as #328).
  try {
    const bakRaw = fs.readFileSync(creditsBackupFile(), 'utf8');
    return parseCredits(bakRaw);
  } catch { /* no usable backup */ }
  if (mainRaw !== null) {
    // Corrupt main AND no usable backup: true data loss. Never
    // silently return {} — callers must fail loudly, not overwrite.
    throw new Error('credits store unreadable: main corrupt, no usable backup');
  }
  return {};
}

function writeAll(data) {
  fs.mkdirSync(path.dirname(creditsFile()), { recursive: true });
  // Rotate first: the previous good main becomes the backup BEFORE the
  // new main lands, so a crash mid-write can never leave both corrupt.
  try {
    if (fs.existsSync(creditsFile())) fs.renameSync(creditsFile(), creditsBackupFile());
  } catch { /* rotation is best-effort; the atomic write below still lands */ }
  const tmp = `${creditsFile()}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, creditsFile());
}

function entryFor(all, userId) {
  if (!all[userId]) all[userId] = { balanceCents: 0, txns: [] };
  return all[userId];
}

/** Balance in dollars (float, 2dp). For DISPLAY only — never compare
 *  it against integer cents: `balanceUsd * 100` miscompares for 573
 *  of 10000 cent values (e.g. 29/100*100 = 28.999999999999996, #336).
 *  Use getBalanceCents for every affordability check. */
export function getBalanceUsd(userId) {
  if (!userId) return 0;
  const all = readAll();
  const e = all[userId];
  return e ? e.balanceCents / 100 : 0;
}

/** Balance in integer cents — the ONLY value affordability checks
 *  may compare against integer-cent prices (#336). The ledger
 *  already stores integer cents; this avoids the dollars round-trip. */
export function getBalanceCents(userId) {
  if (!userId) return 0;
  const all = readAll();
  const e = all[userId];
  return e ? e.balanceCents : 0;
}

/** Add credits. Returns new balance (USD). */
export function addCreditsUsd(userId, amountCents, meta = {}) {
  const cents = Math.round(amountCents);
  if (!userId || !Number.isFinite(cents) || cents <= 0) throw new Error('Invalid credit amount.');
  const all = readAll();
  const e = entryFor(all, userId);
  e.balanceCents += cents;
  e.txns.push({ ts: new Date().toISOString(), type: 'topup', cents, ...meta });
  e.txns = e.txns.slice(-200); // keep the ledger bounded
  writeAll(all);
  return e.balanceCents / 100;
}

/**
 * Deduct credits for hunt usage. Returns true if deducted, false if the
 * balance is insufficient (caller should pause the hunt).
 */
export function deductCreditsUsd(userId, amountCents, meta = {}) {
  const cents = Math.round(amountCents);
  if (!userId || !Number.isFinite(cents) || cents <= 0) return false;
  let all;
  try {
    all = readAll();
  } catch {
    // #344: a totally unreadable ledger must pause the hunt (false),
    // not crash the loop with a throw — and never wipe the ledger.
    return false;
  }
  const e = entryFor(all, userId);
  if (e.balanceCents < cents) return false;
  e.balanceCents -= cents;
  e.txns.push({ ts: new Date().toISOString(), type: 'hunt_spend', cents: -cents, ...meta });
  e.txns = e.txns.slice(-200);
  writeAll(all);
  return true;
}

/** Recent ledger entries for the UI (newest first). */
export function recentTxns(userId, limit = 20) {
  if (!userId) return [];
  const all = readAll();
  const e = all[userId];
  if (!e) return [];
  return e.txns.slice(-limit).reverse();
}
