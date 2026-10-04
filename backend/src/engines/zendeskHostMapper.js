/**
 * zendeskHostMapper.js — Zendesk help-center host mapping engine.
 *
 * Maps *.zendesk.com help-center subdomains to the owning organisation using
 * only passive signals:
 *  - DNS CNAME records: support.example.com -> example.zendesk.com
 *  - Help-center HTML: <title>, help center JSON API, branding text,
 *    favicon/asset hosts, embedded guide IDs.
 *
 * Helps an authorized hunter confirm which support portals belong to the
 * in-scope organisation before testing them.
 */

const ZENDESK_HOST_RE = /^([a-z0-9-]+)\.zendesk\.com$/i;
const ZENDESK_CNAME_TARGET_RE = /(^|\.)zendesk\.com$/i;

/** @param {string} hostname */
export function parseZendeskHost(hostname = '') {
  const m = String(hostname).toLowerCase().replace(/\.$/, '').match(ZENDESK_HOST_RE);
  return m ? { subdomain: m[1], host: m[0] } : null;
}

/**
 * Map CNAME records to Zendesk help-center tenants.
 * @param {{name: string, target: string}[]} cnameRecords
 * @returns {{alias: string, zendeskSubdomain: string, zendeskHost: string}[]}
 */
export function mapZendeskCnames(cnameRecords = []) {
  const out = [];
  for (const rec of cnameRecords || []) {
    if (!rec || !rec.name || !rec.target) continue;
    const target = String(rec.target).toLowerCase().replace(/\.$/, '');
    if (!ZENDESK_CNAME_TARGET_RE.test(target)) continue;
    const parsed = parseZendeskHost(target);
    out.push({
      alias: String(rec.name).toLowerCase().replace(/\.$/, ''),
      zendeskSubdomain: parsed ? parsed.subdomain : target,
      zendeskHost: target,
    });
  }
  return out;
}

/**
 * Extract organisation branding signals from help-center HTML.
 * @param {string} html help-center page HTML
 * @returns {{title: string|null, brandName: string|null, zendeskHost: string|null, guideId: string|null}}
 */
export function extractHelpCenterBranding(html = '') {
  const text = String(html || '');
  const titleM = text.match(/<title[^>]*>([^<]{1,200})<\/title>/i);
  const hostM = text.match(/https?:\/\/([a-z0-9-]+\.zendesk\.com)/i);
  const guideM = text.match(/["']guide["']\s*:\s*\{[^}]*["']id["']\s*:\s*(\d+)/i) ||
    text.match(/help_center[^"']*["']id["']\s*:\s*(\d+)/i);
  let brandName = null;
  if (titleM) {
    // "Acme Help Center" / "Acme Support — Help Center"
    brandName = titleM[1].replace(/(help\s*center|support|knowledge\s*base)/gi, '').replace(/[-|–—:()[\]]/g, ' ').trim() || null;
  }
  return {
    title: titleM ? titleM[1].trim() : null,
    brandName,
    zendeskHost: hostM ? hostM[1].toLowerCase() : null,
    guideId: guideM ? guideM[1] : null,
  };
}

/**
 * Extract Zendesk host references from arbitrary text/HTML (links, assets, embeds).
 * @param {string} text
 * @returns {string[]} unique zendesk.com hostnames
 */
export function extractZendeskReferences(text = '') {
  const hosts = new Set();
  const re = /https?:\/\/([a-z0-9-]+\.zendesk\.com)/gi;
  let m;
  while ((m = re.exec(String(text))) !== null) hosts.add(m[1].toLowerCase());
  return [...hosts];
}

/**
 * Full mapping pass.
 * @param {{cnames: {name:string,target:string}[], htmlPages: string[], orgKeywords?: string[]}} input
 * @returns {{tenants: object[], branding: object[], orgMatchScore: number}}
 */
export function mapZendeskFootprint({ cnames = [], htmlPages = [], orgKeywords = [] } = {}) {
  const tenants = mapZendeskCnames(cnames);
  const branding = (htmlPages || []).map(extractHelpCenterBranding);
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
