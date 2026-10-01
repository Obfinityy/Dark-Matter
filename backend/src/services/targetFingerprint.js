/**
 * Target Fingerprint — canonical identity of a hunt target.
 *
 * When a user pastes a target link, we fingerprint it (normalize → SHA-256) and
 * check the hunt-records database FIRST. If a completed report already exists
 * for that fingerprint, we return it instantly instead of re-running the agent.
 *
 * Built on the existing normalizeTargetUrl() (models/targetModel.js) so the
 * fingerprint agrees with how the assessment system already canonicalizes URLs,
 * then goes further: tracking parameters are stripped and the remaining query
 * string is sorted, so `?utm_source=x&id=1` and `?id=1` fingerprint identically.
 */
import crypto from 'node:crypto';
import { normalizeTargetUrl } from '../models/targetModel.js';

// Query parameters that identify the *visit*, never the *target*. Stripped before hashing.
const TRACKING_PARAM = /^(utm_[a-z_]+|fbclid|gclid|gclsrc|dclid|msclkid|mc_cid|mc_eid|igshid|_ga|_gl|ref|source|campaignid|adid)$/i;

/**
 * Canonical string for a target URL. Throws the same AppError as
 * normalizeTargetUrl() when the URL is invalid — callers that only want a
 * best-effort lookup should catch and skip dedup.
 */
export function canonicalTargetUrl(raw) {
  const url = new URL(normalizeTargetUrl(raw)); // validates scheme, strips hash/trailing slash
  url.hostname = url.hostname.toLowerCase();

  // normalizeTargetUrl() only strips a trailing slash at the END of the whole
  // string — `/app/?id=1` keeps its slash. Strip it from the pathname too so
  // `/app` and `/app/` fingerprint identically (root "/" is kept as-is).
  if (url.pathname !== '/' && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.replace(/\/+$/, '');
  }

  // Strip tracking params; sort what remains so parameter ORDER never changes identity.
  const kept = [...url.searchParams.entries()]
    .filter(([key]) => !TRACKING_PARAM.test(key))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  url.search = '';
  for (const [key, value] of kept) url.searchParams.append(key, value);
  url.hash = '';

  let canonical = url.toString();
  if (canonical.endsWith('/') && url.pathname === '/' && !url.search) {
    canonical = canonical.slice(0, -1);
  }
  return canonical;
}

/** { canonical, hash } — the hash is the dedup key stored on hunt records. */
export function fingerprintTarget(raw) {
  const canonical = canonicalTargetUrl(raw);
  const hash = crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
  return { canonical, hash };
}

/**
 * Best-effort fingerprint for values that may be a bare hostname (the job
 * record stores `target` as a hostname). Tries the raw value as a URL, then
 * as https://host. Returns null when nothing parses — the caller then skips
 * the hunt-record write instead of failing the hunt completion.
 */
export function fingerprintTargetLenient(raw) {
  const candidates = [raw, `https://${String(raw || '').trim()}`];
  for (const candidate of candidates) {
    try {
      return fingerprintTarget(candidate);
    } catch {
      // try the next candidate
    }
  }
  return null;
}
