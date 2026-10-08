/**
 * afsdbIntel.js — AFSDB record legacy mapping (idea 00089).
 *
 * Defensive legacy file-service discovery for an authorized bug-bounty
 * agent. AFSDB records (RFC 1183) map a domain name to AFS database
 * servers or DCE/NCS cell servers: `<subtype> <hostname>` where subtype 1
 * is an AFS volume location server and subtype 2 is a DCE/NCS cell server.
 * These records predate modern infrastructure — when present they often
 * reference forgotten file-service hosts that are still live and
 * unmonitored, prime candidates for legacy-service review.
 *
 * Passive DNS lookups only. Use against operator-authorized targets only.
 */

import dns from 'node:dns';

const resolver = new dns.promises.Resolver();

/** AFSDB subtypes (RFC 1183 §1, RFC 5864). */
export const AFSDB_SUBTYPES = {
  0: 'reserved',
  1: 'AFS volume location server',
  2: 'DCE/NCS cell server',
};

/**
 * Parse an AFSDB rdata string: `<subtype> <hostname>` (RFC 1183 §1).
 * Accepts Node's dns.resolve object shape { subtype, host } too.
 *
 * @param {string|Object} rdata e.g. "1 afsdb1.example.com."
 * @returns {{subtype:number, subtypeName:string, hostname:string}|null}
 */
export function parseAfsdbRecord(rdata) {
  if (rdata && typeof rdata === 'object') {
    const subtype = Number(rdata.subtype);
    if (!Number.isInteger(subtype)) return null;
    return {
      subtype,
      subtypeName: AFSDB_SUBTYPES[subtype] || `unknown(${subtype})`,
      hostname: String(rdata.host || '')
        .replace(/\.$/, '')
        .toLowerCase(),
    };
  }
  const parts = String(rdata || '')
    .trim()
    .split(/\s+/);
  if (parts.length < 2) return null;
  const subtype = Number(parts[0]);
  if (!Number.isInteger(subtype)) return null;
  return {
    subtype,
    subtypeName: AFSDB_SUBTYPES[subtype] || `unknown(${subtype})`,
    hostname: parts.slice(1).join(' ').replace(/\.$/, '').toLowerCase(),
  };
}

/**
 * Analyze a domain's AFSDB records and return defensive findings.
 *
 * @param {string} domain
 * @param {Array<string|Object>} records raw AFSDB rdata or dns.resolve shapes
 * @returns {{domain:string, present:boolean, servers:Array<{hostname:string, subtype:string}>, findings:Array<{severity:string,type:string,detail:string,recommendation:string}>}}
 */
export function analyzeAfsdbRecords(domain, records) {
  const d = String(domain || '')
    .trim()
    .toLowerCase()
    .replace(/\.$/, '');
  const findings = [];
  const parsed = (records || []).map(parseAfsdbRecord).filter(Boolean);
  const seen = new Set();
  const servers = [];
  for (const p of parsed) {
    const key = `${p.subtype}|${p.hostname}`;
    if (seen.has(key)) continue;
    seen.add(key);
    servers.push({ hostname: p.hostname, subtype: p.subtypeName });
  }
  if (servers.length === 0) return { domain: d, present: false, servers, findings };
  findings.push({
    severity: 'medium',
    type: 'afsdb-legacy-service-reference',
    detail: `${d} publishes ${servers.length} AFSDB record(s): ${servers.map(s => `${s.hostname} (${s.subtype})`).join(', ')} — AFSDB is a legacy record type; the referenced hosts are frequently forgotten file-service infrastructure.`,
    recommendation:
      'Resolve each hostname and fingerprint it: legacy AFS/DCE services are rarely patched and often expose volume or cell metadata. Confirm decommissioning if unused.',
  });
  const dce = servers.filter(s => /dce/i.test(s.subtype));
  if (dce.length > 0) {
    findings.push({
      severity: 'low',
      type: 'afsdb-dce-cell-reference',
      detail: `DCE/NCS cell server reference(s): ${dce.map(s => s.hostname).join(', ')} — DCE cell infrastructure is end-of-life in most estates; verify these hosts are still intended to exist.`,
      recommendation:
        'If the cell is retired, remove the AFSDB records to shrink the legacy footprint.',
    });
  }
  return { domain: d, present: true, servers, findings };
}

/**
 * Idea 00089 — query AFSDB records for a domain and its common prefixes.
 *
 * @param {string} domain e.g. "example.com"
 * @param {string[]} [names] owner names to probe (default: domain + cell/afs prefixes)
 * @returns {Promise<{domain:string, results:Array, summary:string[]}>}
 */
export async function mapAfsdbLegacy(domain, names = ['@', 'cell', 'afs', 'dfs']) {
  const d = String(domain || '')
    .trim()
    .toLowerCase()
    .replace(/\.$/, '');
  const targets = [...new Set(names.map(n => (n === '@' ? d : `${n}.${d}`)))];
  const results = [];
  const summary = [];
  await Promise.all(
    targets.map(async owner => {
      try {
        const raw = await resolver.resolve(owner, 'AFSDB');
        const analysis = analyzeAfsdbRecords(owner, raw);
        if (analysis.present) results.push({ owner, ...analysis });
      } catch {
        /* no AFSDB — not a finding */
      }
    })
  );
  results.sort((a, b) => a.owner.localeCompare(b.owner));
  if (results.length === 0) {
    summary.push(
      'No AFSDB records found — no legacy AFS/DCE file-service references in DNS (expected for modern estates).'
    );
  } else {
    summary.push(
      `${results.length} owner name(s) with legacy AFSDB references — each referenced host is a forgotten-file-service candidate for fingerprinting.`
    );
  }
  return { domain: d, results, summary };
}
