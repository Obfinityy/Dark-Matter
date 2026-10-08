/**
 * Wave70A.jsx — Infinity AI · Dark-Matter · Wave 70
 * 20 working React components for finding lifecycle round 6 and
 * bulk actions part 1, ideas 52761–52780. Export-only module:
 * components are not mounted anywhere. Pure presentational,
 * props-driven.
 */
import React from 'react';
import * as EA from './wave70ACore.js';

const NOW = '2026-10-09T00:00:00Z';

const DEMO_FINDINGS = [
  { id: 'f1', title: 'SQLi in checkout', severity: 'critical', status: 'verifying', target: 'shop.example.com', owner: 'aarav', assignee: 'meera', riskScore: 92, tags: ['checkout', 'sqli'], watchers: ['aarav'], evidence: ['retest payload still reflects'], comments: [{ author: 'lead-1', text: 'General note on checkout scope', at: '2026-10-04T09:00:00Z' }], history: [{ from: 'new', to: 'triaged', actor: 'analyst-1', at: '2026-10-01T09:00:00Z', reason: 'intake' }, { from: 'closed', to: 'reopened', actor: 'verifier-1', at: '2026-10-03T09:00:00Z', reason: 'regression', comments: [{ author: 'verifier-1', text: 'Still exploitable on staging', at: '2026-10-03T09:05:00Z' }] }, { from: 'closed', to: 'reopened', actor: 'verifier-1', at: '2026-10-05T09:00:00Z', reason: 'regression again' }, { from: 'verifying', to: 'verified', actor: 'verifier-1', at: '2026-10-06T09:00:00Z', reason: 'retest passed' }, { from: 'verified', to: 'closed', actor: 'lead-1', at: '2026-10-07T09:00:00Z', reason: 'verified closure' }], stateEnteredAt: '2026-10-05T09:00:00Z', createdAt: '2026-10-01T09:00:00Z', slaHours: 48, fixNote: 'PR #61 parameterizes queries', verificationEvidence: 'retest passed on staging', verifiedBy: 'verifier-1' },
  { id: 'f2', title: 'XSS in search', severity: 'high', status: 'fixing', target: 'shop.example.com', owner: 'meera', assignee: 'meera', riskScore: 74, tags: ['search'], watchers: [], evidence: ['reflected script executed'], history: [{ from: 'new', to: 'triaged', actor: 'analyst-1', at: '2026-10-03T09:00:00Z', reason: 'intake' }, { from: 'triaged', to: 'confirmed', actor: 'lead-1', at: '2026-10-04T09:00:00Z', reason: 'reproduced' }], stateEnteredAt: '2026-10-08T09:00:00Z', createdAt: '2026-10-03T09:00:00Z', slaHours: 72, fixNote: 'PR #62 encodes output' },
  { id: 'f3', title: 'Weak TLS on mobile API', severity: 'medium', status: 'triaged', target: 'api.example.com', owner: 'platform', riskScore: 42, tags: [], watchers: [], evidence: ['legacy cipher negotiated'], history: [{ from: 'new', to: 'triaged', actor: 'analyst-1', at: '2026-10-08T09:00:00Z', reason: 'intake' }], stateEnteredAt: '2026-10-08T09:00:00Z', createdAt: '2026-10-08T09:00:00Z', slaHours: 72 },
  { id: 'f4', title: 'Verbose errors in profile', severity: 'low', status: 'verified', target: 'shop.example.com', owner: 'meera', riskScore: 21, tags: ['profile'], watchers: ['meera'], evidence: ['stack trace in error screen'], history: [{ from: 'verifying', to: 'verified', actor: 'verifier-1', at: '2026-10-07T09:00:00Z', reason: 'retest passed' }], stateEnteredAt: '2026-10-07T09:00:00Z', createdAt: '2026-10-02T09:00:00Z', slaHours: 120, verificationEvidence: 'retest passed', verifiedBy: 'verifier-1', fixNote: 'PR #63 hides stack traces' },
  { id: 'f5', title: 'Legacy auth banner', severity: 'medium', status: 'closed', target: 'shop.example.com', owner: 'aarav', riskScore: 35, tags: ['auth'], watchers: [], evidence: ['version banner'], history: [{ from: 'verified', to: 'closed', actor: 'lead-1', at: '2026-10-06T09:00:00Z', reason: 'verified closure' }], stateEnteredAt: '2026-10-06T09:00:00Z', createdAt: '2026-10-01T09:00:00Z', slaHours: 96, verificationEvidence: 'retest passed', verifiedBy: 'verifier-1', fixNote: 'PR #60 removes banner' },
];

function Card({ title, note, children }) {
  return (
    <div className="w70a-card">
      <div className="w70a-title">{title}</div>
      {note ? <div className="w70a-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w70a-badge w70a-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w70a-kv">
      <span className="w70a-k">{k}</span>
      <span className="w70a-v">{String(v)}</span>
    </div>
  );
}

export function HistoricalStateSearch() {
  const v = EA.searchHistoricalStates(DEMO_FINDINGS, { states: ['reopened'], minVisits: 2 });
  return (
    <Card title="Historical state search" note="Idea 52761">
      <Kv k="Matches" v={v.count} />
      <Kv k="Ids" v={v.matches.map(m => m.id).join(', ') || 'none'} />
      <Kv k="Reopened top" v={v.matches[0] ? v.matches[0].reopenedCount : 0} />
    </Card>
  );
}

export function AutoAssignOnStateEntry() {
  const v = EA.autoAssignOnStateEntry(DEMO_FINDINGS[1], { fixing: { 'shop.example.com': 'aarav', default: 'platform' } }, { enteredState: 'fixing', at: NOW });
  return (
    <Card title="Auto-assign on state entry" note="Idea 52762">
      <Kv k="Assigned" v={String(v.assigned)} />
      <Kv k="Assignee" v={v.assignee || 'none'} />
      <Kv k="Rule" v={v.rule} />
    </Card>
  );
}

export function ThroughputLeaderboard() {
  const v = EA.buildThroughputLeaderboard(DEMO_FINDINGS, { participants: ['lead-1', 'verifier-1'] });
  return (
    <Card title="Throughput leaderboard" note="Idea 52763">
      <Kv k="Ranked" v={v.count} />
      {v.leaderboard.slice(0, 2).map(row => (
        <Kv key={row.actor} k={row.actor} v={`${row.advanced} advanced`} />
      ))}
    </Card>
  );
}

export function TransitionCommentThreads() {
  const v = EA.buildTransitionThreads(DEMO_FINDINGS[0]);
  return (
    <Card title="Transition comment threads" note="Idea 52764">
      <Kv k="Threads" v={v.threadCount} />
      <Kv k="Transition comments" v={v.transitionCommentCount} />
      <Kv k="General" v={v.generalComments.length} />
    </Card>
  );
}

export function RecurringStateReviewMeetings() {
  const v = EA.buildReviewMeetingAgenda(DEMO_FINDINGS, { nowIso: NOW, title: 'Weekly state review' });
  return (
    <Card title="Recurring state-review meetings" note="Idea 52765">
      <Kv k="Agenda items" v={v.count} />
      <Kv k="First" v={v.items[0] ? v.items[0].id : 'none'} />
      <Kv k="States" v={Object.keys(v.byState).join(', ') || 'none'} />
    </Card>
  );
}

export function EmbeddableStateWidgets() {
  const v = EA.buildStateWidgetPayload(DEMO_FINDINGS, NOW, { huntId: 'hunt-42' });
  return (
    <Card title="Embeddable state widgets" note="Idea 52766">
      <Kv k="Widget" v={v.widgetId} />
      <Kv k="Total" v={v.total} />
      <Kv k="Avg age h" v={v.avgAgeHours} />
    </Card>
  );
}

export function TransitionReasonTemplates() {
  const v = EA.getTransitionReasonTemplates('dismissed', { findingId: 'f2' });
  return (
    <Card title="Transition reason templates" note="Idea 52767">
      <Kv k="Templates" v={v.count} />
      <Kv k="First" v={v.templates[0] ? v.templates[0].label : 'none'} />
      <div className="w70a-note">{v.templates[0] ? v.templates[0].text : ''}</div>
    </Card>
  );
}

export function StateBasedAssignmentRotation() {
  const v = EA.rotateTriagedAssignments(DEMO_FINDINGS, ['aarav', 'meera'], {});
  return (
    <Card title="State-based assignment rotation" note="Idea 52768">
      <Kv k="Assigned" v={v.count} />
      {v.assignments.slice(0, 2).map(a => (
        <Kv key={a.id} k={a.id} v={a.assignee} />
      ))}
    </Card>
  );
}

export function CrossHuntStateRollups() {
  const v = EA.buildCrossHuntRollups([{ huntId: 'hunt-42', findings: DEMO_FINDINGS }, { huntId: 'hunt-43', findings: [DEMO_FINDINGS[2]] }]);
  return (
    <Card title="Cross-hunt state rollups" note="Idea 52769">
      <Kv k="Hunts" v={v.huntCount} />
      <Kv k="Findings" v={v.totalFindings} />
      <Kv k="Closed" v={v.byState.closed || 0} />
    </Card>
  );
}

export function StateChangeDigest() {
  const v = EA.buildStateChangeDigest([
    { findingId: 'f1', huntId: 'hunt-42', from: 'verifying', to: 'verified', actor: 'verifier-1', at: NOW },
    { findingId: 'f2', huntId: 'hunt-42', from: 'triaged', to: 'confirmed', actor: 'lead-1', at: NOW },
    { findingId: 'f3', huntId: 'hunt-99', from: 'new', to: 'triaged', actor: 'analyst-1', at: NOW },
  ], { date: '2026-10-09', watchedHunts: ['hunt-42'] });
  return (
    <Card title="State-change digest" note="Idea 52770">
      <Kv k="Changes" v={v.count} />
      <Kv k="Verified" v={v.byState.verified || 0} />
      <div className="w70a-note">{v.summary}</div>
    </Card>
  );
}

export function LifecycleComplianceMapping() {
  const v = EA.mapLifecycleToCompliance(DEMO_FINDINGS, { framework: 'soc2' });
  return (
    <Card title="Lifecycle compliance mapping" note="Idea 52771">
      <Kv k="Framework" v={v.framework} />
      <Kv k="Covered" v={v.coveredStates.join(', ') || 'none'} />
      <Kv k="Unmapped" v={v.unmappedStates.join(', ') || 'none'} />
    </Card>
  );
}

export function InboxMultiSelectCheckboxes() {
  const v = EA.updateInboxSelection(['f1'], DEMO_FINDINGS, { type: 'select-page' });
  return (
    <Card title="Inbox multi-select checkboxes" note="Idea 52772">
      <Kv k="Selected" v={v.selectedCount} />
      <Kv k="Page selected" v={v.pageSelectedCount} />
      <Kv k="All page" v={String(v.allPageSelected)} />
    </Card>
  );
}

export function FilterThenSelectAll() {
  const v = EA.selectAllMatchingFilter(DEMO_FINDINGS, { state: 'verified' }, ['f1']);
  return (
    <Card title="Filter-then-select-all" note="Idea 52773">
      <Kv k="Matched" v={v.count} />
      <Kv k="Ids" v={v.matchedIds.join(', ') || 'none'} />
      <Kv k="Merged" v={v.mergedCount} />
    </Card>
  );
}

export function BulkSeverityReassignment() {
  const v = EA.bulkChangeSeverity([DEMO_FINDINGS[2]], 'high', { justification: 'Exploit path confirmed in review', actor: 'lead-1', at: NOW });
  return (
    <Card title="Bulk severity reassignment" note="Idea 52774">
      <Kv k="Changed" v={v.changedIds.join(', ') || 'none'} />
      <Kv k="Was" v={v.fromSeverities.f3 || 'none'} />
      <Kv k="Now" v={v.updated[0] ? v.updated[0].severity : 'none'} />
    </Card>
  );
}

export function BulkOwnerAssignment() {
  const v = EA.bulkAssignOwners(DEMO_FINDINGS.slice(0, 3), ['aarav', 'meera'], { actor: 'lead-1', at: NOW });
  return (
    <Card title="Bulk owner assignment" note="Idea 52775">
      <Kv k="Assigned" v={v.count} />
      {v.assignments.slice(0, 2).map(a => (
        <Kv key={a.id} k={a.id} v={a.owner} />
      ))}
    </Card>
  );
}

export function BulkTaggingPostHunt() {
  const v = EA.bulkUpdateTags(DEMO_FINDINGS.slice(0, 2), { add: ['post-hunt'], remove: ['search'], actor: 'lead-1', at: NOW });
  return (
    <Card title="Bulk tagging (post-hunt)" note="Idea 52776">
      <Kv k="Changed" v={v.count} />
      <Kv k="Added" v={v.addedTags.join(', ') || 'none'} />
      <Kv k="Tags f1" v={v.updated[0] ? v.updated[0].tags.join(', ') : 'none'} />
    </Card>
  );
}

export function BatchLifecycleTransitions() {
  const v = EA.batchTransitionFindings([DEMO_FINDINGS[2]], 'confirmed', { actor: 'lead-1', at: NOW, reason: 'Batch triage review complete', confirmed: true });
  return (
    <Card title="Batch lifecycle transitions" note="Idea 52777">
      <Kv k="Moved" v={v.okCount} />
      <Kv k="Blocked" v={v.blockedCount} />
      <div className="w70a-note">{v.summary}</div>
    </Card>
  );
}

export function BulkFpDismissal() {
  const v = EA.bulkDismissAsFalsePositive([DEMO_FINDINGS[2]], { reason: 'Scanner artefact confirmed as false positive', actor: 'lead-1', at: NOW });
  return (
    <Card title="Bulk FP dismissal" note="Idea 52778">
      <Kv k="Dismissed" v={v.dismissedIds.join(', ') || 'none'} />
      <Kv k="Blocked" v={v.blocked.length} />
      <Kv k="Kind" v={v.dismissed[0] ? v.dismissed[0].dismissalKind : 'none'} />
    </Card>
  );
}

export function SelectionWideRetestQueueing() {
  const v = EA.queueSelectionRetests(DEMO_FINDINGS, { requestedBy: 'verifier-1', at: NOW });
  return (
    <Card title="Selection-wide retest queueing" note="Idea 52779">
      <Kv k="Queued" v={v.count} />
      <Kv k="Ids" v={v.queuedIds.join(', ') || 'none'} />
      <Kv k="Skipped" v={v.skipped.length} />
    </Card>
  );
}

export function BulkExportPostHunt() {
  const v = EA.exportSelectionBulk(DEMO_FINDINGS, 'csv', {});
  return (
    <Card title="Bulk export (post-hunt)" note="Idea 52780">
      <Kv k="File" v={v.filename} />
      <Kv k="Rows" v={v.rows} />
      <Kv k="Checksum" v={v.checksum} />
    </Card>
  );
}

/** Gallery: all 20 idea-52761–52780 components, export-only. */
export function Wave70AGallery() {
  return (
    <div className="w70a-gallery">
      <HistoricalStateSearch />
      <AutoAssignOnStateEntry />
      <ThroughputLeaderboard />
      <TransitionCommentThreads />
      <RecurringStateReviewMeetings />
      <EmbeddableStateWidgets />
      <TransitionReasonTemplates />
      <StateBasedAssignmentRotation />
      <CrossHuntStateRollups />
      <StateChangeDigest />
      <LifecycleComplianceMapping />
      <InboxMultiSelectCheckboxes />
      <FilterThenSelectAll />
      <BulkSeverityReassignment />
      <BulkOwnerAssignment />
      <BulkTaggingPostHunt />
      <BatchLifecycleTransitions />
      <BulkFpDismissal />
      <SelectionWideRetestQueueing />
      <BulkExportPostHunt />
    </div>
  );
}
