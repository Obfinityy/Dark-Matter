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
 * Storage: JSON file on the backend host (`backend/data/brain-links.json`,
 * gitignored), following the owner's no-MongoDB rule (same pattern as the
 * Infinity Credits wallet in creditStore.js). Atomic writes (temp + rename).
 *
 * If BRAIN_LINKS_KEY is unset, an ephemeral key is generated and a loud
 * warning is printed — links will NOT survive a restart in that mode.
 * Set a stable key in production (see backend/.env.example).
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_FILE = path.resolve(
  process.env.BRAIN_LINKS_FILE || path.join(process.cwd(), 'data', 'brain-links.json')
);

export const VALID_BRAIN_SLOTS = ['vision', 'grounding', 'hacker'];

/** Resolve the 32-byte AES key from env, or generate an ephemeral one. */
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
    if (buf && buf.length === 32) return { key: buf, ephemeral: false };
    console.warn(
      '[brain-links] BRAIN_LINKS_KEY is set but is not 32 bytes (hex/base64) — using ephemeral key. Links will not survive restart.'
    );
  } else {
    console.warn(
      '[brain-links] BRAIN_LINKS_KEY is not set — using an ephemeral key. Set a stable 32-byte key or saved links will be lost on restart.'
    );
  }
  return { key: crypto.randomBytes(32), ephemeral: true };
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
 * @param {{ filePath?: string }} [opts]
 */
export function createBrainLinkStore({ filePath = DEFAULT_FILE } = {}) {
  const { key, ephemeral } = resolveKey();
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
    const slots = data[id] || {};
    const out = {};
    for (const slot of VALID_BRAIN_SLOTS) {
      const entry = slots[slot];
      if (!entry || !entry.urlEnc) continue;
      const url = decrypt(key, entry.urlEnc);
      if (!url) continue; // Undecryptable (key rotated?) — skip silently.
      out[slot] = { url, name: entry.name || null, updatedAt: entry.updatedAt || null };
    }
    return out;
  }

  return {
    /** Whether the encryption key is ephemeral (dev warning surface). */
    isEphemeralKey: ephemeral,

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
      if (!links || typeof links !== 'object' || Array.isArray(links)) {
        throw new Error('Invalid links payload');
      }
      const userSlots = { ...(data[id] || {}) };
      let changed = false;
      for (const [slot, entry] of Object.entries(links)) {
        if (!VALID_BRAIN_SLOTS.includes(slot)) continue;
        if (entry == null) {
          // Explicit null removes the slot.
          if (userSlots[slot]) {
            delete userSlots[slot];
            changed = true;
          }
          continue;
        }
        const url = String(entry.url || '').trim();
        if (!validUrl(url)) throw new Error(`Invalid URL for brain slot "${slot}"`);
        userSlots[slot] = {
          urlEnc: encrypt(key, url),
          name: String(entry.name || '').trim().slice(0, 120) || null,
          updatedAt: new Date().toISOString(),
        };
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

/** Default singleton used by the brain-link controller. */
export const brainLinkStore = createBrainLinkStore();
