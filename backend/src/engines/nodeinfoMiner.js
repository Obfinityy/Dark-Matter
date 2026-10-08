/**
 * nodeinfoMiner.js — NodeInfo federation host discovery (idea 00116).
 *
 * Fediverse instances publish nodeinfo documents describing their software,
 * usage stats and federation settings. Fetching them on suspected hosts
 * confirms federated instances and maps the org's fediverse footprint.
 */

/**
 * Build nodeinfo discovery URLs for a host (2.0 → 2.1 → 1.0 fallbacks).
 * @param {string} host — e.g. "social.example.com"
 * @returns {string[]}
 */
export function nodeinfoDiscoveryUrls(host) {
  const clean = String(host)
    .replace(/^https?:\/\//, '')
    .split('/')[0];
  return [
    `https://${clean}/.well-known/nodeinfo`,
    `https://${clean}/nodeinfo/2.1`,
    `https://${clean}/nodeinfo/2.0`,
    `https://${clean}/nodeinfo/1.0`,
  ];
}

/**
 * Extract the canonical nodeinfo href from a .well-known/nodeinfo index.
 * @param {object|string} index — parsed index JSON or raw text
 * @returns {{ href: string|null, versions: string[] }}
 */
export function parseNodeinfoIndex(index) {
  let obj = index;
  if (typeof index === 'string') {
    try {
      obj = JSON.parse(index);
    } catch {
      return { href: null, versions: [] };
    }
  }
  const links = obj && Array.isArray(obj.links) ? obj.links : [];
  const versions = links.map(l => l && l.rel).filter(Boolean);
  const preferred =
    links.find(l => /nodeinfo\/2\.1/.test(l.rel || '')) ||
    links.find(l => /nodeinfo\/2\.0/.test(l.rel || '')) ||
    links[0];
  return { href: (preferred && preferred.href) || null, versions };
}

/**
 * Parse a nodeinfo document into federation intelligence.
 * @param {object|string} doc — parsed nodeinfo or raw JSON text
 * @returns {{ valid: boolean, software: string, version: string, openRegistrations: boolean|null, usage: object, notes: string[] }}
 */
export function parseNodeinfo(doc) {
  const notes = [];
  let obj = doc;
  if (typeof doc === 'string') {
    try {
      obj = JSON.parse(doc);
    } catch {
      return {
        valid: false,
        software: 'unknown',
        version: '',
        openRegistrations: null,
        usage: {},
        notes: ['Not valid JSON'],
      };
    }
  }
  if (!obj || typeof obj !== 'object') {
    return {
      valid: false,
      software: 'unknown',
      version: '',
      openRegistrations: null,
      usage: {},
      notes: ['Empty document'],
    };
  }

  const software = (obj.software && obj.software.name) || 'unknown';
  const version = (obj.software && obj.software.version) || '';
  const openRegistrations =
    obj.openRegistrations === true ? true : obj.openRegistrations === false ? false : null;
  const usage = obj.usage && typeof obj.usage === 'object' ? obj.usage : {};

  if (software === 'unknown')
    notes.push('No software.name — document is not a real nodeinfo response');
  if (openRegistrations === true)
    notes.push('Open registrations enabled — account-creation surface available');
  if (obj.protocols && Array.isArray(obj.protocols))
    notes.push(`Federation protocols: ${obj.protocols.join(', ')}`);

  return { valid: software !== 'unknown', software, version, openRegistrations, usage, notes };
}

export const NODEINFO_MINER = { nodeinfoDiscoveryUrls, parseNodeinfoIndex, parseNodeinfo };
export default NODEINFO_MINER;
