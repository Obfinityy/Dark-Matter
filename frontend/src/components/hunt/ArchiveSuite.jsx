/**
 * ArchiveSuite.jsx — Infinity AI · Dark-Matter · Wave 64
 * 25 working React components for hunt archive management, ideas 52536–52560.
 * Export-only module: components are not mounted anywhere. Pure presentational,
 * props-driven; no localStorage (repo convention for wave galleries).
 */
import React from 'react';
import * as AR from './archiveCore.js';

const NOW = 1700000000000;
const DAY = 86400000;

const DEMO_HUNT = {
  id: 'hunt-demo',
  target: 'acme.com',
  at: NOW - 400 * DAY,
  bytes: 250 * 1024 * 1024,
  findings: [
    { id: 'f1', title: 'XSS', severity: 'high', state: 'fixed' },
    { id: 'f2', title: 'SQLi', severity: 'critical', state: 'verified' },
  ],
};

const DEMO_ARCHIVE = Object.assign(
  AR.archiveHunt(
    DEMO_HUNT,
    { reason: 'quarterly closeout', tags: ['q3-audit'], storage: 's3', actor: 'lead' },
    NOW - 30 * DAY
  ),
  {
    severityCounts: { critical: 1, high: 1 },
    topFindings: [
      { title: 'SQLi', severity: 'critical' },
      { title: 'XSS', severity: 'high' },
    ],
    workspace: 'default',
  }
);

function Card({ title, note, children }) {
  return (
    <div className="ar64-card">
      <div className="ar64-title">{title}</div>
      {note ? <div className="ar64-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  const cls =
    tone === 'good'
      ? 'ar64-badge ar64-badge-good'
      : tone === 'warn'
        ? 'ar64-badge ar64-badge-warn'
        : tone === 'bad'
          ? 'ar64-badge ar64-badge-bad'
          : 'ar64-badge';
  return <span className={cls}>{children}</span>;
}

/** 52536 — One-click archive. */
export function OneClickArchive() {
  const a = AR.archiveHunt(DEMO_HUNT, { reason: 'done', actor: 'analyst' }, NOW);
  return (
    <Card title="One-click archive" note="Full-fidelity archive, restorable later.">
      <div className="ar64-row">
        <span>ID</span>
        <span className="ar64-stat">{a.id}</span>
      </div>
      <div className="ar64-row">
        <span>Version</span>
        <span className="ar64-stat">v{a.version}</span>
      </div>
      <div className="ar64-row">
        <span>Checksum</span>
        <span className="ar64-stat">{a.checksum}</span>
      </div>
    </Card>
  );
}

/** 52537 — Auto-archive by age. */
export function AutoArchiveByAge() {
  const hunts = [
    { id: 'old', at: NOW - 400 * DAY },
    { id: 'new', at: NOW - 10 * DAY },
  ];
  const due = AR.dueForAgeArchive(hunts, 365, NOW);
  return (
    <Card title="Auto-archive by age" note="Hunts older than the threshold.">
      <div className="ar64-row">
        <span>Due</span>
        <Badge tone={due.length ? 'warn' : 'good'}>{due.length}</Badge>
      </div>
      {due.map(h => (
        <div className="ar64-row" key={h.id}>
          <span>{h.id}</span>
        </div>
      ))}
    </Card>
  );
}

/** 52538 — Auto-archive when all fixed. */
export function AutoArchiveAllFixed() {
  const hunts = [
    { id: 'clean', findings: [{ state: 'fixed' }, { state: 'verified' }] },
    { id: 'dirty', findings: [{ state: 'open' }] },
  ];
  const due = AR.dueForFixedArchive(hunts);
  return (
    <Card title="Auto-archive when all fixed" note="Summary stays visible after archival.">
      <div className="ar64-row">
        <span>Due</span>
        <span className="ar64-stat">{due.map(h => h.id).join(', ') || 'none'}</span>
      </div>
    </Card>
  );
}

/** 52539 — Storage location choice. */
export function StorageLocation() {
  const loc = AR.resolveArchiveLocation(
    { defaultStorage: 's3', perWorkspace: { eu: 'cold' } },
    'eu'
  );
  return (
    <Card title="Archive storage location" note="Per-policy location resolution.">
      <div className="ar64-row">
        <span>EU workspace</span>
        <span className="ar64-stat">{loc}</span>
      </div>
      <div className="ar64-row">
        <span>Default</span>
        <span className="ar64-stat">{AR.resolveArchiveLocation({})}</span>
      </div>
    </Card>
  );
}

/** 52540 — Compression estimate. */
export function ArchiveCompression() {
  const r = AR.estimateCompressedSize(1024 * 1024 * 500, 0.35);
  return (
    <Card title="Archive compression" note="Shrink evidence and logs before storing.">
      <div className="ar64-row">
        <span>Original</span>
        <span className="ar64-stat">{r.bytes} B</span>
      </div>
      <div className="ar64-row">
        <span>Compressed</span>
        <span className="ar64-stat">{r.compressed} B</span>
      </div>
      <div className="ar64-row">
        <span>Saved</span>
        <Badge tone="good">{r.saved} B</Badge>
      </div>
    </Card>
  );
}

/** 52541 — Encryption at rest. */
export function ArchiveEncryption() {
  const env = AR.buildArchiveEnvelope(DEMO_ARCHIVE, 'org-kms-key-7');
  return (
    <Card title="Encryption at rest" note="Org-managed keys for sensitive data.">
      <div className="ar64-row">
        <span>Algorithm</span>
        <span className="ar64-stat">{env.algorithm}</span>
      </div>
      <div className="ar64-row">
        <span>Key</span>
        <span className="ar64-stat">{env.keyRef}</span>
      </div>
    </Card>
  );
}

/** 52542 — Metadata search. */
export function ArchiveSearch() {
  const hits = AR.searchArchives([DEMO_ARCHIVE], 'acme');
  return (
    <Card title="Archive metadata search" note="Search without restoring.">
      <div className="ar64-row">
        <span>Query “acme”</span>
        <Badge tone="good">{hits.length} hit(s)</Badge>
      </div>
      {hits.map(h => (
        <div className="ar64-row" key={h.id}>
          <span>{h.target}</span>
        </div>
      ))}
    </Card>
  );
}

/** 52543 — One-click restore. */
export function ArchiveRestore() {
  const r = AR.restoreArchive(DEMO_ARCHIVE, NOW);
  return (
    <Card title="One-click restore" note="Back to full interactive state.">
      <div className="ar64-row">
        <span>Restored</span>
        <Badge tone={r.restored ? 'good' : 'bad'}>{r.restored ? 'yes' : 'no'}</Badge>
      </div>
      <div className="ar64-row">
        <span>Restores</span>
        <span className="ar64-stat">{r.archive.restores}</span>
      </div>
    </Card>
  );
}

/** 52544 — Summary preview. */
export function ArchivePreview() {
  const p = AR.archiveSummaryPreview(DEMO_ARCHIVE);
  return (
    <Card title="Archive summary preview" note="Key stats without a full restore.">
      <div className="ar64-row">
        <span>Target</span>
        <span className="ar64-stat">{p.target}</span>
      </div>
      <div className="ar64-row">
        <span>Top finding</span>
        <span className="ar64-stat">{p.topFindings[0].title}</span>
      </div>
    </Card>
  );
}

/** 52545 — Retention policies. */
export function RetentionPolicies() {
  const r = AR.retentionStatus(DEMO_ARCHIVE, { keepDays: 730 }, NOW);
  return (
    <Card title="Retention policies" note="Keep 2 years, then purge — unless held.">
      <div className="ar64-row">
        <span>Status</span>
        <Badge tone={r.status === 'retained' ? 'good' : 'warn'}>{r.status}</Badge>
      </div>
    </Card>
  );
}

/** 52546 — Legal hold. */
export function LegalHold() {
  const held = AR.applyLegalHold(DEMO_ARCHIVE, { matter: 'litigation-42', actor: 'counsel' }, NOW);
  const r = AR.retentionStatus(held, { keepDays: 1 }, NOW + 10 * DAY);
  return (
    <Card title="Legal hold" note="Blocks deletion and auto-purge.">
      <div className="ar64-row">
        <span>Hold</span>
        <Badge tone="warn">active</Badge>
      </div>
      <div className="ar64-row">
        <span>Retention</span>
        <span className="ar64-stat">{r.status}</span>
      </div>
    </Card>
  );
}

/** 52547 — Access permissions. */
export function ArchivePermissions() {
  const analyst = { role: 'analyst', scopes: ['archive:view'] };
  const canView = AR.canAccessArchive(analyst, DEMO_ARCHIVE, 'view');
  const canDelete = AR.canAccessArchive(analyst, DEMO_ARCHIVE, 'delete');
  return (
    <Card title="Archive permissions" note="Separate from active-hunt permissions.">
      <div className="ar64-row">
        <span>View</span>
        <Badge tone={canView ? 'good' : 'bad'}>{canView ? 'allow' : 'deny'}</Badge>
      </div>
      <div className="ar64-row">
        <span>Delete</span>
        <Badge tone={canDelete ? 'good' : 'bad'}>{canDelete ? 'allow' : 'deny'}</Badge>
      </div>
    </Card>
  );
}

/** 52548 — Export-before-delete. */
export function ExportBeforeDelete() {
  const r = AR.requireExportBeforeDelete(DEMO_ARCHIVE);
  return (
    <Card title="Export-before-delete" note="Final bundle required first.">
      <div className="ar64-row">
        <span>Allowed</span>
        <Badge tone={r.allowed ? 'good' : 'warn'}>{r.allowed ? 'yes' : 'no'}</Badge>
      </div>
      {!r.allowed ? (
        <div className="ar64-row">
          <span>{r.reason}</span>
        </div>
      ) : null}
    </Card>
  );
}

/** 52549 — Archive vs delete distinction. */
export function ArchiveVsDelete() {
  const d = AR.describeArchiveVsDelete();
  return (
    <Card title="Archive vs delete" note="Preserve vs destroy — different confirmations.">
      <div className="ar64-row">
        <span>Archive</span>
        <span className="ar64-note">{d.archive.effect}</span>
      </div>
      <div className="ar64-row">
        <span>Delete</span>
        <span className="ar64-note">{d.delete.effect}</span>
      </div>
    </Card>
  );
}

/** 52550 — Bulk archive. */
export function BulkArchive() {
  const recs = AR.bulkArchive(
    [DEMO_HUNT, { ...DEMO_HUNT, id: 'hunt-demo-2' }],
    { reason: 'quarterly' },
    NOW
  );
  return (
    <Card title="Bulk archive" note="Many hunts, shared reason and retention.">
      <div className="ar64-row">
        <span>Archived</span>
        <Badge tone="good">{recs.length}</Badge>
      </div>
      {recs.map(r => (
        <div className="ar64-row" key={r.id}>
          <span className="ar64-stat">{r.id}</span>
        </div>
      ))}
    </Card>
  );
}

/** 52551 — Archive tags. */
export function ArchiveTags() {
  const t = AR.tagArchive(DEMO_ARCHIVE, ['Client-Acme', 'q3-audit']);
  return (
    <Card title="Archive tags" note="Organized retrieval.">
      <div className="ar64-row">
        <span>Tags</span>
        <span className="ar64-stat">{t.tags.join(', ')}</span>
      </div>
    </Card>
  );
}

/** 52552 — Reason notes. */
export function ArchiveReasonNotes() {
  const r = AR.recordArchiveReason(DEMO_ARCHIVE, 'engagement closed', 'lead', NOW);
  return (
    <Card title="Archive reason notes" note="Future context for why it was archived.">
      <div className="ar64-row">
        <span>Reason</span>
        <span className="ar64-stat">{r.reason}</span>
      </div>
      <div className="ar64-row">
        <span>History</span>
        <span className="ar64-stat">{r.reasonHistory.length} entr(y/ies)</span>
      </div>
    </Card>
  );
}

/** 52553 — Archive dashboard. */
export function ArchiveDashboard() {
  const d = AR.buildArchiveDashboard([DEMO_ARCHIVE], NOW);
  return (
    <Card title="Archive dashboard" note="Size, age, retention, restore activity.">
      <div className="ar64-row">
        <span>Archives</span>
        <span className="ar64-stat">{d.count}</span>
      </div>
      <div className="ar64-row">
        <span>Total bytes</span>
        <span className="ar64-stat">{d.totalBytes}</span>
      </div>
      <div className="ar64-row">
        <span>Due purge</span>
        <Badge tone={d.duePurge ? 'warn' : 'good'}>{d.duePurge}</Badge>
      </div>
    </Card>
  );
}

/** 52554 — Storage usage meter. */
export function StorageMeter() {
  const m = AR.storageUsageMeter([DEMO_ARCHIVE], 1024 * 1024);
  return (
    <Card title="Storage usage meter" note="Per-workspace bytes with projections.">
      {m.map(w => (
        <div className="ar64-row" key={w.workspace}>
          <span>{w.workspace}</span>
          <span className="ar64-stat">
            {w.bytes} B → {w.projected30d} B
          </span>
        </div>
      ))}
      <div className="ar64-row">
        <span>Suggestion</span>
        <span className="ar64-note">{m[0].suggestion}</span>
      </div>
    </Card>
  );
}

/** 52555 — Cost estimator. */
export function CostEstimator() {
  const hot = AR.estimateArchiveCost(100 * 1024 ** 3, 'hot');
  const cold = AR.estimateArchiveCost(100 * 1024 ** 3, 'cold');
  return (
    <Card title="Cost estimator" note="See tier costs before choosing.">
      <div className="ar64-row">
        <span>Hot / mo</span>
        <span className="ar64-stat">${hot.monthlyUsd}</span>
      </div>
      <div className="ar64-row">
        <span>Cold / mo</span>
        <span className="ar64-stat">${cold.monthlyUsd}</span>
      </div>
    </Card>
  );
}

/** 52556 — Cold-storage tiering. */
export function ColdTiering() {
  const plan = AR.tieringPlan([DEMO_ARCHIVE], { coldAfterDays: 90 }, NOW);
  return (
    <Card title="Cold-storage tiering" note="Automatic moves by policy.">
      <div className="ar64-row">
        <span>Move to cold</span>
        <Badge tone={plan.moveToCold.length ? 'warn' : 'good'}>{plan.moveToCold.length}</Badge>
      </div>
    </Card>
  );
}

/** 52557 — Integrity checksums. */
export function ChecksumVerify() {
  const r = AR.verifyArchiveChecksum(DEMO_ARCHIVE);
  return (
    <Card title="Integrity checksums" note="Detect corruption on restore.">
      <div className="ar64-row">
        <span>Integrity</span>
        <Badge tone={r.ok ? 'good' : 'bad'}>{r.ok ? 'ok' : 'corrupt'}</Badge>
      </div>
      <div className="ar64-row">
        <span>Checksum</span>
        <span className="ar64-stat">{r.expected}</span>
      </div>
    </Card>
  );
}

/** 52558 — Archive versioning. */
export function ArchiveVersioning() {
  const v2 = AR.versionArchive(DEMO_ARCHIVE, NOW);
  return (
    <Card title="Archive versioning" note="Re-archives never silently overwrite.">
      <div className="ar64-row">
        <span>Version</span>
        <span className="ar64-stat">v{v2.version}</span>
      </div>
      <div className="ar64-row">
        <span>Prior checksum</span>
        <span className="ar64-stat">{v2.priorChecksum}</span>
      </div>
    </Card>
  );
}

/** 52559 — Audit log. */
export function ArchiveAuditLog() {
  const log = AR.logArchiveAction(
    [],
    { type: 'archive', archiveId: DEMO_ARCHIVE.id, actor: 'lead' },
    NOW
  );
  const log2 = AR.logArchiveAction(
    log,
    { type: 'restore', archiveId: DEMO_ARCHIVE.id, actor: 'analyst' },
    NOW + 1000
  );
  return (
    <Card title="Archive audit log" note="Every action with actor and timestamp.">
      {log2.map((e, i) => (
        <div className="ar64-row" key={i}>
          <span>{e.type}</span>
          <span className="ar64-stat">{e.actor}</span>
        </div>
      ))}
    </Card>
  );
}

/** 52560 — Read-only archived view. */
export function ReadOnlyView() {
  const v = AR.readOnlyView(DEMO_ARCHIVE);
  return (
    <Card title="Read-only archived view" note="Browse without restoring.">
      <div className="ar64-row">
        <span>{v.banner}</span>
      </div>
      <div className="ar64-row">
        <span>Target</span>
        <span className="ar64-stat">{v.summary.target}</span>
      </div>
    </Card>
  );
}

export const AR64_GALLERY = [
  OneClickArchive,
  AutoArchiveByAge,
  AutoArchiveAllFixed,
  StorageLocation,
  ArchiveCompression,
  ArchiveEncryption,
  ArchiveSearch,
  ArchiveRestore,
  ArchivePreview,
  RetentionPolicies,
  LegalHold,
  ArchivePermissions,
  ExportBeforeDelete,
  ArchiveVsDelete,
  BulkArchive,
  ArchiveTags,
  ArchiveReasonNotes,
  ArchiveDashboard,
  StorageMeter,
  CostEstimator,
  ColdTiering,
  ChecksumVerify,
  ArchiveVersioning,
  ArchiveAuditLog,
  ReadOnlyView,
];

export function ArchiveSuiteGallery() {
  return (
    <div className="ar64-gallery">
      {AR64_GALLERY.map((C, i) => (
        <C key={i} />
      ))}
    </div>
  );
}
