/**
 * Loaders.jsx — Forge wave 1, ideas 50005–50040 (hunt-UX loaders & progress).
 *
 * Determinate/indeterminate loaders, progress bars, overlays and optimistic
 * UI used across the hunt experience. Dark-theme, violet accent.
 */
import React from 'react';
import './Loaders.css';

/** 50009 — Determinate model-download bar: percentage + ETA. */
export function DeterminateProgressBar({ value = 0, etaText = '', label = '', className = '' }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={`hl-progress ${className}`} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label || 'Progress'}>
      {(label || etaText) && (
        <div className="hl-progress-meta">
          {label && <span className="hl-progress-label">{label}</span>}
          {etaText && <span className="hl-progress-eta">{etaText}</span>}
        </div>
      )}
      <div className="hl-progress-track">
        <div className="hl-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="hl-progress-pct">{Math.round(pct)}%</span>
    </div>
  );
}

/** 50010 — Barber-pole indeterminate striped loader for target analysis. */
export function BarberPoleLoader({ label = 'Analyzing target…', className = '' }) {
  return (
    <div className={`hl-barber ${className}`} role="status" aria-label={label}>
      <div className="hl-barber-bar" aria-hidden="true" />
      {label && <span className="hl-barber-label">{label}</span>}
    </div>
  );
}

/** 50012 — Start Hunt button: spinner morphs into the phase label once hunting. */
export function StartButtonMorphingSpinner({ phase = null, idleLabel = 'Start Hunt', onClick, disabled = false, className = '' }) {
  return (
    <button
      type="button"
      className={`hl-start-btn ${phase ? 'hl-start-active' : ''} ${className}`}
      onClick={onClick}
      disabled={disabled || !!phase}
    >
      {phase ? (
        <span className="hl-start-phase">
          <span className="hl-mini-spinner" aria-hidden="true" />
          {phase}
        </span>
      ) : (
        idleLabel
      )}
    </button>
  );
}

/** 50016 — Engine warm-up checklist: engines light up green as each readies. */
export function EngineWarmupChecklist({ engines = [], className = '' }) {
  const items = engines.length > 0 ? engines : [
    { name: 'Recon engine', ready: false },
    { name: 'Vulnerability detector', ready: false },
    { name: 'PoC generator', ready: false },
  ];
  return (
    <div className={`hl-warmup ${className}`} role="status" aria-label="Warming up engines">
      <span className="hl-warmup-title">Warming up engines</span>
      {items.map((e) => (
        <div key={e.name} className={`hl-warmup-row ${e.ready ? 'hl-ready' : ''}`}>
          <span className="hl-warmup-dot" aria-hidden="true" />
          <span>{e.name}</span>
          <span className="hl-warmup-state">{e.ready ? 'ready' : '…'}</span>
        </div>
      ))}
    </div>
  );
}

/** 50018 — Blurred domain placeholder while the target preview iframe loads. */
export function TargetPreviewIframeLoader({ hostname = 'target', className = '' }) {
  return (
    <div className={`hl-iframe-ph ${className}`} role="status" aria-label={`Loading preview of ${hostname}`}>
      <div className="hl-iframe-blur" aria-hidden="true">
        <div className="hl-iframe-bar" />
        <div className="hl-iframe-lines" />
      </div>
      <span className="hl-iframe-host">{hostname}</span>
    </div>
  );
}

/** 50020 — Optimistic queued-hunt card: appears the instant a link is pasted. */
export function OptimisticQueuedHuntCard({ target = '', onCancel, className = '' }) {
  return (
    <div className={`hl-queue-card ${className}`} role="status" aria-label="Hunt queued">
      <span className="hl-queue-pulse" aria-hidden="true" />
      <div className="hl-queue-body">
        <span className="hl-queue-title">Queued</span>
        {target && <span className="hl-queue-target">{target}</span>}
      </div>
      {onCancel && (
        <button type="button" className="hl-queue-cancel" onClick={onCancel} aria-label="Cancel queued hunt">✕</button>
      )}
    </div>
  );
}

/** 50022 — Thinking agent avatar pulse with caption. */
export function ThinkingAvatarPulse({ caption = 'thinking', initials = 'AI', className = '' }) {
  return (
    <div className={`hl-thinking ${className}`} role="status" aria-label={`Agent ${caption}`}>
      <span className="hl-avatar-ring" aria-hidden="true">
        <span className="hl-avatar-core">{initials}</span>
      </span>
      <span className="hl-thinking-caption">{caption}</span>
    </div>
  );
}

/** 50023 — Export overlay: "generating PDF" with a working cancel option. */
export function ExportOverlayWithCancel({ label = 'Generating PDF…', onCancel, className = '' }) {
  return (
    <div className={`hl-export-overlay ${className}`} role="alertdialog" aria-label={label}>
      <span className="hl-mini-spinner hl-spinner-lg" aria-hidden="true" />
      <span>{label}</span>
      {onCancel && (
        <button type="button" className="hl-export-cancel" onClick={onCancel}>Cancel</button>
      )}
    </div>
  );
}

/** 50028 — Target URL input analyzing state: shimmer + cancel X. */
export function UrlAnalyzingState({ onCancel, className = '' }) {
  return (
    <div className={`hl-url-analyzing ${className}`} role="status" aria-label="Analyzing URL">
      <div className="hl-url-shimmer" aria-hidden="true" />
      {onCancel && (
        <button type="button" className="hl-url-cancel" onClick={onCancel} aria-label="Cancel analysis">✕</button>
      )}
    </div>
  );
}

/** 50029 — Per-phase loading bars inside the timeline tracker. */
export function PerPhaseLoadingBars({ phases = [], className = '' }) {
  const items = phases.length > 0 ? phases : [
    { name: 'Recon', progress: 0 }, { name: 'Testing', progress: 0 },
    { name: 'Chaining', progress: 0 }, { name: 'Reporting', progress: 0 },
  ];
  return (
    <div className={`hl-phases ${className}`} role="status" aria-label="Phase progress">
      {items.map((p) => (
        <div key={p.name} className="hl-phase-row">
          <span className="hl-phase-name">{p.name}</span>
          <div className="hl-progress-track hl-phase-track">
            <div className="hl-progress-fill" style={{ width: `${Math.max(0, Math.min(100, p.progress))}%` }} />
          </div>
          <span className="hl-phase-pct">{Math.round(p.progress)}%</span>
        </div>
      ))}
    </div>
  );
}

/** 50031 — Resume-from-snapshot loader: snapshot restore progress. */
export function ResumeFromSnapshotLoader({ progress = 0, stage = 'Restoring hunt snapshot…', className = '' }) {
  return (
    <div className={`hl-resume ${className}`} role="status" aria-label={stage}>
      <span className="hl-mini-spinner" aria-hidden="true" />
      <div className="hl-resume-body">
        <span>{stage}</span>
        <div className="hl-progress-track">
          <div className="hl-progress-fill" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
        </div>
      </div>
      <span className="hl-progress-pct">{Math.round(progress)}%</span>
    </div>
  );
}

/** 50033 — Filter chip with a tiny spinner while re-querying. */
export function FilterChipSpinner({ label = 'Filter', loading = true, onClick, active = false, className = '' }) {
  return (
    <button
      type="button"
      className={`hl-filter-chip ${active ? 'hl-active' : ''} ${className}`}
      onClick={onClick}
      disabled={loading}
    >
      {loading && <span className="hl-mini-spinner" aria-hidden="true" />}
      {label}
    </button>
  );
}

/** 50035 — Inline agent-status dots: "Testing login form …" during live steps. */
export function InlineStatusDots({ text = 'Working', className = '' }) {
  return (
    <span className={`hl-status-dots ${className}`} role="status" aria-label={text}>
      {text}
      <span className="hl-dots" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span>
    </span>
  );
}

/** 50037 — Spinner inside the saved-search dropdown while searches fetch. */
export function SavedSearchDropdownLoader({ className = '' }) {
  return (
    <div className={`hl-dropdown-loader ${className}`} role="status" aria-label="Loading saved searches">
      <span className="hl-mini-spinner" aria-hidden="true" />
      <span>Loading saved searches…</span>
    </div>
  );
}

/** 50039 — ZIP-export progress bar with the file count being packed. */
export function ZipExportProgressBar({ done = 0, total = 0, className = '' }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className={`hl-zip ${className}`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Exporting memory ZIP">
      <div className="hl-progress-meta">
        <span className="hl-progress-label">Packing memory ZIP</span>
        <span className="hl-progress-eta">{done} / {total} files</span>
      </div>
      <div className="hl-progress-track">
        <div className="hl-progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
