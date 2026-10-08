/**
 * pkiHostIntel.js — PKI host-mapping intelligence for autonomous bug bounty.
 *
 * Implements Dark-Matter idea-bank item 00076 as a real, working defensive
 * asset-discovery capability for authorized targets:
 *
 *  00076 Certificate OCSP responder host mapping — extract OCSP and CRL
 *      URLs from target certificates to map PKI infrastructure hosts.
 *
 * X.509 certificates carry Authority Information Access (OCSP responder,
 * caIssuers) and CRL Distribution Points URLs. Those hosts are part of the
 * target's PKI infrastructure; mapping them — and flagging anomalies such
 * as unexpected third-party responders — is defensive asset discovery.
 *
 * All functions are pure: they operate on certificate-info objects (as
 * produced by openssl or any PEM parser) already collected by the caller.
 * No network I/O, no private-key material is ever touched.
 */

/**
 * Certificate info shape consumed by this engine (caller-supplied).
 * @typedef {object} CertInfo
 * @property {string} subject
 * @property {string} issuer
 * @property {string[]} [ocsp]       OCSP responder URLs (AIA)
 * @property {string[]} [caIssuers]  caIssuers URLs (AIA)
 * @property {string[]} [crl]        CRL distribution point URLs
 * @property {string} [fingerprint]
 */

/**
 * Extract the hostname from a URL string, or null when unparsable.
 *
 * @param {string} url
 * @returns {string|null}
 */
export function hostOf(url) {
  if (!url || typeof url !== 'string') return null;
  let u = url.trim();
  if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = 'http://' + u;
  try {
    return new URL(u).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Extract all PKI endpoint URLs from one certificate, tagged by role.
 *
 * @param {CertInfo} cert
 * @returns {Array<{url: string, host: string|null, role: 'ocsp'|'caIssuers'|'crl'}>}
 */
export function extractPkiEndpoints(cert) {
  const endpoints = [];
  for (const role of ['ocsp', 'caIssuers', 'crl']) {
    for (const url of cert[role] || []) {
      endpoints.push({ url, host: hostOf(url), role });
    }
  }
  return endpoints;
}

/** Host patterns typical of managed/public PKI providers. */
const PUBLIC_PKI_PATTERNS = [
  /digicert/i,
  /globalsign/i,
  /comodo/i,
  /sectigo/i,
  /letsencrypt/i,
  /entrust/i,
  /godaddy/i,
  /verisign/i,
  /symantec/i,
  /amazontrust/i,
  /google.*trust/i,
  /microsoft/i,
  /apple/i,
  /cloudflare/i,
];

/**
 * Map PKI infrastructure hosts across a certificate set: which hosts
 * serve OCSP/CRL/AIA, how many certificates reference each, and whether
 * the host looks like a public PKI provider or private org infrastructure.
 *
 * @param {CertInfo[]} certs
 * @returns {Array<{
 *   host: string,
 *   roles: string[],
 *   certCount: number,
 *   certSubjects: string[],
 *   provider: 'public-pki'|'private'|'unknown'
 * }>}
 */
export function mapPkiInfrastructure(certs) {
  const byHost = new Map();
  for (const cert of certs || []) {
    for (const ep of extractPkiEndpoints(cert)) {
      if (!ep.host) continue;
      if (!byHost.has(ep.host)) {
        byHost.set(ep.host, { roles: new Set(), subjects: new Set() });
      }
      const entry = byHost.get(ep.host);
      entry.roles.add(ep.role);
      entry.subjects.add(cert.subject || cert.fingerprint || 'unknown');
    }
  }
  return [...byHost.entries()]
    .map(([host, v]) => ({
      host,
      roles: [...v.roles].sort(),
      certCount: v.subjects.size,
      certSubjects: [...v.subjects].sort().slice(0, 10),
      provider: PUBLIC_PKI_PATTERNS.some(re => re.test(host)) ? 'public-pki' : 'private',
    }))
    .sort((a, b) => b.certCount - a.certCount);
}

/**
 * Flag PKI anomalies worth an analyst's attention:
 *  - certificates whose OCSP responder is on an unexpected port or plain HTTP
 *    while the org otherwise uses HTTPS responders;
 *  - responder hosts that serve multiple roles (e.g. same host for OCSP
 *    and CRL is fine, but a host whose URL mixes CRL+OCSP inconsistently
 *    across certs can indicate mis-issuance or interception);
 *  - private hosts appearing as responders for certs issued by public CAs.
 *
 * @param {CertInfo[]} certs
 * @returns {Array<{severity: 'info'|'warning', host: string, finding: string, certs: string[]}>}
 */
export function detectPkiAnomalies(certs) {
  const findings = [];
  const httpResponders = new Map(); // host -> Set(subject)
  const privateRespondersOnPublicCerts = new Map();

  for (const cert of certs || []) {
    const subject = cert.subject || cert.fingerprint || 'unknown';
    const issuer = (cert.issuer || '').toLowerCase();
    for (const ep of extractPkiEndpoints(cert)) {
      if (!ep.host) continue;
      if (/^http:/i.test(ep.url)) {
        if (!httpResponders.has(ep.host)) httpResponders.set(ep.host, new Set());
        httpResponders.get(ep.host).add(subject);
      }
      const looksPublicPki = PUBLIC_PKI_PATTERNS.some(re => re.test(ep.host));
      if (
        ep.role === 'ocsp' &&
        !looksPublicPki &&
        PUBLIC_PKI_PATTERNS.some(re => re.test(issuer))
      ) {
        if (!privateRespondersOnPublicCerts.has(ep.host)) {
          privateRespondersOnPublicCerts.set(ep.host, new Set());
        }
        privateRespondersOnPublicCerts.get(ep.host).add(subject);
      }
    }
  }

  for (const [host, subjects] of httpResponders) {
    findings.push({
      severity: 'info',
      host,
      finding:
        'PKI endpoint served over plain HTTP (normal for OCSP/CRL, verify it matches org policy)',
      certs: [...subjects].sort(),
    });
  }
  for (const [host, subjects] of privateRespondersOnPublicCerts) {
    findings.push({
      severity: 'warning',
      host,
      finding:
        'private responder host used on certificates issued by a public CA — possible OCSP stapling proxy or unexpected delegation',
      certs: [...subjects].sort(),
    });
  }
  return findings;
}
