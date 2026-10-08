/**
 * Wave66A.jsx — Infinity AI · Dark-Matter · Wave 66
 * 20 working React components for post-hunt email triggers & delivery, ideas 52601–52620.
 * Export-only module: components are not mounted anywhere. Pure presentational,
 * props-driven; no localStorage (repo convention for wave galleries).
 */
import React from 'react';
import * as EA from './wave66ACore.js';

const DEMO_FINDINGS = [
  { id: 'f1', title: 'SQLi in login', severity: 'critical', status: 'open', target: 'app.example.com', riskScore: 9.1, foundAt: '2026-09-20T10:00:00Z', dueAt: '2026-10-02T10:00:00Z', assignee: 'aarav' },
  { id: 'f2', title: 'XSS in search', severity: 'high', status: 'triaging', target: 'app.example.com', riskScore: 7.4, foundAt: '2026-09-22T10:00:00Z', dueAt: '2026-10-20T10:00:00Z', assignee: 'aarav' },
  { id: 'f3', title: 'Open redirect', severity: 'medium', status: 'new', target: 'app.example.com', riskScore: 4.2, foundAt: '2026-09-25T10:00:00Z', assignee: 'meera' },
  { id: 'f4', title: 'Verbose errors', severity: 'low', status: 'fixed', target: 'app.example.com', riskScore: 2.1, foundAt: '2026-09-01T10:00:00Z', fixedAt: '2026-09-10T10:00:00Z', assignee: 'meera' },
  { id: 'f5', title: 'IDOR in profile', severity: 'high', status: 'new', target: 'app.example.com', riskScore: 8.0, foundAt: '2026-10-01T10:00:00Z', dueAt: '2026-10-09T10:00:00Z', assignee: 'aarav' },
  { id: 'f6', title: 'SSRF in webhook', severity: 'critical', status: 'verified', target: 'api.example.com', riskScore: 9.6, foundAt: '2026-08-01T10:00:00Z', fixedAt: '2026-08-20T10:00:00Z', assignee: 'aarav' },
];

const DEMO_HUNTS = [
  { id: 'h1', team: 'red', findings: DEMO_FINDINGS.slice(0, 3) },
  { id: 'h2', team: 'blue', findings: DEMO_FINDINGS.slice(3) },
];

function Card({ title, note, children }) {
  return (
    <div className="w66a-card">
      <div className="w66a-title">{title}</div>
      {note ? <div className="w66a-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w66a-badge w66a-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w66a-kv">
      <span className="w66a-k">{k}</span>
      <span className="w66a-v">{String(v)}</span>
    </div>
  );
}

export function SeverityThresholdEmail() {
  const r = EA.decideEmailRoute(DEMO_FINDINGS, { immediateAt: 'high' });
  return (
    <Card title="Severity-threshold routing" note="Idea 52601">
      <Badge tone={r.route === 'immediate' ? 'danger' : 'info'}>{r.route}</Badge>
      <Kv k="Max severity" v={r.maxSeverity} />
      <Kv k="Matched" v={r.matched.join(', ') || 'none'} />
    </Card>
  );
}

export function DigestScheduler() {
  const jobs = EA.planDigestSchedule(
    [{ email: 'lead@example.com', frequency: 'daily', timezone: 'Asia/Kolkata' }],
    { hunts: DEMO_HUNTS, newFindings: 5, closedFindings: 2 }
  );
  const j = jobs[0];
  return (
    <Card title="Scheduled digest" note="Idea 52602">
      <Kv k="To" v={j.to} />
      <Kv k="Subject" v={j.subject} />
      <Kv k="Window" v={j.window} />
    </Card>
  );
}

export function PerTeamDigest() {
  const t = EA.filterFindingsForTeam(DEMO_HUNTS, 'red');
  return (
    <Card title="Per-team digest" note="Idea 52603">
      <Kv k="Team" v={t.teamId} />
      <Kv k="Hunts" v={t.hunts.join(', ')} />
      <Kv k="Findings" v={t.findings.length} />
    </Card>
  );
}

export function PerStakeholderDigest() {
  const digest = { findings: DEMO_FINDINGS, riskScore: 72, decisions: ['ship fix for f1'] };
  const exec = EA.tuneDigestForRole(digest, 'executive');
  return (
    <Card title="Per-stakeholder digest" note="Idea 52604">
      <Kv k="Executive view" v={exec.view} />
      <Kv k="Risk score" v={exec.riskScore} />
      <Kv k="Critical count" v={exec.counts.critical || 0} />
    </Card>
  );
}

export function TopFindingsEmail() {
  const top = EA.selectTopFindings(DEMO_FINDINGS, 5);
  return (
    <Card title="Top-5 findings spotlight" note="Idea 52605">
      {top.map(f => (
        <div key={f.id} className="w66a-row">
          <Badge tone={f.severity === 'critical' ? 'danger' : 'warn'}>{f.severity}</Badge>
          <span className="w66a-rowtext">{f.title}</span>
        </div>
      ))}
    </Card>
  );
}

export function RemediationStatsEmail() {
  const s = EA.computeRemediationStats(DEMO_FINDINGS);
  return (
    <Card title="Remediation stats" note="Idea 52606">
      <Kv k="Fixed" v={s.fixed} />
      <Kv k="Verified" v={s.verified} />
      <Kv k="Overdue" v={s.overdue} />
      <Kv k="MTTR (h)" v={s.mttrHours ?? 'n/a'} />
    </Card>
  );
}

export function TrendSparklineEmail() {
  const sp = EA.buildSparklineData([3, 5, 4, 7, 6, 9, 8]);
  return (
    <Card title="Trend sparkline" note="Idea 52607">
      <div className="w66a-spark">{sp.spark}</div>
      <Kv k="Points" v={sp.points.join(', ')} />
    </Card>
  );
}

export function DualFormatEmail() {
  const b = EA.renderEmailBodies({
    subject: 'Hunt summary',
    heading: 'Weekly hunt summary',
    sections: [{ title: 'Findings', body: '2 critical, 3 high open.' }],
    cta: { label: 'Open portal', url: 'https://portal.example.com' },
  });
  return (
    <Card title="Plain-text + HTML" note="Idea 52608">
      <Kv k="Text length" v={b.text.length} />
      <Kv k="HTML length" v={b.html.length} />
      <div className="w66a-pre">{b.text.split('\n').slice(0, 3).join('\n')}</div>
    </Card>
  );
}

export function EmailBrandingCard() {
  const html = EA.applyBranding('<p>Summary body.</p>', { orgName: 'Infinity AI', primaryColor: '#6d28d9' });
  return (
    <Card title="Email branding" note="Idea 52609">
      <Kv k="Branded HTML" v={`${html.length} chars`} />
      <Kv k="Org present" v={html.includes('Infinity AI') ? 'yes' : 'no'} />
    </Card>
  );
}

export function ReplyToConfig() {
  const rt = EA.resolveReplyTo({ defaultReplyTo: 'security@example.com', byType: { alert: 'soc@example.com' } }, 'alert');
  return (
    <Card title="Reply-to configuration" note="Idea 52610">
      <Kv k="Alert reply-to" v={rt} />
    </Card>
  );
}

export function LocalizedEmail() {
  const dicts = {
    en: { summary: () => ({ subject: 'Hunt summary', body: 'Hunt finished.' }) },
    hi: { summary: () => ({ subject: 'Hunt सारांश', body: 'Hunt समाप्त।' }) },
  };
  const l = EA.localizeEmail('summary', 'hi', dicts);
  return (
    <Card title="Localized email" note="Idea 52611">
      <Kv k="Locale" v={l.locale} />
      <Kv k="Subject" v={l.subject} />
      <Kv k="Fallback" v={l.fallback ? 'yes' : 'no'} />
    </Card>
  );
}

export function ActionButtonsEmail() {
  const html = EA.renderActionButtons([
    { id: 'a1', label: 'Approve fix', url: 'https://app.example.com/approve/f1', style: 'primary' },
    { id: 'a2', label: 'Open finding', url: 'https://app.example.com/f/f1', style: 'danger' },
  ]);
  return (
    <Card title="Action buttons" note="Idea 52612">
      <Kv k="Buttons" v={2} />
      <div className="w66a-mailprev" dangerouslySetInnerHTML={{ __html: html }} />
    </Card>
  );
}

export function ReadTrackingEmail() {
  const t = EA.buildTrackingPixel({ optedIn: true, emailId: 'e-123', trackingDomain: 'track.example.com' });
  return (
    <Card title="Opt-in read tracking" note="Idea 52613">
      <Kv k="Enabled" v={t.enabled ? 'yes' : 'no'} />
      <Kv k="Pixel" v={t.pixelUrl || 'none'} />
    </Card>
  );
}

export function UnsubscribeManage() {
  const u = EA.buildUnsubscribeLink('weekly-digest', 'u-42');
  const v = EA.verifyUnsubscribeToken(u.token);
  return (
    <Card title="Unsubscribe management" note="Idea 52614">
      <Kv k="Token valid" v={v.valid ? 'yes' : 'no'} />
      <Kv k="Digest" v={v.digestType || 'n/a'} />
    </Card>
  );
}

export function UserEmailPrefs() {
  const r = EA.shouldSendEmail({ events: { critical: 'email', digest: 'inapp' }, default: 'email' }, 'digest');
  return (
    <Card title="Per-user preferences" note="Idea 52615">
      <Kv k="Digest channel" v={r.channel} />
      <Kv k="Send email" v={r.sendEmail ? 'yes' : 'no'} />
    </Card>
  );
}

export function SlaEscalationEmail() {
  const b = EA.detectSlaBreaches(DEMO_FINDINGS, {
    triage: { critical: 24, high: 72 },
    fix: { critical: 168, high: 336 },
  }, new Date('2026-10-08T12:00:00Z'));
  return (
    <Card title="SLA-breach escalation" note="Idea 52616">
      <Kv k="Breaches" v={b.length} />
      {b.slice(0, 3).map(x => <div key={x.id + x.sla} className="w66a-row"><Badge tone="danger">{x.sla}</Badge><span className="w66a-rowtext">{x.id} · {x.overdueHours}h overdue</span></div>)}
    </Card>
  );
}

export function AllClearEmail() {
  const e = EA.buildAllClearEmail({ id: 'rg-7', target: 'app.example.com', checkedAt: '2026-10-08T09:00:00Z', verifiedBy: 'Lead' });
  return (
    <Card title="Regression all-clear" note="Idea 52617">
      <div className="w66a-subject">{e.subject}</div>
    </Card>
  );
}

export function NewCriticalAlert() {
  const prev = DEMO_FINDINGS.filter(f => f.id !== 'f1');
  const n = EA.detectNewCriticals(DEMO_FINDINGS, prev);
  return (
    <Card title="New-critical alert" note="Idea 52618">
      <Kv k="New criticals" v={n.length} />
      {n.map(f => <div key={f.id} className="w66a-row"><Badge tone="danger">critical</Badge><span className="w66a-rowtext">{f.title}</span></div>)}
    </Card>
  );
}

export function FpOversightDigest() {
  const s = EA.summarizeFalsePositives([
    { findingId: 'f9', reason: 'duplicate', dismissedBy: 'lead', severity: 'medium' },
    { findingId: 'f10', reason: 'not-reproducible', dismissedBy: 'lead', severity: 'low' },
  ]);
  return (
    <Card title="False-positive oversight" note="Idea 52619">
      <Kv k="Dismissed" v={s.total} />
      <Kv k="Reviewers" v={s.reviewers.join(', ') || 'none'} />
    </Card>
  );
}

export function BountyPayoutEmail() {
  const p = EA.buildPayoutNotice({ researcher: 'hunter_x', findingId: 'f1', amount: 500, currency: 'USD', paidAt: '2026-10-07', program: 'Acme Bounty' });
  return (
    <Card title="Bounty payout email" note="Idea 52620">
      <div className="w66a-subject">{p.subject}</div>
      <div className="w66a-pre">{p.text.slice(0, 90)}…</div>
    </Card>
  );
}

/** Gallery: all 20 idea-52601–52620 components, export-only. */
export function Wave66AGallery() {
  return (
    <div className="w66a-gallery">
      <SeverityThresholdEmail />
      <DigestScheduler />
      <PerTeamDigest />
      <PerStakeholderDigest />
      <TopFindingsEmail />
      <RemediationStatsEmail />
      <TrendSparklineEmail />
      <DualFormatEmail />
      <EmailBrandingCard />
      <ReplyToConfig />
      <LocalizedEmail />
      <ActionButtonsEmail />
      <ReadTrackingEmail />
      <UnsubscribeManage />
      <UserEmailPrefs />
      <SlaEscalationEmail />
      <AllClearEmail />
      <NewCriticalAlert />
      <FpOversightDigest />
      <BountyPayoutEmail />
    </div>
  );
}
