/**
 * Wave68B.jsx — Infinity AI · Dark-Matter · Wave 68
 * 20 working React components for stakeholder roles, presentation tooling,
 * and the finding lifecycle state machine, ideas 52701–52720.
 * Export-only module: components are not mounted anywhere. Pure presentational,
 * props-driven; no localStorage (repo convention for wave galleries).
 */
import React from 'react';
import * as EB from './wave68BCores.js';

const DEMO_FINDINGS = [
  { id: 'f1', title: 'SQLi in checkout', severity: 'critical', status: 'new', target: 'shop.example.com' },
  { id: 'f2', title: 'XSS in search', severity: 'high', status: 'confirmed', target: 'shop.example.com', assignee: 'meera' },
  { id: 'f3', title: 'Weak TLS cipher', severity: 'medium', status: 'fixing', target: 'shop.example.com', fixNote: 'PR #42 tightens ciphers' },
  { id: 'f4', title: 'Missing CSP header', severity: 'low', status: 'verifying', target: 'shop.example.com', fixNote: 'PR #43 adds CSP', verificationEvidence: 'retest passed', verifiedBy: 'verifier-1' },
];

function Card({ title, note, children }) {
  return (
    <div className="w68b-card">
      <div className="w68b-title">{title}</div>
      {note ? <div className="w68b-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w68b-badge w68b-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w68b-kv">
      <span className="w68b-k">{k}</span>
      <span className="w68b-v">{String(v)}</span>
    </div>
  );
}

export function CustomRoles() {
  const r = EB.createCustomRole({ name: 'Vendor reviewer', permissions: ['view', 'comment', 'export'], defaultView: 'vendor-risk' });
  return (
    <Card title="Custom stakeholder roles" note="Idea 52701">
      <Kv k="Role" v={r.name} />
      <Kv k="Permissions" v={r.permissions.join(', ')} />
      <Kv k="Valid" v={String(r.valid)} />
    </Card>
  );
}

export function OnboardingTour() {
  const t = EB.buildOnboardingTour('executive', 'exec-dashboard');
  return (
    <Card title="Stakeholder onboarding tour" note="Idea 52702">
      <Kv k="Steps" v={t.stepCount} />
      {t.steps.slice(0, 2).map(s => (
        <Kv key={s.title} k={s.title} v={s.target} />
      ))}
    </Card>
  );
}

export function ViewFaq() {
  const f = EB.buildViewFaq('compliance', DEMO_FINDINGS);
  return (
    <Card title="Stakeholder FAQ per view" note="Idea 52703">
      <Kv k="View" v={f.view} />
      {f.faqs.map(x => (
        <div key={x.q} className="w68b-note">{x.q}</div>
      ))}
    </Card>
  );
}

export function ViewAnalytics() {
  const a = EB.computeViewAnalytics([
    { view: 'vendor-risk', user: 'lead', action: 'view' },
    { view: 'vendor-risk', user: 'auditor', action: 'export' },
    { view: 'soc-triage', user: 'lead', action: 'view' },
  ]);
  return (
    <Card title="Stakeholder view analytics" note="Idea 52704">
      <Kv k="Total views" v={a.totalViews} />
      <Kv k="Top view" v={a.topView || 'none'} />
    </Card>
  );
}

export function MeetingMode() {
  const m = EB.buildMeetingMode(
    [
      { name: 'Lead', role: 'lead', view: 'exec-dashboard' },
      { name: 'Engineer', role: 'engineer', view: 'engineer-detail' },
    ],
    ['exec-dashboard', 'engineer-detail']
  );
  return (
    <Card title="Multi-stakeholder meeting mode" note="Idea 52705">
      <Kv k="Participants" v={m.participantCount} />
      <Kv k="Duration" v={`${m.durationMinutes}m`} />
    </Card>
  );
}

export function PresentationMode() {
  const d = EB.buildPresentationDeck(['exec-dashboard', 'engineer-detail'], DEMO_FINDINGS);
  return (
    <Card title="Live presentation mode" note="Idea 52706">
      <Kv k="Slides" v={d.slideCount} />
      <Kv k="Opener" v={d.slides[0].title} />
    </Card>
  );
}

export function SpeakerNotes() {
  const n = EB.buildSpeakerNotes('exec-dashboard', DEMO_FINDINGS);
  return (
    <Card title="Speaker notes per view" note="Idea 52707">
      <Kv k="Minutes" v={n.durationEstimateMinutes} />
      <div className="w68b-note">{n.notes[0]}</div>
    </Card>
  );
}

export function PrintOptimizedView() {
  const p = EB.buildPrintView({ id: 'exec-dashboard', name: 'Executive dashboard' }, DEMO_FINDINGS);
  return (
    <Card title="Print-optimized views" note="Idea 52708">
      <Kv k="Pages" v={p.pageEstimate} />
      <Kv k="Findings" v={p.findingCount} />
    </Card>
  );
}

export function StakeholderViewApi() {
  const r = EB.buildViewApiResponse({ id: 'soc-triage' }, DEMO_FINDINGS, { severity: 'critical', page: 1, pageSize: 10 });
  return (
    <Card title="Stakeholder view API" note="Idea 52709">
      <Kv k="Total" v={r.total} />
      <Kv k="Items" v={r.items.map(i => i.id).join(', ') || 'none'} />
    </Card>
  );
}

export function ViewWatermarks() {
  const w = EB.applyViewWatermark({ title: 'Vendor risk', content: 'rows' }, { id: 'u1', name: 'Lead Reviewer' }, { id: 'vendor-risk', name: 'Vendor risk' });
  return (
    <Card title="View-level watermarks" note="Idea 52710">
      <div className="w68b-note">{w.watermark}</div>
      <Kv k="Trace" v={w.traceId} />
    </Card>
  );
}

export function ViewScheduling() {
  const s = EB.scheduleViewDelivery({ id: 'vendor-risk' }, { frequency: 'weekly', recipients: ['lead@example.com'] });
  return (
    <Card title="Stakeholder view scheduling" note="Idea 52711">
      <Kv k="Valid" v={String(s.valid)} />
      <Kv k="Next run" v={s.nextRun || 'unscheduled'} />
    </Card>
  );
}

export function FeedbackWidget() {
  const f = EB.summarizeViewFeedback([
    { view: 'vendor-risk', rating: 5, user: 'lead', comment: 'Clear.' },
    { view: 'vendor-risk', rating: 4, user: 'auditor' },
    { view: 'soc-triage', rating: 2, user: 'analyst', comment: 'Too dense.' },
  ]);
  return (
    <Card title="Stakeholder feedback widget" note="Idea 52712">
      <Kv k="Overall" v={`${f.overallAvg}/5`} />
      <Kv k="Responses" v={f.total} />
      <Kv k="Needs work" v={f.lowRated.join(', ') || 'none'} />
    </Card>
  );
}

export function LifecycleMachine() {
  const m = EB.createLifecycleMachine();
  return (
    <Card title="Configurable lifecycle state machine" note="Idea 52713">
      <Kv k="States" v={m.states.join(', ')} />
      <Kv k="Terminal" v={m.terminalStates.join(', ')} />
      <Kv k="Valid" v={String(m.valid)} />
    </Card>
  );
}

export function IntakeFlow() {
  const ok = EB.transitionIntake({ id: 'f1', status: 'new' }, 'triaged', { id: 'analyst-1', role: 'analyst' });
  const blocked = EB.transitionIntake({ id: 'f1', status: 'new' }, 'confirmed', { id: 'analyst-1', role: 'analyst' });
  return (
    <Card title="New → Triaged → Confirmed flow" note="Idea 52714">
      <Kv k="new → triaged" v={ok.ok ? ok.finding.status : 'refused'} />
      <Kv k="new → confirmed" v={blocked.ok ? 'allowed' : 'blocked'} />
    </Card>
  );
}

export function RemediationFlow() {
  const ok = EB.transitionRemediation({ id: 'f2', status: 'confirmed', nextAssignee: 'meera' }, 'assigned', { id: 'lead-1', role: 'lead' });
  return (
    <Card title="Confirmed → Assigned → Fixing flow" note="Idea 52715">
      <Kv k="confirmed → assigned" v={ok.ok ? ok.finding.status : ok.error || 'refused'} />
      <Kv k="Assignee kept" v={ok.ok ? 'yes' : 'no'} />
    </Card>
  );
}

export function ClosureFlow() {
  const ok = EB.transitionClosure({ id: 'f4', status: 'verifying', verificationEvidence: 'retest passed', verifiedBy: 'verifier-1', severity: 'low' }, 'closed', { id: 'verifier-1', role: 'verifier' });
  return (
    <Card title="Fixing → Verifying → Closed flow" note="Idea 52716">
      <Kv k="verifying → closed" v={ok.ok ? ok.finding.status : ok.error || 'refused'} />
    </Card>
  );
}

export function TransitionGuardrails() {
  const m = EB.createLifecycleMachine();
  const blocked = EB.validateTransition(m, 'new', 'closed', {});
  const allowed = EB.validateTransition(m, 'new', 'triaged', {});
  return (
    <Card title="State transition guardrails" note="Idea 52717">
      <div className="w68b-kv">
        <span className="w68b-k">new → closed</span>
        <Badge tone="danger">{blocked.allowed ? 'allowed' : 'blocked'}</Badge>
      </div>
      <Kv k="Reason" v={blocked.reasons[0] || 'none'} />
      <Kv k="new → triaged" v={allowed.allowed ? 'allowed' : 'blocked'} />
    </Card>
  );
}

export function RoleTransitionPermissions() {
  const yes = EB.canRoleTransition('engineer', 'fixing', 'verifying');
  const no = EB.canRoleTransition('engineer', 'verifying', 'closed');
  return (
    <Card title="Per-role transition permissions" note="Idea 52718">
      <Kv k="Engineer fixing → verifying" v={yes.allowed ? 'allowed' : 'denied'} />
      <Kv k="Engineer verifying → closed" v={no.allowed ? 'allowed' : 'denied'} />
    </Card>
  );
}

export function StateChangeLog() {
  const one = EB.appendStateLog([], { findingId: 'f1', from: 'new', to: 'triaged', actor: 'analyst-1', at: '2026-10-08T10:00:00Z' });
  const two = EB.appendStateLog(one, { findingId: 'f1', from: 'triaged', to: 'confirmed', actor: 'lead-1', at: '2026-10-08T11:00:00Z' });
  return (
    <Card title="Immutable state-change log" note="Idea 52719">
      <Kv k="Entries" v={two.length} />
      <Kv k="Latest hash" v={two[1].hash} />
      <Kv k="Chain link" v={two[1].prevHash === two[0].hash ? 'linked' : 'broken'} />
    </Card>
  );
}

export function TransitionAlerts() {
  const a = EB.buildTransitionAlerts({ findingId: 'f1', from: 'verifying', to: 'closed', actor: 'verifier-1', severity: 'critical', ok: true }, { channels: ['in-app', 'email'], notifyRoles: ['lead'] });
  return (
    <Card title="Lifecycle transition alerts" note="Idea 52720">
      <Kv k="Alerts" v={a.alerts.length} />
      <Kv k="Reason" v={a.reason} />
    </Card>
  );
}

/** Gallery: all 20 idea-52701–52720 components, export-only. */
export function Wave68BGallery() {
  return (
    <div className="w68b-gallery">
      <CustomRoles />
      <OnboardingTour />
      <ViewFaq />
      <ViewAnalytics />
      <MeetingMode />
      <PresentationMode />
      <SpeakerNotes />
      <PrintOptimizedView />
      <StakeholderViewApi />
      <ViewWatermarks />
      <ViewScheduling />
      <FeedbackWidget />
      <LifecycleMachine />
      <IntakeFlow />
      <RemediationFlow />
      <ClosureFlow />
      <TransitionGuardrails />
      <RoleTransitionPermissions />
      <StateChangeLog />
      <TransitionAlerts />
    </div>
  );
}
