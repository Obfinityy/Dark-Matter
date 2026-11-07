// Dark Matter rule-based scanner — API versioning / deprecated version
// probe (coverage row #343 [Medium], phase 80).
//
// NARROW DEFINITION (the ledger row is a bare title, so the boundary
// is written down here, in index.js, and in the lane report): this
// phase detects ONE thing — an API version that is still live after
// it was superseded or explicitly deprecated. An old version that
// keeps serving data without security fixes is the hole attackers
// target with known flaws in the deprecated version (OWASP API08:2023).
//
// A finding counts ONLY when one of these two signals holds for the
// same API base:
//   1. EXPLICIT DEPRECATION: a versioned endpoint responds 2xx with
//      API-shaped data AND carries a `Deprecation:` or `Sunset:`
//      header — the server itself declares the version deprecated
//      yet still serves it. This is the proven case.
//   2. MULTI-VERSION LIVE: two or more DISTINCT versions of the same
//      base respond 2xx with API-shaped data. Every version except
//      the highest is a finding — the older version is still live
//      alongside its successor. The evidence says so plainly when no
//      Deprecation/Sunset header was observed, so the vendor's
//      support status for that version still needs confirming.
//
// NON-OVERLAP (by design): /api vs /rest are DIFFERENT surfaces, not
// versions — they never count as two versions of one base. A single
// live version is never a finding (no evidence of deprecation). A
// version returning 410 Gone is correctly retired — never a finding.
// Non-2xx, HTML bodies, and redirects to a login page are never
// "live": a version counts as live only with status 2xx AND an
// API-shaped body (JSON content-type or a JSON-parseable body).
// A versioned path that only exists in the app's own JS bundles is
// not a finding either — only a live HTTP response counts.
//
// SAFETY: read-only GETs only, capped at 20 requests per scan
// (bases x version variants + origin-level bare versions). Every
// request failure is treated as "not live" — the phase stays ok:true
// on fetch trouble. One finding per (base, version), capped at 5.

import { fetchPage } from '../fingerprint.js';

const MAX_REQUESTS = 20;
const MAX_FINDINGS = 5;
const MAX_BASES = 3;

// Version segments probed for each discovered API base, plus the
// origin-level bare versions. Numeric order matters: the highest
// live version per base is the successor, the rest are findings.
const VERSION_SEGMENTS = ['v1', 'v2', 'v3', '1.0', '2.0'];

// Parse a version segment to a comparable number: 'v1' -> 1,
// '1.0' -> 1, 'v2' -> 2. Returns null when it is not a version.
export function parseVersion(segment) {
  const m = String(segment || '').match(/^v?(\d+)(?:\.(\d+))?$/i);
  if (!m) return null;
  const major = parseInt(m[1], 10);
  const minor = m[2] ? parseInt(m[2], 10) : 0;
  return major + minor / 100;
}

// Is this response body API-shaped? JSON content-type, or a body
// that parses as JSON, or starts with { / [. HTML, empty, and
// login-page bodies are never API-shaped.
export function isApiShaped(res) {
  if (!res || typeof res.status !== 'number' || res.status < 200 || res.status >= 300) return false;
  const body = typeof res.body === 'string' ? res.body.trim() : '';
  if (!body) return false;
  const ct = String((res.headers || {})['content-type'] || '').toLowerCase();
  if (ct.includes('application/json')) return true;
  if (body.startsWith('{') || body.startsWith('[')) {
    try {
      JSON.parse(body);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

// Derive API bases from the scan's target URLs. A base is the
// version-less API prefix: /api, /rest, or '' for origin-level
// versioned paths. Exported for unit tests.
export function apiBases(pageUrl, targetUrls) {
  const bases = new Set();
  const urls = [];
  if (typeof pageUrl === 'string' && pageUrl) urls.push(pageUrl);
  for (const u of Array.isArray(targetUrls) ? targetUrls : []) {
    if (typeof u === 'string' && u) urls.push(u);
  }
  for (const u of urls) {
    let path = '';
    try {
      path = new URL(u).pathname;
    } catch {
      continue;
    }
    const segs = path.split('/').filter(Boolean);
    if (segs.length === 0) continue;
    // /api/... or /rest/... -> base is the first segment.
    if (segs[0] === 'api' || segs[0] === 'rest') {
      bases.add(`/${segs[0]}`);
      continue;
    }
    // /api/v1/... or /v1/... -> the versioned path itself proves a
    // versioned API exists; its base is /api or origin-level.
    if (parseVersion(segs[0]) !== null) bases.add('');
    if (segs[0] === 'api' && segs.length > 1 && parseVersion(segs[1]) !== null) {
      bases.add('/api');
    }
  }
  // Origin-level bare versions are always candidates — an app can
  // version at the root (/v1/users) with no /api prefix at all.
  bases.add('');
  return [...bases].slice(0, MAX_BASES);
}

function snippet(body) {
  return String(body || '').replace(/\s+/g, ' ').trim().slice(0, 200);
}

/**
 * Probe API versioning (#343). @param {string} pageUrl — the pasted
 * page URL. @param {string[]} targetUrls — the scan's target URLs
 * (jsRoutes/openapi-mined API paths seed the bases). @param {object}
 * opts — { fetchPage } seam (defaults to fingerprint.fetchPage).
 * @returns {Promise<object[]>} findings (class 'api_versioning',
 * medium) — at most one per (base, version), capped at MAX_FINDINGS.
 */
export async function probeApiVersioning(pageUrl, targetUrls, opts = {}) {
  const findings = [];
  if (typeof pageUrl !== 'string' || !pageUrl) return [];
  let origin;
  try {
    origin = new URL(pageUrl).origin;
  } catch {
    return [];
  }
  const fetchFn = typeof opts.fetchPage === 'function' ? opts.fetchPage : fetchPage;
  const bases = apiBases(pageUrl, targetUrls);
  // Candidates: { base, version, segment, url }. Dedupe by URL.
  const candidates = [];
  const seenUrls = new Set();
  for (const base of bases) {
    for (const segment of VERSION_SEGMENTS) {
      const url = `${origin}${base}/${segment}`;
      if (seenUrls.has(url)) continue;
      seenUrls.add(url);
      candidates.push({ base, segment, version: parseVersion(segment), url });
    }
  }
  // Live versions per base: { base: [{ version, segment, url, res }] }.
  const liveByBase = new Map();
  const deprecated = [];
  let requests = 0;
  for (const c of candidates) {
    if (requests >= MAX_REQUESTS) break;
    requests += 1;
    let res;
    try {
      res = await fetchFn(c.url, { timeoutMs: 8000 });
    } catch {
      continue;
    }
    if (!isApiShaped(res)) continue;
    const headers = res.headers || {};
    const isDeprecated =
      Object.prototype.hasOwnProperty.call(headers, 'deprecation') ||
      Object.prototype.hasOwnProperty.call(headers, 'sunset');
    const rec = { ...c, res };
    if (!liveByBase.has(c.base)) liveByBase.set(c.base, []);
    liveByBase.get(c.base).push(rec);
    if (isDeprecated) deprecated.push(rec);
  }
  const seen = new Set();
  const pushFinding = (rec, title, detail) => {
    if (findings.length >= MAX_FINDINGS) return;
    const key = `${rec.base}|${rec.segment}`;
    if (seen.has(key)) return;
    seen.add(key);
    findings.push({
      class: 'api_versioning',
      id: `api-versioning-${(rec.base || 'root').replace(/[^a-z0-9]+/g, '-')}-${rec.segment.replace(/[^a-z0-9]+/g, '-')}`,
      title,
      severity: 'medium',
      url: rec.url,
      evidence: {
        request: `GET ${rec.url}`,
        response:
          `HTTP ${rec.res.status} with API-shaped body (first 200 chars: "${snippet(rec.res.body)}")${detail}`,
        impact_demo:
          'Old API versions stay live without security fixes — an attacker targets known flaws in the deprecated version while the current version is patched (OWASP API08:2023).',
        signalCorrelated: true,
      },
    });
  };
  // Signal 1 first: explicit deprecation is the proven case.
  for (const rec of deprecated) {
    const dep = rec.res.headers['deprecation'];
    const sun = rec.res.headers['sunset'];
    pushFinding(
      rec,
      `Deprecated API version ${rec.segment} still live${rec.base ? ` under ${rec.base}` : ' at the API root'} (server declares deprecation)`,
      ` — response carries ${dep !== undefined ? `Deprecation: ${dep}` : ''}${dep !== undefined && sun !== undefined ? ' and ' : ''}${sun !== undefined ? `Sunset: ${sun}` : ''} yet still serves data`
    );
  }
  // Signal 2: every live version except the highest per base.
  for (const [base, recs] of liveByBase) {
    if (recs.length < 2) continue;
    const max = Math.max(...recs.map((r) => r.version));
    for (const rec of recs) {
      if (rec.version >= max) continue;
      const top = recs.find((r) => r.version === max);
      pushFinding(
        rec,
        `Older API version ${rec.segment} still live alongside newer version ${top.segment}${base ? ` under ${base}` : ' at the API root'}`,
        ' — no Deprecation/Sunset header was observed on this version, so confirm the vendor\u2019s support status for it before treating it as deprecated'
      );
    }
  }
  return findings;
}

export const __apiVersioningMeta = { phases: ['api-versioning'], depth: ['quick', 'standard', 'deep'] };
