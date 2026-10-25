// Dark Matter — UPI payment claims (owner order 25 Oct 2026).
//
// Simplified activation, NO gateway, NO OTP: the user pays Rs 10,000 to the
// Obfinity UPI ID from any UPI app, then submits a claim (phone, WhatsApp
// number, account details, UTR). The claim waits in the admin portal until
// the owner verifies the money arrived in his bank and activates the
// account for 1 day. If the money did not arrive he does nothing.
//
// A claim NEVER auto-activates an account: only an explicit admin Verify
// (verifyClaim) touches the user record, and only while the claim is still
// pending. Verifying twice does not extend access twice.
//
// Store discipline follows notifications.js: append-only JSON file under
// config.dataDir, atomic tmp+rename writes, bounded to the newest 500.
// UTR / phone / WhatsApp are PII: admin-only plus the owning user —
// listClaimsFor never returns another user's claim.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from './config.js';
import { UPI_AMOUNT_INR, UPI_ACCESS_DAYS } from './upiPay.js';
import { grantAccess } from './access.js';
import { readUsers, writeUsers } from './store.js';

function storePath() {
  try {
    fs.mkdirSync(config.dataDir, { recursive: true });
  } catch { /* best-effort */ }
  return path.join(config.dataDir, 'payment-claims.json');
}

function readStore() {
  try {
    const raw = fs.readFileSync(storePath(), 'utf8');
    const obj = JSON.parse(raw);
    if (obj && Array.isArray(obj.claims)) return obj;
  } catch { /* missing or corrupt -> start fresh */ }
  return { claims: [] };
}

function writeStore(obj) {
  const p = storePath();
  const tmp = `${p}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, p);
}

function cleanStr(v, max) {
  return String(v == null ? '' : v).trim().slice(0, max);
}

export class ClaimValidationError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function validateClaimInput({ amountInr, utr, phone, whatsapp, accountDetails }) {
  if (amountInr !== UPI_AMOUNT_INR) {
    throw new ClaimValidationError('bad_amount', `Amount must be exactly Rs ${UPI_AMOUNT_INR}.`);
  }
  const cleanUtr = cleanStr(utr, 100);
  if (cleanUtr.length < 3) {
    throw new ClaimValidationError('missing_utr', 'UTR number is required (from your UPI app after paying).');
  }
  const cleanPhone = cleanStr(phone, 20);
  if (!/^[+0-9][0-9 ()-]{5,19}$/.test(cleanPhone)) {
    throw new ClaimValidationError('bad_phone', 'Enter a valid phone number.');
  }
  const cleanWhatsapp = cleanStr(whatsapp, 20);
  if (!/^[+0-9][0-9 ()-]{5,19}$/.test(cleanWhatsapp)) {
    throw new ClaimValidationError('bad_whatsapp', 'Enter a valid WhatsApp number.');
  }
  const cleanDetails = cleanStr(accountDetails, 1000);
  if (cleanDetails.length < 2) {
    throw new ClaimValidationError('missing_account_details', 'Account details are required (name / bank / account hint).');
  }
  return { utr: cleanUtr, phone: cleanPhone, whatsapp: cleanWhatsapp, accountDetails: cleanDetails };
}

function publicClaim(c) {
  if (!c) return null;
  return {
    id: c.id,
    userId: c.userId,
    username: c.username,
    amountInr: c.amountInr,
    utr: c.utr,
    phone: c.phone,
    whatsapp: c.whatsapp,
    accountDetails: c.accountDetails,
    status: c.status,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt || null,
    verifiedBy: c.verifiedBy || null,
    verifiedAt: c.verifiedAt || null,
    rejectedBy: c.rejectedBy || null,
    rejectedAt: c.rejectedAt || null,
    accessUntil: c.accessUntil || null,
  };
}

/**
 * Submit a payment claim. One pending claim per user: submitting again with
 * the SAME UTR returns the existing claim (duplicate:true); submitting with
 * a DIFFERENT UTR updates the pending claim in place (the user correcting
 * a mistyped UTR) and returns it (updated:true). Returns { claim, duplicate, updated }.
 * Throws ClaimValidationError on bad input. Never activates the account.
 */
export function submitClaim({ userId, username, amountInr, utr, phone, whatsapp, accountDetails }) {
  if (!userId || !username) {
    throw new ClaimValidationError('missing_user', 'A user is required to submit a claim.');
  }
  const clean = validateClaimInput({ amountInr, utr, phone, whatsapp, accountDetails });
  const store = readStore();
  const pending = store.claims.find((c) => c.userId === String(userId) && c.status === 'pending');
  if (pending) {
    if (pending.utr === clean.utr) return { claim: publicClaim(pending), duplicate: true, updated: false };
    pending.utr = clean.utr;
    pending.phone = clean.phone;
    pending.whatsapp = clean.whatsapp;
    pending.accountDetails = clean.accountDetails;
    pending.updatedAt = new Date().toISOString();
    writeStore(store);
    return { claim: publicClaim(pending), duplicate: false, updated: true };
  }
  const claim = {
    id: crypto.randomUUID(),
    userId: String(userId),
    username: String(username),
    amountInr: UPI_AMOUNT_INR,
    utr: clean.utr,
    phone: clean.phone,
    whatsapp: clean.whatsapp,
    accountDetails: clean.accountDetails,
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: null,
    verifiedBy: null,
    verifiedAt: null,
    rejectedBy: null,
    rejectedAt: null,
    accessUntil: null,
  };
  store.claims.push(claim);
  if (store.claims.length > 500) store.claims = store.claims.slice(store.claims.length - 500);
  writeStore(store);
  return { claim: publicClaim(claim), duplicate: false, updated: false };
}

/** Claims visible to this user: admins see all (pending first), users see only their own. */
export function listClaimsFor(user) {
  try {
    const list = readStore().claims;
    const isAdmin = user && user.role === 'admin';
    const visible = isAdmin ? list : list.filter((c) => user && c.userId === user.id);
    const rank = (s) => (s === 'pending' ? 0 : s === 'verified' ? 1 : 2);
    return [...visible]
      .sort((a, b) => (rank(a.status) - rank(b.status)) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
      .map(publicClaim);
  } catch {
    return [];
  }
}

export function getClaim(id) {
  if (!id) return null;
  try {
    const found = readStore().claims.find((c) => c.id === id);
    return publicClaim(found);
  } catch {
    return null;
  }
}

function findUserRecord(userId) {
  const users = readUsers();
  const key = Object.keys(users).find((k) => users[k] && users[k].id === userId);
  return key ? { key, users, user: users[key] } : null;
}

/**
 * Admin Verify: marks a PENDING claim verified and activates the account
 * for UPI_ACCESS_DAYS from now (approved + accessUntil). Returns
 * { claim, accessUntil } or null when the claim does not exist. Verifying
 * an already-handled claim is a no-op (alreadyHandled:true) — it never
 * extends access twice. Throws when the claim's user record is missing.
 */
export function verifyClaim(id, adminUser) {
  const store = readStore();
  const claim = store.claims.find((c) => c.id === id);
  if (!claim) return null;
  if (claim.status !== 'pending') return { claim: publicClaim(claim), accessUntil: claim.accessUntil || null, alreadyHandled: true };
  const found = findUserRecord(claim.userId);
  if (!found) throw new Error('user_not_found');
  const accessUntil = grantAccess(found.user, UPI_ACCESS_DAYS);
  found.users[found.key] = found.user;
  writeUsers(found.users);
  claim.status = 'verified';
  claim.verifiedBy = (adminUser && adminUser.username) || (adminUser && adminUser.id) || 'admin';
  claim.verifiedAt = new Date().toISOString();
  claim.accessUntil = accessUntil;
  claim.updatedAt = claim.verifiedAt;
  writeStore(store);
  return { claim: publicClaim(claim), accessUntil, alreadyHandled: false };
}

/**
 * Admin Reject: marks a PENDING claim rejected. No user record is touched —
 * the account stays exactly as it was. Returns { claim } or null when the
 * claim does not exist; rejecting an already-handled claim is a no-op
 * (alreadyHandled:true).
 */
export function rejectClaim(id, adminUser) {
  const store = readStore();
  const claim = store.claims.find((c) => c.id === id);
  if (!claim) return null;
  if (claim.status !== 'pending') return { claim: publicClaim(claim), alreadyHandled: true };
  claim.status = 'rejected';
  claim.rejectedBy = (adminUser && adminUser.username) || (adminUser && adminUser.id) || 'admin';
  claim.rejectedAt = new Date().toISOString();
  claim.updatedAt = claim.rejectedAt;
  writeStore(store);
  return { claim: publicClaim(claim), alreadyHandled: false };
}
