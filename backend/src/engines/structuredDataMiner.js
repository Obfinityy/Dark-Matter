/**
 * structuredDataMiner.js — Structured-data (JSON-LD / HTML markup) surface mapper.
 *
 * Search engines reward pages that publish schema.org JSON-LD and special
 * markup (AMP, Instant Articles, Apple News). Those declarations often
 * disclose extra hosts, content APIs, analytics collectors, hiring portals,
 * event platforms and mobile content endpoints that never appear in the
 * visible page. This engine mines those declarations passively — no requests
 * are made — so an authorized hunter can enumerate in-scope surfaces and
 * confirm which hosts, APIs and content endpoints belong to the target
 * organisation before testing them.
 *
 * Inputs are JSON-LD blobs (object, array, JSON string, possibly wrapped in
 * `@graph`) or raw HTML source (for AMP `<link>` tags, `<amp-analytics>`
 * configs, Instant Article and Apple News markup).
 */

const SCHEMA_ORG_PREFIX = 'https://schema.org/';
const AMP_ANALYTICS_RE = /<amp-analytics\b([^>]*)>([\s\S]*?)<\/amp-analytics\s*>/gi;
const ANALYTICS_JSON_SCRIPT_RE = /<script\b[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script\s*>/i;
const LINK_TAG_RE = /<link\b[^>]*>/gi;
const META_TAG_RE = /<meta\b[^>]*>/gi;
const ANCHOR_TAG_RE = /<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi;

/**
 * Read a single HTML tag attribute (handles single/double quotes).
 * @param {string} tag
 * @param {string} name
 * @returns {string|null}
 */
function tagAttr(tag, name) {
  const m = String(tag).match(new RegExp(`${name}\\s*=\\s*(["'])([^"']*)\\1`, 'i'));
  return m ? m[2] : null;
}

/**
 * Normalize any JSON-LD input (object, array, JSON string, @graph wrapper)
 * into a flat list of node objects.
 * @param {object|object[]|string} input
 * @returns {object[]}
 */
function flattenJsonLd(input) {
  let data = input;
  if (typeof data === 'string') {
    const trimmed = data.trim();
    if (!trimmed) return [];
    try {
      data = JSON.parse(trimmed);
    } catch {
      return [];
    }
  }
  if (!data || typeof data !== 'object') return [];
  const roots = Array.isArray(data) ? data : [data];
  const out = [];
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (node['@graph']) visit(node['@graph']);
    out.push(node);
    for (const key of Object.keys(node)) visit(node[key]);
  };
  roots.forEach(visit);
  return out;
}

/**
 * All @type names declared by a node (handles string or array forms).
 * @param {object} node
 * @returns {string[]}
 */
function typeNames(node) {
  const t = node && node['@type'];
  const list = Array.isArray(t) ? t : [t];
  return list
    .filter((x) => typeof x === 'string')
    .map((x) => x.replace(SCHEMA_ORG_PREFIX, ''));
}

/**
 * @param {object} node
 * @param {string} type
 * @returns {boolean}
 */
function isType(node, type) {
  return typeNames(node).includes(type);
}

/**
 * Keep only nodes declaring one of the given types.
 * @param {object|object[]|string} jsonLd
 * @param {string[]} types
 * @returns {object[]}
 */
function nodesOfType(jsonLd, types) {
  return flattenJsonLd(jsonLd).filter((n) => types.some((t) => isType(n, t)));
}

/**
 * Extract the hostname from a URL string; null when not an absolute http(s) URL.
 * @param {string} url
 * @returns {string|null}
 */
function hostOf(url) {
  if (typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  try {
    return new URL(trimmed).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Pull a usable URL out of a schema value: plain string, {url}, {@id}, {sameAs}.
 * @param {*} value
 * @returns {string|null}
 */
function urlOf(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    for (const key of ['url', '@id', 'sameAs']) {
      const v = value[key];
      if (typeof v === 'string' && v) return v;
      if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
    }
  }
  return null;
}

/**
 * Deduplicate mapping entries by a key function.
 * @param {object[]} entries
 * @param {(e: object) => string} keyFn
 * @returns {object[]}
 */
function dedupe(entries, keyFn) {
  const seen = new Set();
  return entries.filter((e) => {
    const k = keyFn(e);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * Idea 861 — JobPosting schema host mapping.
 *
 * Extracts hiring URLs from JobPosting structured data: the posting URL,
 * the hiring organisation's site, direct-apply flags and contact/application
 * endpoints. Reveals job boards, ATS hosts (application tracking systems)
 * and career subdomains tied to the organisation.
 *
 * @param {object|object[]|string} jsonLd JSON-LD containing JobPosting nodes
 * @returns {{title: string|null, jobUrl: string|null, jobHost: string|null,
 *   hiringOrg: string|null, hiringOrgUrl: string|null, hiringOrgHost: string|null,
 *   directApply: boolean|null, contactUrls: string[]}[]}
 */
export function mapJobPostingHosts(jsonLd) {
  const nodes = nodesOfType(jsonLd, ['JobPosting']);
  const out = nodes.map((n) => {
    const jobUrl = urlOf(n.url);
    const org = n.hiringOrganization;
    const orgName = org && typeof org === 'object' ? (org.name || null) : (typeof org === 'string' ? org : null);
    const orgUrl = urlOf(org);
    const contacts = [];
    for (const key of ['applicationContact', 'jobLocation']) {
      const v = n[key];
      const items = Array.isArray(v) ? v : [v];
      for (const item of items) {
        const u = urlOf(item);
        if (u) contacts.push(u);
      }
    }
    return {
      title: typeof n.title === 'string' ? n.title : null,
      jobUrl: jobUrl || null,
      jobHost: hostOf(jobUrl),
      hiringOrg: orgName || null,
      hiringOrgUrl: orgUrl || null,
      hiringOrgHost: hostOf(orgUrl),
      directApply: typeof n.directApply === 'boolean' ? n.directApply : null,
      contactUrls: [...new Set(contacts)],
    };
  });
  return dedupe(out, (e) => `${e.jobUrl || ''}|${e.hiringOrgUrl || ''}`);
}

/**
 * Idea 862 — Event-schema venue mapping.
 *
 * Maps event URLs from Event structured data: the event page, venue/location
 * pages, organiser sites, ticket-offer endpoints and performer links.
 * Reveals ticketing platforms, venue sites and partner hosts.
 *
 * @param {object|object[]|string} jsonLd JSON-LD containing Event nodes
 * @returns {{name: string|null, eventUrl: string|null, eventHost: string|null,
 *   eventStatus: string|null, venues: {name: string|null, url: string|null, host: string|null}[],
 *   organizers: {name: string|null, url: string|null, host: string|null}[],
 *   offerUrls: string[], performerUrls: string[]}[]}
 */
export function mapEventVenues(jsonLd) {
  const nodes = nodesOfType(jsonLd, ['Event', 'MusicEvent', 'SportsEvent', 'BusinessEvent', 'SocialEvent']);
  const personOf = (v) => {
    const url = urlOf(v);
    const name = v && typeof v === 'object' && typeof v.name === 'string' ? v.name : null;
    return { name, url: url || null, host: hostOf(url) };
  };
  const out = nodes.map((n) => {
    const eventUrl = urlOf(n.url);
    const toList = (v) => (Array.isArray(v) ? v : [v]).filter(Boolean);
    const offerUrls = [...new Set(toList(n.offers).map(urlOf).filter(Boolean))];
    const performerUrls = [...new Set(toList(n.performer).map(urlOf).filter(Boolean))];
    return {
      name: typeof n.name === 'string' ? n.name : null,
      eventUrl: eventUrl || null,
      eventHost: hostOf(eventUrl),
      eventStatus: typeof n.eventStatus === 'string' ? n.eventStatus.replace(SCHEMA_ORG_PREFIX, '') : null,
      venues: dedupe(toList(n.location).map(personOf), (v) => v.url || v.name || ''),
      organizers: dedupe(toList(n.organizer).map(personOf), (o) => o.url || o.name || ''),
      offerUrls,
      performerUrls,
    };
  });
  return dedupe(out, (e) => `${e.eventUrl || ''}|${e.name || ''}`);
}

/**
 * Idea 863 — Product-schema offer mapping.
 *
 * Extracts offer and review URLs from Product structured data: the product
 * page, per-offer checkout/seller endpoints and review page URLs. Reveals
 * storefront hosts, marketplace sellers and review-platform integrations.
 *
 * @param {object|object[]|string} jsonLd JSON-LD containing Product nodes
 * @returns {{name: string|null, productUrl: string|null, productHost: string|null,
 *   offers: {url: string|null, host: string|null, price: string|null,
 *     priceCurrency: string|null, seller: string|null, sellerHost: string|null}[],
 *   reviewUrls: string[], aggregateRating: {ratingValue: string|null, reviewCount: string|null}|null}[]}
 */
export function mapProductOffers(jsonLd) {
  const nodes = nodesOfType(jsonLd, ['Product']);
  const out = nodes.map((n) => {
    const productUrl = urlOf(n.url);
    const toList = (v) => (Array.isArray(v) ? v : [v]).filter(Boolean);
    const offers = dedupe(
      toList(n.offers)
        .filter((o) => isType(o, 'Offer') || o.url || o.price)
        .map((o) => {
          const offerUrl = urlOf(o);
          const seller = o.seller;
          const sellerName = seller && typeof seller === 'object' && typeof seller.name === 'string' ? seller.name : null;
          const sellerUrl = urlOf(seller);
          return {
            url: offerUrl || null,
            host: hostOf(offerUrl),
            price: o.price != null ? String(o.price) : null,
            priceCurrency: typeof o.priceCurrency === 'string' ? o.priceCurrency : null,
            seller: sellerName,
            sellerHost: hostOf(sellerUrl),
          };
        }),
      (o) => o.url || `${o.sellerHost || ''}|${o.price || ''}`
    );
    const reviewUrls = [...new Set(toList(n.review).map(urlOf).filter(Boolean))];
    const agg = n.aggregateRating && typeof n.aggregateRating === 'object' ? n.aggregateRating : null;
    return {
      name: typeof n.name === 'string' ? n.name : null,
      productUrl: productUrl || null,
      productHost: hostOf(productUrl),
      offers,
      reviewUrls,
      aggregateRating: agg
        ? {
            ratingValue: agg.ratingValue != null ? String(agg.ratingValue) : null,
            reviewCount: agg.reviewCount != null ? String(agg.reviewCount) : null,
          }
        : null,
    };
  });
  return dedupe(out, (p) => `${p.productUrl || ''}|${p.name || ''}`);
}

/**
 * Idea 864 — Breadcrumb-schema path mining.
 *
 * Mines BreadcrumbList trails for site hierarchy: ordered position → name →
 * URL entries reveal section structure, category paths and deep-linked areas
 * (docs, support, account) worth mapping during recon.
 *
 * @param {object|object[]|string} jsonLd JSON-LD containing BreadcrumbList nodes
 * @returns {{trails: {items: {position: number|null, name: string|null, url: string|null,
 *   host: string|null, path: string|null}[], depth: number, root: string|null}[],
 *   maxDepth: number, uniqueHosts: string[]} }
 */
export function mineBreadcrumbPaths(jsonLd) {
  const nodes = nodesOfType(jsonLd, ['BreadcrumbList']);
  const trails = nodes.map((n) => {
    const raw = n.itemListElement;
    const items = (Array.isArray(raw) ? raw : [raw])
      .filter((i) => i && typeof i === 'object')
      .map((i) => {
        const item = i.item;
        const url = urlOf(item) || urlOf(i);
        const name = (item && typeof item === 'object' && typeof item.name === 'string' ? item.name : null) ||
          (typeof i.name === 'string' ? i.name : null);
        let path = null;
        if (url && /^https?:\/\//i.test(url)) {
          try {
            path = new URL(url).pathname || '/';
          } catch { /* ignore */ }
        }
        return {
          position: i.position != null ? Number(i.position) : null,
          name,
          url: url || null,
          host: hostOf(url),
          path,
        };
      })
      .sort((a, b) => (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER));
    const depth = items.length;
    const firstHost = items.find((i) => i.host)?.host || null;
    return { items, depth, root: firstHost };
  });
  const maxDepth = trails.reduce((m, t) => Math.max(m, t.depth), 0);
  const uniqueHosts = [...new Set(trails.flatMap((t) => t.items.map((i) => i.host)).filter(Boolean))];
  return { trails, maxDepth, uniqueHosts };
}

/**
 * Idea 865 — Sitelinks searchbox action mining.
 *
 * Extracts SearchAction targets from WebSite structured data (the sitelinks
 * search box). The `target` URL template discloses the site's search
 * endpoint and its query-parameter contract — a prime recon input.
 *
 * @param {object|object[]|string} jsonLd JSON-LD containing WebSite nodes
 * @returns {{siteUrl: string|null, siteHost: string|null, target: string|null,
 *   targetHost: string|null, queryInput: string|null, queryParam: string|null}[]}
 */
export function mineSitelinksSearchActions(jsonLd) {
  const nodes = nodesOfType(jsonLd, ['WebSite']);
  const out = [];
  for (const n of nodes) {
    const siteUrl = urlOf(n.url);
    const actions = n.potentialAction;
    const list = (Array.isArray(actions) ? actions : [actions]).filter(Boolean);
    for (const a of list) {
      if (!isType(a, 'SearchAction')) continue;
      const target = a.target;
      const targetStr = typeof target === 'string' ? target
        : (target && typeof target === 'object' && typeof target.urlTemplate === 'string' ? target.urlTemplate : null);
      const qi = a['query-input'];
      const queryInput = typeof qi === 'string' ? qi : null;
      let queryParam = null;
      if (targetStr) {
        const m = targetStr.match(/[?&]([^=&#{}]+)=\{[^}]*\}/) || targetStr.match(/\{([^}]*)\}/);
        queryParam = m ? m[1] : null;
      }
      out.push({
        siteUrl: siteUrl || null,
        siteHost: hostOf(siteUrl),
        target: targetStr || null,
        targetHost: hostOf(targetStr),
        queryInput,
        queryParam,
      });
    }
  }
  return dedupe(out, (e) => `${e.siteUrl || ''}|${e.target || ''}`);
}

/**
 * Idea 866 — Speakable-schema section mapping.
 *
 * Maps `speakable` specifications (CSS selectors / XPaths) to content
 * sections. Publishers mark high-value sections as speakable; the selectors
 * point at stable DOM landmarks that double as content-endpoint anchors.
 *
 * @param {object|object[]|string} jsonLd JSON-LD nodes carrying a `speakable` spec
 * @returns {{pageUrl: string|null, pageHost: string|null,
 *   selectors: {type: 'css'|'xpath', value: string}[]}[]}
 */
export function mapSpeakableSections(jsonLd) {
  const out = [];
  for (const n of flattenJsonLd(jsonLd)) {
    const spec = n.speakable;
    if (!spec) continue;
    const pageUrl = urlOf(n.url) || urlOf(n['@id']);
    const specs = Array.isArray(spec) ? spec : [spec];
    const selectors = [];
    for (const s of specs) {
      if (typeof s === 'string') {
        selectors.push({ type: s.trim().startsWith('/') || s.trim().startsWith('(') ? 'xpath' : 'css', value: s });
        continue;
      }
      if (s && typeof s === 'object' && isType(s, 'SpeakableSpecification')) {
        const addAll = (vals, type) => {
          for (const v of Array.isArray(vals) ? vals : [vals]) {
            if (typeof v === 'string' && v) selectors.push({ type, value: v });
          }
        };
        addAll(s.cssSelector, 'css');
        addAll(s.xpath, 'xpath');
      }
    }
    if (!selectors.length) continue;
    out.push({
      pageUrl: pageUrl || null,
      pageHost: hostOf(pageUrl),
      selectors: dedupe(selectors, (s) => `${s.type}|${s.value}`),
    });
  }
  return dedupe(out, (e) => `${e.pageUrl || ''}|${e.selectors.map((s) => s.value).join(',')}`);
}

/**
 * Idea 867 — AMP-page canonical mapping.
 *
 * Maps AMP pages to their canonical counterparts from HTML `<link>` tags:
 * - On a canonical page: `<link rel="amphtml" href="...">` points at the AMP variant.
 * - On an AMP page: `<link rel="canonical" href="...">` points back at the canonical.
 * Cross-host AMP ↔ canonical pairs reveal CDN/AMP-cache hosts.
 *
 * @param {string} html page HTML source
 * @returns {{ampUrl: string|null, ampHost: string|null, canonicalUrl: string|null,
 *   canonicalHost: string|null, isAmpPage: boolean, crossHost: boolean}}
 */
export function mapAmpCanonicals(html = '') {
  const text = String(html || '');
  let ampUrl = null;
  let canonicalUrl = null;
  for (const m of text.matchAll(LINK_TAG_RE)) {
    const tag = m[0];
    const rel = (tagAttr(tag, 'rel') || '').toLowerCase();
    const href = tagAttr(tag, 'href');
    if (!href) continue;
    if (rel === 'amphtml' && !ampUrl) ampUrl = href;
    if (rel === 'canonical' && !canonicalUrl) canonicalUrl = href;
  }
  const ampHost = hostOf(ampUrl);
  const canonicalHost = hostOf(canonicalUrl);
  const isAmpPage = /<html[^>]*\bamp\b/i.test(text) || /\b⚡\b/.test(text);
  return {
    ampUrl,
    ampHost,
    canonicalUrl,
    canonicalHost,
    isAmpPage,
    crossHost: Boolean(ampHost && canonicalHost && ampHost !== canonicalHost),
  };
}

/**
 * Idea 868 — AMP-analytics endpoint extraction.
 *
 * Extracts analytics/collector endpoints from `<amp-analytics>` configs:
 * inline JSON `requests` maps, remote `config=` URLs and `transport` beacon
 * URLs. Reveals third-party measurement hosts wired into the page.
 *
 * @param {string} html page HTML source
 * @returns {{type: string|null, configUrl: string|null, configHost: string|null,
 *   requests: {name: string, url: string, host: string|null}[]}[]}
 */
export function extractAmpAnalyticsEndpoints(html = '') {
  const text = String(html || '');
  const out = [];
  for (const m of text.matchAll(AMP_ANALYTICS_RE)) {
    const openTag = m[1] || '';
    const inner = m[2] || '';
    const type = tagAttr(`<x ${openTag}>`, 'type');
    const configUrl = tagAttr(`<x ${openTag}>`, 'config');
    let requests = [];
    const jsonM = inner.match(ANALYTICS_JSON_SCRIPT_RE);
    if (jsonM) {
      try {
        const cfg = JSON.parse(jsonM[1]);
        const reqMap = cfg && typeof cfg === 'object' && cfg.requests && typeof cfg.requests === 'object' ? cfg.requests : {};
        requests = Object.entries(reqMap)
          .filter(([, v]) => typeof v === 'string')
          .map(([name, url]) => ({ name, url, host: hostOf(url) }));
        const transport = cfg.transport && typeof cfg.transport === 'object' ? cfg.transport : {};
        for (const [tName, tVal] of Object.entries(transport)) {
          if (typeof tVal === 'string' && /^https?:\/\//i.test(tVal)) {
            requests.push({ name: `transport:${tName}`, url: tVal, host: hostOf(tVal) });
          }
        }
      } catch { /* malformed inline config — keep attribute-level data */ }
    }
    out.push({
      type,
      configUrl: configUrl || null,
      configHost: hostOf(configUrl),
      requests: dedupe(requests, (r) => `${r.name}|${r.url}`),
    });
  }
  return out;
}

/**
 * Idea 869 — Instant-Article URL mapping.
 *
 * Maps Facebook Instant Articles markup to canonical hosts: `op:markup_version`
 * presence, `ia:markup_url` / `ia:markup_url_version` meta tags, the canonical
 * link and `fb:pages` linkage. Reveals the publisher's canonical web host
 * behind the Instant Article surface.
 *
 * @param {string} html page HTML source
 * @returns {{isInstantArticle: boolean, markupUrl: string|null, markupHost: string|null,
 *   markupVersion: string|null, canonicalUrl: string|null, canonicalHost: string|null,
 *   fbPages: string[], standoutUrl: string|null}}
 */
export function mapInstantArticleUrls(html = '') {
  const text = String(html || '');
  let isInstantArticle = false;
  let markupUrl = null;
  let markupVersion = null;
  const fbPages = [];
  let canonicalUrl = null;
  let standoutUrl = null;
  for (const m of text.matchAll(META_TAG_RE)) {
    const tag = m[0];
    const prop = (tagAttr(tag, 'property') || '').toLowerCase();
    const content = tagAttr(tag, 'content');
    if (!content) continue;
    if (prop === 'op:markup_version') {
      isInstantArticle = true;
      if (!markupVersion) markupVersion = content;
    }
    if ((prop === 'ia:markup_url' || prop === 'op:markup_url') && !markupUrl) markupUrl = content;
    if (prop === 'fb:pages' && !fbPages.includes(content)) fbPages.push(content);
  }
  for (const m of text.matchAll(LINK_TAG_RE)) {
    const tag = m[0];
    const rel = (tagAttr(tag, 'rel') || '').toLowerCase();
    const href = tagAttr(tag, 'href');
    if (!href) continue;
    if (rel === 'canonical' && !canonicalUrl) canonicalUrl = href;
    if (rel === 'standout' && !standoutUrl) standoutUrl = href;
  }
  return {
    isInstantArticle,
    markupUrl,
    markupHost: hostOf(markupUrl),
    markupVersion,
    canonicalUrl,
    canonicalHost: hostOf(canonicalUrl),
    fbPages,
    standoutUrl,
  };
}

/**
 * Idea 870 — Apple-News URL mapping.
 *
 * Maps Apple News channel surface from page markup: `apple.news/...` links,
 * `apple-itunes-app` smart-banner metadata (app-id / app-argument) and
 * `apple-news:*` meta tags. Reveals the publisher's Apple News channel and
 * the deep-link argument the site hands to the News app.
 *
 * @param {string} html page HTML source
 * @returns {{channelUrls: string[], channelHosts: string[], appId: string|null,
 *   appArguments: string[], appleNewsMeta: {name: string, content: string}[]}}
 */
export function mapAppleNewsChannels(html = '') {
  const text = String(html || '');
  const channelSet = new Set();
  let appId = null;
  const appArguments = [];
  const appleNewsMeta = [];
  const consider = (url) => {
    if (typeof url === 'string' && /^(https?:)?\/\/([a-z0-9-]+\.)*apple\.news\//i.test(url.trim())) {
      channelSet.add(url.trim().replace(/^\/\//, 'https://'));
    }
  };
  for (const m of text.matchAll(META_TAG_RE)) {
    const tag = m[0];
    const name = (tagAttr(tag, 'name') || '').toLowerCase();
    const content = tagAttr(tag, 'content');
    if (!content) continue;
    if (name === 'apple-itunes-app') {
      const idM = content.match(/app-id\s*=\s*([^,\s]+)/i);
      if (idM && !appId) appId = idM[1];
      const argM = content.match(/app-argument\s*=\s*([^,]+)/i);
      if (argM) {
        const arg = argM[1].trim();
        if (arg && !appArguments.includes(arg)) appArguments.push(arg);
        consider(arg);
      }
    }
    if (name.startsWith('apple-news')) {
      appleNewsMeta.push({ name, content });
      consider(content);
    }
  }
  for (const m of text.matchAll(LINK_TAG_RE)) {
    consider(tagAttr(m[0], 'href'));
  }
  for (const m of text.matchAll(ANCHOR_TAG_RE)) {
    consider(m[1]);
  }
  const channelUrls = [...channelSet].sort();
  const channelHosts = [...new Set(channelUrls.map(hostOf).filter(Boolean))].sort();
  return { channelUrls, channelHosts, appId, appArguments, appleNewsMeta };
}
