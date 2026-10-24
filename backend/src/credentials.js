// Lane AI (24 Oct 2026) — agent credential vault + Obfinity persona.
//
// The agent is a person with its own accounts. When a target needs an
// account, the agent creates it ITSELF under the Obfinity persona —
// never the owner's identity, never another user's data — and the
// password lives exactly one place: this server-side vault file.
//
// SECURITY INVARIANTS (non-negotiable, asserted in tests):
//   - Passwords and temp-mail tokens NEVER appear in hunt events,
//     reasoning rows, screens, or the user-facing frontend. The hunt
//     record references a credential by handle only
//     (`cred:<host>:<id>`); humanLoop.js scrubs every recorded
//     surface against the session's secrets before writing.
//   - The vault file itself is 0600 and written atomically. It is
//     the ONLY place passwords and inbox tokens live on disk.
//   - The admin portal lists PUBLIC records (no password, no token)
//     and reveals one password only through an explicit admin-only
//     endpoint, on click — never on list load.
//
// File layout under config.dataDir (honours DATA_DIR in tests):
//   agent-credentials.json  { version: 1, records: [ ... ] }

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from './config.js';

export const PERSONA_NAME = 'Obfinity';
export const PERSONA_USERNAME_PREFIX = 'obfinity';
export const VAULT_VERSION = 1;

const MIN_SCRUB_LEN = 4;

export function vaultFile() {
  return path.join(config.dataDir, 'agent-credentials.json');
}

/** Random password: 16+ chars, at least one of each class. */
export function generatePassword(length = 20) {
  const len = Math.max(16, Number(length) || 20);
  const classes = [
    'abcdefghijklmnopqrstuvwxyz',
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    '0123456789',
    '!@#$%^&*()-_=+',
  ];
  const all = classes.join('');
  const pick = (s) => s[crypto.randomInt(s.length)];
  const chars = classes.map(pick);
  while (chars.length < len) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

/** Persona username: obfinity-<8 lowercase alphanumerics>. */
export function generatePersonaUsername() {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let suffix = '';
  for (let i = 0; i < 8; i++) suffix += alphabet[crypto.randomInt(alphabet.length)];
  return `${PERSONA_USERNAME_PREFIX}-${suffix}`;
}

/** Host part of a site URL (or a bare host), lowercased. */
export function hostOf(site) {
  const s = String(site || '').trim();
  try {
    return new URL(s.includes('://') ? s : `https://${s}`).hostname.toLowerCase();
  } catch {
    return s.toLowerCase().replace(/^[^/]*:\/\//, '').split('/')[0];
  }
}

/** Opaque handle: cred:<host>:<12 hex>. The handle is safe to print. */
export function makeHandle(host) {
  return `cred:${hostOf(host)}:${crypto.randomBytes(6).toString('hex')}`;
}

function readVault() {
  try {
    const parsed = JSON.parse(fs.readFileSync(vaultFile(), 'utf8'));
    if (parsed && Array.isArray(parsed.records)) return parsed;
  } catch { /* missing/corrupt -> empty vault, never fatal */ }
  return { version: VAULT_VERSION, records: [] };
}

function writeVault(vault) {
  const file = vaultFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(vault, null, 2));
  try { fs.chmodSync(tmp, 0o600); } catch { /* best-effort */ }
  fs.renameSync(tmp, file);
  try { fs.chmodSync(file, 0o600); } catch { /* best-effort */ }
}

/**
 * Store a credential. `inbox` is {provider, address, token?} — the
 * token is kept in the vault file only and stripped by every
 * serializer below. Returns the full record (server-side use only).
 */
export function saveCredential({ site, username, password, huntId = null, inbox = null }) {
  const host = hostOf(site);
  const record = {
    handle: makeHandle(host),
    site: String(site || ''),
    host,
    username: String(username || ''),
    password: String(password || ''),
    createdAt: new Date().toISOString(),
    verified: false,
    verifiedAt: null,
    lastUsedAt: null,
    huntId: huntId || null,
    inbox: inbox ? { provider: inbox.provider || null, address: inbox.address || null, token: inbox.token || null } : null,
  };
  const vault = readVault();
  vault.records.push(record);
  vault.version = VAULT_VERSION;
  writeVault(vault);
  return record;
}

/** Full record by handle — server-side use only, never serialized out. */
export function getCredential(handle) {
  const vault = readVault();
  return vault.records.find((r) => r.handle === handle) || null;
}

/** Public record: safe for the admin list and any API response. */
export function publicCredential(rec) {
  if (!rec) return null;
  return {
    handle: rec.handle,
    site: rec.site,
    host: rec.host,
    username: rec.username,
    createdAt: rec.createdAt,
    verified: !!rec.verified,
    verifiedAt: rec.verifiedAt || null,
    lastUsedAt: rec.lastUsedAt || null,
    huntId: rec.huntId || null,
    inboxAddress: rec.inbox ? rec.inbox.address : null,
    inboxProvider: rec.inbox ? rec.inbox.provider : null,
  };
}

/** All credentials, public form only. */
export function listCredentials() {
  return readVault().records.map(publicCredential);
}

/** Admin-only reveal: one record's password, on explicit request. */
export function revealCredential(handle) {
  const rec = getCredential(handle);
  if (!rec) return null;
  return { handle: rec.handle, site: rec.site, username: rec.username, password: rec.password };
}

export function markVerified(handle) {
  const vault = readVault();
  const rec = vault.records.find((r) => r.handle === handle);
  if (!rec) return false;
  rec.verified = true;
  rec.verifiedAt = new Date().toISOString();
  writeVault(vault);
  return true;
}

export function touchCredential(handle) {
  const vault = readVault();
  const rec = vault.records.find((r) => r.handle === handle);
  if (!rec) return false;
  rec.lastUsedAt = new Date().toISOString();
  writeVault(vault);
  return true;
}

/** Rotation/replacement for future use: swap the password, keep the handle. */
export function replaceCredential(handle, password) {
  const vault = readVault();
  const rec = vault.records.find((r) => r.handle === handle);
  if (!rec) return null;
  rec.password = String(password || '');
  rec.updatedAt = new Date().toISOString();
  writeVault(vault);
  return rec;
}

/**
 * Redact exact secret strings from text. Only secrets of >= 4 chars
 * are scrubbed (shorter strings collide with ordinary text). Every
 * recorded surface in humanLoop.js passes through this before
 * writing, so a password or verification code the brain typed or
 * quoted can never land in events.jsonl or reasoning.jsonl.
 */
export function scrubSecrets(text, secrets) {
  let out = String(text ?? '');
  if (!out) return out;
  for (const s of secrets || []) {
    const secret = String(s || '');
    if (secret.length < MIN_SCRUB_LEN) continue;
    out = out.split(secret).join('[redacted]');
  }
  return out;
}
