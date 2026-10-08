/**
 * urlRoutingRecon.test.js — Tests for the URL routing recon engine (ideas 801-810).
 *
 * All fixtures are synthetic. Functions are pure and deterministic; no
 * network access. No exploit material — probes use benign markers only.
 *
 * Run: cd backend && node --test tests/urlRoutingRecon.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  REDIRECT_PARAM_NAMES,
  extractRedirectParamTargets,
  summarizeRedirectTargets,
  SHORTENER_DOMAINS,
  findShortenerLinks,
  buildExpansionPlan,
  recordExpansion,
  AFFILIATE_NETWORKS,
  mapAffiliateLinks,
  summarizeAffiliateNetworks,
  UTM_PARAM_NAMES,
  extractUtmParams,
  inferCampaignInfrastructure,
  SESSION_ID_PATTERNS,
  detectSessionIds,
  planSlashProbes,
  analyzeSlashRedirects,
  planCaseProbes,
  analyzeCaseResponses,
  ENCODED_CHAR_MAP,
  planEncodingProbes,
  analyzeNormalization,
  planDoubleEncodingProbes,
  analyzeDoubleEncoding,
  planSemicolonProbes,
  analyzeSemicolonResponses,
} from '../src/engines/urlRoutingRecon.js';

// ---------------------------------------------------------------------------
// Idea 801 — Redirect-parameter host extraction
// ---------------------------------------------------------------------------
describe('801: extractRedirectParamTargets', () => {
  it('extracts target hosts from known redirect parameters', () => {
    const out = extractRedirectParamTargets(
      ['https://shop.example.com/login?next=https%3A%2F%2Fevil.example%2Fphish'],
      'shop.example.com',
    );
    assert.equal(out.length, 1);
    assert.equal(out[0].param, 'next');
    assert.equal(out[0].targetHost, 'evil.example');
    assert.equal(out[0].isExternal, true);
  });

  it('classifies same-domain targets as internal', () => {
    const out = extractRedirectParamTargets(
      ['https://shop.example.com/login?return=/dashboard/home'],
      'shop.example.com',
    );
    assert.equal(out.length, 1);
    assert.equal(out[0].targetHost, 'shop.example.com');
    assert.equal(out[0].isExternal, false);
  });

  it('handles multiple redirect params across multiple urls', () => {
    const out = extractRedirectParamTargets([
      'https://a.example.com/?redirect_uri=https://b.example.com/x',
      'https://a.example.com/?continue=https%3A%2F%2Fc.example.com%2Fy&next=/z',
    ], 'a.example.com');
    assert.equal(out.length, 3);
    assert.deepEqual(out.map((f) => f.param).sort(), ['continue', 'next', 'redirect_uri']);
  });

  it('returns null targetHost for unparseable values', () => {
    const out = extractRedirectParamTargets(
      ['https://a.example.com/?next=not a valid host !'],
      'a.example.com',
    );
    assert.equal(out[0].targetHost, null);
  });

  it('ignores urls without redirect params and bad input', () => {
    assert.deepEqual(extractRedirectParamTargets(['https://a.example.com/?q=hello']), []);
    assert.deepEqual(extractRedirectParamTargets('nope'), []);
    assert.deepEqual(extractRedirectParamTargets([null, 42]), []);
  });

  it('REDIRECT_PARAM_NAMES contains common names', () => {
    assert.ok(REDIRECT_PARAM_NAMES.includes('next'));
    assert.ok(REDIRECT_PARAM_NAMES.includes('redirect_uri'));
  });
});

describe('801: summarizeRedirectTargets', () => {
  it('groups hosts per parameter and flags external params', () => {
    const findings = [
      { param: 'next', targetHost: 'a.example.com', isExternal: false },
      { param: 'next', targetHost: 'evil.example', isExternal: true },
      { param: 'return', targetHost: 'a.example.com', isExternal: false },
    ];
    const s = summarizeRedirectTargets(findings);
    assert.deepEqual(s.parameters.sort(), ['next', 'return']);
    assert.deepEqual(s.hostMap.next.sort(), ['a.example.com', 'evil.example']);
    assert.deepEqual(s.externalParams, ['next']);
    assert.equal(s.totalFindings, 3);
  });

  it('handles empty input', () => {
    const s = summarizeRedirectTargets([]);
    assert.deepEqual(s.parameters, []);
    assert.equal(s.totalFindings, 0);
  });
});

// ---------------------------------------------------------------------------
// Idea 802 — URL-shortener expansion mapping
// ---------------------------------------------------------------------------
describe('802: findShortenerLinks / buildExpansionPlan / recordExpansion', () => {
  const urls = [
    'https://bit.ly/3xAbC9',
    'https://www.example.com/page',
    'https://t.co/z9y8x7w6',
    'not-a-url',
  ];

  it('identifies shortener links with codes', () => {
    const links = findShortenerLinks(urls);
    assert.equal(links.length, 2);
    assert.equal(links[0].shortener, 'bit.ly');
    assert.equal(links[0].code, '3xAbC9');
    assert.equal(links[1].shortener, 't.co');
  });

  it('SHORTENER_DOMAINS is non-empty', () => {
    assert.ok(SHORTENER_DOMAINS.length > 5);
  });

  it('builds a deterministic expansion plan (no network)', () => {
    const plan = buildExpansionPlan(findShortenerLinks(urls));
    assert.equal(plan.length, 2);
    assert.equal(plan[0].method, 'HEAD');
    assert.ok(plan[0].action.includes('redirect'));
  });

  it('records an expansion to a destination host', () => {
    const links = findShortenerLinks(urls);
    const rec = recordExpansion(links[0], 'https://landing.example.com/offer?x=1');
    assert.equal(rec.destinationHost, 'landing.example.com');
    assert.equal(rec.expanded, true);
    assert.equal(rec.code, '3xAbC9');
  });

  it('marks unparseable final urls as not expanded', () => {
    const rec = recordExpansion({ url: 'https://bit.ly/x', shortener: 'bit.ly', code: 'x' }, '::garbage::');
    assert.equal(rec.expanded, false);
    assert.equal(rec.destinationHost, null);
  });

  it('handles empty/invalid input', () => {
    assert.deepEqual(findShortenerLinks([]), []);
    assert.deepEqual(findShortenerLinks(null), []);
    assert.deepEqual(buildExpansionPlan([]), []);
  });
});

// ---------------------------------------------------------------------------
// Idea 803 — Affiliate-link network mapping
// ---------------------------------------------------------------------------
describe('803: mapAffiliateLinks / summarizeAffiliateNetworks', () => {
  const urls = [
    'https://amzn.to/abc123',
    'https://www.example.com/blog',
    'https://www.awin1.com/cread.php?x=1',
    'https://go2cloud.org/aff_c?offer=2',
  ];

  it('maps links to networks', () => {
    const mapped = mapAffiliateLinks(urls);
    assert.equal(mapped.length, 3);
    const nets = mapped.map((m) => m.network);
    assert.ok(nets.includes('Amazon Associates'));
    assert.ok(nets.includes('Awin'));
    assert.ok(nets.includes('Impact'));
  });

  it('stops at first matching network per link', () => {
    const mapped = mapAffiliateLinks(['https://amzn.to/x']);
    assert.equal(mapped.length, 1);
    assert.equal(mapped[0].affiliateDomain, 'amzn.to');
  });

  it('summarizes per-network counts and domains', () => {
    const s = summarizeAffiliateNetworks(mapAffiliateLinks(urls));
    assert.deepEqual(s.networks.sort(), ['Amazon Associates', 'Awin', 'Impact']);
    assert.equal(s.byNetwork['Amazon Associates'].links, 1);
    assert.deepEqual(s.byNetwork['Awin'].domains, ['awin1.com']);
  });

  it('AFFILIATE_NETWORKS is populated and handles bad input', () => {
    assert.ok(AFFILIATE_NETWORKS.length > 5);
    assert.deepEqual(mapAffiliateLinks([]), []);
    assert.deepEqual(mapAffiliateLinks(null), []);
  });
});

// ---------------------------------------------------------------------------
// Idea 804 — UTM-parameter campaign inference
// ---------------------------------------------------------------------------
describe('804: extractUtmParams / inferCampaignInfrastructure', () => {
  it('extracts utm params from a url', () => {
    const u = extractUtmParams(
      'https://shop.example.com/p?utm_source=google&utm_medium=cpc&utm_campaign=summer_sale&utm_term=shoes&utm_content=banner1',
    );
    assert.equal(u.utm_source, 'google');
    assert.equal(u.utm_medium, 'cpc');
    assert.equal(u.utm_campaign, 'summer_sale');
    assert.equal(u.utm_term, 'shoes');
    assert.equal(u.utm_content, 'banner1');
    assert.equal(u.utm_id, '');
  });

  it('returns blanks for urls without utm params', () => {
    const u = extractUtmParams('https://shop.example.com/p?x=1');
    assert.deepEqual(Object.values(u), ['', '', '', '', '', '']);
  });

  it('groups links into campaigns with landing hosts', () => {
    const { campaigns, inferredInfra } = inferCampaignInfrastructure([
      'https://shop.example.com/a?utm_source=google&utm_medium=cpc&utm_campaign=summer',
      'https://shop.example.com/b?utm_source=google&utm_medium=cpc&utm_campaign=summer&utm_term=sneakers',
      'https://blog.example.com/c?utm_source=newsletter&utm_medium=email&utm_campaign=weekly',
      'https://shop.example.com/no-utm',
    ]);
    assert.equal(campaigns.length, 2);
    const summer = campaigns.find((c) => c.campaign === 'summer');
    assert.equal(summer.linkCount, 2);
    assert.deepEqual(summer.landingHosts, ['shop.example.com']);
    assert.deepEqual(summer.terms, ['sneakers']);
    assert.ok(inferredInfra.includes('ad-network:google'));
    assert.ok(inferredInfra.includes('shop.example.com'));
  });

  it('UTM_PARAM_NAMES covers the standard set', () => {
    assert.ok(UTM_PARAM_NAMES.includes('utm_campaign'));
  });

  it('handles bad input', () => {
    assert.deepEqual(inferCampaignInfrastructure([]).campaigns, []);
    assert.equal(extractUtmParams(null).utm_source, '');
  });
});

// ---------------------------------------------------------------------------
// Idea 805 — Session-ID URL-rewriting detection
// ---------------------------------------------------------------------------
describe('805: detectSessionIds', () => {
  it('detects PHPSESSID in query', () => {
    const out = detectSessionIds(['https://a.example.com/?PHPSESSID=abc123XYZ789']);
    assert.equal(out.length, 1);
    assert.equal(out[0].param, 'PHPSESSID');
    assert.equal(out[0].location, 'query');
    assert.equal(out[0].confidence, 'high');
  });

  it('detects JSESSIONID matrix-style in path', () => {
    const out = detectSessionIds(['https://a.example.com/app;jsessionid=DEFG456hij789']);
    assert.ok(out.some((f) => f.param === 'JSESSIONID'));
    assert.ok(out.some((f) => f.location === 'path'));
  });

  it('detects generic sid/token params', () => {
    const out = detectSessionIds([
      'https://a.example.com/?sid=QWERTY123456',
      'https://a.example.com/?session_token=zxcvbnm09876',
    ]);
    assert.equal(out.length, 2);
  });

  it('ignores placeholders and tiny values', () => {
    const out = detectSessionIds([
      'https://a.example.com/?sid=test',
      'https://a.example.com/?sid=1',
      'https://a.example.com/?page=about',
    ]);
    assert.equal(out.length, 0);
  });

  it('SESSION_ID_PATTERNS is populated; bad input safe', () => {
    assert.ok(SESSION_ID_PATTERNS.length >= 8);
    assert.deepEqual(detectSessionIds([]), []);
    assert.deepEqual(detectSessionIds(null), []);
  });
});

// ---------------------------------------------------------------------------
// Idea 806 — Trailing-slash redirect mapping
// ---------------------------------------------------------------------------
describe('806: planSlashProbes / analyzeSlashRedirects', () => {
  it('plans both slash variants', () => {
    const probes = planSlashProbes('/admin');
    assert.deepEqual(probes.map((p) => p.path).sort(), ['/admin', '/admin/']);
  });

  it('detects slash-adding behavior with framework hint', () => {
    const r = analyzeSlashRedirects('/admin', [
      { path: '/admin', status: 301, location: 'https://a.example.com/admin/' },
      { path: '/admin/', status: 200, location: null },
    ]);
    assert.equal(r.slashHandling, 'adds');
    assert.ok(r.frameworkHint.includes('Django'));
  });

  it('detects slash-removing behavior', () => {
    const r = analyzeSlashRedirects('/admin', [
      { path: '/admin/', status: 301, location: '/admin' },
      { path: '/admin', status: 200, location: null },
    ]);
    assert.equal(r.slashHandling, 'removes');
    assert.ok(r.frameworkHint.includes('Express'));
  });

  it('reports no canonicalization when variants route independently', () => {
    const r = analyzeSlashRedirects('/admin', [
      { path: '/admin', status: 200, location: null },
      { path: '/admin/', status: 200, location: null },
    ]);
    assert.equal(r.slashHandling, 'none');
    assert.equal(r.frameworkHint, null);
  });

  it('flags inconsistent behavior', () => {
    const r = analyzeSlashRedirects('/admin', [
      { path: '/admin', status: 301, location: '/admin/' },
      { path: '/admin/', status: 301, location: '/admin' },
    ]);
    assert.equal(r.slashHandling, 'inconsistent');
  });

  it('handles empty observations', () => {
    const r = analyzeSlashRedirects('/admin', []);
    assert.equal(r.slashHandling, 'unknown');
    assert.deepEqual(r.redirectMap, []);
  });
});

// ---------------------------------------------------------------------------
// Idea 807 — Case-sensitivity path probing
// ---------------------------------------------------------------------------
describe('807: planCaseProbes / analyzeCaseResponses', () => {
  it('plans distinct case variants', () => {
    const probes = planCaseProbes('/Admin/Panel');
    const paths = probes.map((p) => p.path);
    assert.ok(paths.includes('/admin/panel'));
    assert.ok(paths.includes('/ADMIN/PANEL'));
    assert.equal(new Set(paths).size, paths.length);
  });

  it('returns empty for blank path', () => {
    assert.deepEqual(planCaseProbes(''), []);
  });

  it('fingerprints case-insensitive routing', () => {
    const r = analyzeCaseResponses('/Admin', [
      { path: '/admin', status: 200, length: 100 },
      { path: '/ADMIN', status: 200, length: 100 },
    ]);
    assert.equal(r.caseSensitive, false);
    assert.ok(r.fingerprint.includes('case-insensitive'));
  });

  it('fingerprints case-sensitive routing', () => {
    const r = analyzeCaseResponses('/Admin', [
      { path: '/admin', status: 404, length: 50 },
      { path: '/ADMIN', status: 404, length: 50 },
    ]);
    assert.equal(r.caseSensitive, true);
    assert.ok(r.fingerprint.includes('case-sensitive'));
  });

  it('flags 403 variants as hidden-route hints', () => {
    const r = analyzeCaseResponses('/Admin', [
      { path: '/admin', status: 403, length: 50 },
      { path: '/ADMIN', status: 404, length: 50 },
    ]);
    assert.deepEqual(r.hiddenRouteHints, ['/admin']);
    assert.equal(r.caseSensitive, null); // mixed
  });

  it('handles no responses', () => {
    const r = analyzeCaseResponses('/Admin', []);
    assert.equal(r.caseSensitive, null);
    assert.equal(r.fingerprint, null);
  });
});

// ---------------------------------------------------------------------------
// Idea 808 — URL-encoded path normalization mapping
// ---------------------------------------------------------------------------
describe('808: planEncodingProbes / analyzeNormalization', () => {
  it('plans one probe per encoded char', () => {
    const probes = planEncodingProbes('/about');
    assert.equal(probes.length, ENCODED_CHAR_MAP.length);
    assert.ok(probes.every((p) => p.path.includes('%')));
  });

  it('ENCODED_CHAR_MAP uses benign characters only', () => {
    const banned = ['<', '>', '"', "'", '\\'];
    for (const e of ENCODED_CHAR_MAP) {
      assert.ok(!banned.includes(e.char), `unsafe char ${e.char}`);
    }
  });

  it('detects full decoding before routing', () => {
    const probes = planEncodingProbes('/about');
    const observations = probes.map((p) => ({
      label: p.label,
      status: 200,
      servedPath: `/a${p.char}out`,
    }));
    const r = analyzeNormalization(probes, observations);
    assert.equal(r.decodesBeforeRouting, true);
    assert.equal(r.normalizedChars.length, probes.length);
    assert.ok(r.layers.includes('single'));
  });

  it('detects no decoding', () => {
    const probes = planEncodingProbes('/about');
    const observations = probes.map((p) => ({ label: p.label, status: 404, servedPath: null }));
    const r = analyzeNormalization(probes, observations);
    assert.equal(r.decodesBeforeRouting, false);
  });

  it('detects partial normalization (layered stack)', () => {
    const probes = planEncodingProbes('/about');
    const observations = probes.map((p, i) => (i < 2
      ? { label: p.label, status: 200, servedPath: `/a${p.char}out` }
      : { label: p.label, status: 404, servedPath: null }));
    const r = analyzeNormalization(probes, observations);
    assert.equal(r.decodesBeforeRouting, true);
    assert.ok(r.layers.toLowerCase().includes('partial'));
  });

  it('handles empty observations', () => {
    const r = analyzeNormalization(planEncodingProbes('/about'), []);
    assert.equal(r.decodesBeforeRouting, null);
    assert.equal(r.layers, 'unknown');
  });
});

// ---------------------------------------------------------------------------
// Idea 809 — Double-encoding normalization analysis
// ---------------------------------------------------------------------------
describe('809: planDoubleEncodingProbes / analyzeDoubleEncoding', () => {
  it('plans single and double probes', () => {
    const probes = planDoubleEncodingProbes('/about');
    assert.equal(probes.length, 2);
    assert.ok(probes.some((p) => p.encoding === 'single' && p.path.includes('%41')));
    assert.ok(probes.some((p) => p.encoding === 'double' && p.path.includes('%2541')));
  });

  it('supports a custom benign character', () => {
    const probes = planDoubleEncodingProbes('/about', '~');
    assert.ok(probes.some((p) => p.path.includes('%257E')));
  });

  it('detects double decoding with WAF hint', () => {
    const probes = planDoubleEncodingProbes('/about');
    const r = analyzeDoubleEncoding(probes, [
      { label: probes[0].label, status: 200, servedPath: '/About' },
      { label: probes[1].label, status: 200, servedPath: '/About' },
    ]);
    assert.equal(r.doubleDecodingDetected, true);
    assert.ok(r.wafFingerprintHint);
  });

  it('flags asymmetric normalization', () => {
    const probes = planDoubleEncodingProbes('/about');
    const r = analyzeDoubleEncoding(probes, [
      { label: probes[0].label, status: 404, servedPath: null },
      { label: probes[1].label, status: 200, servedPath: '/About' },
    ]);
    assert.equal(r.doubleDecodingDetected, true);
    assert.ok(r.interpretation.includes('asymmetric'));
  });

  it('reports no double decoding when literal', () => {
    const probes = planDoubleEncodingProbes('/about');
    const r = analyzeDoubleEncoding(probes, [
      { label: probes[0].label, status: 200, servedPath: '/About' },
      { label: probes[1].label, status: 200, servedPath: '/%2541bout' },
    ]);
    assert.equal(r.doubleDecodingDetected, false);
    assert.equal(r.wafFingerprintHint, null);
  });

  it('requires both observations', () => {
    const probes = planDoubleEncodingProbes('/about');
    const r = analyzeDoubleEncoding(probes, [
      { label: probes[0].label, status: 200, servedPath: '/About' },
    ]);
    assert.equal(r.doubleDecodingDetected, null);
  });
});

// ---------------------------------------------------------------------------
// Idea 810 — Semicolon-parameter route splitting
// ---------------------------------------------------------------------------
describe('810: planSemicolonProbes / analyzeSemicolonResponses', () => {
  it('plans semicolon variants', () => {
    const probes = planSemicolonProbes('/account');
    assert.equal(probes.length, 4);
    assert.ok(probes.every((p) => p.path.includes(';')));
  });

  it('detects split behavior when statuses differ', () => {
    const r = analyzeSemicolonResponses('/account', [
      { label: 'semicolon-param', path: '/account;probe=1', status: 200, length: 90 },
      { label: 'semicolon-empty-param', path: '/account;', status: 404, length: 40 },
    ]);
    assert.equal(r.behavior, 'split');
    assert.equal(r.layerSplit, true);
  });

  it('detects unified behavior when all serve', () => {
    const r = analyzeSemicolonResponses('/account', [
      { label: 'semicolon-param', path: '/account;probe=1', status: 200, length: 90 },
      { label: 'semicolon-empty-param', path: '/account;', status: 200, length: 90 },
    ]);
    assert.equal(r.behavior, 'unified');
    assert.equal(r.layerSplit, false);
  });

  it('detects redirect canonicalization', () => {
    const r = analyzeSemicolonResponses('/account', [
      { label: 'semicolon-param', path: '/account;probe=1', status: 301, length: 0 },
    ]);
    assert.equal(r.behavior, 'redirect');
  });

  it('detects uniformly ignored segments', () => {
    const r = analyzeSemicolonResponses('/account', [
      { label: 'semicolon-param', path: '/account;probe=1', status: 404, length: 40 },
    ]);
    assert.equal(r.behavior, 'ignored');
  });

  it('handles no responses', () => {
    const r = analyzeSemicolonResponses('/account', []);
    assert.equal(r.behavior, 'unknown');
  });

  it('returns empty plan for blank path', () => {
    assert.deepEqual(planSemicolonProbes(''), []);
  });
});
