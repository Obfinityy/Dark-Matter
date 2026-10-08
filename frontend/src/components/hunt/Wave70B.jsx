/**
 * Wave70B.jsx — Infinity AI · Dark-Matter · Wave 70
 * 20 working React components for bulk actions part 2,
 * ideas 52781–52800. Export-only module: components are not
 * mounted anywhere. Pure presentational, props-driven.
 */
import React from 'react';
import * as EB from './wave70BCores.js';

const NOW = '2026-10-09T00:00:00Z';

const DEMO_FINDINGS = [
  { id: 'f1', title: 'SQLi in checkout', severity: 'critical', status: 'verifying', huntId: 'hunt-42', target: 'shop.example.com', owner: 'aarav', riskScore: 92, tags: ['checkout'], watchers: ['aarav'], comments: [], evidence: ['retest payload still reflects'], history: [{ from: 'fixing', to: 'verifying', actor: 'meera', at: '2026-10-05T09:00:00Z', reason: 'fix ready' }], stateEnteredAt: '2026-10-05T09:00:00Z', createdAt: '2026-10-01T09:00:00Z', slaHours: 48, fixNote: 'PR #61 parameterizes queries', verificationEvidence: 'retest passed on staging', verifiedBy: 'verifier-1' },
  { id: 'f2', title: 'XSS in search', severity: 'high', status: 'fixing', huntId: 'hunt-42', target: 'shop.example.com', owner: 'meera', riskScore: 74, tags: ['search'], watchers: [], comments: [], evidence: ['reflected script executed'], history: [{ from: 'new', to: 'triaged', actor: 'analyst-1', at: '2026-10-03T09:00:00Z', reason: 'intake' }], stateEnteredAt: '2026-10-08T09:00:00Z', createdAt: '2026-10-03T09:00:00Z', slaHours: 72, fixNote: 'PR #62 encodes output', dueAt: '2026-10-15T00:00:00Z' },
  { id: 'f3', title: 'Weak TLS on mobile API', severity: 'medium', status: 'new', huntId: 'hunt-42', target: 'api.example.com', owner: 'platform', riskScore: 42, tags: [], watchers: [], comments: [], evidence: [], history: [], stateEnteredAt: '2026-10-08T09:00:00Z', createdAt: '2026-10-08T09:00:00Z', slaHours: 72 },
  { id: 'f4', title: 'Verbose errors in profile', severity: 'low', status: 'verified', huntId: 'hunt-42', target: 'shop.example.com', owner: 'meera', riskScore: 21, tags: ['profile'], watchers: ['meera'], comments: [], evidence: ['stack trace in error screen'], history: [{ from: 'verifying', to: 'verified', actor: 'verifier-1', at: '2026-10-07T09:00:00Z', reason: 'retest passed' }], stateEnteredAt: '2026-10-07T09:00:00Z', createdAt: '2026-10-06T09:00:00Z', slaHours: 120, verificationEvidence: 'retest passed', verifiedBy: 'verifier-1' },
  { id: 'f5', title: 'Legacy auth banner', severity: 'medium', status: 'closed', huntId: 'hunt-42', target: 'shop.example.com', owner: 'aarav', riskScore: 35, tags: ['auth'], watchers: [], comments: [], evidence: ['version banner'], history: [{ from: 'verified', to: 'closed', actor: 'lead-1', at: '2026-10-06T09:00:00Z', reason: 'verified closure' }], stateEnteredAt: '2026-10-06T09:00:00Z', createdAt: '2026-10-02T09:00:00Z', slaHours: 96, verificationEvidence: 'retest passed', verifiedBy: 'verifier-1' },
];

const MERGED_CANONICAL = {
  id: 'f1', title: 'SQLi in checkout', severity: 'critical', status: 'verifying', target: 'shop.example.com', evidence: ['retest payload still reflects', 'error-based extraction'], tags: ['checkout'],
  mergedFrom: [
    { id: 'f1b', title: 'SQLi variant in checkout', severity: 'high', status: 'duplicate', target: 'shop.example.com', evidence: ['error-based extraction'], tags: ['variant'], history: [{ from: 'new', to: 'duplicate', actor: 'lead-1', at: '2026-10-05T09:00:00Z', reason: 'merged' }] },
    { id: 'f1c', title: 'SQLi second report', severity: 'medium', status: 'duplicate', target: 'shop.example.com', evidence: ['time-based delay'], tags: [], history: [] },
  ],
};

function Card({ title, note, children }) {
  return (
    <div className="w70b-card">
      <div className="w70b-title">{title}</div>
      {note ? <div className="w70b-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w70b-badge w70b-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w70b-kv">
      <span className="w70b-k">{k}</span>
      <span className="w70b-v">{String(v)}</span>
    </div>
  );
}

export function BulkShareLinkCreation() {
  const v = EB.createBulkShareLink(DEMO_FINDINGS.slice(0, 3), { createdBy: 'lead-1', expiresAt: '2026-10-16T00:00:00Z' });
  return (
    <Card title="Bulk share-link creation" note="Idea 52781">
      <Kv k="Shared" v={v.count} />
      <Kv k="Token" v={v.token} />
      <div className="w70b-link">{v.url}</div>
    </Card>
  );
}

export function BulkDeleteWithSafeguards() {
  const v = EB.bulkDeleteWithSafeguards(DEMO_FINDINGS.slice(0, 2), { confirmation: 'DELETE 2', actor: 'lead-1', at: NOW });
  return (
    <Card title="Bulk delete with safeguards (post-hunt)" note="Idea 52782">
      <Kv k="Deleted" v={v.deletedIds.join(', ') || 'none'} />
      <Kv k="Audit entries" v={v.auditEntries.length} />
      <Kv k="Confirm by" v={v.requiredConfirmation} />
    </Card>
  );
}

export function BulkFindingArchival() {
  const v = EB.bulkArchiveSelection(DEMO_FINDINGS.slice(0, 2), { archivedBy: 'lead-1', at: NOW, settings: { reason: 'Hunt closed', retentionDays: 180 } });
  return (
    <Card title="Bulk finding archival" note="Idea 52783">
      <Kv k="Archived" v={v.count} />
      <Kv k="Retention days" v={v.settings.retentionDays} />
      <Kv k="States" v={Object.keys(v.byState).join(', ') || 'none'} />
    </Card>
  );
}

export function BulkCommenting() {
  const v = EB.bulkPostComment(DEMO_FINDINGS.slice(0, 2), 'Retest window opens Monday; please hold changes.', { author: 'lead-1', at: NOW });
  return (
    <Card title="Bulk commenting" note="Idea 52784">
      <Kv k="Commented" v={v.count} />
      <Kv k="Ids" v={v.commentedIds.join(', ') || 'none'} />
      <Kv k="Thread kept" v={v.updated[0] ? v.updated[0].comments.length : 0} />
    </Card>
  );
}

export function BulkBountyDraftCreation() {
  const v = EB.createBountyDrafts(DEMO_FINDINGS.slice(0, 2), { platform: 'bug-platform', submitter: 'lead-1' });
  return (
    <Card title="Bulk bounty-draft creation" note="Idea 52785">
      <Kv k="Drafts" v={v.count} />
      <Kv k="Platform" v={v.platform} />
      <Kv k="First" v={v.drafts[0] ? v.drafts[0].title : 'none'} />
    </Card>
  );
}

export function BulkTicketLinking() {
  const v = EB.linkFindingsToTickets(DEMO_FINDINGS.slice(0, 2), { f1: 'SEC-101', f2: 'SEC-102' }, { provider: 'jira' });
  return (
    <Card title="Bulk ticket linking" note="Idea 52786">
      <Kv k="Linked" v={v.count} />
      <Kv k="Tickets" v={v.updated.slice(0, 2).map(f => f.ticketId || 'none').join(', ')} />
      <Kv k="Skipped" v={v.skippedIds.length} />
    </Card>
  );
}

export function BulkDueDateSetting() {
  const v = EB.bulkSetDueDates(DEMO_FINDINGS.slice(0, 3), { nowIso: NOW, actor: 'lead-1' });
  return (
    <Card title="Bulk due-date setting" note="Idea 52787">
      <Kv k="Scheduled" v={v.count} />
      <Kv k="Critical due" v={v.updated[0] ? v.updated[0].dueAt : 'none'} />
    </Card>
  );
}

export function BulkPriorityOverride() {
  const v = EB.bulkSetPriorityOverride(DEMO_FINDINGS.slice(0, 2), { priority: 'sprint-now', reason: 'Sprint planning', actor: 'lead-1', at: NOW });
  return (
    <Card title="Bulk priority override (post-hunt)" note="Idea 52788">
      <Kv k="Flagged" v={v.count} />
      <Kv k="Priority" v={v.priority} />
    </Card>
  );
}

export function BulkWatcherSubscription() {
  const v = EB.bulkAddWatchers(DEMO_FINDINGS.slice(0, 2), ['qa-1', 'dev-2'], {});
  return (
    <Card title="Bulk watcher subscription" note="Idea 52789">
      <Kv k="Findings" v={v.count} />
      <Kv k="Watchers added" v={v.watchersAdded.join(', ') || 'none'} />
      <Kv k="On f1" v={v.updated[0] ? v.updated[0].watchers.join(', ') : 'none'} />
    </Card>
  );
}

export function BulkNotificationMute() {
  const v = EB.bulkMuteNotifications(DEMO_FINDINGS.slice(0, 2), { mutedBy: 'lead-1', at: NOW, muteUntil: '2026-10-12T00:00:00Z', reason: 'Fix in progress' });
  return (
    <Card title="Bulk notification mute" note="Idea 52790">
      <Kv k="Muted" v={v.count} />
      <Kv k="Until" v={v.muteUntil || 'none'} />
    </Card>
  );
}

export function BulkMoveBetweenHunts() {
  const v = EB.bulkMoveToHunt(DEMO_FINDINGS.slice(0, 2), 'hunt-43', { actor: 'lead-1', at: NOW });
  return (
    <Card title="Bulk move between hunts" note="Idea 52791">
      <Kv k="Moved" v={v.count} />
      <Kv k="To" v={v.updated[0] ? v.updated[0].huntId : 'none'} />
      <Kv k="From" v={v.updated[0] ? v.updated[0].movedFromHunt : 'none'} />
    </Card>
  );
}

export function BulkDuplicateMerging() {
  const v = EB.mergeIntoCanonical([DEMO_FINDINGS[0], DEMO_FINDINGS[1]], 'f1', { actor: 'lead-1', at: NOW });
  return (
    <Card title="Bulk duplicate merging" note="Idea 52792">
      <Kv k="Merged" v={v.mergedIds.join(', ') || 'none'} />
      <Kv k="Evidence" v={v.evidence.length} />
      <Kv k="Duplicates" v={v.duplicates.length} />
    </Card>
  );
}

export function BulkUnmerge() {
  const v = EB.unmergeMergedFinding(MERGED_CANONICAL, { actor: 'lead-1', at: NOW });
  return (
    <Card title="Bulk unmerge" note="Idea 52793">
      <Kv k="Restored" v={v.count} />
      <Kv k="Ids" v={v.restored.map(f => f.id).join(', ') || 'none'} />
      <Kv k="From" v={v.canonicalId || 'none'} />
    </Card>
  );
}

export function BulkVerifyFixed() {
  const v = EB.bulkVerifyFixed(DEMO_FINDINGS, { verifiedBy: 'verifier-1', at: NOW, evidence: 'retest passed 2026-10-09' });
  return (
    <Card title="Bulk verify-fixed" note="Idea 52794">
      <Kv k="Verified" v={v.count} />
      <Kv k="Ids" v={v.verifiedIds.join(', ') || 'none'} />
      <Kv k="Blocked" v={v.blocked.length} />
    </Card>
  );
}

export function MassFindingReopen() {
  const v = EB.bulkReopenFindings(DEMO_FINDINGS, { reason: 'Regression sweep reopened for retest', actor: 'verifier-1', at: NOW });
  return (
    <Card title="Mass finding reopen" note="Idea 52795">
      <Kv k="Reopened" v={v.reopenedIds.join(', ') || 'none'} />
      <Kv k="Blocked" v={v.blocked.length} />
    </Card>
  );
}

export function BulkPrint() {
  const v = EB.buildBulkPrintPayload(DEMO_FINDINGS.slice(0, 3), { title: 'Sprint review pack', generatedAt: NOW });
  return (
    <Card title="Bulk print" note="Idea 52796">
      <Kv k="Sections" v={v.count} />
      <Kv k="Checksum" v={v.checksum} />
      <div className="w70b-presig">{v.text}</div>
    </Card>
  );
}

export function BulkIdCopy() {
  const v = EB.buildIdCopyPayload(DEMO_FINDINGS.slice(0, 3), { format: 'pairs' });
  return (
    <Card title="Bulk ID copy" note="Idea 52797">
      <Kv k="Copied" v={v.count} />
      <Kv k="Format" v={v.format} />
      <div className="w70b-presig">{v.text}</div>
    </Card>
  );
}

export function BulkActionsApi() {
  const v = EB.describeBulkActionsApi({});
  return (
    <Card title="Bulk actions API" note="Idea 52798">
      <Kv k="Endpoints" v={v.count} />
      <Kv k="Base" v={v.basePath} />
      <Kv k="Job states" v={v.jobStatuses.join(', ')} />
    </Card>
  );
}

export function BulkActionUndo() {
  const v = EB.undoBulkOperation({ action: 'severity', performedAt: '2026-10-09T00:00:00Z', changes: [{ findingId: 'f3', field: 'severity', before: 'medium', after: 'high' }] }, { nowIso: '2026-10-09T00:30:00Z', graceMinutes: 60 });
  return (
    <Card title="Bulk-action undo" note="Idea 52799">
      <Kv k="Undoable" v={String(v.undoable)} />
      <Kv k="Restored" v={v.restored.length} />
      <Kv k="Expires" v={v.expiresAt || 'none'} />
    </Card>
  );
}

export function BulkActionApprovalGate() {
  const v = EB.evaluateBulkApprovalGate('delete', { actorRole: 'analyst', count: 3, maxSeverity: 'high', approverRole: 'lead', approvedBy: 'lead-1' });
  return (
    <Card title="Bulk-action approval gate" note="Idea 52800">
      <Kv k="Needs approval" v={String(v.requiresApproval)} />
      <Kv k="Allowed" v={String(v.allowed)} />
      <div className="w70b-note">{v.reason}</div>
    </Card>
  );
}

/** Gallery: all 20 idea-52781–52800 components, export-only. */
export function Wave70BGallery() {
  return (
    <div className="w70b-gallery">
      <BulkShareLinkCreation />
      <BulkDeleteWithSafeguards />
      <BulkFindingArchival />
      <BulkCommenting />
      <BulkBountyDraftCreation />
      <BulkTicketLinking />
      <BulkDueDateSetting />
      <BulkPriorityOverride />
      <BulkWatcherSubscription />
      <BulkNotificationMute />
      <BulkMoveBetweenHunts />
      <BulkDuplicateMerging />
      <BulkUnmerge />
      <BulkVerifyFixed />
      <MassFindingReopen />
      <BulkPrint />
      <BulkIdCopy />
      <BulkActionsApi />
      <BulkActionUndo />
      <BulkActionApprovalGate />
    </div>
  );
}
