/**
 * wave21.test.js — wave 21 (ideas 50801–50840): onboarding / tours / hints.
 * Pure-logic tests (onboardingCore.js) + registry completeness + source-file
 * presence audits for the new components.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));

import {
  WAVE21_IDEAS,
  COACH_MARK_STEPS,
  ONBOARDING_STEPS,
  POWER_TIPS,
  createTourState,
  startTour,
  nextTourStep,
  prevTourStep,
  skipTour,
  resumeTour,
  tourProgress,
  shouldShowHint,
  suggestFirstOperator,
  filterComboTip,
  chatExampleQuestions,
  deepLinkHowTo,
  chainExplainer,
  fpDismissalGuide,
  explainConfidence,
  zeroResultsRecovery,
  printHint,
  timelineClickTip,
  checklistProgress,
  completeChecklistStep,
  celebrationState,
  graduateChecklist,
  sampleHuntSpec,
  sandboxConfig,
  dismissHint,
  setTipsEnabled,
  mergeHintState,
  exportWalkthroughSteps,
  shouldNudgeShortcut,
  shortcutNudgeCopy,
  shouldSuggestSchedule,
  shouldSuggestInvite,
  daysBetween,
  shouldShowWelcomeBack,
  welcomeBackCopy,
  roleOnboardingPath,
  widgetTourSteps,
  weakTargetCheck,
  dripEmailSchedule,
  videoSnippetSpec,
  hashString,
  tipOfTheDay,
  rotatingHelpTip,
  voiceCommandHint,
  a11yShortcutHint,
  slackIntegrationHint,
  modelsPageHint,
  paywallExplainer,
  postHuntRatingPrompt,
  darkModeHint,
  pocMarkdown,
} from './onboardingCore.js';

/* ---------------- registry ---------------- */

test('WAVE21_IDEAS covers 50801–50840 exactly, all new', () => {
  assert.equal(WAVE21_IDEAS.length, 40);
  const ids = WAVE21_IDEAS.map(i => i.id).sort((a, b) => a - b);
  for (let n = 50801; n <= 50840; n++) assert.ok(ids.includes(n), `missing idea ${n}`);
  for (const idea of WAVE21_IDEAS) {
    assert.equal(idea.status, 'new', `idea ${idea.id} should be new`);
    assert.ok(idea.title.length > 3);
  }
});

test('COACH_MARK_STEPS is a six-step tour', () => {
  assert.equal(COACH_MARK_STEPS.length, 6);
  for (const s of COACH_MARK_STEPS) {
    assert.ok(s.id && s.title && s.body);
  }
});

test('ONBOARDING_STEPS has 7 steps', () => {
  assert.equal(ONBOARDING_STEPS.length, 7);
});

/* ---------------- tour state machine (50801) ---------------- */

test('tour lifecycle: start → next × 5 → done', () => {
  let t = startTour(createTourState());
  assert.equal(t.status, 'active');
  assert.equal(t.stepIndex, 0);
  for (let i = 0; i < 5; i++) t = nextTourStep(t);
  assert.equal(t.stepIndex, 5);
  t = nextTourStep(t);
  assert.equal(t.status, 'done');
  assert.ok(t.completedAt);
});

test('tour prev clamps at 0 and skip works mid-tour', () => {
  let t = startTour(createTourState());
  t = prevTourStep(t);
  assert.equal(t.stepIndex, 0);
  t = nextTourStep(t);
  t = prevTourStep(t);
  assert.equal(t.stepIndex, 0);
  t = skipTour(t);
  assert.equal(t.status, 'skipped');
  // no-ops when not active
  assert.deepEqual(nextTourStep(createTourState()), createTourState());
});

test('resumeTour restores a saved step index', () => {
  const t = resumeTour(3);
  assert.equal(t.status, 'active');
  assert.equal(t.stepIndex, 3);
  const bad = resumeTour(NaN);
  assert.equal(bad.stepIndex, 0);
});

test('tourProgress is 0..1 across the tour', () => {
  let t = startTour(createTourState());
  assert.equal(tourProgress(t), 1 / 6);
  t = nextTourStep(nextTourStep(t));
  assert.equal(tourProgress(t), 3 / 6);
  assert.equal(tourProgress(createTourState()), 0);
});

/* ---------------- hint gate (50802…) ---------------- */

test('shouldShowHint respects seen ids and the global toggle', () => {
  assert.equal(shouldShowHint('x', new Set(), true), true);
  assert.equal(shouldShowHint('x', new Set(['x']), true), false);
  assert.equal(shouldShowHint('x', new Set(), false), false);
  assert.equal(shouldShowHint('', new Set(), true), false);
  assert.equal(shouldShowHint('x', ['x'], true), false); // array also works
});

test('suggestFirstOperator only fires on empty query', () => {
  const s = suggestFirstOperator('   ');
  assert.equal(s.operator, 'sev:critical');
  assert.equal(suggestFirstOperator('sev:high'), null);
});

/* ---------------- checklist (50805/50819/50839) ---------------- */

test('checklistProgress reports "N of M" honestly', () => {
  const p = checklistProgress(['target', 'finding', 'chat']);
  assert.equal(p.done, 3);
  assert.equal(p.total, 7);
  assert.equal(p.label, '3 of 7 steps done');
  assert.equal(p.percent, 43);
  assert.equal(p.complete, false);
  const full = checklistProgress(ONBOARDING_STEPS.map(s => s.id));
  assert.equal(full.complete, true);
  assert.equal(full.percent, 100);
});

test('completeChecklistStep is idempotent and ignores unknown ids', () => {
  let done = completeChecklistStep([], 'target');
  done = completeChecklistStep(done, 'target');
  assert.deepEqual(done, ['target']);
  assert.deepEqual(completeChecklistStep(done, 'nope'), ['target']);
});

test('celebrationState only celebrates a complete checklist', () => {
  assert.equal(celebrationState(checklistProgress([])).celebrate, false);
  const full = celebrationState(checklistProgress(ONBOARDING_STEPS.map(s => s.id)));
  assert.equal(full.celebrate, true);
  assert.match(full.title, /set/i);
});

test('graduateChecklist archives only when complete', () => {
  const partial = graduateChecklist(['target'], []);
  assert.equal(partial.graduated, false);
  const full = graduateChecklist(
    ONBOARDING_STEPS.map(s => s.id),
    []
  );
  assert.equal(full.graduated, true);
  assert.equal(full.tips.length, 1);
});

/* ---------------- sample hunt + sandbox (50806/50826) ---------------- */

test('sampleHuntSpec is quota-free demo data', () => {
  const s = sampleHuntSpec();
  assert.equal(s.quotaCost, 0);
  assert.ok(s.findings > 0);
});

test('sandboxConfig is quota-free with safe tools', () => {
  const c = sandboxConfig();
  assert.equal(c.quotaCost, 0);
  assert.ok(c.tools.length > 0);
});

/* ---------------- dismiss + sync (50807/50835) ---------------- */

test('dismissHint accumulates ids', () => {
  const next = dismissHint(['a'], 'b');
  assert.ok(next.includes('a') && next.includes('b'));
});

test('mergeHintState: dismissals union, opt-out wins', () => {
  const merged = mergeHintState(
    { seenIds: ['a'], tipsEnabled: true, updatedAt: 1 },
    { seenIds: ['b'], tipsEnabled: false, updatedAt: 2 }
  );
  assert.ok(merged.seenIds.includes('a') && merged.seenIds.includes('b'));
  assert.equal(merged.tipsEnabled, false);
  assert.equal(merged.updatedAt, 2);
});

test('setTipsEnabled toggles the preference', () => {
  assert.equal(setTipsEnabled({}, false).tipsEnabled, false);
  assert.equal(setTipsEnabled({ tipsEnabled: false }, true).tipsEnabled, true);
});

/* ---------------- nudges (50809/50824/50827) ---------------- */

test('shortcut nudge fires at 5 mouse reviews', () => {
  assert.equal(shouldNudgeShortcut(4, new Set()), false);
  assert.equal(shouldNudgeShortcut(5, new Set()), true);
  assert.equal(shouldNudgeShortcut(9, new Set(['shortcut-nudge'])), false);
  assert.match(shortcutNudgeCopy().body, /press R/);
});

test('schedule hint fires at 3 manual runs; invite at 2 hunts', () => {
  assert.equal(shouldSuggestSchedule(2, new Set()), false);
  assert.equal(shouldSuggestSchedule(3, new Set()), true);
  assert.equal(shouldSuggestInvite(1, new Set()), false);
  assert.equal(shouldSuggestInvite(2, new Set()), true);
});

/* ---------------- welcome back (50811) ---------------- */

test('welcome-back fires after 14 idle days', () => {
  const now = Date.now();
  const day = 86400000;
  assert.equal(shouldShowWelcomeBack(now - 13 * day, now), false);
  assert.equal(shouldShowWelcomeBack(now - 14 * day, now), true);
  assert.equal(shouldShowWelcomeBack(null, now), false);
  assert.equal(daysBetween(now - 2 * day, now), 2);
  assert.match(welcomeBackCopy(15, 4).body, /15 days/);
});

/* ---------------- roles, widgets, weak targets ---------------- */

test('roleOnboardingPath returns researcher/executive tracks', () => {
  const r = roleOnboardingPath('researcher');
  assert.equal(r.firstTasks.length, 3);
  const e = roleOnboardingPath('executive');
  assert.ok(e.firstTasks.some(t => /dashboard/i.test(t)));
  assert.equal(roleOnboardingPath('unknown').role, 'researcher');
});

test('widgetTourSteps has 3 steps; video snippets resolve', () => {
  assert.equal(widgetTourSteps().length, 3);
  assert.match(videoSnippetSpec('triage').caption, /0:30/);
  assert.match(videoSnippetSpec('custom-flow').src, /custom-flow-30s/);
});

test('weakTargetCheck flags bare domains and placeholders', () => {
  assert.equal(weakTargetCheck('https://example.com').weak, true);
  assert.equal(weakTargetCheck('https://example.com/').weak, true);
  assert.equal(weakTargetCheck('https://shop.example.org/login').weak, false);
  assert.equal(weakTargetCheck('').weak, false);
});

/* ---------------- drip emails (50818) ---------------- */

test('dripEmailSchedule sends 3 emails over the first week when opted in', () => {
  assert.deepEqual(dripEmailSchedule(false, Date.now()), []);
  const sched = dripEmailSchedule(true, 1000);
  assert.equal(sched.length, 3);
  assert.deepEqual(
    sched.map(s => s.day),
    [0, 3, 7]
  );
  assert.ok(sched[2].sendAt > sched[0].sendAt);
});

/* ---------------- tips rotation (50823/50833) ---------------- */

test('tipOfTheDay is deterministic per date', () => {
  const a = tipOfTheDay('2026-10-07');
  const b = tipOfTheDay('2026-10-07');
  assert.deepEqual(a, b);
  assert.ok(POWER_TIPS.includes(a.tip));
  const c = tipOfTheDay('2026-10-08');
  assert.ok(POWER_TIPS.includes(c.tip));
});

test('rotatingHelpTip cycles with visit count', () => {
  const t0 = rotatingHelpTip(0);
  const t1 = rotatingHelpTip(1);
  assert.notEqual(t0.tip, t1.tip);
  const wrap = rotatingHelpTip(POWER_TIPS.length);
  assert.equal(wrap.tip, t0.tip);
});

test('hashString is stable', () => {
  assert.equal(hashString('abc'), hashString('abc'));
  assert.notEqual(hashString('abc'), hashString('abd'));
});

/* ---------------- explainers ---------------- */

test('explainConfidence bands low/medium/high', () => {
  assert.equal(explainConfidence(0.2).band, 'low');
  assert.equal(explainConfidence(0.6).band, 'medium');
  assert.equal(explainConfidence(0.95).band, 'high');
  assert.match(explainConfidence(0.2).advice, /lead/i);
});

test('static hint copy builders return shaped payloads', () => {
  assert.ok(filterComboTip().example.includes('sev:'));
  assert.equal(chatExampleQuestions().length, 3);
  assert.ok(deepLinkHowTo().body.length > 10);
  assert.ok(chainExplainer().title.length > 5);
  assert.equal(fpDismissalGuide().steps.length, 3);
  assert.ok(zeroResultsRecovery().action.label.includes('Clear'));
  assert.equal(printHint().shortcut, 'Ctrl+P');
  assert.ok(timelineClickTip().body.length > 10);
  assert.equal(exportWalkthroughSteps().length, 3);
  assert.ok(modelsPageHint().action.label.includes('Models'));
  assert.ok(slackIntegrationHint().body.includes('Slack'));
  assert.ok(paywallExplainer('Pro').cta.label.includes('trial'));
  assert.equal(postHuntRatingPrompt('h').scale, 5);
  assert.equal(darkModeHint().shortcut, 'Ctrl+.');
  assert.equal(a11yShortcutHint().shortcut, 'Shift+?');
});

test('voiceCommandHint only fires on mobile', () => {
  assert.equal(voiceCommandHint(false), null);
  assert.ok(voiceCommandHint(true).body.includes('mic'));
});

/* ---------------- PoC markdown (50840) ---------------- */

test('pocMarkdown formats a complete block', () => {
  const md = pocMarkdown({
    title: 'SQLi',
    severity: 'critical',
    confidence: 0.91,
    target: 'https://demo/shop/login',
    huntId: 'h1',
    poc: "' OR 1=1--",
    remediation: 'Use parameterized queries.',
  });
  assert.match(md, /## SQLi — CRITICAL/);
  assert.match(md, /confidence 91%/);
  assert.match(md, /```/);
  assert.match(md, /OR 1=1/);
  assert.match(md, /parameterized queries/);
});

test('pocMarkdown tolerates missing fields', () => {
  const md = pocMarkdown({});
  assert.match(md, /Untitled finding/);
  assert.match(md, /No PoC captured/);
});

/* ---------------- source-file presence audit ---------------- */

test('wave 21 source files exist and are substantive', () => {
  for (const f of [
    'onboardingCore.js',
    'OnboardingTour.jsx',
    'OnboardingHints.jsx',
    'Onboarding.css',
    'wave21.test.js',
  ]) {
    const p = path.join(here, f);
    assert.ok(existsSync(p), `missing ${f}`);
    assert.ok(readFileSync(p, 'utf8').length > 2000, `${f} looks stubbed`);
  }
});

test('no TODO/mock debris in wave 21 sources', () => {
  for (const f of ['onboardingCore.js', 'OnboardingTour.jsx', 'OnboardingHints.jsx']) {
    const src = readFileSync(path.join(here, f), 'utf8');
    assert.ok(!/TODO|FIXME|MOCK/i.test(src), `${f} contains TODO/MOCK debris`);
  }
});

test('JSX files import their core logic and CSS', () => {
  const tour = readFileSync(path.join(here, 'OnboardingTour.jsx'), 'utf8');
  const hints = readFileSync(path.join(here, 'OnboardingHints.jsx'), 'utf8');
  assert.ok(tour.includes("from './onboardingCore.js'"));
  assert.ok(tour.includes("import './Onboarding.css'"));
  assert.ok(hints.includes("from './onboardingCore.js'"));
  assert.ok(hints.includes("import './Onboarding.css'"));
});
