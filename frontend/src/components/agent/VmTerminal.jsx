/**
 * VmTerminal — live terminal into the Infinity VM (xterm.js + fit addon,
 * wired to the runner's /vm/terminal WebSocket bridge).
 *
 * Wire protocol (design doc §2): frames are JSON
 *   { t: "in", data }            browser → runner (keystrokes)
 *   { t: "out", data }           runner → browser (pty output)
 *   { t: "resize", cols, rows }  browser → runner (size changes)
 *
 * Props:
 *   sessionId — active VM session (null → placeholder)
 *   enabled   — connect only when the session is running
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { SquareTerminal, RotateCcw } from 'lucide-react';
import { terminalSocketUrl } from '../../services/vmRunnerApi';

const THEME = {
  background: '#0b0d10',
  foreground: '#d7dce2',
  cursor: '#c9a86a',
  selectionBackground: 'rgba(201, 168, 106, 0.3)',
  black: '#0b0d10',
  red: '#e06c75',
  green: '#98c379',
  yellow: '#c9a86a',
  blue: '#61afef',
  magenta: '#c678dd',
  cyan: '#56b6c2',
  white: '#d7dce2'
};

export function VmTerminal({ sessionId, enabled = true }) {
  const hostRef = useRef(null);
  const termRef = useRef(null);
  const fitRef = useRef(null);
  const wsRef = useRef(null);
  const termSubsRef = useRef(null); // disposables for term.onData/onResize
  const [status, setStatus] = useState('idle'); // idle | connecting | connected | disconnected | error

  const closeSocket = useCallback(() => {
    try { termSubsRef.current?.(); } catch { /* noop */ }
    termSubsRef.current = null;
    try { wsRef.current?.close(); } catch { /* noop */ }
    wsRef.current = null;
  }, []);

  const connect = useCallback(() => {
    const term = termRef.current;
    if (!term || !sessionId || !enabled) return;
    closeSocket();
    setStatus('connecting');
    let ws;
    try {
      ws = new WebSocket(terminalSocketUrl(sessionId));
    } catch (err) {
      setStatus('error');
      term.writeln(`\x1b[31mCould not open the terminal socket: ${err?.message || err}\x1b[0m`);
      return;
    }
    wsRef.current = ws;

    const sendResize = () => {
      if (ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ t: 'resize', cols: term.cols, rows: term.rows }));
    };

    ws.onopen = () => {
      setStatus('connected');
      fitRef.current?.fit();
      sendResize();
    };
    ws.onmessage = (ev) => {
      let frame;
      try { frame = JSON.parse(ev.data); } catch { return; }
      if (frame && frame.t === 'out' && typeof frame.data === 'string') {
        term.write(frame.data);
      }
    };
    ws.onclose = () => {
      setStatus((s) => (s === 'connected' ? 'disconnected' : s));
      wsRef.current = null;
    };
    ws.onerror = () => {
      setStatus('error');
    };

    // Keystrokes → runner.
    const onData = term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ t: 'in', data }));
    });
    // Resize events → runner.
    const onResize = term.onResize(() => sendResize());
    termSubsRef.current = () => { onData.dispose(); onResize.dispose(); };
  }, [sessionId, enabled, closeSocket]);

  // Create the terminal once.
  useEffect(() => {
    const term = new Terminal({
      theme: THEME,
      fontSize: 13,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      cursorBlink: true,
      scrollback: 5000,
      allowTransparency: false
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(hostRef.current);
    termRef.current = term;
    fitRef.current = fit;
    fit.fit();

    const onWinResize = () => { try { fit.fit(); } catch { /* noop */ } };
    window.addEventListener('resize', onWinResize);
    return () => {
      window.removeEventListener('resize', onWinResize);
      try { termSubsRef.current?.(); } catch { /* noop */ }
      try { wsRef.current?.close(); } catch { /* noop */ }
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, []);

  // Connect when the session is ready; tear down otherwise.
  useEffect(() => {
    if (sessionId && enabled && termRef.current) {
      termRef.current.clear();
      connect();
    } else {
      closeSocket();
      setStatus('idle');
    }
    return () => { try { termSubsRef.current?.(); } catch { /* noop */ } closeSocket(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, enabled]);

  return (
    <div className="vm-terminal" role="region" aria-label="VM terminal">
      <div className="vm-terminal-head">
        <span className="vm-terminal-title"><SquareTerminal size={14} aria-hidden="true" /> vm terminal</span>
        <span className={`vm-screen-status is-${status}`}>
          {status === 'connected' ? '● live' : status}
        </span>
        {(status === 'disconnected' || status === 'error') && sessionId && (
          <button type="button" className="dm-btn dm-btn-ghost dm-btn-sm" onClick={connect}>
            <RotateCcw size={13} /> Reconnect
          </button>
        )}
      </div>
      <div className="vm-terminal-body">
        <div ref={hostRef} className="vm-terminal-host" />
        {(!sessionId || !enabled) && (
          <div className="vm-screen-empty">Start the VM to open a live terminal.</div>
        )}
      </div>
    </div>
  );
}
