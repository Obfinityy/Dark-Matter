/**
 * acmeAccountIntel.js — certificate authority-account URL mining (idea 00146).
 *
 * Some certificate metadata (CAA records, ACME server logs, cert
 * transparency auxiliary data, certificate order receipts) exposes ACME
 * account URIs. Pivoting on the issuing account reveals every other
 * certificate issued to the same account. This module extracts ACME
 * account URIs from supplied metadata text and groups issuances by account.
 */

const ACME_URI_RE = /https?:\/\/[^\s"'<>]*\/acme\/acct\/[^\s"'<>]+/gi;
const ACME_URI_RE2 = /https?:\/\/[^\s"'<>]*\/acme\/[^\/\s"'<>]+\/accounts?\/[^\s"'<>]+/gi;

function hostOf(uri) {
  try {
    return new URL(uri).hostname;
  } catch {
    return null;
  }
}

/**
 * Extract ACME account URIs from certificate/order metadata.
 * @param {string|string[]} sources — metadata text blobs
 * @returns {{ uri, caHost, accountId }[]}
 */
export function extractAcmeAccountUris(sources = []) {
  const blobs = Array.isArray(sources) ? sources : [sources];
  const seen = new Map();
  for (const blob of blobs) {
    const text = String(blob || '');
    for (const re of [ACME_URI_RE, ACME_URI_RE2]) {
      let m;
      while ((m = re.exec(text)) !== null) {
        const uri = m[0].replace(/[.,;)\]]+$/, '');
        if (!seen.has(uri)) {
          const caHost = hostOf(uri);
          const accountId = uri.split('/').filter(Boolean).pop();
          seen.set(uri, { uri, caHost, accountId });
        }
      }
    }
  }
  return [...seen.values()];
}

/**
 * Group certificates by the ACME account that issued them.
 * @param {{ serial, hostnames?: string[], acmeAccountUri?: string }[]} certs
 * @returns {{ accountUri, caHost, accountId, certificateCount, hostnames: string[] }[]}
 */
export function groupIssuancesByAccount(certs = []) {
  const groups = new Map();
  for (const cert of certs) {
    const uri = cert.acmeAccountUri;
    if (!uri) continue;
    if (!groups.has(uri)) groups.set(uri, { accountUri: uri, certificateCount: 0, hostnames: [] });
    const g = groups.get(uri);
    g.certificateCount++;
    for (const h of cert.hostnames || []) {
      if (!g.hostnames.includes(h)) g.hostnames.push(h);
    }
  }
  return [...groups.values()]
    .map((g) => ({ ...g, caHost: hostOf(g.accountUri), accountId: g.accountUri.split('/').filter(Boolean).pop() }))
    .sort((a, b) => b.certificateCount - a.certificateCount);
}

/**
 * Mine CAA record sets for ACME account URIs (CAA accounturi parameters).
 * @param {{ name, value }[]} caaRecords — parsed CAA records
 * @returns {{ domain, issuer, accountUri }[]}
 */
export function mineCaaAccountUris(caaRecords = []) {
  const out = [];
  for (const rec of caaRecords) {
    const m = /accounturi=([^\s;]+)/i.exec(String(rec.value || ''));
    if (m) {
      out.push({
        domain: rec.name,
        issuer: String(rec.value).split(';')[0].trim(),
        accountUri: m[1].replace(/["']/g, ''),
      });
    }
  }
  return out;
}
