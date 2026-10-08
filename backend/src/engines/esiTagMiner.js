/**
 * esiTagMiner.js — edge-include (ESI) tag mining.
 *
 * Idea 00896: mine ESI tags for backend fragment URLs.
 *
 * No network calls: the module scans operator-supplied HTML for Edge Side
 * Includes tags (esi:include, esi:remove, esi:try/attempt/except, esi:vars,
 * esi:choose). Each fragment's src is resolved against a base URL, producing
 * a map of backend fragment endpoints that the edge layer assembles —
 * valuable authorized-recon surface on the target's own pages.
 */

const ESI_INCLUDE_RE = /<esi:include\b([^>]*?)\/?>/gi;
const ESI_REMOVE_RE = /<esi:remove>([\s\S]*?)<\/esi:remove>/gi;
const ESI_TRY_RE = /<esi:try>([\s\S]*?)<\/esi:try>/gi;
const ESI_VARS_RE = /<esi:vars>([\s\S]*?)<\/esi:vars>/gi;
const ESI_COMMENT_RE = /<!--\s*esi\b([\s\S]*?)-->/gi;
const ATTR_RE = /(\w[\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;

/** Parse a tag's attributes into an object. */
function parseAttrs(attrString = '') {
  const attrs = {};
  for (const m of String(attrString).matchAll(ATTR_RE)) {
    attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return attrs;
}

/** Resolve a possibly-relative fragment URL against the base URL. */
function resolveUrl(src, baseUrl) {
  try {
    return new URL(src, baseUrl || undefined).toString();
  } catch {
    return src;
  }
}

/** Detect ESI variable placeholders like $(QUERY_STRING) in a value. */
function findEsiVars(value = '') {
  return [...String(value).matchAll(/\$\(([^)]+)\)/g)].map(m => m[1]);
}

/**
 * Extract ESI tags from HTML.
 * @param {string} html
 * @param {string} [baseUrl] - Used to resolve fragment src attributes.
 * @returns {{includes: object[], removes: object[], tries: object[], varsBlocks: object[], esiComments: number}}
 */
export function extractEsiTags(html = '', baseUrl = '') {
  const text = String(html);
  const includes = [];
  for (const m of text.matchAll(ESI_INCLUDE_RE)) {
    const attrs = parseAttrs(m[1]);
    const src = attrs.src || '';
    includes.push({
      tag: 'esi:include',
      src,
      resolved: src ? resolveUrl(src, baseUrl) : null,
      alt: attrs.alt ? resolveUrl(attrs.alt, baseUrl) : null,
      onerror: attrs.onerror || null,
      dca: attrs.dca || null,
      esiVars: [...findEsiVars(src), ...findEsiVars(attrs.alt || '')],
    });
  }
  const removes = [];
  for (const m of text.matchAll(ESI_REMOVE_RE)) {
    removes.push({ tag: 'esi:remove', contentPreview: m[1].trim().slice(0, 120) || null });
  }
  const tries = [];
  for (const m of text.matchAll(ESI_TRY_RE)) {
    const attempt = m[1].match(/<esi:attempt>([\s\S]*?)<\/esi:attempt>/i);
    const except = m[1].match(/<esi:except>([\s\S]*?)<\/esi:except>/i);
    tries.push({
      tag: 'esi:try',
      attempt: attempt ? attempt[1].trim().slice(0, 120) : null,
      except: except ? except[1].trim().slice(0, 120) : null,
    });
  }
  const varsBlocks = [];
  for (const m of text.matchAll(ESI_VARS_RE)) {
    varsBlocks.push({ tag: 'esi:vars', body: m[1].trim().slice(0, 200) });
  }
  let esiComments = 0;
  for (const _ of text.matchAll(ESI_COMMENT_RE)) esiComments++;
  return { includes, removes, tries, varsBlocks, esiComments };
}

/**
 * Build the fragment URL map from extracted ESI tags.
 * @param {ReturnType<typeof extractEsiTags>} tags
 */
export function mapEsiFragments(tags) {
  const fragments = tags.includes
    .filter(i => i.resolved)
    .map(i => ({
      fragmentUrl: i.resolved,
      raw: i.src,
      onerror: i.onerror,
      hasVars: i.esiVars.length > 0,
      vars: i.esiVars,
    }));
  const seen = new Set();
  const unique = fragments.filter(f => {
    if (seen.has(f.fragmentUrl)) return false;
    seen.add(f.fragmentUrl);
    return true;
  });
  const hosts = new Set();
  for (const f of unique) {
    try { hosts.add(new URL(f.fragmentUrl).hostname.toLowerCase()); } catch { /* skip */ }
  }
  return {
    fragments: unique,
    stats: {
      fragments: unique.length,
      withDynamicVars: unique.filter(f => f.hasVars).length,
      uniqueHosts: [...hosts],
      removes: tags.removes.length,
      tries: tags.tries.length,
      esiComments: tags.esiComments,
    },
  };
}

/**
 * Build a report finding from the mining result.
 * @param {ReturnType<typeof mapEsiFragments>} result
 */
export function esiFinding(result) {
  return {
    title: `ESI tag mining — ${result.stats.fragments} backend fragment URL(s) exposed`,
    severity: result.stats.fragments > 0 ? 'Low' : 'Info',
    confidence: result.stats.fragments >= 3 ? 'high' : 'medium',
    stats: result.stats,
    fragments: result.fragments.slice(0, 20),
    evidence:
      `${result.stats.fragments} unique esi:include fragment URL(s); ` +
      `${result.stats.withDynamicVars} carry ESI variable placeholders.`,
  };
}

export const ESI_TAG_MINER = {
  extractEsiTags,
  mapEsiFragments,
  esiFinding,
};
export default ESI_TAG_MINER;
