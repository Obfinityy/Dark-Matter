// Dark Matter rule-based scanner — missing authentication for critical
// function probe (coverage row #47 [Critical]; DEFAULT_PHASES was 86
// when it landed).
//
// CWE-306 (Missing Authentication for Critical Function), ASVS V4.1:
// a critical function (admin, management, setup, config, backup,
// debug, ...) that answers an unauthenticated request with
// authenticated-only content is callable without any login.
//
// STRICT all-four-conjunct gate (decided BEFORE any proof run, on
// OWASP/ASVS grounds — do NOT tune it to force a lab outcome). A
// candidate fires ONLY if ALL hold:
//   1. Direct 200 — any 3xx (login redirect or moved), 401, 403, 404,
//      or 5xx = NO fire. A redirect to a login page is correct
//      behaviour, not a finding. Redirects are NEVER followed.
//   2. Not the SPA catch-all — a random nonexistent path on the same
//      origin must NOT return 200 with a near-identical body (the
//      files.js anti-SPA oracle, reused here).
//   3. Authenticated-content markers present AND no login form — the
//      body carries an authenticated marker (a logout / sign-out LINK,
//      "Admin Dashboard" page text, user-management markers, or a
//      settings/admin form) AND contains NO password input and NO
//      "sign in to continue" text. A 200 login page is NOT a finding.
//      A bare word ("dashboard" alone, version strings, public docs)
//      is NOT a marker. The logout branch needs a real link (an
//      anchor/button/form pointing at a logout URL, or anchor text
//      "log out" / "sign out") — the bare word "logout" in prose is
//      not a marker. Residual risk, stated honestly: a public page
//      under a sensitive segment that carries a shared-header logout
//      link could false-positive; the finding text quotes the matched
//      marker so a human can judge.
//   4. Content-Type HTML or JSON — assets (images, JS, CSS) never
//      fire. An empty content-type is sniffed (HTML/JSON start only).
//
// SAFETY: read-only unauthenticated GETs only, capped at 12 requests
// per scan (discovered candidates first, then the fixed list) + 1
// catch-all baseline request. No cookies, no Authorization header.
// Every request failure is treated as "not exposed" — the phase stays
// ok:true on fetch trouble. One finding per URL, capped at 3/scan.
// Always-run phase: the fixed candidate list is never empty, so the
// phase runs and reports 0 findings on a bare page (the 'files'
// precedent) — no gated skip.
//
// NON-OVERLAP (by design): idor.js is URL-only with no network;
// files.js probes sensitive FILES (.env, .git/HEAD, ...) with its own
// oracle — different target class (files, not functions). Nothing
// else in the scanner requests an admin/management URL without
// credentials and checks what comes back.
const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
const MAX_REQUESTS = 12;
const MAX_FINDINGS = 3;
const TIMEOUT_MS = 15000;

// Sensitive-function path segments (tight, predefined, 20). Segment
// match is case-insensitive; query strings ignored for matching.
export const SENSITIVE_FUNCTION_SEGMENTS = [
  'admin', 'administrator', 'manage', 'manager', 'console', 'setup',
  'install', 'config', 'configuration', 'backup', 'debug', 'actuator',
  'dashboard', 'control-panel', 'superuser', 'sysadmin', 'wp-admin',
  'phpmyadmin', 'private', 'internal', 'staff',
];

// Fixed candidate paths, resolved against the page origin. The fixed
// list is never empty, so the phase always runs (always-run phase).
export const FIXED_FUNCTION_PATHS = [
  '/admin', '/administrator', '/admin.php', '/manage', '/manager',
  '/console', '/setup', '/setup.php', '/install', '/config', '/backup',
  '/debug',
];

// Default fetcher: unauthenticated GET, redirects NEVER followed
// (fingerprint.fetchPage follows redirects — wrong here: a 3xx to a
// login page must read as "not exposed", not as the login page's
// 200). Returns the fingerprint.fetchPage shape { status, headers,
// body } so opts.fetchPage can be the same seam in tests.
async function defaultFetchPage(url, { timeoutMs = TIMEOUT_MS } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'manual', // never follow: a 3xx is NOT exposure
      headers: { 'User-Agent': UA },
    });
    const headers = {};
    for (const [k, v] of res.headers) headers[k.toLowerCase()] = v;
    let body = '';
    try {
      body = await res.text();
    } catch {
      body = '';
    }
    return { status: res.status, headers, body: body.slice(0, 50000) };
  } finally {
    clearTimeout(t);
  }
}

// Normalise a fetch response to { status, contentType, body }.
// Accepts the fingerprint shape { status, headers, body } and, defensively,
// the files.js shape { status, contentType, text }.
function normalizeResponse(res) {
  const headers = res.headers || {};
  const contentType = String(
    headers['content-type'] || headers['Content-Type'] || res.contentType || ''
  ).toLowerCase();
  const body =
    typeof res.body === 'string' ? res.body : typeof res.text === 'string' ? res.text : '';
  return { status: res.status, contentType, body: String(body).slice(0, 50000) };
}

// Catch-all baseline: fetch one random nonexistent path. If the origin
// answers 200 with the same body as a candidate, that "finding" is the
// SPA catch-all (files.js pattern).
async function catchAllBaseline(base, fetchOne) {
  const nonce = `dm-spa-check-${Math.random().toString(36).slice(2, 12)}`;
  return fetchOne(`${base}/${nonce}`);
}

function sameAsBaseline(res, baseline) {
  if (!baseline || baseline.status !== 200 || res.status !== 200) return false;
  const a = res.body;
  const b = baseline.body;
  if (Math.abs(a.length - b.length) > Math.max(200, b.length * 0.15)) return false;
  return a.slice(0, 200) === b.slice(0, 200);
}

function pathSegments(pathname) {
  return String(pathname || '')
    .split('/')
    .filter(Boolean)
    .map((s) => {
      try {
        return decodeURIComponent(s).toLowerCase();
      } catch {
        return s.toLowerCase();
      }
    });
}

// Does this URL's path carry a sensitive-function segment? Query
// strings and fragments are ignored for matching.
export function isSensitiveCandidate(url) {
  let path = '';
  try {
    path = new URL(url).pathname;
  } catch {
    return false;
  }
  return pathSegments(path).some((s) => SENSITIVE_FUNCTION_SEGMENTS.includes(s));
}

// Candidate inventory: discovered sensitive targets first (in scan
// order), then the fixed list, deduped by normalized URL (fragment
// stripped, trailing slash stripped), capped at MAX_REQUESTS.
// Exported for unit tests.
export function candidateUrls(pageUrl, scanTargets) {
  let origin;
  try {
    origin = new URL(pageUrl).origin;
  } catch {
    return [];
  }
  const seen = new Set();
  const out = [];
  const push = (u) => {
    let norm;
    try {
      const parsed = new URL(u);
      parsed.hash = '';
      norm = parsed.href.replace(/\/$/, '');
    } catch {
      return;
    }
    if (seen.has(norm)) return;
    seen.add(norm);
    out.push(norm);
  };
  for (const u of Array.isArray(scanTargets) ? scanTargets : []) {
    if (typeof u !== 'string' || !u) continue;
    if (!isSensitiveCandidate(u)) continue;
    push(u);
  }
  for (const p of FIXED_FUNCTION_PATHS) push(origin + p);
  return out.slice(0, MAX_REQUESTS);
}

// --- Gate 3: authenticated-content markers ---------------------------------
// Each entry is { label, test } where test(body) returns a snippet string
// (the matched text, for the evidence) or null. A bare word is never a
// marker: "dashboard" needs the "Admin Dashboard" phrase, "logout"
// needs a real link, "role" needs a user record or a JSON key.

// Logout / sign-out LINK: an anchor, button, or form pointing at a
// logout URL, or anchor/button text "log out" / "sign out".
const LOGOUT_LINK = [
  /<a[^>]*href\s*=\s*["'][^"']*(logout|log-out|sign[\s_-]?out)[^"']*["']/i,
  /<a[^>]*>\s*(log\s*out|sign\s*out)\s*<\/a>/i,
  /<button[^>]*>\s*(log\s*out|sign\s*out)\s*<\/button>/i,
  /<form[^>]*action\s*=\s*["'][^"']*(logout|sign[\s_-]?out)[^"']*["']/i,
];

const MARKER_TESTS = [
  {
    label: 'logout/sign-out link',
    test: (body) => matchSnippet(body, LOGOUT_LINK),
  },
  {
    label: '"Admin Dashboard" page text',
    test: (body) => matchSnippet(body, [/admin\s+dashboard/i]),
  },
  {
    label: 'user-management content',
    test: (body) => {
      if (hasUserRecords(body)) return 'user records with role fields';
      return matchSnippet(body, [/user\s+management/i, /manage\s+users/i, /["'](?:role|roles|isAdmin|is_admin|permissions)["']\s*:/i]);
    },
  },
  {
    label: 'settings/admin form',
    test: (body) =>
      matchSnippet(body, [
        /<form[^>]*(settings|admin|config|preferences)/i,
        /(save|update)\s+settings/i,
      ]),
  },
];

function matchSnippet(body, patterns) {
  for (const re of patterns) {
    const m = String(body).match(re);
    if (m) return snippetAround(body, m.index, m[0].length);
  }
  return null;
}

function snippetAround(body, index, length) {
  const start = Math.max(0, index - 40);
  const end = Math.min(body.length, index + length + 80);
  return String(body.slice(start, end)).replace(/\s+/g, ' ').trim().slice(0, 200);
}

// JSON array of user records carrying role fields: [{ id, username,
// role }, ...] or a { users: [...] } / { data: [...] } wrapper. A
// version/status JSON object never matches: the rows must look like
// user records (a user-ish key AND a role-ish key).
const ROLE_KEYS = new Set(['role', 'roles', 'isadmin', 'is_admin', 'admin', 'permissions', 'userrole']);
const USER_KEYS = new Set(['id', 'username', 'user', 'email', 'name', 'userid', 'user_id']);

function hasUserRecords(body) {
  let parsed;
  try {
    parsed = JSON.parse(String(body).trim());
  } catch {
    return false;
  }
  const rows = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object'
      ? parsed.users || parsed.data || parsed.items || []
      : [];
  if (!Array.isArray(rows) || rows.length === 0) return false;
  return rows.slice(0, 5).some((r) => {
    if (!r || typeof r !== 'object' || Array.isArray(r)) return false;
    const keys = Object.keys(r).map((k) => k.toLowerCase());
    return keys.some((k) => USER_KEYS.has(k)) && keys.some((k) => ROLE_KEYS.has(k));
  });
}

// Login-form veto: any password input, or "sign in to continue" text.
// A 200 that serves a login form is NOT a finding, even if it also
// carries an admin marker (e.g. a settings page behind a login wall
// that echoes the login form).
function hasLoginVeto(body) {
  const b = String(body);
  if (/<input[^>]*(type\s*=\s*["']?password["']?|name\s*=\s*["']?(password|passwd|pwd)["']?)/i.test(b)) return true;
  if (/sign\s*in\s+to\s+continue/i.test(b)) return true;
  return false;
}

function findAuthMarker(body) {
  for (const m of MARKER_TESTS) {
    const snippet = m.test(body);
    if (snippet) return { label: m.label, snippet };
  }
  return null;
}

// Content-Type gate: HTML or JSON only. An empty content-type is
// sniffed (HTML/JSON start only); any other type never fires.
function isHtmlOrJson(contentType, body) {
  const ct = String(contentType || '').toLowerCase();
  if (ct.includes('text/html') || ct.includes('application/json') || ct.includes('+json')) return true;
  if (!ct) {
    const t = String(body || '').trimStart();
    return t.startsWith('<') || t.startsWith('{') || t.startsWith('[');
  }
  return false;
}

function findingId(pathname) {
  const slug = String(pathname || '')
    .split('/')
    .filter(Boolean)
    .join('-')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return `missing-auth-${slug || 'root'}`;
}

/**
 * Probe missing authentication for critical functions (#47).
 * @param {string} pageUrl — the pasted page URL.
 * @param {string[]} scanTargets — the scan's discovered target URLs.
 * @param {object} opts — { fetchPage } seam (defaults to a local
 *   unauthenticated fetcher with redirect:'manual').
 * @returns {Promise<object[]>} findings (class 'missing_auth',
 *   critical) — at most one per URL, capped at MAX_FINDINGS.
 */
export async function probeMissingAuth(pageUrl, scanTargets, opts = {}) {
  const findings = [];
  if (typeof pageUrl !== 'string' || !pageUrl) return [];
  let origin;
  try {
    origin = new URL(pageUrl).origin;
  } catch {
    return [];
  }
  const fetchFn = typeof opts.fetchPage === 'function' ? opts.fetchPage : defaultFetchPage;
  const fetchOne = async (url) => {
    try {
      return normalizeResponse(await fetchFn(url, { timeoutMs: TIMEOUT_MS }));
    } catch {
      return null;
    }
  };
  try {
    const candidates = candidateUrls(pageUrl, scanTargets);
    if (candidates.length === 0) return [];
    const baseline = await catchAllBaseline(origin, fetchOne);
    for (const url of candidates) {
      if (findings.length >= MAX_FINDINGS) break;
      const res = await fetchOne(url);
      if (!res || res.status !== 200) continue; // gate 1: direct 200 only
      if (!isHtmlOrJson(res.contentType, res.body)) continue; // gate 4
      if (sameAsBaseline(res, baseline)) continue; // gate 2: not the SPA catch-all
      if (hasLoginVeto(res.body)) continue; // gate 3: no login form
      const marker = findAuthMarker(res.body);
      if (!marker) continue; // gate 3: authenticated-content marker required
      let pathname = '';
      try {
        pathname = new URL(url).pathname;
      } catch {
        pathname = url;
      }
      findings.push({
        class: 'missing_auth',
        id: findingId(pathname),
        title: `Critical function reachable without authentication — ${pathname}`,
        severity: 'critical',
        url,
        evidence: {
          request: `GET ${url} (unauthenticated, redirects not followed)`,
          response:
            `HTTP 200 (direct, no redirect) content-type="${res.contentType || 'none'}"` +
            ` with authenticated-content marker (${marker.label}): "${marker.snippet}"`,
          impact_demo:
            'A critical function (admin / management / setup) answers an unauthenticated request with authenticated-only content — anyone on the internet can call it without logging in. Unauthenticated access to admin functions lets an attacker manage users, change settings, or read sensitive data (CWE-306, ASVS V4.1).',
          signalCorrelated: true,
        },
      });
    }
  } catch {
    // A throwing probe must never fail the phase: return what fired so far.
  }
  return findings;
}

export const __missingAuthMeta = { phases: ['missing-auth'], depth: ['quick', 'standard', 'deep'] };
