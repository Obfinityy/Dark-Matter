/**
 * threatIntelPivoter.js — threat-intel brand-mention pivoting.
 *
 * Threat-intel reports (vendor blogs, ISAC bulletins, OSINT writeups) often
 * name the brands being impersonated while listing attacker domains, IPs, and
 * hashes. This module pivots on brand mentions: given report texts, it extracts
 * the indicators of compromise, keeps the brand-mention context, and clusters
 * shared infrastructure so the team gets blocklist and takedown candidates
 * with evidence attached.
 *
 * Defensive use only: parses report text supplied by the caller; no network I/O.
 */

const URL_RE = /\bhttps?:\/\/[^\s"'<>()\\]+/gi;
const DOMAIN_RE = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,}|xn--[a-z0-9-]+)\b/gi;
const IPV4_RE = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const MD5_RE = /\b[a-f0-9]{32}\b/gi;
const SHA1_RE = /\b[a-f0-9]{40}\b/gi;
const SHA256_RE = /\b[a-f0-9]{64}\b/gi;
const CVE_RE = /\bCVE-\d{4}-\d{4,7}\b/gi;

/**
 * Extract indicators of compromise from free text.
 * @param {string} text
 * @returns {{domains: string[], urls: string[], ips: string[], hashes: string[], cves: string[]}}
 */
export function extractIoCs(text) {
  const src = String(text || '');
  const domains = new Set();
  for (const m of src.match(URL_RE) || []) {
    try {
      const h = new URL(m.replace(/[.,;:!?]+$/, '')).hostname.toLowerCase();
      if (h) domains.add(h);
    } catch { /* skip malformed URLs */ }
  }
  for (const m of src.match(DOMAIN_RE) || []) domains.add(m.toLowerCase());
  const ips = new Set();
  for (const m of src.match(IPV4_RE) || []) {
    if (m.split('.').every((o) => Number(o) <= 255)) ips.add(m);
  }
  const hashes = new Set();
  for (const re of [MD5_RE, SHA1_RE, SHA256_RE]) {
    for (const m of src.match(re) || []) hashes.add(m.toLowerCase());
  }
  const cves = new Set((src.match(CVE_RE) || []).map((c) => c.toUpperCase()));
  return {
    domains: [...domains],
    urls: [...new Set(src.match(URL_RE) || [])],
    ips: [...ips],
    hashes: [...hashes],
    cves: [...cves],
  };
}

/**
 * Count brand mentions and capture context snippets around each mention.
 * @param {string} text
 * @param {string} brand
 * @param {number} [window=90] characters of context on each side
 * @returns {{count: number, snippets: string[]}}
 */
export function brandMentionContext(text, brand, window = 90) {
  const src = String(text || '');
  const b = String(brand || '');
  if (!b) return { count: 0, snippets: [] };
  const re = new RegExp(b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  const snippets = [];
  let m;
  let count = 0;
  while ((m = re.exec(src)) !== null && count < 20) {
    count++;
    const start = Math.max(0, m.index - window);
    const end = Math.min(src.length, m.index + m[0].length + window);
    snippets.push(`...${src.slice(start, end).replace(/\s+/g, ' ').trim()}...`);
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return { count, snippets };
}

/**
 * Pivot a set of threat-intel reports on a brand.
 * Report shape: {id, title, body, source?, publishedAt?}
 * @param {object[]} reports
 * @param {string} brand
 * @returns pivots with IoCs and mention evidence, most mentions first
 */
export function pivotThreatIntelOnBrand(reports, brand) {
  const pivots = [];
  for (const report of reports || []) {
    const body = String(report?.body || '');
    const title = String(report?.title || '');
    const combined = `${title}\n${body}`;
    const { count, snippets } = brandMentionContext(combined, brand);
    if (!count) continue;
    const iocs = extractIoCs(combined);
    pivots.push({
      reportId: report.id || null,
      title,
      source: report.source || 'unknown',
      publishedAt: report.publishedAt || null,
      brandMentions: count,
      snippets: snippets.slice(0, 5),
      attackerDomains: iocs.domains,
      ips: iocs.ips,
      hashes: iocs.hashes,
      cves: iocs.cves,
    });
  }
  pivots.sort((a, b) => b.brandMentions - a.brandMentions);
  return pivots;
}

/**
 * Cluster attacker infrastructure across pivots by shared IPs/hashes:
 * domains resolving to (or reported alongside) the same IP or hash belong to
 * the same campaign infrastructure.
 * @param {ReturnType<typeof pivotThreatIntelOnBrand>} pivots
 * @returns {{key: string, kind: 'shared-ip'|'shared-hash', domains: string[], reports: string[]}[]}
 */
export function clusterAttackerInfrastructure(pivots) {
  const byIp = new Map();
  const byHash = new Map();
  for (const p of pivots || []) {
    for (const ip of p.ips) {
      const e = byIp.get(ip) || { domains: new Set(), reports: new Set() };
      p.attackerDomains.forEach((d) => e.domains.add(d));
      e.reports.add(p.reportId || p.title);
      byIp.set(ip, e);
    }
    for (const h of p.hashes) {
      const e = byHash.get(h) || { domains: new Set(), reports: new Set() };
      p.attackerDomains.forEach((d) => e.domains.add(d));
      e.reports.add(p.reportId || p.title);
      byHash.set(h, e);
    }
  }
  const clusters = [];
  for (const [ip, e] of byIp) {
    if (e.domains.size >= 1) {
      clusters.push({ key: ip, kind: 'shared-ip', domains: [...e.domains], reports: [...e.reports] });
    }
  }
  for (const [h, e] of byHash) {
    if (e.domains.size >= 2) {
      clusters.push({ key: h, kind: 'shared-hash', domains: [...e.domains], reports: [...e.reports] });
    }
  }
  clusters.sort((a, b) => b.domains.length - a.domains.length);
  return clusters;
}

/**
 * Build blocklist/takedown candidates: attacker domains seen in brand-mention
 * reports, with evidence and source references attached.
 * @param {ReturnType<typeof pivotThreatIntelOnBrand>} pivots
 * @param {{brand?: string, orgDomains?: string[]}} [opts]
 */
export function buildTakedownCandidates(pivots, opts = {}) {
  const org = new Set((opts.orgDomains || []).map((d) => String(d).toLowerCase()));
  const brand = String(opts.brand || '').toLowerCase();
  const byDomain = new Map();
  for (const p of pivots || []) {
    for (const d of p.attackerDomains) {
      if (org.has(d) || (brand && d === brand)) continue; // never list own assets
      const e = byDomain.get(d) || { sources: [], mentions: 0 };
      e.sources.push(p.reportId || p.title);
      e.mentions += p.brandMentions;
      byDomain.set(d, e);
    }
  }
  return [...byDomain.entries()]
    .map(([domain, e]) => ({
      domain,
      reportCount: new Set(e.sources).size,
      sources: [...new Set(e.sources)],
      evidence: `mentioned alongside brand in ${new Set(e.sources).size} threat-intel report(s): ${[...new Set(e.sources)].join(', ')}`,
    }))
    .sort((a, b) => b.reportCount - a.reportCount);
}

export const THREAT_INTEL_PIVOTER = {
  extractIoCs,
  brandMentionContext,
  pivotThreatIntelOnBrand,
  clusterAttackerInfrastructure,
  buildTakedownCandidates,
};

export default THREAT_INTEL_PIVOTER;
