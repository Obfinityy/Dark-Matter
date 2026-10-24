import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Hook for live hunt terminal streaming (PiP).
 * Fetches a ticket, opens WebSocket, wires to xterm.js instance.
 */
export function useHuntTerminal(huntId, terminalRef) {
  const [status, setStatus] = useState('connecting'); // connecting|live|reconnecting|ended|error
  const wsRef = useRef(null);
  const termRef = useRef(null);
  const retryRef = useRef(0);

  const connect = useCallback(async () => {
    if (!huntId || !terminalRef.current) return;
    
    try {
      setStatus(retryRef.current > 0 ? 'reconnecting' : 'connecting');
      
      // Get ticket
      const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
      const token = localStorage.getItem('dm.token') || sessionStorage.getItem('dm.token');
      const ticketRes = await fetch(`${apiBase}/api/v1/hunts/${huntId}/terminal/ticket`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!ticketRes.ok) {
        if (ticketRes.status === 400) setStatus('ended');
        else setStatus('error');
        return;
      }
      const { ticket } = await ticketRes.json();
      
      // Open WebSocket
      const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsHost = apiBase ? new URL(apiBase).host : window.location.host;
      const ws = new WebSocket(`${wsProto}//${wsHost}/api/v1/hunts/${huntId}/terminal?ticket=${ticket}`);
      wsRef.current = ws;
      // ttyd speaks binary: frames carry a one-byte type prefix, so the
      // terminal must receive ArrayBuffers, not Blobs.
      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        retryRef.current = 0;
        setStatus('live');
      };

      ws.onmessage = async (event) => {
        let data = event.data;
        if (data instanceof Blob) data = await data.arrayBuffer();
        if (data instanceof ArrayBuffer) {
          // ttyd binary protocol (live-verified): first byte is the
          // message type — '0' is terminal output, '1' is session info
          // (command + session id), '2' is settings. Only output goes
          // to the terminal; writing the session/settings frames would
          // print protocol chatter into the prompt.
          const bytes = new Uint8Array(data);
          if (bytes.length > 0 && bytes[0] === 48 /* '0' */ && termRef.current) {
            termRef.current.write(bytes.slice(1));
          }
          return;
        }
        // Text frames: legacy/JSON handling (unchanged behavior).
        try {
          const msg = JSON.parse(data);
          if (termRef.current && msg.data) {
            termRef.current.write(msg.data);
          } else if (termRef.current && typeof data === 'string' && !data.startsWith('{')) {
            termRef.current.write(data);
          }
        } catch {
          // Raw terminal data
          if (termRef.current) termRef.current.write(data);
        }
      };
      
      ws.onclose = (event) => {
        if (event.code === 1000 && event.reason === 'hunt ended') {
          setStatus('ended');
        } else if (retryRef.current < 5) {
          retryRef.current++;
          setStatus('reconnecting');
          setTimeout(connect, Math.min(1000 * Math.pow(2, retryRef.current), 10000));
        } else {
          setStatus('error');
        }
      };
      
      ws.onerror = () => {
        // onclose will handle retry
      };
    } catch (err) {
      console.error('[terminal] connect failed:', err);
      setStatus('error');
    }
  }, [huntId, terminalRef]);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      retryRef.current = 0;
    };
  }, [connect]);

  const writeToTerm = useCallback((data) => {
    if (termRef.current) termRef.current.write(data);
  }, []);

  return { status, termRef, writeToTerm, reconnect: connect };
}
