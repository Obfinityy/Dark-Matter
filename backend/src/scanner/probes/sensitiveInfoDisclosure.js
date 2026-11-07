// Dark Matter rule-based scanner — sensitive information disclosure
// (general) (coverage row #181 [High], phase 76).
//
// DIAGNOSIS: a plain HTTP 200 response that prints the application's
// own internal infrastructure — a private (RFC1918) IP address, or
// an internal hostname such as db.internal — hands an
// unauthenticated attacker the internal network map for free: which
// hosts exist, where the database lives, what the internal naming
// scheme is. That is the reconnaissance half of every later
// pivot (SSRF to an internal host, a direct hit on an internal
// admin panel, a cloud-metadata reach). The finding is the address
// itself, already sitting in a public response.
//
// VERIFICATION (100% truth rule): a finding counts ONLY when a
// fetched same-origin response actually contains a genuinely
// internal address. Public IPs, localhost, documentation ranges,
// the target's OWN host/IP (the address the user pasted — the
// attacker already knows it), and a value already printed on the
// pasted page are NEVER findings. A body identical to the catch-all
// control (a nonexistent path in the same directory) is an SPA
// fallback, not a disclosure. One finding per distinct URL +
// disclosure kind + value. Internal addresses are NOT secrets — the address
// itself is the evidence (unlike #180, nothing is masked here).
//
// NON-OVERLAP (by design): this probe reads the scanner's own
// already-selected response bodies for INTERNAL ADDRESSES only.
// Error responses are owned by 'error-disclosure' (only HTTP 200
// bodies are examined); JS bundle contents are owned by
// 'secrets-in-js' (.js/.ts candidates are never fetched); served
// log files are owned by 'sensitive-data-in-logs' (.log/.jsonl
// candidates are never fetched); version/banner headers are owned
// by 'fingerprint-banner' (headers are never examined — bodies
// only); backup copies, source files and .git/config are owned by
// 'source-code-disclosure' / 'files' (those extensions and /.git/
// paths are never fetched); image/document metadata is owned by
// 'metadata-leakage' (binary bodies are skipped). Diagnostic
// endpoints (/actuator, /metrics, /openapi.json, /swagger.json) are
// NOT probed here — nuclei templates and 'openapi-targets' already
// own those surfaces, so this phase only examines URLs the scanner
// selected for other reasons. IPv6 internal addresses are OUT OF
// SCOPE (IPv4 + internal hostnames only — honest open item).
//
// SAFETY: read-only GETs only — no writes, no allowWrite gate.
// Baseline page (HTML, via the fetchPage seam) + catch-all control
// + up to 10 disclosure candidates (via the same seam). The pasted
// page is the baseline, so this phase never skips.
import { createHash } from 'node:crypto';
import { fetchPage } from '../fingerprint.js';

const MAX_CANDIDATES = 10;
const MAX_FETCHES = 12; // baseline + catch-all + 10 candidates
const MAX_FINDINGS = 20;
const MAX_SCAN_CHARS = 1024 * 1024; // bound regex work per body
const NONEXISTENT_LEAF = 'dm-nonexistent-7b31e9d2.txt';

// Internal TLDs: a hostname under one of these is internal-only
// infrastructure, never a public address.
const INTERNAL_TLDS = new Set(['internal', 'intranet', 'corp', 'lan', 'local', 'private']);

// Extensions this phase never fetches — each belongs to another
// phase (see NON-OVERLAP above) or is a binary body.
const EXCLUDED_EXTS = new Set([
  'js', 'mjs', 'ts', 'jsx', 'tsx', 'css', 'map',
  'log', 'jsonl', 'ndjson',
  'bak', 'old', 'orig', 'save', 'sql', 'swp', 'tmp', 'env',
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico',
  'woff', 'woff2', 'ttf', 'eot', 'otf',
  'pdf', 'zip', 'gz', 'tar', 'mp4', 'mp3', 'wav',
]);

function sha12(text) {
  return createHash('sha256').update(String(text || '')).digest('hex').slice(0, 12);
}

function normWs(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function fileExtension(pathname) {
  const base = String(pathname || '').split('/').pop() || '';
  const dot = base.lastIndexOf('.');
  if (dot < 0) return '';
  // A dotfile ('.env') has no name part — its extension is the
  // whole name after the dot, so it is still excluded below.
  if (dot === 0) return base.slice(1).toLowerCase();
  return base.slice(dot + 1).toLowerCase();
}

// A dotted quad is a private (RFC1918) IPv4 address when it falls
// in 10/8, 172.16/12 or 192.168/16 — and every octet is a real
// octet (0-255), so "10.999.1.2" never counts.
export function isPrivateIPv4(value) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(value || '').trim());
  if (!m) return false;
  const o = m.slice(1).map(Number);
  if (o.some((n) => n > 255)) return false;
  if (o[0] === 10) return true;
  if (o[0] === 172 && o[1] >= 16 && o[1] <= 31) return true;
  if (o[0] === 192 && o[1] === 168) return true;
  return false;
}

// A hostname is internal when its final label is an internal TLD
// and at least one label precedes it. The match must NOT be
// followed by '.' or a word char — so "foo.internal.example.com"
// (a subdomain of a public domain) never counts.
const INTERNAL_HOST_RE =
  /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(internal|intranet|corp|lan|local|private)(?![.\w-])/gi;

export function isInternalHostname(value) {
  const v = String(value || '').trim().toLowerCase();
  if (!v || !v.includes('.')) return false;
  const labels = v.split('.');
  const tld = labels[labels.length - 1];
  if (!INTERNAL_TLDS.has(tld)) return false;
  return labels.length >= 2 && labels.every((l) => /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(l));
}

// Candidate dotted quads in private ranges. Octets are validated
// by isPrivateIPv4, so version-like strings with an octet > 255
// are dropped by the caller.
const PRIVATE_IP_RE = /\b(?:10(?:\.\d{1,3}){3}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}|192\.168(?:\.\d{1,3}){2})\b/g;

// Is this URL a disclosure surface by name — same-origin text the
// scanner already selected, and not owned by another phase?
export function isDisclosureSurface(rawUrl) {
  let u;
  try {
    u = new URL(rawUrl);
  } catch {
    return false;
  }
  if (u.pathname.includes('/.git/') || u.pathname.endsWith('/.git')) return false;
  if (EXCLUDED_EXTS.has(fileExtension(u.pathname))) return false;
  return true;
}

/**
 * Core detection for one fetched response — THE negative-control
 * stub point is findSensitiveInfoDisclosure below (this pure helper
 * is unit tested directly, so stubbing kills only the probe's
 * finding-expecting tests). `check` = { baselineBody, catchAllBody,
 * url, targetHost }. Returns an array of leaks
 * [{ kind, field, value, display }] — empty when nothing leaks.
 * Kinds: internal-ip, internal-hostname.
 */
export function detectSensitiveInfoDisclosure(text, check = {}) {
  const body = typeof text === 'string' ? text : '';
  if (!body) return [];
  // A NUL byte means a binary body, not a text response.
  if (body.includes('\0')) return [];
  const baselineBody = typeof check.baselineBody === 'string' ? check.baselineBody : '';
  const catchAllBody = typeof check.catchAllBody === 'string' ? check.catchAllBody : '';
  const targetHost = typeof check.targetHost === 'string' ? check.targetHost.toLowerCase() : '';
  const scan = body.slice(0, MAX_SCAN_CHARS);
  // A body identical to the catch-all control is an SPA fallback.
  if (catchAllBody && normWs(scan) === normWs(catchAllBody)) return [];
  const base = normWs(baselineBody);
  const leaks = [];
  const seen = new Set();
  const push = (kind, field, value) => {
    const v = String(value || '').trim();
    if (!v) return;
    // The target's own host/IP is the address the user pasted —
    // the attacker already knows it, so it is not a leak.
    if (targetHost && v.toLowerCase() === targetHost) return;
    // Baseline differential: a value already printed on the pasted
    // page is public, not a leak.
    if (base && normWs(base).includes(normWs(v))) return;
    const key = `${kind}|${v.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    leaks.push({ kind, field, value: v, display: v });
  };

  for (const m of scan.matchAll(PRIVATE_IP_RE)) {
    const ip = m[0];
    if (!isPrivateIPv4(ip)) continue;
    push('internal-ip', 'internal IP address', ip);
  }
  for (const m of scan.matchAll(INTERNAL_HOST_RE)) {
    const host = m[0];
    if (!isInternalHostname(host)) continue;
    push('internal-hostname', 'internal hostname', host);
  }
  return leaks;
}

/**
 * Probe-facing detection entry — the negative-control stub point.
 * Kept separate from detectSensitiveInfoDisclosure (the pure helper,
 * unit tested directly) so stubbing this kills only the probe's
 * finding-expecting tests and nothing else.
 */
function findSensitiveInfoDisclosure(text, check) {
  return detectSensitiveInfoDisclosure(text, check);
}

const LINK_HREF_RE = /<a[^>]+href\s*=\s*["']([^"']+)["']/gi;

/**
 * Build the candidate fetch list for a scan. Pure — exported for
 * unit tests. Priority: the orchestrator's URL list (targets the
 * scanner already selected) first, then <a> links from the page.
 * Same-origin only, deduped on origin+pathname, capped at
 * MAX_CANDIDATES. The pasted page itself is the baseline, never a
 * candidate. Returns [{ url }].
 */
export function buildDisclosureTargets(pageUrl, urls, pageHtml) {
  let page;
  try {
    page = new URL(pageUrl);
  } catch {
    return [];
  }
  const origin = page.origin;
  const pageKey = `${page.origin}${page.pathname}`;
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
    if (!isDisclosureSurface(u.toString())) return;
    const key = `${u.origin}${u.pathname}`;
    if (key === pageKey) return;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ url: `${u.origin}${u.pathname}` });
  };
  for (const u of Array.isArray(urls) ? urls : []) push(u);
  const html = typeof pageHtml === 'string' ? pageHtml : '';
  for (const m of html.matchAll(LINK_HREF_RE)) push(m[1]);
  return out;
}

function pushFinding(leak, res, candidate, findings, seen) {
  // One finding per URL + kind + value: two distinct internal
  // addresses on one URL are two distinct leaks (different
  // evidence, different hosts to pivot to), while the same address
  // repeated on one URL is one finding.
  const key = `${leak.kind}|${candidate.url}|${leak.value.toLowerCase()}`;
  if (seen.has(key)) return;
  seen.add(key);
  const base = candidate.url.split('/').pop() || candidate.url;
  let title;
  if (leak.kind === 'internal-ip') {
    title = `Sensitive information disclosure — internal IP address '${leak.value}' exposed in response from '${base}'`;
  } else {
    title = `Sensitive information disclosure — internal hostname '${leak.value}' exposed in response from '${base}'`;
  }
  findings.push({
    class: 'sensitive_info_disclosure',
    id: `infodis-${sha12(key)}`,
    title,
    severity: 'high',
    url: candidate.url,
    parameter: null,
    evidence: {
      request: `GET ${candidate.url}`,
      response: `HTTP ${res.status} response discloses ${leak.field}: ${leak.display}`,
      impact_demo:
        'Sensitive-information-disclosure primitive — the application prints its own internal infrastructure in a plain HTTP response, so anyone who fetches the page walks away with the internal network map: private IP addresses reveal where the database and internal services live, internal hostnames reveal the naming scheme and hidden hosts — chain with SSRF to reach an internal host directly, with a direct hit on an internal admin panel, or with a version-targeted exploit against the disclosed service.',
      signalCorrelated: true,
    },
  });
}

/**
 * Probe sensitive information disclosure (general) (#181).
 * @param {string} pageUrl — the pasted page (baseline).
 * @param {string[]} urls — distinct GET probe target URLs (the
 *   orchestrator selects them; disclosure surfaces seed candidates).
 * @param {object} opts — { timeoutMs, headers, fetchPage }.
 *   fetchPage is the test seam (defaults to fingerprint.fetchPage).
 * @returns {object[]} findings (class 'sensitive_info_disclosure', high).
 */
export async function probeSensitiveInfoDisclosure(pageUrl, urls, opts = {}) {
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
    // not a disclosure. One fetch, skipped when the page URL is
    // unparseable (then there are no candidates either).
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

    // The target's own host/IP is never a leak — derive it once
    // from the pasted URL (hostname; for lab targets this is the
    // RFC1918 address the page is served from).
    let targetHost = '';
    try {
      targetHost = new URL(pageUrl).hostname.toLowerCase();
    } catch {
      targetHost = '';
    }

    // Candidates in priority order, within the fetch budget.
    let fetches = 2; // baseline + catch-all
    const candidates = buildDisclosureTargets(pageUrl, urls, baselineBody);
    for (const candidate of candidates) {
      if (findings.length >= MAX_FINDINGS) break;
      if (fetches >= MAX_FETCHES) break;
      fetches += 1;
      let res;
      try {
        res = await fetchFn(candidate.url, opts);
      } catch {
        continue;
      }
      if (!res || res.status !== 200 || typeof res.body !== 'string' || !res.body) continue;
      const leaks = findSensitiveInfoDisclosure(res.body, {
        baselineBody,
        catchAllBody,
        url: candidate.url,
        targetHost,
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

export const __sensitiveInfoDisclosureMeta = { phases: ['sensitive-info-disclosure'], depth: ['quick', 'standard', 'deep'] };
