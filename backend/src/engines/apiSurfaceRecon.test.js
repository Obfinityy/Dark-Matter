/**
 * apiSurfaceRecon.test.js — tests for the idea-bank wave 1271-1280 engine.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  WAVE1271_COVERAGE,
  ideaFunctions,
  diffAllowHeaders,
  discoverApiFromSrv,
  harvestApiSans,
  correlateShodanApiPorts,
  discoverAnalyticsEndpoints,
  testCorrelationIdReflection,
  diffHttp2VsHttp11,
  probeHttp3QuicSupport,
  huntSoapRestShims,
  discoverGraphqlRestFallbacks,
} from './apiSurfaceRecon.js';

describe('coverage registry', () => {
  it('declares all ten ideas', () => {
    assert.deepEqual(WAVE1271_COVERAGE, [1271, 1272, 1273, 1274, 1275, 1276, 1277, 1278, 1279, 1280]);
  });
  it('maps every idea number to an exported function', () => {
    const map = ideaFunctions();
    assert.equal(Object.keys(map).length, 10);
    assert.equal(map[1271], 'diffAllowHeaders');
    assert.equal(map[1279], 'huntSoapRestShims');
    assert.equal(map[1280], 'discoverGraphqlRestFallbacks');
  });
});

describe('1271 diffAllowHeaders', () => {
  it('flags state-dependent method exposure', () => {
    const res = diffAllowHeaders({
      states: [
        { label: 'anonymous', allowHeader: 'GET, HEAD, OPTIONS' },
        { label: 'authenticated', allowHeader: 'GET, HEAD, OPTIONS, PUT, DELETE' },
      ],
    });
    assert.ok(res.diffs.length >= 2);
    const del = res.diffs.find((d) => d.method === 'DELETE');
    assert.ok(del, 'DELETE diff should be reported');
    assert.deepEqual(del.presentIn, ['authenticated']);
    assert.deepEqual(del.missingFrom, ['anonymous']);
    assert.match(del.finding, /authz/i);
  });
  it('reports no diffs when headers are identical', () => {
    const res = diffAllowHeaders({
      states: [
        { label: 'a', allowHeader: 'GET, OPTIONS' },
        { label: 'b', allowHeader: 'get, options' },
      ],
    });
    assert.equal(res.diffs.length, 0);
    assert.match(res.findings.join(' '), /identical/i);
  });
  it('asks for more observations with a single state', () => {
    const res = diffAllowHeaders({ states: [{ label: 'a', allowHeader: 'GET' }] });
    assert.equal(res.diffs.length, 0);
    assert.match(res.findings.join(' '), /at least two/i);
  });
});

describe('1272 discoverApiFromSrv', () => {
  it('extracts API services and flags non-standard ports', () => {
    const res = discoverApiFromSrv({
      records: [
        { service: '_https', proto: 'tcp', port: 443, target: 'web.example.com' },
        { service: '_api', proto: 'tcp', port: 8443, target: 'internal-api.example.com' },
        { service: '_sip', proto: 'tcp', port: 5060, target: 'sip.example.com' },
      ],
    });
    assert.equal(res.apiServices.length, 2);
    const api = res.apiServices.find((s) => s.service === '_api');
    assert.equal(api.port, 8443);
    assert.equal(api.standardPort, false);
    assert.match(res.findings.join(' '), /non-standard/i);
  });
  it('handles no records gracefully', () => {
    const res = discoverApiFromSrv({});
    assert.equal(res.apiServices.length, 0);
    assert.match(res.findings.join(' '), /no srv records/i);
  });
  it('reports when no API-like services exist', () => {
    const res = discoverApiFromSrv({ records: [{ service: '_smtp', proto: 'tcp', port: 25, target: 'm.example.com' }] });
    assert.equal(res.apiServices.length, 0);
    assert.match(res.findings.join(' '), /none advertise/i);
  });
});

describe('1273 harvestApiSans', () => {
  it('classifies api/staging/admin hostnames', () => {
    const res = harvestApiSans({ sans: ['example.com', 'api.example.com', 'staging.example.com', 'admin.example.com', 'internal-db.example.com'] });
    assert.equal(res.totalSans, 5);
    assert.deepEqual(res.byCategory.api, ['api.example.com']);
    assert.deepEqual(res.byCategory.staging, ['staging.example.com']);
    assert.ok(res.interesting.includes('admin.example.com'));
    assert.match(res.findings.join(' '), /interesting hostnames/i);
  });
  it('dedupes and flags wildcards', () => {
    const res = harvestApiSans({ sans: ['*.example.com', '*.example.com', 'www.example.com'] });
    assert.equal(res.totalSans, 2);
    assert.match(res.findings.join(' '), /wildcard/i);
  });
  it('handles empty SAN lists', () => {
    const res = harvestApiSans({});
    assert.equal(res.totalSans, 0);
    assert.match(res.findings.join(' '), /nothing to harvest/i);
  });
});

describe('1274 correlateShodanApiPorts', () => {
  it('flags database ports on API hosts', () => {
    const res = correlateShodanApiPorts({
      banners: [
        { host: 'api.example.com', port: 443, service: 'https', banner: 'nginx' },
        { host: 'api.example.com', port: 3306, service: 'mysql', banner: 'MySQL 8.0' },
        { host: 'api.example.com', port: 6379, service: 'redis', banner: '' },
      ],
      webApiHosts: ['api.example.com'],
    });
    assert.equal(res.correlated.length, 2);
    assert.ok(res.correlated.every((c) => c.kind === 'database'));
    assert.match(res.findings.join(' '), /high priority/i);
  });
  it('detects gRPC listeners', () => {
    const res = correlateShodanApiPorts({
      banners: [{ host: 'api.example.com', port: 50051, service: 'grpc', banner: 'grpc-go' }],
    });
    assert.equal(res.correlated.length, 1);
    assert.equal(res.correlated[0].kind, 'grpc');
  });
  it('handles empty banners', () => {
    const res = correlateShodanApiPorts({});
    assert.equal(res.correlated.length, 0);
    assert.match(res.findings.join(' '), /no banner observations/i);
  });
});

describe('1275 discoverAnalyticsEndpoints', () => {
  it('discovers analytics paths from client references', () => {
    const res = discoverAnalyticsEndpoints({
      candidates: [
        { ref: '/api/track', source: 'app.js' },
        { ref: 'https://stats.example.com/collect', source: 'index.html' },
        { ref: '/static/logo.png', source: 'index.html' },
      ],
    });
    assert.equal(res.endpoints.length, 2);
    assert.ok(res.endpoints.some((e) => e.label === 'tracking'));
    assert.ok(res.endpoints.some((e) => e.label === 'collection'));
    assert.match(res.findings.join(' '), /client-controlled event data/i);
  });
  it('marks self-hosted collectors', () => {
    const res = discoverAnalyticsEndpoints({ candidates: [{ ref: '/plausible/api/event', source: 'app.js' }] });
    assert.equal(res.endpoints[0].selfHosted, true);
    assert.match(res.findings.join(' '), /self-hosted/i);
  });
  it('handles no candidates', () => {
    const res = discoverAnalyticsEndpoints({});
    assert.equal(res.endpoints.length, 0);
    assert.match(res.findings.join(' '), /not possible/i);
  });
});

describe('1276 testCorrelationIdReflection', () => {
  it('detects header reflection', () => {
    const res = testCorrelationIdReflection({
      probes: [
        { sentValue: 'probe-abc-123', reflectedValue: 'probe-abc-123', reflectedInHeader: true },
        { sentValue: 'probe-def-456', reflectedValue: null },
      ],
    });
    assert.equal(res.reflected, true);
    assert.equal(res.reflectedCount, 1);
    assert.equal(res.totalProbes, 2);
    assert.match(res.findings.join(' '), /1\/2 probe/i);
  });
  it('flags control-character reflection as log-injection surface', () => {
    const res = testCorrelationIdReflection({
      probes: [{ sentValue: 'x\r\nINJECTED', reflectedValue: 'x\r\nINJECTED', reflectedInBody: true }],
    });
    assert.equal(res.logInjectionSurface, true);
    assert.match(res.findings.join(' '), /log-injection/i);
  });
  it('reports clean when nothing is reflected', () => {
    const res = testCorrelationIdReflection({ probes: [{ sentValue: 'abc' }] });
    assert.equal(res.reflected, false);
    assert.match(res.findings.join(' '), /good hygiene/i);
  });
});

describe('1277 diffHttp2VsHttp11', () => {
  it('flags status and body-length differentials as HIGH', () => {
    const res = diffHttp2VsHttp11({
      http2: { status: 200, headers: { 'content-type': 'application/json' }, bodyLength: 128 },
      http11: { status: 400, headers: { 'content-type': 'application/json' }, bodyLength: 64 },
    });
    assert.ok(res.differences.some((d) => d.area === 'status-code' && d.significance.startsWith('HIGH')));
    assert.ok(res.differences.some((d) => d.area === 'body-length' && d.significance.startsWith('HIGH')));
    assert.match(res.findings.join(' '), /HIGH-significance/i);
  });
  it('flags version-only response headers', () => {
    const res = diffHttp2VsHttp11({
      http2: { status: 200, headers: { 'x-h2-only': 'yes' } },
      http11: { status: 200, headers: {} },
    });
    assert.ok(res.differences.some((d) => d.area === 'response-header'));
  });
  it('reports no differences when behavior matches', () => {
    const res = diffHttp2VsHttp11({
      http2: { status: 200, headers: { 'content-type': 'text/html' } },
      http11: { status: 200, headers: { 'Content-Type': 'text/html' } },
    });
    assert.equal(res.differences.length, 0);
    assert.match(res.findings.join(' '), /no behavioral differences/i);
  });
});

describe('1278 probeHttp3QuicSupport', () => {
  it('detects h3 advertisement in Alt-Svc', () => {
    const res = probeHttp3QuicSupport({ altSvcHeader: 'h3=":443"; ma=86400, h2=":443"' });
    assert.equal(res.quicEnabled, true);
    assert.match(res.signals.join(' '), /alt-svc/i);
    assert.match(res.findings.join(' '), /protocol-parity/i);
  });
  it('detects UDP/443 reachability', () => {
    const res = probeHttp3QuicSupport({ udp443Reachable: true });
    assert.equal(res.quicEnabled, true);
  });
  it('reports absent QUIC cleanly', () => {
    const res = probeHttp3QuicSupport({ udp443Reachable: false });
    assert.equal(res.quicEnabled, false);
    assert.match(res.findings.join(' '), /absent/i);
  });
});

describe('1279 huntSoapRestShims', () => {
  it('detects shim-like paths with SOAP markers', () => {
    const res = huntSoapRestShims({
      endpoints: [
        { path: '/api/soap-rest/users', contentType: 'application/soap+xml', bodySnippet: '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">' },
        { path: '/api/v2/users', contentType: 'application/json' },
      ],
    });
    assert.equal(res.shims.length, 1);
    assert.equal(res.shims[0].path, '/api/soap-rest/users');
    assert.ok(res.shims[0].indicators.includes('shim-like path'));
    assert.ok(res.shims[0].indicators.includes('SOAP envelope / soap+xml content marker'));
    assert.match(res.findings.join(' '), /translation boundary/i);
  });
  it('detects WSDL references', () => {
    const res = huntSoapRestShims({ endpoints: [{ path: '/services/billing?wsdl' }] });
    assert.equal(res.shims.length, 1);
  });
  it('reports clean when no shim indicators exist', () => {
    const res = huntSoapRestShims({ endpoints: [{ path: '/api/users', contentType: 'application/json' }] });
    assert.equal(res.shims.length, 0);
    assert.match(res.findings.join(' '), /no SOAP-to-REST shim indicators/i);
  });
});

describe('1280 discoverGraphqlRestFallbacks', () => {
  it('maps GraphQL operations to REST equivalents', () => {
    const res = discoverGraphqlRestFallbacks({
      graphqlOps: ['getUserProfile', 'createOrder'],
      restEndpoints: [
        { path: '/api/v1/user-profile', method: 'GET' },
        { path: '/api/v1/orders', method: 'POST' },
        { path: '/api/v1/health', method: 'GET' },
      ],
    });
    assert.ok(res.mappings.length >= 1);
    const m = res.mappings.find((x) => x.operation === 'getUserProfile');
    assert.ok(m, 'getUserProfile should map');
    assert.equal(m.restEndpoint, '/api/v1/user-profile');
    assert.match(m.note, /authz/i);
    assert.match(res.findings.join(' '), /different authz/i);
  });
  it('lists unmapped operations', () => {
    const res = discoverGraphqlRestFallbacks({
      graphqlOps: ['internalAdminThing'],
      restEndpoints: [{ path: '/api/users' }],
    });
    assert.equal(res.mappings.length, 0);
    assert.deepEqual(res.unmappedOperations, ['internalAdminThing']);
  });
  it('handles missing GraphQL operations', () => {
    const res = discoverGraphqlRestFallbacks({ restEndpoints: [] });
    assert.equal(res.mappings.length, 0);
    assert.match(res.findings.join(' '), /not possible/i);
  });
});
