// Dark Matter rule-based scanner — disclosure legs (coverage rows
// #409 [Low] / #410 [Low], files phase).
//
// #409 — robots.txt / sitemap.xml revealing sensitive paths.
// Oracle: a sensitive path is LISTED in a directly-fetched
// robots.txt or sitemap.xml. Both files are fetched with read-only
// GETs (redirects never followed — a 3xx to the homepage is not a
// disclosure). Two structural gates keep SPA/error pages from
// firing: the body must actually parse as a robots file (a
// User-agent/Disallow/Allow/Sitemap line) or a sitemap (a <urlset> /
// <sitemapindex> with <loc> entries), AND it must differ from the
// origin's catch-all baseline (a random nonexistent path must not
// return the same 200 body — the same SPA guard files.js uses).
// Only paths matching the sensitive list below fire; a bare
// `Disallow: /` or a public page (/about, /contact) never fires.
// Sitemap indexes are NOT chased in v1 (their <loc> entries name
// sub-sitemap files, not content paths).
//
// #410 — secrets / internals inside HTML comments.
// Oracle: a credential value, private-key block, connection string
// with credentials, or internal hostname appears inside an HTML
// comment (`<!-- ... -->`) of the landing page. The probe inspects
// the HTML the fingerprint step already fetched (opts.html /
// fp.body) — zero extra requests in-scan; when no HTML is passed it
// fetches the page itself once (fallback). Comments are EXTRACTED
// first and matched second: visible text never fires (that is #41's
// surface — credentialDisclosure.js strips comments for exactly
// this reason), and neither do SSI directives (`<!--#...-->`) or
// conditional comments (`<!--[if ...]>`). One finding per comment
// (strongest match wins; evidence lists every matched kind), capped
// at 5. Credential values are masked in evidence (first 4 + last 2
// chars, via credentialDisclosure.js) and never published in full.
//
// Severity: low for both legs — both rows are filed [Low].
// Read-only: 3 GETs max for #409 (robots + sitemap + baseline) and
// 1 fallback GET for #410 when no HTML is supplied.

import { isSecretLike, isPlaceholder, maskCredential } from './credentialDisclosure.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
const FETCH_CAP = 200000;
const MAX_ROBOTS_FINDINGS = 5; // per file
const MAX_COMMENT_FINDINGS = 5; // total for the comment half

// Path fragments that make a listed path "sensitive". Matched
// case-insensitively against the decoded pathname (robots wildcards
// `*`/`$` stripped first). Deliberately narrow: a login page, a
// public /about, or a bare `Disallow: /` never fires.
const SENSITIVE_PATH_RES = [
  /\/admin\b/i,
  /\/wp-admin\b/i,
  /\/administrator\b/i,
  /\/phpmyadmin\b/i,
  /\/pma\b/i,
  /backup/i,
  /\.bak\b/i,
  /\.old\b/i,
  /\.sql\b/i,
  /\.(zip|tar|gz|tgz|7z|rar)\b/i,
  /\bdump\b/i,
  /\.git\b/i,
  /\.svn\b/i,
  /\.env\b/i,
  /\/config\b/i,
  /\/private\b/i,
  /\/internal\b/i,
  /\/secret\b/i,
  /\/staging\b/i,
  /(^|\/)dev(\/|$)/i,
  /\/cgi-bin\b/i,
];

// Does this pathname name a sensitive path? Exported for unit tests.
export function isSensitivePath(pathname) {
  let p = String(pathname || '');
  try {
    p = decodeURIComponent(p);
  } catch {
    // Keep the raw value — the patterns still decide.
  }
  p = p.replace(/[*$]/g, '');
  return SENSITIVE_PATH_RES.some((re) => re.test(p));
}

// Parse robots.txt lines into listed paths: Disallow / Allow /
// Sitemap targets (the Sitemap URL's pathname). Exported for tests.
export function extractRobotsPaths(text) {
  const out = [];
  for (const rawLine of String(text || '').split('\n')) {
    const line = rawLine.trim();
    const m = line.match(/^(?:disallow|allow|sitemap)\s*:\s*(\S+)/i);
    if (!m) continue;
    let value = m[1];
    // Robots wildcards are matching syntax, not path text.
    value = value.replace(/[*$]/g, '');
    if (/^https?:\/\//i.test(value)) {
      try {
        value = new URL(value).pathname;
      } catch {
        continue;
      }
    }
    if (value) out.push(value);
  }
  return out;
}

// Parse sitemap.xml <loc> entries into pathnames. Exported for tests.
export function extractSitemapLocs(text) {
  const out = [];
  for (const m of String(text || '').matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)) {
    try {
      out.push(new URL(m[1]).pathname);
    } catch {
      // Ignore a <loc> that is not a URL (relative or garbage).
    }
  }
  return out;
}

// Extract real HTML comments, skipping SSI directives, conditional
// comments, and empty ones. Exported for unit tests.
export function extractHtmlComments(html) {
  const out = [];
  if (typeof html !== 'string' || !html) return out;
  for (const m of html.matchAll(/<!--([\s\S]*?)-->/g)) {
    const text = m[1].trim();
    if (!text) continue;
    if (text.startsWith('#')) continue; // SSI directive <!--#...-->
    if (/^\[if\s/i.test(text)) continue; // conditional comment
    out.push({ text, raw: m[0] });
  }
  return out;
}

// Credential parameter names for the comment-assignment match.
// Mirrors credentialDisclosure.js's discipline: bare `token` / `auth`
// never fire (too broad — CSRF/session), and `user` / `username` /
// `email` never fire (identifiers, not credentials).
const COMMENT_CRED_PARAMS = [
  'password',
  'passwd',
  'pwd',
  'secret',
  'api[_-]?key',
  'apikey',
  'access[_-]?key',
  'access[_-]?token',
  'client[_-]?secret',
  'private[_-]?key',
];
const COMMENT_CRED_RE = new RegExp(
  `\\b(${COMMENT_CRED_PARAMS.join('|')})\\s*[:=]\\s*['"]?([^\\s"'<>;,]{4,})`,
  'gi'
);
const PRIVATE_KEY_RE = /-----BEGIN\s+(?:RSA\s+|EC\s+|OPENSSH\s+|PGP\s+)?PRIVATE KEY-----/i;
const AWS_KEY_RE = /\bAKIA[0-9A-Z]{16}\b/;
const CONN_STRING_RE =
  /\b(?:mysql|postgres(?:ql)?|mongodb(?:\+srv)?|redis|amqp):\/\/[^\s"'<>]+:[^\s"'<>]+@/i;
const INTERNAL_HOST_RE =
  /(?:[a-z0-9-]+\.)+(?:internal|corp|local|intranet)\b/i;
const RFC1918_RE =
  /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})\b/;

// Placeholder values that appear in template/example comments:
// `password: changeme` is a placeholder, not a disclosure. Extends
// credentialDisclosure.js's isPlaceholder (***, xxx, null,
// undefined, redacted) with the example values common in comments.
const COMMENT_PLACEHOLDER_RE =
  /^(changeme|change-me|your[-_]?password|example|sample|demo|placeholder|test123|password123)$/i;

function isCommentPlaceholder(raw) {
  if (isPlaceholder(raw)) return true;
  return COMMENT_PLACEHOLDER_RE.test(String(raw || '').trim());
}

// Strip trailing punctuation the assignment regex swept in.
function cleanValue(raw) {
  let value = String(raw || '').trim();
  value = value.replace(/^["'`]+/, '').replace(/["'`]+$/, '');
  value = value.replace(/[,;:.]+$/, '');
  value = value.replace(/[)\]}>]+$/, '');
  return value;
}

// Match every secret/internals signal inside one comment's text.
// Returns [{ kind, param?, value?, match }] in first-seen order.
// Exported for unit tests.
export function matchCommentSecrets(commentText) {
  const text = String(commentText || '');
  const hits = [];
  const push = (kind, extra = {}) => {
    hits.push({ kind, ...extra });
  };
  const pk = text.match(PRIVATE_KEY_RE);
  if (pk) push('private-key', { match: pk[0] });
  const aws = text.match(AWS_KEY_RE);
  if (aws) push('aws-key', { match: aws[0], value: aws[0] });
  const conn = text.match(CONN_STRING_RE);
  if (conn) push('connection-string', { match: conn[0] });
  COMMENT_CRED_RE.lastIndex = 0;
  for (const m of text.matchAll(COMMENT_CRED_RE)) {
    const param = m[1].toLowerCase();
    const value = cleanValue(m[2]);
    if (value.length < 4) continue;
    if (isCommentPlaceholder(value)) continue;
    // Secret/key params need a token-like value so placeholders
    // like api_key=test never fire; password params fire on any
    // non-empty, non-placeholder value (the disclosure is the
    // defect, whatever the strength).
    const isPasswordParam = /^(password|passwd|pwd)$/.test(param);
    if (!isPasswordParam && !isSecretLike(value)) continue;
    push('credential-assignment', { param, value, match: m[0] });
  }
  const host = text.match(INTERNAL_HOST_RE);
  if (host) push('internal-host', { match: host[0] });
  const ip = text.match(RFC1918_RE);
  if (ip) push('internal-host', { match: ip[0] });
  return hits;
}

// Priority: the strongest signal in a comment names its finding.
const KIND_PRIORITY = {
  'private-key': 0,
  'aws-key': 1,
  'connection-string': 2,
  'credential-assignment': 3,
  'internal-host': 4,
};

function kindTitle(kind, hit) {
  switch (kind) {
    case 'private-key':
      return 'Private key block in HTML comment';
    case 'aws-key':
      return 'AWS access key in HTML comment';
    case 'connection-string':
      return 'Database connection string with credentials in HTML comment';
    case 'credential-assignment':
      return `Secret in HTML comment — ${hit.param} assignment`;
    case 'internal-host':
      return `Internal hostname in HTML comment — ${hit.match}`;
    default:
      return 'Secret in HTML comment';
  }
}

// Mask a matched secret value for evidence; internal hostnames and
// the private-key header are shown as-is (they are the signal, not
// a credential value).
function maskHit(hit) {
  if (hit.kind === 'credential-assignment' || hit.kind === 'aws-key') {
    return maskCredential(hit.value || hit.match);
  }
  if (hit.kind === 'connection-string') {
    return hit.match.replace(/:\/\/([^:]+):[^@]+@/, '://$1:…@');
  }
  return hit.match;
}

async function get(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 15000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'manual', // never follow: a 3xx to the homepage is NOT a disclosure
      headers: { 'User-Agent': UA, ...(opts.headers || {}) },
    });
    const text = await res.text().catch(() => '');
    return {
      status: res.status,
      contentType: res.headers.get('content-type') || '',
      text: text.slice(0, FETCH_CAP),
    };
  } finally {
    clearTimeout(t);
  }
}

// Same SPA catch-all guard as files.js: a random nonexistent path
// returning the same 200 body means the "file" is the index page.
function sameAsBaseline(res, baseline) {
  if (!baseline || baseline.status !== 200 || res.status !== 200) return false;
  const a = res.text;
  const b = baseline.text;
  if (Math.abs(a.length - b.length) > Math.max(200, b.length * 0.15)) return false;
  return a.slice(0, 200) === b.slice(0, 200);
}

function robotsStructuralGate(text) {
  return /^(?:user-agent|disallow|allow|sitemap|crawl-delay|host)\s*:/im.test(text);
}

function sitemapStructuralGate(text) {
  return /<(urlset|sitemapindex)[\s>]/i.test(text) && /<loc>\s*[^<\s]+\s*<\/loc>/i.test(text);
}

/**
 * Probe disclosure legs #409/#410. @param {string} baseUrl — the
 * scan's target URL (robots/sitemap are fetched from its origin).
 * @param {object} opts — { html, timeoutMs }: html is the landing
 * page HTML (fp.body) for the #410 half; when absent the page is
 * fetched once as a fallback. @returns {object[]} findings, both
 * classes severity 'low' (both rows are filed [Low]).
 */
export async function probeDisclosure(baseUrl, opts = {}) {
  const findings = [];
  let origin;
  try {
    origin = new URL(String(baseUrl)).origin;
  } catch {
    return [];
  }
  const timeoutMs = opts.timeoutMs || 15000;

  // ---- #409: robots.txt / sitemap.xml ----
  let baseline = null;
  try {
    baseline = await get(`${origin}/dm-spa-check-${Math.random().toString(36).slice(2, 12)}`, { timeoutMs });
  } catch {
    baseline = null;
  }
  const files = [
    { path: '/robots.txt', gate: robotsStructuralGate, parse: extractRobotsPaths },
    { path: '/sitemap.xml', gate: sitemapStructuralGate, parse: extractSitemapLocs },
  ];
  let n = 0;
  for (const f of files) {
    let res;
    try {
      res = await get(origin + f.path, { timeoutMs });
    } catch {
      continue;
    }
    if (res.status !== 200) continue; // gate 1: direct 200 only
    if (sameAsBaseline(res, baseline)) continue; // gate 2: not the SPA catch-all
    if (!f.gate(res.text)) continue; // gate 3: actually a robots/sitemap file
    const seen = new Set();
    for (const p of f.parse(res.text)) {
      if (n >= MAX_ROBOTS_FINDINGS * files.length) break;
      if (!isSensitivePath(p)) continue;
      if (seen.has(p)) continue;
      seen.add(p);
      n += 1;
      findings.push({
        class: 'robots_sitemap_disclosure',
        id: `robots-sitemap-${f.path.replace(/[^a-z0-9]/gi, '')}-${n}`,
        title: `Sensitive path disclosed in ${f.path.slice(1)} — ${p}`,
        severity: 'low',
        url: origin + f.path,
        evidence: {
          request: `GET ${origin + f.path}`,
          response:
            `HTTP 200 (direct, no redirect) ${f.path} lists sensitive path "${p}" — the file advertises where the sensitive area lives.`,
          impact_demo: `An attacker reading ${f.path} learns the sensitive path ${p} exists without probing for it (CWE-200).`,
          signalCorrelated: true,
        },
      });
      if (n >= MAX_ROBOTS_FINDINGS && f.path === '/robots.txt') break;
    }
  }

  // ---- #410: HTML comments ----
  let html = typeof opts.html === 'string' ? opts.html : '';
  if (!html) {
    // Fallback: fetch the page itself once (in-scan fp.body is
    // always passed, so this runs only for standalone callers or a
    // failed fingerprint step).
    try {
      const res = await get(String(baseUrl), { timeoutMs });
      if (res.status === 200 && String(res.contentType || '').toLowerCase().includes('text/html')) {
        html = res.text;
      }
    } catch {
      html = '';
    }
  }
  const comments = extractHtmlComments(html);
  let m = 0;
  for (const comment of comments) {
    if (m >= MAX_COMMENT_FINDINGS) break;
    const hits = matchCommentSecrets(comment.text);
    if (!hits.length) continue;
    const sorted = [...hits].sort((a, b) => KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind]);
    const top = sorted[0];
    m += 1;
    const kinds = [...new Set(sorted.map((h) => h.kind))].join(', ');
    const masked = sorted.map((h) => `${h.kind}: ${maskHit(h)}`).join('; ');
    const finding = {
      class: 'html_comment_secret',
      id: `html-comment-secret-${top.kind}-${m}`,
      title: kindTitle(top.kind, top),
      severity: 'low',
      url: String(baseUrl),
      evidence: {
        request: `GET ${String(baseUrl)}`,
        response: `HTML comment contains ${kinds} — ${masked}.`,
        impact_demo:
          'Secrets and internal hostnames left in HTML comments are served to anyone who fetches the page — view-source harvests them with no login (CWE-200).',
        signalCorrelated: true,
      },
    };
    if (top.kind === 'credential-assignment') finding.parameter = top.param;
    findings.push(finding);
  }
  return findings;
}

export const __disclosureMeta = { phases: ['files'], depth: ['quick', 'standard', 'deep'] };
