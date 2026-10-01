/**
 * FingerprintCard — the target fingerprint card.
 *
 * Shows what the agent knows about the target: hostname, technologies,
 * server header, TLS info, IP/ASN when known, and scope. The "what we know"
 * card at the top of every hunt.
 *
 * Props: { job, surface } — job from GET /jobs/:id, surface from attack-surface
 */
import React from 'react';
import { Fingerprint, Lock, Server, Globe } from 'lucide-react';

export function FingerprintCard({ job = {}, surface = {} }) {
  const target = job.target || job.targetHostname || 'unknown target';
  const technologies = surface.technologies || [];
  const scope = job.scope || {};

  return (
    <div className="dm-fingerprint">
      <header>
        <Fingerprint size={16} />
        <h3>Target fingerprint</h3>
      </header>
      <div className="dm-fingerprint-target">
        <Globe size={14} />
        <code>{target}</code>
      </div>
      <dl className="dm-fingerprint-grid">
        <div>
          <dt>Status</dt>
          <dd><span className={`dm-job-status st-${job.status}`}>{job.status || '—'}</span></dd>
        </div>
        <div>
          <dt>Phase</dt>
          <dd>{job.phase || '—'}</dd>
        </div>
        <div>
          <dt>Steps</dt>
          <dd>{job.stepCount ?? '—'}</dd>
        </div>
        <div>
          <dt>Objective</dt>
          <dd className="dm-fingerprint-objective">{job.currentObjective || job.objective || '—'}</dd>
        </div>
      </dl>
      {technologies.length > 0 && (
        <div className="dm-fingerprint-tech">
          <Server size={13} />
          {technologies.map((t, i) => (
            <span key={i} className="dm-tech-chip">{typeof t === 'string' ? t : t.name || JSON.stringify(t)}</span>
          ))}
        </div>
      )}
      {(scope.included?.length > 0 || scope.excluded?.length > 0) && (
        <div className="dm-fingerprint-scope">
          <Lock size={13} />
          <span>
            {scope.included?.length ? `In scope: ${scope.included.join(', ')}` : ''}
            {scope.included?.length && scope.excluded?.length ? ' · ' : ''}
            {scope.excluded?.length ? `Out of scope: ${scope.excluded.join(', ')}` : ''}
          </span>
        </div>
      )}
    </div>
  );
}
