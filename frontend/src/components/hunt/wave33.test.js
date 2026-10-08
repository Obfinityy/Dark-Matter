/**
 * wave33.test.js — wave 33 (ideas 51281–51320): pause/abort/resume control
 * suite + log governance + live artifact gallery.
 * node:test checks for pure logic in pauseControlCore.js and registry
 * completeness.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WAVE33_START,
  WAVE33_END,
  WAVE33_IDEAS,
  createHuntControl,
  instantPause,
  beginGracefulPause,
  gracefulDrainTick,
  completeInFlightUnit,
  PAUSE_REASONS,
  tagPauseReason,
  describePauseReason,
  resume,
  schedulePause,
  scheduledPauseDue,
  applyScheduledPause,
  shouldPauseOnFinding,
  pauseOnFinding,
  pauseOnApproval,
  prepareAbort,
  confirmAbort,
  abortAndArchive,
  softAbort,
  setModulePaused,
  pausedModules,
  pauseAllHunts,
  resumeAllHunts,
  pauseBanner,
  resumeChecklist,
  scheduleAutoResume,
  autoResumeDue,
  applyAutoResume,
  stealthPause,
  ABORT_REASON_CODES,
  describeAbortCode,
  pauseNotifications,
  createCheckpoint,
  resumeFromCheckpoint,
  parsePauseCommand,
  pauseHeat,
  resumeDryRun,
  abortImpact,
  pauseChatContext,
  armResumeCondition,
  checkResumeCondition,
  PAUSE_TEMPLATES,
  applyPauseTemplate,
  hibernate,
  wakeFromHibernation,
  shouldWake,
  pauseCost,
  resumeWithInstructions,
  cloneHuntConfig,
  suspendApprovalTimers,
  resumeApprovalTimers,
  checkResumeConflicts,
  setScreenLocked,
  abortToReport,
  recordPauseEvent,
  pauseAnalytics,
  LOG_ROLES,
  canSeeRawLogs,
  visibleLogView,
  RETENTION_POLICIES,
  applyRetentionPolicy,
  buildIncidentPackage,
  ARTIFACT_TYPES,
  addArtifact,
  filterArtifacts,
  artifactCounts,
} from './pauseControlCore.js';

const NOW = 1728220000000;
const mk = (over = {}) => ({ ...createHuntControl('hunt-42', ['recon', 'fuzzing']), ...over });

// --- registry completeness ---------------------------------------------------

test('registry covers all 40 ideas 51281–51320, zero skips', () => {
  assert.equal(WAVE33_START, 51281);
  assert.equal(WAVE33_END, 51320);
  assert.equal(WAVE33_IDEAS.length, 40);
  const ids = WAVE33_IDEAS.map(([id]) => id);
  for (let id = 51281; id <= 51320; id += 1) assert.ok(ids.includes(id), `idea ${id} present`);
  for (const [id, slug, desc] of WAVE33_IDEAS) {
    assert.ok(slug && slug.length > 3, `idea ${id} has a slug`);
    assert.ok(desc && desc.length > 10, `idea ${id} has a description`);
  }
});

// --- pause state machine -----------------------------------------------------

test('instant pause freezes a running hunt', () => {
  const c = instantPause(mk(), { reason: 'manual', by: 'operator', now: NOW });
  assert.equal(c.status, 'paused');
  assert.equal(c.pausedAt, NOW);
  assert.equal(c.pauseReason, 'manual');
  assert.equal(c.pausedBy, 'operator');
});

test('instant pause is a no-op unless running', () => {
  const c = mk({ status: 'paused' });
  assert.equal(instantPause(c, { reason: 'manual', now: NOW }), c);
});

test('graceful pause drains in-flight work before pausing', () => {
  let c = beginGracefulPause(mk({ inFlight: 2 }), { reason: 'manual', by: 'op', now: NOW });
  assert.equal(c.status, 'draining');
  c = gracefulDrainTick(completeInFlightUnit(c), NOW);
  assert.equal(c.status, 'draining');
  assert.equal(c.inFlight, 1);
  c = gracefulDrainTick(completeInFlightUnit(c), NOW);
  assert.equal(c.status, 'paused');
  assert.equal(c.pausedAt, NOW);
});

test('pause reasons tag and describe correctly', () => {
  const c = tagPauseReason(mk(), 'lunch', 'back in 20');
  assert.equal(c.pauseReason, 'lunch');
  assert.equal(c.pauseNote, 'back in 20');
  assert.ok(describePauseReason('lunch').length > 5);
  assert.equal(tagPauseReason(mk(), 'bogus').pauseReason, 'other');
  assert.equal(PAUSE_REASONS.length, 9);
});

test('resume picks up exactly where the hunt stopped', () => {
  const paused = instantPause(mk({ completedSteps: 17 }), { reason: 'manual', now: NOW });
  const c = resume(paused, { now: NOW + 1000 });
  assert.equal(c.status, 'running');
  assert.equal(c.completedSteps, 17);
  assert.equal(c.pausedAt, null);
});

test('scheduled pause fires only when due', () => {
  let c = schedulePause(mk(), NOW + 30 * 60_000);
  assert.equal(scheduledPauseDue(c, NOW), false);
  assert.equal(scheduledPauseDue(c, NOW + 30 * 60_000 + 1), true);
  c = applyScheduledPause(c, NOW + 30 * 60_000 + 1);
  assert.equal(c.status, 'paused');
  assert.equal(c.pauseReason, 'scheduled');
  assert.equal(c.scheduledPauseAt, null);
});

test('pause on finding respects the severity threshold', () => {
  assert.equal(shouldPauseOnFinding('high', { severity: 'critical' }), true);
  assert.equal(shouldPauseOnFinding('high', { severity: 'high' }), true);
  assert.equal(shouldPauseOnFinding('high', { severity: 'medium' }), false);
  const c = pauseOnFinding(mk(), { severity: 'critical' }, 'high', NOW);
  assert.equal(c.status, 'paused');
  assert.equal(c.pauseReason, 'finding');
  const c2 = pauseOnFinding(mk(), { severity: 'low' }, 'high', NOW);
  assert.equal(c2.status, 'running');
});

test('pause on approval fires while approvals are pending', () => {
  const c = pauseOnApproval(mk(), ['approval-1'], NOW);
  assert.equal(c.status, 'paused');
  assert.equal(c.pauseReason, 'approval');
  assert.equal(c.pendingApprovals, 1);
  assert.equal(pauseOnApproval(mk(), [], NOW).status, 'running');
});

// --- abort flows -------------------------------------------------------------

test('two-step abort requires the confirmation token', () => {
  const c = mk({ inFlight: 2, nextActions: ['a', 'b'] });
  const prep = prepareAbort(c);
  assert.ok(prep.token.includes('hunt-42'));
  assert.equal(prep.willDiscardInFlight, 2);
  assert.equal(prep.queuedActions, 2);
  assert.equal(confirmAbort(c, 'wrong-token', { now: NOW }), c);
  const aborted = confirmAbort(c, prep.token, { code: 'operator', now: NOW });
  assert.equal(aborted.status, 'aborted');
  assert.equal(aborted.abortCode, 'operator');
});

test('abort-and-archive preserves findings and timeline', () => {
  const c = mk({ inFlight: 1 });
  const prep = prepareAbort(c);
  const a = abortAndArchive(c, prep.token, { code: 'incident', now: NOW });
  assert.equal(a.status, 'archived');
  assert.equal(a.archive.findingsKept, true);
  assert.equal(a.archive.timelineKept, true);
  assert.equal(a.archive.inFlightDiscarded, 1);
});

test('soft abort clears the queue but keeps the hunt finishing', () => {
  const c = softAbort(mk({ nextActions: ['a'] }), { now: NOW });
  assert.equal(c.status, 'finishing');
  assert.deepEqual(c.nextActions, []);
});

// --- module + global pause ---------------------------------------------------

test('per-module pause freezes one module only', () => {
  const c = setModulePaused(mk(), 'fuzzing', true);
  assert.deepEqual(pausedModules(c), ['fuzzing']);
  assert.equal(c.status, 'running');
  const before = mk();
  assert.equal(setModulePaused(before, 'nope', true), before, 'unknown module is a no-op');
});

test('global pause hits every running hunt; resume only globally-paused ones', () => {
  const hunts = [
    mk({ huntId: 'a' }),
    mk({ huntId: 'b' }),
    mk({ huntId: 'c', status: 'paused', pauseReason: 'manual' }),
  ];
  const paused = pauseAllHunts(hunts, { by: 'op', now: NOW });
  assert.equal(paused[0].status, 'paused');
  assert.equal(paused[1].pauseReason, 'global');
  assert.equal(paused[2].pauseReason, 'manual');
  const resumed = resumeAllHunts(paused, { now: NOW });
  assert.equal(resumed[0].status, 'running');
  assert.equal(resumed[2].status, 'paused');
});

// --- indicator, checklist, timers --------------------------------------------

test('pause banner model covers every stopped state', () => {
  assert.equal(pauseBanner(mk()).show, false);
  const b = pauseBanner(instantPause(mk(), { reason: 'review', by: 'op', now: NOW }));
  assert.equal(b.show, true);
  assert.equal(b.title, 'HUNT PAUSED');
  assert.ok(b.detail.includes('Review'));
  assert.equal(pauseBanner(mk({ status: 'draining', inFlight: 2 })).title, 'PAUSING…');
  assert.equal(pauseBanner(mk({ status: 'hibernating' })).title, 'HUNT HIBERNATING');
});

test('resume checklist lists next actions and special states', () => {
  const items = resumeChecklist(
    mk({
      status: 'paused',
      completedSteps: 9,
      nextActions: ['a', 'b'],
      networkHalted: true,
      newInstructions: ['x'],
    })
  );
  assert.ok(items.some(i => i.label.includes('step 10')));
  assert.ok(items.some(i => i.label.includes('Network traffic will resume')));
  assert.ok(items.some(i => i.label.includes('1 new instruction')));
});

test('auto-resume timer fires while paused', () => {
  let c = scheduleAutoResume(instantPause(mk(), { reason: 'manual', now: NOW }), 15, NOW);
  assert.equal(autoResumeDue(c, NOW + 14 * 60_000), false);
  assert.equal(autoResumeDue(c, NOW + 15 * 60_000 + 1), true);
  c = applyAutoResume(c, NOW + 15 * 60_000 + 1);
  assert.equal(c.status, 'running');
  assert.equal(c.resumedBy, 'auto-timer');
});

test('stealth pause halts network traffic instantly', () => {
  const c = stealthPause(mk(), { by: 'op', now: NOW });
  assert.equal(c.status, 'paused');
  assert.equal(c.pauseReason, 'stealth');
  assert.equal(c.networkHalted, true);
});

// --- abort codes, notifications, checkpoints, API ----------------------------

test('abort reason codes describe every code', () => {
  assert.equal(ABORT_REASON_CODES.length, 8);
  for (const [code] of ABORT_REASON_CODES) assert.ok(describeAbortCode(code).length > 3);
});

test('pause notifications fire on transitions only', () => {
  const running = mk();
  const paused = instantPause(running, { reason: 'review', by: 'op', now: NOW });
  const n1 = pauseNotifications(running, paused);
  assert.equal(n1.length, 1);
  assert.equal(n1[0].kind, 'paused');
  assert.ok(n1[0].text.includes('hunt-42'));
  const n2 = pauseNotifications(paused, resume(paused, { now: NOW }));
  assert.equal(n2[0].kind, 'resumed');
  assert.deepEqual(pauseNotifications(paused, paused), []);
});

test('checkpoints allow rollback resume', () => {
  let c = mk({ completedSteps: 24, nextActions: ['x'] });
  c = createCheckpoint(c, 'before risky module', NOW);
  assert.equal(c.checkpoints.length, 1);
  const paused = { ...c, status: 'paused', completedSteps: 30, nextActions: ['y'] };
  const r = resumeFromCheckpoint(paused, c.checkpoints[0].id, { now: NOW });
  assert.equal(r.completedSteps, 24);
  assert.deepEqual(r.nextActions, ['x']);
  assert.equal(r.resumedFromCheckpoint, c.checkpoints[0].id);
  assert.equal(resumeFromCheckpoint(paused, 'cp-nope', { now: NOW }), paused);
});

test('pause API parses every supported command', () => {
  assert.deepEqual(parsePauseCommand('pause'), { action: 'pause' });
  assert.deepEqual(parsePauseCommand('pause 10m'), { action: 'pause-timed', minutes: 10 });
  assert.deepEqual(parsePauseCommand('pause module recon'), {
    action: 'pause-module',
    module: 'recon',
  });
  assert.deepEqual(parsePauseCommand('resume'), { action: 'resume' });
  assert.deepEqual(parsePauseCommand('resume dry-run'), { action: 'resume-dry-run' });
  assert.deepEqual(parsePauseCommand('abort'), { action: 'abort' });
  assert.deepEqual(parsePauseCommand('status'), { action: 'status' });
  assert.ok(parsePauseCommand('frobnicate').error);
  assert.ok(parsePauseCommand('').error);
});

// --- heat, dry-run, impact, chat, conditions, templates ----------------------

test('pause heat flags mid-exploit pauses for review', () => {
  assert.equal(pauseHeat(mk()).level, 'cool');
  assert.equal(pauseHeat(mk({ inFlight: 1, nextActions: ['enumerate'] })).level, 'warm');
  const hot = pauseHeat(mk({ inFlight: 2, nextActions: ['send exploit payload'] }));
  assert.equal(hot.level, 'hot');
  assert.equal(hot.review, true);
});

test('resume dry-run previews at most 5 actions', () => {
  const preview = resumeDryRun(
    mk({ completedSteps: 12, nextActions: ['a', 'b', 'c', 'd', 'e', 'f'] })
  );
  assert.equal(preview.length, 5);
  assert.equal(preview[0].fromStep, 13);
  assert.equal(preview[4].order, 5);
});

test('abort impact summary quantifies the loss', () => {
  const impact = abortImpact(mk({ inFlight: 2, nextActions: ['a', 'b', 'c'] }), {
    findings: [{}, {}, {}],
    coveragePct: 62,
    startedAt: NOW - 45 * 60_000,
    now: NOW,
  });
  assert.equal(impact.findingsDrafted, 3);
  assert.equal(impact.inFlightLost, 2);
  assert.equal(impact.queuedLost, 3);
  assert.equal(impact.coverageAtAbortPct, 62);
  assert.equal(impact.minutesInvested, 45);
});

test('pause-and-chat context is complete', () => {
  const ctx = pauseChatContext(mk({ status: 'paused', pauseReason: 'review', completedSteps: 18 }));
  assert.equal(ctx.huntId, 'hunt-42');
  assert.equal(ctx.completedSteps, 18);
  assert.ok(ctx.heat);
});

test('conditional auto-resume fires on facts', () => {
  const c = armResumeCondition(mk({ status: 'paused' }), { type: 'approval-resolved' });
  assert.equal(checkResumeCondition(c, { pendingApprovals: 2 }), false);
  assert.equal(checkResumeCondition(c, { pendingApprovals: 0 }), true);
  assert.equal(checkResumeCondition(mk({ status: 'running' }), { pendingApprovals: 0 }), false);
});

test('pause templates apply named reasons', () => {
  const c = applyPauseTemplate(mk(), 'standup', { by: 'op', now: NOW });
  assert.equal(c.status, 'paused');
  assert.ok(c.pauseNote.includes('Standup'));
  assert.equal(PAUSE_TEMPLATES.length, 5);
  assert.equal(applyPauseTemplate(mk(), 'bogus', { now: NOW }).status, 'running');
});

// --- hibernation, wake, cost, instructions, clone -----------------------------

test('hibernation deep-freezes and wakes with state intact', () => {
  const c = mk({ status: 'paused', completedSteps: 40, nextActions: ['deep fuzz'] });
  const snap = hibernate(c, { now: NOW });
  assert.equal(snap.status, 'hibernating');
  assert.equal(snap.completedSteps, 40);
  const woken = wakeFromHibernation(snap, { now: NOW + 1 });
  assert.equal(woken.status, 'paused');
  assert.equal(woken.nextActions.length, 1);
  assert.equal(hibernate(mk({ status: 'aborted' }), { now: NOW }).status, 'aborted');
});

test('wake-on-finding only fires on watched changes', () => {
  assert.equal(shouldWake(['new-subdomain'], ['new-subdomain']), true);
  assert.equal(shouldWake(['new-subdomain'], ['unrelated-dns']), false);
});

test('pause cost accrues only while paused', () => {
  const cost = pauseCost(mk({ status: 'paused', pausedAt: NOW - 90 * 60_000 }), 0.42, NOW);
  assert.equal(cost.minutes, 90);
  assert.equal(cost.cost, 37.8);
  assert.deepEqual(pauseCost(mk(), 0.42, NOW), { minutes: 0, cost: 0, currency: 'USD' });
});

test('resume with new instructions attaches steering', () => {
  const c = resumeWithInstructions(mk({ status: 'paused' }), 'focus auth', { now: NOW });
  assert.equal(c.status, 'running');
  assert.deepEqual(c.newInstructions, ['focus auth']);
});

test('abort-and-clone carries config, not history', () => {
  const clone = cloneHuntConfig(mk({ targetFingerprint: 'fp-1', newInstructions: ['x'] }));
  assert.equal(clone.fromHunt, 'hunt-42');
  assert.deepEqual(clone.modules, ['recon', 'fuzzing']);
  assert.equal(clone.targetFingerprint, 'fp-1');
  assert.ok(!('completedSteps' in clone));
});

// --- approval chains, conflicts, lock, report mode, analytics ----------------

test('approval timers suspend and resume with the pause', () => {
  assert.equal(suspendApprovalTimers(mk()).approvalsSuspended, true);
  assert.equal(resumeApprovalTimers(mk({ approvalsSuspended: true })).approvalsSuspended, false);
});

test('resume conflict check warns on target change', () => {
  const c = mk({
    status: 'paused',
    targetFingerprint: 'fp-aaaa',
    completedSteps: 5,
    nextActions: [],
  });
  const w = checkResumeConflicts(c, 'fp-bbbb');
  assert.ok(w.some(x => x.id === 'target-changed' && x.severity === 'high'));
  assert.deepEqual(checkResumeConflicts({ ...c, nextActions: ['a'] }, 'fp-aaaa'), []);
});

test('screen lock toggles', () => {
  assert.equal(setScreenLocked(mk(), true).screenLocked, true);
  assert.equal(setScreenLocked(mk({ screenLocked: true }), false).screenLocked, false);
});

test('abort to report keeps the agent in report mode', () => {
  const c = abortToReport(mk({ nextActions: ['a'] }), { now: NOW });
  assert.equal(c.status, 'reporting');
  assert.equal(c.reportMode, true);
  assert.deepEqual(c.nextActions, []);
});

test('pause analytics aggregates pauses by reason', () => {
  let log = [];
  log = recordPauseEvent(log, { kind: 'paused', reason: 'review', at: NOW - 500000 });
  log = recordPauseEvent(log, { kind: 'resumed', at: NOW - 440000 });
  log = recordPauseEvent(log, { kind: 'paused', reason: 'lunch', at: NOW - 300000 });
  const s = pauseAnalytics(log);
  assert.equal(s.totalPauses, 2);
  assert.equal(s.totalResumes, 1);
  assert.deepEqual(s.byReason, { review: 1, lunch: 1 });
  assert.equal(s.avgPauseMinutes, 1);
});

// --- log governance ----------------------------------------------------------

test('log access roles gate raw logs', () => {
  assert.equal(canSeeRawLogs('owner'), true);
  assert.equal(canSeeRawLogs('teammate'), true);
  assert.equal(canSeeRawLogs('auditor'), false);
  assert.equal(canSeeRawLogs('viewer'), false);
  assert.equal(LOG_ROLES.length, 4);
  const lines = [{ id: 'l1' }];
  assert.equal(visibleLogView('owner', lines, []).mode, 'raw');
  assert.equal(visibleLogView('auditor', lines, [{ id: 's1' }]).mode, 'summaries');
  assert.equal(visibleLogView('viewer', lines, []).mode, 'status');
});

test('retention policies archive or purge correctly', () => {
  const DAY = 86_400_000;
  const lines = [
    { id: 'l1', ts: NOW - 2 * DAY, pii: false },
    { id: 'l2', ts: NOW - 40 * DAY, pii: false },
    { id: 'l3', ts: NOW - 2 * DAY, pii: true },
  ];
  const r7 = applyRetentionPolicy(lines, 'keep-7d', NOW);
  assert.equal(r7.live.length, 2);
  assert.equal(r7.archived.length, 1);
  const arch = applyRetentionPolicy(lines, 'archive-now', NOW);
  assert.equal(arch.archived.length, 3);
  assert.equal(arch.live.length, 0);
  const purge = applyRetentionPolicy(lines, 'purge-pii', NOW);
  assert.equal(purge.purged.length, 1);
  assert.equal(purge.live.length, 2);
  assert.equal(RETENTION_POLICIES.length, 5);
});

test('incident package bundles logs, findings, and timeline', () => {
  const pack = buildIncidentPackage({
    huntId: 'hunt-42',
    logs: [{}, {}],
    findings: [{}],
    timeline: [{}, {}, {}],
    builtAt: NOW,
  });
  assert.equal(pack.kind, 'incident-package');
  assert.deepEqual(pack.manifest, { logs: 2, findings: 1, timelineEvents: 3 });
  assert.equal(pack.sections.length, 4);
  assert.equal(pack.shareable, true);
});

// --- artifact gallery --------------------------------------------------------

test('artifact gallery appends, filters, and counts', () => {
  let g = [];
  g = addArtifact(g, { type: 'screenshot', title: 'login render', capturedAt: NOW });
  g = addArtifact(g, { type: 'response', title: 'GET /hunts', capturedAt: NOW });
  g = addArtifact(g, { type: 'bogus', title: 'weird', capturedAt: NOW });
  assert.equal(g.length, 3);
  assert.equal(g[2].type, 'note');
  assert.equal(filterArtifacts(g, { type: 'screenshot' }).length, 1);
  assert.equal(filterArtifacts(g, { query: 'hunts' }).length, 1);
  assert.equal(filterArtifacts(g, { type: 'all', query: 'zzz' }).length, 0);
  assert.deepEqual(artifactCounts(g), { all: 3, screenshot: 1, response: 1, file: 0, note: 1 });
  assert.deepEqual(ARTIFACT_TYPES, ['screenshot', 'response', 'file', 'note']);
});

// --- no-debris + zero-animation audits ---------------------------------------

test('core file has no TODO/FIXME/mock debris', async () => {
  const { readFile } = await import('node:fs/promises');
  const src = await readFile(new URL('./pauseControlCore.js', import.meta.url), 'utf8');
  assert.ok(!/\bTODO\b|\bFIXME\b/i.test(src), 'no TODO/FIXME');
  assert.ok(!/simulate/i.test(src), 'no simulate debris');
});

test('CSS carries zero keyframes per the zero-animation order', async () => {
  const { readFile } = await import('node:fs/promises');
  const css = await readFile(new URL('./PauseControl.css', import.meta.url), 'utf8');
  assert.ok(!/@keyframes/i.test(css), 'zero keyframes');
});
