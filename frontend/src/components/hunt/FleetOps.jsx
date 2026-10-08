// Infinity AI — Wave 48 (ideas 51881–51895): fleet operations components.
// Purely presentational, export-only (not mounted anywhere). Data flows from
// fleetOpsCore pure functions over sample state — no network, no side effects.
import {
  buildAuditLog, auditSummary, costRollup, etaBoard, detectConflicts,
  mergeHunts, splitHunt, pausePreset, resumeOrder, FLEET_SHORTCUTS,
  resolveFleetShortcut, resolveVoiceSwitch, mobileCardPayload, widgetPayload,
  darkModeParityAudit, tourSteps, fleetRetrospective,
} from './fleetOpsCore.js';

const SAMPLE_HUNTS = [
  { id: 'h1', name: 'API hunt', client: 'acme', status: 'running', scope: ['api.acme.test', 'auth.acme.test'], findings: [{ severity: 'high', title: 'Auth bypass' }], spend: 12.4, etaMs: Date.now() + 3600000, progress: 0.4 },
  { id: 'h2', name: 'Web hunt', client: 'acme', status: 'running', scope: ['www.acme.test', 'api.acme.test'], findings: [{ severity: 'critical', title: 'SQLi in search' }], spend: 8.1, etaMs: Date.now() + 7200000, progress: 0.6 },
  { id: 'h3', name: 'Mobile hunt', client: 'globex', status: 'paused', scope: ['m.globex.test'], findings: [], spend: 3.3, etaMs: 0, progress: 0.2 },
];
const SAMPLE_EVENTS = [
  { ts: 3, actor: 'infinity-two', huntId: 'h1', kind: 'finding', summary: 'High finding: auth bypass' },
  { ts: 2, actor: 'infinity-one', huntId: 'h2', kind: 'steer', summary: 'Steered to checkout flow' },
  { ts: 1, actor: 'infinity-two', huntId: 'h1', kind: 'start', summary: 'Hunt started' },
];

const Card = ({ title, children }) => (
  <div className="fo48-card">
    <div className="fo48-card-title">{title}</div>
    <div className="fo48-card-body">{children}</div>
  </div>
);
const Row = ({ k, v }) => (
  <div className="fo48-row"><span className="fo48-k">{k}</span><span className="fo48-v">{v}</span></div>
);

// 51881
export const AuditLog = () => {
  const rows = buildAuditLog(SAMPLE_EVENTS);
  return (
    <Card title="Hunt audit log">
      {rows.map((r) => (
        <Row key={r.id} k={`${r.actor} · ${r.kind}`} v={r.summary} />
      ))}
    </Card>
  );
};
export const AuditSummary = () => {
  const s = auditSummary(SAMPLE_EVENTS);
  return (
    <Card title="Audit summary">
      <Row k="Total events" v={s.total} />
      {Object.entries(s.byActor).map(([a, n]) => <Row key={a} k={a} v={n} />)}
    </Card>
  );
};
// 51882
export const CostRollup = () => {
  const r = costRollup(SAMPLE_HUNTS);
  return (
    <Card title={`Cost rollup — ${r.total} ${r.currency}`}>
      {r.perHunt.map((p) => <Row key={p.huntId} k={p.name} v={`${p.spend} ${p.currency}`} />)}
    </Card>
  );
};
// 51883
export const EtaBoard = () => {
  const board = etaBoard(SAMPLE_HUNTS);
  return (
    <Card title="Hunt ETA board">
      {board.map((b) => (
        <Row key={b.huntId} k={b.name} v={b.remainingMs == null ? 'no ETA' : `${Math.round(b.remainingMs / 60000)}m · ${Math.round(b.progress * 100)}%`} />
      ))}
    </Card>
  );
};
// 51884
export const ConflictDetector = () => {
  const w = detectConflicts(SAMPLE_HUNTS);
  return (
    <Card title="Scope conflict detection">
      {w.length === 0 ? <div className="fo48-dim">No overlapping scope.</div> :
        w.map((x, i) => <Row key={i} k={`${x.huntA} × ${x.huntB} (${x.severity})`} v={x.overlapping.join(', ')} />)}
    </Card>
  );
};
// 51885
export const HuntMerger = () => {
  const m = mergeHunts(SAMPLE_HUNTS[0], SAMPLE_HUNTS[1]);
  return (
    <Card title="Hunt merge">
      <Row k="Merged" v={m.ok ? `${m.merged.scope.length} scopes, ${m.merged.findings.length} findings` : m.error} />
      <Row k="Deduped" v={m.dedupedCount} />
    </Card>
  );
};
// 51886
export const HuntSplitter = () => {
  const s = splitHunt(SAMPLE_HUNTS[0], { scopeA: ['api.acme.test'], scopeB: ['auth.acme.test'] });
  return (
    <Card title="Hunt split">
      <Row k="Hunt A" v={s.ok ? s.huntA.scope.join(', ') : s.error} />
      <Row k="Hunt B" v={s.ok ? s.huntB.scope.join(', ') : ''} />
    </Card>
  );
};
// 51887
export const PausePresets = () => {
  const plan = pausePreset(SAMPLE_HUNTS, { exceptClient: 'globex' });
  return (
    <Card title='Pause preset: "everything except globex"'>
      {plan.map((p) => <Row key={p.huntId} k={p.huntId} v={p.action} />)}
    </Card>
  );
};
// 51888
export const ResumeOrdering = () => {
  const order = resumeOrder(SAMPLE_HUNTS, ['h3', 'h1']);
  return (
    <Card title="Resume ordering">
      {order.map((o) => <Row key={o.huntId} k={`#${o.resumeSequence}`} v={o.huntId} />)}
    </Card>
  );
};
// 51889
export const FleetShortcuts = () => (
  <Card title="Fleet keyboard shortcuts">
    {FLEET_SHORTCUTS.map((s) => <Row key={s.key} k={s.key} v={s.label} />)}
    <Row k='resolve "g 2"' v={resolveFleetShortcut('g 2').label} />
  </Card>
);
// 51890
export const VoiceSwitcher = () => {
  const r = resolveVoiceSwitch('switch to the api hunt', SAMPLE_HUNTS);
  return (
    <Card title='Voice switching: "switch to the API hunt"'>
      <Row k="Resolved" v={r.ok ? r.huntId : r.error} />
    </Card>
  );
};
// 51891
export const MobileCards = () => {
  const cards = SAMPLE_HUNTS.map(mobileCardPayload).filter(Boolean);
  return (
    <Card title="Hunt mobile cards">
      {cards.map((c) => <Row key={c.huntId} k={c.name} v={`${Math.round(c.progress * 100)}% · ${c.findings} findings`} />)}
    </Card>
  );
};
// 51892
export const FleetWidgets = () => {
  const w = widgetPayload('fleet', { hunts: SAMPLE_HUNTS });
  return (
    <Card title="Fleet widget">
      <Row k="Title" v={w.title} />
      <Row k="Running" v={w.running} />
      <Row k="Findings" v={w.findings} />
    </Card>
  );
};
// 51893
export const DarkModeParity = () => {
  const audit = darkModeParityAudit([
    { view: 'MultiHunt', tokens: ['bg-light', 'bg-dark'] },
    { view: 'EtaBoard', tokens: ['bg-light'], hardcodedColors: ['#fff'] },
  ]);
  return (
    <Card title="Dark-mode parity audit">
      {audit.map((a) => <Row key={a.view} k={a.view} v={a.parity ? 'parity OK' : a.issues.join('; ')} />)}
    </Card>
  );
};
// 51894
export const OnboardingTour = () => (
  <Card title="Multi-hunt onboarding tour">
    {tourSteps().map((s) => <Row key={s.id} k={s.title} v={s.body} />)}
  </Card>
);
// 51895
export const FleetRetrospective = () => {
  const r = fleetRetrospective(SAMPLE_HUNTS);
  return (
    <Card title="Fleet retrospective">
      <Row k="Hunts" v={r.hunts} />
      <Row k="Total findings" v={r.totalFindings} />
      <Row k="Total cost" v={`${r.cost.total} ${r.cost.currency}`} />
      {r.topHunts.map((h) => <Row key={h.huntId} k={h.name} v={`${h.findings} findings`} />)}
    </Card>
  );
};

export const FleetOpsGallery = () => (
  <div className="fo48-gallery">
    <AuditLog /><AuditSummary /><CostRollup /><EtaBoard /><ConflictDetector />
    <HuntMerger /><HuntSplitter /><PausePresets /><ResumeOrdering /><FleetShortcuts />
    <VoiceSwitcher /><MobileCards /><FleetWidgets /><DarkModeParity /><OnboardingTour />
    <FleetRetrospective />
  </div>
);
