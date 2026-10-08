/**
 * naptrIntel.js — NAPTR service discovery (idea 00086).
 *
 * Defensive ENUM/SIP service mapping for an authorized bug-bounty agent.
 * NAPTR records (RFC 3403) encode service-selection rules: SIP and SIPS
 * server discovery (RFC 3263), E.164 ENUM telephone-number mapping
 * (RFC 6116) and other protocol handoffs. Parsing them reveals the VoIP /
 * telephony services tied to a domain — each one a service worth SIP
 * security review within the assessment scope.
 *
 * Passive DNS lookups only. Use against operator-authorized targets only.
 */

import dns from 'node:dns';

const resolver = new dns.promises.Resolver();

/**
 * Parse a NAPTR rdata string (RFC 3403 §4.1).
 * Format: `<order> <preference> "<flags>" "<service>" "<regexp>" <replacement>`
 * Accepts Node's dns.resolve NAPTR object shape too.
 *
 * @param {string|Object} rdata
 * @returns {{order:number, preference:number, flags:string, service:string, regexp:string, replacement:string}|null}
 */
export function parseNaptrRecord(rdata) {
  if (rdata && typeof rdata === 'object') {
    return {
      order: Number(rdata.order) || 0,
      preference: Number(rdata.preference) || 0,
      flags: String(rdata.flags || '').toLowerCase(),
      service: String(rdata.service || '').toLowerCase(),
      regexp: String(rdata.regexp || ''),
      replacement: String(rdata.replacement || '')
        .replace(/\.$/, '')
        .toLowerCase(),
    };
  }
  const m = String(rdata || '')
    .trim()
    .match(/^(\d+)\s+(\d+)\s+"([^"]*)"\s+"([^"]*)"\s+"([^"]*)"\s+(\S+)\s*$/);
  if (!m) return null;
  return {
    order: Number(m[1]),
    preference: Number(m[2]),
    flags: m[3].toLowerCase(),
    service: m[4].toLowerCase(),
    regexp: m[5],
    replacement: m[6].replace(/\.$/, '').toLowerCase(),
  };
}

/**
 * Interpret a parsed NAPTR service string into a human-readable service class.
 *
 * @param {string} service e.g. "SIP+D2T", "SIPS+D2S", "E2U+sip"
 * @returns {string}
 */
export function classifyNaptrService(service) {
  const s = String(service || '').toLowerCase();
  if (/^sip\+/.test(s)) return 'SIP signaling';
  if (/^sips\+/.test(s)) return 'SIPS (TLS) signaling';
  if (/^e2u\+/.test(s)) return `ENUM telephony mapping (${s})`;
  if (s === '') return 'no service (terminal rule)';
  return `other service (${s})`;
}

/**
 * Analyze a domain's NAPTR records and return defensive findings.
 *
 * @param {string} domain
 * @param {Array<string|Object>} records
 * @returns {{domain:string, present:boolean, services:Array<{service:string,class:string,flags:string,replacement:string}>, findings:Array<{severity:string,type:string,detail:string}>}}
 */
export function analyzeNaptrRecords(domain, records) {
  const d = String(domain || '')
    .trim()
    .toLowerCase()
    .replace(/\.$/, '');
  const findings = [];
  const parsed = (records || [])
    .map(parseNaptrRecord)
    .filter(Boolean)
    .sort((a, b) => a.order - b.order || a.preference - b.preference);
  const services = parsed.map(p => ({
    service: p.service,
    class: classifyNaptrService(p.service),
    flags: p.flags,
    regexp: p.regexp,
    replacement: p.replacement === '.' ? '(regexp substitution)' : p.replacement,
  }));
  if (parsed.length === 0) return { domain: d, present: false, services, findings };
  findings.push({
    severity: 'info',
    type: 'naptr-services-published',
    detail: `${d} publishes ${parsed.length} NAPTR record(s): ${[...new Set(services.map(s => s.class))].join(', ')} — each replacement hostname is a telephony/VoIP service in scope for SIP security review.`,
  });
  const sipTargets = new Set(
    parsed
      .filter(p => /^(sip|sips)\+/.test(p.service) && p.replacement !== '.')
      .map(p => p.replacement)
  );
  if (sipTargets.size > 0) {
    findings.push({
      severity: 'info',
      type: 'naptr-sip-targets',
      detail: `SIP signaling targets discovered: ${[...sipTargets].join(', ')} — probe these for SIP method enumeration, registration auth policy and TLS (SIPS) posture.`,
    });
  }
  const enumRules = parsed.filter(p => p.service.startsWith('e2u+'));
  if (enumRules.length > 0) {
    findings.push({
      severity: 'medium',
      type: 'naptr-enum-mapping',
      detail: `${enumRules.length} ENUM (E2U) rule(s) published — telephone-number-to-URI mappings expose the organization's numbering plan; treat the regexp rules as sensitive mapping data.`,
    });
  }
  return { domain: d, present: true, services, findings };
}

/**
 * Idea 00086 — parse NAPTR records for a domain to discover SIP, SIPS and
 * ENUM service mappings.
 *
 * @param {string} domain e.g. "example.com"
 * @returns {Promise<{domain:string, present:boolean, services:Array, findings:Array}>}
 */
export async function discoverNaptrServices(domain) {
  const d = String(domain || '')
    .trim()
    .toLowerCase()
    .replace(/\.$/, '');
  let raw = [];
  try {
    raw = await resolver.resolve(d, 'NAPTR');
  } catch (err) {
    if (err && err.code !== 'ENODATA' && err.code !== 'ENOTFOUND' && err.code !== 'SERVFAIL')
      throw err;
  }
  return analyzeNaptrRecords(d, raw);
}
