/**
 * webfingerMiner.js — WebFinger host enumeration (idea 00115).
 *
 * Querying WebFinger (/.well-known/webfinger?resource=acct:...) for
 * acct: URIs returns JRD documents whose links reveal profile, federation
 * and service hosts. This module builds query URLs and parses responses.
 */

/**
 * Build a WebFinger query URL for an acct: resource.
 * @param {string} base — e.g. "https://example.com"
 * @param {string} account — e.g. "acct:user@example.com"
 * @returns {string}
 */
export function webfingerUrl(base, account) {
  const u = new URL(String(base));
  return `${u.origin}/.well-known/webfinger?resource=${encodeURIComponent(account)}`;
}

function hostOf(value) {
  try {
    return new URL(String(value)).hostname;
  } catch {
    return null;
  }
}

/**
 * Parse a WebFinger JRD response into discovered hosts and links.
 * @param {object|string} jrd — parsed JRD or raw JSON text
 * @returns {{ valid: boolean, subject: string|null, hosts: { rel, host, href }[], uniqueHosts: string[], notes: string[] }}
 */
export function parseWebFinger(jrd) {
  const notes = [];
  let obj = jrd;
  if (typeof jrd === 'string') {
    try {
      obj = JSON.parse(jrd);
    } catch {
      return { valid: false, subject: null, hosts: [], uniqueHosts: [], notes: ['Not valid JSON'] };
    }
  }
  if (!obj || typeof obj !== 'object') {
    return { valid: false, subject: null, hosts: [], uniqueHosts: [], notes: ['Empty JRD'] };
  }

  const links = Array.isArray(obj.links) ? obj.links : [];
  const hosts = [];
  const unique = new Set();
  for (const link of links) {
    if (!link || !link.href) continue;
    const host = hostOf(link.href);
    if (host) {
      hosts.push({ rel: link.rel || 'unknown', host, href: String(link.href) });
      unique.add(host);
    }
  }

  const subject = obj.subject || null;
  if (links.length === 0) notes.push('No links in JRD — host supports WebFinger but disclosed nothing for this resource');
  if (unique.size > 1) notes.push(`Resource is spread across ${unique.size} hosts — federation/profile surface mapped`);

  return { valid: true, subject, hosts, uniqueHosts: [...unique], notes };
}

export const WEBFINGER_MINER = { webfingerUrl, parseWebFinger };
export default WEBFINGER_MINER;
