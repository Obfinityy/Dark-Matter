// Dark Matter rule-based scanner — sensitive data cached by browser probe
// (coverage row #96 [Medium], phase 84).
//
// NARROW DEFINITION (the ledger row is a bare title, so the boundary is
// written down here, in index.js, and in the lane report): this phase
// detects ONE thing — a SENSITIVE page served without
// `Cache-Control: no-store`, so the browser stores the response and it
// stays viewable after logout or on a shared device (CWE-524; OWASP
// WSTG v4.2 "Test for Browser Cache Weaknesses" / OWASP Cheat Sheet
// Series on caching: sensitive responses must carry `no-store`).
//
// A finding counts ONLY when BOTH hold:
//   1. The landing page is sensitive — it sets a cookie (Set-Cookie
//      present), OR its HTML contains a password input or a login form,
//      OR its URL path is auth-gated (/login, /profile, /account,
//      /admin, /settings, /checkout — first path segment, so
//      /accounting never matches).
//   2. The response lacks cache protection — see the GATE below.
//
// GATE DECISION (7 Nov 2026, chosen on OWASP grounds BEFORE any proof
// run — recorded in the lane report): STRICT `no-store`. Only the
// `no-store` directive in the parsed Cache-Control directive list
// counts as protection. `no-cache` does NOT prevent storage — it only
// forces revalidation before reuse, so the body still sits in the
// cache (disk/memory), viewable on a shared device or after logout,
// and servable stale if revalidation fails; `must-revalidate` only
// governs stale reuse; `Pragma: no-cache` is the HTTP/1.0 equivalent
// of `no-cache` with the same weakness. `Expires: 0` / a past Expires
// is NOT accepted as a substitute in v1. Consequence, stated up
// front: DVWA's login page (`Cache-Control: no-cache, must-revalidate`
// + `Pragma: no-cache`, session cookies, no `no-store` — verified live
// 7 Nov ~21:05 IST) FIRES under this gate, so the DVWA proof leg is
// expected to be 1 real [Medium] finding, not a true negative. The
// gate is not tuned to force a 0-finding proof.
//
// NON-OVERLAP (by design): the 'headers' phase owns missing-header
// findings (missing-hsts/csp/xfo/xcto/rp, CORS, CSP weakness) — this
// phase never fires for a missing Cache-Control header on a PUBLIC
// page, and never re-fires a headers-phase finding. A public page with
// `Cache-Control: public` is not sensitive and never fires, however
// cacheable it is. The #180 sensitive-data-in-logs surface (log-viewer
// pages) is a different defect and never fires here.
//
// VERIFICATION: headers-only evidence — the Cache-Control / Pragma
// values ARE the evidence, so the differential verifier judges this
// on the default protocol (signalCorrelated). The class name
// 'sensitive_cache' is routed by protocolFor to the default protocol:
// it matches no family branch (no 'sqli'/'xss'/'idor'/'ssrf'/'bypass'
// substring, no 'oob' suffix, and none of the protocol keys) —
// verified by a unit test that calls assessConfirmation on a probe
// finding and expects 'confirmed'.
//
// SAFETY: read-only — pure inspection of the landing-page response the
// fingerprint step already fetched (fp.headers + fp.body), ZERO extra
// requests. One finding per scan, capped at 1.

// First path segment counts as auth-gated (so /login.php and
// /login/anything match, but /accounting never does).
export const AUTH_GATED_SEGMENTS = new Set([
  'login',
  'profile',
  'account',
  'admin',
  'settings',
  'checkout',
]);

// Parse a Cache-Control (or Pragma) header value into a set of
// lowercased directive NAMES. Values are dropped — `max-age=3600`
// yields 'max-age', and a quoted value that happens to contain the
// string 'no-store' (e.g. foo="no-store") yields only 'foo', never
// 'no-store'. Header values may arrive as a string or an array of
// strings (multiple headers). Exported for unit tests.
export function parseCacheDirectives(raw) {
  const out = new Set();
  const values = Array.isArray(raw) ? raw : [raw];
  for (const v of values) {
    if (typeof v !== 'string') continue;
    for (const part of v.split(',')) {
      const name = part.trim().split(/[=\s]/, 1)[0].trim().toLowerCase();
      if (name) out.add(name);
    }
  }
  return out;
}

// Lowercase a headers object defensively (fetchPage already lowercases
// keys, but the probe must not depend on that).
function lowerHeaders(headers) {
  const h = {};
  if (headers && typeof headers === 'object') {
    for (const [k, v] of Object.entries(headers)) h[String(k).toLowerCase()] = v;
  }
  return h;
}

// Is the page sensitive? Returns the matched signals (empty = not
// sensitive). Exported for unit tests.
export function sensitiveSignals(pageUrl, headers, html) {
  const signals = [];
  const h = lowerHeaders(headers);
  const setCookie = h['set-cookie'];
  const hasCookie =
    (typeof setCookie === 'string' && setCookie.trim() !== '') ||
    (Array.isArray(setCookie) && setCookie.some((v) => typeof v === 'string' && v.trim() !== ''));
  if (hasCookie) signals.push('sets a cookie (Set-Cookie present)');
  const clean = typeof html === 'string' ? html.replace(/<!--[\s\S]*?-->/g, '') : '';
  if (/<input\b[^>]*type\s*=\s*["']?password["']?/i.test(clean)) {
    signals.push('contains a password input');
  } else {
    // No password input — a form whose action/name/id names a login
    // still marks the page as a login surface.
    for (const m of clean.matchAll(/<form\b[^>]*>/gi)) {
      if (/\b(?:action|name|id)\s*=\s*["'][^"']*login[^"']*["']/i.test(m[0])) {
        signals.push('contains a login form');
        break;
      }
    }
  }
  try {
    const segments = new URL(pageUrl).pathname.split('/').filter(Boolean);
    // Strip a file extension before matching, so /login.php counts as
    // /login — but /accounting still never matches (no dot to strip).
    const first = segments.length > 0 ? segments[0].toLowerCase().split('.')[0] : '';
    if (first && AUTH_GATED_SEGMENTS.has(first)) {
      signals.push(`auth-gated path /${first}`);
    }
  } catch {
    // Invalid URL — the probe entry returns [] before reaching here.
  }
  return signals;
}

/**
 * Probe sensitive data cached by browser (#96). @param {string} pageUrl
 * — the pasted page URL. @param {object} headers — the landing-page
 * response headers (fp.headers; keys case-insensitive). @param {string}
 * html — the landing-page HTML (fp.body). @param {object} opts —
 * unused, reserved. @returns {object[]} findings (class
 * 'sensitive_cache', medium) — at most 1 per scan. Synchronous: pure
 * inspection of an already-fetched response, no network.
 */
export function probeSensitiveCache(pageUrl, headers, html, opts = {}) {
  if (typeof pageUrl !== 'string' || !pageUrl) return [];
  try {
    new URL(pageUrl);
  } catch {
    return [];
  }
  const signals = sensitiveSignals(pageUrl, headers, html);
  if (signals.length === 0) return [];
  const h = lowerHeaders(headers);
  const directives = parseCacheDirectives(h['cache-control']);
  if (directives.has('no-store')) return [];
  const ccRaw =
    typeof h['cache-control'] === 'string'
      ? h['cache-control']
      : Array.isArray(h['cache-control'])
        ? h['cache-control'].join(', ')
        : '(absent)';
  const pragmaRaw =
    typeof h['pragma'] === 'string'
      ? h['pragma']
      : Array.isArray(h['pragma'])
        ? h['pragma'].join(', ')
        : '(absent)';
  return [
    {
      class: 'sensitive_cache',
      id: 'sensitive-cache-no-store',
      title: `Sensitive page cached by browser — ${signals[0]} served without Cache-Control: no-store`,
      severity: 'medium',
      url: pageUrl,
      evidence: {
        request: `GET ${pageUrl}`,
        response:
          `Cache-Control: ${ccRaw}; Pragma: ${pragmaRaw}. Page is sensitive (${signals.join('; ')}), but the response carries no 'no-store' directive — the browser stores it and it stays viewable after logout or on a shared device. 'no-cache' / 'must-revalidate' / 'Pragma: no-cache' do not prevent storage, they only force revalidation before reuse.`,
        impact_demo:
          'A cached sensitive page (login, profile, account) remains readable in the browser cache after logout or on a shared device — session and account data leak to the next user of the machine (CWE-524, OWASP WSTG Browser Cache Weaknesses).',
        signalCorrelated: true,
      },
    },
  ];
}

export const __sensitiveCacheMeta = { phases: ['sensitive-cache'], depth: ['quick', 'standard', 'deep'] };
