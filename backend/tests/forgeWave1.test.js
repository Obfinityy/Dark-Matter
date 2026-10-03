/**
 * Tests for Forge wave 1 backend engines (ideas 50001–50004):
 * configBackupAuditor, patchComplianceBuilder, vulnSlaTracker,
 * redTeamRemediationTracker.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  auditConfigBackup,
  auditConfigBackups,
  summarizeBackupPosture,
  BACKUP_MAX_AGE_HOURS,
  RESTORE_TEST_MAX_AGE_DAYS,
} from '../src/engines/configBackupAuditor.js';
import {
  assessAssetPatch,
  buildPatchComplianceDashboard,
  PATCH_SLA_DAYS,
} from '../src/engines/patchComplianceBuilder.js';
import { trackVuln, trackVulnSla, VULN_SLA_DAYS } from '../src/engines/vulnSlaTracker.js';
import {
  trackRedTeamFinding,
  trackRedTeamFindings,
  STUCK_AFTER_DAYS,
} from '../src/engines/redTeamRemediationTracker.js';

const HOUR = 3_600_000;
const DAY = 86_400_000;
const NOW = 1_800_000_000_000; // fixed clock for determinism

describe('configBackupAuditor (50001)', () => {
  it('passes a healthy store with fresh backup and tested restore', () => {
    const r = auditConfigBackup(
      { id: 'gitops', type: 'gitops-repo', backupEnabled: true, lastBackupAt: NOW - 2 * HOUR, lastRestoreTestAt: NOW - 5 * DAY },
      NOW,
    );
    assert.equal(r.overall, 'pass');
    assert.equal(r.backup, 'ok');
    assert.equal(r.restoreTest, 'ok');
  });

  it('warns on stale backup and never-tested restore', () => {
    const r = auditConfigBackup(
      { id: 'vault', type: 'vault', backupEnabled: true, lastBackupAt: NOW - (BACKUP_MAX_AGE_HOURS + 1) * HOUR, lastRestoreTestAt: null },
      NOW,
    );
    assert.equal(r.backup, 'stale');
    assert.equal(r.restoreTest, 'never');
    assert.equal(r.overall, 'warn');
  });

  it('fails when backups are disabled or missing', () => {
    assert.equal(auditConfigBackup({ id: 'x', type: 'dns-zone', backupEnabled: false }, NOW).overall, 'fail');
    assert.equal(auditConfigBackup({ id: 'y', type: 'vault', lastBackupAt: null, lastRestoreTestAt: NOW }, NOW).overall, 'fail');
  });

  it('fails unknown types and summarizes posture', () => {
    const { summary } = auditConfigBackups(
      [
        { id: 'a', type: 'vault', lastBackupAt: NOW - HOUR, lastRestoreTestAt: NOW - DAY },
        { id: 'b', type: 'nope', lastBackupAt: NOW },
      ],
      NOW,
    );
    assert.equal(summary.total, 2);
    assert.equal(summary.pass, 1);
    assert.equal(summary.fail, 1);
    assert.equal(summary.posturePct, 50);
    assert.equal(summarizeBackupPosture([]).posturePct, 100);
  });

  it('flags stale restore tests beyond the window', () => {
    const r = auditConfigBackup(
      { id: 'ca', type: 'certificate-authority', lastBackupAt: NOW - HOUR, lastRestoreTestAt: NOW - (RESTORE_TEST_MAX_AGE_DAYS + 1) * DAY },
      NOW,
    );
    assert.equal(r.restoreTest, 'stale');
    assert.equal(r.overall, 'warn');
  });
});

describe('patchComplianceBuilder (50002)', () => {
  const mkAsset = (over = {}) => ({
    id: 'web-01', hostname: 'web-01', assetClass: 'server', missingPatches: [], ...over,
  });

  it('marks fully patched assets compliant', () => {
    const r = assessAssetPatch(mkAsset(), NOW);
    assert.equal(r.compliant, true);
    assert.equal(r.breached, false);
  });

  it('breaches when a critical patch exceeds its SLA', () => {
    const r = assessAssetPatch(
      mkAsset({ missingPatches: [{ severity: 'critical', releasedAt: NOW - (PATCH_SLA_DAYS.critical + 1) * DAY }] }),
      NOW,
    );
    assert.equal(r.compliant, false);
    assert.equal(r.breached, true);
    assert.equal(r.worstBreach.severity, 'critical');
  });

  it('honours a valid exception', () => {
    const r = assessAssetPatch(
      mkAsset({
        missingPatches: [{ severity: 'high', releasedAt: NOW - 30 * DAY }],
        exceptionReason: 'vendor patch pending',
        exceptionExpiresAt: NOW + 7 * DAY,
      }),
      NOW,
    );
    assert.equal(r.compliant, true);
    assert.equal(r.exception.valid, true);
  });

  it('ignores expired exceptions', () => {
    const r = assessAssetPatch(
      mkAsset({
        missingPatches: [{ severity: 'high', releasedAt: NOW - 30 * DAY }],
        exceptionReason: 'old ticket',
        exceptionExpiresAt: NOW - DAY,
      }),
      NOW,
    );
    assert.equal(r.compliant, false);
    assert.equal(r.exception.valid, false);
  });

  it('builds per-class dashboard rollups', () => {
    const { byClass, summary } = buildPatchComplianceDashboard(
      [
        mkAsset({ id: 'a', assetClass: 'server' }),
        mkAsset({ id: 'b', assetClass: 'server', missingPatches: [{ severity: 'critical', releasedAt: NOW - 10 * DAY }] }),
        mkAsset({ id: 'c', assetClass: 'workstation' }),
      ],
      NOW,
    );
    assert.equal(byClass.server.total, 2);
    assert.equal(byClass.server.compliancePct, 50);
    assert.equal(byClass.workstation.compliancePct, 100);
    assert.equal(summary.total, 3);
    assert.equal(summary.breached, 1);
  });
});

describe('vulnSlaTracker (50003)', () => {
  it('tracks within-sla, at-risk and breached states', () => {
    const within = trackVuln({ id: 'v1', severity: 'High', detectedAt: NOW - DAY }, NOW);
    assert.equal(within.state, 'within-sla');
    assert.equal(within.slaDays, VULN_SLA_DAYS.High);

    const atRisk = trackVuln({ id: 'v2', severity: 'Critical', detectedAt: NOW - (VULN_SLA_DAYS.Critical - 1) * DAY }, NOW);
    assert.equal(atRisk.state, 'at-risk');

    const breached = trackVuln({ id: 'v3', severity: 'Critical', detectedAt: NOW - (VULN_SLA_DAYS.Critical + 2) * DAY }, NOW);
    assert.equal(breached.state, 'breached');
    assert.ok(breached.daysRemaining < 0);
  });

  it('distinguishes on-time vs late verified closure', () => {
    const onTime = trackVuln(
      { id: 'v4', severity: 'High', detectedAt: NOW - 10 * DAY, status: 'verified', verifiedAt: NOW - 5 * DAY },
      NOW,
    );
    assert.equal(onTime.state, 'closed-on-time');
    const late = trackVuln(
      { id: 'v5', severity: 'High', detectedAt: NOW - 60 * DAY, status: 'verified', verifiedAt: NOW - DAY },
      NOW,
    );
    assert.equal(late.state, 'closed-late');
  });

  it('summarizes the batch', () => {
    const { summary } = trackVulnSla(
      [
        { id: 'a', severity: 'Low', detectedAt: NOW - DAY },
        { id: 'b', severity: 'Critical', detectedAt: NOW - 30 * DAY },
      ],
      NOW,
    );
    assert.equal(summary.total, 2);
    assert.equal(summary.breached, 1);
    assert.equal(summary.breachRatePct, 50);
  });
});

describe('redTeamRemediationTracker (50004)', () => {
  it('computes closure, control-improvement gaps and stuck items', () => {
    const { summary } = trackRedTeamFindings(
      [
        { id: 'r1', severity: 'High', reportedAt: NOW - 20 * DAY, status: 'verified-closed', verifiedAt: NOW - 5 * DAY, controlImprovement: 'WAF rule deployed' },
        { id: 'r2', severity: 'Medium', reportedAt: NOW - 10 * DAY, status: 'remediated', remediatedAt: NOW - 2 * DAY, controlImprovement: '' },
        { id: 'r3', severity: 'Low', reportedAt: NOW - (STUCK_AFTER_DAYS + 5) * DAY, status: 'open' },
      ],
      NOW,
    );
    assert.equal(summary.total, 3);
    assert.equal(summary.verifiedClosed, 1);
    assert.equal(summary.closureRatePct, 33);
    assert.equal(summary.remediatedWithoutControlImprovement, 1);
    assert.equal(summary.stuck, 1);
    assert.equal(summary.avgDaysToClosure, 15);
  });

  it('marks findings without verified closure as open', () => {
    const r = trackRedTeamFinding({ id: 'x', reportedAt: NOW - DAY, status: 'open' }, NOW);
    assert.equal(r.verifiedClosed, false);
    assert.equal(r.daysToClosure, null);
    assert.equal(r.stuck, false);
  });

  it('handles an empty batch', () => {
    const { summary } = trackRedTeamFindings([], NOW);
    assert.equal(summary.total, 0);
    assert.equal(summary.closureRatePct, 100);
    assert.equal(summary.avgDaysToClosure, null);
  });
});
