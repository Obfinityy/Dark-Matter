/**
 * Tests for ideas 661-670: protocol fingerprinting + JS framework route mining.
 *
 * Covers backend/src/engines/protocolFingerprinting.js (ideas 661-667) and
 * backend/src/engines/jsFrameworkRouteMining.js (ideas 668-670).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeIcmpTimestampReply,
  analyzeAddressMaskReply,
  detectSynCookies,
  mapTcpFastOpen,
  isGreasedQuicVersion,
  mapQuicVersionNegotiation,
  correlateAltSvc,
  scoreServiceIdentity,
} from '../src/engines/protocolFingerprinting.js';

import {
  normalizeRoutePath,
  extractRouteParams,
  scoreRouteInterestingness,
  dedupeRoutes,
  extractReactRouterRoutes,
  extractVueRouterPaths,
  extractAngularRoutes,
  mineRoutes,
} from '../src/engines/jsFrameworkRouteMining.js';

// --- Idea 661: ICMP timestamp analysis ---------------------------------------

describe('idea 661 — analyzeIcmpTimestampReply', () => {
  it('flags no-reply as linux-bsd-family', () => {
    const r = analyzeIcmpTimestampReply({ originateMs: 1000, rttMs: 40 });
    assert.equal(r.responded, false);
    assert.equal(r.osHint, 'linux-bsd-family');
    assert.equal(r.timezoneHint, null);
  });

  it('detects windows-like receive/transmit behavior', () => {
    const r = analyzeIcmpTimestampReply({ originateMs: 1000000, receiveMs: 1000000, transmitMs: 1000010, rttMs: 40 });
    assert.equal(r.responded, true);
    assert.equal(r.osHint, 'windows-like');
    assert.ok(typeof r.clockSkewMs === 'number');
  });

  it('detects transmit-only embedded behavior', () => {
    const r = analyzeIcmpTimestampReply({ originateMs: 5000, receiveMs: 0, transmitMs: 5010, rttMs: 20 });
    assert.equal(r.osHint, 'embedded-legacy');
  });

  it('extracts a whole-hour timezone hint from local-time stacks', () => {
    // Target clock ~5h ahead of UTC (IST-style offset) plus 12ms noise.
    const originateMs = 1000000;
    const rttMs = 50;
    const transmitMs = originateMs + rttMs / 2 + 5 * 3600000 + 12;
    const r = analyzeIcmpTimestampReply({ originateMs, receiveMs: 0, transmitMs, rttMs });
    assert.equal(r.timezoneHint, '+05:00');
    assert.ok(r.notes.some((n) => n.includes('local time')));
  });

  it('gives no timezone hint for small skew', () => {
    const r = analyzeIcmpTimestampReply({ originateMs: 1000000, receiveMs: 0, transmitMs: 1000040, rttMs: 40 });
    assert.equal(r.timezoneHint, null);
  });
});

// --- Idea 662: ICMP address-mask probing -------------------------------------

describe('idea 662 — analyzeAddressMaskReply', () => {
  it('identifies legacy router on a /24 mask reply', () => {
    const r = analyzeAddressMaskReply({ mask: '255.255.255.0' });
    assert.equal(r.responded, true);
    assert.equal(r.legacy, true);
    assert.equal(r.prefixLength, 24);
    assert.ok(r.addressClass.includes('C'));
  });

  it('parses a /16 mask', () => {
    const r = analyzeAddressMaskReply({ mask: '255.255.0.0' });
    assert.equal(r.prefixLength, 16);
    assert.ok(r.addressClass.includes('B'));
  });

  it('treats no reply as modern', () => {
    const r = analyzeAddressMaskReply({});
    assert.equal(r.responded, false);
    assert.equal(r.legacy, false);
  });
});

// --- Idea 663: TCP SYN-cookie detection -------------------------------------

describe('idea 663 — detectSynCookies', () => {
  const offered = [{ kind: 2 }, { kind: 3 }, { kind: 4 }, { kind: 8 }];

  it('detects SYN cookies when all stateful options are dropped', () => {
    const r = detectSynCookies({ synOptions: offered, synAckOptions: [{ kind: 2 }], synAckMss: 1460 });
    assert.equal(r.synCookies, true);
    assert.equal(r.confidence, 'high');
    assert.equal(r.kernelHint, 'linux-like');
    assert.ok(r.loadHint.includes('high'));
    assert.deepEqual(r.evidence.missing, [3, 4, 8]);
  });

  it('reports no SYN cookies when options are echoed', () => {
    const r = detectSynCookies({ synOptions: offered, synAckOptions: offered, synAckMss: 1460 });
    assert.equal(r.synCookies, false);
    assert.equal(r.confidence, 'low');
    assert.equal(r.loadHint, 'normal (stateful handshake)');
  });

  it('is inconclusive on partial option echo', () => {
    const r = detectSynCookies({ synOptions: offered, synAckOptions: [{ kind: 2 }, { kind: 3 }], synAckMss: 1400 });
    assert.equal(r.synCookies, false);
    assert.ok(r.notes.some((n) => n.includes('inconclusive')));
  });
});

// --- Idea 664: TCP Fast Open mapping ----------------------------------------

describe('idea 664 — mapTcpFastOpen', () => {
  it('maps TFO support with an issued cookie', () => {
    const r = mapTcpFastOpen({ synAckOptions: [{ kind: 34, data: 'aabbccdd' }], requested: true });
    assert.equal(r.supported, true);
    assert.equal(r.hasCookie, true);
    assert.equal(r.cookieHex, 'aabbccdd');
    assert.equal(r.cookieLength, 4);
    assert.ok(r.stackHint.includes('modern'));
  });

  it('reports no TFO when the option is absent', () => {
    const r = mapTcpFastOpen({ synAckOptions: [{ kind: 2 }, { kind: 8 }], requested: true });
    assert.equal(r.supported, false);
    assert.equal(r.hasCookie, false);
    assert.equal(r.cookieHex, null);
  });
});

// --- Idea 665: QUIC version-negotiation mapping -----------------------------

describe('idea 665 — mapQuicVersionNegotiation', () => {
  it('identifies known, draft and greased versions', () => {
    const r = mapQuicVersionNegotiation({ endpoint: 'example.com:443', versions: [0x00000001, 0xff00001d, 0x1a2a3a4a] });
    assert.equal(r.versions.length, 3);
    assert.ok(r.versions[0].name.includes('RFC 9000'));
    assert.ok(r.versions[1].name.includes('draft-29'));
    assert.ok(r.versions[2].name.includes('GREASE'));
    assert.equal(r.modern, true);
    assert.ok(r.stackHint.includes('draft'));
  });

  it('flags Google gQUIC versions as legacy', () => {
    const r = mapQuicVersionNegotiation({ versions: [0x51303436] });
    assert.ok(r.versions[0].name.includes('Q046'));
    assert.equal(r.versions[0].modern, false);
    assert.ok(r.stackHint.includes('gQUIC'));
  });

  it('grease detection is exact', () => {
    assert.equal(isGreasedQuicVersion(0x1a2a3a4a), true);
    assert.equal(isGreasedQuicVersion(0x00000001), false);
    assert.equal(isGreasedQuicVersion(0x6b3343cf), false);
  });
});

// --- Idea 666: HTTP/3 Alt-Svc correlation ------------------------------------

describe('idea 666 — correlateAltSvc', () => {
  it('correlates advertisements against QUIC probes', () => {
    const r = correlateAltSvc({
      headers: { 'alt-svc': 'h3=":443"; ma=2592000, h3-29=":8443"' },
      quicProbes: [
        { port: 443, reachable: true, negotiatedVersion: 0x00000001 },
        { port: 8443, reachable: false },
        { port: 9443, reachable: true, negotiatedVersion: 0x00000001 },
      ],
    });
    assert.equal(r.advertised.length, 2);
    assert.equal(r.advertised[0].protocol, 'h3');
    assert.equal(r.advertised[0].maxAge, 2592000);
    const confirmed = r.correlations.find((c) => c.port === 443);
    assert.equal(confirmed.status, 'confirmed');
    const stale = r.correlations.find((c) => c.port === 8443);
    assert.equal(stale.status, 'advertised-unreachable');
    const undoc = r.correlations.find((c) => c.port === 9443);
    assert.equal(undoc.status, 'undocumented-quic');
    assert.equal(undoc.advertised, false);
  });

  it('handles a missing Alt-Svc header', () => {
    const r = correlateAltSvc({ headers: {}, quicProbes: [] });
    assert.deepEqual(r.advertised, []);
    assert.deepEqual(r.correlations, []);
  });
});

// --- Idea 667: service-identity confidence scoring ---------------------------

describe('idea 667 — scoreServiceIdentity', () => {
  it('combines agreeing signals into a medium-confidence score', () => {
    const r = scoreServiceIdentity({
      banner: { candidate: 'nginx', version: '1.24.0', confidence: 0.9 },
      behavior: { candidate: 'nginx', confidence: 0.8 },
      tls: { candidate: 'nginx', confidence: 0.6 },
      visual: { candidate: 'apache', confidence: 0.4 },
    });
    assert.equal(r.service, 'nginx');
    assert.equal(r.version, '1.24.0');
    assert.equal(r.score, 66);
    assert.equal(r.confidence, 'medium');
    assert.equal(r.agreement, '3/4');
    assert.ok(r.notes.some((n) => n.includes('disagree')));
    assert.equal(r.breakdown.length, 4);
  });

  it('reaches high confidence when all signals agree strongly', () => {
    const r = scoreServiceIdentity({
      banner: { candidate: 'caddy', version: '2.7', confidence: 1 },
      behavior: { candidate: 'caddy', confidence: 1 },
      tls: { candidate: 'caddy', confidence: 1 },
      visual: { candidate: 'caddy', confidence: 1 },
    });
    assert.equal(r.score, 100);
    assert.equal(r.confidence, 'high');
    assert.equal(r.agreement, '4/4');
  });

  it('returns zero score with no signals', () => {
    const r = scoreServiceIdentity({});
    assert.equal(r.service, null);
    assert.equal(r.score, 0);
    assert.equal(r.confidence, 'low');
  });
});

// --- Route mining helpers ---------------------------------------------------

describe('route mining helpers', () => {
  it('normalizeRoutePath cleans paths', () => {
    assert.equal(normalizeRoutePath(''), '/');
    assert.equal(normalizeRoutePath('admin/'), '/admin');
    assert.equal(normalizeRoutePath('//a//b//'), '/a/b');
    assert.equal(normalizeRoutePath('/users/:id'), '/users/:id');
  });

  it('extractRouteParams finds dynamic segments', () => {
    assert.deepEqual(extractRouteParams('/users/:id/posts/:postId'), ['id', 'postId']);
    assert.deepEqual(extractRouteParams('/static/page'), []);
  });

  it('scoreRouteInterestingness ranks sensitive routes higher', () => {
    assert.ok(scoreRouteInterestingness('/admin/users') > scoreRouteInterestingness('/about'));
    assert.ok(scoreRouteInterestingness('/api/graphql') > scoreRouteInterestingness('/contact'));
  });

  it('dedupeRoutes collapses duplicates by path', () => {
    const out = dedupeRoutes([
      { path: '/a', source: 'x', interestingness: 10 },
      { path: '/a/', source: 'y', interestingness: 99 },
      { path: '/b', source: 'x', interestingness: 5 },
    ]);
    assert.equal(out.length, 2);
    assert.equal(out.find((r) => r.path === '/a').source, 'y');
  });
});

// --- Idea 668: React Router extraction --------------------------------------

const REACT_BUNDLE = `
const router=createBrowserRouter([{path:"/",element:h},{path:"/dashboard",element:d},
{path:"/users/:id",lazy:()=>import("./views/User-abc123")}]);
function App(){return <Route path="/legacy" element={<Legacy/>}/>}
`;

describe('idea 668 — extractReactRouterRoutes', () => {
  it('extracts object routes, params and lazy chunks', () => {
    const r = extractReactRouterRoutes(REACT_BUNDLE);
    assert.equal(r.framework, 'react-router');
    assert.equal(r.routerType, 'browser');
    const paths = r.routes.map((x) => x.path);
    assert.ok(paths.includes('/'));
    assert.ok(paths.includes('/dashboard'));
    assert.ok(paths.includes('/users/:id'));
    assert.ok(paths.includes('/legacy'));
    const users = r.routes.find((x) => x.path === '/users/:id');
    assert.deepEqual(users.params, ['id']);
    assert.equal(users.dynamic, true);
    assert.equal(users.lazyChunk, './views/User-abc123');
    assert.ok(r.lazyChunks.includes('./views/User-abc123'));
    const legacy = r.routes.find((x) => x.path === '/legacy');
    assert.equal(legacy.source, 'jsx-route');
  });
});

// --- Idea 669: Vue Router harvesting ----------------------------------------

const VUE_BUNDLE = `
const router=createRouter({history:createWebHistory(),routes:[
{path:"/",name:"Home",component:H},
{path:"/admin",name:"Admin",component:()=>import("./Admin-xyz")},
{path:"/:catchAll(.*)",redirect:"/"}]});
router.addRoute({path:"/dynamic",component:D});
`;

describe('idea 669 — extractVueRouterPaths', () => {
  it('harvests route records, names and redirects', () => {
    const r = extractVueRouterPaths(VUE_BUNDLE);
    assert.equal(r.framework, 'vue-router');
    const paths = r.routes.map((x) => x.path);
    assert.ok(paths.includes('/'));
    assert.ok(paths.includes('/admin'));
    assert.ok(paths.includes('/dynamic'));
    const admin = r.routes.find((x) => x.path === '/admin');
    assert.equal(admin.name, 'Admin');
    assert.equal(r.redirects.length, 1);
    assert.equal(r.redirects[0].to, '/');
  });
});

// --- Idea 670: Angular route-config mining -----------------------------------

const ANGULAR_BUNDLE = `
const routes=[{path:"",redirectTo:"home",pathMatch:"full"},
{path:"home",component:H},
{path:"settings",loadChildren:()=>import("./settings-chunk").then(m=>m.SettingsModule),children:[{path:"profile",component:P}]},
{path:"**",component:NF}];
`;

describe('idea 670 — extractAngularRoutes', () => {
  it('mines paths, lazy modules, redirects and wildcards', () => {
    const r = extractAngularRoutes(ANGULAR_BUNDLE);
    assert.equal(r.framework, 'angular-router');
    const settings = r.routes.find((x) => x.fullPath === '/settings');
    assert.ok(settings);
    assert.equal(settings.lazyModule, './settings-chunk');
    assert.equal(settings.hasChildren, true);
    assert.ok(r.lazyModules.includes('./settings-chunk'));
    const wildcard = r.routes.find((x) => x.wildcard);
    assert.ok(wildcard);
    assert.equal(wildcard.fullPath, '/**');
    assert.deepEqual(r.redirects, [{ from: '/', to: '/home' }]);
  });
});

// --- mineRoutes auto-detection ------------------------------------------------

describe('mineRoutes', () => {
  it('detects react bundles and ranks interesting routes first', () => {
    const r = mineRoutes(REACT_BUNDLE);
    assert.ok(r.detected.includes('react-router'));
    assert.ok(r.allRoutes.length > 0);
    for (let i = 1; i < r.allRoutes.length; i++) {
      assert.ok(r.allRoutes[i - 1].interestingness >= r.allRoutes[i].interestingness);
    }
  });

  it('detects angular bundles', () => {
    const r = mineRoutes(ANGULAR_BUNDLE);
    assert.ok(r.detected.includes('angular-router'));
    assert.ok(r.allRoutes.some((x) => x.fullPath === '/settings'));
  });

  it('detects vue bundles', () => {
    const r = mineRoutes(VUE_BUNDLE);
    assert.ok(r.detected.includes('vue-router'));
  });

  it('returns empty for plain text', () => {
    const r = mineRoutes('hello world, no framework here');
    assert.deepEqual(r.detected, []);
    assert.deepEqual(r.allRoutes, []);
  });
});
