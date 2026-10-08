/**
 * FingerprintCard — the target fingerprint card.
 *
 * Shows what the agent knows about the target: hostname, technologies,
 * live attack-surface stats (subdomains, endpoints, open ports), and scope.
 * The "what we know" card at the top of every hunt.
 *
 * Props: { job, surface } — job from GET /jobs/:id, surface from attack-surface
 */
import React from 'react';
import { Fingerprint, Lock, Server, Globe, Network } from 'lucide-react';
import './FingerprintCard.polish.css';

const techName = t => (typeof t === 'string' ? t : t?.name || t?.version || '');

export function FingerprintCard({ job = {}, surface = {} }) {
  const target = job.target || job.targetHostname || 'unknown target';
  const technologies = (surface.technologies || []).map(techName).filter(Boolean);
  const openPorts = (surface.openPorts || [])
    .map(p => (typeof p === 'string' || typeof p === 'number' ? p : p?.port))
    .filter(p => p !== undefined && p !== null && p !== '');
  const subdomains = (surface.subdomains || []).length;
  const endpoints = (surface.endpoints || []).length;
  const scope = job.scope || {};

  return (
    <section className="dm-fingerprint dm-polish-in" aria-label="Target fingerprint" tabIndex={-1}>
      <header>
        <Fingerprint size={16} aria-hidden="true" />
        <h3>Target fingerprint</h3>
      </header>
      <div className="dm-fingerprint-target">
        <Globe size={14} aria-hidden="true" />
        <code>{target}</code>
      </div>
      <dl className="dm-fingerprint-grid">
        <div>
          <dt>Status</dt>
          <dd>
            <span className={`dm-job-status st-${job.status || 'unknown'}`}>
              {job.status || '—'}
            </span>
          </dd>
        </div>
        <div>
          <dt>Phase</dt>
          <dd>{job.phase || '—'}</dd>
        </div>
        <div>
          <dt>Steps</dt>
          <dd>{job.stepCount ?? '—'}</dd>
        </div>
        <div className="dm-fingerprint-objective-cell">
          <dt>Objective</dt>
          <dd className="dm-fingerprint-objective">
            {job.currentObjective || job.objective || '—'}
          </dd>
        </div>
        {subdomains > 0 && (
          <div>
            <dt>Subdomains</dt>
            <dd>{subdomains}</dd>
          </div>
        )}
        {endpoints > 0 && (
          <div>
            <dt>Endpoints</dt>
            <dd>{endpoints}</dd>
          </div>
        )}
      </dl>
      {technologies.length > 0 && (
        <div className="dm-fingerprint-tech">
          <Server size={13} aria-hidden="true" />
          {technologies.map(t => (
            <span key={t} className="dm-tech-chip">
              {t}
            </span>
          ))}
        </div>
      )}
      {openPorts.length > 0 && (
        <div className="dm-fingerprint-ports" aria-label="Open ports">
          <Network size={13} aria-hidden="true" />
          {openPorts.map(p => (
            <span key={p} className="dm-port-chip" title={`Open port ${p}`}>
              {p}
            </span>
          ))}
        </div>
      )}
      {(scope.included?.length > 0 || scope.excluded?.length > 0) && (
        <div className="dm-fingerprint-scope">
          <Lock size={13} aria-hidden="true" />
          <span>
            {scope.included?.length ? `In scope: ${scope.included.join(', ')}` : ''}
            {scope.included?.length && scope.excluded?.length ? ' · ' : ''}
            {scope.excluded?.length ? `Out of scope: ${scope.excluded.join(', ')}` : ''}
          </span>
        </div>
      )}
    </section>
  );
}
