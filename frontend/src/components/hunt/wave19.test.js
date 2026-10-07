/**
 * wave19.test.js — wave 19 (ideas 50721–50760): node --test suite for
 * dashboardRound2Core.js pure logic + export/CSS audits of the new components.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  WAVE19_IDEAS, wave19IdeasComplete,
  GRID_COLS, collides, normalizeItem, moveItem, resizeItem, compactLayout, gridArea,
  serializeLayout, deserializeLayout,
  DASHBOARD_PRESETS, presetLayout, duplicateDashboard,
  TIME_RANGES, TIME_RANGE_LABELS, rangeMs, inRange,
  recentReportsModel, watchlistModel, modelStatusModel, calendarMonth, huntsByDay,
  costUsageModel, projectMonthEnd, webhookDeliveryModel, rankPayloadFamilies,
  retestQueueModel, unreadMentionsModel, findingsTickerModel, uptimeModel,
  chainsModel, coverageModel, comparativeCard, widgetDeepLink,
  checkThreshold, thresholdLabel, canSeeWidget, visibleLayout,
  isQuietNow, quietHoursSummary, kioskNext, snapshotExport,
  TOAST_POSITIONS, DEFAULT_TOAST_POSITION, MOBILE_TOAST_POSITION,
  toastSeverityColor, criticalToast, phaseToast, errorToast, actionToast,
  stackToasts, TOAST_STACK_LIMIT, rateLimitOk, TOAST_RATE_WINDOW_MS,
  groupFindingsToast, resolveToastPosition, filterGalleryWidgets, updatedAgo,
} from './dashboardRound2Core.js';

const here = dirname(fileURLToPath(import.meta.url));
const read = (f) => readFileSync(join(here, f), 'utf8');

/* Registry ---------------------------------------------------------------- */

test('WAVE19_IDEAS covers all 40 ideas 50721–50760', () => {
  assert.equal(Object.keys(WAVE19_IDEAS).length, 40);
  assert.ok(wave19IdeasComplete());
  for (let i = 50721; i <= 50760; i++) assert.ok(WAVE19_IDEAS[i].title, `missing ${i}`);
  for (const [, v] of Object.entries(WAVE19_IDEAS)) assert.equal(v.status, 'new');
});

/* Grid math ---------------------------------------------------------------- */

test('collides detects overlap and adjacency', () => {
  const a = { id: 'a', x: 0, y: 0, w: 4, h: 2 };
  assert.ok(collides(a, { id: 'b', x: 2, y: 1, w: 4, h: 2 }));
  assert.ok(!collides(a, { id: 'b', x: 4, y: 0, w: 4, h: 2 })); // touching edge
  assert.ok(!collides(a, { id: 'a', x: 2, y: 1, w: 4, h: 2 })); // self
});

test('normalizeItem clamps to the 12-column grid', () => {
  const n = normalizeItem({ id: 'x', x: 11, y: -2, w: 20, h: 9 });
  assert.equal(GRID_COLS, 12);
  assert.ok(n.w <= 12 && n.x + n.w <= 12);
  assert.ok(n.y >= 0 && n.h <= 4);
});

test('moveItem/resizeItem return new arrays and clamp', () => {
  const layout = [{ id: 'a', x: 0, y: 0, w: 4, h: 2 }];
  const moved = moveItem(layout, 'a', 9, 3);
  assert.equal(moved[0].x, 8); // clamped: 9 + 4 > 12 → x = 8
  assert.equal(moved[0].y, 3);
  assert.equal(layout[0].x, 0); // original untouched
  const resized = resizeItem(layout, 'a', 0, 0);
  assert.ok(resized[0].w >= 1 && resized[0].h >= 1);
});

test('compactLayout removes vertical gaps without overlap', () => {
  const layout = [
    { id: 'a', x: 0, y: 0, w: 4, h: 2 },
    { id: 'b', x: 0, y: 5, w: 4, h: 2 },
  ];
  const c = compactLayout(layout);
  const b = c.find((i) => i.id === 'b');
  assert.ok(b.y < 5);
  assert.ok(!collides(c[0], c[1]));
});

test('gridArea produces 1-based CSS grid-area', () => {
  assert.equal(gridArea({ x: 0, y: 0, w: 4, h: 2 }), '1 / 1 / span 2 / span 4');
});

test('serialize/deserialize round-trip; bad JSON returns null', () => {
  const layout = [{ id: 'a', x: 0, y: 0, w: 4, h: 2 }];
  const back = deserializeLayout(serializeLayout(layout));
  assert.equal(back.length, 1);
  assert.equal(back[0].id, 'a');
  assert.equal(deserializeLayout('not-json'), null);
  assert.equal(deserializeLayout('{"x":1}'), null);
});

test('presets produce layouts from the catalog', () => {
  const allIds = [
    'severityDonut', 'coverage', 'costUsage', 'recentReports', 'findingsTicker',
    'chains', 'payloadFamily', 'watchlist', 'retestQueue', 'agentHeatmap',
    'needsReview', 'criticalToastFeed', 'mentions', 'slaRisk', 'webhookDeliveries',
  ];
  for (const name of Object.keys(DASHBOARD_PRESETS)) {
    const l = presetLayout(name, allIds);
    assert.ok(Array.isArray(l) && l.length > 0, name);
    assert.ok(l.every((it) => it.x + it.w <= 12));
  }
  assert.equal(presetLayout('nope', []), null);
  assert.deepEqual(presetLayout('executive', []), []);
});

test('duplicateDashboard renames and re-ids', () => {
  const copy = duplicateDashboard({ name: 'Ops', layout: [{ id: 'a', x: 0, y: 0, w: 4, h: 2 }] });
  assert.ok(copy.name.includes('(copy)'));
  assert.notEqual(copy.layout[0].id, 'a');
  assert.equal(copy.layout[0].w, 4);
});

/* Time ranges --------------------------------------------------------------- */

test('rangeMs and inRange', () => {
  assert.equal(TIME_RANGES.length, 4);
  assert.ok(TIME_RANGE_LABELS['7d']);
  assert.equal(rangeMs('24h'), 86400000);
  const now = Date.now();
  assert.ok(inRange(now - 1000, '24h', now));
  assert.ok(!inRange(now - 2 * 86400000, '24h', now));
  assert.ok(inRange(0, 'all', now));
});

/* Widget models ------------------------------------------------------------- */

test('recentReportsModel sorts newest-first and limits', () => {
  const now = Date.now();
  const rows = recentReportsModel([
    { id: '1', createdAt: now - 2000 }, { id: '2', createdAt: now - 1000 }, { id: '3', createdAt: now },
  ], 2);
  assert.deepEqual(rows.map((r) => r.id), ['3', '2']);
  assert.ok(rows[0].dateLabel);
});

test('watchlistModel keeps badges and severity', () => {
  const rows = watchlistModel([{ id: 't', host: 'x.com', newFindings: 2, severityMax: 'high' }]);
  assert.equal(rows[0].newFindings, 2);
  assert.equal(rows[0].severityMax, 'high');
});

test('modelStatusModel summarizes brain health', () => {
  assert.equal(modelStatusModel([{ slot: 'h', health: 'healthy' }]).summary, 'healthy');
  assert.equal(modelStatusModel([{ slot: 'h', health: 'degraded' }]).summary, 'degraded');
  assert.equal(modelStatusModel([{ slot: 'h', health: 'down' }]).summary, 'down');
  const m = modelStatusModel([{ slot: 'hacker', name: 'qwen', version: '32b', location: 'local', health: 'healthy' }]);
  assert.equal(m.slots[0].location, 'Local');
});

test('calendarMonth builds week rows; huntsByDay buckets by date', () => {
  const weeks = calendarMonth(2026, 9);
  assert.ok(weeks.length >= 4 && weeks.every((w) => w.length === 7));
  const map = huntsByDay([{ startedAt: new Date(2026, 9, 7).getTime() }, { startedAt: new Date(2026, 9, 7).getTime() }], 2026, 9);
  assert.equal(map[7].length, 2);
});

test('projectMonthEnd scales linearly', () => {
  assert.equal(projectMonthEnd(10, 10, 30), 30);
  assert.equal(projectMonthEnd(0, 0, 30), 0);
  const m = costUsageModel(12.5, { name: 'Pro', limit: 29 }, 10, 30);
  assert.equal(m.projected, 37.5);
  assert.ok(m.overProjection);
  assert.ok(m.label.includes('$12.50'));
});

test('webhookDeliveryModel maps status dots and retry', () => {
  const rows = webhookDeliveryModel([
    { id: '1', event: 'e', status: 'delivered', attemptedAt: 1 },
    { id: '2', event: 'e', status: 'failed', attemptedAt: 2 },
    { id: '3', event: 'e', status: 'retrying', attemptedAt: 3 },
  ]);
  assert.deepEqual(rows.map((r) => r.dot), ['amber', 'red', 'green']);
  assert.ok(rows.find((r) => r.id === '2').retryable);
});

test('rankPayloadFamilies sorts by confirmed', () => {
  const rows = rankPayloadFamilies([
    { family: 'xss', confirmed: true }, { family: 'xss', confirmed: false },
    { family: 'sqli', confirmed: true }, { family: 'sqli', confirmed: true },
  ]);
  assert.equal(rows[0].family, 'sqli');
  assert.equal(rows[1].family, 'xss');
  assert.ok(Math.abs(rows[1].rate - 0.5) < 1e-9);
});

test('retestQueueModel filters and enables run-all', () => {
  const m = retestQueueModel([
    { id: '1', needsRetest: true }, { id: '2', needsRetest: true, retestedAt: 1 }, { id: '3' },
  ]);
  assert.equal(m.count, 1);
  assert.ok(m.runAllEnabled);
  assert.ok(!retestQueueModel([]).runAllEnabled);
});

test('unreadMentionsModel counts unread', () => {
  const m = unreadMentionsModel([{ id: '1', read: false }, { id: '2', read: true }]);
  assert.equal(m.count, 1);
  assert.equal(m.items[0].id, '1');
});

test('findingsTickerModel limits to 20 newest', () => {
  const now = Date.now();
  const list = Array.from({ length: 25 }, (_, i) => ({ id: `f${i}`, foundAt: now - i }));
  assert.equal(findingsTickerModel(list).length, 20);
});

test('uptimeModel computes downtime', () => {
  const now = Date.now();
  const m = uptimeModel([
    { at: now - 3600000, type: 'down' }, { at: now - 3540000, type: 'up' },
  ], 86400000, now);
  assert.ok(m.pct > 99 && m.pct < 100);
  assert.equal(m.downtimeMs, 60000);
  assert.equal(uptimeModel([], 86400000).pct, 100);
});

test('chainsModel returns count + top 3', () => {
  const m = chainsModel([
    { id: 'a', severityScore: 9, findings: [1, 2] },
    { id: 'b', severityScore: 5, findings: [1] },
    { id: 'c', severityScore: 7, findings: [1, 2, 3] },
    { id: 'd', severityScore: 8, findings: [1] },
  ]);
  assert.equal(m.count, 4);
  assert.deepEqual(m.top.map((c) => c.id), ['a', 'd', 'c']);
  assert.equal(m.top[2].hops, 3);
});

test('coverageModel clamps', () => {
  assert.equal(coverageModel(50, 100).pct, 50);
  assert.equal(coverageModel(0, 0).pct, 0);
  assert.equal(coverageModel(200, 100).pct, 100);
});

test('comparativeCard judges better-than-average', () => {
  const good = comparativeCard(18, 12.4, true);
  assert.ok(good.good && good.delta > 0);
  const bad = comparativeCard(18, 12.4, false);
  assert.ok(!bad.good);
});

test('widgetDeepLink maps widget ids to pages', () => {
  assert.equal(widgetDeepLink('severityDonut'), '/agent/findings');
  assert.equal(widgetDeepLink('unknownWidget'), '/agent');
  assert.ok(widgetDeepLink('chains', '/x').startsWith('/x'));
});

/* Thresholds, access, quiet hours, kiosk ------------------------------------ */

test('checkThreshold levels', () => {
  assert.equal(checkThreshold(50, { warn: 80, crit: 95 }), 'ok');
  assert.equal(checkThreshold(85, { warn: 80, crit: 95 }), 'warn');
  assert.equal(checkThreshold(99, { warn: 80, crit: 95 }), 'crit');
  assert.equal(checkThreshold(999, null), 'ok');
  assert.equal(thresholdLabel('crit'), 'Critical');
});

test('canSeeWidget respects role allowlists', () => {
  assert.ok(canSeeWidget('w1', ['admin'], {}));
  assert.ok(canSeeWidget('w1', ['viewer'], { w1: ['viewer'] }));
  assert.ok(!canSeeWidget('w1', ['viewer'], { w1: ['admin'] }));
  assert.ok(visibleLayout([{ id: 'w1', x: 0, y: 0, w: 4, h: 2 }], ['viewer'], { w1: ['admin'] }).length === 0);
});

test('isQuietNow wraps midnight', () => {
  const night = new Date(2026, 9, 7, 23, 0); // 23:00
  const day = new Date(2026, 9, 7, 12, 0);
  assert.ok(isQuietNow(night, { start: '22:00', end: '07:00' }));
  assert.ok(isQuietNow(new Date(2026, 9, 7, 3, 0), { start: '22:00', end: '07:00' }));
  assert.ok(!isQuietNow(day, { start: '22:00', end: '07:00' }));
  assert.ok(isQuietNow(day, { start: '11:00', end: '13:00' }));
  assert.ok(!isQuietNow(day, { start: '11:00', end: '11:00' }));
  assert.ok(quietHoursSummary(4, { start: '22:00', end: '07:00' }).includes('4 live updates'));
});

test('kioskNext wraps around', () => {
  assert.equal(kioskNext(['a', 'b', 'c'], 2).idx, 0);
  assert.equal(kioskNext(['a', 'b', 'c'], 0, 30).idx, 1);
});

test('snapshotExport names files', () => {
  const s = snapshotExport('My Ops Board', 'pdf');
  assert.equal(s.format, 'pdf');
  assert.ok(s.filename.startsWith('my-ops-board-') && s.filename.endsWith('.pdf'));
});

/* Toast logic --------------------------------------------------------------- */

test('toast severity colors', () => {
  assert.equal(toastSeverityColor('critical'), '#ff4d5e');
  assert.equal(toastSeverityColor('nonsense'), '#4da3ff');
});

test('toast builders carry actions and persistence flags', () => {
  const c = criticalToast({ id: 'f1', title: 'RCE' }, 'hunt-1');
  assert.deepEqual(c.actions, ['view', 'snooze']);
  assert.equal(c.severity, 'critical');
  const p = phaseToast('Recon', 'URLs crawled', 142);
  assert.equal(p.title, 'Recon complete');
  assert.ok(p.body.includes('142'));
  const e = errorToast('Upload failed');
  assert.ok(e.persistent && e.requiresAck);
  assert.ok(e.actions.includes('dismiss'));
  const a = actionToast('Bulk retried', '12 findings', ['view', 'undo']);
  assert.ok(!a.persistent);
});

test('stackToasts keeps max 3 visible and never collapses persistent', () => {
  const mk = (i, persistent = false) => ({ id: `t${i}`, persistent });
  const { visible, collapsedCount } = stackToasts([mk(1), mk(2), mk(3), mk(4), mk(5)]);
  assert.equal(TOAST_STACK_LIMIT, 3);
  assert.equal(visible.length, 3);
  assert.equal(collapsedCount, 2);
  const withErr = stackToasts([mk(1), mk(2), mk(3), mk(4, true), mk(5)]);
  assert.ok(withErr.visible.some((t) => t.id === 't4'));
});

test('rateLimitOk enforces 10s per category', () => {
  assert.equal(TOAST_RATE_WINDOW_MS, 10000);
  const now = Date.now();
  assert.ok(rateLimitOk({ findings: now - 11000 }, 'findings', now));
  assert.ok(!rateLimitOk({ findings: now - 1000 }, 'findings', now));
  assert.ok(rateLimitOk({}, 'new', now));
});

test('groupFindingsToast merges 2+ findings', () => {
  assert.equal(groupFindingsToast([{ id: '1' }]), null);
  const g = groupFindingsToast([
    { id: '1', severity: 'critical' }, { id: '2', severity: 'low' }, { id: '3', severity: 'medium' },
  ]);
  assert.equal(g.title, '3 new findings');
  assert.ok(g.expandable);
  assert.deepEqual(g.findingIds, ['1', '2', '3']);
});

test('resolveToastPosition: setting wins, else responsive default', () => {
  assert.equal(resolveToastPosition('top-right', false), 'top-right');
  assert.equal(resolveToastPosition(null, false), DEFAULT_TOAST_POSITION);
  assert.equal(resolveToastPosition(null, true), MOBILE_TOAST_POSITION);
  assert.equal(resolveToastPosition('bogus', true), MOBILE_TOAST_POSITION);
  assert.equal(TOAST_POSITIONS.length, 3);
});

test('filterGalleryWidgets searches title/category/description', () => {
  const entries = [
    { title: 'Chains', category: 'Findings', description: 'chained findings' },
    { title: 'Uptime', category: 'System', description: 'reliability' },
  ];
  assert.equal(filterGalleryWidgets(entries, 'chain').length, 1);
  assert.equal(filterGalleryWidgets(entries, 'system').length, 1);
  assert.equal(filterGalleryWidgets(entries, '').length, 2);
});

test('updatedAgo labels', () => {
  const now = Date.now();
  assert.equal(updatedAgo(now - 2000, now), 'just now');
  assert.equal(updatedAgo(now - 30000, now), '30s ago');
  assert.equal(updatedAgo(now - 5 * 60000, now), '5 min ago');
  assert.equal(updatedAgo(now - 3 * 3600000, now), '3h ago');
});

/* Export + CSS audits -------------------------------------------------------- */

test('DashboardWidgets2.jsx exports all 13 widgets + gallery + shell', () => {
  const src = read('DashboardWidgets2.jsx');
  for (const name of [
    'RecentReportsWidget', 'WatchlistWidget', 'ModelStatusWidget', 'HuntCalendarWidget',
    'CostUsageWidget', 'WebhookDeliveryWidget', 'PayloadFamilyWidget', 'RetestQueueWidget',
    'MentionsWidget', 'ComparativeCard', 'FindingsTickerWidget', 'UptimeWidget',
    'ChainsWidget', 'CoverageWidget', 'WidgetShell', 'DashboardWidgets2Gallery',
  ]) assert.ok(src.includes(`export function ${name}`), name);
});

test('DashboardShell.jsx exports shell, gallery, frame, hooks', () => {
  const src = read('DashboardShell.jsx');
  for (const name of [
    'catalogEntry', 'WidgetFrame', 'WidgetGallery',
  ]) assert.ok(src.includes(name), name);
  assert.ok(src.includes('export function useAutoRefresh'), 'useAutoRefresh');
  assert.ok(src.includes('export function DashboardShell'), 'DashboardShell');
  assert.ok(src.includes('export const WIDGET_CATALOG'), 'WIDGET_CATALOG');
  const catalogBlock = src.slice(src.indexOf('export const WIDGET_CATALOG'), src.indexOf('];', src.indexOf('export const WIDGET_CATALOG')));
  const entries = catalogBlock.match(/\{ id: '/g) || [];
  assert.ok(entries.length >= 29, `catalog entries: ${entries.length}`);
  // wave-19 widget ids present in catalog
  for (const id of ['recentReports', 'watchlist', 'modelStatus', 'huntCalendar', 'costUsage',
    'webhookDeliveries', 'payloadFamily', 'retestQueue', 'mentions', 'findingsTicker',
    'uptime', 'chains', 'coverage', 'comparative']) {
    assert.ok(catalogBlock.includes(`id: '${id}'`), `catalog missing ${id}`);
  }
});

test('ToastCenter.jsx exports provider, hook, card', () => {
  const src = read('ToastCenter.jsx');
  for (const name of ['ToastProvider', 'useToast', 'ToastCard']) assert.ok(src.includes(name), name);
});

test('CSS files carry the class hooks the components use', () => {
  const w2 = read('DashboardWidgets2.css');
  for (const cls of ['.dw2-widget', '.dw2-ticker-track', '.dw2-cal', '.dw2-bar-fill', '.dw2-ring-fg', '.dw2-chain-mini'])
    assert.ok(w2.includes(cls), cls);
  const sh = read('DashboardShell.css');
  for (const cls of ['.dsh-grid', '.dsh-frame', '.dsh-resize-handle', '.dsh-modal-backdrop', '.dsh-sticky', '.dsh-quiet-banner'])
    assert.ok(sh.includes(cls), cls);
  const tc = read('ToastCenter.css');
  for (const cls of ['.toast-center', '.toast-card', '.toast-bottom-right', '.toast-bottom-center', '.toast-requires-ack', '.toast-more'])
    assert.ok(tc.includes(cls), cls);
});
