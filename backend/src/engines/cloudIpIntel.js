/**
 * cloudIpIntel.js — Cloud IP-range intelligence engine for autonomous bug bounty.
 *
 * Defensive asset-discovery capabilities that map discovered IP addresses
 * against published cloud-provider IP ranges and correlate them with DNS
 * records. Covers idea-bank items 00047–00048:
 *
 *  00047 Cloud IP-range to tenant mapping
 *  00048 Cloud metadata-endpoint adjacent discovery
 *
 * All functions are pure and side-effect free: they operate on IP lists,
 * provider range tables and DNS record objects the caller obtained legally
 * during an authorized engagement. Downloading provider range feeds
 * (e.g. AWS ip-ranges.json, Azure ServiceTags, GCP cloud.json) is left to
 * the caller; expected range-entry shape is documented on mapIpToRange.
 * No scanning or metadata-service probing is performed here — the engine
 * only prioritizes which assets merit such checks later, inside the
 * authorized scope.
 */

/** Well-known cloud metadata-service endpoints (public documentation). */
export const METADATA_ENDPOINTS = Object.freeze({
  aws: ['http://169.254.169.254/latest/meta-data/', 'http://fd00:ec2::254/latest/meta-data/'],
  gcp: [
    'http://metadata.google.internal/computeMetadata/v1/',
    'http://169.254.169.254/computeMetadata/v1/',
  ],
  azure: ['http://169.254.169.254/metadata/instance?api-version=2021-02-01'],
  digitalocean: ['http://169.254.169.254/metadata/v1/'],
  oracle: ['http://169.254.169.254/opc/v2/instance/'],
  alibaba: ['http://100.100.100.200/latest/meta-data/'],
});

/**
 * Convert an IPv4 address to a 32-bit unsigned integer.
 * @param {string} ip
 * @returns {number|null}
 */
export function ipv4ToInt(ip) {
  if (!ip || typeof ip !== 'string') return null;
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const o = Number(p);
    if (o > 255) return null;
    n = n * 256 + o;
  }
  return n >>> 0;
}

/**
 * Parse a CIDR prefix into [networkInt, broadcastInt].
 * @param {string} cidr e.g. "3.5.140.0/22"
 * @returns {[number, number]|null}
 */
export function parseCidr(cidr) {
  if (!cidr || typeof cidr !== 'string') return null;
  const m = cidr.match(/^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/);
  if (!m) return null;
  const base = ipv4ToInt(m[1]);
  const bits = Number(m[2]);
  if (base === null || bits > 32) return null;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  const network = (base & mask) >>> 0;
  const broadcast = (network | (~mask >>> 0)) >>> 0;
  return [network, broadcast];
}

/**
 * Check whether an IP falls inside a CIDR prefix.
 * @param {string} ip
 * @param {string} cidr
 * @returns {boolean}
 */
export function ipInCidr(ip, cidr) {
  const n = ipv4ToInt(ip);
  const range = parseCidr(cidr);
  if (n === null || !range) return false;
  return n >= range[0] && n <= range[1];
}

/**
 * Map one IP against a provider range table (idea 00047).
 *
 * @param {string} ip
 * @param {Array<{prefix: string, provider: string, region?: string, service?: string}>} ranges
 * @returns {{ip: string, provider: string|null, region: string|null, service: string|null, prefix: string|null}}
 */
export function mapIpToRange(ip, ranges) {
  const out = { ip, provider: null, region: null, service: null, prefix: null };
  if (!Array.isArray(ranges) || ranges.length === 0) return out;
  let best = null;
  let bestBits = -1;
  for (const r of ranges) {
    if (!r || !r.prefix) continue;
    const bits = Number(r.prefix.split('/')[1] || '0');
    if (bits <= bestBits) continue;
    if (ipInCidr(ip, r.prefix)) {
      best = r;
      bestBits = bits;
    }
  }
  if (best) {
    out.provider = best.provider || null;
    out.region = best.region || null;
    out.service = best.service || null;
    out.prefix = best.prefix;
  }
  return out;
}

/**
 * Map a batch of discovered IPs to their cloud providers (idea 00047).
 *
 * @param {string[]} ips
 * @param {Array<{prefix: string, provider: string, region?: string, service?: string}>} ranges
 * @returns {{mapped: ReturnType<mapIpToRange>[], unmapped: string[], providerSummary: {provider: string, regions: string[], count: number}[]}}
 */
export function mapIpsToProviders(ips, ranges) {
  const mapped = [];
  const unmapped = [];
  const byProvider = new Map();
  for (const ip of new Set(ips || [])) {
    const m = mapIpToRange(ip, ranges);
    if (m.provider) {
      mapped.push(m);
      const cur = byProvider.get(m.provider) || {
        provider: m.provider,
        regions: new Set(),
        count: 0,
      };
      if (m.region) cur.regions.add(m.region);
      cur.count++;
      byProvider.set(m.provider, cur);
    } else {
      unmapped.push(ip);
    }
  }
  return {
    mapped: mapped.sort((a, b) => a.ip.localeCompare(b.ip, undefined, { numeric: true })),
    unmapped: unmapped.sort(),
    providerSummary: [...byProvider.values()]
      .map(p => ({ provider: p.provider, regions: [...p.regions].sort(), count: p.count }))
      .sort((a, b) => b.count - a.count),
  };
}

/**
 * Group cloud-hosted IPs by their containing prefix to surface likely
 * sibling tenants in the same account/region allocation (idea 00047).
 *
 * @param {string[]} ips
 * @param {Array<{prefix: string, provider: string, region?: string, service?: string}>} ranges
 * @param {number} [minGroupSize] Minimum group size to report (default 2).
 * @returns {{prefix: string, provider: string|null, region: string|null, ips: string[]}[]}
 */
export function identifySiblingTenants(ips, ranges, minGroupSize = 2) {
  const { mapped } = mapIpsToProviders(ips, ranges);
  const byPrefix = new Map();
  for (const m of mapped) {
    const cur = byPrefix.get(m.prefix) || {
      prefix: m.prefix,
      provider: m.provider,
      region: m.region,
      ips: [],
    };
    cur.ips.push(m.ip);
    byPrefix.set(m.prefix, cur);
  }
  return [...byPrefix.values()]
    .filter(g => g.ips.length >= minGroupSize)
    .map(g => ({ ...g, ips: g.ips.sort() }))
    .sort((a, b) => b.ips.length - a.ips.length);
}

/**
 * Correlate provider IP ranges with DNS records to identify cloud-hosted
 * target assets and prioritize metadata-service checks (idea 00048).
 *
 * @param {Array<{host: string, ips: string[]}>} dnsRecords Host → resolved IPs.
 * @param {Array<{prefix: string, provider: string, region?: string, service?: string}>} ranges
 * @returns {{host: string, ips: string[], cloudIps: ReturnType<mapIpToRange>[], metadataPriority: 'high'|'medium'|'low', suggestedMetadataEndpoints: string[]}[]}
 */
export function correlateCloudDns(dnsRecords, ranges) {
  if (!Array.isArray(dnsRecords)) return [];
  return dnsRecords
    .map(rec => {
      const ips = Array.isArray(rec.ips) ? rec.ips : [];
      const cloudIps = ips.map(ip => mapIpToRange(ip, ranges)).filter(m => m.provider);
      const providers = [...new Set(cloudIps.map(m => m.provider))];
      let metadataPriority = 'low';
      if (cloudIps.length > 0 && cloudIps.length === ips.length) metadataPriority = 'high';
      else if (cloudIps.length > 0) metadataPriority = 'medium';
      const suggestedMetadataEndpoints = providers.flatMap(p => METADATA_ENDPOINTS[p] || []);
      return {
        host: rec.host,
        ips,
        cloudIps,
        metadataPriority,
        suggestedMetadataEndpoints: [...new Set(suggestedMetadataEndpoints)],
      };
    })
    .sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.metadataPriority] - order[b.metadataPriority] || a.host.localeCompare(b.host);
    });
}

export default {
  ipv4ToInt,
  parseCidr,
  ipInCidr,
  mapIpToRange,
  mapIpsToProviders,
  identifySiblingTenants,
  correlateCloudDns,
  METADATA_ENDPOINTS,
};
