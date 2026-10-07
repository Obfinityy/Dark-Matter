/**
 * wave43.test.js — wave 43 (ideas 51681–51720): finding-confidence
 * display & triage + governance & depth.
 *
 * Registry completeness (40/40 zero skips), core-logic spot checks,
 * zero-keyframe CSS audit, no-debris audit, and JSX esbuild-parse checks.
 * Deterministic — run with: node --test wave43.test.js
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  WAVE43_CONF_IDEAS, WAVE43_CONF_START, WAVE43_CONF_END,
  clampScore,
  flagLowConfidence, sortByConfidence, filterByConfidence, confidenceHistory,
  uncertaintyNote, crossValidationBadge, manualVerificationPrompt, matrixPosition,
  prioritizationScore, applyDecay, boostEvents, peerAgreement, calibrationView,
  thresholdAlert, notificationPayload, snapshotConfidenceSection,
  confidenceColor, confidenceTooltip, appendAuditLog, autoTriage,
} from './confidenceCore.js';

import {
  WAVE43_GOV_IDEAS, WAVE43_GOV_START, WAVE43_GOV_END,
  disputeScore, confidenceBenchmarks, exportWithConfidence,
  CONFIDENCE_API_ROUTES, confidencePublicDTO, chatAnswerWithConfidence,
  multiModelAgreement, needsWorkTray, milestoneBadges, evidenceRequests,
  evidenceTypeBreakdown, sharingControl, trendAlerts, weightedReportingOrder,
  explainConfidence, calibrationTraining, mobileConfidenceCard,
  snapshotConfidenceDiffs, slaForConfidence, groupFindings, overrideScore,
} from './confidenceGovernCore.js';

const DIR = dirname(fileURLToPath(import.meta.url));

const F = [
  { id: 'T-1', title: 'SQLi', severity: 'critical', confidence: 88, techniques: ['sqlmap', 'manual'], evidence: [{ type: 'response' }, { type: 'replay' }], history: [{ at: 'a', score: 70, trigger: 'detect' }, { at: 'b', score: 88, trigger: 'replay' }] },
  { id: 'T-2', title: 'XSS', severity: 'high', confidence: 55, techniques: ['scanner'], evidence: [{ type: 'response' }], history: [{ at: 'a', score: 55, trigger: 'detect' }] },
  { id: 'T-3', title: 'Header', severity: 'low', confidence: 30, techniques: ['headers'], evidence: [], history: [{ at: 'a', score: 45, trigger: 'detect' }, { at: 'b', score: 30, trigger: 'decay −15: contradicted' }] },
];

/* --- registry completeness ----------------------------------------------------- */

test('wave-43 combined registry: 40/40 ideas, ids 51681–51720 contiguous, zero skips', () => {
  assert.equal(WAVE43_CONF_START, 51681);
  assert.equal(WAVE43_CONF_END, 51700);
  assert.equal(WAVE43_GOV_START, 51701);
  assert.equal(WAVE43_GOV_END, 51720);
  assert.equal(WAVE43_CONF_IDEAS.length, 20);
  assert.equal(WAVE43_GOV_IDEAS.length, 20);
  const all = [...WAVE43_CONF_IDEAS, ...WAVE43_GOV_IDEAS];
  const ids = all.map(r => r[0]);
  assert.equal(ids.length, 40);
  assert.deepEqual(ids, Array.from({ length: 40 }, (_, i) => 51681 + i));
  for (const [id, title, desc] of all) {
    assert.ok(title && title.length > 3, `idea ${id} has a title`);
    assert.ok(desc && desc.length > 10, `idea ${id} has a description`);
    assert.ok(!/SKIP|skip|deferred/i.test(title + ' ' + desc), `idea ${id} is not a skip`);
  }
});

/* --- confidenceCore spot checks (51681–51700) ----------------------------------- */

test('clampScore bounds and NaN handling', () => {
  assert.equal(clampScore(150), 100);
  assert.equal(clampScore(-3), 0);
  assert.equal(clampScore(NaN), 0);
  assert.equal(clampScore(62.4), 62);
});

test('flagLowConfidence marks below-threshold findings', () => {
  const out = flagLowConfidence(F, 60);
  assert.equal(out.find(f => f.id === 'T-3').flag, 'low-confidence');
  assert.equal(out.find(f => f.id === 'T-1').flag, 'none');
});

test('sortByConfidence + filterByConfidence', () => {
  const s = sortByConfidence(F);
  assert.deepEqual(s.map(f => f.id), ['T-1', 'T-2', 'T-3']);
  assert.deepEqual(sortByConfidence(F, { dir: 'asc' }).map(f => f.id), ['T-3', 'T-2', 'T-1']);
  assert.deepEqual(filterByConfidence(F, 60).map(f => f.id), ['T-1']);
});

test('confidenceHistory always ends at current score', () => {
  const h = confidenceHistory({ confidence: 77, history: [] });
  assert.equal(h[h.length - 1].score, 77);
  const h2 = confidenceHistory(F[0]);
  assert.equal(h2[h2.length - 1].score, 88);
});

test('uncertaintyNote cites real causes', () => {
  const n = uncertaintyNote(F[2]);
  assert.ok(n.includes('no evidence'), 'missing evidence is named');
  const ok = uncertaintyNote({ confidence: 95, techniques: ['a', 'b'], evidence: [{ type: 'x' }, { type: 'y' }] });
  assert.ok(ok.startsWith('Nothing flagged'), 'solid finding gets a clean note');
});

test('crossValidationBadge needs two techniques', () => {
  assert.equal(crossValidationBadge(F[0]).crossValidated, true);
  assert.equal(crossValidationBadge(F[1]).crossValidated, false);
});

test('manualVerificationPrompt skips solid findings, guides shaky ones', () => {
  assert.equal(manualVerificationPrompt(F[0]).needed, false);
  const p = manualVerificationPrompt(F[2]);
  assert.ok(p.needed && p.checks.length >= 2, 'shaky finding gets concrete checks');
});

test('matrixPosition buckets correctly', () => {
  assert.deepEqual(matrixPosition(F[0]), { row: 0, col: 0, rowLabel: 'critical', colLabel: 'Certain (80+)' });
  assert.equal(matrixPosition(F[2]).colLabel, 'Shaky (<40)');
});

test('prioritizationScore blends severity and confidence', () => {
  assert.ok(prioritizationScore(F[0]) > prioritizationScore(F[2]));
  assert.ok(prioritizationScore({ severity: 'critical', confidence: 100 }) <= 100);
});

test('applyDecay is deterministic and audited', () => {
  const d = applyDecay(F[1], { contradictedEvidence: 2, reason: 'artifact' });
  assert.equal(d.confidence, 55 - 24);
  assert.ok(d.history[d.history.length - 1].trigger.includes('decay'), 'decay is in the audit trail');
  // original untouched (immutable)
  assert.equal(F[1].confidence, 55);
});

test('boostEvents finds rising edges', () => {
  const e = boostEvents(F[0]);
  assert.equal(e.length, 1);
  assert.deepEqual([e[0].from, e[0].to], [70, 88]);
});

test('peerAgreement handles missing data', () => {
  assert.equal(peerAgreement(F[0], null).rate, null);
  const p = peerAgreement({ techniques: ['sqlmap'] }, { sqlmap: { truePositives: 3, total: 4 } });
  assert.equal(p.rate, 75);
});

test('calibrationView buckets predicted vs actual', () => {
  const rows = calibrationView([
    { predicted: 90, outcome: true }, { predicted: 90, outcome: false },
    { predicted: 50, outcome: true },
  ]);
  const top = rows.find(r => r.label === '80–100');
  assert.equal(top.n, 2);
  assert.equal(top.actualRate, 50);
});

test('thresholdAlert detects crossings', () => {
  const crossed = thresholdAlert({ confidence: 85, history: [{ at: 'a', score: 70 }] }, 80);
  assert.equal(crossed.crossed, true);
  assert.equal(crossed.direction, 'up');
  const flat = thresholdAlert(F[1], 80);
  assert.equal(flat.crossed, false);
});

test('notificationPayload and snapshotConfidenceSection carry scores', () => {
  const p = notificationPayload(F[1], 'slack');
  assert.equal(p.confidence, 55);
  assert.ok(p.text.includes('55/100'));
  const s = snapshotConfidenceSection(F);
  assert.equal(s.solid, 1);
  assert.equal(s.needsWork, 2);
  assert.equal(s.rows[0].id, 'T-1');
});

test('confidenceColor ramp + confidenceTooltip bands', () => {
  assert.equal(confidenceColor(95), '#22c55e');
  assert.equal(confidenceColor(65), '#a3e635');
  assert.equal(confidenceColor(45), '#f59e0b');
  assert.equal(confidenceColor(10), '#ef4444');
  assert.ok(confidenceTooltip(95).includes('confirmed'));
  assert.ok(confidenceTooltip(20).includes('shaky'));
});

test('appendAuditLog is immutable and appends', () => {
  const f = appendAuditLog(F[1], { from: 55, to: 62, trigger: 'analyst confirmed' });
  assert.equal(f.confidence, 62);
  assert.equal(f.history.length, 2);
  assert.equal(F[1].confidence, 55);
});

test('autoTriage applies rules', () => {
  assert.equal(autoTriage(F[0], { escalateAt: 80 }).action, 'escalate');
  assert.equal(autoTriage(F[1], { escalateAt: 80, watchAt: 60 }).action, 'hold');
  assert.equal(autoTriage({ ...F[1], confidence: 65 }, { escalateAt: 80, watchAt: 60 }).action, 'watch');
});

/* --- confidenceGovernCore spot checks (51701–51720) ----------------------------- */

test('disputeScore blends agent 60 / analyst 40, note required', () => {
  const d = disputeScore(F[1], { analystScore: 35, analystNote: 'looks like an error page' });
  assert.equal(d.confidence, Math.round(55 * 0.6 + 35 * 0.4));
  assert.equal(d.disputed, true);
  assert.throws(() => disputeScore(F[1], { analystScore: 35, analystNote: '  ' }), /requires an analyst note/);
});

test('confidenceBenchmarks places scores in quartiles', () => {
  const b = confidenceBenchmarks({ confidence: 88, techniques: ['sqlmap'] }, { sqlmap: { p25: 40, median: 55, p75: 71, n: 100 } });
  assert.equal(b.percentile, 'top quartile');
  assert.equal(confidenceBenchmarks({ confidence: 50 }, {}).percentile, null);
});

test('exportWithConfidence embeds scores in json/csv/markdown', () => {
  const j = JSON.parse(exportWithConfidence(F, 'json'));
  assert.equal(j.findings[0].confidence, 88);
  const csv = exportWithConfidence(F, 'csv');
  assert.ok(csv.startsWith('id,title,severity,confidence,techniques,evidence_types'));
  assert.ok(csv.includes(',88,'));
  const md = exportWithConfidence(F, 'markdown');
  assert.ok(md.includes('| T-1 |'));
  assert.throws(() => exportWithConfidence(F, 'xml'), /unsupported export format/);
});

test('confidencePublicDTO whitelists fields', () => {
  const d = confidencePublicDTO(F[0]);
  assert.deepEqual(Object.keys(d).sort(), ['color', 'confidence', 'crossValidated', 'id', 'severity', 'techniques', 'title', 'updatedAt'].sort());
  assert.ok(!('evidence' in d) && !('history' in d), 'internals stay server-side');
  assert.equal(CONFIDENCE_API_ROUTES.length, 5);
});

test('chatAnswerWithConfidence and multiModelAgreement', () => {
  const a = chatAnswerWithConfidence('Looks real.', 58);
  assert.ok(a.spoken.includes('58%'));
  const m = multiModelAgreement({ model: 'a', confidence: 84 }, { model: 'b', confidence: 61 });
  assert.equal(m.gap, 23);
  assert.equal(m.agreement, 'partial');
});

test('needsWorkTray splits on the floor', () => {
  const t = needsWorkTray(F, 60);
  assert.equal(t.ready.length, 1);
  assert.equal(t.needsWork.length, 2);
  assert.equal(t.floor, 60);
});

test('milestoneBadges earned and next computed', () => {
  const m = milestoneBadges(F[0]);
  assert.deepEqual(m.badges.map(b => b.id), ['likely', 'validated']);
  assert.equal(m.next.label, 'Confirmed');
  assert.equal(milestoneBadges({ confidence: 20 }).badges.length, 0);
});

test('evidenceRequests target gaps only', () => {
  assert.equal(evidenceRequests(F[0]).needed, false);
  const r = evidenceRequests(F[2]);
  assert.ok(r.needed && r.requests.some(x => x.kind === 'replay'));
});

test('evidenceTypeBreakdown shares sum to 100', () => {
  const b = evidenceTypeBreakdown(F[0]);
  assert.equal(b.reduce((s, x) => s + x.share, 0), 100);
  assert.deepEqual(evidenceTypeBreakdown({ evidence: [] }), []);
});

test('sharingControl raw vs labels', () => {
  assert.equal(sharingControl(91, 'raw').shown, '91/100');
  assert.equal(sharingControl(91, 'labels').shown, 'Confirmed');
  assert.equal(sharingControl(50, 'labels').shown, 'Unproven');
});

test('trendAlerts flags sharp drops', () => {
  const a = trendAlerts(F[2], { dropPoints: 10 });
  assert.equal(a.length, 1);
  assert.equal(a[0].drop, 15);
  assert.equal(trendAlerts(F[0]).length, 0);
});

test('weightedReportingOrder sorts by severity×confidence', () => {
  const o = weightedReportingOrder(F);
  assert.equal(o[0].id, 'T-1');
  assert.ok(o[0].reportWeight > o[2].reportWeight);
});

test('explainConfidence answers "why only X?" with specifics', () => {
  const e = explainConfidence(F[1]);
  assert.ok(e.points.some(p => p.includes('single technique')), 'single-technique limitation named');
  assert.ok(e.summary.includes('55/100'));
});

test('calibrationTraining adjusts weights from feedback', () => {
  const a = calibrationTraining([
    { finding: { confidence: 90 }, analystSaidTrue: false },
    { finding: { confidence: 85 }, analystSaidTrue: false },
    { finding: { confidence: 50 }, analystSaidTrue: true },
  ]);
  assert.ok(a.decayPenalty > 0, 'overconfidence increases decay penalty');
  const b = calibrationTraining([]);
  assert.ok(b.notes[0].includes('balanced'));
});

test('mobileConfidenceCard is compact and trend-aware', () => {
  const c = mobileConfidenceCard(F[0]);
  assert.equal(c.trend, 'up');
  assert.ok(c.color && c.meaning);
});

test('snapshotConfidenceDiffs reports rose/fell/added/removed', () => {
  const d = snapshotConfidenceDiffs(
    { findings: [{ id: 'a', confidence: 70 }, { id: 'b', confidence: 60 }] },
    { findings: [{ id: 'a', confidence: 90 }, { id: 'c', confidence: 40 }] },
  );
  assert.ok(d.some(x => x.id === 'a' && x.change === 'rose' && x.delta === 20));
  assert.ok(d.some(x => x.id === 'b' && x.change === 'removed'));
  assert.ok(d.some(x => x.id === 'c' && x.change === 'added'));
});

test('slaForConfidence scales deadlines', () => {
  assert.equal(slaForConfidence(95).hours, 4);
  assert.equal(slaForConfidence(30).hours, 168);
  assert.ok(slaForConfidence(65).label.includes('24h'));
});

test('groupFindings buckets certain/likely/unproven', () => {
  const g = groupFindings(F);
  assert.equal(g.certain.length, 1);
  assert.equal(g.likely.length, 0);
  assert.equal(g.unproven.length, 2);
});

test('overrideScore requires a note and audits', () => {
  const o = overrideScore(F[2], 70, 'analyst confirmed manually');
  assert.equal(o.confidence, 70);
  assert.equal(o.overridden, true);
  assert.throws(() => overrideScore(F[2], 70, ''), /requires a note/);
});

/* --- zero-keyframe CSS audit ----------------------------------------------------- */

test('Wave43.css: zero keyframes, no animation/transition, scoped classes only', () => {
  const css = readFileSync(join(DIR, 'Wave43.css'), 'utf8');
  assert.ok(!/@keyframes/i.test(css), 'no @keyframes allowed');
  assert.ok(!/animation\s*:/i.test(css), 'no animation shorthand allowed');
  assert.ok(!/transition\s*:/i.test(css), 'no transitions allowed');
  assert.ok(css.includes('.cf43-') && css.includes('.cg43-'), 'scoped classes present');
});

/* --- no-debris audit ------------------------------------------------------------------- */

test('wave-43 sources carry no unfinished-work or fake-content markers', () => {
  const files = ['confidenceCore.js', 'confidenceGovernCore.js', 'ConfidenceSuite.jsx', 'ConfidenceGovern.jsx', 'Wave43.css'];
  for (const f of files) {
    const src = readFileSync(join(DIR, f), 'utf8');
    assert.ok(!/TODO|FIXME|XXX|HACK/i.test(src), 'no todo markers in ' + f);
    assert.ok(!/\bmock\b/i.test(src), 'no mock debris in ' + f);
    assert.ok(!/\bdemo\b/i.test(src), 'no demo debris in ' + f);
    assert.ok(!/\bsimulate\b/i.test(src), 'no simulate debris in ' + f);
    assert.ok(!/\bplaceholder\b/i.test(src), 'no placeholder debris in ' + f);
  }
});

/* --- JSX esbuild-parse checks ------------------------------------------------------------ */

test('ConfidenceSuite.jsx parses clean via esbuild', () => {
  const jsxPath = join(DIR, 'ConfidenceSuite.jsx');
  const out = execFileSync('npx', ['--no-install', 'esbuild', '--loader:.jsx=jsx', jsxPath], { encoding: 'utf8', timeout: 30000 });
  assert.ok(out.includes('ConfidenceSuiteGallery'), 'esbuild parsed the suite gallery export');
});

test('ConfidenceGovern.jsx parses clean via esbuild', () => {
  const jsxPath = join(DIR, 'ConfidenceGovern.jsx');
  const out = execFileSync('npx', ['--no-install', 'esbuild', '--loader:.jsx=jsx', jsxPath], { encoding: 'utf8', timeout: 30000 });
  assert.ok(out.includes('ConfidenceGovernGallery'), 'esbuild parsed the governance gallery export');
});
