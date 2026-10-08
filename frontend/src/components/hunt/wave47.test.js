/**
 * wave47.test.js — wave 47 (ideas 51841–51880): multi-hunt command center + hunt ops.
 *
 * Registry completeness (40/40 zero skips), core-logic spot checks for every
 * exported function, zero-keyframe CSS audit, no-debris audit, and JSX
 * esbuild-parse checks.
 * Deterministic — run with: node --test wave47.test.js
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  WAVE47_MULTIHUNT_IDEAS, WAVE47_MULTIHUNT_START, WAVE47_MULTIHUNT_END,
  STALL_MS,
  switchHunt, huntTabs, commandCenterMetrics, compareHunts,
  globalPause, globalResume, crossHuntChatAnswer, rankHunts,
  allocateResources, attentionSort, groupHunts, bulkSteer, bulkApprove,
  cloneHuntConfig, applyTemplate, mergeFindingsFeeds, dedupeFindings,
  healthScore, stalledAlerts, sharePool, enforceCaps, scheduleQueue,
  gateSatisfied, resolveDependencies,
} from './multiHuntCore.js';

import {
  WAVE47_HUNTOPS_IDEAS, WAVE47_HUNTOPS_START, WAVE47_HUNTOPS_END,
  dependencyGates, campaignRollup, clientRollup, searchHunts, filterHunts,
  archiveHunt, reopenHunt, favoriteHunt, unfavoriteHunt, notificationsHub,
  routeNotifications, assignOwner, transferOwnership, inviteCollaborator,
  activityFeed, timelineCompare, addHuntNote, tagHunt, applySavedView,
  bulkExport, issueApiToken, webhookPayload, ssoScope, escapeHtml,
} from './huntOpsCore.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const NOW = 1728307200000;
const MIN = 60000;

const F = (id, title, severity, signature, atMin) => ({ id, title, severity, signature, atMs: NOW - atMin * MIN });

const HUNTS = [
  {
    id: 'H-1', name: 'oct-sweep', target: 'api.example.com', phase: 'scanning', status: 'running',
    progress: 62, owner: 'bhavesh', campaignId: 'C-1', clientId: 'acme', tags: ['api'],
    durationMs: 180 * MIN, startedAtMs: NOW - 180 * MIN, lastActivityMs: NOW - 2 * MIN,
    etaMs: 70 * MIN, priority: 1, budgetUsedUsd: 6.20, requestsUsed: 41000,
    needsAttention: false, dependencies: [],
    findings: [
      F('F1', 'SQL injection in login', 'critical', 'sqli-login', 60),
      F('F2', 'Reflected XSS in search', 'high', 'xss-search', 30),
    ],
  },
  {
    id: 'H-2', name: 'vendor-api', target: 'vendor.example.com', phase: 'recon', status: 'running',
    progress: 18, owner: 'shubham', campaignId: 'C-1', clientId: 'acme', tags: ['api'],
    durationMs: 90 * MIN, startedAtMs: NOW - 90 * MIN, lastActivityMs: NOW - 45 * MIN,
    etaMs: 200 * MIN, priority: 2, budgetUsedUsd: 9.80, requestsUsed: 120000,
    needsAttention: true, dependencies: [{ huntId: 'H-1', gate: 'done' }],
    findings: [],
  },
  {
    id: 'H-3', name: 'shop-front', target: 'shop.example.com', phase: 'exploitation', status: 'paused',
    progress: 44, owner: 'arvind', campaignId: 'C-2', clientId: 'globex', tags: ['web'],
    durationMs: 300 * MIN, startedAtMs: NOW - 240 * MIN, lastActivityMs: NOW - 300 * MIN,
    etaMs: 90 * MIN, priority: 3, budgetUsedUsd: 3.10, requestsUsed: 22000,
    needsAttention: false, dependencies: [],
    findings: [F('F3', 'Stored XSS in reviews', 'high', 'xss-search', 120)],
  },
];

const NOTIFS = [
  { id: 'N-1', huntId: 'H-1', severity: 'critical', type: 'finding', title: 'Critical finding in oct-sweep', atMs: NOW - 30 * MIN, read: false },
  { id: 'N-2', huntId: 'H-2', severity: 'warning', type: 'stalled', title: 'vendor-api went quiet', atMs: NOW - 45 * MIN, read: false },
  { id: 'N-3', huntId: 'H-3', severity: 'info', type: 'done', title: 'shop-front finished', atMs: NOW - 120 * MIN, read: true },
];

const EVENTS = [
  { atMs: NOW - 10 * MIN, actor: 'bhavesh', huntId: 'H-1', action: 'steer', detail: 'Focused on /login' },
  { atMs: NOW - 30 * MIN, actor: 'system', huntId: 'H-1', action: 'finding', detail: 'Critical: SQL injection' },
  { atMs: NOW - 45 * MIN, actor: 'system', huntId: 'H-2', action: 'stalled', detail: 'Quiet 20 minutes' },
];

/* --- registry completeness ------------------------------------------------------- */

test('wave-47 combined registry: 40/40 ideas, ids 51841–51880 contiguous, zero skips', () => {
  assert.equal(WAVE47_MULTIHUNT_START, 51841);
  assert.equal(WAVE47_MULTIHUNT_END, 51860);
  assert.equal(WAVE47_HUNTOPS_START, 51861);
  assert.equal(WAVE47_HUNTOPS_END, 51880);
  assert.equal(WAVE47_MULTIHUNT_IDEAS.length, 20);
  assert.equal(WAVE47_HUNTOPS_IDEAS.length, 20);
  const all = [...WAVE47_MULTIHUNT_IDEAS, ...WAVE47_HUNTOPS_IDEAS];
  assert.deepEqual(all.map((r) => r.id), Array.from({ length: 40 }, (_, i) => 51841 + i));
  for (const r of all) {
    assert.equal(typeof r.id, 'number');
    assert.ok(r.name && r.name.length > 3, `idea ${r.id} has a name`);
    assert.equal(r.status, 'done', `idea ${r.id} is done`);
    assert.ok(!/SKIP|skip|deferred/i.test(r.name), `idea ${r.id} is not a skip`);
  }
  assert.equal(STALL_MS, 20 * 60 * 1000);
});

/* --- multiHuntCore spot checks (51841–51860) --------------------------------------- */

test('switchHunt returns the new active hunt state', () => {
  const s = switchHunt(HUNTS, 'H-2', 'H-1');
  assert.equal(s.activeId, 'H-2');
  assert.equal(s.previousId, 'H-1');
  assert.equal(s.active.name, 'vendor-api');
  assert.ok(s.text.includes('vendor-api'));
  const miss = switchHunt(HUNTS, 'H-9', 'H-1');
  assert.equal(miss.activeId, null);
  assert.ok(miss.text.includes('not found'));
});

test('huntTabs builds tab descriptors with live badges', () => {
  const t = huntTabs(HUNTS, NOW);
  assert.equal(t.count, 3);
  assert.deepEqual(t.tabs.map((x) => x.badge.kind), ['live', 'alert', 'paused']);
  assert.equal(t.live, 1);
  assert.equal(t.alerts, 1);
  assert.ok(t.text.includes('3 hunt tabs'));
});

test('commandCenterMetrics rolls up the whole fleet', () => {
  const m = commandCenterMetrics(HUNTS);
  assert.equal(m.totalHunts, 3);
  assert.equal(m.activeHunts, 2);
  assert.equal(m.pausedHunts, 1);
  assert.equal(m.totalFindings, 3);
  assert.equal(m.avgProgress, 41);
  assert.equal(m.totalEta, '6h 0m');
  assert.deepEqual([m.severityBreakdown.critical, m.severityBreakdown.high], [1, 2]);
  assert.ok(m.text.includes('2/3 hunts running'));
  assert.equal(commandCenterMetrics([]).avgProgress, 0);
});

test('compareHunts puts progress, findings, ETA, phase side by side', () => {
  const c = compareHunts(HUNTS[0], HUNTS[2]);
  assert.deepEqual(c.rows.map((r) => r.metric), ['progress', 'findings', 'eta', 'phase', 'status']);
  assert.equal(c.rows[0].a, '62%');
  assert.equal(c.rows[0].b, '44%');
  assert.equal(c.leader, 'H-1');
  assert.equal(c.aWins, 3);
  assert.equal(c.bWins, 0);
  assert.ok(c.text.includes('H-1'));
});

test('globalPause/globalResume control all hunts or a subset', () => {
  const p = globalPause(HUNTS);
  assert.deepEqual(p.pausedIds, ['H-1', 'H-2']);
  assert.ok(p.hunts.every((h) => h.id === 'H-3' || h.status === 'paused'));
  const sub = globalPause(HUNTS, ['H-1']);
  assert.deepEqual(sub.pausedIds, ['H-1']);
  assert.equal(sub.hunts.find((h) => h.id === 'H-2').status, 'running');
  const r = globalResume(p.hunts);
  assert.deepEqual(r.resumedIds, ['H-1', 'H-2', 'H-3']);
  assert.ok(r.text.includes('Resumed 3 hunts'));
  assert.equal(globalPause([]).count, 0);
});

test('crossHuntChatAnswer grounds answers in real fleet data', () => {
  assert.ok(crossHuntChatAnswer('which hunts are stalled?', HUNTS, NOW).includes('vendor-api'));
  assert.ok(crossHuntChatAnswer('which hunts are stalled?', HUNTS, NOW).includes('45m'));
  assert.ok(crossHuntChatAnswer('how is our progress?', HUNTS, NOW).includes('41%'));
  assert.ok(crossHuntChatAnswer('any critical findings?', HUNTS, NOW).includes('1 critical'));
  assert.ok(crossHuntChatAnswer('fleet health?', HUNTS, NOW).includes('vendor-api'));
  assert.ok(crossHuntChatAnswer('', HUNTS, NOW).includes('2/3 hunts running'));
  assert.equal(typeof crossHuntChatAnswer('hi', HUNTS, NOW), 'string');
});

test('rankHunts reorders hunts and renumbers priorities', () => {
  const r = rankHunts(HUNTS, ['H-3', 'H-1']);
  assert.deepEqual(r.order, ['H-3', 'H-1', 'H-2']);
  assert.deepEqual(r.hunts.map((h) => h.priority), [1, 2, 3]);
  assert.ok(r.text.includes('1. shop-front'));
});

test('allocateResources honors priority order when splitting the pool', () => {
  const a = allocateResources(HUNTS, { requests: 10000, budgetUsd: 50 });
  assert.deepEqual(a.allocations.map((x) => x.requests), [5000, 3333, 1667]);
  assert.deepEqual(a.allocations.map((x) => x.budgetUsd), [25, 16.66, 8.34]);
  assert.equal(a.allocations.reduce((n, x) => n + x.requests, 0), 10000);
  assert.equal(Math.round(a.allocations.reduce((n, x) => n + x.budgetUsd, 0) * 100) / 100, 50);
  assert.ok(a.text.includes('H-1 5000 req'));
});

test('attentionSort floats attention-needed and stalled hunts to the top', () => {
  const s = attentionSort(HUNTS, NOW);
  assert.deepEqual(s.order, ['H-2', 'H-3', 'H-1']);
  assert.equal(s.top.id, 'H-2');
  assert.ok(s.text.includes('vendor-api'));
});

test('groupHunts organizes hunts into campaign/client/status folders', () => {
  const g = groupHunts(HUNTS, 'campaign');
  assert.equal(g.count, 2);
  assert.equal(g.groups[0].key, 'C-1');
  assert.deepEqual(g.groups[0].huntIds, ['H-1', 'H-2']);
  assert.equal(g.groups[0].findings, 2);
  const st = groupHunts(HUNTS, 'status');
  assert.equal(st.groups.find((x) => x.key === 'running').hunts, 2);
});

test('bulkSteer applies one command to several hunts', () => {
  const r = bulkSteer(HUNTS, ['H-1', 'H-3'], { type: 'setPhase', phase: 'reporting' });
  assert.equal(r.applied, 2);
  assert.equal(r.hunts.find((h) => h.id === 'H-1').phase, 'reporting');
  const bad = bulkSteer(HUNTS, ['H-1'], { type: 'levitate' });
  assert.equal(bad.applied, 0);
  assert.ok(bad.text.includes('Unknown'));
  assert.equal(bad.hunts.find((h) => h.id === 'H-1').phase, 'scanning');
});

test('bulkApprove decides a whole approval queue at once', () => {
  const q = [
    { id: 'A-1', huntId: 'H-1', kind: 'intrusive', summary: 'SQLi probes' },
    { id: 'A-2', huntId: 'H-2', kind: 'intrusive', summary: 'SQLi probes', decision: 'rejected' },
    { id: 'A-3', huntId: 'H-3', kind: 'rate', summary: 'Raise rate' },
  ];
  const r = bulkApprove(q, 'approved', NOW);
  assert.equal(r.count, 3);
  assert.equal(r.approved, 2);
  assert.equal(r.rejected, 1);
  assert.ok(r.decided.every((d) => d.decidedAtMs === NOW));
  assert.equal(bulkApprove([]).count, 0);
});

test('cloneHuntConfig spawns a fresh sibling with the config preserved', () => {
  const c = cloneHuntConfig(HUNTS[0]);
  assert.equal(c.hunt.id, 'H-1-clone');
  assert.equal(c.hunt.status, 'queued');
  assert.equal(c.hunt.progress, 0);
  assert.deepEqual(c.hunt.findings, []);
  assert.equal(c.hunt.target, 'api.example.com');
  assert.ok(c.text.includes('H-1-clone'));
});

test('applyTemplate launches a new hunt from a saved configuration', () => {
  const t = applyTemplate({ name: 'API Sweep', target: 'api.example.com', strategy: 'depth' });
  assert.ok(t.hunt.id.startsWith('H-api-sweep-'));
  assert.equal(t.hunt.status, 'queued');
  assert.equal(t.hunt.strategy, 'depth');
  assert.equal(t.hunt.phases.length, 4);
  assert.ok(t.text.includes('API Sweep'));
  const again = applyTemplate({ name: 'API Sweep', target: 'api.example.com' });
  assert.equal(again.hunt.id, t.hunt.id, 'template ids are deterministic');
});

test('mergeFindingsFeeds merges every hunt feed newest-first', () => {
  const m = mergeFindingsFeeds(HUNTS);
  assert.equal(m.count, 3);
  assert.deepEqual(m.feed.map((f) => f.id), ['F2', 'F1', 'F3']);
  assert.equal(m.feed[0].huntId, 'H-1');
  assert.ok(m.text.includes('3 findings'));
});

test('dedupeFindings links identical signatures across hunts', () => {
  const d = dedupeFindings(mergeFindingsFeeds(HUNTS).feed);
  assert.equal(d.unique, 2);
  assert.equal(d.total, 3);
  assert.equal(d.duplicates, 1);
  assert.equal(d.crossHuntLinks, 1);
  const xss = d.groups.find((g) => g.signature === 'xss-search');
  assert.deepEqual(xss.hunts, ['H-1', 'H-3']);
  assert.ok(d.text.includes('1 duplicate'));
});

test('healthScore grades hunts on-track / struggling / stalled', () => {
  const good = healthScore(HUNTS[0], NOW);
  assert.equal(good.score, 100);
  assert.equal(good.label, 'on-track');
  const bad = healthScore(HUNTS[1], NOW);
  assert.equal(bad.score, 20);
  assert.equal(bad.label, 'stalled');
  assert.ok(bad.reasons.length >= 2);
  assert.ok(bad.score >= 0 && bad.score <= 100);
});

test('stalledAlerts flags hunts that went quiet', () => {
  const a = stalledAlerts(HUNTS, NOW);
  assert.equal(a.count, 1);
  assert.equal(a.alerts[0].huntId, 'H-2');
  assert.equal(a.alerts[0].severity, 'critical');
  assert.equal(a.alerts[0].quietFor, '45m');
  assert.ok(a.text.includes('vendor-api'));
});

test('sharePool tracks the shared request-budget pool', () => {
  const alloc = allocateResources(HUNTS, { requests: 10000, budgetUsd: 50 }).allocations;
  const p = sharePool({ id: 'P-1', name: 'core', totalRequests: 200000, totalBudgetUsd: 60 }, alloc);
  assert.deepEqual(p.remaining, { requests: 190000, budgetUsd: 10 });
  assert.equal(p.over, false);
  const over = sharePool({ id: 'P-1', name: 'core', totalRequests: 100, totalBudgetUsd: 1 }, alloc);
  assert.equal(over.over, true);
});

test('enforceCaps clamps usage and flags violations', () => {
  const r = enforceCaps(HUNTS, { 'H-2': { maxBudgetUsd: 5, maxRequests: 100000 } });
  assert.equal(r.count, 2);
  assert.deepEqual([r.violations[0].metric, r.violations[0].used, r.violations[0].cap], ['budgetUsd', 9.8, 5]);
  const h2 = r.hunts.find((h) => h.id === 'H-2');
  assert.equal(h2.budgetUsedUsd, 5);
  assert.equal(h2.needsAttention, true);
  assert.equal(enforceCaps(HUNTS, {}).count, 0);
});

test('scheduleQueue orders the start queue, dependency-free first', () => {
  const s = scheduleQueue([
    { huntId: 'H-1', position: 2 },
    { huntId: 'H-2', position: 1, after: ['H-1'] },
    { huntId: 'H-3', position: 0 },
  ]);
  assert.deepEqual(s.order, ['H-3', 'H-1', 'H-2']);
  assert.deepEqual(s.waiting, [{ huntId: 'H-2', after: ['H-1'] }]);
  assert.equal(scheduleQueue([]).order.length, 0);
});

test('resolveDependencies produces a topological start order', () => {
  const d = resolveDependencies([
    { id: 'H-A', status: 'done', phase: 'reporting', dependencies: [] },
    { id: 'H-B', status: 'running', phase: 'scanning', dependencies: [{ huntId: 'H-A', gate: 'done' }] },
    { id: 'H-C', status: 'queued', phase: 'recon', dependencies: [{ huntId: 'H-B', gate: 'reporting' }] },
  ]);
  assert.deepEqual(d.order, ['H-A', 'H-B', 'H-C']);
  assert.deepEqual(d.blocked, ['H-C']);
  assert.equal(d.gates.length, 2);
  assert.equal(d.gates[0].satisfied, true);
  assert.equal(d.cycles.length, 0);
  const cyc = resolveDependencies([
    { id: 'X', dependencies: [{ huntId: 'Y', gate: 'done' }] },
    { id: 'Y', dependencies: [{ huntId: 'X', gate: 'done' }] },
  ]);
  assert.deepEqual(cyc.cycles.sort(), ['X', 'Y']);
  assert.ok(cyc.text.includes('cycle'));
  assert.equal(gateSatisfied({ status: 'done' }, 'done'), true);
  assert.equal(gateSatisfied({ phase: 'reporting', status: 'running' }, 'reporting'), true);
  assert.equal(gateSatisfied(null, 'done'), false);
});

/* --- huntOpsCore spot checks (51861–51880) ----------------------------------------- */

test('dependencyGates reports which hunts are blocked on gates', () => {
  const d = dependencyGates(HUNTS);
  assert.equal(d.rows.length, 1);
  assert.equal(d.rows[0].huntId, 'H-2');
  assert.equal(d.rows[0].blocked, true);
  assert.equal(d.rows[0].gates[0].satisfied, false);
  assert.deepEqual(d.blocked, ['H-2']);
  assert.equal(dependencyGates([]).rows.length, 0);
});

test('campaignRollup rolls up a campaign dashboard', () => {
  const c = campaignRollup(HUNTS, 'C-1');
  assert.equal(c.hunts, 2);
  assert.equal(c.findings, 2);
  assert.equal(c.activeHunts, 2);
  assert.equal(c.avgProgress, 40);
  assert.equal(c.totalCostUsd, 16);
  assert.deepEqual(c.huntIds, ['H-1', 'H-2']);
  assert.ok(c.text.includes('C-1'));
});

test('clientRollup rolls up hunts, findings, time, and spend per client', () => {
  const c = clientRollup(HUNTS, 'acme');
  assert.equal(c.hunts, 2);
  assert.equal(c.findings, 2);
  assert.equal(c.totalTimeHrs, 4.5);
  assert.equal(c.totalCostUsd, 16);
  assert.equal(c.bySeverity.critical, 1);
  assert.ok(c.text.includes('acme'));
});

test('searchHunts finds hunts by target, name, owner, or tag', () => {
  assert.deepEqual(searchHunts(HUNTS, 'vendor').results.map((h) => h.id), ['H-2']);
  assert.deepEqual(searchHunts(HUNTS, 'API.EXAMPLE').results.map((h) => h.id), ['H-1']);
  assert.equal(searchHunts(HUNTS, 'zzz-no-match').count, 0);
  assert.equal(searchHunts(HUNTS, '   ').count, 0);
});

test('filterHunts filters by phase, severity, owner, health, tag, findings', () => {
  assert.equal(filterHunts(HUNTS, { status: 'running' }).count, 2);
  assert.deepEqual(filterHunts(HUNTS, { severity: 'critical' }).results.map((h) => h.id), ['H-1']);
  assert.deepEqual(filterHunts(HUNTS, { status: 'running', severity: 'critical' }).results.map((h) => h.id), ['H-1']);
  assert.deepEqual(filterHunts(HUNTS, { tag: 'web' }).results.map((h) => h.id), ['H-3']);
  assert.deepEqual(filterHunts(HUNTS, { minFindings: 2 }).results.map((h) => h.id), ['H-1']);
  assert.deepEqual(filterHunts(HUNTS, { owner: 'arvind' }).results.map((h) => h.id), ['H-3']);
});

test('archiveHunt/reopenHunt archive and instantly restore hunts', () => {
  const a = archiveHunt(HUNTS, 'H-3');
  assert.equal(a.hunt.archived, true);
  assert.ok(a.text.includes('archived'));
  const r = reopenHunt(a.hunts, 'H-3');
  assert.equal(r.hunt.archived, false);
  assert.ok(r.text.includes('reopened'));
});

test('favoriteHunt/unfavoriteHunt pin and unpin hunts', () => {
  assert.equal(favoriteHunt(HUNTS, 'H-2').hunts.find((h) => h.id === 'H-2').favorite, true);
  assert.equal(unfavoriteHunt(HUNTS, 'H-1').hunts.find((h) => h.id === 'H-1').favorite, false);
});

test('notificationsHub builds one inbox for all hunts', () => {
  const h = notificationsHub(NOTIFS);
  assert.equal(h.total, 3);
  assert.equal(h.unread, 2);
  assert.equal(h.items[0].id, 'N-1');
  assert.deepEqual(Object.keys(h.groups).sort(), ['critical', 'info', 'warning']);
  assert.ok(h.text.includes('2 unread'));
});

test('routeNotifications matches per-hunt routing rules', () => {
  const rules = [
    { id: 'R-1', match: { severity: 'critical' }, channels: ['slack', 'inapp'], recipients: ['oncall'] },
    { id: 'R-2', match: { huntId: 'H-102' }, channels: ['inapp'], recipients: ['shubham'] },
    { id: 'R-3', match: { type: 'done' }, channels: ['email'], recipients: ['team'] },
  ];
  const r1 = routeNotifications(rules, NOTIFS[0]);
  assert.equal(r1.count, 1);
  assert.equal(r1.routes[0].ruleId, 'R-1');
  assert.deepEqual(r1.routes[0].channels, ['slack', 'inapp']);
  const r3 = routeNotifications(rules, NOTIFS[2]);
  assert.equal(r3.routes[0].ruleId, 'R-3');
  const none = routeNotifications(rules, { severity: 'info', type: 'note', huntId: 'H-9' });
  assert.equal(none.matched, false);
  assert.ok(none.text.includes('hub only'));
});

test('assignOwner/transferOwnership keep a clean ownership history', () => {
  const a = assignOwner(HUNTS, 'H-1', 'sukrit');
  assert.equal(a.hunts.find((h) => h.id === 'H-1').owner, 'sukrit');
  const t = transferOwnership(HUNTS, 'H-1', 'sukrit', NOW);
  const h1 = t.hunts.find((h) => h.id === 'H-1');
  assert.equal(h1.owner, 'sukrit');
  assert.deepEqual(h1.ownershipHistory, [{ from: 'bhavesh', to: 'sukrit', atMs: NOW }]);
  assert.ok(t.text.includes('bhavesh'));
});

test('inviteCollaborator invites with viewer/analyst/admin roles', () => {
  const r = inviteCollaborator(HUNTS[0], 'priya', 'admin', NOW);
  assert.equal(r.ok, true);
  assert.ok(r.hunt.collaborators.some((c) => c.user === 'priya' && c.role === 'admin'));
  assert.equal(r.invitation.atMs, NOW);
  const bad = inviteCollaborator(HUNTS[0], 'priya', 'superadmin', NOW);
  assert.equal(bad.ok, false);
  assert.ok(bad.error.includes('Unknown role'));
});

test('activityFeed streams every action newest-first', () => {
  const f = activityFeed(EVENTS);
  assert.equal(f.count, 3);
  assert.equal(f.items[0].actor, 'bhavesh');
  assert.equal(f.items[2].action, 'stalled');
});

test('timelineCompare overlays two hunts to compare pace', () => {
  const t = timelineCompare(
    { id: 'A', samples: [{ atMs: 0, progress: 0 }, { atMs: 10, progress: 40 }, { atMs: 20, progress: 60 }] },
    { id: 'B', samples: [{ atMs: 0, progress: 0 }, { atMs: 10, progress: 20 }, { atMs: 20, progress: 50 }] },
  );
  assert.equal(t.rows.length, 3);
  assert.deepEqual(t.rows[1], { atMs: 10, aProgress: 40, bProgress: 20, delta: 20 });
  assert.equal(t.leader, 'A');
  assert.equal(t.delta, 10);
  assert.ok(t.text.includes('ahead by 10'));
});

test('addHuntNote attaches team notes with HTML-escaped bodies', () => {
  const r = addHuntNote(HUNTS, 'H-1', { author: 'bhavesh', body: '<b>next:</b> login', atMs: NOW });
  assert.equal(r.note.bodyHtml, '&lt;b&gt;next:&lt;/b&gt; login');
  const h1 = r.hunts.find((h) => h.id === 'H-1');
  assert.equal(h1.notes[h1.notes.length - 1].author, 'bhavesh');
  assert.ok(r.text.includes('H-1'));
});

test('tagHunt merges custom tags without duplicates', () => {
  const r = tagHunt(HUNTS, 'H-1', ['api', 'priority']);
  const h1 = r.hunts.find((h) => h.id === 'H-1');
  assert.deepEqual(h1.tags, ['api', 'priority']);
  assert.ok(r.text.includes('priority'));
});

test('applySavedView applies a named filter set in one tap', () => {
  const v = applySavedView(HUNTS, { name: 'running hunts', filters: { status: 'running' }, sortBy: 'progress', sortDir: 'desc' });
  assert.deepEqual(v.hunts.map((h) => h.id), ['H-1', 'H-2']);
  assert.equal(v.viewName, 'running hunts');
  assert.ok(v.text.includes('2 hunts'));
});

test('bulkExport writes JSON, CSV, and markdown safely', () => {
  const evil = { id: 'H-9', name: '=cmd', target: '<img src=x>', phase: 'recon', status: 'running', progress: 5, findings: [], owner: '', tags: [] };
  const j = bulkExport([...HUNTS, evil], ['H-1', 'H-9'], 'json');
  assert.equal(j.format, 'json');
  assert.equal(j.filename, 'hunts-export.json');
  assert.equal(JSON.parse(j.content).count, 2);
  const c = bulkExport([...HUNTS, evil], ['H-9'], 'csv');
  assert.ok(c.content.startsWith('id,name,target,phase,status,progress,findings,owner,tags\r\n'));
  assert.ok(c.content.includes("'=cmd"), 'CSV cells guard against formula injection');
  const m = bulkExport([...HUNTS, evil], ['H-9'], 'markdown');
  assert.ok(m.content.includes('&lt;img src=x&gt;'), 'markdown cells are HTML-escaped');
  assert.ok(m.content.includes('| H-9 |'));
});

test('issueApiToken returns a labeled sample descriptor, never a secret', () => {
  const t = issueApiToken('H-1');
  assert.ok(t.tokenPrefix.startsWith('dm47_sample_'));
  assert.deepEqual(t.scopes, ['hunt:read', 'findings:read', 'webhooks:write']);
  assert.equal(t.sample, true);
  assert.ok(t.label.includes('SAMPLE'));
  assert.ok(t.text.includes('not a credential'));
  assert.equal(issueApiToken('H-1').tokenPrefix, t.tokenPrefix, 'prefixes are deterministic');
});

test('webhookPayload builds a signed-payload descriptor', () => {
  const p = webhookPayload({ type: 'hunt.finding', huntId: 'H-1', data: { findingId: 'F1' } });
  assert.equal(p.event, 'hunt.finding');
  assert.equal(p.huntId, 'H-1');
  assert.ok(p.signature.startsWith('sample-sha256:'));
  assert.equal(p.sample, true);
  assert.ok(p.text.includes('sample signature'));
});

test('ssoScope shows members only their assigned hunts', () => {
  const s = ssoScope({ id: 'shubham', assignedHuntIds: ['H-2'] }, HUNTS);
  assert.equal(s.count, 1);
  assert.equal(s.hidden, 2);
  assert.equal(s.hunts[0].id, 'H-2');
  const all = ssoScope({ id: 'bhavesh', assignedHuntIds: 'all' }, HUNTS);
  assert.equal(all.count, 3);
  assert.equal(all.hidden, 0);
});

test('escapeHtml neutralizes user-controlled strings', () => {
  assert.equal(escapeHtml('<a href="x">&'), '&lt;a href=&quot;x&quot;&gt;&amp;');
  assert.equal(escapeHtml(null), '');
});

/* --- zero-keyframe CSS audit --------------------------------------------------------- */

test('Wave47.css: zero keyframes, no animation/transition, scoped classes only', () => {
  const css = readFileSync(join(DIR, 'Wave47.css'), 'utf8');
  assert.ok(!/@keyframes/i.test(css), 'no @keyframes allowed');
  assert.ok(!/animation\s*:/i.test(css), 'no animation shorthand allowed');
  assert.ok(!/transition\s*:/i.test(css), 'no transitions allowed');
  assert.ok(css.includes('.mh47-') && css.includes('.ho47-'), 'scoped classes present');
  assert.ok(css.includes('.mh47-track') && css.includes('.ho47-track'), 'progress tracks present');
});

/* --- no-debris audit ------------------------------------------------------------------- */

test('wave-47 sources carry no unfinished-work or fake-content markers', () => {
  // Markers built char-by-char so the test source itself never matches them.
  const markers = [
    ['T', 'O', 'D', 'O'], ['F', 'I', 'X', 'M', 'E'], ['X', 'X', 'X'], ['H', 'A', 'C', 'K'],
    ['M', 'O', 'C', 'K'], ['D', 'E', 'M', 'O'], ['S', 'i', 'm', 'u', 'l', 'a', 't', 'e'],
    ['p', 'l', 'a', 'c', 'e', 'h', 'o', 'l', 'd', 'e', 'r'], ['l', 'o', 'r', 'e', 'm'],
  ].map((parts) => new RegExp('\\b' + parts.join('') + '\\b', 'i'));
  const files = ['multiHuntCore.js', 'huntOpsCore.js', 'MultiHunt.jsx', 'HuntOps.jsx', 'Wave47.css', 'wave47.test.js'];
  for (const f of files) {
    const src = readFileSync(join(DIR, f), 'utf8');
    for (const re of markers) {
      assert.ok(!re.test(src), `debris marker ${re} in ${f}`);
    }
  }
});

/* --- JSX esbuild-parse checks ------------------------------------------------------------ */

test('MultiHunt.jsx parses clean via esbuild', () => {
  const jsxPath = join(DIR, 'MultiHunt.jsx');
  const out = execFileSync('npx', ['--no-install', 'esbuild', '--loader:.jsx=jsx', jsxPath], { encoding: 'utf8', timeout: 30000 });
  assert.ok(out.includes('MultiHuntGallery'), 'esbuild parsed the multi-hunt gallery export');
});

test('HuntOps.jsx parses clean via esbuild', () => {
  const jsxPath = join(DIR, 'HuntOps.jsx');
  const out = execFileSync('npx', ['--no-install', 'esbuild', '--loader:.jsx=jsx', jsxPath], { encoding: 'utf8', timeout: 30000 });
  assert.ok(out.includes('HuntOpsGallery'), 'esbuild parsed the hunt-ops gallery export');
});
