// Docked picture-in-picture card — extracted from LiveMachine.jsx (P6).
// The small bottom-right live view: header (LIVE dot, target, expand,
// minimise), control banners, and the click-to-expand screen.
import React from 'react';

export default function LiveMachineDock({
  available,
  shortTarget,
  target,
  embedded,
  control,
  controlError,
  frame,
  slotStyle,
  onExpand,
  onMinimize,
}) {
  return (
    <div
      className={`live-machine${embedded ? ' live-machine-embedded' : ''}`}
      aria-label="Live machine view"
      style={slotStyle}
    >
      <div className="live-machine-header">
        <span className={`live-machine-dot${available ? ' on' : ''}`} aria-hidden="true" />
        <span className="live-machine-live">LIVE</span>
        <span className="live-machine-target" title={target}>{shortTarget}</span>
        <button
          type="button"
          className="live-machine-expand"
          onClick={onExpand}
          title="Expand machine view"
        >
          ⛶
        </button>
        {!embedded && (
          <button
            type="button"
            className="live-machine-expand"
            onClick={onMinimize}
            title="Minimize to a small chip"
          >
            ✕
          </button>
        )}
      </div>
      {control === 'error' && controlError && (
        <div className="live-machine-control-error" role="alert">
          {controlError}
        </div>
      )}
      {control === 'on' && (
        <div className="live-machine-control-banner" role="status">
          <span aria-hidden="true">●</span> YOU ARE IN CONTROL — the AI&apos;s GUI actions are paused
        </div>
      )}
      <div
        className="live-machine-screen live-machine-screen-clickable"
        onClick={onExpand}
        title="Click to expand fullscreen"
        role="button"
        aria-label="Expand machine view fullscreen"
      >
        {frame}
      </div>
    </div>
  );
}
