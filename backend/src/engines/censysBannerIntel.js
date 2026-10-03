/**
 * censysBannerIntel.js — Censys banner hostname extraction for autonomous bug bounty.
 *
 * Implements idea-bank item 00151: extract hostnames from service banners
 * (SMTP, FTP, SSH) indexed for the target's netblocks.
 *
 * Internet-wide scanning platforms expose banner grabs for open services.
 * Server banners frequently embed the machine's hostname
 * (e.g. SMTP "220 mail.example.com ESMTP", FTP "220 ftp.example.com",
 * SSH "SSH-2.0-OpenSSH host.example.com"). This module parses supplied
 * Censys-style host records, extracts candidate hostnames from banners and
 * links them to the IP and port where they were observed.
 *
 * All functions are pure and side-effect free: they operate on host-record
 * objects the caller obtained through a legitimate Censys API account
 * during an authorized engagement. No scanning is performed here.
 */

/**
 * Regexes that capture hostnames embedded in common service banners.
 * Ordered by service; each entry lists [service, pattern] where group 1 is the hostname.
 */
const BANNER_HOSTNAME_PATTERNS = [
  ['smtp', /220[\s-](?:[a-zA-Z0-9-]+\s+)*([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+)\s+ESMTP/i],
  ['smtp', /^220[\s-]([a-zA-Z0-9][\w.-]*\.[a-zA-Z]{2,})\b/],
  ['ftp', /^220[\s-](?:[^\s]*\s)?([a-zA-Z0-9][\w.-]*\.[a-zA-Z]{2,})/],
  ['ssh', /SSH-[\d.]+\s+([a-zA-Z0-9][\w.-]*\.[a-zA-Z]{2,})\b/],
  ['telnet', /login[\s:]*@([a-zA-Z0-9][\w.-]*\.[a-zA-Z]{2,})/i],
  ['imap', /^\* OK\s+(?:[^[]*\[)?([a-zA-Z0-9][\w.-]*\.[a-zA-Z]{2,})/i],
  ['pop3', /^\+OK\s+(?:[^[]*\[)?([a-zA-Z0-9][\w.-]*\.[a-zA-Z]{2,})/i],
  ['mysql', /Host\s+['"]?([a-zA-Z0-9][\w.-]*\.[a-zA-Z]{2,})['"]?/i],
  ['rdp', /hostname[=:\s]+([a-zA-Z0-9][\w.-]*\.[a-zA-Z]{2,})/i],
];

/**
 * Extract a hostname from a single service banner string.
 * @param {string} banner Raw banner text (one or more lines).
 * @param {string} [serviceHint] Optional service name to constrain pattern matching.
 * @returns {{hostname:string, service:string}|null}
 */
export function extractBannerHostname(banner, serviceHint) {
  if (!banner || typeof banner !== 'string') return null;
  const firstLine = banner.split(/\r?\n/)[0] || '';
  for (const [service, pattern] of BANNER_HOSTNAME_PATTERNS) {
    if (serviceHint && service !== serviceHint.toLowerCase()) continue;
    const m = firstLine.match(pattern);
    if (m && m[1] && !/^\d+\.\d+\.\d+\.\d+$/.test(m[1])) {
      return { hostname: m[1].toLowerCase(), service };
    }
  }
  return null;
}

/**
 * Harvest every distinct hostname embedded in the service banners of one
 * Censys host record.
 * @param {object} host Censys host record: { ip, services: [{ port, service_name, banner? }], ... }.
 *   Service data may also live under `host.services[].observed_at` variants;
 *   banner is accepted under `banner`, `banner_grab`, or `raw`.
 * @returns {Array<{hostname:string, ip:string, port:number, service:string}>}
 */
export function extractHostBannerHostnames(host) {
  const out = [];
  const seen = new Set();
  if (!host || !Array.isArray(host.services)) return out;
  const ip = host.ip || host.ip_address || 'unknown';
  for (const svc of host.services) {
    const banner = svc.banner ?? svc.banner_grab ?? svc.raw ?? svc.data;
    if (typeof banner !== 'string') continue;
    const hit = extractBannerHostname(banner, svc.service_name);
    if (!hit) continue;
    const key = `${hit.hostname}|${svc.port}|${hit.service}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ hostname: hit.hostname, ip, port: svc.port, service: hit.service });
  }
  return out;
}

/**
 * Process a batch of Censys host records and build a hostname → sightings map.
 * Useful for scoping: every hostname is linked to the IPs/ports where a
 * banner disclosed it.
 * @param {Array<object>} hosts Censys host records (same shape as extractHostBannerHostnames input).
 * @returns {{hostnames: Array<{hostname:string, sightings:Array<{ip:string, port:number, service:string}>, count:number}>, totalRecords:number}}
 */
export function aggregateBannerHostnames(hosts) {
  const map = new Map();
  const records = Array.isArray(hosts) ? hosts : [];
  for (const host of records) {
    for (const sighting of extractHostBannerHostnames(host)) {
      if (!map.has(sighting.hostname)) {
        map.set(sighting.hostname, { hostname: sighting.hostname, sightings: [], count: 0 });
      }
      const entry = map.get(sighting.hostname);
      entry.sightings.push({ ip: sighting.ip, port: sighting.port, service: sighting.service });
      entry.count += 1;
    }
  }
  return {
    hostnames: [...map.values()].sort((a, b) => b.count - a.count || a.hostname.localeCompare(b.hostname)),
    totalRecords: records.length,
  };
}

/**
 * Score candidate hostnames for relevance to the target org: a hostname earns
 * points when it contains a target keyword, shares the target's registrable
 * domain, or was seen on multiple target-netblock IPs.
 * @param {{hostnames:Array}} aggregated Output of aggregateBannerHostnames.
 * @param {object} opts { orgKeywords?: string[], registrableDomain?: string }.
 * @returns {Array<{hostname:string, score:number, reasons:string[], sightings:Array}>} sorted by score.
 */
export function rankBannerHostnames(aggregated, opts = {}) {
  const keywords = (opts.orgKeywords || []).map((k) => k.toLowerCase());
  const root = (opts.registrableDomain || '').toLowerCase();
  const rows = [];
  for (const entry of aggregated.hostnames || []) {
    let score = 0;
    const reasons = [];
    const h = entry.hostname;
    for (const kw of keywords) {
      if (kw && h.includes(kw)) {
        score += 25;
        reasons.push(`contains org keyword "${kw}"`);
      }
    }
    if (root && (h === root || h.endsWith(`.${root}`))) {
      score += 40;
      reasons.push(`shares target domain ${root}`);
    }
    const uniqueIps = new Set(entry.sightings.map((s) => s.ip)).size;
    if (uniqueIps > 1) {
      const bonus = Math.min(20, (uniqueIps - 1) * 5);
      score += bonus;
      reasons.push(`seen on ${uniqueIps} distinct IPs`);
    }
    score += Math.min(10, entry.sightings.length);
    rows.push({ hostname: h, score, reasons, sightings: entry.sightings });
  }
  return rows.sort((a, b) => b.score - a.score || a.hostname.localeCompare(b.hostname));
}
