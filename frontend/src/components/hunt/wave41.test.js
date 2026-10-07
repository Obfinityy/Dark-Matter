/**
 * wave41.test.js — wave 41 (ideas 51601–51640): question management +
 * mid-hunt snapshots.
 *
 * Registry completeness (40/40 zero skips), core-logic spot checks,
 * zero-keyframe CSS audit, no-debris audit, and JSX esbuild-parse checks.
 * Deterministic — run with: node --test wave41.test.js
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  WAVE41_QN_IDEAS, WAVE41_QN_START, WAVE41_QN_END, URGENCY_LABELS,
  escHtml as qnEscHtml,
  questionId, labelUrgency,
  newQuestion, answerQuestion,
  batchQuestions,
  createAutoAnswerRule, applyAutoAnswerRules,
  recordQuestion, questionHistory,
  recordAnswerOutcome, answerOutcomeAnalytics,
  quietModeQueue, deliverQuietQueue,
  voiceAskedDescriptor,
  mobileQuestionCard,
  escalateQuestion,
  questionTiming,
  questionPreview,
  multiOptionQuestion,
  QUESTION_TEMPLATES, applyQuestionTemplate,
  fatigueGuard,
  logQuestion, questionAuditLog,
  learnFromAnswer, learningConfidence,
  emergencyBreakthrough,
  delegateQuestion,
  confidenceDisplay,
  postHuntReview,
} from './questionCore.js';

import {
  WAVE41_SN_IDEAS, WAVE41_SN_START, WAVE41_SN_END, FINDING_STATES,
  escHtml as snEscHtml,
  snapshotId, takeSnapshot,
  scheduleSnapshot, dueScheduledSnapshots, advanceSchedule,
  diffSnapshots,
  snapshotTimeline,
  shareSnapshotLink,
  pdfExportDescriptor,
  annotateSnapshot,
  snapshotWatermark, applySnapshotWatermark,
  snapshotDeltas,
  executiveSummary,
  technicalSummary,
  subscribeSnapshot, notifySnapshotSubscribers,
  approveSnapshot, shareableExternally,
  applySnapshotRetention,
  searchSnapshots,
  SNAPSHOT_TEMPLATES, applySnapshotTemplate,
  snapshotLanguageLabels, labelForLanguage,
  livePreviewDescriptor,
  snapshotCompleteness,
  markFindingState, findingsByState,
} from './snapshotCore.js';

const DIR = dirname(fileURLToPath(import.meta.url));

/* --- registry completeness ----------------------------------------------------- */

test('wave-41 combined registry: 40/40 ideas, ids 51601–51640 contiguous, zero skips', () => {
  assert.equal(WAVE41_QN_START, 51601);
  assert.equal(WAVE41_QN_END, 51620);
  assert.equal(WAVE41_SN_START, 51621);
  assert.equal(WAVE41_SN_END, 51640);
  assert.equal(WAVE41_QN_IDEAS.length, 20);
  assert.equal(WAVE41_SN_IDEAS.length, 20);
  const ids = [...WAVE41_QN_IDEAS, ...WAVE41_SN_IDEAS].map(r => r[0]);
  assert.equal(ids.length, 40);
  assert.equal(new Set(ids).size, 40);
  for (let n = 51601; n <= 51640; n++) assert.ok(ids.includes(n), 'missing idea ' + n);
  for (const [, name, desc] of [...WAVE41_QN_IDEAS, ...WAVE41_SN_IDEAS]) {
    assert.ok(name && name.length > 2, 'empty name');
    assert.ok(desc && desc.length > 5, 'empty desc for ' + name);
  }
});

test('urgency labels and finding states match their registries', () => {
  assert.deepEqual(URGENCY_LABELS, ['fyi', 'decision-needed', 'blocking']);
  assert.deepEqual(FINDING_STATES, ['draft', 'validating', 'confirmed']);
});

/* --- question core spot checks ---------------------------------------------------- */

test('newQuestion/answerQuestion/labelUrgency/questionId determinism', () => {
  const q = newQuestion('k', 'title <x>', 'body', [{ key: 'a', label: 'A' }], 'blocking', 1000);
  assert.equal(q.status, 'open');
  assert.equal(q.urgency, 'blocking');
  assert.equal(questionId('k', 'title <x>', 1000), q.id);
  const unknown = labelUrgency({ urgency: 'yelling' });
  assert.equal(unknown.urgency, 'fyi');
  const a = answerQuestion(q, 'a', 2000);
  assert.equal(a.status, 'answered');
  assert.equal(a.answerKey, 'a');
  const bad = answerQuestion(q, 'zzz', 2000);
  assert.equal(bad.status, 'open');
  assert.ok(!qnEscHtml('<b>x</b>').includes('<b>'));
});

test('batchQuestions: blocking stays standalone, rest digest', () => {
  const qs = [
    newQuestion('a', 'Q1', '', [], 'fyi', 1000),
    newQuestion('b', 'Q2', '', [], 'decision-needed', 1000),
    newQuestion('c', 'Q3', '', [], 'blocking', 1000),
  ];
  const { digest, standalone } = batchQuestions(qs, 2000);
  assert.equal(standalone.length, 1);
  assert.equal(standalone[0].title, 'Q3');
  assert.ok(digest && digest.items.length === 2);
  assert.equal(digest.urgency, 'decision-needed');
});

test('auto-answer rules match and record hits', () => {
  const rule = createAutoAnswerRule('dig deeper', 'yes', 'standing preference');
  const q = newQuestion('dig-deeper', 'Dig deeper here?', '', [{ key: 'yes', label: 'Yes' }, { key: 'no', label: 'No' }], 'fyi', 1000);
  const { question, ruleId } = applyAutoAnswerRules(q, [rule], 2000);
  assert.equal(ruleId, rule.id);
  assert.equal(question.status, 'answered');
  assert.equal(question.answerKey, 'yes');
  assert.equal(question.autoAnswered, true);
  const nomatch = applyAutoAnswerRules(newQuestion('scope', 'Other?', '', [{ key: 'ok', label: 'OK' }], 'fyi', 1000), [rule], 2000);
  assert.equal(nomatch.ruleId, null);
});

test('question history ordering + answer outcome analytics', () => {
  let s = { questions: [] };
  s = recordQuestion(s, newQuestion('a', 'First', '', [], 'fyi', 1000), 1000);
  s = recordQuestion(s, newQuestion('b', 'Second', '', [], 'fyi', 2000), 2000);
  const h = questionHistory(s);
  assert.equal(h[0].title, 'Second');
  let o = { outcomes: [] };
  o = recordAnswerOutcome(o, 'Q-1', 'dig', 90, 3000);
  o = recordAnswerOutcome(o, 'Q-2', 'dig', 70, 4000);
  o = recordAnswerOutcome(o, 'Q-3', 'skip', 40, 5000);
  const a = answerOutcomeAnalytics(o);
  assert.equal(a[0].answerKey, 'dig');
  assert.equal(a[0].avgScore, 80);
  assert.equal(a[1].answerKey, 'skip');
});

test('quiet mode queue and delivery', () => {
  const q = newQuestion('t', 'Q?', '', [], 'fyi', 1000);
  const queued = quietModeQueue([], q);
  assert.equal(queued[0].queuedSilently, true);
  const { delivered, queue } = deliverQuietQueue(queued);
  assert.equal(delivered.length, 1);
  assert.equal(queue.length, 0);
});

test('voice descriptor, mobile card, escalation', () => {
  const b = newQuestion('emergency', 'Critical?', 'RCE confirmed.', [{ key: 'ack', label: 'Ack' }], 'blocking', 1000);
  const v = voiceAskedDescriptor(b, 'kai');
  assert.equal(v.voice, 'kai');
  assert.equal(v.priority, 'high');
  assert.ok(v.speakText.includes('Critical?'));
  const card = mobileQuestionCard(b);
  assert.equal(card.cardId, 'CARD-' + b.id);
  assert.equal(card.swipeActions.length, 1);
  const esc = escalateQuestion(b, 'arjun', 6000);
  assert.equal(esc.escalated, true);
  assert.equal(esc.escalatedTo, 'arjun');
  const nonBlocking = escalateQuestion(newQuestion('x', 'Q', '', [], 'fyi', 1000), 'arjun', 6000);
  assert.equal(nonBlocking.escalated, false);
});

test('question timing holds non-boundary questions', () => {
  const q = newQuestion('c', 'Coverage?', '', [], 'decision-needed', 1000);
  const hold = questionTiming(q, 'injection-testing', 2000);
  assert.equal(hold.askNow, false);
  assert.equal(hold.holdUntilPhase, 'recon-complete');
  const nowT = questionTiming(q, 'scan-complete', 2000);
  assert.equal(nowT.atBoundary, true);
  assert.equal(nowT.askNow, true);
  const urgentNow = questionTiming(newQuestion('d', 'U?', '', [], 'blocking', 1000), 'injection-testing', 2000);
  assert.equal(urgentNow.askNow, true);
});

test('previews, multi-option guard, templates', () => {
  const q = newQuestion('e', 'Q?', '', [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }], 'fyi', 1000);
  const pv = questionPreview(q, { a: 'Will do A-thing' });
  assert.equal(pv.options[0].previewText, 'Will do A-thing');
  assert.ok(pv.options[1].previewText.includes('continue'));
  const mq = multiOptionQuestion('Pick', 'Body', [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }, { key: 'c', label: 'C' }], 'decision-needed');
  assert.equal(mq.options.length, 3);
  assert.throws(() => multiOptionQuestion('Bad', 'x', [{ key: 'a', label: 'A' }], 'fyi'));
  assert.throws(() => multiOptionQuestion('Bad', 'x', [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }, { key: 'c', label: 'C' }, { key: 'd', label: 'D' }, { key: 'e', label: 'E' }], 'fyi'));
  const t = applyQuestionTemplate('socratic', { title: 'T', context: 'ctx', ask: 'go?' });
  assert.ok(t.body.includes('Before I continue'));
  const keys = Object.keys(QUESTION_TEMPLATES);
  assert.ok(keys.includes('concise') && keys.includes('detailed') && keys.includes('socratic'));
});

test('fatigue guard, audit log, delegation', () => {
  const g = fatigueGuard(5, 5);
  assert.equal(g.allowed, false);
  assert.equal(g.remaining, 0);
  const g2 = fatigueGuard(2, 5);
  assert.equal(g2.allowed, true);
  assert.equal(g2.remaining, 3);
  let log = [];
  log = logQuestion(log, { id: 'l1', questionId: 'Q-1', action: 'asked', detail: 'd', atMs: 1000 });
  log = logQuestion(log, { id: 'l2', questionId: 'Q-1', action: 'answered', detail: 'e', atMs: 2000 });
  const rows = questionAuditLog(log);
  assert.equal(rows.length, 2);
  assert.ok(rows[0].line.includes('asked'));
  const d = delegateQuestion(newQuestion('scope', 'S?', '', [], 'decision-needed', 1000), 'meera', 'scope owner');
  assert.equal(d.status, 'delegated');
  assert.equal(d.delegatedTo, 'meera');
});

test('learning, emergency breakthrough, confidence display, post-hunt review', () => {
  let p = learnFromAnswer(null, 'dig', ['injection']);
  p = learnFromAnswer(p, 'dig', ['injection']);
  p = learnFromAnswer(p, 'skip', ['injection']);
  assert.equal(learningConfidence(p, 'injection', 'dig'), 67);
  const eq = { ...newQuestion('emergency', 'E?', '', [], 'blocking', 1000), kind: 'emergency' };
  const brk = emergencyBreakthrough(eq, Date.UTC(2026, 9, 8, 2, 0, 0), { start: 22, end: 7 });
  assert.equal(brk.isQuietHour, true);
  assert.equal(brk.breaksThrough, true);
  assert.equal(brk.delivery, 'interrupt');
  const plain = emergencyBreakthrough(newQuestion('fyi-q', 'F?', '', [], 'fyi', 1000), Date.UTC(2026, 9, 8, 2, 0, 0), { start: 22, end: 7 });
  assert.equal(plain.breaksThrough, false);
  assert.equal(plain.delivery, 'silent-queue');
  const cd = confidenceDisplay([{ key: 'a', label: 'A', confidence: 50 }, { key: 'b', label: 'B', confidence: 50 }]);
  assert.equal(cd.agentLean, 'a');
  assert.equal(cd.options[0].bar, 50);
  const answered = answerQuestion(newQuestion('r', 'R?', '', [{ key: 'y', label: 'Y' }], 'blocking', 1000), 'y', 2000);
  const review = postHuntReview({ questions: [answered] });
  assert.equal(review.totalQuestions, 1);
  assert.equal(review.decisionsMade, 1);
  assert.equal(review.blockingDecisions, 1);
  assert.equal(review.keyDecisions[0].answerKey, 'y');
});

/* --- snapshot core spot checks ----------------------------------------------------- */

const SN_HUNT = {
  id: 'H-1', target: 'app.example.com', phase: 'in-progress',
  findings: [
    { id: 'F-1', title: 'Stored XSS', type: 'xss', severity: 'high', confidence: 80, evidence: 'payload stored' },
    { id: 'F-2', title: 'Weak headers', type: 'headers', severity: 'low', confidence: 95, evidence: 'no CSP' },
  ],
};

test('takeSnapshot captures counts and severity mix deterministically', () => {
  const s = takeSnapshot(SN_HUNT, 5000);
  assert.equal(s.findingCount, 2);
  assert.deepEqual(s.bySeverity, { high: 1, low: 1 });
  assert.equal(s.id, snapshotId('H-1', 5000));
  assert.equal(snapshotsAreDeterministic(), true);
  assert.ok(!snEscHtml('<x>').includes('<x>'));
});

function snapshotsAreDeterministic() {
  const a = takeSnapshot(SN_HUNT, 5000);
  const b = takeSnapshot(SN_HUNT, 5000);
  return a.id === b.id;
}

test('scheduled snapshots: due rules advance', () => {
  let rules = scheduleSnapshot([], { label: 'r', intervalMs: 60000, fromMs: 1000 });
  assert.equal(rules[0].nextAtMs, 61000);
  assert.equal(dueScheduledSnapshots(rules, 62000).length, 1);
  assert.equal(dueScheduledSnapshots(rules, 60000).length, 0);
  rules = [advanceSchedule(rules[0], 62000)];
  assert.equal(rules[0].nextAtMs, 122000);
});

test('diffSnapshots reports added/removed/changed', () => {
  const a = takeSnapshot(SN_HUNT, 1000);
  const bHunt = {
    ...SN_HUNT,
    findings: [
      { id: 'F-1', title: 'Stored XSS', type: 'xss', severity: 'critical', confidence: 80, evidence: 'payload stored' },
      { id: 'F-3', title: 'IDOR', type: 'idor', severity: 'high', confidence: 90, evidence: 'enum ids' },
    ],
  };
  const b = takeSnapshot(bHunt, 2000);
  const d = diffSnapshots(a, b);
  assert.deepEqual(d.addedIds, ['F-3']);
  assert.deepEqual(d.removedIds, ['F-2']);
  assert.deepEqual(d.changedIds, ['F-1']);
  const tl = snapshotTimeline([b, a]);
  assert.equal(tl[0].id, a.id);
  assert.equal(tl[1].gapSincePrevMs, 1000);
});

test('sharing links hide live controls; pdf descriptor is coherent', () => {
  const s = takeSnapshot(SN_HUNT, 5000);
  const link = shareSnapshotLink(s, 'client');
  assert.equal(link.snapshotId, s.id);
  assert.equal(link.liveControlsExposed, false);
  assert.ok(link.url.endsWith(link.token));
  assert.equal(shareSnapshotLink(s, 'client').token, link.token);
  const pdf = pdfExportDescriptor(s);
  assert.equal(pdf.filename, s.id + '-report.pdf');
  assert.equal(pdf.pages, 4);
  assert.ok(pdf.sections.includes('findings'));
});

test('annotations and watermark attach deterministically', () => {
  let s = takeSnapshot(SN_HUNT, 5000);
  s = annotateSnapshot(s, 'note one', 'owner', 5100);
  assert.equal(s.annotations.length, 1);
  assert.equal(s.annotations[0].author, 'owner');
  const wm = snapshotWatermark('DRAFT', { opacity: 0.2, rotationDeg: -45, fontSizePx: 60 });
  assert.equal(wm.text, 'DRAFT');
  assert.equal(wm.style.opacity, 0.2);
  assert.equal(wm.style.rotationDeg, -45);
  s = applySnapshotWatermark(s, wm, 5200);
  assert.equal(s.watermark.appliedAtMs, 5200);
});

test('deltas headline and executive/technical summaries', () => {
  const prev = takeSnapshot(SN_HUNT, 1000);
  const cur = takeSnapshot({ ...SN_HUNT, findings: [...SN_HUNT.findings, { id: 'F-9', title: 'New', type: 'sqli', severity: 'critical', confidence: 70, evidence: 'error-based' }] }, 2000);
  const d = snapshotDeltas(cur, prev);
  assert.ok(d.headline.includes('1 new'));
  assert.equal(d.highlights[0].kind, 'new-finding');
  const ex = executiveSummary(cur);
  assert.equal(ex.mode, 'executive');
  assert.equal(ex.pages, 1);
  assert.ok(ex.topRisks.some(r => r.id === 'F-9'));
  const tech = technicalSummary(cur);
  assert.equal(tech.mode, 'technical');
  assert.equal(tech.findings.length, 3);
});

test('subscriptions, approval gate, retention', () => {
  let subs = subscribeSnapshot([], { email: 'cto@example.com', role: 'stakeholder' });
  subs = subscribeSnapshot(subs, { email: 'cto@example.com', role: 'stakeholder' });
  assert.equal(subs.length, 1);
  const s = takeSnapshot(SN_HUNT, 5000);
  assert.equal(shareableExternally(s), false);
  const approved = approveSnapshot(s, 'owner', 6000);
  assert.equal(approved.approved, true);
  assert.equal(approved.approvedBy, 'owner');
  assert.equal(shareableExternally(approved), true);
  const old = takeSnapshot(SN_HUNT, 1000);
  const now = 5000 + 31 * 86400000;
  const recent = takeSnapshot(SN_HUNT, now - 1000);
  const r = applySnapshotRetention([old, recent], { retainDays: 30 }, now);
  assert.equal(r.kept.length, 1);
  assert.equal(r.archived.length, 1);
  const queued = notifySnapshotSubscribers(subs, approved);
  assert.equal(queued.length, 1);
  assert.equal(queued[0].channel, 'email');
});

test('search, templates, languages, live preview, completeness', () => {
  let s = takeSnapshot(SN_HUNT, 5000);
  s = annotateSnapshot(s, 'client note about xss', 'owner', 5100);
  const hits = searchSnapshots([s], 'xss');
  assert.equal(hits.length, 1);
  assert.equal(searchSnapshots([s], 'zzz-nomatch').length, 0);
  const t = applySnapshotTemplate('branded', { org: 'Acme' });
  assert.ok(t.header.includes('Acme'));
  assert.equal(Object.keys(SNAPSHOT_TEMPLATES).length, 3);
  const dict = snapshotLanguageLabels();
  assert.equal(labelForLanguage(dict, 'hi', 'findings'), 'निष्कर्ष');
  assert.equal(labelForLanguage(dict, 'es', 'snapshot'), 'Instantánea');
  assert.equal(labelForLanguage(dict, 'en', 'snapshot'), 'Snapshot');
  const pv = livePreviewDescriptor(s);
  assert.equal(pv.live, true);
  assert.equal(pv.findingCount, 2);
  const c = snapshotCompleteness(s);
  assert.ok(c.pct < 100);
  assert.ok(c.missing.length > 0);
  assert.ok(c.missing.includes('Snapshot reviewed'));
});

test('finding states: mark and aggregate', () => {
  let s = takeSnapshot(SN_HUNT, 5000);
  s = markFindingState(s, 'F-1', 'confirmed');
  s = markFindingState(s, 'F-2', 'validating');
  const by = findingsByState(s);
  assert.deepEqual(by.confirmed, ['F-1']);
  assert.deepEqual(by.validating, ['F-2']);
  assert.deepEqual(by.draft, []);
  const bad = markFindingState(s, 'F-1', 'archived');
  assert.equal(bad.invalid, true);
});

/* --- zero-keyframe CSS audit --------------------------------------------------------- */

test('Wave41.css: zero keyframes, scoped classes only', () => {
  const css = readFileSync(join(DIR, 'Wave41.css'), 'utf8');
  assert.ok(!/@keyframes/i.test(css), 'no @keyframes allowed');
  assert.ok(!/animation\s*:/i.test(css), 'no animation shorthand allowed');
  assert.ok(!/transition\s*:/i.test(css), 'no transitions allowed');
  assert.ok(css.includes('.qn41-') && css.includes('.sn41-'), 'scoped classes present');
});

/* --- no-debris audit ------------------------------------------------------------------- */

test('wave-41 sources carry no unfinished-work or fake-content markers', () => {
  const files = ['questionCore.js', 'snapshotCore.js', 'QuestionSuite.jsx', 'SnapshotSuite.jsx', 'Wave41.css'];
  for (const f of files) {
    const src = readFileSync(join(DIR, f), 'utf8');
    assert.ok(!/\bTODO\b|\bFIXME\b/i.test(src), 'no TODO/FIXME in ' + f);
    assert.ok(!/\bmock\b/i.test(src), 'no mock debris in ' + f);
    assert.ok(!/\bdemo\b/i.test(src), 'no demo debris in ' + f);
    assert.ok(!/\bsimulate\b/i.test(src), 'no simulate debris in ' + f);
    assert.ok(!/\bplaceholder\b/i.test(src), 'no placeholder debris in ' + f);
    assert.ok(!/lorem ipsum/i.test(src), 'no lorem ipsum in ' + f);
  }
});

test('QuestionSuite.jsx parses clean via esbuild', () => {
  const jsxPath = join(DIR, 'QuestionSuite.jsx');
  const out = execFileSync('npx', ['--no-install', 'esbuild', '--loader:.jsx=jsx', jsxPath], { encoding: 'utf8', timeout: 30000 });
  assert.ok(out.includes('QuestionSuiteGallery'), 'esbuild parsed the question gallery export');
});

test('SnapshotSuite.jsx parses clean via esbuild', () => {
  const jsxPath = join(DIR, 'SnapshotSuite.jsx');
  const out = execFileSync('npx', ['--no-install', 'esbuild', '--loader:.jsx=jsx', jsxPath], { encoding: 'utf8', timeout: 30000 });
  assert.ok(out.includes('SnapshotSuiteGallery'), 'esbuild parsed the snapshot gallery export');
});
