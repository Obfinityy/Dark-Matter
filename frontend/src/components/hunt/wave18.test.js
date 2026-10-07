/**
 * wave18.test.js — node --test suite for wave 18 (ideas 50681–50720).
 * Covers themeRound3Core.js + dashboardCore.js pure logic and the
 * WAVE18_IDEAS registry completeness (40/40, honest SKIPs included).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SEPIA_THEME,
  severityTintForTheme,
  tintOpacityForTheme,
  errorColorPairs,
  FORCED_COLORS_MAP,
  forcedColorsCssVars,
  IDE_THEMES,
  ideThemePalette,
  ideThemeIds,
  isDndNow,
  shouldRunThemeTransition,
  dndWindowLabel,
  makeHuntThemeStore,
  syncThemePreference,
  themePreferenceRecord,
  embeddedThemePayload,
  parseEmbeddedThemeMessage,
  EMBED_THEME_MESSAGE,
  progressAccentForTheme,
  scrollbarClass,
  selectionClass,
  tableModeClass,
  HIGH_CONTRAST_FOCUS_SPEC,
  instantThemeAttrs,
  firstRunThemes,
  gradientsAllowed,
  emptyIllustrationVariant,
  sepiaTextPair,
  WAVE18_IDEAS,
  wave18Coverage,
} from './themeRound3Core.js';
import {
  normalizeSparkline,
  weekOverWeekDelta,
  formatCountdown,
  formatBytes,
  activeHuntsModel,
  severityDonutSegments,
  weeklyFindingsModel,
  throughputModel,
  needsReviewModel,
  topVulnerableTargetsModel,
  agentActivityHeatmap,
  timeToFirstFindingModel,
  fpRateModel,
  reportReadyModel,
  upcomingSchedulesModel,
  integrationHealthModel,
  learningAppliedModel,
  storageUsageModel,
  teamLeaderboardModel,
  slaRiskModel,
} from './dashboardCore.js';

/* Registry completeness ------------------------------------------------ */
test('WAVE18_IDEAS covers all 40 ideas 50681-50720', () => {
  assert.equal(WAVE18_IDEAS.length, 40);
  const ids = WAVE18_IDEAS.map((i) => i.id).sort((a, b) => a - b);
  for (let n = 50681; n <= 50720; n += 1) assert.ok(ids.includes(n), `missing idea ${n}`);
  const skips = WAVE18_IDEAS.filter((i) => i.status === 'skipped').map((i) => i.id).sort();
  assert.deepEqual(skips, [50684, 50688, 50689, 50693, 50696, 50703]);
  const cov = wave18Coverage();
  assert.equal(cov.total, 40);
  assert.equal(cov.shipped + cov.skipped, 40);
});

/* 50685 — sepia theme --------------------------------------------------- */
test('SEPIA_THEME is a complete warm reading palette', () => {
  assert.equal(SEPIA_THEME.id, 'sepia');
  assert.match(SEPIA_THEME.vars['--bg'], /^#[0-9a-f]{6}$/i);
  assert.match(SEPIA_THEME.vars['--text'], /^#[0-9a-f]{6}$/i);
  const pair = sepiaTextPair();
  assert.ok(pair.ratio >= 4.5, `sepia text/bg contrast ${pair.ratio} below 4.5`);
});

/* 50686 — balanced severity tints ---------------------------------------- */
test('severityTintForTheme uses 4% dark-family / 8% light-family opacity', () => {
  assert.equal(tintOpacityForTheme('dark'), 0.04);
  assert.equal(tintOpacityForTheme('dim'), 0.04);
  assert.equal(tintOpacityForTheme('high-contrast'), 0.04);
  assert.equal(tintOpacityForTheme('light'), 0.08);
  assert.equal(tintOpacityForTheme('sepia'), 0.08);
  assert.match(severityTintForTheme('critical', 'dark'), /^rgba\(255, 77, 77, 0\.04\)$/);
  assert.match(severityTintForTheme('low', 'light'), /0\.08\)$/);
  assert.match(severityTintForTheme('bogus', 'dark'), /^rgba\(/); // falls back to low
});

/* 50692 — error color pairs ------------------------------------------------ */
test('errorColorPairs ships icon + label, never color-alone', () => {
  for (const theme of ['dark', 'light', 'sepia', 'high-contrast']) {
    const p = errorColorPairs(theme);
    for (const k of ['error', 'success', 'warning']) {
      assert.ok(p[k].icon, `${k} missing icon`);
      assert.ok(p[k].label, `${k} missing label`);
      assert.ok(p[k].shape, `${k} missing shape`);
    }
    assert.notEqual(p.error.hue, p.success.hue);
  }
});

/* 50697 — forced-colors ------------------------------------------------------ */
test('forcedColorsCssVars maps app vars to system colors', () => {
  const css = forcedColorsCssVars();
  assert.ok(css.includes('--bg: Canvas'));
  assert.ok(css.includes('--accent: Highlight'));
  assert.ok(css.includes('--text-dim: GrayText'));
  assert.equal(Object.keys(FORCED_COLORS_MAP).length >= 6, true);
});

/* 50699 — IDE themes ------------------------------------------------------------ */
test('ideThemePalette returns palettes and a follow-app fallback', () => {
  const dracula = ideThemePalette('dracula');
  assert.equal(dracula.bg, '#282a36');
  assert.ok(dracula.kw);
  assert.equal(ideThemePalette('bogus').label, 'Follow app theme');
  assert.ok(ideThemeIds().length >= 4);
  assert.ok(ideThemeIds().includes('vscode-dark'));
});

/* 50701 — DND-aware scheduling ------------------------------------------------------ */
test('isDndNow handles wrapping midnight windows', () => {
  const at = (h) => new Date(2026, 9, 7, h, 0, 0);
  assert.equal(isDndNow({ startHour: 22, endHour: 7, now: at(23) }), true);
  assert.equal(isDndNow({ startHour: 22, endHour: 7, now: at(3) }), true);
  assert.equal(isDndNow({ startHour: 22, endHour: 7, now: at(12) }), false);
  assert.equal(isDndNow({ startHour: 9, endHour: 17, now: at(12) }), true);
  assert.equal(isDndNow({ startHour: 9, endHour: 17, now: at(20) }), false);
  assert.equal(isDndNow({}), false);
  assert.equal(shouldRunThemeTransition({ dnd: { startHour: 22, endHour: 7 }, date: at(23) }), false);
  assert.equal(shouldRunThemeTransition({ dnd: { startHour: 22, endHour: 7 }, date: at(12) }), true);
  assert.equal(dndWindowLabel({ startHour: 22, endHour: 7 }), '22:00 – 07:00 local');
  assert.equal(dndWindowLabel({}), 'Off');
});

/* 50702 — per-hunt theme override -------------------------------------------------------- */
test('makeHuntThemeStore pins and clears per-hunt themes', () => {
  const mem = {};
  const store = makeHuntThemeStore({ getItem: (k) => mem[k] || null, setItem: (k, v) => { mem[k] = v; } });
  assert.equal(store.get('h1'), null);
  assert.equal(store.effective('h1', 'dark'), 'dark');
  store.set('h1', 'high-contrast');
  assert.equal(store.get('h1'), 'high-contrast');
  assert.equal(store.effective('h1', 'dark'), 'high-contrast');
  store.set('h1', null);
  assert.equal(store.get('h1'), null);
});

/* 50683 — synced theme preference ---------------------------------------------------------------- */
test('syncThemePreference: last writer wins, ties prefer explicit device', () => {
  const dev = 'dev-a';
  const local = themePreferenceRecord({ deviceId: dev, theme: 'sepia', updatedAt: 100 });
  const account = themePreferenceRecord({ deviceId: 'dev-b', theme: 'dark', updatedAt: 200 });
  const m1 = syncThemePreference({ deviceId: dev, local, account });
  assert.equal(m1.theme, 'dark');
  assert.equal(m1.source, 'account');
  const m2 = syncThemePreference({ deviceId: dev, local: { ...local, updatedAt: 300 }, account });
  assert.equal(m2.theme, 'sepia');
  assert.equal(m2.source, 'local');
  // tie → device's own explicit record wins
  const m3 = syncThemePreference({ deviceId: dev, local: { ...local, updatedAt: 200 }, account });
  assert.equal(m3.theme, 'sepia');
  assert.equal(m3.synced, true);
});

/* 50690 — embedded report bridge ------------------------------------------------------------------------ */
test('embeddedThemePayload / parseEmbeddedThemeMessage round-trip with validation', () => {
  const p = embeddedThemePayload({ themeId: 'dark', vars: { '--bg': '#000' } });
  assert.equal(p.type, EMBED_THEME_MESSAGE);
  const back = parseEmbeddedThemeMessage(p);
  assert.deepEqual(back, { themeId: 'dark', vars: { '--bg': '#000' } });
  assert.equal(parseEmbeddedThemeMessage({ type: 'nope' }), null);
  assert.equal(parseEmbeddedThemeMessage({ type: EMBED_THEME_MESSAGE, themeId: 'x'.repeat(64) }), null);
  assert.equal(parseEmbeddedThemeMessage(null), null);
});

/* 50691 — progress accents ----------------------------------------------------------------------------------- */
test('progressAccentForTheme gives high-contrast a solid fill', () => {
  const hc = progressAccentForTheme('high-contrast');
  assert.equal(hc.fill, '#ffffff');
  const dark = progressAccentForTheme('dark', '#6e8efb');
  assert.equal(dark.fill, '#6e8efb');
  assert.ok(dark.track.includes('rgba'));
});

/* class helpers ------------------------------------------------------------------------------------------------ */
test('scrollbar/selection/table/focus helpers', () => {
  assert.ok(scrollbarClass('dark').includes('th-scrollbars-dark'));
  assert.ok(selectionClass('sepia').includes('th-selection-sepia'));
  assert.equal(tableModeClass('high-contrast'), 'th-table-hc');
  assert.equal(tableModeClass('standard'), 'th-table');
  assert.equal(HIGH_CONTRAST_FOCUS_SPEC.outlineWidth, '3px');
  assert.equal(HIGH_CONTRAST_FOCUS_SPEC.outlineOffset, '2px');
  assert.deepEqual(instantThemeAttrs('light'), { 'data-theme': 'light', 'data-th-instant': 'true' });
  assert.equal(gradientsAllowed('dark'), true);
  assert.equal(gradientsAllowed('dim'), true);
  assert.equal(gradientsAllowed('light'), false);
  assert.equal(gradientsAllowed('sepia'), false);
  assert.equal(emptyIllustrationVariant('light'), 'light');
  assert.equal(emptyIllustrationVariant('sepia'), 'light');
  assert.equal(emptyIllustrationVariant('dark'), 'dark');
  const fr = firstRunThemes();
  assert.equal(fr.length, 3);
  assert.deepEqual(fr.map((t) => t.id), ['dark', 'light', 'sepia']);
});

/* dashboardCore ----------------------------------------------------------------------------------------------- */
test('normalizeSparkline / weekOverWeekDelta / formatCountdown / formatBytes', () => {
  assert.deepEqual(normalizeSparkline([]), []);
  assert.deepEqual(normalizeSparkline([5, 5, 5]), [0.5, 0.5, 0.5]);
  const n = normalizeSparkline([0, 10]);
  assert.equal(n[0], 0);
  assert.equal(n[1], 1);
  assert.deepEqual(weekOverWeekDelta(12, 10), { deltaPct: 20, direction: 'up' });
  assert.equal(weekOverWeekDelta(0, 0).direction, 'flat');
  assert.equal(formatCountdown(90000), '1m');
  assert.equal(formatCountdown(3 * 3600000 + 600000), '3h 10m');
  assert.equal(formatCountdown(2 * 86400000), '2d 0h');
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(2.4 * 1024 ** 3), '2.4 GB');
});

test('activeHuntsModel filters + shapes running/paused hunts', () => {
  const rows = activeHuntsModel([
    { id: 'a', targetUrl: 'https://x.test/', status: 'running', phase: 'recon', progress: 0.5 },
    { id: 'b', targetUrl: 'https://y.test/', status: 'completed' },
    { id: 'c', targetUrl: 'not a url', status: 'paused', phase: 'testing', progress: 2 },
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].host, 'x.test');
  assert.equal(rows[1].host, 'not a url');
  assert.equal(rows[1].progress, 1); // clamped
});

test('severityDonutSegments counts + percents sum to 100', () => {
  const segs = severityDonutSegments([
    { severity: 'critical' }, { severity: 'CRITICAL' }, { severity: 'low' }, { severity: 'weird' },
  ]);
  const crit = segs.find((s) => s.severity === 'critical');
  assert.equal(crit.count, 2);
  const sum = segs.reduce((a, s) => a + s.pct, 0);
  assert.ok(Math.abs(sum - 100) < 0.01);
  assert.deepEqual(crit.filter, { severity: 'critical' });
});

test('weeklyFindingsModel totals + spark + WoW', () => {
  const days = Array.from({ length: 14 }, (_, i) => ({ day: `d${i}`, count: i < 7 ? 2 : 4 }));
  const m = weeklyFindingsModel(days);
  assert.equal(m.total, 28);
  assert.equal(m.points.length, 7);
  assert.equal(m.wow.direction, 'up');
});

test('throughputModel buckets 30 days', () => {
  const now = new Date('2026-10-07T12:00:00Z');
  const m = throughputModel([
    { completedAt: '2026-10-07T06:00:00Z' },
    { completedAt: '2026-09-01T00:00:00Z' },
  ], now);
  assert.equal(m.buckets.length, 30);
  assert.equal(m.total, 1);
  assert.equal(m.buckets[29], 1);
});

test('needsReviewModel returns top unreviewed sorted by severity', () => {
  const rows = needsReviewModel([
    { id: 'a', title: 'low one', severity: 'low' },
    { id: 'b', title: 'crit one', severity: 'critical' },
    { id: 'c', title: 'reviewed', severity: 'critical', reviewed: true },
    { id: 'd', title: 'fp', severity: 'high', falsePositive: true },
  ]);
  assert.deepEqual(rows.map((r) => r.id), ['a', 'b'].sort((x, y) => (x === 'b' ? -1 : 1)));
  assert.equal(rows[0].id, 'b');
});

test('topVulnerableTargetsModel ranks by criticals with trend', () => {
  const rows = topVulnerableTargetsModel(
    [
      { severity: 'critical', url: 'https://a.test/1' },
      { severity: 'critical', url: 'https://a.test/2' },
      { severity: 'low', url: 'https://b.test/' },
    ],
    { 'a.test': 1 }
  );
  assert.equal(rows[0].host, 'a.test');
  assert.equal(rows[0].critical, 2);
  assert.equal(rows[0].trend, 'up');
  assert.equal(rows[1].trend, 'new');
});

test('agentActivityHeatmap builds a 7x24 grid with peak', () => {
  const events = [
    { at: '2026-10-07T10:00:00Z' }, { at: '2026-10-07T10:30:00Z' }, { at: '2026-10-06T10:00:00Z' },
  ];
  const { grid, peak } = agentActivityHeatmap(events);
  assert.equal(grid.length, 7);
  assert.equal(grid[0].length, 24);
  assert.ok(peak.count >= 1);
});

test('timeToFirstFindingModel averages and trends (down is good)', () => {
  const m = timeToFirstFindingModel([
    { startedAt: '2026-10-01T00:00:00Z', firstFindingAt: '2026-10-01T01:00:00Z' },
    { startedAt: '2026-10-02T00:00:00Z', firstFindingAt: '2026-10-02T00:10:00Z' },
  ]);
  assert.equal(m.sample, 2);
  assert.equal(m.avgMs, 35 * 60000);
  assert.equal(m.trend, 'down');
  assert.equal(timeToFirstFindingModel([]).avgMs, null);
});

test('fpRateModel computes per-engine rates', () => {
  const rows = fpRateModel([
    { engine: 'a', falsePositive: true }, { engine: 'a' }, { engine: 'b' },
  ]);
  const a = rows.find((r) => r.engine === 'a');
  assert.equal(a.fpRate, 50);
  assert.equal(a.spark.length, 30);
});

test('reportReadyModel + upcomingSchedulesModel filter correctly', () => {
  const now = new Date('2026-10-07T12:00:00Z');
  const ready = reportReadyModel([
    { id: 'r1', targetUrl: 'https://a.test', status: 'completed', reportGenerated: false },
    { id: 'r2', targetUrl: 'https://b.test', status: 'completed', reportGenerated: true },
    { id: 'r3', targetUrl: 'https://c.test', status: 'running' },
  ]);
  assert.deepEqual(ready.map((r) => r.id), ['r1']);
  const sched = upcomingSchedulesModel(
    [
      { id: 's1', name: 'old', targetUrl: 'https://a.test', nextRunAt: '2026-10-01T00:00:00Z' },
      { id: 's2', name: 'soon', targetUrl: 'https://b.test', nextRunAt: '2026-10-07T15:00:00Z' },
    ],
    now
  );
  assert.deepEqual(sched.map((s) => s.id), ['s2']);
  assert.equal(sched[0].countdown, '3h 0m');
});

test('integrationHealthModel maps statuses to dots', () => {
  const rows = integrationHealthModel([
    { name: 'x', status: 'healthy' }, { name: 'y', status: 'degraded' }, { name: 'z', status: 'down' },
  ]);
  assert.deepEqual(rows.map((r) => r.dot), ['green', 'amber', 'red']);
});

test('learningAppliedModel keeps only this-week entries', () => {
  const now = new Date('2026-10-07T12:00:00Z');
  const rows = learningAppliedModel(
    [
      { rule: 'r1', example: 'e1', learnedAt: '2026-10-06T00:00:00Z', huntsImproved: 3 },
      { rule: 'r0', example: 'e0', learnedAt: '2026-09-01T00:00:00Z' },
    ],
    now
  );
  assert.deepEqual(rows.map((r) => r.rule), ['r1']);
});

test('storageUsageModel computes pct + advice tiers', () => {
  const m = storageUsageModel({ evidenceBytes: 9 * 1024 ** 3, snapshotBytes: 0, quotaBytes: 10 * 1024 ** 3 });
  assert.equal(m.pct, 90);
  assert.ok(m.suggestion.includes('clean'));
  const ok = storageUsageModel({ evidenceBytes: 1024, snapshotBytes: 0, quotaBytes: 10 * 1024 ** 3 });
  assert.ok(ok.suggestion.includes('healthy'));
});

test('teamLeaderboardModel is opt-in and ranked', () => {
  const rows = teamLeaderboardModel([
    { name: 'b', confirmedFindings: 5, optIn: true },
    { name: 'a', confirmedFindings: 9, optIn: true },
    { name: 'c', confirmedFindings: 99, optIn: false },
  ]);
  assert.deepEqual(rows.map((r) => r.name), ['a', 'b']);
  assert.equal(rows[0].rank, 1);
});

test('slaRiskModel sorts by urgency then remaining time', () => {
  const now = new Date('2026-10-07T12:00:00Z');
  const rows = slaRiskModel(
    [
      { id: 'ok', title: 'ok', severity: 'low', createdAt: '2026-10-07T00:00:00Z' },
      { id: 'hot', title: 'hot', severity: 'critical', createdAt: '2026-10-06T13:00:00Z' },
      { id: 'done', title: 'done', severity: 'critical', createdAt: '2026-10-06T13:00:00Z', resolved: true },
    ],
    { now }
  );
  assert.deepEqual(rows.map((r) => r.id), ['hot', 'ok']);
  assert.ok(rows[0].countdown.includes('h') || rows[0].countdown.includes('m'));
});
