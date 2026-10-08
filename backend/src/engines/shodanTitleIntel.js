/**
 * shodanTitleIntel.js — Shodan HTTP-title clustering for autonomous bug bounty.
 *
 * Implements idea-bank item 00154: cluster HTTP titles across the target's
 * IPs to find same-application deployments on unexpected hosts.
 *
 * Shodan host records carry `http.title` (and `data[].http.title`) for
 * web services. Hosts running the same application on unexpected IPs —
 * forgotten staging copies, dev mirrors, mis-scoped assets — share titles.
 * This module clusters records by normalized title so the hunt can focus on
 * clusters that do not belong to the expected production footprint.
 *
 * All functions are pure and side-effect free: they operate on Shodan host
 * records the caller obtained through a legitimate Shodan API account
 * during an authorized engagement. No scanning is performed here.
 */

/** Default titles that carry no signal and are excluded from clusters. */
const GENERIC_TITLES = new Set([
  'index of /',
  'directory listing',
  '403 forbidden',
  '404 not found',
  '400 bad request',
  '500 internal server error',
  '502 bad gateway',
  '503 service unavailable',
  'default web page',
  'welcome to nginx',
  'apache2 ubuntu default page',
  'iis windows server',
  'it works!',
  'test page for the nginx http server',
  'site not found',
  'parked domain',
]);

/**
 * Normalize an HTTP title for clustering: lowercase, trim, collapse
 * whitespace, strip common separators' noise.
 * @param {*} title
 * @returns {string|null} Null for missing or generic titles.
 */
export function normalizeTitle(title) {
  if (!title || typeof title !== 'string') return null;
  const t = title.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!t || GENERIC_TITLES.has(t)) return null;
  return t;
}

/**
 * Extract (title, ip, port) tuples from Shodan records.
 * @param {Array<object>} records Shodan host records; titles read from
 *   record.http.title and each record.data[].http.title.
 * @returns {Array<{title:string, ip:string, port:number}>}
 */
export function extractHttpTitles(records) {
  const out = [];
  for (const record of Array.isArray(records) ? records : []) {
    const ip = (record && (record.ip_str || record.ip)) || 'unknown';
    const candidates = [];
    if (record && record.http && record.http.title)
      candidates.push({ title: record.http.title, port: record.port });
    for (const d of (record && record.data) || []) {
      if (d && d.http && d.http.title) candidates.push({ title: d.http.title, port: d.port });
    }
    const seen = new Set();
    for (const c of candidates) {
      const t = normalizeTitle(c.title);
      if (!t) continue;
      const key = `${t}|${c.port || 0}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ title: t, ip, port: c.port || null });
    }
  }
  return out;
}

/**
 * Cluster hosts by HTTP title.
 * @param {Array<object>} records Shodan host records.
 * @returns {{clusters: Array<{title:string, hosts:Array<{ip:string, port:number}>, hostCount:number}>, totalTitles:number}}
 */
export function clusterByTitle(records) {
  const map = new Map();
  for (const { title, ip, port } of extractHttpTitles(records)) {
    if (!map.has(title)) map.set(title, { title, hosts: [], seenIps: new Set() });
    const cluster = map.get(title);
    cluster.hosts.push({ ip, port });
    cluster.seenIps.add(ip);
  }
  return {
    clusters: [...map.values()]
      .map(c => ({ title: c.title, hosts: c.hosts, hostCount: c.seenIps.size }))
      .sort((a, b) => b.hostCount - a.hostCount || a.title.localeCompare(b.title)),
    totalTitles: map.size,
  };
}

/**
 * Rank title clusters by investigative interest: clusters whose title hints
 * at admin/dev/test surfaces score higher, as do titles shared by many
 * unexpected hosts.
 * @param {{clusters:Array}} clustered Output of clusterByTitle.
 * @param {object} opts { expectedIps?: string[] } IPs of the known production footprint.
 * @returns {Array<{title:string, score:number, reasons:string[], unexpectedHosts:Array<{ip:string, port:number}>}>}
 */
export function rankTitleClusters(clustered, opts = {}) {
  const expected = new Set(opts.expectedIps || []);
  const rows = [];
  for (const cluster of clustered.clusters || []) {
    let score = 0;
    const reasons = [];
    const unexpected = cluster.hosts.filter(h => !expected.has(h.ip));
    if (expected.size > 0 && unexpected.length > 0) {
      score += 40;
      reasons.push(
        `${unexpected.length} of ${cluster.hosts.length} sightings outside known footprint`
      );
    }
    if (
      /\b(admin|dashboard|panel|login|portal|console|phpmyadmin|wp-admin)\b/i.test(cluster.title)
    ) {
      score += 30;
      reasons.push('title indicates administrative surface');
    }
    if (/\b(dev|staging|test|qa|uat|beta|demo)\b/i.test(cluster.title)) {
      score += 25;
      reasons.push('title indicates non-production environment');
    }
    if (cluster.hostCount >= 3) {
      const bonus = Math.min(20, cluster.hostCount * 2);
      score += bonus;
      reasons.push(`deployed on ${cluster.hostCount} distinct hosts`);
    }
    if (score > 0) rows.push({ title: cluster.title, score, reasons, unexpectedHosts: unexpected });
  }
  return rows.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}
