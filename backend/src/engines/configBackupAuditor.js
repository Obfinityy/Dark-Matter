/**
 * configBackupAuditor.js — Idea 50001: Config-backup auditor.
 *
 * Confirms that GitOps repositories, secret vaults, certificate authorities
 * and DNS zones are backed up on schedule — and that restores are actually
 * tested, not just assumed. Pure functions; the caller supplies the inventory.
 */

export const BACKUP_MAX_AGE_HOURS = 24;
export const RESTORE_TEST_MAX_AGE_DAYS = 30;

export const SUPPORTED_BACKUP_TYPES = [
  'gitops-repo',
  'vault',
  'certificate-authority',
  'dns-zone',
];

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/**
 * Audit a single config store.
 * item: { id, type, name, backupEnabled, lastBackupAt (ms epoch|null), lastRestoreTestAt (ms epoch|null) }
 * Returns { id, type, name, backup, restoreTest, overall, reason? }
 */
export function auditConfigBackup(item = {}, now = Date.now()) {
  const { id = 'unknown', type = 'unknown', name = id } = item;
  const result = { id, type, name };

  if (!SUPPORTED_BACKUP_TYPES.includes(type)) {
    return { ...result, backup: 'missing', restoreTest: 'never', overall: 'fail', reason: `unsupported type: ${type}` };
  }
  if (item.backupEnabled === false) {
    return {
      ...result,
      backup: 'disabled',
      restoreTest: item.lastRestoreTestAt ? 'ok' : 'never',
      overall: 'fail',
      reason: 'backups disabled for this store',
    };
  }

  if (!item.lastBackupAt) {
    result.backup = 'missing';
  } else if ((now - item.lastBackupAt) / HOUR_MS > BACKUP_MAX_AGE_HOURS) {
    result.backup = 'stale';
  } else {
    result.backup = 'ok';
  }

  if (!item.lastRestoreTestAt) {
    result.restoreTest = 'never';
  } else if ((now - item.lastRestoreTestAt) / DAY_MS > RESTORE_TEST_MAX_AGE_DAYS) {
    result.restoreTest = 'stale';
  } else {
    result.restoreTest = 'ok';
  }

  if (result.backup === 'ok' && result.restoreTest === 'ok') {
    result.overall = 'pass';
  } else if (result.backup === 'missing' || result.backup === 'disabled') {
    result.overall = 'fail';
  } else {
    result.overall = 'warn';
  }
  return result;
}

/**
 * Audit a whole inventory. Returns { results, summary }.
 */
export function auditConfigBackups(items = [], now = Date.now()) {
  const results = items.map((item) => auditConfigBackup(item, now));
  return { results, summary: summarizeBackupPosture(results) };
}

/**
 * Roll per-store results into a posture summary.
 */
export function summarizeBackupPosture(results = []) {
  const summary = { total: results.length, pass: 0, warn: 0, fail: 0, byType: {} };
  for (const r of results) {
    if (summary[r.overall] !== undefined) summary[r.overall] += 1;
    const t = summary.byType[r.type] ?? { total: 0, pass: 0, warn: 0, fail: 0 };
    t.total += 1;
    if (t[r.overall] !== undefined) t[r.overall] += 1;
    summary.byType[r.type] = t;
  }
  summary.posturePct = summary.total === 0 ? 100 : Math.round((summary.pass / summary.total) * 100);
  return summary;
}
