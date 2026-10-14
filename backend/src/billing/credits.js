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

function readAll() {
  try {
    const raw = fs.readFileSync(creditsFile(), 'utf8');
    const data = JSON.parse(raw);
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

function writeAll(data) {
  fs.mkdirSync(path.dirname(creditsFile()), { recursive: true });
  const tmp = `${creditsFile()}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, creditsFile());
}

function entryFor(all, userId) {
  if (!all[userId]) all[userId] = { balanceCents: 0, txns: [] };
  return all[userId];
}

/** Balance in dollars (float, 2dp). */
export function getBalanceUsd(userId) {
  if (!userId) return 0;
  const all = readAll();
  const e = all[userId];
  return e ? e.balanceCents / 100 : 0;
}

/** Add credits after a verified Razorpay payment. Returns new balance (USD). */
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
  const all = readAll();
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
