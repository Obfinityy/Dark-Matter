import React, { useState, useRef, useEffect, useCallback } from 'react';
import { TerminalSquare, ArrowDown, Send } from 'lucide-react';
import { getJobActivity, subscribeToJobEvents, askJob } from '../../services/api';
import './HuntTerminal.css';

function lineText(ev) {
  if (typeof ev === 'string') return ev;
  const t = ev?.__sseType || ev?.type || '';
  const d = ev?.data || ev || {};
  const stamp = d.timestamp || d.at || '';
  const msg = d.message || d.text || d.detail || JSON.stringify(d).slice(0, 180);
  return `${stamp ? `[${String(stamp).slice(11, 19) || stamp}] ` : ''}${t ? `${t} — ` : ''}${msg}`;
}

/** Classify an event for the terminal filter. */
function lineKind(ev) {
  const t = String(ev?.__sseType || ev?.type || '');
  if (/^finding\.|^observation\.|phase_changed|completed|failed|cancelled|error/i.test(t)) return 'key';
  return 'info';
}

/**
 * HuntTerminal — live terminal view of what the agent is doing.
 * Backfills from the job activity log, then streams live SSE events.
 * Auto-scroll sticks to the bottom only while the user is already there;
 * a "Latest" jump button appears when they scroll up to inspect output,
 * with a badge counting the lines that arrived meanwhile.
 */
export function HuntTerminal({ jobId }) {
  const [lines, setLines] = useState([]);
  const [follow, setFollow] = useState(true);
  const [unseen, setUnseen] = useState(0);
  const [filter, setFilter] = useState('all'); // 'all' | 'key' | 'chat'
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const bodyRef = useRef(null);
  const followRef = useRef(true);
  const [reducedMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  const push = useCallback((incoming, kindOverride) => {
    const items = Array.isArray(incoming) ? incoming : [incoming];
    const wrapped = items.map((it) =>
      typeof it === 'string'
        ? { text: it, kind: kindOverride || 'info' }
        : { text: lineText(it), kind: kindOverride || lineKind(it) }
    );
    setLines((prev) => [...prev, ...wrapped].slice(-400));
    // Lines that stream in while the user is scrolled up are counted so
    // the "Latest" button can say how much was missed.
    if (!followRef.current) setUnseen((n) => n + wrapped.length);
  }, []);

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    getJobActivity(jobId, 120)
      .then((res) => {
        if (cancelled) return;
        const items = res?.activity || res?.items || [];
        if (items.length) push(items);
      })
      .catch(() => {});
    const unsubscribe = subscribeToJobEvents(jobId, {
      onEvent: (ev) => { if (!cancelled) push(ev); },
      onError: () => {},
    });
    return () => { cancelled = true; unsubscribe?.(); };
  }, [jobId, push]);

  const checkFollow = useCallback(() => {
    const el = bodyRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    followRef.current = atBottom;
    setFollow(atBottom);
  }, []);

  const jumpToLatest = useCallback(() => {
    followRef.current = true;
    setFollow(true);
    setUnseen(0);
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

  // Mid-hunt chat: ask the hacking brain without pausing the hunt.
  const sendQuestion = useCallback(async () => {
    const q = question.trim();
    if (!q || asking || !jobId) return;
    setAsking(true);
    push(`$ you: ${q}`, 'chat');
    setQuestion('');
    try {
      const body = await askJob(jobId, q);
      const reply = body?.reply ?? body?.answer ?? body?.message ?? '(no answer)';
      push(`$ hacking-brain: ${reply}`, 'chat');
    } catch (err) {
      push(`$ hacking-brain: [error] ${err.message || 'could not answer'}`, 'chat');
    } finally {
      setAsking(false);
    }
  }, [question, asking, jobId, push]);

  const visibleLines = filter === 'all' ? lines : lines.filter((l) => l.kind === filter || l.kind === 'chat');

  return (
    <section className="sg-terminal" aria-label="Hunt terminal">
      <div className="sg-terminal-head">
        <span className="sg-terminal-dot" aria-hidden="true" />
        <TerminalSquare size={13} aria-hidden="true" />
        <span>Live terminal</span>
        <span className="sg-terminal-filters" role="group" aria-label="Terminal filter">
          {['all', 'key', 'chat'].map((f) => (
            <button
              key={f}
              type="button"
              className={`sg-terminal-filter${filter === f ? ' sg-terminal-filter-on' : ''}`}
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
            >
              {f === 'all' ? 'All' : f === 'key' ? 'Key events' : 'Chat'}
            </button>
          ))}
        </span>
        {!follow && lines.length > 0 && (
          <button
            type="button"
            className="sg-terminal-jump"
            onClick={jumpToLatest}
            aria-label={
              unseen > 0
                ? `Jump to latest terminal output, ${unseen} new ${unseen === 1 ? 'line' : 'lines'} missed`
                : 'Jump to latest terminal output'
            }
          >
            <ArrowDown size={13} aria-hidden="true" /> Latest{unseen > 0 && ` · ${unseen} new`}
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
        {visibleLines.length === 0 && (
          <div className="sg-terminal-dim">$ waiting<span className="sg-terminal-cursor" aria-hidden="true" /> agent output…</div>
        )}
        {visibleLines.map((l, i) => (
          <div key={i} className={`sg-terminal-line${l.kind === 'chat' ? ' sg-terminal-chat' : ''}`}>{l.text}</div>
        ))}
      </div>
      {/* Mid-hunt chat: talk to the hacking brain without pausing the hunt. */}
      <form
        className="sg-terminal-ask"
        onSubmit={(e) => { e.preventDefault(); sendQuestion(); }}
      >
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask the hacking brain anything, anytime…"
          aria-label="Ask the hacking brain"
          disabled={asking}
          maxLength={2000}
        />
        <button type="submit" disabled={asking || !question.trim()} aria-label="Send question">
          <Send size={14} aria-hidden="true" />
        </button>
      </form>
    </section>
  );
}
