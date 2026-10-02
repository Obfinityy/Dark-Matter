/**
 * SpotlightCard — a card with a cursor-following radial light (original implementation).
 *
 * The card stays dark; a soft violet light follows the pointer across its
 * surface, revealing a subtle glow. Turns static cards into tactile objects.
 * Falls back gracefully on touch devices (static soft glow).
 */
import React, { useRef, useCallback } from 'react';
import './SpotlightCard.css';

export function SpotlightCard({
  children,
  className = '',
  glowColor = '139, 92, 246',
  spotlightSize = 320,
  ...rest
}) {
  const ref = useRef(null);

  const onMove = useCallback((e) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--sl-x', `${e.clientX - rect.left}px`);
    el.style.setProperty('--sl-y', `${e.clientY - rect.top}px`);
    el.style.setProperty('--sl-opacity', '1');
  }, []);

  const onLeave = useCallback(() => {
    ref.current?.style.setProperty('--sl-opacity', '0');
  }, []);

  return (
    <div
      ref={ref}
      className={`sl-card ${className}`}
      style={{ '--sl-color': glowColor, '--sl-size': `${spotlightSize}px` }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      {...rest}
    >
      <div className="sl-glow" aria-hidden="true" />
      <div className="sl-content">{children}</div>
    </div>
  );
}
