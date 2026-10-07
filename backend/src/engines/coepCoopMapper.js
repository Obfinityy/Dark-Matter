/**
 * coepCoopMapper.js — Cross-Origin-Embedder-Policy / Cross-Origin-Opener-Policy header mapper.
 *
 * Maps COEP / COOP / COOP-Report-Only headers to the cross-origin isolation
 * posture of a target and infers the application type. Sites that require
 * crossOriginIsolated (SharedArrayBuffer, high-resolution timers) are
 * typically performance-sensitive apps (video editors, games, CAD, WASM
 * workloads); the isolation requirement itself becomes fingerprinting data.
 */

const COEP_VALUES = new Set(['require-corp', 'credentialless']);
const COOP_VALUES = new Set(['same-origin', 'same-origin-allow-popups', 'unsafe-none']);

/**
 * Normalize a COEP/COOP header value.
 * @param {string} value raw header value
 * @param {Set} allowed known tokens
 * @returns {string|null} normalized token or null
 */
function normalizePolicy(value, allowed) {
  if (!value) return null;
  const token = String(value).split(';')[0].trim().toLowerCase();
  return allowed.has(token) ? token : null;
}

/**
 * Map isolation headers to an isolation profile.
 * @param {object} headers header map (any case)
 * @returns {{coep: string|null, coop: string|null, crossOriginIsolated: boolean, profile: string, appTypeHint: string}}
 */
export function mapIsolationHeaders(headers = {}) {
  const lowered = {};
  for (const [k, v] of Object.entries(headers)) lowered[k.toLowerCase()] = String(v);
  const coep = normalizePolicy(lowered['cross-origin-embedder-policy'], COEP_VALUES);
  const coop = normalizePolicy(lowered['cross-origin-opener-policy'], COOP_VALUES);
  const crossOriginIsolated = coep === 'require-corp' && coop === 'same-origin';

  let profile = 'not-isolated';
  if (crossOriginIsolated) profile = 'fully-isolated';
  else if (coep || (coop && coop !== 'unsafe-none')) profile = 'partially-isolated';

  let appTypeHint = 'standard web app — no isolation requirement detected';
  if (profile === 'fully-isolated') {
    appTypeHint = 'high-performance app (WASM / video / game / editor) — SharedArrayBuffer-capable';
  } else if (coep === 'require-corp') {
    appTypeHint = 'resource-embedding controls in place; likely media-heavy or embedding-sensitive app';
  } else if (coop === 'same-origin-allow-popups') {
    appTypeHint = 'OAuth / SSO popup flows likely (opener preserved for popups)';
  } else if (coop === 'same-origin') {
    appTypeHint = 'process isolation enforced; security-conscious deployment';
  }
  return { coep, coop, crossOriginIsolated, profile, appTypeHint };
}

/**
 * Score the isolation posture for reporting (0-100).
 * @param {object} mapped output of mapIsolationHeaders
 * @returns {number}
 */
export function scoreIsolationPosture(mapped = {}) {
  let score = 0;
  if (mapped.coep === 'require-corp') score += 40;
  else if (mapped.coep === 'credentialless') score += 25;
  if (mapped.coop === 'same-origin') score += 40;
  else if (mapped.coop === 'same-origin-allow-popups') score += 20;
  if (mapped.crossOriginIsolated) score += 20;
  return Math.min(score, 100);
}

export const COEP_COOP_MAPPER = {
  mapIsolationHeaders,
  scoreIsolationPosture,
};

export default COEP_COOP_MAPPER;
