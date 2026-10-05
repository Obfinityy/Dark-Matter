/**
 * CvssBadge — severity pill with the CVSS score when the finding has one.
 * Falls back to the plain severity label when no CVSS was recorded.
 *
 * Every severity maps to a distinct pill colour (never a bare neutral),
 * with a status dot, a normalised one-decimal score, and an accessible
 * label for screen readers.
 */
import React from 'react';

const SEV_CLASS = {
  critical: 'sg-pill-danger',
  high: 'sg-pill-warn',
  medium: 'sg-pill-info',
  low: 'sg-pill-go',
  informational: 'sg-pill-brand'
};

function prettySeverity(severity) {
  return severity.charAt(0).toUpperCase() + severity.slice(1);
}

export function CvssBadge({ finding }) {
  const cvss = finding?.cvss || {};
  const severity = String(finding?.severity || 'informational').toLowerCase();
  const cls = SEV_CLASS[severity] || 'sg-pill-brand';
  const score = Number(cvss.score);
  const hasScore = cvss.score != null && Number.isFinite(score);
  const label = hasScore
    ? `${prettySeverity(severity)} · CVSS ${score.toFixed(1)}`
    : prettySeverity(severity);
  const srLabel = hasScore
    ? `Severity: ${prettySeverity(severity)}, CVSS score ${score.toFixed(1)}`
    : `Severity: ${prettySeverity(severity)} (no CVSS score recorded)`;

  return (
    <span
      className={`sg-pill ${cls}`}
      title={cvss.vector || `Severity: ${severity} (no CVSS vector recorded)`}
      aria-label={srLabel}
    >
      <span className="dot" aria-hidden="true" />
      {label}
    </span>
  );
}
