/**
 * HackerTerminal — the live view of the agent at work.
 *
 * Streams job events (SSE) plus the persisted activity feed, rendered as a
 * hacker-style terminal: timestamped lines, color-coded by event kind
 * (brain decisions in violet, tool output in green, findings in red/amber,
 * computer actions in cyan). Auto-scrolls; pauses when the user scrolls up.
 *
 * Props:
 *   jobId            — the hunt to watch
 *   subscribe        — (jobId, handlers) => unsubscribe  (defaults to subscribeToJobEvents)
 *   fetchActivity    — (jobId) => Promise<{activity: [...]}>
 *   fetchHistory     — (jobId, {after}) => Promise<{events: [...]}>  (backfill on reconnect)
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { TerminalSquare } from 'lucide-react';
import { subscribeToJobEvents, getJobActivity, getJobEventHistory } from '../../services/api';

const KIND_STYLE = {
  brain: 'dm-term-brain',
  tool: 'dm-term-tool',
  finding: 'dm-term-finding',
  computer: 'dm-term-computer',
  report: 'dm-term-report',
  system: 'dm-term-system',
  chat: 'dm-term-chat'
};

function classifyEvent(event) {
  const t = event.__sseType || event.type || '';
  if (t.startsWith('brain.')) return 'brain';
  if (t.startsWith('tool.')) return 'tool';
  if (t.startsWith('finding.') || t.startsWith('observation.') || t.startsWith('hypothesis.')) return 'finding';
  if (t.startsWith('computer.') || t.startsWith('browser.')) return 'computer';
  if (t.startsWith('report.')) return 'report';
  if (t.startsWith('agent.chat')) return 'chat';
  return 'system';
}

function eventToLine(event) {
  const kind = classifyEvent(event);
  const ts = event.at || event.timestamp || new Date().toISOString();
  const text = event.message || event.data?.message || event.summary || JSON.stringify(event.data || event).slice(0, 200);
  // Stable fallback id: the same event fetched twice (activity backfill vs SSE
  // history replay) must map to the same id so duplicates can be dropped.
  const fallbackId = `evt-${event.__sseType || event.type || '?'}-${ts}-${text.slice(0, 48)}`;
  return {
    id: event.id || fallbackId,
    at: ts,
    kind,
    type: event.__sseType || event.type || 'event',
    text: String(text)
  };
}

function activityToLine(entry, index) {
  return {
    id: entry.id || `activity-${index}`,
    at: entry.at || entry.createdAt,
    kind: entry.kind === 'finding' ? 'finding' : entry.kind === 'tool' ? 'tool' : 'system',
    type: entry.kind || 'activity',
    text: entry.message || entry.text || ''
  };
}

export function HackerTerminal({
  jobId,
  subscribe = subscribeToJobEvents,
  fetchActivity = getJobActivity,
  fetchHistory = getJobEventHistory,
  height = 420
}) {
  const [lines, setLines] = useState([]);
  const [connected, setConnected] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef(null);
  const lastEventIdRef = useRef(null);
  const autoScrollRef = useRef(true);
  autoScrollRef.current = autoScroll;
  // Ids already rendered — the activity backfill and the SSE history replay
  // overlap, so without this the terminal shows every early event twice.
  const seenIdsRef = useRef(new Set());

  const pushLines = useCallback((newLines) => {
    const fresh = [];
    for (const line of newLines) {
      if (seenIdsRef.current.has(line.id)) continue;
      seenIdsRef.current.add(line.id);
      fresh.push(line);
    }
    if (!fresh.length) return;
    setLines((prev) => {
      const merged = [...prev, ...fresh];
      // Keep chronological — history replays can arrive after live lines.
      merged.sort((a, b) => new Date(a.at || 0) - new Date(b.at || 0));
      return merged.length > 2000 ? merged.slice(merged.length - 2000) : merged;
    });
  }, []);

  // Initial backfill from the persisted activity feed.
  useEffect(() => {
    let cancelled = false;
    setLines([]);
    seenIdsRef.current = new Set();
    lastEventIdRef.current = null;
    fetchActivity(jobId, 300)
      .then((body) => {
        if (cancelled) return;
        const activity = body?.activity || body || [];
        pushLines(activity.map(activityToLine));
      })
      .catch(() => { /* terminal stays empty rather than crashing the page */ });
    return () => { cancelled = true; };
  }, [jobId, fetchActivity, pushLines]);

  // Live stream with history backfill on (re)connect.
  useEffect(() => {
    let cancelled = false;
    const onEvent = (event) => {
      if (cancelled) return;
      if (event.id) lastEventIdRef.current = event.id;
      pushLines([eventToLine(event)]);
    };
    const onOpen = async () => {
      if (cancelled) return;
      setConnected(true);
      // Backfill anything emitted while we were disconnected.
      try {
        const body = await fetchHistory(jobId, { after: lastEventIdRef.current || undefined });
        const events = body?.events || [];
        if (!cancelled && events.length) pushLines(events.map(eventToLine));
      } catch { /* non-fatal */ }
    };
    const unsubscribe = subscribe(jobId, {
      onOpen,
      onEvent,
      onError: () => { if (!cancelled) setConnected(false); }
    });
    return () => { cancelled = true; unsubscribe?.(); };
  }, [jobId, subscribe, fetchHistory, pushLines]);

  // Auto-scroll to the bottom unless the user scrolled up to read.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && autoScrollRef.current) el.scrollTop = el.scrollHeight;
  }, [lines]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    setAutoScroll(nearBottom);
  };

  return (
    <div className="dm-terminal-wrap">
      <div className="dm-terminal-head">
        <TerminalSquare size={15} aria-hidden="true" />
        <span className="dm-terminal-title">live hunt terminal</span>
        <span className={`dm-term-conn ${connected ? 'on' : 'off'}`}>
          {connected ? '● live' : '○ reconnecting'}
        </span>
        {!autoScroll && (
          <button
            className="dm-term-follow"
            onClick={() => setAutoScroll(true)}
            aria-label="Follow latest terminal output"
          >
            follow latest ↓
          </button>
        )}
      </div>
      <div
        ref={scrollRef}
        className="dm-terminal"
        style={{ height }}
        onScroll={onScroll}
        role="log"
        aria-label="Live hunt terminal"
        aria-live="off"
        tabIndex={0}
      >
        {lines.length === 0 && (
          <div className="dm-term-empty">waiting for the agent to speak…</div>
        )}
        {lines.map((line) => (
          <div key={line.id} className={`dm-term-line ${KIND_STYLE[line.kind] || ''}`}>
            <span className="dm-term-ts">
              {line.at ? new Date(line.at).toLocaleTimeString('en-GB', { hour12: false }) : '--:--:--'}
            </span>
            <span className="dm-term-tag">{line.type}</span>
            <span className="dm-term-text">{line.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
