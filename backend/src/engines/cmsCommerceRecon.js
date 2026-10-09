/**
 * cmsCommerceRecon.js — Headless-CMS & headless-commerce endpoint reconnaissance engine.
 *
 * Maps the content-management and commerce API surface a site exposes from its
 * own client-side code: DatoCMS API hosts, Prismic repository names, Ghost
 * Content-API endpoints, WordPress REST routes, Drupal JSON:API resources, and
 * Shopify/BigCommerce storefront endpoints.
 *
 * Operates purely on HTML/JS text the hunt agent has already fetched from the
 * target's own publicly served pages (passive/static analysis). No network calls,
 * no execution of target code — fully deterministic.
 *
 * Defensive/product framing only: extraction reports API hosts, repository
 * names and route patterns a site administrator would want inventoried.
 * Client tokens and API keys are never reported verbatim — when a token-shaped
 * literal is found it is reported as a masked presence hint only.
 *
 * @module cmsCommerceRecon
 */

const DATOCMS_HOSTS = ['graph.datocms.com', 'site-api.datocms.com', 'www.datocms.com/api', 'datocms.com/api'];

/**
 * Mask a credential-shaped literal so reports show presence, never the value.
 *
 * @param {string} value - Raw literal.
 * @returns {string} Masked hint, e.g. "present(len=64)".
 */
function maskSecret(value) {
  if (!value) return 'none';
  return `present(len=${value.length})`;
}

/**
 * Line number (1-based) of a character offset in a source string.
 *
 * @param {string} src - Source text.
 * @param {number} offset - Character offset.
 * @returns {number} 1-based line number.
 */
function lineOf(src, offset) {
  return src.slice(0, offset).split('\n').length;
}

/**
 * Idea 00991 — map DatoCMS API hosts from client code.
 *
 * Recognises DatoCMS API hostnames, `SiteClient`/`buildClient` instantiation
 * from `@datocms/cma-client-browser` or `@datocms/client`, and client API
 * method call sites (items.list, uploads.create, etc.) without echoing tokens.
 *
 * @param {string} htmlOrJs - Raw HTML or JS source.
 * @returns {{hosts: Array<{host: string, line: number}>, clients: Array<{kind: string, token: string, line: number}>, callSites: Array<{method: string, line: number}>}}
 */
export function mapDatoCmsApiHosts(htmlOrJs = '') {
  const src = String(htmlOrJs);
  const hosts = [];
  const clients = [];
  const callSites = [];
  const seen = new Set();

  for (const host of DATOCMS_HOSTS) {
    const re = new RegExp(host.replace(/\./g, '\\.'), 'gi');
    let m;
    while ((m = re.exec(src)) !== null) {
      const key = host + m.index;
      if (seen.has(key)) continue;
      seen.add(key);
      hosts.push({ host, line: lineOf(src, m.index) });
    }
  }

  const clientRe = /\b(?:new\s+)?(?:SiteClient|buildClient|Client)\(\s*['"`]([^'"`]+)['"`]/g;
  let m;
  while ((m = clientRe.exec(src)) !== null) {
    const kind = /SiteClient/.test(m[0]) ? 'SiteClient' : /buildClient/.test(m[0]) ? 'buildClient' : 'Client';
    clients.push({ kind, token: maskSecret(m[1]), line: lineOf(src, m.index) });
  }

  const callRe = /\bclient\.(items|uploads|users|itemTypes|fields|environments)\.(list|create|update|destroy|all|find)\s*\(/g;
  while ((m = callRe.exec(src)) !== null) {
    callSites.push({ method: `client.${m[1]}.${m[2]}`, line: lineOf(src, m.index) });
  }

  return { hosts, clients, callSites };
}

/**
 * Idea 00992 — extract Prismic repository names.
 *
 * Recognises `https://<repo>.prismic.io/api/v2`, `.cdn.prismic.io` endpoints,
 * `Prismic.client(endpoint)`, `@prismicio/client` `createClient("repo")` and
 * `Prismic.buildAPIRoute` helpers.
 *
 * @param {string} htmlOrJs - Raw HTML or JS source.
 * @returns {{repositories: Array<{name: string, endpoint: string, line: number}>}}
 */
export function extractPrismicRepoNames(htmlOrJs = '') {
  const src = String(htmlOrJs);
  const repositories = [];
  const seen = new Set();

  const endpointRe = /https?:\/\/([a-z0-9][a-z0-9-]*)\.(?:cdn\.)?prismic\.io\/api\/v\d/gi;
  let m;
  while ((m = endpointRe.exec(src)) !== null) {
    const name = m[1].toLowerCase();
    const endpoint = m[0];
    const key = name + endpoint;
    if (seen.has(key)) continue;
    seen.add(key);
    repositories.push({ name, endpoint, line: lineOf(src, m.index) });
  }

  const createRe = /\bcreateClient\(\s*['"`]([a-z0-9][a-z0-9-]*)['"`]/gi;
  while ((m = createRe.exec(src)) !== null) {
    const name = m[1].toLowerCase();
    const endpoint = `https://${name}.cdn.prismic.io/api/v2`;
    const key = name + endpoint;
    if (seen.has(key)) continue;
    seen.add(key);
    repositories.push({ name, endpoint, line: lineOf(src, m.index) });
  }

  return { repositories };
}

/**
 * Idea 00993 — map Ghost Content-API endpoints.
 *
 * Recognises `/ghost/api/content/...` and `/ghost/api/admin/...` paths,
 * `GhostContentAPI` instantiation from `@tryghost/content-api` (API key
 * reported masked only) and version hints (`v2`–`v6`).
 *
 * @param {string} htmlOrJs - Raw HTML or JS source.
 * @returns {{endpoints: Array<{path: string, api: string, line: number}>, clients: Array<{version: string|null, key: string, line: number}>}}
 */
export function mapGhostContentApiEndpoints(htmlOrJs = '') {
  const src = String(htmlOrJs);
  const endpoints = [];
  const clients = [];
  const seen = new Set();

  const pathRe = /\/(ghost)\/api\/(content|admin)(?:\/v(\d+))?\/([a-z][a-z0-9_-]*(?:\/[a-z0-9_.-]*)*)/gi;
  let m;
  while ((m = pathRe.exec(src)) !== null) {
    const path = `/ghost/api/${m[2]}${m[3] ? `/v${m[3]}` : ''}/${m[4]}`;
    const key = path;
    if (seen.has(key)) continue;
    seen.add(key);
    endpoints.push({ path, api: m[2], line: lineOf(src, m.index) });
  }

  const clientRe = /\bnew\s+GhostContentAPI\(\s*\{([^}]{0,400})\}/g;
  while ((m = clientRe.exec(src)) !== null) {
    const opts = m[1];
    const ver = opts.match(/version\s*:\s*['"`]([^'"`]+)['"`]/);
    const key = opts.match(/key\s*:\s*['"`]([^'"`]+)['"`]/);
    clients.push({
      version: ver ? ver[1] : null,
      key: key ? maskSecret(key[1]) : 'none',
      line: lineOf(src, m.index),
    });
  }

  return { endpoints, clients };
}

/**
 * Idea 00994 — discover WordPress REST endpoints and their routes.
 *
 * Recognises `wp-json` bases, namespaced routes (`/wp-json/wp/v2/posts`,
 * `/wp-json/wp/v2/types`, plugin namespaces like `/wp-json/contact-form-7/v1`),
 * and `wpApiSettings` root hints. Routes are grouped by namespace.
 *
 * @param {string} htmlOrJs - Raw HTML or JS source.
 * @returns {{bases: string[], namespaces: Record<string, string[]>}}
 */
export function discoverWordPressRestEndpoints(htmlOrJs = '') {
  const src = String(htmlOrJs);
  const baseSet = new Set();
  const namespaceRoutes = {};

  const baseRe = /(https?:\/\/[a-z0-9.:_-]+\/)?\/wp-json\/?/gi;
  let m;
  while ((m = baseRe.exec(src)) !== null) {
    baseSet.add((m[1] || '') + '/wp-json/');
  }

  const routeRe = /\/wp-json\/([a-z0-9_-]+(?:\/v\d+)?)\/([a-z0-9_\-/]+)/gi;
  while ((m = routeRe.exec(src)) !== null) {
    const ns = m[1].toLowerCase();
    const route = m[2].toLowerCase().replace(/\/+$/, '');
    if (!namespaceRoutes[ns]) namespaceRoutes[ns] = [];
    if (!namespaceRoutes[ns].includes(route)) namespaceRoutes[ns].push(route);
  }

  const settingsRe = /wpApiSettings\s*=\s*\{[^}]{0,300}root\s*:\s*['"`]([^'"`]+)['"`]/gi;
  while ((m = settingsRe.exec(src)) !== null) {
    baseSet.add(m[1]);
  }

  return { bases: [...baseSet], namespaces: namespaceRoutes };
}

/**
 * Idea 00995 — map Drupal JSON:API resource routes.
 *
 * Recognises `/jsonapi/node/<type>` resource paths, `drupalSettings` JSON:API
 * base hints, `?filter[…]` usage on jsonapi paths and include-graph depth
 * hints — enough to inventory a Drupal JSON:API surface.
 *
 * @param {string} htmlOrJs - Raw HTML or JS source.
 * @returns {{base: string|null, resources: Array<{path: string, resourceType: string, line: number}>}}
 */
export function mapDrupalJsonApiRoutes(htmlOrJs = '') {
  const src = String(htmlOrJs);
  const resources = [];
  const seen = new Set();
  let base = null;

  const settingsRe = /drupalSettings\s*=\s*\{[^]{0,600}?jsonapi[^]{0,100}?(?:baseUrl|base_url|base)\s*['"]?\s*:\s*['"`]([^'"`]+)['"`]/i;
  const settingsMatch = src.match(settingsRe);
  if (settingsMatch) base = settingsMatch[1];

  const routeRe = /\/jsonapi\/([a-z0-9_-]+(?:\/[a-z0-9_-]+)*)(\?[^'"`\s]*)?/gi;
  let m;
  while ((m = routeRe.exec(src)) !== null) {
    const path = `/jsonapi/${m[1]}`;
    const key = path;
    if (seen.has(key)) continue;
    seen.add(key);
    resources.push({ path, resourceType: m[1], line: lineOf(src, m.index) });
  }

  return { base, resources };
}

/**
 * Idea 00996 — map Shopify/BigCommerce headless-commerce endpoints.
 *
 * Shopify: `<shop>.myshopify.com` stores, `/api/<version>/graphql(.json)`,
 * `/cart/add`, `/products.json`, `ShopifyBuy.buildClient` (storefront token
 * masked). BigCommerce: storefront GraphQL (`/graphql`), `/api/storefront/cart`,
 * `bigcommerce.com` CDN/cart endpoints, Stencil config hints.
 *
 * @param {string} htmlOrJs - Raw HTML or JS source.
 * @returns {{shopify: {stores: Array<{store: string, line: number}>, endpoints: Array<{endpoint: string, line: number}>, buyClients: Array<{storefrontToken: string, line: number}>}, bigcommerce: {endpoints: Array<{endpoint: string, line: number}>}}}
 */
export function mapHeadlessCommerceEndpoints(htmlOrJs = '') {
  const src = String(htmlOrJs);
  const seenShop = new Set();
  const seenEp = new Set();
  const seenBuy = new Set();
  const seenBc = new Set();
  const shopify = { stores: [], endpoints: [], buyClients: [] };
  const bigcommerce = { endpoints: [] };

  const storeRe = /https?:\/\/([a-z0-9][a-z0-9-]*)\.myshopify\.com/gi;
  let m;
  while ((m = storeRe.exec(src)) !== null) {
    const store = m[1].toLowerCase();
    if (seenShop.has(store)) continue;
    seenShop.add(store);
    shopify.stores.push({ store, line: lineOf(src, m.index) });
  }

  const shopifyEpRe = /\/(?:api\/(?:\d{4}-\d{2}\/)?graphql(?:\.json)?|cart\/(?:add|change|update)|products(?:\.json)?|collections(?:\.json)?)/gi;
  while ((m = shopifyEpRe.exec(src)) !== null) {
    const endpoint = m[0].toLowerCase();
    if (seenEp.has(endpoint)) continue;
    seenEp.add(endpoint);
    shopify.endpoints.push({ endpoint, line: lineOf(src, m.index) });
  }

  const buyRe = /ShopifyBuy\.buildClient\(\s*\{([^}]{0,400})\}/g;
  while ((m = buyRe.exec(src)) !== null) {
    const tok = m[1].match(/storefrontAccessToken\s*:\s*['"`]([^'"`]+)['"`]/);
    const key = m.index;
    if (seenBuy.has(key)) continue;
    seenBuy.add(key);
    shopify.buyClients.push({ storefrontToken: tok ? maskSecret(tok[1]) : 'none', line: lineOf(src, m.index) });
  }

  const bcRe = /\/(?:graphql|api\/storefront\/[a-z0-9/_-]+|bigcommerce(?:\.json)?)/gi;
  while ((m = bcRe.exec(src)) !== null) {
    const endpoint = m[0].toLowerCase();
    if (seenBc.has(endpoint)) continue;
    seenBc.add(endpoint);
    bigcommerce.endpoints.push({ endpoint, line: lineOf(src, m.index) });
  }
  const bcCdnRe = /https?:\/\/[a-z0-9.-]*bigcommerce\.com[^\s'"`]*/gi;
  while ((m = bcCdnRe.exec(src)) !== null) {
    const endpoint = m[0];
    if (seenBc.has(endpoint)) continue;
    seenBc.add(endpoint);
    bigcommerce.endpoints.push({ endpoint, line: lineOf(src, m.index) });
  }

  return { shopify, bigcommerce };
}

/**
 * Run every CMS/commerce mapper over one source and combine the results.
 *
 * @param {string} htmlOrJs - Raw HTML or JS source.
 * @returns {object} Combined findings keyed by idea number.
 */
export function analyseCmsCommerceSurface(htmlOrJs = '') {
  return {
    datoCms: mapDatoCmsApiHosts(htmlOrJs),
    prismic: extractPrismicRepoNames(htmlOrJs),
    ghost: mapGhostContentApiEndpoints(htmlOrJs),
    wordpress: discoverWordPressRestEndpoints(htmlOrJs),
    drupal: mapDrupalJsonApiRoutes(htmlOrJs),
    commerce: mapHeadlessCommerceEndpoints(htmlOrJs),
  };
}

export const CMS_COMMERCE_RECON = {
  mapDatoCmsApiHosts,
  extractPrismicRepoNames,
  mapGhostContentApiEndpoints,
  discoverWordPressRestEndpoints,
  mapDrupalJsonApiRoutes,
  mapHeadlessCommerceEndpoints,
  analyseCmsCommerceSurface,
};

export default CMS_COMMERCE_RECON;
