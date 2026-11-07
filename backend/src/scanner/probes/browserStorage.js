// Dark Matter rule-based scanner — sensitive data in browser
// local/session storage probe (coverage row #97 [Medium], phase 85).
//
// NARROW DEFINITION (the ledger row is a bare title, so the boundary
// is written down here, in index.js, and in the lane report): this
// phase detects ONE thing — the app WRITES sensitive data (auth
// tokens, session material, passwords, secrets) into
// `localStorage` / `sessionStorage`, where any script running in the
// origin can read it (ASVS V8; OWASP Cheat Sheet Series, HTML5
// security: sensitive data must not be stored in web storage, because
// web storage is readable by JavaScript and therefore by any XSS, any
// compromised third-party script, and any malicious extension context
// in the origin; unlike an HttpOnly cookie it has no read barrier at
// all). The signal is STATIC: a write call in the page's own
// same-origin JS bundles or inline <script> blocks — the exact
// reframing that shipped #179 secrets-in-js (phase 69).
//
// A finding counts ONLY when ALL THREE hold:
//   1. It is a WRITE — `setItem('key', …)` or a direct assignment
//      (`localStorage.key = …`, `localStorage['key'] = …`, with an
//      optional `window.` prefix). READS (`getItem`, a bare
//      `localStorage.key` read, `key in localStorage`) NEVER fire —
//      reading creates no exposure.
//   2. The key is a STATIC string literal naming sensitive material
//      — it must be in the SENSITIVE_STORAGE_KEYS allowlist below.
//      Dynamic / variable keys never fire (sensitivity unprovable).
//      A non-sensitive key (`theme`, `bid`, `cart`, …) can NEVER fire,
//      whatever the value is. `'email'` is DELIBERATELY not in the
//      allowlist in v1 (PII, not auth material — follow-up, not v1).
//   3. The value is NOT a placeholder literal — when the call's value
//      IS a string literal containing test / example / dummy / sample /
//      placeholder / changeme (the PLACEHOLDER_RE shape from
//      secretsInJs.js), it is a doc example or a test fixture, never
//      a stored secret.
//
// GATE DECISION (7 Nov 2026, chosen on OWASP/ASVS grounds BEFORE any
// proof run — recorded in the lane report): STRICT writes-only +
// static-literal-key + allowlist-only-sensitive-name. BOTH stores
// count: `localStorage` persists across sessions (worse),
// `sessionStorage` is tab-scoped but readable by ANY script executing
// in the origin. The finding text names which store it is and states
// the persistence difference — persistence is never overclaimed for a
// sessionStorage finding. Consequence, stated up front: Juice Shop's
// `main.js` stores its login JWT with
// `localStorage.setItem("token", …)` (verified live 7 Nov ~22:10 IST),
// so the Juice proof leg is expected to be 1 real [Medium] finding,
// not a true negative; DVWA serves no storage writes at all, so the
// DVWA leg is expected to be a true negative. The gate is not tuned
// to force either outcome.
//
// VERIFICATION: the write call site IS the evidence (store, key,
// bundle URL, line number, redacted snippet), so the differential
// verifier judges this on the default protocol (signalCorrelated).
// The class name 'browser_storage' is routed by protocolFor to the
// default protocol: it matches no family branch (no 'sqli'/'xss'/
// 'idor'/'ssrf'/'bypass' substring, no 'oob' suffix, and none of the
// protocol keys) — verified by a unit test that calls
// assessConfirmation on a probe finding and expects 'confirmed'.
//
// SAFETY: read-only GETs of the page's own same-origin script bundles
// (cap 5, the jsRoutes cap) plus the page's inline <script> blocks
// (cap 10) — no writes, no allowWrite gate, same-origin only.
// Bundles are fetched with fingerprint.fetchPage (opts.fetchPage is
// the test seam, mirroring probeSecretsInJs). One finding per
// (store, key); max 5 findings per scan.
import { fetchPage } from '../fingerprint.js';
import { JS_ROUTES_MAX_BUNDLES } from '../jsRoutes.js';

const MAX_BUNDLES = JS_ROUTES_MAX_BUNDLES; // 5, same cap as jsRoutes
const MAX_INLINE = 10;
const MAX_FINDINGS = 5;
const SNIPPET_RADIUS = 80;
const VALUE_LOOKAHEAD = 200;

// Sensitive-key ALLOWLIST — only these exact key names ever fire.
// A write under any other name is not a finding, whatever the value
// is. Case-sensitive: 'token' and 'accessToken' are distinct entries
// because bundles use both spellings. 'email' is deliberately
// absent (PII, not auth material — v1 follow-up).
export const SENSITIVE_STORAGE_KEYS = new Set([
  'token',
  'authtoken',
  'auth_token',
  'access_token',
  'accessToken',
  'id_token',
  'idToken',
  'refresh_token',
  'refreshToken',
  'session',
  'sessionid',
  'session_id',
  'session_token',
  'password',
  'passwd',
  'secret',
  'api_key',
  'apikey',
  'apiKey',
  'credential',
  'credentials',
  'jwt',
  'bearer',
  'auth',
]);

// Placeholder / example markers — the PLACEHOLDER_RE shape from
// secretsInJs.js: a literal VALUE containing one of these is a doc
// example or a test fixture, never a stored secret.
const PLACEHOLDER_RE =
  /(test|example|dummy|sample|placeholder|your[-_]?key|changeme|todo|fake|mock|demo|xxx+|lorem|abcdef|123456|qwerty|000000|111111)/i;

// Write call forms. The key must be a STATIC string literal (single
// or double quotes) — a variable / template key never matches.
//   setItem:  localStorage.setItem('key', …) / window.sessionStorage.setItem("key", …)
//   dot:      localStorage.key = … / window.sessionStorage.key = …
//   bracket:  localStorage['key'] = … / sessionStorage["key"] = …
const SETITEM_RE =
  /(?:window\.)?(localStorage|sessionStorage)\.setItem\(\s*(['"])([A-Za-z0-9_$]+)\2\s*,/g;
const DOT_ASSIGN_RE =
  /(?:window\.)?(localStorage|sessionStorage)\.([A-Za-z_$][A-Za-z0-9_$]*)\s*=(?!=)/g;
const BRACKET_ASSIGN_RE =
  /(?:window\.)?(localStorage|sessionStorage)\[\s*(['"])([A-Za-z0-9_$]+)\2\s*\]\s*=(?!=)/g;

// The `=(?!=)` lookahead in the assignment forms keeps a comparison
// read (`localStorage.token == 'x'`) from matching as a write: the
// first `=` of `==` is followed by another `=`, so it never fires.

function isPlaceholder(value) {
  return PLACEHOLDER_RE.test(String(value || ''));
}

// First 4 chars + '…' + last 4 chars — enough to prove the literal,
// never enough to use it. Short values redact fully. (Same shape as
// redactSecret in secretsInJs.js.)
function redactValue(value) {
  const v = String(value || '');
  if (v.length <= 8) return '…(redacted)';
  return `${v.slice(0, 4)}…${v.slice(-4)}`;
}

// Line number (1-based) of an offset in a body.
function lineOf(body, offset) {
  let n = 1;
  for (let i = 0; i < offset && i < body.length; i += 1) {
    if (body[i] === '\n') n += 1;
  }
  return n;
}

// A redacted snippet around the match — newlines flattened; a literal
// value, when present, is replaced by its redacted form.
function snippetAround(body, matchIndex, matchLength, literal, redacted) {
  const start = Math.max(0, matchIndex - SNIPPET_RADIUS);
  const end = Math.min(body.length, matchIndex + matchLength + SNIPPET_RADIUS);
  let snip = body.slice(start, end).replace(/\s+/g, ' ').trim();
  if (start > 0) snip = `…${snip}`;
  if (end < body.length) snip = `${snip}…`;
  if (literal !== null && literal !== '') {
    const at = snip.indexOf(literal);
    if (at >= 0) snip = snip.slice(0, at) + redacted + snip.slice(at + literal.length);
  }
  return snip.slice(0, 400);
}

// The call's value, when it is a string literal: the literal text
// starting at `offset` (after the comma / `=`), or null when the
// value is a variable or an expression.
function literalValueAfter(body, offset) {
  const rest = body.slice(offset, offset + VALUE_LOOKAHEAD).trimStart();
  const q = rest[0];
  if (q !== "'" && q !== '"') return null;
  const end = rest.indexOf(q, 1);
  if (end < 0) return null;
  return rest.slice(1, end);
}

// Persistence sentence per store — the finding text must name the
// store and state the persistence difference, never overclaiming a
// sessionStorage finding.
function persistenceNote(store) {
  return store === 'localStorage'
    ? 'localStorage persists across browser restarts — the value stays readable to any script in the origin until it is cleared'
    : 'sessionStorage is tab-scoped (cleared when the tab closes) — but while the tab lives, any script in the origin can read it';
}

// Scan one source body (a bundle or an inline block) and push
// findings. `sourceUrl` is the URL the finding is filed under;
// `sourceLabel` names the source in the evidence. Dedup is on
// store + key across the whole probe run — the first call site seen
// is cited.
function scanBody(body, sourceUrl, sourceLabel, findings, seen) {
  const text = typeof body === 'string' ? body : '';
  if (!text) return;
  const forms = [
    { re: SETITEM_RE, store: 1, key: 3 },
    { re: DOT_ASSIGN_RE, store: 1, key: 2 },
    { re: BRACKET_ASSIGN_RE, store: 1, key: 3 },
  ];
  for (const { re, store: storeGroup, key: keyGroup } of forms) {
    const rx = new RegExp(re.source, re.flags);
    let m;
    while ((m = rx.exec(text)) !== null) {
      const store = m[storeGroup];
      const key = m[keyGroup];
      if (!SENSITIVE_STORAGE_KEYS.has(key)) continue;
      const valueOffset = m.index + m[0].length;
      const literal = literalValueAfter(text, valueOffset);
      if (literal !== null && isPlaceholder(literal)) continue;
      const dedupKey = `${store}|${key}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);
      const redacted = literal !== null ? redactValue(literal) : null;
      const line = lineOf(text, m.index);
      const snip = snippetAround(text, m.index, m[0].length, literal, redacted);
      findings.push({
        class: 'browser_storage',
        id: `browser-storage-${store}-${key}`,
        title:
          store === 'localStorage'
            ? `Sensitive data stored in localStorage — '${key}' written to browser storage that survives browser restart`
            : `Sensitive data stored in sessionStorage — '${key}' written to tab-scoped browser storage (cleared when the tab closes)`,
        severity: 'medium',
        url: sourceUrl,
        parameter: key,
        evidence: {
          request:
            sourceLabel.startsWith('inline')
              ? `inline <script> block on ${sourceUrl} (page body already fetched)`
              : `GET ${sourceUrl} (same-origin script bundle)`,
          response:
            `${store} write of sensitive key '${key}' at line ${line} in ${sourceLabel}; ` +
            `${persistenceNote(store)}. The value is readable by any script running in this ` +
            `origin (via XSS, a compromised third-party script, or a malicious extension ` +
            `context) — reading the store needs script execution in the origin, so this is ` +
            `a storage defect, not a proven exploit. Snippet: ${snip}`,
          impact_demo:
            'Web-storage read primitive — web storage is readable by ANY JavaScript in the origin (XSS, compromised third-party script, malicious extension); unlike an HttpOnly cookie it has no read barrier at all. A stored auth token / session secret lets the reader act as the user; move auth material to an HttpOnly, Secure, SameSite cookie or keep it in memory only (ASVS V8, OWASP HTML5 Security Cheat Sheet).',
          signalCorrelated: true,
        },
      });
      if (findings.length >= MAX_FINDINGS) return;
    }
    if (findings.length >= MAX_FINDINGS) return;
  }
}

/**
 * Probe sensitive data in browser local/session storage (#97).
 * @param {string} pageUrl — the pasted page URL (findings on inline
 *   scripts are filed under it).
 * @param {object} targets — { bundles: [urls], inline: [bodies] }
 *   from extractSecretTargets (runScan computes it from the page
 *   body so a script-less page skips instead of fetching).
 * @param {object} opts — { timeoutMs, headers, fetchPage }.
 *   fetchPage is the test seam (defaults to fingerprint.fetchPage).
 * @returns {object[]} findings (class 'browser_storage', medium) —
 *   at most 1 per (store, key), max 5 per scan.
 */
export async function probeBrowserStorage(pageUrl, targets, opts = {}) {
  const findings = [];
  const fetchFn = typeof opts.fetchPage === 'function' ? opts.fetchPage : fetchPage;
  const bundles = Array.isArray(targets && targets.bundles)
    ? targets.bundles.slice(0, MAX_BUNDLES)
    : [];
  const inline = Array.isArray(targets && targets.inline)
    ? targets.inline.slice(0, MAX_INLINE)
    : [];
  const seen = new Set();
  for (const bundleUrl of bundles) {
    let res;
    try {
      res = await fetchFn(bundleUrl, opts);
    } catch {
      continue;
    }
    if (!res || res.status !== 200 || !res.body) continue;
    scanBody(res.body, bundleUrl, `script bundle ${bundleUrl}`, findings, seen);
    if (findings.length >= MAX_FINDINGS) return findings;
  }
  inline.forEach((body, i) => {
    if (findings.length >= MAX_FINDINGS) return;
    scanBody(body, pageUrl, `inline <script> block #${i + 1} on ${pageUrl}`, findings, seen);
  });
  return findings;
}

export const __browserStorageMeta = { phases: ['browser-storage'], depth: ['quick', 'standard', 'deep'] };
