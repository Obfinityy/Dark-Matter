/**
 * pingdomReportMiner.js — Pingdom public report host extraction engine.
 *
 * Covers idea-bank item 00252:
 *  - 00252 Pingdom public report host extraction — extract hostnames from
 *    public Pingdom uptime reports.
 *
 * Pure functions only: callers fetch the public Pingdom status/report page or
 * its embedded check JSON themselves (respecting provider rate limits) and
 * pass the raw data in. Functions extract check names, target hostnames, and
 * uptime-table hosts, dedupe them, and score relevance to the target brand.
 * No live HTTP here.
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
 * Classify a Pingdom check's naming intent.
 * @param {string} checkName
 * @returns {'api'|'web'|'transaction'|'internal'|'staging'|'mail'|'other'}
 */
export function classifyCheck(checkName) {
  const hay = String(checkName || '').toLowerCase();
  if (/(^|[^\w])(api|rest|graphql|endpoint|gateway)([^\w]|$)/.test(hay)) return 'api';
  if (/(^|[^\w])(transaction|checkout|signup|login|payment|journey)([^\w]|$)/.test(hay))
    return 'transaction';
  if (/(^|[^\w])(staging|stage|dev|test|qa|uat|preview)([^\w]|$)/.test(hay)) return 'staging';
  if (/(^|[^\w])(internal|intranet|corp|vpn|admin|private)([^\w]|$)/.test(hay)) return 'internal';
  if (/(^|[^\w])(mail|smtp|imap|pop3|webmail|mx|dns|udp|tcp|ping)([^\w]|$)/.test(hay))
    return 'mail';
  return 'web';
}

/**
 * Parse one Pingdom check record (from embedded JSON or a report row) into a
 * normalized host entry.
 *
 * @param {{name?: string, host?: string, hostname?: string, url?: string, type?: string, status?: string}} check
 * @returns {{host: string, checkName: string, kind: string, checkType: string, status: string}|null}
 */
export function parseCheck(check) {
  if (!check) return null;
  const checkName = String(check?.name ?? '');
  const rawHost = check?.host ?? check?.hostname ?? check?.url ?? '';
  let host = hostFromUrl(rawHost);
  if (!host) {
    const m = checkName.match(HOSTNAME_RE);
    host = m ? normalizeHostname(m[0]) : '';
  }
  if (!host) return null;
  return {
    host,
    checkName,
    kind: classifyCheck(checkName),
    checkType: String(check?.type ?? 'http').toLowerCase(),
    status: String(check?.status ?? 'unknown').toLowerCase(),
  };
}

/**
 * Extract checks from a public Pingdom report.
 *
 * Accepts either the embedded check JSON array (objects with `name`/`host`/
 * `url` fields) or the raw report HTML. For HTML, the function recovers the
 * embedded checks JSON first and falls back to scraping check-table rows of
 * the form `<td class="check-name">…</td>` / host cells.
 *
 * @param {string|object[]} input report HTML or check JSON array
 * @returns {{host: string, checkName: string, kind: string, checkType: string, status: string}[]}
 */
export function extractReportChecks(input) {
  let checks = [];
  if (Array.isArray(input)) {
    checks = input;
  } else if (typeof input === 'string') {
    const m = input.match(/"checks"\s*:\s*(\[[\s\S]*?\])\s*,?\s*"(?:summary|totals|uptime)/);
    if (m) {
      try {
        checks = JSON.parse(m[1]);
      } catch {
        checks = [];
      }
    }
    if (!checks.length) {
      // Fallback: rows with a check name cell followed by a host cell.
      const rowRe =
        /<tr[^>]*>[\s\S]*?<td[^>]*class=["'][^"']*check-name[^"']*["'][^>]*>([\s\S]*?)<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/gi;
      let rm;
      while ((rm = rowRe.exec(input)) !== null) {
        const strip = s =>
          s
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        checks.push({ name: strip(rm[1]), host: strip(rm[2]) });
      }
    }
  }

  const out = [];
  const seen = new Set();
  for (const c of checks || []) {
    const parsed = parseCheck(c);
    if (!parsed) continue;
    const key = `${parsed.host}|${parsed.checkName}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(parsed);
  }
  return out.sort((a, b) => a.host.localeCompare(b.host));
}

/**
 * Score a report check's relevance to the target brand (0-100).
 *
 * @param {{host: string, kind: string}} check
 * @param {string} rootDomain
 * @returns {number} 0-100
 */
export function scoreCheckRelevance(check, rootDomain) {
  const h = normalizeHostname(check?.host);
  const root = normalizeHostname(rootDomain);
  if (!h || !root) return 0;
  let score = 0;
  if (h === root) score = 100;
  else if (h.endsWith(`.${root}`)) score = 90;
  else {
    const label = root.split('.')[0];
    if (label.length > 2 && h.includes(label)) score = 55;
  }
  if (score > 0 && (check?.kind === 'staging' || check?.kind === 'internal'))
    score = Math.min(100, score + 8);
  return score;
}

/**
 * Extract and rank hostnames from a public Pingdom report for the target
 * brand. Returns only brand-touching checks, ordered by relevance.
 *
 * @param {string|object[]} input report HTML or check JSON array
 * @param {string} rootDomain
 * @returns {{host: string, checkName: string, kind: string, checkType: string, status: string, score: number}[]}
 */
export function extractBrandHosts(input, rootDomain) {
  return extractReportChecks(input)
    .map(c => ({ ...c, score: scoreCheckRelevance(c, rootDomain) }))
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score || a.host.localeCompare(b.host));
}
