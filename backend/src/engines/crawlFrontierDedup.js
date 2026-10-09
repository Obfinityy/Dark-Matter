/**
 * crawlFrontierDedup.js — Crawl-frontier deduplication engine.
 *
 * Normalises and deduplicates the entire discovered URL frontier by canonical
 * form so downstream testing never wastes cycles on duplicate routes.
 *
 * Canonicalisation rules (applied deterministically, pure functions only):
 *  - scheme and hostname lower-cased; default ports (:80/:443) stripped;
 *  - dot-segments (`.`/`..`) resolved and duplicate slashes collapsed;
 *  - percent-decoding of unreserved characters (A-Za-z0-9-._~) applied
 *    repeatedly until stable, then re-encoded consistently;
 *  - fragment (`#…`) removed — it never reaches the server;
 *  - tracking parameters stripped (utm_*, gclid, fbclid, msclkid, mc_*, fb_*
 *    ad ids, _ga, yclid, …) and remaining query parameters sorted by name;
 *  - empty query (`?`) and trailing slash on non-root paths normalised.
 *
 * Passive and purely local: operates on URL strings already discovered by
 * earlier recon; no network calls, no target interaction.
 *
 * @module crawlFrontierDedup
 */

import { URL } from 'node:url';

/** Query parameters that identify a click campaign rather than a resource. */
export const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'utm_id', 'utm_source_platform', 'utm_creative_format', 'utm_marketing_tactic',
  'gclid', 'gclsrc', 'dclid', 'fbclid', 'msclkid', 'mc_cid', 'mc_eid',
  'igshid', 'yclid', 'gbraid', 'wbraid', 'scid', 'sccid', '_ga', '_gl',
  'vero_conv', 'vero_id', 'pk_campaign', 'pk_kwd', 'piwik_campaign',
  'piwik_kwd', 'matomo_campaign', 'matomo_kwd', 'wt_mc', 'wtmc',
  'ef_id', 's_kwcid', 'mkwid', 'pcrid', 'msclkid', 'ttclid', 'li_fat_id',
]);

/** Parameter-name patterns (case-insensitive) that identify campaign trackers. */
export const TRACKING_PARAM_PATTERNS = [/^utm_/i, /^fb_/i, /^mc_/i];

/**
 * Decide whether a query parameter name is a tracking parameter.
 *
 * @param {string} name - Raw query parameter name.
 * @returns {boolean} True when the parameter is campaign tracking noise.
 */
export function isTrackingParam(name) {
  const lower = name.toLowerCase();
  if (TRACKING_PARAMS.has(lower)) return true;
  return TRACKING_PARAM_PATTERNS.some(re => re.test(name));
}

/**
 * Repeatedly percent-decode unreserved characters until the string is stable.
 *
 * @param {string} s - Input path/query segment.
 * @returns {string} Decoded string with unreserved chars in plain form.
 */
function decodeUnreserved(s) {
  let prev = s;
  for (let i = 0; i < 5; i++) {
    let next;
    try {
      next = prev.replace(/%([0-9a-fA-F]{2})/g, (m, hex) => {
        const ch = String.fromCharCode(parseInt(hex, 16));
        return /[A-Za-z0-9\-._~]/.test(ch) ? ch : m.toUpperCase();
      });
    } catch {
      next = prev;
    }
    if (next === prev) return next;
    prev = next;
  }
  return prev;
}

/**
 * Resolve `.` and `..` dot-segments in a path string (RFC 3986 §5.2.4).
 *
 * @param {string} path - URL path (may be empty).
 * @returns {string} Path with dot-segments resolved.
 */
export function resolveDotSegments(path) {
  const input = path || '/';
  const segs = input.split('/');
  const out = [];
  for (const seg of segs) {
    if (seg === '' || seg === '.') {
      if (seg === '' && out.length === 0) out.push('');
      continue;
    }
    if (seg === '..') {
      if (out.length > 1) out.pop();
      continue;
    }
    out.push(seg);
  }
  if (input.endsWith('/.') || input.endsWith('/..')) out.push('');
  const resolved = out.join('/');
  return resolved.startsWith('/') ? resolved : `/${resolved}`;
}

/**
 * Canonicalise a URL to its stable canonical form.
 *
 * @param {string} rawUrl - The discovered URL (absolute or protocol-relative).
 * @param {object} [options] - Options.
 * @param {string} [options.base] - Base URL used to resolve relative URLs.
 * @returns {{canonical: string, ok: boolean, reason?: string}} Canonical form,
 *   or ok=false with a reason when the input is not a usable http(s) URL.
 */
export function canonicaliseUrl(rawUrl, options = {}) {
  const raw = String(rawUrl || '').trim();
  if (!raw) return { canonical: '', ok: false, reason: 'empty' };
  if (/^(javascript|data|mailto|tel|ftp|file|vbscript):/i.test(raw)) {
    return { canonical: '', ok: false, reason: 'non-http-scheme' };
  }

  let url;
  try {
    url = options.base ? new URL(raw, options.base) : new URL(raw);
  } catch {
    return { canonical: '', ok: false, reason: 'unparseable' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { canonical: '', ok: false, reason: 'non-http-scheme' };
  }

  // Scheme + host normalisation.
  const scheme = url.protocol.toLowerCase();
  const host = url.hostname.toLowerCase();
  let port = url.port;
  if ((scheme === 'http:' && port === '80') || (scheme === 'https:' && port === '443')) port = '';

  // Path normalisation.
  let path = decodeUnreserved(url.pathname);
  path = path.replace(/\/{2,}/g, '/');
  path = resolveDotSegments(path);
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  if (path === '') path = '/';

  // Query normalisation: drop trackers, sort the rest.
  const params = [];
  for (const [name, value] of url.searchParams) {
    if (isTrackingParam(name)) continue;
    params.push([decodeUnreserved(name), decodeUnreserved(value)]);
  }
  params.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
  const query = params
    .map(([n, v]) => `${encodeURIComponent(n)}=${encodeURIComponent(v)}`)
    .join('&');

  const canonical = `${scheme}//${host}${port ? `:${port}` : ''}${path}${query ? `?${query}` : ''}`;
  return { canonical, ok: true };
}

/**
 * Idea 01000 — dedupe an entire discovered URL frontier by canonical form.
 *
 * Each URL keeps the first-seen representative; later equivalents are recorded
 * as duplicates with their canonical key and the representative they map to.
 * Relative URLs are resolved against `options.base` before comparison.
 *
 * @param {string[]} urls - Discovered frontier URLs (any order).
 * @param {object} [options] - Options.
 * @param {string} [options.base] - Base URL for resolving relative URLs.
 * @param {boolean} [options.includeSkipped=false] - Include rejected inputs in `skipped`.
 * @returns {{unique: string[], duplicates: Array<{url: string, canonical: string, duplicateOf: string}>, skipped: Array<{url: string, reason: string}>, stats: {input: number, unique: number, duplicateCount: number, skipped: number, reductionPct: number}}}
 */
export function dedupeFrontier(urls, options = {}) {
  const list = Array.isArray(urls) ? urls : [];
  const canonicalToRep = new Map();
  const unique = [];
  const duplicates = [];
  const skipped = [];

  for (const raw of list) {
    const { canonical, ok, reason } = canonicaliseUrl(raw, options);
    if (!ok) {
      if (options.includeSkipped) skipped.push({ url: String(raw), reason });
      else skipped.push({ url: String(raw), reason });
      continue;
    }
    if (canonicalToRep.has(canonical)) {
      duplicates.push({ url: String(raw), canonical, duplicateOf: canonicalToRep.get(canonical) });
    } else {
      canonicalToRep.set(canonical, String(raw));
      unique.push(String(raw));
    }
  }

  const stats = {
    input: list.length,
    unique: unique.length,
    duplicateCount: duplicates.length,
    skipped: skipped.length,
    reductionPct: list.length ? Math.round((duplicates.length / list.length) * 1000) / 10 : 0,
  };

  return { unique, duplicates, skipped, stats };
}

/**
 * Merge several frontiers into one canonical-deduplicated frontier.
 *
 * @param {Array<string[]>} frontiers - Multiple URL lists.
 * @param {object} [options] - Passed through to dedupeFrontier.
 * @returns {ReturnType<typeof dedupeFrontier>} Deduped merge result.
 */
export function mergeFrontiers(frontiers, options = {}) {
  const all = [];
  for (const f of frontiers || []) {
    if (Array.isArray(f)) all.push(...f);
  }
  return dedupeFrontier(all, options);
}

/**
 * Summarise which canonicalisation rules actually collapsed the frontier,
 * so operators can see what the dedup engine did.
 *
 * @param {string[]} urls - Discovered frontier URLs.
 * @param {object} [options] - Passed through to canonicaliseUrl.
 * @returns {Record<string, number>} Counts of URLs affected per rule.
 */
export function frontierCanonicalisationReport(urls, options = {}) {
  const report = {
    schemeOrHostCase: 0,
    defaultPortStripped: 0,
    fragmentRemoved: 0,
    trackingParamsRemoved: 0,
    querySorted: 0,
    trailingSlashNormalised: 0,
    dotSegmentsResolved: 0,
    percentDecoded: 0,
  };

  for (const raw of urls || []) {
    const s = String(raw);
    if (/[A-Z]/.test(s)) report.schemeOrHostCase += 1;
    if (/:80(?![0-9])/.test(s) || /:443(?![0-9])/.test(s)) report.defaultPortStripped += 1;
    if (s.includes('#')) report.fragmentRemoved += 1;
    if (s.includes('?')) {
      try {
        const u = new URL(s, options.base || 'http://x.local');
        const names = [...u.searchParams.keys()];
        if (names.some(n => isTrackingParam(n))) report.trackingParamsRemoved += 1;
        const sorted = [...names].sort();
        if (names.some((n, i) => n !== sorted[i])) report.querySorted += 1;
      } catch { /* ignore */ }
    }
    const pathOnly = s.split('?')[0].split('#')[0];
    if (pathOnly.length > 1 && pathOnly.endsWith('/')) report.trailingSlashNormalised += 1;
    if (/\/(?:\.\.?)(?:\/|$)/.test(pathOnly)) report.dotSegmentsResolved += 1;
    if (/%[0-9a-fA-F]{2}/.test(s)) report.percentDecoded += 1;
  }

  return report;
}

export const CRAWL_FRONTIER_DEDUP = {
  TRACKING_PARAMS,
  TRACKING_PARAM_PATTERNS,
  isTrackingParam,
  resolveDotSegments,
  canonicaliseUrl,
  dedupeFrontier,
  mergeFrontiers,
  frontierCanonicalisationReport,
};

export default CRAWL_FRONTIER_DEDUP;
