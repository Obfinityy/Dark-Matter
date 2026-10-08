/**
 * vulnSlaTracker.js — Idea 50003: Vulnerability-SLA tracker.
 *
 * Tracks every vulnerability from detection to verified remediation against
 * severity-based SLAs. Flags breaches and at-risk items before the deadline.
 * Pure functions; pass `now` for deterministic testing.
 */

export const VULN_SLA_DAYS = { Critical: 7, High: 30, Medium: 90, Low: 180, Info: 365 };

// Items within the last 20% of their SLA window count as at-risk.
const AT_RISK_FRACTION = 0.2;
const DAY_MS = 86_400_000;

/**
 * Track one vulnerability.
 * vuln: { id, title, severity, detectedAt, status: 'open'|'remediated'|'verified', remediatedAt?, verifiedAt? }
 * Returns { id, title, severity, slaDays, detectedAt, deadlineAt, state, daysRemaining }
 * state: 'within-sla' | 'at-risk' | 'breached' | 'closed-on-time' | 'closed-late'
 */
export function trackVuln(vuln = {}, now = Date.now()) {
  const { id = 'unknown', title = '', severity = 'Medium' } = vuln;
  const slaDays = VULN_SLA_DAYS[severity] ?? VULN_SLA_DAYS.Medium;
  const detectedAt = vuln.detectedAt ?? now;
  const deadlineAt = detectedAt + slaDays * DAY_MS;
  const closed = vuln.status === 'verified';
  const closedAt = vuln.verifiedAt ?? vuln.remediatedAt ?? null;

  let state;
  if (closed) {
    state = closedAt !== null && closedAt <= deadlineAt ? 'closed-on-time' : 'closed-late';
  } else if (now > deadlineAt) {
    state = 'breached';
  } else if (deadlineAt - now < AT_RISK_FRACTION * slaDays * DAY_MS) {
    state = 'at-risk';
  } else {
    state = 'within-sla';
  }

  return {
    id,
    title,
    severity,
    slaDays,
    detectedAt,
    deadlineAt,
    state,
    daysRemaining: Math.round(((deadlineAt - now) / DAY_MS) * 10) / 10,
  };
}

/**
 * Track a batch. Returns { results, summary }.
 */
export function trackVulnSla(vulns = [], now = Date.now()) {
  const results = vulns.map(v => trackVuln(v, now));
  const count = s => results.filter(r => r.state === s).length;
  const open = results.filter(r => !r.state.startsWith('closed'));
  const summary = {
    total: results.length,
    open: open.length,
    withinSla: count('within-sla'),
    atRisk: count('at-risk'),
    breached: count('breached'),
    closedOnTime: count('closed-on-time'),
    closedLate: count('closed-late'),
  };
  summary.breachRatePct =
    open.length === 0 ? 0 : Math.round((summary.breached / open.length) * 100);
  return { results, summary };
}
