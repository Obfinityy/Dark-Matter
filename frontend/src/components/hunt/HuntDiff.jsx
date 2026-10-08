/**
 * HuntDiff.jsx — Infinity AI · Dark-Matter · Wave 62
 * 20 working React components for hunt comparison and post-hunt operations, ideas 52461–52480.
 * Export-only module: components are not mounted anywhere. Pure presentational,
 * props-driven; no localStorage (repo convention for wave galleries).
 */
import React, { useState } from 'react';
import * as HD from './huntDiffCore.js';

const NOW = 1700000000000;
const DAY = 24 * 3600000;

const F1 = {
  id: 'f-621',
  title: 'Stored XSS in reviews',
  severity: 'high',
  state: 'New',
  firstSeenAt: NOW - 7 * DAY,
  foundAt: NOW - 7 * DAY,
};
const F2 = {
  id: 'f-622',
  title: 'SQLi in search',
  severity: 'critical',
  state: 'Fixed',
  firstSeenAt: NOW - 14 * DAY,
  foundAt: NOW - 14 * DAY,
  fixedAt: NOW - 2 * DAY,
  linkedPrs: [
    { number: 42, status: 'merged', url: 'https://github.com/Obfinityy/Dark-Matter/pull/42' },
  ],
};
const F3 = {
  id: 'f-623',
  title: 'Open redirect',
  severity: 'medium',
  state: 'InProgress',
  firstSeenAt: NOW - 14 * DAY,
  foundAt: NOW - 14 * DAY,
};
const HUNT_A = {
  id: 'hunt-a',
  target: 'acme-prod',
  findings: [F2, F3, { ...F1, severity: 'medium' }],
};
const HUNT_B = {
  id: 'hunt-b',
  target: 'acme-prod',
  findings: [
    F2,
    F3,
    F1,
    { id: 'f-624', title: 'IDOR in profile', severity: 'high', state: 'New', firstSeenAt: NOW },
  ],
};

function Note({ children }) {
  return <p className="hd62-note">{children}</p>;
}
function Mono({ children }) {
  return <pre className="hd62-mono">{children}</pre>;
}

/* 52461 — Regression scope-diff preview. */
export function ScopeDiffPreview() {
  const r = HD.previewScopeDiff(
    { endpoints: ['/', '/api', '/login'] },
    { endpoints: ['/', '/api', '/checkout', '/profile'], engines: ['xss'] }
  );
  return (
    <div className="hd62-card">
      <h3 className="hd62-title">52461 · Regression scope-diff preview</h3>
      <Note>What the next regression will cover vs the last run, before it starts.</Note>
      <div className="hd62-row">
        <span className="hd62-chip">+{r.stats.added} added</span>
        <span className="hd62-chip">-{r.stats.removed} removed</span>
        <span className="hd62-chip">{r.stats.unchanged} unchanged</span>
      </div>
      <Mono>{r.added.join(', ') || 'none added'}</Mono>
    </div>
  );
}

/* 52462 — Auto-archive old regressions. */
export function AutoArchive() {
  const r = HD.autoArchiveCandidates(
    [
      { id: 'run-old', target: 'acme-prod', startedAt: NOW - 400 * DAY },
      { id: 'run-new', target: 'acme-prod', startedAt: NOW - 5 * DAY },
      { id: 'run-pin', target: 'acme-prod', startedAt: NOW - 400 * DAY, pinned: true },
    ],
    365,
    NOW
  );
  return (
    <div className="hd62-card">
      <h3 className="hd62-title">52462 · Auto-archive old regressions</h3>
      <Note>Archive runs older than N months, keeping only their diff summaries.</Note>
      <span className="hd62-chip">
        {r.counts.archived} archived · {r.counts.kept} kept
      </span>
      <Mono>{r.archived.map(a => `${a.runId} (summary only)`).join('\n') || 'none'}</Mono>
    </div>
  );
}

/* 52463 — Regression comparison dashboard. */
export function ComparisonDashboard() {
  const r = HD.buildComparisonDashboard(
    [
      { id: 'r1', target: 'acme-prod', startedAt: NOW - DAY, verdict: 'all-clear' },
      { id: 'r2', target: 'acme-prod', startedAt: NOW - 8 * DAY, verdict: 'fixed-found' },
      { id: 'r3', target: 'acme-staging', startedAt: NOW - 2 * DAY, verdict: 'all-clear' },
    ],
    2
  );
  return (
    <div className="hd62-card">
      <h3 className="hd62-title">52463 · Regression comparison dashboard</h3>
      <Note>Side-by-side verdicts of the last N regressions per target.</Note>
      {r.cards.map(c => (
        <div key={c.target}>
          <span className="hd62-chip">{c.target}</span>
          <ul className="hd62-list">
            {c.recent.map(x => (
              <li key={x.runId}>
                {x.runId} · {x.verdict}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/* 52464 — "All clear" certificate. */
export function AllClearCertificate() {
  const r = HD.issueAllClearCertificate(
    { id: 'run-621', target: 'acme-prod', stats: { openIssues: 0 } },
    'Infinity AI',
    NOW
  );
  const denied = HD.issueAllClearCertificate(
    { id: 'run-622', target: 'acme-prod', stats: { openIssues: 3 } },
    'Infinity AI',
    NOW
  );
  return (
    <div className="hd62-card">
      <h3 className="hd62-title">52464 · "All clear" certificate</h3>
      <Note>Signed certificate when a regression finds zero open issues.</Note>
      {r.ok ? (
        <Mono>
          {r.certificate.statement}
          {'\n'}id: {r.certificate.id}
        </Mono>
      ) : (
        <Mono>{r.reason}</Mono>
      )}
      <Mono>with 3 open: {denied.ok ? 'issued' : denied.reason}</Mono>
    </div>
  );
}

/* 52465 — Schedule-via-API. */
export function ScheduleViaApi() {
  const r = HD.parseScheduleApiPayload(
    { targetId: 'acme-prod', cadence: 'weekly', depth: 'full', owner: 'aria' },
    NOW
  );
  return (
    <div className="hd62-card">
      <h3 className="hd62-title">52465 · Schedule-via-API</h3>
      <Note>Create and manage recurring hunts programmatically.</Note>
      <Mono>{r.ok ? JSON.stringify(r.schedule, null, 2) : r.reason}</Mono>
    </div>
  );
}

/* 52466 — Schedule-via-chat. */
export function ScheduleViaChat() {
  const [text, setText] = useState('regression every Monday at 2am');
  const r = HD.parseScheduleChatCommand(text, NOW);
  return (
    <div className="hd62-card">
      <h3 className="hd62-title">52466 · Schedule-via-chat</h3>
      <Note>Tell the agent "regression every Monday at 2am" and it configures the schedule.</Note>
      <div className="hd62-row">
        <input className="hd62-input" value={text} onChange={e => setText(e.target.value)} />
      </div>
      <Mono>
        {r.ok
          ? `${r.parsed.cadence} · ${r.parsed.day || 'any day'} · ${r.parsed.hour}:${String(r.parsed.minute).padStart(2, '0')}`
          : r.reason}
      </Mono>
    </div>
  );
}

/* 52467 — Regression reminders. */
export function RegressionReminders() {
  const r = HD.regressionReminders(
    [
      {
        id: 'sched-621',
        targetId: 'acme-prod',
        owner: 'aria',
        runAt: NOW + 3 * 3600000,
        status: 'scheduled',
      },
    ],
    { 'acme-prod': false },
    NOW
  );
  return (
    <div className="hd62-card">
      <h3 className="hd62-title">52467 · Regression reminders</h3>
      <Note>Remind owners before a regression; nudge when targets are unreachable.</Note>
      <ul className="hd62-list">
        {r.reminders.map((x, i) => (
          <li key={i}>
            <span className="hd62-chip">{x.kind}</span> {x.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* 52468 — Regression digest email. */
export function DigestEmail() {
  const r = HD.buildDigestEmail(
    [
      { id: 'r1', target: 'acme-prod', verdict: 'all-clear' },
      { id: 'r2', target: 'acme-staging', verdict: 'fixed-found' },
    ],
    'last 7 days',
    NOW
  );
  return (
    <div className="hd62-card">
      <h3 className="hd62-title">52468 · Regression digest email</h3>
      <Note>Periodic summary of all regression outcomes across targets.</Note>
      <Mono>{r.subject}</Mono>
      <div className="hd62-row">
        <span className="hd62-chip">total: {r.total}</span>
        <span className="hd62-chip">all-clear: {r.byVerdict['all-clear'] || 0}</span>
      </div>
    </div>
  );
}

/* 52469 — Multi-target regression campaigns. */
export function MultiTargetCampaigns() {
  const r = HD.buildCampaign(
    'Q3 portfolio sweep',
    [
      { id: 'r1', target: 'acme-prod', stats: { newFindings: 1, fixed: 4, persistent: 6 } },
      { id: 'r2', target: 'acme-staging', stats: { newFindings: 0, fixed: 2, persistent: 3 } },
    ],
    NOW
  );
  return (
    <div className="hd62-card">
      <h3 className="hd62-title">52469 · Multi-target regression campaigns</h3>
      <Note>Group regressions across an asset portfolio with unified reporting.</Note>
      <div className="hd62-row">
        <span className="hd62-chip">{r.campaign.targets.length} targets</span>
        <span className="hd62-chip">fixed: {r.campaign.totals.fixed}</span>
      </div>
      <Mono>
        {r.campaign.name} · {r.campaign.id}
      </Mono>
    </div>
  );
}

/* 52470 — PR linking for fixes. */
export function PrLinking() {
  const r = HD.linkPrToFinding(
    F3,
    {
      number: 42,
      url: 'https://github.com/Obfinityy/Dark-Matter/pull/42',
      title: 'fix open redirect',
      merged: true,
    },
    NOW
  );
  return (
    <div className="hd62-card">
      <h3 className="hd62-title">52470 · PR linking for fixes</h3>
      <Note>Link pull requests to findings; PR status shows on the remediation card.</Note>
      <div className="hd62-row">
        <span className="hd62-chip">
          #{r.pr.number} {r.pr.status}
        </span>
      </div>
      <Mono>{r.pr.title}</Mono>
    </div>
  );
}

/* 52471 — Fix diff viewer. */
export function FixDiffViewer() {
  const r = HD.fixDiffViewerPayload({ number: 42 }, [
    { path: 'src/search.js', additions: 12, deletions: 4 },
    { path: 'src/router.js', additions: 3, deletions: 8 },
  ]);
  return (
    <div className="hd62-card">
      <h3 className="hd62-title">52471 · Fix diff viewer</h3>
      <Note>View the actual code diff of a linked fix commit without leaving the page.</Note>
      <ul className="hd62-list">
        {r.files.map(f => (
          <li key={f.path}>
            {f.path}{' '}
            <span className="hd62-chip">
              +{f.additions}/-{f.deletions}
            </span>
          </li>
        ))}
      </ul>
      <Mono>
        {r.stats.files} files · +{r.stats.additions} -{r.stats.deletions}
      </Mono>
    </div>
  );
}

/* 52472 — Verification evidence panel. */
export function EvidencePanel() {
  const finding = {
    ...F2,
    fixNotes: 'parameterized query in search handler',
    evidence: [{ kind: 'fix', name: 'patch.diff' }],
    retest: { passed: true, at: NOW - DAY, by: 'aria' },
  };
  const r = HD.evidencePanelPayload(finding);
  return (
    <div className="hd62-card">
      <h3 className="hd62-title">52472 · Verification evidence panel</h3>
      <Note>Retest evidence alongside fix notes for one-glance verification.</Note>
      <div className="hd62-row">
        <span className="hd62-chip">{r.verdict}</span>
        <span className="hd62-chip">{r.evidenceCount} artifact(s)</span>
      </div>
      <Mono>{r.fixNotes}</Mono>
    </div>
  );
}

/* 52473 — "Verified fixed" badge. */
export function VerifiedFixedBadge() {
  const good = { ...F2, retest: { passed: true, at: NOW - DAY, by: 'aria' } };
  const r = HD.verifiedFixedBadge(good);
  const bad = HD.verifiedFixedBadge(F1);
  return (
    <div className="hd62-card">
      <h3 className="hd62-title">52473 · "Verified fixed" badge</h3>
      <Note>Prominent badge on findings that passed verification retest.</Note>
      <div className="hd62-row">
        <span className="hd62-chip">
          {r.ok ? `${r.badge.label} · ${r.badge.verifiedBy}` : r.reason}
        </span>
      </div>
      <Mono>unverified: {bad.ok ? 'badged' : bad.reason}</Mono>
    </div>
  );
}

/* 52474 — Fix SLA per severity. */
export function FixSla() {
  const r = HD.fixSlaDeadline('critical', NOW - 8 * DAY, {});
  return (
    <div className="hd62-card">
      <h3 className="hd62-title">52474 · Fix SLA per severity</h3>
      <Note>Configurable fix deadlines (Critical: 7d, High: 30d...) with breach escalation.</Note>
      <div className="hd62-row">
        <span className="hd62-chip">critical → {r.slaDays}d</span>
      </div>
      <Mono>deadline: {new Date(r.deadline).toISOString().slice(0, 10)}</Mono>
    </div>
  );
}

/* 52475 — SLA breach alerts (post-hunt). */
export function SlaBreachAlerts() {
  const r = HD.slaBreachAlerts(
    [
      { id: 'f-621', severity: 'critical', foundAt: NOW - 20 * DAY },
      { id: 'f-622', severity: 'high', foundAt: NOW - 29 * DAY },
    ],
    {},
    NOW
  );
  return (
    <div className="hd62-card">
      <h3 className="hd62-title">52475 · SLA breach alerts (post-hunt)</h3>
      <Note>Escalating notifications (assignee → lead → manager) as SLAs approach and pass.</Note>
      <ul className="hd62-list">
        {r.alerts.map((a, i) => (
          <li key={i}>
            <span className="hd62-chip">{a.kind}</span> {a.findingId} → {a.level}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* 52476 — Remediation progress percentage. */
export function RemediationProgress() {
  const r = HD.remediationProgress([
    { id: 'f-1', state: 'Verified', retest: { passed: true } },
    { id: 'f-2', state: 'Fixed' },
    { id: 'f-3', state: 'InProgress' },
    { id: 'f-4', state: 'New' },
  ]);
  return (
    <div className="hd62-card">
      <h3 className="hd62-title">52476 · Remediation progress percentage</h3>
      <Note>Per-hunt and per-target % of findings fixed and verified.</Note>
      <div className="hd62-row">
        <span className="hd62-chip">{r.pct}% fixed</span>
        <span className="hd62-chip">{r.verifiedPct}% verified</span>
      </div>
      <div className="hd62-bar">
        <div className="hd62-bar-fill" style={{ width: `${r.pct}%` }} />
      </div>
    </div>
  );
}

/* 52477 — Before/after hunt diff view (post-hunt). */
export function HuntDiffView() {
  const r = HD.diffHunts(HUNT_A, HUNT_B);
  return (
    <div className="hd62-card">
      <h3 className="hd62-title">52477 · Before/after hunt diff view</h3>
      <Note>Visual diff of two hunts: new, fixed, persistent, severity-changed.</Note>
      <div className="hd62-row">
        <span className="hd62-chip">+{r.counts.new} new</span>
        <span className="hd62-chip">{r.counts.fixed} fixed</span>
        <span className="hd62-chip">{r.counts.persistent} persistent</span>
        <span className="hd62-chip">{r.counts.severityChanged} severityΔ</span>
      </div>
    </div>
  );
}

/* 52478 — Target A vs target B compare. */
export function TargetCompare() {
  const r = HD.compareTargets(HUNT_A, {
    ...HUNT_B,
    id: 'hunt-c',
    target: 'acme-staging',
    findings: [F1],
  });
  return (
    <div className="hd62-card">
      <h3 className="hd62-title">52478 · Target A vs target B compare</h3>
      <Note>Compare two targets' hunts to benchmark security posture.</Note>
      <div className="hd62-row">
        <span className="hd62-chip">A: {r.riskScoreA}</span>
        <span className="hd62-chip">B: {r.riskScoreB}</span>
        <span className="hd62-chip">{r.posture}</span>
      </div>
    </div>
  );
}

/* 52479 — New-findings highlight. */
export function NewFindingsHighlight() {
  const r = HD.highlightNewFindings(HD.diffHunts(HUNT_A, HUNT_B), NOW);
  return (
    <div className="hd62-card">
      <h3 className="hd62-title">52479 · New-findings highlight</h3>
      <Note>New findings get a prominent badge with "first seen" timestamps.</Note>
      <ul className="hd62-list">
        {r.items.map(x => (
          <li key={x.id}>
            <span className="hd62-chip">{x.badge.label}</span> {x.title} ·{' '}
            {new Date(x.firstSeenAt).toISOString().slice(0, 10)}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* 52480 — Fixed-findings highlight. */
export function FixedFindingsHighlight() {
  const diff = HD.diffHunts(
    { ...HUNT_A, id: 'hunt-d', findings: [{ ...F2, state: 'InProgress' }] },
    { ...HUNT_B, id: 'hunt-e', findings: [F2] }
  );
  const r = HD.highlightFixedFindings(diff);
  return (
    <div className="hd62-card">
      <h3 className="hd62-title">52480 · Fixed-findings highlight</h3>
      <Note>Celebrate remediated findings in diffs with fix dates and linked commits.</Note>
      <ul className="hd62-list">
        {r.items.map(x => (
          <li key={x.id}>
            <span className="hd62-chip">{x.badge.label}</span> {x.title}
            {x.commit ? ` · PR #${x.commit.number} merged` : ''}
          </li>
        ))}
      </ul>
    </div>
  );
}

export const HD62_GALLERY = [
  ScopeDiffPreview,
  AutoArchive,
  ComparisonDashboard,
  AllClearCertificate,
  ScheduleViaApi,
  ScheduleViaChat,
  RegressionReminders,
  DigestEmail,
  MultiTargetCampaigns,
  PrLinking,
  FixDiffViewer,
  EvidencePanel,
  VerifiedFixedBadge,
  FixSla,
  SlaBreachAlerts,
  RemediationProgress,
  HuntDiffView,
  TargetCompare,
  NewFindingsHighlight,
  FixedFindingsHighlight,
];

export function HuntDiffGallery() {
  return (
    <div className="hd62-gallery">
      {HD62_GALLERY.map((C, i) => (
        <C key={i} />
      ))}
    </div>
  );
}
