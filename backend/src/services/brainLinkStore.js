/**
 * brainLinkStore — per-account Kaggle brain links, encrypted at rest.
 *
 * Owner's architecture: the user pastes their 3 Kaggle Gradio links once in
 * the Models page; they are saved against their ACCOUNT (not just the
 * browser) so the agent machine (dedicated box / Oracle free-tier VM) can
 * fetch them 24/7 without the browser open.
 *
 * SECURITY: Gradio share URLs are bearer tokens — whoever holds the URL can
 * use the GPU. URLs are encrypted at rest with AES-256-GCM using the server
 * key from `BRAIN_LINKS_KEY` (32 bytes, hex or base64). The key NEVER leaves
 * the backend, URLs are never logged, and only the owning user (or their
 * agent poller presenting their token) can read them.
 *
 * Storage (owner order, 8 Oct 2026): MongoDB collection `brain_links`, one
 * document per user (`{ userId, slots: { [slot]: { urlEnc, name, updatedAt } } }`).
 * The legacy JSON file (`backend/data/brain-links.json`, gitignored) remains
 * as a runtime fallback: if Mongo is unreachable an operation degrades to the
 * file store with a warning instead of crashing. On first read, when Mongo
 * has no document for a user but the file does, the file's data is imported
 * into Mongo once (best-effort).
 *
 * If BRAIN_LINKS_KEY is unset, the key is derived from JWT_SECRET via
 * HKDF-SHA256 (stable across restarts, zero extra config). Only when neither
 * secret is set does it fall back to an ephemeral key with a loud warning —
 * links will NOT survive a restart in that mode. Set BRAIN_LINKS_KEY
 * explicitly in production for the strongest posture (see backend/.env.example).
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_FILE = path.resolve(
  process.env.BRAIN_LINKS_FILE || path.join(process.cwd(), 'data', 'brain-links.json')
);

/** Mongo collection holding one document per user. */
export const BRAIN_LINKS_COLLECTION = 'brain_links';

export const VALID_BRAIN_SLOTS = ['vision', 'grounding', 'hacker'];

/** Resolve the 32-byte AES key.
 *
 * Priority:
 *  1. BRAIN_LINKS_KEY env (64-char hex or 44-char base64) — explicit, best.
 *  2. Derived from JWT_SECRET via HKDF-SHA256 — stable across restarts with
 *     zero extra env vars. The derivation keeps this encryption key
 *     cryptographically separate from the JWT signing key.
 *  3. Ephemeral random key — loud warning; saved links will NOT survive a
 *     restart. Only when neither secret is set (in which case auth sessions
 *     are broken too).
 *
 * Note: every store instance derives the SAME key from the same inputs, so
 * the file-backed and Mongo-backed stores stay mutually readable (the old
 * ephemeral path gave each instance a different random key).
 */
function resolveKey() {
  const raw = (process.env.BRAIN_LINKS_KEY || '').trim();
  if (raw) {
    // Accept hex (64 chars) or base64 (44 chars) encodings.
    let buf = null;
    if (/^[0-9a-fA-F]{64}$/.test(raw)) buf = Buffer.from(raw, 'hex');
    else {
      try {
        buf = Buffer.from(raw, 'base64');
      } catch {
        buf = null;
      }
    }
    if (buf && buf.length === 32) return { key: buf, ephemeral: false, source: 'env' };
    console.warn(
      '[brain-links] BRAIN_LINKS_KEY is set but is not 32 bytes (hex/base64) — trying JWT_SECRET fallback.'
    );
  }
  const jwtSecret = (process.env.JWT_SECRET || '').trim();
  if (jwtSecret) {
    const key = crypto.hkdfSync(
      'sha256',
      Buffer.from(jwtSecret, 'utf8'),
      'dark-matter-brain-links-v1',
      '',
      32
    );
    return { key, ephemeral: false, source: 'jwt-secret' };
  }
  console.warn(
    '[brain-links] No BRAIN_LINKS_KEY or JWT_SECRET set — using an ephemeral key. ' +
      'Saved links will NOT survive a restart. Set BRAIN_LINKS_KEY (or JWT_SECRET) to fix this.'
  );
  return { key: crypto.randomBytes(32), ephemeral: true, source: 'ephemeral' };
}

/** AES-256-GCM encrypt. Returns "iv:tag:ciphertext" (hex). */
function encrypt(key, plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${ciphertext.toString('hex')}`;
}

/** AES-256-GCM decrypt. Returns plaintext or null on failure. */
function decrypt(key, packed) {
  try {
    const [ivHex, tagHex, ctHex] = String(packed || '').split(':');
    if (!ivHex || !tagHex || !ctHex) return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ctHex, 'hex')),
      decipher.final(),
    ]);
    return plaintext.toString('utf8');
  } catch {
    return null; // Wrong key or corrupted data — never throw the URL around.
  }
}

function loadFromFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch {
    // Missing or corrupt — start empty.
  }
  return {};
}

function validUrl(url) {
  return typeof url === 'string' && /^https?:\/\/.+/i.test(url.trim());
}

/**
 * Validate a save payload and build encrypted slot changes.
 * Returns { [slot]: { urlEnc, name, updatedAt } | null } — null means "delete this slot".
 * Throws on invalid payload / invalid URL (before anything is written).
 */
function buildSlotChanges(key, links) {
  if (!links || typeof links !== 'object' || Array.isArray(links)) {
    throw new Error('Invalid links payload');
  }
  const changes = {};
  for (const [slot, entry] of Object.entries(links)) {
    if (!VALID_BRAIN_SLOTS.includes(slot)) continue;
    if (entry == null) {
      changes[slot] = null;
      continue;
    }
    const url = String(entry.url || '').trim();
    if (!validUrl(url)) throw new Error(`Invalid URL for brain slot "${slot}"`);
    changes[slot] = {
      urlEnc: encrypt(key, url),
      name: String(entry.name || '').trim().slice(0, 120) || null,
      updatedAt: new Date().toISOString(),
    };
  }
  return changes;
}

/** Decrypt a slots map into { slot: { url, name, updatedAt } }. */
function decryptSlots(key, slots) {
  const out = {};
  for (const slot of VALID_BRAIN_SLOTS) {
    const entry = (slots || {})[slot];
    if (!entry || !entry.urlEnc) continue;
    const url = decrypt(key, entry.urlEnc);
    if (!url) continue; // Undecryptable (key rotated?) — skip silently.
    out[slot] = { url, name: entry.name || null, updatedAt: entry.updatedAt || null };
  }
  return out;
}

/**
 * File-backed store (legacy). Kept as the runtime fallback when Mongo is
 * unreachable, and as the migration source for the Mongo store.
 * @param {{ filePath?: string }} [opts]
 */
export function createBrainLinkStore({ filePath = DEFAULT_FILE } = {}) {
  const { key, ephemeral, source: keySource } = resolveKey();
  let data = loadFromFile(filePath); // { userId: { slot: { urlEnc, name, updatedAt } } }

  function persist() {
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
    const tmp = `${filePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, filePath);
  }

  /** Decrypt a user's stored slots into { slot: { url, name, updatedAt } }. */
  function readUser(userId) {
    const id = String(userId || 'anonymous');
    return decryptSlots(key, data[id] || {});
  }

  return {
    /** Whether the encryption key is ephemeral (dev warning surface). */
    isEphemeralKey: ephemeral,
    /** Where the key came from: 'env' | 'jwt-secret' | 'ephemeral'. */
    keySource,

    /** All decrypted brain links for a user: { slot: { url, name, updatedAt } }. */
    getLinks(userId) {
      return readUser(userId);
    },

    /**
     * Save brain links for a user. `links` is { slot: { url, name? } }.
     * Only VALID_BRAIN_SLOTS are accepted; invalid URLs throw.
     * Returns the decrypted saved links.
     */
    saveLinks(userId, links) {
      const id = String(userId || 'anonymous');
      const changes = buildSlotChanges(key, links);
      const userSlots = { ...(data[id] || {}) };
      let changed = false;
      for (const [slot, change] of Object.entries(changes)) {
        if (change === null) {
          if (userSlots[slot]) {
            delete userSlots[slot];
            changed = true;
          }
          continue;
        }
        userSlots[slot] = change;
        changed = true;
      }
      if (changed) {
        data[id] = userSlots;
        persist();
      }
      return readUser(userId);
    },

    /** Delete one slot's link for a user. Returns true if something was removed. */
    deleteSlot(userId, slot) {
      const id = String(userId || 'anonymous');
      if (!VALID_BRAIN_SLOTS.includes(slot)) throw new Error(`Unknown brain slot "${slot}"`);
      const userSlots = data[id] || {};
      if (!userSlots[slot]) return false;
      delete userSlots[slot];
      data[id] = userSlots;
      persist();
      return true;
    },

    /** Reload from disk (picks up edits made by another process). */
    reload() {
      data = loadFromFile(filePath);
    },
  };
}

/**
 * Mongo-backed store (owner order, 8 Oct 2026): one document per user in the
 * `brain_links` collection. URLs are stored only as AES-256-GCM ciphertext.
 *
 * - Same REST-facing semantics as the file store (validation, null-deletes).
 * - If Mongo is unreachable at runtime, every operation falls back to the
 *   file store and logs a warning — the backend never crashes for this.
 * - On first read, when Mongo has no document for the user but the file
 *   store does, the file's slots are imported into Mongo once (best-effort).
 *
 * All methods are async. `database` is the app's MongoDatabase/MemoryDatabase
 * (both expose `.collection(name)`).
 */
export function createMongoBrainLinkStore({ database = null, filePath = DEFAULT_FILE } = {}) {
  const { key, ephemeral, source: keySource } = resolveKey();
  const fallback = createBrainLinkStore({ filePath });
  let mongoHealthy = true;
  let indexEnsured = false;

  function collection() {
    if (!database) return null;
    try {
      return database.collection(BRAIN_LINKS_COLLECTION);
    } catch {
      return null;
    }
  }

  function markDown(err) {
    if (mongoHealthy) {
      mongoHealthy = false;
      console.warn(
        '[brain-links] Mongo unavailable — using local JSON fallback:',
        err?.message || String(err)
      );
    }
  }

  function markUp() {
    if (!mongoHealthy) {
      mongoHealthy = true;
      console.warn('[brain-links] Mongo recovered — resuming Mongo-backed storage.');
    }
  }

  async function ensureIndex(coll) {
    if (indexEnsured) return;
    try {
      await coll.createIndex({ userId: 1 }, { unique: true });
      indexEnsured = true;
    } catch {
      // Best-effort; the unique index is also created by MongoDatabase.init().
    }
  }

  /**
   * One-time migration: if Mongo has no document for the user but the file
   * store does, import the file's slots into Mongo. Best-effort, never throws.
   */
  async function maybeMigrate(coll, userId) {
    try {
      const existing = await coll.findOne({ userId });
      if (existing && existing.slots && Object.keys(existing.slots).length > 0) return;
      const fileLinks = fallback.getLinks(userId);
      const entries = Object.entries(fileLinks);
      if (entries.length === 0) return;
      const changes = buildSlotChanges(
        key,
        Object.fromEntries(entries.map(([slot, { url, name }]) => [slot, { url, name }]))
      );
      const slots = {};
      for (const [slot, change] of Object.entries(changes)) {
        if (change !== null) slots[slot] = change;
      }
      if (Object.keys(slots).length === 0) return;
      await coll.updateOne(
        { userId },
        { $set: { slots, updatedAt: new Date().toISOString() } },
        { upsert: true }
      );
      console.warn(`[brain-links] migrated ${Object.keys(slots).length} slot(s) for a user into Mongo`);
    } catch {
      // Best-effort migration — a later read retries it.
    }
  }

  async function readSlots(coll, userId) {
    const doc = await coll.findOne({ userId });
    return doc?.slots || {};
  }

  return {
    /** Whether the encryption key is ephemeral (dev warning surface). */
    isEphemeralKey: ephemeral,
    /** Where the key came from: 'env' | 'jwt-secret' | 'ephemeral'. */
    keySource,

    /** All decrypted brain links for a user: { slot: { url, name, updatedAt } }. */
    async getLinks(userId) {
      const id = String(userId || 'anonymous');
      const coll = collection();
      if (!coll) {
        markDown(new Error('no database handle'));
        return fallback.getLinks(id);
      }
      try {
        await ensureIndex(coll);
        await maybeMigrate(coll, id);
        markUp();
        return decryptSlots(key, await readSlots(coll, id));
      } catch (err) {
        markDown(err);
        return fallback.getLinks(id);
      }
    },

    /**
     * Save brain links for a user. `links` is { slot: { url, name? } }.
     * Only VALID_BRAIN_SLOTS are accepted; invalid URLs throw.
     * Returns the decrypted saved links.
     */
    async saveLinks(userId, links) {
      const id = String(userId || 'anonymous');
      const changes = buildSlotChanges(key, links); // throws before any write
      const coll = collection();
      if (!coll) {
        markDown(new Error('no database handle'));
        return fallback.saveLinks(id, links);
      }
      try {
        await ensureIndex(coll);
        await maybeMigrate(coll, id);
        const slots = { ...(await readSlots(coll, id)) };
        let changed = false;
        for (const [slot, change] of Object.entries(changes)) {
          if (change === null) {
            if (slots[slot]) {
              delete slots[slot];
              changed = true;
            }
            continue;
          }
          slots[slot] = change;
          changed = true;
        }
        if (changed) {
          await coll.updateOne(
            { userId: id },
            { $set: { slots, updatedAt: new Date().toISOString() } },
            { upsert: true }
          );
        }
        markUp();
        return decryptSlots(key, slots);
      } catch (err) {
        markDown(err);
        return fallback.saveLinks(id, links);
      }
    },

    /** Delete one slot's link for a user. Returns true if something was removed. */
    async deleteSlot(userId, slot) {
      const id = String(userId || 'anonymous');
      if (!VALID_BRAIN_SLOTS.includes(slot)) throw new Error(`Unknown brain slot "${slot}"`);
      const coll = collection();
      if (!coll) {
        markDown(new Error('no database handle'));
        return fallback.deleteSlot(id, slot);
      }
      try {
        await ensureIndex(coll);
        await maybeMigrate(coll, id);
        const slots = { ...(await readSlots(coll, id)) };
        if (!slots[slot]) {
          markUp();
          return false;
        }
        delete slots[slot];
        await coll.updateOne(
          { userId: id },
          { $set: { slots, updatedAt: new Date().toISOString() } },
          { upsert: true }
        );
        markUp();
        return true;
      } catch (err) {
        markDown(err);
        return fallback.deleteSlot(id, slot);
      }
    },

    /** Reload the fallback file store (picks up edits made by another process). */
    reload() {
      fallback.reload();
    },
  };
}

/** Default singleton used by the brain-link controller (file-backed). */
export const brainLinkStore = createBrainLinkStore();
