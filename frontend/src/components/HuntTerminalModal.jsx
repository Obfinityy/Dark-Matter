import { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { useHuntTerminal } from '../hooks/useHuntTerminal';
import 'xterm/css/xterm.css';

/**
 * HuntTerminalModal — Expanded terminal view.
 * Larger terminal with full scrollback. Read-only.
 */
export default function HuntTerminalModal({ huntId, target, onClose }) {
  const termContainerRef = useRef(null);
  const termInstanceRef = useRef(null);
  const { status, termRef } = useHuntTerminal(huntId, termContainerRef);

  useEffect(() => {
    if (!termContainerRef.current || termInstanceRef.current) return;
    
    const term = new Terminal({
      theme: {
        background: '#0a0a0a',
        foreground: '#e0e0e0',
        cursor: '#00ff00',
        selection: 'rgba(255, 255, 255, 0.2)',
      },
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      scrollback: 5000,
      disableStdin: true,
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(termContainerRef.current);
    fitAddon.fit();
    
    termInstanceRef.current = term;
    termRef.current = term;
    
    term.writeln('\x1b[32m● Connected to hunt terminal (read-only)\x1b[0m');
    term.writeln('\x1b[90mWatching live: ' + (target || huntId) + '\x1b[0m\r\n');
    
    const handleResize = () => {
      try { fitAddon.fit(); } catch { /* ignore */ }
    };
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
      termInstanceRef.current = null;
      termRef.current = null;
    };
  }, [termRef, huntId, target]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="terminal-modal" onClick={(e) => e.stopPropagation()}>
        <div className="terminal-modal-header">
          <span className={`pip-live ${status === 'live' ? 'on' : ''}`}>
            {status === 'live' ? '● LIVE TERMINAL' : status.toUpperCase()}
          </span>
          <span className="terminal-modal-target">{target || huntId}</span>
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
        <div ref={termContainerRef} className="terminal-modal-body" />
        <div className="terminal-modal-footer">
          Read-only — use chat to steer the AI
        </div>
      </div>
    </div>
  );
}
