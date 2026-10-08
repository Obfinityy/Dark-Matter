/**
 * Wave69B.jsx — Infinity AI · Dark-Matter · Wave 69
 * 20 working React components for finding lifecycle states part 2,
 * ideas 52741–52760. Export-only module: components are not mounted
 * anywhere. Pure presentational, props-driven.
 */
import React from 'react';
import * as EB from './wave69BCores.js';

const NOW = '2026-10-09T00:00:00Z';

const DEMO_FINDINGS = [
  { id: 'f1', title: 'SQLi in checkout', severity: 'critical', status: 'verifying', target: 'shop.example.com', owner: 'aarav', riskScore: 92, evidence: ['retest payload still reflects'], history: [{ from: 'new', to: 'triaged', actor: 'analyst-1', at: '2026-10-01T09:00:00Z', reason: 'intake' }, { from: 'triaged', to: 'confirmed', actor: 'lead-1', at: '2026-10-02T09:00:00Z', reason: 'reproduced' }, { from: 'confirmed', to: 'assigned', actor: 'lead-1', at: '2026-10-03T09:00:00Z', reason: 'assign' }, { from: 'assigned', to: 'fixing', actor: 'meera', at: '2026-10-04T09:00:00Z', reason: 'fix' }, { from: 'fixing', to: 'verifying', actor: 'meera', at: '2026-10-05T09:00:00Z', reason: 'verify' }], stateEnteredAt: '2026-10-05T09:00:00Z', createdAt: '2026-10-01T09:00:00Z', slaHours: 48, fixNote: 'PR #61 parameterizes queries', verificationEvidence: 'retest passed on staging', verifiedBy: 'verifier-1', fixer: 'meera' },
  { id: 'f2', title: 'XSS in search', severity: 'high', status: 'fixing', target: 'shop.example.com', owner: 'meera', riskScore: 74, evidence: ['reflected script executed'], history: [{ from: 'new', to: 'triaged', actor: 'analyst-1', at: '2026-10-03T09:00:00Z', reason: 'intake' }], stateEnteredAt: '2026-09-20T09:00:00Z', createdAt: '2026-10-03T09:00:00Z', slaHours: 72, fixNote: 'PR #62 encodes output' },
  { id: 'f3', title: 'Weak TLS on mobile API', severity: 'medium', status: 'new', target: 'api.example.com', owner: 'platform', riskScore: 42, evidence: [], history: [], stateEnteredAt: '2026-10-08T09:00:00Z', createdAt: '2026-10-08T09:00:00Z', slaHours: 72 },
  { id: 'f4', title: 'Verbose errors in profile', severity: 'low', status: 'verified', target: 'shop.example.com', owner: 'meera', riskScore: 21, evidence: ['stack trace in error screen'], history: [{ from: 'verifying', to: 'verified', actor: 'verifier-1', at: '2026-10-07T09:00:00Z', reason: 'retest passed' }], stateEnteredAt: '2026-10-07T09:00:00Z', createdAt: '2026-10-06T09:00:00Z', slaHours: 120, verificationEvidence: 'retest passed', verifiedBy: 'verifier-1', fixNote: 'PR #63 hides stack traces' },
  { id: 'f5', title: 'Legacy auth banner', severity: 'medium', status: 'closed', target: 'shop.example.com', owner: 'aarav', riskScore: 35, evidence: ['version banner'], history: [{ from: 'verified', to: 'closed', actor: 'lead-1', at: '2026-10-06T09:00:00Z', reason: 'verified closure' }], stateEnteredAt: '2026-10-06T09:00:00Z', createdAt: '2026-10-02T09:00:00Z', slaHours: 96, verificationEvidence: 'retest passed', verifiedBy: 'verifier-1', closedBy: 'lead-1', fixNote: 'PR #60 removes banner' },
];

function Card({ title, note, children }) {
  return (
    <div className="w69b-card">
      <div className="w69b-title">{title}</div>
      {note ? <div className="w69b-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w69b-badge w69b-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w69b-kv">
      <span className="w69b-k">{k}</span>
      <span className="w69b-v">{String(v)}</span>
    </div>
  );
}

export function BreachEscalationChains() {
  const v = EB.buildEscalationChain({ findingId: 'f1', severity: 'critical', breachedHours: 10, owner: 'aarav' });
  return (
    <Card title="Breach escalation chains" note="Idea 52741">
      <Kv k="Level" v={v.currentLevel} />
      <Kv k="Escalate" v={String(v.shouldEscalate)} />
      <Kv k="Chain" v={v.chain.map(c => c.role).join(', ')} />
    </Card>
  );
}

export function TransitionApprovalQueues() {
  const v = EB.buildApprovalQueue([
    { id: 'a1', findingId: 'f1', from: 'verifying', to: 'closed', requestedBy: 'verifier-1', severity: 'critical', requestedAt: '2026-10-08T09:00:00Z', requiredRole: 'lead' },
    { id: 'a2', findingId: 'f2', from: 'confirmed', to: 'dismissed', requestedBy: 'lead-1', severity: 'high', requestedAt: '2026-10-08T08:00:00Z', requiredRole: 'admin' },
  ], 'lead');
  return (
    <Card title="Transition approval queues" note="Idea 52742">
      <Kv k="Pending" v={v.count} />
      <Kv k="Approvable" v={v.approvableIds.join(', ') || 'none'} />
    </Card>
  );
}

export function HistoricalStateExport() {
  const v = EB.exportHistoricalStates([
    { seq: 2, findingId: 'f1', from: 'triaged', to: 'confirmed', actor: 'lead-1', at: '2026-10-02T09:00:00Z' },
    { seq: 1, findingId: 'f1', from: 'new', to: 'triaged', actor: 'analyst-1', at: '2026-10-01T09:00:00Z' },
  ], 'csv');
  return (
    <Card title="Historical state export" note="Idea 52743">
      <Kv k="File" v={v.filename} />
      <Kv k="Rows" v={v.rows} />
      <Kv k="Checksum" v={v.checksum} />
    </Card>
  );
}

export function LifecycleFunnelAnalytics() {
  const v = EB.computeLifecycleFunnel(DEMO_FINDINGS);
  return (
    <Card title="Lifecycle funnel analytics" note="Idea 52744">
      <Kv k="Total" v={v.total} />
      <Kv k="Closed" v={v.closedCount} />
      <Kv k="Biggest drop" v={v.biggestDropStage || 'none'} />
    </Card>
  );
}

export function SeverityAwareStateRules() {
  const v = EB.evaluateSeverityStateRules(DEMO_FINDINGS[0], 'closed', { actor: 'meera', verifiedBy: 'verifier-1' });
  return (
    <Card title="Severity-aware state rules" note="Idea 52745">
      <Kv k="Allowed" v={String(v.allowed)} />
      <Kv k="Rules" v={v.rulesApplied.join(', ') || 'none'} />
      <div className="w69b-note">{v.reasons[0] || 'no blocks'}</div>
    </Card>
  );
}

export function TerminalStateDefinitions() {
  const v = EB.getTerminalStateDefinitions();
  return (
    <Card title="Terminal-state definitions" note="Idea 52746">
      <Kv k="Terminal" v={v.terminalStates.join(', ')} />
      <Kv k="Active" v={v.activeStates.length} />
      <Kv k="Total" v={v.totalStates} />
    </Card>
  );
}

export function AiNextStateSuggestions() {
  const v = EB.suggestNextStates(DEMO_FINDINGS[1]);
  return (
    <Card title="AI next-state suggestions" note="Idea 52747">
      <Kv k="Current" v={v.currentState} />
      <Kv k="Recommended" v={v.recommended || 'none'} />
      <Kv k="Options" v={v.suggestions.map(s => s.state).join(', ') || 'none'} />
    </Card>
  );
}

export function PreTransitionChecklists() {
  const v = EB.buildTransitionChecklist(DEMO_FINDINGS[0], 'closed');
  return (
    <Card title="Pre-transition checklists" note="Idea 52748">
      <Kv k="Ready" v={String(v.ready)} />
      <Kv k="Done" v={`${v.completed}/${v.total}`} />
      <Kv k="Complete" v={`${v.completionPct}%`} />
    </Card>
  );
}

export function ActionGatingByState() {
  const yes = EB.gateActionByState('verifying', 'verify');
  const no = EB.gateActionByState('closed', 'start-fix');
  return (
    <Card title="Action gating by state" note="Idea 52749">
      <Kv k="Verify in verifying" v={yes.allowed ? 'allowed' : 'denied'} />
      <Kv k="Fix in closed" v={no.allowed ? 'allowed' : 'denied'} />
    </Card>
  );
}

export function MobileTransitionApprovals() {
  const v = EB.buildMobileApprovalPayload({ id: 'a1', findingId: 'f1', from: 'verifying', to: 'closed', severity: 'critical', requestedBy: 'verifier-1' }, { platform: 'ios' });
  return (
    <Card title="Mobile transition approvals" note="Idea 52750">
      <Kv k="Priority" v={v.priority} />
      <Kv k="Sendable" v={String(v.sendable)} />
      <div className="w69b-note">{v.body}</div>
    </Card>
  );
}

export function LifecycleDocumentationGenerator() {
  const v = EB.generateLifecycleDocumentation({ states: ['new', 'triaged', 'closed'], transitions: { new: ['triaged'], triaged: ['closed'], closed: [] } });
  return (
    <Card title="Lifecycle documentation generator" note="Idea 52751">
      <Kv k="States" v={v.stateCount} />
      <Kv k="Transitions" v={v.transitionCount} />
      <div className="w69b-note">{v.title}</div>
    </Card>
  );
}

export function TimeToClosePrediction() {
  const v = EB.predictTimeToClose(DEMO_FINDINGS[2], {}, NOW);
  return (
    <Card title="Time-to-close prediction" note="Idea 52752">
      <Kv k="Average" v={`${v.avgHours}h`} />
      <Kv k="Remaining" v={`${v.remainingHours}h`} />
      <Kv k="Predicted" v={v.predictedCloseAt || 'none'} />
    </Card>
  );
}

export function PriorityBoostForStalled() {
  const v = EB.boostStalledPriorities(DEMO_FINDINGS, NOW, { thresholdHours: 72 });
  return (
    <Card title="Priority boost for stalled" note="Idea 52753">
      <Kv k="Boosted" v={v.boostedCount} />
      <Kv k="Ids" v={v.boostedIds.join(', ') || 'none'} />
    </Card>
  );
}

export function TicketingTwoWaySync() {
  const v = EB.syncTicketState(DEMO_FINDINGS[1], { externalId: 'JIRA-9', status: 'resolved', updatedAt: '2026-10-09T00:00:00Z' });
  return (
    <Card title="Ticketing two-way sync" note="Idea 52754">
      <Kv k="Synced" v={v.syncedState} />
      <Kv k="Conflict" v={String(v.conflict)} />
      <Kv k="Direction" v={v.direction} />
    </Card>
  );
}

export function PlatformStatusSync() {
  const v = EB.syncPlatformStatus(DEMO_FINDINGS[1], { status: 'outage', component: 'shop.example.com' });
  return (
    <Card title="Platform-status sync" note="Idea 52755">
      <Kv k="Suggested" v={v.suggestedState} />
      <Kv k="Action" v={v.action} />
      <Kv k="In sync" v={String(v.inSync)} />
    </Card>
  );
}

export function AgentProposedTransitions() {
  const v = EB.proposeAgentTransitions(DEMO_FINDINGS);
  return (
    <Card title="Agent-proposed transitions" note="Idea 52756">
      <Kv k="Proposals" v={v.count} />
      {v.proposals.slice(0, 2).map(p => (
        <Kv key={p.findingId} k={p.findingId} v={`${p.from} -> ${p.to}`} />
      ))}
    </Card>
  );
}

export function LifecycleDiagramRenderer() {
  const v = EB.renderLifecycleDiagram(['new', 'triaged', 'closed'], { new: ['triaged'], triaged: ['closed'], closed: [] });
  return (
    <Card title="Lifecycle diagram renderer" note="Idea 52757">
      <Kv k="Format" v={v.format} />
      <Kv k="Transitions" v={v.transitionCount} />
      <div className="w69b-presig">{v.diagram}</div>
    </Card>
  );
}

export function CsvStateImport() {
  const v = EB.importStatesFromCsv('id,state\nf1,triaged\nf2,closed\nf3,bogus-state');
  return (
    <Card title="CSV state import" note="Idea 52758">
      <Kv k="Valid" v={v.validCount} />
      <Kv k="Total" v={v.total} />
      <Kv k="Errors" v={v.errors.length} />
    </Card>
  );
}

export function StateRemapMigrationTool() {
  const v = EB.remapFindingStates(DEMO_FINDINGS, { new: 'triaged', fixing: 'verifying' });
  return (
    <Card title="State-remap migration tool" note="Idea 52759">
      <Kv k="Remapped" v={v.remappedCount} />
      <Kv k="Ids" v={v.remappedIds.join(', ') || 'none'} />
      <Kv k="Errors" v={v.errors.length} />
    </Card>
  );
}

export function PreservedStatesOnArchive() {
  const v = EB.archiveWithPreservedStates(DEMO_FINDINGS, NOW);
  return (
    <Card title="Preserved states on archive" note="Idea 52760">
      <Kv k="Archived" v={v.count} />
      <Kv k="At" v={v.archivedAt || 'none'} />
      <Kv k="States" v={Object.keys(v.byState).join(', ') || 'none'} />
    </Card>
  );
}

/** Gallery: all 20 idea-52741–52760 components, export-only. */
export function Wave69BGallery() {
  return (
    <div className="w69b-gallery">
      <BreachEscalationChains />
      <TransitionApprovalQueues />
      <HistoricalStateExport />
      <LifecycleFunnelAnalytics />
      <SeverityAwareStateRules />
      <TerminalStateDefinitions />
      <AiNextStateSuggestions />
      <PreTransitionChecklists />
      <ActionGatingByState />
      <MobileTransitionApprovals />
      <LifecycleDocumentationGenerator />
      <TimeToClosePrediction />
      <PriorityBoostForStalled />
      <TicketingTwoWaySync />
      <PlatformStatusSync />
      <AgentProposedTransitions />
      <LifecycleDiagramRenderer />
      <CsvStateImport />
      <StateRemapMigrationTool />
      <PreservedStatesOnArchive />
    </div>
  );
}
