/**
 * urlRoutingRecon.js — URL routing & redirect-surface reconnaissance engine.
 *
 * Maps how an authorized target handles URLs before any vulnerability
 * testing begins: where redirect parameters point, how the routing layer
 * normalizes slashes, case, encodings, and semicolon parameters, and what
 * third-party infrastructure (shorteners, affiliates, campaign trackers)
 * the site depends on. Every finding here sharpens later attack-surface
 * mapping; nothing in this module sends exploit payloads.
 *
 * Idea mapping:
 *   801  extractRedirectParamTargets / summarizeRedirectTargets
 *   802  findShortenerLinks / buildExpansionPlan / recordExpansion
 *   803  mapAffiliateLinks / summarizeAffiliateNetworks
 *   804  extractUtmParams / inferCampaignInfrastructure
 *   805  detectSessionIds
 *   806  planSlashProbes / analyzeSlashRedirects
 *   807  planCaseProbes / analyzeCaseResponses
 *   808  ENCODED_CHAR_MAP / planEncodingProbes / analyzeNormalization
 *   809  planDoubleEncodingProbes / analyzeDoubleEncoding
 *   810  planSemicolonProbes / analyzeSemicolonResponses
 *
 * All functions are pure and deterministic: they take observed data
 * (URL strings, observed redirect pairs, recorded probe responses) and
 * return structured findings. No network access is performed.
 */

/**
 * Query parameter names that commonly carry redirect/forward targets.
 * @type {string[]}
 */
export const REDIRECT_PARAM_NAMES = [
  'next', 'return', 'returnurl', 'return_url', 'redirect', 'redirect_to',
  'redirectto', 'redirect_uri', 'redir', 'url', 'target', 'to', 'dest',
  'destination', 'continue', 'continue_to', 'r', 'ref', 'referer', 'referrer',
  'callback', 'goto', 'go', 'forward', 'fwd', 'jump', 'link', 'u',
];

/**
 * Well-known URL shortener hostnames.
 * @type {string[]}
 */
export const SHORTENER_DOMAINS = [
  'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly',
  'rebrand.ly', 'cutt.ly', 'shorte.st', 'adf.ly', 'rb.gy', 't.ly',
  'tiny.cc', 'shorturl.at', 's.id', 'dub.sh', 'bitly.com',
];

/**
 * Affiliate / performance-marketing networks and their link domains.
 * @type {{network: string, domains: string[]}[]}
 */
export const AFFILIATE_NETWORKS = [
  { network: 'Amazon Associates', domains: ['amzn.to', 'amazon.com', 'a.co', 'amzn.com'] },
  { network: 'Commission Junction (CJ)', domains: ['cj.com', 'qksrv.net', 'anrdoezrs.net'] },
  { network: 'ShareASale', domains: ['shareasale.com', 'sharea-sale.com'] },
  { network: 'Rakuten Advertising', domains: ['rakutenadvertising.com', 'linksynergy.com'] },
  { network: 'Awin', domains: ['awin1.com', 'zenaps.com'] },
  { network: 'Impact', domains: ['impact.com', 'impactradius.com', 'go2cloud.org'] },
  { network: 'Partnerize', domains: ['partnerize.com', 'prf.hn'] },
  { network: 'ClickBank', domains: ['clickbank.net', 'hop.clickbank.net'] },
  { network: 'TradeDoubler', domains: ['tradedoubler.com'] },
  { network: 'eBay Partner Network', domains: ['ebay.com', 'rover.ebay.com'] },
];

/**
 * UTM parameter names recognised for campaign inference.
 * @type {string[]}
 */
export const UTM_PARAM_NAMES = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id',
];

/**
 * Session-identifier patterns that reveal URL-based stateful routing.
 * @type {{name: string, pattern: RegExp, kind: 'query'|'path'|'either'}[]}
 */
export const SESSION_ID_PATTERNS = [
  { name: 'PHPSESSID', pattern: /(?:^|[?&;])phpsessid=([^&;/?#]+)/i, kind: 'either' },
  { name: 'JSESSIONID', pattern: /(?:^|[?&;/])jsessionid=([^&;/?#]+)/i, kind: 'either' },
  { name: 'ASP.NET SessionID', pattern: /(?:^|[?&;/])aspsessionid[a-z]*=([^&;/?#]+)/i, kind: 'either' },
  { name: 'ASP.NET_SessionId cookie-in-url', pattern: /(?:^|[?&;/])asp\.net_sessionid=([^&;/?#]+)/i, kind: 'either' },
  { name: 'sessionid', pattern: /(?:^|[?&;/])sessionid=([^&;/?#]+)/i, kind: 'either' },
  { name: 'sessid', pattern: /(?:^|[?&;/])sessid=([^&;/?#]+)/i, kind: 'either' },
  { name: 'sid', pattern: /(?:^|[?&;/])sid=([A-Za-z0-9+/=_-]{8,})/i, kind: 'either' },
  { name: 'token', pattern: /(?:^|[?&;/])(?:session_?token|auth_?token)=([^&;/?#]+)/i, kind: 'either' },
  { name: 'path-embedded id', pattern: /\/[Ss](?:ession)?[_-]?[Ii][Dd]?[\/=]([A-Za-z0-9_-]{8,})/, kind: 'path' },
];

/**
 * Encoded characters used to map routing-layer normalization (idea 808).
 * Values are benign characters — this probes *decoding behavior*, not payloads.
 * @type {{char: string, encoded: string, doubleEncoded: string, description: string}[]}
 */
export const ENCODED_CHAR_MAP = [
  { char: 'A', encoded: '%41', doubleEncoded: '%2541', description: 'uppercase letter' },
  { char: 'a', encoded: '%61', doubleEncoded: '%2561', description: 'lowercase letter' },
  { char: '~', encoded: '%7E', doubleEncoded: '%257E', description: 'tilde (unreserved per RFC 3986)' },
  { char: '.', encoded: '%2E', doubleEncoded: '%252E', description: 'dot' },
  { char: '-', encoded: '%2D', doubleEncoded: '%252D', description: 'hyphen' },
  { char: ' ', encoded: '%20', doubleEncoded: '%2520', description: 'space' },
  { char: '/', encoded: '%2F', doubleEncoded: '%252F', description: 'path separator' },
  { char: ';', encoded: '%3B', doubleEncoded: '%253B', description: 'parameter separator' },
  { char: '?', encoded: '%3F', doubleEncoded: '%253F', description: 'query delimiter' },
  { char: '#', encoded: '%23', doubleEncoded: '%2523', description: 'fragment delimiter' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Safely extract the hostname from a (possibly partial) URL string.
 * Relative paths ("/dashboard") have no host — pass `baseUrl` to
 * resolve them against the source URL's host.
 * @param {string} value
 * @param {string} [baseUrl]
 * @returns {string|null}
 */
function safeHost(value, baseUrl = '') {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Relative path: inherit the host of the page that carried it.
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    try {
      const base = new URL(baseUrl);
      return base.hostname.toLowerCase() || null;
    } catch {
      return null;
    }
  }
  // Protocol-relative or schemeless host ("example.com/path").
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
    ? trimmed
    : trimmed.startsWith('//') ? `https:${trimmed}` : `https://${trimmed}`;
  try {
    const host = new URL(withScheme).hostname.toLowerCase();
    if (!host || host.includes(' ')) return null;
    return host;
  } catch {
    return null;
  }
}

/**
 * Extract the path portion of a Location header value for slash comparison.
 * @param {string|null} loc
 * @returns {string|null}
 */
function locationPath(loc) {
  if (!loc || typeof loc !== 'string') return null;
  try {
    return new URL(loc, 'https://placeholder.invalid').pathname;
  } catch {
    return loc;
  }
}

const stripTrailing = (s) => String(s || '').replace(/\/+$/, '') || '/';

/**
 * Parse the query string of a URL into a lowercase-keyed map (no throw).
 * @param {string} url
 * @returns {Map<string,string>}
 */
function queryParams(url) {
  const out = new Map();
  try {
    for (const [k, v] of new URL(url).searchParams.entries()) {
      out.set(k.toLowerCase(), v);
    }
  } catch {
    // Not a parseable absolute URL — ignore.
  }
  return out;
}

// ---------------------------------------------------------------------------
// Idea 801 — Redirect-parameter host extraction
// ---------------------------------------------------------------------------

/**
 * Extract target hosts carried by redirect parameters in the given URLs.
 *
 * Maps open-redirect-style surface for the *mapping* phase: which
 * parameters exist and where they point, so later verification can
 * test each parameter deliberately against authorized scope.
 *
 * @param {string[]} urls absolute URLs observed during crawling
 * @param {string} [scopeHost] the target's own hostname for same/external classification
 * @returns {{url: string, param: string, rawValue: string, targetHost: string|null, isExternal: boolean}[]}
 */
export function extractRedirectParamTargets(urls = [], scopeHost = '') {
  if (!Array.isArray(urls)) return [];
  const scope = String(scopeHost || '').toLowerCase();
  const findings = [];
  for (const url of urls) {
    if (typeof url !== 'string') continue;
    const params = queryParams(url);
    for (const name of REDIRECT_PARAM_NAMES) {
      if (!params.has(name)) continue;
      const rawValue = params.get(name);
      const targetHost = safeHost(rawValue, url);
      findings.push({
        url,
        param: name,
        rawValue,
        targetHost,
        isExternal: Boolean(targetHost && scope && targetHost !== scope),
      });
    }
  }
  return findings;
}

/**
 * Summarize redirect-parameter findings into a per-parameter host map.
 * @param {{param: string, targetHost: string|null, isExternal: boolean}[]} findings
 * @returns {{parameters: string[], hostMap: Record<string,string[]>, externalParams: string[], totalFindings: number}}
 */
export function summarizeRedirectTargets(findings = []) {
  const hostMap = {};
  const externalParams = new Set();
  for (const f of findings || []) {
    if (!f || !f.param) continue;
    hostMap[f.param] = hostMap[f.param] || [];
    if (f.targetHost && !hostMap[f.param].includes(f.targetHost)) {
      hostMap[f.param].push(f.targetHost);
    }
    if (f.isExternal) externalParams.add(f.param);
  }
  return {
    parameters: Object.keys(hostMap),
    hostMap,
    externalParams: [...externalParams],
    totalFindings: (findings || []).length,
  };
}

// ---------------------------------------------------------------------------
// Idea 802 — URL-shortener expansion mapping
// ---------------------------------------------------------------------------

/**
 * Find shortened URLs in observed links and identify the shortener service.
 * @param {string[]} urls
 * @returns {{url: string, shortener: string, code: string}[]}
 */
export function findShortenerLinks(urls = []) {
  if (!Array.isArray(urls)) return [];
  const out = [];
  for (const url of urls) {
    if (typeof url !== 'string') continue;
    let parsed;
    try { parsed = new URL(url); } catch { continue; }
    const host = parsed.hostname.toLowerCase();
    const match = SHORTENER_DOMAINS.find((d) => host === d || host.endsWith(`.${d}`));
    if (!match) continue;
    const code = parsed.pathname.split('/').filter(Boolean).join('/') || '';
    out.push({ url, shortener: match, code });
  }
  return out;
}

/**
 * Build a deterministic, network-free expansion plan for shortener links.
 *
 * The plan records *what to request* (a HEAD request is enough to follow
 * the redirect chain); the hunt runtime executes it separately. Mapping
 * only — no requests are made here.
 *
 * @param {{url: string, shortener: string, code: string}[]} links
 * @returns {{url: string, shortener: string, code: string, method: string, action: string}[]}
 */
export function buildExpansionPlan(links = []) {
  return (links || []).map((l) => ({
    url: l.url,
    shortener: l.shortener,
    code: l.code,
    method: 'HEAD',
    action: 'follow redirect chain and record the final destination host',
  }));
}

/**
 * Record an observed expansion result, mapping the short link to its
 * destination host for infrastructure mapping.
 * @param {{url: string, shortener: string, code: string}} link
 * @param {string} finalUrl the final URL after following redirects
 * @returns {{url: string, shortener: string, code: string, destinationHost: string|null, expanded: boolean}}
 */
export function recordExpansion(link = {}, finalUrl = '') {
  const destinationHost = safeHost(finalUrl);
  return {
    url: link.url || '',
    shortener: link.shortener || '',
    code: link.code || '',
    destinationHost,
    expanded: Boolean(destinationHost),
  };
}

// ---------------------------------------------------------------------------
// Idea 803 — Affiliate-link network mapping
// ---------------------------------------------------------------------------

/**
 * Map affiliate links to their third-party performance networks.
 * @param {string[]} urls
 * @returns {{url: string, network: string, affiliateDomain: string}[]}
 */
export function mapAffiliateLinks(urls = []) {
  if (!Array.isArray(urls)) return [];
  const out = [];
  for (const url of urls) {
    if (typeof url !== 'string') continue;
    let parsed;
    try { parsed = new URL(url); } catch { continue; }
    const host = parsed.hostname.toLowerCase();
    for (const net of AFFILIATE_NETWORKS) {
      const domain = net.domains.find((d) => host === d || host.endsWith(`.${d}`));
      if (domain) {
        out.push({ url, network: net.network, affiliateDomain: domain });
        break;
      }
    }
  }
  return out;
}

/**
 * Summarize affiliate mappings per network.
 * @param {{network: string, affiliateDomain: string}[]} mapped
 * @returns {{networks: string[], byNetwork: Record<string,{links: number, domains: string[]}>}}
 */
export function summarizeAffiliateNetworks(mapped = []) {
  const byNetwork = {};
  for (const m of mapped || []) {
    if (!m || !m.network) continue;
    byNetwork[m.network] = byNetwork[m.network] || { links: 0, domains: [] };
    byNetwork[m.network].links += 1;
    if (m.affiliateDomain && !byNetwork[m.network].domains.includes(m.affiliateDomain)) {
      byNetwork[m.network].domains.push(m.affiliateDomain);
    }
  }
  return { networks: Object.keys(byNetwork), byNetwork };
}

// ---------------------------------------------------------------------------
// Idea 804 — UTM-parameter campaign inference
// ---------------------------------------------------------------------------

/**
 * Extract UTM parameters from a single URL.
 * @param {string} url
 * @returns {{utm_source: string, utm_medium: string, utm_campaign: string, utm_term: string, utm_content: string, utm_id: string}}
 */
export function extractUtmParams(url = '') {
  const blank = {
    utm_source: '', utm_medium: '', utm_campaign: '',
    utm_term: '', utm_content: '', utm_id: '',
  };
  if (typeof url !== 'string') return blank;
  const params = queryParams(url);
  for (const name of UTM_PARAM_NAMES) {
    if (params.has(name)) blank[name] = params.get(name);
  }
  return blank;
}

/**
 * Infer campaign infrastructure from UTM-tagged URLs observed on the target.
 *
 * Groups links by (source, medium, campaign) and records the landing-host
 * footprint plus which ad/tracker infrastructure the campaigns rely on,
 * so the hunt can scope third-party campaign hosts deliberately.
 *
 * @param {string[]} urls
 * @returns {{campaigns: {key: string, source: string, medium: string, campaign: string, landingHosts: string[], linkCount: number, terms: string[], contents: string[]}[], inferredInfra: string[]}}
 */
export function inferCampaignInfrastructure(urls = []) {
  const groups = new Map();
  for (const url of urls || []) {
    if (typeof url !== 'string') continue;
    const utm = extractUtmParams(url);
    if (!utm.utm_source && !utm.utm_medium && !utm.utm_campaign) continue;
    const key = `${utm.utm_source}|${utm.utm_medium}|${utm.utm_campaign}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        source: utm.utm_source,
        medium: utm.utm_medium,
        campaign: utm.utm_campaign,
        landingHosts: [],
        linkCount: 0,
        terms: [],
        contents: [],
      });
    }
    const g = groups.get(key);
    g.linkCount += 1;
    let host = null;
    try { host = new URL(url).hostname.toLowerCase(); } catch { /* ignore */ }
    if (host && !g.landingHosts.includes(host)) g.landingHosts.push(host);
    if (utm.utm_term && !g.terms.includes(utm.utm_term)) g.terms.push(utm.utm_term);
    if (utm.utm_content && !g.contents.includes(utm.utm_content)) g.contents.push(utm.utm_content);
  }
  const campaigns = [...groups.values()];
  // Infrastructure hints: known ad/tracker sources and distinct landing hosts.
  const infra = new Set();
  for (const c of campaigns) {
    for (const h of c.landingHosts) infra.add(h);
    const src = c.source.toLowerCase();
    if (/(google|facebook|fb|instagram|tiktok|linkedin|twitter|x\.com|bing|newsletter|email)/.test(src)) {
      infra.add(`ad-network:${c.source}`);
    }
  }
  return { campaigns, inferredInfra: [...infra] };
}

// ---------------------------------------------------------------------------
// Idea 805 — Session-ID URL-rewriting detection
// ---------------------------------------------------------------------------

/**
 * Detect session identifiers embedded in URLs (URL rewriting), which
 * reveal stateful routing and session-fixation surface.
 * @param {string[]} urls
 * @returns {{url: string, location: 'query'|'path', param: string, value: string, patternName: string, confidence: 'high'|'medium'}[]}
 */
export function detectSessionIds(urls = []) {
  if (!Array.isArray(urls)) return [];
  const findings = [];
  for (const url of urls) {
    if (typeof url !== 'string') continue;
    const seen = new Set();
    for (const sig of SESSION_ID_PATTERNS) {
      const m = sig.pattern.exec(url);
      if (!m || !m[1]) continue;
      const value = m[1];
      // Ignore obvious placeholders and tiny values.
      if (/^(true|false|null|undefined|none|empty|test|demo|0|1)$/i.test(value)) continue;
      if (value.length < 6) continue;
      const dedupe = `${sig.name}:${value}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      let location = 'query';
      try {
        const parsed = new URL(url);
        const inQuery = parsed.search.includes(value) || parsed.search.toLowerCase().includes(sig.name.toLowerCase().replace(/[^a-z]/g, ''));
        location = inQuery ? 'query' : 'path';
      } catch {
        location = url.includes('?') ? 'query' : 'path';
      }
      findings.push({
        url,
        location,
        param: sig.name,
        value,
        patternName: sig.name,
        confidence: /^(PHPSESSID|JSESSIONID|ASP)/.test(sig.name) ? 'high' : 'medium',
      });
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Idea 806 — Trailing-slash redirect mapping
// ---------------------------------------------------------------------------

/**
 * Build the trailing-slash probe plan for a path.
 * @param {string} path e.g. "/admin"
 * @returns {{label: string, path: string}[]}
 */
export function planSlashProbes(path = '') {
  const p = String(path || '');
  if (!p) return [];
  const base = p === '/' ? '' : p.replace(/\/+$/, '');
  return [
    { label: 'with-trailing-slash', path: `${base}/` },
    { label: 'without-trailing-slash', path: base || '/' },
  ];
}

/**
 * Analyze observed slash-handling behavior to infer framework routing.
 *
 * Each observation: { path, status, location } where `location` is the
 * Location header (or null) from the recorded response.
 *
 * @param {string} path the original path that was probed
 * @param {{path: string, status: number, location: string|null}[]} observations
 * @returns {{slashHandling: 'adds'|'removes'|'none'|'inconsistent'|'unknown', redirectMap: {from: string, to: string|null, status: number}[], frameworkHint: string|null, note: string}}
 */
export function analyzeSlashRedirects(path = '', observations = []) {
  const redirectMap = (observations || []).map((o) => ({
    from: o.path,
    to: o.location || null,
    status: o.status,
  }));
  if (redirectMap.length === 0) {
    return { slashHandling: 'unknown', redirectMap, frameworkHint: null, note: 'no observations recorded' };
  }
  const adds = redirectMap.some((r) => {
    const toPath = locationPath(r.to);
    return toPath && stripTrailing(toPath) === stripTrailing(r.from)
      && toPath.endsWith('/') && !String(r.from).endsWith('/');
  });
  const removes = redirectMap.some((r) => {
    const toPath = locationPath(r.to);
    return toPath && stripTrailing(toPath) === stripTrailing(r.from)
      && !toPath.endsWith('/') && String(r.from).endsWith('/');
  });
  const anyRedirect = redirectMap.some((r) => r.to && [301, 302, 307, 308].includes(r.status));
  let slashHandling = 'none';
  if (adds && removes) slashHandling = 'inconsistent';
  else if (adds) slashHandling = 'adds';
  else if (removes) slashHandling = 'removes';
  else if (!anyRedirect) slashHandling = 'none';

  let frameworkHint = null;
  if (slashHandling === 'adds') frameworkHint = 'Django/Flask-style (APPEND_SLASH-like canonicalization)';
  else if (slashHandling === 'removes') frameworkHint = 'Express-style (strict-routing slash trimming)';
  else if (slashHandling === 'inconsistent') frameworkHint = 'mixed layers — possible reverse-proxy in front of app server';

  return {
    slashHandling,
    redirectMap,
    frameworkHint,
    note: anyRedirect
      ? 'slash redirects observed — routing is canonicalized at one layer'
      : 'no slash redirects — each variant routes independently',
  };
}

// ---------------------------------------------------------------------------
// Idea 807 — Case-sensitivity path probing
// ---------------------------------------------------------------------------

/**
 * Build case-variation probes for a path to fingerprint case handling.
 * @param {string} path e.g. "/Admin/Panel"
 * @returns {{label: string, path: string}[]}
 */
export function planCaseProbes(path = '') {
  const p = String(path || '');
  if (!p) return [];
  const variants = new Map();
  const add = (label, v) => { if (v !== p && !variants.has(v)) variants.set(v, label); };
  add('lowercase', p.toLowerCase());
  add('uppercase', p.toUpperCase());
  const swap = p.split('').map((c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase())).join('');
  add('swapped-case', swap);
  // Capitalize each path segment — catches case-insensitive routers that
  // canonicalize only the first letter.
  const capSeg = p.split('/').map((s) => (s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s)).join('/');
  add('capitalized-segments', capSeg);
  return [...variants.entries()].map(([v, label]) => ({ label, path: v }));
}

/**
 * Analyze case-probe responses to fingerprint case handling.
 *
 * Each response: { path, status, length } recorded by the hunt runtime.
 *
 * @param {string} path original path
 * @param {{path: string, status: number, length: number}[]} responses
 * @returns {{caseSensitive: boolean|null, behavior: Record<string,string>, hiddenRouteHints: string[], fingerprint: string|null}}
 */
export function analyzeCaseResponses(path = '', responses = []) {
  const behavior = {};
  const hiddenRouteHints = [];
  if (!responses || responses.length === 0) {
    return { caseSensitive: null, behavior, hiddenRouteHints, fingerprint: null };
  }
  let allSameAsOriginal = true;
  let allNotFound = true;
  for (const r of responses) {
    const key = r.path;
    if (r.status === 200) {
      behavior[key] = 'served';
      allNotFound = false;
    } else if (r.status === 301 || r.status === 302 || r.status === 307 || r.status === 308) {
      behavior[key] = 'redirected';
      allSameAsOriginal = false;
      allNotFound = false;
    } else if (r.status === 403) {
      behavior[key] = 'forbidden';
      allSameAsOriginal = false;
      allNotFound = false;
      hiddenRouteHints.push(key); // exists but denied — worth deeper probing
    } else if (r.status === 404) {
      behavior[key] = 'not-found';
    } else {
      behavior[key] = `status-${r.status}`;
      allSameAsOriginal = false;
      allNotFound = false;
    }
  }
  let caseSensitive = null;
  if (allNotFound) caseSensitive = true; // router rejects every variant
  else if (allSameAsOriginal) caseSensitive = false; // router normalizes case
  const fingerprint = caseSensitive === false
    ? 'case-insensitive routing (Windows/IIS-style or normalizing router)'
    : caseSensitive === true
      ? 'case-sensitive routing (Linux/nginx-style strict match)'
      : 'mixed case behavior — layered routing or per-route rules';
  return { caseSensitive, behavior, hiddenRouteHints, fingerprint };
}

// ---------------------------------------------------------------------------
// Idea 808 — URL-encoded path normalization mapping
// ---------------------------------------------------------------------------

/**
 * Build probes that map how the routing layer normalizes encoded characters.
 * Uses only benign characters — this maps *decoding behavior*, never payloads.
 * @param {string} path base path, e.g. "/about"
 * @returns {{label: string, path: string, char: string, encoded: string}[]}
 */
export function planEncodingProbes(path = '') {
  const p = String(path || '');
  if (!p) return [];
  return ENCODED_CHAR_MAP.map((e) => ({
    label: `encoded-${e.description}`,
    // Encode the first path character of the base path to observe normalization.
    path: p.charAt(0) === '/' ? `/${e.encoded}${p.slice(2)}` : `${e.encoded}${p.slice(1)}`,
    char: e.char,
    encoded: e.encoded,
  }));
}

/**
 * Analyze normalization observations: does the stack decode before routing?
 *
 * Each observation: { label, path, status, servedPath } where `servedPath`
 * is the path the server *acted on* (from logs/headers/body), or null if
 * it could not be determined.
 *
 * @param {{label: string, path: string, char: string, encoded: string}[]} probes
 * @param {{label: string, status: number, servedPath: string|null}[]} observations
 * @returns {{decodesBeforeRouting: boolean|null, normalizedChars: string[], layers: string, notes: string[]}}
 */
export function analyzeNormalization(probes = [], observations = []) {
  const notes = [];
  const normalizedChars = [];
  const byLabel = new Map((observations || []).map((o) => [o.label, o]));
  let decoded = 0;
  let total = 0;
  for (const probe of probes || []) {
    const obs = byLabel.get(probe.label);
    if (!obs) continue;
    total += 1;
    if (obs.servedPath && obs.servedPath.includes(probe.char)) {
      decoded += 1;
      normalizedChars.push(probe.char);
      notes.push(`${probe.encoded} decoded to '${probe.char}' before routing`);
    } else if (obs.status === 400 || obs.status === 404) {
      notes.push(`${probe.encoded} rejected or not matched (status ${obs.status})`);
    }
  }
  let decodesBeforeRouting = null;
  let layers = 'unknown';
  if (total > 0) {
    if (decoded === total) {
      decodesBeforeRouting = true;
      layers = 'single decoding layer before routing (or fully-normalizing stack)';
    } else if (decoded === 0) {
      decodesBeforeRouting = false;
      layers = 'no decoding before routing — encoded forms route literally';
    } else {
      decodesBeforeRouting = true;
      layers = 'partial normalization — mixed decoding across layers (proxy vs app split likely)';
    }
  }
  return { decodesBeforeRouting, normalizedChars, layers, notes };
}

// ---------------------------------------------------------------------------
// Idea 809 — Double-encoding normalization analysis
// ---------------------------------------------------------------------------

/**
 * Build single-vs-double-encoding probe pairs for one character.
 * @param {string} path base path
 * @param {string} [char='A'] a benign character from ENCODED_CHAR_MAP
 * @returns {{label: string, path: string, encoding: 'single'|'double'}[]}
 */
export function planDoubleEncodingProbes(path = '', char = 'A') {
  const p = String(path || '');
  const entry = ENCODED_CHAR_MAP.find((e) => e.char === char) || ENCODED_CHAR_MAP[0];
  if (!p) return [];
  const rest = p.charAt(0) === '/' ? p.slice(2) : p.slice(1);
  const prefix = p.charAt(0) === '/' ? '/' : '';
  return [
    { label: `single-encoded-${entry.description}`, path: `${prefix}${entry.encoded}${rest}`, encoding: 'single', char: entry.char, encoded: entry.encoded },
    { label: `double-encoded-${entry.description}`, path: `${prefix}${entry.doubleEncoded}${rest}`, encoding: 'double', char: entry.char, encoded: entry.encoded },
  ];
}

/**
 * Analyze double-encoding behavior to fingerprint WAF/server combos.
 *
 * Each observation: { label, status, servedPath } as in analyzeNormalization.
 *
 * @param {{label: string, encoding: string}[]} probes
 * @param {{label: string, status: number, servedPath: string|null}[]} observations
 * @returns {{doubleDecodingDetected: boolean|null, interpretation: string, wafFingerprintHint: string|null, notes: string[]}}
 */
export function analyzeDoubleEncoding(probes = [], observations = []) {
  const notes = [];
  const byLabel = new Map((observations || []).map((o) => [o.label, o]));
  let single = null;
  let dbl = null;
  for (const probe of probes || []) {
    const obs = byLabel.get(probe.label);
    if (!obs) continue;
    if (probe.encoding === 'single') single = obs;
    else dbl = obs;
    if (obs.servedPath) notes.push(`${probe.label}: server acted on '${obs.servedPath}' (status ${obs.status})`);
  }
  if (!single || !dbl) {
    return {
      doubleDecodingDetected: null,
      interpretation: 'incomplete observations — both single and double probes are required',
      wafFingerprintHint: null,
      notes,
    };
  }
  // Double-decoding: the double-encoded value resolves to the literal char,
  // meaning the stack decoded twice (often WAF at one layer, app at another).
  // The double-encoded sequence (e.g. %2541) must be fully gone from the
  // served path AND the literal char present — a single decode would leave
  // the once-encoded form (%41) behind.
  const probeChar = (probes || []).find((pr) => pr.encoding === 'double')?.char || 'A';
  const doubleDecoded = Boolean(
    dbl.servedPath
      && dbl.servedPath.includes(probeChar)
      && !/%25/i.test(dbl.servedPath)
      && dbl.status === 200,
  );
  const singleRejected = single.status === 400 || single.status === 404;
  let interpretation;
  let wafFingerprintHint = null;
  if (doubleDecoded && !singleRejected) {
    interpretation = 'stack decodes more than once — layered normalization (proxy/WAF + app)';
    wafFingerprintHint = 'double-decoding layer present: WAF may inspect a different encoding layer than the app routes on';
  } else if (doubleDecoded) {
    interpretation = 'double-encoded form accepted while single form rejected — asymmetric normalization across layers';
    wafFingerprintHint = 'possible WAF bypass surface via encoding asymmetry (verify manually in scope)';
  } else {
    interpretation = 'no double decoding — single normalization pass';
  }
  return { doubleDecodingDetected: doubleDecoded, interpretation, wafFingerprintHint, notes };
}

// ---------------------------------------------------------------------------
// Idea 810 — Semicolon-parameter route splitting
// ---------------------------------------------------------------------------

/**
 * Build semicolon-parameter probes that can split routes across layers.
 * Matrix-style `;param=value` segments are honored by some frameworks
 * (Spring, older servlet containers) and ignored by others — a split
 * means proxy and app see different resources.
 * @param {string} path base path, e.g. "/account"
 * @returns {{label: string, path: string}[]}
 */
export function planSemicolonProbes(path = '') {
  const p = String(path || '');
  if (!p) return [];
  return [
    { label: 'semicolon-param', path: `${p};probe=1` },
    { label: 'semicolon-empty-param', path: `${p};` },
    { label: 'semicolon-mid-path', path: p.includes('/') ? `${p.replace(/\/([^/]*)$/, ';probe=1/$1')}` : `${p};probe=1` },
    { label: 'semicolon-jsessionid-style', path: `${p};id=abc123` },
  ];
}

/**
 * Analyze semicolon-probe responses for route-splitting behavior.
 *
 * Each response: { label, path, status, length } recorded by the hunt runtime.
 *
 * @param {string} path original path
 * @param {{label: string, path: string, status: number, length: number}[]} responses
 * @returns {{behavior: 'unified'|'split'|'ignored'|'redirect'|'unknown', layerSplit: boolean, details: string, perProbe: Record<string,string>}}
 */
export function analyzeSemicolonResponses(path = '', responses = []) {
  const perProbe = {};
  if (!responses || responses.length === 0) {
    return { behavior: 'unknown', layerSplit: false, details: 'no observations recorded', perProbe };
  }
  const statuses = new Set();
  let sawRedirect = false;
  let sawServed = false;
  for (const r of responses) {
    statuses.add(r.status);
    if ([301, 302, 307, 308].includes(r.status)) { perProbe[r.label] = 'redirected'; sawRedirect = true; }
    else if (r.status === 200) { perProbe[r.label] = 'served'; sawServed = true; }
    else if (r.status === 404) { perProbe[r.label] = 'not-found'; }
    else if (r.status === 400) { perProbe[r.label] = 'rejected'; }
    else { perProbe[r.label] = `status-${r.status}`; }
  }
  let behavior = 'unified';
  let layerSplit = false;
  let details;
  if (statuses.size > 1) {
    behavior = 'split';
    layerSplit = true;
    details = 'semicolon segments are handled differently across probes — routing layers disagree on the resource identity';
  } else if (sawRedirect) {
    behavior = 'redirect';
    details = 'semicolon variants are canonicalized via redirect — router strips or normalizes the segment';
  } else if (sawServed) {
    behavior = 'unified';
    details = 'all semicolon variants serve the same resource — segment ignored or stripped uniformly';
  } else {
    behavior = 'ignored';
    details = 'semicolon variants are uniformly rejected/not found — segment not routed';
  }
  return { behavior, layerSplit, details, perProbe };
}

// ---------------------------------------------------------------------------
// Aggregate export
// ---------------------------------------------------------------------------

export const URL_ROUTING_RECON = {
  // idea 801
  extractRedirectParamTargets,
  summarizeRedirectTargets,
  REDIRECT_PARAM_NAMES,
  // idea 802
  findShortenerLinks,
  buildExpansionPlan,
  recordExpansion,
  SHORTENER_DOMAINS,
  // idea 803
  mapAffiliateLinks,
  summarizeAffiliateNetworks,
  AFFILIATE_NETWORKS,
  // idea 804
  extractUtmParams,
  inferCampaignInfrastructure,
  UTM_PARAM_NAMES,
  // idea 805
  detectSessionIds,
  SESSION_ID_PATTERNS,
  // idea 806
  planSlashProbes,
  analyzeSlashRedirects,
  // idea 807
  planCaseProbes,
  analyzeCaseResponses,
  // idea 808
  planEncodingProbes,
  analyzeNormalization,
  ENCODED_CHAR_MAP,
  // idea 809
  planDoubleEncodingProbes,
  analyzeDoubleEncoding,
  // idea 810
  planSemicolonProbes,
  analyzeSemicolonResponses,
};

export default URL_ROUTING_RECON;
