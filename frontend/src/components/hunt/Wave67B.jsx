/**
 * Wave67B.jsx — Infinity AI · Dark-Matter · Wave 67
 * 20 working React components for stakeholder reporting views, ideas 52661–52680.
 * Export-only module: components are not mounted anywhere. Pure presentational,
 * props-driven; no localStorage (repo convention for wave galleries).
 */
import React from 'react';
import * as EB from './wave67BCores.js';

const DEMO_FINDINGS = [
  { id: 'f1', title: 'SQLi in checkout', severity: 'critical', status: 'open', target: 'shop.example.com', exploitability: 0.9, effortHours: 8, dependsOn: [], team: 'payments', repo: 'checkout-svc', service: 'checkout', category: 'injection', productArea: 'Checkout', dataTypes: ['payment'], failedControls: ['WAF'], foundAt: '2026-09-20T10:00:00Z', dueAt: '2026-10-02T10:00:00Z', owner: 'aarav', evidence: ['db version leak'], payloads: ["' OR '1'='1"], reproSteps: ['Submit payload'], fixGuidance: 'Parameterized queries.', references: ['https://owasp.org'] },
  { id: 'f2', title: 'XSS in search', severity: 'high', status: 'triaging', target: 'shop.example.com', exploitability: 0.7, effortHours: 4, dependsOn: [], team: 'search', repo: 'search-svc', service: 'search', category: 'xss', productArea: 'Search', dataTypes: ['pii'], failedControls: ['WAF'], foundAt: '2026-09-22T10:00:00Z', triagedAt: '2026-09-23T10:00:00Z', dueAt: '2026-10-20T10:00:00Z', owner: 'meera' },
  { id: 'f3', title: 'Weak TLS cipher', severity: 'medium', status: 'new', target: 'shop.example.com', exploitability: 0.4, effortHours: 2, dependsOn: ['f2'], team: 'platform', repo: 'edge-config', service: 'edge', category: 'tls cipher', productArea: 'Platform', dataTypes: [], failedControls: ['TLS-POLICY'], foundAt: '2026-09-25T10:00:00Z', dueAt: '2026-11-01T10:00:00Z', owner: 'platform' },
  { id: 'f4', title: 'Missing CSP header', severity: 'low', status: 'fixed', target: 'shop.example.com', exploitability: 0.2, effortHours: 1, dependsOn: [], team: 'platform', repo: 'edge-config', service: 'edge', category: 'security headers', productArea: 'Platform', dataTypes: [], failedControls: [], foundAt: '2026-09-01T10:00:00Z', fixedAt: '2026-09-10T10:00:00Z', owner: 'platform' },
];

const DEMO_HUNTS = [
  { id: 'h1', target: 'shop.example.com', team: 'payments', owner: 'aarav', findings: [DEMO_FINDINGS[0]] },
  { id: 'h2', target: 'search.example.com', team: 'search', owner: 'meera', findings: [DEMO_FINDINGS[1]] },
  { id: 'h3', target: 'edge.example.com', team: 'platform', owner: 'platform', findings: [DEMO_FINDINGS[2], DEMO_FINDINGS[3]] },
];

function Card({ title, note, children }) {
  return (
    <div className="w67b-card">
      <div className="w67b-title">{title}</div>
      {note ? <div className="w67b-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w67b-badge w67b-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w67b-kv">
      <span className="w67b-k">{k}</span>
      <span className="w67b-v">{String(v)}</span>
    </div>
  );
}

export function RiskMatrixView() {
  const m = EB.placeInRiskMatrix(DEMO_FINDINGS);
  const hot = m.placements.find(p => p.id === 'f1');
  return (
    <Card title="Likelihood × impact matrix" note="Idea 52661">
      <Kv k="f1 cell" v={hot.cell} />
      <Kv k="Cells used" v={Object.keys(m.cells).length} />
    </Card>
  );
}

export function RemediationRoadmap() {
  const phases = EB.planRemediationRoadmap(DEMO_FINDINGS);
  return (
    <Card title="Remediation roadmap" note="Idea 52662">
      {phases.map(p => (
        <div key={p.phase} className="w67b-kv">
          <span className="w67b-k">Phase {p.phase}: {p.title}</span>
          <span className="w67b-v">{p.items.join(', ')} · {p.effortHours}h</span>
        </div>
      ))}
    </Card>
  );
}

export function DeveloperTicketSlice() {
  const s = EB.sliceForDeveloper(DEMO_HUNTS, 'checkout-svc');
  return (
    <Card title="Developer ticket view" note="Idea 52663">
      <Kv k="Repo" v={s.repo} />
      <Kv k="Open tickets" v={s.openCount} />
      <Kv k="Top severity" v={s.topSeverity} />
    </Card>
  );
}

export function DevOpsInfraView() {
  const g = EB.groupInfraFindings(DEMO_FINDINGS);
  return (
    <Card title="DevOps infrastructure view" note="Idea 52664">
      <Kv k="TLS" v={g.tls.join(', ') || 'none'} />
      <Kv k="Headers" v={g.headers.join(', ') || 'none'} />
      <Kv k="Misconfig" v={g.misconfig.join(', ') || 'none'} />
      <Kv k="Network" v={g.network.join(', ') || 'none'} />
    </Card>
  );
}

export function ProductManagerView() {
  const rows = EB.summarizeProductRisk(DEMO_FINDINGS);
  return (
    <Card title="Product-manager view" note="Idea 52665">
      {rows.map(r => (
        <div key={r.area} className="w67b-kv">
          <span className="w67b-k">{r.area}</span>
          <Badge tone={r.debtScore >= 8 ? 'danger' : 'warn'}>{`debt ${r.debtScore} · ${r.open} open`}</Badge>
        </div>
      ))}
    </Card>
  );
}

export function LegalDisclosureView() {
  const flags = EB.flagDisclosureObligations(DEMO_FINDINGS);
  return (
    <Card title="Legal disclosure view" note="Idea 52666">
      {flags.length === 0 ? (
        <div className="w67b-note">No disclosure obligations flagged.</div>
      ) : (
        flags.map(f => (
          <div key={f.id} className="w67b-kv">
            <span className="w67b-k">{f.id}</span>
            <Badge tone="danger">{f.obligation}</Badge>
          </div>
        ))
      )}
    </Card>
  );
}

export function MarketingSafeSummary() {
  const s = EB.buildMarketingSummary({ lastAudit: '2026-10-01' });
  return (
    <Card title="Marketing-safe summary" note="Idea 52667">
      <div className="w67b-note">{s.statement}</div>
      <Kv k="Safe to publish" v={String(s.safe)} />
    </Card>
  );
}

export function RoleDefaultViews() {
  const roles = ['executive', 'auditor', 'developer', 'legal', 'marketing'];
  return (
    <Card title="Role-based default views" note="Idea 52668">
      {roles.map(r => {
        const d = EB.resolveDefaultView({ role: r });
        return <Kv key={r} k={r} v={d.view} />;
      })}
    </Card>
  );
}

export function ViewSwitcher() {
  const v = EB.switchView({ target: 'shop.example.com', findings: DEMO_FINDINGS, riskScore: 78 }, 'engineer-detail');
  return (
    <Card title="View switcher" note="Idea 52669">
      <Kv k="View" v={v.title} />
      <Kv k="Findings" v={v.payload.findings.join(', ')} />
    </Card>
  );
}

export function SavedStakeholderViews() {
  const v = EB.saveStakeholderView({ name: 'Board Q4', view: 'board-slide', columns: ['severity', 'owner'], group: 'leadership' });
  return (
    <Card title="Saved stakeholder views" note="Idea 52670">
      <Kv k="Name" v={v.name} />
      <Kv k="ID" v={v.id} />
      <Kv k="Shared with" v={v.sharedWith} />
    </Card>
  );
}

export function ExecOnePager() {
  const p = EB.buildExecOnePager({
    portfolioRisk: 62,
    trend: 'improving',
    topRisks: DEMO_FINDINGS.slice(0, 2),
    decisions: ['Approve WAF rule change'],
  });
  return (
    <Card title="Exec one-pager" note="Idea 52671">
      <div className="w67b-subject">{p.title}</div>
      {p.sections.map(s => (
        <Kv key={s.heading} k={s.heading} v={s.body.slice(0, 60) + (s.body.length > 60 ? '…' : '')} />
      ))}
    </Card>
  );
}

export function EngineerDetailPack() {
  const p = EB.buildEngineerDetailPack(DEMO_FINDINGS[0]);
  return (
    <Card title="Engineer detail pack" note="Idea 52672">
      <div className="w67b-subject">{p.title}</div>
      <Kv k="Artifacts" v={p.artifacts.length} />
      {p.artifacts.slice(0, 3).map(a => (
        <Kv key={a.name} k={a.name} v={a.content.slice(0, 40) + (a.content.length > 40 ? '…' : '')} />
      ))}
    </Card>
  );
}

export function ControlCoverageView() {
  const rows = EB.mapControlCoverage(DEMO_FINDINGS, ['WAF', 'TLS-POLICY', 'MFA']);
  return (
    <Card title="Control-coverage view" note="Idea 52673">
      {rows.map(r => (
        <div key={r.control} className="w67b-kv">
          <span className="w67b-k">{r.control}</span>
          <Badge tone={r.status === 'failed' ? 'danger' : 'ok'}>{`${r.status} · ${r.failures.length} failures`}</Badge>
        </div>
      ))}
    </Card>
  );
}

export function SlaComplianceView() {
  const c = EB.computeSlaCompliance(DEMO_FINDINGS, { triage: { critical: 24, high: 72 }, fix: { critical: 168 } }, new Date('2026-10-08T00:00:00Z'));
  return (
    <Card title="SLA-compliance view" note="Idea 52674">
      {Object.entries(c).map(([team, sevs]) =>
        Object.entries(sevs).map(([sev, s]) => (
          <Kv key={`${team}-${sev}`} k={`${team}/${sev}`} v={`${s.adherencePct}% (${s.met}/${s.met + s.breached})`} />
        ))
      )}
    </Card>
  );
}

export function ExecTrendView() {
  const t = EB.buildExecTrend([
    { label: 'Q2', riskScore: 80, annotation: 'WAF rollout' },
    { label: 'Q3', riskScore: 62 },
  ]);
  return (
    <Card title="Executive trend view" note="Idea 52675">
      <Kv k="Direction" v={t.direction} />
      <div className="w67b-note">{t.narrative}</div>
    </Card>
  );
}

export function BenchmarkView() {
  const b = EB.benchmarkPosture({ riskScore: 62, mttrHours: 96 }, [{ riskScore: 70 }, { riskScore: 80 }, { riskScore: 55 }]);
  return (
    <Card title="Benchmark view" note="Idea 52676">
      <Kv k="Percentile" v={`${b.percentile}%`} />
      <div className="w67b-note">{b.framing}</div>
    </Card>
  );
}

export function FixedBoardView() {
  const rows = EB.buildFixedBoard(DEMO_FINDINGS);
  return (
    <Card title="What we fixed" note="Idea 52677">
      {rows.length === 0 ? (
        <div className="w67b-note">Nothing fixed yet.</div>
      ) : (
        rows.map(r => <Kv key={r.id} k={r.title} v={r.fixedAt || 'date unknown'} />)
      )}
    </Card>
  );
}

export function OpenRiskInventory() {
  const rows = EB.buildOpenRiskInventory(DEMO_FINDINGS);
  return (
    <Card title="What remains" note="Idea 52678">
      {rows.map(r => (
        <div key={r.id} className="w67b-kv">
          <span className="w67b-k">{r.title}</span>
          <Badge tone={r.overdue ? 'danger' : r.severity === 'critical' ? 'warn' : 'info'}>
            {`${r.severity} · ${r.owner}${r.overdue ? ' · overdue' : ''}`}
          </Badge>
        </div>
      ))}
    </Card>
  );
}

export function AssetOwnerView() {
  const v = EB.viewForAssetOwner(DEMO_HUNTS, 'aarav');
  return (
    <Card title="Per-asset-owner view" note="Idea 52679">
      <Kv k="Owner" v={v.owner} />
      <Kv k="Assets" v={v.assets.join(', ')} />
      <Kv k="Open findings" v={v.slaSummary.open} />
    </Card>
  );
}

export function TeamRollupView() {
  const rows = EB.rollupByTeam(DEMO_HUNTS);
  return (
    <Card title="Per-team rollup" note="Idea 52680">
      {rows.map(r => (
        <div key={r.team} className="w67b-kv">
          <span className="w67b-k">{r.team}</span>
          <Badge tone={r.criticals > 0 ? 'danger' : 'info'}>{`risk ${r.riskScore} · ${r.open} open`}</Badge>
        </div>
      ))}
    </Card>
  );
}

/** Gallery: all 20 idea-52661–52680 components, export-only. */
export function Wave67BGallery() {
  return (
    <div className="w67b-gallery">
      <RiskMatrixView />
      <RemediationRoadmap />
      <DeveloperTicketSlice />
      <DevOpsInfraView />
      <ProductManagerView />
      <LegalDisclosureView />
      <MarketingSafeSummary />
      <RoleDefaultViews />
      <ViewSwitcher />
      <SavedStakeholderViews />
      <ExecOnePager />
      <EngineerDetailPack />
      <ControlCoverageView />
      <SlaComplianceView />
      <ExecTrendView />
      <BenchmarkView />
      <FixedBoardView />
      <OpenRiskInventory />
      <AssetOwnerView />
      <TeamRollupView />
    </div>
  );
}
