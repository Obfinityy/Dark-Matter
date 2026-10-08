/**
 * SchedRegress.jsx — Infinity AI · Dark-Matter · Wave 62
 * 20 working React components for scheduled regression management, ideas 52441–52460.
 * Export-only module: components are not mounted anywhere. Pure presentational,
 * props-driven; no localStorage (repo convention for wave galleries).
 */
import React, { useState } from 'react';
import * as SR from './schedRegressCore.js';

const NOW = 1700000000000;
const DAY = 24 * 3600000;
const HOUR = 3600000;

const SCHED1 = {
  id: 'sched-621',
  targetId: 'acme-prod',
  targetName: 'acme-prod',
  cadence: 'weekly',
  depth: 'quick',
  owner: 'aria',
  runAt: NOW + 3 * HOUR,
  status: 'scheduled',
};
const SCHED2 = {
  id: 'sched-622',
  targetId: 'acme-staging',
  targetName: 'acme-staging',
  cadence: 'daily',
  depth: 'full',
  owner: 'kai',
  runAt: NOW + 2 * DAY,
  status: 'scheduled',
};
const RUN1 = {
  id: 'run-621',
  target: 'acme-prod',
  startedAt: NOW - 7 * DAY,
  verdict: 'all-clear',
  stats: { newFindings: 0, fixed: 5, persistent: 12, openIssues: 0, meanTimeToVerifyMs: 9000000 },
};
const RUN2 = {
  id: 'run-622',
  target: 'acme-prod',
  startedAt: NOW - 14 * DAY,
  verdict: 'fixed-found',
  stats: {
    newFindings: 2,
    fixed: 8,
    persistent: 10,
    openIssues: 0,
    meanTimeToVerifyMs: 12000000,
    reintroduced: 1,
  },
};
const WS = { id: 'ws-1' };

function Note({ children }) {
  return <p className="sr62-note">{children}</p>;
}
function Mono({ children }) {
  return <pre className="sr62-mono">{children}</pre>;
}

/* 52441 — Scheduled hunt ownership. */
export function ScheduleOwnership() {
  const [owner, setOwner] = useState('aria');
  const r = SR.assignScheduleOwner(SCHED1, owner, NOW);
  return (
    <div className="sr62-card">
      <h3 className="sr62-title">52441 · Scheduled hunt ownership</h3>
      <Note>Assign an accountable owner to each recurring schedule.</Note>
      <div className="sr62-row">
        <select className="sr62-select" value={owner} onChange={e => setOwner(e.target.value)}>
          {['aria', 'kai', 'bhavesh'].map(u => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
        <span className="sr62-chip">owner: {r.schedule.owner}</span>
      </div>
      <Mono>{JSON.stringify(r.schedule.ownerHistory, null, 2)}</Mono>
    </div>
  );
}

/* 52442 — Scheduled hunt permissions. */
export function SchedulePermissions() {
  const [role, setRole] = useState('editor');
  const r = SR.checkSchedulePermission(WS, { id: 'u-1', roles: { 'ws-1': role } }, 'pause');
  return (
    <div className="sr62-card">
      <h3 className="sr62-title">52442 · Scheduled hunt permissions</h3>
      <Note>Role-based control over who can create, edit, or pause recurring hunts.</Note>
      <div className="sr62-row">
        <select className="sr62-select" value={role} onChange={e => setRole(e.target.value)}>
          {['viewer', 'editor', 'owner', 'admin'].map(x => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>
        <span className="sr62-chip">{r.allowed ? 'allowed' : 'denied'}</span>
      </div>
      <Mono>{r.reason}</Mono>
    </div>
  );
}

/* 52443 — Regression report auto-send. */
export function ReportAutoSend() {
  const r = SR.buildAutoSendReport(RUN2, ['leads@infinity.ai', 'sec@acme.co'], NOW);
  return (
    <div className="sr62-card">
      <h3 className="sr62-title">52443 · Regression report auto-send</h3>
      <Note>Diff report emailed to stakeholders automatically after each regression.</Note>
      <Mono>{r.subject}</Mono>
      <Mono>{r.body}</Mono>
      <span className="sr62-chip">to: {r.recipients.join(', ')}</span>
    </div>
  );
}

/* 52444 — Regression SLA tracking. */
export function RegressionSla() {
  const r = SR.trackRegressionSla(
    { ...RUN1, verifiedAt: NOW - 6 * DAY },
    NOW - 7 * DAY,
    7 * DAY,
    NOW
  );
  return (
    <div className="sr62-card">
      <h3 className="sr62-title">52444 · Regression SLA tracking</h3>
      <Note>Time from fix-deploy to verified-fixed against the configured SLA.</Note>
      <div className="sr62-row">
        <span className="sr62-chip">{r.status}</span>
        <span className="sr62-chip">
          elapsed: {Math.round(r.elapsedMs / DAY)}d / {Math.round(r.slaMs / DAY)}d
        </span>
      </div>
    </div>
  );
}

/* 52445 — Regression history timeline. */
export function HistoryTimeline() {
  const r = SR.buildHistoryTimeline(
    [RUN1, RUN2, { ...RUN1, id: 'run-620', target: 'other' }],
    'acme-prod'
  );
  return (
    <div className="sr62-card">
      <h3 className="sr62-title">52445 · Regression history timeline</h3>
      <Note>Per-target timeline of every regression run with verdicts.</Note>
      <ul className="sr62-list">
        {r.timeline.map(t => (
          <li key={t.runId}>
            <span className="sr62-chip">{t.verdict}</span> {t.runId} ·{' '}
            {new Date(t.at).toISOString().slice(0, 10)}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* 52446 — Regression analytics. */
export function RegressionAnalytics() {
  const r = SR.regressionAnalytics([RUN1, RUN2]);
  return (
    <div className="sr62-card">
      <h3 className="sr62-title">52446 · Regression analytics</h3>
      <Note>Fix success rates, mean time to verify, regression-caught reintroductions.</Note>
      <div className="sr62-row">
        <span className="sr62-chip">success: {Math.round(r.fixSuccessRate * 100)}%</span>
        <span className="sr62-chip">mtv: {Math.round((r.meanTimeToVerifyMs || 0) / HOUR)}h</span>
        <span className="sr62-chip">reintroduced: {r.reintroductions}</span>
      </div>
    </div>
  );
}

/* 52447 — Bulk schedule creation. */
export function BulkScheduleCreate() {
  const r = SR.bulkCreateSchedules(
    [
      { id: 't-1', name: 'acme-prod' },
      { id: 't-2', name: 'acme-staging' },
    ],
    { name: 'weekly-quick', cadence: 'weekly', depth: 'quick', owner: 'aria' },
    NOW
  );
  return (
    <div className="sr62-card">
      <h3 className="sr62-title">52447 · Bulk schedule creation</h3>
      <Note>Apply the same regression schedule to many targets at once.</Note>
      <ul className="sr62-list">
        {r.schedules.map(s => (
          <li key={s.id}>
            <span className="sr62-chip">{s.cadence}</span> {s.targetName}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* 52448 — Schedule-from-triage. */
export function ScheduleFromTriage() {
  const r = SR.scheduleFromTriage(
    {
      id: 'f-621',
      state: 'Triaged',
      triageDecision: 'fix',
      severity: 'high',
      title: 'SQLi in search',
    },
    { delayMs: 7 * DAY },
    NOW
  );
  return (
    <div className="sr62-card">
      <h3 className="sr62-title">52448 · Schedule-from-triage</h3>
      <Note>Schedule regression verification straight from a triaged finding.</Note>
      {r.ok ? (
        <Mono>{`verification at ${new Date(r.schedule.runAt).toISOString()}`}</Mono>
      ) : (
        <Mono>{r.reason}</Mono>
      )}
    </div>
  );
}

/* 52449 — Schedule-from-remediation-board. */
export function ScheduleFromBoard() {
  const r = SR.scheduleFromBoard({ findingId: 'f-621', movedBy: 'kai' }, NOW + 2 * DAY, NOW);
  return (
    <div className="sr62-card">
      <h3 className="sr62-title">52449 · Schedule-from-remediation-board</h3>
      <Note>Drag a "fixing" card onto a calendar date to schedule verification.</Note>
      <Mono>
        {r.ok
          ? `dropped → verification ${new Date(r.schedule.runAt).toISOString().slice(0, 10)}`
          : r.reason}
      </Mono>
    </div>
  );
}

/* 52450 — Blackout windows. */
export function BlackoutWindows() {
  const wins = [{ name: 'holiday freeze', start: NOW + DAY, end: NOW + 3 * DAY }];
  const r1 = SR.isInBlackoutWindow(NOW, wins);
  const r2 = SR.isInBlackoutWindow(NOW + 2 * DAY, wins);
  return (
    <div className="sr62-card">
      <h3 className="sr62-title">52450 · Blackout windows</h3>
      <Note>No-hunt periods (peak sales, holidays) that scheduled hunts respect.</Note>
      <div className="sr62-row">
        <span className="sr62-chip">now: {r1.inBlackout ? 'blackout' : 'clear'}</span>
        <span className="sr62-chip">+2d: {r2.inBlackout ? 'blackout' : 'clear'}</span>
      </div>
      <Mono>{r2.hint}</Mono>
    </div>
  );
}

/* 52451 — Timezone-aware scheduling (post-hunt). */
export function TimezoneAware() {
  const r = SR.formatInTargetTimezone(NOW, 330, 'acme-prod local (IST)');
  return (
    <div className="sr62-card">
      <h3 className="sr62-title">52451 · Timezone-aware scheduling</h3>
      <Note>Schedules display and fire in the target's local timezone.</Note>
      <Mono>
        {r.local} {r.offset}
      </Mono>
      <Note>{r.dstNote}.</Note>
    </div>
  );
}

/* 52452 — Concurrency limits. */
export function ConcurrencyLimits() {
  const r = SR.checkConcurrency(
    [{ status: 'running' }, { status: 'running' }, { status: 'done' }],
    2
  );
  return (
    <div className="sr62-card">
      <h3 className="sr62-title">52452 · Concurrency limits</h3>
      <Note>Cap simultaneous scheduled hunts to protect shared targets and budgets.</Note>
      <div className="sr62-row">
        <span className="sr62-chip">
          active: {r.active}/{r.limit}
        </span>
        <span className="sr62-chip">{r.allowed ? 'slot available' : 'at cap'}</span>
      </div>
      <Mono>{r.hint}</Mono>
    </div>
  );
}

/* 52453 — Budget caps for scheduled hunts. */
export function BudgetCaps() {
  const r = SR.checkBudget(8500, 10000);
  return (
    <div className="sr62-card">
      <h3 className="sr62-title">52453 · Budget caps for scheduled hunts</h3>
      <Note>Monthly compute caps with warnings and auto-pause on exceed.</Note>
      <div className="sr62-row">
        <span className="sr62-chip">{r.status}</span>
        <span className="sr62-chip">used: {Math.round(r.pctUsed * 100)}%</span>
      </div>
      <div className="sr62-bar">
        <div className="sr62-bar-fill" style={{ width: `${Math.min(100, r.pctUsed * 100)}%` }} />
      </div>
    </div>
  );
}

/* 52454 — Scheduled-hunt dry run. */
export function DryRun() {
  const r = SR.dryRunSchedule({
    id: 'sched-623',
    scope: { target: 'acme-prod', endpoints: ['/', '/api', '/login'] },
    engines: ['xss', 'sqli'],
    payloadsPerEngine: 50,
  });
  return (
    <div className="sr62-card">
      <h3 className="sr62-title">52454 · Scheduled-hunt dry run</h3>
      <Note>Preview scope, engines, and estimated requests before the first run.</Note>
      <div className="sr62-row">
        <span className="sr62-chip">~{r.estRequests} requests</span>
        <span className="sr62-chip">~{Math.round(r.estDurationMs / 60000)} min</span>
      </div>
      <Mono>{r.note}</Mono>
    </div>
  );
}

/* 52455 — Scheduled-hunt run logs. */
export function RunLogs() {
  const seed = [];
  const a = SR.appendRunLog(
    seed,
    { runId: 'run-621', level: 'info', message: 'started scope /api' },
    NOW
  );
  const b = SR.appendRunLog(
    a.logs,
    { runId: 'run-621', level: 'error', message: 'engine sqli timed out' },
    NOW + 1000
  );
  const q = SR.filterRunLogs(b.logs, { level: 'error' });
  return (
    <div className="sr62-card">
      <h3 className="sr62-title">52455 · Scheduled-hunt run logs</h3>
      <Note>Full logs per scheduled execution for debugging missed or failed runs.</Note>
      <Mono>{q.rows.map(x => `[${x.level}] ${x.message}`).join('\n')}</Mono>
      <span className="sr62-chip">{q.count} error(s)</span>
    </div>
  );
}

/* 52456 — Schedule failure alerts (post-hunt). */
export function FailureAlerts() {
  const r = SR.buildFailureAlert(
    RUN1,
    { kind: 'did-not-start', detail: 'target DNS unresolvable' },
    NOW
  );
  return (
    <div className="sr62-card">
      <h3 className="sr62-title">52456 · Schedule failure alerts</h3>
      <Note>Immediate alert when a scheduled hunt fails to start or errors out.</Note>
      <div className="sr62-row">
        <span className="sr62-chip">{r.alert.severity}</span>
      </div>
      <Mono>{r.alert.title}</Mono>
    </div>
  );
}

/* 52457 — Retry policy for scheduled hunts. */
export function RetryPolicy() {
  const r1 = SR.nextRetryAttempt([{ at: NOW - HOUR }], { maxAttempts: 3, baseMs: 60000 }, NOW);
  const r2 = SR.nextRetryAttempt([{ at: 1 }, { at: 2 }, { at: 3 }], { maxAttempts: 3 }, NOW);
  return (
    <div className="sr62-card">
      <h3 className="sr62-title">52457 · Retry policy for scheduled hunts</h3>
      <Note>Configurable retries with exponential backoff for transient failures.</Note>
      <div className="sr62-row">
        <span className="sr62-chip">
          {r1.retry
            ? `attempt ${r1.attempt}/${r1.maxAttempts} in ${r1.delayMs / 60000} min`
            : r1.reason}
        </span>
        <span className="sr62-chip">{r2.retry ? 'retrying' : r2.reason}</span>
      </div>
    </div>
  );
}

/* 52458 — Schedule templates (post-hunt). */
export function ScheduleTemplates() {
  const r = SR.applyScheduleTemplate(
    { name: 'weekly-quick', cadence: 'weekly', depth: 'quick', notify: ['leads@infinity.ai'] },
    { id: 'acme-prod', name: 'acme-prod' },
    NOW
  );
  return (
    <div className="sr62-card">
      <h3 className="sr62-title">52458 · Schedule templates</h3>
      <Note>Reusable schedule blueprints applied to new targets.</Note>
      <Mono>{`${r.schedule.fromTemplate} → ${r.schedule.targetName} (${r.schedule.cadence})`}</Mono>
    </div>
  );
}

/* 52459 — Event-triggered schedules. */
export function EventTriggers() {
  const triggers = [
    { id: 'trig-1', onEvent: 'certificate-renewal' },
    { id: 'trig-2', onEvent: 'dns-change', targetId: 'acme-prod' },
  ];
  const r = SR.matchEventTrigger({ kind: 'certificate-renewal', targetId: 'acme-prod' }, triggers);
  return (
    <div className="sr62-card">
      <h3 className="sr62-title">52459 · Event-triggered schedules</h3>
      <Note>Fire regressions on events like certificate renewal or DNS changes.</Note>
      <span className="sr62-chip">{r.count} trigger(s) matched</span>
      <Mono>{r.matched.join(', ')}</Mono>
    </div>
  );
}

/* 52460 — FP spot-check regression. */
export function FpSpotCheck() {
  const r = SR.fpSpotCheckSample(
    [{ id: 'fp-1' }, { id: 'fp-2' }, { id: 'fp-3' }, { id: 'fp-4' }, { id: 'fp-5' }],
    2
  );
  return (
    <div className="sr62-card">
      <h3 className="sr62-title">52460 · FP spot-check regression</h3>
      <Note>Periodically re-validate a sample of FP-dismissed patterns to catch rule drift.</Note>
      <div className="sr62-row">
        <span className="sr62-chip">
          {r.sampled}/{r.total} sampled
        </span>
      </div>
      <Mono>{r.sample.map(p => p.id).join(', ')}</Mono>
    </div>
  );
}

export const SR62_GALLERY = [
  ScheduleOwnership,
  SchedulePermissions,
  ReportAutoSend,
  RegressionSla,
  HistoryTimeline,
  RegressionAnalytics,
  BulkScheduleCreate,
  ScheduleFromTriage,
  ScheduleFromBoard,
  BlackoutWindows,
  TimezoneAware,
  ConcurrencyLimits,
  BudgetCaps,
  DryRun,
  RunLogs,
  FailureAlerts,
  RetryPolicy,
  ScheduleTemplates,
  EventTriggers,
  FpSpotCheck,
];

export function SchedRegressGallery() {
  return (
    <div className="sr62-gallery">
      {SR62_GALLERY.map((C, i) => (
        <C key={i} />
      ))}
    </div>
  );
}
