/**
 * emailDeepLinkMapper.js — Email deep-link route mapping.
 *
 * Idea 00882: extract deep links from email templates (newsletter HTML,
 * transactional-mail bodies) that reveal the app's internal routes — universal
 * links, custom-scheme links (myapp://), and Android intent:// URIs.
 *
 * The module parses email HTML/text, classifies each link as a deep link or a
 * plain web link, and maps custom-scheme/intent paths onto app route trees so
 * the operator can reconcile web routes with in-app routes. No network calls.
 */

/** Custom app schemes worth mapping (excluding web/mail/tel/sms). */
export const APP_SCHEME_RE = /^([a-z][a-z0-9+.-]{1,39}):\/\//i;

/** Non-app schemes to ignore when hunting for deep links. */
export const IGNORED_SCHEMES = new Set([
  'http', 'https', 'mailto', 'tel', 'sms', 'callto', 'skype', 'ftp', 'file',
]);

/** Android intent:// URI markers that encode the target app route. */
export const INTENT_PARAM_RE = /[?&](?:scheme|package|S\.browser_fallback_url)=/i;

/**
 * Extract all link-like strings from email HTML/text.
 * @param {string} text
 * @returns {string[]}
 */
export function extractEmailLinks(text = '') {
  const out = new Set();
  const re = /href\s*=\s*["']([^"']+)["']|["']((?:https?|intent|[a-z][a-z0-9+.-]{1,39}):\/\/[^"'\s<>{}|^`\\]+)["']|((?:https?|intent|[a-z][a-z0-9+.-]{1,39}):\/\/[^\s<>"'{}\|^`\\]+)/gi;
  let m;
  while ((m = re.exec(String(text))) !== null) {
    const u = m[1] || m[2] || m[3];
    if (u && APP_SCHEME_RE.test(u)) out.add(u);
  }
  return [...out];
}

/**
 * Parse an Android intent:// URI into its route and package parts.
 * @param {string} uri
 * @returns {{scheme: string, route: string, package: string|null, fallbackUrl: string|null}|null}
 */
export function parseIntentUri(uri = '') {
  const m = /^intent:\/\/([^#]+)#Intent;(.+);end$/i.exec(String(uri).trim());
  if (!m) return null;
  const params = {};
  for (const part of m[2].split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0) params[part.slice(0, eq)] = decodeURIComponent(part.slice(eq + 1));
  }
  return {
    scheme: params.scheme || 'https',
    route: `/${m[1].replace(/^\//, '')}`,
    package: params.package || null,
    fallbackUrl: params['S.browser_fallback_url'] || null,
  };
}

/**
 * Classify a link found in an email template.
 * @param {string} link
 * @returns {'custom-scheme'|'intent'|'universal'|'web'|'other'}
 */
export function classifyEmailLink(link = '') {
  const s = String(link);
  if (/^intent:\/\//i.test(s)) return 'intent';
  const scheme = /^([a-z][a-z0-9+.-]{1,39}):/i.exec(s)?.[1]?.toLowerCase();
  if (scheme && !IGNORED_SCHEMES.has(scheme)) return 'custom-scheme';
  if (/^https?:\/\//i.test(s)) {
    // Universal-link candidates: app-route-shaped paths on the brand domain.
    if (/\/(app|open|launch|deeplink|dl)\b/i.test(s) || /[?&](?:deeplink|af_dp|deep_link)=/i.test(s)) {
      return 'universal';
    }
    return 'web';
  }
  return 'other';
}

/**
 * Normalize a deep link to an app route signature (scheme stripped, query
 * removed, path parameters generalized).
 * @param {string} link
 * @returns {string}
 */
export function toRouteSignature(link = '') {
  let s = String(link);
  if (/^intent:\/\//i.test(s)) {
    const parsed = parseIntentUri(s);
    if (parsed) s = `${parsed.scheme}://route${parsed.route}`;
  }
  const noScheme = s.replace(/^[a-z][a-z0-9+.-]{1,39}:\/\/[^/]*/i, '');
  const path = noScheme.split('?')[0].split('#')[0] || '/';
  return path
    .split('/')
    .map(seg =>
      /^[0-9a-f]{8,}(-[0-9a-f]{4}){0,4}$/i.test(seg) || /^\d+$/.test(seg)
        ? '{id}'
        : seg
    )
    .join('/')
    .replace(/\/{2,}/g, '/');
}

/**
 * Map deep links in an email template to app routes.
 * @param {string} emailHtml - Full email HTML or plain-text body.
 * @returns {{deepLinks: object[], routes: object[], stats: object}}
 */
export function mapEmailDeepLinks(emailHtml = '') {
  const links = extractEmailLinks(emailHtml);
  const deepLinks = [];
  for (const link of links) {
    const kind = classifyEmailLink(link);
    if (kind === 'web' || kind === 'other') continue;
    const entry = {
      kind: 'email-deep-link',
      link,
      type: kind,
      route: toRouteSignature(link),
    };
    if (kind === 'intent') entry.intent = parseIntentUri(link);
    deepLinks.push(entry);
  }
  const routeMap = new Map();
  for (const d of deepLinks) {
    if (!routeMap.has(d.route)) routeMap.set(d.route, []);
    routeMap.get(d.route).push(d);
  }
  const routes = [...routeMap.entries()].map(([route, items]) => ({
    route,
    hits: items.length,
    types: [...new Set(items.map(i => i.type))],
    samples: items.slice(0, 3).map(i => i.link),
  }));
  routes.sort((a, b) => b.hits - a.hits);
  const byType = {};
  for (const d of deepLinks) byType[d.type] = (byType[d.type] || 0) + 1;
  return {
    deepLinks,
    routes,
    stats: {
      totalLinks: links.length,
      deepLinks: deepLinks.length,
      distinctRoutes: routes.length,
      byType,
    },
  };
}

/**
 * Build a report finding from an email deep-link map.
 * @param {ReturnType<typeof mapEmailDeepLinks>} result
 */
export function emailDeepLinkFinding(result) {
  return {
    title: `Email deep-link route mapping — ${result.stats.deepLinks} deep link(s), ${result.stats.distinctRoutes} route(s)`,
    severity: 'Info',
    confidence: result.stats.deepLinks > 0 ? 'high' : 'medium',
    routes: result.routes.slice(0, 20),
    stats: result.stats,
    evidence:
      `${result.stats.deepLinks} deep link(s) extracted from email content, ` +
      `mapping to ${result.stats.distinctRoutes} distinct app route(s).`,
  };
}

export const EMAIL_DEEP_LINK_MAPPER = {
  extractEmailLinks,
  parseIntentUri,
  classifyEmailLink,
  toRouteSignature,
  mapEmailDeepLinks,
  emailDeepLinkFinding,
};
export default EMAIL_DEEP_LINK_MAPPER;
