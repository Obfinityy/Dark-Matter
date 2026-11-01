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
  const [error, setError] = useState('');

  if (!open) return null;

  function submit() {
    const t = target.trim();
    // FIX (#308): the old code silently returned here, so pressing
    // Enter (or any submit attempt) with an empty target or an
    // unchecked authorization box did nothing at all — no error, no
    // feedback. Say what is missing instead.
    if (!t) { setError('Enter a target to hunt.'); return; }
    if (!confirmed) { setError('Confirm you are authorized to test this target.'); return; }
    setError('');
    onSubmit(t, scope.trim(), mode, confirmed);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Start a new hunt">
        <h3>Start a bug-bounty hunt</h3>
        <p className="modal-sub">
          The hunt runs in the background. You can keep chatting while it works.
        </p>
        {/* FIX (#308): a real <form> so Enter in the target field
            submits (the old markup had no form and no key handler,
            so Enter did nothing). The Start button stays enabled
            except while launching so invalid submits reach the
            validation above and show the inline error. */}
        <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <label className="field-label">
          Target
          <input
            className="text-input"
            placeholder="https://target.example or bug-bounty program URL"
            value={target}
            onChange={(e) => { setTarget(e.target.value); setError(''); }}
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
            onChange={(e) => { setConfirmed(e.target.checked); setError(''); }}
          />
          <span>I am authorized to test this target (I own it or it is an in-scope bug-bounty asset).</span>
        </label>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={launching}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={launching}>
            {launching ? 'Starting…' : 'Start hunt'}
          </button>
        </div>
        </form>
        <p className="modal-note">Only hunt targets you are authorized to test.</p>
      </div>
    </div>
  );
}
