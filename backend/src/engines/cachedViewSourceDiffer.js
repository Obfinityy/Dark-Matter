/**
 * cachedViewSourceDiffer.js — cached-view source diffing.
 *
 * Idea 00892: diff cached vs live pages to find recently removed links.
 *
 * No network calls: the module takes two operator-supplied HTML strings (a
 * cached copy and the live copy of the same page) and reports the links that
 * vanished or appeared. Vanished links point at removed endpoints, assets or
 * integrations worth mapping during authorized recon.
 */

/**
 * Extract every URL-valued link from HTML: href, src, srcset, action, data-*.
 * @param {string} html
 * @returns {Map<string, {kinds: Set<string>, contexts: string[]}>} url → usage detail
 */
export function extractPageLinks(html = '') {
  const text = String(html);
  const links = new Map();
  const add = (url, kind, context) => {
    if (!url) return;
    const u = url.trim().replace(/&amp;/g, '&');
    if (!u || u.startsWith('#') || u.startsWith('data:') || u.startsWith('javascript:')) return;
    if (!links.has(u)) links.set(u, { kinds: new Set(), contexts: [] });
    const entry = links.get(u);
    entry.kinds.add(kind);
    if (context && entry.contexts.length < 3 && !entry.contexts.includes(context)) {
      entry.contexts.push(context);
    }
  };
  for (const m of text.matchAll(/<a\b[^>]*?\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]{0,120}?)<\/a>/gi)) {
    const label = m[2].replace(/<[^>]*>/g, '').trim().slice(0, 60);
    add(m[1], 'anchor', label || null);
  }
  for (const [re, kind] of [
    [/<script\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi, 'script'],
    [/<link\b[^>]*?\bhref\s*=\s*["']([^"']+)["']/gi, 'stylesheet'],
    [/<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi, 'image'],
    [/<source\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi, 'media'],
    [/<form\b[^>]*?\baction\s*=\s*["']([^"']+)["']/gi, 'form'],
    [/<iframe\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi, 'iframe'],
  ]) {
    for (const m of text.matchAll(re)) add(m[1], kind, null);
  }
  for (const m of text.matchAll(/\bsrcset\s*=\s*["']([^"']+)["']/gi)) {
    for (const part of m[1].split(',')) add(part.trim().split(/\s+/)[0], 'srcset', null);
  }
  for (const m of text.matchAll(/\b(?:data-src|data-href|data-url|data-endpoint)\s*=\s*["']([^"']+)["']/gi)) {
    add(m[1], 'data-attr', null);
  }
  return links;
}

/**
 * Compare cached vs live link sets.
 * @param {Map} cachedLinks
 * @param {Map} liveLinks
 * @returns {{removed: object[], added: object[], kept: number}}
 */
export function diffLinkSets(cachedLinks, liveLinks) {
  const removed = [];
  const added = [];
  for (const [url, detail] of cachedLinks) {
    if (!liveLinks.has(url)) {
      removed.push({ url, kinds: [...detail.kinds], contexts: detail.contexts });
    }
  }
  for (const [url, detail] of liveLinks) {
    if (!cachedLinks.has(url)) {
      added.push({ url, kinds: [...detail.kinds], contexts: detail.contexts });
    }
  }
  let kept = 0;
  for (const url of cachedLinks.keys()) if (liveLinks.has(url)) kept++;
  removed.sort((a, b) => a.url.localeCompare(b.url));
  added.sort((a, b) => a.url.localeCompare(b.url));
  return { removed, added, kept };
}

/** Rough classifier for a removed/added URL, to prioritise review. */
function classifyUrl(url) {
  const u = url.toLowerCase();
  if (/\.(js|mjs)(\?|$)/.test(u)) return 'script-asset';
  if (/\.(css)(\?|$)/.test(u)) return 'style-asset';
  if (/\.(png|jpe?g|gif|svg|webp|ico)(\?|$)/.test(u)) return 'image-asset';
  if (/\/(api|graphql|rest|v\d+)\//.test(u)) return 'api-endpoint';
  if (/wp-(content|admin|includes)/.test(u)) return 'cms-asset';
  if (/^https?:\/\//.test(u)) return 'external-link';
  return 'internal-link';
}

/**
 * Full diff between a cached page and the live page.
 * @param {string} cachedHtml
 * @param {string} liveHtml
 * @param {{baseUrl?: string}} [options]
 */
export function diffCachedVsLive(cachedHtml = '', liveHtml = '', options = {}) {
  const cachedLinks = extractPageLinks(cachedHtml);
  const liveLinks = extractPageLinks(liveHtml);
  const { removed, added, kept } = diffLinkSets(cachedLinks, liveLinks);
  const enrich = list => list.map(e => ({ ...e, class: classifyUrl(e.url) }));
  return {
    removed: enrich(removed),
    added: enrich(added),
    stats: {
      cachedLinks: cachedLinks.size,
      liveLinks: liveLinks.size,
      kept,
      removed: removed.length,
      added: added.length,
      removedByClass: countBy(enrich(removed).map(e => e.class)),
    },
    baseUrl: options.baseUrl || null,
  };
}

function countBy(classes) {
  const counts = {};
  for (const c of classes) counts[c] = (counts[c] || 0) + 1;
  return counts;
}

/**
 * Build a report finding from the diff result.
 * @param {ReturnType<typeof diffCachedVsLive>} result
 */
export function cachedViewDiffFinding(result) {
  return {
    title: `Cached-view source diffing — ${result.stats.removed} removed link(s), ${result.stats.added} added`,
    severity: result.stats.removed > 0 ? 'Low' : 'Info',
    confidence: 'high',
    stats: result.stats,
    topRemoved: result.removed.slice(0, 15),
    topAdded: result.added.slice(0, 15),
    evidence:
      `Cached copy had ${result.stats.cachedLinks} link(s), live copy has ` +
      `${result.stats.liveLinks}; ${result.stats.removed} no longer appear.`,
  };
}

export const CACHED_VIEW_SOURCE_DIFFER = {
  extractPageLinks,
  diffLinkSets,
  diffCachedVsLive,
  cachedViewDiffFinding,
};
export default CACHED_VIEW_SOURCE_DIFFER;
