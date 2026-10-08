/**
 * circlIntel.js — CIRCL passive-DNS / passive-SSL correlation (idea 00180).
 *
 * Defensive asset-discovery analyzers for an authorized bug-bounty agent.
 * Correlates aggregated CIRCL-style passive-DNS records with passive-SSL
 * (certificate observation) records to link IPs, certificates, and names
 * into a single infrastructure graph: from a seed IP or domain the agent can
 * pivot through shared certificates to sibling hosts it would otherwise miss.
 *
 * Passive-DNS record shape: { name, ip, firstSeen, lastSeen, source }
 * Passive-SSL record shape:
 *   { ip, port, cert: { sha1, cn, sans: [String], firstSeen, lastSeen }, source }
 * All functions are pure and synchronous.
 */

/**
 * Idea 00180 — Correlate passive DNS with passive SSL.
 *
 * Builds the three-way linkage: ip -> { names, certs }, where names come
 * from passive DNS and certs from passive SSL observations on that IP.
 *
 * @param {Array<Object>} dnsRecords - passive-DNS records.
 * @param {Array<Object>} sslRecords - passive-SSL records.
 * @returns {Map<string, { names: Array<string>, certs: Array<Object> }>} keyed by IP.
 */
export function correlate(dnsRecords, sslRecords) {
  const out = new Map();
  const ensure = ip => {
    if (!out.has(ip)) out.set(ip, { names: new Set(), certs: new Map() });
    return out.get(ip);
  };
  for (const r of dnsRecords || []) {
    if (!r || !r.name || !r.ip) continue;
    ensure(String(r.ip)).names.add(String(r.name).toLowerCase().replace(/\.$/, ''));
  }
  for (const r of sslRecords || []) {
    if (!r || !r.ip || !r.cert || !r.cert.sha1) continue;
    const entry = ensure(String(r.ip));
    const sha1 = String(r.cert.sha1).toLowerCase();
    if (!entry.certs.has(sha1)) {
      entry.certs.set(sha1, {
        sha1,
        cn: r.cert.cn ?? null,
        sans: [...new Set((r.cert.sans || []).map(s => String(s).toLowerCase()))].sort(),
        ports: new Set(),
        firstSeen: r.cert.firstSeen ?? null,
        lastSeen: r.cert.lastSeen ?? null,
      });
    }
    if (r.port != null) entry.certs.get(sha1).ports.add(Number(r.port));
  }
  const result = new Map();
  for (const [ip, e] of out.entries()) {
    result.set(ip, {
      names: [...e.names].sort(),
      certs: [...e.certs.values()].map(c => ({ ...c, ports: [...c.ports].sort((a, b) => a - b) })),
    });
  }
  return result;
}

/**
 * Idea 00180 — Pivot from a seed through shared certificates.
 *
 * Finds every IP whose passive-SSL certificate matches one observed on the
 * seed's IPs — those hosts share TLS infrastructure with the target.
 *
 * @param {Map<string, Object>} correlated - output of correlate.
 * @param {Array<string>} seedIps
 * @returns {Array<{ ip, names: Array<string>, viaCert: string, viaCn: string|null }>}
 */
export function pivotByCertificate(correlated, seedIps) {
  const seeds = new Set((seedIps || []).map(String));
  const seedShas = new Map(); // sha1 -> { cn }
  for (const [ip, entry] of correlated || []) {
    if (!seeds.has(ip)) continue;
    for (const c of entry.certs) seedShas.set(c.sha1, c.cn);
  }
  const out = [];
  const seen = new Set();
  for (const [ip, entry] of correlated || []) {
    if (seeds.has(ip)) continue;
    for (const c of entry.certs) {
      if (!seedShas.has(c.sha1)) continue;
      const key = `${ip}|${c.sha1}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ ip, names: entry.names, viaCert: c.sha1, viaCn: c.cn });
    }
  }
  return out.sort((a, b) => a.ip.localeCompare(b.ip));
}

/**
 * Idea 00180 — Certificate-reuse summary.
 *
 * Ranks certificates by how many distinct IPs they were observed on —
 * widely reused certs are the strongest pivot anchors (and occasionally a
 * finding in themselves when a private cert leaks onto unrelated hosts).
 *
 * @param {Map<string, Object>} correlated - output of correlate.
 * @param {{ minIps?: number }} [opts]
 * @returns {Array<{ sha1, cn, ipCount: number, ips: Array<string> }>} sorted desc.
 */
export function certificateReuse(correlated, opts = {}) {
  const minIps = opts.minIps ?? 2;
  const bySha = new Map();
  for (const [ip, entry] of correlated || []) {
    for (const c of entry.certs) {
      if (!bySha.has(c.sha1)) bySha.set(c.sha1, { cn: c.cn, ips: new Set() });
      bySha.get(c.sha1).ips.add(ip);
    }
  }
  return [...bySha.entries()]
    .filter(([, v]) => v.ips.size >= minIps)
    .map(([sha1, v]) => ({ sha1, cn: v.cn, ipCount: v.ips.size, ips: [...v.ips].sort() }))
    .sort((a, b) => b.ipCount - a.ipCount || a.sha1.localeCompare(b.sha1));
}
