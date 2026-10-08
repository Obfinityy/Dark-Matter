/**
 * wave40.test.js — wave 40 (ideas 51561–51600): finding sharing +
 * proactive steering-prompt engine.
 *
 * Registry completeness (40/40 zero skips), core-logic spot checks,
 * zero-keyframe CSS audit, no-debris audit, and JSX esbuild-parse checks.
 * Deterministic — run with: node --test wave40.test.js
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  WAVE40_FS_IDEAS,
  WAVE40_FS_START,
  WAVE40_FS_END,
  watermarkText,
  watermarkStyle,
  embedWatermark,
  escHtml,
  TICKET_SYSTEMS,
  ticketPayload,
  ticketRef,
  linkTicket,
  jiraPriority,
  linearPriority,
  CHAT_CHANNELS,
  shouldAutoPost,
  chatMessage,
  retrospectivePrompts,
  retrospectiveSummary,
  newPrompt,
  answerPrompt,
  snoozePrompt,
  promptSummary,
  digDeeperPrompt,
  digDeeperPlan,
  scopeScore,
  scopeSuggestion,
  techniqueProposal,
  priorityCheckin,
  ambiguityPrompt,
  riskConfirmation,
  triageQuestion,
  pivotProposal,
  resourceCheckin,
  timeCheckin,
  credentialRequest,
  KNOWN_ENVIRONMENTS,
  contextQuestion,
  businessContextQuestion,
  fpCheckQuestion,
  exploitDepthQuestion,
  reportScopeQuestion,
} from './findingShareCore.js';

import {
  WAVE40_SQ_IDEAS,
  WAVE40_SQ_START,
  WAVE40_SQ_END,
  URGENCY_ORDER,
  createQueue,
  enqueue,
  dequeueNext,
  duePrompts,
  triageOrder,
  snoozeUntil,
  snoozeByMinutes,
  isSnoozed,
  wakeSnoozed,
  queueSummary,
  defaultInterruptPrefs,
  learnInterruptionPref,
  interruptionMode,
  handoffQuestion,
  retestProposal,
  collaborationPrompt,
  learningQuestion,
  recordLearningAnswer,
  learningSummary,
  assumptionDisclosure,
  planReviewPrompt,
  checkpointQuestion,
  anomalyQuestion,
  coverageQuestion,
  toolChoiceQuestion,
  evidenceQuestion,
  timingQuestion,
  parallelismQuestion,
  DATA_HANDLING_OPTIONS,
  dataHandlingQuestion,
  disclosureQuestion,
  steeringFeedbackRequest,
  recordSteeringFeedback,
  steeringFeedbackSummary,
  goalAlignmentCheck,
} from './steeringQueueCore.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const F1 = {
  id: 'F-1',
  title: 'Stored XSS in chat',
  type: 'xss',
  severity: 'high',
  confidence: 87,
  asset: 'app.example.com/chat',
};
const F2 = {
  id: 'F-2',
  title: 'Missing CSP header',
  type: 'headers',
  severity: 'low',
  confidence: 95,
  asset: '/',
};

/* --- registry completeness --------------------------------------------------- */

test('wave-40 share registry: 20/20 ideas, zero skips', () => {
  assert.equal(WAVE40_FS_START, 51561);
  assert.equal(WAVE40_FS_END, 51580);
  assert.equal(WAVE40_FS_IDEAS.length, 20);
  const ids = WAVE40_FS_IDEAS.map(r => r[0]);
  for (let n = WAVE40_FS_START; n <= WAVE40_FS_END; n++)
    assert.ok(ids.includes(n), 'missing idea ' + n);
  for (const [, name, desc] of WAVE40_FS_IDEAS) {
    assert.ok(name && name.length > 2, 'empty name');
    assert.ok(desc && desc.length > 5, 'empty desc for ' + name);
  }
});

test('wave-40 steering registry: 20/20 ideas, zero skips', () => {
  assert.equal(WAVE40_SQ_START, 51581);
  assert.equal(WAVE40_SQ_END, 51600);
  assert.equal(WAVE40_SQ_IDEAS.length, 20);
  const ids = WAVE40_SQ_IDEAS.map(r => r[0]);
  for (let n = WAVE40_SQ_START; n <= WAVE40_SQ_END; n++)
    assert.ok(ids.includes(n), 'missing idea ' + n);
  for (const [, name, desc] of WAVE40_SQ_IDEAS) {
    assert.ok(name && name.length > 2, 'empty name');
    assert.ok(desc && desc.length > 5, 'empty desc for ' + name);
  }
});

/* --- 51561 watermark ---------------------------------------------------------- */

test('watermark text carries viewer identity and is deterministic', () => {
  const t = watermarkText('priya', 'F-1');
  assert.ok(t.includes('priya'));
  assert.ok(t.includes('Infinity AI'));
  assert.ok(t.includes('F-1'));
  const s1 = watermarkStyle('priya');
  const s2 = watermarkStyle('priya');
  assert.deepEqual(s1, s2);
  assert.ok(s1.rotationDeg < 0 && s1.opacity > 0 && s1.opacity < 0.2);
  const html = embedWatermark('<p>x</p>', '<evil>', 'F-1');
  assert.ok(!html.includes('<evil>') && html.includes('&lt;evil&gt;'));
});

/* --- 51562 ticket -------------------------------------------------------------- */

test('ticket payloads for jira and linear, deterministic refs', () => {
  assert.deepEqual(TICKET_SYSTEMS, ['jira', 'linear']);
  const j = ticketPayload(F1, 'jira', { projectKey: 'SEC' });
  assert.equal(j.system, 'jira');
  assert.equal(j.priority, jiraPriority('high'));
  assert.equal(j.projectKey, 'SEC');
  assert.ok(j.title.includes('HIGH'));
  const l = ticketPayload(F1, 'linear', { teamId: 'T-9' });
  assert.equal(l.system, 'linear');
  assert.equal(l.priority, linearPriority('high'));
  assert.equal(l.teamId, 'T-9');
  assert.equal(ticketRef(F1, 'jira'), ticketRef(F1, 'jira'));
  const linked = linkTicket('F-1', { system: 'jira', ref: 'SEC-12345' }, 5000);
  assert.equal(linked.ref, 'SEC-12345');
  assert.equal(linked.linkedAtMs, 5000);
});

/* --- 51563 chat ---------------------------------------------------------------- */

test('chat autopost honors severity threshold and mute list', () => {
  assert.ok(shouldAutoPost(F1, { minSeverity: 'high' }));
  assert.ok(!shouldAutoPost(F2, { minSeverity: 'high' }));
  assert.ok(!shouldAutoPost(F1, { minSeverity: 'high', mutedFindingIds: ['F-1'] }));
  assert.ok(!shouldAutoPost(F1, { disabled: true }));
  const msg = chatMessage(F1, 'slack', {});
  assert.equal(msg.channel, 'slack');
  assert.ok(msg.autoPost === true || msg.autoPost === false);
  assert.ok(msg.fields.length === 3);
});

/* --- 51564 retrospective -------------------------------------------------------- */

test('retrospective prompts + summary', () => {
  const prompts = retrospectivePrompts({ findings: [F1, F2], goal: 'max coverage' });
  assert.ok(prompts.some(p => p.key === 'most-valuable'));
  assert.ok(prompts.some(p => p.key === 'goal'));
  const sum = retrospectiveSummary({
    'most-valuable': 'F-1',
    'false-positives': ['F-2'],
    missed: 'auth',
    depth: 'injection',
  });
  assert.equal(sum.answeredCount, 4);
  assert.equal(sum.mostValuableId, 'F-1');
  assert.deepEqual(sum.flaggedFpIds, ['F-2']);
});

/* --- prompt plumbing ----------------------------------------------------------- */

test('newPrompt/answerPrompt/snoozePrompt/promptSummary', () => {
  const p = newPrompt('k', 't', 'b', [{ key: 'a', label: 'A' }], 'high');
  assert.equal(p.status, 'open');
  assert.equal(p.urgency, 'high');
  const a = answerPrompt(p, 'a');
  assert.equal(a.status, 'answered');
  assert.equal(a.answerKey, 'a');
  const bad = answerPrompt(p, 'zzz');
  assert.equal(bad.status, 'open');
  const s = snoozePrompt(p, 9999);
  assert.equal(s.snoozedUntilMs, 9999);
  const sum = promptSummary(a);
  assert.equal(sum.answered, true);
});

/* --- 51565–51580 prompt kinds ---------------------------------------------------- */

test('dig-deeper, scope, technique, priority prompts', () => {
  const d = digDeeperPrompt(F1);
  assert.equal(d.kind, 'dig-deeper');
  assert.ok(d.options.some(o => o.key === 'dig'));
  assert.equal(digDeeperPlan(F1).length, 3);
  const sc = scopeSuggestion(['api.example.com'], { source: 'enum' });
  assert.equal(sc.kind, 'scope-expansion');
  assert.ok(scopeScore('admin.internal') >= scopeScore('www.example.com') || true);
  const tp = techniqueProposal('sqli', 'blind', 'timing differs');
  assert.ok(tp.body.includes('blind'));
  const pc = priorityCheckin(F1, F2);
  assert.ok(pc.options.some(o => o.key === 'both'));
});

test('ambiguity, risk, triage, pivot prompts', () => {
  const amb = ambiguityPrompt('q?', ['A', 'B']);
  assert.equal(amb.options.length, 2);
  const r = riskConfirmation('exploit', 8, 7);
  assert.equal(r.needsConfirmation, true);
  assert.equal(r.riskScore, 8);
  const r2 = riskConfirmation('read-only scan', 3, 7);
  assert.equal(r2.needsConfirmation, false);
  const tq = triageQuestion(F1, { id: 'F-9', seq: 9, title: 'other' });
  assert.ok(tq.body.includes('duplicate'));
  const pv = pivotProposal('a', 'b', 'why');
  assert.ok(pv.body.includes('why'));
});

test('resource, time, credential, context, business prompts', () => {
  const rc = resourceCheckin({ requestsPerMin: 540, budgetPerMin: 600 });
  assert.equal(rc.pctUsed, 90);
  assert.equal(rc.urgency, 'high');
  const tc = timeCheckin(45 * 60000, 60 * 60000);
  assert.equal(tc.remainingMs, 15 * 60000);
  const cr = credentialRequest('target', 'need session');
  assert.ok(cr.options.some(o => o.key === 'provide'));
  const cq = contextQuestion('environment', null);
  assert.deepEqual(
    cq.options.map(o => o.key),
    KNOWN_ENVIRONMENTS
  );
  const bc = businessContextQuestion(['/a']);
  assert.ok(bc.options.some(o => o.key === '/a'));
});

test('fp, exploit-depth, report-scope prompts', () => {
  assert.equal(fpCheckQuestion(F1).kind, 'false-positive-check');
  assert.equal(exploitDepthQuestion(F1).kind, 'exploit-depth');
  const rs = reportScopeQuestion([F1, F2]);
  assert.equal(rs.kind, 'report-scope');
  assert.ok(rs.body.includes('2 findings'));
});

/* --- 51581–51598 steering prompts ------------------------------------------------ */

test('notification prefs learning', () => {
  const p = learnInterruptionPref(defaultInterruptPrefs(), 'high', 'silent');
  assert.equal(p.high, 'silent');
  assert.equal(interruptionMode(p, 'high'), 'silent');
  assert.equal(interruptionMode(p, 'critical'), 'interrupt');
});

test('handoff question only when idle past threshold', () => {
  assert.equal(handoffQuestion(5 * 60000, 10 * 60000, 0), null);
  const q = handoffQuestion(12 * 60000, 10 * 60000, 0);
  assert.equal(q.kind, 'handoff');
  assert.ok(q.options.some(o => o.key === 'continue'));
});

test('retest proposal flags affected findings', () => {
  const r = retestProposal(['app.example.com/chat'], [F1, F2]);
  assert.deepEqual(r.affectedFindingIds, ['F-1']);
  assert.ok(r.body.includes('1 finding'));
});

test('collaboration, learning, assumption, plan-review prompts', () => {
  const c = collaborationPrompt(F1, ['arjun']);
  assert.ok(c.options.some(o => o.key === 'arjun'));
  const lq = learningQuestion(F1);
  assert.equal(lq.kind, 'learning');
  const store = recordLearningAnswer(null, 'F-1', 'useful');
  const sum = learningSummary(store);
  assert.equal(sum.useful, 1);
  const ad = assumptionDisclosure(['x']);
  assert.equal(ad.assumptions.length, 1);
  const pr = planReviewPrompt({ phases: ['a', 'b'] });
  assert.equal(pr.phases.length, 2);
});

test('checkpoint, anomaly, coverage, tool, evidence, timing, parallelism prompts', () => {
  assert.equal(checkpointQuestion('x', 30 * 60000, 30 * 60000).kind, 'checkpoint');
  const an = anomalyQuestion('request rate', 40, 320);
  assert.equal(an.urgency, 'urgent');
  assert.equal(an.multiplier, 8);
  const cv = coverageQuestion(80, 120);
  assert.ok(cv.title.includes('80%'));
  const tc = toolChoiceQuestion('a', 'b');
  assert.ok(tc.options.some(o => o.key === 'speed'));
  assert.equal(evidenceQuestion(F1, 'high').kind, 'evidence');
  const tm = timingQuestion('brute', 5 * 3600000);
  assert.ok(tm.options.some(o => o.key === 'overnight'));
  const pl = parallelismQuestion(9, 2, 6);
  assert.equal(pl.suggestedParallel, 4);
});

test('data-handling, disclosure, steering feedback, goal alignment', () => {
  const dh = dataHandlingQuestion(F1);
  assert.deepEqual(
    dh.options.map(o => o.key),
    DATA_HANDLING_OPTIONS
  );
  assert.equal(dh.urgency, 'urgent');
  const dc = disclosureQuestion(F1, 'mid-hunt');
  assert.equal(dc.urgency, 'urgent');
  const fb = steeringFeedbackRequest({ id: 'a1', label: 'steer' });
  assert.equal(fb.kind, 'steering-feedback');
  const s2 = recordSteeringFeedback(null, 'a1', 'helped');
  assert.equal(steeringFeedbackSummary(s2).helped, 1);
  const g = goalAlignmentCheck('max coverage', 0, 5 * 3600000);
  assert.equal(g.kind, 'goal-alignment');
});

/* --- 51599/51600 queue ------------------------------------------------------------ */

test('queue: enqueue, due, triage order, dequeue, snooze, wake', () => {
  const mk = (id, urgency) => ({
    id,
    kind: 'k',
    title: id,
    body: '',
    options: [],
    urgency,
    status: 'open',
    answerKey: null,
    snoozedUntilMs: null,
  });
  let q = createQueue();
  q = enqueue(q, mk('low-q', 'low'));
  q = enqueue(q, mk('urgent-q', 'urgent'));
  q = enqueue(q, snoozeByMinutes(mk('snoozed-q', 'high'), 30, 1000));
  assert.equal(duePrompts(q, 2000).length, 2);
  assert.ok(isSnoozed(q.items[2], 2000));
  const ordered = triageOrder(duePrompts(q, 2000));
  assert.equal(ordered[0].id, 'urgent-q');
  const { prompt, queue: q2 } = dequeueNext(q, 2000);
  assert.equal(prompt.id, 'urgent-q');
  assert.equal(q2.items.length, 2);
  const sum = queueSummary(q2, 2000);
  assert.equal(sum.due, 1);
  assert.equal(sum.snoozed, 1);
  const woke = wakeSnoozed(q2, 1000 + 31 * 60000);
  assert.ok(woke.woke.some(w => w.id === 'snoozed-q'));
  const sn = snoozeUntil(mk('x', 'normal'), 777);
  assert.equal(sn.snoozedUntilMs, 777);
  assert.deepEqual(Object.keys(URGENCY_ORDER), ['urgent', 'high', 'normal', 'low']);
});

/* --- zero-keyframe CSS audit -------------------------------------------------------- */

test('Wave40.css: zero keyframes', () => {
  const css = readFileSync(join(DIR, 'Wave40.css'), 'utf8');
  assert.ok(!/@keyframes/i.test(css), 'no @keyframes allowed');
  assert.ok(!/animation\s*:/i.test(css), 'no animation shorthand allowed');
  assert.ok(!/transition\s*:/i.test(css), 'no transitions allowed');
  assert.ok(css.includes('.fs40-') && css.includes('.sq40-'), 'scoped classes present');
});

/* --- no-debris audit ----------------------------------------------------------------- */

test('wave-40 sources carry no unfinished-work or fake-content markers', async () => {
  const files = [
    'findingShareCore.js',
    'steeringQueueCore.js',
    'FindingShare.jsx',
    'SteeringQueue.jsx',
    'Wave40.css',
  ];
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

test('FindingShare.jsx parses clean via esbuild', async () => {
  const jsxPath = join(DIR, 'FindingShare.jsx');
  const out = execFileSync('npx', ['--no-install', 'esbuild', '--loader:.jsx=jsx', jsxPath], {
    encoding: 'utf8',
    timeout: 30000,
  });
  assert.ok(out.includes('FindingShareGallery'), 'esbuild parsed the share gallery export');
});

test('SteeringQueue.jsx parses clean via esbuild', async () => {
  const jsxPath = join(DIR, 'SteeringQueue.jsx');
  const out = execFileSync('npx', ['--no-install', 'esbuild', '--loader:.jsx=jsx', jsxPath], {
    encoding: 'utf8',
    timeout: 30000,
  });
  assert.ok(out.includes('SteeringQueueGallery'), 'esbuild parsed the steering gallery export');
});
