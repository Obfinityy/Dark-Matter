/**
 * rirAbuseIntel.js — RIR abuse-contact domain pivoting (idea 00142).
 *
 * RIR whois objects (irt, role, organisation) carry abuse-mailbox attributes.
 * The mailbox domain often belongs to the security team or SOC operator and
 * can pivot to further infrastructure. This module extracts abuse contacts
 * from RIR objects and scores the pivots.
 */

const ABUSE_RE = /^abuse-mailbox:\s*(.+)$/gim;
const ORG_RE = /^org-name:\s*(.+)$/gim;
const EMAIL_RE = /([a-z0-9._%+-]+)@([a-z0-9.-]+\.[a-z]{2,})/i;

function domainOf(mailbox) {
  const m = EMAIL_RE.exec(String(mailbox).trim());
  return m ? m[2].toLowerCase() : null;
}

/**
 * Extract abuse-mailbox contacts and their parent organization from an
 * RIR whois object dump.
 * @param {string} text — raw RIR whois object (may contain several objects)
 * @returns {{ mailboxes: string[], domains: string[], orgNames: string[] }}
 */
export function extractAbuseContacts(text = '') {
  const body = String(text);
  const mailboxes = [];
  const domains = [];
  const orgNames = [];
  let m;
  while ((m = ABUSE_RE.exec(body)) !== null) {
    const mailbox = m[1].trim().toLowerCase();
    if (!mailboxes.includes(mailbox)) mailboxes.push(mailbox);
    const domain = domainOf(mailbox);
    if (domain && !domains.includes(domain)) domains.push(domain);
  }
  while ((m = ORG_RE.exec(body)) !== null) {
    const org = m[1].trim();
    if (org && !orgNames.includes(org)) orgNames.push(org);
  }
  return { mailboxes, domains, orgNames };
}

/**
 * Pivot on abuse-contact domains: correlate mailbox domains with any
 * hostnames already known for the target and rank them.
 * @param {string[]} rirTexts — RIR whois dumps (one or more objects)
 * @param {string[]} knownHosts — hostnames already attributed to the target
 * @returns {{ domain, occurrences, matchesKnownBrand, suggestedPivots: string[] }[]}
 */
export function pivotOnAbuseDomains(rirTexts = [], knownHosts = []) {
  const stats = new Map();
  for (const text of rirTexts) {
    const { domains } = extractAbuseContacts(text);
    for (const domain of domains) {
      stats.set(domain, (stats.get(domain) || 0) + 1);
    }
  }
  const hosts = knownHosts.map((h) => h.toLowerCase());
  const results = [];
  for (const [domain, occurrences] of stats.entries()) {
    const brandHits = hosts.filter((h) => h === domain || h.endsWith(`.${domain}`));
    const suggestedPivots = [
      `soc.${domain}`,
      `abuse.${domain}`,
      `security.${domain}`,
      `noc.${domain}`,
    ];
    results.push({
      domain,
      occurrences,
      matchesKnownBrand: brandHits.length > 0,
      matchedHosts: brandHits,
      suggestedPivots,
    });
  }
  results.sort((a, b) => (b.matchesKnownBrand - a.matchesKnownBrand) || (b.occurrences - a.occurrences));
  return results;
}
