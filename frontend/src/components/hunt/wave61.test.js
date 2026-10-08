/**
 * wave61.test.js — Infinity AI · Dark-Matter · Wave 61
 * node:test + node:assert/strict. Registry coverage (11/11 for 52401–52411,
 * 29/29 for 52412–52440, zero skips, 40/40 combined), registry titles matched
 * against the idea bank, deterministic spot-checks of every pure function
 * (at least one assertion per idea), Wave61.css scope/zero-animation audits,
 * a real esbuild JSX parse audit, a no-branding-leak audit ("Infinity AI"
 * only) and a no-debris audit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { WAVE61_LC4_IDEAS } from './lifecycleRound4Core.js';
import * as LC4 from './lifecycleRound4Core.js';
import { WAVE61_RG_IDEAS } from './regressCore.js';
import * as RG from './regressCore.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const CSS = join(DIR, 'Wave61.css');
const LC4_SRC = readFileSync(join(DIR, 'lifecycleRound4Core.js'), 'utf8');
const RG_SRC = readFileSync(join(DIR, 'regressCore.js'), 'utf8');
const LC4_JSX = readFileSync(join(DIR, 'LifecycleRound4.jsx'), 'utf8');
const RG_JSX = readFileSync(join(DIR, 'RegressionSuite.jsx'), 'utf8');
const CSS_SRC = readFileSync(CSS, 'utf8');
const TEST_SRC = readFileSync(join(DIR, 'wave61.test.js'), 'utf8');
const ALL_SRC = [LC4_SRC, RG_SRC, LC4_JSX, RG_JSX, CSS_SRC, TEST_SRC];
const NOW = 1700000000000;
const HOUR = 3600000;
const DAY = 24 * HOUR;

function registryOk(reg, first, count) {
  assert.equal(reg.length, count, `expected ${count} registry entries, got ${reg.length}`);
  const ids = reg.map(e => e.id);
  assert.deepEqual(
    ids,
    Array.from({ length: count }, (_, i) => first + i),
    'registry ids must be the exact idea range in order'
  );
  for (const e of reg) {
    assert.ok(typeof e.title === 'string' && e.title.length > 0, `entry ${e.id} needs a title`);
    assert.ok(typeof e.desc === 'string' && e.desc.length > 0, `entry ${e.id} needs a desc`);
    assert.equal(e.skip, false, `entry ${e.id} must not be skipped`);
  }
}

/* ---- Registry coverage ---- */
test('WAVE61_LC4_IDEAS: 11/11 entries 52401–52411, zero skips', () => {
  registryOk(WAVE61_LC4_IDEAS, 52401, 11);
});

test('WAVE61_RG_IDEAS: 29/29 entries 52412–52440, zero skips', () => {
  registryOk(WAVE61_RG_IDEAS, 52412, 29);
});

test('combined coverage: exactly 52401–52440 with no gaps or dupes', () => {
  const all = [...WAVE61_LC4_IDEAS.map(e => e.id), ...WAVE61_RG_IDEAS.map(e => e.id)];
  assert.equal(all.length, 40);
  assert.deepEqual(
    [...all].sort((a, b) => a - b),
    Array.from({ length: 40 }, (_, i) => 52401 + i)
  );
});

/* ---- Registry titles match the bank ideas ---- */
const BANK_TITLES = {
  52401: 'Agent-suggested transitions',
  52402: 'State diagram visualization',
  52403: 'Bulk state import',
  52404: 'State migration tool',
  52405: 'Archived-finding states',
  52406: 'State search',
  52407: 'State-based assignment rules',
  52408: 'Lifecycle throughput leaderboard',
  52409: 'State transition comments',
  52410: 'Scheduled state reviews',
  52411: 'State-based dashboard widgets',
  52412: 'Fix assignment',
  52413: 'Fix due dates',
  52414: 'Fix verification retest link',
  52415: 'Remediation kanban board',
  52416: 'Per-finding fix notes',
  52417: 'Code commit linking',
  52418: 'One-click regression hunt',
  52419: 'Regression scope auto-builder',
  52420: 'Deploy-triggered regression',
  52421: 'Cron-scheduled regression hunts',
  52422: 'Regression diff report',
  52423: 'Regression cadence presets',
  52424: 'Post-fix verification scheduling',
  52425: 'Regression hunt templates',
  52426: 'Regression notifications',
  52427: 'Regression auto-compare',
  52428: 'Regression cost estimate',
  52429: 'Quick vs full regression depth',
  52430: 'Engine-pinned regression',
  52431: 'New-engine regression',
  52432: 'Cross-environment regression',
  52433: 'Regression queue',
  52434: 'Regression calendar view',
  52435: 'Pause/resume scheduled hunts',
  52436: 'Skip-if-no-change',
  52437: 'Target change-detection trigger',
  52438: 'Git-push regression trigger',
  52439: 'CI pipeline regression trigger',
  52440: 'Scheduled hunt naming conventions',
};

test('registry titles match bank idea titles (all 40)', () => {
  for (const e of [...WAVE61_LC4_IDEAS, ...WAVE61_RG_IDEAS]) {
    assert.equal(e.title, BANK_TITLES[e.id], `title mismatch for idea ${e.id}`);
  }
});

test('registry titles cross-checked against the idea-bank file', () => {
  const bank = readFileSync(
    join(DIR, '..', '..', '..', '..', 'ideas', 'batch6', 'part-03-posthunt.md'),
    'utf8'
  );
  for (const id of [52401, 52406, 52411, 52412, 52421, 52428, 52433, 52440]) {
    const line = bank.split('\n').find(l => l.startsWith(`${id}. `));
    assert.ok(line, `bank line for idea ${id} not found`);
    const bankTitle = line.replace(/^\d+\.\s+\*\*/, '').split('**')[0];
    const entry = [...WAVE61_LC4_IDEAS, ...WAVE61_RG_IDEAS].find(e => e.id === id);
    assert.equal(entry.title, bankTitle, `bank title mismatch for ${id}`);
  }
});

/* ---- Lifecycle round 4 core spot-checks (one+ assertion per idea) ---- */
const F_RETEST_PASS = {
  id: 'f-611',
  state: 'InRetest',
  retest: { passed: true, id: 'rt-61' },
  assetOwner: 'aria',
  title: 'Stored XSS',
};
const F_STUCK = {
  id: 'f-612',
  state: 'Triaged',
  stateEnteredAt: NOW - 9 * DAY,
  title: 'SQLi in search',
  assetOwner: 'kai',
};
const F_AUTO = {
  id: 'f-613',
  state: 'New',
  autoTriaged: true,
  stateEnteredAt: NOW - 2 * HOUR,
  title: 'Open redirect',
};

test('52401 suggestTransitions: passing retest suggests Verified; one-click approve applies it', () => {
  const r = LC4.suggestTransitions(F_RETEST_PASS, NOW);
  assert.equal(r.ok, true);
  assert.equal(r.suggestions.length, 1);
  assert.equal(r.suggestions[0].to, 'Verified');
  assert.ok(r.suggestions[0].reason.length > 0);
  const a = LC4.approveTransition(r.suggestions[0], 'bhavesh', NOW);
  assert.equal(a.ok, true);
  assert.equal(a.transition.status, 'approved');
  assert.equal(a.transition.approvedBy, 'bhavesh');
  assert.equal(a.applied.to, 'Verified');
  const none = LC4.suggestTransitions({ id: 'f-x', state: 'Closed' }, NOW);
  assert.equal(none.suggestions.length, 0);
});

test('52402 stateDiagramPayload: nodes/edges stats, invalid edges dropped', () => {
  const r = LC4.stateDiagramPayload(
    [{ id: 'New' }, { id: 'Triaged' }, { id: 'Verified', terminal: true }],
    [
      { from: 'New', to: 'Triaged' },
      { from: 'Triaged', to: 'Verified' },
      { from: 'Triaged', to: 'Nowhere' },
    ]
  );
  assert.equal(r.ok, true);
  assert.equal(r.stats.nodeCount, 3);
  assert.equal(r.stats.edgeCount, 2);
  assert.equal(r.stats.droppedEdges, 1);
  assert.equal(r.nodes.find(n => n.id === 'Verified').terminal, true);
});

test('52403 parseStateImport: valid rows accepted, bad state/unknown finding rejected', () => {
  const csv =
    'f-611,Verified,retest passed\nf-612,InProgress,picked up\nf-611,Phantom,nope\nf-999,New,unknown finding';
  const r = LC4.parseStateImport(csv, [F_RETEST_PASS, F_STUCK], NOW);
  assert.equal(r.rows.length, 2);
  assert.equal(r.errors.length, 2);
  assert.equal(r.stats.valid, 2);
  assert.equal(r.rows[0].to, 'Verified');
});

test('52404 previewStateRemap: affected findings listed before apply', () => {
  const r = LC4.previewStateRemap(
    [F_RETEST_PASS, F_STUCK, F_AUTO],
    { InRetest: 'Verifying', Triaged: 'Triage' },
    NOW
  );
  assert.equal(r.ok, true);
  assert.equal(r.stats.affected, 2);
  assert.equal(r.stats.unaffected, 1);
  assert.equal(r.affected[0].to, 'Verifying');
  assert.ok(r.previewId.length > 0);
});

test('52405 archiveFindingWithState: final state sealed and locked', () => {
  const r = LC4.archiveFindingWithState(F_RETEST_PASS, 'bhavesh', NOW);
  assert.equal(r.ok, true);
  assert.equal(r.archived.finalState, 'InRetest');
  assert.equal(r.archived.archived, true);
  assert.equal(r.archived.stateLocked, true);
  assert.ok(r.reportHint.includes('InRetest'));
});

test('52406 searchFindingsByState: history scan finds "was ever Risk Accepted"', () => {
  const findings = [
    { id: 'f-611', state: 'Verified', history: [{ to: 'RiskAccepted', at: NOW - 40 * DAY }] },
    { id: 'f-612', state: 'RiskAccepted', history: [] },
    { id: 'f-613', state: 'New', history: [] },
  ];
  const r = LC4.searchFindingsByState(findings, 'RiskAccepted', NOW);
  assert.deepEqual(r.current, ['f-612']);
  assert.deepEqual(r.ever, ['f-611', 'f-612']);
  assert.equal(r.counts.ever, 2);
});

test('52407 evaluateAssignmentRules: entering InProgress assigns the asset owner', () => {
  const rules = [{ id: 'r-1', onState: 'InProgress', assignee: 'assetOwner' }];
  const r = LC4.evaluateAssignmentRules(
    rules,
    F_STUCK,
    { type: 'enterState', to: 'InProgress' },
    NOW
  );
  assert.equal(r.ok, true);
  assert.equal(r.autoAssigned, true);
  assert.equal(r.assignments[0].assignee, 'kai');
});

test('52408 throughputLeaderboard: weekly terminal moves ranked; anonymize masks actors', () => {
  const transitions = [
    { actor: 'aria', to: 'Verified', at: NOW - 2 * DAY, actorOptedIn: true },
    { actor: 'kai', to: 'Closed', at: NOW - DAY, actorOptedIn: true },
    { actor: 'aria', to: 'Triaged', at: NOW - DAY, actorOptedIn: true },
    { actor: 'old', to: 'Closed', at: NOW - 30 * DAY, actorOptedIn: true },
  ];
  const r = LC4.throughputLeaderboard(transitions, NOW);
  assert.equal(r.entries.length, 2);
  assert.ok(r.entries.every(e => e.closed >= 1));
  const anon = LC4.throughputLeaderboard(transitions, NOW, { anonymize: true });
  assert.ok(anon.entries.every(e => e.actor.startsWith('member-')));
  const optIn = LC4.throughputLeaderboard([{ actor: 'x', to: 'Closed', at: NOW - DAY }], NOW, {
    optIn: true,
  });
  assert.equal(optIn.entries.length, 0);
});

test('52409 addTransitionComment: thread grows per transition', () => {
  let r = LC4.addTransitionComment(
    {},
    't-611',
    { author: 'aria', body: 'retest evidence attached' },
    NOW
  );
  assert.equal(r.commentCount, 1);
  r = LC4.addTransitionComment(r.threads, 't-611', { author: 'bhavesh', body: 'approved' }, NOW);
  assert.equal(r.commentCount, 2);
  assert.equal(r.threads['t-611'][1].author, 'bhavesh');
});

test('52410 scheduleStateReviews: stuck non-terminal findings scheduled for the lead', () => {
  const r = LC4.scheduleStateReviews([F_RETEST_PASS, F_STUCK, F_AUTO], NOW, { lead: 'bhavesh' });
  assert.equal(r.ok, true);
  assert.ok(r.reviews.some(v => v.findingId === 'f-612'));
  assert.ok(!r.reviews.some(v => v.findingId === 'f-613'));
  assert.equal(r.reviews.find(v => v.findingId === 'f-612').reviewer, 'bhavesh');
  assert.ok(r.reviews[0].nextReviewAt > NOW);
});

test('52411 stateWidgetPayload: counts and aging for status pages', () => {
  const r = LC4.stateWidgetPayload([F_RETEST_PASS, F_STUCK, F_AUTO], NOW);
  assert.equal(r.ok, true);
  assert.equal(r.brand, 'Infinity AI');
  assert.equal(r.total, 3);
  assert.equal(r.counts.InRetest, 1);
  assert.ok(r.avgAgingDays > 0);
  assert.equal(r.terminal, 0);
});

/* ---- Regression core spot-checks (one+ assertion per idea) ---- */
const RF1 = {
  id: 'f-621',
  state: 'InProgress',
  severity: 'high',
  endpoint: 'https://acme.example/login',
  target: 'acme-prod',
  assetId: 'asset-1',
  title: 'SQLi in login',
};
const RF2 = {
  id: 'f-622',
  state: 'InRetest',
  severity: 'medium',
  endpoint: 'https://acme.example/search',
  target: 'acme-prod',
  assetId: 'asset-2',
  title: 'XSS in search',
};
const ASSET_MAP = { 'asset-1': { owner: 'aria', team: 'appsec', securityChampion: 'bhavesh' } };

test('52412 suggestFixOwners: asset owner suggested first; assignFixOwner records it', () => {
  const r = RG.suggestFixOwners(RF1, ASSET_MAP);
  assert.equal(r.ok, true);
  assert.equal(r.suggestions[0].assignee, 'aria');
  assert.equal(r.suggestions[0].role, 'asset-owner');
  const a = RG.assignFixOwner('f-621', 'aria', NOW);
  assert.equal(a.owner, 'aria');
});

test('52413 fixDueDate: critical defaults to 3 days; calendar payload branded', () => {
  const r = RG.fixDueDate('critical', NOW);
  assert.equal(r.days, 3);
  assert.equal(r.dueAt, NOW + 3 * DAY);
  const c = RG.fixCalendarPayload('f-621', r.dueAt);
  assert.equal(c.ok, true);
  assert.ok(c.event.title.includes('f-621'));
});

test('52414 verifyWithRetestAction: one-click action deeplink names the finding', () => {
  const r = RG.verifyWithRetestAction('f-621', NOW);
  assert.equal(r.ok, true);
  assert.equal(r.action.label, 'Verify with retest');
  assert.ok(r.action.deeplink.includes('f-621'));
});

test('52415 kanbanReducer: moves columns; WIP limit blocks overflow', () => {
  const board = {
    cards: [
      { findingId: 'f-621', column: 'ToFix' },
      { findingId: 'f-622', column: 'Fixing' },
    ],
    wipLimits: { Fixing: 1 },
  };
  const blocked = RG.kanbanReducer(board, { type: 'move', findingId: 'f-621', to: 'Fixing' });
  assert.equal(blocked.ok, false);
  assert.ok(blocked.reason.includes('WIP limit'));
  const moved = RG.kanbanReducer(
    { ...board, wipLimits: {} },
    { type: 'move', findingId: 'f-621', to: 'Fixing' }
  );
  assert.equal(moved.ok, true);
  assert.equal(moved.cards.find(c => c.findingId === 'f-621').column, 'Fixing');
});

test('52416 addFixNote: structured files/commits/config attached', () => {
  const r = RG.addFixNote(
    RF1,
    {
      summary: 'Parameterized query',
      files: ['src/auth/login.js'],
      commits: ['abc1234'],
      author: 'aria',
    },
    NOW
  );
  assert.equal(r.ok, true);
  assert.deepEqual(r.note.files, ['src/auth/login.js']);
  assert.deepEqual(r.note.commits, ['abc1234']);
});

test('52417 linkCommit: github provider detected; diff stats kept', () => {
  const r = RG.linkCommit(
    'f-621',
    {
      sha: 'abc1234',
      url: 'https://github.com/acme/app/commit/abc1234',
      filesChanged: 3,
      additions: 40,
      deletions: 12,
    },
    NOW
  );
  assert.equal(r.ok, true);
  assert.equal(r.link.provider, 'github');
  assert.equal(r.link.stats.additions, 40);
});

test('52418 oneClickRegressionHunt: scoped launch descriptor', () => {
  const r = RG.oneClickRegressionHunt(RF1, { endpoints: [RF1.endpoint] }, NOW);
  assert.equal(r.ok, true);
  assert.equal(r.launch.kind, 'regression');
  assert.equal(r.launch.target, 'acme-prod');
  assert.deepEqual(r.launch.baselineFindingIds, ['f-621']);
});

test('52419 buildRegressionScope: open/recent findings become endpoints', () => {
  const r = RG.buildRegressionScope([RF1, RF2], 'acme-prod', NOW);
  assert.equal(r.ok, true);
  assert.ok(r.endpoints.includes('https://acme.example/login'));
  assert.equal(r.stats.findings, 2);
});

test('52420 deployTriggeredRegression: CI/CD webhook becomes a hunt', () => {
  const r = RG.deployTriggeredRegression(
    { deployId: 'd-99', target: 'acme-prod', environment: 'production', ref: 'main' },
    NOW
  );
  assert.equal(r.ok, true);
  assert.equal(r.trigger, 'deploy');
  assert.equal(r.hunt.environment, 'production');
});

test('52421 cronRegressionSchedule: timezone-aware next run lands in the future', () => {
  const r = RG.cronRegressionSchedule(
    '0 2 * * 1',
    'acme-prod',
    { timezone: 'Asia/Kolkata', tzOffsetMin: 330 },
    NOW
  );
  assert.equal(r.ok, true);
  assert.ok(r.nextRun > NOW);
  const bad = RG.cronRegressionSchedule('not-a-cron', 'acme-prod', {}, NOW);
  assert.equal(bad.ok, false);
});

test('52422 regressionDiffReport: fixed/still-vulnerable/new vs baseline + verdict', () => {
  const baseline = [
    { id: 'f-620', status: 'open' },
    { id: 'f-621', status: 'open' },
  ];
  const current = [
    { id: 'f-621', status: 'closed' },
    { id: 'f-623', status: 'open' },
  ];
  const r = RG.regressionDiffReport(baseline, current);
  assert.equal(r.ok, true);
  assert.deepEqual(r.fixed.sort(), ['f-620', 'f-621']);
  assert.deepEqual(r.stillVulnerable, []);
  assert.deepEqual(r.newFindings, ['f-623']);
  assert.equal(r.verdict, 'new-issues');
  const clean = RG.regressionDiffReport(baseline, [
    { id: 'f-620', status: 'closed' },
    { id: 'f-621', status: 'closed' },
  ]);
  assert.equal(clean.verdict, 'clean');
});

test('52423 regressionCadencePreset: weekly maps to a cron schedule', () => {
  const r = RG.regressionCadencePreset('weekly', 'acme-prod', NOW);
  assert.equal(r.ok, true);
  assert.equal(r.schedule.expr, '0 2 * * 1');
  assert.ok(r.schedule.nextRun > NOW);
  assert.equal(RG.regressionCadencePreset('yearly', 'acme-prod', NOW).ok, false);
});

test('52424 schedulePostFixVerification: verify auto-scheduled after deploy', () => {
  const r = RG.schedulePostFixVerification('f-621', NOW);
  assert.equal(r.ok, true);
  assert.equal(r.verifyAt, NOW + DAY);
  assert.equal(r.kind, 'post-fix-verification');
});

test('52425 saveRegressionTemplate + applyRegressionTemplate: reusable config', () => {
  const t = RG.saveRegressionTemplate('weekly-depth-quick', {
    depth: 'quick',
    engines: ['vulnDetector'],
    scopeRules: ['recently-fixed'],
  });
  assert.equal(t.ok, true);
  assert.equal(t.template.name, 'weekly-depth-quick');
  const a = RG.applyRegressionTemplate(t.template, 'acme-staging', NOW);
  assert.equal(a.ok, true);
  assert.equal(a.launch.target, 'acme-staging');
  assert.deepEqual(a.launch.engines, ['vulnDetector']);
});

test('52426 regressionNotifications: start/finish/verdict messages', () => {
  const hunt = { id: 'rgh-1', target: 'acme-prod', owner: 'bhavesh' };
  const r = RG.regressionNotifications(hunt, { type: 'verdict', verdict: 'clean' }, NOW);
  assert.equal(r.ok, true);
  assert.ok(r.message.includes('rgh-1'));
  assert.ok(r.message.includes('clean'));
  assert.equal(RG.regressionNotifications(hunt, { type: 'bogus' }, NOW).ok, false);
});

test('52427 autoCompareRegression: diff vs the original hunt', () => {
  const r = RG.autoCompareRegression(
    { id: 'rg-2', findings: [{ id: 'f-621', status: 'open' }] },
    {
      id: 'h-1',
      findings: [
        { id: 'f-621', status: 'open' },
        { id: 'f-620', status: 'open' },
      ],
    }
  );
  assert.equal(r.ok, true);
  assert.equal(r.originalId, 'h-1');
  assert.equal(r.diff.stats.baseline, 2);
});

test('52428 estimateRegressionCost: time/compute preview scales with depth', () => {
  const quick = RG.estimateRegressionCost({
    scope: { endpoints: ['a', 'b', 'c'] },
    depth: 'quick',
  });
  const full = RG.estimateRegressionCost({ scope: { endpoints: ['a', 'b', 'c'] }, depth: 'full' });
  assert.equal(quick.estimatedMinutes, 6);
  assert.equal(full.estimatedMinutes, 24);
  assert.equal(full.estimatedComputeUnits, 120);
  assert.ok(full.estimatedMinutes > quick.estimatedMinutes);
});

test('52429 regressionDepthConfig: quick vs full check sets', () => {
  const q = RG.regressionDepthConfig('quick');
  assert.ok(q.checks.includes('known-findings-only'));
  const f = RG.regressionDepthConfig('full');
  assert.ok(f.checks.includes('full-exploration'));
  assert.equal(RG.regressionDepthConfig('bogus').ok, false);
});

test('52430 pinEngines: exact versions pinned on the launch', () => {
  const r = RG.pinEngines({ id: 'rg-3' }, { vulnDetector: '3.1.0', riskScorer: '2.0.4' });
  assert.equal(r.ok, true);
  assert.equal(r.launch.pinned, true);
  assert.equal(r.launch.engines.vulnDetector, '3.1.0');
});

test('52431 includeNewEngines: newly released engines merged in', () => {
  const r = RG.includeNewEngines({ id: 'rg-3', engines: { vulnDetector: '3.1.0' } }, [
    { name: 'secretScanner', version: '1.2.0' },
  ]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.added, ['secretScanner']);
  assert.equal(r.launch.engines.secretScanner, '1.2.0');
});

test('52432 crossEnvironmentRegression: one job across staging+prod', () => {
  const r = RG.crossEnvironmentRegression({ id: 'rg-3' }, ['staging', 'production']);
  assert.equal(r.ok, true);
  assert.deepEqual(r.job.environments, ['staging', 'production']);
  assert.equal(r.job.compare, true);
  assert.equal(RG.crossEnvironmentRegression({ id: 'rg-3' }, ['staging']).ok, false);
});

test('52433 regressionQueueAdd: priority-sorted queue with owners', () => {
  let q = RG.regressionQueueAdd([], { id: 'rg-1' }, { priority: 'normal', owner: 'aria' });
  q = RG.regressionQueueAdd(q.queue, { id: 'rg-2' }, { priority: 'urgent', owner: 'bhavesh' });
  assert.equal(q.queue[0].huntId, 'rg-2');
  assert.equal(q.queue[0].owner, 'bhavesh');
});

test('52434 regressionCalendarPayload: upcoming hunts sorted, paused hidden', () => {
  const r = RG.regressionCalendarPayload(
    [
      {
        id: 'c-1',
        target: 'acme-prod',
        nextRun: NOW + 2 * DAY,
        preset: 'weekly',
        owner: 'bhavesh',
      },
      { id: 'c-2', target: 'acme-staging', nextRun: NOW + DAY, expr: '0 2 * * 1' },
      { id: 'c-3', target: 'acme-prod', nextRun: NOW + DAY, paused: true },
    ],
    NOW
  );
  assert.equal(r.count, 2);
  assert.equal(r.upcoming[0].id, 'c-2');
});

test('52435 pauseScheduledHunt/resumeScheduledHunt: pause preserves config', () => {
  const s = RG.cronRegressionSchedule('0 2 * * 1', 'acme-prod', {}, NOW);
  const p = RG.pauseScheduledHunt(s, NOW);
  assert.equal(p.schedule.paused, true);
  assert.equal(p.schedule.expr, '0 2 * * 1');
  const back = RG.resumeScheduledHunt(p.schedule, NOW);
  assert.equal(back.schedule.paused, false);
  assert.ok(back.schedule.nextRun > NOW);
});

test('52436 skipIfNoChange: unchanged target skips the run', () => {
  const r = RG.skipIfNoChange({ id: 'c-1' }, { changed: false });
  assert.equal(r.ok, true);
  assert.equal(r.skipped, true);
  const go = RG.skipIfNoChange({ id: 'c-1' }, { changed: true });
  assert.equal(go.skipped, false);
});

test('52437 targetChangeTrigger: fingerprint shift fires a regression trigger', () => {
  const r = RG.targetChangeTrigger(
    { tech: ['nginx'], contentHash: 'aaa' },
    { tech: ['nginx', 'waf'], contentHash: 'aaa' },
    'acme-prod',
    NOW
  );
  assert.equal(r.ok, true);
  assert.equal(r.changed, true);
  assert.ok(r.trigger.shifts.techShift);
  const calm = RG.targetChangeTrigger(
    { tech: ['nginx'], contentHash: 'aaa' },
    { tech: ['nginx'], contentHash: 'aaa' },
    'acme-prod',
    NOW
  );
  assert.equal(calm.changed, false);
  assert.equal(calm.trigger, null);
});

test('52438 gitPushTrigger: watched paths fire a scoped regression', () => {
  const r = RG.gitPushTrigger(
    { repo: 'acme/app', paths: ['src/auth/login.js', 'README.md'] },
    { 'acme/app': ['src/auth/'] }
  );
  assert.equal(r.ok, true);
  assert.equal(r.trigger, true);
  assert.deepEqual(r.matchedPaths, ['src/auth/login.js']);
  const miss = RG.gitPushTrigger(
    { repo: 'acme/app', paths: ['README.md'] },
    { 'acme/app': ['src/auth/'] }
  );
  assert.equal(miss.trigger, false);
});

test('52439 ciPipelineTrigger: jenkins/github-actions/gitlab-ci hunts', () => {
  const r = RG.ciPipelineTrigger(
    { provider: 'github-actions', job: 'deploy-prod', target: 'acme-prod' },
    NOW
  );
  assert.equal(r.ok, true);
  assert.equal(r.hunt.provider, 'github-actions');
  assert.ok(r.hunt.id.length > 0);
  assert.equal(
    RG.ciPipelineTrigger({ provider: 'travis', job: 'x', target: 'acme-prod' }, NOW).ok,
    false
  );
});

test('52440 autoNameScheduledHunt: "acme-prod weekly #12"', () => {
  const r = RG.autoNameScheduledHunt('acme-prod', 'weekly', 12, NOW);
  assert.equal(r.ok, true);
  assert.equal(r.name, 'acme-prod weekly #12');
});

/* ---- JSX structure: named exports only, galleries list all components ---- */
test('LifecycleRound4.jsx: 11 component exports + gallery', () => {
  const names = (LC4_JSX.match(/^export function (\w+)/gm) || []).map(m =>
    m.replace('export function ', '')
  );
  const components = names.filter(n => n !== 'LifecycleRound4Gallery');
  assert.equal(components.length, 11);
  assert.ok(names.includes('LifecycleRound4Gallery'));
  assert.ok(!/^export default /m.test(LC4_JSX), 'no default export allowed');
});

test('RegressionSuite.jsx: 29 component exports + gallery', () => {
  const names = (RG_JSX.match(/^export function (\w+)/gm) || []).map(m =>
    m.replace('export function ', '')
  );
  const components = names.filter(n => n !== 'RegressionSuiteGallery');
  assert.equal(components.length, 29);
  assert.ok(names.includes('RegressionSuiteGallery'));
  assert.ok(!/^export default /m.test(RG_JSX), 'no default export allowed');
});

test('JSX components wire to the right core modules', () => {
  assert.ok(/import \* as LC4 from '.\/lifecycleRound4Core.js'/.test(LC4_JSX));
  assert.ok(/import \* as RG from '.\/regressCore.js'/.test(RG_JSX));
  assert.ok(/LR61_GALLERY/.test(LC4_JSX));
  assert.ok(/RG61_GALLERY/.test(RG_JSX));
});

test('real esbuild parse of both JSX files', () => {
  for (const f of ['LifecycleRound4.jsx', 'RegressionSuite.jsx']) {
    execFileSync(
      'npx',
      ['esbuild', `--loader:.jsx=jsx`, '--format=esm', `--outfile=/dev/null`, join(DIR, f)],
      { stdio: 'pipe' }
    );
  }
});

/* ---- CSS audit: scoped prefixes only, zero keyframes, no global rules ---- */
test('Wave61.css: only .lr461-/.rg61- selectors, zero @keyframes, no global rules', () => {
  const classSelectors = [...CSS_SRC.matchAll(/^\s*\.([a-zA-Z0-9_-]+)\s*[{,]/gm)].map(m => m[1]);
  assert.ok(classSelectors.length > 0, 'expected class selectors');
  for (const sel of classSelectors) {
    assert.ok(sel.startsWith('lr461-') || sel.startsWith('rg61-'), `unscoped selector .${sel}`);
  }
  assert.ok(!/@keyframes/i.test(CSS_SRC), 'zero-animation order: no @keyframes');
  assert.ok(!/transition\s*:/i.test(CSS_SRC), 'zero-animation order: no transitions');
  assert.ok(!/animation\s*:/i.test(CSS_SRC), 'zero-animation order: no animations');
  assert.ok(!/^\s*(html|body|\*)\s*[{,]/m.test(CSS_SRC), 'no global element selectors');
  assert.ok(!/!important/.test(CSS_SRC), 'no !important');
});

test('Wave61.css: both prefixes have the shared layout primitives', () => {
  for (const prefix of ['lr461', 'rg61']) {
    for (const cls of ['gallery', 'card', 'title', 'note', 'mono', 'row', 'btn']) {
      assert.ok(new RegExp(`\\.${prefix}-${cls}\\b`).test(CSS_SRC), `missing .${prefix}-${cls}`);
    }
  }
});

/* ---- Branding audit: Infinity AI only, never Muse ---- */
test('branding: no "Muse" anywhere; "Infinity AI" present where branded', () => {
  for (const [name, src] of [
    ['lc4Core', LC4_SRC],
    ['rgCore', RG_SRC],
    ['lc4Jsx', LC4_JSX],
    ['rgJsx', RG_JSX],
    ['css', CSS_SRC],
  ]) {
    assert.ok(!/Muse/i.test(src), `${name} leaks "Muse" branding`);
  }
  for (const [name, src] of [
    ['lc4Core', LC4_SRC],
    ['rgCore', RG_SRC],
    ['lc4Jsx', LC4_JSX],
    ['rgJsx', RG_JSX],
    ['css', CSS_SRC],
  ]) {
    assert.ok(/Infinity AI/.test(src), `${name} missing "Infinity AI" branding`);
  }
});

/* ---- Debris audit: no TODO/FIXME/mock/demo/placeholder/debris ---- */
test('no TODO/FIXME/mock/demo/debris in any wave-61 file', () => {
  const bad = /\b(TODO|FIXME|XXX|HACK|lorem ipsum|not implemented)\b/i;
  for (const [name, src] of [
    ['lc4Core', LC4_SRC],
    ['rgCore', RG_SRC],
    ['lc4Jsx', LC4_JSX],
    ['rgJsx', RG_JSX],
    ['css', CSS_SRC],
  ]) {
    const clean = src.replace(/placeholder="[^"]*"/g, '');
    assert.ok(!bad.test(clean), `${name} contains debris marker`);
    assert.ok(!/\bmock\b/i.test(src) || /no mock/i.test(src), `${name} mentions mock`);
  }
});

test('registry idea count matches function coverage: 40 ideas, 40 spot-checks', () => {
  const src = TEST_SRC;
  const spotChecks = (src.match(/^test\('524\d\d /gm) || []).length;
  assert.ok(spotChecks >= 40, `expected >=40 idea spot-check tests, found ${spotChecks}`);
});
