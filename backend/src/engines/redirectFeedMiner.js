/**
 * redirectFeedMiner.js — Feed, sitemap, and redirect-chain analysis (ideas 791–800).
 *
 * Content endpoints (feeds, pingback endpoints, sitemap extensions) and
 * redirect/canonical chains make up a large part of a target's publicly
 * exposed surface. Each of these functions is PURE: it analyzes GIVEN data
 * (HTML strings, XML text, header text, or redirect-chain records) and
 * returns an inventory. No network fetching, no exploit payloads.
 *
 * Defensive framing: these are inventory/auditing utilities for an
 * authorized bug-bounty agent — mapping content endpoints and redirect
 * behaviour as part of a permitted crawl, never for abuse.
 */

/**
 * Extract a hostname from a URL string, gracefully.
 * @param {string} url URL string
 * @param {string} base optional base for relative URLs
 * @returns {string} hostname or '' when unparseable
 */
export function safeHost(url, base = '') {
  try {
    const parsed = new URL(url, base || undefined);
    return parsed.host || '';
  } catch {
    return '';
  }
}

/**
 * Extract attribute name/value pairs from an HTML tag opening string.
 * @param {string} tag opening tag text including < and >
 * @returns {Record<string, string>} lowercase attribute names to values
 */
export function tagAttributes(tag = '') {
  const attrs = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let m;
  while ((m = re.exec(tag)) !== null) {
    attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return attrs;
}

/* ------------------------------------------------------------------ */
/* 791 — Pingback endpoint detection                                   */
/* ------------------------------------------------------------------ */

/**
 * Detect an XML-RPC pingback endpoint from a page's HTML and its raw
 * response-header text (X-Pingback-style hints). Used for blog/CMS
 * attack-surface inventory: pingback endpoints are content endpoints
 * worth logging during authorized hunts.
 * @param {string} html Page HTML
 * @param {string} headersText Raw response-header text (may be empty)
 * @param {string} pageUrl Page URL, used to resolve relative hrefs
 * @returns {{ found: boolean, endpoint: string|null, source: string|null }}
 */
export function detectPingbackEndpoint(html = '', headersText = '', pageUrl = '') {
  const text = String(html);

  // 1. <link rel="pingback" href="...">
  const linkRe = /<link\b[^>]*>/gi;
  let m;
  while ((m = linkRe.exec(text)) !== null) {
    const attrs = tagAttributes(m[0]);
    if (attrs.rel && attrs.rel.toLowerCase() === 'pingback' && attrs.href) {
      let endpoint = attrs.href;
      try {
        endpoint = new URL(attrs.href, pageUrl || undefined).href;
      } catch {
        /* keep raw value */
      }
      return { found: true, endpoint, source: 'link-rel-pingback' };
    }
  }

  // 2. X-Pingback (or X-Pingback-*) header hint.
  const headerRe = /^x-pingback(?:-\w+)*\s*:\s*(.+)$/gim;
  const headerMatch = headerRe.exec(String(headersText));
  if (headerMatch) {
    const value = headerMatch[1].trim();
    let endpoint = value;
    try {
      endpoint = new URL(value, pageUrl || undefined).href;
    } catch {
      /* keep raw value */
    }
    return { found: true, endpoint, source: 'x-pingback-header' };
  }

  return { found: false, endpoint: null, source: null };
}

/* ------------------------------------------------------------------ */
/* 792 — RSS feed URL harvesting                                       */
/* ------------------------------------------------------------------ */

/**
 * Harvest RSS/Atom feed URLs from HTML <link> autodiscovery elements and
 * common feed-path anchor conventions.
 * @param {string} html Page HTML
 * @param {string} pageUrl Page URL, used to resolve relative hrefs
 * @returns {{ url: string, type: string, title: string }[]} discovered feeds
 */
export function harvestFeedUrls(html = '', pageUrl = '') {
  const text = String(html);
  const found = new Map();

  const push = (url, type, title) => {
    if (!url) return;
    let absolute = url;
    try {
      absolute = new URL(url, pageUrl || undefined).href;
    } catch {
      /* keep raw value */
    }
    if (!found.has(absolute)) found.set(absolute, { url: absolute, type, title });
  };

  // Autodiscovery <link> tags: alternate + rss/atom feed mime types.
  const linkRe = /<link\b[^>]*>/gi;
  let m;
  while ((m = linkRe.exec(text)) !== null) {
    const attrs = tagAttributes(m[0]);
    const type = (attrs.type || '').toLowerCase();
    const rel = (attrs.rel || '').toLowerCase();
    if (rel.includes('alternate') && /rss|atom|feed/i.test(type) && attrs.href) {
      const kind = /atom/i.test(type) ? 'atom' : /json/i.test(type) ? 'jsonfeed' : 'rss';
      push(attrs.href, kind, attrs.title || '');
    }
  }

  // Anchor conventions: <a href="...feed..."> / "rss".
  const anchorRe = /<a\b[^>]*>/gi;
  while ((m = anchorRe.exec(text)) !== null) {
    const attrs = tagAttributes(m[0]);
    if (attrs.href && /feed|rss|atom/i.test(attrs.href)) {
      push(attrs.href, 'rss', attrs.title || '');
    }
  }

  return [...found.values()];
}

/* ------------------------------------------------------------------ */
/* 793 — Feed autodiscovery link parsing + generator host attribution  */
/* ------------------------------------------------------------------ */

/**
 * Parse <link> feed autodiscovery elements and attribute each feed's
 * generator/owner host — useful for mapping which hosts serve a site's
 * content API.
 * @param {string} html Page HTML
 * @param {string} pageUrl Page URL, used to resolve relative hrefs
 * @returns {{ url: string, type: string, title: string, feedHost: string, sameHostAsPage: boolean }[]}
 */
export function parseAutodiscoveryLinks(html = '', pageUrl = '') {
  const feeds = harvestFeedUrls(html, pageUrl);
  const pageHost = safeHost(pageUrl);
  return feeds.map(feed => {
    const feedHost = safeHost(feed.url);
    return {
      ...feed,
      feedHost,
      sameHostAsPage: pageHost !== '' && feedHost !== '' && feedHost === pageHost,
    };
  });
}

/* ------------------------------------------------------------------ */
/* 794 — JSON Feed endpoint mapping                                    */
/* ------------------------------------------------------------------ */

/**
 * Map JSON Feed endpoints (type="application/feed+json") as content-API
 * candidates, since they are machine-readable endpoints worth auditing.
 * @param {string} html Page HTML
 * @param {string} pageUrl Page URL, used to resolve relative hrefs
 * @returns {{ url: string, title: string, host: string, type: 'jsonfeed' }[]}
 */
export function mapJsonFeedEndpoints(html = '', pageUrl = '') {
  const text = String(html);
  const out = [];
  const seen = new Set();
  const linkRe = /<link\b[^>]*>/gi;
  let m;
  while ((m = linkRe.exec(text)) !== null) {
    const attrs = tagAttributes(m[0]);
    const type = (attrs.type || '').toLowerCase();
    if (type === 'application/feed+json' && attrs.href) {
      let absolute = attrs.href;
      try {
        absolute = new URL(attrs.href, pageUrl || undefined).href;
      } catch {
        /* keep raw value */
      }
      if (seen.has(absolute)) continue;
      seen.add(absolute);
      out.push({
        url: absolute,
        title: attrs.title || '',
        host: safeHost(absolute),
        type: 'jsonfeed',
      });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 795 — Sitemap-image extension mining                                 */
/* ------------------------------------------------------------------ */

/**
 * Parse sitemap <image:image> extension entries from given XML text and
 * map each page URL to its image locations (for media-host inventory).
 * @param {string} xml Sitemap XML text
 * @returns {{ pageUrl: string, images: { loc: string, title: string, caption: string }[] }[]}
 */
export function parseSitemapImageEntries(xml = '') {
  const text = String(xml);
  const out = [];
  const urlRe = /<url>([\s\S]*?)<\/url>/gi;
  let u;
  while ((u = urlRe.exec(text)) !== null) {
    const inner = u[1];
    const locMatch = /<loc>([\s\S]*?)<\/loc>/i.exec(inner);
    const pageUrl = (locMatch && locMatch[1].trim()) || '';
    const images = [];
    const imgRe = /<image:image>([\s\S]*?)<\/image:image>/gi;
    let im;
    while ((im = imgRe.exec(inner)) !== null) {
      const block = im[1];
      const get = tag => {
        const m2 = new RegExp(`<image:${tag}>([\\s\\S]*?)<\\/image:${tag}>`, 'i').exec(block);
        return m2 ? m2[1].trim() : '';
      };
      images.push({
        loc: get('loc'),
        title: get('title'),
        caption: get('caption'),
      });
    }
    if (pageUrl || images.length > 0) {
      out.push({ pageUrl, images });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 796 — Sitemap-video extension mining                                 */
/* ------------------------------------------------------------------ */

/**
 * Parse sitemap <video:video> extension entries from given XML text,
 * extracting title, thumbnail and player locations for video-platform
 * host inventory.
 * @param {string} xml Sitemap XML text
 * @returns {{ pageUrl: string, videos: { title: string, thumbnailLoc: string, playerLoc: string, duration: string }[] }[]}
 */
export function parseSitemapVideoEntries(xml = '') {
  const text = String(xml);
  const out = [];
  const urlRe = /<url>([\s\S]*?)<\/url>/gi;
  let u;
  while ((u = urlRe.exec(text)) !== null) {
    const inner = u[1];
    const locMatch = /<loc>([\s\S]*?)<\/loc>/i.exec(inner);
    const pageUrl = (locMatch && locMatch[1].trim()) || '';
    const videos = [];
    const vidRe = /<video:video>([\s\S]*?)<\/video:video>/gi;
    let v;
    while ((v = vidRe.exec(inner)) !== null) {
      const block = v[1];
      const get = tag => {
        const m2 = new RegExp(`<video:${tag}>([\\s\\S]*?)<\\/video:${tag}>`, 'i').exec(block);
        return m2 ? m2[1].trim() : '';
      };
      videos.push({
        title: get('title'),
        thumbnailLoc: get('thumbnail_loc'),
        playerLoc: get('player_loc'),
        duration: get('duration'),
      });
    }
    if (pageUrl || videos.length > 0) {
      out.push({ pageUrl, videos });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 797 — Sitemap-news extension mining                                  */
/* ------------------------------------------------------------------ */

/**
 * Parse sitemap <news:news> extension entries from given XML text,
 * extracting article title, publication date, and publication name to
 * derive article URL patterns.
 * @param {string} xml Sitemap XML text
 * @returns {{ pageUrl: string, articles: { title: string, publicationDate: string, publicationName: string, keywords: string }[] }[]}
 */
export function parseSitemapNewsEntries(xml = '') {
  const text = String(xml);
  const out = [];
  const urlRe = /<url>([\s\S]*?)<\/url>/gi;
  let u;
  while ((u = urlRe.exec(text)) !== null) {
    const inner = u[1];
    const locMatch = /<loc>([\s\S]*?)<\/loc>/i.exec(inner);
    const pageUrl = (locMatch && locMatch[1].trim()) || '';
    const articles = [];
    const newsRe = /<news:news>([\s\S]*?)<\/news:news>/gi;
    let n;
    while ((n = newsRe.exec(inner)) !== null) {
      const block = n[1];
      const get = tag => {
        const m2 = new RegExp(`<news:${tag}>([\\s\\S]*?)<\\/news:${tag}>`, 'i').exec(block);
        return m2 ? m2[1].trim() : '';
      };
      const pubMatch = /<news:publication>([\s\S]*?)<\/news:publication>/i.exec(block);
      let publicationName = '';
      if (pubMatch) {
        const nameMatch = /<news:name>([\s\S]*?)<\/news:name>/i.exec(pubMatch[1]);
        publicationName = nameMatch ? nameMatch[1].trim() : '';
      }
      articles.push({
        title: get('title'),
        publicationDate: get('publication_date'),
        publicationName,
        keywords: get('keywords'),
      });
    }
    if (pageUrl || articles.length > 0) {
      out.push({ pageUrl, articles });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 798 — Hreflang alternate mapping                                     */
/* ------------------------------------------------------------------ */

/**
 * Map hreflang alternate links (hreflang → href) to regional site
 * variants for multilingual/regional crawl-surface inventory.
 * @param {string} html Page HTML
 * @param {string} pageUrl Page URL, used to resolve relative hrefs
 * @returns {{ hreflang: string, url: string, host: string }[]} alternates
 */
export function mapHreflangAlternates(html = '', pageUrl = '') {
  const text = String(html);
  const out = [];
  const seen = new Set();
  const linkRe = /<link\b[^>]*>/gi;
  let m;
  while ((m = linkRe.exec(text)) !== null) {
    const attrs = tagAttributes(m[0]);
    const rel = (attrs.rel || '').toLowerCase();
    const hreflang = attrs.hreflang || '';
    if (rel.includes('alternate') && hreflang && attrs.href) {
      let absolute = attrs.href;
      try {
        absolute = new URL(attrs.href, pageUrl || undefined).href;
      } catch {
        /* keep raw value */
      }
      const key = `${hreflang.toLowerCase()}|${absolute}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        hreflang: hreflang.toLowerCase(),
        url: absolute,
        host: safeHost(absolute),
      });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 799 — Canonical-chain loop detection                                 */
/* ------------------------------------------------------------------ */

/**
 * Detect canonical chains and loops from a given list of { url, canonical }
 * records. Chains reveal duplicate deployments; loops indicate canonical
 * misconfiguration worth auditing.
 * @param {{ url: string, canonical?: string }[]} records page → canonical records
 * @returns {{ chains: string[][], loops: string[][] }}
 */
export function detectCanonicalChains(records = []) {
  const target = new Map();
  for (const r of records) {
    if (r && r.url) {
      target.set(r.url, r.canonical || r.url);
    }
  }

  const chains = [];
  const loops = [];
  const seenLoops = new Set();

  for (const start of target.keys()) {
    const chain = [start];
    const path = new Set([start]);
    let current = start;

    for (;;) {
      const next = target.get(current);
      if (!next || next === current) {
        chains.push(chain);
        break;
      }
      if (path.has(next)) {
        // Loop: report the cyclic segment.
        const loopStart = chain.indexOf(next);
        const loop = chain.slice(loopStart).concat(next);
        const key = [...new Set(loop)].sort().join('->');
        if (!seenLoops.has(key)) {
          seenLoops.add(key);
          loops.push(loop);
        }
        chains.push(chain);
        break;
      }
      path.add(next);
      chain.push(next);
      current = next;
      // Canonical for an unknown URL terminates the chain.
      if (!target.has(current)) {
        chains.push(chain);
        break;
      }
    }
  }

  return { chains, loops };
}

/* ------------------------------------------------------------------ */
/* 800 — Redirect-chain full mapping                                   */
/* ------------------------------------------------------------------ */

/**
 * Map a GIVEN redirect chain record (array of { url, status, location })
 * to the final host plus an intermediate-host summary. The caller has
 * already followed the chain; this function only inventories it.
 * @param {{ url: string, status?: number, location?: string }[]} chain
 *   Redirect hops in order, as recorded by the crawler.
 * @returns {{
 *   hops: number,
 *   finalUrl: string,
 *   finalHost: string,
 *   intermediateHosts: { host: string, hops: number }[],
 *   crossHost: boolean,
 *   loop: boolean
 * }}
 */
export function mapRedirectChain(chain = []) {
  const hops = Array.isArray(chain) ? chain : [];
  const intermediateHosts = [];
  const seenUrls = new Set();
  let loop = false;

  const finalUrl = hops.length > 0 ? String(hops[hops.length - 1].url || '') : '';
  const finalHost = safeHost(finalUrl);

  const hostCounts = new Map();
  const hostOrder = [];
  for (const hop of hops) {
    if (!hop || !hop.url) continue;
    const url = String(hop.url);
    if (seenUrls.has(url)) {
      loop = true;
      continue;
    }
    seenUrls.add(url);
    const host = safeHost(url);
    if (!host) continue;
    if (!hostCounts.has(host)) {
      hostCounts.set(host, 0);
      hostOrder.push(host);
    }
    hostCounts.set(host, hostCounts.get(host) + 1);
  }
  for (const host of hostOrder) {
    intermediateHosts.push({ host, hops: hostCounts.get(host) });
  }

  const distinctHosts = intermediateHosts.map(h => h.host);
  const crossHost =
    new Set(distinctHosts).size > 1 || (finalHost !== '' && !distinctHosts.includes(finalHost));

  return {
    hops: hops.length,
    finalUrl,
    finalHost,
    intermediateHosts,
    crossHost,
    loop,
  };
}

/* ------------------------------------------------------------------ */
/* Registry                                                             */
/* ------------------------------------------------------------------ */

/**
 * Registry: idea number → implementing function name. Must cover every
 * idea in the 791–800 range with zero skips.
 */
export const REDIRECT_FEED_IDEAS = {
  791: 'detectPingbackEndpoint',
  792: 'harvestFeedUrls',
  793: 'parseAutodiscoveryLinks',
  794: 'mapJsonFeedEndpoints',
  795: 'parseSitemapImageEntries',
  796: 'parseSitemapVideoEntries',
  797: 'parseSitemapNewsEntries',
  798: 'mapHreflangAlternates',
  799: 'detectCanonicalChains',
  800: 'mapRedirectChain',
};

const IMPLEMENTATIONS = {
  detectPingbackEndpoint,
  harvestFeedUrls,
  parseAutodiscoveryLinks,
  mapJsonFeedEndpoints,
  parseSitemapImageEntries,
  parseSitemapVideoEntries,
  parseSitemapNewsEntries,
  mapHreflangAlternates,
  detectCanonicalChains,
  mapRedirectChain,
};

/**
 * Verify that every idea in the 791–800 range maps to a real exported
 * function. Returns { covered, total }; both must be 10.
 * @returns {{ covered: number, total: number }}
 */
export function registryComplete() {
  const ids = Object.keys(REDIRECT_FEED_IDEAS);
  const covered = ids.filter(
    id => typeof IMPLEMENTATIONS[REDIRECT_FEED_IDEAS[id]] === 'function'
  ).length;
  return { covered, total: ids.length };
}

export default {
  detectPingbackEndpoint,
  harvestFeedUrls,
  parseAutodiscoveryLinks,
  mapJsonFeedEndpoints,
  parseSitemapImageEntries,
  parseSitemapVideoEntries,
  parseSitemapNewsEntries,
  mapHreflangAlternates,
  detectCanonicalChains,
  mapRedirectChain,
  REDIRECT_FEED_IDEAS,
  registryComplete,
};
