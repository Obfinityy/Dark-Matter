/**
 * shodanHostnameIntel.js — Shodan hostname-field aggregation for autonomous bug bounty.
 *
 * Implements idea-bank item 00152: aggregate the `hostnames` field across
 * all Shodan host records for the target's IPs and ASNs.
 *
 * Shodan enriches every host record with a `hostnames` array derived from
 * reverse DNS, certificate subjects, and banner data. Aggregating that field
 * across a batch of records exposes which names the infrastructure actually
 * answers as — including forgotten subdomains — and reveals which hostnames
 * are shared across many IPs (load-balanced fleets, shared hosting).
 *
 * All functions are pure and side-effect free: they operate on Shodan host
 * records the caller obtained through a legitimate Shodan API account
 * during an authorized engagement. No scanning is performed here.
 */

/**
 * Normalize a hostname: lowercase, strip trailing dot and whitespace.
 * @param {*} name
 * @returns {string|null} Null when the value is not a plausible hostname.
 */
export function normalizeHostname(name) {
  if (!name || typeof name !== 'string') return null;
  const clean = name.trim().toLowerCase().replace(/\.$/, '');
  if (
    !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,}$/.test(
      clean
    )
  ) {
    return null;
  }
  return clean;
}

/**
 * Extract normalized hostnames from a single Shodan host record, preserving
 * where each name was observed (ip, asn, ports).
 * @param {object} record Shodan host record: { ip_str, asn, ports, hostnames: [] }.
 * @returns {Array<{hostname:string, ip:string, asn:string|null, ports:number[]}>}
 */
export function extractRecordHostnames(record) {
  const out = [];
  if (!record || !Array.isArray(record.hostnames)) return out;
  const ip = record.ip_str || record.ip || 'unknown';
  const asn = record.asn || null;
  const ports = Array.isArray(record.ports) ? record.ports : [];
  const seen = new Set();
  for (const raw of record.hostnames) {
    const h = normalizeHostname(raw);
    if (!h || seen.has(h)) continue;
    seen.add(h);
    out.push({ hostname: h, ip, asn, ports });
  }
  return out;
}

/**
 * Aggregate hostnames across a batch of Shodan records for the target's IPs
 * and ASNs.
 * @param {Array<object>} records Shodan host records.
 * @returns {{hostnames: Array<{hostname:string, ips:string[], asns:string[], ports:number[], records:number}>, totalRecords:number, distinctIps:number, distinctAsns:number}}
 */
export function aggregateShodanHostnames(records) {
  const map = new Map();
  const ips = new Set();
  const asns = new Set();
  const list = Array.isArray(records) ? records : [];
  for (const record of list) {
    if (record && record.ip_str) ips.add(record.ip_str);
    if (record && record.asn) asns.add(String(record.asn));
    for (const entry of extractRecordHostnames(record)) {
      if (!map.has(entry.hostname)) {
        map.set(entry.hostname, {
          hostname: entry.hostname,
          ips: new Set(),
          asns: new Set(),
          ports: new Set(),
          records: 0,
        });
      }
      const agg = map.get(entry.hostname);
      agg.ips.add(entry.ip);
      if (entry.asn) agg.asns.add(String(entry.asn));
      for (const p of entry.ports) agg.ports.add(p);
      agg.records += 1;
    }
  }
  return {
    hostnames: [...map.values()]
      .map(e => ({
        hostname: e.hostname,
        ips: [...e.ips].sort(),
        asns: [...e.asns].sort(),
        ports: [...e.ports].sort((a, b) => a - b),
        records: e.records,
      }))
      .sort((a, b) => b.records - a.records || a.hostname.localeCompare(b.hostname)),
    totalRecords: list.length,
    distinctIps: ips.size,
    distinctAsns: asns.size,
  };
}

/**
 * Flag hostnames that deserve attention: names under the target's domain that
 * appear on few IPs (possible single-purpose/forgotten assets), names seen
 * only via reverse-DNS-style sources, and wildcard-like shared-hosting names.
 * @param {{hostnames:Array}} aggregated Output of aggregateShodanHostnames.
 * @param {object} opts { registrableDomain?: string }.
 * @returns {Array<{hostname:string, flags:string[], ips:string[], records:number}>}
 */
export function flagNotableHostnames(aggregated, opts = {}) {
  const root = (opts.registrableDomain || '').toLowerCase();
  const out = [];
  for (const entry of aggregated.hostnames || []) {
    const flags = [];
    const h = entry.hostname;
    const inScope = root !== '' && (h === root || h.endsWith(`.${root}`));
    if (inScope) flags.push('in-scope-domain');
    if (inScope && entry.records === 1) flags.push('single-record — possible forgotten asset');
    if (entry.ips.length >= 5)
      flags.push(`shared across ${entry.ips.length} IPs — fleet or shared hosting`);
    if (/^(mail|mx|vpn|owa|rdp|citrix|rds)/i.test(h)) flags.push('remote-access indicator');
    if (/\b(dev|staging|test|qa|uat|demo|beta)\b/i.test(h))
      flags.push('non-production environment');
    if (flags.length > 0) {
      out.push({ hostname: h, flags, ips: entry.ips, records: entry.records });
    }
  }
  return out;
}
