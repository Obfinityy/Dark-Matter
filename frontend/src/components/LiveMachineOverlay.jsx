// Expanded fullscreen overlay — extracted from LiveMachine.jsx (P6).
// Shows the live noVNC canvas while the owner drives (or is connecting),
// else the 3-second screenshot feed. The "Take Control" button appears
// ONLY here, never on the small docked card or the minimised chip (owner
// order 25 Oct 2026).
import React from 'react';

export default function LiveMachineOverlay({
  available,
  shortTarget,
  control,
  controlError,
  controlButton,
  overlayScreen,
  onClose,
  onEndControl,
}) {
  return (
    <div className="live-machine-overlay" role="dialog" aria-label="Live machine view — expanded">
      <div className="live-machine-overlay-bar">
        <span className={`live-machine-dot${available ? ' on' : ''}`} aria-hidden="true" />
        <span className="live-machine-live">LIVE</span>
        <span className="live-machine-target" title={shortTarget}>{shortTarget}</span>
        {control === 'on' ? (
          <>
            <span className="live-machine-control-banner" role="status">
              <span aria-hidden="true">●</span> YOU ARE IN CONTROL — the AI&apos;s GUI actions are paused
            </span>
            <button
              type="button"
              className="live-machine-done"
              onClick={onEndControl}
              title="Hand the machine back to the AI"
            >
              Done
            </button>
            <button
              type="button"
              className="live-machine-cancel"
              onClick={onEndControl}
              title="Exit control mode and hand the machine back to the AI"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <span className="live-machine-note">
              {control === 'taking' || control === 'taken' ? 'Connecting to the machine…' : 'View only — the hunter is driving'}
            </span>
            {controlButton}
          </>
        )}
        <button
          type="button"
          className="live-machine-expand"
          onClick={onClose}
          title={control === 'on' || control === 'taking' || control === 'taken' ? 'Exit control mode and close' : 'Close expanded view'}
        >
          ✕
        </button>
      </div>
      {control === 'error' && controlError && (
        <div className="live-machine-control-error" role="alert">
          {controlError}
        </div>
      )}
      {overlayScreen}
    </div>
  );
}
