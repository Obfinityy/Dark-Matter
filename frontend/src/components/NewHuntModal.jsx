import React, { useEffect, useState } from 'react';

const MODES = [
  { id: 'normal', name: 'Normal', tagline: 'Quick recon + top checks', tier: 'free' },
  { id: 'medium', name: 'Medium', tagline: 'Deeper scan with confirmation', tier: 'free' },
  { id: 'high', name: 'High', tagline: 'Full surface + chaining', tier: 'pro' },
  { id: 'ultra', name: 'Ultra High', tagline: 'API fuzzing + logic tests', tier: 'pro' },
  { id: 'max', name: 'Max', tagline: 'Everything, longest chains', tier: 'elite' },
  { id: 'infinity', name: 'Infinity', tagline: 'No limits — hunts until stopped', tier: 'elite' },
];

// Scan depth for the autonomous hunter (3 Nov 2026, owner order): every
// depth runs the full predefined battery — depth only changes how far the
// crawler goes and how long each probe may take. Wired end-to-end:
// modal → POST /api/v1/hunts {scanDepth} → scannerHunt → runScan opts.
const SCAN_DEPTHS = [
  { id: 'quick', name: 'Quick', tagline: 'Top pages only · fastest', tier: 'free' },
  { id: 'standard', name: 'Standard', tagline: 'Full battery · balanced', tier: 'free' },
  { id: 'deep', name: 'Deep', tagline: 'More pages, longer probes · slowest', tier: 'pro' },
];

// Scan scope for the autonomous hunter (9 Nov 2026, /* owner order):
// 'page' scans the pasted page only (the one-page-deep default);
// 'site' follows every same-origin link recursively and tries the
// battery on every discovered route. Wired end-to-end the same way
// as scan depth: modal → POST /api/v1/hunts {scanScope} →
// scannerHunt → runScan opts → stored on the hunt meta.
const SCAN_SCOPES = [
  { id: 'page', name: 'Single page', tagline: 'The pasted page only', tier: 'free' },
  { id: 'site', name: 'Whole site (/*)', tagline: 'Every same-origin route, recursively', tier: 'free' },
];

// Default hunter shared with the TopBar hunter picker (localStorage
// 'dm.hunter': 'ai' | 'scanner'). The dialog re-reads it every time it
// opens so a top-bar change applies to the next hunt.
function defaultHunter() {
  try {
    return window.localStorage.getItem('dm.hunter') === 'ai' ? 'ai' : 'scanner';
  } catch {
    return 'scanner';
  }
}

export default function NewHuntModal({ open, onClose, onSubmit, launching, duplicate, onOpenDuplicate, onStartDuplicateAnyway }) {
  const [target, setTarget] = useState('');
  const [scope, setScope] = useState('');
  // Infinity is the running default (owner order, 24 Oct 2026): hunts run
  // until stopped. All six modes stay selectable in the picker.
  const [mode, setMode] = useState('infinity');
  // Hunter (3 Nov 2026, owner order): "Infinity AI" or
  // "Infinity Autonomous". 'ai' = the AI agent hunts; 'scanner' =
  // rule-based automation (no AI, $0).
  const [brainMode, setBrainMode] = useState(defaultHunter);
  const [scanDepth, setScanDepth] = useState('standard');
  const [scanScope, setScanScope] = useState('page');
  const [confirmed, setConfirmed] = useState(false);

  // Fresh dialog state on every open — picks up the top-bar hunter choice.
  useEffect(() => {
    if (open) {
      setBrainMode(defaultHunter());
      setScanDepth('standard');
      setScanScope('page');
    }
  }, [open ]);

  if (!open) return null;

  function submit() {
    const t = target.trim();
    if (!t || !confirmed) return;
    onSubmit(t, scope.trim(), mode, confirmed, brainMode, scanDepth, scanScope);
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
            disabled={!!duplicate}
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
          Hunt with
          <div className="mode-grid">
            <button
              type="button"
              className={`mode-card${brainMode === 'ai' ? ' selected' : ''}`}
              onClick={() => setBrainMode('ai')}
              title="The AI agent hunts like a human expert"
            >
              <div className="mode-name">Infinity AI</div>
              <div className="mode-tag">AI agent hunts autonomously</div>
            </button>
            <button
              type="button"
              className={`mode-card${brainMode === 'scanner' ? ' selected' : ''}`}
              onClick={() => setBrainMode('scanner')}
              title="Predefined rule-based automation — no AI, $0, results in minutes"
            >
              <div className="mode-name">Infinity Autonomous</div>
              <div className="mode-tag">Rule-based scan, no AI, $0</div>
              <div className="mode-tier">fast</div>
            </button>
          </div>
        </div>
        {brainMode === 'scanner' && (
          <div className="field-label">
            Scan depth
            <div className="mode-grid">
              {SCAN_DEPTHS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className={`mode-card${scanDepth === d.id ? ' selected' : ''}`}
                  onClick={() => setScanDepth(d.id)}
                  title={d.tagline}
                >
                  <div className="mode-name">{d.name}</div>
                  <div className="mode-tag">{d.tagline}</div>
                  {d.tier !== 'free' && <div className="mode-tier">{d.tier}</div>}
                </button>
              ))}
            </div>
          </div>
        )}
        {brainMode === 'scanner' && (
          <div className="field-label">
            Scan scope
            <div className="mode-grid">
              {SCAN_SCOPES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`mode-card${scanScope === s.id ? ' selected' : ''}`}
                  onClick={() => setScanScope(s.id)}
                  title={s.tagline}
                >
                  <div className="mode-name">{s.name}</div>
                  <div className="mode-tag">{s.tagline}</div>
                </button>
              ))}
            </div>
          </div>
        )}
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
        {/* DUPLICATE PROMPT (5 Nov 2026, owner order): re-paste returns the
            saved result, but 'Start new hunt' must start fresh. When a hunt
            already exists for (target, brainMode) the dialog offers the
            choice instead of only opening the existing hunt. 'Start new
            hunt anyway' re-submits the frozen pending args with forceNew. */}
        {duplicate && duplicate.existing && (
          <div className="duplicate-notice" role="status">
            <p>
              You already have a {duplicate.existing.brainMode === 'scanner' ? 'Infinity Autonomous' : 'Infinity AI'} hunt
              for {duplicate.existing.target} ({duplicate.existing.state}).
            </p>
            <p>Open the saved hunt, or start a fresh one against the same target.</p>
          </div>
        )}
        <div className="modal-actions">
          {duplicate && duplicate.existing ? (
            <>
              <button className="btn btn-ghost" onClick={onClose} disabled={launching}>
                Cancel
              </button>
              <button className="btn btn-ghost" onClick={() => onOpenDuplicate && onOpenDuplicate(duplicate.existing.huntId)} disabled={launching}>
                Open existing hunt
              </button>
              <button className="btn btn-primary" onClick={() => onStartDuplicateAnyway && onStartDuplicateAnyway()} disabled={launching}>
                {launching ? 'Starting…' : 'Start new hunt anyway'}
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-ghost" onClick={onClose} disabled={launching}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={submit} disabled={!target.trim() || !confirmed || launching}>
                {launching ? 'Starting…' : 'Start hunt'}
              </button>
            </>
          )}
        </div>
        <p className="modal-note">Only hunt targets you are authorized to test.</p>
      </div>
    </div>
  );
}
