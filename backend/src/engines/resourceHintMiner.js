/**
 * resourceHintMiner.js — Resource-hint, embedded-markup and DOM-data URL mining.
 *
 * Analyzes ALREADY-FETCHED content (HTTP response headers, HTML source) to
 * surface URLs and hosts a target discloses on its own. This covers the routes
 * static crawlers miss: resource hints browsers use to pre-connect or
 * pre-render, scripts tucked inside inline SVG/MathML, unrendered <template>
 * markup, noscript fallbacks, and data-* attributes that JS routers read at
 * runtime.
 *
 * Defensive/product framing: content-analysis utilities for an authorized
 * bug-bounty agent. These functions never perform network requests — the
 * caller supplies the header value or HTML string. They emit no exploit
 * payloads, only discovered URL/host inventories with the relation context
 * needed for triage.
 *
 * Ideas covered: 751 Link-header relation mapping · 752 DNS-prefetch hint
 * harvesting · 753 Preconnect hint analysis · 754 Prerender hint URL
 * extraction · 755 Resource-hint priority mapping · 756 Inline SVG script
 * mining · 757 MathML endpoint references · 758 Template-tag content
 * extraction · 759 Noscript-fallback link harvesting · 760 Data-attribute URL
 * mining.
 */

/**
 * Parse an RFC 8288 (formerly 5988) HTTP Link header value into structured
 * link objects.
 *
 * Example input:
 *   '</app.js>; rel=preload; as=script, <https://cdn.example.com>; rel=preconnect'
 *
 * @param {string} linkHeaderValue raw Link header value (may contain commas)
 * @returns {Array<{url: string, rels: string[], params: Record<string, string|boolean>}>}
 */
export function mapLinkHeaderRelations(linkHeaderValue = '') {
  const text = String(linkHeaderValue || '').trim();
  if (!text) return [];

  // Split on commas that are not inside quoted parameter values.
  const parts = [];
  let current = '';
  let inQuote = false;
  for (const ch of text) {
    if (ch === '"') inQuote = !inQuote;
    if (ch === ',' && !inQuote) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current);

  const seen = new Set();
  const links = [];
  for (const part of parts) {
    const match = /^\s*<([^>]+)>\s*(;.*)?$/s.exec(part);
    if (!match) continue;
    const url = match[1].trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);

    const params = {};
    const rels = [];
    const rest = (match[2] || '').split(';');
    for (const seg of rest) {
      const [rawKey, ...rawVal] = seg.split('=');
      const key = (rawKey || '').trim().toLowerCase();
      if (!key) continue;
      const value = rawVal.join('=').trim().replace(/^"|"$/g, '');
      if (key === 'rel') {
        for (const rel of value.split(/\s+/)) {
          const r = rel.trim().toLowerCase();
          if (r) rels.push(r);
        }
      } else {
        params[key] = value === '' ? true : value;
      }
    }
    links.push({ url, rels, params });
  }
  return links;
}

/**
 * Extract a normalized hostname from a URL or protocol-relative reference.
 * @param {string} url
 * @returns {string|null} hostname, or null when it cannot be derived
 */
function toHost(url) {
  const v = String(url || '').trim();
  if (!v) return null;
  try {
    const normalized = v.startsWith('//') ? `https:${v}` : v;
    return new URL(normalized).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Collect all <link rel="dns-prefetch" href="..."> hints in an HTML document.
 *
 * dns-prefetch hints name third-party origins the page intends to contact,
 * giving a ready-made third-party host list for authorized asset scoping.
 *
 * @param {string} html full or partial HTML source
 * @returns {string[]} unique hostnames in order of first appearance
 */
export function harvestDnsPrefetchHints(html = '') {
  return harvestLinkHints(html, 'dns-prefetch').hosts;
}

/**
 * Low-level helper: collect <link> hints for one or more rel values.
 * @param {string} html
 * @param {...string} wantedRels
 * @returns {{hints: Array<{url: string, host: string|null, crossorigin: boolean}>, hosts: string[]}}
 */
function harvestLinkHints(html, ...wantedRels) {
  const source = String(html || '');
  const hints = [];
  const hosts = [];
  const seenHosts = new Set();
  const re = /<link\b[^>]*>/gi;
  let m;
  while ((m = re.exec(source)) !== null) {
    const tag = m[0];
    const relMatch = /rel\s*=\s*["']?([^"'\s>]+)["']?/i.exec(tag);
    if (!relMatch) continue;
    const rels = relMatch[1].toLowerCase().split(/\s+/);
    if (!wantedRels.some(w => rels.includes(w.toLowerCase()))) continue;
    const hrefMatch = /href\s*=\s*["']([^"']+)["']/i.exec(tag);
    const url = hrefMatch ? hrefMatch[1].trim() : '';
    if (!url) continue;
    const crossorigin = /\bcrossorigin\b/i.test(tag);
    const host = toHost(url);
    hints.push({ url, host, crossorigin });
    if (host && !seenHosts.has(host)) {
      seenHosts.add(host);
      hosts.push(host);
    }
  }
  return { hints, hosts };
}

/**
 * Analyze <link rel="preconnect" href="..."> hints.
 *
 * Preconnect hints point at origins the browser connects to early — usually
 * performance-critical third-party services (CDNs, APIs, analytics). The
 * crossorigin attribute marks origins that carry authenticated (CORS) traffic,
 * which deserve earlier scrutiny in an authorized hunt.
 *
 * @param {string} html full or partial HTML source
 * @returns {{origins: Array<{host: string|null, url: string, crossorigin: boolean}>, critical: string[]}}
 *          critical = hostnames marked with crossorigin, unique
 */
export function analyzePreconnectHints(html = '') {
  const { hints } = harvestLinkHints(html, 'preconnect');
  const origins = [];
  const critical = [];
  const seenCritical = new Set();
  for (const h of hints) {
    origins.push({ host: h.host, url: h.url, crossorigin: h.crossorigin });
    if (h.crossorigin && h.host && !seenCritical.has(h.host)) {
      seenCritical.add(h.host);
      critical.push(h.host);
    }
  }
  return { origins, critical };
}

/**
 * Extract <link rel="prerender" href="..."> hints.
 *
 * Prerender hints name routes the site believes the visitor is about to take
 * — a high-priority crawl list of routes that matter to the application.
 *
 * @param {string} html full or partial HTML source
 * @returns {string[]} unique prerendered URLs in order of first appearance
 */
export function extractPrerenderUrls(html = '') {
  const { hints } = harvestLinkHints(html, 'prerender', 'next', 'prefetch', 'modulepreload');
  const seen = new Set();
  const urls = [];
  for (const h of hints) {
    if (!seen.has(h.url)) {
      seen.add(h.url);
      urls.push(h.url);
    }
  }
  return urls;
}

/** Hint priority order: earliest-in-render wins. */
const HINT_PRIORITY = [
  'prerender',
  'preconnect',
  'preload',
  'modulepreload',
  'prefetch',
  'dns-prefetch',
];

/**
 * Map every resource hint in the HTML to a priority-ordered critical-path view.
 *
 * The output orders hints from highest to lowest priority (prerender first,
 * dns-prefetch last), grouped per hint so an agent can see which hosts feed
 * the critical rendering path before it spends time on low-priority origins.
 *
 * @param {string} html full or partial HTML source
 * @returns {{byPriority: Array<{priority: string, url: string, host: string|null, crossorigin: boolean}>, hosts: string[], criticalHosts: string[]}}
 */
export function mapResourceHintPriority(html = '') {
  const byPriority = [];
  for (const priority of HINT_PRIORITY) {
    const { hints } = harvestLinkHints(html, priority);
    for (const h of hints) {
      byPriority.push({ priority, url: h.url, host: h.host, crossorigin: h.crossorigin });
    }
  }
  const hosts = [];
  const criticalHosts = [];
  const seen = new Set();
  const seenCritical = new Set();
  for (const h of byPriority) {
    if (!h.host || seen.has(h.host)) continue;
    seen.add(h.host);
    hosts.push(h.host);
    // Hosts behind prerender/preconnect hints sit on the critical path.
    if ((h.priority === 'prerender' || h.priority === 'preconnect') && !seenCritical.has(h.host)) {
      seenCritical.add(h.host);
      criticalHosts.push(h.host);
    }
  }
  return { byPriority, hosts, criticalHosts };
}

/**
 * Scan inline <svg> blocks for embedded <script> elements and xlink:href /
 * href URL references.
 *
 * Inline SVGs sometimes carry scripting (event handlers, <script> children)
 * or reference external assets via xlink:href — both are URL sources and, for
 * scripts, review targets in an authorized hunt.
 *
 * @param {string} html full or partial HTML source
 * @returns {{svgs: number, scripts: Array<{index: number, code: string}>, hrefs: string[]}}
 */
export function mineInlineSvg(html = '') {
  const source = String(html || '');
  const scripts = [];
  const hrefs = [];
  const seenHrefs = new Set();
  let svgCount = 0;
  const svgRe = /<svg\b[^>]*>([\s\S]*?)<\/svg>/gi;
  let m;
  while ((m = svgRe.exec(source)) !== null) {
    const index = svgCount++;
    const inner = m[1] || '';

    // Embedded scripts
    const scriptRe = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
    let sm;
    while ((sm = scriptRe.exec(inner)) !== null) {
      const code = (sm[1] || '').trim();
      if (code) scripts.push({ index, code });
    }

    // xlink:href and plain href references
    const hrefRe = /(?:xlink:href|href)\s*=\s*["']([^"']+)["']/gi;
    let hm;
    while ((hm = hrefRe.exec(inner)) !== null) {
      const href = hm[1].trim();
      if (!href || href.startsWith('#') || seenHrefs.has(href)) continue;
      seenHrefs.add(href);
      hrefs.push(href);
    }
  }
  return { svgs: svgCount, scripts, hrefs };
}

/**
 * Check MathML blocks (<math>…</math>) for href references that point at
 * asset or endpoint hosts.
 *
 * MathML elements can carry href attributes; the referenced hosts extend the
 * asset inventory beyond the HTML link graph.
 *
 * @param {string} html full or partial HTML source
 * @returns {{blocks: number, hrefs: string[], hosts: string[]}}
 */
export function mineMathmlHrefs(html = '') {
  const source = String(html || '');
  const hrefs = [];
  const hosts = [];
  const seenHrefs = new Set();
  const seenHosts = new Set();
  let blocks = 0;
  const mathRe = /<math\b[^>]*>([\s\S]*?)<\/math>/gi;
  let m;
  while ((m = mathRe.exec(source)) !== null) {
    blocks++;
    const inner = m[1] || '';
    const hrefRe = /(?:xlink:href|href)\s*=\s*["']([^"']+)["']/gi;
    let hm;
    while ((hm = hrefRe.exec(inner)) !== null) {
      const href = hm[1].trim();
      if (!href || href.startsWith('#') || seenHrefs.has(href)) continue;
      seenHrefs.add(href);
      hrefs.push(href);
      const host = toHost(href);
      if (host && !seenHosts.has(host)) {
        seenHosts.add(host);
        hosts.push(host);
      }
    }
  }
  return { blocks, hrefs, hosts };
}

/**
 * Extract the contents of <template> tags.
 *
 * Templates hold unrendered markup — including routes, forms, and API URLs
 * that never appear in the visible DOM. Returns both the raw markup and any
 * URL-like values found inside it.
 *
 * @param {string} html full or partial HTML source
 * @returns {{templates: number, contents: string[], urls: string[]}}
 */
export function extractTemplateContent(html = '') {
  const source = String(html || '');
  const contents = [];
  const urls = [];
  const seenUrls = new Set();
  const tplRe = /<template\b[^>]*>([\s\S]*?)<\/template>/gi;
  let m;
  while ((m = tplRe.exec(source)) !== null) {
    const content = (m[1] || '').trim();
    if (!content) continue;
    contents.push(content);

    // URLs inside attributes (href, src, action, data-*, xlink)
    const attrRe = /\b(?:href|src|action|xlink:href|data-[a-zA-Z0-9_-]+)\s*=\s*["']([^"']+)["']/gi;
    let am;
    while ((am = attrRe.exec(content)) !== null) {
      const value = am[1].trim();
      if (!looksLikeUrl(value) || seenUrls.has(value)) continue;
      seenUrls.add(value);
      urls.push(value);
    }
  }
  return { templates: contents.length, contents, urls };
}

/**
 * Harvest links from <noscript> fallbacks.
 *
 * Noscript blocks duplicate JS-driven routes as plain links (meta refresh,
 * plain anchors), exposing routes that only exist client-side otherwise.
 *
 * @param {string} html full or partial HTML source
 * @returns {string[]} unique href/action/refresh URLs in order of appearance
 */
export function harvestNoscriptLinks(html = '') {
  const source = String(html || '');
  const urls = [];
  const seen = new Set();
  const nsRe = /<noscript\b[^>]*>([\s\S]*?)<\/noscript>/gi;
  let m;
  while ((m = nsRe.exec(source)) !== null) {
    const inner = m[1] || '';

    // Anchor / link / form targets
    const attrRe = /\b(?:href|action)\s*=\s*["']([^"']+)["']/gi;
    let am;
    while ((am = attrRe.exec(inner)) !== null) {
      const value = am[1].trim();
      if (!value || seen.has(value)) continue;
      seen.add(value);
      urls.push(value);
    }

    // Meta refresh inside noscript
    const refreshRe =
      /<meta\b[^>]*http-equiv\s*=\s*["']?refresh["']?[^>]*content\s*=\s*["'][^"']*?url\s*=\s*([^"';]+)/gi;
    let rm;
    while ((rm = refreshRe.exec(inner)) !== null) {
      const value = rm[1].trim();
      if (!value || seen.has(value)) continue;
      seen.add(value);
      urls.push(value);
    }
  }
  return urls;
}

/**
 * Conservative check: is this string plausibly a URL or site-relative path?
 * @param {string} value
 * @returns {boolean}
 */
function looksLikeUrl(value) {
  const v = String(value || '').trim();
  if (!v || v.startsWith('#') || v.startsWith('javascript:') || v.startsWith('data:')) return false;
  if (/^(https?:)?\/\//i.test(v)) return true; // absolute or protocol-relative
  if (v.startsWith('/')) return true; // site-relative path
  if (/^[a-zA-Z0-9][\w.-]*\.[a-z]{2,}(\/|$|\?|#)/i.test(v)) return true; // bare host
  if (/\.([a-z]{2,6}|js|json|php|aspx?|html?)$/i.test(v) || v.includes('?')) return true;
  return false;
}

/**
 * Mine URLs from data-* attributes (data-href, data-url, data-src,
 * data-api-endpoint, …).
 *
 * Client-side routers and components stash real route/endpoint URLs in
 * data-* attributes; collecting them surfaces routes a DOM snapshot misses.
 *
 * @param {string} html full or partial HTML source
 * @returns {{attributes: Array<{name: string, value: string}>, urls: string[]}}
 */
export function mineDataAttributeUrls(html = '') {
  const source = String(html || '');
  const attributes = [];
  const urls = [];
  const seenUrls = new Set();
  const re = /\bdata-([a-zA-Z0-9_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
  let m;
  while ((m = re.exec(source)) !== null) {
    const name = `data-${m[1]}`.toLowerCase();
    const value = (m[2] ?? m[3] ?? m[4] ?? '').trim();
    if (!value) continue;
    attributes.push({ name, value });
    if (looksLikeUrl(value) && !seenUrls.has(value)) {
      seenUrls.add(value);
      urls.push(value);
    }
  }
  return { attributes, urls };
}

/**
 * Run every miner over the supplied content and return a unified inventory.
 * Convenience entry point for the hunt pipeline; every sub-result is also
 * exported individually for callers that need one slice.
 *
 * @param {{html?: string, linkHeader?: string}} input
 * @returns {{linkHeader: Array, dnsPrefetchHosts: string[], preconnect: Object, prerenderUrls: string[], hintPriority: Object, inlineSvg: Object, mathml: Object, templates: Object, noscriptLinks: string[], dataAttributes: Object}}
 */
export function mineAllResourceHints({ html = '', linkHeader = '' } = {}) {
  const inlineSvg = mineInlineSvg(html);
  const mathml = mineMathmlHrefs(html);
  const templates = extractTemplateContent(html);
  const dataAttributes = mineDataAttributeUrls(html);
  return {
    linkHeader: mapLinkHeaderRelations(linkHeader),
    dnsPrefetchHosts: harvestDnsPrefetchHints(html),
    preconnect: analyzePreconnectHints(html),
    prerenderUrls: extractPrerenderUrls(html),
    hintPriority: mapResourceHintPriority(html),
    inlineSvg,
    mathml,
    templates,
    noscriptLinks: harvestNoscriptLinks(html),
    dataAttributes,
  };
}

export const RESOURCE_HINT_MINER = {
  mapLinkHeaderRelations,
  harvestDnsPrefetchHints,
  analyzePreconnectHints,
  extractPrerenderUrls,
  mapResourceHintPriority,
  mineInlineSvg,
  mineMathmlHrefs,
  extractTemplateContent,
  harvestNoscriptLinks,
  mineDataAttributeUrls,
  mineAllResourceHints,
};
export default RESOURCE_HINT_MINER;
