/**
 * processedPaymentsStore — idempotency ledger for top-up verifications.
 *
 * Security: a verified {orderId, paymentId, signature} tuple must never
 * credit the wallet twice. Replaying a successful POST /billing/topup/verify
 * is a classic replay attack that mints unlimited free credits. This ledger
 * records every paymentId that has already been credited; duplicates are
 * rejected (idempotent 200) before any credit is applied.
 *
 * Persistence follows the creditStore pattern: a JSON file on the backend
 * host (`backend/data/processed-payments.json`, gitignored), loaded once into
 * an in-memory map and written back atomically (temp file + rename).
 */
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_FILE = path.resolve(
  process.env.PROCESSED_PAYMENTS_FILE ||
    path.join(process.cwd(), 'data', 'processed-payments.json')
);

/** Cap the ledger so the JSON file stays small; oldest entries evict first. */
const MAX_ENTRIES = 10000;

function loadFromFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const payments = new Map();
      for (const [paymentId, record] of Object.entries(parsed.payments || {})) {
        if (record && typeof record === 'object') payments.set(paymentId, record);
      }
      return payments;
    }
  } catch {
    // Missing or corrupt file — start empty.
  }
  return new Map();
}

/**
 * @param {{ filePath?: string }} [opts]
 */
export function createProcessedPaymentsStore({ filePath = DEFAULT_FILE } = {}) {
  let payments = loadFromFile(filePath);

  /** Atomic write: temp file + rename so a crash never leaves a half-written file. */
  function persist() {
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
    const tmp = `${filePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ payments: Object.fromEntries(payments) }));
    fs.renameSync(tmp, filePath);
  }

  return {
    /** True when this paymentId has already been credited. */
    has(paymentId) {
      return payments.has(String(paymentId));
    },

    /** The stored record for a processed paymentId, or null. */
    get(paymentId) {
      return payments.get(String(paymentId)) || null;
    },

    /**
     * Record a paymentId as processed. Returns false when it was already
     * recorded (caller should treat the request as a duplicate).
     */
    add(paymentId, record = {}) {
      const id = String(paymentId);
      if (!id || payments.has(id)) return false;
      payments.set(id, { at: new Date().toISOString(), ...record });
      while (payments.size > MAX_ENTRIES) {
        payments.delete(payments.keys().next().value);
      }
      persist();
      return true;
    },

    /** Reload from disk (picks up edits made by another process). */
    reload() {
      payments = loadFromFile(filePath);
    },
  };
}

/** Default singleton used by the billing controller. */
export const processedPaymentsStore = createProcessedPaymentsStore();
