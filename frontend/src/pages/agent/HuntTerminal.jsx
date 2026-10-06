import React, { useState, useRef, useEffect, useCallback } from 'react';
import { TerminalSquare, ArrowDown } from 'lucide-react';
import { getJobActivity, subscribeToJobEvents } from '../../services/api';
import './HuntTerminal.css';

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
 * Auto-scroll sticks to the bottom only while the user is already there;
 * a "Latest" jump button appears when they scroll up to inspect output.
 */
export function HuntTerminal({ jobId }) {
  const [lines, setLines] = useState([]);
  const [follow, setFollow] = useState(true);
  const bodyRef = useRef(null);
  const [reducedMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

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

  const checkFollow = useCallback(() => {
    const el = bodyRef.current;
    if (!el) return;
    setFollow(el.scrollHeight - el.scrollTop - el.clientHeight < 40);
  }, []);

  useEffect(() => {
    if (follow) {
      // Scroll the terminal container only — never yank the whole page.
      const el = bodyRef.current;
      if (el) {
        el.scrollTo({ top: el.scrollHeight, behavior: reducedMotion ? 'auto' : 'smooth' });
      }
    }
  }, [lines, follow, reducedMotion]);

  return (
    <section className="sg-terminal" aria-label="Hunt terminal">
      <div className="sg-terminal-head">
        <span className="sg-terminal-dot" aria-hidden="true" />
        <TerminalSquare size={13} aria-hidden="true" />
        <span>Live terminal</span>
        {!follow && lines.length > 0 && (
          <button
            type="button"
            className="sg-terminal-jump"
            onClick={() => setFollow(true)}
            aria-label="Jump to latest terminal output"
          >
            <ArrowDown size={13} aria-hidden="true" /> Latest
          </button>
        )}
      </div>
      <div
        className="sg-terminal-body"
        ref={bodyRef}
        onScroll={checkFollow}
        role="log"
        aria-label="Agent activity log"
        tabIndex={0}
      >
        {lines.length === 0 && (
          <div className="sg-terminal-dim">$ waiting<span className="sg-terminal-cursor" aria-hidden="true" /> agent output…</div>
        )}
        {lines.map((l, i) => (
          <div key={i} className="sg-terminal-line">{l}</div>
        ))}
      </div>
    </section>
  );
}
