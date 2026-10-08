/**
 * wave34.test.js — wave 34 (ideas 51321–51360): pause/abort control round 2
 * + live strategy suite.
 * node:test checks for pure logic in pauseRound2Core.js / strategyCore.js
 * and registry completeness.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WAVE34A_START,
  WAVE34A_END,
  WAVE34A_IDEAS,
  VOICE_PAUSE_PHRASES,
  parseVoicePauseCommand,
  applyVoiceCommand,
  mobilePauseSpec,
  pauseWithInheritance,
  resumeWithInheritance,
  inheritedPausees,
  RESUME_ORDERS,
  orderResume,
  queueApprovalWhilePaused,
  drainApprovalQueue,
  abortSummary,
  pauseToSteer,
  reducedScope,
  watchdogCheck,
  ABORT_CASCADE_MODES,
  abortCascade,
  exportPauseState,
  attachResumeNote,
  pauseButtonPlacement,
  ABORT_REASON_CODES,
  validateAbortReason,
  snapshotOnPause,
  rampRate,
  rampCurve,
  pauseDiscussion,
  addPauseComment,
  canResume,
  isInPauseWindow,
  addPauseWindow,
  describePauseWindow,
  diffPauseState,
  indexAbortedHunt,
  searchAbortedHunts,
} from './pauseRound2Core.js';
import {
  WAVE34B_START,
  WAVE34B_END,
  WAVE34B_IDEAS,
  normalizeStrategy,
  shiftBreadthToDepth,
  shiftDepthToBreadth,
  STRATEGY_PRESETS,
  applyPreset,
  compareStrategies,
  forecastImpact,
  buildStrategy,
  commitStrategy,
  rollbackStrategy,
  strategyHistoryList,
  abTestPlan,
  abResult,
  suggestStrategyShift,
  scheduleShift,
  shiftsDue,
  perAssetStrategy,
  strategyHeatmap,
  logRationale,
  INDUSTRY_TEMPLATES,
  industryTemplate,
  exportStrategy,
  importStrategy,
  dryRun,
  strategyConfidence,
  autoStrategyBounds,
  autoShiftAllowed,
  checkGuardrails,
  strategyAlert,
} from './strategyCore.js';

const NOW = 1728220000000;
const BALANCED = normalizeStrategy({
  name: 'Balanced',
  focus: 'balanced',
  allocation: {
    recon: 20,
    'surface-map': 15,
    'tech-fingerprint': 10,
    'auth-deep': 20,
    'business-logic': 20,
    'exploit-chain': 15,
  },
});

// --- registry completeness ---------------------------------------------------

test('registry covers all 40 ideas 51321–51360, zero skips', () => {
  assert.equal(WAVE34A_START, 51321);
  assert.equal(WAVE34A_END, 51340);
  assert.equal(WAVE34B_START, 51341);
  assert.equal(WAVE34B_END, 51360);
  assert.equal(WAVE34A_IDEAS.length, 20);
  assert.equal(WAVE34B_IDEAS.length, 20);
  const idsA = WAVE34A_IDEAS.map(([id]) => id);
  const idsB = WAVE34B_IDEAS.map(([id]) => id);
  for (let i = 51321; i <= 51360; i += 1) {
    assert.ok(idsA.includes(i) || idsB.includes(i), `idea ${i} registered`);
  }
  for (const [, title, desc] of [...WAVE34A_IDEAS, ...WAVE34B_IDEAS]) {
    assert.ok(title && title.length > 2, 'title present');
    assert.ok(desc && desc.length > 5, 'description present');
  }
});

// --- 51321 voice pause ---------------------------------------------------------

test('voice transcript maps to control actions', () => {
  assert.equal(parseVoicePauseCommand('hey, pause the hunt please').action, 'pause');
  assert.equal(parseVoicePauseCommand('resume the hunt').action, 'resume');
  assert.equal(parseVoicePauseCommand('abort the hunt now').action, 'abort');
  assert.equal(parseVoicePauseCommand('weather today').action, null);
  assert.equal(parseVoicePauseCommand('').action, null);
  assert.ok(VOICE_PAUSE_PHRASES.length >= 10);
});

test('voice pause/resume apply; voice never aborts directly', () => {
  const s0 = { huntId: 'h1', paused: false, voiceLog: [] };
  const r1 = applyVoiceCommand(s0, parseVoicePauseCommand('pause the hunt'), NOW);
  assert.ok(r1.accepted && r1.state.paused && r1.state.pauseVia === 'voice');
  const r2 = applyVoiceCommand(r1.state, parseVoicePauseCommand('pause the hunt'), NOW);
  assert.ok(!r2.accepted);
  const r3 = applyVoiceCommand(r1.state, parseVoicePauseCommand('resume the hunt'), NOW);
  assert.ok(r3.accepted && !r3.state.paused);
  const r4 = applyVoiceCommand(s0, parseVoicePauseCommand('abort the hunt'), NOW);
  assert.ok(!r4.accepted && r4.state.abortArmed);
});

// --- 51322 mobile spec -----------------------------------------------------------

test('mobile pause spec keeps a big thumb target', () => {
  const phone = mobilePauseSpec(390, false);
  assert.ok(phone.touchTargetPx >= 56);
  assert.equal(phone.label, 'Pause');
  assert.equal(mobilePauseSpec(390, true).label, 'Resume');
  assert.ok(mobilePauseSpec(390, true).touchTargetPx >= 56, 'size never shrinks when paused');
});

// --- 51323 inheritance -------------------------------------------------------------

test('pause inheritance pauses subs; resume only lifts inherited ones', () => {
  const tree = pauseWithInheritance('p', ['s1', 's2'], NOW);
  assert.equal(tree.length, 3);
  assert.deepEqual(inheritedPausees(tree, 'p'), ['s1', 's2']);
  const resumed = resumeWithInheritance(tree, NOW);
  assert.ok(resumed.find(n => n.huntId === 'p').paused, 'parent stays paused');
  assert.ok(
    resumed.filter(n => n.inheritedFrom).every(n => !n.paused),
    'inherited sub-hunts resume'
  );
});

// --- 51324 ordering ------------------------------------------------------------------

test('resume ordering strategies order the queue', () => {
  const q = [
    { huntId: 'a', priority: 3, pausedAt: NOW - 50, findings: 12, remainingPhases: 4 },
    { huntId: 'b', priority: 5, pausedAt: NOW - 90, findings: 3, remainingPhases: 2 },
    { huntId: 'c', priority: 3, pausedAt: NOW - 20, findings: 30, remainingPhases: 6 },
  ];
  assert.deepEqual(
    orderResume(q, 'priority').map(h => h.huntId),
    ['b', 'a', 'c']
  );
  assert.deepEqual(
    orderResume(q, 'fifo').map(h => h.huntId),
    ['b', 'a', 'c']
  );
  assert.deepEqual(
    orderResume(q, 'largest-first').map(h => h.huntId),
    ['c', 'a', 'b']
  );
  assert.deepEqual(
    orderResume(q, 'quickest-first').map(h => h.huntId),
    ['b', 'a', 'c']
  );
  assert.deepEqual(RESUME_ORDERS, ['priority', 'fifo', 'largest-first', 'quickest-first']);
});

// --- 51325 approvals queue ------------------------------------------------------------------

test('approvals decided while paused queue and drain on resume', () => {
  let q = queueApprovalWhilePaused([], { id: 'a1', action: 'run PoC' });
  q = queueApprovalWhilePaused(q, { id: 'a2', action: 'send report' });
  assert.equal(q.length, 2);
  const { executed, remaining } = drainApprovalQueue(q, null);
  assert.equal(executed.length, 2);
  assert.equal(remaining.length, 0);
  const gated = drainApprovalQueue(q, () => false);
  assert.equal(gated.executed.length, 0);
  assert.equal(gated.remaining.length, 2);
});

// --- 51326 abort summary -----------------------------------------------------------------------

test('abort summary captures final-screen facts', () => {
  const s = abortSummary({
    huntId: 'h1',
    target: 't',
    startedAt: NOW - 3600000,
    now: NOW,
    phases: [
      { id: 'a', status: 'done' },
      { id: 'b', status: 'running' },
    ],
    findings: [
      { title: 'X', severity: 'critical' },
      { title: 'Y', severity: 'low' },
    ],
    modules: [{ id: 'm', active: true }],
    artifactCount: 5,
  });
  assert.equal(s.coverage, 50);
  assert.equal(s.criticalFindings, 1);
  assert.equal(s.elapsedMin, 60);
  assert.ok(s.irreversible);
});

// --- 51327 pause-to-steer --------------------------------------------------------------------------

test('pause-to-steer pauses and opens steering together', () => {
  const h = pauseToSteer({ huntId: 'h1', paused: false }, NOW);
  assert.ok(h.paused && h.steeringOpen && h.pauseVia === 'pause-to-steer');
});

// --- 51328 reduced scope -------------------------------------------------------------------------------

test('resume with reduced scope drops lowest-priority phases', () => {
  const phases = [
    { id: 'p1', priority: 5, status: 'pending' },
    { id: 'p2', priority: 1, status: 'pending' },
    { id: 'p3', priority: 3, status: 'done' },
    { id: 'p4', priority: 4, status: 'pending' },
  ];
  const { kept, dropped } = reducedScope(phases, 2);
  assert.deepEqual(
    kept.map(p => p.id),
    ['p1', 'p4']
  );
  assert.deepEqual(
    dropped.map(p => p.id),
    ['p2']
  );
});

// --- 51329 watchdog ----------------------------------------------------------------------------------------

test('pause watchdog flags overdue pauses', () => {
  const w = watchdogCheck(NOW - 47 * 60000, NOW, 30);
  assert.ok(w.overdue && w.overByMin === 17);
  assert.ok(!watchdogCheck(NOW - 5 * 60000, NOW, 30).overdue);
  assert.ok(!watchdogCheck(null, NOW, 30).overdue);
});

// --- 51330 cascade ------------------------------------------------------------------------------------------------

test('abort cascade respects the mode', () => {
  assert.deepEqual(abortCascade('a', ['b', 'c'], 'this-only').aborted, ['a']);
  assert.deepEqual(abortCascade('a', ['b', 'c'], 'cascade').aborted, ['a', 'b', 'c']);
  assert.deepEqual(abortCascade('a', ['b'], 'bogus').mode, 'this-only');
  assert.deepEqual(ABORT_CASCADE_MODES, ['this-only', 'cascade']);
});

// --- 51331 export ------------------------------------------------------------------------------------------------------

test('pause state export is JSON-serializable', () => {
  const snap = exportPauseState(
    {
      huntId: 'h1',
      target: 't',
      paused: true,
      phases: [{ id: 'a', status: 'done' }],
      findings: [{}],
      checkpoints: ['c'],
    },
    NOW
  );
  assert.equal(snap.format, 'dark-matter-pause-state');
  assert.equal(JSON.parse(JSON.stringify(snap)).huntId, 'h1');
});

// --- 51332 resume notes -----------------------------------------------------------------------------------------------------

test('resume notes attach with author and cap', () => {
  const h = attachResumeNote({ huntId: 'h1' }, 'client confirmed scope', 'you', NOW);
  assert.equal(h.resumeNotes.length, 1);
  assert.equal(h.resumeNotes[0].author, 'you');
  const long = attachResumeNote(h, 'x'.repeat(900), 'you', NOW);
  assert.equal(long.resumeNotes[1].note.length, 500);
});

// --- 51333 placement ----------------------------------------------------------------------------------------------------------------

test('pause button is sticky and visible on every hunt screen', () => {
  const s = pauseButtonPlacement('findings', 390);
  assert.ok(s.sticky && s.alwaysVisible);
  assert.equal(s.position, 'fixed-bottom-right');
  assert.equal(pauseButtonPlacement('findings', 1200).position, 'fixed-top-bar');
});

// --- 51334 abort reason -------------------------------------------------------------------------------------------------------------------

test('abort requires a valid reason code and detail', () => {
  assert.ok(!validateAbortReason(null).ok);
  assert.ok(!validateAbortReason({ code: 'bogus', detail: 'long enough detail' }).ok);
  assert.ok(!validateAbortReason({ code: 'scope-changed', detail: 'short' }).ok);
  const good = validateAbortReason({ code: 'scope-changed', detail: 'client narrowed the scope' });
  assert.ok(good.ok && good.errors.length === 0);
  assert.ok(ABORT_REASON_CODES.length >= 5);
});

// --- 51335 snapshot --------------------------------------------------------------------------------------------------------------------------------

test('pause-and-snapshot freezes report counts', () => {
  const s = snapshotOnPause(
    {
      huntId: 'h1',
      findings: [
        { title: 'A', severity: 'high' },
        { title: 'B', severity: 'low' },
      ],
      phases: [{ id: 'a', status: 'done' }],
    },
    NOW
  );
  assert.equal(s.findingsTotal, 2);
  assert.equal(s.bySeverity.high, 1);
  assert.equal(s.topFindings.length, 2);
});

// --- 51336 ramp ---------------------------------------------------------------------------------------------------------------------------------------------

test('resume speed ramp starts low and reaches base', () => {
  assert.equal(rampRate(60, 0, 10, 25), 15);
  assert.equal(rampRate(60, 10, 10, 25), 60);
  assert.equal(rampRate(60, 99, 10, 25), 60);
  const curve = rampCurve(60, 4, 25);
  assert.equal(curve.length, 5);
  assert.ok(curve[0].rpm < curve[4].rpm);
});

// --- 51337 collaboration ---------------------------------------------------------------------------------------------------------------------------------------------

test('pause collaboration gates resume to participants', () => {
  const t = pauseDiscussion({
    pausedBy: 'priya',
    pausedAt: NOW,
    reason: 'scope check',
    watchers: ['arjun'],
  });
  assert.deepEqual(t.participants.sort(), ['arjun', 'priya']);
  assert.ok(canResume(t, 'arjun'));
  assert.ok(!canResume(t, 'outsider'));
  const t2 = addPauseComment(t, 'arjun', 'looks fine', NOW);
  assert.equal(t2.comments.length, 1);
});

// --- 51338 calendar ----------------------------------------------------------------------------------------------------------------------------------------------------------

test('pause calendar blackouts match day/hour', () => {
  let cal = addPauseWindow([], { days: [1, 2, 3, 4, 5], startHour: 9, endHour: 18, label: 'biz' });
  assert.ok(isInPauseWindow(cal, 3, 14).inWindow);
  assert.ok(!isInPauseWindow(cal, 3, 19).inWindow);
  assert.ok(!isInPauseWindow(cal, 0, 14).inWindow);
  assert.ok(describePauseWindow(cal[0]).includes('business') === false); // label shown via template
  assert.ok(describePauseWindow(cal[0]).includes('Mon'));
});

// --- 51339 diff ------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('pause state diff reports target changes during pause', () => {
  const d = diffPauseState({ a: 1, b: 2 }, { a: 1, b: 3, c: 4 });
  assert.ok(d.changed && d.changeCount === 2);
  assert.deepEqual(diffPauseState({ a: 1 }, { a: 1 }).changes, []);
});

// --- 51340 archive search ---------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('aborted hunts stay searchable with partial findings', () => {
  let idx = indexAbortedHunt([], {
    huntId: 'h1',
    target: 'shop.example',
    abortedAt: NOW,
    abortReason: { code: 'scope-changed' },
    findings: [{ title: 'XSS on /search', severity: 'high' }],
  });
  idx = indexAbortedHunt(idx, {
    huntId: 'h2',
    target: 'api.bank.example',
    abortedAt: NOW,
    abortReason: { code: 'other' },
    findings: [],
  });
  assert.equal(searchAbortedHunts(idx, 'xss').length, 1);
  assert.equal(searchAbortedHunts(idx, 'scope-changed').length, 1);
  assert.equal(searchAbortedHunts(idx, 'zzz').length, 0);
  assert.equal(searchAbortedHunts(idx, '').length, 0);
});

// --- 51341/51342 breadth-depth switches -----------------------------------------------------------------------------------------------------------------------------------------------------------------

test('breadth-to-depth and back keep weights at 100', () => {
  const deep = shiftBreadthToDepth(BALANCED);
  const back = shiftDepthToBreadth(deep);
  for (const s of [deep, back]) {
    assert.equal(
      Object.values(s.allocation).reduce((a, b) => a + b, 0),
      100
    );
  }
  assert.equal(deep.focus, 'depth');
  assert.equal(back.focus, 'breadth');
  assert.ok(deep.allocation['auth-deep'] > BALANCED.allocation['auth-deep']);
  assert.ok(back.allocation.recon > deep.allocation.recon);
});

// --- 51343 presets ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('strategy presets apply live and normalize', () => {
  assert.ok(STRATEGY_PRESETS.length >= 4);
  const p = applyPreset('Auth-focused');
  assert.equal(p.name, 'Auth-focused');
  assert.equal(
    Object.values(p.allocation).reduce((a, b) => a + b, 0),
    100
  );
  assert.equal(applyPreset('Nope'), null);
});

// --- 51344 comparison -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('strategy comparison diffs current vs proposed', () => {
  const cmp = compareStrategies(BALANCED, applyPreset('Auth-focused'));
  assert.ok(cmp.rows.length > 0);
  const auth = cmp.rows.find(r => r.phase === 'auth-deep');
  assert.ok(auth.delta > 0);
  assert.ok(cmp.focusChanged);
  assert.ok(cmp.biggestShift.phase);
});

// --- 51345 forecast -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('impact forecast estimates time and coverage', () => {
  const f = forecastImpact(BALANCED, applyPreset('Recon-wide'), { endpoints: 400 });
  assert.ok(f.hoursCurrent >= 0 && f.hoursProposed >= 0);
  assert.ok(f.coverageProposed >= f.coverageCurrent, 'recon-wide covers more');
  assert.equal(typeof f.hoursDelta, 'number');
});

// --- 51346 builder -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('custom strategy builder validates weight sums', () => {
  const ok = buildStrategy('Mine', { recon: 50, 'auth-deep': 50 });
  assert.ok(ok.ok && ok.strategy.name === 'Mine');
  const bad = buildStrategy('Mine', { recon: 50, 'auth-deep': 30 });
  assert.ok(!bad.ok && bad.errors.some(e => e.includes('sum to 100')));
  assert.ok(!buildStrategy('', { recon: 100 }).ok);
});

// --- 51347 versioning -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('strategy versioning commits and rolls back', () => {
  let h = commitStrategy([], BALANCED, 'initial', NOW);
  h = commitStrategy(h, shiftBreadthToDepth(BALANCED), 'shift', NOW + 1);
  assert.equal(h.length, 2);
  assert.equal(h[1].version, 2);
  assert.equal(rollbackStrategy(h, 1).name, 'Balanced');
  assert.equal(rollbackStrategy(h, 99), null);
  assert.equal(strategyHistoryList(h).length, 2);
});

// --- 51348 A/B ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('A/B plan splits mirrored scope; result picks the winner', () => {
  const plan = abTestPlan(applyPreset('API-first'), applyPreset('Auth-focused'), {
    endpoints: 401,
  });
  assert.equal(plan.armA.endpoints + plan.armB.endpoints, 401);
  assert.equal(abResult(7, 11).winner, 'B');
  assert.equal(abResult(11, 7).winner, 'A');
  assert.equal(abResult(7, 7).winner, 'tie');
});

// --- 51349 suggestions -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('strategy suggestions react to live stats', () => {
  const s1 = suggestStrategyShift({
    coveragePct: 20,
    breadthHours: 1,
    depthHours: 5,
    findingsPerHour: 1,
  });
  assert.equal(s1.preset, 'Recon-wide');
  const s2 = suggestStrategyShift({
    coveragePct: 80,
    findingsPerHour: 0.2,
    breadthHours: 5,
    depthHours: 5,
  });
  assert.equal(s2.preset, 'Auth-focused');
  const s3 = suggestStrategyShift({ coveragePct: 80, findingsPerHour: 3, authFindings: 4 });
  assert.equal(s3.preset, 'Logic-heavy');
  assert.equal(suggestStrategyShift({ coveragePct: 80, findingsPerHour: 2 }).suggestion, 'hold');
});

// --- 51350 scheduled shifts ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('scheduled shifts fire on phase completion or time', () => {
  let s = scheduleShift([], { when: 'phase-complete:recon', apply: 'Auth-focused' });
  s = scheduleShift(s, { when: `at:${NOW + 60000}`, apply: 'Logic-heavy' });
  const due1 = shiftsDue(s, { completedPhases: ['recon'], now: NOW });
  assert.equal(due1.length, 1);
  assert.equal(due1[0].apply, 'Auth-focused');
  const due2 = shiftsDue(s, { completedPhases: [], now: NOW + 120000 });
  assert.equal(due2.length, 1);
});

// --- 51351 per-asset ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('per-asset strategies map assets with a default fallback', () => {
  const rows = perAssetStrategy(['a', 'b'], [{ asset: 'a', strategyName: 'API-first' }], BALANCED);
  assert.equal(rows.find(r => r.asset === 'a').strategy, 'API-first');
  assert.equal(rows.find(r => r.asset === 'b').strategy, 'Balanced');
});

// --- 51352 heatmap -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('strategy heatmap classifies intensity', () => {
  const rows = strategyHeatmap(BALANCED);
  assert.ok(rows.length > 0);
  const recon = rows.find(r => r.phase === 'recon');
  assert.equal(recon.intensity, 'medium');
  assert.ok(['none', 'low', 'medium', 'high'].includes(recon.intensity));
});

// --- 51353 rationale -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('rationale log appends entries', () => {
  const l = logRationale([], 'A → B', 'yield doubled on auth', NOW);
  assert.equal(l.length, 1);
  assert.ok(l[0].rationale.includes('yield'));
});

// --- 51354 industry templates ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('industry templates resolve to presets', () => {
  const t = industryTemplate('fintech');
  assert.ok(t && t.strategy.name === 'Auth-focused');
  assert.ok(Object.keys(INDUSTRY_TEMPLATES).length >= 4);
  assert.equal(industryTemplate('unknown'), null);
});

// --- 51355 import/export ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('strategy import/export round-trips with validation', () => {
  const json = exportStrategy(BALANCED);
  const back = importStrategy(json);
  assert.ok(back.ok && back.strategy.name === 'Balanced');
  assert.ok(!importStrategy('not json').ok);
  assert.ok(!importStrategy(JSON.stringify({ format: 'other' })).ok);
  assert.ok(
    !importStrategy(
      JSON.stringify({
        format: 'dark-matter-strategy',
        version: 1,
        strategy: { name: 'X', allocation: { a: 10 } },
      })
    ).ok
  );
});

// --- 51356 dry-run ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('dry-run previews without applying', () => {
  const d = dryRun(BALANCED, applyPreset('Recon-wide'), { endpoints: 400 });
  assert.ok(d.coverageDelta >= 0);
  assert.ok(typeof d.verdict === 'string' && d.verdict.length > 0);
});

// --- 51357 confidence ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('strategy confidence scores fit 0–100', () => {
  const deep = shiftBreadthToDepth(BALANCED);
  const c = strategyConfidence(deep, { coveragePct: 90, findingsPerHour: 2.5 });
  assert.ok(c >= 0 && c <= 100);
  assert.ok(
    strategyConfidence(BALANCED, { coveragePct: 10, findingsPerHour: 0 }) < c,
    'fit beats misfit'
  );
});

// --- 51358 auto bounds ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('auto-strategy bounds gate automatic shifts', () => {
  const b = autoStrategyBounds();
  assert.ok(b.allowBreadthDepth && !b.allowPresetChange);
  assert.ok(autoShiftAllowed(b, { kind: 'breadth-depth', shiftPct: 20 }).allowed);
  assert.ok(!autoShiftAllowed(b, { kind: 'preset', shiftPct: 10 }).allowed);
  assert.ok(!autoShiftAllowed(b, { kind: 'breadth-depth', shiftPct: 50 }).allowed);
  const open = autoStrategyBounds({ allowPresetChange: true, maxShiftPct: 60 });
  assert.ok(autoShiftAllowed(open, { kind: 'preset', shiftPct: 50 }).allowed);
});

// --- 51359 guardrails ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('guardrails flag violations', () => {
  const rails = [
    { id: 'cov', kind: 'min-breadth', limit: 15 },
    { id: 'auth', kind: 'forbid-phase', phases: ['auth-deep'] },
    { id: 'cap', kind: 'max-shift', limit: 40 },
  ];
  const v = checkGuardrails(
    { kind: 'breadth-depth', newBreadthPct: 10, shiftPct: 45, removedPhases: ['auth-deep'] },
    rails
  );
  assert.equal(v.length, 3);
  assert.equal(
    checkGuardrails(
      { kind: 'breadth-depth', newBreadthPct: 20, shiftPct: 10, removedPhases: [] },
      rails
    ).length,
    0
  );
});

// --- 51360 alerts ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('strategy change alerts fan out to watchers', () => {
  const a = strategyAlert(
    { from: 'Balanced', to: 'Auth-focused', reason: 'suggestion accepted' },
    [{ id: 'you', channel: 'board' }],
    NOW
  );
  assert.equal(a.length, 1);
  assert.ok(a[0].subject.includes('Balanced'));
  assert.ok(a[0].body.includes('suggestion accepted'));
});

// --- no-debris + zero-animation audits ---------------------------------------

test('core files have no TODO/FIXME/mock debris', async () => {
  const { readFile } = await import('node:fs/promises');
  for (const f of ['./pauseRound2Core.js', './strategyCore.js']) {
    const src = await readFile(new URL(f, import.meta.url), 'utf8');
    assert.ok(!/\bTODO\b|\bFIXME\b/i.test(src), `no TODO/FIXME in ${f}`);
    assert.ok(!/simulate/i.test(src), `no simulate debris in ${f}`);
  }
});

test('CSS carries zero keyframes per the zero-animation order', async () => {
  const { readFile } = await import('node:fs/promises');
  const css = await readFile(new URL('./Wave34.css', import.meta.url), 'utf8');
  assert.ok(!/@keyframes/i.test(css), 'zero keyframes');
});

test('JSX files have no TODO/mock debris', async () => {
  const { readFile } = await import('node:fs/promises');
  for (const f of ['./PauseRound2.jsx', './StrategySuite.jsx']) {
    const src = await readFile(new URL(f, import.meta.url), 'utf8');
    assert.ok(!/\bTODO\b|\bFIXME\b/i.test(src), `no TODO/FIXME in ${f}`);
    assert.ok(!/\bmock\b/i.test(src), `no mock debris in ${f}`);
  }
});
