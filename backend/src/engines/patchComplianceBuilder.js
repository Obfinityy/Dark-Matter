/**
 * patchComplianceBuilder.js — Idea 50002: Patch-compliance dashboard builder.
 *
 * Aggregates patch compliance by asset class with severity-based SLA tracking
 * and explicit exception visibility. Pure functions; the caller supplies the
 * asset inventory with each asset's missing (unapplied) patches.
 */

export const PATCH_SLA_DAYS = { critical: 3, high: 7, medium: 14, low: 30 };

const DAY_MS = 86_400_000;

const round1 = (n) => Math.round(n * 10) / 10;

/**
 * Assess one asset.
 * asset: { id, hostname, assetClass, missingPatches: [{ severity, releasedAt }], exceptionReason?, exceptionExpiresAt? }
 * Returns { id, hostname, assetClass, openCount, compliant, breached, worstBreach, exception }
 */
export function assessAssetPatch(asset = {}, now = Date.now()) {
  const { id = 'unknown', hostname = id, assetClass = 'unknown' } = asset;
  const open = (asset.missingPatches ?? []).filter((p) => !p.appliedAt);

  let worstBreach = null;
  for (const p of open) {
    const sla = PATCH_SLA_DAYS[p.severity] ?? PATCH_SLA_DAYS.low;
    const ageDays = (now - p.releasedAt) / DAY_MS;
    const overdueBy = ageDays - sla;
    if (overdueBy > 0 && (!worstBreach || overdueBy > worstBreach.overdueBy)) {
      worstBreach = { severity: p.severity, ageDays: round1(ageDays), overdueBy: round1(overdueBy) };
    }
  }

  const exception = asset.exceptionReason
    ? {
        reason: asset.exceptionReason,
        expiresAt: asset.exceptionExpiresAt ?? null,
        valid: !asset.exceptionExpiresAt || asset.exceptionExpiresAt > now,
      }
    : null;

  const compliant = open.length === 0 || (exception?.valid ?? false);
  return {
    id,
    hostname,
    assetClass,
    openCount: open.length,
    compliant,
    breached: !compliant && worstBreach !== null,
    worstBreach,
    exception,
  };
}

/**
 * Build the full dashboard: per-class rollups, breached assets, exceptions.
 */
export function buildPatchComplianceDashboard(assets = [], now = Date.now()) {
  const results = assets.map((a) => assessAssetPatch(a, now));
  const byClass = {};

  for (const r of results) {
    const bucket = byClass[r.assetClass] ?? { assetClass: r.assetClass, total: 0, compliant: 0, breached: 0, exceptions: 0 };
    bucket.total += 1;
    if (r.compliant) bucket.compliant += 1;
    if (r.breached) bucket.breached += 1;
    if (r.exception?.valid) bucket.exceptions += 1;
    bucket.compliancePct = Math.round((bucket.compliant / bucket.total) * 100);
    byClass[r.assetClass] = bucket;
  }

  const breached = results.filter((r) => r.breached);
  const exceptions = results
    .filter((r) => r.exception)
    .map((r) => ({ id: r.id, hostname: r.hostname, reason: r.exception.reason, valid: r.exception.valid, expiresAt: r.exception.expiresAt }));

  const summary = {
    total: results.length,
    compliant: results.filter((r) => r.compliant).length,
    breached: breached.length,
    exceptions: exceptions.filter((e) => e.valid).length,
  };
  summary.compliancePct = summary.total === 0 ? 100 : Math.round((summary.compliant / summary.total) * 100);

  return { results, byClass, breached, exceptions, summary };
}
