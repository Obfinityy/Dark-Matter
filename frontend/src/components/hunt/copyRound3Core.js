/**
 * copyRound3Core.js — wave 23 (ideas 50881–50884): copy round 3 pure logic.
 *
 * Pure, framework-free logic for the four copy ideas that round out the
 * clipboard work from wave 22:
 *   50881 — version-info copy ("Dark-Matter v2.4.1 (build 8812)")
 *   50882 — finding filters copied as API query params for automation scripts
 *   50883 — screenshots copied as image bytes (ClipboardItem, feature-detected)
 *   50884 — sensitive fields never show copy buttons without an explicit reveal
 *
 * The WAVE23 registry lives in printCore.js; these ideas are referenced there.
 */

export const APP_BRAND = 'Dark-Matter';

/* 50881 — Copy version info --------------------------------------------- */

export function parseVersionInfo(input) {
  if (!input || typeof input !== 'object') return null;
  const version = String(input.version || '').trim();
  if (!/^\d+\.\d+\.\d+$/.test(version)) return null;
  const build = input.build == null ? null : String(input.build).trim();
  if (build !== null && !/^\d+$/.test(build)) return null;
  return { version, build };
}

/** "Dark-Matter v2.4.1 (build 8812)" — one-click bug-report string. */
export function versionInfoString(input) {
  const parsed = parseVersionInfo(input);
  if (!parsed) return null;
  const buildPart = parsed.build ? ` (build ${parsed.build})` : '';
  return `${APP_BRAND} v${parsed.version}${buildPart}`;
}

/* 50882 — Copy as API query --------------------------------------------- */

const API_QUERY_KEYS = [
  'severity',
  'status',
  'engine',
  'target',
  'q',
  'sort',
  'order',
  'from',
  'to',
];

/** Serialize finding filters to `severity=high&status=open…` for scripts. */
export function filtersToApiQuery(filters = {}) {
  const params = new URLSearchParams();
  for (const key of API_QUERY_KEYS) {
    const v = filters[key];
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) {
      for (const item of v) params.append(key, String(item));
    } else {
      params.set(key, String(v));
    }
  }
  return params.toString();
}

/** Parse back — round-trip safe with filtersToApiQuery. */
export function apiQueryToFilters(query) {
  const out = {};
  if (!query) return out;
  const params = new URLSearchParams(query);
  for (const key of API_QUERY_KEYS) {
    const all = params.getAll(key);
    if (all.length === 0) continue;
    out[key] = all.length === 1 ? all[0] : all;
  }
  return out;
}

/* 50883 — Copy image bytes ---------------------------------------------- */

/**
 * Feature detection for real image-bytes copy.
 * Needs ClipboardItem + clipboard.write (secure context). Pure check of the
 * environment so tests can inject fakes.
 */
export function canCopyImageBytes(env = {}) {
  const nav = env.navigator;
  if (!nav || !nav.clipboard || typeof nav.clipboard.write !== 'function') return false;
  if (typeof env.ClipboardItem !== 'function') return false;
  return true;
}

export const IMAGE_COPY_MIMES = ['image/png', 'image/jpeg'];

/** Validate a candidate blob for image-bytes copy. */
export function validateImageCopyBlob(blob) {
  if (!blob || typeof blob !== 'object') return { ok: false, reason: 'no-blob' };
  if (!IMAGE_COPY_MIMES.includes(blob.type)) {
    return { ok: false, reason: 'unsupported-mime', mime: blob.type || 'unknown' };
  }
  if (!blob.size || blob.size <= 0) return { ok: false, reason: 'empty' };
  return { ok: true, mime: blob.type, bytes: blob.size };
}

/**
 * Build the ClipboardItem payload map. The actual write is done by the
 * component with the real ClipboardItem constructor; this keeps the pure
 * part testable and the DOM part thin.
 */
export function imageCopyPayload(blob) {
  const v = validateImageCopyBlob(blob);
  if (!v.ok) return v;
  return { ok: true, payload: { [v.mime]: blob } };
}

/* 50884 — No copy on secrets -------------------------------------------- */

export const SECRET_FIELD_PATTERNS = [
  /api[-_ ]?key/i,
  /secret/i,
  /token/i,
  /password/i,
  /passwd/i,
  /private[-_ ]?key/i,
  /client[-_ ]?secret/i,
  /auth/i,
  /credential/i,
  /bearer/i,
];

/** True when a field name looks like it holds a secret. */
export function isSecretField(fieldName) {
  if (!fieldName) return false;
  return SECRET_FIELD_PATTERNS.some(re => re.test(String(fieldName)));
}

export const SECRET_REVEAL_WINDOW_MS = 60_000;

/**
 * Copy gate for a field: secrets are copyable only inside an explicit reveal
 * window (50884). Returns { allowed, reason }.
 */
export function secretCopyGate({ fieldName, revealedAt, now = Date.now() } = {}) {
  if (!isSecretField(fieldName)) return { allowed: true, reason: 'not-secret' };
  if (typeof revealedAt !== 'number') return { allowed: false, reason: 'reveal-required' };
  if (now - revealedAt > SECRET_REVEAL_WINDOW_MS) {
    return { allowed: false, reason: 'reveal-expired' };
  }
  return { allowed: true, reason: 'revealed' };
}
