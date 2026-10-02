/**
 * CoverageMeter — OWASP Top-10 coverage bar for a hunt.
 * Shows the percent of OWASP categories with at least one confirmed finding,
 * with the covered category IDs as chips.
 */
import React from 'react';

export function CoverageMeter({ coverage }) {
  if (!coverage) return null;
  const pct = coverage.percent || 0;
  return (
    <div className="sg-coverage" title="Share of OWASP Top-10 categories with a confirmed finding">
      <div className="sg-coverage-top">
        <span className="sg-coverage-label">OWASP Top-10 coverage</span>
        <strong className="sg-coverage-pct">{pct}%</strong>
      </div>
      <div className="sg-coverage-bar" role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100">
        <div className="sg-coverage-fill" style={{ width: `${pct}%` }} />
      </div>
      {coverage.covered?.length > 0 && (
        <div className="sg-coverage-cats">
          {coverage.covered.map((c) => (
            <span key={c.id} className="sg-pill sg-pill-info" title={c.name}>{c.id}</span>
          ))}
        </div>
      )}
    </div>
  );
}
