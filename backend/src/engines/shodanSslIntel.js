/**
 * shodanSslIntel.js — Shodan SSL certificate subject harvesting for autonomous bug bounty.
 *
 * Implements idea-bank item 00153: harvest certificate subjects from
 * Shodan's SSL index for the target's netblocks.
 *
 * Shodan records for TLS-enabled services embed the presented certificate
 * (`ssl.cert.subject.CN`, `extensions.subjectAltName`). Subjects and SANs
 * disclose the exact hostnames an asset claims — including internal names,
 * pre-production domains, and sibling services — without ever connecting to
 * those names directly. This module harvests subjects and SANs from supplied
 * Shodan records and builds a subject → host map for scoping.
 *
 * All functions are pure and side-effect free: they operate on Shodan
 * records the caller obtained through a legitimate Shodan API account
 * during an authorized engagement. No scanning is performed here.
 */

/**
 * Extract the certificate subject CN and SAN list from a Shodan SSL block.
 * Handles the Shodan shapes: ssl.cert.subject.CN, ssl.cert.extensions[]
 * entries named subjectAltName / subject_alt_name, and parsed.subject_alt_names.
 * @param {object} sslBlock The `ssl` object of a Shodan record.
 * @returns {{cn:string|null, sans:string[], issuer:string|null, expires:string|null}}
 */
export function parseShodanCert(sslBlock) {
  if (!sslBlock || typeof sslBlock !== 'object') return { cn: null, sans: [], issuer: null, expires: null };
  const cert = sslBlock.cert || {};
  const subject = cert.subject || {};
  const issuer = cert.issuer || {};
  let cn = subject.CN || subject.commonName || null;
  if (cn && typeof cn !== 'string') cn = null;
  const sans = [];
  const pushSan = (v) => {
    if (typeof v === 'string' && v.includes('.') && !v.includes(' ')) sans.push(v.toLowerCase());
  };
  for (const ext of cert.extensions || []) {
    const name = String(ext.name || ext.shortName || '').toLowerCase();
    if (name.includes('subjectaltname') || name.includes('subject_alt_name')) {
      const data = String(ext.data || '');
      for (const m of data.matchAll(/DNS:([^,\s]+)/g)) pushSan(m[1]);
    }
  }
  for (const v of sslBlock.subject_alt_names || cert.subject_alt_names || []) pushSan(v);
  // Also accept the parsed section Shodan exposes under ssl.cert.parsed
  for (const v of (cert.parsed && cert.parsed.subject_alt_names) || []) pushSan(v);
  const uniqueSans = [...new Set(sans)].filter((s) => !s.startsWith('*.') || s.length > 2);
  const expires = cert.expires || sslBlock.expires || null;
  const issuerName = issuer.CN || issuer.O || issuer.commonName || issuer.organizationName || null;
  return { cn, sans: uniqueSans, issuer: issuerName, expires };
}

/**
 * Harvest certificate subjects from a batch of Shodan records and map each
 * subject/SAN to the IPs and ports where that certificate was observed.
 * @param {Array<object>} records Shodan host records; TLS data may live at
 *   record.ssl, or under record.data[] entries (banner-style results).
 * @returns {{subjects: Array<{name:string, type:'cn'|'san', ips:string[], ports:number[], issuers:string[], expired:boolean}>, totalRecords:number, withCerts:number}}
 */
export function harvestShodanCertSubjects(records) {
  const map = new Map();
  let withCerts = 0;
  const list = Array.isArray(records) ? records : [];
  const ensure = (name, type) => {
    if (!map.has(name)) {
      map.set(name, { name, type, ips: new Set(), ports: new Set(), issuers: new Set(), expired: false });
    }
    return map.get(name);
  };
  for (const record of list) {
    const ip = (record && (record.ip_str || record.ip)) || 'unknown';
    const sslBlocks = [];
    if (record && record.ssl) sslBlocks.push({ block: record.ssl, port: record.port });
    for (const d of (record && record.data) || []) {
      if (d && d.ssl) sslBlocks.push({ block: d.ssl, port: d.port });
    }
    for (const { block, port } of sslBlocks) {
      const cert = parseShodanCert(block);
      if (!cert.cn && cert.sans.length === 0) continue;
      withCerts += 1;
      const isExpired = cert.expires ? new Date(cert.expires).getTime() < Date.now() : false;
      if (cert.cn) {
        const e = ensure(cert.cn.toLowerCase(), 'cn');
        e.ips.add(ip); if (port) e.ports.add(port); if (cert.issuer) e.issuers.add(cert.issuer);
        if (isExpired) e.expired = true;
      }
      for (const san of cert.sans) {
        const e = ensure(san, 'san');
        e.ips.add(ip); if (port) e.ports.add(port); if (cert.issuer) e.issuers.add(cert.issuer);
        if (isExpired) e.expired = true;
      }
    }
  }
  return {
    subjects: [...map.values()]
      .map((e) => ({
        name: e.name,
        type: e.type,
        ips: [...e.ips].sort(),
        ports: [...e.ports].sort((a, b) => a - b),
        issuers: [...e.issuers].sort(),
        expired: e.expired,
      }))
      .sort((a, b) => b.ips.length - a.ips.length || a.name.localeCompare(b.name)),
    totalRecords: list.length,
    withCerts,
  };
}

/**
 * Keep only the subjects relevant to the target: in-scope domains plus
 * internal/non-public names that hint at hidden infrastructure.
 * @param {{subjects:Array}} harvested Output of harvestShodanCertSubjects.
 * @param {object} opts { registrableDomain?: string }.
 * @returns {{inScope:Array, internal:Array, other:Array}}
 */
export function scopeCertSubjects(harvested, opts = {}) {
  const root = (opts.registrableDomain || '').toLowerCase();
  const inScope = [];
  const internal = [];
  const other = [];
  for (const s of harvested.subjects || []) {
    const n = s.name;
    const isInternal = /(\.local|\.internal|\.lan|\.corp|\.intranet)$/i.test(n) ||
      !/\.[a-z]{2,}$/i.test(n) ||
      /^[\d.]+$/.test(n);
    if (root && (n === root || n.endsWith(`.${root}`) || n === `*.${root}`)) {
      inScope.push(s);
    } else if (isInternal) {
      internal.push(s);
    } else {
      other.push(s);
    }
  }
  return { inScope, internal, other };
}
