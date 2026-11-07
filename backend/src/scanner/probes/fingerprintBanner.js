// Dark Matter rule-based scanner — server / technology fingerprinting
// & banner disclosure (coverage row #183 [Low], phase 72).
//
// DIAGNOSIS: a server that signs its responses hands the attacker its
// exact stack before any payload is sent — `Server: Apache/2.4.52`,
// `X-Powered-By: PHP/8.1.2`, an error page footered
// "Apache/2.4.52 (Debian) Server at localhost Port 80". The version
// turns every later probe from a guess into a CVE lookup.
//
// VERIFICATION (100% truth rule): a finding counts ONLY when a version
// number / build identifier is actually disclosed. Mere header
// presence is NEVER a finding (`Server: nginx`, `X-Powered-By:
// Express`, `Via: 1.1 varnish` carry no version and fire nothing),
// and a protocol version is not a server version (`Via: 1.1`,
// `HTTP/1.1` are excluded). Error-page body matches count ONLY on
// the mandatory baseline differential — the matched version string
// must appear in the 4xx/5xx error body AND NOT in the baseline GET
// of the pasted page (a docs page that prints "Apache 2.4" in its
// own text is not a disclosure). One finding per distinct leak
// (header + product + version, or body product + version); the same
// leak on the page and on the 404 trigger is one finding, first URL
// cited. A bare 404/500 with no version string is NEVER a finding,
// and a soft 200 error page is not scanned at all — the design
// scans 4xx/5xx bodies only.
//
// SAFETY: read-only GETs only — no writes, no allowWrite gate. The
// pasted page (baseline) + up to 5 probe-target responses for
// header inspection + one 404 trigger per distinct directory (cap 5).
// The pasted page is always a surface, so this phase never skips.
import { createHash } from 'node:crypto';
import { fetchPage } from '../fingerprint.js';

const MAX_TARGETS = 5;
const MAX_TRIGGERS = 5;
const MAX_FINDINGS = 20;

// Deterministic non-existent leaf: the same on every scan, so a
// repeated scan is reproducible and the token can never collide with
// a real application file. Shared with errorDisclosure.js.
const NONEXISTENT_LEAF = 'dm-nonexistent-9f27a1c4.html';

// Response headers that can carry a server/framework version. Other
// headers (Date, Content-Type, Cache-Control, ...) are never scanned
// — a version in an unlisted header is out of scope by design.
const MONITORED_HEADERS = [
  'server',
  'x-powered-by',
  'x-aspnet-version',
  'x-aspnetmvc-version',
  'x-generator',
  'x-backend',
  'via',
  'x-runtime',
  'x-version',
];

// Product tokens that are protocol names, not server versions —
// `Via: HTTP/1.1` discloses the proxy protocol, not the stack.
const EXCLUDED_PRODUCTS = new Set(['http', 'https']);

// Headers whose bare value IS a version (no product token in the
// value itself) — the header name is the product. Restricted to
// headers that name a version by construction; `x-runtime` (Rails
// response time in seconds, e.g. `0.123456`) is deliberately NOT
// here — a bare dotted number there is a duration, not a version.
const BARE_VERSION_HEADERS = new Set(['x-aspnet-version', 'x-aspnetmvc-version', 'x-version']);

// One product/version pair inside a header value: a word token, a `/`
// or space separator, then a dotted version (major.minor minimum —
// a bare integer such as `Varnish/7` is not a version). The version
// may carry build suffixes (`8.1.2-1ubuntu2.11`).
const PAIR_RE_SOURCE =
  '([A-Za-z][A-Za-z0-9._+-]{0,40})[\\/\\s]v?(\\d+\\.\\d+(?:\\.\\d+){0,2}(?:[-._][A-Za-z0-9]+)*)';

// Error-page body patterns: named server/framework version footers.
// Each entry names the product; the single capture group is the
// version. Deliberately an explicit product list — a generic
// product/version pair in body text would fire on innocent docs
// prose ("API 2.0"), so bodies only match known server footers.
const BODY_VERSION_PATTERNS = [
  { product: 'Apache', re: /Apache\/(\d+\.\d+(?:\.\d+)?)/g },
  { product: 'nginx', re: /nginx\/(\d+\.\d+(?:\.\d+)?)/g },
  { product: 'Microsoft-IIS', re: /Microsoft-IIS\/(\d+\.\d+(?:\.\d+)?)/g },
  { product: 'PHP', re: /PHP(?:\/| Version:?\s*)(\d+\.\d+(?:\.\d+)?)/g },
  { product: 'ASP.NET', re: /ASP\.NET(?:\/| Version:?\s*)(\d+\.\d+(?:\.\d+)?)/g },
  { product: '.NET Framework', re: /Microsoft \.NET Framework Version:?\s*(\d+\.\d+(?:\.\d+)?)/g },
  { product: 'Django', re: /Django(?:\/| Version:?\s*)(\d+\.\d+(?:\.\d+)?)/g },
  { product: 'Tomcat', re: /Tomcat\/(\d+\.\d+(?:\.\d+)?)/g },
  { product: 'Jetty', re: /Jetty:\/\/\s*(\d+\.\d+(?:\.\d+)?)/g },
  { product: 'Node.js', re: /Node\.js[\/\s]v?(\d+\.\d+(?:\.\d+)?)/g },
  { product: 'Express', re: /Express\/(\d+\.\d+(?:\.\d+)?)/g },
  { product: 'Werkzeug', re: /Werkzeug\/(\d+\.\d+(?:\.\d+)?)/g },
  { product: 'WordPress', re: /WordPress\/(\d+\.\d+(?:\.\d+)?)/g },
  { product: 'Drupal', re: /Drupal[\/\s](\d+\.\d+(?:\.\d+)?)/g },
  { product: 'Joomla', re: /Joomla!?[\/\s](\d+\.\d+(?:\.\d+)?)/g },
];

function sha12(text) {
  return createHash('sha256').update(String(text || '')).digest('hex').slice(0, 12);
}

// A redacted snippet around the match — newlines flattened, capped.
function snippetAround(body, matchIndex, matchLen) {
  const start = Math.max(0, matchIndex - 80);
  const end = Math.min(body.length, matchIndex + matchLen + 80);
  let snip = body.slice(start, end).replace(/\s+/g, ' ').trim();
  if (start > 0) snip = `…${snip}`;
  if (end < body.length) snip = `${snip}…`;
  return snip.slice(0, 400);
}

/**
 * Extract product/version pairs from one header value. Pure —
 * exported for unit tests. Returns [{ product, version }] in order
 * of appearance, deduped. A value with no version returns [].
 */
export function extractBannerVersions(value, headerName) {
  const text = typeof value === 'string' ? value : '';
  if (!text) return [];
  const out = [];
  const seen = new Set();
  const pairRe = new RegExp(PAIR_RE_SOURCE, 'g');
  let m;
  while ((m = pairRe.exec(text)) !== null) {
    const product = m[1];
    const version = m[2];
    if (EXCLUDED_PRODUCTS.has(product.toLowerCase())) continue;
    const key = `${product.toLowerCase()}|${version}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ product, version });
  }
  if (out.length === 0 && BARE_VERSION_HEADERS.has(String(headerName || '').toLowerCase())) {
    const bare = /^\s*v?(\d+\.\d+(?:\.\d+){0,2}(?:[-._][A-Za-z0-9]+)*)\s*$/.exec(text);
    if (bare) out.push({ product: headerName, version: bare[1] });
  }
  return out;
}

// Scan one error body for named server/framework version strings.
// Returns [{ product, version, match }] — the match is the full
// matched token (e.g. "Apache/2.4.52"), deduped per body.
function findBodyVersions(body) {
  const text = typeof body === 'string' ? body : '';
  const out = [];
  const seen = new Set();
  for (const p of BODY_VERSION_PATTERNS) {
    const fresh = new RegExp(p.re.source, p.re.flags);
    let m;
    while ((m = fresh.exec(text)) !== null) {
      const key = `${p.product}|${m[1]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ product: p.product, version: m[1], match: m[0] });
    }
  }
  return out;
}

/**
 * Core detection for one fetched response — THE negative-control
 * stub point: replacing this body with `return [];` must make every
 * finding-expecting probe test fail and nothing else. Headers are
 * scanned on every response; the body is scanned only when the
 * response is an error (4xx/5xx) and the matched version string
 * does not appear in the baseline page body (mandatory
 * differential). Returns [{ kind, header?, product, version, value?,
 * match? }].
 */
function detectLeaks(headers, body, isError, baselineBody) {
  const leaks = [];
  for (const [name, value] of Object.entries(headers || {})) {
    if (!MONITORED_HEADERS.includes(String(name).toLowerCase())) continue;
    for (const pair of extractBannerVersions(value, name)) {
      leaks.push({
        kind: 'header',
        header: name,
        product: pair.product,
        version: pair.version,
        value: String(value),
      });
    }
  }
  if (isError && typeof body === 'string' && body) {
    const base = typeof baselineBody === 'string' ? baselineBody : '';
    for (const hit of findBodyVersions(body)) {
      // DIFFERENTIAL (mandatory): the version string must NOT
      // appear in the baseline page body.
      if (base.includes(hit.match)) continue;
      leaks.push({ kind: 'body', product: hit.product, version: hit.version, match: hit.match });
    }
  }
  return leaks;
}

/**
 * Build the 404-trigger request list for a set of URLs. Pure —
 * exported for unit tests. One non-existent-path trigger per
 * distinct origin + directory, capped at MAX_TRIGGERS. Each trigger
 * carries the URL to fetch and the baseline URL it is differenced
 * against (the first target in that directory).
 */
export function buildBannerTriggers(urls) {
  const list = Array.isArray(urls) ? urls.filter(Boolean) : [];
  const triggers = [];
  const seenDirs = new Set();
  for (const raw of list) {
    if (triggers.length >= MAX_TRIGGERS) break;
    let u;
    try {
      u = new URL(raw);
    } catch {
      continue;
    }
    const dir = u.pathname.slice(0, u.pathname.lastIndexOf('/') + 1) || '/';
    const key = `${u.origin}${dir}`;
    if (seenDirs.has(key)) continue;
    seenDirs.add(key);
    const bad = new URL(u);
    bad.pathname = `${dir}${NONEXISTENT_LEAF}`;
    bad.search = '';
    bad.hash = '';
    triggers.push({ url: bad.toString(), baselineUrl: raw, directory: dir });
  }
  return triggers;
}

// Record one leak as a finding; dedup is on kind + identifying
// version (header + product + version, or body product + version).
function pushFinding(leak, res, url, baselineUrl, findings, seen) {
  const key =
    leak.kind === 'header'
      ? `header|${String(leak.header).toLowerCase()}|${leak.product}|${leak.version}`
      : `body|${leak.product}|${leak.version}`;
  if (seen.has(key)) return;
  seen.add(key);
  const title =
    leak.kind === 'header'
      ? `Server banner disclosure — ${leak.product} ${leak.version} in '${leak.header}' response header`
      : `Server banner disclosure — ${leak.product} ${leak.version} in error-page body`;
  findings.push({
    class: 'banner_disclosure',
    id: `fingerprint-banner-${sha12(key)}`,
    title,
    severity: 'low',
    url,
    parameter: null,
    evidence: {
      request:
        leak.kind === 'header'
          ? `GET ${url}`
          : `GET ${url} (non-existent path); baseline GET ${baselineUrl}`,
      response:
        leak.kind === 'header'
          ? `HTTP ${res.status} response discloses ${leak.product} ${leak.version} in '${leak.header}' header: ${leak.value}`
          : `HTTP ${res.status} error response discloses ${leak.product} ${leak.version}: snippet: ${snippetAround(
              res.body,
              res.body.indexOf(leak.match),
              leak.match.length
            )}`,
      impact_demo:
        'Banner-disclosure primitive — the exact server/framework version narrows every later probe (known CVE lookup, version-specific payloads) to the real stack instead of guesses; chain with a version-targeted exploit against the named component.',
      signalCorrelated: true,
    },
  });
}

/**
 * Probe server / technology fingerprinting & banner disclosure (#183).
 * @param {string} pageUrl — the pasted page (baseline + header surface).
 * @param {string[]} urls — distinct GET probe target URLs (the
 *   orchestrator selects them; their responses' headers are also
 *   scanned, and one 404 trigger is built per distinct directory).
 * @param {object} opts — { timeoutMs, headers, fetchPage }.
 *   fetchPage is the test seam (defaults to fingerprint.fetchPage).
 * @returns {object[]} findings (class 'banner_disclosure', low).
 */
export async function probeFingerprintBanner(pageUrl, urls, opts = {}) {
  const fetchFn = typeof opts.fetchPage === 'function' ? opts.fetchPage : fetchPage;
  const findings = [];
  const seen = new Set();
  const targets = [];
  const seenUrls = new Set();
  const pushTarget = (u) => {
    if (u && !seenUrls.has(u)) {
      seenUrls.add(u);
      targets.push(u);
    }
  };
  pushTarget(pageUrl);
  for (const u of Array.isArray(urls) ? urls : []) {
    if (targets.length >= MAX_TARGETS) break;
    pushTarget(u);
  }

  // Baseline first: the pasted page's body is the control the
  // error-page differential is measured against. Its headers are
  // scanned too — the page's own banner is the primary surface.
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
  if (baselineRes && baselineRes.headers) {
    for (const leak of detectLeaks(baselineRes.headers, null, false, baselineBody)) {
      pushFinding(leak, baselineRes, pageUrl, pageUrl, findings, seen);
      if (findings.length >= MAX_FINDINGS) return findings;
    }
  }

  // Probe-target responses: headers only (a target that itself
  // errors gets its body scanned too — it IS an error page then).
  for (const target of targets.slice(1)) {
    if (findings.length >= MAX_FINDINGS) break;
    let res;
    try {
      res = await fetchFn(target, opts);
    } catch {
      continue;
    }
    if (!res) continue;
    const isError = typeof res.status === 'number' && res.status >= 400;
    for (const leak of detectLeaks(res.headers, isError ? res.body : null, isError, baselineBody)) {
      pushFinding(leak, res, target, pageUrl, findings, seen);
      if (findings.length >= MAX_FINDINGS) break;
    }
  }

  // 404 triggers: headers + body (4xx/5xx only).
  const triggers = buildBannerTriggers([pageUrl, ...(Array.isArray(urls) ? urls : [])]);
  for (const trigger of triggers) {
    if (findings.length >= MAX_FINDINGS) break;
    let res;
    try {
      res = await fetchFn(trigger.url, opts);
    } catch {
      continue;
    }
    if (!res || !res.body) continue;
    // Only 4xx/5xx responses are error responses. A 2xx/3xx
    // answer to a bad path is a soft error page, not a leak
    // surface — it is not scanned.
    if (typeof res.status !== 'number' || res.status < 400) continue;
    for (const leak of detectLeaks(res.headers, res.body, true, baselineBody)) {
      pushFinding(leak, res, trigger.url, trigger.baselineUrl, findings, seen);
      if (findings.length >= MAX_FINDINGS) break;
    }
  }
  return findings;
}

export const __fingerprintBannerMeta = { phases: ['fingerprint-banner'], depth: ['quick', 'standard', 'deep'] };
