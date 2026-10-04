/**
 * pressWireHostMiner.js — Press-release wire host mining.
 *
 * Press releases are distributed through wire services (Business Wire,
 * GlobeNewswire, PR Newswire, Accesswire, newswire.com). The canonical
 * URLs of those distributions reveal vendor hosts and, via author/org
 * pages and press-kit links, infrastructure tied to the target.
 *
 * Passive analysis: parse press-release HTML/text for wire-service
 * canonical hosts and extract the wire provider, release identifiers,
 * and any org-linked hosts.
 */

/** Known press-release wire services and their canonical hosts. */
const WIRE_SERVICES = [
  { name: 'Business Wire', hostMatch: /(^|\.)businesswire\.com$/, idHint: /\/news\/home\/([a-z0-9-]+)/i },
  { name: 'GlobeNewswire', hostMatch: /(^|\.)globenewswire\.com$/, idHint: /\/news-release\/\d+\/\d+\/\d+\/(\d+)/i },
  { name: 'PR Newswire', hostMatch: /(^|\.)prnewswire\.com$/, idHint: /\/news-releases\/[^/]*-(\d+)\.html/i },
  { name: 'Accesswire', hostMatch: /(^|\.)accesswire\.com$/, idHint: null },
  { name: 'Newswire.com', hostMatch: /(^|\.)newswire\.com$/, idHint: null },
  { name: 'PRWeb', hostMatch: /(^|\.)prweb\.com$/, idHint: /\/releases\/[^/]*\/prweb(\d+)\.htm/i },
  { name: 'EIN Presswire', hostMatch: /(^|\.)einpresswire\.com$/, idHint: null },
];

const CANONICAL_RX = /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i;
const OG_URL_RX = /<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i;
const LINK_ATTRS = /(?:href|src)=["']([^"']+)["']/gi;

/**
 * Identify the wire service behind a URL/hostname.
 * @param {string} urlOrHost
 * @returns {{service: string, host: string}|null}
 */
export function identifyWireService(urlOrHost) {
  const raw = String(urlOrHost || '');
  let host = raw;
  try {
    host = new URL(raw.startsWith('http') ? raw : `https://${raw}`).hostname.toLowerCase();
  } catch {
    host = raw.toLowerCase();
  }
  for (const w of WIRE_SERVICES) {
    if (w.hostMatch.test(host)) return { service: w.name, host };
  }
  return null;
}

/**
 * Extract the canonical wire URL from a press-release page.
 * @param {string} html release HTML
 * @returns {{canonical: string|null, service: string|null}}
 */
export function extractCanonicalWireUrl(html) {
  const body = String(html || '');
  const m = body.match(CANONICAL_RX) || body.match(OG_URL_RX);
  const canonical = m ? m[1] : null;
  if (!canonical) return { canonical: null, service: null };
  const wire = identifyWireService(canonical);
  return { canonical, service: wire ? wire.service : null };
}

/**
 * Mine a press-release page for wire hosts + any org-linked outbound hosts.
 * @param {string} html release HTML
 * @param {string} orgDomain the organisation's domain to flag own-host links
 * @param {string} [pageUrl] page the HTML came from (for evidence)
 * @returns {{wire: object|null, outboundHosts: string[], evidence: string}}
 */
export function minePressRelease(html, orgDomain = '', pageUrl = '') {
  const body = String(html || '');
  const evidence = pageUrl || '(inline)';
  const { canonical, service } = extractCanonicalWireUrl(body);

  const outbound = new Set();
  LINK_ATTRS.lastIndex = 0;
  let m;
  while ((m = LINK_ATTRS.exec(body)) !== null) {
    const link = m[1];
    if (!/^https?:\/\//i.test(link)) continue;
    try {
      const host = new URL(link).hostname.toLowerCase();
      if (host && !identifyWireService(host)) outbound.add(host);
    } catch {
      /* ignore */
    }
  }

  const own = orgDomain.toLowerCase();
  const orgLinked = [...outbound].filter((h) => own && (h === own || h.endsWith(`.${own}`))).sort();

  return {
    wire: canonical ? { service, canonical } : null,
    outboundHosts: [...outbound].sort(),
    orgLinkedHosts: orgLinked,
    evidence,
  };
}

export const PRESS_WIRE_MINER = {
  WIRE_SERVICES: WIRE_SERVICES.map((w) => w.name),
  identifyWireService,
  extractCanonicalWireUrl,
  minePressRelease,
};

export default PRESS_WIRE_MINER;
