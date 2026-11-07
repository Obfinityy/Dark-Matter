// Dark Matter rule-based scanner — sensitive data in logs
// (coverage row #180 [High], phase 75).
//
// DIAGNOSIS: a log file or log-viewer path served over plain HTTP
// that records the application's own secrets — a password or API key
// written to app.log, an Authorization header echoed into access.log,
// an AWS key or private key in a debug dump, a credit-card number in
// a payment log — hands an unauthenticated attacker live credentials
// without any login. Logs are written for operators and then
// forgotten; the finding is the secret itself, already sitting on a
// public URL.
//
// VERIFICATION (100% truth rule): a finding counts ONLY when a
// fetched log surface actually contains a genuinely sensitive value.
// Benign log lines (timestamps, IPs, status codes, user-agents, a
// bare word like "password" with no value, a placeholder such as
// changeme / *** / ${DB_PASS}) are NEVER findings. The value must
// look like a real secret: at least 8 characters and (a digit, a
// symbol, or 12+ characters). Card numbers must pass Luhn. A value
// already printed on the pasted page is NEVER a finding (mandatory
// baseline differential). A body identical to the catch-all control
// (a nonexistent path in the same directory) is an SPA fallback,
// not a log. One finding per distinct file + sensitive kind. The
// secret itself is NEVER published in evidence — values are masked
// (first 4 + last 2 chars; cards show the last 4 digits only;
// private keys show the BEGIN marker only).
//
// NON-OVERLAP (by design): this probe reads SERVED logs for the
// app's OWN secrets. Error responses are owned by
// 'error-disclosure' (this probe only examines HTTP 200 bodies
// that are not HTML documents); JS bundle contents are owned by
// 'secrets-in-js' (.js/.ts candidates are never fetched);
// attacker-controlled data reflected INTO logs is owned by
// 'csv-log-injection' (this probe sends no payloads and checks no
// reflections — the opposite direction). HTML log-viewer pages are
// OUT OF SCOPE (raw log files only — an HTML viewer rendering log
// lines inside markup is not parsed; honest open item).
//
// SAFETY: read-only GETs only — no writes, no allowWrite gate.
// Baseline page (HTML, via the fetchPage seam) + catch-all control
// + up to 10 log candidates (text, via the same seam). The pasted
// page is always a surface, so this phase never skips.
import { createHash } from 'node:crypto';
import { fetchPage } from '../fingerprint.js';

const MAX_CANDIDATES = 10;
const MAX_FETCHES = 12; // baseline + catch-all + 10 candidates
const MAX_FINDINGS = 20;
const MAX_SCAN_CHARS = 1024 * 1024; // bound regex work per file
const NONEXISTENT_LEAF = 'dm-nonexistent-7b31e9d2.txt';

// Fixed log surfaces probed on every scan (same-origin only).
const LOG_PATHS = [
  '/logs',
  '/log',
  '/admin/logs',
  '/app.log',
  '/error.log',
  '/debug.log',
  '/access.log',
  '/logs/app.log',
  '/logs/error.log',
  '/logs/access.log',
];

// File extensions that declare a log surface.
const LOG_EXTS = new Set(['log', 'jsonl', 'ndjson']);

// Paths that are log viewers even without a log extension.
const LOG_VIEWER_PATHS = new Set(['/logs', '/log', '/admin/logs']);

function sha12(text) {
  return createHash('sha256').update(String(text || '')).digest('hex').slice(0, 12);
}

function normWs(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function fileExtension(pathname) {
  const base = String(pathname || '').split('/').pop() || '';
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return '';
  return base.slice(dot + 1).toLowerCase();
}

// Is this URL a log surface by name (extension or viewer path)?
export function isLogSurface(rawUrl) {
  let u;
  try {
    u = new URL(rawUrl);
  } catch {
    return false;
  }
  const path = u.pathname.replace(/\/$/, '') || '/';
  if (LOG_EXTS.has(fileExtension(u.pathname))) return true;
  if (LOG_VIEWER_PATHS.has(path)) return true;
  return false;
}

// A line "looks log-like" when it carries a timestamp, a log level,
// or a bracketed prefix — the shape real logs have and READMEs and
// docs do not.
const LOG_LINE_RE =
  /(?:\d{4}[-/]\d{2}[-/]\d{2}(?:[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?|\d{2}:\d{2}:\d{2}(?:\.\d+)?|\b(?:INFO|DEBUG|WARN|WARNING|ERROR|FATAL|TRACE)\b|^\s*\[[^\]\n]{1,40}\])/;

function countLogLines(text) {
  let count = 0;
  for (const line of String(text || '').split('\n')) {
    if (LOG_LINE_RE.test(line)) count += 1;
    if (count >= 2) break;
  }
  return count;
}

// A body is a log when it has log structure: 2+ log-like lines, or
// 1 log-like line on a URL that declares itself a log file.
export function looksLikeLog(text, rawUrl) {
  const count = countLogLines(text);
  if (count >= 2) return true;
  if (count >= 1) {
    try {
      return LOG_EXTS.has(fileExtension(new URL(rawUrl).pathname));
    } catch {
      return false;
    }
  }
  return false;
}

function isHtmlDocument(text) {
  const t = String(text || '').trimStart().slice(0, 64).toLowerCase();
  return t.startsWith('<!doctype html') || t.startsWith('<html');
}

// Luhn checksum — the standard guard against random 16-digit
// numbers (order ids, timestamps) posing as card numbers.
export function luhnValid(digits) {
  const d = String(digits || '').replace(/[^0-9]/g, '');
  if (d.length < 13 || d.length > 19) return false;
  let sum = 0;
  let doubleIt = false;
  for (let i = d.length - 1; i >= 0; i -= 1) {
    let n = d.charCodeAt(i) - 48;
    if (doubleIt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    doubleIt = !doubleIt;
  }
  return sum % 10 === 0;
}

// Values that are documentation, not secrets.
const PLACEHOLDER_VALUES = new Set([
  'password',
  'changeme',
  'change-me',
  'change_me',
  'xxx',
  'xxxx',
  'xxxxx',
  'xxxxxx',
  '******',
  '********',
  '**********',
  'null',
  'undefined',
  'none',
  'your-password',
  'your_password',
  'your-api-key',
  'your_api_key',
  'example',
  'test',
  'dummy',
  'placeholder',
  'redacted',
  '[redacted]',
  '(redacted)',
]);

// A captured value is a real secret only when it is long enough,
// not a placeholder/template, and carries entropy (a digit, a
// symbol, or 12+ characters). `password=wrongpass` (letters only,
// 9 chars) is a failed-login guess, not a leaked credential.
export function isRealSecretValue(value) {
  const v = String(value || '').trim();
  if (v.length < 8) return false;
  const lower = v.toLowerCase();
  if (PLACEHOLDER_VALUES.has(lower)) return false;
  if (/[<>${}]/.test(v)) return false; // template placeholder
  if (/^(.)\1+$/.test(v)) return false; // all one character
  if (/[0-9]/.test(v)) return true;
  if (/[^A-Za-z0-9]/.test(v)) return true;
  return v.length >= 12;
}

function cleanValue(raw) {
  return String(raw || '').trim().replace(/[.,:;)\\]"]+$/, '');
}

// Credential assignments: the key must start at a word boundary
// (so "bypass:" never matches "pass"), the value is captured up
// to 64 chars. Longer keys first so "password" wins over "pass".
// Bare `pass` is deliberately NOT a key — too noisy.
const CREDENTIAL_RE =
  /(?:^|[\s"'`({\[,;])(password|passwd|pwd|api[_-]?key|apikey|secret|client[_-]?secret|access[_-]?token|auth[_-]?token|session[_-]?token|private[_-]?key|db[_-]?pass(?:word)?|aws[_-]?secret[_-]?access[_-]?key)["']?\s*[:=]\s*["']?([^\s'";,]{8,64})["']?/gim;

const BEARER_RE = /(?:Authorization\s*:\s*)?Bearer\s+([A-Za-z0-9\-._~+/=]{20,200})/gi;
const BASIC_RE = /(?:Authorization\s*:\s*)?Basic\s+([A-Za-z0-9+/=]{16,200})/gi;
const AWS_KEY_RE = /AKIA[0-9A-Z]{16}/g;
const PRIVATE_KEY_RE = /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/g;
// A digit run of 13–19 digits, separators allowed between digits
// (the boundary sits outside the repetition — a \b inside the group
// would demand a boundary before EVERY digit and never match).
const CARD_RE = /\b\d(?:[ -]?\d){12,18}\b/g;

// Mask a secret for evidence: prove the leak without publishing
// the secret itself (same rule as the GPS rounding in #178).
export function maskValue(value, kind) {
  const v = String(value || '');
  if (kind === 'card') return `**** **** **** ${v.slice(-4)}`;
  if (kind === 'private-key') return v; // BEGIN marker only, no key material
  if (v.length <= 8) return '****';
  return `${v.slice(0, 4)}\u2026${v.slice(-2)}`;
}

/**
 * Core detection for one fetched log surface — THE negative-control
 * stub point is findSensitiveDataInLogs below (this pure helper is
 * unit tested directly, so stubbing kills only the probe's
 * finding-expecting tests). `check` = { baselineBody, catchAllBody,
 * url }. Returns an array of leaks [{ kind, field, value, display }]
 * — empty when nothing leaks.
 * Kinds: credential, bearer, aws-key, private-key, card.
 */
export function detectSensitiveDataInLogs(text, check = {}) {
  const body = typeof text === 'string' ? text : '';
  if (!body) return [];
  const url = typeof check.url === 'string' ? check.url : '';
  const baselineBody = typeof check.baselineBody === 'string' ? check.baselineBody : '';
  const catchAllBody = typeof check.catchAllBody === 'string' ? check.catchAllBody : '';
  const scan = body.slice(0, MAX_SCAN_CHARS);
  // An HTML document is a rendered page, not a raw log (error pages
  // are error-disclosure's territory; HTML log viewers are out of
  // scope — see the header).
  if (isHtmlDocument(scan)) return [];
  // A body identical to the catch-all control is an SPA fallback.
  if (catchAllBody && normWs(scan) === normWs(catchAllBody)) return [];
  // The body must actually look like a log.
  if (!looksLikeLog(scan, url)) return [];
  const base = normWs(baselineBody);
  const leaks = [];
  const seen = new Set();
  const push = (kind, field, value) => {
    const v = String(value || '').trim();
    if (!v) return;
    // Baseline differential: a value already printed on the pasted
    // page is public, not a leak.
    if (base && normWs(base).includes(normWs(v))) return;
    const key = `${kind}|${v}`;
    if (seen.has(key)) return;
    seen.add(key);
    leaks.push({ kind, field, value: v, display: maskValue(v, kind) });
  };

  for (const m of scan.matchAll(CREDENTIAL_RE)) {
    const key = String(m[1] || '').toLowerCase();
    const value = cleanValue(m[2]);
    if (!isRealSecretValue(value)) continue;
    // The key itself must not be the value (e.g. `password=password`).
    if (value.toLowerCase() === key) continue;
    push('credential', key, value);
  }
  for (const m of scan.matchAll(BEARER_RE)) {
    push('bearer', 'Authorization Bearer token', cleanValue(m[1]));
  }
  for (const m of scan.matchAll(BASIC_RE)) {
    push('bearer', 'Authorization Basic credentials', cleanValue(m[1]));
  }
  for (const m of scan.matchAll(AWS_KEY_RE)) {
    push('aws-key', 'AWS access key id', m[0]);
  }
  for (const m of scan.matchAll(PRIVATE_KEY_RE)) {
    push('private-key', 'private key', m[0]);
  }
  for (const m of scan.matchAll(CARD_RE)) {
    const raw = m[0];
    const digits = raw.replace(/[^0-9]/g, '');
    if (digits.length < 13 || digits.length > 19) continue;
    // A YYYYMMDD date is not a card number.
    if (/^(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])/.test(digits)) continue;
    if (/^(\d)\1+$/.test(digits)) continue;
    if (!luhnValid(digits)) continue;
    // Baseline differential on both the raw and stripped forms.
    if (base && (normWs(base).includes(normWs(raw)) || normWs(base).includes(digits))) continue;
    const key = `card|${digits}`;
    if (seen.has(key)) continue;
    seen.add(key);
    leaks.push({ kind: 'card', field: 'credit-card number', value: digits, display: maskValue(digits, 'card') });
  }
  return leaks;
}

/**
 * Probe-facing detection entry — the negative-control stub point.
 * Kept separate from detectSensitiveDataInLogs (the pure helper,
 * unit tested directly) so stubbing this kills only the probe's
 * finding-expecting tests and nothing else.
 */
function findSensitiveDataInLogs(text, check) {
  return detectSensitiveDataInLogs(text, check);
}

const LINK_HREF_RE = /<a[^>]+href\s*=\s*["']([^"']+)["']/gi;

/**
 * Build the candidate fetch list for a scan. Pure — exported for
 * unit tests. Priority: the pasted URL itself when it IS a log
 * surface, then <a> links to log files, then the orchestrator's URL
 * list filtered to log surfaces (targets the scanner already
 * selected outrank blind fixed paths), then the fixed log paths.
 * Same-origin only, deduped, capped at MAX_CANDIDATES.
 * Returns [{ url }].
 */
export function buildLogTargets(pageUrl, urls, pageHtml) {
  let page;
  try {
    page = new URL(pageUrl);
  } catch {
    return [];
  }
  const origin = page.origin;
  const out = [];
  const seen = new Set();
  const push = (raw) => {
    if (out.length >= MAX_CANDIDATES) return;
    let u;
    try {
      u = new URL(raw, pageUrl);
    } catch {
      return;
    }
    if (u.origin !== origin) return;
    if (!isLogSurface(u.toString())) return;
    const key = `${u.origin}${u.pathname}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ url: `${u.origin}${u.pathname}` });
  };
  push(pageUrl);
  const html = typeof pageHtml === 'string' ? pageHtml : '';
  for (const m of html.matchAll(LINK_HREF_RE)) push(m[1]);
  for (const u of Array.isArray(urls) ? urls : []) push(u);
  for (const p of LOG_PATHS) push(`${origin}${p}`);
  return out;
}

function pushFinding(leak, res, candidate, findings, seen) {
  const key = `${leak.kind}|${candidate.url}`;
  if (seen.has(key)) return;
  seen.add(key);
  const base = candidate.url.split('/').pop() || candidate.url;
  let title;
  if (leak.kind === 'credential') {
    title = `Sensitive data in logs — credential '${leak.field}' exposed in log file '${base}'`;
  } else if (leak.kind === 'bearer') {
    title = `Sensitive data in logs — Authorization token exposed in log file '${base}'`;
  } else if (leak.kind === 'aws-key') {
    title = `Sensitive data in logs — AWS access key exposed in log file '${base}'`;
  } else if (leak.kind === 'private-key') {
    title = `Sensitive data in logs — private key exposed in log file '${base}'`;
  } else {
    title = `Sensitive data in logs — credit-card number exposed in log file '${base}'`;
  }
  findings.push({
    class: 'sensitive_data_in_logs',
    id: `logsecret-${sha12(key)}`,
    title,
    severity: 'high',
    url: candidate.url,
    parameter: null,
    evidence: {
      request: `GET ${candidate.url}`,
      response: `HTTP ${res.status} log file contains ${leak.field}: ${leak.display}`,
      impact_demo:
        'Sensitive-data-in-logs primitive — the application writes its own credentials into a log file served over plain HTTP, so anyone who fetches the log walks away with live secrets: a password or API key enables account takeover, a Bearer/Basic token enables session hijacking, an AWS key or private key enables infrastructure compromise, and a card number enables fraud — chain with credential reuse or a version-targeted exploit against the disclosed service.',
      signalCorrelated: true,
    },
  });
}

/**
 * Probe sensitive data in logs (#180).
 * @param {string} pageUrl — the pasted page (baseline + surface).
 * @param {string[]} urls — distinct GET probe target URLs (the
 *   orchestrator selects them; log paths seed candidates).
 * @param {object} opts — { timeoutMs, headers, fetchPage }.
 *   fetchPage is the test seam (defaults to fingerprint.fetchPage).
 * @returns {object[]} findings (class 'sensitive_data_in_logs', high).
 */
export async function probeSensitiveDataInLogs(pageUrl, urls, opts = {}) {
  const fetchFn = typeof opts.fetchPage === 'function' ? opts.fetchPage : fetchPage;
  const findings = [];
  const seen = new Set();
  try {
    // Baseline first: the pasted page's body is the control the
    // differential is measured against.
    let baselineBody = '';
    let baselineRes = null;
    try {
      baselineRes = await fetchFn(pageUrl, opts);
      if (baselineRes) {
        baselineBody = typeof baselineRes.body === 'string' ? baselineRes.body : '';
      }
    } catch {
      baselineRes = null;
      baselineBody = '';
    }

    // Catch-all control: a nonexistent path in the page's directory.
    // A candidate whose body equals this control is an SPA fallback,
    // not a log. One fetch, skipped when the page URL is unparseable
    // (then there are no candidates either).
    let catchAllBody = '';
    try {
      const page = new URL(pageUrl);
      const dir = page.pathname.slice(0, page.pathname.lastIndexOf('/') + 1) || '/';
      const bad = new URL(page);
      bad.pathname = `${dir}${NONEXISTENT_LEAF}`;
      bad.search = '';
      bad.hash = '';
      const res = await fetchFn(bad.toString(), opts);
      if (res && res.status === 200 && typeof res.body === 'string') {
        catchAllBody = res.body;
      }
    } catch {
      catchAllBody = '';
    }

    // The pasted page itself, when it IS a log file: its body is the
    // surface, so the differential runs against an empty baseline
    // (the value cannot be "already public" — the log IS the page).
    if (
      baselineRes &&
      baselineRes.status === 200 &&
      baselineBody &&
      isLogSurface(pageUrl)
    ) {
      const leaks = findSensitiveDataInLogs(baselineBody, {
        baselineBody: '',
        catchAllBody,
        url: pageUrl,
      });
      for (const leak of leaks) {
        pushFinding(leak, baselineRes, { url: pageUrl }, findings, seen);
      }
    }

    // Candidates in priority order, within the fetch budget.
    let fetches = 2; // baseline + catch-all
    const candidates = buildLogTargets(pageUrl, urls, baselineBody);
    let pageKey = '';
    try {
      const p = new URL(pageUrl);
      pageKey = `${p.origin}${p.pathname}`;
    } catch {
      pageKey = '';
    }
    for (const candidate of candidates) {
      if (findings.length >= MAX_FINDINGS) break;
      if (fetches >= MAX_FETCHES) break;
      // The baseline response already covers the page-as-log case
      // (compare normalized origin+pathname: the pasted URL may
      // carry a query string the candidate list strips).
      if (pageKey && candidate.url === pageKey) continue;
      fetches += 1;
      let res;
      try {
        res = await fetchFn(candidate.url, opts);
      } catch {
        continue;
      }
      if (!res || res.status !== 200 || typeof res.body !== 'string' || !res.body) continue;
      const leaks = findSensitiveDataInLogs(res.body, {
        baselineBody,
        catchAllBody,
        url: candidate.url,
      });
      for (const leak of leaks) {
        pushFinding(leak, res, candidate, findings, seen);
      }
    }
    return findings;
  } catch {
    return findings;
  }
}

export const __sensitiveDataInLogsMeta = { phases: ['sensitive-data-in-logs'], depth: ['quick', 'standard', 'deep'] };
