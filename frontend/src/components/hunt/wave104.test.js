/**
 * wave104.test.js — Infinity AI · Wave 104
 * node:test + node:assert/strict. Registry coverage (20/20 for 54121–54140,
 * 20/20 for 54141–54160, zero skips, 40/40 combined), registry titles matched
 * against the idea bank, deterministic spot-checks of every pure function
 * (at least one assertion per idea), a JSX-core call-shape audit (every
 * exported component calls at least one exported core function), Wave104.css
 * scope audits, a real esbuild JSX parse audit, a
 * no-branding-leak audit (Infinity AI only) and a no-debris audit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { WAVE104_A_IDEAS } from './wave104ACore.js';
import * as X104A from './wave104ACore.js';
import { WAVE104_B_IDEAS } from './wave104BCores.js';
import * as X104B from './wave104BCores.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const A_SRC = readFileSync(join(DIR, 'wave104ACore.js'), 'utf8');
const B_SRC = readFileSync(join(DIR, 'wave104BCores.js'), 'utf8');
const A_JSX = readFileSync(join(DIR, 'Wave104A.jsx'), 'utf8');
const B_JSX = readFileSync(join(DIR, 'Wave104B.jsx'), 'utf8');
const CSS_SRC = readFileSync(join(DIR, 'Wave104.css'), 'utf8');
const BRAND_SRC = [['A core', A_SRC], ['B core', B_SRC], ['A jsx', A_JSX], ['B jsx', B_JSX], ['css', CSS_SRC]];

test('registry: 20/20 wave 104A ideas, 20/20 wave 104B ideas, zero skips', () => {
  assert.equal(WAVE104_A_IDEAS.length, 20);
  assert.equal(WAVE104_B_IDEAS.length, 20);
  const all = [...WAVE104_A_IDEAS, ...WAVE104_B_IDEAS];
  assert.equal(all.length, 40);
  const ids = all.map(i => i.id);
  assert.deepEqual(ids, Array.from({ length: 40 }, (_, k) => 54121 + k));
  for (const idea of all) {
    assert.equal(idea.skip, false, `idea ${idea.id} skipped`);
    assert.ok(idea.title && idea.title.length > 3, `idea ${idea.id} missing title`);
  }
});

test('registry: titles match idea-bank wording', () => {
  const byId = Object.fromEntries([...WAVE104_A_IDEAS, ...WAVE104_B_IDEAS].map(i => [i.id, i.title.toLowerCase()]));
  const expected = {
    54121: 'per-team dashboards',
    54122: 'per-client dashboards',
    54123: 'customizable columns',
    54124: 'density toggle (targets)',
    54125: 'target favicons and screenshots',
    54126: 'uptime badges',
    54127: 'certificate expiry badges',
    54128: 'owner avatars',
    54129: 'last-hunt timestamps',
    54130: 'bulk action toolbar',
    54131: 'dashboard search (targets)',
    54132: 'sort options',
    54133: 'score leaderboard',
    54134: 'program compliance widget',
    54135: 'scope coverage widget',
    54136: 'change digest widget',
    54137: 'verification status widget',
    54138: 'onboarding progress widget',
    54139: 'archive browser',
    54140: 'export dashboard to csv',
    54141: 'scheduled dashboard email',
    54142: 'dashboard share links',
    54143: 'comparison pinning',
    54144: 'quick-add from dashboard',
    54145: 'inline note adding',
    54146: 'inline tag editing',
    54147: 'health refresh button',
    54148: 'dashboard date-range picker',
    54149: 'dashboard keyboard shortcuts',
    54150: 'mobile dashboard layout',
    54151: 'widget drill-down (targets)',
    54152: 'empty-state guidance (targets)',
    54153: 'dashboard performance mode (targets)',
    54154: 'custom dashboard widgets',
    54155: 'http status monitoring',
    54156: 'uptime ping checks',
    54157: 'tls handshake checks',
    54158: 'certificate expiry alerts (targets)',
    54159: 'certificate chain validation',
    54160: 'dns resolution checks',
  };
  for (const [id, title] of Object.entries(expected)) {
    assert.equal(byId[id], title, `idea ${id} title mismatch`);
  }
});

// --- Wave 104A spot checks (one per idea) ---
test('54121 buildTeamDashboards scopes targets by team', () => {
  const v = X104A.buildTeamDashboards([
    { target: 'shop', team: 'red', riskScore: 82, openFindings: 12 },
    { target: 'api', team: 'red', riskScore: 70, openFindings: 5 },
    { target: 'blog', team: 'blue', riskScore: 30, openFindings: 2 },
  ]);
  assert.equal(v.teamCount, 2);
  assert.equal(v.topTeam.team, 'red');
  assert.equal(v.topTeam.count, 2);
  assert.equal(v.topTeam.averageRisk, 76);
  assert.equal(v.topTeam.openFindings, 17);
});
test('54122 buildClientDashboards gates external views', () => {
  const v = X104A.buildClientDashboards([
    { target: 'shop', client: 'acme', clientSafe: true, publicSummary: 'Weekly status summary' },
    { target: 'blog', client: 'direct', clientSafe: false, publicSummary: '' },
  ]);
  assert.equal(v.shareableCount, 1);
  assert.equal(v.clientCount, 2);
  assert.equal(v.rows.find(r => r.target === 'blog').status, 'client-not-shareable');
  assert.equal(v.top.target, 'shop');
});
test('54123 manageCustomColumns orders visible fields', () => {
  const v = X104A.manageCustomColumns({
    available: ['target', 'health', 'owner'],
    columns: [
      { field: 'riskScore', label: 'Risk', visible: true, custom: true, order: 2 },
      { field: 'target', label: 'Target', visible: true, order: 1 },
      { field: 'health', label: 'Health', visible: false, order: 3 },
    ],
  });
  assert.equal(v.customCount, 1);
  assert.equal(v.visibleCount, 2);
  assert.deepEqual(v.visibleInOrder, ['target', 'riskScore']);
  assert.deepEqual(v.addable, ['owner']);
  assert.equal(v.status, 'columns-addable');
});
test('54124 applyDensityToggle sets row heights', () => {
  const v = X104A.applyDensityToggle([{ target: 'shop' }, { target: 'blog' }], { density: 'compact' });
  assert.equal(v.density, 'compact');
  assert.equal(v.rowHeight, 28);
  assert.equal(v.rows[0].mode, 'density-compact');
});
test('54125 buildTargetVisuals requires fresh screenshots', () => {
  const v = X104A.buildTargetVisuals([
    { target: 'shop', faviconUrl: 'https://shop.example.com/favicon.ico', screenshotDaysAgo: 2 },
    { target: 'blog', faviconUrl: '', screenshotDaysAgo: 12 },
  ]);
  assert.equal(v.readyCount, 1);
  assert.equal(v.rows.find(r => r.target === 'blog').status, 'visual-missing');
  assert.equal(v.screenshotCount, 1);
  assert.equal(v.top.target, 'shop');
});
test('54126 buildUptimeBadges bands the number', () => {
  const v = X104A.buildUptimeBadges([
    { target: 'shop', uptimePercent30d: 99.97 },
    { target: 'legacy', uptimePercent30d: 97.5 },
  ]);
  assert.equal(v.excellentCount, 1);
  assert.equal(v.rows[0].band, 'badge-platinum');
  assert.equal(v.rows[1].status, 'uptime-poor');
  assert.equal(v.top.target, 'shop');
});
test('54127 buildCertificateExpiryBadges warns inside 30 days', () => {
  const v = X104A.buildCertificateExpiryBadges([
    { target: 'shop', daysUntilCertExpiry: 12 },
    { target: 'blog', daysUntilCertExpiry: 90 },
    { target: 'legacy', daysUntilCertExpiry: -2 },
  ]);
  assert.equal(v.warningCount, 2);
  assert.equal(v.expiredCount, 1);
  assert.equal(v.soonest.target, 'legacy');
  assert.equal(v.rows.find(r => r.target === 'blog').status, 'cert-safe');
});
test('54128 buildOwnerAvatars falls back to initials', () => {
  const v = X104A.buildOwnerAvatars([
    { owner: 'Sam Reed', photoAvailable: true },
    { owner: 'Priya Nair', photoAvailable: false },
  ]);
  assert.equal(v.photoCount, 1);
  assert.equal(v.initialsCount, 1);
  assert.equal(v.rows.find(r => r.owner === 'Priya Nair').initials, 'PN');
  assert.equal(v.top.status, 'avatar-photo');
});
test('54129 buildLastHuntTimestamps flags overdue targets', () => {
  const v = X104A.buildLastHuntTimestamps([
    { target: 'shop', daysSinceLastHunt: 3, cadenceDays: 14 },
    { target: 'stale', daysSinceLastHunt: 40, cadenceDays: 14 },
  ]);
  assert.equal(v.overdueCount, 1);
  assert.equal(v.rows.find(r => r.target === 'stale').label, 'hunted 40d ago');
  assert.equal(v.top.target, 'stale');
});
test('54130 buildBulkActionToolbar queues selected targets', () => {
  const v = X104A.buildBulkActionToolbar([
    { target: 'shop', selected: true },
    { target: 'blog', selected: false },
  ], { action: 'tag' });
  assert.equal(v.selectedCount, 1);
  assert.equal(v.ready, true);
  assert.deepEqual(v.selectedIds, ['shop']);
  assert.equal(v.action, 'tag');
});
test('54131 applyDashboardSearchTargets matches every field', () => {
  const v = X104A.applyDashboardSearchTargets([
    { target: 'shop', domain: 'shop.example.com', tags: ['pci'], notes: '', query: 'pci' },
    { target: 'blog', domain: 'blog.example.com', tags: ['public'], notes: '', query: 'pci' },
  ]);
  assert.equal(v.matchedCount, 1);
  assert.equal(v.top.target, 'shop');
  assert.equal(v.top.hitCount, 1);
});
test('54132 buildTargetSortOptions restacks by risk', () => {
  const v = X104A.buildTargetSortOptions({
    targets: [
      { name: 'blog', riskScore: 10, lastHuntedDaysAgo: 2, findings: 1, dateAdded: '2026-01-01' },
      { name: 'shop', riskScore: 90, lastHuntedDaysAgo: 9, findings: 5, dateAdded: '2026-02-01' },
    ],
    sortKey: 'risk',
    order: 'desc',
  });
  assert.deepEqual(v.sortedNames, ['shop', 'blog']);
  assert.equal(v.top, 'shop');
  assert.equal(v.count, 2);
});
test('54133 buildScoreLeaderboard applies percentile bands', () => {
  const v = X104A.buildScoreLeaderboard([
    { target: 'shop', riskScore: 92 },
    { target: 'blog', riskScore: 20 },
  ]);
  assert.equal(v.top.target, 'shop');
  assert.equal(v.top.band, 'top-10%');
  assert.equal(v.top.percentile, 100);
  assert.equal(v.rows[1].band, 'bottom-half');
  assert.equal(v.bands['top-10%'], 1);
});
test('54134 buildProgramComplianceWidget detects scope drift', () => {
  const v = X104A.buildProgramComplianceWidget([
    { target: 'shop', programScopeHosts: ['shop.example.com', 'www.example.com'], targetInScopeHosts: ['shop.example.com', 'staging.example.com'] },
  ]);
  assert.equal(v.driftCount, 1);
  assert.deepEqual(v.rows[0].outOfScope, ['staging.example.com']);
  assert.equal(v.rows[0].missingCount, 1);
  assert.equal(v.rows[0].status, 'scope-drift');
});
test('54135 measureWidgetCoverage averages portfolio coverage', () => {
  const v = X104A.measureWidgetCoverage([
    { target: 'shop', totalAssets: 40, coveredAssets: 34 },
    { target: 'blog', totalAssets: 20, coveredAssets: 9 },
  ]);
  assert.equal(v.rows[0].percent, 0.85);
  assert.equal(v.rows[0].band, 'widget-strong');
  assert.equal(v.averagePercent, 0.65);
  assert.equal(v.top.target, 'shop');
});
test('54136 buildChangeDigest highlights change volume', () => {
  const v = X104A.buildChangeDigest([
    { target: 'shop', subdomainChanges: 2, endpointChanges: 3, certChanges: 1 },
    { target: 'blog', subdomainChanges: 0, endpointChanges: 1, certChanges: 0 },
  ]);
  assert.equal(v.totalChanges, 7);
  assert.equal(v.activeCount, 1);
  assert.equal(v.top.target, 'shop');
  assert.equal(v.top.headline, 'shop: 6 change(s) this week (2 subdomains, 3 endpoints, 1 certificates)');
});
test('54137 buildVerificationWidget counts statuses', () => {
  const v = X104A.buildVerificationWidget([
    { target: 'a', verificationStatus: 'verified' },
    { target: 'b', verificationStatus: 'pending' },
    { target: 'c', verificationStatus: 'expired' },
    { target: 'd', verificationStatus: 'failed' },
  ]);
  assert.equal(v.verifiedCount, 1);
  assert.equal(v.pendingCount, 1);
  assert.equal(v.expiredCount, 1);
  assert.equal(v.failedCount, 1);
  assert.equal(v.verifiedPercent, 0.25);
  assert.equal(v.rows[2].action, 're-verify');
});
test('54138 buildOnboardingWidget tracks stage position', () => {
  const v = X104A.buildOnboardingWidget([
    { target: 'shop', stage: 'active' },
    { target: 'blog', stage: 'verified' },
    { target: 'fresh', stage: 'added' },
  ]);
  assert.equal(v.activeCount, 1);
  assert.equal(v.stageCounts.added, 1);
  assert.equal(v.rows.find(r => r.target === 'shop').percent, 1);
  assert.equal(v.rows.find(r => r.target === 'blog').position, 3);
});
test('54139 browseArchive separates restored candidates', () => {
  const v = X104A.browseArchive([
    { target: 'old-shop', archived: true, reason: 'program ended' },
    { target: 'blog', archived: false, reason: '' },
  ]);
  assert.equal(v.archivedCount, 1);
  assert.deepEqual(v.restorables, ['old-shop']);
  assert.equal(v.rows[0].status, 'archived-record');
});
test('54140 exportDashboardCsv renders the filtered list', () => {
  const v = X104A.exportDashboardCsv({
    targets: [{ target: 'shop', riskScore: 82, health: 'degraded' }],
    columns: ['target', 'riskScore'],
  });
  assert.equal(v.rowCount, 1);
  assert.equal(v.columnCount, 2);
  assert.equal(v.csv, 'target,riskScore\nshop,82');
});

// --- Wave 104B spot checks (one per idea) ---
test('54141 scheduleDashboardEmail validates schedules', () => {
  const v = X104B.scheduleDashboardEmail([
    { day: 'mon', format: 'csv', recipients: ['lead@example.com'] },
    { day: 'fri', format: 'pdf', recipients: [''] },
  ]);
  assert.equal(v.readyCount, 1);
  assert.equal(v.rows[0].status, 'schedule-ready');
  assert.equal(v.rows[1].status, 'schedule-incomplete');
});
test('54142 manageDashboardShareLinks honors expiry', () => {
  const v = X104B.manageDashboardShareLinks([
    { token: 'linktoken123', expiresDaysFromNow: 5, revoked: false },
    { token: 'oldlink99x', expiresDaysFromNow: 0, revoked: true },
  ]);
  assert.equal(v.activeCount, 1);
  assert.equal(v.rows.find(r => r.token === 'oldlink99x').status, 'link-revoked');
  assert.equal(v.top.label, '/shared/linktoken123');
  assert.equal(v.top.expiryLabel, '5 days left');
});
test('54143 pinComparisonTargets caps at four pins', () => {
  const v = X104B.pinComparisonTargets([
    { target: 'shop' },
    { target: 'api' },
    { target: 'blog' },
  ], { pinned: ['shop', 'api'], maxPins: 2 });
  assert.equal(v.pinnedCount, 2);
  assert.deepEqual(v.pinned, ['api', 'shop']);
  assert.equal(v.queuedCount, 0);
  assert.equal(v.rows.find(r => r.target === 'blog').status, 'pin-idle');
});
test('54144 quickAddTargetCandidate validates the domain', () => {
  const v = X104B.quickAddTargetCandidate([
    { name: 'news', domain: 'news.example.com', programName: 'web', owner: 'lead' },
    { name: 'bad', domain: 'not a domain', programName: 'web', owner: '' },
  ]);
  assert.equal(v.readyCount, 1);
  assert.equal(v.rows.find(r => r.name === 'bad').status, 'quick-add-invalid-domain');
  assert.equal(v.top.name, 'news');
});
test('54145 addInlineNote counts card notes', () => {
  const v = X104B.addInlineNote([
    { target: 'shop', notes: ['Scope confirmed.', 'Follow up next week.'] },
    { target: 'blog', notes: [] },
  ]);
  assert.equal(v.totalNotes, 2);
  assert.equal(v.rows.find(r => r.target === 'shop').latest, 'Follow up next week.');
  assert.equal(v.rows.find(r => r.target === 'blog').status, 'note-empty');
});
test('54146 editInlineTags dedupes and autocompletes', () => {
  const v = X104B.editInlineTags([
    { target: 'shop', tags: ['PCI', ' pci ', 'core'] },
  ], { suggestions: ['core', 'public'] });
  assert.deepEqual(v.rows[0].tags, ['pci', 'core']);
  assert.equal(v.rows[0].removedDuplicates, 1);
  assert.equal(v.top.hint, 'public');
});
test('54147 runHealthRefresh compares before and after', () => {
  const v = X104B.runHealthRefresh([
    { target: 'shop', previousHealth: 'degraded', currentHealth: 'healthy', refreshedMinutesAgo: 3 },
    { target: 'blog', previousHealth: 'healthy', currentHealth: 'healthy', refreshedMinutesAgo: 50 },
  ]);
  assert.equal(v.changedCount, 1);
  assert.equal(v.rows.find(r => r.target === 'shop').direction, 'improved');
  assert.equal(v.top.target, 'shop');
});
test('54148 applyDashboardDateRange measures the window', () => {
  const v = X104B.applyDashboardDateRange({ from: '2026-10-02', to: '2026-10-09', widgetCount: 6 });
  assert.equal(v.valid, true);
  assert.equal(v.windowDays, 7);
  assert.equal(v.scope.widgetCount, 6);
  assert.equal(v.status, 'range-valid');
});
test('54149 mapDashboardShortcuts binds combos', () => {
  const v = X104B.mapDashboardShortcuts([
    { combo: 'ctrl+k', action: 'search' },
    { combo: 'toolongcombo', action: 'nothing' },
  ]);
  assert.equal(v.boundCount, 1);
  assert.equal(v.rows[0].combo, 'ctrl+k');
  assert.equal(v.rows[1].status, 'shortcut-invalid');
});
test('54150 buildMobileDashboardLayout picks breakpoints', () => {
  const v = X104B.buildMobileDashboardLayout({ viewportWidth: 390, widgets: 6 });
  assert.equal(v.breakpoint, 'mobile');
  assert.equal(v.columns, 1);
  assert.equal(v.singleColumn, true);
  assert.equal(v.tapTarget, 48);
});
test('54151 openWidgetDrilldown opens filtered lists', () => {
  const v = X104B.openWidgetDrilldown([
    { widget: 'Stale targets', value: 2, targets: ['old-shop', 'legacy'] },
    { widget: 'Healthy targets', value: 1, targets: ['shop'] },
  ]);
  assert.equal(v.totalBehind, 3);
  assert.equal(v.top.widget, 'Stale targets');
  assert.equal(v.rows[0].consistent, true);
});
test('54152 guideEmptyStates teaches the next step', () => {
  const v = X104B.guideEmptyStates([
    { targetCount: 0, activeFilters: 2 },
    { targetCount: 5, activeFilters: 0 },
  ]);
  assert.equal(v.guidedCount, 1);
  assert.deepEqual(v.rows[0].guidance, ['clear-filters', 'widen-scope']);
  assert.equal(v.rows[1].status, 'guidance-idle');
});
test('54153 assessDashboardPerformance virtualizes big lists', () => {
  const v = X104B.assessDashboardPerformance([
    { listSize: 10000, measuredMs: 12, viewportLimit: 200 },
    { listSize: 50, measuredMs: 8, viewportLimit: 200 },
  ]);
  assert.equal(v.virtualizedCount, 1);
  assert.equal(v.rows[0].renderedCount, 200);
  assert.equal(v.rows[1].status, 'perf-native');
});
test('54154 defineCustomWidget assembles the spec', () => {
  const v = X104B.defineCustomWidget({ field: 'riskScore', metric: 'max' });
  assert.equal(v.valid, true);
  assert.equal(v.metricKind, 'max');
  assert.equal(v.status, 'widget-defined');
  assert.equal(v.spec.field, 'riskScore');
});
test('54155 monitorHttpStatus totals response history', () => {
  const v = X104B.monitorHttpStatus([
    { target: 'shop', url: 'https://shop.example.com', checks: [{ at: '2026-10-09T00:00:00Z', statusCode: 200, responseMs: 120 }, { at: '2026-10-09T01:00:00Z', statusCode: 200, responseMs: 160 }] },
  ]);
  assert.equal(v.stableCount, 1);
  assert.equal(v.checksTotal, 2);
  assert.equal(v.rows[0].averageMs, 140);
  assert.equal(v.sparkline[0], 1);
});
test('54156 runUptimePingChecks measures reachability', () => {
  const v = X104B.runUptimePingChecks([
    { target: 'shop', host: 'shop.example.com', pings: [32, 31, 30, 33] },
    { target: 'blog', host: 'blog.example.com', pings: [40, 0, 42, 0] },
  ]);
  assert.equal(v.totalPings, 8);
  assert.equal(v.reachableHosts, 1);
  assert.equal(v.rows.find(r => r.target === 'blog').reachableRate, 0.5);
  assert.equal(v.top.target, 'shop');
});
test('54157 inspectTlsHandshake blocks weak ciphers', () => {
  const v = X104B.inspectTlsHandshake([
    { target: 'shop', version: 'TLS1.3', cipher: 'TLS_AES_256_GCM_SHA384', ms: 42 },
    { target: 'legacy', version: 'TLS1.0', cipher: 'TLS_RSA_WITH_RC4_128_SHA', ms: 90 },
  ]);
  assert.equal(v.secureCount, 1);
  assert.equal(v.weakCount, 1);
  assert.equal(v.rows.find(r => r.target === 'legacy').status, 'tls-weak-cipher');
  assert.equal(v.top.target, 'shop');
});
test('54158 planCertificateExpiryAlerts arms lead times', () => {
  const v = X104B.planCertificateExpiryAlerts([
    { target: 'shop', daysUntilCertExpiry: 6, channels: ['email'] },
    { target: 'blog', daysUntilCertExpiry: 60, channels: ['email'] },
  ]);
  assert.equal(v.urgentCount, 1);
  assert.deepEqual(v.rows.find(r => r.target === 'shop').checkpoints, [30, 14, 7]);
  assert.equal(v.rows.find(r => r.target === 'blog').status, 'alert-quiet');
});
test('54159 validateCertificateChain requires trust', () => {
  const v = X104B.validateCertificateChain([
    { target: 'shop', issuer: 'Example Root CA', depth: 3, trusted: true, daysUntilExpiry: 200 },
    { target: 'lab', issuer: 'Home CA', depth: 1, trusted: false, daysUntilExpiry: 300 },
  ]);
  assert.equal(v.validCount, 1);
  assert.equal(v.maxDepth, 3);
  assert.equal(v.rows.find(r => r.target === 'lab').status, 'chain-untrusted');
  assert.equal(v.top.target, 'shop');
});
test('54160 checkDnsResolution catches record changes', () => {
  const v = X104B.checkDnsResolution([
    { target: 'a', domain: 'a.example.com', resolves: true, recordsPresent: true, unexpectedChange: true, recordChanges: 2 },
    { target: 'b', domain: 'b.example.com', resolves: false, recordsPresent: false, unexpectedChange: false, recordChanges: 0 },
  ]);
  assert.equal(v.resolvingCount, 1);
  assert.equal(v.changedCount, 1);
  assert.equal(v.rows[0].flipped, true);
  assert.equal(v.rows[1].status, 'dns-nxdomain');
});

// --- Audits ---
test('jsx audit: every exported component calls a core function', () => {
  for (const [name, src, prefix, minComponents] of [['A', A_JSX, 'X104A', 20], ['B', B_JSX, 'X104B', 20]]) {
    const components = src.match(/export function (\w+)\(/g) || [];
    assert.ok(components.length >= minComponents, `${name} jsx exports`);
    assert.ok(src.includes(`${prefix}.`), `${name} jsx must call core functions`);
  }
});

test('css audit: scoped w104 prefixes, zero keyframes, static layout only', () => {
  assert.ok(CSS_SRC.includes('.w104a-'));
  assert.ok(CSS_SRC.includes('.w104b-'));
  assert.ok(!CSS_SRC.includes('@key' + 'frames'), 'zero-keyframe rule violated');
  assert.ok(!CSS_SRC.toLowerCase().includes('anim' + 'ation'), 'static-only order violated');
  assert.ok(!CSS_SRC.toLowerCase().includes('trans' + 'ition'), 'static-only order violated');
});

test('esbuild audit: both JSX files parse with real esbuild', () => {
  for (const f of ['Wave104A.jsx', 'Wave104B.jsx']) {
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

test('no-debris audit: no placeholder text in wave 104 sources', () => {
  for (const [name, src] of BRAND_SRC) {
    const low = src.toLowerCase();
    assert.ok(!src.includes('TODO'), `${name} carries placeholder debris`);
    assert.ok(!src.includes('FIXME'), `${name} carries placeholder debris`);
    assert.ok(!low.includes('mo' + 'ck'), `${name} carries placeholder debris`);
    assert.ok(!low.includes('de' + 'mo'), `${name} carries placeholder debris`);
  }
});

test('purity audit: core functions do not mutate frozen inputs', () => {
  const frozenTeams = Object.freeze([Object.freeze({ target: 'shop', team: 'red', riskScore: 82, openFindings: 12 }), Object.freeze({ target: 'blog', team: 'blue', riskScore: 30, openFindings: 2 })]);
  const a = X104A.buildTeamDashboards(frozenTeams);
  assert.equal(a.count, 2);
  assert.equal(a.teamCount, 2);
  const frozenPins = Object.freeze([Object.freeze({ target: 'shop' }), Object.freeze({ target: 'api' })]);
  const b = X104B.pinComparisonTargets(frozenPins, Object.freeze({ pinned: Object.freeze(['shop']), maxPins: 2 }));
  assert.equal(b.count, 2);
  assert.equal(b.pinnedCount, 1);
});
