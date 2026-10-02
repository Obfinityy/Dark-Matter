import React, { useState, useRef, useEffect, useCallback } from 'react';
import { TerminalSquare } from 'lucide-react';
import { getJobActivity, subscribeToJobEvents } from '../../services/api';

function lineText(ev) {
  if (typeof ev === 'string') return ev;
  const t = ev?.__sseType || ev?.type || '';
  const d = ev?.data || ev || {};
  const stamp = d.timestamp || d.at || '';
  const msg = d.message || d.text || d.detail || JSON.stringify(d).slice(0, 180);
  return `${stamp ? `[${String(stamp).slice(11, 19) || stamp}] ` : ''}${t ? `${t} — ` : ''}${msg}`;
}

/**
 * HuntTerminal — live terminal view of what the agent is doing.
 * Backfills from the job activity log, then streams live SSE events.
 */
export function HuntTerminal({ jobId }) {
  const [lines, setLines] = useState([]);
  const bottomRef = useRef(null);

  const push = useCallback((incoming) => {
    setLines((prev) => {
      const next = [...prev, ...(Array.isArray(incoming) ? incoming : [incoming])];
      return next.slice(-400);
    });
  }, []);

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    getJobActivity(jobId, 120)
      .then((res) => {
        if (cancelled) return;
        const items = res?.activity || res?.items || [];
        if (items.length) push(items.map(lineText));
      })
      .catch(() => {});
    const unsubscribe = subscribeToJobEvents(jobId, {
      onEvent: (ev) => { if (!cancelled) push(lineText(ev)); },
      onError: () => {},
    });
    return () => { cancelled = true; unsubscribe?.(); };
  }, [jobId, push]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [lines]);

  return (
    <section className="sg-terminal" aria-label="Hunt terminal">
      <div className="sg-terminal-head">
        <TerminalSquare size={13} />
        <span>Live terminal</span>
      </div>
      <div className="sg-terminal-body">
        {lines.length === 0 && <div className="sg-terminal-dim">Waiting for agent output…</div>}
        {lines.map((l, i) => (
          <div key={i} className="sg-terminal-line">{l}</div>
        ))}
        <div ref={bottomRef} />
      </div>
    </section>
  );
}
