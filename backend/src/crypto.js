// AES-256-GCM encryption for plugin API keys and other secrets at rest.
//
// Master key resolution:
//   1. PLUGIN_MASTER_KEY env var (hex-encoded 32 bytes, or base64, or a raw
//      passphrase which is stretched with PBKDF2 to 32 bytes).
//   2. If missing: a random key is generated at boot and the app WARNS that
//      stored keys will be unreadable after restart. Never commit a real key.

import crypto from 'node:crypto';
import { config } from './config.js';

function resolveMasterKey() {
  const raw = (config.pluginMasterKey || '').trim();
  if (!raw) {
    const ephemeral = crypto.randomBytes(32);
    console.warn(
      '[plugins] WARNING: PLUGIN_MASTER_KEY is not set. Generated an ephemeral ' +
        'master key — encrypted plugin keys will NOT survive a restart. ' +
        'Set PLUGIN_MASTER_KEY in the environment to persist them.'
    );
    return { key: ephemeral, ephemeral: true };
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return { key: Buffer.from(raw, 'hex'), ephemeral: false };
  if (/^[A-Za-z0-9+/=]{40,}$/.test(raw) && raw.length % 4 === 0) {
    try {
      const buf = Buffer.from(raw, 'base64');
      if (buf.length === 32) return { key: buf, ephemeral: false };
    } catch {
      // fall through to passphrase stretching
    }
  }
  // Passphrase: stretch deterministically (fixed salt) so restarts keep working.
  const key = crypto.pbkdf2Sync(raw, 'dark-matter-plugin-salt-v1', 210000, 32, 'sha256');
  return { key, ephemeral: false };
}

const { key: MASTER_KEY, ephemeral: EPHEMERAL_KEY } = resolveMasterKey();

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
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    MASTER_KEY,
    Buffer.from(envelope.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  const pt = Buffer.concat([
    decipher.update(Buffer.from(envelope.data, 'base64')),
    decipher.final(),
  ]);
  return pt.toString('utf8');
}
