// Dark Matter rule-based scanner — session token in URL probe
// (coverage rows #265 [Medium] + #321 [Medium], phase 81).
//
// NARROW DEFINITION (the ledger rows are bare titles, so the boundary
// is written down here, in index.js, and in the lane report): this
// phase detects ONE thing — a session identifier placed in a URL.
// A token in a URL leaks through Referer headers, server logs,
// browser history, and shared links, so anyone who obtains it can
// hijack the session (CWE-598; CWE-359 / OWASP A07:2021 for the
// leak via logs/referrer).
//
// A finding counts ONLY when a URL seen during the scan (the pasted
// page URL, a crawled link, or a form-derived GET target) carries a
// session-identifier parameter whose value passes the entropy gate
// below. Two signals, and the finding text says which one fired:
//   1. TOKEN IN URL (#265): a session param (PHPSESSID, JSESSIONID,
//      ASP.NET_SessionId, sessionid, sessid, sid, session_token)
//      carries a token-like value. The token leaks via logs, shared
//      links, and Referer on outbound navigation.
//   2. REFERER LEAK PATH (#321): the token-bearing URL is the pasted
//      page itself AND the page loads cross-origin subresources (or
//      links out cross-origin) — the token URL is then sent as the
//      Referer header to a third-party host on every subresource
//      load (or on click). The finding names the third-party hosts.
//
// NON-OVERLAP (by design): CSRF tokens are NOT session identifiers
// (csrf_token, _token, authenticity_token are not in the param list,
// so a CSRF-token-in-URL row — if one exists — is a different defect
// and never fires here). The 'session-fixation' phase is a different
// defect too (attacker SETS the id). Low-entropy values never fire:
// a bare `sid=1`, `sessionid=guest`, or a short numeric id is not a
// session token. URL fragments are never inspected (they are not
// sent to the server). Redirect Location headers are NOT inspected —
// the fetchPage seam follows redirects and never exposes the chain
// (recorded as an honest limit).
//
// SAFETY: read-only — pure URL inspection, ZERO extra requests (the
// URLs are the scan's own targets; the page HTML is the fingerprint
// step's fp.body, already fetched). The token value is never published
// in full: evidence shows a masked form (first 4 + last 2 chars).
// One finding per (URL, param), capped at 5.

const MAX_FINDINGS = 5;
const MIN_TOKEN_LEN = 16;

// Session-identifier parameter names (matched case-insensitively,
// exact name match — `sessionid2` or `my_sid` never fire).
export const SESSION_PARAM_NAMES = new Set([
  'phpsessid',
  'jsessionid',
  'asp.net_sessionid',
  'sessionid',
  'sessid',
  'sid',
  'session_token',
]);

// The token charset after percent-decoding: alphanumerics plus the
// base64/base64url alphabet (- _ + / =). A space, quote, or angle
// bracket means the value is not a token.
const TOKEN_RE = /^[A-Za-z0-9\-_+=/]+$/;

// Does this value look like a session token? Length + charset +
// mixed letters and digits. Exported for unit tests.
export function isTokenLike(raw) {
  let value = String(raw || '');
  try {
    value = decodeURIComponent(value);
  } catch {
    // Keep the raw value when decoding fails — the charset gate
    // below still decides.
  }
  if (value.length < MIN_TOKEN_LEN) return false;
  if (!TOKEN_RE.test(value)) return false;
  if (!/[A-Za-z]/.test(value)) return false; // at least one letter
  if (!/[0-9]/.test(value)) return false; // at least one digit
  return true;
}

// Mask a token for evidence: first 4 + last 2 chars + length.
// The full value is never published.
export function maskToken(raw) {
  const value = String(raw || '');
  if (value.length <= 8) return `${value.slice(0, 2)}… (${value.length} chars)`;
  return `${value.slice(0, 4)}…${value.slice(-2)} (${value.length} chars)`;
}

function attrValue(tag, name) {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  if (!m) return null;
  return m[1] ?? m[2] ?? m[3] ?? null;
}

// Cross-origin hosts a page reaches: subresource loads (script/link/
// img/iframe/source/embed/video/audio/track) and outbound <a> links.
// Returns { subresources: string[], outboundLinks: string[] } —
// distinct hostnames, port ignored, same host as the page excluded.
// Exported for unit tests.
export function crossOriginHosts(html, pageUrl) {
  const out = { subresources: [], outboundLinks: [] };
  if (typeof html !== 'string' || !html) return out;
  let pageHost;
  try {
    pageHost = new URL(pageUrl).hostname.toLowerCase();
  } catch {
    return out;
  }
  const clean = html.replace(/<!--[\s\S]*?-->/g, '');
  const seenSub = new Set();
  const seenLink = new Set();
  const collect = (src, into, seen) => {
    if (!src) return;
    if (/^(data|blob|javascript):/i.test(src.trim())) return;
    let resolved;
    try {
      resolved = new URL(src.trim(), pageUrl);
    } catch {
      return;
    }
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') return;
    const host = resolved.hostname.toLowerCase();
    if (!host || host === pageHost) return;
    if (seen.has(host)) return;
    seen.add(host);
    into.push(host);
  };
  for (const m of clean.matchAll(/<(?:script|img|iframe|source|embed|video|audio|track)\b[^>]*>/gi)) {
    collect(attrValue(m[0], 'src'), out.subresources, seenSub);
  }
  for (const m of clean.matchAll(/<link\b[^>]*>/gi)) {
    collect(attrValue(m[0], 'href'), out.subresources, seenSub);
  }
  for (const m of clean.matchAll(/<a\b[^>]*>/gi)) {
    collect(attrValue(m[0], 'href'), out.outboundLinks, seenLink);
  }
  return out;
}

// Extract session params from one URL: query params plus `;name=value`
// path params (Java EE URL rewriting, e.g. /app;jsessionid=...).
// Returns [{ param, value }] with the param name as written.
// Exported for unit tests.
export function extractSessionParams(urlString) {
  const found = [];
  let u;
  try {
    u = new URL(urlString);
  } catch {
    return found;
  }
  for (const [name, value] of u.searchParams) {
    if (SESSION_PARAM_NAMES.has(String(name).toLowerCase())) {
      found.push({ param: name, value });
    }
  }
  for (const m of u.pathname.matchAll(/;([^;/?=]+)=([^;/?#]*)/g)) {
    const name = m[1];
    if (SESSION_PARAM_NAMES.has(String(name).toLowerCase())) {
      found.push({ param: name, value: m[2] });
    }
  }
  return found;
}

/**
 * Probe session token in URL (#265 + #321). @param {string} pageUrl —
 * the pasted page URL. @param {string[]} targetUrls — the scan's
 * target URLs (crawled links + form-derived GET targets). @param
 * {object} opts — { html }: the landing page HTML (fp.body) for the
 * #321 Referer-leak check; without it every finding is the #265
 * variant. @returns {object[]} findings (class
 * 'session_token_in_url', medium) — at most one per (URL, param),
 * capped at MAX_FINDINGS. Synchronous: pure URL inspection, no
 * network.
 */
export function probeSessionTokenInUrl(pageUrl, targetUrls, opts = {}) {
  const findings = [];
  if (typeof pageUrl !== 'string' || !pageUrl) return [];
  try {
    new URL(pageUrl);
  } catch {
    return [];
  }
  // Candidate URLs: the pasted page first, then the scan targets.
  // Dedupe by URL without fragment.
  const candidates = [];
  const seenUrls = new Set();
  const pushCandidate = (u) => {
    if (typeof u !== 'string' || !u) return;
    let norm;
    try {
      norm = new URL(u).toString().split('#')[0];
    } catch {
      return;
    }
    if (seenUrls.has(norm)) return;
    seenUrls.add(norm);
    candidates.push(norm);
  };
  pushCandidate(pageUrl);
  for (const u of Array.isArray(targetUrls) ? targetUrls : []) pushCandidate(u);
  // The #321 leak path only applies to the pasted page itself, whose
  // HTML we have: a token URL on a page loading cross-origin
  // subresources (or linking out) leaks the token in Referer.
  const leak = crossOriginHosts(typeof opts.html === 'string' ? opts.html : '', pageUrl);
  const seen = new Set();
  let n = 0;
  for (const url of candidates) {
    if (findings.length >= MAX_FINDINGS) break;
    const isLandingPage = url === candidates[0];
    for (const { param, value } of extractSessionParams(url)) {
      if (findings.length >= MAX_FINDINGS) break;
      if (!isTokenLike(value)) continue;
      const key = `${url}|${String(param).toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      n += 1;
      const masked = maskToken(value);
      const viaSubresource = isLandingPage && leak.subresources.length > 0;
      const viaLink = isLandingPage && leak.subresources.length === 0 && leak.outboundLinks.length > 0;
      const title = viaSubresource
        ? `Session token in URL leaks via Referer — ${param} on a page loading cross-origin subresources from ${leak.subresources.slice(0, 3).join(', ')}`
        : viaLink
          ? `Session token in URL leaks via Referer — ${param} on a page linking out to ${leak.outboundLinks.slice(0, 3).join(', ')}`
          : `Session token in URL — ${param} carries a session identifier`;
      const leakNote = viaSubresource
        ? ` The page loads cross-origin subresources from ${leak.subresources.slice(0, 3).join(', ')}, so every load sends this token URL as the Referer header to a third party`
        : viaLink
          ? ` The page links out to ${leak.outboundLinks.slice(0, 3).join(', ')}, so following a link sends this token URL as the Referer header`
          : '';
      findings.push({
        class: 'session_token_in_url',
        id: `session-token-in-url-${String(param).toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${n}`,
        title,
        severity: 'medium',
        url,
        parameter: param,
        evidence: {
          request: `GET ${url}`,
          response:
            `URL carries session parameter ${param}=${masked} — a token-like value (length + charset + mixed letters/digits pass the entropy gate).${leakNote}${viaSubresource || viaLink ? ' (#321: Referer leak path)' : ' (#265: token in URL — leaks via logs, shared links, and Referer on outbound navigation)'}`,
          impact_demo:
            'Session identifiers in URLs leak through Referer headers, server logs, browser history, and shared links — anyone who obtains the token can hijack the session (CWE-598, CWE-359 / OWASP A07:2021).',
          signalCorrelated: true,
        },
      });
    }
  }
  return findings;
}

export const __sessionTokenInUrlMeta = { phases: ['session-token-in-url'], depth: ['quick', 'standard', 'deep'] };
