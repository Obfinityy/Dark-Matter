/**
 * sshfpIntel.js — SSHFP record host harvesting (idea 00084).
 *
 * Defensive SSH-fingerprint enumeration for an authorized bug-bounty agent.
 * SSHFP records (RFC 4255) publish the fingerprints of a host's SSH host
 * keys in DNS so clients can verify them via DNSSEC. Each SSHFP record
 * marks a host that offers SSH — every one of those hosts is a candidate
 * for further fingerprinting (version, auth methods, host-key rotation)
 * within the assessment scope.
 *
 * Passive DNS lookups only; no SSH connections are opened. Use against
 * operator-authorized targets only.
 */

import dns from 'node:dns';

const resolver = new dns.promises.Resolver();

/** SSH host-key algorithms per RFC 4255 / RFC 6594. */
export const SSHFP_ALGORITHMS = {
  0: 'reserved',
  1: 'RSA',
  2: 'DSS',
  3: 'ECDSA',
  4: 'Ed25519',
  6: 'Ed448',
};

/** SSHFP fingerprint (hash) types per RFC 4255 / RFC 6594. */
export const SSHFP_FP_TYPES = { 0: 'reserved', 1: 'SHA-1', 2: 'SHA-256' };

/**
 * Parse an SSHFP rdata string into a structured record.
 * Format: `<algorithm> <fingerprint-type> <fingerprint-hex>` (RFC 4255 §3.1).
 * Accepts Node's dns.resolve object shape { algorithm, fingerprintType, fingerprint } too.
 *
 * @param {string|Object} rdata
 * @returns {{algorithm:number, algorithmName:string, fingerprintType:number, fingerprintTypeName:string, fingerprint:string, valid:boolean}|null}
 */
export function parseSshfpRecord(rdata) {
  let algorithm, fingerprintType, fingerprint;
  if (rdata && typeof rdata === 'object') {
    algorithm = Number(rdata.algorithm);
    fingerprintType = Number(rdata.fingerprintType);
    fingerprint = String(rdata.fingerprint || '').replace(/[^0-9a-fA-F]/g, '');
  } else {
    const parts = String(rdata || '')
      .trim()
      .split(/\s+/);
    if (parts.length < 3) return null;
    algorithm = Number(parts[0]);
    fingerprintType = Number(parts[1]);
    fingerprint = parts
      .slice(2)
      .join('')
      .replace(/[^0-9a-fA-F]/g, '');
  }
  if (!Number.isInteger(algorithm) || !Number.isInteger(fingerprintType) || !fingerprint)
    return null;
  const algorithmName = SSHFP_ALGORITHMS[algorithm] || `unknown(${algorithm})`;
  const fingerprintTypeName = SSHFP_FP_TYPES[fingerprintType] || `unknown(${fingerprintType})`;
  const expectedLen = fingerprintType === 1 ? 40 : fingerprintType === 2 ? 64 : 0;
  const valid = expectedLen === 0 || fingerprint.length === expectedLen;
  return {
    algorithm,
    algorithmName,
    fingerprintType,
    fingerprintTypeName,
    fingerprint: fingerprint.toLowerCase(),
    valid,
  };
}

/**
 * Analyze a host's SSHFP records and return defensive findings.
 *
 * @param {string} hostname
 * @param {Array<string|Object>} records raw SSHFP rdata or dns.resolve shapes
 * @returns {{hostname:string, offersSsh:boolean, keyTypes:string[], findings:Array<{severity:string,type:string,detail:string}>}}
 */
export function analyzeSshfpRecords(hostname, records) {
  const host = String(hostname || '')
    .toLowerCase()
    .replace(/\.$/, '');
  const findings = [];
  const parsed = (records || []).map(parseSshfpRecord).filter(Boolean);
  if (parsed.length === 0) return { hostname: host, offersSsh: false, keyTypes: [], findings };
  const keyTypes = [...new Set(parsed.map(p => p.algorithmName))];
  findings.push({
    severity: 'info',
    type: 'ssh-service-advertised',
    detail: `${host} publishes ${parsed.length} SSHFP record(s) advertising SSH host keys (${keyTypes.join(', ')}) — the host offers SSH and belongs in the assessment's fingerprinting queue.`,
  });
  const sha1 = parsed.filter(p => p.fingerprintType === 1);
  if (sha1.length > 0) {
    findings.push({
      severity: 'low',
      type: 'sshfp-sha1-fingerprint',
      detail: `${sha1.length} SSHFP record(s) on ${host} use SHA-1 fingerprints. SHA-1 fingerprints are legacy; prefer SHA-256 (type 2) so clients can verify host keys strongly via DNSSEC.`,
    });
  }
  const invalid = parsed.filter(p => !p.valid);
  if (invalid.length > 0) {
    findings.push({
      severity: 'low',
      type: 'sshfp-malformed-record',
      detail: `${invalid.length} SSHFP record(s) on ${host} have a fingerprint length inconsistent with their hash type — stale or hand-edited records that undermine host-key verification.`,
    });
  }
  if (parsed.some(p => p.algorithm === 2)) {
    findings.push({
      severity: 'low',
      type: 'sshfp-dss-key-advertised',
      detail: `${host} advertises a DSS (DSA) host key via SSHFP — DSA host keys are legacy and disabled in modern OpenSSH; flag for decommissioning.`,
    });
  }
  return { hostname: host, offersSsh: true, keyTypes, findings };
}

/**
 * Idea 00084 — harvest SSHFP records across candidate hostnames of a domain.
 *
 * @param {string} domain
 * @param {string[]} [hostnames] hostnames to probe (defaults to common prefixes)
 * @returns {Promise<{domain:string, sshHosts:Array, summary:string[]}>}
 */
export async function harvestSshfpHosts(
  domain,
  hostnames = [
    'www',
    'mail',
    'vpn',
    'ssh',
    'git',
    'server',
    'gateway',
    'remote',
    'dev',
    'staging',
    ' Bastion'.trim().toLowerCase(),
  ]
) {
  const d = String(domain || '')
    .trim()
    .toLowerCase()
    .replace(/\.$/, '');
  const targets = [...new Set([...hostnames.map(h => `${h}.${d}`), d])];
  const sshHosts = [];
  const summary = [];
  await Promise.all(
    targets.map(async hostname => {
      try {
        const raw = await resolver.resolve(hostname, 'SSHFP');
        const analysis = analyzeSshfpRecords(hostname, raw);
        if (analysis.offersSsh) sshHosts.push(analysis);
      } catch {
        /* no SSHFP — not a finding */
      }
    })
  );
  sshHosts.sort((a, b) => a.hostname.localeCompare(b.hostname));
  if (sshHosts.length === 0) {
    summary.push(
      'No SSHFP records found on probed hostnames — SSH services on this domain are not DNS-advertised (normal; SSH may still exist).'
    );
  } else {
    summary.push(
      `${sshHosts.length} host(s) advertise SSH via SSHFP: ${sshHosts.map(h => `${h.hostname} (${h.keyTypes.join('/')})`).join(', ')} — fingerprint each for version, auth methods and host-key rotation status.`
    );
  }
  return { domain: d, sshHosts, summary };
}
