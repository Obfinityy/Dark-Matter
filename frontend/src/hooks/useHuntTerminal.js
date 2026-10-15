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
      
      ws.onopen = () => {
        retryRef.current = 0;
        setStatus('live');
      };
      
      ws.onmessage = (event) => {
        // ttyd protocol: JSON messages with base64 or raw data
        try {
          const msg = JSON.parse(event.data);
          // ttyd sends {type: 'output', data: '...'} or similar
          if (termRef.current && msg.data) {
            termRef.current.write(msg.data);
          } else if (termRef.current && typeof event.data === 'string' && !event.data.startsWith('{')) {
            termRef.current.write(event.data);
          }
        } catch {
          // Raw terminal data
          if (termRef.current) termRef.current.write(event.data);
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
