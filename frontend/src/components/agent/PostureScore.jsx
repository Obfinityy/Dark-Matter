/**
 * PostureScore — the target's security posture at a glance.
 *
 * Fetches GET /api/v1/jobs/:id/posture (computed from the hunt's real
 * confirmed findings: 100 starts clean, severity-weighted deductions).
 * Renders a compact score ring + grade + severity counts. Degrades to
 * nothing when the backend has no posture yet.
 */
import React, { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { getJobPosture } from '../../services/api';

const GRADE_COLORS = {
  A: '#34d399',
  B: '#a3e635',
  C: '#fbbf24',
  D: '#fb923c',
  F: '#f87171',
};

export function PostureScore({ jobId }) {
  const [posture, setPosture] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!jobId) return undefined;
    getJobPosture(jobId)
      .then((body) => { if (!cancelled && body?.posture) setPosture(body.posture); })
      .catch(() => { /* 404/empty — panel simply hides */ });
    return () => { cancelled = true; };
  }, [jobId]);

  if (!posture) return null;

  const color = GRADE_COLORS[posture.grade] || '#9ca3af';
  const counts = posture.counts || {};

  return (
    <div className="sg-posture" title={`${posture.total || 0} confirmed findings shape this score`}>
      <div className="sg-posture-ring" style={{ borderColor: color }}>
        <ShieldCheck size={16} style={{ color }} />
        <strong style={{ color }}>{posture.score}</strong>
        <span className="sg-posture-grade" style={{ background: color }}>{posture.grade}</span>
      </div>
      <div className="sg-posture-meta">
        <span className="sg-posture-label">Target posture</span>
        <span className="sg-posture-counts">
          {[['critical', counts.critical], ['high', counts.high], ['medium', counts.medium], ['low', counts.low]]
            .filter(([, n]) => n > 0)
            .map(([sev, n]) => `${n} ${sev}`)
            .join(' · ') || 'no findings yet'}
        </span>
      </div>
    </div>
  );
}
