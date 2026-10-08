/**
 * hostMetaMiner.js — host-meta XRD mining (idea 00117).
 *
 * host-meta documents (XRD XML) describe a domain's services; their LRDD
 * (Link-based Resource Descriptor Discovery) templates reveal the hosts
 * handling user profiles and other resources. This module parses the XML.
 */

const LINK_RE = /<Link\b[^>]*>/gi;
const ATTR_RE = /(\w+)\s*=\s*"([^"]*)"/g;
const TEMPLATE_TOKEN_RE = /\{[^}]*\}/;

function attrsOf(linkTag) {
  const attrs = {};
  let m;
  while ((m = ATTR_RE.exec(linkTag)) !== null) {
    attrs[m[1].toLowerCase()] = m[2];
  }
  return attrs;
}

function hostOf(value) {
  try {
    return new URL(String(value).replace(TEMPLATE_TOKEN_RE, 'user')).hostname;
  } catch {
    return null;
  }
}

/**
 * Parse a host-meta XRD document into links and template-derived hosts.
 * @param {string} xml — raw host-meta XRD body
 * @returns {{ valid: boolean, links: { rel, type, href, template, host }[], uniqueHosts: string[], lrddTemplates: string[], notes: string[] }}
 */
export function parseHostMeta(xml = '') {
  const notes = [];
  if (typeof xml !== 'string' || !/<XRD\b/i.test(xml)) {
    return {
      valid: false,
      links: [],
      uniqueHosts: [],
      lrddTemplates: [],
      notes: ['Not an XRD document'],
    };
  }

  const links = [];
  const unique = new Set();
  const lrddTemplates = [];
  let tag;
  while ((tag = LINK_RE.exec(xml)) !== null) {
    const attrs = attrsOf(tag[0]);
    const rel = attrs.rel || '';
    const type = attrs.type || '';
    const href = attrs.href || null;
    const template = attrs.template || null;

    let host = null;
    if (href) host = hostOf(href);
    else if (template) host = hostOf(template);

    if (/lrdd/i.test(rel) && template && !lrddTemplates.includes(template)) {
      lrddTemplates.push(template);
    }
    if (host) unique.add(host);

    links.push({ rel, type, href, template, host });
  }

  if (links.length === 0) notes.push('XRD present but no Link elements found');
  if (lrddTemplates.length > 0) {
    notes.push(
      `LRDD template(s) found — profile-service host(s) resolvable by substituting the subject: ${[...unique].join(', ')}`
    );
  }

  return { valid: true, links, uniqueHosts: [...unique], lrddTemplates, notes };
}

/**
 * Canonical host-meta URL for a domain.
 * @param {string} domain — e.g. "example.com"
 * @returns {string}
 */
export function hostMetaUrl(domain) {
  const clean = String(domain)
    .replace(/^https?:\/\//, '')
    .split('/')[0];
  return `https://${clean}/.well-known/host-meta`;
}

export const HOSTMETA_MINER = { parseHostMeta, hostMetaUrl };
export default HOSTMETA_MINER;
