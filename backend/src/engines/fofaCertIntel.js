/**
 * fofaCertIntel.js — Fofa certificate-subject pivoting for autonomous bug bounty.
 *
 * Implements idea-bank item 00155: pivot on certificate subjects in Fofa
 * to expand from one known host to all hosts sharing certs.
 *
 * Fofa records include the TLS certificate (`cert`, `cert_subject`,
 * `cert_issuer`) presented by each host. Hosts sharing a certificate —
 * especially one issued for the target's domain — are almost certainly
 * operated by the same organization, even when their IPs sit in unrelated
 * netblocks. This module takes Fofa-style records, groups them by
 * certificate identity (subject CN / fingerprint), and lets a hunt expand
 * from a seed host to every host sharing its cert.
 *
 * All functions are pure and side-effect free: they operate on Fofa API
 * result objects the caller obtained through a legitimate Fofa account
 * during an authorized engagement. No scanning is performed here.
 */

/**
 * Normalize a Fofa certificate identity to a stable key. Prefers the cert
 * fingerprint when present; falls back to subject CN + issuer.
 * @param {object} cert Certificate object or raw subject string.
 * @returns {string|null}
 */
export function certIdentityKey(cert) {
  if (!cert) return null;
  if (typeof cert === 'string') {
    const s = cert.trim().toLowerCase();
    return s ? `subject:${s}` : null;
  }
  const fp = cert.fingerprint || cert.sha256 || cert.fingerprint_sha256;
  if (fp)
    return `fp:${String(fp)
      .toLowerCase()
      .replace(/[^a-f0-9]/g, '')}`;
  const cn = (cert.subject_cn || cert.cn || cert.subject || '').toString().toLowerCase();
  const issuer = (cert.issuer_cn || cert.issuer || '').toString().toLowerCase();
  if (!cn) return null;
  return `subject:${cn}|issuer:${issuer}`;
}

/**
 * Extract certificate identities from a single Fofa record.
 * @param {object} record Fofa result: { ip, port, cert?, cert_subject?, cert_issuer?, ... }.
 * @returns {Array<{key:string, cn:string|null, issuer:string|null, ip:string, port:number}>}
 */
export function extractRecordCerts(record) {
  const out = [];
  if (!record) return out;
  const ip = record.ip || record.host || 'unknown';
  const port = record.port || null;
  const certs = [];
  if (record.cert) certs.push(record.cert);
  if (record.cert_subject || record.cert_issuer) {
    certs.push({ subject_cn: record.cert_subject, issuer_cn: record.cert_issuer });
  }
  for (const cert of certs) {
    const key = certIdentityKey(cert);
    if (!key) continue;
    const cn = typeof cert === 'string' ? cert : cert.subject_cn || cert.cn || cert.subject || null;
    const issuer = typeof cert === 'string' ? null : cert.issuer_cn || cert.issuer || null;
    out.push({ key, cn, issuer, ip, port });
  }
  return out;
}

/**
 * Group Fofa records by certificate identity: every host that presents the
 * same certificate lands in one group.
 * @param {Array<object>} records Fofa result objects.
 * @returns {{groups: Array<{key:string, cn:string|null, issuers:string[], hosts:Array<{ip:string, port:number}>, hostCount:number}>, totalRecords:number}}
 */
export function groupByCertificate(records) {
  const map = new Map();
  const list = Array.isArray(records) ? records : [];
  for (const record of list) {
    for (const c of extractRecordCerts(record)) {
      if (!map.has(c.key)) {
        map.set(c.key, { key: c.key, cn: c.cn, issuers: new Set(), hosts: [], seen: new Set() });
      }
      const g = map.get(c.key);
      if (c.issuer) g.issuers.add(c.issuer);
      if (c.cn && !g.cn) g.cn = c.cn;
      const hostKey = `${c.ip}|${c.port}`;
      if (!g.seen.has(hostKey)) {
        g.seen.add(hostKey);
        g.hosts.push({ ip: c.ip, port: c.port });
      }
    }
  }
  return {
    groups: [...map.values()]
      .map(g => ({
        key: g.key,
        cn: g.cn,
        issuers: [...g.issuers].sort(),
        hosts: g.hosts,
        hostCount: g.seen.size,
      }))
      .sort((a, b) => b.hostCount - a.hostCount),
    totalRecords: list.length,
  };
}

/**
 * Pivot from a seed IP to every other host sharing one of its certificates.
 * This is the expansion step: given one confirmed target host, discover the
 * sibling assets hiding behind the same certificate.
 * @param {{groups:Array}} grouped Output of groupByCertificate.
 * @param {string} seedIp The known target host IP to pivot from.
 * @returns {Array<{ip:string, port:number, viaCert:string, viaCn:string|null}>} Sibling hosts (seed excluded).
 */
export function pivotFromSeed(grouped, seedIp) {
  const out = [];
  const seen = new Set();
  for (const g of grouped.groups || []) {
    if (!g.hosts.some(h => h.ip === seedIp)) continue;
    for (const h of g.hosts) {
      if (h.ip === seedIp) continue;
      const key = `${h.ip}|${h.port}|${g.key}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ ip: h.ip, port: h.port, viaCert: g.key, viaCn: g.cn });
    }
  }
  return out;
}
