// Dark Matter rule-based scanner — credential disclosure in URL / logs
// (coverage row #41 [High], phase 82).
//
// NARROW DEFINITION (the ledger row is a bare title + generic
// description, so the boundary is written down here, in index.js,
// and in the lane report): this phase detects ONE thing — a
// credential VALUE disclosed where it can be harvested: (1) in a URL
// the scan sees, or (2) echoed in a served response body in a
// log/error context. A credential in a URL leaks via Referer, server
// logs, browser history, and shared links; a credential in a served
// log/error page leaks to anyone who can fetch that page (CWE-359).
//
// A finding counts ONLY when a credential VALUE is present. Two
// signals, and the finding text says which one fired:
//   1. CREDENTIAL IN URL: a scan URL (pasted page, crawled link, or
//      form-derived GET target; query params + `;name=value` path
//      params, fragments ignored) carries a credential param with a
//      non-empty value. Password params (password, passwd, pwd, pass)
//      fire on ANY non-empty value — a password in a URL is a finding
//      regardless of strength. Secret/key params (secret, api_key,
//      apikey, access_key, access_token, private_key, client_secret)
//      require a token-like value (>= 8 chars, token charset, no
//      spaces) so placeholders like `secret=none` / `api_key=test`
//      never fire.
//   2. CREDENTIAL IN SERVED BODY: the landing page HTML (fp.body)
//      echoes a credential assignment in its visible text, outside
//      form inputs — e.g. `password: hunter2` in a <pre> block or a
//      log/error line. <input> tags are stripped before scanning (a
//      form field is not a disclosure), script/style blocks are
//      stripped (secrets in JS are #179's surface), and placeholder
//      values (***, xxx, null, undefined, redacted) never fire.
//
// NON-OVERLAP (by design): session identifiers are NOT credentials
// (#265/#321 own PHPSESSID/JSESSIONID/sessionid/sid — a URL carrying
// BOTH a session param and a credential param fires BOTH phases,
// different findings, different classes — that is correct, not a
// duplicate). CSRF tokens are NOT credentials (csrf_token, _token,
// authenticity_token never fire). `token` / `auth` alone never fire
// (too broad — CSRF/session). `user` / `username` / `email` never
// fire (identifiers, not credentials). Secrets in JS bundles are
// #179's surface (script blocks are stripped here). Secrets in LOG
// FILES are #180's surface: when the landing page URL itself is a
// log surface (isLogSurface), the body half is skipped entirely —
// the body half is for credential values echoed in ordinary
// page/error bodies, not for log-file downloads.
//
// SAFETY: read-only — pure inspection of URLs the scan already holds
// + the fingerprint step's fp.body, ZERO extra requests. A credential
// value is never published in full: evidence shows a masked form
// (first 4 + last 2 chars). One finding per (URL, param), capped at
// 5 URL findings; body findings capped at 2.

import { isLogSurface } from './sensitiveDataInLogs.js';

const MAX_URL_FINDINGS = 5;
const MAX_BODY_FINDINGS = 2;
const MIN_SECRET_LEN = 8;

// Password parameter names (matched case-insensitively, exact name
// match — `password2` or `my_pass` never fire). Any non-empty value
// fires: the disclosure is the defect, whatever the strength.
export const PASSWORD_PARAM_NAMES = new Set([
  'password',
  'passwd',
  'pwd',
  'pass',
]);

// Secret/key parameter names (matched case-insensitively, exact name
// match). Require a token-like value (see isSecretLike) so
// placeholders never fire.
export const SECRET_PARAM_NAMES = new Set([
  'secret',
  'api_key',
  'apikey',
  'access_key',
  'access_token',
  'private_key',
  'client_secret',
]);

// The secret charset after percent-decoding: alphanumerics plus
// `-_+=/.` (base64/base64url + dotted version-ish keys). A space,
// quote, or angle bracket means the value is not a token.
const SECRET_RE = /^[A-Za-z0-9\-_+=/.]+$/;

// Does this value look like a secret/key? Length + charset.
// Exported for unit tests.
export function isSecretLike(raw) {
  let value = String(raw || '');
  try {
    value = decodeURIComponent(value);
  } catch {
    // Keep the raw value when decoding fails — the charset gate
    // below still decides.
  }
  if (value.length < MIN_SECRET_LEN) return false;
  if (!SECRET_RE.test(value)) return false;
  return true;
}

// Mask a credential value for evidence: first 4 + last 2 chars +
// length. Short values show the first 2 chars only. The full value
// is never published.
export function maskCredential(raw) {
  const value = String(raw || '');
  if (value.length <= 8) return `${value.slice(0, 2)}… (${value.length} chars)`;
  return `${value.slice(0, 4)}…${value.slice(-2)} (${value.length} chars)`;
}

// Extract credential params from one URL: query params plus
// `;name=value` path params. Returns [{ param, value, kind }] with
// the param name as written and kind 'password' | 'secret'.
// Exported for unit tests.
export function extractCredentialParams(urlString) {
  const found = [];
  let u;
  try {
    u = new URL(urlString);
  } catch {
    return found;
  }
  const push = (name, value) => {
    const lower = String(name).toLowerCase();
    if (PASSWORD_PARAM_NAMES.has(lower)) {
      found.push({ param: name, value, kind: 'password' });
    } else if (SECRET_PARAM_NAMES.has(lower)) {
      found.push({ param: name, value, kind: 'secret' });
    }
  };
  for (const [name, value] of u.searchParams) push(name, value);
  for (const m of u.pathname.matchAll(/;([^;/?=]+)=([^;/?#]*)/g)) {
    let value = m[2];
    try {
      value = decodeURIComponent(value);
    } catch {
      // Keep the raw value — the gates below still decide.
    }
    push(m[1], value);
  }
  return found;
}

// Is this a placeholder rather than a real credential value?
// Exported for unit tests.
export function isPlaceholder(raw) {
  const value = String(raw || '').trim().toLowerCase();
  if (!value) return true;
  if (/^\*+$/.test(value)) return true;
  if (/^x+$/.test(value)) return true;
  return ['null', 'undefined', 'redacted'].includes(value);
}

// A credential assignment line in visible text:
// `password: hunter2`, `api_key = AKIA...`, `secret=hunter2`.
// The captured value must be >= 4 non-space chars.
const BODY_CRED_RE =
  /\b(password|passwd|pwd|secret|api[_-]?key)\s*[:=]\s*(\S{4,})/gi;

// Clean a captured body value: strip surrounding quotes and trailing
// punctuation the regex swept in (commas, periods, closing brackets).
function cleanBodyValue(raw) {
  let value = String(raw || '').trim();
  value = value.replace(/^["'`]+/, '').replace(/["'`]+$/, '');
  value = value.replace(/[,;:.]+$/, '');
  value = value.replace(/[)\]}>]+$/, '');
  return value;
}

// Find credential echoes in visible page text. The HTML is reduced
// to visible text first: comments, script/style blocks, and <input>
// tags are removed (a form field is not a disclosure; secrets in JS
// are #179's surface), then all remaining tags are stripped.
// Returns [{ param, value }] in first-seen order, one per param.
// Exported for unit tests.
export function extractBodyCredentials(html) {
  const out = [];
  if (typeof html !== 'string' || !html) return out;
  const noComments = html.replace(/<!--[\s\S]*?-->/g, '');
  const noScripts = noComments
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '');
  const noInputs = noScripts.replace(/<input\b[^>]*>/gi, '');
  const text = noInputs.replace(/<[^>]*>/g, '\n');
  const seen = new Set();
  for (const line of text.split('\n')) {
    BODY_CRED_RE.lastIndex = 0;
    for (const m of line.matchAll(BODY_CRED_RE)) {
      const param = m[1].toLowerCase();
      const value = cleanBodyValue(m[2]);
      if (value.length < 4) continue;
      if (isPlaceholder(value)) continue;
      if (seen.has(param)) continue;
      seen.add(param);
      out.push({ param, value });
    }
  }
  return out;
}

/**
 * Probe credential disclosure in URL / logs (#41). @param {string}
 * pageUrl — the pasted page URL. @param {string[]} targetUrls — the
 * scan's target URLs (crawled links + form-derived GET targets).
 * @param {object} opts — { html }: the landing page HTML (fp.body)
 * for the body half; without it every finding is the URL variant.
 * @returns {object[]} findings (class 'credential_disclosure',
 * high) — at most one per (URL, param), capped at
 * MAX_URL_FINDINGS, plus at most MAX_BODY_FINDINGS body findings.
 * Synchronous: pure inspection, no network.
 */
export function probeCredentialDisclosure(pageUrl, targetUrls, opts = {}) {
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
  // Signal 1 — CREDENTIAL IN URL.
  const seen = new Set();
  let n = 0;
  for (const url of candidates) {
    if (findings.length >= MAX_URL_FINDINGS) break;
    for (const { param, value, kind } of extractCredentialParams(url)) {
      if (findings.length >= MAX_URL_FINDINGS) break;
      // Password params fire on any non-empty value; secret/key
      // params need a token-like value.
      const decoded = (() => {
        try {
          return decodeURIComponent(String(value));
        } catch {
          return String(value);
        }
      })();
      if (kind === 'password') {
        if (!decoded.trim()) continue;
      } else if (!isSecretLike(decoded)) {
        continue;
      }
      const key = `${url}|${String(param).toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      n += 1;
      const masked = maskCredential(decoded);
      const kindWord = kind === 'password' ? 'a password' : 'a secret/API key';
      findings.push({
        class: 'credential_disclosure',
        id: `credential-disclosure-${String(param).toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${n}`,
        title: `Credential disclosure in URL — ${param} carries ${kindWord}`,
        severity: 'high',
        url,
        parameter: param,
        evidence: {
          request: `GET ${url}`,
          response:
            `URL carries credential parameter ${param}=${masked} — a non-empty credential value in a URL, visible to anyone who sees the link.`,
          impact_demo:
            'Credentials in URLs leak through Referer headers, server logs, browser history, and shared links — anyone who obtains the value can impersonate the user or use the key (CWE-359).',
          signalCorrelated: true,
        },
      });
    }
  }
  // Signal 2 — CREDENTIAL IN SERVED BODY (landing page only).
  // Skipped when the landing page itself is a log file: secrets in
  // log-file bodies are #180's surface, not this probe's.
  const html = typeof opts.html === 'string' ? opts.html : '';
  if (html && !isLogSurface(pageUrl)) {
    const bodyCreds = extractBodyCredentials(html);
    for (const { param, value } of bodyCreds.slice(0, MAX_BODY_FINDINGS)) {
      n += 1;
      const masked = maskCredential(value);
      findings.push({
        class: 'credential_disclosure',
        id: `credential-disclosure-body-${String(param).toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${n}`,
        title: `Credential value echoed in page body — ${param} in visible text`,
        severity: 'high',
        url: pageUrl,
        parameter: param,
        evidence: {
          request: `GET ${pageUrl}`,
          response:
            `Landing page echoes a credential assignment in its visible text: ${param} = ${masked} — outside any form input, readable by anyone who fetches the page.`,
          impact_demo:
            'A credential echoed in a served page leaks to anyone who can fetch that page — no login needed to harvest it (CWE-359).',
          signalCorrelated: true,
        },
      });
    }
  }
  return findings;
}

export const __credentialDisclosureMeta = { phases: ['credential-disclosure'], depth: ['quick', 'standard', 'deep'] };
