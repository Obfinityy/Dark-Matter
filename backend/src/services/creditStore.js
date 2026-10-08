/**
 * creditStore — Infinity Credits wallet, local-first.
 *
 * Owner rule: no MongoDB for credit balances. Balances live in a JSON file
 * on the backend host (`backend/data/credits.json`, gitignored), loaded once
 * into an in-memory map and written back atomically (temp file + rename) on
 * every change.
 *
 * Concurrency: the backend runs as a single Node process, so a synchronous
 * read-modify-write is safe. When Cloud mode ships (multi-instance backend +
 * per-minute metering), move this to durable storage (database) instead.
 */
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_FILE = path.resolve(
  process.env.CREDITS_DATA_FILE ||
    path.join(process.cwd(), 'data', 'credits.json')
);

function loadFromFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const balances = new Map();
      for (const [userId, paise] of Object.entries(parsed.balances || {})) {
        if (typeof paise === 'number' && Number.isInteger(paise) && paise >= 0) {
          balances.set(userId, paise);
        }
      }
      return balances;
    }
  } catch {
    // Missing or corrupt file — start empty.
  }
  return new Map();
}

/**
 * @param {{ filePath?: string }} [opts]
 */
export function createCreditStore({ filePath = DEFAULT_FILE } = {}) {
  let balances = loadFromFile(filePath);

  /** Atomic write: temp file + rename so a crash never leaves a half-written file. */
  function persist() {
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
    const tmp = `${filePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ balances: Object.fromEntries(balances) }));
    fs.renameSync(tmp, filePath);
  }

  return {
    /** Balance in INR (two-decimal number). */
    getBalanceInr(userId) {
      const id = String(userId || 'anonymous');
      return (balances.get(id) || 0) / 100;
    },

    /**
     * Add credits (INR, any positive number) and persist. Returns the new
     * balance in INR. Balances are tracked in integer paise to avoid
     * floating-point drift.
     */
    addCreditsInr(userId, amountInr) {
      const id = String(userId || 'anonymous');
      if (typeof amountInr !== 'number' || !Number.isFinite(amountInr) || amountInr <= 0) {
        throw new Error('Invalid credit amount');
      }
      const paise = Math.round(amountInr * 100);
      balances.set(id, (balances.get(id) || 0) + paise);
      persist();
      return this.getBalanceInr(id);
    },

    /** Reload balances from disk (picks up edits made by another process). */
    reload() {
      balances = loadFromFile(filePath);
    },
  };
}

/** Default singleton used by the billing controller. */
export const creditStore = createCreditStore();
