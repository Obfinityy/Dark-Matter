/**
 * wave35.test.js — wave 35 (ideas 51361–51400): strategy round 3 +
 * explainability suite.
 * node:test checks for pure logic in strategyRound3Core.js /
 * explainabilityCore.js and registry completeness.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WAVE35A_START,
  WAVE35A_END,
  WAVE35A_IDEAS,
  recordStrategyEvent,
  findingsPerHour,
  liveEffectivenessScores,
  pushStrategyState,
  rollbackOneClick,
  annotateStrategy,
  annotationsFor,
  parseStrategyChatCommand,
  segmentStrategyTimeline,
  strategyColor,
  attributeFinding,
  strategyReportLines,
  MARKETPLACE_PRESETS,
  previewMarketplacePreset,
  installMarketplacePreset,
  simulateStrategy,
  FOCUS_AREAS,
  applyFocusAreas,
  excludeFromStrategy,
  startTimebox,
  timeboxRemainingMs,
  timeboxExpired,
  startStrategyVote,
  castStrategyVote,
  strategyVoteTally,
  diffStrategy,
  retestModePreset,
  learnStrategies,
  isBusinessHour,
  quietHoursDowngrade,
  estimateStrategyCost,
  requestStrategyApproval,
  decideStrategyApproval,
  pendingStrategyApprovals,
  chainStrategies,
  advanceStrategyChain,
  checkStrategyPerformance,
  personalizeStrategy,
  explainStrategyFit,
  snapshotStrategy,
  migrateStrategy,
  ensureFairCoverage,
  strategyChangeTiming,
  digestStrategyUpdates,
  ROLLBACK_WINDOW_MS,
  rollbackWindowOpen,
  undoStrategyChange,
  tagStrategySegment,
  strategySegmentsByTag,
  correlateStrategyFindings,
  exportStrategyJourney,
  parseVoiceStrategyCommand,
  mobileStrategyPicker,
  GUARDRAIL_PRESETS,
  enforceGuardrailPreset,
  buildRetrospective,
  recommendStrategies,
} from './strategyRound3Core.js';
import {
  WAVE35B_START,
  WAVE35B_END,
  WAVE35B_IDEAS,
  explainFinding,
  eli5Explanation,
  executiveSummary,
  findingAnalogy,
  explainFindingAll,
} from './explainabilityCore.js';

const NOW = 1728220000000;
const BASE = {
  name: 'Balanced',
  focus: 'balanced',
  aggression: 'balanced',
  allocation: {
    recon: 20,
    'surface-map': 15,
    'tech-fingerprint': 10,
    'auth-deep': 20,
    'business-logic': 20,
    'exploit-chain': 15,
  },
};
const AGGRO = {
  ...BASE,
  name: 'Aggro',
  focus: 'depth',
  aggression: 'aggressive',
  allocation: {
    recon: 10,
    'surface-map': 10,
    'tech-fingerprint': 10,
    'auth-deep': 25,
    'business-logic': 25,
    'exploit-chain': 20,
  },
};

// --- registry completeness -----------------------------------------------------

test('strategy round 3 registry covers 51361–51396 with zero skips', () => {
  assert.equal(WAVE35A_START, 51361);
  assert.equal(WAVE35A_END, 51396);
  assert.equal(WAVE35A_IDEAS.length, 36);
  const ids = WAVE35A_IDEAS.map(([id]) => id);
  for (let i = WAVE35A_START; i <= WAVE35A_END; i++)
    assert.ok(ids.includes(i), `missing idea ${i}`);
  assert.equal(new Set(ids).size, 36, 'no duplicate ids');
});

test('explainability registry covers 51397–51400', () => {
  assert.equal(WAVE35B_START, 51397);
  assert.equal(WAVE35B_END, 51400);
  assert.equal(WAVE35B_IDEAS.length, 4);
});

// --- 51361 effectiveness --------------------------------------------------------

test('findings-per-hour tracked live per strategy', () => {
  let e = [];
  e = recordStrategyEvent(e, 'A', 'F-1', NOW - 1_800_000);
  e = recordStrategyEvent(e, 'A', 'F-2', NOW - 600_000);
  e = recordStrategyEvent(e, 'B', 'F-3', NOW - 600_000);
  assert.equal(findingsPerHour(e, 'A', 3_600_000, NOW), 2);
  const scores = liveEffectivenessScores(e, NOW);
  assert.equal(scores[0].strategy, 'A');
  assert.equal(scores[1].strategy, 'B');
});

// --- 51362 rollback --------------------------------------------------------------

test('one-click rollback restores previous strategy with state intact', () => {
  let stack = pushStrategyState([], BASE, { phase: 'recon' }, NOW - 3_600_000, 'init');
  stack = pushStrategyState(stack, AGGRO, { phase: 'auth-deep' }, NOW, 'switch');
  const { entry, rest } = rollbackOneClick(stack);
  assert.equal(entry.strategy.name, 'Balanced');
  assert.equal(entry.stateSnapshot.phase, 'recon');
  assert.equal(rest.length, 1);
  const empty = rollbackOneClick([]);
  assert.equal(empty.entry, null);
});

// --- 51363 annotations -------------------------------------------------------------

test('strategy annotations are recorded and retrievable', () => {
  let a = annotateStrategy([], 'Balanced', 'Auth endpoints look juicy', NOW);
  assert.equal(annotationsFor(a, 'Balanced').length, 1);
  assert.equal(annotationsFor(a, 'Other').length, 0);
});

// --- 51364 chat commands -------------------------------------------------------------

test('chat commands parse into strategy actions', () => {
  assert.deepEqual(parseStrategyChatCommand('switch to depth mode'), {
    action: 'switch',
    target: 'depth',
  });
  assert.deepEqual(parseStrategyChatCommand('try breadth for 30 minutes'), {
    action: 'timebox',
    target: 'breadth',
    minutes: 30,
  });
  assert.deepEqual(parseStrategyChatCommand('roll back to previous strategy'), {
    action: 'rollback',
  });
  assert.equal(parseStrategyChatCommand('hello there'), null);
});

// --- 51365 timeline ---------------------------------------------------------------------

test('strategy timeline segments are color-coded with durations', () => {
  const segs = segmentStrategyTimeline([
    { strategy: 'X', focus: 'depth', from: NOW - 3_600_000, to: NOW },
  ]);
  assert.equal(segs[0].color, strategyColor('depth'));
  assert.equal(segs[0].durationMin, 60);
});

// --- 51366 reporting ----------------------------------------------------------------------

test('findings are attributed to strategies for reporting', () => {
  const attr = attributeFinding({}, 'F-1', 'Auth hammer');
  const lines = strategyReportLines([{ id: 'F-1', severity: 'high' }, { id: 'F-9' }], attr);
  assert.ok(lines[0].includes('Auth hammer'));
  assert.ok(lines[1].includes('not recorded'));
});

// --- 51367 marketplace ------------------------------------------------------------------------

test('marketplace preview and install', () => {
  assert.ok(MARKETPLACE_PRESETS.length >= 3);
  assert.equal(previewMarketplacePreset('auth-hammer').author, 'nullbyte');
  assert.equal(previewMarketplacePreset('nope'), null);
  const r1 = installMarketplacePreset([], 'wide-net');
  assert.ok(r1.ok && r1.installed.includes('wide-net'));
  const r2 = installMarketplacePreset(r1.installed, 'wide-net');
  assert.ok(!r2.ok);
});

// --- 51368 simulator ------------------------------------------------------------------------------

test('simulator projects from historical hunts', () => {
  const history = [
    { strategyFocus: 'depth', findings: 10, hours: 5, scopeAssets: 4 },
    { strategyFocus: 'depth', findings: 6, hours: 3, scopeAssets: 5 },
  ];
  const s = simulateStrategy(history, 'depth', 4);
  assert.ok(s.projectedFindings > 0);
  assert.equal(s.basis, '2 similar hunt(s)');
  assert.equal(simulateStrategy([], 'depth', 4).basis, 'no history');
});

// --- 51369 focus areas --------------------------------------------------------------------------------

test('focus areas reweight the allocation', () => {
  const before = BASE.allocation['auth-deep'];
  const w = applyFocusAreas(BASE, ['auth']);
  assert.ok(w.allocation['auth-deep'] > before);
  assert.equal(
    Object.values(w.allocation).reduce((s, v) => s + v, 0),
    100
  );
  assert.deepEqual(w.focusAreas, ['auth']);
  assert.deepEqual(applyFocusAreas(BASE, []).allocation, BASE.allocation);
});

// --- 51370 exclusions -------------------------------------------------------------------------------------

test('exclusions rule out phases with a warning when too few remain', () => {
  const r = excludeFromStrategy(BASE, ['exploit-chain']);
  assert.ok(!r.phasesRemaining.includes('exploit-chain'));
  assert.equal(r.warning, '');
  const r2 = excludeFromStrategy(BASE, [
    'recon',
    'surface-map',
    'tech-fingerprint',
    'auth-deep',
    'business-logic',
  ]);
  assert.ok(r2.warning.length > 0);
});

// --- 51371 timeboxing -----------------------------------------------------------------------------------------

test('timebox starts, reports remaining, and expires', () => {
  const tb = startTimebox('Auth hammer', 45, NOW);
  assert.ok(timeboxRemainingMs(tb, NOW) > 0);
  assert.ok(!timeboxExpired(tb, NOW));
  assert.ok(timeboxExpired(tb, NOW + 46 * 60_000));
});

// --- 51372 voting -------------------------------------------------------------------------------------------------

test('teammate voting reaches a verdict at quorum', () => {
  let v = startStrategyVote('switch to depth', ['a', 'b', 'c'], NOW);
  v = castStrategyVote(v, 'a', 'approve');
  v = castStrategyVote(v, 'b', 'approve');
  assert.equal(strategyVoteTally(v).result, 'approved');
  let v2 = startStrategyVote('x', ['a', 'b', 'c'], NOW);
  v2 = castStrategyVote(v2, 'a', 'approve');
  assert.equal(strategyVoteTally(v2).result, 'open', 'below quorum stays open');
});

// --- 51373 diff --------------------------------------------------------------------------------------------------------

test('diff view shows added/removed phases and weight deltas', () => {
  const d = diffStrategy(BASE, AGGRO);
  assert.ok(d.weightChanges.some(w => w.phase === 'auth-deep' && w.delta === 5));
  assert.ok(d.priorityChanges);
});

// --- 51374 retest ----------------------------------------------------------------------------------------------------------

test('retest preset is verify-first', () => {
  const p = retestModePreset();
  assert.equal(p.focus, 'retest');
  assert.ok(p.rules.includes('verify-fixes-first'));
});

// --- 51375 learning --------------------------------------------------------------------------------------------------------------

test('learning ranks strategies by past performance on similar targets', () => {
  const hunts = [
    { strategy: 'Auth hammer', targetType: 'saas', findings: 12, hours: 3, endedAt: NOW },
    { strategy: 'Wide net', targetType: 'saas', findings: 4, hours: 4, endedAt: NOW },
    { strategy: 'Auth hammer', targetType: 'fintech', findings: 20, hours: 1, endedAt: NOW },
  ];
  const l = learnStrategies(hunts, 'saas');
  assert.equal(l[0].strategy, 'Auth hammer');
  assert.equal(l[0].findingsPerHour, 4);
});

// --- 51376 quiet hours ---------------------------------------------------------------------------------------------------------------------

test('aggressive strategies downgrade during business hours', () => {
  const bizNoon = new Date(NOW).setHours(12, 0, 0, 0);
  const r = quietHoursDowngrade(AGGRO, bizNoon);
  assert.ok(r.downgraded);
  assert.equal(r.strategy.aggression, 'balanced');
  const night = new Date(NOW).setHours(23, 0, 0, 0);
  assert.ok(!quietHoursDowngrade(AGGRO, night).downgraded);
  assert.ok(!isBusinessHour(night));
});

// --- 51377 cost ----------------------------------------------------------------------------------------------------------------------------------

test('cost estimator projects requests, hours, spend', () => {
  const c = estimateStrategyCost(AGGRO, 4);
  assert.ok(c.requests > 1000);
  assert.ok(c.estSpend > 0);
  assert.equal(c.estHours, 4);
});

// --- 51378 approval ------------------------------------------------------------------------------------------------------------------------------------

test('approval flow moves pending to approved/denied', () => {
  const req = requestStrategyApproval({ to: 'X' }, 'two', NOW);
  assert.equal(pendingStrategyApprovals([req]).length, 1);
  const ok = decideStrategyApproval(req, true, 'one', NOW);
  assert.equal(ok.status, 'approved');
  assert.equal(pendingStrategyApprovals([ok]).length, 0);
});

// --- 51379 chaining ------------------------------------------------------------------------------------------------------------------------------------------

test('strategy chain advances in order', () => {
  const chain = chainStrategies(['A', 'B']);
  const s1 = advanceStrategyChain(chain);
  assert.equal(s1.next, 'A');
  assert.ok(!s1.done);
  const s2 = advanceStrategyChain(s1.chain);
  assert.equal(s2.next, 'B');
  assert.ok(s2.done);
});

// --- 51380 alerts ------------------------------------------------------------------------------------------------------------------------------------------------

test('performance alerts fire below threshold only', () => {
  assert.equal(checkStrategyPerformance(2.5, 2.4), null);
  const a = checkStrategyPerformance(2.5, 0.8);
  assert.ok(a && a.alert);
  assert.ok(a.shortfallPct > 50);
});

// --- 51381 personalization ---------------------------------------------------------------------------------------------------------------------------------------------

test('personalization adapts allocation to preferences', () => {
  const p = personalizeStrategy(BASE, {
    preferredPhases: ['auth-deep'],
    avoidPhases: ['recon'],
    defaultDepth: 90,
  });
  assert.ok(p.allocation['auth-deep'] > BASE.allocation['auth-deep']);
  assert.ok(p.allocation['recon'] < BASE.allocation['recon']);
  assert.ok(p.personalized);
});

// --- 51382 explainability ----------------------------------------------------------------------------------------------------------------------------------------------------

test('strategy fit explained with evidence', () => {
  const e = explainStrategyFit(AGGRO, [{ fact: 'JWT none-alg accepted', supports: 'depth' }]);
  assert.ok(e.headline.includes('Aggro'));
  assert.equal(e.evidence.length, 1);
});

// --- 51383 snapshots -------------------------------------------------------------------------------------------------------------------------------------------------------------

test('strategy snapshots pin strategy to a report', () => {
  const s = snapshotStrategy(AGGRO, 'r-7', NOW);
  assert.equal(s.reportId, 'r-7');
  assert.equal(s.strategyName, 'Aggro');
  assert.equal(s.allocation['auth-deep'], 25);
});

// --- 51384 migration -----------------------------------------------------------------------------------------------------------------------------------------------------------------

test('strategy migration validates the target hunt', () => {
  const ok = migrateStrategy(AGGRO, { id: 'h-1', status: 'done' }, { id: 'h-2', assets: ['a'] });
  assert.ok(ok.ok && ok.record.assets === 1);
  assert.ok(!migrateStrategy(AGGRO, { id: 'h-1' }, { id: 'h-2', assets: [] }).ok);
  assert.ok(
    !migrateStrategy(AGGRO, { id: 'h-1', status: 'archived' }, { id: 'h-2', assets: ['a'] }).ok
  );
});

// --- 51385 fairness ------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('fairness enforces minimum coverage per asset', () => {
  const r = ensureFairCoverage({ app: 90, docs: 2 }, ['app', 'docs'], 10);
  assert.ok(r.allocation.docs >= 10);
  assert.ok(r.adjusted);
});

// --- 51386 pause points ----------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('strategy changes wait for phase boundaries outside safe phases', () => {
  assert.equal(strategyChangeTiming('recon'), 'apply-now');
  assert.equal(strategyChangeTiming('business-logic'), 'wait-for-boundary');
});

// --- 51387 digest --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('notification digest batches recent updates', () => {
  const d = digestStrategyUpdates(
    [
      { kind: 'switch', at: NOW - 60_000 },
      { kind: 'old', at: NOW - 9_000_000 },
    ],
    NOW
  );
  assert.equal(d.count, 1);
  assert.ok(d.summary.includes('switch'));
});

// --- 51388 rollback window ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('rollback window is a 15-minute grace period', () => {
  assert.equal(ROLLBACK_WINDOW_MS, 15 * 60_000);
  assert.ok(rollbackWindowOpen({ at: NOW }, NOW));
  assert.ok(!rollbackWindowOpen({ at: NOW - 20 * 60_000 }, NOW));
  const u = undoStrategyChange({ previous: BASE, at: NOW }, NOW);
  assert.ok(u.ok && u.restored.name === 'Balanced');
  assert.ok(!undoStrategyChange({ previous: BASE, at: NOW - 20 * 60_000 }, NOW).ok);
});

// --- 51389 tags -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('segments can be tagged and filtered', () => {
  let t = tagStrategySegment({}, 'seg-1', 'won');
  t = tagStrategySegment(t, 'seg-1', 'won');
  assert.deepEqual(t['seg-1'], ['won'], 'no duplicate tags');
  assert.deepEqual(strategySegmentsByTag(t, 'won'), ['seg-1']);
});

// --- 51390 correlation --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('correlation groups findings by producing strategy', () => {
  const c = correlateStrategyFindings([{ id: 'F-1' }, { id: 'F-2' }], { 'F-1': 'A' });
  assert.equal(c.top.strategy, 'A');
  assert.deepEqual(c.byStrategy.unrecorded, ['F-2']);
});

// --- 51391 export -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('strategy journey exports as a markdown appendix', () => {
  const md = exportStrategyJourney(
    [{ strategy: 'Wide net', durationMin: 60 }],
    [{ strategy: 'Wide net', text: 'why' }]
  );
  assert.ok(md.includes('# Strategy journey'));
  assert.ok(md.includes('why'));
});

// --- 51392 voice -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('voice commands map to strategy actions', () => {
  assert.deepEqual(parseVoiceStrategyCommand('roll back the strategy'), {
    action: 'rollback',
    target: null,
  });
  assert.deepEqual(parseVoiceStrategyCommand('switch to depth mode'), {
    action: 'switch',
    target: 'depth',
  });
  assert.equal(parseVoiceStrategyCommand('play music'), null);
});

// --- 51393 mobile -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('mobile picker simplifies strategies to tap actions', () => {
  const items = mobileStrategyPicker([BASE]);
  assert.equal(items[0].tapAction, 'apply:Balanced');
});

// --- 51394 guardrails --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('guardrail presets block aggressive strategies on prod', () => {
  assert.ok(Object.keys(GUARDRAIL_PRESETS).length >= 3);
  const blocked = enforceGuardrailPreset(AGGRO, 'never-aggressive-on-prod', { env: 'prod' });
  assert.ok(!blocked.ok && blocked.violations.length > 0);
  const allowed = enforceGuardrailPreset(BASE, 'never-aggressive-on-prod', { env: 'prod' });
  assert.ok(allowed.ok);
  assert.ok(!enforceGuardrailPreset(BASE, 'nope', {}).ok);
});

// --- 51395 retrospectives --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('retrospective grades the hunt and writes lessons', () => {
  const r = buildRetrospective(
    [{ strategy: 'A', forecastFph: 3 }],
    [{ strategy: 'A', findingsPerHour: 4 }]
  );
  assert.equal(r.grade, 'strong');
  assert.ok(r.lessons[0].includes('beat'));
});

// --- 51396 recommendations --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('recommendation engine ranks past strategies deterministically', () => {
  const hunts = [
    {
      strategy: 'Auth hammer',
      targetType: 'saas',
      findings: 12,
      hours: 3,
      endedAt: NOW - 86_400_000,
    },
    { strategy: 'Wide net', targetType: 'saas', findings: 4, hours: 4, endedAt: NOW - 86_400_000 },
  ];
  const recs = recommendStrategies(hunts, { targetType: 'saas', now: NOW });
  assert.equal(recs.length, 2);
  assert.equal(recs[0].strategy, 'Auth hammer');
  assert.ok(recs[0].reason.length > 0);
  assert.deepEqual(
    recommendStrategies(hunts, { targetType: 'saas', now: NOW }),
    recs,
    'deterministic'
  );
});

// --- explainability 51397–51400 -----------------------------------------------------------------------------------------------------------------------

const SQLI = {
  id: 'F-101',
  type: 'sql-injection',
  severity: 'critical',
  title: 'SQL injection',
  location: '/api/search?q=',
};
const UNKNOWN = {
  id: 'F-900',
  type: 'zero-day-xyz',
  severity: 'medium',
  title: 'Unknown oddity',
  location: '/weird',
};

test('51397 explain-this-finding gives a plain-language explanation', () => {
  const e = explainFinding(SQLI);
  assert.ok(e.includes('/api/search?q='), 'mentions the location');
  assert.ok(e.includes('database'), 'explains in plain words');
  assert.ok(explainFinding(UNKNOWN).includes('/weird'), 'fallback still references the finding');
});

test('51398 ELI5 mode is non-technical', () => {
  const e = eli5Explanation(SQLI);
  assert.ok(e.toLowerCase().includes('librarian'), 'uses a real-world picture');
  assert.ok(eli5Explanation(UNKNOWN).includes('stranger'), 'fallback asks the right question');
});

test('51399 executive summary frames business impact', () => {
  const e = executiveSummary(SQLI);
  assert.ok(e.includes('Business impact'));
  assert.ok(e.includes('critical'));
});

test('51400 analogy generator returns a real-world analogy', () => {
  const a = findingAnalogy(SQLI);
  assert.ok(a.includes('bank teller'));
  assert.ok(findingAnalogy(UNKNOWN).length > 20, 'fallback analogy exists');
});

test('explainFindingAll bundles all four modes', () => {
  const all = explainFindingAll(SQLI);
  assert.ok(all.plain && all.eli5 && all.executive && all.analogy);
});

// --- no-debris + zero-animation audits ---------------------------------------

test('core files have no TODO/FIXME/mock debris', async () => {
  const { readFile } = await import('node:fs/promises');
  for (const f of ['./strategyRound3Core.js', './explainabilityCore.js']) {
    const src = await readFile(new URL(f, import.meta.url), 'utf8');
    assert.ok(!/\bTODO\b|\bFIXME\b/i.test(src), `no TODO/FIXME in ${f}`);
    assert.ok(!/\bsimulate\b/i.test(src), `no simulate debris in ${f}`);
  }
});

test('CSS carries zero keyframes per the zero-animation order', async () => {
  const { readFile } = await import('node:fs/promises');
  const css = await readFile(new URL('./Wave35.css', import.meta.url), 'utf8');
  assert.ok(!/@keyframes/i.test(css), 'zero keyframes');
  assert.ok(/\.st35-/.test(css) && /\.ex35-/.test(css), 'scoped prefixes present');
});

test('JSX files have no TODO/mock debris', async () => {
  const { readFile } = await import('node:fs/promises');
  for (const f of ['./StrategyRound3.jsx', './Explainability.jsx']) {
    const src = await readFile(new URL(f, import.meta.url), 'utf8');
    assert.ok(!/\bTODO\b|\bFIXME\b/i.test(src), `no TODO/FIXME in ${f}`);
    assert.ok(!/\bmock\b/i.test(src), `no mock debris in ${f}`);
  }
});
