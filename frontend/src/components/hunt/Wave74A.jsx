/**
 * Wave74A.jsx — Infinity AI · Dark-Matter · Wave 74
 * 20 working React components for reopen restoration and
 * continuity, ideas 52921–52940. Export-only module: components
 * are not mounted anywhere. Pure presentational, props-driven.
 */
import React from 'react';
import * as XA from './wave74ACore.js';

const NOW = '2026-10-09T00:00:00Z';

const DEMO_FINDINGS = [
  { id: 'f1', title: 'SQLi in checkout', severity: 'critical', status: 'confirmed', target: 'shop.example.com/checkout' },
  { id: 'f3', title: 'IDOR in invoices', severity: 'high', status: 'triaged', target: 'api.example.com/invoices/1001' },
];

const DEMO_HUNT = {
  huntId: 'hunt-42',
  target: 'shop.example.com',
  status: 'open',
  closedAt: '2026-09-20T09:00:00Z',
  createdAt: '2026-09-01T09:00:00Z',
  owner: 'lead-1',
  watchers: ['lead-1', 'analyst-1'],
  assignees: ['meera'],
  reopenedAt: '2026-10-05T09:00:00Z',
  lastReopenedAt: '2026-10-05T09:00:00Z',
  reopenCount: 1,
  reopenHistory: [{ at: '2026-10-05T09:00:00Z', reason: 'Regression detected in checkout after the deploy.', category: 'regression' }],
  findings: DEMO_FINDINGS,
  decisions: [{ findingId: 'f1', decision: 'confirmed', by: 'lead-1' }, { findingId: 'f3', decision: 'triaged', by: 'analyst-1' }],
  qaHistory: [{ id: 'qa-1', question: 'Which checkout finding is critical?', answer: 'The checkout SQL issue is critical.', findingId: 'f1' }],
  ticketLinks: [{ id: 'PROJ-101', system: 'jira', url: 'https://tracker.example.com/browse/PROJ-101' }],
  shareLinks: [{ id: 'share-1', url: 'https://app.infinity-ai.example/share/qa/hunt-42', permission: 'view', expiresAt: '2026-11-01T00:00:00Z' }],
  schedules: [{ id: 'sched-1', huntId: 'hunt-42', status: 'paused', cadence: 'weekly' }],
  scope: { include: ['shop.example.com', 'api.example.com'], exclude: ['admin.example.com'] },
  techStack: ['node', 'postgres'],
  chapters: [
    { number: 1, kind: 'original', openedAt: '2026-09-01T09:00:00Z', closedAt: '2026-09-20T09:00:00Z', findingCount: 2 },
    { number: 2, kind: 'reopen', openedAt: '2026-10-05T09:00:00Z', closedAt: null, findingCount: 0 },
  ],
  snapshot: { huntId: 'hunt-42', closedAt: '2026-09-20T09:00:00Z', findings: DEMO_FINDINGS, decisions: [{ findingId: 'f1', decision: 'confirmed' }], findingCount: 2 },
  stats: { requests: 1240, durationMinutes: 95, engines: ['recon', 'vuln-scan'] },
  engines: ['recon', 'vuln-scan'],
};

function Card({ title, note, children }) {
  return (
    <div className="w74a-card">
      <div className="w74a-title">{title}</div>
      {note ? <div className="w74a-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w74a-badge w74a-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w74a-kv">
      <span className="w74a-k">{k}</span>
      <span className="w74a-v">{String(v)}</span>
    </div>
  );
}

export function ShareRestorationOnReopen() {
  const v = XA.restoreShareLinksOnReopen(DEMO_HUNT, DEMO_HUNT.shareLinks, { now: NOW });
  return (
    <Card title="Share-restoration on reopen" note="Idea 52921">
      <Kv k="Restored" v={v.restoredCount} />
      <Kv k="Blocked" v={v.blockedCount} />
      <div className="w74a-row"><Badge tone={v.restoredCount ? 'ok' : 'info'}>links checked</Badge></div>
    </Card>
  );
}

export function ScheduleRestorationOnReopen() {
  const v = XA.restoreSchedulesOnReopen(DEMO_HUNT, DEMO_HUNT.schedules, { now: NOW });
  return (
    <Card title="Schedule-restoration on reopen" note="Idea 52922">
      <Kv k="Resumed" v={v.resumedCount} />
      <Kv k="Cadence" v={v.resumed[0] ? v.resumed[0].cadence : 'none'} />
    </Card>
  );
}

export function TicketLinkPreservation() {
  const v = XA.preserveTicketLinks(DEMO_HUNT, DEMO_HUNT.ticketLinks, { reason: 'Regression detected in checkout.' });
  return (
    <Card title="Ticket-link preservation" note="Idea 52923">
      <Kv k="Links" v={v.preservedCount} />
      <Kv k="Intact" v={String(v.intact)} />
      <div className="w74a-note">{v.links[0] ? v.links[0].id : 'none'}</div>
    </Card>
  );
}

export function StakeholderViewRefresh() {
  const v = XA.refreshStakeholderViews(DEMO_HUNT, [{ id: 'exec', audience: 'leadership' }, { id: 'eng', audience: 'engineering' }], { now: NOW });
  return (
    <Card title="Stakeholder-view refresh" note="Idea 52924">
      <Kv k="Views" v={v.viewCount} />
      <Kv k="Findings" v={v.views[0] ? v.views[0].findingCount : 0} />
    </Card>
  );
}

export function QaContextRestoration() {
  const v = XA.restoreQaContext(DEMO_HUNT, DEMO_HUNT.qaHistory, {});
  return (
    <Card title="Q&A context restoration" note="Idea 52925">
      <Kv k="Exchanges" v={v.entryCount} />
      <Kv k="Findings" v={v.findingIds.join(', ') || 'none'} />
      <div className="w74a-row"><Badge tone={v.restored ? 'ok' : 'info'}>{v.restored ? 'restored' : 'empty'}</Badge></div>
    </Card>
  );
}

export function AgentBriefingOnReopen() {
  const v = XA.briefOnReopen(DEMO_HUNT, DEMO_HUNT.snapshot, { now: NOW });
  return (
    <Card title="Agent briefing on reopen" note="Idea 52926">
      <Kv k="Added" v={v.addedCount} />
      <Kv k="Away days" v={v.awayDays} />
      <div className="w74a-note">{v.bullets[0].slice(0, 60)}</div>
    </Card>
  );
}

export function AutoSuggestReopenOnAssetChange() {
  const v = XA.suggestReopenOnAssetChange({ beforeStack: ['node', 'postgres'], afterStack: ['node', 'postgres', 'stripe'] }, { ...DEMO_HUNT, status: 'closed' }, {});
  return (
    <Card title="Auto-suggest reopen on asset change" note="Idea 52927">
      <Kv k="Suggest" v={String(v.suggest)} />
      <Kv k="Score" v={v.score} />
      <Kv k="Gained" v={v.addedStack.join(', ') || 'none'} />
    </Card>
  );
}

export function ReopenReminders() {
  const v = XA.buildReopenReminders([{ huntId: 'hunt-42', owner: 'lead-1', target: 'shop.example.com', reopenAfter: '2026-10-01T09:00:00Z' }], { now: NOW });
  return (
    <Card title="Reopen reminders" note="Idea 52928">
      <Kv k="Due" v={v.count} />
      <Kv k="Owner" v={v.reminders[0] ? v.reminders[0].owner : 'none'} />
    </Card>
  );
}

export function ReopenDigest() {
  const v = XA.buildReopenDigest([DEMO_HUNT], { now: NOW });
  return (
    <Card title="Reopen digest" note="Idea 52929">
      <Kv k="Reopened" v={v.count} />
      <Kv k="Window days" v={v.windowDays} />
      <div className="w74a-note">{v.entries[0] ? v.entries[0].huntId : 'none'}</div>
    </Card>
  );
}

export function MobileReopen() {
  const v = XA.planMobileReopen(DEMO_HUNT, { reason: 'Regression detected in checkout after the deploy.', role: 'analyst' }, { now: NOW });
  return (
    <Card title="Mobile reopen" note="Idea 52930">
      <Kv k="Ready" v={String(v.ready)} />
      <Kv k="Steps" v={v.steps.length} />
      <div className="w74a-row"><Badge tone={v.needsApproval ? 'warn' : 'ok'}>{v.needsApproval ? 'needs approval' : 'direct'}</Badge></div>
    </Card>
  );
}

export function TriageDecisionPreservation() {
  const v = XA.preserveTriageDecisions(DEMO_HUNT, DEMO_HUNT.decisions, {});
  return (
    <Card title="Triage-decision preservation" note="Idea 52931">
      <Kv k="Decisions" v={v.decisionCount} />
      <Kv k="Untouched" v={String(v.untouched)} />
    </Card>
  );
}

export function SlaResetOptionOnReopen() {
  const v = XA.planSlaOnReopen(DEMO_HUNT, { mode: 'reset', triageHours: 24, fixHours: 120 }, { now: NOW });
  return (
    <Card title="SLA reset option on reopen" note="Idea 52932">
      <Kv k="Mode" v={v.mode} />
      <Kv k="Triage h" v={v.triageHours} />
      <div className="w74a-note">{String(v.triageDue).slice(0, 10)}</div>
    </Card>
  );
}

export function CloseReopenHistoryExport() {
  const v = XA.exportCloseReopenHistory(DEMO_HUNT, { format: 'markdown' });
  return (
    <Card title="Close-reopen history export" note="Idea 52933">
      <Kv k="Events" v={v.eventCount} />
      <Kv k="File" v={v.filename} />
    </Card>
  );
}

export function ComplianceNoteOnReopen() {
  const v = XA.buildComplianceNoteOnReopen(DEMO_HUNT, { actor: 'lead-1', reason: 'Continued due diligence after new intel.', at: NOW }, { now: NOW });
  return (
    <Card title="Compliance note on reopen" note="Idea 52934">
      <Kv k="Ready" v={String(v.complianceReady)} />
      <Kv k="By" v={v.reopenedBy} />
      <div className="w74a-row"><Badge tone={v.complianceReady ? 'ok' : 'warn'}>compliance</Badge></div>
    </Card>
  );
}

export function DuplicateReopenGuard() {
  const v = XA.checkDuplicateReopen({ ...DEMO_HUNT, status: 'open' }, [{ huntId: 'hunt-42', requestedBy: 'analyst-1' }], {});
  return (
    <Card title="Duplicate-reopen guard" note="Idea 52935">
      <Kv k="Duplicate" v={String(v.duplicate)} />
      <Kv k="Pending" v={v.pendingCount} />
      <div className="w74a-row"><Badge tone={v.duplicate ? 'danger' : 'ok'}>{v.duplicate ? 'blocked' : 'clear'}</Badge></div>
    </Card>
  );
}

export function ReopenConflictResolution() {
  const v = XA.resolveReopenConflicts([
    { huntId: 'hunt-42', requestedBy: 'lead-1', reason: 'Regression detected in checkout.', at: '2026-10-08T09:00:00Z' },
    { huntId: 'hunt-42', requestedBy: 'analyst-1', reason: 'New intel matches this stack and needs review.', at: '2026-10-08T09:05:00Z' },
  ], {});
  return (
    <Card title="Reopen conflict resolution" note="Idea 52936">
      <Kv k="Merged" v={v.merged.length} />
      <Kv k="Conflicts" v={v.conflictCount} />
      <Kv k="Requesters" v={v.merged[0] ? v.merged[0].requesters.join(', ') : 'none'} />
    </Card>
  );
}

export function PlatformStatusReopen() {
  const v = XA.handlePlatformStatusReopen({ platform: 'bounty-platform', reportId: 'rep-9', status: 'reopened' }, DEMO_HUNT, {});
  return (
    <Card title="Platform-status reopen" note="Idea 52937">
      <Kv k="Triggers" v={String(v.triggersReopen)} />
      <Kv k="Report" v={v.reportId || 'none'} />
      <div className="w74a-note">{v.action}</div>
    </Card>
  );
}

export function FpDisputeReopen() {
  const v = XA.reopenFindingOnFpDispute({ findingId: 'f3', outcome: 'upheld', evidence: 'Live request replay confirmed the issue.' }, DEMO_HUNT, {});
  return (
    <Card title="FP-dispute reopen" note="Idea 52938">
      <Kv k="Finding" v={v.findingId || 'none'} />
      <Kv k="Status" v={v.findingStatus} />
      <div className="w74a-row"><Badge tone={v.successful ? 'ok' : 'info'}>{v.action}</Badge></div>
    </Card>
  );
}

export function ResearcherAppealReopen() {
  const v = XA.routeResearcherAppeal({ id: 'appeal-1', researcher: 'external-researcher', grounds: 'Finding is exploitable with a chained request.', evidence: 'video proof attached' }, DEMO_HUNT, {});
  return (
    <Card title="Researcher-appeal reopen" note="Idea 52939">
      <Kv k="Queue" v={v.queue} />
      <Kv k="Complete" v={String(v.complete)} />
      <div className="w74a-note">{v.researcher}</div>
    </Card>
  );
}

export function ReopenTemplates() {
  const v = XA.listReopenTemplates({ templateId: 'regression-quick', context: { baseScope: ['shop.example.com'] } });
  return (
    <Card title="Reopen templates" note="Idea 52940">
      <Kv k="Templates" v={v.count} />
      <Kv k="Picked" v={v.applied ? v.applied.label : 'none'} />
      <div className="w74a-note">{v.applied ? v.applied.engines.join(', ') : 'none'}</div>
      <div className="w74a-row"><Badge tone="info">{`checked ${NOW.slice(0, 10)}`}</Badge></div>
    </Card>
  );
}

/** Gallery list: all 20 idea-52921–52940 components, export-only. */
export const W74_A_GALLERY = [
  ShareRestorationOnReopen,
  ScheduleRestorationOnReopen,
  TicketLinkPreservation,
  StakeholderViewRefresh,
  QaContextRestoration,
  AgentBriefingOnReopen,
  AutoSuggestReopenOnAssetChange,
  ReopenReminders,
  ReopenDigest,
  MobileReopen,
  TriageDecisionPreservation,
  SlaResetOptionOnReopen,
  CloseReopenHistoryExport,
  ComplianceNoteOnReopen,
  DuplicateReopenGuard,
  ReopenConflictResolution,
  PlatformStatusReopen,
  FpDisputeReopen,
  ResearcherAppealReopen,
  ReopenTemplates,
];

/** Gallery: renders every Wave 74A component, export-only. */
export function Wave74AGallery() {
  return (
    <div className="w74a-gallery">
      {W74_A_GALLERY.map((C, i) => (
        <C key={i} />
      ))}
    </div>
  );
}
