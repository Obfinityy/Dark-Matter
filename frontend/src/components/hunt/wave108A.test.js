/**
 * Wave 108A tests — risk-score presentation, tuning and prediction (ideas 54281-54290).
 * Run: node --test frontend/src/components/hunt/wave108A.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const corePath = join(here, 'wave108ACore.js');
const jsxPath = join(here, 'Wave108A.jsx');
const cssPath = join(here, 'Wave108A.css');

import {
  WAVE108_A_IDEAS,
  SCORE_BANDS,
  WHAT_IF_PRESETS,
  DEFAULT_FACTOR_WEIGHTS,
  scoreBand,
  scoreBandLabel,
  badgeClass,
  sortTargetsByScore,
  detectScoreJump,
  appendScoreHistory,
  simulateWhatIf,
  registerModelVersion,
  getModelVersion,
  listModelVersions,
  listModelChangelog,
  applyWeights,
  createClientProfile,
  getClientProfile,
  listClientProfiles,
  scoreWithProfile,
  predictBountyLikelihood,
} from './wave108ACore.js';

const EXPECTED_TITLES = {
  54281: 'Score jump alerts',
  54282: 'Score in list columns',
  54283: 'Score badges',
  54284: 'Score history log',
  54285: 'What-if score simulator',
  54286: 'Scoring model versioning',
  54287: 'Scoring changelog',
  54288: 'Custom scoring weights',
  54289: 'Per-client scoring profiles',
  54290: 'Bounty likelihood predictor',
};

/* ---------- idea registry ---------- */
test('WAVE108_A_IDEAS has exactly 10 entries, ids 54281-54290, titles matching the idea bank', () => {
  assert.equal(WAVE108_A_IDEAS.length, 10);
  const ids = WAVE108_A_IDEAS.map((i) => i.id);
  for (let id = 54281; id <= 54290; id += 1) {
    assert.ok(ids.includes(id), `missing id ${id}`);
  }
  for (const idea of WAVE108_A_IDEAS) {
    assert.equal(idea.title, EXPECTED_TITLES[idea.id], `title mismatch for ${idea.id}`);
  }
});

/* ---------- 54283 score bands ---------- */
test('54283: scoreBand boundary at 90 and 70 (critical/high)', () => {
  assert.equal(scoreBand(100), 'critical');
  assert.equal(scoreBand(90), 'critical');
  assert.equal(scoreBand(89), 'high');
  assert.equal(scoreBand(70), 'high');
});

test('54283: scoreBand boundary at 40 (medium/low)', () => {
  assert.equal(scoreBand(69), 'medium');
  assert.equal(scoreBand(40), 'medium');
  assert.equal(scoreBand(39), 'low');
  assert.equal(scoreBand(0), 'low');
});

test('54283: scoreBand clamps out-of-range and rejects non-numeric input', () => {
  assert.equal(scoreBand(150), 'critical');
  assert.equal(scoreBand(-5), 'low');
  assert.equal(scoreBand(NaN), 'low');
  assert.equal(scoreBand('not-a-score'), 'low');
  assert.equal(SCORE_BANDS.length, 4);
  assert.equal(scoreBandLabel('high'), 'High');
});

test('54283: badgeClass maps each band to its CSS class, unknown falls back', () => {
  assert.equal(badgeClass('critical'), 'wave108-badge wave108-badge-critical');
  assert.equal(badgeClass('high'), 'wave108-badge wave108-badge-high');
  assert.equal(badgeClass('medium'), 'wave108-badge wave108-badge-medium');
  assert.equal(badgeClass('low'), 'wave108-badge wave108-badge-low');
  assert.equal(badgeClass('bogus'), 'wave108-badge wave108-badge-unknown');
});

/* ---------- 54282 sortable score columns ---------- */
test('54282: sortTargetsByScore sorts desc by default on the score key', () => {
  const list = [
    { name: 'a', score: 50 },
    { name: 'b', score: 90 },
    { name: 'c', score: 70 },
  ];
  const sorted = sortTargetsByScore(list);
  assert.deepEqual(sorted.map((t) => t.name), ['b', 'c', 'a']);
});

test('54282: asc direction, missing keys sort as 0, input array is not mutated', () => {
  const list = [
    { name: 'a', score: 50 },
    { name: 'b', score: 90 },
    { name: 'c' },
  ];
  const original = JSON.parse(JSON.stringify(list));
  const sorted = sortTargetsByScore(list, 'score', 'asc');
  assert.deepEqual(sorted.map((t) => t.name), ['c', 'a', 'b']);
  assert.deepEqual(list, original);
  const byFindings = sortTargetsByScore([{ n: 'x', findings: 3 }, { n: 'y', findings: 9 }], 'findings');
  assert.equal(byFindings[0].n, 'y');
});

/* ---------- 54281 score jump alerts ---------- */
test('54281: detectScoreJump reports an upward jump with band shift', () => {
  const jump = detectScoreJump(68, 92, 10);
  assert.ok(jump);
  assert.equal(jump.jumped, true);
  assert.equal(jump.direction, 'up');
  assert.equal(jump.magnitude, 24);
  assert.equal(jump.signedDelta, 24);
  assert.equal(jump.bandShift, true);
  assert.equal(jump.previousBand, 'medium');
  assert.equal(jump.currentBand, 'critical');
  assert.ok(jump.detectedAt);
});

test('54281: detectScoreJump reports a downward jump', () => {
  const jump = detectScoreJump(92, 70, 10);
  assert.ok(jump);
  assert.equal(jump.direction, 'down');
  assert.equal(jump.magnitude, 22);
  assert.equal(jump.signedDelta, -22);
  assert.equal(jump.bandShift, true);
});

test('54281: no jump when the move is within or exactly at the threshold', () => {
  assert.equal(detectScoreJump(70, 80, 10), null); // exactly at delta -> not a jump
  assert.equal(detectScoreJump(70, 79, 10), null);
  assert.equal(detectScoreJump(70, 70), null);
  assert.throws(() => detectScoreJump('x', 80, 10));
});

/* ---------- 54284 score history log ---------- */
test('54284: appendScoreHistory records entry with timestamp and isolated inputs snapshot', () => {
  const log = [];
  const inputs = { factors: { exposure: 80 }, weights: { exposure: 1 } };
  const entry = appendScoreHistory(log, {
    targetId: 't1',
    score: 82,
    version: '2.0.0',
    inputs,
    reason: 'nightly recompute',
    now: '2026-10-10T03:00:00.000Z',
  });
  assert.equal(entry.id, 'scorehist:t1:1');
  assert.equal(entry.band, 'high');
  assert.equal(entry.version, '2.0.0');
  assert.equal(entry.reason, 'nightly recompute');
  assert.equal(entry.recordedAt, '2026-10-10T03:00:00.000Z');
  inputs.factors.exposure = 0; // mutate after recording
  assert.equal(entry.inputsSnapshot.factors.exposure, 80); // snapshot is isolated
  const second = appendScoreHistory(log, { targetId: 't1', score: 60 });
  assert.equal(second.id, 'scorehist:t1:2');
  assert.equal(log.length, 2);
});

/* ---------- 54285 what-if simulator ---------- */
test('54285: simulateWhatIf applies preset deltas and projects the score', () => {
  const result = simulateWhatIf(74, ['fix-headers', 'archive-subdomains']);
  assert.equal(result.base, 74);
  assert.equal(result.totalDelta, -9);
  assert.equal(result.projected, 65);
  assert.equal(result.clamped, false);
  assert.equal(result.applied.length, 2);
  assert.equal(result.applied[0].label, WHAT_IF_PRESETS['fix-headers'].label);
  assert.equal(result.applied[0].delta, -4);
  const custom = simulateWhatIf(50, [{ label: 'Scope doubled', delta: 20 }]);
  assert.equal(custom.projected, 70);
  assert.equal(custom.applied[0].id, null);
});

test('54285: simulateWhatIf clamps to 0-100 and rejects unknown presets', () => {
  const over = simulateWhatIf(95, ['expose-admin']);
  assert.equal(over.projected, 100);
  assert.equal(over.clamped, true);
  const under = simulateWhatIf(5, ['patch-critical']);
  assert.equal(under.projected, 0);
  assert.equal(under.clamped, true);
  assert.throws(() => simulateWhatIf(50, ['not-a-preset']));
});

/* ---------- 54286 scoring model versioning ---------- */
test('54286: registerModelVersion + getModelVersion round-trip; duplicates rejected', () => {
  const record = registerModelVersion('3.0.0', { description: 'Test model.' }, ['Test change in plain language.']);
  assert.equal(record.version, '3.0.0');
  assert.equal(getModelVersion('3.0.0').formula.description, 'Test model.');
  assert.deepEqual(getModelVersion('3.0.0').changelog, ['Test change in plain language.']);
  assert.equal(getModelVersion('9.9.9'), null);
  assert.throws(() => registerModelVersion('3.0.0', { description: 'duplicate' }, []));
  assert.throws(() => registerModelVersion('3.0.1', {}, []));
});

test('54286/54287: seeded versions exist; listModelChangelog is oldest-first with plain-language entries', () => {
  const v200 = getModelVersion('2.0.0');
  assert.ok(v200);
  assert.ok(v200.formula.description.includes('weighted average'));
  const changelog = listModelChangelog();
  const versions = changelog.map((e) => e.version);
  const idx100 = versions.indexOf('1.0.0');
  const idx110 = versions.indexOf('1.1.0');
  const idx200 = versions.indexOf('2.0.0');
  assert.ok(idx100 !== -1 && idx110 !== -1 && idx200 !== -1);
  assert.ok(idx100 < idx110 && idx110 < idx200);
  for (const entry of changelog) {
    assert.ok(entry.changes.length > 0);
    for (const line of entry.changes) assert.ok(line.length > 0);
  }
  const all = listModelVersions();
  assert.ok(all.length >= 4);
});

/* ---------- 54288 custom scoring weights ---------- */
test('54288: applyWeights with equal weights averages the factors', () => {
  const factors = { exposure: 50, vulnerability: 50, hygiene: 50, businessLogic: 50, reachability: 50 };
  const result = applyWeights(factors, { exposure: 1, vulnerability: 1, hygiene: 1, businessLogic: 1, reachability: 1 });
  assert.equal(result.score, 50);
  assert.equal(result.contributions.length, 5);
  const sum = result.contributions.reduce((a, c) => a + c.weightedPoints, 0);
  assert.ok(Math.abs(sum - result.score) < 0.01);
});

test('54288: applyWeights honors custom weights and validates input', () => {
  const result = applyWeights({ exposure: 100 }, { exposure: 3 });
  assert.equal(result.score, 100);
  const blended = applyWeights({ exposure: 100, vulnerability: 0 }, { exposure: 1, vulnerability: 3 });
  assert.equal(blended.score, 25);
  assert.equal(blended.contributions.find((c) => c.factor === 'exposure').weightedPoints, 25);
  assert.throws(() => applyWeights({ exposure: 50 }, {}));
  assert.throws(() => applyWeights({ exposure: 50 }, { mystery: 1 }));
  assert.throws(() => applyWeights({ exposure: 50 }, { exposure: -1 }));
  assert.equal(Object.keys(DEFAULT_FACTOR_WEIGHTS).length, 5);
});

/* ---------- 54289 per-client scoring profiles ---------- */
test('54289: createClientProfile + getClientProfile + listClientProfiles round-trip', () => {
  const profile = createClientProfile('Test Client A', { exposure: 50, vulnerability: 50 });
  assert.equal(profile.name, 'Test Client A');
  assert.deepEqual(getClientProfile('Test Client A').weights, { exposure: 50, vulnerability: 50 });
  const names = listClientProfiles().map((p) => p.name);
  assert.ok(names.includes('Test Client A'));
  for (let i = 1; i < names.length; i += 1) {
    assert.ok(names[i - 1].localeCompare(names[i]) <= 0, 'profiles listed in name order');
  }
});

test('54289: duplicate profile names rejected; scoreWithProfile uses the saved weights', () => {
  assert.throws(() => createClientProfile('Test Client A', { exposure: 1 }));
  assert.equal(getClientProfile('no-such-client'), null);
  const result = scoreWithProfile({ exposure: 100, vulnerability: 0 }, 'Test Client A');
  assert.equal(result.profile, 'Test Client A');
  assert.equal(result.score, 50);
  assert.throws(() => scoreWithProfile({ exposure: 1 }, 'no-such-client'));
});

/* ---------- 54290 bounty likelihood predictor ---------- */
test('54290: predictBountyLikelihood returns shaped, bounded output with reasons', () => {
  const p = predictBountyLikelihood(
    { vulnCount: 9, criticalCount: 2, exposureScore: 78, hygieneScore: 44, pastValidFindings: 3, daysSinceLastHunt: 120 },
    { totalTargets: 24, totalValidFindings: 61 }
  );
  assert.ok(p.probability >= 0 && p.probability <= 1);
  assert.equal(p.probability, 0.98); // saturated by strong signals
  assert.equal(p.confidence, 'high');
  assert.ok(Array.isArray(p.reasons) && p.reasons.length > 0);
  assert.ok(p.reasons.some((r) => r.includes('critical')));
});

test('54290: confidence follows portfolio size; probability rises with exposure', () => {
  const med = predictBountyLikelihood({ exposureScore: 50 }, { totalTargets: 6, totalValidFindings: 3 });
  assert.equal(med.confidence, 'medium');
  const low = predictBountyLikelihood({ exposureScore: 50 }, { totalTargets: 2, totalValidFindings: 1 });
  assert.equal(low.confidence, 'low');
  const empty = predictBountyLikelihood({}, {});
  assert.equal(empty.confidence, 'low');
  assert.ok(empty.reasons.length > 0);
  const cold = predictBountyLikelihood({ exposureScore: 10 }, { totalTargets: 10, totalValidFindings: 10 });
  const hot = predictBountyLikelihood({ exposureScore: 90 }, { totalTargets: 10, totalValidFindings: 10 });
  assert.ok(hot.probability > cold.probability);
});

/* ---------- file existence ---------- */
test('all 4 deliverable files exist', () => {
  for (const p of [corePath, jsxPath, cssPath, join(here, 'wave108A.test.js')]) {
    assert.ok(existsSync(p), `missing file: ${p}`);
  }
});

/* ---------- branding ---------- */
test('no branding leak: forbidden brand string appears in none of the wave 108A files', () => {
  const forbidden = 'Mu' + 'se'; // built without the literal string in source
  for (const p of [corePath, jsxPath, cssPath, join(here, 'wave108A.test.js')]) {
    const text = readFileSync(p, 'utf8');
    assert.ok(!text.includes(forbidden), `forbidden brand string found in ${p}`);
  }
});
