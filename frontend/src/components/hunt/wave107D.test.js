/**
 * wave107D.test.js — Infinity AI · Wave 107 Group D
 * node:test + node:assert/strict.
 *
 * Covers ideas 54271–54280: registry integrity (10 entries, ids, titles
 * matched against the idea bank), at least one behavioral assertion per
 * idea, queue sorted descending, percentile bounds 0–100, and a
 * no-branding-leak audit (Infinity AI branding only in the new files).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  WAVE107_D_IDEAS,
  buildScoreTrend,
  applyManualOverride,
  confidenceIndicator,
  peerPercentile,
  applyProgramTierWeighting,
  applyClientSlaWeighting,
  orderHuntQueue,
  checkAutoHuntThresholds,
  decayHuntedDampener,
  boostOnNewChanges,
} from './wave107DCores.js';

const here = dirname(fileURLToPath(import.meta.url));
const H = 3_600_000;
const NOW = 1760064000000;

test('registry: exactly 10 ideas, ids 54271–54280', () => {
  assert.equal(WAVE107_D_IDEAS.length, 10);
  assert.deepEqual(WAVE107_D_IDEAS.map((i) => i.id), [
    54271, 54272, 54273, 54274, 54275, 54276, 54277, 54278, 54279, 54280,
  ]);
});

test('registry: titles match the idea bank exactly', () => {
  const expected = {
    54271: 'Score trend chart',
    54272: 'Manual score override',
    54273: 'Score confidence indicator (targets)',
    54274: 'Peer percentile ranking',
    54275: 'Program tier weighting',
    54276: 'Client SLA weighting',
    54277: 'Score-based hunt queue',
    54278: 'Auto-hunt score thresholds',
    54279: 'Recently-hunted dampener decay',
    54280: 'Score boost on new changes',
  };
  for (const entry of WAVE107_D_IDEAS) {
    assert.equal(entry.title, expected[entry.id], `title mismatch for ${entry.id}`);
  }
});

test('54271 buildScoreTrend: annotated trend with net change and direction', () => {
  const history = [
    { ts: NOW - 48 * H, score: 90, annotation: 'IDOR verified' },
    { ts: NOW - 96 * H, score: 60, annotation: 'Recon finished' }, // out of order on purpose
    { ts: NOW - 24 * H, score: 40, annotation: 'FP confirmed' },
  ];
  const trend = buildScoreTrend(history);
  assert.equal(trend.pointCount, 3);
  assert.deepEqual(trend.points.map((p) => p.ts), [NOW - 96 * H, NOW - 48 * H, NOW - 24 * H]);
  assert.equal(trend.firstScore, 60);
  assert.equal(trend.lastScore, 40);
  assert.equal(trend.netChange, -20);
  assert.equal(trend.trend, 'down');
  assert.equal(trend.annotations.length, 3);
  assert.equal(trend.annotations[0].text, 'Recon finished');
  assert.deepEqual(trend.points[1], { ts: NOW - 48 * H, score: 90, delta: 30, direction: 'up' });
});

test('54272 applyManualOverride: pins score with justification, input untouched', () => {
  const target = { id: 't1', name: 'x', score: 55 };
  const result = applyManualOverride(target, 82, '  Analyst context  ', {
    analystId: 'ana-1',
    at: NOW,
  });
  assert.equal(result.score, 82);
  assert.equal(result.override.pinnedScore, 82);
  assert.equal(result.override.previousScore, 55);
  assert.equal(result.override.justification, 'Analyst context');
  assert.equal(result.override.analystId, 'ana-1');
  assert.equal(result.override.at, NOW);
  assert.equal(result.override.isManualOverride, true);
  assert.equal(target.score, 55); // original not mutated
  const empty = applyManualOverride({ score: 10 }, 20, '   ', { at: NOW });
  assert.equal(empty.override.justification, 'No justification recorded');
});

test('54273 confidenceIndicator: strong evidence = high, thin evidence flagged', () => {
  const strong = confidenceIndicator(88, [
    { source: 'recon', weight: 30 },
    { source: 'detector', weight: 35 },
    { source: 'poc', weight: 25 },
  ]);
  assert.equal(strong.confidence, 90);
  assert.equal(strong.level, 'high');
  assert.equal(strong.thinData, false);
  assert.equal(strong.evidenceCount, 3);
  const thin = confidenceIndicator(41, [{ source: 'recon', weight: 15 }]);
  assert.equal(thin.level, 'low');
  assert.equal(thin.thinData, true);
  const none = confidenceIndicator(50, []);
  assert.equal(none.confidence, 0);
  assert.ok(none.confidence >= 0 && none.confidence <= 100);
});

test('54274 peerPercentile: stays within 0–100 and labels correctly', () => {
  const peers = [50, 60, 70, 90, 95];
  const top = peerPercentile(80, peers);
  assert.equal(top.percentile, 60);
  assert.equal(top.peerCount, 5);
  assert.equal(top.peersBelow, 3);
  assert.equal(top.label, 'riskier than 60% of targets');
  const best = peerPercentile(99, peers);
  assert.equal(best.percentile, 100);
  const worst = peerPercentile(10, peers);
  assert.equal(worst.percentile, 0);
  for (const s of [0, 25, 50, 75, 100]) {
    const r = peerPercentile(s, peers);
    assert.ok(r.percentile >= 0 && r.percentile <= 100, `out of bounds: ${r.percentile}`);
  }
  assert.equal(peerPercentile(70, []).percentile, 0);
});

test('54275 applyProgramTierWeighting: bounty nudges score, boost is capped', () => {
  const elite = applyProgramTierWeighting(78, 4500, { tier: 'elite' });
  const standard = applyProgramTierWeighting(78, 4500, { tier: 'standard' });
  assert.ok(elite.boost > standard.boost, 'elite tier should boost more than standard');
  assert.ok(elite.finalScore >= elite.score);
  assert.ok(elite.finalScore <= 100);
  const whale = applyProgramTierWeighting(90, 10_000_000, { tier: 'elite' });
  assert.ok(whale.boost <= 25, 'boost must be capped at maxBoost');
  assert.equal(whale.finalScore, 100);
  const unknown = applyProgramTierWeighting(50, 1000, { tier: 'nope' });
  assert.equal(unknown.tier, 'standard');
});

test('54276 applyClientSlaWeighting: known client multiplied, unknown stays neutral', () => {
  const vip = applyClientSlaWeighting(64, 'acme-corp', { 'acme-corp': 1.35 });
  assert.equal(vip.multiplier, 1.35);
  assert.equal(vip.weighted, true);
  assert.equal(vip.finalScore, 86.4);
  const stranger = applyClientSlaWeighting(64, 'unknown-co', { 'acme-corp': 1.35 });
  assert.equal(stranger.multiplier, 1);
  assert.equal(stranger.weighted, false);
  assert.equal(stranger.finalScore, 64);
  const capped = applyClientSlaWeighting(95, 'vip', { vip: 3 });
  assert.equal(capped.finalScore, 100);
});

test('54277 orderHuntQueue: sorted descending, stable on ties, input untouched', () => {
  const targets = [
    { id: 'b', score: 64 },
    { id: 'a', score: 91 },
    { id: 'c', score: 91 },
    { id: 'd', score: 41 },
  ];
  const queue = orderHuntQueue(targets);
  assert.deepEqual(queue.map((t) => t.id), ['a', 'c', 'b', 'd']);
  assert.deepEqual(queue.map((t) => t.score), [91, 91, 64, 41]);
  assert.deepEqual(queue.map((t) => t.queueRank), [1, 2, 3, 4]);
  assert.equal(targets[0].id, 'b'); // input order untouched
  assert.ok(!('queueRank' in targets[0]));
  for (let i = 1; i < queue.length; i++) {
    assert.ok(queue[i - 1].score >= queue[i].score, 'queue must be sorted descending by score');
  }
});

test('54278 checkAutoHuntThresholds: only crossed targets returned, per-target lines win', () => {
  const targets = [
    { id: 'a', score: 88 },
    { id: 'b', score: 64 },
    { id: 'c', score: 74 },
  ];
  const crossed = checkAutoHuntThresholds(targets, { default: 75, perTarget: { c: 70 } });
  assert.deepEqual(crossed.map((r) => r.id), ['a', 'c']);
  assert.ok(crossed.every((r) => r.crossed && r.autoHunt));
  assert.equal(crossed[1].line, 70);
  assert.deepEqual(checkAutoHuntThresholds(targets, { default: 99 }), []);
});

test('54279 decayHuntedDampener: dampener fades over time, stale targets recover', () => {
  const recent = decayHuntedDampener(
    { id: 'a', score: 80, lastHuntedTs: NOW - 6 * H, huntedDampener: 20 },
    NOW,
  );
  const stale = decayHuntedDampener(
    { id: 'a', score: 80, lastHuntedTs: NOW - 240 * H, huntedDampener: 20 },
    NOW,
  );
  assert.ok(recent.remainingDampener > stale.remainingDampener, 'dampener must shrink with time');
  assert.equal(stale.fullyRecovered, true);
  assert.equal(stale.effectiveScore, 80);
  assert.ok(recent.effectiveScore < 80, 'recent hunts still dampen the score');
  assert.ok(recent.effectiveScore >= 0);
  // half-life sanity: 24h elapsed with 24h half-life halves the dampener
  const half = decayHuntedDampener(
    { id: 'a', score: 80, lastHuntedTs: NOW - 24 * H, huntedDampener: 20 },
    NOW,
    { halfLifeHours: 24 },
  );
  assert.ok(Math.abs(half.remainingDampener - 10) < 0.01);
});

test('54280 boostOnNewChanges: recent high-interest changes lift the score, capped', () => {
  const boosted = boostOnNewChanges(70, [
    { type: 'new-endpoint', interest: 0.9, detectedTs: NOW - 1 * H },
    { type: 'header-change', interest: 0.2, detectedTs: NOW - 100 * H },
  ], NOW);
  assert.equal(boosted.contributingChanges, 2);
  assert.ok(boosted.boost > 0 && boosted.boost <= 30);
  assert.ok(boosted.boostedScore > 70);
  const empty = boostOnNewChanges(70, [], NOW);
  assert.equal(empty.boost, 0);
  assert.equal(empty.boostedScore, 70);
  const noisy = boostOnNewChanges(
    50,
    Array.from({ length: 10 }, () => ({ type: 'x', interest: 1, detectedTs: NOW })),
    NOW,
  );
  assert.equal(noisy.boost, 30, 'boost must be capped at maxBoost');
});

test('no-branding-leak: forbidden brand string absent from the new files', () => {
  // The forbidden brand name is built dynamically so the audit itself does
  // not contain the literal string it searches for.
  const forbidden = ['Mu', 'se'].join('');
  const files = ['wave107DCores.js', 'Wave107D.jsx', 'wave107D.test.js'];
  for (const f of files) {
    const content = readFileSync(join(here, f), 'utf8');
    const stripped = content.split(`const forbidden = ['Mu', 'se'].join('');`).join('');
    assert.ok(!stripped.includes(forbidden), `${f} leaks a forbidden brand string`);
    assert.ok(content.includes('Infinity AI'), `${f} should carry Infinity AI branding`);
  }
});
