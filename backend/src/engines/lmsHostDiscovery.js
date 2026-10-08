/**
 * lmsHostDiscovery.js — LMS platform host discovery engine.
 *
 * Finds Teachable / Thinkific / Kajabi course hosts tied to an organisation's
 * training brand from passive signals:
 *  - Canonical host patterns: *.teachable.com, *.thinkific.com,
 *    *.mykajabi.com, *.kajabi.com
 *  - DNS CNAME delegations from org-owned aliases (courses.example.com)
 *  - Page HTML branding: school name, platform asset hosts, embed snippets.
 *
 * Pure host-discovery for an authorized hunter mapping the target's
 * learning-platform footprint.
 */

const LMS_PLATFORMS = [
  {
    name: 'Teachable',
    hostRe: /^([a-z0-9-]+)\.teachable\.com$/i,
    cnameRe: /(^|\.)teachable\.com$/i,
  },
  {
    name: 'Thinkific',
    hostRe: /^([a-z0-9-]+)\.thinkific\.com$/i,
    cnameRe: /(^|\.)thinkific\.com$/i,
  },
  {
    name: 'Kajabi',
    hostRe: /^([a-z0-9-]+)\.(mykajabi\.com|kajabi\.com)$/i,
    cnameRe: /(^|\.)(mykajabi\.com|kajabi\.com)$/i,
  },
];

/**
 * Classify an LMS hostname.
 * @param {string} hostname
 * @returns {{platform: string, school: string, host: string}|null}
 */
export function classifyLmsHost(hostname = '') {
  const h = String(hostname).toLowerCase().replace(/\.$/, '');
  for (const p of LMS_PLATFORMS) {
    const m = h.match(p.hostRe);
    if (m) return { platform: p.name, school: m[1], host: h };
  }
  return null;
}

/**
 * Map CNAME records to LMS tenants.
 * @param {{name: string, target: string}[]} cnameRecords
 * @returns {{alias: string, platform: string, school: string, host: string}[]}
 */
export function mapLmsCnames(cnameRecords = []) {
  const out = [];
  for (const rec of cnameRecords || []) {
    if (!rec || !rec.name || !rec.target) continue;
    const target = String(rec.target).toLowerCase().replace(/\.$/, '');
    const p = LMS_PLATFORMS.find(pl => pl.cnameRe.test(target));
    if (!p) continue;
    const classified = classifyLmsHost(target);
    out.push({
      alias: String(rec.name).toLowerCase().replace(/\.$/, ''),
      platform: p.name,
      school: classified ? classified.school : target,
      host: target,
    });
  }
  return out;
}

/**
 * Extract LMS references and school branding from page HTML.
 * @param {string} html page source
 * @returns {{platform: string, school: string|null, host: string|null, title: string|null}[]}
 */
export function extractLmsBranding(html = '') {
  const text = String(html || '');
  const out = [];
  const seen = new Set();
  const hostRe =
    /https?:\/\/([a-z0-9-]+\.(?:teachable\.com|thinkific\.com|mykajabi\.com|kajabi\.com))/gi;
  let m;
  while ((m = hostRe.exec(text)) !== null) {
    const host = m[1].toLowerCase();
    if (seen.has(host)) continue;
    seen.add(host);
    const classified = classifyLmsHost(host);
    const titleM = text.match(/<title[^>]*>([^<]{1,200})<\/title>/i);
    out.push({
      platform: classified ? classified.platform : 'unknown',
      school: classified ? classified.school : null,
      host,
      title: titleM ? titleM[1].trim() : null,
    });
  }
  return out;
}

/**
 * Full discovery pass.
 * @param {{cnames: {name:string,target:string}[], htmlPages: string[], orgKeywords?: string[]}} input
 * @returns {{tenants: object[], branding: object[], orgMatchScore: number}}
 */
export function discoverLmsFootprint({ cnames = [], htmlPages = [], orgKeywords = [] } = {}) {
  const tenants = mapLmsCnames(cnames);
  const branding = (htmlPages || []).flatMap(extractLmsBranding);
  const keywords = (orgKeywords || []).map(k => String(k).toLowerCase());
  let orgMatchScore = 0;
  if (keywords.length) {
    for (const b of branding) {
      const hay = `${b.title || ''} ${b.school || ''}`.toLowerCase();
      if (keywords.some(k => k && hay.includes(k))) orgMatchScore += 1;
    }
  }
  return { tenants, branding, orgMatchScore };
}
