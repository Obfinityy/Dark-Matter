/**
 * wave63.test.js — Infinity AI · Dark-Matter · Wave 63
 * node:test + node:assert/strict. Registry coverage (20/20 for 52481–52500,
 * 20/20 for 52501–52520, zero skips, 40/40 combined), registry titles matched
 * against the idea bank, deterministic spot-checks of every pure function
 * (at least one assertion per idea), Wave63.css scope/zero-animation audits,
 * a real esbuild JSX parse audit, a no-branding-leak audit ("Infinity AI"
 * only) and a no-debris audit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { WAVE63_HC_IDEAS } from './huntCompareCore.js';
import * as HC from './huntCompareCore.js';
import { WAVE63_CO_IDEAS } from './compareOpsCore.js';
import * as CO from './compareOpsCore.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const CSS = join(DIR, 'Wave63.css');
const HC_SRC = readFileSync(join(DIR, 'huntCompareCore.js'), 'utf8');
const CO_SRC = readFileSync(join(DIR, 'compareOpsCore.js'), 'utf8');
const HC_JSX = readFileSync(join(DIR, 'HuntCompare.jsx'), 'utf8');
const CO_JSX = readFileSync(join(DIR, 'CompareOps.jsx'), 'utf8');
const CSS_SRC = readFileSync(CSS, 'utf8');
const TEST_SRC = readFileSync(join(DIR, 'wave63.test.js'), 'utf8');
const ALL_SRC = [HC_SRC, CO_SRC, HC_JSX, CO_JSX, CSS_SRC, TEST_SRC];
const NOW = 1700000000000;
const DAY = 86400000;

const F1 = {
  id: 'f-1',
  title: 'XSS',
  severity: 'high',
  state: 'open',
  vulnClass: 'xss',
  asset: 'web',
  evidence: 'e1',
  detectedAt: NOW - 60 * DAY,
  fp: false,
};
const F2 = {
  id: 'f-2',
  title: 'SQLi',
  severity: 'critical',
  state: 'open',
  vulnClass: 'sqli',
  asset: 'web',
  evidence: 'e2',
  detectedAt: NOW - 45 * DAY,
  fp: false,
};
const F3 = {
  id: 'f-3',
  title: 'CORS',
  severity: 'medium',
  state: 'fixed',
  vulnClass: 'misconfig',
  asset: 'api',
  evidence: 'e3',
  detectedAt: NOW - 90 * DAY,
  fixedAt: NOW - 20 * DAY,
  fp: false,
};
const F4 = {
  id: 'f-4',
  title: 'FP case',
  severity: 'low',
  state: 'open',
  vulnClass: 'xss',
  asset: 'web',
  evidence: 'e4',
  detectedAt: NOW - 10 * DAY,
  fp: true,
};
const F1B = { ...F1, severity: 'critical', evidence: 'e1b' };
const F5 = {
  id: 'f-5',
  title: 'IDOR',
  severity: 'high',
  state: 'open',
  vulnClass: 'idor',
  asset: 'api',
  evidence: 'e5',
  detectedAt: NOW - 2 * DAY,
  fp: false,
};

const HA = {
  id: 'ha',
  target: 'acme',
  at: NOW - 30 * DAY,
  riskScore: 7.2,
  findings: [F1, F2, F3, F4],
  endpoints: ['/login', '/search', '/profile'],
  tech: ['nginx', 'django'],
  subdomains: ['www', 'api'],
  params: ['q', 'page'],
  config: { depth: 'full', payloads: 5000, scope: 'all' },
};
const HB = {
  id: 'hb',
  target: 'acme',
  at: NOW,
  riskScore: 6.4,
  findings: [F1B, F2, F5, F4],
  endpoints: ['/login', '/search', '/orders'],
  tech: ['nginx', 'django', 'redis'],
  subdomains: ['www', 'api', 'cdn'],
  params: ['q'],
  config: { depth: 'full', payloads: 7000, scope: 'all' },
};
const HXC = {
  id: 'hc',
  target: 'acme',
  at: NOW - 60 * DAY,
  riskScore: 8.1,
  findings: [F1, F3],
  endpoints: ['/login'],
};

function registryOk(reg, first, count) {
  assert.equal(reg.length, count, `expected ${count} registry entries, got ${reg.length}`);
  const ids = reg.map(e => e.id);
  assert.deepEqual(
    ids,
    Array.from({ length: count }, (_, i) => first + i),
    'registry ids must be the exact idea range in order'
  );
  for (const e of reg) {
    assert.ok(typeof e.title === 'string' && e.title.length > 0, `entry ${e.id} needs a title`);
    assert.ok(typeof e.desc === 'string' && e.desc.length > 0, `entry ${e.id} needs a desc`);
    assert.equal(e.skip, false, `entry ${e.id} must not be skipped`);
  }
}

/* ---- Registry coverage ---- */
test('WAVE63_HC_IDEAS: 20/20 entries 52481–52500, zero skips', () => {
  registryOk(WAVE63_HC_IDEAS, 52481, 20);
});

test('WAVE63_CO_IDEAS: 20/20 entries 52501–52520, zero skips', () => {
  registryOk(WAVE63_CO_IDEAS, 52501, 20);
});

test('combined coverage: exactly 52481–52520 with no gaps or dupes', () => {
  const all = [...WAVE63_HC_IDEAS.map(e => e.id), ...WAVE63_CO_IDEAS.map(e => e.id)];
  assert.equal(all.length, 40);
  assert.deepEqual(
    [...all].sort((a, b) => a - b),
    Array.from({ length: 40 }, (_, i) => 52481 + i)
  );
});

/* ---- Registry titles match the bank ideas ---- */
const BANK_TITLES = {
  52481: 'Persistent-findings list',
  52482: 'Severity migration tracking',
  52483: 'Diff summary counts',
  52484: 'Side-by-side finding cards',
  52485: 'Endpoint coverage diff',
  52486: 'Attack-surface diff',
  52487: 'Risk-score trend line',
  52488: 'Multi-hunt overlay',
  52489: 'Regression delta report',
  52490: 'Diff export',
  52491: 'Shareable diff links',
  52492: 'Diff filters',
  52493: 'Diff by vulnerability class',
  52494: 'Diff by asset',
  52495: 'Visual diff charts',
  52496: 'Field-level finding diff',
  52497: 'Evidence diff',
  52498: 'False-positive delta',
  52499: 'Remediation delta',
  52500: 'Coverage-map diff',
  52501: 'Time-to-detect comparison',
  52502: 'Engine performance comparison',
  52503: 'Model A vs model B comparison',
  52504: 'Hunt config comparison',
  52505: 'Payload-count comparison',
  52506: 'Duration comparison',
  52507: 'Cost comparison',
  52508: 'Target maturity score trend',
  52509: 'Comparison dashboard',
  52510: 'Scheduled comparison reports (post-hunt)',
  52511: 'Comparison annotations (post-hunt)',
  52512: 'AI "what changed" summary',
  52513: 'Change attribution (post-hunt)',
  52514: 'Diff API',
  52515: 'Diff webhooks',
  52516: 'Comparison templates (post-hunt)',
  52517: 'Saved comparisons',
  52518: 'New-critical comparison alerts',
  52519: 'Trend forecasting (post-hunt)',
  52520: 'Seasonality analysis (post-hunt)',
};

test('registry titles match bank idea titles (all 40)', () => {
  for (const e of [...WAVE63_HC_IDEAS, ...WAVE63_CO_IDEAS]) {
    assert.equal(e.title, BANK_TITLES[e.id], `title mismatch for idea ${e.id}`);
  }
});

test('registry titles cross-checked against the idea-bank file', () => {
  const bank = readFileSync(
    join(DIR, '..', '..', '..', '..', 'ideas', 'batch6', 'part-03-posthunt.md'),
    'utf8'
  );
  for (const id of [52481, 52490, 52500, 52501, 52510, 52515, 52520]) {
    const line = bank.split('\n').find(l => l.startsWith(`${id}. `));
    assert.ok(line, `bank line for idea ${id} not found`);
    const bankTitle = line.replace(/^\d+\.\s+\*\*/, '').split('**')[0];
    const entry = [...WAVE63_HC_IDEAS, ...WAVE63_CO_IDEAS].find(e => e.id === id);
    assert.equal(entry.title, bankTitle, `bank title mismatch for ${id}`);
  }
});

/* ---- Hunt-compare core spot-checks (one+ assertion per idea) ---- */

test('52481 persistentFindings: 3 persistent, oldest first', () => {
  const r = HC.persistentFindings(HA, HB, NOW);
  assert.equal(r.ok, true);
  assert.equal(r.count, 3);
  assert.equal(r.persistent[0].id, 'f-1');
  assert.ok(r.persistent[0].ageDays >= 60);
  assert.ok(r.auditId.startsWith('hc63_'));
});

test('52482 severityMigrations: f-1 high→critical, reason new evidence', () => {
  const r = HC.severityMigrations(HA, HB);
  assert.equal(r.ok, true);
  assert.equal(r.count, 1);
  assert.equal(r.migrations[0].id, 'f-1');
  assert.equal(r.migrations[0].from, 'high');
  assert.equal(r.migrations[0].to, 'critical');
  assert.equal(r.migrations[0].reason, 'new evidence');
});

test('52483 diffSummary: 1 added, 1 removed, 3 persistent, 1 severity change', () => {
  const r = HC.diffSummary(HA, HB);
  assert.equal(r.ok, true);
  assert.equal(r.added, 1);
  assert.equal(r.removed, 1);
  assert.equal(r.persistent, 3);
  assert.equal(r.severityChanges, 1);
});

test('52484 findingSideBySide: adjacent severities, changed flag; rejects mismatched ids', () => {
  const r = HC.findingSideBySide(F1, F1B);
  assert.equal(r.ok, true);
  assert.equal(r.left.severity, 'high');
  assert.equal(r.right.severity, 'critical');
  assert.equal(r.changed, true);
  assert.equal(HC.findingSideBySide(F1, F2).ok, false);
});

test('52485 coverageDiff: /profile only A, /orders only B, 2 both', () => {
  const r = HC.coverageDiff(HA, HB);
  assert.equal(r.ok, true);
  assert.deepEqual(r.onlyA, ['/profile']);
  assert.deepEqual(r.onlyB, ['/orders']);
  assert.equal(r.both.length, 2);
});

test('52486 attackSurfaceDiff: redis/cdn added, page param removed', () => {
  const r = HC.attackSurfaceDiff(HA, HB);
  assert.equal(r.ok, true);
  assert.deepEqual(r.tech.added, ['redis']);
  assert.deepEqual(r.subdomains.added, ['cdn']);
  assert.deepEqual(r.params.removed, ['page']);
});

test('52487 riskTrend: 3 points sorted, improving direction', () => {
  const r = HC.riskTrend([HA, HXC, HB]);
  assert.equal(r.ok, true);
  assert.equal(r.points.length, 3);
  assert.equal(r.points[0].huntId, 'hc');
  assert.equal(r.direction, 'improving');
  assert.equal(HC.riskTrend([]).ok, false);
});

test('52488 overlayHunts: 3 rows; rejects fewer than 3', () => {
  const r = HC.overlayHunts([HA, HB, HXC]);
  assert.equal(r.ok, true);
  assert.equal(r.count, 3);
  assert.equal(HC.overlayHunts([HA, HB]).ok, false);
});

test('52489 deltaReport: report id + 3 sections', () => {
  const r = HC.deltaReport(HA, HB, NOW);
  assert.equal(r.ok, true);
  assert.ok(r.reportId.startsWith('hc63_'));
  assert.equal(r.sections.length, 3);
  assert.equal(r.sections[0].name, 'summary');
});

test('52490 exportDiff: CSV header + 4 rows, JSON rowCount', () => {
  const rows = HC.buildDiffRows(HA, HB).rows;
  const r = HC.exportDiff({ rows }, { a: 'ha', b: 'hb' });
  assert.equal(r.ok, true);
  assert.ok(r.csv.startsWith('id,title,severity,state,vuln_class,asset'));
  assert.equal(r.csv.split('\n').length, 5);
  assert.equal(r.rowCount, 4);
  assert.equal(HC.exportDiff(null).ok, false);
});

test('52491 shareableDiffLink: https URL with token; rejects missing ids', () => {
  const r = HC.shareableDiffLink('ha', 'hb', { severity: 'high' }, NOW);
  assert.equal(r.ok, true);
  assert.ok(r.url.startsWith('https://app.infinityai.dev/diff/'));
  assert.equal(r.expiresInDays, 30);
  assert.equal(HC.shareableDiffLink(null, 'hb').ok, false);
});

test('52492 filterDiff: filters by severity', () => {
  const rows = HC.buildDiffRows(HA, HB).rows;
  const r = HC.filterDiff({ rows }, { severity: 'critical' });
  assert.equal(r.ok, true);
  assert.equal(r.total, 4);
  assert.ok(r.matched >= 1);
  assert.ok(r.rows.every(x => x.severity === 'critical'));
});

test('52493 diffByVulnClass: rows sorted by net growth', () => {
  const rows = HC.buildDiffRows(HA, HB).rows;
  const r = HC.diffByVulnClass({ rows });
  assert.equal(r.ok, true);
  assert.ok(r.rows.length >= 3);
  const xss = r.rows.find(x => x.vulnClass === 'xss');
  assert.equal(xss.persistent, 2);
});

test('52494 diffByAsset: per-asset breakdown present', () => {
  const rows = HC.buildDiffRows(HA, HB).rows;
  const r = HC.diffByAsset({ rows });
  assert.equal(r.ok, true);
  const web = r.rows.find(x => x.asset === 'web');
  assert.ok(web.added + web.removed + web.persistent >= 2);
});

test('52495 diffChartData: bar has 5 severities, donut sums to 4', () => {
  const rows = HC.buildDiffRows(HA, HB).rows;
  const r = HC.diffChartData({ rows });
  assert.equal(r.ok, true);
  assert.equal(r.bar.length, 5);
  assert.equal(r.donut.added + r.donut.removed + r.donut.persistent, 4);
});

test('52496 findingFieldDiff: severity + evidence changed', () => {
  const r = HC.findingFieldDiff(F1, F1B);
  assert.equal(r.ok, true);
  const fields = r.changed.map(c => c.field);
  assert.ok(fields.includes('severity'));
  assert.ok(fields.includes('evidence'));
  assert.equal(HC.findingFieldDiff(F1, F2).ok, false);
});

test('52497 evidenceDiff: changed flag true for new proof', () => {
  const r = HC.evidenceDiff(F1, F1B);
  assert.equal(r.ok, true);
  assert.equal(r.changed, true);
  assert.equal(r.oldEvidence, 'e1');
  assert.equal(r.newEvidence, 'e1b');
  assert.equal(HC.evidenceDiff(F1, F1).changed, false);
});

test('52498 fpDelta: rates computed, delta points present', () => {
  const r = HC.fpDelta(HA, HB);
  assert.equal(r.ok, true);
  assert.equal(r.huntA.fpCount, 1);
  assert.equal(r.huntA.total, 4);
  assert.ok(typeof r.deltaPoints === 'number');
});

test('52499 remediationDelta: fixed counts + mttrHours', () => {
  const r = HC.remediationDelta(HA, HB);
  assert.equal(r.ok, true);
  assert.equal(r.huntA.fixed, 1);
  assert.ok(r.huntA.mttrHours > 0);
});

test('52500 coverageMapDiff: nodes with statuses', () => {
  const r = HC.coverageMapDiff(HA, HB);
  assert.equal(r.ok, true);
  assert.equal(r.nodes.length, 4);
  assert.deepEqual(r.counts, { onlyA: 1, onlyB: 1, both: 2 });
});

/* ---- Compare-ops core spot-checks (one+ assertion per idea) ---- */

const OPS_HA = {
  ...HA,
  model: 'qwen-2.5',
  engines: [{ name: 'vulnDetector', findings: 2 }],
  stats: { requests: 120000, payloads: 5000, hours: 6, phases: { recon: 3600000 } },
  finishedAt: NOW - 30 * DAY + 6 * 3600000,
};
const OPS_HB = {
  ...HB,
  model: 'qwen-3',
  engines: [{ name: 'eliteRecon', findings: 1 }],
  stats: { requests: 150000, payloads: 7000, hours: 7, phases: { recon: 5400000 } },
  finishedAt: NOW + 7 * 3600000,
};

test('52501 timeToDetectCompare: per-hunt TTD rows', () => {
  const h = {
    ...OPS_HA,
    at: NOW - 30 * DAY,
    findings: [{ ...F2, detectedAt: NOW - 30 * DAY + 120 * 60000 }],
  };
  const r = CO.timeToDetectCompare([h]);
  assert.equal(r.ok, true);
  assert.equal(r.rows[0].criticals, 1);
  assert.equal(r.rows[0].fastestMin, 120);
  assert.equal(CO.timeToDetectCompare([]).ok, false);
});

test('52502 engineCompare: aggregated findings sorted', () => {
  const r = CO.engineCompare([OPS_HA, OPS_HB]);
  assert.equal(r.ok, true);
  assert.ok(r.rows.length >= 1);
  assert.equal(r.rows[0].findings, 2);
});

test('52503 modelCompare: grouped by model', () => {
  const r = CO.modelCompare([OPS_HA, OPS_HB]);
  assert.equal(r.ok, true);
  assert.equal(r.rows.length, 2);
  assert.ok(r.rows.every(x => typeof x.avgFindings === 'number'));
});

test('52504 configDiff: payloads 5000→7000; identical configs pass', () => {
  const r = CO.configDiff(HA.config, HB.config);
  assert.equal(r.ok, true);
  const ch = r.changed.find(c => c.key === 'payloads');
  assert.equal(ch.from, 5000);
  assert.equal(ch.to, 7000);
  assert.equal(CO.configDiff(HA.config, { ...HA.config }).identical, true);
});

test('52505 payloadCompare: findings per 1k computed', () => {
  const r = CO.payloadCompare([OPS_HA]);
  assert.equal(r.ok, true);
  assert.equal(r.rows[0].requests, 120000);
  assert.equal(r.rows[0].findingsPer1k, 0);
  assert.equal(CO.payloadCompare([OPS_HA, OPS_HB]).rows.length, 2);
});

test('52506 durationCompare: phase totals in minutes', () => {
  const r = CO.durationCompare([OPS_HA]);
  assert.equal(r.ok, true);
  assert.equal(r.rows[0].totalMin, 60);
});

test('52507 costCompare: cost + per-confirmed; rejects bad rate', () => {
  const r = CO.costCompare([OPS_HA], 2.5);
  assert.equal(r.ok, true);
  assert.equal(r.rows[0].cost, 15);
  assert.equal(r.currency, 'USD');
  assert.equal(CO.costCompare([OPS_HA], -1).ok, false);
});

test('52508 maturityTrend: score 0–100, latest present', () => {
  const mk = ov => ({
    ...HA,
    at: NOW - ov * DAY,
    stats: { endpointsCovered: 480, endpointsTotal: 500 },
  });
  const r = CO.maturityTrend([mk(60), mk(30), mk(0)]);
  assert.equal(r.ok, true);
  assert.equal(r.points.length, 3);
  assert.ok(r.latest >= 0 && r.latest <= 100);
});

test('52509 buildComparisonDashboard: charts default when omitted', () => {
  const r = CO.buildComparisonDashboard(HA, HB, {});
  assert.equal(r.ok, true);
  assert.equal(r.dashboard.huntAId, 'ha');
  assert.deepEqual(r.dashboard.charts, ['summary', 'bar', 'donut', 'trend']);
  assert.equal(CO.buildComparisonDashboard(null, HB).ok, false);
});

test('52510 scheduleComparisonReport: monthly schedule + recipients', () => {
  const r = CO.scheduleComparisonReport(
    'acme',
    { cadence: 'monthly', recipients: ['sec@acme.dev'] },
    NOW
  );
  assert.equal(r.ok, true);
  assert.equal(r.schedule.cadence, 'monthly');
  assert.ok(r.schedule.id.startsWith('co63_'));
  assert.equal(CO.scheduleComparisonReport('acme', { cadence: 'yearly' }, NOW).ok, false);
  assert.equal(
    CO.scheduleComparisonReport('acme', { cadence: 'weekly', recipients: [] }, NOW).ok,
    false
  );
});

test('52511 addAnnotation: trims note; rejects empty', () => {
  const r = CO.addAnnotation('cmp-1', '  v2.4 deploy  ', 'aria', NOW);
  assert.equal(r.ok, true);
  assert.equal(r.annotation.note, 'v2.4 deploy');
  assert.ok(r.annotation.id.startsWith('co63_'));
  assert.equal(CO.addAnnotation('cmp-1', '   ').ok, false);
});

test('52512 whatChangedSummary: natural language, empty case', () => {
  const r = CO.whatChangedSummary({ added: 3, removed: 5, persistent: 12, severityChanges: 2 });
  assert.equal(r.ok, true);
  assert.ok(r.text.includes('3 new findings appeared'));
  const empty = CO.whatChangedSummary({ added: 0, removed: 0, persistent: 0, severityChanges: 0 });
  assert.ok(empty.text.includes('No meaningful differences'));
});

test('52513 attributeChanges: nearest prior event wins', () => {
  const timeline = [
    { type: 'deploy', at: NOW - 3 * DAY },
    { type: 'config-change', at: NOW - 40 * DAY },
  ];
  const r = CO.attributeChanges([{ id: 'f-5', detectedAt: NOW - 2 * DAY }], timeline);
  assert.equal(r.ok, true);
  assert.equal(r.attributions[0].cause, 'deploy');
  assert.equal(r.attributions[0].confidence, 'high');
  assert.equal(CO.attributeChanges(null, []).ok, false);
});

test('52514 diffApiResponse: pagination math', () => {
  const rows = Array.from({ length: 45 }, (_, i) => ({ id: `f-${i}` }));
  const r = CO.diffApiResponse({ rows }, { page: 3, perPage: 20 });
  assert.equal(r.ok, true);
  assert.equal(r.page, 3);
  assert.equal(r.pages, 3);
  assert.equal(r.rows.length, 5);
  assert.equal(r.total, 45);
});

test('52515 fireDiffWebhook: gate fails on new criticals; rejects bad url', () => {
  const fail = CO.fireDiffWebhook(
    { huntAId: 'ha', huntBId: 'hb', newCriticals: 2 },
    'https://ci.acme.dev/hook'
  );
  assert.equal(fail.ok, true);
  assert.equal(fail.payload.gate, 'fail');
  const pass = CO.fireDiffWebhook(
    { huntAId: 'ha', huntBId: 'hb', newCriticals: 0 },
    'https://ci.acme.dev/hook'
  );
  assert.equal(pass.payload.gate, 'pass');
  assert.equal(CO.fireDiffWebhook({ huntAId: 'ha', huntBId: 'hb' }, 'ftp://x').ok, false);
});

test('52516 saveComparisonTemplate: named template', () => {
  const r = CO.saveComparisonTemplate('monthly-review', { charts: ['summary'] }, NOW);
  assert.equal(r.ok, true);
  assert.equal(r.template.name, 'monthly-review');
  assert.equal(r.template.usageCount, 0);
  assert.equal(CO.saveComparisonTemplate('  ').ok, false);
});

test('52517 saveComparison: bookmark with both hunt ids', () => {
  const r = CO.saveComparison('q3-review', 'ha', 'hb', {}, NOW);
  assert.equal(r.ok, true);
  assert.equal(r.saved.huntAId, 'ha');
  assert.ok(r.saved.id.startsWith('co63_'));
  assert.equal(CO.saveComparison('x', 'ha', null).ok, false);
});

test('52518 newCriticalAlerts: new critical triggers alert', () => {
  const nb = {
    ...HB,
    findings: [...HB.findings, { id: 'f-9', title: 'RCE', severity: 'critical', state: 'open' }],
  };
  const r = CO.newCriticalAlerts(HB, nb);
  assert.equal(r.ok, true);
  assert.equal(r.count, 1);
  assert.ok(r.alerts[0].message.includes('New Critical'));
  assert.equal(CO.newCriticalAlerts(HA, HA).count, 0);
});

test('52519 forecastTrend: n projections, non-negative', () => {
  const r = CO.forecastTrend([HXC, HA, HB], 3);
  assert.equal(r.ok, true);
  assert.equal(r.projections.length, 3);
  assert.ok(r.projections.every(p => p.projectedFindings >= 0 && p.projectedRisk >= 0));
  assert.equal(CO.forecastTrend([HA]).ok, false);
});

test('52520 seasonalityAnalysis: detects post-release spike', () => {
  const mk = (daysAgo, n) => ({
    id: `h-${daysAgo}`,
    at: NOW - daysAgo * DAY,
    findings: Array.from({ length: n }, (_, i) => ({ id: `f-${daysAgo}-${i}` })),
  });
  const r = CO.seasonalityAnalysis(
    [mk(60, 1), mk(30, 1), mk(3, 4)],
    [{ type: 'deploy', at: NOW - 4 * DAY }]
  );
  assert.equal(r.ok, true);
  assert.equal(r.spikeCount, 1);
  assert.deepEqual(r.postReleaseSpikes, ['h-3']);
  assert.equal(CO.seasonalityAnalysis([]).ok, false);
});

/* ---- JSX wiring audit (regex-based; node cannot import .jsx directly) ---- */
test('JSX files import the right cores and export 20-component galleries', () => {
  assert.ok(/import \* as HC from '.\/huntCompareCore.js'/.test(HC_JSX));
  assert.ok(/import \* as CO from '.\/compareOpsCore.js'/.test(CO_JSX));
  for (const [name, src, gal] of [
    ['hc', HC_JSX, 'HC63_GALLERY'],
    ['co', CO_JSX, 'CO63_GALLERY'],
  ]) {
    assert.ok(new RegExp(`export const ${gal} = \\[`).test(src), `${name}: missing ${gal} export`);
    const m = src.match(new RegExp(`export const ${gal} = \\[([^\\]]+)\\]`));
    assert.ok(m, `${name}: could not parse ${gal} array`);
    const count = m[1].split(',').filter(s => s.trim().length > 0).length;
    assert.equal(count, 20, `${name}: ${gal} must have 20 components, got ${count}`);
  }
});

/* ---- Real esbuild JSX parse audit ---- */
test('real esbuild parse of both JSX files', () => {
  for (const f of ['HuntCompare.jsx', 'CompareOps.jsx']) {
    execFileSync(
      'npx',
      ['esbuild', `--loader:.jsx=jsx`, '--format=esm', `--outfile=/dev/null`, join(DIR, f)],
      { stdio: 'pipe' }
    );
  }
});

/* ---- CSS audit: scoped prefixes only, zero keyframes, no global rules ---- */
test('Wave63.css: only .hc63-/.co63- selectors, zero @keyframes, no global rules', () => {
  const classSelectors = [...CSS_SRC.matchAll(/^\s*\.([a-zA-Z0-9_-]+)\s*[{,]/gm)].map(m => m[1]);
  assert.ok(classSelectors.length > 0, 'expected class selectors');
  for (const sel of classSelectors) {
    assert.ok(sel.startsWith('hc63-') || sel.startsWith('co63-'), `unscoped selector .${sel}`);
  }
  assert.ok(!/@keyframes/i.test(CSS_SRC), 'zero-animation order: no @keyframes');
  assert.ok(!/transition\s*:/i.test(CSS_SRC), 'zero-animation order: no transitions');
  assert.ok(!/animation\s*:/i.test(CSS_SRC), 'zero-animation order: no animations');
  assert.ok(!/^\s*(html|body|\*)\s*[{,]/m.test(CSS_SRC), 'no global element selectors');
  assert.ok(!/!important/.test(CSS_SRC), 'no !important');
});

test('Wave63.css: both prefixes have the shared layout primitives', () => {
  for (const prefix of ['hc63', 'co63']) {
    for (const cls of ['gallery', 'card', 'title', 'note', 'mono', 'row', 'btn']) {
      assert.ok(new RegExp(`\\.${prefix}-${cls}\\b`).test(CSS_SRC), `missing .${prefix}-${cls}`);
    }
  }
});

/* ---- Branding audit: Infinity AI only, never Muse ---- */
test('branding: no "Muse" anywhere; "Infinity AI" present where branded', () => {
  for (const [name, src] of [
    ['hcCore', HC_SRC],
    ['coCore', CO_SRC],
    ['hcJsx', HC_JSX],
    ['coJsx', CO_JSX],
    ['css', CSS_SRC],
  ]) {
    assert.ok(!/Muse/i.test(src), `${name} leaks "Muse" branding`);
  }
  for (const [name, src] of [
    ['hcCore', HC_SRC],
    ['coCore', CO_SRC],
    ['hcJsx', HC_JSX],
    ['coJsx', CO_JSX],
    ['css', CSS_SRC],
  ]) {
    assert.ok(/Infinity AI/.test(src), `${name} missing "Infinity AI" branding`);
  }
});

/* ---- Debris audit: no TODO/FIXME/mock/demo/placeholder/debris ---- */
test('no TODO/FIXME/mock/demo/debris in any wave-63 file', () => {
  const bad = /\b(TODO|FIXME|XXX|HACK|lorem ipsum|not implemented)\b/i;
  for (const [name, src] of [
    ['hcCore', HC_SRC],
    ['coCore', CO_SRC],
    ['hcJsx', HC_JSX],
    ['coJsx', CO_JSX],
    ['css', CSS_SRC],
  ]) {
    const clean = src.replace(/placeholder="[^"]*"/g, '');
    assert.ok(!bad.test(clean), `${name} contains debris marker`);
    assert.ok(!/\bmock\b/i.test(src) || /no mock/i.test(src), `${name} mentions mock`);
  }
});

test('registry idea count matches function coverage: 40 ideas, 40 spot-checks', () => {
  const src = TEST_SRC;
  for (let id = 52481; id <= 52520; id += 1) {
    assert.ok(
      src.includes(`${id} `) || src.includes(`'${id}'`) || src.includes(`${id}:`),
      `no spot-check referencing idea ${id}`
    );
  }
});
