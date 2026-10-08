/**
 * Wave68A.jsx — Infinity AI · Dark-Matter · Wave 68
 * 20 working React components for stakeholder views part 3, ideas 52681–52700.
 * Export-only module: components are not mounted anywhere. Pure presentational,
 * props-driven; no localStorage (repo convention for wave galleries).
 */
import React from 'react';
import * as EA from './wave68ACore.js';

const DEMO_FINDINGS = [
  { id: 'f1', title: 'SQLi in checkout', severity: 'critical', status: 'open', target: 'shop.example.com', vendor: 'PaymentsCo', asset: 'checkout service', component: 'checkout-api', endpoint: '/api/checkout', platform: 'web', category: 'injection', dataTypes: ['payment'], classification: 'regulated', threatId: 'T1', detected: true, riskScore: 9.1, exploitability: 0.9, owner: 'aarav', evidence: ['error-based payload returned DB version'], cwe: 'CWE-89' },
  { id: 'f2', title: 'XSS in search', severity: 'high', status: 'triaging', target: 'shop.example.com', vendor: 'Internal', asset: 'search service', component: 'search-api', endpoint: '/api/search', platform: 'web', category: 'xss', dataTypes: ['pii'], classification: 'regulated', threatId: 'T2', detected: false, riskScore: 7.4, exploitability: 0.7, owner: 'meera', evidence: ['reflected script executed'], cwe: 'CWE-79' },
  { id: 'f3', title: 'Weak TLS on mobile API', severity: 'medium', status: 'new', target: 'api.example.com', vendor: 'CloudEdge', asset: 'mobile backend', component: 'mobile-api', endpoint: '/api/mobile/login', platform: 'android', category: 'crypto tls', dataTypes: [], classification: 'internal', threatId: 'T3', detected: false, riskScore: 4.2, exploitability: 0.4, owner: 'platform', evidence: ['legacy cipher negotiated'], cwe: 'CWE-327' },
  { id: 'f4', title: 'Verbose errors in iOS client', severity: 'low', status: 'fixed', target: 'ios.example.com', vendor: 'Internal', asset: 'iOS app', component: 'ios-client', endpoint: '/api/profile', platform: 'ios', category: 'mobile storage', dataTypes: ['pii'], classification: 'regulated', threatId: 'T2', detected: true, riskScore: 2.1, exploitability: 0.2, owner: 'mobile-team', evidence: ['stack trace in error screen'], cwe: 'CWE-209' },
];

const DEMO_HUNT = { id: 'h1', target: 'shop.example.com', completedAt: '2026-10-07', findings: DEMO_FINDINGS };
const DEMO_HUNTS = [
  { id: 'h1', target: 'shop.example.com', findings: DEMO_FINDINGS.slice(0, 2) },
  { id: 'h2', target: 'api.example.com', findings: DEMO_FINDINGS.slice(2) },
];

function Card({ title, note, children }) {
  return (
    <div className="w68a-card">
      <div className="w68a-title">{title}</div>
      {note ? <div className="w68a-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w68a-badge w68a-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w68a-kv">
      <span className="w68a-k">{k}</span>
      <span className="w68a-v">{String(v)}</span>
    </div>
  );
}

export function VendorRiskView() {
  const v = EA.buildVendorRiskView(DEMO_FINDINGS, [{ name: 'PaymentsCo', criticality: 'high' }]);
  return (
    <Card title="Vendor-risk view" note="Idea 52681">
      <Kv k="Vendors" v={v.totalVendors} />
      <Kv k="Highest risk" v={v.highestRiskVendor || 'none'} />
      {v.vendors.slice(0, 3).map(r => (
        <div key={r.vendor} className="w68a-kv">
          <span className="w68a-k">{r.vendor}</span>
          <Badge tone={r.criticals > 0 ? 'danger' : 'info'}>{`risk ${r.riskScore} · ${r.open} open`}</Badge>
        </div>
      ))}
    </Card>
  );
}

export function MaDiligenceView() {
  const v = EA.buildMaDiligenceView(DEMO_HUNTS);
  return (
    <Card title="M&A diligence view" note="Idea 52682">
      <Kv k="Assets" v={v.assetCount} />
      <Kv k="Recommendation" v={v.recommendation} />
      <Kv k="Open criticals" v={v.openCriticals.join(', ') || 'none'} />
    </Card>
  );
}

export function CyberInsuranceView() {
  const v = EA.buildCyberInsuranceView(DEMO_FINDINGS, { requestedLimitUsd: 2000000 });
  return (
    <Card title="Cyber-insurance view" note="Idea 52683">
      <Kv k="Insurability" v={`${v.insurabilityScore}/100`} />
      <Kv k="Tier" v={v.tier} />
      <Kv k="Exclusions" v={v.exclusions.length} />
    </Card>
  );
}

export function PentestEquivalenceView() {
  const v = EA.buildPentestEquivalenceView(DEMO_FINDINGS, { categories: ['injection', 'xss', 'crypto', 'api'] });
  return (
    <Card title="Pen-test-equivalence view" note="Idea 52684">
      <Kv k="Coverage" v={`${v.coveragePct}%`} />
      <Kv k="Verdict" v={v.verdict} />
      <Kv k="Gaps" v={v.gaps.join(', ') || 'none'} />
    </Card>
  );
}

export function RedTeamNarrativeView() {
  const v = EA.buildRedTeamNarrative(DEMO_FINDINGS);
  return (
    <Card title="Red-team narrative view" note="Idea 52685">
      <div className="w68a-note">{v.summary}</div>
      {v.steps.slice(0, 3).map(s => (
        <Kv key={s.findingId} k={`Step ${s.step} ${s.phase}`} v={s.findingId} />
      ))}
    </Card>
  );
}

export function BlueTeamDetectionView() {
  const v = EA.buildBlueTeamDetectionView(DEMO_FINDINGS);
  return (
    <Card title="Blue-team detection view" note="Idea 52686">
      <Kv k="Coverage" v={`${v.coveragePct}%`} />
      <Kv k="Gaps" v={v.gaps.join(', ') || 'none'} />
    </Card>
  );
}

export function SocTriageView() {
  const v = EA.buildSocTriageView(DEMO_FINDINGS);
  return (
    <Card title="SOC triage view" note="Idea 52687">
      <Kv k="Queue length" v={v.queueLength} />
      {v.queue.slice(0, 3).map(q => (
        <div key={q.id} className="w68a-kv">
          <span className="w68a-k">{q.title}</span>
          <Badge tone={q.priority === 'P1' ? 'danger' : q.priority === 'P2' ? 'warn' : 'info'}>{`${q.priority} · ${q.slaMinutes}m`}</Badge>
        </div>
      ))}
    </Card>
  );
}

export function IrHandoffView() {
  const v = EA.buildIrHandoffView(DEMO_FINDINGS, { id: 'INC-7', title: 'Checkout incident', declaredAt: '2026-10-08' });
  return (
    <Card title="Incident-response handoff view" note="Idea 52688">
      <Kv k="Incident" v={v.incidentId} />
      <Kv k="Assets" v={v.affectedAssets.join(', ')} />
      <Kv k="Evidence refs" v={v.evidence.length} />
    </Card>
  );
}

export function ThreatModelLinkageView() {
  const v = EA.linkThreatModel(DEMO_FINDINGS, [
    { id: 'T1', threat: 'Injection into checkout', assets: ['checkout service'] },
    { id: 'T2', threat: 'Cross-site scripting', assets: ['search service'] },
    { id: 'T9', threat: 'Unmodeled threat', assets: ['archive'] },
  ]);
  return (
    <Card title="Threat-model linkage view" note="Idea 52689">
      <Kv k="Coverage" v={`${v.coveragePct}%`} />
      <Kv k="Unlinked" v={v.unlinkedFindings.join(', ') || 'none'} />
    </Card>
  );
}

export function ArchitectureReviewView() {
  const v = EA.buildArchitectureReviewView(DEMO_FINDINGS, [{ name: 'checkout-api', boundary: 'public-edge' }]);
  return (
    <Card title="Architecture-review view" note="Idea 52690">
      {v.components.slice(0, 3).map(c => (
        <div key={c.name} className="w68a-kv">
          <span className="w68a-k">{c.name}</span>
          <Badge tone={c.criticals > 0 ? 'danger' : 'info'}>{`risk ${c.riskScore} · ${c.boundary}`}</Badge>
        </div>
      ))}
    </Card>
  );
}

export function ApiOwnerView() {
  const v = EA.buildApiOwnerView(DEMO_FINDINGS);
  return (
    <Card title="API-owner view" note="Idea 52691">
      <Kv k="Open API findings" v={v.openCount} />
      {v.endpoints.slice(0, 3).map(e => (
        <Kv key={e.endpoint} k={e.endpoint} v={`${e.open} open · ${e.worstSeverity}`} />
      ))}
    </Card>
  );
}

export function MobileTeamView() {
  const v = EA.buildMobileTeamView(DEMO_FINDINGS);
  return (
    <Card title="Mobile-team view" note="Idea 52692">
      <Kv k="iOS open" v={v.platforms.ios.open} />
      <Kv k="Android open" v={v.platforms.android.open} />
      <Kv k="Store risks" v={v.storeRisks.join(', ') || 'none'} />
    </Card>
  );
}

export function DataTeamView() {
  const v = EA.buildDataTeamView(DEMO_FINDINGS);
  return (
    <Card title="Data-team view" note="Idea 52693">
      {v.byDataType.slice(0, 3).map(d => (
        <Kv key={d.dataType} k={d.dataType} v={`${d.open} open`} />
      ))}
      <Kv k="Top exposure" v={v.exposure.join(', ') || 'none'} />
    </Card>
  );
}

export function PrivacyDpoView() {
  const v = EA.buildPrivacyView(DEMO_FINDINGS);
  return (
    <Card title="Privacy (DPO) view" note="Idea 52694">
      <Kv k="PII exposure" v={v.piiExposure} />
      <Kv k="DPO tasks" v={v.dpoTasks.length} />
      <Kv k="Redacted" v={String(v.redacted)} />
    </Card>
  );
}

export function StakeholderAnnotations() {
  const r = EA.addStakeholderAnnotation([], { viewId: 'vendor-risk', findingId: 'f1', author: 'lead@example.com', text: 'Escalate to vendor review.' });
  return (
    <Card title="Per-stakeholder annotations" note="Idea 52695">
      <Kv k="Total" v={r.total} />
      <div className="w68a-presig">{r.annotation.text}</div>
    </Card>
  );
}

export function StakeholderComments() {
  const first = EA.addStakeholderComment([], { viewId: 'soc-triage', findingId: 'f1', author: 'analyst', text: 'Taking this one.' });
  const second = EA.addStakeholderComment(first.comments, { viewId: 'soc-triage', findingId: 'f1', author: 'lead', text: 'Bridge is open.', parentId: first.comment.id });
  return (
    <Card title="Per-stakeholder comments" note="Idea 52696">
      <Kv k="Comments" v={second.comments.length} />
      <Kv k="Threads" v={second.threadCount} />
    </Card>
  );
}

export function StakeholderExports() {
  const r = EA.buildStakeholderExport({ id: 'client-summary', name: 'Client summary', redacted: true }, DEMO_FINDINGS, 'csv');
  return (
    <Card title="Per-stakeholder exports" note="Idea 52697">
      <Kv k="File" v={r.filename} />
      <Kv k="Rows" v={r.rows} />
      <Kv k="Checksum" v={r.checksum} />
    </Card>
  );
}

export function StakeholderEmails() {
  const r = EA.buildStakeholderEmail({ id: 'vendor-risk', name: 'Vendor risk' }, DEMO_FINDINGS, 'vendor@example.com');
  return (
    <Card title="Per-stakeholder emails" note="Idea 52698">
      <Kv k="To" v={r.to} />
      <div className="w68a-subject">{r.subject}</div>
      <Kv k="Open ids" v={r.findingIds.join(', ')} />
    </Card>
  );
}

export function ViewPermissions() {
  const ok = EA.checkViewPermission({ id: 'u1', role: 'auditor' }, { id: 'compliance', owner: 'u9', allowedRoles: ['auditor'] }, 'view');
  const no = EA.checkViewPermission({ id: 'u2', role: 'marketing' }, { id: 'compliance', owner: 'u9', allowedRoles: ['auditor'] }, 'export');
  return (
    <Card title="Stakeholder view permissions" note="Idea 52699">
      <Kv k="Auditor view" v={String(ok.allowed)} />
      <Kv k="Marketing export" v={String(no.allowed)} />
      <div className="w68a-note">{no.reason}</div>
    </Card>
  );
}

export function ViewAuditLog() {
  const r = EA.buildViewAuditLog([
    { user: 'lead@example.com', viewId: 'vendor-risk', action: 'view', at: '2026-10-08T09:00:00Z', allowed: true },
    { user: 'guest@example.com', viewId: 'vendor-risk', action: 'export', at: '2026-10-08T09:05:00Z', allowed: false },
  ]);
  return (
    <Card title="Stakeholder view audit log" note="Idea 52700">
      <Kv k="Entries" v={r.total} />
      <Kv k="Denied" v={r.deniedCount} />
    </Card>
  );
}

/** Gallery: all 20 idea-52681–52700 components, export-only. */
export function Wave68AGallery() {
  return (
    <div className="w68a-gallery">
      <VendorRiskView />
      <MaDiligenceView />
      <CyberInsuranceView />
      <PentestEquivalenceView />
      <RedTeamNarrativeView />
      <BlueTeamDetectionView />
      <SocTriageView />
      <IrHandoffView />
      <ThreatModelLinkageView />
      <ArchitectureReviewView />
      <ApiOwnerView />
      <MobileTeamView />
      <DataTeamView />
      <PrivacyDpoView />
      <StakeholderAnnotations />
      <StakeholderComments />
      <StakeholderExports />
      <StakeholderEmails />
      <ViewPermissions />
      <ViewAuditLog />
    </div>
  );
}
