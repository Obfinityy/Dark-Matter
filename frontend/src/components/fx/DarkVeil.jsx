/**
 * DarkVeil — ambient violet fog background (original implementation).
 *
 * Inspired by the "dark veil / aurora" aesthetic: slow-drifting radial
 * gradients of violet and magenta over a near-black violet-tinted base.
 * Pure CSS — no WebGL, no dependencies, GPU-cheap (transform/opacity only).
 *
 * Usage: <DarkVeil /> as the first child of a full-page container.
 * Children render in a content layer ABOVE the atmosphere so they stay
 * interactive and visible to assistive tech (the atmosphere is aria-hidden).
 */
import React, { useMemo } from 'react';
import './DarkVeil.css';

export function DarkVeil({ intensity = 1, children }) {
  const orbs = useMemo(() => [
    { x: '12%', y: '8%',  size: 520, hue: 'violet',  dur: '26s', delay: '0s' },
    { x: '82%', y: '18%', size: 460, hue: 'magenta', dur: '32s', delay: '-8s' },
    { x: '68%', y: '82%', size: 600, hue: 'violet',  dur: '38s', delay: '-16s' },
    { x: '18%', y: '78%', size: 420, hue: 'cyan',    dur: '30s', delay: '-4s' },
    { x: '48%', y: '48%', size: 700, hue: 'deep',    dur: '44s', delay: '-22s' },
  ], []);

  return (
    <div className="dv-root" style={{ '--dv-intensity': intensity }}>
      <div className="dv-atmosphere" aria-hidden="true">
        {orbs.map((o, i) => (
          <div
            key={i}
            className={`dv-orb dv-orb-${o.hue}`}
            style={{
              left: o.x, top: o.y,
              width: o.size, height: o.size,
              animationDuration: o.dur,
              animationDelay: o.delay,
            }}
          />
        ))}
        <div className="dv-grain" />
      </div>
      {children ? <div className="dv-content">{children}</div> : null}
    </div>
  );
}
