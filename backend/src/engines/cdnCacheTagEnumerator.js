/**
 * cdnCacheTagEnumerator.js — CDN cache-tag enumeration.
 *
 * Idea 00899: enumerate cache tags that reveal content groupings.
 *
 * No network calls: the module extracts Cache-Tag / Edge-Cache-Tag /
 * Akamai-Cache-Tag headers from operator-supplied responses and groups URLs
 * by tag, revealing how the target organises its cacheable content
 * (sections, tenants, campaigns). Shared tags across unrelated URLs are
 * the interesting authorized-recon signal.
 */

const TAG_HEADER_NAMES = ['cache-tag', 'cache-tags', 'edge-cache-tag', 'akamai-cache-tag'];

/**
 * Extract cache tags from a response-header object.
 * @param {object} headers
 * @returns {string[]}
 */
export function parseCacheTags(headers = {}) {
  const tags = [];
  for (const [name, value] of Object.entries(headers)) {
    if (TAG_HEADER_NAMES.includes(String(name).toLowerCase())) {
      const raw = Array.isArray(value) ? value.join(',') : String(value);
      for (const part of raw.split(/[,;\s]+/)) {
        const t = part.trim();
        if (t) tags.push(t);
      }
    }
  }
  return [...new Set(tags)];
}

/**
 * Group URLs by their cache tags.
 * @param {{url: string, headers: object}[]} responses
 */
export function groupUrlsByTag(responses = []) {
  const tagToUrls = new Map();
  const urlToTags = new Map();
  for (const { url = '', headers = {} } of responses) {
    const tags = parseCacheTags(headers);
    urlToTags.set(url, tags);
    for (const tag of tags) {
      if (!tagToUrls.has(tag)) tagToUrls.set(tag, new Set());
      tagToUrls.get(tag).add(url);
    }
  }
  const groups = [...tagToUrls.entries()]
    .map(([tag, urls]) => ({
      tag,
      urlCount: urls.size,
      urls: [...urls].sort().slice(0, 25),
    }))
    .sort((a, b) => b.urlCount - a.urlCount);
  return { groups, urlToTags };
}

/**
 * Infer likely group semantics from tag names.
 * @param {string} tag
 */
export function inferTagSemantics(tag = '') {
  const t = String(tag).toLowerCase();
  if (/^(section|category|cat)-/.test(t)) return 'content-section';
  if (/^(tenant|site|customer|account)-/.test(t)) return 'tenant-grouping';
  if (/^(campaign|promo|sale|offer)-/.test(t)) return 'campaign-grouping';
  if (/^(product|sku|item)-/.test(t)) return 'product-grouping';
  if (/^(page|template|layout)-/.test(t)) return 'template-grouping';
  if (/^(lang|locale|region)-/.test(t)) return 'locale-grouping';
  if (/^(author|user)-/.test(t)) return 'author-grouping';
  if (/^(api|endpoint)-/.test(t)) return 'api-grouping';
  if (/^static/.test(t)) return 'static-assets';
  return 'uncategorized';
}

/**
 * Full enumeration pass over responses.
 * @param {{url: string, headers: object}[]} responses
 */
export function enumerateCacheTags(responses = []) {
  const { groups, urlToTags } = groupUrlsByTag(responses);
  const enriched = groups.map(g => ({
    ...g,
    semantics: inferTagSemantics(g.tag),
  }));
  const shared = enriched.filter(g => g.urlCount > 1);
  const bySemantics = {};
  for (const g of enriched) bySemantics[g.semantics] = (bySemantics[g.semantics] || 0) + 1;
  const untagged = [...urlToTags.entries()].filter(([, tags]) => tags.length === 0).map(([url]) => url);
  return {
    groups: enriched,
    sharedGroups: shared,
    untaggedUrls: untagged,
    stats: {
      responses: responses.length,
      tagged: responses.length - untagged.length,
      uniqueTags: enriched.length,
      sharedTags: shared.length,
      bySemantics,
    },
  };
}

/**
 * Build a report finding from the enumeration result.
 * @param {ReturnType<typeof enumerateCacheTags>} result
 */
export function cacheTagFinding(result) {
  return {
    title: `Cache-tag enumeration — ${result.stats.uniqueTags} tag(s) group ${result.stats.tagged} URL(s)`,
    severity: 'Info',
    confidence: result.stats.uniqueTags >= 3 ? 'high' : 'medium',
    stats: result.stats,
    topGroups: result.groups.slice(0, 15).map(g => ({
      tag: g.tag,
      semantics: g.semantics,
      urlCount: g.urlCount,
    })),
    evidence:
      `${result.stats.uniqueTags} unique cache tag(s); ` +
      `${result.stats.sharedTags} tag(s) are shared across multiple URLs.`,
  };
}

export const CDN_CACHE_TAG_ENUMERATOR = {
  parseCacheTags,
  groupUrlsByTag,
  inferTagSemantics,
  enumerateCacheTags,
  cacheTagFinding,
};
export default CDN_CACHE_TAG_ENUMERATOR;
