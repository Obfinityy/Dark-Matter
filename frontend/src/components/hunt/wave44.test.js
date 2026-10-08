/**
 * wave44.test.js — wave 44 (ideas 51721–51760): confidence governance
 * round 4 + live ETA suite.
 *
 * Registry completeness (40/40 zero skips), core-logic spot checks,
 * zero-keyframe CSS audit, no-debris audit, and JSX esbuild-parse checks.
 * Deterministic — run with: node --test wave44.test.js
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CONF44_IDEAS, CONF44_START, CONF44_END,
  appendOverrideLog, retrospectiveAccuracy, retestQueue, confidenceDigest,
  scoreLegend, mergedFindingConfidence, presentationScores, approvalGate,
  siemExportPayload, maturityScore,
} from './confidenceRound4Core.js';

import {
  ETA44_IDEAS, ETA44_START, ETA44_END,
  liveEta, phaseEtas, etaInterval, etaTrend, currentStepEta, etaBreakdown,
  etaHistorySeries, finishTimeClock, etaShiftAlerts, deadlinePlan,
  deadlineFeasibility, budgetTracker, overtimeWarnings, etaByStrategy,
  steeringTimeImpact, pauseAdjustedEta, etaPerAsset, etaPerFinding,
  slowdownDetection, speedupOptions, etaCalibration, etaChatAnswer,
  etaVoiceScript, etaWidgetPayload, etaShareLink, snapshotEtaStamp,
  etaVariance, phasePredictions, etaConfidenceMeter, etaBounds, formatDuration,
} from './etaCore.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const MIN = 60000;

const F = [
  { id: 'T-1', title: 'SSRF', severity: 'critical', confidence: 84, techniques: ['scanner', 'manual'], overrideLog: [] },
  { id: 'T-2', title: 'XSS', severity: 'high', confidence: 58, techniques: ['scanner'], overrideLog: [] },
  { id: 'T-3', title: 'Cipher', severity: 'medium', confidence: 72, techniques: ['headers', 'manual'], overrideLog: [] },
];

/* --- registry completeness ----------------------------------------------------- */

test('wave-44 combined registry: 40/40 ideas, ids 51721–51760 contiguous, zero skips', () => {
  assert.equal(CONF44_START, 51721);
  assert.equal(CONF44_END, 51730);
  assert.equal(ETA44_START, 51731);
  assert.equal(ETA44_END, 51760);
  assert.equal(CONF44_IDEAS.length, 10);
  assert.equal(ETA44_IDEAS.length, 30);
  const all = [...CONF44_IDEAS, ...ETA44_IDEAS];
  const ids = all.map(r => r[0]);
  assert.equal(ids.length, 40);
  assert.deepEqual(ids, Array.from({ length: 40 }, (_, i) => 51721 + i));
  for (const [id, title, desc] of all) {
    assert.ok(title && title.length > 3, `idea ${id} has a title`);
    assert.ok(desc && desc.length > 10, `idea ${id} has a description`);
    assert.ok(!/SKIP|skip|deferred/i.test(title + ' ' + desc), `idea ${id} is not a skip`);
  }
});

/* --- confidenceRound4Core spot checks (51721–51730) ------------------------------- */

test('appendOverrideLog requires a note, appends immutably', () => {
  const f = appendOverrideLog(F[1], { from: 58, to: 70, by: 'a.analyst', note: 'confirmed manually', at: '10:00' });
  assert.equal(f.confidence, 70);
  assert.equal(f.overridden, true);
  assert.equal(f.overrideLog.length, 1);
  assert.equal(f.overrideLog[0].by, 'a.analyst');
  assert.equal(F[1].confidence, 58);
  assert.throws(() => appendOverrideLog(F[1], { from: 58, to: 70, note: '   ' }), /requires a reason note/);
});

test('retrospectiveAccuracy computes deltas, accuracy, and bias', () => {
  const r = retrospectiveAccuracy([
    { huntId: 'H-1', avgPredicted: 80, actualHitRate: 70 },
    { huntId: 'H-2', avgPredicted: 60, actualHitRate: 65 },
  ]);
  assert.equal(r.hunts[0].delta, 10);
  assert.equal(r.hunts[0].accuracy, 90);
  assert.equal(r.hunts[1].delta, -5);
  assert.equal(r.bias, 'balanced');
  assert.equal(r.trend, 5);
  assert.equal(retrospectiveAccuracy([]).bias, 'unknown');
});

test('retestQueue keeps only borderline findings, shakiest first', () => {
  const q = retestQueue(F, { floor: 50, ceiling: 75 });
  assert.deepEqual(q.map(x => x.id), ['T-2', 'T-3']);
  assert.equal(q[0].urgency, 'normal');
  const q2 = retestQueue([{ id: 'X', title: 'x', confidence: 51 }], { floor: 50, ceiling: 75 });
  assert.equal(q2[0].urgency, 'high');
  assert.equal(retestQueue(F, { floor: 90, ceiling: 95 }).length, 0);
});

test('confidenceDigest batches changes and names top movers', () => {
  const d = confidenceDigest([
    { findingId: 'a', title: 'A', from: 70, to: 84, at: 't' },
    { findingId: 'b', title: 'B', from: 62, to: 60, at: 't' },
    { findingId: 'c', title: 'C', from: 50, to: 44, at: 't' },
  ], { minDelta: 5 });
  assert.equal(d.total, 3);
  assert.equal(d.notable, 2);
  assert.equal(d.raised, 1);
  assert.equal(d.lowered, 1);
  assert.equal(d.topMovers[0].findingId, 'a');
  assert.ok(d.summary.includes('2 notable'));
});

test('scoreLegend covers 0–100 with five labeled bands', () => {
  const bands = scoreLegend();
  assert.equal(bands.length, 5);
  assert.equal(bands[bands.length - 1].lo, 0);
  assert.equal(bands[0].hi, 100);
  assert.ok(bands.every(b => b.label && b.color && b.meaning));
});

test('mergedFindingConfidence combines independently and lists parts', () => {
  const m = mergedFindingConfidence({ id: 'P', title: 'p', confidence: 84 }, [{ id: 'D', title: 'd', confidence: 61 }]);
  assert.equal(m.parts.length, 2);
  assert.equal(m.combined, Math.round((1 - 0.16 * 0.39) * 100));
  assert.ok(m.note.includes('independent'));
});

test('presentationScores sorts desc and labels bands', () => {
  const rows = presentationScores(F);
  assert.deepEqual(rows.map(r => r.id), ['T-1', 'T-3', 'T-2']);
  assert.equal(rows[0].band, 'Solid');
  assert.equal(rows[2].band, 'Unproven');
  assert.ok(rows[0].display.includes('84'));
});

test('approvalGate holds low-confidence destructive validations', () => {
  const held = approvalGate({ kind: 'exploit' }, F[1], {});
  assert.equal(held.approved, false);
  assert.equal(held.requires, 'second-approver');
  const ok = approvalGate({ kind: 'exploit' }, F[0], {});
  assert.equal(ok.approved, true);
  const passive = approvalGate({ kind: 'passive-scan' }, F[1], {});
  assert.equal(passive.approved, true);
});

test('siemExportPayload emits typed events with scores', () => {
  const p = siemExportPayload(F);
  assert.equal(p.vendor, 'InfinityAI');
  assert.equal(p.events.length, 3);
  assert.equal(p.events[0].confidence, 84);
  assert.equal(p.events[0].event_type, 'finding-confidence');
  assert.equal(p.events[0].cross_validated, true);
  assert.equal(p.events[1].cross_validated, false);
});

test('maturityScore levels 1–5 with trend', () => {
  const m = maturityScore([
    { huntId: 'H-1', accuracy: 60 },
    { huntId: 'H-2', accuracy: 82 },
    { huntId: 'H-3', accuracy: 92 },
  ]);
  assert.equal(m.avgAccuracy, Math.round((60 + 82 + 92) / 3));
  assert.equal(m.level, 3);
  assert.equal(m.label, 'Defined');
  assert.equal(m.trend, 32);
  assert.equal(maturityScore([]).level, 0);
});

/* --- etaCore spot checks (51731–51760) ------------------------------------------- */

test('formatDuration renders compact durations', () => {
  assert.equal(formatDuration(45 * MIN), '45m');
  assert.equal(formatDuration(134 * MIN), '2h 14m');
  assert.equal(formatDuration(0), '0m');
});

test('liveEta derives remaining and finish from weighted expectations', () => {
  const e = liveEta({ now: 1000, elapsedActiveMs: 50 * MIN, totalExpectedActiveMs: 160 * MIN });
  assert.equal(e.remainingMs, 110 * MIN);
  assert.equal(e.finishAtMs, 1000 + 110 * MIN);
  assert.equal(e.pctComplete, 31);
  assert.equal(liveEta({ now: 0, elapsedActiveMs: 200 * MIN, totalExpectedActiveMs: 160 * MIN }).remainingMs, 0);
});

test('phaseEtas nets elapsed time on the active phase', () => {
  const rows = phaseEtas([
    { name: 'A', status: 'done', estimatedMs: 30 * MIN },
    { name: 'B', status: 'active', estimatedMs: 60 * MIN, elapsedMs: 22 * MIN },
    { name: 'C', status: 'pending', estimatedMs: 45 * MIN },
  ]);
  assert.deepEqual(rows.map(r => r.name), ['B', 'C']);
  assert.equal(rows[0].etaMs, 38 * MIN);
  assert.equal(rows[1].etaMs, 45 * MIN);
});

test('etaInterval contains the estimate and narrows with confidence', () => {
  const wide = etaInterval(100 * MIN, 30);
  const tight = etaInterval(100 * MIN, 95);
  assert.ok(wide.loMs <= 100 * MIN && wide.hiMs >= 100 * MIN);
  assert.ok((tight.hiMs - tight.loMs) < (wide.hiMs - wide.loMs));
  assert.ok(wide.label.includes('–'));
});

test('etaTrend detects shrinking, slipping, and steady', () => {
  assert.equal(etaTrend([{ at: 'a', estimateMs: 170 * MIN }, { at: 'b', estimateMs: 120 * MIN }]).trend, 'shrinking');
  assert.equal(etaTrend([{ at: 'a', estimateMs: 120 * MIN }, { at: 'b', estimateMs: 170 * MIN }]).trend, 'slipping');
  assert.equal(etaTrend([{ at: 'a', estimateMs: 150 * MIN }, { at: 'b', estimateMs: 151 * MIN }]).trend, 'steady');
  assert.equal(etaTrend([]).trend, 'unknown');
});

test('currentStepEta flags overruns', () => {
  const s = currentStepEta({ name: 'step', startedAt: 0, now: 14 * MIN, typicalMs: 12 * MIN });
  assert.equal(s.elapsedMs, 14 * MIN);
  assert.equal(s.remainingMs, 0);
  assert.equal(s.runningOver, true);
  assert.equal(currentStepEta({ name: 'step', startedAt: 0, now: 5 * MIN, typicalMs: 12 * MIN }).remainingMs, 7 * MIN);
});

test('etaBreakdown shares sum to 100', () => {
  const rows = etaBreakdown([
    { name: 'B', status: 'active', estimatedMs: 60 * MIN, elapsedMs: 22 * MIN },
    { name: 'C', status: 'pending', estimatedMs: 45 * MIN },
  ]);
  assert.equal(rows.reduce((s, r) => s + r.sharePct, 0), 100);
  assert.ok(rows[0].etaMs >= rows[1].etaMs);
});

test('etaHistorySeries normalizes to minutes', () => {
  const s = etaHistorySeries([{ at: '09:00', estimateMs: 90 * MIN }]);
  assert.equal(s[0].estimateMin, 90);
  assert.equal(s[0].at, '09:00');
});

test('finishTimeClock is deterministic for an explicit offset', () => {
  const c = finishTimeClock(1728288000000, { tzOffsetMin: 330, label: 'IST' });
  assert.equal(c.clock, '1:30 PM');
  assert.equal(c.text, '1:30 PM IST');
  assert.equal(c.weekday, 'Mon');
});

test('etaShiftAlerts only fires beyond tolerance', () => {
  const a = etaShiftAlerts(148 * MIN, 170 * MIN);
  assert.equal(a.significant, true);
  assert.equal(a.direction, 'slipped');
  assert.ok(a.text.includes('slipped'));
  const quiet = etaShiftAlerts(148 * MIN, 150 * MIN);
  assert.equal(quiet.significant, false);
});

test('deadlinePlan compresses phases when the deadline is tight', () => {
  const p = deadlinePlan([{ name: 'B', estimatedMs: 38 * MIN }, { name: 'C', estimatedMs: 45 * MIN }], 120 * MIN);
  assert.equal(p.fits, true);
  const tight = deadlinePlan([{ name: 'B', estimatedMs: 38 * MIN }, { name: 'C', estimatedMs: 45 * MIN }], 60 * MIN);
  assert.equal(tight.fits, false);
  assert.ok(tight.compressionFactor < 1);
  assert.ok(Math.abs(tight.phases.reduce((s, x) => s + x.plannedMs, 0) - 60 * MIN) <= 2);
});

test('deadlineFeasibility is honest about the margin', () => {
  assert.equal(deadlineFeasibility(100 * MIN, 130 * MIN).verdict, 'feasible');
  assert.equal(deadlineFeasibility(100 * MIN, 100 * MIN).verdict, 'marginal');
  assert.equal(deadlineFeasibility(100 * MIN, 80 * MIN).verdict, 'infeasible');
  assert.ok(deadlineFeasibility(100 * MIN, 80 * MIN).note.includes('cutting scope'));
});

test('budgetTracker reports usage and overruns', () => {
  const b = budgetTracker(180 * MIN, 150 * MIN);
  assert.equal(b.usedPct, 83);
  assert.equal(b.remainingMs, 30 * MIN);
  assert.equal(b.overBudget, false);
  assert.equal(budgetTracker(180 * MIN, 190 * MIN).overBudget, true);
});

test('overtimeWarnings escalate with usage', () => {
  assert.equal(overtimeWarnings(180 * MIN, 100 * MIN, 170 * MIN).length, 0);
  const warn = overtimeWarnings(180 * MIN, 150 * MIN, 170 * MIN);
  assert.ok(warn.some(w => w.level === 'warning'));
  const crit = overtimeWarnings(180 * MIN, 185 * MIN, 200 * MIN);
  assert.ok(crit.some(w => w.level === 'critical'));
  const proj = overtimeWarnings(180 * MIN, 100 * MIN, 200 * MIN);
  assert.ok(proj.some(w => w.level === 'projected'));
});

test('etaByStrategy sorts fastest first', () => {
  const rows = etaByStrategy([
    { name: 'deep', scaleFactor: 1.25, baseRemainingMs: 100 * MIN },
    { name: 'targeted', scaleFactor: 0.7, baseRemainingMs: 100 * MIN },
  ]);
  assert.equal(rows[0].name, 'targeted');
  assert.equal(rows[0].remainingMs, 70 * MIN);
});

test('steeringTimeImpact prices a redirection before confirmation', () => {
  const d = steeringTimeImpact(110 * MIN, { description: 'redirect', addsMs: 25 * MIN, removesMs: 10 * MIN });
  assert.equal(d.deltaMs, 15 * MIN);
  assert.equal(d.newRemainingMs, 125 * MIN);
  assert.ok(d.recommendation.includes('Costs'));
  const save = steeringTimeImpact(110 * MIN, { description: 'trim', addsMs: 0, removesMs: 20 * MIN });
  assert.ok(save.recommendation.includes('Saves'));
});

test('pauseAdjustedEta pushes the finish by the paused duration', () => {
  const a = pauseAdjustedEta({ remainingMs: 110 * MIN, finishAtMs: 2000 }, { extraPausedMs: 30 * MIN });
  assert.equal(a.finishAtMs, 2000 + 30 * MIN);
  assert.equal(a.remainingMs, 110 * MIN);
  assert.ok(a.note.includes('Paused'));
});

test('etaPerAsset splits proportionally by weight', () => {
  const rows = etaPerAsset([{ name: 'a', weight: 1 }, { name: 'b', weight: 3 }], 80 * MIN);
  assert.equal(rows[0].etaMs, 20 * MIN);
  assert.equal(rows[1].etaMs, 60 * MIN);
  const explicit = etaPerAsset([{ name: 'a', remainingMs: 5 * MIN }], 80 * MIN);
  assert.equal(explicit[0].etaMs, 5 * MIN);
});

test('etaPerFinding derives pace from real counts', () => {
  const p = etaPerFinding(7, 84 * MIN);
  assert.equal(p.avgMinutesPerFinding, 12);
  assert.equal(p.nextFindingInMs, 12 * MIN);
  assert.ok(p.note.includes('12m'));
  const none = etaPerFinding(0, 84 * MIN);
  assert.equal(none.nextFindingInMs, null);
});

test('slowdownDetection flags sub-60% pace', () => {
  const d = slowdownDetection([{ at: 'h', items: 3, windowMs: 60 * MIN }], 8);
  assert.equal(d.flagged, true);
  assert.equal(d.perHour, 3);
  const ok = slowdownDetection([{ at: 'h', items: 9, windowMs: 60 * MIN }], 8);
  assert.equal(ok.flagged, false);
});

test('speedupOptions rank by real saved time', () => {
  const opts = speedupOptions({ remainingMs: 110 * MIN, parallelizableMs: 40 * MIN, lowYieldMs: 15 * MIN });
  assert.ok(opts[0].savesMs >= opts[1].savesMs);
  assert.ok(opts.every(o => o.tradeoff && o.tradeoff.length > 5));
  assert.equal(speedupOptions({ remainingMs: 100 * MIN }).length, 1);
});

test('etaCalibration learns a factor and adjusts estimates', () => {
  const cal = etaCalibration([
    { predictedMs: 120 * MIN, actualMs: 150 * MIN },
    { predictedMs: 90 * MIN, actualMs: 100 * MIN },
    { predictedMs: 180 * MIN, actualMs: 210 * MIN },
  ]);
  assert.ok(cal.factor > 1);
  assert.equal(cal.direction, 'underestimate');
  assert.equal(cal.calibrate(100 * MIN), Math.round(100 * MIN * cal.factor));
  assert.equal(etaCalibration([]).factor, 1);
});

test('etaChatAnswer answers "how much longer?" plainly', () => {
  const eta = { etaMs: 110 * MIN, loMs: 95 * MIN, hiMs: 130 * MIN, finishAtMs: 1728288000000 + 110 * MIN };
  const a = etaChatAnswer('how much longer?', eta);
  assert.ok(a.includes('1h 50m'));
  assert.ok(a.includes('IST'));
});

test('etaVoiceScript names the milestone', () => {
  const s = etaVoiceScript('Scanning phase complete', 62 * MIN);
  assert.ok(s.includes('Scanning phase complete'));
  assert.ok(s.includes('1h 2m'));
});

test('etaWidgetPayload is compact', () => {
  const w = etaWidgetPayload({ etaMs: 110 * MIN, finishAtMs: 1728288000000 + 110 * MIN, pctComplete: 31 });
  assert.equal(w.etaMin, 110);
  assert.ok(w.compact.includes('1h 50m'));
  assert.equal(w.pctComplete, 31);
});

test('etaShareLink builds a read-only encoded link', () => {
  const l = etaShareLink('https://hunt.example.com/', { etaMs: 110 * MIN, finishAtMs: 2000, huntName: 'oct-sweep' });
  assert.ok(l.url.startsWith('https://hunt.example.com/eta/'));
  assert.equal(l.readOnly, true);
  assert.ok(l.note.includes('Read-only'));
});

test('snapshotEtaStamp freezes the estimate', () => {
  const s = snapshotEtaStamp({ remainingMs: 110 * MIN, finishAtMs: 2000, confidence: 70 }, { snapshotId: 'snap-014' });
  assert.equal(s.snapshotId, 'snap-014');
  assert.equal(s.remainingMs, 110 * MIN);
  assert.equal(s.confidence, 70);
});

test('etaVariance reports ahead and behind', () => {
  const behind = etaVariance(140 * MIN, 162 * MIN);
  assert.equal(behind.status, 'behind');
  assert.ok(behind.text.includes('behind plan'));
  const ahead = etaVariance(140 * MIN, 120 * MIN);
  assert.equal(ahead.status, 'ahead');
});

test('phasePredictions use medians of similar past phases', () => {
  const rows = phasePredictions(['Verification', 'Reporting'], [
    { name: 'Verification', actualMs: 52 * MIN },
    { name: 'Verification', actualMs: 44 * MIN },
    { name: 'Reporting', actualMs: 28 * MIN },
  ]);
  assert.equal(rows[0].predictedMs, 52 * MIN);
  assert.ok(rows[0].source.includes('similar'));
  const unknown = phasePredictions(['Brand-new'], [{ name: 'Other', actualMs: 10 * MIN }]);
  assert.equal(unknown[0].predictedMs, 10 * MIN);
  assert.ok(unknown[0].source.includes('all past phases'));
});

test('etaConfidenceMeter scores 0–100 with a trust band', () => {
  const m = etaConfidenceMeter({ dataPoints: 6, calibrationAgeDays: 3, progressPct: 31 });
  assert.ok(m.meter >= 0 && m.meter <= 100);
  assert.ok(['high', 'moderate', 'low'].includes(m.trust));
  assert.equal(etaConfidenceMeter({}).trust, 'low');
});

test('etaBounds brackets the estimate', () => {
  const b = etaBounds(110 * MIN, 70);
  assert.ok(b.bestMs <= 110 * MIN);
  assert.ok(b.worstMs >= 110 * MIN);
  assert.ok(b.label.includes('Best') && b.label.includes('worst'));
  const tight = etaBounds(110 * MIN, 99);
  assert.ok((tight.worstMs - tight.bestMs) < (b.worstMs - b.bestMs));
});

/* --- zero-keyframe CSS audit ----------------------------------------------------- */

test('Wave44.css: zero keyframes, no animation/transition, scoped classes only', () => {
  const css = readFileSync(join(DIR, 'Wave44.css'), 'utf8');
  assert.ok(!/@keyframes/i.test(css), 'no @keyframes allowed');
  assert.ok(!/animation\s*:/i.test(css), 'no animation shorthand allowed');
  assert.ok(!/transition\s*:/i.test(css), 'no transitions allowed');
  assert.ok(css.includes('.cr44-') && css.includes('.et44-'), 'scoped classes present');
});

/* --- no-debris audit ------------------------------------------------------------------- */

test('wave-44 sources carry no unfinished-work or fake-content markers', () => {
  const markers = [
    ['T', 'O', 'D', 'O'], ['F', 'I', 'X', 'M', 'E'], ['X', 'X', 'X'], ['H', 'A', 'C', 'K'],
    ['M', 'O', 'C', 'K'], ['D', 'E', 'M', 'O'], ['S', 'i', 'm', 'u', 'l', 'a', 't', 'e'],
    ['p', 'l', 'a', 'c', 'e', 'h', 'o', 'l', 'd', 'e', 'r'],
  ].map((parts) => new RegExp('\\b' + parts.join('') + '\\b', 'i'));
  const files = ['confidenceRound4Core.js', 'etaCore.js', 'ConfidenceRound4.jsx', 'EtaSuite.jsx', 'Wave44.css', 'wave44.test.js'];
  for (const f of files) {
    const src = readFileSync(join(DIR, f), 'utf8');
    for (const re of markers) {
      assert.ok(!re.test(src), `debris marker ${re} in ${f}`);
    }
  }
});

/* --- JSX esbuild-parse checks ------------------------------------------------------------ */

test('ConfidenceRound4.jsx parses clean via esbuild', () => {
  const jsxPath = join(DIR, 'ConfidenceRound4.jsx');
  const out = execFileSync('npx', ['--no-install', 'esbuild', '--loader:.jsx=jsx', jsxPath], { encoding: 'utf8', timeout: 30000 });
  assert.ok(out.includes('ConfidenceRound4Gallery'), 'esbuild parsed the round-4 gallery export');
});

test('EtaSuite.jsx parses clean via esbuild', () => {
  const jsxPath = join(DIR, 'EtaSuite.jsx');
  const out = execFileSync('npx', ['--no-install', 'esbuild', '--loader:.jsx=jsx', jsxPath], { encoding: 'utf8', timeout: 30000 });
  assert.ok(out.includes('EtaSuiteGallery'), 'esbuild parsed the ETA suite gallery export');
});
