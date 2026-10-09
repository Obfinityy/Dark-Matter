/**
 * cmsConfigRecon.js — Headless-CMS config reconnaissance engine.
 *
 * Passively maps headless-CMS configuration references embedded in a web
 * application's own publicly served client JavaScript: Strapi, Contentful,
 * Sanity, Storyblok and Hygraph.
 *
 * It extracts ONLY config references — project/space IDs, dataset names,
 * delivery hosts, CDN endpoint URLs, content-type names and SDK usage markers —
 * from JS text the hunt agent has already fetched. Delivery/token values that
 * appear in the bundle are reported as config references (client delivery
 * identifiers), never treated as secrets to reuse. No network calls, no
 * execution of target code — fully deterministic.
 *
 * @module cmsConfigRecon
 */

/**
 * Build the standard finding record for a harvested config reference.
 *
 * @param {string} idea - Idea number ("00986" … "00990").
 * @param {string} provider - CMS provider name.
 * @param {string} kind - Type of reference (spaceId, dataset, deliveryHost, endpoint, contentType, sdkUsage …).
 * @param {string} value - The extracted value (trimmed, non-secret config hint).
 * @param {string} source - Short excerpt of the matched code.
 * @param {number} line - 1-based line number in the source text.
 * @returns {{idea: string, provider: string, kind: string, value: string, source: string, line: number, note: string}}
 */
function finding(idea, provider, kind, value, source, line) {
  return {
    idea,
    provider,
    kind,
    value: String(value).slice(0, 220),
    source: String(source).slice(0, 120),
    line,
    note: 'Passive config-reference harvest from the target\'s own client bundle. Values are non-secret config hints only.',
  };
}

/**
 * Generic extractor: run a list of {kind, regex} patterns over the source
 * text, dedupe by kind+value and record line numbers.
 *
 * @param {string} src - Source text.
 * @param {string} idea - Idea number.
 * @param {string} provider - Provider name.
 * @param {Array<{kind: string, re: RegExp}>} patterns - Patterns with one capture group = value.
 * @returns {Array<object>} Deduped findings.
 */
function runPatterns(src, idea, provider, patterns) {
  const findings = [];
  const seen = new Set();
  for (const { kind, re } of patterns) {
    const regex = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    let m;
    while ((m = regex.exec(src)) !== null) {
      const value = (m[1] || m[0] || '').trim();
      if (!value || value.length > 220) continue;
      const key = `${kind}::${value}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const line = src.slice(0, m.index).split('\n').length;
      findings.push(finding(idea, provider, kind, value, m[0], line));
    }
  }
  return findings;
}

/**
 * Record at most one representative SDK-usage marker per provider.
 *
 * @param {string} src - Source text.
 * @param {string} idea - Idea number.
 * @param {string} provider - Provider name.
 * @param {Array<{re: RegExp, value: string}>} markers - Marker regexes and labels.
 * @returns {Array<object>} Zero or one findings.
 */
function sdkMarker(src, idea, provider, markers) {
  for (const { re, value } of markers) {
    const idx = src.search(re);
    if (idx !== -1) {
      return [finding(idea, provider, 'sdkUsage', value, re.source, src.slice(0, idx).split('\n').length)];
    }
  }
  return [];
}

// ---------------------------------------------------------------------------
// Idea 00986 — Strapi API mapping
// ---------------------------------------------------------------------------

/**
 * Idea 00986 — Map Strapi content-type endpoints from client code.
 *
 * Recognises /api/<content-type> fetch paths (REST and query strings),
 * STRAPI_API_URL / NEXT_PUBLIC_STRAPI_URL env references, strapi-plugin
 * markers and GraphQL calls against /graphql on a Strapi host.
 *
 * @param {string} js - Raw client JS text.
 * @returns {Array<object>} Findings with kind in {sdkUsage, baseUrl, contentType, envReference, graphqlEndpoint}.
 */
export function extractStrapiConfigRefs(js = '') {
  const src = String(js);
  const findings = sdkMarker(src, '00986', 'strapi', [
    { re: /\b@strapi\//, value: '@strapi package marker' },
    { re: /\bstrapi-plugin-/, value: 'strapi plugin marker' },
    { re: /\bSTRAPI_(?:API_URL|URL|TOKEN)\b/, value: 'STRAPI_* env marker' },
  ]);

  findings.push(
    ...runPatterns(src, '00986', 'strapi', [
      { kind: 'baseUrl', re: /\b(?:STRAPI_API_URL|STRAPI_URL|NEXT_PUBLIC_STRAPI_API_URL|VITE_STRAPI_URL)\s*[:=]\s*['"`](https?:\/\/[^'"`\s]{4,120})['"`]/ },
      { kind: 'baseUrl', re: /fetch\(\s*[`'"]\$\{(?:STRAPI_API_URL|process\.env\.[A-Z_]*STRAPI[A-Z_]*|import\.meta\.env\.[A-Z_]*STRAPI[A-Z_]*)\}[^`'"]{0,10}/ },
      { kind: 'contentType', re: /\/api\/([a-z][a-z0-9\-_]{1,40})(?:[?\/'"`\s]|$)/ },
      { kind: 'contentType', re: /[`'"]\$\{[^}]*\}\/api\/([a-z][a-z0-9\-_]{1,40})(?:[?\/]|$)/ },
      { kind: 'envReference', re: /process\.env\.([A-Z_]*STRAPI[A-Z_]*)/ },
      { kind: 'envReference', re: /import\.meta\.env\.(VITE_[A-Z_]*STRAPI[A-Z_]*)/ },
      { kind: 'graphqlEndpoint', re: /['"`](https?:\/\/[^'"`\s]{4,120}\/graphql)['"`]/ },
    ]),
  );
  return findings;
}

// ---------------------------------------------------------------------------
// Idea 00987 — Contentful space-ID extraction
// ---------------------------------------------------------------------------

/**
 * Idea 00987 — Extract Contentful space IDs and delivery hosts.
 *
 * Recognises createClient({space, accessToken}) / contentful.createClient,
 * cdn.contentful.com/spaces/<id> and preview.contentful.com URLs, and
 * CONTENTFUL_* env references.
 *
 * @param {string} js - Raw client JS text.
 * @returns {Array<object>} Findings with kind in {sdkUsage, spaceId, deliveryHost, envReference, entryFetch}.
 */
export function extractContentfulConfigRefs(js = '') {
  const src = String(js);
  const findings = sdkMarker(src, '00987', 'contentful', [
    { re: /\bcontentful\.createClient\s*\(/, value: 'contentful.createClient' },
    { re: /\bcreateClient\s*\(\s*\{[^}]{0,120}space\s*:/, value: 'createClient({space})' },
    { re: /\bfrom\s+['"`]contentful['"`]/, value: 'contentful import' },
  ]);

  findings.push(
    ...runPatterns(src, '00987', 'contentful', [
      { kind: 'spaceId', re: /\bspace\s*[:=]\s*['"`]([a-z0-9]{6,20})['"`]/ },
      { kind: 'spaceId', re: /cdn\.contentful\.com\/spaces\/([a-z0-9]{6,20})/ },
      { kind: 'spaceId', re: /\b(?:CONTENTFUL_SPACE_ID|NEXT_PUBLIC_CONTENTFUL_SPACE_ID)\s*[:=]\s*['"`]([a-z0-9]{6,20})['"`]/ },
      { kind: 'deliveryHost', re: /['"`](https?:\/\/(?:cdn|preview)\.contentful\.com[^'"`\s]*)["'`]/ },
      { kind: 'deliveryHost', re: /\bhost\s*[:=]\s*['"`]([a-z0-9.\-]{4,60}\.contentful\.com)["'`]/ },
      { kind: 'envReference', re: /process\.env\.([A-Z_]*CONTENTFUL[A-Z_]*)/ },
      { kind: 'envReference', re: /import\.meta\.env\.(VITE_[A-Z_]*CONTENTFUL[A-Z_]*)/ },
      { kind: 'entryFetch', re: /\bgetEntr(?:y|ies)\(\s*['"`]([A-Za-z0-9_\-]{2,40})['"`]/ },
    ]),
  );
  return findings;
}

// ---------------------------------------------------------------------------
// Idea 00988 — Sanity project-ID mining
// ---------------------------------------------------------------------------

/**
 * Idea 00988 — Mine Sanity project IDs and dataset names.
 *
 * Recognises createClient({projectId, dataset}) / @sanity/client, cdn.sanity.io
 * project URLs (https://<projectId>.api.sanity.io, cdn.sanity.io/images/<id>/),
 * and SANITY_* env references.
 *
 * @param {string} js - Raw client JS text.
 * @returns {Array<object>} Findings with kind in {sdkUsage, projectId, dataset, apiHost, imageCdnRef, envReference}.
 */
export function extractSanityConfigRefs(js = '') {
  const src = String(js);
  const findings = sdkMarker(src, '00988', 'sanity', [
    { re: /\b@sanity\/client\b/, value: '@sanity/client import' },
    { re: /\bsanityClient\b/, value: 'sanityClient' },
    { re: /\bcreateClient\s*\(\s*\{[^}]{0,160}projectId\s*:/, value: 'createClient({projectId})' },
    { re: /\b@sanity\/image-url\b/, value: '@sanity/image-url import' },
  ]);

  findings.push(
    ...runPatterns(src, '00988', 'sanity', [
      { kind: 'projectId', re: /\bprojectId\s*[:=]\s*['"`]([a-z0-9]{6,24})['"`]/ },
      { kind: 'projectId', re: /https?:\/\/([a-z0-9]{6,24})\.api\.sanity\.io/ },
      { kind: 'projectId', re: /cdn\.sanity\.io\/images\/([a-z0-9]{6,24})\// },
      { kind: 'projectId', re: /\b(?:SANITY_PROJECT_ID|NEXT_PUBLIC_SANITY_PROJECT_ID)\s*[:=]\s*['"`]([a-z0-9]{6,24})['"`]/ },
      { kind: 'dataset', re: /\bdataset\s*[:=]\s*['"`]([a-zA-Z0-9][a-zA-Z0-9\-_]{1,30})['"`]/ },
      { kind: 'dataset', re: /\b(?:SANITY_DATASET|NEXT_PUBLIC_SANITY_DATASET)\s*[:=]\s*['"`]([a-zA-Z0-9][a-zA-Z0-9\-_]{1,30})['"`]/ },
      { kind: 'apiHost', re: /['"`](https?:\/\/[a-z0-9]{6,24}\.(?:api|cdn)\.sanity\.io[^'"`\s]*)["'`]/ },
      { kind: 'envReference', re: /process\.env\.([A-Z_]*SANITY[A-Z_]*)/ },
      { kind: 'envReference', re: /import\.meta\.env\.(VITE_[A-Z_]*SANITY[A-Z_]*)/ },
    ]),
  );
  return findings;
}

// ---------------------------------------------------------------------------
// Idea 00989 — Storyblok token-reference mapping
// ---------------------------------------------------------------------------

/**
 * Idea 00989 — Map Storyblok references to CDN endpoints.
 *
 * Recognises storyblokInit({accessToken}), useStoryblok / StoryblokComponent,
 * api.storyblok.com/v2/cdn/stories and a.storyblok.com asset URLs, and
 * STORYBLOK_* env references.
 *
 * @param {string} js - Raw client JS text.
 * @returns {Array<object>} Findings with kind in {sdkUsage, cdnEndpoint, assetCdnUrl, tokenReference, envReference, storyPath}.
 */
export function extractStoryblokConfigRefs(js = '') {
  const src = String(js);
  const findings = sdkMarker(src, '00989', 'storyblok', [
    { re: /\bstoryblokInit\s*\(/, value: 'storyblokInit()' },
    { re: /\buseStoryblok\s*\(/, value: 'useStoryblok()' },
    { re: /\bStoryblokComponent\b/, value: 'StoryblokComponent' },
    { re: /\b@storyblok\//, value: '@storyblok package marker' },
  ]);

  findings.push(
    ...runPatterns(src, '00989', 'storyblok', [
      { kind: 'cdnEndpoint', re: /['"`](https?:\/\/api(?:-eu)?\.storyblok\.com\/v2\/cdn\/stories[^'"`\s]*)["'`]/ },
      { kind: 'cdnEndpoint', re: /\bregion\s*[:=]\s*['"`](eu|us|cn|ap|ca)['"`]/ },
      { kind: 'assetCdnUrl', re: /['"`](https?:\/\/a(?:-eu|-us)?\.storyblok\.com\/f\/[^'"`\s]*)["'`]/ },
      { kind: 'tokenReference', re: /\baccessToken\s*[:=]\s*['"`]([A-Za-z0-9]{8,64})['"`]/ },
      { kind: 'tokenReference', re: /\b(?:STORYBLOK_TOKEN|STORYBLOK_API_TOKEN|NEXT_PUBLIC_STORYBLOK_TOKEN)\s*[:=]\s*['"`]([A-Za-z0-9]{8,64})['"`]/ },
      { kind: 'envReference', re: /process\.env\.([A-Z_]*STORYBLOK[A-Z_]*)/ },
      { kind: 'envReference', re: /import\.meta\.env\.(VITE_[A-Z_]*STORYBLOK[A-Z_]*)/ },
      { kind: 'storyPath', re: /\buseStoryblok\(\s*['"`]([A-Za-z0-9_\-/]{1,80})['"`]/ },
    ]),
  );
  return findings;
}

// ---------------------------------------------------------------------------
// Idea 00990 — Hygraph endpoint extraction
// ---------------------------------------------------------------------------

/**
 * Idea 00990 — Extract Hygraph content endpoints.
 *
 * Recognises <region>.hygraph.com/v2/<projectId>/<stage> URLs (formerly
 * graphcms.com), GraphQLClient against a Hygraph endpoint, and HYGRAPH_*
 * env references.
 *
 * @param {string} js - Raw client JS text.
 * @returns {Array<object>} Findings with kind in {sdkUsage, contentEndpoint, projectId, envReference}.
 */
export function extractHygraphConfigRefs(js = '') {
  const src = String(js);
  const findings = sdkMarker(src, '00990', 'hygraph', [
    { re: /\b@hygraph\//, value: '@hygraph package marker' },
    { re: /\bGraphQLClient\s*\(/, value: 'GraphQLClient(...)' },
  ]);

  findings.push(
    ...runPatterns(src, '00990', 'hygraph', [
      { kind: 'contentEndpoint', re: /['"`](https?:\/\/[a-z0-9\-]{2,30}\.hygraph\.com\/v2\/[a-z0-9]{10,40}\/(?:master|main|production|draft|dev)[^'"`\s]*)["'`]/ },
      { kind: 'contentEndpoint', re: /['"`](https?:\/\/[a-z0-9\-]{2,30}\.graphcms\.com\/v2\/[a-z0-9]{10,40}\/[^'"`\s]*)["'`]/ },
      { kind: 'contentEndpoint', re: /['"`](https?:\/\/api-[a-z0-9\-]{2,30}\.(?:hygraph|graphcms)\.com\/v2\/[a-z0-9]{10,40}\/[^'"`\s]*)["'`]/ },
      { kind: 'projectId', re: /(?:hygraph|graphcms)\.com\/v2\/([a-z0-9]{10,40})\// },
      { kind: 'projectId', re: /\b(?:HYGRAPH_PROJECT_ID|NEXT_PUBLIC_HYGRAPH_PROJECT_ID)\s*[:=]\s*['"`]([a-z0-9]{10,40})['"`]/ },
      { kind: 'envReference', re: /process\.env\.([A-Z_]*(?:HYGRAPH|GRAPHCMS)[A-Z_]*)/ },
      { kind: 'envReference', re: /import\.meta\.env\.(VITE_[A-Z_]*(?:HYGRAPH|GRAPHCMS)[A-Z_]*)/ },
    ]),
  );
  return findings;
}

/**
 * Run all CMS config harvesters (ideas 00986–00990) over one JS text.
 *
 * @param {string} js - Raw client JS text.
 * @returns {{strapi: Array<object>, contentful: Array<object>, sanity: Array<object>, storyblok: Array<object>, hygraph: Array<object>, total: number}}
 */
export function mapCmsConfigs(js = '') {
  const strapi = extractStrapiConfigRefs(js);
  const contentful = extractContentfulConfigRefs(js);
  const sanity = extractSanityConfigRefs(js);
  const storyblok = extractStoryblokConfigRefs(js);
  const hygraph = extractHygraphConfigRefs(js);
  return {
    strapi,
    contentful,
    sanity,
    storyblok,
    hygraph,
    total: strapi.length + contentful.length + sanity.length + storyblok.length + hygraph.length,
  };
}
