import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTrailingSlashProbePairs,
  analyzeTrailingSlashDifferential,
  GATEWAY_SIGNATURES,
  fingerprintGateway,
  summarizeGatewayIdentity,
  KONG_ADMIN_PORTS,
  buildKongAdminProbes,
  analyzeKongAdminExposure,
  AWS_STAGE_WORDLIST,
  buildApiGatewayStageProbes,
  analyzeStageEnumeration,
  buildApimPortalProbes,
  parseApimPortalListing,
  buildApimManagementProbes,
  analyzeApimManagementExposure,
  buildTykDiscoveryProbes,
  analyzeTykDiscovery,
  buildTraefikDashboardProbes,
  analyzeTraefikDashboard,
  ENVOY_ADMIN_PORTS,
  ENVOY_ADMIN_PATHS,
  buildEnvoyAdminProbes,
  analyzeEnvoyAdmin,
  routePatternToRegExp,
  samplePathsFromPattern,
  routesOverlap,
  mapRouteOverlaps,
  technique01131TrailingSlash,
  technique01132GatewayFingerprinting,
  technique01133KongAdmin,
  technique01134ApiGatewayStages,
  technique01135ApimPortal,
  technique01136ApimManagement,
  technique01137TykDiscovery,
  technique01138TraefikDashboard,
  technique01139EnvoyAdmin,
  technique01140RouteOverlap,
  gatewayReconFinding,
  GATEWAY_RECON_IDEAS,
  GATEWAY_RECON,
} from '../src/engines/gatewayRecon.js';

// ---- Idea 01131: trailing-slash normalization differential ----
test('01131 buildTrailingSlashProbePairs builds bare+slashed probes per path', () => {
  const probes = buildTrailingSlashProbePairs(['/api/admin', '/api/users/']);
  assert.equal(probes.length, 4);
  assert.equal(probes[0].url, '/api/admin');
  assert.equal(probes[1].url, '/api/admin/');
  assert.equal(probes[0].idea, '01131');
  assert.ok(probes[0].detect.length > 20);
  assert.deepEqual(buildTrailingSlashProbePairs(['', '  ', null]), []);
});

test('01131 analyzeTrailingSlashDifferential flags 403-vs-200 mismatch', () => {
  const records = [
    { path: '/api/admin', variant: 'bare', status: 403 },
    { path: '/api/admin', variant: 'slashed', status: 200 },
    { path: '/api/users', variant: 'bare', status: 200 },
    { path: '/api/users', variant: 'slashed', status: 200 },
    { path: '/api/redirect', variant: 'bare', status: 301, location: '/api/redirect/' },
    { path: '/api/redirect', variant: 'slashed', status: 200 },
    { path: '/api/half', variant: 'bare', status: 200 },
  ];
  const res = analyzeTrailingSlashDifferential(records);
  assert.equal(res.pairs.length, 4);
  assert.equal(res.mismatches.length, 1);
  assert.equal(res.mismatches[0].type, 'auth-bypass-candidate');
  assert.equal(res.findings[0].severity, 'High');
  const redirect = res.pairs.find((p) => p.path === '/api/redirect');
  assert.equal(redirect.behavior, 'redirect-normalization');
  const same = res.pairs.find((p) => p.path === '/api/users');
  assert.equal(same.behavior, 'direct-serve-both');
  const half = res.pairs.find((p) => p.path === '/api/half');
  assert.equal(half.behavior, 'incomplete');
});

// ---- Idea 01132: API gateway fingerprinting ----
test('01132 fingerprintGateway identifies Kong, AWS, Azure APIM and Envoy', () => {
  assert.equal(fingerprintGateway({ Server: 'kong/3.4.0' })[0].id, 'kong');
  assert.equal(fingerprintGateway({ 'X-Kong-Request-Id': 'abc' })[0].confidence, 'medium');
  assert.equal(fingerprintGateway({ Server: 'Apigee Router' })[0].id, 'apigee');
  assert.equal(fingerprintGateway({ 'x-amzn-RequestId': 'abc', 'x-amz-apigw-id': 'x' })[0].id, 'aws-apigateway');
  assert.equal(fingerprintGateway({ 'Ocp-Apim-Trace-Location': 'https://x' })[0].id, 'azure-apim');
  assert.equal(fingerprintGateway({ Server: 'envoy' })[0].id, 'envoy');
  assert.equal(fingerprintGateway({ Server: 'nginx' }).length, 0);
  assert.ok(GATEWAY_SIGNATURES.length >= 7);
});

test('01132 summarizeGatewayIdentity votes across samples', () => {
  const summary = summarizeGatewayIdentity([
    { headers: { Server: 'kong/3.4.0' } },
    { headers: { Server: 'kong/3.4.0', 'X-Kong-Upstream-Latency': '3' } },
    { headers: { Server: 'nginx' } },
  ]);
  assert.equal(summary.gateway, 'Kong');
  assert.equal(summary.matches, 2);
  assert.equal(summary.samples, 3);
  assert.ok(summary.quirks.length > 10);
  const none = summarizeGatewayIdentity([{ headers: { Server: 'nginx' } }]);
  assert.equal(none.gateway, null);
});

// ---- Idea 01133: Kong Admin API exposure check ----
test('01133 buildKongAdminProbes covers ports and admin paths', () => {
  const probes = buildKongAdminProbes({ host: 'target.example' });
  assert.ok(probes.length >= KONG_ADMIN_PORTS.length + 5);
  assert.ok(probes.some((p) => p.url === 'http://target.example:8001/'));
  assert.ok(probes.some((p) => p.url === 'http://target.example:8002/'));
  assert.ok(probes.every((p) => p.idea === '01133'));
  assert.deepEqual(buildKongAdminProbes({}), []);
});

test('01133 analyzeKongAdminExposure flags exposed admin JSON', () => {
  const res = analyzeKongAdminExposure([
    { url: 'http://t:8001/', status: 200, body: '{"version":"3.4.0","node_id":"abc","tag":"x"}' },
    { url: 'http://t:8002/', status: 403, body: '' },
    { url: 'https://t/admin/', status: 404, body: 'not found' },
  ]);
  assert.equal(res.exposed.length, 1);
  assert.equal(res.controlled.length, 1);
  assert.equal(res.closed.length, 1);
  assert.equal(res.findings[0].severity, 'Critical');
});

// ---- Idea 01134: AWS API Gateway stage enumeration ----
test('01134 buildApiGatewayStageProbes builds path and host probes', () => {
  const probes = buildApiGatewayStageProbes({ baseUrl: 'https://api.example.com/prod', stages: ['dev', 'prod'] });
  assert.equal(probes.length, 4);
  assert.ok(probes.some((p) => p.url === 'https://api.example.com/prod/dev'));
  assert.ok(probes.some((p) => p.headers.Host === 'dev.api.example.com'));
  assert.ok(AWS_STAGE_WORDLIST.includes('staging') && AWS_STAGE_WORDLIST.includes('v1'));
  const def = buildApiGatewayStageProbes({ baseUrl: 'https://api.example.com' });
  assert.equal(def.length, AWS_STAGE_WORDLIST.length * 2);
  assert.deepEqual(buildApiGatewayStageProbes({}), []);
});

test('01134 analyzeStageEnumeration flags auth drift', () => {
  const res = analyzeStageEnumeration([
    { stage: 'dev', style: 'path', status: 200, authRequired: false },
    { stage: 'prod', style: 'path', status: 401, authRequired: true },
    { stage: 'ghost', style: 'path', status: 404, authRequired: null },
  ]);
  assert.equal(res.active.length, 2);
  assert.equal(res.authDrift.length, 1);
  assert.equal(res.authDrift[0].stage, 'dev');
  assert.equal(res.findings[0].severity, 'High');
});

// ---- Idea 01135: Azure APIM developer portal check ----
test('01135 buildApimPortalProbes covers portal pages', () => {
  const probes = buildApimPortalProbes({ portalUrl: 'https://contoso.developer.azure-api.net' });
  assert.equal(probes.length, 6);
  assert.ok(probes.some((p) => p.url.endsWith('/apis')));
  assert.ok(probes.some((p) => p.url.endsWith('/subscriptions')));
  assert.deepEqual(buildApimPortalProbes({}), []);
});

test('01135 parseApimPortalListing extracts APIs and key hints', () => {
  const html = `<html><head><title>Developer portal</title></head><body>
    <script>window.apiManagement = {};</script>
    <a href="/apis/echo">Echo API</a>
    <a href="/products/starter">Starter product</a>
    <div>"displayName": "Orders API"</div>
    <div>Ocp-Apim-Subscription-Key: abcd1234efgh5678</div>
  </body></html>`;
  const res = parseApimPortalListing(html);
  assert.equal(res.portalMarkers, true);
  assert.ok(res.apis.includes('Echo API'));
  assert.ok(res.apis.includes('Orders API'));
  assert.ok(res.products.includes('Starter product'));
  assert.equal(res.keyHints.length, 1);
  assert.ok(res.keyHints[0].startsWith('Ocp-Apim-Subscription-Key'));
});

// ---- Idea 01136: APIM management API probe ----
test('01136 buildApimManagementProbes covers service and ARM styles', () => {
  const probes = buildApimManagementProbes({ serviceName: 'contoso' });
  assert.ok(probes.length >= 5);
  assert.ok(probes.some((p) => p.url.startsWith('https://contoso.management.azure-api.net/subscriptions')));
  assert.ok(probes.some((p) => p.url.includes('management.azure.com')));
  assert.ok(probes.every((p) => p.idea === '01136'));
  assert.deepEqual(buildApimManagementProbes({}), []);
});

test('01136 analyzeApimManagementExposure flags anonymous management JSON', () => {
  const res = analyzeApimManagementExposure([
    { url: 'https://x.management.azure-api.net/subscriptions?api-version=2021-08-01', status: 200, body: '{"value":[{"id":"/subscriptions/abc"}]}' },
    { url: 'https://x.management.azure-api.net/users?api-version=2021-08-01', status: 401, body: '' },
  ]);
  assert.equal(res.exposed.length, 1);
  assert.equal(res.controlled.length, 1);
  assert.equal(res.findings[0].severity, 'Critical');
});

// ---- Idea 01137: Tyk gateway discovery ----
test('01137 buildTykDiscoveryProbes covers hello and admin paths', () => {
  const probes = buildTykDiscoveryProbes({ baseUrl: 'https://gw.example.com' });
  assert.equal(probes.length, 5);
  assert.ok(probes.some((p) => p.url === 'https://gw.example.com/hello'));
  assert.ok(probes.some((p) => p.url === 'https://gw.example.com/tyk/apis'));
  assert.deepEqual(buildTykDiscoveryProbes({}), []);
});

test('01137 analyzeTykDiscovery identifies gateway and flags exposed admin', () => {
  const res = analyzeTykDiscovery([
    { url: 'https://gw/hello', status: 200, body: '{"status":"pass","version":"5.2.0","description":"Tyk GW"}' },
    { url: 'https://gw/tyk/apis', status: 200, body: '{"api_id":"1","listen_path":"/api/","auth":{"auth_header_name":"x-key"}}' },
    { url: 'https://gw/tyk/reload', status: 403, body: '' },
  ]);
  assert.equal(res.identified, true);
  assert.equal(res.version, '5.2.0');
  assert.equal(res.exposed.length, 1);
  assert.equal(res.findings[0].severity, 'Critical');
  const quiet = analyzeTykDiscovery([
    { url: 'https://gw/hello', status: 200, body: '{"status":"pass","description":"Tyk GW"}' },
    { url: 'https://gw/tyk/apis', status: 403, body: '' },
  ]);
  assert.equal(quiet.findings[0].type, 'tyk-identified');
  assert.equal(quiet.findings[0].severity, 'Info');
});

// ---- Idea 01138: Traefik dashboard API check ----
test('01138 buildTraefikDashboardProbes covers dashboard and API paths', () => {
  const probes = buildTraefikDashboardProbes({ baseUrl: 'https://edge.example.com' });
  assert.equal(probes.length, 6);
  assert.ok(probes.some((p) => p.url.endsWith('/api/rawdata')));
  assert.ok(probes.some((p) => p.url.endsWith('/dashboard/')));
  assert.deepEqual(buildTraefikDashboardProbes({}), []);
});

test('01138 analyzeTraefikDashboard flags exposed rawdata and extracts routers', () => {
  const res = analyzeTraefikDashboard([
    {
      url: 'https://edge/api/rawdata', status: 200,
      body: '{"routers":{"api@docker":{"entryPoints":["web"],"service":"api"}},"services":{"api":{"servers":["http://10.0.0.5:8080"]}}}',
    },
    { url: 'https://edge/dashboard/', status: 401, body: '' },
  ]);
  assert.equal(res.exposed.length, 1);
  assert.ok(res.routers.includes('api@docker'));
  assert.ok(res.services.includes('http://10.0.0.5:8080'));
  assert.equal(res.findings[0].severity, 'High');
});

// ---- Idea 01139: Envoy admin interface probe ----
test('01139 buildEnvoyAdminProbes covers admin ports and paths', () => {
  const probes = buildEnvoyAdminProbes({ host: 'edge.example' });
  assert.equal(probes.length, ENVOY_ADMIN_PORTS.length * ENVOY_ADMIN_PATHS.length + 1);
  assert.ok(probes.some((p) => p.url === 'http://edge.example:9901/server_info'));
  assert.ok(probes.some((p) => p.url === 'http://edge.example:15000/config_dump'));
  assert.ok(probes.some((p) => p.url === 'https://edge.example/admin'));
  assert.deepEqual(buildEnvoyAdminProbes({}), []);
});

test('01139 analyzeEnvoyAdmin flags exposed config dump', () => {
  const res = analyzeEnvoyAdmin([
    { url: 'http://edge:9901/config_dump', status: 200, body: '{"configs":[{"@type":"type.googleapis.com/envoy.admin.v3.RoutesConfigDump"}]}' },
    { url: 'http://edge:9901/stats', status: 403, body: '' },
    { url: 'http://edge:9901/clusters', status: 200, body: '{"cluster_statuses":[]}' },
  ]);
  assert.equal(res.exposed.length, 1);
  assert.equal(res.findings[0].severity, 'High');
});

// ---- Idea 01140: gateway route-overlap detection ----
test('01140 routesOverlap detects wildcard/param overlap, rejects disjoint', () => {
  assert.equal(routesOverlap('/api/*', '/api/users/:id'), true);
  assert.equal(routesOverlap('/api/users/:id', '/api/users/list'), true);
  assert.equal(routesOverlap('/api/users', '/api/admin'), false);
  assert.equal(routesOverlap('/api/**', '/api/v1/users'), true);
  assert.equal(routesOverlap('', '/api/x'), false);
});

test('01140 mapRouteOverlaps flags auth-gap candidate pairs', () => {
  const res = mapRouteOverlaps([
    { id: 'r1', pattern: '/api/*', auth: 'required', source: 'kong' },
    { id: 'r2', pattern: '/api/public/:id', auth: 'none', source: 'kong' },
    { id: 'r3', pattern: '/internal/*', auth: 'required', source: 'kong' },
  ]);
  assert.equal(res.pairs.length, 1);
  assert.equal(res.authGaps.length, 1);
  assert.equal(res.authGaps[0].authGapCandidate, true);
  assert.equal(res.findings[0].severity, 'High');
  const clean = mapRouteOverlaps([
    { id: 'a', pattern: '/api/*', auth: 'required' },
    { id: 'b', pattern: '/api/public/*', auth: 'required' },
  ]);
  assert.equal(clean.pairs.length, 1);
  assert.equal(clean.authGaps.length, 0);
  assert.equal(clean.findings.length, 0);
});

test('01140 samplePathsFromPattern and routePatternToRegExp round-trip', () => {
  const re = routePatternToRegExp('/api/users/:id');
  assert.ok(re instanceof RegExp);
  assert.ok(re.test('/api/users/42'));
  assert.ok(!re.test('/api/admin/42'));
  const samples = samplePathsFromPattern('/api/*');
  assert.ok(samples.length >= 1 && samples.every((s) => s.startsWith('/')));
  assert.equal(routePatternToRegExp(''), null);
});

// ---- Technique drivers + registries: 10/10 coverage ----
test('GATEWAY_RECON_IDEAS maps all 10 ideas 01131-01140 to functions', () => {
  const keys = Object.keys(GATEWAY_RECON_IDEAS).sort();
  assert.deepEqual(keys, ['01131', '01132', '01133', '01134', '01135', '01136', '01137', '01138', '01139', '01140']);
  for (const fn of Object.values(GATEWAY_RECON_IDEAS)) {
    assert.equal(typeof fn, 'function');
  }
});

test('each technique driver returns idea number, title, and callable analyze', () => {
  assert.equal(technique01131TrailingSlash(['/a']).idea, '01131');
  assert.equal(technique01131TrailingSlash(['/a']).probes.length, 2);
  assert.equal(typeof technique01131TrailingSlash(['/a']).analyze, 'function');

  const t32 = technique01132GatewayFingerprinting([{ headers: { Server: 'kong/3.0' } }]);
  assert.equal(t32.idea, '01132');
  assert.equal(t32.summary.gateway, 'Kong');

  assert.equal(technique01133KongAdmin({ host: 'h' }).idea, '01133');
  assert.ok(technique01133KongAdmin({ host: 'h' }).probes.length > 0);

  const t34 = technique01134ApiGatewayStages({ baseUrl: 'https://x' });
  assert.equal(t34.idea, '01134');
  assert.equal(t34.wordlist, AWS_STAGE_WORDLIST);

  const t35 = technique01135ApimPortal({ portalUrl: 'https://x' });
  assert.equal(t35.idea, '01135');
  assert.equal(t35.probes.length, 6);

  assert.equal(technique01136ApimManagement({ serviceName: 's' }).idea, '01136');
  assert.equal(technique01137TykDiscovery({ baseUrl: 'https://x' }).idea, '01137');
  assert.equal(technique01138TraefikDashboard({ baseUrl: 'https://x' }).idea, '01138');
  assert.equal(technique01139EnvoyAdmin({ host: 'h' }).idea, '01139');

  const t40 = technique01140RouteOverlap([{ id: 'r1', pattern: '/a/*', auth: 'required' }, { id: 'r2', pattern: '/a/b', auth: 'none' }]);
  assert.equal(t40.idea, '01140');
  assert.equal(t40.result.authGaps.length, 1);
});

test('gatewayReconFinding builds a uniform finding', () => {
  const f = gatewayReconFinding({ title: 'Kong admin exposed', severity: 'Critical', evidence: 'e', targets: ['http://t:8001/'] });
  assert.equal(f.title, 'Gateway recon — Kong admin exposed');
  assert.equal(f.severity, 'Critical');
  assert.ok(f.recommendation.length > 20);
});

test('GATEWAY_RECON registry exposes every export', () => {
  const names = [
    'buildTrailingSlashProbePairs', 'analyzeTrailingSlashDifferential',
    'fingerprintGateway', 'summarizeGatewayIdentity',
    'buildKongAdminProbes', 'analyzeKongAdminExposure',
    'buildApiGatewayStageProbes', 'analyzeStageEnumeration',
    'buildApimPortalProbes', 'parseApimPortalListing',
    'buildApimManagementProbes', 'analyzeApimManagementExposure',
    'buildTykDiscoveryProbes', 'analyzeTykDiscovery',
    'buildTraefikDashboardProbes', 'analyzeTraefikDashboard',
    'buildEnvoyAdminProbes', 'analyzeEnvoyAdmin',
    'routePatternToRegExp', 'routesOverlap', 'mapRouteOverlaps',
    'gatewayReconFinding', 'GATEWAY_RECON_IDEAS',
  ];
  for (const n of names) {
    assert.ok(GATEWAY_RECON[n] !== undefined, `missing registry entry: ${n}`);
  }
});
