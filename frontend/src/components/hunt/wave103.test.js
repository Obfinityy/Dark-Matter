/**
 * wave103.test.js — Infinity AI · Wave 103
 * node:test + node:assert/strict. Registry coverage (20/20 for 54081–54100,
 * 20/20 for 54101–54120, zero skips, 40/40 combined), registry titles matched
 * against the idea bank, deterministic spot-checks of every pure function
 * (at least one assertion per idea), a JSX-core call-shape audit (every
 * exported component calls at least one exported core function), Wave103.css
 * scope audits, a real esbuild JSX parse audit, a
 * no-branding-leak audit (Infinity AI only) and a no-debris audit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { WAVE103_A_IDEAS } from './wave103ACore.js';
import * as X103A from './wave103ACore.js';
import { WAVE103_B_IDEAS } from './wave103BCores.js';
import * as X103B from './wave103BCores.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const A_SRC = readFileSync(join(DIR, 'wave103ACore.js'), 'utf8');
const B_SRC = readFileSync(join(DIR, 'wave103BCores.js'), 'utf8');
const A_JSX = readFileSync(join(DIR, 'Wave103A.jsx'), 'utf8');
const B_JSX = readFileSync(join(DIR, 'Wave103B.jsx'), 'utf8');
const CSS_SRC = readFileSync(join(DIR, 'Wave103.css'), 'utf8');
const BRAND_SRC = [['A core', A_SRC], ['B core', B_SRC], ['A jsx', A_JSX], ['B jsx', B_JSX], ['css', CSS_SRC]];

test('registry: 20/20 wave 103A ideas, 20/20 wave 103B ideas, zero skips', () => {
  assert.equal(WAVE103_A_IDEAS.length, 20);
  assert.equal(WAVE103_B_IDEAS.length, 20);
  const all = [...WAVE103_A_IDEAS, ...WAVE103_B_IDEAS];
  assert.equal(all.length, 40);
  const ids = all.map(i => i.id);
  assert.deepEqual(ids, Array.from({ length: 40 }, (_, k) => 54081 + k));
  for (const idea of all) {
    assert.equal(idea.skip, false, `idea ${idea.id} skipped`);
    assert.ok(idea.title && idea.title.length > 3, `idea ${idea.id} missing title`);
  }
});

test('registry: titles match idea-bank wording', () => {
  const byId = Object.fromEntries([...WAVE103_A_IDEAS, ...WAVE103_B_IDEAS].map(i => [i.id, i.title.toLowerCase()]));
  const expected = {
    54081: 'time-boxed scope rules',
    54082: 'scope rule comments',
    54083: 'scope rule @mentions',
    54084: 'scope statistics header',
    54085: 'uncovered asset warnings',
    54086: 'scope coverage meter',
    54087: 'scope simulation against inventory',
    54088: 'scope search',
    54089: 'punycode/idn handling',
    54090: 'case-insensitivity toggle',
    54091: 'trailing-slash normalization',
    54092: 'query-parameter scoping',
    54093: 'geo-based scoping',
    54094: 'asn-based scoping',
    54095: 'scope notes per rule',
    54096: 'scope audit trail',
    54097: 'scope change notifications',
    54098: 'scope conflict highlighting',
    54099: 'scope rule scheduling',
    54100: 'header-based scoping',
    54101: 'cookie-based scoping',
    54102: 'third-party exclusion helper',
    54103: 'scope review reminders',
    54104: 'scope sign-off record',
    54105: 'card grid view',
    54106: 'dense table view',
    54107: 'kanban by lifecycle',
    54108: 'risk heatmap view',
    54109: 'geo map view',
    54110: 'health summary widget',
    54111: 'needs-verification widget',
    54112: 'stale targets widget',
    54113: 'expiring scopes widget',
    54114: 'top risky targets widget',
    54115: 'recent activity feed',
    54116: 'hunt coverage gauge',
    54117: 'findings-by-severity mini bars',
    54118: 'trend sparklines',
    54119: 'quick filters bar',
    54120: 'saved dashboard layouts',
  };
  for (const [id, title] of Object.entries(expected)) {
    assert.equal(byId[id], title, `idea ${id} title mismatch`);
  }
});

// --- Wave 103A spot checks (one per idea) ---
test('54081 applyTimeBoxedScopeRules activates in-window rules', () => {
  const v = X103A.applyTimeBoxedScopeRules([
    { pattern: '*.example.com', startsOn: '2026-01-01', endsOn: '2026-12-31', checkOn: '2026-06-15' },
    { pattern: 'legacy.example.com', startsOn: '2025-01-01', endsOn: '2025-12-31', checkOn: '2026-06-15' },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.activeCount, 1);
  assert.equal(v.expiredCount, 1);
  assert.equal(v.top.pattern, '*.example.com');
});
test('54082 buildScopeRuleComments counts open threads', () => {
  const v = X103A.buildScopeRuleComments([
    { ruleId: 'rule-1', comments: [{ author: 'lead', text: 'Why?', resolved: false }, { author: 'hunter', text: 'Client asked.', resolved: true }] },
  ]);
  assert.equal(v.count, 1);
  assert.equal(v.totalComments, 2);
  assert.equal(v.totalOpen, 1);
  assert.equal(v.top.resolvedRate, 0.5);
});
test('54083 parseScopeRuleMentions extracts teammates', () => {
  const v = X103A.parseScopeRuleMentions([{ ruleId: 'rule-9', text: '@lead can you confirm the @hunter note? cc @lead' }]);
  assert.equal(v.count, 1);
  assert.equal(v.notifiedCount, 1);
  assert.deepEqual(v.rows[0].mentions, ['hunter', 'lead']);
});
test('54084 buildScopeStatisticsHeader totals covered hosts', () => {
  const v = X103A.buildScopeStatisticsHeader([
    { target: 'shop', rules: [{ type: 'include', hostsEstimated: 120 }, { type: 'exclude', hostsEstimated: 5 }] },
    { target: 'blog', rules: [{ type: 'include', hostsEstimated: 12 }] },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.totalRules, 3);
  assert.equal(v.top.coveredHosts, 115);
  assert.equal(v.top.excludeCount, 1);
});
test('54085 findUncoveredAssets flags rule gaps', () => {
  const v = X103A.findUncoveredAssets([
    { asset: 'api.example.com', matchedByRule: true },
    { asset: 'staging.example.com', matchedByRule: false },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.uncoveredCount, 1);
  assert.equal(v.topUncovered.asset, 'staging.example.com');
});
test('54086 measureScopeCoverage bands the gauge', () => {
  const v = X103A.measureScopeCoverage([
    { target: 'shop', knownAssets: 40, coveredAssets: 34 },
    { target: 'blog', knownAssets: 20, coveredAssets: 9 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.strongCount, 1);
  assert.equal(v.averagePercent, 0.65);
  assert.equal(v.rows[0].band, 'strong-coverage');
});
test('54087 simulateScopeAgainstInventory replays rules', () => {
  const v = X103A.simulateScopeAgainstInventory([
    { pattern: '*.example.com', assets: ['api.example.com', 'www.example.com', 'shop.other.com'] },
  ]);
  assert.equal(v.count, 1);
  assert.equal(v.totalMatched, 2);
  assert.deepEqual(v.rows[0].matched, ['api.example.com', 'www.example.com']);
});
test('54088 searchScopeRules finds pattern and reason hits', () => {
  const v = X103A.searchScopeRules([
    { pattern: '*.example.com', reason: 'Primary web inventory', query: 'api' },
    { pattern: 'api.example.com', reason: 'Partner API surface', query: 'api' },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.hitCount, 1);
  assert.equal(v.top.pattern, 'api.example.com');
});
test('54089 normalizeIdnHostnames maps IDN spellings', () => {
  const v = X103A.normalizeIdnHostnames([
    { hostname: 'münchen.example.com' },
    { hostname: 'shop.example.com' },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.idnCount, 1);
  assert.equal(v.rows[0].normalized, 'xn--mnchen-3ya.example.com');
});
test('54090 applyCaseSensitivityToggle honors the safe default', () => {
  const v = X103A.applyCaseSensitivityToggle([
    { pattern: 'api.example.com', hostname: 'API.EXAMPLE.COM', caseInsensitive: true },
    { pattern: 'api.example.com', hostname: 'API.EXAMPLE.COM', caseInsensitive: false },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.matchedCount, 1);
  assert.equal(v.strictCount, 1);
});
test('54091 normalizeTrailingSlash unifies slash twins', () => {
  const v = X103A.normalizeTrailingSlash([
    { pathPrefix: '/api', urlPath: '/api/' },
    { pathPrefix: '/api', urlPath: '/other' },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.matchedCount, 1);
  assert.equal(v.rows[0].normalizedPath, '/api');
});
test('54092 applyQueryParameterScope matches parameters', () => {
  const v = X103A.applyQueryParameterScope([
    { url: 'https://app.example.com/x?preview=1', paramName: 'preview', requiredValue: '1' },
    { url: 'https://app.example.com/x', paramName: 'preview' },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.matchedCount, 1);
  assert.equal(v.rows[1].status, 'param-missing');
});
test('54093 applyGeoScope blocks outside countries', () => {
  const v = X103A.applyGeoScope([
    { hostname: 'app.example.de', country: 'DE', allowedCountries: ['DE', 'NL'] },
    { hostname: 'app.other.cn', country: 'CN', allowedCountries: ['DE', 'NL'] },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.inScopeCount, 1);
  assert.equal(v.blockedCount, 1);
  assert.equal(v.countries, 2);
});
test('54094 applyAsnScope honors blocked networks', () => {
  const v = X103A.applyAsnScope([
    { hostname: 'cdn-a.example.com', asn: 'AS13335', blockedAsns: ['AS9009'] },
    { hostname: 'cdn-b.example.com', asn: 'AS9009', blockedAsns: ['AS9009'] },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.inScopeCount, 1);
  assert.equal(v.blockedCount, 1);
});
test('54095 attachScopeRuleNotes measures justifications', () => {
  const v = X103A.attachScopeRuleNotes([
    { pattern: '*.example.com', note: 'Client approved wildcard for the whole web estate in the kickoff call.' },
    { pattern: 'old.example.com', note: '' },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.justifiedCount, 1);
  assert.equal(v.missingCount, 1);
  assert.equal(v.top.wordCount, 12);
});
test('54096 buildScopeAuditTrail orders the trail', () => {
  const v = X103A.buildScopeAuditTrail([
    { action: 'create', actor: 'ops-lead', at: '2026-10-01T09:00:00Z', ruleId: 'r1' },
    { action: 'delete', actor: 'hunter', at: '2026-10-08T10:00:00Z', ruleId: 'r2' },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.latest.ruleId, 'r2');
  assert.equal(v.actionCounts.delete, 1);
  assert.equal(v.actors, 2);
});
test('54097 notifyScopeChanges reaches subscribers', () => {
  const v = X103A.notifyScopeChanges([
    { ruleId: 'r1', changeType: 'edit', subscribers: ['lead@example.com', 'hunter@example.com'], diffSummary: 'pattern narrowed from *.example.com' },
    { ruleId: 'r2', changeType: 'delete', subscribers: [], diffSummary: '' },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.notifiedCount, 1);
  assert.equal(v.totalRecipients, 2);
  assert.equal(v.withDiffCount, 1);
});
test('54098 highlightScopeConflicts marks contradictions', () => {
  const v = X103A.highlightScopeConflicts([
    { pattern: 'admin.example.com', type: 'include' },
    { pattern: 'admin.example.com', type: 'exclude' },
    { pattern: 'api.example.com', type: 'include' },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.conflictCount, 1);
  assert.equal(v.top.pattern, 'admin.example.com');
});
test('54099 evaluateScopeRuleSchedules checks the window', () => {
  const v = X103A.evaluateScopeRuleSchedules([
    { pattern: 'workday.example.com', windowStartHour: 9, windowEndHour: 18, checkHour: 10 },
    { pattern: 'night.example.com', windowStartHour: 9, windowEndHour: 18, checkHour: 23 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.activeCount, 1);
  assert.equal(v.scheduledCount, 2);
});
test('54100 applyHeaderScope matches gate headers', () => {
  const v = X103A.applyHeaderScope([
    { requirement: { name: 'x-client', value: 'infinity-ai' }, headers: { 'X-Client': 'infinity-ai' } },
    { requirement: { name: 'x-client', value: 'infinity-ai' }, headers: { 'x-client': 'other' } },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.matchedCount, 1);
  assert.equal(v.rows[1].status, 'header-value-mismatch');
});

// --- Wave 103B spot checks (one per idea) ---
test('54101 applyCookieScope matches session cookies', () => {
  const v = X103B.applyCookieScope([
    { cookieName: 'session', requiredValue: 'abc', cookies: { session: 'abc' } },
    { cookieName: 'session', requiredValue: 'abc', cookies: {} },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.matchedCount, 1);
  assert.equal(v.missingCount, 1);
});
test('54102 suggestThirdPartyExclusions finds off-inventory hosts', () => {
  const v = X103B.suggestThirdPartyExclusions([
    { pageHost: 'shop.example.com', resources: ['shop.example.com', 'cdn.assets.net', 'analytics.third.io'] },
  ]);
  assert.equal(v.count, 1);
  assert.equal(v.totalSuggestions, 2);
  assert.deepEqual(v.rows[0].suggestions, ['cdn.assets.net', 'analytics.third.io']);
});
test('54103 planScopeReviewReminders flags overdue reviews', () => {
  const v = X103B.planScopeReviewReminders([
    { target: 'shop', lastConfirmedDaysAgo: 120, thresholdDays: 90 },
    { target: 'blog', lastConfirmedDaysAgo: 10, thresholdDays: 90 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.overdueCount, 1);
  assert.equal(v.top.target, 'shop');
});
test('54104 buildScopeSignoffRecord validates records', () => {
  const v = X103B.buildScopeSignoffRecord([
    { target: 'shop', signedBy: 'Client Lead', signedAt: '2026-10-01', approved: true },
    { target: 'blog', signedBy: '', signedAt: '', approved: false },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.validCount, 1);
  assert.equal(v.top.status, 'signed-off');
});
test('54105 buildCardGridView bands card risk', () => {
  const v = X103B.buildCardGridView([
    { target: 'shop', health: 'healthy', riskScore: 82, owner: 'lead' },
    { target: 'blog', health: 'degraded', riskScore: 30, owner: 'hunter' },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.criticalCount, 1);
  assert.equal(v.healthyCount, 1);
  assert.equal(v.top.band, 'critical');
});
test('54106 buildDenseTableView sorts by risk', () => {
  const v = X103B.buildDenseTableView([
    { target: 'shop', riskScore: 70, columns: ['target', 'riskScore', 'health'] },
    { target: 'api', riskScore: 40, columns: ['target', 'riskScore'] },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.totalColumns, 3);
  assert.equal(v.top.target, 'shop');
});
test('54107 buildLifecycleKanban buckets targets', () => {
  const v = X103B.buildLifecycleKanban([
    { target: 'a', lifecycle: 'Active' },
    { target: 'b', lifecycle: 'Pending Verification' },
    { target: 'c', lifecycle: 'Active' },
  ]);
  assert.equal(v.count, 3);
  assert.equal(v.columnCounts.Active, 2);
  assert.deepEqual(v.byColumn.Active, ['a', 'c']);
});
test('54108 buildRiskHeatmap grades heat cells', () => {
  const v = X103B.buildRiskHeatmap([
    { target: 'core-api', severity: 9, exposure: 8 },
    { target: 'blog', severity: 3, exposure: 2 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.criticalCount, 1);
  assert.equal(v.hottest.cell, 'highxhigh');
  assert.equal(v.hottest.heat, 0.72);
});
test('54109 buildGeoMapView pins by country', () => {
  const v = X103B.buildGeoMapView([
    { target: 'a', country: 'DE', region: 'eu-west' },
    { target: 'b', country: 'DE', region: 'eu-central' },
    { target: 'c', country: 'IN', region: 'ap-south' },
  ]);
  assert.equal(v.count, 3);
  assert.equal(v.countryCount, 2);
  assert.equal(v.topCountry.country, 'DE');
  assert.deepEqual(v.topCountry.targets, ['a', 'b']);
});
test('54110 summarizeTargetHealth counts states', () => {
  const v = X103B.summarizeTargetHealth([
    { target: 'a', health: 'healthy' },
    { target: 'b', health: 'down' },
    { target: 'c', health: 'degraded' },
    { target: 'd', health: 'healthy' },
  ]);
  assert.equal(v.count, 4);
  assert.equal(v.healthyCount, 2);
  assert.equal(v.healthPercent, 0.5);
  assert.deepEqual(v.downTargets, ['b']);
});
test('54111 findNeedsVerification sorts by age', () => {
  const v = X103B.findNeedsVerification([
    { target: 'a', verified: false, daysUnverified: 21 },
    { target: 'b', verified: true, daysUnverified: 0 },
    { target: 'c', verified: false, daysUnverified: 3 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.staleCount, 1);
  assert.equal(v.oldest.target, 'a');
});
test('54112 findStaleTargets compares thresholds', () => {
  const v = X103B.findStaleTargets([
    { target: 'old', lastActivityDaysAgo: 45, thresholdDays: 30 },
    { target: 'fresh', lastActivityDaysAgo: 2, thresholdDays: 30 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.staleCount, 1);
  assert.equal(v.stalest.target, 'old');
});
test('54113 findExpiringScopes warns before lapse', () => {
  const v = X103B.findExpiringScopes([
    { target: 'a', scopeExpiresInDays: 10 },
    { target: 'b', scopeExpiresInDays: 90 },
    { target: 'c', scopeExpiresInDays: -3 },
  ]);
  assert.equal(v.count, 3);
  assert.equal(v.expiringCount, 1);
  assert.equal(v.expiredCount, 1);
  assert.equal(v.soonest.target, 'c');
});
test('54114 rankTopRiskyTargets ranks with arrows', () => {
  const v = X103B.rankTopRiskyTargets([
    { target: 'core-api', riskScore: 92, trend: 'up' },
    { target: 'blog', riskScore: 25, trend: 'down' },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.top.target, 'core-api');
  assert.equal(v.top.rank, 1);
  assert.equal(v.top.arrow, '\u2191');
});
test('54115 buildRecentActivityFeed streams newest first', () => {
  const v = X103B.buildRecentActivityFeed([
    { type: 'hunt', target: 'shop', at: '2026-10-09T10:00:00Z', actor: 'hunter' },
    { type: 'finding', target: 'shop', at: '2026-10-09T12:00:00Z', actor: 'Infinity AI' },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.latest.type, 'finding');
  assert.equal(v.typeCounts.hunt, 1);
});
test('54116 measureHuntCoverage gauges active inventory', () => {
  const v = X103B.measureHuntCoverage([
    { target: 'a', active: true, huntedInPeriod: true },
    { target: 'b', active: true, huntedInPeriod: false },
    { target: 'c', active: false, huntedInPeriod: false },
  ]);
  assert.equal(v.activeCount, 2);
  assert.equal(v.huntedCount, 1);
  assert.equal(v.percent, 0.5);
  assert.deepEqual(v.uncovered, ['b']);
});
test('54117 buildSeverityMiniBars totals severities', () => {
  const v = X103B.buildSeverityMiniBars([
    { target: 'shop', findingsBySeverity: { critical: 2, high: 3, medium: 1, low: 0 } },
  ]);
  assert.equal(v.count, 1);
  assert.equal(v.grandTotal, 6);
  assert.equal(v.rows[0].dominant, 'high');
  assert.equal(v.rows[0].shares.high, 0.5);
});
test('54118 buildTrendSparklines renders glyphs', () => {
  const v = X103B.buildTrendSparklines([{ target: 'shop', series: [1, 2, 3, 2, 4, 6] }]);
  assert.equal(v.count, 1);
  assert.equal(v.risingCount, 1);
  assert.equal(v.rows[0].delta, 5);
  assert.equal(v.rows[0].sparkline.length, 6);
});
test('54119 buildQuickFiltersBar applies chips', () => {
  const targets = [{ name: 'shop', lifecycle: 'Active', health: 'healthy', verified: true, riskScore: 70, owner: 'lead' }, { name: 'api', lifecycle: 'Paused', health: 'down', verified: false, riskScore: 20, owner: 'hunter' }];
  const v = X103B.buildQuickFiltersBar([{ targets, filter: { riskBand: 'high' } }]);
  assert.equal(v.count, 1);
  assert.equal(v.filteredCount, 1);
  assert.deepEqual(v.rows[0].targets, ['shop']);
  assert.deepEqual(v.rows[0].chips, ['riskBand:high']);
});
test('54120 manageSavedDashboardLayouts checks completeness', () => {
  const v = X103B.manageSavedDashboardLayouts([
    { name: 'Hunt morning', views: ['cards', 'table', 'kanban'] },
    { name: 'Quick scan', views: ['cards'] },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.completeCount, 1);
  assert.equal(v.totalViews, 4);
});

// --- Audits ---
test('jsx audit: every exported component calls a core function', () => {
  for (const [name, src, prefix, minComponents] of [['A', A_JSX, 'X103A', 20], ['B', B_JSX, 'X103B', 20]]) {
    const components = src.match(/export function (\w+)\(/g) || [];
    assert.ok(components.length >= minComponents, `${name} jsx exports`);
    assert.ok(src.includes(`${prefix}.`), `${name} jsx must call core functions`);
  }
});

test('css audit: scoped w103 prefixes, zero keyframes, static layout only', () => {
  assert.ok(CSS_SRC.includes('.w103a-'));
  assert.ok(CSS_SRC.includes('.w103b-'));
  assert.ok(!CSS_SRC.includes('@key' + 'frames'), 'zero-keyframe rule violated');
  assert.ok(!CSS_SRC.toLowerCase().includes('anim' + 'ation'), 'static-only order violated');
  assert.ok(!CSS_SRC.toLowerCase().includes('trans' + 'ition'), 'static-only order violated');
});

test('esbuild audit: both JSX files parse with real esbuild', () => {
  for (const f of ['Wave103A.jsx', 'Wave103B.jsx']) {
    const out = execFileSync(
      'npx',
      ['-y', 'esbuild', '--loader:.jsx=jsx', '--format=esm', join(DIR, f)],
      { encoding: 'utf8', timeout: 90000 }
    );
    assert.ok(out.includes('createElement') || out.includes('jsx'), `${f} did not transform`);
  }
});

test('branding audit: Infinity AI only, no other AI names', () => {
  const banned = ['cl' + 'aude', 'chat' + 'gpt', 'open' + 'ai', 'gem' + 'ini', 'copil' + 'ot'];
  for (const [name, src] of BRAND_SRC) {
    const low = src.toLowerCase();
    for (const b of banned) assert.ok(!low.includes(b), `${name} leaks ${b}`);
    assert.ok(src.includes('Infinity AI'), `${name} missing Infinity AI branding`);
  }
});

test('no-debris audit: no placeholder text in wave 103 sources', () => {
  for (const [name, src] of BRAND_SRC) {
    const low = src.toLowerCase();
    assert.ok(!src.includes('TODO'), `${name} carries placeholder debris`);
    assert.ok(!src.includes('FIXME'), `${name} carries placeholder debris`);
    assert.ok(!low.includes('mo' + 'ck'), `${name} carries placeholder debris`);
    assert.ok(!low.includes('de' + 'mo'), `${name} carries placeholder debris`);
  }
});

test('purity audit: core functions do not mutate frozen inputs', () => {
  const frozenTimeBox = Object.freeze([Object.freeze({ pattern: '*.example.com', startsOn: '2026-01-01', endsOn: '2026-12-31', checkOn: '2026-06-15' })]);
  const a = X103A.applyTimeBoxedScopeRules(frozenTimeBox);
  assert.equal(a.count, 1);
  assert.equal(a.activeCount, 1);
  const frozenKanban = Object.freeze([Object.freeze({ target: 'a', lifecycle: 'Active' }), Object.freeze({ target: 'b', lifecycle: 'Archived' })]);
  const b = X103B.buildLifecycleKanban(frozenKanban);
  assert.equal(b.count, 2);
  assert.equal(b.columnCounts.Archived, 1);
});
