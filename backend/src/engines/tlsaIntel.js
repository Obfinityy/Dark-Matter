/**
 * tlsaIntel.js — TLSA record service mapping (idea 00085).
 *
 * Defensive DANE deployment mapping for an authorized bug-bounty agent.
 * TLSA records (RFC 6698) live at `_<port>._<proto>.<host>` and pin the
 * TLS certificates a service must present. Reading them reveals which
 * hosts and ports run DANE-protected services (HTTPS, SMTPS, IMAPS,
 * XMPP, ...) — each one a service whose TLS posture is explicitly
 * managed and worth verifying against the live handshake.
 *
 * Passive DNS lookups only. Use against operator-authorized targets only.
 */

import dns from 'node:dns';

const resolver = new dns.promises.Resolver();

/** TLSA certificate usage values (RFC 6698 §2.1.1). */
export const TLSA_USAGE = { 0: 'CA constraint', 1: 'service certificate constraint', 2: 'trust anchor assertion', 3: 'domain-issued certificate' };

/** TLSA selector values (RFC 6698 §2.1.2). */
export const TLSA_SELECTOR = { 0: 'full certificate', 1: 'SubjectPublicKeyInfo' };

/** TLSA matching-type values (RFC 6698 §2.1.3). */
export const TLSA_MATCHING = { 0: 'exact match', 1: 'SHA-256 hash', 2: 'SHA-512 hash' };

/**
 * Common `_port._proto` service names to probe for TLSA records.
 * @type {Array<{service:string, port:number, proto:string}>}
 */
export const COMMON_TLSA_SERVICES = [
  { service: 'https', port: 443, proto: 'tcp' },
  { service: 'smtps', port: 465, proto: 'tcp' },
  { service: 'submission', port: 587, proto: 'tcp' },
  { service: 'smtp', port: 25, proto: 'tcp' },
  { service: 'imaps', port: 993, proto: 'tcp' },
  { service: 'pop3s', port: 995, proto: 'tcp' },
  { service: 'xmpp', port: 5222, proto: 'tcp' },
  { service: 'sip', port: 5061, proto: 'tcp' },
];

/**
 * Parse a TLSA rdata string into a structured record (RFC 6698 §2.1).
 * Format: `<usage> <selector> <matching-type> <certificate-association-data>`.
 *
 * @param {string} rdata e.g. "3 1 1 d2abde240d7cd3fd..."
 * @returns {{usage:number, usageName:string, selector:number, selectorName:string, matchingType:number, matchingTypeName:string, data:string, valid:boolean}|null}
 */
export function parseTlsaRecord(rdata) {
  const parts = String(rdata || '').trim().split(/\s+/);
  if (parts.length < 4) return null;
  const usage = Number(parts[0]);
  const selector = Number(parts[1]);
  const matchingType = Number(parts[2]);
  const data = parts.slice(3).join('').replace(/[^0-9a-fA-F]/g, '');
  if (![usage, selector, matchingType].every(Number.isInteger)) return null;
  if (usage < 0 || usage > 3 || selector < 0 || selector > 1 || matchingType < 0 || matchingType > 2) return null;
  if (!data) return null;
  const usageName = TLSA_USAGE[usage] || `unknown(${usage})`;
  const selectorName = TLSA_SELECTOR[selector] || `unknown(${selector})`;
  const matchingTypeName = TLSA_MATCHING[matchingType] || `unknown(${matchingType})`;
  const expectedLen = matchingType === 0 ? 0 : matchingType === 1 ? 64 : 128;
  const valid = expectedLen === 0 ? true : data.length === expectedLen;
  return { usage, usageName, selector, selectorName, matchingType, matchingTypeName, data: data.toLowerCase(), valid };
}

/**
 * Analyze one service's TLSA records and return defensive findings.
 *
 * @param {string} hostname
 * @param {number} port
 * @param {string} proto
 * @param {string[]} records raw TLSA rdata strings
 * @returns {{name:string, port:number, proto:string, daneDeployed:boolean, usages:string[], findings:Array<{severity:string,type:string,detail:string}>}}
 */
export function analyzeTlsaRecords(hostname, port, proto, records) {
  const name = `_${port}._${proto}.${String(hostname).toLowerCase().replace(/\.$/, '')}`;
  const findings = [];
  const parsed = (records || []).map(parseTlsaRecord).filter(Boolean);
  if (parsed.length === 0) {
    return { name, port, proto, daneDeployed: false, usages: [], findings };
  }
  const usages = [...new Set(parsed.map(p => p.usageName))];
  findings.push({
    severity: 'info',
    type: 'dane-deployment-found',
    detail: `DANE is deployed for ${name} (${parsed.length} TLSA record(s), usage: ${usages.join(', ')}) — verify the live TLS handshake's certificate matches the pinned association data.`,
  });
  const malformed = parsed.filter(p => !p.valid);
  if (malformed.length > 0) {
    findings.push({
      severity: 'medium',
      type: 'tlsa-malformed-record',
      detail: `${malformed.length} TLSA record(s) for ${name} have hash data inconsistent with their matching type — DANE validation will fail and the record set needs repair.`,
    });
  }
  if (parsed.every(p => p.usage === 0 || p.usage === 1)) {
    findings.push({
      severity: 'low',
      type: 'tlsa-ca-constrained-only',
      detail: `TLSA set for ${name} uses only CA/service constraints (usage 0/1) — still depends on the public CA ecosystem; usage 3 (domain-issued) would give full DANE independence.`,
    });
  }
  return { name, port, proto, daneDeployed: true, usages, findings };
}

/**
 * Idea 00085 — read TLSA records for common services across hostnames of a
 * domain, mapping DANE deployments and their associated ports.
 *
 * @param {string} domain
 * @param {string[]} [hostnames] hostnames to probe (default: domain + mail/www prefixes)
 * @returns {Promise<{domain:string, services:Array, summary:string[]}>}
 */
export async function mapTlsaServices(domain, hostnames = null) {
  const d = String(domain || '').trim().toLowerCase().replace(/\.$/, '');
  const hosts = hostnames || [d, `www.${d}`, `mail.${d}`, `smtp.${d}`, `mx.${d}`];
  const services = [];
  const summary = [];
  const probes = [];
  for (const host of hosts) {
    for (const svc of COMMON_TLSA_SERVICES) {
      probes.push({ host, ...svc });
    }
  }
  await Promise.all(probes.map(async (probe) => {
    const name = `_${probe.port}._${probe.proto}.${probe.host}`;
    try {
      const raw = await resolver.resolve(name, 'TLSA');
      const analysis = analyzeTlsaRecords(probe.host, probe.port, probe.proto, raw.map(r => String(r).trim()));
      if (analysis.daneDeployed) services.push(analysis);
    } catch { /* no TLSA — not a finding */ }
  }));
  services.sort((a, b) => a.name.localeCompare(b.name));
  if (services.length === 0) {
    summary.push('No TLSA records found on probed services — DANE is not deployed here; TLS trust rests entirely on the public CA ecosystem.');
  } else {
    summary.push(`${services.length} DANE-protected service endpoint(s): ${services.map(s => s.name).join(', ')} — verify each pinned certificate against the live handshake and watch for rotation drift.`);
  }
  return { domain: d, services, summary };
}
