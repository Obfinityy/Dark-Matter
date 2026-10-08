/**
 * ArchiveOps.jsx — Infinity AI · Dark-Matter · Wave 65
 * 20 working React components for archive operations & email notifications, ideas 52581–52600.
 * Export-only module: components are not mounted anywhere. Pure presentational,
 * props-driven; no localStorage (repo convention for wave galleries).
 */
import React from 'react';
import * as AO from './archiveOpsCore.js';

const DEMO_ARCHIVE = {
  id: 'arc-ops-01',
  target: 'acme.com',
  team: 'red',
  sizeBytes: 500 * 1024 * 1024,
  ageDays: 400,
  isDuplicate: false,
  policyExpired: false,
  createdAt: '2026-06-01T10:00:00Z',
  retentionExpiresAt: new Date(Date.now() + 20 * 86400000).toISOString(),
  tags: ['q2'],
  topSeverity: 'critical',
  summary: 'Q2 hunt.',
};

const DEMO_HUNT = {
  id: 'hunt-ops-01',
  target: 'acme.com',
  startedAt: '2026-06-01',
  finishedAt: '2026-06-05',
  riskScore: 8.2,
  headline: 'SQLi in login led to the highest-risk chain.',
  findings: [
    { id: 'f1', title: 'SQLi in login', severity: 'critical', evidenceUrl: '/ev/f1' },
    { id: 'f2', title: 'XSS in search', severity: 'high', evidenceUrl: '/ev/f2' },
  ],
};

function Card({ title, note, children }) {
  return (
    <div className="ao65-card">
      <div className="ao65-title">{title}</div>
      {note ? <div className="ao65-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  const cls =
    tone === 'good'
      ? 'ao65-badge ao65-badge-good'
      : tone === 'warn'
        ? 'ao65-badge ao65-badge-warn'
        : tone === 'bad'
          ? 'ao65-badge ao65-badge-bad'
          : 'ao65-badge';
  return <span className={cls}>{children}</span>;
}

/** 52581 — Archive migration tool */
export function ArchiveMigration() {
  const plan = AO.planArchiveMigration(DEMO_ARCHIVE, 's3', 'glacier');
  return (
    <Card title="Archive migration tool" note="Idea 52581">
      <div className="ao65-small">
        {plan.from} → {plan.to}
      </div>
      <div className="ao65-small">{plan.steps.join(' → ')}</div>
    </Card>
  );
}

/** 52582 — Per-team archive stats */
export function TeamArchiveStats() {
  const stats = AO.perTeamArchiveStats([DEMO_ARCHIVE, { ...DEMO_ARCHIVE, id: 'a2', team: 'blue', sizeBytes: 100 }]);
  return (
    <Card title="Per-team archive stats" note="Idea 52582">
      {Object.entries(stats).map(([team, s]) => (
        <div key={team} className="ao65-small">
          {team}: {s.count} archive(s), {(s.bytes / 1024 / 1024).toFixed(0)} MB
        </div>
      ))}
    </Card>
  );
}

/** 52583 — Archive quota management */
export function ArchiveQuotas() {
  const q = AO.checkArchiveQuota({ usedBytes: 850, quotaBytes: 1000, workspace: 'default' });
  return (
    <Card title="Archive quota management" note="Idea 52583">
      <Badge tone={q.status === 'ok' ? 'good' : 'warn'}>{q.percentUsed}% used</Badge>
      <div className="ao65-small">{q.action || 'Within quota.'}</div>
    </Card>
  );
}

/** 52584 — Archive cleanup suggestions */
export function CleanupSuggestions() {
  const s = AO.suggestArchiveCleanup([DEMO_ARCHIVE, { ...DEMO_ARCHIVE, id: 'a2', ageDays: 10 }]);
  return (
    <Card title="Archive cleanup suggestions" note="Idea 52584">
      <div className="ao65-small">{s.length} suggestion(s)</div>
      {s.map(x => (
        <div key={x.archiveId} className="ao65-small">
          {x.archiveId}: {x.reasons.join(', ')}
        </div>
      ))}
    </Card>
  );
}

/** 52585 — Archive "time capsule" summary */
export function TimeCapsule() {
  const text = AO.writeTimeCapsuleSummary(DEMO_HUNT);
  return (
    <Card title='Archive "time capsule" summary' note="Idea 52585">
      <div className="ao65-small">{text}</div>
    </Card>
  );
}

/** 52586 — Linked-hunt preservation */
export function LinkedHuntPreservation() {
  const a = AO.preserveLinkedHunts(DEMO_ARCHIVE, [
    { type: 'regression', id: 'r1' },
    { type: 'comparison', id: 'c1' },
  ]);
  return (
    <Card title="Linked-hunt preservation" note="Idea 52586">
      <div className="ao65-small">{a.linkedHunts.length} link(s) preserved</div>
    </Card>
  );
}

/** 52587 — Chat transcript archiving */
export function TranscriptArchiving() {
  const b = AO.archiveChatTranscripts([
    { role: 'user', text: 'kahan tak pahunche?', at: '2026-06-02' },
    { role: 'agent', text: 'Recon complete.', at: '2026-06-02' },
  ]);
  return (
    <Card title="Chat transcript archiving" note="Idea 52587">
      <div className="ao65-small">{b.count} message(s) archived</div>
    </Card>
  );
}

/** 52588 — Agent reasoning-trace archiving */
export function ReasoningTraceArchiving() {
  const b = AO.archiveReasoningTraces([{ step: 1, decision: 'scan', rationale: 'coverage', at: 't' }]);
  return (
    <Card title="Agent reasoning-trace archiving" note="Idea 52588">
      <div className="ao65-small">{b.count} trace(s) archived</div>
    </Card>
  );
}

/** 52589 — Report snapshot in archive */
export function ReportSnapshot() {
  const s = AO.snapshotReport({ pdfUrl: '/r.pdf', generatedAt: '2026-06-05', hash: 'h1' });
  return (
    <Card title="Report snapshot in archive" note="Idea 52589">
      <Badge tone="good">{s.immutable ? 'Immutable' : 'Mutable'}</Badge>
      <div className="ao65-mono">{s.hash}</div>
    </Card>
  );
}

/** 52590 — Archive restore testing */
export function RestoreTesting() {
  const t = AO.scheduleRestoreTest(DEMO_ARCHIVE);
  return (
    <Card title="Archive restore testing" note="Idea 52590">
      <div className="ao65-small">Test: {t.testId}</div>
      <div className="ao65-small">{t.steps.join(' → ')}</div>
    </Card>
  );
}

/** 52591 — Archive export manifest */
export function ExportManifest() {
  const m = AO.buildExportManifest([
    { path: 'findings.json', hash: 'h1', bytes: 100 },
    { path: 'report.pdf', hash: 'h2', bytes: 200 },
  ]);
  return (
    <Card title="Archive export manifest" note="Idea 52591">
      <div className="ao65-small">
        {m.fileCount} files · {m.totalBytes} bytes
      </div>
    </Card>
  );
}

/** 52592 — Archive expiry warnings */
export function ExpiryWarnings() {
  const w = AO.archiveExpiryWarnings(DEMO_ARCHIVE);
  return (
    <Card title="Archive expiry warnings" note="Idea 52592">
      {w.length ? (
        w.map((x, i) => (
          <div key={i} className="ao65-small">
            {x.message}
          </div>
        ))
      ) : (
        <Badge tone="good">No warnings due</Badge>
      )}
    </Card>
  );
}

/** 52593 — Archive search filters */
export function ArchiveSearchFilters() {
  const r = AO.filterArchives([DEMO_ARCHIVE], { target: 'acme', severity: 'critical' });
  return (
    <Card title="Archive search filters" note="Idea 52593">
      <div className="ao65-small">{r.length} match(es)</div>
    </Card>
  );
}

/** 52594 — Archive restore with re-index */
export function RestoreReindex() {
  const p = AO.planRestoreReindex(DEMO_ARCHIVE);
  return (
    <Card title="Archive restore with re-index" note="Idea 52594">
      <div className="ao65-small">Indexes: {p.indexes.join(', ')}</div>
      <Badge tone="good">{p.status}</Badge>
    </Card>
  );
}

/** 52595 — Auto email on hunt completion */
export function HuntCompletionEmail() {
  const e = AO.buildHuntCompletionEmail(DEMO_HUNT, ['stake@acme.com']);
  return (
    <Card title="Auto email on hunt completion" note="Idea 52595">
      <div className="ao65-small">{e.subject}</div>
      <div className="ao65-small">To: {e.to.join(', ')}</div>
    </Card>
  );
}

/** 52596 — Customizable email templates */
export function EmailTemplates() {
  const html = AO.renderEmailTemplate('<h1>{{title}}</h1><p>{{body}}</p>', {
    title: 'Hunt done',
    body: 'All clear.',
  });
  return (
    <Card title="Customizable email templates" note="Idea 52596">
      <div className="ao65-mono">{html}</div>
    </Card>
  );
}

/** 52597 — Executive summary email */
export function ExecSummaryEmail() {
  const e = AO.buildExecSummaryEmail(DEMO_HUNT);
  return (
    <Card title="Executive summary email" note="Idea 52597">
      <div className="ao65-small">{e.subject}</div>
      <div className="ao65-small">{e.body}</div>
    </Card>
  );
}

/** 52598 — Engineer detail email */
export function EngineerDetailEmail() {
  const e = AO.buildEngineerDetailEmail(DEMO_HUNT);
  return (
    <Card title="Engineer detail email" note="Idea 52598">
      <div className="ao65-small">{e.subject}</div>
      <pre className="ao65-pre">{e.body}</pre>
    </Card>
  );
}

/** 52599 — Email with PDF attached */
export function EmailWithPdf() {
  const e = AO.attachPdfToEmail({ subject: 'Summary', body: '...' }, 'exec', {
    exec: '/exec.pdf',
    technical: '/tech.pdf',
  });
  return (
    <Card title="Email with PDF attached" note="Idea 52599">
      <div className="ao65-small">Attachment: {e.attachments[0].filename}</div>
    </Card>
  );
}

/** 52600 — Link-only email option */
export function LinkOnlyEmail() {
  const e = AO.buildLinkOnlyEmail(DEMO_HUNT, 'https://secure.example/s/abc');
  return (
    <Card title="Link-only email option" note="Idea 52600">
      <div className="ao65-small">{e.body}</div>
      <Badge tone="good">No details in body</Badge>
    </Card>
  );
}

export const AO65_GALLERY = [
  ArchiveMigration,
  TeamArchiveStats,
  ArchiveQuotas,
  CleanupSuggestions,
  TimeCapsule,
  LinkedHuntPreservation,
  TranscriptArchiving,
  ReasoningTraceArchiving,
  ReportSnapshot,
  RestoreTesting,
  ExportManifest,
  ExpiryWarnings,
  ArchiveSearchFilters,
  RestoreReindex,
  HuntCompletionEmail,
  EmailTemplates,
  ExecSummaryEmail,
  EngineerDetailEmail,
  EmailWithPdf,
  LinkOnlyEmail,
];

export function ArchiveOpsGallery() {
  return (
    <div className="ao65-gallery">
      {AO65_GALLERY.map((C, i) => (
        <C key={i} />
      ))}
    </div>
  );
}
