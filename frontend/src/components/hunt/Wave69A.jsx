/**
 * Wave69A.jsx — Infinity AI · Dark-Matter · Wave 69
 * 20 working React components for finding lifecycle states part 1,
 * ideas 52721–52740. Export-only module: components are not mounted
 * anywhere. Pure presentational, props-driven.
 */
import React from 'react';
import * as EA from './wave69ACore.js';

const NOW = '2026-10-09T00:00:00Z';

const DEMO_FINDINGS = [
  { id: 'f1', title: 'SQLi in checkout', severity: 'critical', status: 'verifying', target: 'shop.example.com', owner: 'aarav', assignee: 'meera', riskScore: 92, evidence: ['retest payload still reflects'], history: [{ from: 'new', to: 'triaged', actor: 'analyst-1', at: '2026-10-01T09:00:00Z', reason: 'intake' }, { from: 'triaged', to: 'confirmed', actor: 'lead-1', at: '2026-10-02T09:00:00Z', reason: 'reproduced' }], stateEnteredAt: '2026-10-05T09:00:00Z', createdAt: '2026-10-01T09:00:00Z', dueAt: '2026-10-12T00:00:00Z', slaHours: 48, fixNote: 'PR #61 parameterizes queries', verificationEvidence: 'retest passed on staging', verifiedBy: 'verifier-1' },
  { id: 'f2', title: 'XSS in search', severity: 'high', status: 'fixing', target: 'shop.example.com', owner: 'meera', assignee: 'meera', riskScore: 74, evidence: ['reflected script executed'], history: [{ from: 'new', to: 'triaged', actor: 'analyst-1', at: '2026-10-03T09:00:00Z', reason: 'intake' }], stateEnteredAt: '2026-10-08T09:00:00Z', createdAt: '2026-10-03T09:00:00Z', slaHours: 72, fixNote: 'PR #62 encodes output' },
  { id: 'f3', title: 'Weak TLS on mobile API', severity: 'medium', status: 'new', target: 'api.example.com', owner: 'platform', riskScore: 42, evidence: ['legacy cipher negotiated'], history: [], stateEnteredAt: '2026-10-08T09:00:00Z', createdAt: '2026-10-08T09:00:00Z', slaHours: 72 },
  { id: 'f4', title: 'Verbose errors in profile', severity: 'low', status: 'verified', target: 'shop.example.com', owner: 'meera', riskScore: 21, evidence: ['stack trace in error screen'], history: [{ from: 'verifying', to: 'verified', actor: 'verifier-1', at: '2026-10-07T09:00:00Z', reason: 'retest passed' }], stateEnteredAt: '2026-10-07T09:00:00Z', createdAt: '2026-10-02T09:00:00Z', slaHours: 120, verificationEvidence: 'retest passed', verifiedBy: 'verifier-1', fixNote: 'PR #63 hides stack traces' },
  { id: 'f5', title: 'Legacy auth banner', severity: 'medium', status: 'closed', target: 'shop.example.com', owner: 'aarav', riskScore: 35, evidence: ['version banner'], history: [{ from: 'verifying', to: 'verified', actor: 'verifier-1', at: '2026-10-05T09:00:00Z', reason: 'retest passed' }, { from: 'verified', to: 'closed', actor: 'lead-1', at: '2026-10-06T09:00:00Z', reason: 'verified closure' }], stateEnteredAt: '2026-10-06T09:00:00Z', createdAt: '2026-10-01T09:00:00Z', slaHours: 96, verificationEvidence: 'retest passed', verifiedBy: 'verifier-1', closedBy: 'lead-1', fixNote: 'PR #60 removes banner' },
];

function Card({ title, note, children }) {
  return (
    <div className="w69a-card">
      <div className="w69a-title">{title}</div>
      {note ? <div className="w69a-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w69a-badge w69a-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w69a-kv">
      <span className="w69a-k">{k}</span>
      <span className="w69a-v">{String(v)}</span>
    </div>
  );
}

export function BulkTransitionsPreview() {
  const v = EA.previewBulkTransition(DEMO_FINDINGS, 'triaged', { id: 'lead-1', role: 'lead' });
  return (
    <Card title="Bulk transitions with preview" note="Idea 52721">
      <Kv k="Ready" v={`${v.okCount}/${v.total}`} />
      <Kv k="Blocked" v={v.blockedCount} />
      <div className="w69a-note">{v.summary}</div>
    </Card>
  );
}

export function StateSlaEngine() {
  const v = EA.evaluateStateSla(DEMO_FINDINGS, NOW);
  return (
    <Card title="State SLA engine" note="Idea 52722">
      <Kv k="Breached" v={v.breachedCount} />
      <Kv k="Breached ids" v={v.breachedIds.join(', ') || 'none'} />
      <Kv k="At risk" v={v.atRiskIds.join(', ') || 'none'} />
    </Card>
  );
}

export function KanbanLifecycleBoard() {
  const v = EA.buildLifecycleBoard(DEMO_FINDINGS);
  return (
    <Card title="Kanban lifecycle board" note="Idea 52723">
      <Kv k="Columns" v={v.columnCount} />
      <Kv k="Total" v={v.total} />
      {v.columns.filter(c => c.count > 0).slice(0, 3).map(c => (
        <Kv key={c.state} k={c.state} v={`${c.count} items`} />
      ))}
    </Card>
  );
}

export function FindingStateTimeline() {
  const v = EA.buildStateTimeline(DEMO_FINDINGS[4]);
  return (
    <Card title="Finding state timeline" note="Idea 52724">
      <Kv k="Events" v={v.eventCount} />
      <Kv k="Current" v={v.currentState} />
      <Kv k="Visited" v={v.statesVisited.join(', ') || 'none'} />
    </Card>
  );
}

export function RequiredTransitionReasons() {
  const ok = EA.validateTransitionReason('confirmed', 'dismissed', 'Duplicate coverage exists');
  const no = EA.validateTransitionReason('confirmed', 'dismissed', '');
  return (
    <Card title="Required transition reasons" note="Idea 52725">
      <Kv k="With reason" v={ok.allowed ? 'allowed' : 'blocked'} />
      <Kv k="Without reason" v={no.allowed ? 'allowed' : 'blocked'} />
      <div className="w69a-note">{no.message}</div>
    </Card>
  );
}

export function TransitionUndoWindow() {
  const v = EA.evaluateUndoWindow({ at: '2026-10-09T00:00:00Z' }, '2026-10-09T00:10:00Z', 30);
  return (
    <Card title="Transition undo window" note="Idea 52726">
      <Kv k="Undoable" v={String(v.undoable)} />
      <Kv k="Remaining" v={`${v.remainingMinutes}m`} />
      <Kv k="Expires" v={v.expiresAt || 'none'} />
    </Card>
  );
}

export function AwaitingInfoParking() {
  const v = EA.parkFindingForInfo(DEMO_FINDINGS[1], { actor: 'lead-1', at: NOW, infoRequested: 'Need staging credentials' });
  return (
    <Card title={'"Awaiting info" parking state'} note="Idea 52727">
      <Kv k="Parked" v={String(v.ok)} />
      <Kv k="Previous" v={v.previousState} />
      <Kv k="Requested" v={v.infoRequested} />
    </Card>
  );
}

export function DuplicateLinkingState() {
  const v = EA.linkDuplicateFinding(DEMO_FINDINGS[2], DEMO_FINDINGS[0], { actor: 'lead-1', at: NOW });
  return (
    <Card title="Duplicate-linking state" note="Idea 52728">
      <Kv k="Linked" v={String(v.ok)} />
      <Kv k="Canonical" v={v.canonicalId || 'none'} />
      <Kv k="State" v={v.ok ? v.finding.status : 'unchanged'} />
    </Card>
  );
}

export function RiskAcceptanceExpiry() {
  const v = EA.acceptRiskWithExpiry(DEMO_FINDINGS[1], { acceptedBy: 'security-director', expiresAt: '2026-11-01T00:00:00Z', nowIso: NOW, actor: 'security-director', at: NOW, reason: 'Compensating control in place' });
  return (
    <Card title="Risk-acceptance with expiry" note="Idea 52729">
      <Kv k="Accepted" v={String(v.ok)} />
      <Kv k="Expires" v={v.expiresAt || 'none'} />
      <Kv k="By" v={v.acceptedBy || 'none'} />
    </Card>
  );
}

export function DeferredToDateState() {
  const v = EA.deferFindingToDate(DEMO_FINDINGS[2], { deferredUntil: '2026-10-20T00:00:00Z', nowIso: NOW, actor: 'lead-1', at: NOW, reason: 'Waiting for release window' });
  return (
    <Card title="Deferred-to-date state" note="Idea 52730">
      <Kv k="Deferred" v={String(v.ok)} />
      <Kv k="Until" v={v.deferredUntil || 'none'} />
      <Kv k="Due for review" v={String(v.dueForReview)} />
    </Card>
  );
}

export function BlockedOnVendorState() {
  const v = EA.blockFindingOnVendor(DEMO_FINDINGS[1], { vendorTicket: 'VND-441', vendor: 'PaymentsCo', actor: 'lead-1', at: NOW });
  return (
    <Card title="Blocked-on-vendor state" note="Idea 52731">
      <Kv k="Blocked" v={String(v.ok)} />
      <Kv k="Ticket" v={v.vendorTicket || 'none'} />
      <Kv k="State" v={v.ok ? v.finding.status : 'unchanged'} />
    </Card>
  );
}

export function VerifiedVsClosedSeparation() {
  const v = EA.evaluateVerifiedVsClosed(DEMO_FINDINGS);
  return (
    <Card title="Verified vs closed separation" note="Idea 52732">
      <Kv k="Verified open" v={v.verifiedCount} />
      <Kv k="Closed" v={v.closedCount} />
      <Kv k="Needs closure" v={v.needsClosureCount} />
    </Card>
  );
}

export function ReopenedWithContext() {
  const v = EA.reopenFindingWithContext(DEMO_FINDINGS[4], { actor: 'verifier-1', at: NOW, reason: 'Regression found in production' });
  return (
    <Card title="Reopened-with-context state" note="Idea 52733">
      <Kv k="Reopened" v={String(v.ok)} />
      <Kv k="Previous" v={v.previousState} />
      <Kv k="History kept" v={v.preservedContext ? v.preservedContext.historyLength : 0} />
    </Card>
  );
}

export function RetestAutoTransitions() {
  const v = EA.applyRetestResult(DEMO_FINDINGS[0], { outcome: 'passed', at: NOW, actor: 'verifier-1', evidence: 'retest passed 2026-10-09' });
  return (
    <Card title="Retest-driven auto-transitions" note="Idea 52734">
      <Kv k="Changed" v={String(v.changed)} />
      <Kv k="Move" v={`${v.from} -> ${v.to}`} />
    </Card>
  );
}

export function TransitionWebhooks() {
  const v = EA.buildTransitionWebhooks([{ findingId: 'f1', from: 'verifying', to: 'verified', actor: 'verifier-1', at: NOW }], { url: 'https://hooks.example.com/lifecycle', states: ['verified', 'closed'] });
  return (
    <Card title="Transition webhooks" note="Idea 52735">
      <Kv k="Payloads" v={v.count} />
      <Kv k="Endpoint" v={v.endpoint || 'none'} />
      <Kv k="Event" v={v.webhooks[0] ? v.webhooks[0].event : 'none'} />
    </Card>
  );
}

export function LifecycleRestApi() {
  const v = EA.buildLifecycleApiResponse(DEMO_FINDINGS, { page: 1, pageSize: 3, sort: 'severity' });
  return (
    <Card title="Lifecycle REST API" note="Idea 52736">
      <Kv k="Total" v={v.total} />
      <Kv k="Page items" v={v.items.map(i => i.id).join(', ') || 'none'} />
    </Card>
  );
}

export function SmartStateViews() {
  const v = EA.buildSmartStateView(DEMO_FINDINGS, 'needs-attention', NOW);
  return (
    <Card title="Smart state views" note="Idea 52737">
      <Kv k="View" v={v.view} />
      <Kv k="Count" v={v.count} />
      <Kv k="Ids" v={v.findingIds.join(', ') || 'none'} />
    </Card>
  );
}

export function StateTriggeredEmails() {
  const v = EA.buildStateTriggeredEmail({ findingId: 'f1', title: 'SQLi in checkout', from: 'verifying', to: 'verified', actor: 'verifier-1', severity: 'critical', owner: 'aarav@example.com' }, 'aarav@example.com');
  return (
    <Card title="State-triggered emails" note="Idea 52738">
      <Kv k="To" v={v.to} />
      <div className="w69a-subject">{v.subject}</div>
      <Kv k="Trigger" v={v.triggerState} />
    </Card>
  );
}

export function StateFilteredExports() {
  const v = EA.exportFindingsByState(DEMO_FINDINGS, 'verified', 'csv');
  return (
    <Card title="State-filtered exports" note="Idea 52739">
      <Kv k="File" v={v.filename} />
      <Kv k="Rows" v={v.rows} />
      <Kv k="Checksum" v={v.checksum} />
    </Card>
  );
}

export function StateAgingAnalytics() {
  const v = EA.computeStateAging(DEMO_FINDINGS, NOW);
  return (
    <Card title="State aging analytics" note="Idea 52740">
      <Kv k="Total" v={v.total} />
      <Kv k="Oldest" v={v.oldestFindingId || 'none'} />
      <Kv k="States" v={Object.keys(v.byState).length} />
    </Card>
  );
}

/** Gallery: all 20 idea-52721–52740 components, export-only. */
export function Wave69AGallery() {
  return (
    <div className="w69a-gallery">
      <BulkTransitionsPreview />
      <StateSlaEngine />
      <KanbanLifecycleBoard />
      <FindingStateTimeline />
      <RequiredTransitionReasons />
      <TransitionUndoWindow />
      <AwaitingInfoParking />
      <DuplicateLinkingState />
      <RiskAcceptanceExpiry />
      <DeferredToDateState />
      <BlockedOnVendorState />
      <VerifiedVsClosedSeparation />
      <ReopenedWithContext />
      <RetestAutoTransitions />
      <TransitionWebhooks />
      <LifecycleRestApi />
      <SmartStateViews />
      <StateTriggeredEmails />
      <StateFilteredExports />
      <StateAgingAnalytics />
    </div>
  );
}
