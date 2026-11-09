// Dark Matter — Razorpay order records (issue #491).
//
// One record per Razorpay order created from the pay page. It is the link
// between a Razorpay payment and the Dark Matter account it activates:
// the webhook (and the polling fallback) look the order up here to find
// the paying user, and the record is the idempotency key — a payment id
// that is already marked paid never activates twice.
//
// Store discipline follows paymentClaims.js: JSON file under
// config.dataDir, atomic tmp+rename writes, bounded to the newest 500.
// The record holds no secrets and no card/UPI details — only ids.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from './config.js';
import { grantAccess } from './access.js';
import { readUsers, writeUsers } from './store.js';
import { notifyAccount } from './notifications.js';
import { RAZORPAY_ACCESS_DAYS } from './razorpayClient.js';

function storePath() {
  try {
    fs.mkdirSync(config.dataDir, { recursive: true });
  } catch { /* best-effort */ }
  return path.join(config.dataDir, 'razorpay-orders.json');
}

function readStore() {
  try {
    const raw = fs.readFileSync(storePath(), 'utf8');
    const obj = JSON.parse(raw);
    if (obj && Array.isArray(obj.orders)) return obj;
  } catch { /* missing or corrupt -> start fresh */ }
  return { orders: [] };
}

function writeStore(obj) {
  const p = storePath();
  const tmp = `${p}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, p);
}

function publicOrder(r) {
  if (!r) return null;
  return {
    id: r.id,
    orderId: r.orderId,
    userId: r.userId,
    username: r.username,
    amountPaise: r.amountPaise,
    currency: r.currency,
    receipt: r.receipt || null,
    status: r.status,
    paymentId: r.paymentId || null,
    accessUntil: r.accessUntil || null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt || null,
  };
}

/** Create a record for a Razorpay order just created via the Orders API. */
export function createOrderRecord({ userId, username, orderId, amountPaise, currency, receipt }) {
  const store = readStore();
  const rec = {
    id: crypto.randomUUID(),
    orderId: String(orderId),
    userId: String(userId),
    username: String(username),
    amountPaise,
    currency,
    receipt: receipt || null,
    status: 'created',
    paymentId: null,
    accessUntil: null,
    createdAt: new Date().toISOString(),
    updatedAt: null,
  };
  store.orders.push(rec);
  if (store.orders.length > 500) store.orders = store.orders.slice(store.orders.length - 500);
  writeStore(store);
  return publicOrder(rec);
}

/** Find an order record by its Razorpay order id, or null. */
export function findOrderByRazorpayId(orderId) {
  if (!orderId) return null;
  try {
    const found = readStore().orders.find((o) => o.orderId === String(orderId));
    return publicOrder(found);
  } catch {
    return null;
  }
}

/**
 * Mark an order failed (e.g. Razorpay `payment.failed`). A paid order is
 * never un-paid: marking a paid order failed is a no-op returning it.
 * Returns the record or null when the order is unknown.
 */
export function markOrderFailed(orderId) {
  const store = readStore();
  const rec = store.orders.find((o) => o.orderId === String(orderId));
  if (!rec) return null;
  if (rec.status === 'paid') return publicOrder(rec);
  rec.status = 'failed';
  rec.updatedAt = new Date().toISOString();
  writeStore(store);
  return publicOrder(rec);
}

/**
 * Activate the paying user's account for one day, from a verified
 * Razorpay payment. This is THE activation path for gateway payments —
 * the same mechanism as the admin Verify (`grantAccess`, 1 day from now),
 * so a gateway payment and a manual UPI verification produce the exact
 * same access window.
 *
 * Idempotent on the payment id: a second call with the same payment id
 * returns the first activation unchanged (alreadyHandled: true) and never
 * extends access. A different payment id on an already-paid order throws
 * (one order = one payment). Throws `order_not_found` when the order is
 * unknown and `user_not_found` when the user record is gone.
 */
export function activateOrderPayment(orderId, paymentId) {
  const store = readStore();
  const rec = store.orders.find((o) => o.orderId === String(orderId));
  if (!rec) throw new Error('order_not_found');
  if (rec.status === 'paid') {
    if (rec.paymentId === String(paymentId)) {
      return { record: publicOrder(rec), accessUntil: rec.accessUntil, alreadyHandled: true };
    }
    throw new Error('order_already_paid_by_another_payment');
  }
  const users = readUsers();
  const key = Object.keys(users).find((k) => users[k] && users[k].id === rec.userId);
  if (!key) throw new Error('user_not_found');
  const user = users[key];
  const accessUntil = grantAccess(user, RAZORPAY_ACCESS_DAYS);
  users[key] = user;
  writeUsers(users);
  rec.status = 'paid';
  rec.paymentId = String(paymentId);
  rec.accessUntil = accessUntil;
  rec.updatedAt = new Date().toISOString();
  writeStore(store);
  // Best-effort in-app notification (same bell as the admin Verify path).
  try {
    const until = new Date(accessUntil).toLocaleString('en-GB', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
    notifyAccount({
      ownerId: rec.userId,
      title: `Account activated — access until ${until}`,
      kind: 'activation',
    });
  } catch { /* activation already happened; notification is best-effort */ }
  return { record: publicOrder(rec), accessUntil, alreadyHandled: false };
}
