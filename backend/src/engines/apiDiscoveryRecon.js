/**
 * apiDiscoveryRecon.js — API-surface discovery recon probe builder and
 * response analyzer.
 *
 * Idea 01081: SDK source endpoint enumeration — grep published npm/pip SDK
 * source text for path templates because SDKs encode the complete private
 * API surface.
 *
 * Idea 01082: HATEOAS link harvesting — follow _links and hypermedia
 * controls recursively since hypermedia APIs self-document hidden state
 * transitions.
 *
 * Idea 01083: Link-header pagination crawl — walk rel="next" Link headers
 * to exhaustion because paginated collections expose object IDs at scale.
 *
 * Idea 01084: API changelog endpoint discovery — probe /changelog,
 * /release-notes and /whats-new since changelogs name newly added and
 * removed endpoints.
 *
 * Idea 01085: Status-page API backend discovery — query statuspage.io and
 * custom status APIs since status endpoints often expose component IDs
 * and internal service names.
 *
 * Idea 01086: Security.txt scope harvesting — fetch
 * /.well-known/security.txt because contact files sometimes list in-scope
 * API hosts and testing policies.
 *
 * Idea 01087: Well-known URI enumeration — probe /.well-known/* variants
 * (openid-configuration, assetlinks, change-password) since discovery
 * documents reveal auth and API endpoints.
 *
 * Idea 01088: Robots.txt API disallow harvest — parse Disallow entries for
 * /api, /admin and /internal paths because robots files enumerate routes
 * operators wanted hidden.
 *
 * Idea 01089: Sitemap API route hints — crawl sitemap.xml for API-ish URLs
 * since sitemaps occasionally include JSON endpoints and feeds.
 *
 * Idea 01090: Wayback Machine API path harvest — parse Wayback CDX
 * response rows for the target's historical URLs because archived crawls
 * preserve retired endpoints that may still be live today.
 *
 * No network calls: every function operates on operator-supplied strings
 * and objects (SDK source text, JSON bodies, header strings, file text,
 * CDX response rows). Probe-builder functions return ready-to-send probe
 * descriptors (URL path, method, headers); the agent's network layer
 * performs the actual transport and hands the returned text back to the
 * response analyzers in this module.
 * Defensive surface mapping of the engagement's own authorized target only.
 */

/**
 * Normalize a raw URL/string into an endpoint path template:
 * strip protocol + host, query strings and fragments, collapse trailing
 * slashes, and normalize :id/{id}/<id> placeholders to {}.
 * @param {string} raw
 * @returns {string}
 */
export function normalizePathTemplate(raw) {
  let p = String(raw || '').trim();
  p = p.replace(/^https?:\/\/[^/]+/i, '');
  p = p.replace(/[?#].*$/, '');
  p = p.replace(/\$\{[^}]*\}/g, '{}');
  p = p.replace(/\{[^}]*\}/g, '{}').replace(/<[^>]*>/g, '{}').replace(/:[A-Za-z_][A-Za-z0-9_]*/g, '{}');
  p = p.replace(/\/{2,}/g, '/');
  if (p.length > 1) p = p.replace(/\/+$/, '');
  if (!p.startsWith('/')) p = `/${p}`;
  return p;
}

/**
 * Idea 01081 — grep published SDK source text (npm/pip packages, bundle
 * snippets) for path templates. Captures string literals that look like
 * versioned API paths (e.g. `/v2/users/{id}`), including template-literal
 * and format-string placeholders.
 * @param {string} sdkText - Raw SDK source text.
 * @param {{maxTemplates?: number, minSegments?: number}} [options]
 * @returns {{templates: string[], findings: object[]}}
 */
export function extractSdkPathTemplates(sdkText = '', options = {}) {
  const { maxTemplates = 500, minSegments = 2 } = options;
  const text = String(sdkText || '');
  const templates = new Set();
  const patterns = [
    /["'`](\/[A-Za-z0-9_\-{}\[\]:<>/$.+]+)["'`]/g,
    /endpoint\s*[:=]\s*["'`]([^"'`]+)["'`]/gi,
    /url_for\(["'`]([^"'`]+)["'`]\)/gi,
    /url\s*[:=]\s*f?["'`](\/[^"'`\s]*)["'`]/gi,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(text)) !== null && templates.size < maxTemplates) {
      const candidate = m[1].trim();
      if (!candidate.startsWith('/') || candidate.length > 256) continue;
      const norm = normalizePathTemplate(candidate);
      if (norm.split('/').filter(Boolean).length < minSegments) continue;
      // Keep API-shaped candidates: versioned paths, placeholders, or
      // obvious API markers; drop static-asset leftovers.
      if (!/\/v\d+|\{\}|api|rest|graphql|webhook|_next\/data/i.test(norm)) continue;
      if (/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|map)$/i.test(norm)) continue;
      templates.add(norm);
    }
    if (templates.size >= maxTemplates) break;
  }
  const list = [...templates].sort();
  const findings = list.map(t => ({
    type: 'sdk-encoded-endpoint',
    confidence: 'high',
    evidence: `Path template "${t}" encoded in the published SDK source — SDKs carry the complete private API surface, including routes absent from public docs.`,
    template: t,
  }));
  return { templates: list, findings };
}

/**
 * Idea 01082 — recursively harvest HATEOAS/hypermedia controls from a
 * JSON response body. Follows `_links`, `links` (object or array form),
 * and HAL-style embedded link maps, returning a flat rel → href(s) map of
 * hidden state transitions.
 * @param {object} body - Parsed JSON response body.
 * @param {{maxDepth?: number, visitedHrefs?: Set<string>, rels?: object}} [options]
 * @returns {{rels: Object<string, string[]>, totalLinks: number}}
 */
export function harvestHateoasLinks(body, options = {}) {
  const { maxDepth = 6, visitedHrefs = new Set() } = options;
  const rels = {};
  const add = (rel, href) => {
    if (!href || typeof href !== 'string') return;
    const key = String(rel || 'self');
    if (!rels[key]) rels[key] = [];
    if (!rels[key].includes(href)) rels[key].push(href);
  };
  const walk = (node, depth) => {
    if (node === null || node === undefined || depth > maxDepth) return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1);
      return;
    }
    if (typeof node !== 'object') return;
    for (const linksKey of ['_links', 'links']) {
      const links = node[linksKey];
      if (links && typeof links === 'object') {
        if (Array.isArray(links)) {
          for (const l of links) {
            if (l && typeof l === 'object') add(l.rel, l.href || l.url);
          }
        } else {
          for (const [rel, l] of Object.entries(links)) {
            if (l && typeof l === 'object') add(rel, l.href || l.url);
            else add(rel, l);
          }
        }
      }
    }
    // HAL embedded resources are fetched by the agent as follow-up probes;
    // register their _links so the map stays complete without fetching here.
    if (node._embedded && typeof node._embedded === 'object') {
      for (const [key, embedded] of Object.entries(node._embedded)) {
        const items = Array.isArray(embedded) ? embedded : [embedded];
        for (const item of items) {
          const l = item && item._links;
          if (l) {
            for (const [rel, linkObj] of Object.entries(l)) {
              if (linkObj && typeof linkObj === 'object') add(`${key}:${rel}`, linkObj.href);
            }
          }
        }
      }
    }
    for (const v of Object.values(node)) {
      if (v && typeof v === 'object') walk(v, depth + 1);
    }
  };
  walk(body, 0);
  for (const hrefs of Object.values(rels)) {
    for (const h of hrefs) visitedHrefs.add(h);
  }
  return { rels, totalLinks: Object.values(rels).reduce((n, h) => n + h.length, 0) };
}

/**
 * Idea 01082 — build follow-up probe descriptors from a harvested
 * HATEOAS transition map so the agent can walk every hypermedia
 * transition the API self-documents.
 * @param {Object<string, string[]>} transitionMap - Output rels from harvestHateoasLinks.
 * @param {{method?: string}} [options]
 * @returns {{label: string, url: string, method: string, rel: string}[]}
 */
export function hateoasTransitionProbes(transitionMap = {}, options = {}) {
  const { method = 'GET' } = options;
  const probes = [];
  for (const [rel, hrefs] of Object.entries(transitionMap || {})) {
    for (const href of hrefs || []) {
      const url = String(href || '').trim();
      if (!url) continue;
      probes.push({ label: `hateoas:${rel}`, url, method, rel });
    }
  }
  return probes;
}

/**
 * Idea 01083 — parse an RFC 8288 Link response header into structured
 * link records.
 * @param {string} linkHeader - Raw Link header value.
 * @returns {{url: string, rel: string|null, params: Object<string,string>}[]}
 */
export function parseLinkHeader(linkHeader = '') {
  const header = String(linkHeader || '').trim();
  if (!header) return [];
  const links = [];
  // Split on commas that are NOT inside angle brackets.
  const parts = header.match(/<[^>]*>(?:\s*;\s*[^,<>]*)*/g) || [];
  for (const part of parts) {
    const m = part.match(/^<([^>]*)>\s*(;.*)?$/);
    if (!m) continue;
    const url = m[1].trim();
    const params = {};
    let rel = null;
    const rest = m[2] || '';
    const paramRe = /;\s*([A-Za-z][A-Za-z0-9-]*)\s*=\s*(?:"([^"]*)"|([^;]*))/g;
    let pm;
    while ((pm = paramRe.exec(rest)) !== null) {
      const name = pm[1].toLowerCase();
      const value = (pm[2] !== undefined ? pm[2] : pm[3] || '').trim();
      params[name] = value;
      if (name === 'rel') rel = value.split(/\s+/)[0] || null;
    }
    links.push({ url, rel, params });
  }
  return links;
}

/**
 * Idea 01083 — from a parsed Link header, extract the rel="next" URL and
 * build the next crawl-step probe descriptor so the agent can walk a
 * paginated collection to exhaustion.
 * @param {string} linkHeader - Raw Link header value from the current page.
 * @param {{method?: string, label?: string}} [options]
 * @returns {{hasNext: boolean, nextUrl: string|null, probe: object|null, allRels: string[]}}
 */
export function nextPageProbe(linkHeader = '', options = {}) {
  const { method = 'GET', label = 'link-header-pagination:next' } = options;
  const links = parseLinkHeader(linkHeader);
  const allRels = [...new Set(links.map(l => l.rel).filter(Boolean))];
  const next = links.find(l => l.rel === 'next');
  if (!next) return { hasNext: false, nextUrl: null, probe: null, allRels };
  return {
    hasNext: true,
    nextUrl: next.url,
    probe: {
      label,
      url: next.url,
      method,
      detect: 'paginated collection page — harvest object IDs from the body, then repeat with this page\'s Link header until hasNext is false',
    },
    allRels,
  };
}

/** Candidate changelog/release-notes probe paths. */
const CHANGELOG_PATHS = [
  '/changelog',
  '/changelogs',
  '/release-notes',
  '/releases',
  '/whats-new',
  '/whatsnew',
  '/api/changelog',
  '/api/release-notes',
  '/api/changes',
  '/docs/changelog',
  '/docs/release-notes',
  '/news',
];

/**
 * Idea 01084 — build probe descriptors for changelog / release-notes /
 * whats-new pages since changelogs name newly added and removed
 * endpoints.
 * @param {{extensions?: string[]}} [options]
 * @returns {{label: string, path: string, method: string, detect: string}[]}
 */
export function changelogProbes(options = {}) {
  const { extensions = ['', '.json', '.md'] } = options;
  const probes = [];
  for (const path of CHANGELOG_PATHS) {
    for (const ext of extensions) {
      probes.push({
        label: `changelog:${path}${ext || '(bare)'}`,
        path: `${path}${ext}`,
        method: 'GET',
        detect: 'endpoint mentions: look for Added/Removed/Deprecated lines naming API paths — diff against the documented spec',
      });
    }
  }
  return probes;
}

/**
 * Idea 01084 — extract added/removed/deprecated endpoint mentions from
 * changelog or release-notes text.
 * @param {string} changelogText - Raw changelog/release-notes text.
 * @param {{maxEndpoints?: number}} [options]
 * @returns {{added: string[], removed: string[], deprecated: string[], findings: object[]}}
 */
export function extractChangelogEndpoints(changelogText = '', options = {}) {
  const { maxEndpoints = 200 } = options;
  const text = String(changelogText || '');
  const added = new Set();
  const removed = new Set();
  const deprecated = new Set();
  const pathRe = /(\/[A-Za-z0-9_\-{}\/.:]+(?:\/[A-Za-z0-9_\-{}\/.:]+)*)/; // non-global: first path mention per line only
  const lineActionRe = /^\s*(?:[-*•#>]+\s*)?(added|new|introduced|removed|deleted|dropped|deprecated|retired|sunset)\b/i;
  for (const line of text.split('\n')) {
    const action = line.match(lineActionRe);
    if (!action) continue;
    const verb = action[1].toLowerCase();
    // One changelog line names one endpoint: capture the first path
    // mention only, so parenthetical replacements ("use /api/v2/auth")
    // are not misclassified.
    const pm = line.match(pathRe);
    if (!pm) continue;
    {
      const p = normalizePathTemplate(pm[1]);
      if (p.split('/').filter(Boolean).length < 2) continue;
      if (!/\/v\d+|\{\}|api|rest|graphql|webhook|endpoint/i.test(p)) continue;
      if (/^(added|new|introduced)$/.test(verb)) added.add(p);
      else if (/^(removed|deleted|dropped)$/.test(verb)) removed.add(p);
      else deprecated.add(p);
    }
  }
  const findings = [];
  for (const p of [...added].sort()) {
    findings.push({ type: 'changelog-added-endpoint', confidence: 'high', evidence: `Changelog reports endpoint "${p}" was added — verify it is documented and hardened.`, endpoint: p });
  }
  for (const p of [...removed].sort()) {
    findings.push({ type: 'changelog-removed-endpoint', confidence: 'high', evidence: `Changelog reports endpoint "${p}" was removed — retest it; removed routes frequently stay live.`, endpoint: p });
  }
  for (const p of [...deprecated].sort()) {
    findings.push({ type: 'changelog-deprecated-endpoint', confidence: 'medium', evidence: `Changelog marks endpoint "${p}" as deprecated — treat as a deprecated-but-live candidate.`, endpoint: p });
  }
  return { added: [...added].sort(), removed: [...removed].sort(), deprecated: [...deprecated].sort(), findings };
}

/**
 * Idea 01085 — parse statuspage.io (or compatible custom status API)
 * JSON into structured component/service intelligence: component IDs,
 * names, groups, and status — since status endpoints often leak internal
 * service names.
 * @param {string|object} statusJson - Status API response JSON (text or object).
 * @returns {{components: object[], groups: object[], pageName: string|null, findings: object[]}}
 */
export function parseStatusPageData(statusJson) {
  let data = statusJson;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return { components: [], groups: [], pageName: null, findings: [{ type: 'statuspage-parse-error', confidence: 'low', evidence: 'Status API response could not be parsed as JSON.' }] };
    }
  }
  const page = (data && data.page) || {};
  const components = Array.isArray(data && data.components) ? data.components : [];
  const groups = Array.isArray(data && data.component_groups) ? data.component_groups : [];
  const comps = components
    .filter(c => c && typeof c === 'object')
    .map(c => ({
      id: c.id == null ? null : String(c.id),
      name: c.name == null ? null : String(c.name),
      status: c.status == null ? null : String(c.status),
      groupId: c.group_id == null ? null : String(c.group_id),
      onlyShowIfDegraded: Boolean(c.only_show_if_degraded),
    }));
  const grpList = groups
    .filter(g => g && typeof g === 'object')
    .map(g => ({ id: g.id == null ? null : String(g.id), name: g.name == null ? null : String(g.name) }));
  const findings = [];
  for (const c of comps) {
    if (c.name && /api|internal|admin|service|backend|micro|worker|queue|db|cache|auth|gateway/i.test(c.name)) {
      findings.push({
        type: 'statuspage-internal-service-name',
        confidence: 'medium',
        evidence: `Status page exposes component "${c.name}" (id ${c.id}, status ${c.status}) — an internal service name/API backend candidate for the authorized target.`,
        component: c,
      });
    }
  }
  return {
    components: comps,
    groups: grpList,
    pageName: page.name == null ? null : String(page.name),
    findings,
  };
}

/**
 * Idea 01085 — build probe descriptors for statuspage.io and custom
 * status API endpoints.
 * @param {{host?: string}} [options]
 * @returns {{label: string, url: string, method: string, detect: string}[]}
 */
export function statusApiProbes(options = {}) {
  const { host = 'status.example.com' } = options;
  const paths = [
    '/api/v2/summary.json',
    '/api/v2/status.json',
    '/api/v2/components.json',
    '/api/v2/incidents/unresolved.json',
    '/api/v1/status',
    '/status.json',
    '/health',
  ];
  return paths.map(p => ({
    label: `status-api:${p}`,
    url: `https://${host}${p}`,
    method: 'GET',
    detect: 'status endpoint — parse component IDs and internal service names with parseStatusPageData',
  }));
}

/**
 * Idea 01086 — build probe descriptors for security.txt (RFC 9116) at
 * both the canonical and legacy locations.
 * @returns {{label: string, path: string, method: string, detect: string}[]}
 */
export function securityTxtProbes() {
  return [
    {
      label: 'security-txt:well-known',
      path: '/.well-known/security.txt',
      method: 'GET',
      detect: 'RFC 9116 contact file — parse in-scope hosts, testing policies, and contact URIs with parseSecurityTxt',
    },
    {
      label: 'security-txt:legacy',
      path: '/security.txt',
      method: 'GET',
      detect: 'legacy security.txt location — parse with parseSecurityTxt',
    },
  ];
}

/**
 * Idea 01086 — parse an RFC 9116 security.txt body into structured
 * fields, extracting in-scope API hosts and testing-policy hints from
 * Contact/Acknowledgments/Canonical URIs.
 * @param {string} securityTxt - Raw security.txt body.
 * @returns {{fields: Object<string, string[]>, contacts: string[], hosts: string[], expires: string|null, findings: object[]}}
 */
export function parseSecurityTxt(securityTxt = '') {
  const text = String(securityTxt || '');
  const fields = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Za-z-]+)\s*:\s*(.+?)\s*$/);
    if (!m) continue;
    const name = m[1];
    if (!fields[name]) fields[name] = [];
    fields[name].push(m[2]);
  }
  const contacts = [...(fields.Contact || []), ...(fields.Acknowledgments || []), ...(fields.Canonical || [])];
  const hosts = new Set();
  for (const c of contacts) {
    const hm = String(c).match(/https?:\/\/([^/\s"']+)/i);
    if (hm) hosts.add(hm[1].toLowerCase());
    const mm = String(c).match(/@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/);
    if (mm) hosts.add(mm[1].toLowerCase());
  }
  const expires = fields.Expires && fields.Expires[0] ? fields.Expires[0] : null;
  const findings = [];
  if (contacts.length) {
    findings.push({
      type: 'security-txt-scope-hint',
      confidence: 'medium',
      evidence: `security.txt lists ${contacts.length} contact/canonical reference(s) referencing host(s): ${[...hosts].join(', ') || 'none extractable'} — scope and testing-policy candidates for the engagement.`,
      contacts,
      hosts: [...hosts],
    });
  }
  if (fields['Preferred-Languages'] || fields.Hiring || fields.Policy) {
    findings.push({
      type: 'security-txt-policy-present',
      confidence: 'low',
      evidence: 'security.txt carries policy/hiring metadata — read the testing policy before probing any listed host.',
    });
  }
  return { fields, contacts, hosts: [...hosts], expires, findings };
}

/** Well-known discovery documents worth probing. */
const WELL_KNOWN_VARIANTS = [
  'openid-configuration',
  'oauth-authorization-server',
  'assetlinks.json',
  'apple-app-site-association',
  'change-password',
  'security.txt',
  'dnt-policy.txt',
  'gpc.json',
  'jwks.json',
  'webfinger',
  'nodeinfo',
  'host-meta',
  'host-meta.json',
  'trust.txt',
  'ai-plugin.json',
  'mta-sts.txt',
];

/**
 * Idea 01087 — build probe descriptors for /.well-known/* discovery
 * documents (openid-configuration, assetlinks, change-password, …)
 * since discovery documents reveal auth and API endpoints.
 * @param {{variants?: string[], method?: string}} [options]
 * @returns {{label: string, path: string, method: string, detect: string}[]}
 */
export function wellKnownProbes(options = {}) {
  const { variants = WELL_KNOWN_VARIANTS, method = 'GET' } = options;
  return (variants || []).map(v => ({
    label: `well-known:${v}`,
    path: `/.well-known/${v}`,
    method,
    detect: 'discovery document — mine for authorization_endpoint, jwks_uri, api hosts, and app deep-link endpoints',
  }));
}

/**
 * Idea 01087 — mine an openid-configuration / discovery JSON document
 * for endpoint URLs (authorization, token, jwks, userinfo, revocation,
 * issuer, registration).
 * @param {string|object} discoveryJson - Discovery document JSON (text or object).
 * @returns {{endpoints: Object<string, string>, findings: object[]}}
 */
export function mineDiscoveryDocument(discoveryJson) {
  let data = discoveryJson;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return { endpoints: {}, findings: [{ type: 'discovery-parse-error', confidence: 'low', evidence: 'Discovery document could not be parsed as JSON.' }] };
    }
  }
  const keys = [
    'issuer', 'authorization_endpoint', 'token_endpoint', 'userinfo_endpoint',
    'jwks_uri', 'registration_endpoint', 'revocation_endpoint',
    'introspection_endpoint', 'device_authorization_endpoint',
    'pushed_authorization_request_endpoint', 'end_session_endpoint',
    'check_session_iframe', 'mtls_endpoint_aliases',
  ];
  const endpoints = {};
  const walk = (node, prefix = '') => {
    if (!node || typeof node !== 'object') return;
    for (const [k, v] of Object.entries(node)) {
      const path = prefix ? `${prefix}.${k}` : k;
      if (typeof v === 'string' && /^https?:\/\//i.test(v)) {
        if (keys.some(key => k === key || k.endsWith('_endpoint') || k === 'jwks_uri' || k === 'issuer')) {
          endpoints[path] = v;
        }
      } else if (v && typeof v === 'object') {
        walk(v, path);
      }
    }
  };
  walk(data);
  const findings = Object.entries(endpoints).map(([k, v]) => ({
    type: 'well-known-auth-endpoint',
    confidence: 'high',
    evidence: `Discovery document reveals "${k}" → ${v} — an auth/API endpoint to include in the recon surface.`,
    field: k,
    url: v,
  }));
  return { endpoints, findings };
}

/**
 * Idea 01088 — parse a robots.txt body: extract Disallow/Allow entries,
 * flag route groups operators tried to hide (/api, /admin, /internal, …),
 * and harvest Sitemap: directives for follow-up.
 * @param {string} robotsTxt - Raw robots.txt body.
 * @param {{sensitivePatterns?: RegExp}} [options]
 * @returns {{disallows: string[], allows: string[], sitemaps: string[], sensitiveRoutes: string[], findings: object[]}}
 */
export function parseRobotsDisallows(robotsTxt = '', options = {}) {
  const { sensitivePatterns = /\/(api|admin|internal|private|staging|beta|debug|test|dev|console|manage|secure|auth|config|backup|tmp|old|new|v\d+|graphql)/i } = options;
  const text = String(robotsTxt || '');
  const disallows = [];
  const allows = [];
  const sitemaps = [];
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*(Disallow|Allow|Sitemap)\s*:\s*(\S+)\s*$/i);
    if (!m) continue;
    const directive = m[1].toLowerCase();
    const value = m[2];
    if (directive === 'disallow') disallows.push(value);
    else if (directive === 'allow') allows.push(value);
    else sitemaps.push(value);
  }
  const sensitiveRoutes = [...new Set(disallows.filter(d => sensitivePatterns.test(d)))].sort();
  const findings = sensitiveRoutes.map(r => ({
    type: 'robots-hidden-route',
    confidence: 'medium',
    evidence: `robots.txt Disallow entry "${r}" enumerates a route the operator wanted hidden — a recon candidate on the authorized target.`,
    route: r,
  }));
  return { disallows, allows, sitemaps, sensitiveRoutes, findings };
}

/**
 * Idea 01089 — build a probe descriptor for the target's sitemap index.
 * @returns {{label: string, path: string, method: string, detect: string}}
 */
export function sitemapProbe() {
  return {
    label: 'sitemap:index',
    path: '/sitemap.xml',
    method: 'GET',
    detect: 'sitemap XML — crawl <loc> entries for API-ish URLs with extractSitemapApiUrls',
  };
}

/**
 * Idea 01089 — extract <loc> URLs from sitemap XML text and filter to
 * API-ish candidates (JSON endpoints, /api paths, feeds, versioned
 * routes).
 * @param {string} sitemapXml - Raw sitemap.xml text.
 * @param {{maxUrls?: number}} [options]
 * @returns {{allUrls: string[], apiUrls: string[], findings: object[]}}
 */
export function extractSitemapApiUrls(sitemapXml = '', options = {}) {
  const { maxUrls = 1000 } = options;
  const text = String(sitemapXml || '');
  const allUrls = new Set();
  const locRe = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let m;
  while ((m = locRe.exec(text)) !== null && allUrls.size < maxUrls) {
    allUrls.add(m[1].trim());
  }
  const all = [...allUrls];
  const apiUrls = all
    .filter(u => /\/api[\w/-]*|\.json(\?|#|$)|\/feed|\/rss|\/v\d+\/|graphql|webhook/i.test(u))
    .sort();
  const findings = apiUrls.map(u => ({
    type: 'sitemap-api-url',
    confidence: 'medium',
    evidence: `Sitemap includes API-ish URL "${u}" — sitemaps occasionally expose JSON endpoints and feeds worth reconning.`,
    url: u,
  }));
  return { allUrls: all, apiUrls, findings };
}

/**
 * Idea 01090 — parse Wayback Machine CDX API response rows (plain text
 * "timestamp original" rows or parsed JSON row objects) into a deduped,
 * sorted list of unique historical paths for the target.
 * @param {string|object[]} cdxData - CDX API response: text rows or row objects.
 * @param {{maxPaths?: number}} [options]
 * @returns {{paths: string[], count: number, findings: object[]}}
 */
export function parseCdxRows(cdxData, options = {}) {
  const { maxPaths = 2000 } = options;
  const paths = new Set();
  const addUrl = raw => {
    const u = String(raw || '').trim();
    if (!u || u.length > 1024) return;
    try {
      const parsed = new URL(/^https?:\/\//i.test(u) ? u : `https://${u}`);
      const p = parsed.pathname || '/';
      if (p === '/') return;
      if (/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|map)$/i.test(p)) return;
      paths.add(p);
    } catch {
      // Not a parseable URL — ignore.
    }
  };
  if (typeof cdxData === 'string') {
    for (const line of cdxData.split('\n')) {
      if (paths.size >= maxPaths) break;
      const trimmed = line.trim();
      if (!trimmed) continue;
      // CDX text rows: "timestamp original ..." — the URL is the first
      // token containing a dot or slash; JSON-per-line rows handled too.
      if (trimmed.startsWith('{')) {
        try {
          const obj = JSON.parse(trimmed);
          if (obj && obj.url) addUrl(obj.url);
          else if (obj && obj.original) addUrl(obj.original);
        } catch {
          // ignore malformed line
        }
        continue;
      }
      const tokens = trimmed.split(/\s+/);
      const urlToken = tokens.find(t => t.includes('.') || t.includes('/')) || tokens[tokens.length - 1];
      addUrl(urlToken);
    }
  } else if (Array.isArray(cdxData)) {
    for (const row of cdxData) {
      if (paths.size >= maxPaths) break;
      if (!row) continue;
      if (typeof row === 'string') addUrl(row);
      else if (typeof row === 'object') addUrl(row.url || row.original);
    }
  }
  const list = [...paths].sort();
  const findings = list
    .filter(p => /\/v\d+|\/api|\{\}|graphql|webhook/i.test(p))
    .slice(0, 50)
    .map(p => ({
      type: 'wayback-historical-endpoint',
      confidence: 'medium',
      evidence: `Wayback CDX shows historical URL "${p}" — archived crawls preserve retired endpoints that may still be live today; retest on the authorized target.`,
      path: p,
    }));
  return { paths: list, count: list.length, findings };
}

/**
 * Idea 01090 — build the Wayback CDX API probe descriptor for a target
 * host so the agent's network layer can fetch the historical URL list.
 * @param {string} host - Target host (e.g. "api.example.com").
 * @param {{matchType?: string, limit?: number, collapse?: string}} [options]
 * @returns {{label: string, url: string, method: string, detect: string}}
 */
export function waybackCdxProbe(host = '', options = {}) {
  const { matchType = 'domain', limit = 5000, collapse = 'urlkey' } = options;
  const h = String(host || '').trim().replace(/^https?:\/\//i, '').split('/')[0];
  const params = new URLSearchParams({
    url: `${h}/*`,
    output: 'text',
    fl: 'timestamp,original',
    matchType,
    collapse,
    limit: String(limit),
  });
  return {
    label: `wayback-cdx:${h}`,
    url: `https://web.archive.org/cdx/search/cdx?${params.toString()}`,
    method: 'GET',
    detect: 'CDX rows — parse with parseCdxRows into a unique historical path list',
  };
}

/**
 * Build a uniform report finding from an API-discovery recon result.
 * @param {{title?: string, kind?: string, evidence?: string, targets?: string[], confidence?: string}} result
 * @returns {{title: string, severity: string, confidence: string, kind: string, evidence: string, targets: string[], recommendation: string}}
 */
export function apiDiscoveryReconFinding(result = {}) {
  const { title = 'API discovery recon finding', kind = 'recon', evidence = '', targets = [], confidence = 'medium' } = result;
  return {
    title: `API discovery recon — ${title}`,
    severity: 'Info',
    confidence,
    kind,
    evidence,
    targets: Array.isArray(targets) ? targets : [],
    recommendation:
      'Expand the documented API surface with the discovered routes: diff every discovered endpoint against the OpenAPI/spec, ' +
      'retire endpoints the changelog removed (return 410, remove routes), verify retired-but-archived routes are truly gone, ' +
      'keep robots.txt and sitemaps free of sensitive route leaks, and treat status-page and discovery-document metadata as part of the attack surface review.',
  };
}

/**
 * Named-const registry for deterministic access, mirroring house style.
 */
export const API_DISCOVERY_RECON = {
  normalizePathTemplate,
  extractSdkPathTemplates,
  harvestHateoasLinks,
  hateoasTransitionProbes,
  parseLinkHeader,
  nextPageProbe,
  changelogProbes,
  extractChangelogEndpoints,
  parseStatusPageData,
  statusApiProbes,
  securityTxtProbes,
  parseSecurityTxt,
  wellKnownProbes,
  mineDiscoveryDocument,
  parseRobotsDisallows,
  sitemapProbe,
  extractSitemapApiUrls,
  parseCdxRows,
  waybackCdxProbe,
  apiDiscoveryReconFinding,
};

export default API_DISCOVERY_RECON;
