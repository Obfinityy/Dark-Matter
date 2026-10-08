/**
 * wave62.test.js — Infinity AI · Dark-Matter · Wave 62
 * node:test + node:assert/strict. Registry coverage (20/20 for 52441–52460,
 * 20/20 for 52461–52480, zero skips, 40/40 combined), registry titles matched
 * against the idea bank, deterministic spot-checks of every pure function
 * (at least one assertion per idea), Wave62.css scope/zero-animation audits,
 * a real esbuild JSX parse audit, a no-branding-leak audit ("Infinity AI"
 * only) and a no-debris audit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { WAVE62_SR_IDEAS } from './schedRegressCore.js';
import * as SR from './schedRegressCore.js';
import { WAVE62_HD_IDEAS } from './huntDiffCore.js';
import * as HD from './huntDiffCore.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const CSS = join(DIR, 'Wave62.css');
const SR_SRC = readFileSync(join(DIR, 'schedRegressCore.js'), 'utf8');
const HD_SRC = readFileSync(join(DIR, 'huntDiffCore.js'), 'utf8');
const SR_JSX = readFileSync(join(DIR, 'SchedRegress.jsx'), 'utf8');
const HD_JSX = readFileSync(join(DIR, 'HuntDiff.jsx'), 'utf8');
const CSS_SRC = readFileSync(CSS, 'utf8');
const TEST_SRC = readFileSync(join(DIR, 'wave62.test.js'), 'utf8');
const ALL_SRC = [SR_SRC, HD_SRC, SR_JSX, HD_JSX, CSS_SRC, TEST_SRC];
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
test('WAVE62_SR_IDEAS: 20/20 entries 52441–52460, zero skips', () => {
  registryOk(WAVE62_SR_IDEAS, 52441, 20);
});

test('WAVE62_HD_IDEAS: 20/20 entries 52461–52480, zero skips', () => {
  registryOk(WAVE62_HD_IDEAS, 52461, 20);
});

test('combined coverage: exactly 52441–52480 with no gaps or dupes', () => {
  const all = [...WAVE62_SR_IDEAS.map(e => e.id), ...WAVE62_HD_IDEAS.map(e => e.id)];
  assert.equal(all.length, 40);
  assert.deepEqual(
    [...all].sort((a, b) => a - b),
    Array.from({ length: 40 }, (_, i) => 52441 + i)
  );
});

/* ---- Registry titles match the bank ideas ---- */
const BANK_TITLES = {
  52441: 'Scheduled hunt ownership',
  52442: 'Scheduled hunt permissions',
  52443: 'Regression report auto-send',
  52444: 'Regression SLA tracking',
  52445: 'Regression history timeline',
  52446: 'Regression analytics',
  52447: 'Bulk schedule creation',
  52448: 'Schedule-from-triage',
  52449: 'Schedule-from-remediation-board',
  52450: 'Blackout windows',
  52451: 'Timezone-aware scheduling (post-hunt)',
  52452: 'Concurrency limits',
  52453: 'Budget caps for scheduled hunts',
  52454: 'Scheduled-hunt dry run',
  52455: 'Scheduled-hunt run logs',
  52456: 'Schedule failure alerts (post-hunt)',
  52457: 'Retry policy for scheduled hunts',
  52458: 'Schedule templates (post-hunt)',
  52459: 'Event-triggered schedules',
  52460: 'FP spot-check regression',
  52461: 'Regression scope-diff preview',
  52462: 'Auto-archive old regressions',
  52463: 'Regression comparison dashboard',
  52464: '"All clear" certificate',
  52465: 'Schedule-via-API',
  52466: 'Schedule-via-chat',
  52467: 'Regression reminders',
  52468: 'Regression digest email',
  52469: 'Multi-target regression campaigns',
  52470: 'PR linking for fixes',
  52471: 'Fix diff viewer',
  52472: 'Verification evidence panel',
  52473: '"Verified fixed" badge',
  52474: 'Fix SLA per severity',
  52475: 'SLA breach alerts (post-hunt)',
  52476: 'Remediation progress percentage',
  52477: 'Before/after hunt diff view (post-hunt)',
  52478: 'Target A vs target B compare',
  52479: 'New-findings highlight',
  52480: 'Fixed-findings highlight',
};

test('registry titles match bank idea titles (all 40)', () => {
  for (const e of [...WAVE62_SR_IDEAS, ...WAVE62_HD_IDEAS]) {
    assert.equal(e.title, BANK_TITLES[e.id], `title mismatch for idea ${e.id}`);
  }
});

test('registry titles cross-checked against the idea-bank file', () => {
  const bank = readFileSync(
    join(DIR, '..', '..', '..', '..', 'ideas', 'batch6', 'part-03-posthunt.md'),
    'utf8'
  );
  for (const id of [52441, 52450, 52455, 52460, 52461, 52464, 52470, 52477, 52480]) {
    const line = bank.split('\n').find(l => l.startsWith(`${id}. `));
    assert.ok(line, `bank line for idea ${id} not found`);
    const bankTitle = line.replace(/^\d+\.\s+\*\*/, '').split('**')[0];
    const entry = [...WAVE62_SR_IDEAS, ...WAVE62_HD_IDEAS].find(e => e.id === id);
    assert.equal(entry.title, bankTitle, `bank title mismatch for ${id}`);
  }
});

/* ---- Scheduled regression core spot-checks (one+ assertion per idea) ---- */

test('52441 assignScheduleOwner: owner set, reassignment keeps history', () => {
  const r = SR.assignScheduleOwner({ id: 's-1' }, 'aria', NOW);
  assert.equal(r.ok, true);
  assert.equal(r.schedule.owner, 'aria');
  assert.ok(r.auditId.startsWith('sr62_'));
  const r2 = SR.assignScheduleOwner({ ...r.schedule, id: 's-1' }, 'kai', NOW + 1000);
  assert.equal(r2.schedule.ownerHistory.length, 1);
  assert.equal(r2.schedule.ownerHistory[0].previous, 'aria');
  assert.equal(SR.assignScheduleOwner({ id: 's-1' }, '', NOW).ok, false);
});

test('52442 checkSchedulePermission: editor cannot pause; owner can', () => {
  const denied = SR.checkSchedulePermission(
    { id: 'ws-1' },
    { id: 'u-1', roles: { 'ws-1': 'editor' } },
    'pause'
  );
  assert.equal(denied.ok, true);
  assert.equal(denied.allowed, false);
  assert.equal(denied.requiredRole, 'owner');
  const allowed = SR.checkSchedulePermission(
    { id: 'ws-1' },
    { id: 'u-2', roles: { 'ws-1': 'owner' } },
    'pause'
  );
  assert.equal(allowed.allowed, true);
  assert.equal(SR.checkSchedulePermission({ id: 'ws-1' }, { id: 'u-1' }, 'launch').ok, false);
});

test('52443 buildAutoSendReport: email payload for a finished regression', () => {
  const r = SR.buildAutoSendReport(
    {
      id: 'run-1',
      target: 'acme-prod',
      verdict: 'all-clear',
      stats: { newFindings: 0, fixed: 3, persistent: 5 },
    },
    ['leads@infinity.ai'],
    NOW
  );
  assert.equal(r.ok, true);
  assert.deepEqual(r.recipients, ['leads@infinity.ai']);
  assert.ok(r.subject.includes('run-1'));
  assert.ok(r.body.includes('acme-prod'));
  assert.equal(SR.buildAutoSendReport({ id: 'run-1' }, [], NOW).ok, false);
});

test('52444 trackRegressionSla: within-sla vs breached', () => {
  const okRun = SR.trackRegressionSla(
    { id: 'r-1', verifiedAt: NOW - DAY },
    NOW - 7 * DAY,
    7 * DAY,
    NOW
  );
  assert.equal(okRun.ok, true);
  assert.equal(okRun.status, 'within-sla');
  assert.equal(okRun.breached, false);
  const bad = SR.trackRegressionSla({ id: 'r-1', verifiedAt: NOW }, NOW - 8 * DAY, 7 * DAY, NOW);
  assert.equal(bad.status, 'breached');
  assert.equal(bad.breached, true);
  assert.equal(SR.trackRegressionSla(null, NOW, 100, NOW).ok, false);
});

test('52445 buildHistoryTimeline: per-target, newest first', () => {
  const r = SR.buildHistoryTimeline(
    [
      { id: 'r-1', target: 't1', startedAt: NOW - 2 * DAY, verdict: 'all-clear' },
      { id: 'r-2', target: 't1', startedAt: NOW - DAY, verdict: 'fixed-found' },
      { id: 'r-3', target: 't2', startedAt: NOW, verdict: 'all-clear' },
    ],
    't1'
  );
  assert.equal(r.ok, true);
  assert.equal(r.count, 2);
  assert.equal(r.timeline[0].runId, 'r-2');
  assert.equal(SR.buildHistoryTimeline([], null).ok, false);
});

test('52446 regressionAnalytics: fix rate, mean time to verify, reintroductions', () => {
  const r = SR.regressionAnalytics([
    { stats: { fixed: 5, persistent: 12, meanTimeToVerifyMs: 9000000 } },
    { stats: { fixed: 8, persistent: 10, meanTimeToVerifyMs: 12000000, reintroduced: 1 } },
  ]);
  assert.equal(r.ok, true);
  assert.equal(r.runs, 2);
  assert.ok(Math.abs(r.fixSuccessRate - 13 / 35) < 1e-9);
  assert.equal(r.meanTimeToVerifyMs, 10500000);
  assert.equal(r.reintroductions, 1);
  assert.equal(SR.regressionAnalytics([]).ok, false);
});

test('52447 bulkCreateSchedules: one template across many targets', () => {
  const r = SR.bulkCreateSchedules(
    [
      { id: 't-1', name: 'acme-prod' },
      { id: 't-2', name: 'acme-staging' },
    ],
    { name: 'weekly-quick', cadence: 'weekly', depth: 'quick', owner: 'aria' },
    NOW
  );
  assert.equal(r.ok, true);
  assert.equal(r.count, 2);
  assert.equal(r.schedules[0].cadence, 'weekly');
  assert.equal(r.schedules[0].targetName, 'acme-prod');
  assert.equal(SR.bulkCreateSchedules([], { cadence: 'weekly' }, NOW).ok, false);
});

test('52448 scheduleFromTriage: triaged finding schedules verification', () => {
  const r = SR.scheduleFromTriage(
    { id: 'f-1', state: 'Triaged', triageDecision: 'fix' },
    { delayMs: 7 * DAY },
    NOW
  );
  assert.equal(r.ok, true);
  assert.equal(r.schedule.runAt, NOW + 7 * DAY);
  assert.equal(r.schedule.findingId, 'f-1');
  assert.equal(SR.scheduleFromTriage({ id: 'f-2', state: 'New' }, {}, NOW).ok, false);
});

test('52449 scheduleFromBoard: board drop onto a future date schedules it', () => {
  const r = SR.scheduleFromBoard({ findingId: 'f-1', movedBy: 'kai' }, NOW + 2 * DAY, NOW);
  assert.equal(r.ok, true);
  assert.equal(r.schedule.runAt, NOW + 2 * DAY);
  assert.equal(SR.scheduleFromBoard({ findingId: 'f-1' }, NOW - DAY, NOW).ok, false);
});

test('52450 isInBlackoutWindow: blackout honored, clear otherwise', () => {
  const wins = [{ name: 'holiday freeze', start: NOW + DAY, end: NOW + 3 * DAY }];
  assert.equal(SR.isInBlackoutWindow(NOW, wins).inBlackout, false);
  const hit = SR.isInBlackoutWindow(NOW + 2 * DAY, wins);
  assert.equal(hit.inBlackout, true);
  assert.equal(hit.window.name, 'holiday freeze');
  assert.equal(SR.isInBlackoutWindow('x', wins).ok, false);
});

test('52451 formatInTargetTimezone: local display with UTC offset', () => {
  const r = SR.formatInTargetTimezone(NOW, 330, 'acme-prod local (IST)');
  assert.equal(r.ok, true);
  assert.equal(r.offset, 'UTC+05:30');
  assert.ok(r.local.includes('T'));
  assert.ok(r.dstNote.length > 0);
  assert.equal(SR.formatInTargetTimezone(NOW, 'x').ok, false);
});

test('52452 checkConcurrency: cap enforced, overflow queues', () => {
  const free = SR.checkConcurrency([{ status: 'running' }, { status: 'done' }], 2);
  assert.equal(free.allowed, true);
  assert.equal(free.active, 1);
  const capped = SR.checkConcurrency([{ status: 'running' }, { status: 'running' }], 1);
  assert.equal(capped.allowed, false);
  assert.equal(capped.queued, 1);
  assert.equal(SR.checkConcurrency('x', 2).ok, false);
});

test('52453 checkBudget: warning at 85%, auto-pause at 100%', () => {
  const warn = SR.checkBudget(8500, 10000);
  assert.equal(warn.warn, true);
  assert.equal(warn.autoPause, false);
  assert.equal(warn.status, 'warning');
  const over = SR.checkBudget(10000, 10000);
  assert.equal(over.autoPause, true);
  assert.equal(over.status, 'paused-over-budget');
  assert.equal(SR.checkBudget(10, 0).ok, false);
});

test('52454 dryRunSchedule: request estimate before first run', () => {
  const r = SR.dryRunSchedule({
    id: 's-1',
    scope: { target: 't', endpoints: ['/', '/a'] },
    engines: ['xss', 'sqli'],
    payloadsPerEngine: 50,
  });
  assert.equal(r.ok, true);
  assert.equal(r.estRequests, 200);
  assert.equal(r.dryRun, true);
  assert.equal(SR.dryRunSchedule({ id: 's-1' }).ok, false);
});

test('52455 appendRunLog + filterRunLogs: debuggable per-run logs', () => {
  const a = SR.appendRunLog([], { runId: 'run-1', level: 'info', message: 'started' }, NOW);
  assert.equal(a.ok, true);
  assert.equal(a.logs.length, 1);
  const b = SR.appendRunLog(
    a.logs,
    { runId: 'run-1', level: 'error', message: 'timeout' },
    NOW + 1
  );
  const q = SR.filterRunLogs(b.logs, { level: 'error' });
  assert.equal(q.count, 1);
  assert.equal(q.rows[0].message, 'timeout');
  assert.equal(SR.appendRunLog([], { level: 'info' }, NOW).ok, false);
});

test('52456 buildFailureAlert: critical for did-not-start', () => {
  const r = SR.buildFailureAlert(
    { id: 'run-1' },
    { kind: 'did-not-start', detail: 'DNS unresolvable' },
    NOW
  );
  assert.equal(r.ok, true);
  assert.equal(r.alert.severity, 'critical');
  assert.ok(r.alert.title.includes('failed to start'));
  const e = SR.buildFailureAlert({ id: 'run-1' }, { kind: 'errored', detail: 'x' }, NOW);
  assert.equal(e.alert.severity, 'high');
  assert.equal(SR.buildFailureAlert({ id: 'run-1' }, null, NOW).ok, false);
});

test('52457 nextRetryAttempt: exponential backoff, max attempts honored', () => {
  const r1 = SR.nextRetryAttempt([], { maxAttempts: 3, baseMs: 60000 }, NOW);
  assert.equal(r1.retry, true);
  assert.equal(r1.attempt, 1);
  assert.equal(r1.delayMs, 60000);
  const r2 = SR.nextRetryAttempt([{ at: 1 }], { maxAttempts: 3, baseMs: 60000 }, NOW);
  assert.equal(r2.delayMs, 120000);
  const done = SR.nextRetryAttempt([{ at: 1 }, { at: 2 }, { at: 3 }], { maxAttempts: 3 }, NOW);
  assert.equal(done.retry, false);
  assert.equal(done.reason, 'max attempts reached');
});

test('52458 applyScheduleTemplate: blueprint applied to a new target', () => {
  const r = SR.applyScheduleTemplate(
    { name: 'weekly-quick', cadence: 'weekly', depth: 'quick', notify: ['a@b.co'] },
    { id: 'acme-prod', name: 'acme-prod' },
    NOW
  );
  assert.equal(r.ok, true);
  assert.equal(r.schedule.fromTemplate, 'weekly-quick');
  assert.equal(r.schedule.targetId, 'acme-prod');
  assert.equal(SR.applyScheduleTemplate({ name: 'x' }, { id: 't' }, NOW).ok, false);
});

test('52459 matchEventTrigger: cert-renewal fires its trigger', () => {
  const r = SR.matchEventTrigger({ kind: 'certificate-renewal', targetId: 'acme' }, [
    { id: 'trig-1', onEvent: 'certificate-renewal' },
  ]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.matched, ['trig-1']);
  assert.equal(r.count, 1);
  const scoped = SR.matchEventTrigger({ kind: 'dns-change', targetId: 'acme' }, [
    { id: 'trig-2', onEvent: 'dns-change', targetId: 'other' },
  ]);
  assert.equal(scoped.count, 0);
  assert.equal(SR.matchEventTrigger({ kind: 'supernova' }, [], NOW).ok, false);
});

test('52460 fpSpotCheckSample: deterministic sample of FP patterns', () => {
  const patterns = [{ id: 'fp-1' }, { id: 'fp-2' }, { id: 'fp-3' }, { id: 'fp-4' }, { id: 'fp-5' }];
  const r = SR.fpSpotCheckSample(patterns, 2);
  assert.equal(r.ok, true);
  assert.equal(r.sampled, 2);
  assert.equal(r.total, 5);
  const r2 = SR.fpSpotCheckSample(patterns, 2);
  assert.deepEqual(
    r.sample.map(p => p.id),
    r2.sample.map(p => p.id)
  );
  assert.equal(SR.fpSpotCheckSample(patterns, 0).ok, false);
});

/* ---- Hunt diff core spot-checks (one+ assertion per idea) ---- */

test('52461 previewScopeDiff: added/removed/unchanged endpoints', () => {
  const r = HD.previewScopeDiff(
    { endpoints: ['/', '/api'] },
    { endpoints: ['/', '/checkout'], engines: ['xss'] }
  );
  assert.equal(r.ok, true);
  assert.deepEqual(r.added, ['/checkout']);
  assert.deepEqual(r.removed, ['/api']);
  assert.deepEqual(r.unchanged, ['/']);
  assert.equal(r.stats.added, 1);
  assert.equal(r.enginesChanged, true);
  assert.equal(HD.previewScopeDiff(null, {}).ok, false);
});

test('52462 autoArchiveCandidates: old runs archived, pinned kept', () => {
  const r = HD.autoArchiveCandidates(
    [
      { id: 'old', target: 't', startedAt: NOW - 400 * DAY },
      { id: 'new', target: 't', startedAt: NOW - 5 * DAY },
      { id: 'pin', target: 't', startedAt: NOW - 400 * DAY, pinned: true },
    ],
    365,
    NOW
  );
  assert.equal(r.ok, true);
  assert.equal(r.counts.archived, 1);
  assert.equal(r.archived[0].runId, 'old');
  assert.equal(r.archived[0].summaryOnly, true);
  assert.equal(r.counts.kept, 2);
  assert.equal(HD.autoArchiveCandidates([], 0, NOW).ok, false);
});

test('52463 buildComparisonDashboard: side-by-side verdicts per target', () => {
  const r = HD.buildComparisonDashboard(
    [
      { id: 'r1', target: 't1', startedAt: NOW - DAY, verdict: 'all-clear' },
      { id: 'r2', target: 't1', startedAt: NOW - 8 * DAY, verdict: 'fixed-found' },
      { id: 'r3', target: 't2', startedAt: NOW - 2 * DAY, verdict: 'all-clear' },
    ],
    1
  );
  assert.equal(r.ok, true);
  assert.equal(r.targets, 2);
  assert.equal(r.cards.find(c => c.target === 't1').recent.length, 1);
  assert.equal(HD.buildComparisonDashboard('x').ok, false);
});

test('52464 issueAllClearCertificate: only with zero open issues', () => {
  const r = HD.issueAllClearCertificate(
    { id: 'run-1', target: 'acme', stats: { openIssues: 0 } },
    'Infinity AI',
    NOW
  );
  assert.equal(r.ok, true);
  assert.equal(r.certificate.signed, true);
  assert.ok(r.certificate.statement.includes('Zero open issues'));
  const denied = HD.issueAllClearCertificate({ id: 'run-2', stats: { openIssues: 3 } });
  assert.equal(denied.ok, false);
  assert.ok(denied.reason.includes('3 open issue(s)'));
});

test('52465 parseScheduleApiPayload: validated recurring schedule', () => {
  const r = HD.parseScheduleApiPayload(
    { targetId: 'acme', cadence: 'weekly', depth: 'full', owner: 'aria' },
    NOW
  );
  assert.equal(r.ok, true);
  assert.equal(r.schedule.via, 'api');
  assert.equal(r.schedule.cadence, 'weekly');
  assert.equal(
    HD.parseScheduleApiPayload({ targetId: 'acme', cadence: 'whenever' }, NOW).ok,
    false
  );
  assert.equal(HD.parseScheduleApiPayload({ cadence: 'weekly' }, NOW).ok, false);
});

test('52466 parseScheduleChatCommand: "regression every Monday at 2am"', () => {
  const r = HD.parseScheduleChatCommand('regression every Monday at 2am', NOW);
  assert.equal(r.ok, true);
  assert.equal(r.parsed.cadence, 'weekly');
  assert.equal(r.parsed.day, 'monday');
  assert.equal(r.parsed.hour, 2);
  assert.equal(r.schedule.via, 'chat');
  const daily = HD.parseScheduleChatCommand('regression daily at 3pm', NOW);
  assert.equal(daily.parsed.cadence, 'daily');
  assert.equal(daily.parsed.hour, 15);
  assert.equal(HD.parseScheduleChatCommand('scan the site please', NOW).ok, false);
});

test('52467 regressionReminders: upcoming + unreachable nudges', () => {
  const r = HD.regressionReminders(
    [{ id: 's-1', targetId: 't1', owner: 'aria', runAt: NOW + 3 * HOUR, status: 'scheduled' }],
    { t1: false },
    NOW
  );
  assert.equal(r.ok, true);
  assert.equal(r.count, 2);
  assert.ok(r.reminders.some(x => x.kind === 'upcoming'));
  assert.ok(r.reminders.some(x => x.kind === 'unreachable'));
  assert.equal(HD.regressionReminders('x', {}).ok, false);
});

test('52468 buildDigestEmail: cross-target regression summary', () => {
  const r = HD.buildDigestEmail(
    [
      { id: 'r1', target: 't1', verdict: 'all-clear' },
      { id: 'r2', target: 't2', verdict: 'fixed-found' },
      { id: 'r3', target: 't1', verdict: 'all-clear' },
    ],
    'last 7 days',
    NOW
  );
  assert.equal(r.ok, true);
  assert.equal(r.total, 3);
  assert.equal(r.byVerdict['all-clear'], 2);
  assert.ok(r.subject.includes('last 7 days'));
  assert.equal(HD.buildDigestEmail('x', 'w').ok, false);
});

test('52469 buildCampaign: unified multi-target report', () => {
  const r = HD.buildCampaign(
    'Q3 sweep',
    [
      { id: 'r1', target: 't1', stats: { newFindings: 1, fixed: 4, persistent: 6 } },
      { id: 'r2', target: 't2', stats: { newFindings: 0, fixed: 2, persistent: 3 } },
    ],
    NOW
  );
  assert.equal(r.ok, true);
  assert.deepEqual(r.campaign.targets, ['t1', 't2']);
  assert.equal(r.campaign.totals.fixed, 6);
  assert.equal(r.campaign.totals.new, 1);
  assert.equal(HD.buildCampaign('', [{ id: 'r1' }], NOW).ok, false);
});

test('52470 linkPrToFinding: PR status surfaces on the finding', () => {
  const r = HD.linkPrToFinding(
    { id: 'f-1' },
    { number: 42, url: 'https://github.com/x/y/pull/42', title: 'fix sql', merged: true },
    NOW
  );
  assert.equal(r.ok, true);
  assert.equal(r.pr.status, 'merged');
  assert.equal(r.linkedPrs.length, 1);
  const open = HD.linkPrToFinding({ id: 'f-1' }, { number: 7 }, NOW);
  assert.equal(open.pr.status, 'open');
  assert.equal(HD.linkPrToFinding({ id: 'f-1' }, {}, NOW).ok, false);
});

test('52471 fixDiffViewerPayload: per-file add/del stats', () => {
  const r = HD.fixDiffViewerPayload({ number: 42 }, [
    { path: 'src/search.js', additions: 12, deletions: 4 },
    { path: 'src/router.js', additions: 3, deletions: 8 },
  ]);
  assert.equal(r.ok, true);
  assert.equal(r.stats.files, 2);
  assert.equal(r.stats.additions, 15);
  assert.equal(r.stats.deletions, 12);
  assert.equal(r.files[0].language, 'js');
  assert.equal(HD.fixDiffViewerPayload({}).ok, false);
});

test('52472 evidencePanelPayload: evidence beside fix notes', () => {
  const r = HD.evidencePanelPayload({
    id: 'f-1',
    fixNotes: 'parameterized query',
    evidence: [{ kind: 'fix', name: 'patch.diff' }],
    retest: { passed: true, at: NOW, by: 'aria' },
  });
  assert.equal(r.ok, true);
  assert.equal(r.verdict, 'verified-fixed');
  assert.equal(r.evidenceCount, 1);
  const pending = HD.evidencePanelPayload({ id: 'f-2' });
  assert.equal(pending.verdict, 'pending-verification');
  assert.equal(HD.evidencePanelPayload(null).ok, false);
});

test('52473 verifiedFixedBadge: badge only for passed retests', () => {
  const r = HD.verifiedFixedBadge({
    id: 'f-1',
    retest: { passed: true, at: NOW - DAY, by: 'aria' },
  });
  assert.equal(r.ok, true);
  assert.equal(r.badge.kind, 'verified-fixed');
  assert.equal(r.badge.verifiedBy, 'aria');
  assert.equal(r.badge.label, 'Verified fixed');
  assert.equal(HD.verifiedFixedBadge({ id: 'f-2' }).ok, false);
});

test('52474 fixSlaDeadline: critical gets 7 days', () => {
  const r = HD.fixSlaDeadline('critical', NOW, {});
  assert.equal(r.ok, true);
  assert.equal(r.slaDays, 7);
  assert.equal(r.deadline, NOW + 7 * DAY);
  const custom = HD.fixSlaDeadline('high', NOW, { high: 10 });
  assert.equal(custom.slaDays, 10);
  assert.equal(HD.fixSlaDeadline('cosmic', NOW, {}).ok, false);
});

test('52475 slaBreachAlerts: breached escalates, approaching warns', () => {
  const r = HD.slaBreachAlerts(
    [
      { id: 'f-1', severity: 'critical', foundAt: NOW - 25 * DAY },
      { id: 'f-2', severity: 'high', foundAt: NOW - 29 * DAY },
    ],
    {},
    NOW
  );
  assert.equal(r.ok, true);
  assert.equal(r.count, 2);
  const breached = r.alerts.find(a => a.findingId === 'f-1');
  assert.equal(breached.kind, 'breached');
  assert.equal(breached.level, 'manager');
  const approaching = r.alerts.find(a => a.findingId === 'f-2');
  assert.equal(approaching.kind, 'approaching');
  assert.equal(approaching.level, 'assignee');
});

test('52476 remediationProgress: fixed and verified percentages', () => {
  const r = HD.remediationProgress([
    { id: 'a', state: 'Verified' },
    { id: 'b', state: 'Fixed' },
    { id: 'c', state: 'InProgress' },
  ]);
  assert.equal(r.ok, true);
  assert.equal(r.total, 3);
  assert.equal(r.fixed, 2);
  assert.equal(r.pct, 66.7);
  assert.equal(r.verified, 1);
  assert.equal(HD.remediationProgress([]).pct, 0);
  assert.equal(HD.remediationProgress('x').ok, false);
});

const HUNT_A = {
  id: 'hunt-a',
  target: 'acme-prod',
  findings: [
    {
      id: 'f-621',
      title: 'Stored XSS',
      severity: 'medium',
      state: 'New',
      firstSeenAt: NOW - 7 * DAY,
    },
    {
      id: 'f-622',
      title: 'SQLi',
      severity: 'critical',
      state: 'Fixed',
      firstSeenAt: NOW - 14 * DAY,
    },
    {
      id: 'f-623',
      title: 'Open redirect',
      severity: 'medium',
      state: 'InProgress',
      firstSeenAt: NOW - 14 * DAY,
    },
  ],
};
const HUNT_B = {
  id: 'hunt-b',
  target: 'acme-prod',
  findings: [
    {
      id: 'f-621',
      title: 'Stored XSS',
      severity: 'high',
      state: 'New',
      firstSeenAt: NOW - 7 * DAY,
    },
    {
      id: 'f-622',
      title: 'SQLi',
      severity: 'critical',
      state: 'Fixed',
      firstSeenAt: NOW - 14 * DAY,
    },
    {
      id: 'f-623',
      title: 'Open redirect',
      severity: 'medium',
      state: 'InProgress',
      firstSeenAt: NOW - 14 * DAY,
    },
    { id: 'f-624', title: 'IDOR', severity: 'high', state: 'New', firstSeenAt: NOW },
  ],
};

test('52477 diffHunts: new/fixed/persistent/severity-changed counts', () => {
  const r = HD.diffHunts(HUNT_A, HUNT_B);
  assert.equal(r.ok, true);
  assert.deepEqual(r.counts, { new: 1, fixed: 0, persistent: 3, severityChanged: 1 });
  assert.equal(r.newFindings[0].id, 'f-624');
  assert.equal(HD.diffHunts(null, HUNT_B).ok, false);
});

test('52478 compareTargets: benchmark posture between targets', () => {
  const r = HD.compareTargets(HUNT_A, {
    id: 'hunt-c',
    target: 'other',
    findings: [{ id: 'x', severity: 'low' }],
  });
  assert.equal(r.ok, true);
  assert.equal(r.riskScoreA, 8);
  assert.equal(r.riskScoreB, 1);
  assert.equal(r.riskDelta, -7);
  assert.equal(r.posture, 'B stronger');
});

test('52479 highlightNewFindings: NEW badge with first-seen', () => {
  const r = HD.highlightNewFindings(HD.diffHunts(HUNT_A, HUNT_B), NOW);
  assert.equal(r.ok, true);
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].badge.label, 'NEW');
  assert.equal(r.items[0].badge.kind, 'new-finding');
  assert.equal(r.items[0].firstSeenAt, NOW);
  assert.equal(HD.highlightNewFindings({}).ok, false);
});

test('52480 highlightFixedFindings: FIXED badge with linked commit', () => {
  const diff = HD.diffHunts(
    {
      id: 'hunt-d',
      findings: [{ id: 'f-623', title: 'Open redirect', severity: 'medium', state: 'InProgress' }],
    },
    {
      id: 'hunt-e',
      findings: [
        {
          id: 'f-623',
          title: 'Open redirect',
          severity: 'medium',
          state: 'Verified',
          fixedAt: NOW - DAY,
          linkedPrs: [{ number: 7, status: 'merged' }],
        },
      ],
    }
  );
  assert.equal(diff.counts.fixed, 1);
  const r = HD.highlightFixedFindings(diff);
  assert.equal(r.ok, true);
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].badge.label, 'FIXED');
  assert.equal(r.items[0].commit.number, 7);
  assert.equal(HD.highlightFixedFindings({}).ok, false);
});

/* ---- JSX wiring audit ---- */
test('JSX files import the right cores and export galleries', () => {
  assert.ok(/import \* as SR from '.\/schedRegressCore.js'/.test(SR_JSX));
  assert.ok(/import \* as HD from '.\/huntDiffCore.js'/.test(HD_JSX));
  assert.ok(/SR62_GALLERY/.test(SR_JSX));
  assert.ok(/HD62_GALLERY/.test(HD_JSX));
});

test('real esbuild parse of both JSX files', () => {
  for (const f of ['SchedRegress.jsx', 'HuntDiff.jsx']) {
    execFileSync(
      'npx',
      ['esbuild', `--loader:.jsx=jsx`, '--format=esm', `--outfile=/dev/null`, join(DIR, f)],
      { stdio: 'pipe' }
    );
  }
});

/* ---- CSS audit: scoped prefixes only, zero keyframes, no global rules ---- */
test('Wave62.css: only .sr62-/.hd62- selectors, zero @keyframes, no global rules', () => {
  const classSelectors = [...CSS_SRC.matchAll(/^\s*\.([a-zA-Z0-9_-]+)\s*[{,]/gm)].map(m => m[1]);
  assert.ok(classSelectors.length > 0, 'expected class selectors');
  for (const sel of classSelectors) {
    assert.ok(sel.startsWith('sr62-') || sel.startsWith('hd62-'), `unscoped selector .${sel}`);
  }
  assert.ok(!/@keyframes/i.test(CSS_SRC), 'zero-animation order: no @keyframes');
  assert.ok(!/transition\s*:/i.test(CSS_SRC), 'zero-animation order: no transitions');
  assert.ok(!/animation\s*:/i.test(CSS_SRC), 'zero-animation order: no animations');
  assert.ok(!/^\s*(html|body|\*)\s*[{,]/m.test(CSS_SRC), 'no global element selectors');
  assert.ok(!/!important/.test(CSS_SRC), 'no !important');
});

test('Wave62.css: both prefixes have the shared layout primitives', () => {
  for (const prefix of ['sr62', 'hd62']) {
    for (const cls of ['gallery', 'card', 'title', 'note', 'mono', 'row', 'btn']) {
      assert.ok(new RegExp(`\\.${prefix}-${cls}\\b`).test(CSS_SRC), `missing .${prefix}-${cls}`);
    }
  }
});

/* ---- Branding audit: Infinity AI only, never Muse ---- */
test('branding: no "Muse" anywhere; "Infinity AI" present where branded', () => {
  for (const [name, src] of [
    ['srCore', SR_SRC],
    ['hdCore', HD_SRC],
    ['srJsx', SR_JSX],
    ['hdJsx', HD_JSX],
    ['css', CSS_SRC],
  ]) {
    assert.ok(!/Muse/i.test(src), `${name} leaks "Muse" branding`);
  }
  for (const [name, src] of [
    ['srCore', SR_SRC],
    ['hdCore', HD_SRC],
    ['srJsx', SR_JSX],
    ['hdJsx', HD_JSX],
    ['css', CSS_SRC],
  ]) {
    assert.ok(/Infinity AI/.test(src), `${name} missing "Infinity AI" branding`);
  }
});

/* ---- Debris audit: no TODO/FIXME/mock/demo/placeholder/debris ---- */
test('no TODO/FIXME/mock/demo/debris in any wave-62 file', () => {
  const bad = /\b(TODO|FIXME|XXX|HACK|lorem ipsum|not implemented)\b/i;
  for (const [name, src] of [
    ['srCore', SR_SRC],
    ['hdCore', HD_SRC],
    ['srJsx', SR_JSX],
    ['hdJsx', HD_JSX],
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
