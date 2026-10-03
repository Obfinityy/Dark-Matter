/**
 * redTeamRemediationTracker.js — Idea 50004: Red-team finding remediation tracker.
 *
 * Ensures red-team findings convert into real control improvements with
 * verified closure — not just reports that gather dust. Tracks closure rate,
 * findings remediated without any control improvement, stuck items, and
 * average time to verified closure. Pure functions.
 */

const DAY_MS = 86_400_000;
// Findings open longer than this without verified closure count as stuck.
export const STUCK_AFTER_DAYS = 60;

/**
 * Track one red-team finding.
 * f: { id, title, severity, reportedAt, controlImprovement (string|null), status: 'open'|'remediated'|'verified-closed', remediatedAt?, verifiedAt? }
 */
export function trackRedTeamFinding(f = {}, now = Date.now()) {
  const { id = 'unknown', title = '', severity = 'Medium', status = 'open' } = f;
  const reportedAt = f.reportedAt ?? now;
  const verifiedClosed = status === 'verified-closed';
  const endAt = verifiedClosed && f.verifiedAt ? f.verifiedAt : now;
  const daysOpen = (endAt - reportedAt) / DAY_MS;

  return {
    id,
    title,
    severity,
    status,
    verifiedClosed,
    hasControlImprovement: typeof f.controlImprovement === 'string' && f.controlImprovement.trim().length > 0,
    daysToClosure: verifiedClosed ? Math.round(daysOpen * 10) / 10 : null,
    stuck: !verifiedClosed && daysOpen > STUCK_AFTER_DAYS,
  };
}

/**
 * Track a batch. Returns { results, summary }.
 */
export function trackRedTeamFindings(findings = [], now = Date.now()) {
  const results = findings.map((f) => trackRedTeamFinding(f, now));
  const verified = results.filter((r) => r.verifiedClosed);
  const remediatedLike = results.filter((r) => r.status === 'remediated' || r.verifiedClosed);

  const summary = {
    total: results.length,
    verifiedClosed: verified.length,
    closureRatePct: results.length === 0 ? 100 : Math.round((verified.length / results.length) * 100),
    remediatedWithoutControlImprovement: remediatedLike.filter((r) => !r.hasControlImprovement).length,
    stuck: results.filter((r) => r.stuck).length,
    avgDaysToClosure:
      verified.length === 0
        ? null
        : Math.round((verified.reduce((s, r) => s + r.daysToClosure, 0) / verified.length) * 10) / 10,
  };
  return { results, summary };
}
