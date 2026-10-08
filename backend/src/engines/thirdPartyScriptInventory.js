/**
 * thirdPartyScriptInventory.js — Third-party script inventory engine.
 *
 * Builds a per-page inventory of third-party JavaScript dependencies to map
 * the supply-chain surface of a target. Each entry is classified by vendor
 * category so a supply-chain compromise (e.g. a hijacked CDN account) can be
 * traced to the pages it affects.
 *
 * Input is observed HTML from pages the agent is authorized to test — the
 * engine performs no fetching itself.
 */

const KNOWN_CDN_HOSTS = [
  'cdnjs.cloudflare.com',
  'cdn.jsdelivr.net',
  'unpkg.com',
  'ajax.googleapis.com',
  'stackpath.bootstrapcdn.com',
  'maxcdn.bootstrapcdn.com',
  'cdn.tailwindcss.com',
];

const KNOWN_ANALYTICS_HOSTS = [
  'google-analytics.com',
  'googletagmanager.com',
  'analytics.tiktok.com',
  'connect.facebook.net',
  'static.hotjar.com',
  'cdn.segment.com',
  'bat.bing.com',
  'snap.licdn.com',
];

const KNOWN_ADS_HOSTS = [
  'doubleclick.net',
  'googlesyndication.com',
  'adservice.google.com',
  'amazon-adsystem.com',
  'ads.yahoo.com',
  'criteo.com',
];

const KNOWN_TAG_MANAGERS = [
  'googletagmanager.com',
  'assets.adobedtm.com',
  'tags.tiqcdn.com',
  'cdn.tagcommander.com',
  'bat.bing.com',
];

const KNOWN_SOCIAL_HOSTS = [
  'platform.twitter.com',
  'connect.facebook.net',
  'apis.google.com',
  'platform.linkedin.com',
];

function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Categorize a script URL into a vendor category.
 * @param {string} url absolute script URL
 * @returns {string} vendor category
 */
export function categorizeScript(url) {
  const host = hostOf(url);
  if (!host) return 'inline';
  if (KNOWN_CDN_HOSTS.includes(host)) return 'cdn-library';
  if (KNOWN_ANALYTICS_HOSTS.includes(host)) return 'analytics';
  if (KNOWN_ADS_HOSTS.includes(host)) return 'advertising';
  if (KNOWN_TAG_MANAGERS.includes(host)) return 'tag-manager';
  if (KNOWN_SOCIAL_HOSTS.includes(host)) return 'social-widget';
  return 'other-third-party';
}

/**
 * Inventory all third-party scripts on a page.
 * @param {string} pageUrl the page the HTML was observed on
 * @param {string} html page HTML
 * @returns {Array<{url: string|null, host: string, category: string, async: boolean, defer: boolean}>}
 */
export function inventoryPageScripts(pageUrl, html = '') {
  const pageHost = hostOf(pageUrl);
  const results = [];
  const seen = new Set();
  const tagRe = /<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi;
  const srcRe = /\bsrc\s*=\s*["']([^"']+)["']/i;
  let m;
  while ((m = tagRe.exec(html)) !== null) {
    const tag = m[0];
    const srcMatch = srcRe.exec(tag);
    let url = null;
    let host = '';
    let category = 'inline';
    if (srcMatch) {
      const raw = srcMatch[1].trim();
      try {
        url = new URL(raw, pageUrl).href;
      } catch {
        url = raw;
      }
      host = hostOf(url);
      category = host === pageHost ? 'first-party' : categorizeScript(url);
    }
    const key = url || `inline:${m[1].slice(0, 64)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({
      url,
      host: host || pageHost,
      category,
      async: /\basync\b/i.test(tag),
      defer: /\bdefer\b/i.test(tag),
    });
  }
  return results;
}

/**
 * Aggregate per-page inventories into a site-wide supply-chain map.
 * @param {Array<{page: string, scripts: Array}>} pageInventories
 * @returns {{vendors: object, pages: number, totalScripts: number}}
 */
export function buildSupplyChainMap(pageInventories = []) {
  const vendors = {};
  let totalScripts = 0;
  for (const { page, scripts } of pageInventories) {
    for (const s of scripts || []) {
      totalScripts += 1;
      const v = vendors[s.host] || {
        host: s.host,
        category: s.category,
        pages: [],
        scriptCount: 0,
      };
      if (!v.pages.includes(page)) v.pages.push(page);
      v.scriptCount += 1;
      vendors[s.host] = v;
    }
  }
  return {
    vendors,
    pages: pageInventories.length,
    totalScripts,
    thirdPartyHosts: Object.keys(vendors).length,
  };
}

export const THIRD_PARTY_SCRIPT_INVENTORY = {
  categorizeScript,
  inventoryPageScripts,
  buildSupplyChainMap,
};

export default THIRD_PARTY_SCRIPT_INVENTORY;
