// AES-256-GCM encryption for plugin API keys and other secrets at rest.
//
// Master key resolution:
//   1. PLUGIN_MASTER_KEY env var (hex-encoded 32 bytes, or base64, or a raw
//      passphrase which is stretched with PBKDF2 to 32 bytes).
//   2. If missing: a random key is generated at boot and the app WARNS that
//      stored keys will be unreadable after restart. Never commit a real key.
//
// FIX (#343): passphrase stretching used to use a FIXED salt published
// in this file ('dark-matter-plugin-salt-v1'), so every deployment with
// the same passphrase derived the SAME key and rainbow tables could be
// precomputed. Passphrases now stretch with a per-deployment random salt
// persisted at DATA_DIR/.plugin-salt (0600, generated once, never
// overwritten). The fixed-salt derivation survives ONLY as a legacy
// DECRYPT fallback (with a loud warning) so keys encrypted before this
// fix stay readable until the owner re-saves them.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { dataDir } from './store.js';

const LEGACY_SALT = 'dark-matter-plugin-salt-v1';

function loadOrGenerateSalt() {
  const file = path.join(dataDir(), '.plugin-salt');
  try {
    const existing = fs.readFileSync(file, 'utf8').trim();
    if (existing) {
      try { fs.chmodSync(file, 0o600); } catch { /* best-effort */ }
      return { salt: existing, persisted: true };
    }
  } catch { /* no persisted salt: generate one */ }
  const generated = crypto.randomBytes(16).toString('hex');
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, generated, { flag: 'wx', mode: 0o600 });
    return { salt: generated, persisted: true };
  } catch (err) {
    if (err && err.code === 'EEXIST') {
      try {
        const winner = fs.readFileSync(file, 'utf8').trim();
        if (winner) return { salt: winner, persisted: true };
      } catch { /* fall through to ephemeral */ }
    }
  }
  return { salt: generated, persisted: false };
}

function resolveMasterKey() {
  const raw = (config.pluginMasterKey || '').trim();
  if (!raw) {
    const ephemeral = crypto.randomBytes(32);
    console.warn(
      '[plugins] WARNING: PLUGIN_MASTER_KEY is not set. Generated an ephemeral ' +
        'master key — encrypted plugin keys will NOT survive a restart. ' +
        'Set PLUGIN_MASTER_KEY in the environment to persist them.'
    );
    return { key: ephemeral, ephemeral: true, legacyKey: null };
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return { key: Buffer.from(raw, 'hex'), ephemeral: false, legacyKey: null };
  if (/^[A-Za-z0-9+/=]{40,}$/.test(raw) && raw.length % 4 === 0) {
    try {
      const buf = Buffer.from(raw, 'base64');
      if (buf.length === 32) return { key: buf, ephemeral: false, legacyKey: null };
    } catch {
      // fall through to passphrase stretching
    }
  }
  // Passphrase: stretch with the per-deployment persisted salt.
  const { salt, persisted } = loadOrGenerateSalt();
  if (!persisted) {
    console.warn(
      '[plugins] WARNING: the passphrase salt could NOT be persisted — using an ' +
        'ephemeral salt. Keys encrypted now will NOT survive a restart. ' +
        'Fix DATA_DIR writability or set a hex/base64 PLUGIN_MASTER_KEY.'
    );
  }
  const key = crypto.pbkdf2Sync(raw, salt, 210000, 32, 'sha256');
  // Legacy decrypt fallback for keys encrypted with the old fixed salt.
  const legacyKey = crypto.pbkdf2Sync(raw, LEGACY_SALT, 210000, 32, 'sha256');
  return { key, ephemeral: false, legacyKey };
}

const { key: MASTER_KEY, ephemeral: EPHEMERAL_KEY, legacyKey: LEGACY_KEY } = resolveMasterKey();
let legacyFallbackWarned = false;

export function isEphemeralMasterKey() {
  return EPHEMERAL_KEY;
}

export function encryptSecret(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', MASTER_KEY, iv);
  const ct = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    alg: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: ct.toString('base64'),
  };
}

export function decryptSecret(envelope) {
  if (!envelope || envelope.alg !== 'aes-256-gcm') throw new Error('unsupported key envelope');
  const attempt = (key) => {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(envelope.iv, 'base64')
    );
    decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
    const pt = Buffer.concat([
      decipher.update(Buffer.from(envelope.data, 'base64')),
      decipher.final(),
    ]);
    return pt.toString('utf8');
  };
  try {
    return attempt(MASTER_KEY);
  } catch (e) {
    // Legacy fallback (#343 migration): keys encrypted before the fix
    // used the fixed salt. If one decrypts, warn loudly (once) so the
    // owner re-saves it under the new salt — then it stays migrated.
    if (LEGACY_KEY) {
      try {
        const pt = attempt(LEGACY_KEY);
        if (!legacyFallbackWarned) {
          legacyFallbackWarned = true;
          console.warn('[plugins] WARNING: a plugin key decrypted with the LEGACY fixed salt — re-save it to migrate to the per-deployment salt.');
        }
        return pt;
      } catch { /* not a legacy key either */ }
    }
    throw e;
  }
}
