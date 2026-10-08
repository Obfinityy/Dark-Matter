/**
 * translationProxyUrlMapper.js — Translation-proxy URL mapping.
 *
 * Idea 00888: map the translated-page proxy URLs a target exposes — Google
 * Translate proxy links, Microsoft Translator links, locale path prefixes,
 * and hreflang alternates — to understand the target's localized surface.
 *
 * The module extracts translation-proxy references from HTML, classifies them
 * (google-proxy, bing-proxy, locale-path, locale-param, hreflang), and maps
 * proxy URLs back to their source URLs. All local, no network calls.
 */

/** Translation proxy services whose URLs wrap the target's pages. */
export const TRANSLATION_PROXIES = [
  {
    name: 'Google Translate proxy',
    host: /(?:^|\.)translate\.google\.com$/i,
    sourceParam: 'u',
    langParam: 'sl',
    targetParam: 'tl',
  },
  {
    name: 'Google Translate host proxy',
    host: /^(.+)\.translate\.goog$/i,
    sourceHostFrom: 1,
  },
  {
    name: 'Microsoft Translator',
    host: /(?:^|\.)translatetheweb\.com$/i,
    sourceParam: 'u',
  },
  {
    name: 'Microsoft Bing translator',
    host: /(?:^|\.)microsofttranslator\.com$/i,
    sourceParam: 'u',
  },
];

/** ISO-ish locale path segments, e.g. /fr/, /en-gb/. */
export const LOCALE_PATH_RE = /^\/([a-z]{2}(?:-[a-z]{2})?)\//i;

/** Locale query parameters, e.g. ?lang=de. */
export const LOCALE_PARAM_RE = /[?&](?:lang|locale|hl|language|setlang)=([a-z]{2}(?:[-_][a-z]{2})?)/i;

/**
 * Extract translation-proxy references from HTML.
 * @param {string} html
 * @returns {object[]}
 */
export function extractTranslationProxyLinks(html = '') {
  const out = [];
  const seen = new Set();
  const re = /href\s*=\s*["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(String(html))) !== null) {
    const href = m[1];
    if (!/^https?:\/\//i.test(href) || seen.has(href)) continue;
    let url;
    try {
      url = new URL(href);
    } catch {
      continue;
    }
    for (const proxy of TRANSLATION_PROXIES) {
      if (!proxy.host.test(url.hostname)) continue;
      seen.add(href);
      const entry = {
        kind: 'translation-proxy-link',
        proxy: proxy.name,
        url: href,
        sourceUrl: null,
        targetLang: null,
        sourceLang: null,
      };
      if (proxy.sourceParam) {
        entry.sourceUrl = url.searchParams.get(proxy.sourceParam);
      }
      if (proxy.sourceHostFrom) {
        const hm = proxy.host.exec(url.hostname);
        entry.sourceUrl = hm ? `https://${hm[proxy.sourceHostFrom]}${url.pathname}${url.search}` : null;
      }
      if (proxy.targetParam) entry.targetLang = url.searchParams.get(proxy.targetParam);
      if (proxy.langParam) entry.sourceLang = url.searchParams.get(proxy.langParam);
      out.push(entry);
      break;
    }
  }
  return out;
}

/**
 * Extract hreflang alternate links (locale surface hints).
 * @param {string} html
 * @returns {object[]}
 */
export function extractHreflangLinks(html = '') {
  const out = [];
  const re = /<link\b([^<>]*)>/gi;
  let m;
  while ((m = re.exec(String(html))) !== null) {
    const attrs = m[1];
    if (!/\brel\s*=\s*["']alternate["']/i.test(attrs)) continue;
    const hl = /hreflang\s*=\s*["']([^"']+)["']/i.exec(attrs);
    const href = /href\s*=\s*["']([^"']+)["']/i.exec(attrs);
    if (hl && href) out.push({ kind: 'hreflang', lang: hl[1], href: href[1] });
  }
  return out;
}

/**
 * Detect locale routing style from a set of site URLs.
 * @param {string[]} urls
 * @returns {{style: 'path-prefix'|'query-param'|'subdomain'|'none', locales: string[]}}
 */
export function detectLocaleRouting(urls = []) {
  const pathLocales = new Set();
  const paramLocales = new Set();
  const subLocales = new Set();
  for (const raw of urls) {
    let u;
    try {
      u = new URL(String(raw));
    } catch {
      continue;
    }
    const pm = LOCALE_PATH_RE.exec(u.pathname);
    if (pm) pathLocales.add(pm[1].toLowerCase());
    const qm = LOCALE_PARAM_RE.exec(u.search);
    if (qm) paramLocales.add(qm[1].toLowerCase().replace('_', '-'));
    const sm = /^([a-z]{2}(?:-[a-z]{2})?)\./i.exec(u.hostname);
    if (sm && !/^(www|app|api|cdn|static)$/i.test(sm[1])) subLocales.add(sm[1].toLowerCase());
  }
  if (pathLocales.size) return { style: 'path-prefix', locales: [...pathLocales] };
  if (subLocales.size) return { style: 'subdomain', locales: [...subLocales] };
  if (paramLocales.size) return { style: 'query-param', locales: [...paramLocales] };
  return { style: 'none', locales: [] };
}

/**
 * Map translation-proxy URLs and locale routing for a site.
 * @param {string} html - Page HTML with proxy/hreflang links.
 * @param {string[]} [siteUrls] - Known site URLs for locale-routing detection.
 * @returns {{proxies: object[], hreflang: object[], localeRouting: object, stats: object}}
 */
export function mapTranslationProxies(html = '', siteUrls = []) {
  const proxies = extractTranslationProxyLinks(html);
  const hreflang = extractHreflangLinks(html);
  const localeRouting = detectLocaleRouting(siteUrls);
  const proxyNames = new Set(proxies.map(p => p.proxy));
  return {
    proxies,
    hreflang,
    localeRouting,
    stats: {
      proxyLinks: proxies.length,
      distinctProxies: proxyNames.size,
      proxies: [...proxyNames],
      hreflangLinks: hreflang.length,
      hreflangLocales: [...new Set(hreflang.map(h => h.lang))],
      localeRoutingStyle: localeRouting.style,
      locales: localeRouting.locales,
    },
  };
}

/**
 * Build a report finding from a translation-proxy map.
 * @param {ReturnType<typeof mapTranslationProxies>} result
 */
export function translationProxyFinding(result) {
  return {
    title: `Translation-proxy URL mapping — ${result.stats.proxyLinks} proxy link(s), ${result.stats.hreflangLinks} hreflang alternate(s)`,
    severity: 'Info',
    confidence: result.stats.proxyLinks + result.stats.hreflangLinks > 0 ? 'high' : 'medium',
    stats: result.stats,
    evidence:
      `${result.stats.proxyLinks} translation-proxy link(s) mapped ` +
      `(${result.stats.proxies.join(', ') || 'none'}); locale routing style: ` +
      `${result.stats.localeRoutingStyle}.`,
  };
}

export const TRANSLATION_PROXY_URL_MAPPER = {
  extractTranslationProxyLinks,
  extractHreflangLinks,
  detectLocaleRouting,
  mapTranslationProxies,
  translationProxyFinding,
};
export default TRANSLATION_PROXY_URL_MAPPER;
