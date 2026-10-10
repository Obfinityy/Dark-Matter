import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
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
  API_DISCOVERY_RECON,
} from './apiDiscoveryRecon.js';

// ---------- Idea 01081: SDK source endpoint enumeration ----------

test('01081: extractSdkPathTemplates finds versioned path templates incl. /vN params', () => {
  const sdk = `
    const BASE = "/api/v1";
    async function getUser(userId) { return this.request("GET", "/v2/users/{id}"); }
    const PATH = '/v1/orgs/:orgId/repos';
    const tpl = \`/api/v3/orders/\${orderId}/items\`;
    const css = "/static/app.css";
  `;
  const { templates, findings } = extractSdkPathTemplates(sdk);
  assert.ok(templates.includes('/v2/users/{}'), `got ${templates}`);
  assert.ok(templates.includes('/v1/orgs/{}/repos'), `got ${templates}`);
  assert.ok(templates.includes('/api/v3/orders/{}/items'), `got ${templates}`);
  assert.ok(!templates.some(t => t.endsWith('.css')), 'static assets excluded');
  assert.equal(findings.length, templates.length);
  assert.equal(findings[0].type, 'sdk-encoded-endpoint');
});

test('01081: normalizePathTemplate collapses :id/{id} placeholders and queries', () => {
  assert.equal(normalizePathTemplate('https://api.example.com/v1/users/42?x=1'), '/v1/users/42');
  assert.equal(normalizePathTemplate('/v1/users/:id/'), '/v1/users/{}');
});

// ---------- Idea 01082: HATEOAS link harvesting ----------

test('01082: harvestHateoasLinks recursively flattens _links into a transition map', () => {
  const body = {
    _links: { self: { href: '/api/v1/orders/1' }, cancel: { href: '/api/v1/orders/1/cancel' } },
    items: [{ _links: { self: { href: '/api/v1/items/9' } } }],
  };
  const { rels, totalLinks } = harvestHateoasLinks(body);
  assert.deepEqual(rels.self.sort(), ['/api/v1/items/9', '/api/v1/orders/1']);
  assert.deepEqual(rels.cancel, ['/api/v1/orders/1/cancel']);
  assert.equal(totalLinks, 3);
});

test('01082: hateoasTransitionProbes builds probe descriptors per transition', () => {
  const probes = hateoasTransitionProbes({ cancel: ['/api/v1/orders/1/cancel'] });
  assert.equal(probes.length, 1);
  assert.equal(probes[0].url, '/api/v1/orders/1/cancel');
  assert.equal(probes[0].rel, 'cancel');
  assert.equal(probes[0].method, 'GET');
});

// ---------- Idea 01083: Link-header pagination crawl ----------

test('01083: parseLinkHeader parses RFC 8288 links with rel params', () => {
  const header = '<https://api.example.com/v1/users?page=2>; rel="next", <https://api.example.com/v1/users?page=9>; rel="last"';
  const links = parseLinkHeader(header);
  assert.equal(links.length, 2);
  assert.equal(links[0].url, 'https://api.example.com/v1/users?page=2');
  assert.equal(links[0].rel, 'next');
  assert.equal(links[1].rel, 'last');
});

test('01083: nextPageProbe returns the rel=next crawl-step probe', () => {
  const { hasNext, nextUrl, probe, allRels } = nextPageProbe(
    '<https://api.example.com/v1/users?page=2>; rel="next", <https://api.example.com/v1/users?page=1>; rel="prev"'
  );
  assert.equal(hasNext, true);
  assert.equal(nextUrl, 'https://api.example.com/v1/users?page=2');
  assert.equal(probe.url, nextUrl);
  assert.ok(allRels.includes('next') && allRels.includes('prev'));
});

test('01083: nextPageProbe reports hasNext=false when no next rel', () => {
  const r = nextPageProbe('<https://api.example.com/v1/users?page=1>; rel="first"');
  assert.equal(r.hasNext, false);
  assert.equal(r.probe, null);
});

// ---------- Idea 01084: API changelog endpoint discovery ----------

test('01084: changelogProbes covers changelog/release-notes/whats-new paths', () => {
  const probes = changelogProbes();
  const paths = probes.map(p => p.path);
  assert.ok(paths.includes('/changelog'));
  assert.ok(paths.includes('/release-notes'));
  assert.ok(paths.includes('/whats-new'));
  assert.ok(probes.every(p => p.method === 'GET' && p.detect.length > 0));
});

test('01084: extractChangelogEndpoints splits added vs removed endpoints', () => {
  const text = `
    ## v2.4.0
    - Added GET /api/v2/webhooks endpoint for event delivery
    - Removed /api/v1/legacy-auth (use /api/v2/auth)
    - Deprecated /api/v1/tokens
  `;
  const { added, removed, deprecated, findings } = extractChangelogEndpoints(text);
  assert.ok(added.includes('/api/v2/webhooks'), `added: ${added}`);
  assert.ok(removed.includes('/api/v1/legacy-auth'), `removed: ${removed}`);
  assert.ok(deprecated.includes('/api/v1/tokens'), `deprecated: ${deprecated}`);
  assert.equal(findings.length, 3);
  assert.ok(findings.some(f => f.type === 'changelog-removed-endpoint'));
});

// ---------- Idea 01085: Status-page API backend discovery ----------

test('01085: parseStatusPageData extracts components, ids and internal service names', () => {
  const json = JSON.stringify({
    page: { name: 'Acme Status' },
    components: [
      { id: 'abc123', name: 'Public API Gateway', status: 'operational', group_id: null, only_show_if_degraded: false },
      { id: 'def456', name: 'internal-billing-worker', status: 'operational', group_id: null, only_show_if_degraded: false },
    ],
    component_groups: [{ id: 'g1', name: 'Core' }],
  });
  const { components, groups, pageName, findings } = parseStatusPageData(json);
  assert.equal(pageName, 'Acme Status');
  assert.equal(components.length, 2);
  assert.equal(components[0].id, 'abc123');
  assert.equal(groups.length, 1);
  assert.ok(findings.some(f => f.type === 'statuspage-internal-service-name' && f.component.id === 'def456'));
});

test('01085: statusApiProbes targets statuspage API paths', () => {
  const probes = statusApiProbes({ host: 'status.acme.test' });
  assert.ok(probes.some(p => p.url === 'https://status.acme.test/api/v2/summary.json'));
  assert.ok(probes.some(p => p.url === 'https://status.acme.test/api/v2/components.json'));
});

// ---------- Idea 01086: Security.txt scope harvesting ----------

test('01086: securityTxtProbes covers both RFC 9116 locations', () => {
  const probes = securityTxtProbes();
  assert.equal(probes.length, 2);
  assert.ok(probes.some(p => p.path === '/.well-known/security.txt'));
  assert.ok(probes.some(p => p.path === '/security.txt'));
});

test('01086: parseSecurityTxt extracts hosts from Contact URIs', () => {
  const txt = `Contact: mailto:security@api.acme.test
Contact: https://api.acme.test/security-contact
Expires: 2027-01-01T00:00:00.000Z
Policy: https://acme.test/bug-bounty-policy
`;
  const { fields, contacts, hosts, expires, findings } = parseSecurityTxt(txt);
  assert.equal(fields.Contact.length, 2);
  assert.ok(hosts.includes('api.acme.test'), `hosts: ${hosts}`);
  assert.equal(expires, '2027-01-01T00:00:00.000Z');
  assert.ok(findings.some(f => f.type === 'security-txt-scope-hint'));
  assert.ok(findings.some(f => f.type === 'security-txt-policy-present'));
});

// ---------- Idea 01087: Well-known URI enumeration ----------

test('01087: wellKnownProbes enumerates discovery documents incl. openid-configuration', () => {
  const probes = wellKnownProbes();
  const paths = probes.map(p => p.path);
  assert.ok(paths.includes('/.well-known/openid-configuration'));
  assert.ok(paths.includes('/.well-known/assetlinks.json'));
  assert.ok(paths.includes('/.well-known/change-password'));
  assert.ok(probes.every(p => p.path.startsWith('/.well-known/')));
});

test('01087: mineDiscoveryDocument extracts auth/API endpoints', () => {
  const doc = JSON.stringify({
    issuer: 'https://auth.acme.test',
    authorization_endpoint: 'https://auth.acme.test/authorize',
    token_endpoint: 'https://auth.acme.test/token',
    jwks_uri: 'https://auth.acme.test/.well-known/jwks.json',
  });
  const { endpoints, findings } = mineDiscoveryDocument(doc);
  assert.equal(endpoints.token_endpoint, 'https://auth.acme.test/token');
  assert.equal(endpoints.jwks_uri, 'https://auth.acme.test/.well-known/jwks.json');
  assert.equal(findings.length, Object.keys(endpoints).length);
  assert.ok(findings.every(f => f.type === 'well-known-auth-endpoint'));
});

// ---------- Idea 01088: Robots.txt API disallow harvest ----------

test('01088: parseRobotsDisallows flags hidden /api /admin /internal routes', () => {
  const txt = `User-agent: *
Disallow: /api/internal/
Disallow: /admin/
Disallow: /internal/debug
Disallow: /public/
Allow: /public/help
Sitemap: https://acme.test/sitemap.xml
`;
  const { disallows, allows, sitemaps, sensitiveRoutes, findings } = parseRobotsDisallows(txt);
  assert.equal(disallows.length, 4);
  assert.deepEqual(allows, ['/public/help']);
  assert.deepEqual(sitemaps, ['https://acme.test/sitemap.xml']);
  assert.ok(sensitiveRoutes.includes('/api/internal/'));
  assert.ok(sensitiveRoutes.includes('/admin/'));
  assert.ok(sensitiveRoutes.includes('/internal/debug'));
  assert.ok(!sensitiveRoutes.includes('/public/'));
  assert.equal(findings.length, sensitiveRoutes.length);
});

// ---------- Idea 01089: Sitemap API route hints ----------

test('01089: extractSitemapApiUrls filters API-ish URLs from sitemap XML', () => {
  const xml = `<?xml version="1.0"?>
  <urlset><url><loc>https://acme.test/</loc></url>
  <url><loc>https://acme.test/api/v1/feed.json</loc></url>
  <url><loc>https://acme.test/about</loc></url>
  <url><loc>https://acme.test/blog/rss</loc></url></urlset>`;
  const { allUrls, apiUrls, findings } = extractSitemapApiUrls(xml);
  assert.equal(allUrls.length, 4);
  assert.ok(apiUrls.includes('https://acme.test/api/v1/feed.json'));
  assert.ok(apiUrls.includes('https://acme.test/blog/rss'));
  assert.ok(!apiUrls.includes('https://acme.test/about'));
  assert.equal(findings.length, apiUrls.length);
});

test('01089: sitemapProbe points at /sitemap.xml', () => {
  const probe = sitemapProbe();
  assert.equal(probe.path, '/sitemap.xml');
  assert.equal(probe.method, 'GET');
});

// ---------- Idea 01090: Wayback Machine API path harvest ----------

test('01090: parseCdxRows builds a unique path list from CDX text rows', () => {
  const cdx = `20200101000000 https://acme.test/api/v1/old-endpoint 200
20210601000000 https://acme.test/api/v1/old-endpoint 200
20220101000000 https://acme.test/assets/app.js 200
20230101000000 https://acme.test/api/v2/widgets 200`;
  const { paths, count, findings } = parseCdxRows(cdx);
  assert.ok(paths.includes('/api/v1/old-endpoint'));
  assert.ok(paths.includes('/api/v2/widgets'));
  assert.ok(!paths.includes('/assets/app.js'), 'static assets excluded');
  assert.equal(count, paths.length);
  assert.equal(paths.filter(p => p === '/api/v1/old-endpoint').length, 1, 'deduped');
  assert.ok(findings.some(f => f.path === '/api/v1/old-endpoint'));
});

test('01090: parseCdxRows accepts row objects with url fields', () => {
  const { paths } = parseCdxRows([{ url: 'https://acme.test/api/v9/retired' }]);
  assert.ok(paths.includes('/api/v9/retired'));
});

test('01090: waybackCdxProbe builds the CDX query URL', () => {
  const probe = waybackCdxProbe('api.acme.test');
  assert.ok(probe.url.startsWith('https://web.archive.org/cdx/search/cdx?'));
  assert.ok(probe.url.includes('api.acme.test'));
  assert.equal(probe.method, 'GET');
});

// ---------- Registry / finding ----------

test('registry exposes every idea capability and default export matches', () => {
  const names = Object.keys(API_DISCOVERY_RECON);
  for (const fn of [
    'extractSdkPathTemplates', 'harvestHateoasLinks', 'parseLinkHeader',
    'nextPageProbe', 'extractChangelogEndpoints', 'parseStatusPageData',
    'parseSecurityTxt', 'mineDiscoveryDocument', 'parseRobotsDisallows',
    'extractSitemapApiUrls', 'parseCdxRows',
  ]) {
    assert.ok(names.includes(fn), `missing ${fn}`);
  }
});

test('apiDiscoveryReconFinding builds a uniform report finding', () => {
  const f = apiDiscoveryReconFinding({ title: 'sdk surface', evidence: 'e', targets: ['/x'] });
  assert.ok(f.title.includes('API discovery recon'));
  assert.equal(f.severity, 'Info');
  assert.ok(f.recommendation.length > 20);
});
