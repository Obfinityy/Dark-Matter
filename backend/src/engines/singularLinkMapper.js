/**
 * singularLinkMapper.js — Singular attribution-link mapping.
 *
 * Idea 00881: map Singular attribution links found on a target's own pages,
 * marketing creatives, and app-store metadata into campaign attribution data.
 *
 * Singular (singular.net) links carry attribution parameters (campaign, channel,
 * partner, af-style click IDs) on branded or custom short domains. The module
 * scans HTML/text for Singular link candidates, classifies their type
 * (click, impression, deeplink-passthrough, branded short), and parses the
 * attribution payload — all locally, no network calls.
 */

/** Known Singular-owned and commonly used attribution host patterns. */
export const SINGULAR_HOST_PATTERNS = [
  /(?:^|\.)singular\.net$/i,
  /(?:^|\.)singular\.link$/i,
  /(?:^|\.)snglr\.link$/i,
  /[.-]singular[.-]/i,
];

/** Branded attribution-domain suffixes occasionally used with Singular. */
export const BRANDED_LINK_SUFFIXES = ['.lnk.to', '.onelink.me', '.app.link'];

/**
 * Extract raw URL strings from arbitrary text (href attributes, JS literals,
 * plain text).
 * @param {string} text
 * @returns {string[]}
 */
export function extractUrls(text = '') {
  const out = [];
  const re = /href\s*=\s*["']([^"']+)["']|["'](https?:\/\/[^"'\s<>{}|^`]+)["']|(https?:\/\/[^\s<>"'{}\|^`\\]+)/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const url = m[1] || m[2] || m[3];
    if (url && /^https?:\/\//i.test(url)) out.push(url);
  }
  return [...new Set(out)];
}

/**
 * Decide whether a host looks like a Singular attribution host.
 * @param {string} host
 * @returns {boolean}
 */
export function isSingularHost(host = '') {
  const h = String(host).toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
  return SINGULAR_HOST_PATTERNS.some(p => p.test(h));
}

/**
 * Parse Singular attribution query parameters into a structured payload.
 * @param {string} url
 * @returns {{campaign: string|null, channel: string|null, partner: string|null, adSet: string|null, creative: string|null, clickId: string|null, raw: object}}
 */
export function parseSingularPayload(url = '') {
  let params;
  try {
    params = new URL(url).searchParams;
  } catch {
    params = new URLSearchParams();
  }
  const get = (...names) => {
    for (const n of names) {
      const v = params.get(n);
      if (v !== null) return v;
    }
    return null;
  };
  const raw = {};
  for (const [k, v] of params) raw[k] = v;
  return {
    campaign: get('campaign', 'campaign_id', 'a_cid', 'c'),
    channel: get('channel', 'media_source', 'pid', 'a_ch'),
    partner: get('partner', 'af_prt', 'a_partner'),
    adSet: get('adset', 'ad_set', 'a_adset'),
    creative: get('creative', 'ad', 'a_creative'),
    clickId: get('click_id', 'af_clickid', 'a_clickid', 'clickid'),
    raw,
  };
}

/**
 * Classify a Singular URL by its path shape.
 * @param {string} url
 * @returns {'click'|'impression'|'deeplink'|'branded-short'|'other'}
 */
export function classifySingularLink(url = '') {
  const lower = String(url).toLowerCase();
  if (/\/(click|clk|a\/click)\b/.test(lower)) return 'click';
  if (/\/(impression|imp|view)\b/.test(lower)) return 'impression';
  if (/\bdeeplink=|\baf_dp=|\bdeep_link=/.test(lower)) return 'deeplink';
  if (BRANDED_LINK_SUFFIXES.some(s => lower.includes(s))) return 'branded-short';
  return 'other';
}

/**
 * Map Singular attribution links found in HTML/text to campaign data.
 * @param {string} html - Page HTML, creative text, or metadata blob.
 * @param {{brandedDomains?: string[]}} [options]
 * @returns {{links: object[], stats: object}}
 */
export function mapSingularLinks(html = '', options = {}) {
  const { brandedDomains = [] } = options;
  const urls = extractUrls(String(html));
  const links = [];
  for (const url of urls) {
    let host = '';
    try {
      host = new URL(url).hostname;
    } catch {
      continue;
    }
    const branded = brandedDomains.some(d => host.toLowerCase().endsWith(String(d).toLowerCase()));
    if (!isSingularHost(host) && !branded) continue;
    links.push({
      kind: 'singular-attribution-link',
      url,
      host,
      type: classifySingularLink(url),
      branded,
      payload: parseSingularPayload(url),
    });
  }
  const byType = {};
  const campaigns = new Set();
  const channels = new Set();
  for (const l of links) {
    byType[l.type] = (byType[l.type] || 0) + 1;
    if (l.payload.campaign) campaigns.add(l.payload.campaign);
    if (l.payload.channel) channels.add(l.payload.channel);
  }
  return {
    links,
    stats: {
      total: links.length,
      byType,
      distinctCampaigns: campaigns.size,
      distinctChannels: channels.size,
      campaigns: [...campaigns].slice(0, 50),
      channels: [...channels].slice(0, 50),
    },
  };
}

/**
 * Build a report finding from a Singular link map.
 * @param {ReturnType<typeof mapSingularLinks>} result
 */
export function singularFinding(result) {
  const { stats } = result;
  return {
    title: `Singular attribution mapping — ${stats.total} link(s), ${stats.distinctCampaigns} campaign(s)`,
    severity: 'Info',
    confidence: stats.total > 0 ? 'high' : 'medium',
    stats,
    evidence:
      `${stats.total} Singular attribution link(s) mapped; ` +
      `campaigns observed: ${stats.campaigns.slice(0, 5).join(', ') || 'none'}.`,
  };
}

export const SINGULAR_LINK_MAPPER = {
  extractUrls,
  isSingularHost,
  parseSingularPayload,
  classifySingularLink,
  mapSingularLinks,
  singularFinding,
};
export default SINGULAR_LINK_MAPPER;
