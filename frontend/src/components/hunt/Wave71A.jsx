/**
 * Wave71A.jsx — Infinity AI · Dark-Matter · Wave 71
 * 20 working React components for bulk actions round 2,
 * ideas 52801–52820. Export-only module: components are not
 * mounted anywhere. Pure presentational, props-driven.
 */
import React from 'react';
import * as EA from './wave71ACore.js';

const NOW = '2026-10-09T00:00:00Z';

const DEMO_FINDINGS = [
  { id: 'f1', title: 'SQLi in checkout', severity: 'critical', status: 'verifying', target: 'shop.example.com', owner: 'aarav', assignee: 'meera', huntId: 'hunt-42', team: 'appsec', riskScore: 92, cwe: 'CWE-89', tags: ['checkout', 'sqli'], evidence: ['payload from admin@shop.example.com reflected', 'request from 10.0.3.14 with Bearer abcdefghij123456'], links: [{ relation: 'related', targetId: 'f2' }], customFields: { source: 'hunt' }, remediationNotes: [], history: [{ from: 'fixing', to: 'verifying', actor: 'meera', at: '2026-10-05T09:00:00Z', reason: 'fix ready' }], stateEnteredAt: '2026-10-05T09:00:00Z', createdAt: '2026-10-01T09:00:00Z' },
  { id: 'f2', title: 'XSS in search', severity: 'high', status: 'fixing', target: 'shop.example.com', owner: 'meera', assignee: 'meera', huntId: 'hunt-42', team: 'appsec', riskScore: 74, cwe: 'CWE-79', tags: ['search'], evidence: ['reflected script executed'], links: [], customFields: {}, remediationNotes: [], history: [], stateEnteredAt: '2026-10-08T09:00:00Z', createdAt: '2026-10-03T09:00:00Z' },
  { id: 'f3', title: 'Weak TLS on mobile API', severity: 'medium', status: 'triaged', target: 'api.example.com', owner: 'platform', assignee: 'platform', huntId: 'hunt-42', riskScore: 42, tags: [], evidence: ['legacy cipher negotiated'], links: [], customFields: {}, remediationNotes: [], history: [], stateEnteredAt: '2026-10-08T09:00:00Z', createdAt: '2026-10-08T09:00:00Z' },
  { id: 'f4', title: 'Verbose errors in profile', severity: 'low', status: 'verified', target: 'shop.example.com', owner: 'meera', assignee: 'qa-1', huntId: 'hunt-42', riskScore: 21, tags: ['profile'], evidence: ['stack trace in error screen'], links: [], customFields: {}, remediationNotes: [], history: [], stateEnteredAt: '2026-10-07T09:00:00Z', createdAt: '2026-10-02T09:00:00Z' },
  { id: 'f5', title: 'Legacy auth banner', severity: 'medium', status: 'closed', target: 'shop.example.com', owner: 'aarav', assignee: 'aarav', huntId: 'hunt-42', riskScore: 35, tags: ['auth'], evidence: ['version banner'], links: [], customFields: {}, remediationNotes: [], history: [{ from: 'verified', to: 'closed', actor: 'lead-1', at: '2026-10-06T09:00:00Z', reason: 'verified closure' }], stateEnteredAt: '2026-10-06T09:00:00Z', createdAt: '2026-10-01T09:00:00Z' },
];

function Card({ title, note, children }) {
  return (
    <div className="w71a-card">
      <div className="w71a-title">{title}</div>
      {note ? <div className="w71a-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w71a-badge w71a-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w71a-kv">
      <span className="w71a-k">{k}</span>
      <span className="w71a-v">{String(v)}</span>
    </div>
  );
}

export function BulkActionDryRunPreview() {
  const v = EA.previewBulkActionDryRun(DEMO_FINDINGS, { type: 'transition', toState: 'confirmed' }, { actor: 'lead-1' });
  return (
    <Card title="Bulk-action dry-run preview" note="Idea 52801">
      <Kv k="Would change" v={v.wouldChange.length} />
      <Kv k="Blocked" v={v.blocked.length} />
      <Kv k="Unchanged" v={v.unchangedIds.length} />
      <div className="w71a-note">{v.summary}</div>
    </Card>
  );
}

export function BulkActionProgressBar() {
  const v = EA.buildBulkActionProgress({ label: 'Post-hunt tagging', total: 40, completed: 25, failed: 2, skipped: 1, startedAt: '2026-10-09T00:00:00Z', updatedAt: '2026-10-09T00:10:00Z' }, NOW);
  return (
    <Card title="Bulk-action progress bar (post-hunt)" note="Idea 52802">
      <Kv k="Done" v={`${v.done}/${v.total}`} />
      <Kv k="Percent" v={`${v.percent}%`} />
      <Kv k="Status" v={v.status} />
      <Kv k="ETA seconds" v={v.etaSeconds === null ? 'n/a' : v.etaSeconds} />
    </Card>
  );
}

export function BulkActionFailureHandling() {
  const v = EA.planBulkFailureHandling([
    { id: 'f1', ok: true },
    { id: 'f2', ok: false, error: 'gateway timeout', errorKind: 'transient' },
    { id: 'f3', ok: false, error: 'missing justification', errorKind: 'validation' },
  ], {});
  return (
    <Card title="Bulk-action failure handling" note="Idea 52803">
      <Kv k="Succeeded" v={v.succeededIds.length} />
      <Kv k="Retries" v={v.retryPlan.length} />
      <Kv k="Held" v={v.permanent.length} />
    </Card>
  );
}

export function BulkActionAuditLog() {
  const v = EA.buildBulkActionAuditLog([
    { action: 'tag', actor: 'lead-1', at: '2026-10-09T01:00:00Z', findingIds: ['f1', 'f2'], details: 'post-hunt tags' },
    { action: 'assign-owner', actor: 'lead-1', at: '2026-10-09T00:30:00Z', findingIds: ['f3'], details: 'rotation' },
  ], { generatedAt: NOW });
  return (
    <Card title="Bulk-action audit log" note="Idea 52804">
      <Kv k="Entries" v={v.totalActions} />
      <Kv k="Findings" v={v.totalFindings} />
      <Kv k="Checksum" v={v.checksum} />
    </Card>
  );
}

export function BulkActionMacros() {
  const v = EA.applyBulkActionMacro(DEMO_FINDINGS.slice(0, 3), 'triage-pack', { actor: 'lead-1', at: NOW });
  return (
    <Card title="Bulk-action macros" note="Idea 52805">
      <Kv k="Macro" v={v.label} />
      <Kv k="Steps" v={v.stepCount} />
      <Kv k="Applied to" v={v.count} />
      <Kv k="Tags f3" v={v.updated[2] ? v.updated[2].tags.join(', ') : 'none'} />
    </Card>
  );
}

export function ScheduledBulkActions() {
  const v = EA.scheduleBulkAction({ type: 'tag', addTags: ['nightly'] }, DEMO_FINDINGS.slice(0, 2), { runAt: '2026-10-10T00:00:00Z', nowIso: NOW, actor: 'lead-1' });
  return (
    <Card title="Scheduled bulk actions (post-hunt)" note="Idea 52806">
      <Kv k="Scheduled" v={String(v.ok)} />
      <Kv k="Findings" v={v.schedule ? v.schedule.findingCount : 0} />
      <Kv k="Status" v={v.schedule ? v.schedule.status : 'none'} />
    </Card>
  );
}

export function BulkActionPermissions() {
  const v = EA.evaluateBulkActionPermissions({ id: 'analyst-1', role: 'analyst' }, 'delete', DEMO_FINDINGS, {});
  return (
    <Card title="Bulk-action permissions" note="Idea 52807">
      <Kv k="Allowed" v={String(v.allowed)} />
      <Kv k="Needs lead" v={String(v.requiresLead)} />
      <div className="w71a-note">{v.deniedReasons[0] || 'permitted'}</div>
    </Card>
  );
}

export function QueryBasedBulkSelect() {
  const v = EA.selectFindingsByQuery(DEMO_FINDINGS, 'severity:critical,high state:verifying,fixing');
  return (
    <Card title="Query-based bulk select" note="Idea 52808">
      <Kv k="Matched" v={v.count} />
      <Kv k="Ids" v={v.matchedIds.join(', ') || 'none'} />
      <Kv k="Terms" v={v.parsedTerms.length} />
    </Card>
  );
}

export function SavedBulkSelections() {
  const saved = EA.manageSavedSelections([], { type: 'save', name: 'Criticals', ids: ['f1'], actor: 'lead-1', at: NOW });
  const v = EA.manageSavedSelections(saved.selections, { type: 'load', name: 'Criticals' });
  return (
    <Card title="Saved bulk selections" note="Idea 52809">
      <Kv k="Saved" v={v.count} />
      <Kv k="Active" v={v.active ? v.active.name : 'none'} />
      <Kv k="Ids" v={v.active ? v.active.ids.join(', ') : 'none'} />
    </Card>
  );
}

export function BulkActionsFromSearch() {
  const v = EA.applyBulkActionFromSearch(DEMO_FINDINGS, 'shop', { type: 'tag', addTags: ['from-search'] }, { actor: 'lead-1', at: NOW });
  return (
    <Card title="Bulk actions from search" note="Idea 52810">
      <Kv k="Matched" v={v.count} />
      <Kv k="Ids" v={v.matchedIds.join(', ') || 'none'} />
      <Kv k="Tagged f1" v={v.updated[0] ? v.updated[0].tags.join(', ') : 'none'} />
    </Card>
  );
}

export function BulkActionsFromDiffView() {
  const after = DEMO_FINDINGS.map(f => (f.id === 'f3' ? { ...f, status: 'confirmed', severity: 'high' } : f));
  const v = EA.selectChangedFromDiff(DEMO_FINDINGS, after);
  return (
    <Card title="Bulk actions from diff view" note="Idea 52811">
      <Kv k="Changed" v={v.changedIds.join(', ') || 'none'} />
      <Kv k="Unchanged" v={v.unchangedIds.length} />
      <div className="w71a-note">{v.summary}</div>
    </Card>
  );
}

export function BulkCustomFieldEditing() {
  const v = EA.bulkEditCustomFields(DEMO_FINDINGS.slice(0, 3), { review_batch: 'oct-sweep', byId: { f1: { review_batch: 'priority' } } }, { actor: 'lead-1', at: NOW });
  return (
    <Card title="Bulk custom-field editing" note="Idea 52812">
      <Kv k="Changed" v={v.changedIds.join(', ') || 'none'} />
      <Kv k="Fields" v={v.fieldsApplied.join(', ') || 'none'} />
      <Kv k="Errors" v={v.errors.length} />
    </Card>
  );
}

export function BulkFindingLinking() {
  const v = EA.bulkLinkFindings(DEMO_FINDINGS.slice(0, 3), { relation: 'related', targetId: 'f1' }, { actor: 'lead-1', at: NOW });
  return (
    <Card title="Bulk finding linking" note="Idea 52813">
      <Kv k="Links written" v={v.linkCount} />
      <Kv k="Linked" v={v.linkedIds.join(', ') || 'none'} />
      <Kv k="Relation" v={v.relation} />
    </Card>
  );
}

export function BulkUnlink() {
  const v = EA.bulkUnlinkFindings(DEMO_FINDINGS.slice(0, 2), { relation: 'related', targetId: 'f2' });
  return (
    <Card title="Bulk unlink" note="Idea 52814">
      <Kv k="Removed" v={v.unlinkedCount} />
      <Kv k="Affected" v={v.affectedIds.join(', ') || 'none'} />
      <Kv k="Links left f1" v={v.updated[0] ? v.updated[0].links.length : 0} />
    </Card>
  );
}

export function BulkEvidenceZip() {
  const v = EA.buildEvidenceZipManifest(DEMO_FINDINGS.slice(0, 3), { generatedAt: NOW });
  return (
    <Card title="Bulk evidence ZIP" note="Idea 52815">
      <Kv k="Archive" v={v.archiveName} />
      <Kv k="Files" v={v.fileCount} />
      <Kv k="Bytes" v={v.totalBytes} />
      <Kv k="Checksum" v={v.manifestChecksum} />
    </Card>
  );
}

export function BulkRedaction() {
  const v = EA.applyBulkRedaction(DEMO_FINDINGS.slice(0, 2), [], { actor: 'lead-1', at: NOW });
  return (
    <Card title="Bulk redaction" note="Idea 52816">
      <Kv k="Redactions" v={v.totalRedactions} />
      <Kv k="Affected" v={v.affectedIds.join(', ') || 'none'} />
      <Kv k="Rules hit" v={Object.keys(v.byRule).join(', ') || 'none'} />
    </Card>
  );
}

export function BulkTeamAssignment() {
  const v = EA.bulkAssignTeams(DEMO_FINDINGS.slice(0, 4), { critical: 'appsec', default: 'platform-team' }, { actor: 'lead-1', at: NOW, rosters: { appsec: ['aarav', 'meera'] } });
  return (
    <Card title="Bulk team assignment" note="Idea 52817">
      <Kv k="Assigned" v={v.count} />
      {v.assignments.slice(0, 2).map(a => (
        <Kv key={a.id} k={a.id} v={`${a.team}/${a.member || 'unassigned'}`} />
      ))}
    </Card>
  );
}

export function BulkEscalation() {
  const v = EA.bulkEscalateFindings(DEMO_FINDINGS.slice(0, 3), { reason: 'Customer report received', actor: 'lead-1', at: NOW });
  return (
    <Card title="Bulk escalation" note="Idea 52818">
      <Kv k="Escalated" v={v.escalatedIds.join(', ') || 'none'} />
      <Kv k="Blocked" v={v.blocked.length} />
      <Kv k="Top now" v={v.escalated[0] ? v.escalated[0].severity : 'none'} />
    </Card>
  );
}

export function BulkInfoRequests() {
  const v = EA.bulkRequestInfo(DEMO_FINDINGS.slice(0, 2), { questions: ['Which account role was used?', 'Can you share the request capture?'], requestedBy: 'lead-1', at: NOW, dueAt: '2026-10-12T00:00:00Z' });
  return (
    <Card title="Bulk info requests" note="Idea 52819">
      <Kv k="Requests" v={v.count} />
      <Kv k="Questions each" v={v.requests[0] ? v.requests[0].questions.length : 0} />
      <Kv k="Awaiting f1" v={v.updated[0] ? String(v.updated[0].awaitingInfo) : 'none'} />
    </Card>
  );
}

export function BulkRemediationNotes() {
  const v = EA.bulkAddRemediationNotes(DEMO_FINDINGS.slice(0, 3), { critical: 'Patch this sprint and add regression coverage.', default: 'Schedule the fix with the owning team.' }, { actor: 'lead-1', at: NOW });
  return (
    <Card title="Bulk remediation notes" note="Idea 52820">
      <Kv k="Noted" v={v.count} />
      <Kv k="Ids" v={v.notedIds.join(', ') || 'none'} />
      <Kv k="Note f1" v={v.updated[0] && v.updated[0].remediationNotes[0] ? v.updated[0].remediationNotes[0].text.slice(0, 28) : 'none'} />
    </Card>
  );
}

/** Gallery: all 20 idea-52801–52820 components, export-only. */
export function Wave71AGallery() {
  return (
    <div className="w71a-gallery">
      <BulkActionDryRunPreview />
      <BulkActionProgressBar />
      <BulkActionFailureHandling />
      <BulkActionAuditLog />
      <BulkActionMacros />
      <ScheduledBulkActions />
      <BulkActionPermissions />
      <QueryBasedBulkSelect />
      <SavedBulkSelections />
      <BulkActionsFromSearch />
      <BulkActionsFromDiffView />
      <BulkCustomFieldEditing />
      <BulkFindingLinking />
      <BulkUnlink />
      <BulkEvidenceZip />
      <BulkRedaction />
      <BulkTeamAssignment />
      <BulkEscalation />
      <BulkInfoRequests />
      <BulkRemediationNotes />
    </div>
  );
}
