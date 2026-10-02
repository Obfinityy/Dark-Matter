/**
 * ElectricBorder — animated crackling-energy border for active/processing states.
 * Original implementation: a conic-gradient border that rotates like plasma arcs.
 * Reserve for the currently-working agent card or alert states.
 */
import React from 'react';
import './ElectricBorder.css';

export function ElectricBorder({ children, className = '', active = true }) {
  return (
    <div className={`eb-wrap ${active ? 'eb-active' : ''} ${className}`}>
      <div className="eb-border" aria-hidden="true" />
      <div className="eb-inner">{children}</div>
    </div>
  );
}
