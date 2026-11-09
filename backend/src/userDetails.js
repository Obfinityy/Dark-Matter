// Dynamic details request (27 Oct 2026, owner order) — user-provided details vault.
//
// The agent ASKS the owner for details it needs (a login, an OTP, any field)
// instead of creating its own account. The owner fills them in on the frontend
// ("Enter details to go forward" card below the chat) and the agent resumes.
//
// SECURITY INVARIANTS (non-negotiable, same posture as credentials.js):
//   - Values live exactly one place: this server-side vault file.
//     They NEVER appear in hunt events, reasoning rows, screens, chat
//     messages, or any API response. Records are referenced by handle
//     only (`udet:<hunt>:<id>`); humanLoop.js scrubs every recorded
//     surface against the session's secrets before writing.
//   - The vault file is 0600 and written atomically.
//   - This vault is SEPARATE from the agent-persona vault
//     (agent-credentials.json). User-owned details and agent-created
//     credentials never mix: different files, different handles,
//     different ownership. A user-provided password is never stored
//     as an agent credential.
//   - One pending request per hunt at a time: a new request while one
//     is pending is refused (the UI shows exactly one card).
//
// File layout under config.dataDir (honours DATA_DIR in tests):
//   user-details.json  { version: 1, requests: [ ... ] }

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from './config.js';
import { atomicWriteJson } from './atomicWrite.js';
import { scrubSecrets } from './credentials.js';

export const USER_DETAILS_VERSION = 1;
export const MAX_FIELDS_PER_REQUEST = 6;
export const FIELD_TYPES = new Set(['text', 'email', 'password', 'otp', 'textarea']);

const KEY_RE = /^[a-z][a-z0-9_]{0,31}$/;

export function userDetailsFile() {
  return path.join(config.dataDir, 'user-details.json');
}

/** Opaque handle: udet:<hunt-short>:<12 hex>. The handle is safe to print. */
export function makeDetailHandle(huntId) {
  const short = String(huntId || 'hunt').replace(/^h_/, '').slice(0, 8) || 'hunt';
  return `udet:${short}:${crypto.randomBytes(6).toString('hex')}`;
}

function readStore() {
  try {
    const parsed = JSON.parse(fs.readFileSync(userDetailsFile(), 'utf8'));
    if (parsed && Array.isArray(parsed.requests)) return parsed;
  } catch { /* missing/corrupt -> empty store, never fatal */ }
  return { version: USER_DETAILS_VERSION, requests: [] };
}

function writeStore(store) {
  const file = userDetailsFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  atomicWriteJson(file, store, { mode: 0o600 });
}

/**
 * Validate a fields array. Returns { ok, error?, fields? } with normalised
 * fields: [{ key, label, type, required }]. Keys must be unique, lowercase
 * snake_case; types from FIELD_TYPES; 1..MAX_FIELDS_PER_REQUEST fields.
 */
export function normaliseFields(fields) {
  if (!Array.isArray(fields) || fields.length === 0) {
    return { ok: false, error: 'at least one field is required' };
  }
  if (fields.length > MAX_FIELDS_PER_REQUEST) {
    return { ok: false, error: `at most ${MAX_FIELDS_PER_REQUEST} fields per request` };
  }
  const seen = new Set();
  const out = [];
  for (const f of fields) {
    const key = String(f?.key || '').trim();
    const label = String(f?.label || '').trim().slice(0, 80);
    const type = String(f?.type || 'text').trim().toLowerCase();
    if (!KEY_RE.test(key)) return { ok: false, error: `bad field key: ${key}` };
    if (seen.has(key)) return { ok: false, error: `duplicate field key: ${key}` };
    if (!label) return { ok: false, error: `field ${key} needs a label` };
    if (!FIELD_TYPES.has(type)) return { ok: false, error: `bad field type: ${type}` };
    seen.add(key);
    out.push({ key, label, type, required: f?.required !== false });
  }
  return { ok: true, fields: out };
}

/** Pending (unresolved) requests for a hunt — public form only. */
export function getPendingRequests(huntId) {
  return readStore().requests
    .filter((r) => r.huntId === String(huntId) && r.status === 'pending')
    .map(publicDetailRequest);
}

/** All requests for a hunt, newest first — public form only. */
export function listDetailRequests(huntId) {
  return readStore().requests
    .filter((r) => r.huntId === String(huntId))
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    .map(publicDetailRequest);
}

/** Full record by id — server-side use only, never serialized out. */
export function getDetailRequest(requestId) {
  const store = readStore();
  return store.requests.find((r) => r.id === String(requestId)) || null;
}

/**
 * Create a pending request. Refused when the hunt already has a pending
 * request (one card at a time) or the fields are invalid. Returns
 * { ok, request? (public), error? }.
 */
export function createDetailRequest({ huntId, title, fields, site = '' }) {
  const cleanTitle = String(title || '').trim().slice(0, 160);
  if (!cleanTitle) return { ok: false, error: 'a title is required' };
  if (!String(huntId || '').trim()) return { ok: false, error: 'a huntId is required' };
  const norm = normaliseFields(fields);
  if (!norm.ok) return { ok: false, error: norm.error };
  const store = readStore();
  if (store.requests.some((r) => r.huntId === String(huntId) && r.status === 'pending')) {
    return { ok: false, error: 'a details request is already pending for this hunt' };
  }
  const rec = {
    id: makeDetailHandle(huntId),
    huntId: String(huntId),
    title: cleanTitle,
    site: String(site || '').slice(0, 200),
    fields: norm.fields,
    values: null,
    status: 'pending',
    createdAt: new Date().toISOString(),
    filledAt: null,
    resolvedAt: null,
    usedAt: null,
  };
  store.requests.push(rec);
  store.version = USER_DETAILS_VERSION;
  writeStore(store);
  return { ok: true, request: publicDetailRequest(rec) };
}

/**
 * Owner submits values. Required fields must be present and non-empty.
 * Values are stored in the vault only. Returns { ok, request? (public), error? }.
 */
export function submitDetailRequest(requestId, values) {
  const store = readStore();
  const rec = store.requests.find((r) => r.id === String(requestId));
  if (!rec) return { ok: false, error: 'request not found' };
  if (rec.status !== 'pending') return { ok: false, error: `request is ${rec.status}` };
  const clean = {};
  for (const f of rec.fields) {
    const v = values ? values[f.key] : undefined;
    const s = typeof v === 'string' ? v : v == null ? '' : String(v);
    if (f.required && !s.trim()) return { ok: false, error: `field "${f.label}" is required` };
    clean[f.key] = s;
  }
  rec.values = clean;
  rec.status = 'filled';
  rec.filledAt = new Date().toISOString();
  rec.resolvedAt = rec.filledAt;
  writeStore(store);
  return { ok: true, request: publicDetailRequest(rec) };
}

/** Owner declines a request. Returns { ok, request? (public), error? }. */
export function cancelDetailRequest(requestId) {
  const store = readStore();
  const rec = store.requests.find((r) => r.id === String(requestId));
  if (!rec) return { ok: false, error: 'request not found' };
  if (rec.status !== 'pending') return { ok: false, error: `request is ${rec.status}` };
  rec.status = 'cancelled';
  rec.resolvedAt = new Date().toISOString();
  writeStore(store);
  return { ok: true, request: publicDetailRequest(rec) };
}

/** Filled values for a request — server-side use only, never serialized out. */
export function getFilledValues(requestId) {
  const rec = getDetailRequest(requestId);
  if (!rec || rec.status !== 'filled' || !rec.values) return null;
  return { ...rec.values };
}

/** Mark a filled request as consumed by the brain (usedAt bookkeeping). */
export function markDetailRequestUsed(requestId) {
  const store = readStore();
  const rec = store.requests.find((r) => r.id === String(requestId));
  if (!rec) return false;
  rec.usedAt = new Date().toISOString();
  rec.status = 'used';
  writeStore(store);
  return true;
}

/** All filled/used values for a hunt — for the session scrub list only. */
export function detailValuesForScrub(huntId) {
  const out = [];
  for (const r of readStore().requests) {
    if (r.huntId !== String(huntId) || !r.values) continue;
    for (const v of Object.values(r.values)) {
      if (typeof v === 'string' && v) out.push(v);
    }
  }
  return out;
}

/** Public record: safe for any API response. Values are NEVER included. */
export function publicDetailRequest(rec) {
  if (!rec) return null;
  return {
    id: rec.id,
    huntId: rec.huntId,
    title: rec.title,
    site: rec.site,
    fields: (rec.fields || []).map((f) => ({ key: f.key, label: f.label, type: f.type, required: !!f.required })),
    status: rec.status,
    createdAt: rec.createdAt,
    filledAt: rec.filledAt || null,
    resolvedAt: rec.resolvedAt || null,
    usedAt: rec.usedAt || null,
  };
}

/** Redact user-detail values from text — delegates to the vault scrubber. */
export function scrubDetailValues(text, secrets) {
  return scrubSecrets(text, secrets);
}

// Screen lines for the hunt loop (mirrors chatQueue.js's
// chatQuestionScreenLines). Called once per turn from humanLoop.js.
//
//   - A pending request says WAIT (never re-ask, never re-attempt).
//   - A newly-filled request's values ride the screen for EXACTLY ONE
//     turn: they join the session secret set (so the record stays
//     clean) and the request is marked used, so the next turn never
//     shows them again. The values live only in the in-memory screen —
//     never in events, reasoning rows, or the session log.
//   - A recently declined request (resolved within 3h) says so once,
//     so the brain moves on instead of re-asking.
export function detailsRequestScreenLines(huntId, sessionSecrets) {
  const lines = [];
  let pending = [];
  let all = [];
  try { pending = getPendingRequests(huntId) || []; } catch { pending = []; }
  try { all = listDetailRequests(huntId) || []; } catch { all = []; }
  for (const p of pending) {
    lines.push(
      `WAITING FOR THE OWNER — your details request "${p.title}" is open in the chat (fields: ${p.fields.map((f) => f.label).join(', ')}). Do NOT re-request these details and do NOT re-attempt the blocked action until the owner answers.`,
    );
  }
  const nowMs = Date.now();
  for (const r of all) {
    if (r.status === 'filled') {
      const values = getFilledValues(r.id);
      if (!values) continue;
      for (const v of Object.values(values)) {
        if (typeof v === 'string' && v) sessionSecrets.add(v);
      }
      const shown = r.fields.map((f) => `${f.label}: ${values[f.key] ?? ''}`).join('; ');
      lines.push(
        `DETAILS RECEIVED from the owner for "${r.title}" (one-turn only — use them NOW with browser_type; they will not be shown again and are never written to the record): ${shown}`,
      );
      try { markDetailRequestUsed(r.id); } catch { /* best-effort */ }
    } else if (r.status === 'cancelled' && r.resolvedAt) {
      const ageMs = nowMs - Date.parse(r.resolvedAt);
      if (Number.isFinite(ageMs) && ageMs >= 0 && ageMs < 3 * 60 * 60 * 1000) {
        lines.push(
          `THE OWNER DECLINED your details request "${r.title}" — do NOT ask for these details again. Use another route: create your own account with save_credential, or move on to a different surface.`,
        );
      }
    }
  }
  return lines.length ? ['=== DETAILS FROM THE OWNER ===', ...lines] : [];
}
