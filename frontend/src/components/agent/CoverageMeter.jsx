/**
 * CoverageMeter — OWASP Top-10 coverage bar for a hunt.
 * Shows the percent of OWASP categories with at least one confirmed finding,
 * with the covered category IDs as chips.
 */
import React from 'react';

export function CoverageMeter({ coverage }) {
  if (!coverage) return null;
  const pct = coverage.percent || 0;
  const coveredCount = coverage.covered?.length || 0;
  return (
    <div className="sg-coverage dm-polish-in">
      <div className="sg-coverage-top">
        <span className="sg-coverage-label">OWASP Top-10 coverage</span>
        <strong className="sg-coverage-pct" aria-hidden="true">{pct}%</strong>
      </div>
      <div
        className="sg-coverage-bar"
        role="progressbar"
        aria-label="OWASP Top-10 category coverage"
        aria-valuenow={pct}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuetext={`${coveredCount} of 10 categories covered`}
      >
        <div className="sg-coverage-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="sg-coverage-foot">
        <span className="sg-coverage-count">{coveredCount} of 10 categories</span>
      </div>
      {coveredCount > 0 && (
        <div className="sg-coverage-cats">
          {coverage.covered.map((c) => (
            <span key={c.id} className="sg-pill sg-pill-info" title={c.name}>{c.id}</span>
          ))}
        </div>
      )}
      {pct === 0 && (
        <p className="sg-coverage-empty">
          No confirmed findings yet — coverage grows as the hunt validates findings.
        </p>
      )}
    </div>
  );
}
