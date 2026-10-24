import { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { useHuntTerminal } from '../hooks/useHuntTerminal';
import 'xterm/css/xterm.css';

/**
 * HuntPiP — Picture-in-Picture live terminal for hunt.
 * Floating, draggable mini window showing what the AI is doing.
 */
export default function HuntPiP({ huntId, target, onExpand, onClose }) {
  const termContainerRef = useRef(null);
  // FIX (24 Oct 2026): the terminal PiP used to open at the exact
  // bottom-right band the Live Machine card occupies (same corner, same
  // z-index 9000, PiP earlier in the DOM) — so the machine card painted
  // OVER it and the terminal was invisible despite a LIVE socket, with
  // its Expand button unclickable ("covered"). The PiP now opens one
  // machine-card height ABOVE that card: machine card bottom 16px +
  // tallest observed card ~310px + 16px gap = 342px from the bottom,
  // minus the PiP's own 220px height. Still draggable afterwards.
  // Safe under the owner's one-hunt-at-a-time rule: only one machine
  // card can exist, so "one step above slot 0" never collides.
  const [position, setPosition] = useState({ x: window.innerWidth - 340, y: window.innerHeight - 562 });
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const termInstanceRef = useRef(null);
  const fitAddonRef = useRef(null);
  
  const { status, termRef } = useHuntTerminal(huntId, termContainerRef);

  useEffect(() => {
    if (!termContainerRef.current || termInstanceRef.current) return;
    
    const term = new Terminal({
      theme: {
        background: '#0a0a0a',
        foreground: '#00ff00',
        cursor: '#00ff00',
      },
      fontSize: 11,
      fontFamily: 'monospace',
      scrollback: 1000,
      disableStdin: true, // Read-only
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(termContainerRef.current);
    fitAddon.fit();
    
    termInstanceRef.current = term;
    fitAddonRef.current = fitAddon;
    termRef.current = term;
    
    term.writeln('\x1b[32m● Connecting to hunt terminal...\x1b[0m');
    
    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
      termInstanceRef.current = null;
      termRef.current = null;
    };
  }, [termRef]);

  const handleMouseDown = (e) => {
    if (e.target.closest('.pip-controls')) return;
    setDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  const handleMouseMove = (e) => {
    if (!dragging) return;
    setPosition({
      x: Math.max(0, Math.min(window.innerWidth - 320, e.clientX - dragOffset.x)),
      y: Math.max(0, Math.min(window.innerHeight - 200, e.clientY - dragOffset.y)),
    });
  };

  const handleMouseUp = () => setDragging(false);

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragging, dragOffset, position]);

  return (
    <div
      className="hunt-pip"
      style={{ left: position.x, top: position.y }}
      onMouseDown={handleMouseDown}
    >
      <div className="pip-header">
        <span className={`pip-live ${status === 'live' ? 'on' : ''}`}>
          {status === 'live' ? '● LIVE' : status === 'reconnecting' ? '↻...' : status === 'ended' ? '■ ENDED' : status === 'error' ? '⚠ ERROR' : '○'}
        </span>
        <span className="pip-target" title={target}>
          {target ? target.replace(/^https?:\/\//, '').slice(0, 20) : huntId.slice(0, 8)}
        </span>
        <span className="pip-controls">
          <button onClick={onExpand} title="Expand terminal">⛶</button>
          <button onClick={onClose} title="Close">✕</button>
        </span>
      </div>
      <div ref={termContainerRef} className="pip-terminal" />
      {status === 'ended' && (
        <div className="pip-ended">Hunt ended — terminal closed</div>
      )}
    </div>
  );
}
