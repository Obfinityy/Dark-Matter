/**
 * archiveCore.js — Infinity AI · Dark-Matter · Wave 64 (ideas 52536–52560)
 * Pure JS (no React / DOM / network). Deterministic hunt-archive helpers:
 * one-click archiving, auto-archive rules, storage location choice,
 * compression/encryption envelopes, metadata search, restore, summary
 * previews, retention policies, legal holds, permissions, export-before-delete,
 * archive-vs-delete distinction, bulk ops, tags, reason notes, dashboards,
 * usage meters, cost estimation, cold tiering, checksums, versioning,
 * audit logs, and read-only views. Time is injected via `now` params
 * (default Date.now()) so every function is reproducible.
 *
 * Archive shape used throughout:
 * {
 *   id, huntId, target, archivedAt, bytes, storage, tier, encrypted,
 *   checksum, version, tags: [], reason, legalHold: bool, retentionUntil,
 *   restores, exports, deleted
 * }
 */

export const WAVE64_AR_IDEAS = [
  {
    id: 52536,
    title: 'One-click hunt archive',
    desc: 'Archive a completed hunt with all data, preserving full fidelity for later restore.',
    skip: false,
  },
  {
    id: 52537,
    title: 'Auto-archive by age',
    desc: 'Automatically archive hunts older than a configurable threshold (e.g. 12 months).',
    skip: false,
  },
  {
    id: 52538,
    title: 'Auto-archive when all fixed',
    desc: 'Archive hunts whose findings are all closed/verified, keeping the summary visible.',
    skip: false,
  },
  {
    id: 52539,
    title: 'Archive storage location choice',
    desc: 'Choose local disk, S3, or cold storage per archive policy.',
    skip: false,
  },
  {
    id: 52540,
    title: 'Archive compression',
    desc: 'Compress archived hunt data (evidence, logs) to minimize storage footprint.',
    skip: false,
  },
  {
    id: 52541,
    title: 'Archive encryption at rest',
    desc: 'Encrypt archives with org-managed keys for sensitive engagement data.',
    skip: false,
  },
  {
    id: 52542,
    title: 'Archive metadata search',
    desc: 'Search across archives by target, date, severity counts, and tags without restoring.',
    skip: false,
  },
  {
    id: 52543,
    title: 'One-click archive restore',
    desc: 'Bring an archived hunt back to full interactive state with re-indexing.',
    skip: false,
  },
  {
    id: 52544,
    title: 'Archive summary preview',
    desc: 'View key stats and top findings of an archived hunt without a full restore.',
    skip: false,
  },
  {
    id: 52545,
    title: 'Archive retention policies',
    desc: 'Define per-workspace retention (keep 2 years, then purge) with legal overrides.',
    skip: false,
  },
  {
    id: 52546,
    title: 'Legal hold on archives',
    desc: 'Place litigation holds that block deletion or auto-purge of specific archives.',
    skip: false,
  },
  {
    id: 52547,
    title: 'Archive access permissions',
    desc: 'Separate permission set for viewing/restoring archives vs active hunts.',
    skip: false,
  },
  {
    id: 52548,
    title: 'Export-before-delete',
    desc: 'Require generating a final export bundle before an archive can be permanently deleted.',
    skip: false,
  },
  {
    id: 52549,
    title: 'Archive vs delete distinction',
    desc: 'Clear UI separation: archiving preserves data, deleting destroys it, with different confirmations.',
    skip: false,
  },
  {
    id: 52550,
    title: 'Bulk archive (post-hunt)',
    desc: 'Archive many hunts at once with shared reason and retention settings.',
    skip: false,
  },
  {
    id: 52551,
    title: 'Archive tags',
    desc: 'Tag archives (q3-audit, client-acme, baseline) for organized retrieval.',
    skip: false,
  },
  {
    id: 52552,
    title: 'Archive reason notes',
    desc: 'Record why a hunt was archived for future context.',
    skip: false,
  },
  {
    id: 52553,
    title: 'Archive dashboard',
    desc: 'Overview of all archives: size, age, retention status, and restore activity.',
    skip: false,
  },
  {
    id: 52554,
    title: 'Archive storage usage meter',
    desc: 'Track bytes per workspace with projections and cleanup suggestions.',
    skip: false,
  },
  {
    id: 52555,
    title: 'Archive cost estimator',
    desc: 'Show storage cost implications before choosing archive tiers.',
    skip: false,
  },
  {
    id: 52556,
    title: 'Cold-storage tiering',
    desc: 'Move old archives to cheaper cold storage automatically by policy.',
    skip: false,
  },
  {
    id: 52557,
    title: 'Archive integrity checksums',
    desc: 'Hash every archive and verify integrity on restore to detect corruption.',
    skip: false,
  },
  {
    id: 52558,
    title: 'Archive versioning',
    desc: 'If a hunt is re-archived, keep versions so nothing is silently overwritten.',
    skip: false,
  },
  {
    id: 52559,
    title: 'Archive audit log',
    desc: 'Record every archive, restore, export, and delete action with actor and timestamp.',
    skip: false,
  },
  {
    id: 52560,
    title: 'Read-only archived view',
    desc: 'Browse archived hunts in a clearly marked read-only mode without restoring.',
    skip: false,
  },
];

const DAY = 86400000;

/** Simple deterministic 32-bit hash (FNV-1a) for checksum demos. */
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * 52536 — Build an archive record for a completed hunt.
 * @param {object} hunt { id, target, at, findings, bytes }
 * @param {object} [opts] { reason, tags, storage, actor }
 * @param {number} [now]
 * @returns {object} Archive record (version 1).
 */
export function archiveHunt(hunt, opts, now = Date.now()) {
  const o = opts || {};
  return {
    id: `arc-${hunt.id}`,
    huntId: hunt.id,
    target: hunt.target,
    archivedAt: now,
    bytes: hunt.bytes || 0,
    storage: o.storage || 'local',
    tier: 'hot',
    encrypted: false,
    checksum: fnv1a(`${hunt.id}:${now}`),
    version: 1,
    tags: Array.isArray(o.tags) ? [...o.tags] : [],
    reason: o.reason || 'manual archive',
    legalHold: false,
    retentionUntil: null,
    restores: 0,
    exports: 0,
    deleted: false,
    actor: o.actor || 'system',
  };
}

/**
 * 52537 — Hunts older than thresholdDays and not yet archived.
 * @param {object[]} hunts { id, at }
 * @param {number} thresholdDays
 * @param {number} [now]
 * @returns {object[]} Due hunts.
 */
export function dueForAgeArchive(hunts, thresholdDays, now = Date.now()) {
  const cutoff = now - thresholdDays * DAY;
  return hunts.filter(h => h.at && h.at < cutoff && !h.archived);
}

/**
 * 52538 — Hunts where every finding is closed/verified.
 * @param {object[]} hunts
 * @returns {object[]} Due hunts.
 */
export function dueForFixedArchive(hunts) {
  return hunts.filter(h => {
    const fs = Array.isArray(h.findings) ? h.findings : [];
    return fs.length > 0 && fs.every(f => f.state === 'fixed' || f.state === 'verified' || f.fp);
  });
}

/**
 * 52539 — Resolve storage location from policy.
 * @param {object} policy { defaultStorage, perWorkspace }
 * @param {string} [workspace]
 * @returns {'local'|'s3'|'cold'}
 */
export function resolveArchiveLocation(policy, workspace) {
  const p = policy || {};
  if (workspace && p.perWorkspace && p.perWorkspace[workspace]) return p.perWorkspace[workspace];
  return p.defaultStorage || 'local';
}

/**
 * 52540 — Estimated compressed size.
 * @param {number} bytes
 * @param {number} [ratio=0.35] Compression ratio (0..1).
 * @returns {{ bytes: number, compressed: number, saved: number }}
 */
export function estimateCompressedSize(bytes, ratio = 0.35) {
  const r = Math.min(0.95, Math.max(0, ratio));
  const compressed = Math.round(bytes * (1 - r));
  return { bytes, compressed, saved: bytes - compressed };
}

/**
 * 52541 — Encryption envelope for an archive.
 * @param {object} archive
 * @param {string} keyRef Org-managed key reference.
 * @returns {object} Encrypted envelope (metadata only; no real crypto here).
 */
export function buildArchiveEnvelope(archive, keyRef) {
  return {
    archiveId: archive.id,
    encrypted: true,
    algorithm: 'AES-256-GCM',
    keyRef,
    checksum: archive.checksum,
    sealedAt: Date.now(),
  };
}

/**
 * 52542 — Search archives by text across target, tags, reason.
 * @param {object[]} archives
 * @param {string} query
 * @returns {object[]} Matches (deleted excluded).
 */
export function searchArchives(archives, query) {
  const q = String(query || '')
    .toLowerCase()
    .trim();
  if (!q) return [];
  return archives.filter(a => {
    if (a.deleted) return false;
    const hay = [a.target, a.reason, ...(a.tags || [])].join(' ').toLowerCase();
    return hay.includes(q);
  });
}

/**
 * 52543 — Restore an archive to interactive state.
 * @param {object} archive
 * @param {number} [now]
 * @returns {{ archive: object, restored: boolean, reason?: string }}
 */
export function restoreArchive(archive, now = Date.now()) {
  if (archive.deleted) return { archive, restored: false, reason: 'archive deleted' };
  if (archive.legalHold) return { archive, restored: false, reason: 'legal hold active' };
  const next = {
    ...archive,
    restores: (archive.restores || 0) + 1,
    lastRestoredAt: now,
    tier: 'hot',
  };
  return { archive: next, restored: true };
}

/**
 * 52544 — Lightweight preview without full restore.
 * @param {object} archive
 * @returns {object} Summary stats.
 */
export function archiveSummaryPreview(archive) {
  return {
    id: archive.id,
    target: archive.target,
    archivedAt: archive.archivedAt,
    bytes: archive.bytes,
    tier: archive.tier,
    tags: archive.tags || [],
    reason: archive.reason,
    topFindings: (archive.topFindings || []).slice(0, 5),
    severityCounts: archive.severityCounts || {},
    restores: archive.restores || 0,
  };
}

/**
 * 52545 — Retention status for an archive under a policy.
 * @param {object} archive
 * @param {object} policy { keepDays, legalOverride }
 * @param {number} [now]
 * @returns {{ status: 'retained'|'due-purge'|'held', purgeAt: number|null }}
 */
export function retentionStatus(archive, policy, now = Date.now()) {
  if (archive.legalHold || (policy && policy.legalOverride)) {
    return { status: 'held', purgeAt: null };
  }
  const keepDays = (policy && policy.keepDays) || 730;
  const purgeAt = (archive.archivedAt || now) + keepDays * DAY;
  return { status: now >= purgeAt ? 'due-purge' : 'retained', purgeAt };
}

/**
 * 52546 — Apply a litigation hold.
 * @param {object} archive
 * @param {object} hold { matter, actor }
 * @param {number} [now]
 * @returns {object} Archive with hold.
 */
export function applyLegalHold(archive, hold, now = Date.now()) {
  return {
    ...archive,
    legalHold: true,
    hold: { matter: hold.matter, actor: hold.actor, placedAt: now },
  };
}

/**
 * 52547 — Permission check for archive actions.
 * @param {object} user { role, scopes }
 * @param {object} archive
 * @param {'view'|'restore'|'delete'|'export'} action
 * @returns {boolean}
 */
export function canAccessArchive(user, archive, action) {
  const scopes = (user && user.scopes) || [];
  if (user && user.role === 'admin') return true;
  const need = `archive:${action}`;
  if (!scopes.includes(need) && !scopes.includes('archive:*')) return false;
  if (action === 'delete' && archive.legalHold) return false;
  return true;
}

/**
 * 52548 — Gate deletion on a prior export bundle.
 * @param {object} archive
 * @returns {{ allowed: boolean, reason?: string }}
 */
export function requireExportBeforeDelete(archive) {
  if (archive.legalHold) return { allowed: false, reason: 'legal hold active' };
  if (!archive.exports || archive.exports < 1) {
    return { allowed: false, reason: 'final export bundle required before delete' };
  }
  return { allowed: true };
}

/**
 * 52549 — Canonical copy distinguishing archive vs delete.
 * @returns {{ archive: object, delete: object }}
 */
export function describeArchiveVsDelete() {
  return {
    archive: {
      label: 'Archive',
      effect: 'Preserves all data; hunt becomes read-only and restorable.',
      confirm: 'Archive this hunt? It stays searchable and can be restored.',
    },
    delete: {
      label: 'Delete permanently',
      effect: 'Destroys all data irreversibly after a final export.',
      confirm: 'Permanently delete? This cannot be undone. A final export is required first.',
    },
  };
}

/**
 * 52550 — Archive many hunts with shared settings.
 * @param {object[]} hunts
 * @param {object} [opts]
 * @param {number} [now]
 * @returns {object[]} Archive records.
 */
export function bulkArchive(hunts, opts, now = Date.now()) {
  return hunts.map(h => archiveHunt(h, opts, now));
}

/**
 * 52551 — Add tags to an archive (deduped, lowercase).
 * @param {object} archive
 * @param {string[]} tags
 * @returns {object}
 */
export function tagArchive(archive, tags) {
  const merged = new Set([
    ...(archive.tags || []),
    ...(tags || []).map(t => String(t).toLowerCase()),
  ]);
  return { ...archive, tags: [...merged] };
}

/**
 * 52552 — Record why a hunt was archived.
 * @param {object} archive
 * @param {string} reason
 * @param {string} actor
 * @param {number} [now]
 * @returns {object}
 */
export function recordArchiveReason(archive, reason, actor, now = Date.now()) {
  return {
    ...archive,
    reason,
    reasonHistory: [...(archive.reasonHistory || []), { reason, actor, at: now }],
  };
}

/**
 * 52553 — Dashboard aggregates over archives.
 * @param {object[]} archives
 * @param {number} [now]
 * @returns {object}
 */
export function buildArchiveDashboard(archives, now = Date.now()) {
  const live = archives.filter(a => !a.deleted);
  const totalBytes = live.reduce((n, a) => n + (a.bytes || 0), 0);
  const byTier = {};
  for (const a of live) byTier[a.tier || 'hot'] = (byTier[a.tier || 'hot'] || 0) + 1;
  const duePurge = live.filter(
    a => retentionStatus(a, { keepDays: 730 }, now).status === 'due-purge'
  ).length;
  return {
    count: live.length,
    totalBytes,
    byTier,
    duePurge,
    totalRestores: live.reduce((n, a) => n + (a.restores || 0), 0),
    oldestAt: live.length ? Math.min(...live.map(a => a.archivedAt || now)) : null,
  };
}

/**
 * 52554 — Per-workspace usage with projection and cleanup suggestions.
 * @param {object[]} archives
 * @param {number} [growthPerDay=0]
 * @returns {object[]}
 */
export function storageUsageMeter(archives, growthPerDay = 0) {
  const byWs = new Map();
  for (const a of archives) {
    if (a.deleted) continue;
    const ws = a.workspace || 'default';
    const cur = byWs.get(ws) || { workspace: ws, bytes: 0, count: 0 };
    cur.bytes += a.bytes || 0;
    cur.count += 1;
    byWs.set(ws, cur);
  }
  return [...byWs.values()].map(w => ({
    ...w,
    projected30d: w.bytes + growthPerDay * 30,
    suggestion: w.bytes > 10 * 1024 ** 3 ? 'consider cold tiering' : 'within budget',
  }));
}

/**
 * 52555 — Cost estimate before choosing tiers.
 * @param {number} bytes
 * @param {'hot'|'cold'} tier
 * @returns {{ monthlyUsd: number, tier: string }}
 */
export function estimateArchiveCost(bytes, tier) {
  const perGbMonth = tier === 'cold' ? 0.004 : 0.023;
  const monthlyUsd = Math.round(((bytes / 1024 ** 3) * perGbMonth + Number.EPSILON) * 100) / 100;
  return { monthlyUsd, tier };
}

/**
 * 52556 — Plan which archives move to cold storage by policy.
 * @param {object[]} archives
 * @param {object} policy { coldAfterDays }
 * @param {number} [now]
 * @returns {{ moveToCold: string[], keepHot: string[] }}
 */
export function tieringPlan(archives, policy, now = Date.now()) {
  const coldAfter = ((policy && policy.coldAfterDays) || 90) * DAY;
  const moveToCold = [];
  const keepHot = [];
  for (const a of archives) {
    if (a.deleted || a.legalHold || a.tier === 'cold') {
      keepHot.push(a.id);
      continue;
    }
    if (now - (a.archivedAt || now) >= coldAfter) moveToCold.push(a.id);
    else keepHot.push(a.id);
  }
  return { moveToCold, keepHot };
}

/**
 * 52557 — Verify archive integrity against its checksum.
 * @param {object} archive
 * @returns {{ ok: boolean, expected: string, actual: string }}
 */
export function verifyArchiveChecksum(archive) {
  const actual = fnv1a(`${archive.huntId}:${archive.archivedAt}`);
  return { ok: actual === archive.checksum, expected: archive.checksum, actual };
}

/**
 * 52558 — Version an archive on re-archive (never overwrite silently).
 * @param {object} archive
 * @param {number} [now]
 * @returns {object} New version record.
 */
export function versionArchive(archive, now = Date.now()) {
  return {
    ...archive,
    version: (archive.version || 1) + 1,
    archivedAt: now,
    checksum: fnv1a(`${archive.huntId}:${now}:${archive.version || 1}`),
    priorChecksum: archive.checksum,
  };
}

/**
 * 52559 — Append an audit entry.
 * @param {object[]} log
 * @param {object} action { type, archiveId, actor, detail }
 * @param {number} [now]
 * @returns {object[]} New log.
 */
export function logArchiveAction(log, action, now = Date.now()) {
  return [...(log || []), { ...action, at: now }];
}

/**
 * 52560 — Read-only view descriptor (no restore needed).
 * @param {object} archive
 * @returns {object} Read-only view payload.
 */
export function readOnlyView(archive) {
  return {
    archiveId: archive.id,
    target: archive.target,
    readOnly: true,
    banner: 'Archived — read-only. Restore to interact.',
    summary: archiveSummaryPreview(archive),
  };
}
