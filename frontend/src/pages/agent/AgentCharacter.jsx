/**
 * AgentCharacter — the visible presence of the hunting agent.
 * A hexagonal core with orbiting rings: breathes slowly when idle, spins
 * and pulses while a hunt is running. Professional, minimal presentation.
 * Part of: Infinity AI / Dark-Matter frontend (pages).
 */
import React from 'react';

/**
 * AgentCharacter — the visible presence of the hunting agent.
 * A hexagonal core with orbiting rings: breathes slowly when idle,
 * spins and pulses while the hunt is running. Professional, minimal.
 */
export function AgentCharacter({ active = false, listening = false, status = 'Idle' }) {
  const accessibleStatus = listening ? `${status} — listening` : status;
  return (
    <div
      className={`sg-agent-char${active ? ' working' : ' idle'}${listening ? ' listening' : ''}`}
      role="status"
      aria-label={`Agent status: ${accessibleStatus}`}
    >
      <svg className="sg-agent-svg" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
        <circle
          className="sg-orbit sg-orbit-outer"
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
          className="sg-orbit sg-orbit-inner"
          cx="60"
          cy="60"
          r="42"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="4 10"
          opacity="0.25"
        />
        <g className="sg-core-glow">
          <circle cx="60" cy="60" r="26" fill="currentColor" opacity="0.12" />
        </g>
        <polygon
          className="sg-core-hex"
          points="60,38 79,49 79,71 60,82 41,71 41,49"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <circle cx="60" cy="60" r="6" fill="currentColor" opacity="0.9" />
        <g fill="currentColor">
          <circle className="sg-tdot sg-tdot-1" cx="48" cy="96" r="2.5" />
          <circle className="sg-tdot sg-tdot-2" cx="60" cy="96" r="2.5" />
          <circle className="sg-tdot sg-tdot-3" cx="72" cy="96" r="2.5" />
        </g>
      </svg>
      <div className="sg-agent-char-label">
        <span className={`sg-agent-state${active ? ' on' : ''}${listening ? ' listening' : ''}`}>
          <span className="visually-hidden">Agent status: </span>
          <span className="sg-live-dot" aria-hidden="true" />
          {status}
        </span>
      </div>
    </div>
  );
}
