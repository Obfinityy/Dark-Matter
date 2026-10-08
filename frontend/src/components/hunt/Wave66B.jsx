/**
 * Wave66B.jsx — Infinity AI · Dark-Matter · Wave 66
 * 20 working React components for post-hunt email content & operations, ideas 52621–52640.
 * Export-only module: components are not mounted anywhere. Pure presentational,
 * props-driven; no localStorage (repo convention for wave galleries).
 */
import React from 'react';
import * as EB from './wave66BCores.js';

const DEMO_FINDINGS = [
  { id: 'f1', title: 'SQLi in login', severity: 'critical', status: 'open', target: 'app.example.com', foundAt: '2026-09-20T10:00:00Z', dueAt: '2026-10-02T10:00:00Z', assignee: 'aarav' },
  { id: 'f2', title: 'XSS in search', severity: 'high', status: 'new', target: 'app.example.com', foundAt: '2026-09-22T10:00:00Z', dueAt: '2026-10-20T10:00:00Z', assignee: 'aarav' },
  { id: 'f3', title: 'Open redirect', severity: 'medium', status: 'triaging', target: 'app.example.com', foundAt: '2026-09-25T10:00:00Z', assignee: 'meera' },
  { id: 'f4', title: 'Verbose errors', severity: 'low', status: 'fixed', target: 'api.example.com', foundAt: '2026-09-01T10:00:00Z', fixedAt: '2026-09-10T10:00:00Z', assignee: 'meera' },
];

const DEMO_HUNTS = [
  { id: 'h1', target: 'app.example.com', findings: DEMO_FINDINGS.slice(0, 3) },
  { id: 'h2', target: 'api.example.com', findings: DEMO_FINDINGS.slice(3) },
];

function Card({ title, note, children }) {
  return (
    <div className="w66b-card">
      <div className="w66b-title">{title}</div>
      {note ? <div className="w66b-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w66b-badge w66b-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w66b-kv">
      <span className="w66b-k">{k}</span>
      <span className="w66b-v">{String(v)}</span>
    </div>
  );
}

export function WeeklyPostureEmail() {
  const p = EB.summarizePosture(DEMO_HUNTS);
  return (
    <Card title="Weekly security-posture email" note="Idea 52621">
      <Kv k="Hunts run" v={p.huntsRun} />
      <Kv k="Open critical" v={p.openCritical} />
      <Kv k="Fix velocity" v={`${p.fixVelocity.fixed} fixed (${p.fixVelocity.perHunt}/hunt)`} />
    </Card>
  );
}

export function MonthlyTrendEmail() {
  const t = EB.compareMonthOverMonth(
    { critical: 2, high: 5, medium: 9, fixed: 12, avgRisk: 41 },
    { critical: 4, high: 7, medium: 8, fixed: 9, avgRisk: 47 }
  );
  return (
    <Card title="Monthly trend email" note="Idea 52622">
      <Badge tone={t.direction === 'improving' ? 'ok' : 'warn'}>{t.direction}</Badge>
      <div className="w66b-pre">{t.narrative}</div>
    </Card>
  );
}

export function ExternalClientEmail() {
  const e = EB.buildClientSummary(
    { target: 'app.example.com', completedAt: '2026-10-07T18:00:00Z', findings: DEMO_FINDINGS },
    { name: 'Acme', portalUrl: 'https://portal.acme.example/h/1', contactName: 'Priya' }
  );
  return (
    <Card title="External client email" note="Idea 52623">
      <div className="w66b-subject">{e.subject}</div>
      <Kv k="Redacted" v={e.redacted ? 'yes' : 'no'} />
      <div className="w66b-pre">{e.text.split('\n').slice(0, 3).join('\n')}</div>
    </Card>
  );
}

export function RedactedEmailMode() {
  const r = EB.redactEmailContent({ subject: 'Summary', text: 'Token abcdefghijklmnopqrstuvwxyz123456 found at /debug', html: '' });
  return (
    <Card title="Redacted-content mode" note="Idea 52624">
      <div className="w66b-pre">{r.text}</div>
      <Kv k="Patterns hit" v={r.redactedFields.length} />
    </Card>
  );
}

export function EncryptionOption() {
  const c = EB.chooseEncryption({ preferred: 'pgp', pgpKeyId: '0xA1B2' }, ['pgp', 'smime', 'none']);
  return (
    <Card title="Email encryption option" note="Idea 52625">
      <Kv k="Method" v={c.method} />
      <Kv k="Envelope" v={c.envelope} />
    </Card>
  );
}

export function DeliveryLogs() {
  let logs = EB.appendDeliveryLog([], { emailId: 'e-1', to: 'lead@example.com', event: 'sent' });
  logs = EB.appendDeliveryLog(logs, { emailId: 'e-1', to: 'lead@example.com', event: 'delivered' });
  logs = EB.appendDeliveryLog(logs, { emailId: 'e-1', to: 'lead@example.com', event: 'opened' });
  const s = EB.summarizeDelivery(logs);
  return (
    <Card title="Delivery logs" note="Idea 52626">
      <Kv k="Events" v={logs.length} />
      <Kv k="Open rate" v={`${s.openRate}%`} />
      <Kv k="Bounce rate" v={`${s.bounceRate}%`} />
    </Card>
  );
}

export function RetryBackoff() {
  const r = EB.nextRetryDelay(2, { baseMs: 60000, maxMs: 3600000, maxAttempts: 5 });
  return (
    <Card title="Failure auto-retry" note="Idea 52627">
      <Kv k="Next delay" v={`${r.delayMs / 60000} min`} />
      <Kv k="Attempts left" v={r.attemptsLeft} />
      <Kv k="Give up" v={r.giveUp ? 'yes' : 'no'} />
    </Card>
  );
}

export function TestSendEmail() {
  const p = EB.buildTestSend(
    { subject: ctx => `Hunt ${ctx.hunt} summary`, body: ctx => `Findings: ${ctx.count}` },
    { hunt: 'Q3', count: 42 },
    'me@example.com'
  );
  return (
    <Card title="Test-send email" note="Idea 52628">
      <div className="w66b-subject">{p.subject}</div>
      <Kv k="Is test" v={p.isTest ? 'yes' : 'no'} />
    </Card>
  );
}

export function VariableLibrary() {
  return (
    <Card title="Template variable library" note="Idea 52629">
      <Kv k="Variables" v={EB.VARIABLE_LIBRARY.length} />
      {EB.VARIABLE_LIBRARY.slice(0, 4).map(v => (
        <div key={v.name} className="w66b-row">
          <code className="w66b-code">{`{{${v.name}}}`}</code>
          <span className="w66b-rowtext">{v.description}</span>
        </div>
      ))}
    </Card>
  );
}

export function ConditionalSections() {
  const secs = EB.evaluateSectionConditions([
    { id: 'crit', condition: ctx => ctx.critical > 0, render: ctx => `<p>${ctx.critical} critical findings.</p>` },
    { id: 'none', condition: ctx => ctx.critical === 0, render: () => '<p>No criticals.</p>' },
  ], { critical: 2 });
  return (
    <Card title="Conditional sections" note="Idea 52630">
      <Kv k="Visible sections" v={secs.map(s => s.id).join(', ')} />
      <div className="w66b-mailprev" dangerouslySetInnerHTML={{ __html: secs.map(s => s.html).join('') }} />
    </Card>
  );
}

export function EmbeddedCharts() {
  const svg = EB.renderInlineChart({ labels: ['c', 'h', 'm'], values: [2, 5, 9] }, 'donut');
  return (
    <Card title="Embedded charts" note="Idea 52631">
      <div className="w66b-mailprev" dangerouslySetInnerHTML={{ __html: svg }} />
      <Kv k="SVG chars" v={svg.length} />
    </Card>
  );
}

export function CsvAttachment() {
  const csv = EB.findingsToCsv(DEMO_FINDINGS);
  return (
    <Card title="CSV attachment" note="Idea 52632">
      <Kv k="Filename" v={csv.filename} />
      <Kv k="Rows" v={csv.content.split('\n').length - 1} />
      <div className="w66b-pre">{csv.content.split('\n').slice(0, 2).join('\n')}</div>
    </Card>
  );
}

export function TeamActivityDigest() {
  const s = EB.summarizeTeamActivity([
    { type: 'comment', actor: 'lead', at: '2026-10-08T09:00:00Z', huntId: 'h1', detail: 'reviewed' },
    { type: 'state-change', actor: 'aarav', at: '2026-10-08T10:00:00Z', huntId: 'h1', detail: 'f2 → triaging' },
    { type: 'decision', actor: 'lead', at: '2026-10-08T11:00:00Z', huntId: 'h2', detail: 'ship fix' },
  ]);
  return (
    <Card title="Team-activity digest" note="Idea 52633">
      <Kv k="Events" v={s.total} />
      <Kv k="Comments" v={s.byType.comment || 0} />
      <Kv k="State changes" v={s.byType['state-change'] || 0} />
    </Card>
  );
}

export function PendingTriageEmail() {
  const n = EB.pendingTriageNudge(DEMO_FINDINGS, 'lead@example.com');
  return (
    <Card title="Pending-triage nudge" note="Idea 52634">
      <div className="w66b-subject">{n.subject}</div>
      {n.items.slice(0, 3).map(i => (
        <div key={i.id} className="w66b-row"><Badge tone="warn">{i.severity}</Badge><span className="w66b-rowtext">{i.title}</span></div>
      ))}
    </Card>
  );
}

export function PendingFixesEmail() {
  const l = EB.pendingFixesList(DEMO_FINDINGS, 'aarav', new Date('2026-10-08T12:00:00Z'));
  return (
    <Card title="Pending-fixes email" note="Idea 52635">
      <Kv k="Overdue" v={l.overdue.join(', ') || 'none'} />
      <Kv k="Due soon" v={l.dueSoon.join(', ') || 'none'} />
    </Card>
  );
}

export function PreHuntNotice() {
  const e = EB.buildPreHuntNotice({ target: 'prod.example.com', startsAt: '2026-10-10T02:00:00Z', scope: 'external assessment' });
  return (
    <Card title="Pre-hunt notification" note="Idea 52636">
      <div className="w66b-subject">{e.subject}</div>
    </Card>
  );
}

export function PostRegressionEmail() {
  const d = EB.buildPostRegressionDiff(
    [{ id: 'f1' }, { id: 'f2' }],
    [{ id: 'f2' }, { id: 'f9' }]
  );
  return (
    <Card title="Post-regression email" note="Idea 52637">
      <div className="w66b-subject">{d.subject}</div>
      <Kv k="Fixed" v={d.fixed.join(', ') || 'none'} />
      <Kv k="Introduced" v={d.introduced.join(', ') || 'none'} />
    </Card>
  );
}

export function ArchiveNoticeEmail() {
  const e = EB.buildArchiveNotice({ id: 'arc-1', target: 'app.example.com', archiveAt: '2026-11-01' }, 'https://app.example.com/keep/arc-1');
  return (
    <Card title="Archive notice email" note="Idea 52638">
      <div className="w66b-subject">{e.subject}</div>
      <Kv k="Opt-out" v={e.optOutUrl ? 'present' : 'missing'} />
    </Card>
  );
}

export function ShareLinkAccessEmail() {
  const e = EB.buildShareLinkAccessNotice({ linkId: 'sl-9', huntTarget: 'app.example.com', accessedAt: '2026-10-08T10:30:00Z', ip: '203.0.113.7', ownerEmail: 'lead@example.com' });
  return (
    <Card title="Share-link access email" note="Idea 52639">
      <div className="w66b-subject">{e.subject}</div>
      <Kv k="To" v={e.to} />
    </Card>
  );
}

export function TimezoneDisplay() {
  const t = EB.formatForTimezone('2026-10-08T12:00:00Z', 'Asia/Kolkata');
  return (
    <Card title="Timezone display" note="Idea 52640">
      <div className="w66b-pre">{t.label}</div>
      <Kv k="Zone" v={t.tz} />
    </Card>
  );
}

/** Gallery: all 20 idea-52621–52640 components, export-only. */
export function Wave66BGallery() {
  return (
    <div className="w66b-gallery">
      <WeeklyPostureEmail />
      <MonthlyTrendEmail />
      <ExternalClientEmail />
      <RedactedEmailMode />
      <EncryptionOption />
      <DeliveryLogs />
      <RetryBackoff />
      <TestSendEmail />
      <VariableLibrary />
      <ConditionalSections />
      <EmbeddedCharts />
      <CsvAttachment />
      <TeamActivityDigest />
      <PendingTriageEmail />
      <PendingFixesEmail />
      <PreHuntNotice />
      <PostRegressionEmail />
      <ArchiveNoticeEmail />
      <ShareLinkAccessEmail />
      <TimezoneDisplay />
    </div>
  );
}
