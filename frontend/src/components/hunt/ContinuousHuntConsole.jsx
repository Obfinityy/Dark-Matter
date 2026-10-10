/**
 * ContinuousHuntConsole — the live view for a continuous autonomous hunt
 * (issue #298). The user pastes a target and hits Enter; the agent hunts
 * non-stop (understanding → recon → testing → research → deep_testing →
 * replan → …) until the USER force-stops it. Force stop is the only
 * terminal action — pause/resume freeze and restore the full loop state.
 *
 * Live data arrives over SSE (`/hunts/:id/events`):
 *   - `activity`      → live terminal lines
 *   - `vuln_tally`    → {critical,high,medium,low,informational,total} severity chips
 *   - `think.trace`   → think-aloud trace (humanRecon / researchFallback)
 *   - `hunt.*`        → lifecycle + VM boot state changes
 *
 * Mid-hunt chat reuses ChatDock's MessageList/MessageComposer (extended,
 * not duplicated) and asks the backend with the hunt id — replies are
 * grounded in the live loop context.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import {
  Pause,
  Play,
  FileText,
  OctagonX,
  Loader2,
  AlertTriangle,
  ChevronLeft,
  TerminalSquare,
  ArrowDown,
  Brain,
  Server,
  Radio,
} from 'lucide-react';
import {
  getHuntState,
  subscribeToHuntEvents,
  pauseHunt,
  resumeHunt,
  forceStopHunt,
  reportHuntSnapshot,
  askHunt,
} from '../../services/api';
import { MessageList, MessageComposer } from './ChatDock';
import { usePrefersReducedMotion } from '../kinetic/Kinetic';
import './ChatDock.css';
import './ContinuousHuntConsole.css';
import '../../styles/kinetic-hunt.css';

const LOOP_STATE_LABELS = {
  UNDERSTANDING: 'Understanding the target',
  RECON: 'Recon',
  TESTING: 'Testing hypotheses',
  RESEARCH: 'Researching',
  DEEP_TESTING: 'Deep testing',
  REPLAN: 'Replanning',
};

const TRACE_KIND_LABELS = {
  humanRecon: 'Recon thinking',
  researchFallback: 'Researching (web fallback)',
  understanding: 'Understanding',
  finding: 'Finding',
  transition: 'State change',
  start: 'Hunt started',
};

// Backend severity set (vulnTallyService): critical/high/medium/low/
// informational — displayed with the familiar short labels.
const TALLY_ORDER = [
  { key: 'critical', label: 'Critical' },
  { key: 'high', label: 'High' },
  { key: 'medium', label: 'Medium' },
  { key: 'low', label: 'Low' },
  { key: 'informational', label: 'Info' },
];

function prettyKind(kind) {
  if (!kind) return 'Trace';
  return String(kind)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, c => c.toUpperCase());
}

function traceLabel(kind) {
  return TRACE_KIND_LABELS[kind] || prettyKind(kind);
}

/** Render one SSE activity payload (or a plain string) as a terminal line.
 * Backend shape: { id, scanId, type, level, message, data: { line, ts }, timestamp }. */
function activityText(ev) {
  if (typeof ev === 'string') return ev;
  const d = ev?.data || {};
  const msg = d.line || ev?.message || d.message || d.text || d.detail;
  if (msg) return String(msg);
  return JSON.stringify(ev?.data ?? ev).slice(0, 220);
}

/** Render one think.trace payload as a readable reasoning entry.
 * Backend shape: { ts, tick, state, kind, text }. */
function traceText(ev) {
  const d = ev?.data || ev || {};
  if (typeof d === 'string') return d;
  return d.text || d.message || JSON.stringify(d).slice(0, 280);
}

function traceKind(ev) {
  const d = ev?.data || ev || {};
  return typeof d === 'object' ? d.kind || d.source || '' : '';
}

function traceAt(ev) {
  const d = ev?.data || ev || {};
  return d.ts || d.at || d.timestamp || new Date().toISOString();
}

function normalizeTally(source) {
  const t = source || {};
  return {
    critical: Number(t.critical) || 0,
    high: Number(t.high) || 0,
    medium: Number(t.medium) || 0,
    low: Number(t.low) || 0,
    informational: Number(t.informational ?? t.info) || 0,
    total: Number(t.total) || 0,
  };
}

/** Hunt status pill — same visual language as the rest of the console lane. */
function HuntStatusPill({ status }) {
  const s = String(status || 'starting').toLowerCase();
  const map = {
    starting: ['Starting', 'chc-pill-info'],
    running: ['Hunting', 'chc-pill-go'],
    paused: ['Paused', 'chc-pill-warn'],
    force_stopped: ['Force stopped', 'chc-pill-danger'],
    error: ['Error', 'chc-pill-danger'],
  };
  const [label, cls] = map[s] || [s.charAt(0).toUpperCase() + s.slice(1), ''];
  return (
    <span className={`chc-pill ${cls}`}>
      {(s === 'running' || s === 'starting') && (
        <span className="chc-pill-dot" aria-hidden="true" />
      )}
      {label}
    </span>
  );
}

export function ContinuousHuntConsole() {
  const { huntId } = useParams();
  const location = useLocation();
  // The tally read endpoint doesn't carry the target — it rides along in
  // navigation state from the launcher (falls back to the hunt id).
  const navTarget = location.state?.target;
  const reducedMotion = usePrefersReducedMotion();

  const [hunt, setHunt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [lines, setLines] = useState([]);
  const [follow, setFollow] = useState(true);
  const [unseen, setUnseen] = useState(0);
  const [tally, setTally] = useState(normalizeTally(null));
  const [traces, setTraces] = useState([]);
  const [vmStatus, setVmStatus] = useState('starting'); // starting | booting | ready
  const [busy, setBusy] = useState(null); // pause | resume | report
  const [confirmStop, setConfirmStop] = useState(false);
  const [reportDone, setReportDone] = useState('');
  const [chat, setChat] = useState({ messages: [], thinking: false, error: '' });

  const bodyRef = useRef(null);
  const followRef = useRef(true);
  const stopBtnRef = useRef(null);
  const chatIdRef = useRef(0);

  // ── Load initial state (refresh-safe) ────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError('');
    getHuntState(huntId)
      .then(({ hunt: h, tally: t }) => {
        if (cancelled) return;
        setHunt(h);
        setTally(normalizeTally(t || h?.tally));
        // First contact with the loop means the machine is up — flip the
        // VM indicator off its "starting…" state.
        setVmStatus('ready');
        setLoading(false);
      })
      .catch(err => {
        if (!cancelled) {
          setLoadError(err.message || 'Could not load the hunt.');
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [huntId]);

  // ── Terminal line pump ───────────────────────────────────────────
  const pushLine = useCallback(text => {
    setLines(prev => [...prev, { text, at: Date.now() }].slice(-400));
    if (!followRef.current) setUnseen(n => n + 1);
  }, []);

  // ── Live SSE stream ──────────────────────────────────────────────
  // The backend publishes vuln_tally/activity to the shared event bus; the
  // dedicated /hunts/:id/events route lands with the backend worker's next
  // pass. Until the stream opens, a light /tally poll keeps the console live.
  useEffect(() => {
    if (!huntId) return;
    let sseOpen = false;
    const refresh = async () => {
      if (sseOpen) return;
      try {
        const { hunt: h, tally: t } = await getHuntState(huntId);
        setHunt(h);
        setTally(normalizeTally(t || h?.tally));
        setVmStatus('ready');
      } catch {
        /* keep last-known state */
      }
    };
    const pollTimer = setInterval(refresh, 10000);
    const unsubscribe = subscribeToHuntEvents(huntId, {
      onOpen: () => {
        sseOpen = true;
        clearInterval(pollTimer);
        setVmStatus('ready');
      },
      onEvent: event => {
        const type = event.__sseType || event.type || '';
        // The shared event bus wraps payloads: { id, scanId, type, level,
        // message, data: <payload>, timestamp }. Some publishers send the
        // payload flat — tolerate both shapes.
        const payload = event.data?.data ?? event.data ?? {};
        if (type === 'activity') {
          pushLine(activityText(event));
          setVmStatus('ready');
        } else if (type === 'vuln_tally') {
          setTally(normalizeTally(payload));
        } else if (type === 'think.trace') {
          setTraces(prev =>
            [
              ...prev,
              {
                id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                kind: traceKind(event),
                text: traceText(event),
                at: traceAt(event),
              },
            ].slice(-60)
          );
        } else if (type === 'hunt.vm_booting') {
          setVmStatus('booting');
        } else if (type === 'hunt.vm_ready' || type === 'hunt.started') {
          setVmStatus('ready');
        } else if (type === 'hunt.state_changed') {
          const st = String(payload.state || payload.status || '').toUpperCase();
          if (st) {
            setHunt(prev => ({
              ...(prev || {}),
              loopState: st,
              status: st === 'PAUSED' ? 'paused' : st === 'FORCE_STOPPED' ? 'force_stopped' : 'running',
            }));
          }
        } else if (type === 'hunt.paused' || type === 'hunt.resumed' || type === 'hunt.force_stopped') {
          setHunt(prev => ({
            ...(prev || {}),
            status:
              type === 'hunt.paused' ? 'paused' : type === 'hunt.resumed' ? 'running' : 'force_stopped',
            loopState:
              type === 'hunt.paused' ? 'PAUSED' : type === 'hunt.resumed' ? prev?.loopState || 'UNDERSTANDING' : 'FORCE_STOPPED',
          }));
        } else if (type === 'finding.created') {
          // The tally event carries the authoritative counts; this line
          // keeps the terminal informative even if tally lags a beat.
          pushLine(`finding recorded${payload.title ? `: ${payload.title}` : ''}`);
        }
      },
      onError: () => {},
    });
    return () => {
      clearInterval(pollTimer);
      unsubscribe?.();
    };
  }, [huntId, pushLine]);

  // ── Follow / auto-scroll ─────────────────────────────────────────
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

  // ── Follow / auto-scroll ─────────────────────────────────────────
  useEffect(() => {
    if (!follow) return;
    const el = bodyRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: reducedMotion ? 'auto' : 'smooth' });
  }, [lines, follow, reducedMotion]);

  // ── Controls ─────────────────────────────────────────────────────
  const doPause = useCallback(async () => {
    setBusy('pause');
    setError('');
    try {
      const body = await pauseHunt(huntId);
      const st = String(body?.state || 'PAUSED').toUpperCase();
      setHunt(prev => ({ ...(prev || {}), loopState: st, status: 'paused', tick: body?.tick ?? prev?.tick }));
    } catch (err) {
      setError(err.message || 'Could not pause the hunt.');
    } finally {
      setBusy(null);
    }
  }, [huntId]);

  const doResume = useCallback(async () => {
    setBusy('resume');
    setError('');
    try {
      const body = await resumeHunt(huntId);
      const st = String(body?.state || 'UNDERSTANDING').toUpperCase();
      setHunt(prev => ({ ...(prev || {}), loopState: st, status: 'running', tick: body?.tick ?? prev?.tick }));
    } catch (err) {
      setError(err.message || 'Could not resume the hunt.');
    } finally {
      setBusy(null);
    }
  }, [huntId]);

  const doReport = useCallback(async () => {
    setBusy('report');
    setError('');
    setReportDone('');
    try {
      const blob = await reportHuntSnapshot(huntId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dark-matter-hunt-${huntId}-snapshot.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 4000);
      setReportDone('Report snapshot downloaded — the hunt keeps running.');
    } catch (err) {
      setError(err.message || 'Could not generate the report snapshot.');
    } finally {
      setBusy(null);
    }
  }, [huntId]);

  const doForceStop = useCallback(async () => {
    setBusy('stop');
    setError('');
    try {
      await forceStopHunt(huntId); // sends { confirmed: true } — explicit intent
      setHunt(prev => ({ ...(prev || {}), loopState: 'FORCE_STOPPED', status: 'force_stopped' }));
      setConfirmStop(false);
    } catch (err) {
      setError(err.message || 'Could not force-stop the hunt.');
    } finally {
      setBusy(null);
    }
  }, [huntId]);

  // Move focus into the confirm dialog when it opens (keyboard + SR users).
  useEffect(() => {
    if (confirmStop) stopBtnRef.current?.focus();
  }, [confirmStop]);

  // ── Mid-hunt chat (grounded in the live loop context) ─────────────
  const loopState = String(hunt?.loopState || '').toUpperCase();
  const loopLabel = LOOP_STATE_LABELS[loopState] || (loopState ? prettyKind(loopState.toLowerCase()) : '');
  const sendChat = useCallback(
    async text => {
      const id = ++chatIdRef.current;
      setChat(prev => ({
        ...prev,
        error: '',
        thinking: true,
        messages: [...prev.messages, { id: `u-${id}`, author: 'user', text }],
      }));
      try {
        const body = await askHunt(huntId, text);
        const reply = body?.reply ?? body?.answer ?? body?.message ?? '(no answer)';
        setChat(prev => ({
          ...prev,
          thinking: false,
          messages: [...prev.messages, { id: `a-${id}`, author: 'agent', text: reply }],
        }));
      } catch (err) {
        setChat(prev => ({
          ...prev,
          thinking: false,
          error: err.message || 'The brain could not answer.',
        }));
      }
    },
    [huntId]
  );

  const tallySummary = useMemo(
    () =>
      TALLY_ORDER.map(({ key, label }) => `${tally[key]} ${label.toLowerCase()}`).join(', ') +
      (tally.total ? ` — ${tally.total} total` : ''),
    [tally]
  );

  if (loading) {
    return (
      <div className="chc-console">
        <div className="chc-loading" role="status">
          <Loader2 size={18} className="sg-spin" aria-hidden="true" /> Loading continuous hunt…
        </div>
      </div>
    );
  }

  if (loadError && !hunt) {
    return (
      <div className="chc-console">
        <h2 className="chc-title">Couldn't open this hunt</h2>
        <p className="chc-sub">{loadError}</p>
        <Link to="/agent" className="dm-btn dm-btn-secondary">
          <ChevronLeft size={15} aria-hidden="true" /> Back to home
        </Link>
      </div>
    );
  }

  const status = String(hunt?.status || 'starting').toLowerCase();
  const canPause = status === 'running';
  const canResume = status === 'paused';
  const ended = status === 'force_stopped';

  return (
    <div className="chc-console">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="chc-head">
        <div className="chc-head-main">
          <div className="chc-title-row">
            <Link to="/agent" className="chc-back" aria-label="Back to home">
              <ChevronLeft size={15} aria-hidden="true" />
            </Link>
            <h1 className="chc-title">Continuous hunt</h1>
            <HuntStatusPill status={status} />
          </div>
          <p className="chc-target">{hunt?.target || navTarget || huntId}</p>
          <div className="chc-meta" aria-label="Hunt machine state">
            <span className="chc-vm" role="status">
              <Server size={13} aria-hidden="true" />
              {vmStatus === 'ready' ? (
                <>VM: ready</>
              ) : (
                <>
                  VM: starting…
                  <Loader2 size={13} className="sg-spin" aria-hidden="true" />
                </>
              )}
            </span>
            {loopLabel && (
              <span className="chc-loop">
                <Radio size={13} aria-hidden="true" />
                Loop: {loopLabel}
              </span>
            )}
          </div>
          <span className="visually-hidden" role="status">
            Hunt status: {status}
            {loopLabel ? `. Loop: ${loopLabel}` : ''}. VM: {vmStatus === 'ready' ? 'ready' : 'starting'}
          </span>
        </div>

        {/* ── Control bar ──────────────────────────────────────── */}
        <div className="chc-controls" role="toolbar" aria-label="Hunt controls">
          <button
            type="button"
            className="dm-btn dm-btn-secondary chc-btn"
            disabled={busy !== null || ended}
            onClick={doReport}
            aria-label="Generate report snapshot without stopping the hunt"
          >
            {busy === 'report' ? (
              <Loader2 size={15} className="sg-spin" aria-hidden="true" />
            ) : (
              <FileText size={15} aria-hidden="true" />
            )}
            Generate report
          </button>
          {canPause && (
            <button
              type="button"
              className="dm-btn dm-btn-secondary chc-btn"
              disabled={busy !== null}
              onClick={doPause}
              aria-label="Pause the hunt"
            >
              {busy === 'pause' ? (
                <Loader2 size={15} className="sg-spin" aria-hidden="true" />
              ) : (
                <Pause size={15} aria-hidden="true" />
              )}
              Pause
            </button>
          )}
          {canResume && (
            <button
              type="button"
              className="dm-btn dm-btn-primary chc-btn"
              disabled={busy !== null}
              onClick={doResume}
              aria-label="Resume the hunt"
            >
              {busy === 'resume' ? (
                <Loader2 size={15} className="sg-spin" aria-hidden="true" />
              ) : (
                <Play size={15} aria-hidden="true" />
              )}
              Resume
            </button>
          )}
          {!ended && (
            <button
              type="button"
              className="dm-btn chc-btn chc-btn-danger"
              disabled={busy !== null}
              onClick={() => setConfirmStop(true)}
              aria-label="Force stop the hunt permanently"
            >
              <OctagonX size={15} aria-hidden="true" />
              Force stop
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="dm-notice dm-notice-red chc-notice" role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}
      {reportDone && (
        <div className="dm-notice chc-notice" role="status">
          <FileText size={16} aria-hidden="true" />
          <span>{reportDone}</span>
        </div>
      )}

      {/* ── Severity tally — always visible ────────────────────── */}
      <section className="chc-tally" aria-label="Severity tally">
        {TALLY_ORDER.map(({ key, label }) => (
          <span key={key} className={`chc-chip chc-chip-${key === 'informational' ? 'info' : key}`}>
            <span className="chc-chip-name">{label}</span>
            <span className="chc-chip-count" aria-label={`${tally[key]} ${label.toLowerCase()} findings`}>
              {tally[key]}
            </span>
          </span>
        ))}
        <span className="chc-chip chc-chip-total">
          <span className="chc-chip-name">Total</span>
          <span className="chc-chip-count">{tally.total}</span>
        </span>
        {/* Screen-reader announcement of tally changes. */}
        <span className="visually-hidden" role="status" aria-live="polite">
          Findings: {tallySummary}
        </span>
      </section>

      {/* ── Main grid ──────────────────────────────────────────── */}
      <div className="chc-grid">
        <div className="chc-main">
          {/* ── Live terminal ─────────────────────────────────── */}
          <section className="chc-panel chc-terminal" aria-label="Live terminal">
            <div className="chc-panel-head">
              <TerminalSquare size={14} aria-hidden="true" />
              <span>Live terminal</span>
              <span className="chc-spacer" aria-hidden="true" />
              {!follow && lines.length > 0 && (
                <button
                  type="button"
                  className="chc-jump"
                  onClick={jumpToLatest}
                  aria-label={unseen > 0 ? `Jump to latest output, ${unseen} new lines missed` : 'Jump to latest output'}
                >
                  <ArrowDown size={13} aria-hidden="true" /> Latest
                  {unseen > 0 && ` · ${unseen} new`}
                </button>
              )}
              <button
                type="button"
                className={`chc-follow${follow ? ' chc-follow-on' : ''}`}
                onClick={() => (follow ? (followRef.current = false, setFollow(false)) : jumpToLatest())}
                aria-pressed={follow}
                aria-label={follow ? 'Stop following new output' : 'Follow new output'}
              >
                Follow
              </button>
            </div>
            <div
              className="chc-terminal-body"
              ref={bodyRef}
              onScroll={checkFollow}
              role="log"
              aria-label="Agent activity log"
              tabIndex={0}
            >
              {lines.length === 0 && (
                <div className="chc-terminal-dim">
                  $ waiting for the agent<span className="chc-cursor" aria-hidden="true" />…
                </div>
              )}
              {lines.map((l, i) => (
                <div key={`${l.at}-${i}`} className="chc-terminal-line">
                  {l.text}
                </div>
              ))}
            </div>
          </section>

          {/* ── Think-aloud trace ─────────────────────────────── */}
          <section className="chc-panel chc-trace" aria-label="Agent reasoning">
            <div className="chc-panel-head">
              <Brain size={14} aria-hidden="true" />
              <span>Agent reasoning</span>
              <span className="chc-hint">think-aloud trace</span>
            </div>
            <div className="chc-trace-body" role="log" aria-label="Think-aloud trace">
              {traces.length === 0 && (
                <p className="chc-terminal-dim">The hacking brain narrates its thinking here.</p>
              )}
              {traces.map(t => (
                <div key={t.id} className="chc-trace-entry">
                  <span className="chc-trace-kind">{traceLabel(t.kind)}</span>
                  <p className="chc-trace-text">{t.text}</p>
                  <time className="chc-trace-at">
                    {new Date(t.at).toLocaleTimeString()}
                  </time>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* ── Mid-hunt chat ────────────────────────────────────── */}
        <aside className="chc-panel chc-chat" aria-label="Mid-hunt chat">
          <div className="chc-panel-head">
            <span className="chc-chat-title">Ask the brain</span>
          </div>
          <p className="chc-chat-context">
            Answers are grounded in the live loop
            {loopLabel ? (
              <>
                {' — '}currently <strong>{loopLabel.toLowerCase()}</strong>
              </>
            ) : null}
            {tally.total > 0 ? `, ${tally.total} findings so far` : ''}.
          </p>
          <div className="chc-chat-list">
            <MessageList messages={chat.messages} compact />
            {chat.thinking && (
              <div className="chc-chat-thinking" role="status">
                <Loader2 size={14} className="sg-spin" aria-hidden="true" /> thinking…
              </div>
            )}
            {chat.error && (
              <div className="dm-notice dm-notice-red chc-notice" role="alert">
                <span>{chat.error}</span>
              </div>
            )}
          </div>
          <div className="chc-chat-composer">
            <MessageComposer onSend={sendChat} disabled={chat.thinking || ended} />
          </div>
        </aside>
      </div>

      {/* ── Force-stop confirmation ──────────────────────────── */}
      {confirmStop && (
        <div className="chc-overlay" onClick={() => busy === null && setConfirmStop(false)}>
          <div
            className="chc-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="chc-stop-title"
            aria-describedby="chc-stop-desc"
            onClick={e => e.stopPropagation()}
            onKeyDown={e => {
              if (e.key === 'Escape') setConfirmStop(false);
            }}
          >
            <h2 id="chc-stop-title" className="chc-dialog-title">
              Force stop this hunt?
            </h2>
            <p id="chc-stop-desc" className="chc-dialog-copy">
              This is the <strong>only way to end a continuous hunt</strong>. The loop stops
              permanently and cannot be resumed. Its findings and report stay saved.
            </p>
            <div className="chc-dialog-actions">
              <button
                type="button"
                className="dm-btn dm-btn-secondary chc-btn"
                disabled={busy !== null}
                onClick={() => setConfirmStop(false)}
              >
                Keep hunting
              </button>
              <button
                type="button"
                ref={stopBtnRef}
                className="dm-btn chc-btn chc-btn-danger"
                disabled={busy !== null}
                onClick={doForceStop}
              >
                {busy === 'stop' ? (
                  <Loader2 size={15} className="sg-spin" aria-hidden="true" />
                ) : (
                  <OctagonX size={15} aria-hidden="true" />
                )}
                Force stop
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
