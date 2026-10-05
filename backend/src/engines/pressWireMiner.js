/**
 * pressWireMiner.js — Press-release wire host mining engine.
 *
 * @idea 00297
 * Covers idea-bank item 00297:
 *  - 00297 Press-release wire host mining — extract canonical hosts from
 *    press-release wire distributions.
 *
 * Pure functions only: the caller fetches press-release pages / wire feeds
 * and passes the raw HTML or text in. No live HTTP here.
 */

const WIRE_HOSTS = [
  { host: 'globenewswire.com', provider: 'globenewswire', note: 'GlobeNewswire distribution host' },
  { host: 'businesswire.com', provider: 'businesswire', note: 'Business Wire distribution host' },
  { host: 'prnewswire.com', provider: 'prnewswire', note: 'PR Newswire distribution host' },
  { host: 'prweb.com', provider: 'prweb', note: 'PRWeb distribution host' },
  { host: 'newswire.com', provider: 'newswire', note: 'Newswire distribution host' },
  { host: 'einpresswire.com', provider: 'einpresswire', note: 'EIN Presswire distribution host' },
  { host: 'accessnewswire.com', provider: 'accessnewswire', note: 'ACCESS Newswire distribution host' },
  { host: 'newsfilecorp.com', provider: 'newsfile', note: 'Newsfile Corp distribution host' },
];

const ATTR_URL_RE = /(?:href|src|data-[a-z-]*url|content)\s*=\s*["']([^"']+)["']/gi;
const BARE_URL_RE = /https?:\/\/([^\s"'<>()?#/:]+)(?::\d+)?(?:\/[^\s"'<>()]*)?/gi;

/**
 * Normalize a hostname: lowercase, strip scheme, port, trailing dot.
 * @param {string} host
 * @returns {string}
 */
export function normalizeHost(host) {
  return String(host || '')
    .trim()
    .toLowerCase()
    .replace(/^\w+:\/\//, '')
    .replace(/:\d+$/, '')
    .replace(/\.$/, '');
}

/**
 * Check whether a host is one of the known wire-distribution hosts.
 * @param {string} host
 * @returns {{provider: string, note: string} | null}
 */
export function isWireHost(host) {
  const h = normalizeHost(host);
  for (const w of WIRE_HOSTS) {
    if (h === w.host || h.endsWith(`.${w.host}`)) return { provider: w.provider, note: w.note };
  }
  return null;
}

/**
 * Extract canonical and wire hosts from a press-release page body.
 * Separates wire-distribution hosts (canonical source) from the org's own
 * linked hosts so the caller can pivot on both.
 *
 * @param {string} body press-release HTML or text
 * @param {string} [pageUrl] URL the body was fetched from
 * @returns {{
 *   pageHost: string,
 *   wireHosts: {host: string, provider: string, note: string, refs: string[]}[],
 *   orgHosts: {host: string, refs: string[]}[]
 * }}
 */
export function extractPressWireHosts(body = '', pageUrl = '') {
  const text = String(body || '');
  let pageHost = '';
  try {
    if (pageUrl && /^[a-z][a-z0-9+.-]*:/i.test(pageUrl)) pageHost = normalizeHost(new URL(pageUrl).hostname);
  } catch { /* leave blank */ }

  const wireByHost = new Map();
  const orgByHost = new Map();

  const consider = (raw) => {
    if (!raw || !/^https?:\/\//i.test(raw)) return;
    let host = '';
    try { host = normalizeHost(new URL(raw).hostname); } catch { return; }
    if (!host || host === pageHost) return;
    const wire = isWireHost(host);
    const entry = wire
      ? { provider: wire.provider, note: wire.note }
      : null;
    if (entry) {
      if (!wireByHost.has(host)) wireByHost.set(host, { host, provider: entry.provider, note: entry.note, refs: [] });
      const e = wireByHost.get(host);
      if (e.refs.length < 5 && !e.refs.includes(raw.slice(0, 160))) e.refs.push(raw.slice(0, 160));
    } else {
      if (!orgByHost.has(host)) orgByHost.set(host, { host, refs: [] });
      const e = orgByHost.get(host);
      if (e.refs.length < 5 && !e.refs.includes(raw.slice(0, 160))) e.refs.push(raw.slice(0, 160));
    }
  };

  for (const m of text.matchAll(ATTR_URL_RE)) consider(m[1]);
  for (const m of text.matchAll(BARE_URL_RE)) consider(m[0]);

  return {
    pageHost,
    wireHosts: [...wireByHost.values()].sort((a, b) => a.provider.localeCompare(b.provider)),
    orgHosts: [...orgByHost.values()].sort((a, b) => b.refs.length - a.refs.length || a.host.localeCompare(b.host)),
  };
}

/**
 * Score press-wire findings: wire hosts confirm the canonical distribution
 * source; org hosts are pivot candidates for brand domains.
 * @param {ReturnType<typeof extractPressWireHosts>} parsed
 * @param {string} brandDomain org's primary domain
 * @returns {{host: string, kind: string, score: number, reason: string}[]}
 */
export function scorePressWireFindings(parsed, brandDomain = '') {
  const brand = String(brandDomain || '').trim().toLowerCase();
  const scored = [];
  for (const w of parsed?.wireHosts || []) {
    scored.push({
      host: w.host,
      kind: 'wire',
      score: 40,
      reason: `${w.provider} wire distribution host — canonical release source, useful for release-timeline correlation`,
    });
  }
  for (const o of parsed?.orgHosts || []) {
    const isBrand = brand && (o.host === brand || o.host.endsWith(`.${brand}`));
    scored.push({
      host: o.host,
      kind: isBrand ? 'brand' : 'third-party',
      score: isBrand ? 65 : 35,
      reason: isBrand
        ? 'brand domain linked from a press release — confirmed official surface'
        : 'third-party host linked from a press release — vendor/tooling reference, low priority unless branded',
    });
  }
  return scored.sort((a, b) => b.score - a.score || a.host.localeCompare(b.host));
}
