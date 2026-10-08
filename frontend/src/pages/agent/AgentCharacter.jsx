/**
 * AgentCharacter — the visible presence of the hunting agent.
 * A hexagonal core with orbiting rings: breathes slowly when idle, spins
 * and pulses while a hunt is running. Professional, minimal presentation.
 * Part of: Infinity AI / Dark-Matter frontend (pages).
 */
import React from 'react';
import './AgentCharacter.css';

/**
 * AgentCharacter — the visible presence of the hunting agent.
 * A hexagonal core with orbiting rings: breathes slowly when idle,
 * spins and pulses while the hunt is running. Professional, minimal.
 */
export function AgentCharacter({ active = false, listening = false, status = 'Idle' }) {
  const accessibleStatus = listening ? `${status} — listening` : status;
  return (
    <div
      className={`dm-char${active ? ' working' : ' idle'}${listening ? ' listening' : ''}`}
      role="status"
      aria-label={`Agent status: ${accessibleStatus}`}
    >
      <svg className="dm-char-svg" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
        <circle
          className="dm-char-orbit dm-char-orbit-outer"
          cx="60"
          cy="60"
          r="52"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="10 8"
          opacity="0.35"
        />
        <circle
          className="dm-char-orbit dm-char-orbit-inner"
          cx="60"
          cy="60"
          r="42"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="4 10"
          opacity="0.25"
        />
        <g className="dm-char-core-glow">
          <circle cx="60" cy="60" r="26" fill="currentColor" opacity="0.12" />
        </g>
        <polygon
          className="dm-char-core-hex"
          points="60,38 79,49 79,71 60,82 41,71 41,49"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <circle cx="60" cy="60" r="6" fill="currentColor" opacity="0.9" />
        <g fill="currentColor">
          <circle className="dm-char-tdot dm-char-tdot-1" cx="48" cy="96" r="2.5" />
          <circle className="dm-char-tdot dm-char-tdot-2" cx="60" cy="96" r="2.5" />
          <circle className="dm-char-tdot dm-char-tdot-3" cx="72" cy="96" r="2.5" />
        </g>
      </svg>
      <div className="dm-char-label">
        <span className={`dm-char-state${active ? ' on' : ''}${listening ? ' listening' : ''}`}>
          <span className="dm-char-live-dot" aria-hidden="true" />
          {status}
        </span>
      </div>
    </div>
  );
}
