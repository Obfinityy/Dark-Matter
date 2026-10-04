/**
 * uptimerobotMiner.js — UptimeRobot public dashboard hostname mining engine.
 *
 * Covers idea-bank item 00251:
 *  - 00251 UptimeRobot public dashboard mining — read public UptimeRobot
 *    dashboards for monitored hostnames.
 *
 * Pure functions only: callers fetch the public UptimeRobot dashboard page or
 * its embedded monitor JSON themselves (respecting provider rate limits) and
 * pass the raw data in. Functions parse monitor lists (friendly names, URLs,
 * statuses) and extract/normalize target hostnames, then score each monitor's
 * relevance to the target brand. No live HTTP here.
 */

const HOSTNAME_RE = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}\b/gi;
const SCHEMED_HOST_RE = /^(?:[a-z][a-z0-9+.-]*:\/\/)?([^/:?\s"'<>]+)/i;

/**
 * Normalize a hostname: lowercase, strip scheme/userinfo/port/trailing dot.
 * @param {string} host
 * @returns {string}
 */
export function normalizeHostname(host) {
  if (!host) return '';
  return String(host)
    .trim()
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
    .replace(/^[^@\s]+@/, '')
    .replace(/:\d+$/, '')
    .replace(/\.$/, '');
}

/**
 * Extract the hostname from a URL or bare host string.
 * @param {string} url
 * @returns {string}
 */
export function hostFromUrl(url) {
  if (!url) return '';
  const m = String(url).trim().match(SCHEMED_HOST_RE);
  return normalizeHostname(m ? m[1] : '');
}

/**
 * True when a host belongs to the target brand: equals the root domain, is a
 * subdomain of it, or contains the root's registrable label.
 * @param {string} host
 * @param {string} rootDomain
 * @returns {boolean}
 */
export function isTargetHost(host, rootDomain) {
  const h = normalizeHostname(host);
  const root = normalizeHostname(rootDomain);
  if (!h || !root) return false;
  if (h === root || h.endsWith(`.${root}`)) return true;
  const label = root.split('.')[0];
  return label.length > 2 && h.includes(label);
}

/**
 * Classify a monitor's naming intent from its friendly name / URL.
 * @param {string} friendlyName
 * @param {string} url
 * @returns {'api'|'web'|'internal'|'staging'|'mail'|'other'}
 */
export function classifyMonitor(friendlyName, url = '') {
  const hay = `${friendlyName || ''} ${url || ''}`.toLowerCase();
  if (/(^|[^\w])(api|rest|graphql|gateway|backend)([^\w]|$)/.test(hay)) return 'api';
  if (/(^|[^\w])(staging|stage|dev|development|test|qa|uat|preview|sandbox|demo)([^\w]|$)/.test(hay)) return 'staging';
  if (/(^|[^\w])(internal|intranet|corp|vpn|admin|ops|private)([^\w]|$)/.test(hay)) return 'internal';
  if (/(^|[^\w])(mail|smtp|imap|pop3|webmail|mx)([^\w]|$)/.test(hay)) return 'mail';
  return 'web';
}

/**
 * Parse a public UptimeRobot dashboard payload into monitor records.
 *
 * Accepts either the embedded monitor JSON array (objects with
 * `friendly_name`/`url`/`status` fields) or the raw dashboard HTML, from
 * which embedded `monitors` JSON is recovered. Hostnames are extracted from
 * both the monitor URL and the friendly name.
 *
 * @param {string|object[]} input dashboard HTML or monitor JSON array
 * @returns {{host: string, friendlyName: string, url: string, status: string, kind: string}[]}
 */
export function parseDashboardMonitors(input) {
  let monitors = [];
  if (Array.isArray(input)) {
    monitors = input;
  } else if (typeof input === 'string') {
    // UptimeRobot public pages embed a JSON blob: "monitors":[{...}]
    const m = input.match(/"monitors"\s*:\s*(\[[\s\S]*?\])\s*,?\s*"(?:psp|total)/);
    if (m) {
      try { monitors = JSON.parse(m[1]); } catch { monitors = []; }
    }
    // Fallback: any absolute URLs in the page that look like monitored targets.
    if (!monitors.length) {
      const urls = [...new Set([...input.matchAll(/https?:\/\/[^\s"'`<>()\[\]{};,]+/gi)].map((x) => x[0]))];
      monitors = urls.map((u) => ({ friendly_name: hostFromUrl(u), url: u, status: 'unknown' }));
    }
  }

  const out = [];
  const seen = new Set();
  for (const mon of monitors || []) {
    const friendlyName = String(mon?.friendly_name ?? mon?.name ?? '');
    const url = String(mon?.url ?? mon?.friendlyname ?? '');
    const host = hostFromUrl(url) || (() => {
      const mh = friendlyName.match(HOSTNAME_RE);
      return mh ? normalizeHostname(mh[0]) : '';
    })();
    if (!host || seen.has(`${host}|${friendlyName}`)) continue;
    seen.add(`${host}|${friendlyName}`);
    out.push({
      host,
      friendlyName,
      url,
      status: String(mon?.status ?? 'unknown').toLowerCase(),
      kind: classifyMonitor(friendlyName, url),
    });
  }
  return out.sort((a, b) => a.host.localeCompare(b.host));
}

/**
 * Score how relevant a monitor is to the target brand (0-100).
 *
 * Exact root-domain and same-apex matches score highest; brand-label
 * containment scores moderately; staging/internal monitors that also match
 * the brand get a small bonus because they are often forgotten assets.
 *
 * @param {{host: string, kind: string}} monitor
 * @param {string} rootDomain
 * @returns {number} 0-100
 */
export function scoreMonitorRelevance(monitor, rootDomain) {
  const h = normalizeHostname(monitor?.host);
  const root = normalizeHostname(rootDomain);
  if (!h || !root) return 0;
  let score = 0;
  if (h === root) score = 100;
  else if (h.endsWith(`.${root}`)) score = 90;
  else {
    const label = root.split('.')[0];
    if (label.length > 2 && h.includes(label)) score = 55;
  }
  if (score > 0 && (monitor?.kind === 'staging' || monitor?.kind === 'internal')) score = Math.min(100, score + 8);
  return score;
}

/**
 * Rank monitors from a public UptimeRobot dashboard for the target brand.
 * Returns only monitors touching the brand, ordered by relevance.
 *
 * @param {string|object[]} input dashboard HTML or monitor JSON array
 * @param {string} rootDomain
 * @returns {{host: string, friendlyName: string, url: string, status: string, kind: string, score: number}[]}
 */
export function rankMonitorsForBrand(input, rootDomain) {
  const monitors = parseDashboardMonitors(input);
  return monitors
    .map((m) => ({ ...m, score: scoreMonitorRelevance(m, rootDomain) }))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score || a.host.localeCompare(b.host));
}
