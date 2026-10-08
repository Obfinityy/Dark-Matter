/**
 * ArchiveNotify.jsx — Infinity AI · Dark-Matter · Wave 65
 * 20 working React components for archive notifications & governance, ideas 52561–52580.
 * Export-only module: components are not mounted anywhere. Pure presentational,
 * props-driven; no localStorage (repo convention for wave galleries).
 */
import React from 'react';
import * as AN from './archiveNotifyCore.js';

const DEMO_ARCHIVE = {
  id: 'arc-demo-01',
  target: 'acme.com',
  ownerEmail: 'lead@acme.com',
  client: 'acme',
  createdAt: '2026-06-01T10:00:00Z',
  retentionExpiresAt: new Date(Date.now() + 20 * 86400000).toISOString(),
  findings: [
    { id: 'f1', title: 'XSS in search', severity: 'high', status: 'open' },
    { id: 'f2', title: 'SQLi in login', severity: 'critical', status: 'open' },
  ],
  pocBundles: ['poc/xss.zip'],
  exports: ['report.pdf'],
  attachments: ['notes.txt'],
  findingHash: 'abc123',
  summary: 'Q2 hunt on acme.com.',
  findingCounts: { critical: 1, high: 1 },
  archivedAt: '2026-07-01T10:00:00Z',
  tags: ['q2'],
  topSeverity: 'critical',
  sizeBytes: 250 * 1024 * 1024,
  team: 'red',
  ageDays: 400,
};

const DEMO_BLOBS = [
  { id: 'b1', sizeBytes: 1024, lastAccessedAt: new Date().toISOString() },
  { id: 'b2', sizeBytes: 2048, lastAccessedAt: new Date(Date.now() - 60 * 86400000).toISOString() },
];

function Card({ title, note, children }) {
  return (
    <div className="an65-card">
      <div className="an65-title">{title}</div>
      {note ? <div className="an65-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  const cls =
    tone === 'good'
      ? 'an65-badge an65-badge-good'
      : tone === 'warn'
        ? 'an65-badge an65-badge-warn'
        : tone === 'bad'
          ? 'an65-badge an65-badge-bad'
          : 'an65-badge';
  return <span className={cls}>{children}</span>;
}

/** 52561 — Archive notifications */
export function ArchiveNotifications() {
  const plan = AN.planArchiveNotifications(DEMO_ARCHIVE, 'pre-archive');
  return (
    <Card title="Archive notifications" note="Idea 52561">
      <div className="an65-small">{plan.message}</div>
      <div className="an65-small">To: {plan.recipients.join(', ')}</div>
    </Card>
  );
}

/** 52562 — Archive approval workflow */
export function ArchiveApproval() {
  const check = AN.checkArchiveApproval(DEMO_ARCHIVE);
  return (
    <Card title="Archive approval workflow" note="Idea 52562">
      <Badge tone={check.needsApproval ? 'warn' : 'good'}>
        {check.needsApproval ? 'Approval required' : 'No approval needed'}
      </Badge>
      <div className="an65-small">{check.reason}</div>
    </Card>
  );
}

/** 52563 — Archive associated files */
export function ArchiveFiles() {
  const files = AN.listArchiveFiles(DEMO_ARCHIVE);
  return (
    <Card title="Archive associated files" note="Idea 52563">
      <ul className="an65-list">
        {files.map(f => (
          <li key={f}>{f}</li>
        ))}
      </ul>
    </Card>
  );
}

/** 52564 — Separate evidence archiving */
export function EvidenceTiering() {
  const tiers = AN.tierEvidenceBlobs(DEMO_BLOBS, 30);
  return (
    <Card title="Separate evidence archiving" note="Idea 52564">
      <div className="an65-small">Hot: {tiers.hot.join(', ') || '—'}</div>
      <div className="an65-small">Cold: {tiers.cold.join(', ') || '—'}</div>
    </Card>
  );
}

/** 52565 — Partial archive option */
export function PartialArchive() {
  const manifest = AN.buildPartialArchiveManifest(DEMO_ARCHIVE, { dropTrafficLogs: true });
  return (
    <Card title="Partial archive option" note="Idea 52565">
      <div className="an65-small">Included: {manifest.included.join(', ')}</div>
      <div className="an65-small">Excluded: {manifest.excluded.join(', ')}</div>
    </Card>
  );
}

/** 52566 — Archive templates */
export function ArchiveTemplates() {
  const cfg = AN.applyArchiveTemplate(
    { name: 'Quarterly', include: ['findings', 'reports'], retentionDays: 365, tier: 'cold' },
    DEMO_ARCHIVE
  );
  return (
    <Card title="Archive templates" note="Idea 52566">
      <div className="an65-small">Template: {cfg.templateName}</div>
      <div className="an65-small">
        Retention: {cfg.retentionDays}d · Tier: {cfg.tier}
      </div>
    </Card>
  );
}

/** 52567 — Scheduled archive sweeps */
export function ArchiveSweeps() {
  const hunts = [
    { id: 'h1', lastActivityAt: new Date(Date.now() - 120 * 86400000).toISOString(), findings: [] },
    { id: 'h2', lastActivityAt: new Date().toISOString(), findings: [{ status: 'open' }] },
  ];
  const sweep = AN.planArchiveSweep(hunts, { inactiveDays: 90, maxOpenFindings: 0 });
  return (
    <Card title="Scheduled archive sweeps" note="Idea 52567">
      <div className="an65-small">{sweep.preview}</div>
      <div className="an65-small">Targets: {sweep.toArchive.join(', ') || '—'}</div>
    </Card>
  );
}

/** 52568 — Cross-archive search */
export function CrossArchiveSearch() {
  const results = AN.searchAcrossArchives([DEMO_ARCHIVE], 'xss');
  return (
    <Card title="Cross-archive search" note="Idea 52568">
      <div className="an65-small">{results.length} match(es)</div>
      <ul className="an65-list">
        {results.map((r, i) => (
          <li key={i}>{r.finding.title}</li>
        ))}
      </ul>
    </Card>
  );
}

/** 52569 — Archive analytics */
export function ArchiveAnalytics() {
  const stats = AN.computeArchiveAnalytics([DEMO_ARCHIVE, { ...DEMO_ARCHIVE, id: 'a2', restoredAt: '2026-08-01' }]);
  return (
    <Card title="Archive analytics" note="Idea 52569">
      <div className="an65-small">Total: {stats.totalArchives}</div>
      <div className="an65-small">Restore rate: {(stats.restoreRate * 100).toFixed(0)}%</div>
    </Card>
  );
}

/** 52570 — Compliance retention mapping */
export function ComplianceRetention() {
  const pci = AN.complianceRetention('PCI-DSS');
  return (
    <Card title="Compliance retention mapping" note="Idea 52570">
      <div className="an65-small">
        {pci.framework}: {pci.retentionDays} days
      </div>
      <div className="an65-small">{pci.note}</div>
    </Card>
  );
}

/** 52571 — Archive redaction option */
export function ArchiveRedaction() {
  const out = AN.redactForArchive('Contact admin@acme.com, key sk-abcdef1234567890 here.');
  return (
    <Card title="Archive redaction option" note="Idea 52571">
      <div className="an65-small">{out.redacted}</div>
      <Badge tone="good">{out.redactionCount} redactions</Badge>
    </Card>
  );
}

/** 52572 — Limited archive sharing */
export function LimitedArchiveShare() {
  const share = AN.buildLimitedArchiveShare(DEMO_ARCHIVE);
  return (
    <Card title="Limited archive sharing" note="Idea 52572">
      <div className="an65-small">{share.summary}</div>
      <div className="an65-small">{share.note}</div>
    </Card>
  );
}

/** 52573 — Duplicate-archive detection */
export function DuplicateArchiveDetection() {
  const warn = AN.detectDuplicateArchive(DEMO_ARCHIVE, [DEMO_ARCHIVE]);
  return (
    <Card title="Duplicate-archive detection" note="Idea 52573">
      {warn ? <Badge tone="warn">{warn.warning}</Badge> : <Badge tone="good">No duplicates</Badge>}
    </Card>
  );
}

/** 52574 — Archive naming conventions */
export function ArchiveNaming() {
  const name = AN.autoNameArchive({ target: 'acme.com', id: 'hunt-12345678' });
  return (
    <Card title="Archive naming conventions" note="Idea 52574">
      <div className="an65-mono">{name}</div>
    </Card>
  );
}

/** 52575 — Archive folder structure */
export function ArchiveFolders() {
  const path = AN.archiveFolderPath(DEMO_ARCHIVE, 'client/year');
  return (
    <Card title="Archive folder structure" note="Idea 52575">
      <div className="an65-mono">{path}</div>
    </Card>
  );
}

/** 52576 — Archive API */
export function ArchiveApi() {
  const res = AN.validateArchiveApiRequest({ action: 'restore', archiveId: 'a1', apiKey: 'k' });
  return (
    <Card title="Archive API" note="Idea 52576">
      <Badge tone={res.valid ? 'good' : 'bad'}>{res.valid ? 'Valid request' : res.error}</Badge>
    </Card>
  );
}

/** 52577 — Archive webhooks */
export function ArchiveWebhooks() {
  const hook = AN.buildArchiveWebhook('archived', DEMO_ARCHIVE);
  return (
    <Card title="Archive webhooks" note="Idea 52577">
      <div className="an65-mono">{hook.event}</div>
      <div className="an65-small">{hook.at}</div>
    </Card>
  );
}

/** 52578 — Pre-archive review reminder */
export function PreArchiveReminder() {
  const r = AN.preArchiveReviewReminder(DEMO_ARCHIVE, '2026-12-01T00:00:00Z');
  return (
    <Card title="Pre-archive review reminder" note="Idea 52578">
      <div className="an65-small">{r.message}</div>
    </Card>
  );
}

/** 52579 — Archive restore request flow */
export function RestoreRequestFlow() {
  const ticket = AN.requestArchiveRestore({ archiveId: 'a1', requester: 'dev@acme.com', reason: 'audit' });
  return (
    <Card title="Archive restore request flow" note="Idea 52579">
      <div className="an65-small">Ticket: {ticket.ticketId}</div>
      <Badge tone="warn">{ticket.status}</Badge>
    </Card>
  );
}

/** 52580 — Archive ownership transfer */
export function OwnershipTransfer() {
  const t = AN.transferArchiveOwnership(DEMO_ARCHIVE, 'newlead@acme.com', 'team change');
  return (
    <Card title="Archive ownership transfer" note="Idea 52580">
      <div className="an65-small">
        {t.previousOwner} → {t.newOwner}
      </div>
    </Card>
  );
}

export const AN65_GALLERY = [
  ArchiveNotifications,
  ArchiveApproval,
  ArchiveFiles,
  EvidenceTiering,
  PartialArchive,
  ArchiveTemplates,
  ArchiveSweeps,
  CrossArchiveSearch,
  ArchiveAnalytics,
  ComplianceRetention,
  ArchiveRedaction,
  LimitedArchiveShare,
  DuplicateArchiveDetection,
  ArchiveNaming,
  ArchiveFolders,
  ArchiveApi,
  ArchiveWebhooks,
  PreArchiveReminder,
  RestoreRequestFlow,
  OwnershipTransfer,
];

export function ArchiveNotifyGallery() {
  return (
    <div className="an65-gallery">
      {AN65_GALLERY.map((C, i) => (
        <C key={i} />
      ))}
    </div>
  );
}
