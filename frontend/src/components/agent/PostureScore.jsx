/**
 * PostureScore — the target's security posture at a glance.
 *
 * Fetches GET /api/v1/jobs/:id/posture (computed from the hunt's real
 * confirmed findings: 100 starts clean, severity-weighted deductions).
 * Renders a true score ring + grade + severity chips. Shows a skeleton while
 * loading; degrades to nothing when the backend has no posture yet.
 */
import React, { useEffect, useState } from 'react';
import { getJobPosture } from '../../services/api';

const GRADE_COLORS = {
  A: 'var(--sg-go)',
  B: '#a3e635',
  C: 'var(--sg-warn)',
  D: '#fb923c',
  F: 'var(--sg-danger)',
};

const SEVERITY_COLORS = {
  critical: 'var(--sg-danger)',
  high: '#fb923c',
  medium: 'var(--sg-warn)',
  low: 'var(--sg-info)',
};

const RING_C = 2 * Math.PI * 27; // r=27 in the 64x64 viewBox

export function PostureScore({ jobId }) {
  const [posture, setPosture] = useState(null);
  const [loading, setLoading] = useState(!!jobId);

  useEffect(() => {
    let cancelled = false;
    if (!jobId) {
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    getJobPosture(jobId)
      .then((body) => { if (!cancelled && body?.posture) setPosture(body.posture); })
      .catch(() => { /* 404/empty — panel simply hides */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [jobId]);

  if (!posture) {
    if (!loading) return null;
    return (
      <div className="sg-posture sg-posture-loading" aria-busy="true" aria-label="Loading security posture">
        <span className="sg-posture-skel-ring" aria-hidden="true" />
        <span className="sg-posture-meta" aria-hidden="true">
          <span className="sg-posture-skel-line" />
          <span className="sg-posture-skel-line" />
        </span>
      </div>
    );
  }

  const color = GRADE_COLORS[posture.grade] || '#9ca3af';
  const counts = posture.counts || {};
  const chips = Object.entries(SEVERITY_COLORS)
    .map(([sev, dot]) => ({ sev, n: counts[sev] || 0, dot }))
    .filter(({ n }) => n > 0);

  return (
    <div className="sg-posture" title={`${posture.total || 0} confirmed findings shape this score`}>
      <div
        className="sg-posture-ringwrap"
        role="img"
        aria-label={`Security posture score ${posture.score} of 100, grade ${posture.grade}`}
      >
        <svg className="sg-posture-svg" viewBox="0 0 64 64" aria-hidden="true">
          <circle className="sg-posture-track" cx="32" cy="32" r="27" />
          <circle
            className="sg-posture-arc"
            cx="32" cy="32" r="27"
            strokeDasharray={RING_C}
            strokeDashoffset={RING_C * (1 - Math.min(100, Math.max(0, posture.score || 0)) / 100)}
            style={{ stroke: color }}
          />
        </svg>
        <span className="sg-posture-score" style={{ color }}>{posture.score}</span>
        <span className="sg-posture-grade" style={{ background: color }} aria-hidden="true">
          {posture.grade}
        </span>
      </div>
      <div className="sg-posture-meta">
        <span className="sg-posture-label">Target posture</span>
        <span className="sg-posture-counts">
          {chips.length > 0 ? (
            chips.map(({ sev, n, dot }) => (
              <span
                key={sev}
                className="sg-posture-chip"
                title={`${n} ${sev} severity finding${n === 1 ? '' : 's'}`}
                aria-label={`${n} ${sev} severity finding${n === 1 ? '' : 's'}`}
              >
                <i className="sg-posture-dot" style={{ background: dot }} aria-hidden="true" />
                {n} {sev}
              </span>
            ))
          ) : (
            <span className="sg-posture-none">no findings yet</span>
          )}
        </span>
      </div>
    </div>
  );
}
