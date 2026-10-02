/**
 * CvssBadge — severity pill with the CVSS score when the finding has one.
 * Falls back to the plain severity label when no CVSS was recorded.
 */
import React from 'react';

const SEV_CLASS = {
  critical: 'sg-pill-danger',
  high: 'sg-pill-warn',
  medium: 'sg-pill-info',
  low: '',
  informational: ''
};

export function CvssBadge({ finding }) {
  const cvss = finding?.cvss || {};
  const severity = String(finding?.severity || 'informational').toLowerCase();
  const cls = SEV_CLASS[severity] || '';
  const label = cvss.score != null
    ? `${severity} · CVSS ${cvss.score}`
    : severity;
  return (
    <span className={`sg-pill ${cls}`} title={cvss.vector || `Severity: ${severity} (no CVSS vector recorded)`}>
      {label}
    </span>
  );
}
