/**
 * Wave67A.jsx — Infinity AI · Dark-Matter · Wave 67
 * 20 working React components for post-hunt email operations part 2 and
 * stakeholder views, ideas 52641–52660.
 * Export-only module: components are not mounted anywhere. Pure presentational,
 * props-driven; no localStorage (repo convention for wave galleries).
 */
import React from 'react';
import * as EA from './wave67ACore.js';

const DEMO_FINDINGS = [
  { id: 'f1', title: 'SQLi in checkout', severity: 'critical', status: 'open', target: 'shop.example.com', asset: 'checkout service', riskScore: 9.1, foundAt: '2026-09-20T10:00:00Z', dueAt: '2026-10-02T10:00:00Z', assignee: 'aarav', evidence: ['error-based payload returned DB version'], payloads: ["' OR '1'='1"], reproSteps: ['Open checkout', 'Submit payload in coupon field'], fixGuidance: 'Use parameterized queries.', cwe: 'CWE-89', controls: ['CC6.1'], dataTypes: ['payment'], exploitability: 0.9 },
  { id: 'f2', title: 'XSS in search', severity: 'high', status: 'triaging', target: 'shop.example.com', asset: 'search service', riskScore: 7.4, foundAt: '2026-09-22T10:00:00Z', dueAt: '2026-10-20T10:00:00Z', assignee: 'aarav', evidence: ['reflected script executed'], payloads: ['<script>alert(1)</script>'], reproSteps: ['Search for payload'], fixGuidance: 'Context-aware output encoding.', cwe: 'CWE-79', controls: ['CC6.1'], dataTypes: ['pii'], exploitability: 0.7 },
  { id: 'f3', title: 'Open redirect', severity: 'medium', status: 'new', target: 'shop.example.com', asset: 'auth service', riskScore: 4.2, foundAt: '2026-09-25T10:00:00Z', assignee: 'meera', evidence: ['redirect to external host'], payloads: ['?next=https://evil'], reproSteps: ['Visit login with next param'], fixGuidance: 'Allowlist redirect targets.', cwe: 'CWE-601', controls: ['CC6.1'], dataTypes: [], exploitability: 0.5 },
  { id: 'f4', title: 'Verbose errors', severity: 'low', status: 'fixed', target: 'shop.example.com', asset: 'api gateway', riskScore: 2.1, foundAt: '2026-09-01T10:00:00Z', fixedAt: '2026-09-10T10:00:00Z', assignee: 'meera', evidence: ['stack trace in 500 page'], payloads: [], reproSteps: ['Trigger 500'], fixGuidance: 'Generic error pages in prod.', cwe: 'CWE-209', controls: ['CC6.1'], dataTypes: [], exploitability: 0.2 },
];

const DEMO_HUNT = { id: 'h1', target: 'shop.example.com', completedAt: '2026-10-07', findings: DEMO_FINDINGS, riskScore: 78 };

function Card({ title, note, children }) {
  return (
    <div className="w67a-card">
      <div className="w67a-title">{title}</div>
      {note ? <div className="w67a-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w67a-badge w67a-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w67a-kv">
      <span className="w67a-k">{k}</span>
      <span className="w67a-v">{String(v)}</span>
    </div>
  );
}

export function ReviewInviteCard() {
  const inv = EA.buildReviewInvite({
    huntId: 'h1',
    target: 'shop.example.com',
    start: '2026-10-10T10:00:00Z',
    end: '2026-10-10T11:00:00Z',
    attendees: ['lead@example.com', 'sec@example.com'],
    agenda: ['Recap criticals', 'Assign owners', 'Set fix dates'],
  });
  return (
    <Card title="Review meeting invite" note="Idea 52641">
      <Kv k="Summary" v={inv.summary} />
      <Kv k="Attendees" v={inv.attendeeCount} />
      <Kv k="Agenda items" v={inv.agendaItems} />
      <Kv k="ICS bytes" v={inv.ics.length} />
    </Card>
  );
}

export function SignatureConfig() {
  const sig = EA.composeSignature({ name: 'Aarav Sharma', role: 'Security Lead', org: 'Infinity AI', phone: '+91-90000-00000' });
  return (
    <Card title="Email signature" note="Idea 52642">
      <div className="w67a-presig">{sig.text}</div>
    </Card>
  );
}

export function EmailPolicyGuard() {
  const r = EA.checkEmailPolicy(
    ['lead@example.com', 'stranger@evil.com', 'ops@example.com'],
    { allow: ['example.com'], block: ['evil.com'] }
  );
  return (
    <Card title="Allow/block policy" note="Idea 52643">
      <Kv k="Allowed" v={r.allowed.length} />
      {r.rejected.map(x => (
        <div key={x.email} className="w67a-kv">
          <span className="w67a-k">{x.email}</span>
          <Badge tone="danger">rejected</Badge>
        </div>
      ))}
    </Card>
  );
}

export function EmailThrottle() {
  const queue = [
    { id: 'e1', to: 'a@x.com', priority: 1 },
    { id: 'e2', to: 'b@x.com', priority: 9 },
    { id: 'e3', to: 'c@x.com', priority: 5 },
  ];
  const t = EA.throttleEmails(queue, { perHour: 2 });
  return (
    <Card title="Email throttling" note="Idea 52644">
      <Kv k="Release now" v={t.release.map(e => e.id).join(', ')} />
      <Kv k="Deferred" v={t.deferred.map(d => `${d.email.id} (+${d.delayMinutes}m)`).join(', ') || 'none'} />
    </Card>
  );
}

export function ApiTriggeredEmail() {
  const r = EA.triggerEmailApi({ template: 'critical-alert', to: 'lead@example.com', variables: { hunt: 'h1' } });
  const bad = EA.triggerEmailApi({ template: 'nope', to: 'lead@example.com' });
  return (
    <Card title="API-triggered email" note="Idea 52645">
      <Kv k="Request" v={r.requestId} />
      <Kv k="OK" v={String(r.ok)} />
      <Kv k="Bad template" v={bad.error || 'none'} />
    </Card>
  );
}

export function SendingDomainSetup() {
  const d = EA.configureSendingDomain({ domain: 'security.example.com' });
  return (
    <Card title="Custom sending domain" note="Idea 52646">
      <Kv k="Domain" v={d.domain} />
      {d.dnsRecords.map(r => (
        <Kv key={r.host} k={r.type + ' ' + r.purpose} v={r.host} />
      ))}
    </Card>
  );
}

export function EmailPreviewPane() {
  const p = EA.renderEmailPreview(
    { subject: 'Hunt {{hunt.id}} summary', text: 'Target: {{hunt.target}}. Open: {{stats.open}}.', html: '<p>{{missing}}</p>' },
    { hunt: { id: 'h1', target: 'shop.example.com' }, stats: { open: 3 } }
  );
  return (
    <Card title="Email preview pane" note="Idea 52647">
      <Kv k="Subject" v={p.subject} />
      <div className="w67a-presig">{p.text}</div>
      <Kv k="Unresolved" v={p.unresolved.join(', ') || 'none'} />
      <Kv k="Warnings" v={p.warnings.join('; ') || 'none'} />
    </Card>
  );
}

export function TemplateAbTest() {
  const t = EA.planAbTest({ name: 'summary-format', variants: ['table', 'narrative'], sampleSize: 500 });
  return (
    <Card title="Template A/B test" note="Idea 52648">
      <Kv k="Name" v={t.name} />
      {t.groups.map(g => (
        <Kv key={g.variant} k={`Variant ${g.variant}`} v={`${g.recipients} recipients`} />
      ))}
      <div className="w67a-note">{t.winnerRule}</div>
    </Card>
  );
}

export function EmailAnalyticsDashboard() {
  const events = [
    { emailId: 'e1', template: 'weekly-digest', event: 'sent' },
    { emailId: 'e1', template: 'weekly-digest', event: 'opened' },
    { emailId: 'e2', template: 'weekly-digest', event: 'sent' },
    { emailId: 'e2', template: 'weekly-digest', event: 'clicked' },
  ];
  const a = EA.computeEmailAnalytics(events)['weekly-digest'];
  return (
    <Card title="Email analytics" note="Idea 52649">
      <Kv k="Sent" v={a.sent} />
      <Kv k="Open rate" v={`${a.openRate}%`} />
      <Kv k="CTR" v={`${a.ctr}%`} />
    </Card>
  );
}

export function QuietHoursPolicy() {
  const pending = [
    { id: 'e1', to: 'a@x.com', urgent: false },
    { id: 'e2', to: 'b@x.com', urgent: true },
  ];
  const r = EA.applyQuietHours(pending, { quietStart: 21, quietEnd: 8 }, new Date('2026-10-08T23:00:00Z'));
  return (
    <Card title="Quiet-hours policy" note="Idea 52650">
      <Kv k="In quiet hours" v={String(r.inQuiet)} />
      <Kv k="Released" v={r.released.map(e => e.id).join(', ')} />
      {r.held.map(h => (
        <Kv key={h.email.id} k={`Held ${h.email.id}`} v={h.releaseAt} />
      ))}
    </Card>
  );
}

export function EmailThreading() {
  const t = EA.threadEmails('h1', ['Fwd: Re: Critical SQLi found']);
  return (
    <Card title="Email threading" note="Idea 52651">
      <Kv k="Subject" v={t.subject} />
      <Kv k="Thread" v={t.threadId} />
      <Kv k="In-Reply-To" v={t.headers['In-Reply-To']} />
    </Card>
  );
}

export function ReplyTriage() {
  const a = EA.parseEmailReply('Looks good, accept finding f1.', ['f1', 'f2']);
  const b = EA.parseEmailReply('This is a false positive, not an issue.', ['f1']);
  return (
    <Card title="Reply-by-email triage" note="Idea 52652">
      <Kv k="Reply 1" v={`${a.action} (${a.findingId}, ${Math.round(a.confidence * 100)}%)`} />
      <Kv k="Reply 2" v={`${b.action} (${b.findingId || 'none'})`} />
    </Card>
  );
}

export function FindingDeepLink() {
  const l = EA.buildDeepLink({ baseUrl: 'https://app.infinity-ai.local', findingId: 'f1', emailId: 'e9' });
  return (
    <Card title="Finding deep link" note="Idea 52653">
      <div className="w67a-link">{l.url}</div>
    </Card>
  );
}

export function ExecDashboardView() {
  const d = EA.buildExecDashboard([{ id: 'h1', target: 'shop.example.com', findings: DEMO_FINDINGS }]);
  return (
    <Card title="Executive dashboard" note="Idea 52654">
      <Kv k="Portfolio risk" v={`${d.portfolioRisk}/100`} />
      <Kv k="Trend" v={d.trend} />
      <Kv k="Fix velocity" v={`${d.fixVelocityPerWeek}/week`} />
      {d.topRisks.slice(0, 3).map(r => (
        <div key={r.id} className="w67a-kv">
          <span className="w67a-k">{r.title}</span>
          <Badge tone={r.severity === 'critical' ? 'danger' : 'warn'}>{r.severity}</Badge>
        </div>
      ))}
    </Card>
  );
}

export function EngineerTechView() {
  const v = EA.buildEngineerView(DEMO_FINDINGS[0]);
  return (
    <Card title="Engineer technical view" note="Idea 52655">
      <Kv k="Finding" v={v.title} />
      <Kv k="CWE" v={v.cwe} />
      <Kv k="Evidence" v={v.evidence.length} />
      <Kv k="Payloads" v={v.payloads.join(', ') || 'none'} />
      <div className="w67a-note">{v.fixGuidance}</div>
    </Card>
  );
}

export function AuditorComplianceView() {
  const m = EA.mapToCompliance(DEMO_FINDINGS, { 'SOC 2': ['CC6.1', 'CC7.2'] });
  return (
    <Card title="Auditor compliance view" note="Idea 52656">
      {m['SOC 2'].map(c => (
        <div key={c.control} className="w67a-kv">
          <span className="w67a-k">{c.control}</span>
          <Badge tone={c.status === 'gap' ? 'warn' : 'ok'}>{`${c.status} · ${c.findings.length} findings`}</Badge>
        </div>
      ))}
    </Card>
  );
}

export function ClientFacingView() {
  const s = EA.redactClientSummary(DEMO_HUNT);
  return (
    <Card title="Client-facing view" note="Idea 52657">
      <div className="w67a-note">{s.text}</div>
      <Kv k="Redacted" v={String(s.redacted)} />
    </Card>
  );
}

export function BoardSlideGen() {
  const slide = EA.buildBoardSlide({ portfolioRisk: 62, trend: 'improving', criticalCount: 1, remediationProgress: 71, quarter: 'Q4 2026', severityCounts: { critical: 1, high: 1, medium: 1, low: 1 } });
  return (
    <Card title="Board slide" note="Idea 52658">
      <div className="w67a-subject">{slide.title}</div>
      {slide.bullets.map((b, i) => (
        <div key={i} className="w67a-note">• {b}</div>
      ))}
    </Card>
  );
}

export function BusinessRiskTranslation() {
  const t = EA.translateToBusinessRisk(DEMO_FINDINGS[0]);
  return (
    <Card title="Business-risk translation" note="Idea 52659">
      <div className="w67a-note">{t.sentence}</div>
      <Kv k="Risk area" v={t.riskArea} />
    </Card>
  );
}

export function DollarImpactEstimate() {
  const e = EA.estimateDollarImpact(DEMO_FINDINGS[0], { assetValueUsd: 500000, exploitability: 0.9 });
  return (
    <Card title="Dollar-impact estimate" note="Idea 52660">
      <Kv k="Expected" v={`${e.currency} ${e.expected.toLocaleString()}`} />
      <Kv k="Range" v={`${e.currency} ${e.low.toLocaleString()} – ${e.high.toLocaleString()}`} />
    </Card>
  );
}

/** Gallery: all 20 idea-52641–52660 components, export-only. */
export function Wave67AGallery() {
  return (
    <div className="w67a-gallery">
      <ReviewInviteCard />
      <SignatureConfig />
      <EmailPolicyGuard />
      <EmailThrottle />
      <ApiTriggeredEmail />
      <SendingDomainSetup />
      <EmailPreviewPane />
      <TemplateAbTest />
      <EmailAnalyticsDashboard />
      <QuietHoursPolicy />
      <EmailThreading />
      <ReplyTriage />
      <FindingDeepLink />
      <ExecDashboardView />
      <EngineerTechView />
      <AuditorComplianceView />
      <ClientFacingView />
      <BoardSlideGen />
      <BusinessRiskTranslation />
      <DollarImpactEstimate />
    </div>
  );
}
