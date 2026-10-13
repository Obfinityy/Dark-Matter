import React, { useState } from 'react';

export default function NewHuntModal({ open, onClose, onSubmit, launching }) {
  const [target, setTarget] = useState('');
  const [scope, setScope] = useState('');

  if (!open) return null;

  function submit() {
    const t = target.trim();
    if (!t) return;
    onSubmit(t, scope.trim());
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Start a new hunt">
        <h3>Start a bug-bounty hunt</h3>
        <p className="modal-sub">
          The hunt runs in the background in the Kali Linux VM. You can keep chatting while it works.
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
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose} disabled={launching}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={!target.trim() || launching}>
            {launching ? 'Starting…' : 'Start hunt'}
          </button>
        </div>
        <p className="modal-note">Only hunt targets you are authorized to test.</p>
      </div>
    </div>
  );
}
