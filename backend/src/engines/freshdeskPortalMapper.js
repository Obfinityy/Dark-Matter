/**
 * freshdeskPortalMapper.js — Freshdesk portal host mapping engine.
 *
 * Maps *.freshdesk.com portals to the owning organisation using passive data:
 *  - DNS CNAME records: support.example.com -> example.freshdesk.com
 *  - Portal HTML branding: Freshworks widget, portal title, company footer,
 *    favicon, custom CSS asset hosts.
 *
 * Confirms which Freshdesk portals belong to the in-scope organisation.
 */

const FRESHDESK_HOST_RE = /^([a-z0-9-]+)\.freshdesk\.com$/i;
const FRESHDESK_CNAME_TARGET_RE = /(^|\.)freshdesk\.com$/i;
const FRESHWORKS_CDN_RES = /(^|\.)(freshworks\.com|freshdesk\.com|freshworksapi\.com)$/i;

/** @param {string} hostname */
export function parseFreshdeskHost(hostname = '') {
  const m = String(hostname).toLowerCase().replace(/\.$/, '').match(FRESHDESK_HOST_RE);
  return m ? { subdomain: m[1], host: m[0] } : null;
}

/**
 * Map CNAME records to Freshdesk tenants.
 * @param {{name: string, target: string}[]} cnameRecords
 * @returns {{alias: string, freshdeskSubdomain: string, freshdeskHost: string}[]}
 */
export function mapFreshdeskCnames(cnameRecords = []) {
  const out = [];
  for (const rec of cnameRecords || []) {
    if (!rec || !rec.name || !rec.target) continue;
    const target = String(rec.target).toLowerCase().replace(/\.$/, '');
    if (!FRESHDESK_CNAME_TARGET_RE.test(target)) continue;
    const parsed = parseFreshdeskHost(target);
    out.push({
      alias: String(rec.name).toLowerCase().replace(/\.$/, ''),
      freshdeskSubdomain: parsed ? parsed.subdomain : target,
      freshdeskHost: target,
    });
  }
  return out;
}

/**
 * Extract branding from Freshdesk portal HTML.
 * @param {string} html portal page HTML
 * @returns {{title: string|null, brandName: string|null, freshdeskHost: string|null, usesFreshworksWidget: boolean}}
 */
export function extractPortalBranding(html = '') {
  const text = String(html || '');
  const titleM = text.match(/<title[^>]*>([^<]{1,200})<\/title>/i);
  const hostM = text.match(/https?:\/\/([a-z0-9-]+\.freshdesk\.com)/i);
  const usesFreshworksWidget = /freshworks[_-]?widget|fw-widget|freshdesk\.com\/support\/widget/i.test(text);
  let brandName = null;
  if (titleM) {
    brandName = titleM[1]
      .replace(/(support|help\s*center|knowledge\s*base|portal|helpdesk)/gi, '')
      .replace(/[-|–—:()[\]]/g, ' ').trim() || null;
  }
  return {
    title: titleM ? titleM[1].trim() : null,
    brandName,
    freshdeskHost: hostM ? hostM[1].toLowerCase() : null,
    usesFreshworksWidget,
  };
}

/**
 * Extract Freshdesk/Freshworks hostnames referenced in text.
 * @param {string} text
 * @returns {string[]} unique hostnames
 */
export function extractFreshdeskReferences(text = '') {
  const hosts = new Set();
  const re = /\b([a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:freshdesk\.com|freshworks\.com))\b/gi;
  let m;
  while ((m = re.exec(String(text))) !== null) hosts.add(m[1].toLowerCase());
  return [...hosts];
}

/**
 * Full mapping pass.
 * @param {{cnames: {name:string,target:string}[], htmlPages: string[], orgKeywords?: string[]}} input
 * @returns {{tenants: object[], branding: object[], orgMatchScore: number}}
 */
export function mapFreshdeskFootprint({ cnames = [], htmlPages = [], orgKeywords = [] } = {}) {
  const tenants = mapFreshdeskCnames(cnames);
  const branding = (htmlPages || []).map(extractPortalBranding);
  const keywords = (orgKeywords || []).map((k) => String(k).toLowerCase());
  let orgMatchScore = 0;
  if (keywords.length) {
    for (const b of branding) {
      const hay = `${b.title || ''} ${b.brandName || ''}`.toLowerCase();
      if (keywords.some((k) => k && hay.includes(k))) orgMatchScore += 1;
    }
  }
  return { tenants, branding, orgMatchScore };
}
