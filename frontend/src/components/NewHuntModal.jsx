import React, { useState } from 'react';

const MODES = [
  { id: 'normal', name: 'Normal', tagline: 'Quick recon + top checks', tier: 'free' },
  { id: 'medium', name: 'Medium', tagline: 'Deeper scan with confirmation', tier: 'free' },
  { id: 'high', name: 'High', tagline: 'Full surface + chaining', tier: 'pro' },
  { id: 'ultra', name: 'Ultra High', tagline: 'API fuzzing + logic tests', tier: 'pro' },
  { id: 'max', name: 'Max', tagline: 'Everything, longest chains', tier: 'elite' },
  { id: 'infinity', name: 'Infinity', tagline: 'No limits — hunts until stopped', tier: 'elite' },
];

export default function NewHuntModal({ open, onClose, onSubmit, launching }) {
  const [target, setTarget] = useState('');
  const [scope, setScope] = useState('');
  // Infinity is the running default (owner order, 24 Oct 2026): hunts run
  // until stopped. All six modes stay selectable in the picker.
  const [mode, setMode] = useState('infinity');
  const [confirmed, setConfirmed] = useState(false);

  if (!open) return null;

  function submit() {
    const t = target.trim();
    if (!t || !confirmed) return;
    onSubmit(t, scope.trim(), mode, confirmed);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Start a new hunt">
        <h3>Start a bug-bounty hunt</h3>
        <p className="modal-sub">
          The hunt runs in the background. You can keep chatting while it works.
        </p>
        <label className="field-label">
          Target
          <input
            className="text-input"
            placeholder="https://target.example or bug-bounty program URL"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            autoFocus
          />
        </label>
        <label className="field-label">
          Scope <span className="optional">(optional)</span>
          <textarea
            className="text-input"
            rows={3}
            placeholder="In-scope domains, out-of-scope areas, bounty focus…"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
          />
        </label>
        <div className="field-label">
          Hunt intensity
          <div className="mode-grid">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`mode-card${mode === m.id ? ' selected' : ''}`}
                onClick={() => setMode(m.id)}
                title={m.tagline}
              >
                <div className="mode-name">{m.name}</div>
                <div className="mode-tag">{m.tagline}</div>
                {m.tier !== 'free' && <div className="mode-tier">{m.tier}</div>}
              </button>
            ))}
          </div>
        </div>
        <label className="auth-confirm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          <span>I am authorized to test this target (I own it or it is an in-scope bug-bounty asset).</span>
        </label>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose} disabled={launching}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={!target.trim() || !confirmed || launching}>
            {launching ? 'Starting…' : 'Start hunt'}
          </button>
        </div>
        <p className="modal-note">Only hunt targets you are authorized to test.</p>
      </div>
    </div>
  );
}
