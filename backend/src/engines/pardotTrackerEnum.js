/**
 * pardotTrackerEnum.js — Pardot (Salesforce Account Engagement) tracker-domain
 * enumeration engine.
 *
 * Covers idea-bank item 00279:
 *  - 00279 Pardot tracker-domain enumeration — enumerate Pardot tracker
 *    domains (go.*) from DNS and page source.
 *
 * Pure functions only: callers fetch page source and DNS records themselves
 * (respecting provider rate limits) and pass the raw data in. No live HTTP
 * here.
 */

const PARDOT_HOST_RES = [
  { re: /\.pardot\.com$/i, kind: 'pardot', note: 'Pardot (Salesforce) tracker host' },
  { re: /\.pi\.pardot\.com$/i, kind: 'pardot-pi', note: 'Pardot prospect-insight host' },
];
const PARDOT_HOSTNAME_RE = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+pardot\.com\b/gi;
const GO_TRACKER_RE = /^go\./i;
// Pardot tracking snippet: piAId / piCId pair, or go.pardot.com/l/... links.
const PI_TRACKING_RE = /piAId\s*=\s*['"](\d+)['"]\s*;\s*(?:var\s+)?piCId\s*=\s*['"](\d+)['"]/i;
const PARDOT_LINK_RE = /https?:\/\/([a-z0-9.-]*go\.[a-z0-9.-]+)\//gi;

/**
 * Normalize a hostname: lowercase, strip trailing dot, port, and scheme.
 * @param {string} host
 * @returns {string}
 */
export function normalizeHostname(host) {
  if (!host) return '';
  return String(host)
    .trim()
    .toLowerCase()
    .replace(/^\w+:\/\//, '')
    .replace(/^[^@\s]+@/, '')
    .replace(/:\d+$/, '')
    .replace(/\.$/, '');
}

/**
 * Classify a hostname by Pardot tracker pattern.
 * @param {string} hostname
 * @returns {{isPardot: boolean, kind: string, note: string, isGoTracker: boolean, host: string}}
 */
export function classifyPardotHost(hostname) {
  const host = normalizeHostname(hostname);
  const isGoTracker = GO_TRACKER_RE.test(host);
  for (const { re, kind, note } of PARDOT_HOST_RES) {
    if (re.test(host)) return { isPardot: true, kind, note, isGoTracker, host };
  }
  return { isPardot: false, kind: 'other', note: '', isGoTracker, host };
}

/**
 * Extract the Pardot tracking ids (piAId, piCId) from page source. The pair
 * attributes a page to one Pardot account/campaign set.
 *
 * @param {string} pageSource HTML already fetched by the caller
 * @returns {{piAId: string, piCId: string}}
 */
export function extractPardotTrackingIds(pageSource = '') {
  const m = String(pageSource || '').match(PI_TRACKING_RE);
  return m ? { piAId: m[1], piCId: m[2] } : { piAId: '', piCId: '' };
}

/**
 * Enumerate Pardot tracker domains from page source links, explicit
 * `go.*` tracker hosts, and DNS CNAME targets supplied by the caller.
 *
 * @param {string} pageSource HTML already fetched by the caller
 * @param {string[]} trackerHosts candidate tracker hosts (e.g. ["go.example.com"])
 * @param {string[]} cnameTargets CNAME targets already resolved by the caller
 * @returns {{
 *   host: string, kind: string, isGoTracker: boolean,
 *   sources: string[], piAId: string, piCId: string
 * }[]}
 */
export function extractPardotTrackers(pageSource = '', trackerHosts = [], cnameTargets = []) {
  const byHost = new Map();
  const note = (raw, source, kindHint = '') => {
    const cls = classifyPardotHost(raw);
    const host = cls.host;
    if (!host) return;
    // Keep hosts that are either Pardot infrastructure or plausible go.* trackers.
    if (!cls.isPardot && !cls.isGoTracker) return;
    if (!byHost.has(host)) {
      byHost.set(host, {
        host,
        kind: cls.isPardot ? cls.kind : 'go-tracker',
        isGoTracker: cls.isGoTracker,
        sources: new Set(),
      });
    }
    const entry = byHost.get(host);
    entry.sources.add(source);
    if (kindHint && entry.kind === 'go-tracker' && kindHint !== 'go-tracker') entry.kind = kindHint;
  };

  const text = String(pageSource || '');
  for (const m of text.matchAll(PARDOT_LINK_RE)) {
    note(m[1], 'page-source');
  }
  for (const m of text.matchAll(PARDOT_HOSTNAME_RE)) {
    note(m[0], 'page-source');
  }
  for (const host of trackerHosts || []) note(host, 'tracker-list');
  for (const target of cnameTargets || []) note(target, 'dns-cname');

  const { piAId, piCId } = extractPardotTrackingIds(text);

  return [...byHost.values()]
    .map(e => ({
      host: e.host,
      kind: e.kind,
      isGoTracker: e.isGoTracker,
      sources: [...e.sources].sort(),
      piAId,
      piCId,
    }))
    .sort((a, b) => a.host.localeCompare(b.host));
}

/**
 * Detect Pardot presence on a site from page source markers.
 *
 * @param {string} pageSource HTML already fetched by the caller
 * @returns {{onPardot: boolean, piAId: string, piCId: string, evidence: string[]}}
 */
export function detectPardot(pageSource = '') {
  const evidence = [];
  const text = String(pageSource || '');
  const { piAId, piCId } = extractPardotTrackingIds(text);
  if (piAId) evidence.push('Pardot piAId/piCId tracking pair present');
  if (/pardot/i.test(text)) evidence.push('Pardot references in page source');
  return { onPardot: evidence.length > 0, piAId, piCId, evidence };
}

/**
 * Score Pardot tracker domains for hunt relevance: brand-matching go.*
 * trackers confirmed via DNS score highest.
 *
 * @param {ReturnType<typeof extractPardotTrackers>} trackers
 * @param {string} rootDomain e.g. "example.com"
 * @returns {{host: string, score: number, reasons: string[]}[]}
 */
export function scorePardotTrackers(trackers = [], rootDomain = '') {
  const brand = normalizeHostname(rootDomain).split('.')[0];
  return (trackers || [])
    .map(t => {
      let score = 25;
      const reasons = ['Pardot tracker domain'];
      if (brand && t.host.includes(brand)) {
        score += 40;
        reasons.push(`hostname references brand "${brand}"`);
      }
      if (t.isGoTracker) {
        score += 10;
        reasons.push('go.* branded tracker domain');
      }
      if (t.sources.includes('dns-cname')) {
        score += 10;
        reasons.push('confirmed via DNS CNAME');
      }
      if (t.piAId) {
        score += 10;
        reasons.push('tracking ids attributable');
      }
      return { host: t.host, score: Math.min(100, score), reasons };
    })
    .sort((a, b) => b.score - a.score);
}
