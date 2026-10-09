/**
 * Wave 108B tests — risk scoring suite (ideas 54291-54300).
 * Run: node --test frontend/src/components/hunt/wave108B.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const corePath = join(here, 'wave108BCores.js');
const jsxPath = join(here, 'Wave108B.jsx');
const cssPath = join(here, 'Wave108B.css');

import {
  WAVE108_B_IDEAS,
  exploitabilityIndex,
  tagCrownJewel,
  untagCrownJewel,
  isCrownJewel,
  sortWithCrownJewels,
  applyComplianceBoost,
  factorDocLink,
  FACTOR_KEYS,
  scoreBreakdown,
  assignSmartBand,
  exportScoresCsv,
  buildSmartGroups,
  subscribeTopMovers,
  unsubscribeTopMovers,
  buildWeeklyMoversDigest,
  buildLeaderboard,
  correlationStats,
  patchCadenceScore,
} from './wave108BCores.js';

const EXPECTED_TITLES = {
  54291: 'Exploitability index',
  54292: 'Crown-jewel tagging boost',
  54293: 'Compliance scope boost',
  54294: 'Score documentation links',
  54295: 'Score export',
  54296: 'Score-based smart groups',
  54297: 'Score notifications',
  54298: 'Risk score leaderboard',
  54299: 'Score vs findings correlation',
  54300: 'Patch cadence factor',
};

const mkTarget = (overrides = {}) => ({
  id: 't1',
  name: 'Target One',
  score: 60,
  tags: [],
  frameworks: [],
  likelihoodSignals: { attackSurface: 0.5, exposure: 0.5, vulnHistory: 0.5, techRisk: 0.5, exploitAvailability: 0.5 },
  impactSignals: { dataSensitivity: 0.5, revenueImpact: 0.5, userCount: 0.5, complianceWeight: 0.5, crownJewelWeight: 0.5 },
  deployHistory: [],
  findings: [],
  ...overrides,
});

/* ---------- idea registry ---------- */
test('WAVE108_B_IDEAS has exactly 10 entries, ids 54291-54300, titles matching the idea bank', () => {
  assert.equal(WAVE108_B_IDEAS.length, 10);
  const ids = WAVE108_B_IDEAS.map((i) => i.id);
  for (let id = 54291; id <= 54300; id += 1) {
    assert.ok(ids.includes(id), `missing id ${id}`);
  }
  for (const idea of WAVE108_B_IDEAS) {
    assert.equal(idea.title, EXPECTED_TITLES[idea.id], `title mismatch for ${idea.id}`);
  }
});

/* ---------- 54291 exploitability index ---------- */
test('54291: exploitabilityIndex keeps likelihood and impact as separate dimensions', () => {
  const r = exploitabilityIndex(
    { attackSurface: 1, exposure: 1, vulnHistory: 1, techRisk: 1, exploitAvailability: 1 },
    { dataSensitivity: 0, revenueImpact: 0, userCount: 0, complianceWeight: 0, crownJewelWeight: 0 }
  );
  assert.equal(r.likelihood, 100);
  assert.equal(r.impact, 0);
  assert.equal(r.index, 0, 'geometric mean keeps a one-sided spike from dominating');
  assert.equal(r.quadrant, 'high-likelihood-low-impact');
});

test('54291: exploitabilityIndex rewards both dimensions and names the quadrant', () => {
  const r = exploitabilityIndex(
    { attackSurface: 0.8, exposure: 0.8, vulnHistory: 0.8, techRisk: 0.8, exploitAvailability: 0.8 },
    { dataSensitivity: 0.8, revenueImpact: 0.8, userCount: 0.8, complianceWeight: 0.8, crownJewelWeight: 0.8 }
  );
  assert.equal(r.likelihood, 80);
  assert.equal(r.impact, 80);
  assert.equal(r.index, 80);
  assert.equal(r.quadrant, 'high-likelihood-high-impact');
  const low = exploitabilityIndex({}, {});
  assert.equal(low.quadrant, 'low-likelihood-low-impact');
});

/* ---------- 54292 crown jewels ---------- */
test('54292: tagCrownJewel marks the target; isCrownJewel reads tag or flag', () => {
  const tagged = tagCrownJewel(mkTarget());
  assert.equal(isCrownJewel(tagged), true);
  assert.ok(tagged.tags.includes('crown-jewel'));
  assert.equal(isCrownJewel(mkTarget({ tags: ['crown-jewel'] })), true);
  assert.equal(isCrownJewel(mkTarget()), false);
  assert.equal(isCrownJewel(untagCrownJewel(tagged)), false);
});

test('54292: sortWithCrownJewels pins crown jewels first even with lower score', () => {
  const jewel = tagCrownJewel(mkTarget({ id: 'jewel', name: 'Jewel', score: 40 }));
  const plain = mkTarget({ id: 'plain', name: 'Plain', score: 90 });
  const other = mkTarget({ id: 'other', name: 'Other', score: 50 });
  const sorted = sortWithCrownJewels([plain, jewel, other], (t) => t.score);
  assert.deepEqual(sorted.map((t) => t.id), ['jewel', 'plain', 'other']);
});

test('54292: scoreBreakdown adds the crown-jewel boost, capped at 100', () => {
  const b = scoreBreakdown(tagCrownJewel(mkTarget({ score: 96 })));
  assert.equal(b.crownJewel, true);
  assert.equal(b.total, 100, 'boost is clamped at 100');
});

/* ---------- 54293 compliance boost ---------- */
test('54293: applyComplianceBoost raises the score for in-scope targets only', () => {
  const scope = { framework: 'PCI-DSS', inScope: ['t1'] };
  const inScope = applyComplianceBoost(mkTarget({ score: 70 }), scope);
  assert.equal(inScope.inScope, true);
  assert.equal(inScope.boost, 8);
  assert.equal(inScope.boostedScore, 78);
  assert.ok(inScope.reason.includes('PCI-DSS'));

  const byFramework = applyComplianceBoost(mkTarget({ id: 't9', score: 70, frameworks: ['PCI-DSS'] }), scope);
  assert.equal(byFramework.inScope, true);

  const out = applyComplianceBoost(mkTarget({ id: 't2', score: 70 }), scope);
  assert.equal(out.inScope, false);
  assert.equal(out.boost, 0);
  assert.equal(out.boostedScore, 70);
});

/* ---------- 54294 docs links ---------- */
test('54294: factorDocLink returns URL and label for every known factor', () => {
  assert.equal(FACTOR_KEYS.length, 6);
  for (const key of FACTOR_KEYS) {
    const doc = factorDocLink(key);
    assert.equal(doc.key, key);
    assert.ok(doc.url, `missing url for ${key}`);
    assert.ok(doc.label, `missing label for ${key}`);
  }
});

test('54294: factorDocLink throws on unknown factor keys', () => {
  assert.throws(() => factorDocLink('nope'), /unknown scoring factor/);
});

/* ---------- 54295 score export ---------- */
test('54295: exportScoresCsv has header row plus one row per target with breakdown columns', () => {
  const targets = [
    tagCrownJewel(mkTarget({ id: 'a', name: 'Alpha', score: 80 })),
    mkTarget({ id: 'b', name: 'Beta, Inc.', score: 30 }),
  ];
  const csv = exportScoresCsv(targets);
  const lines = csv.split('\n');
  assert.equal(lines.length, 3);
  const header = lines[0].split(',');
  assert.ok(header.includes('effective_score'));
  assert.ok(header.includes('exploitability_index'));
  assert.ok(header.includes('crown_jewel'));
  assert.ok(header.includes('band'));
  assert.ok(lines[1].includes('yes'), 'crown jewel column marks yes for the jewel');
  assert.ok(lines[2].includes('"Beta, Inc."'), 'commas in names are quoted');
});

/* ---------- 54296 smart groups ---------- */
test('54296: buildSmartGroups places targets in the right bands and sorts within them', () => {
  const groups = buildSmartGroups([
    mkTarget({ id: 'c', name: 'Crit', score: 90 }),
    mkTarget({ id: 'h', name: 'High', score: 70 }),
    mkTarget({ id: 'm', name: 'Med', score: 45 }),
    mkTarget({ id: 'l', name: 'Low', score: 10 }),
  ]);
  assert.deepEqual(groups.counts, { critical: 1, high: 1, medium: 1, low: 1 });
  assert.equal(groups.critical[0].id, 'c');
  assert.equal(groups.low[0].id, 'l');
  assert.equal(assignSmartBand(85), 'critical');
  assert.equal(assignSmartBand(84.9), 'high');
  assert.equal(assignSmartBand(40), 'medium');
  assert.equal(assignSmartBand(39.9), 'low');
});

test('54296: smart groups stay current after a rescore moves a target between bands', () => {
  const before = buildSmartGroups([mkTarget({ id: 'x', name: 'X', score: 60 })]);
  assert.equal(before.medium.length, 1);
  const after = buildSmartGroups([mkTarget({ id: 'x', name: 'X', score: 92 })]);
  assert.equal(after.critical.length, 1);
  assert.equal(after.medium.length, 0);
});

/* ---------- 54297 notifications ---------- */
test('54297: subscribeTopMovers validates email and clamps topN', () => {
  const sub = subscribeTopMovers('lead@example.com', { topN: 3 });
  assert.equal(sub.email, 'lead@example.com');
  assert.equal(sub.topN, 3);
  assert.equal(sub.frequency, 'weekly');
  assert.equal(sub.active, true);
  assert.throws(() => subscribeTopMovers('not-an-email'), /valid email/);
  assert.equal(unsubscribeTopMovers(sub).active, false);
});

test('54297: buildWeeklyMoversDigest ranks by absolute delta and writes a summary', () => {
  const targets = [
    mkTarget({ id: 'up', name: 'Up', score: 80 }),
    mkTarget({ id: 'down', name: 'Down', score: 30 }),
    mkTarget({ id: 'same', name: 'Same', score: 50 }),
  ];
  const digest = buildWeeklyMoversDigest(targets, { up: 60, down: 50, same: 50 }, { topN: 5 });
  assert.equal(digest.totalMovers, 2, 'unchanged target is excluded');
  assert.equal(digest.movers[0].targetId, 'up', 'biggest absolute mover first');
  assert.equal(digest.movers[0].direction, 'up');
  assert.equal(digest.movers[0].delta, 20);
  assert.equal(digest.movers[1].direction, 'down');
  assert.ok(digest.summary.includes('2 targets'));
  assert.ok(digest.summary.includes('Up'));
});

/* ---------- 54298 leaderboard ---------- */
test('54298: buildLeaderboard ranks by effective score with correct movement arrows', () => {
  const jewel = tagCrownJewel(mkTarget({ id: 'j', name: 'Jewel', score: 55 }));
  const plain = mkTarget({ id: 'p', name: 'Plain', score: 70 });
  const fresh = mkTarget({ id: 'n', name: 'New', score: 80 });
  // Empty deploy history gives cadence swing -5, so effective scores are:
  // jewel 55 + 10 (jewel) - 5 = 60; plain 70 - 5 = 65; new 80 - 5 = 75.
  const rows = buildLeaderboard([plain, jewel, fresh], { j: 55, p: 70 });
  assert.deepEqual(rows.map((r) => r.id), ['n', 'p', 'j']);
  assert.deepEqual(rows.map((r) => r.rank), [1, 2, 3]);
  const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
  assert.equal(byId.j.movement, 'up');
  assert.equal(byId.j.arrow, '▲');
  assert.equal(byId.p.movement, 'down');
  assert.equal(byId.p.arrow, '▼');
  assert.equal(byId.n.movement, 'new');
  assert.equal(byId.n.arrow, '✦');
  const same = buildLeaderboard([mkTarget({ id: 's', score: 60 })], { s: 55 });
  assert.equal(same[0].movement, 'same');
  assert.equal(same[0].arrow, '→');
});

/* ---------- 54299 correlation ---------- */
test('54299: correlationStats buckets hit rates and calibration score stays in 0..1', () => {
  const mk = (id, score, n) => mkTarget({ id, name: id, score, findings: Array.from({ length: n }, (_, i) => ({ id: `${id}-f${i}` })) });
  const stats = correlationStats([
    mk('a', 95, 3), mk('b', 92, 2), mk('c', 80, 1),
    mk('d', 55, 0), mk('e', 45, 1), mk('f', 20, 0), mk('g', 15, 0),
  ]);
  const crit = stats.buckets.find((b) => b.band === 'critical');
  assert.equal(crit.targets, 2);
  assert.equal(crit.hitRate, 1, 'both critical-band targets have findings');
  const low = stats.buckets.find((b) => b.band === 'low');
  assert.equal(low.hitRate, 0);
  assert.ok(stats.calibrationScore >= 0.6, `expected decent calibration, got ${stats.calibrationScore}`);
  assert.ok(stats.interpretation.length > 0);
  assert.equal(stats.targetCount, 7);
});

test('54299: weak correlation yields a low calibration score with retune guidance', () => {
  const mk = (id, score, n) => mkTarget({ id, name: id, score, findings: Array.from({ length: n }, (_, i) => ({ id: `${id}-f${i}` })) });
  const stats = correlationStats([
    mk('a', 95, 0), mk('b', 92, 0), mk('c', 80, 0),
    mk('d', 55, 3), mk('e', 45, 2), mk('f', 20, 4),
  ]);
  assert.ok(stats.calibrationScore < 0.5, `expected weak calibration, got ${stats.calibrationScore}`);
  assert.ok(stats.interpretation.includes('retune'));
});

/* ---------- 54300 patch cadence ---------- */
test('54300: patchCadenceScore orders fast > slow > stale, all within 0..1', () => {
  const now = new Date('2026-10-10T00:00:00.000Z');
  const daysAgo = (d) => ({ deployedAt: new Date(now.getTime() - d * 86400000).toISOString() });
  const fast = [daysAgo(1), daysAgo(8), daysAgo(15), daysAgo(22)].map((d) => d);
  const slow = [daysAgo(30), daysAgo(120), daysAgo(210), daysAgo(300)];
  const stale = [daysAgo(200), daysAgo(400)];
  const fastScore = patchCadenceScore(fast, { now });
  const slowScore = patchCadenceScore(slow, { now });
  const staleScore = patchCadenceScore(stale, { now });
  for (const s of [fastScore, slowScore, staleScore]) {
    assert.ok(s >= 0 && s <= 1, `out of range: ${s}`);
  }
  assert.ok(fastScore > slowScore, `fast ${fastScore} should beat slow ${slowScore}`);
  assert.ok(slowScore > staleScore, `slow ${slowScore} should beat stale ${staleScore}`);
  assert.ok(fastScore >= 0.75, `weekly shipping should score high, got ${fastScore}`);
});

test('54300: patchCadenceScore penalizes empty history and single deploys', () => {
  const now = new Date('2026-10-10T00:00:00.000Z');
  assert.equal(patchCadenceScore([], { now }), 0);
  const single = patchCadenceScore([{ deployedAt: new Date(now.getTime() - 86400000).toISOString() }], { now });
  assert.ok(single < 0.45, `single deploy should not score like real cadence, got ${single}`);
});

test('54300: scoreBreakdown feeds patch cadence into the effective score swing', () => {
  const now = new Date('2026-10-10T00:00:00.000Z');
  const daysAgo = (d) => ({ deployedAt: new Date(now.getTime() - d * 86400000).toISOString() });
  const fast = mkTarget({ score: 60, deployHistory: [daysAgo(1), daysAgo(8), daysAgo(15)] });
  const stale = mkTarget({ score: 60, deployHistory: [daysAgo(200), daysAgo(400)] });
  const bFast = scoreBreakdown(fast);
  const bStale = scoreBreakdown(stale);
  assert.ok(bFast.patchCadenceSwing > bStale.patchCadenceSwing);
  assert.ok(bFast.total > bStale.total, 'fast cadence lifts the effective score');
});

/* ---------- file existence ---------- */
test('all 4 deliverable files exist', () => {
  for (const p of [corePath, jsxPath, cssPath, join(here, 'wave108B.test.js')]) {
    assert.ok(existsSync(p), `missing file: ${p}`);
  }
});

/* ---------- branding ---------- */
test('no branding leak: forbidden brand string appears in none of the wave 108B files', () => {
  const forbidden = 'Mu' + 'se'; // built without the literal string in source
  for (const p of [corePath, jsxPath, cssPath, join(here, 'wave108B.test.js')]) {
    const text = readFileSync(p, 'utf8');
    assert.ok(!text.includes(forbidden), `forbidden brand string found in ${p}`);
  }
});
