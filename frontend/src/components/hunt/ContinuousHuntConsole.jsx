/**
 * ContinuousHuntConsole — the Hunt AI live page for a continuous autonomous
 * hunt (issue #298). The user pastes a target and hits Enter; the agent hunts
 * non-stop until the USER force-stops it. Force stop is the only terminal
 * action — pause/resume freeze and restore the full loop state.
 *
 * Clean by design (owner order):
 *   - hero: ONE live terminal — activity + findings + think-aloud, inline
 *   - a live timeline rendered from REAL SSE events (hunt.state_changed,
 *     think.trace, tool output, findings, vuln_tally) — what the hacking
 *     brain is actually doing right now. Never a predefined phase checklist.
 *   - a bottom-docked chat input + tap-to-talk voice button
 *   - secondary tabs: Live screen, Findings
 *
 * Live data arrives over SSE (`/hunts/:id/events`):
 *   - `activity`      → live terminal lines
 *   - `vuln_tally`    → {critical,high,medium,low,informational,total} severity chips
 *   - `think.trace`   → think-aloud trace
 *   - `hunt.*`        → lifecycle + VM boot state changes
 *   - `finding.*`     → findings
 *
 * Mid-hunt chat asks the backend with the hunt id — replies are grounded in
 * the live loop context.
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
  Monitor,
  Target,
  Cpu,
} from 'lucide-react';
import {
  getAgentStatus,
  getHuntState,
  subscribeToHuntEvents,
  pauseHunt,
  resumeHunt,
  forceStopHunt,
  reportHuntSnapshot,
  askHunt,
} from '../../services/api';
import { MessageList, MessageComposer } from './ChatDock';
import { MicButton } from '../agent/VoiceInput';
import { HuntLiveScreen } from './HuntLiveScreen';
import { probeRunner } from '../../services/runnerDownload.js';
import { usePrefersReducedMotion } from '../kinetic/Kinetic';
import './ChatDock.css';
import './ContinuousHuntConsole.css';
import './HuntLiveScreen.css';
import '../../styles/kinetic-hunt.css';

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

/** Render one SSE activity payload (or a plain string) as a terminal line.
 * Backend shape: { id, scanId, type, level, message, data: { line, ts }, timestamp }. */
function activityText(ev) {
  if (typeof ev === 'string') return ev;
  const d = ev?.data || {};
  const msg = d.line || ev?.message || d.message || d.text || d.detail;
  if (msg) return String(msg);
  return JSON.stringify(ev?.data ?? ev).slice(0, 220);
}

function activityLevel(ev) {
  const d = ev?.data || {};
  const lvl = String(d.level || ev?.level || '').toLowerCase();
  if (/(error|crit|fail)/.test(lvl)) return 'err';
  if (/(warn|alert)/.test(lvl)) return 'warn';
  return 'info';
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

/** Normalize one brain presence value from GET /api/v1/agent/status.
 * `grounding` may be the string 'vision-driven' when the grounding brain is
 * disabled and vision covers grounding — surfaced explicitly in the UI. */
function brainTone(value) {
  if (value === 'vision-driven') return 'vision-driven';
  const v = String(value ?? '').toLowerCase();
  if (value === true || ['connected', 'live', 'ready', 'on', 'enabled', 'ok'].includes(v))
    return 'on';
  return 'off';
}

function brainLabel(name, value) {
  const tone = brainTone(value);
  if (tone === 'vision-driven') return `${name}: vision-driven`;
  return `${name}: ${tone === 'on' ? 'live' : 'off'}`;
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

let entrySeq = 0;
function nextEntryId() {
  entrySeq += 1;
  return `${Date.now()}-${entrySeq}`;
}

export function ContinuousHuntConsole() {
  const { huntId } = useParams();
  const location = useLocation();
  // The tally read endpoint doesn't carry the target — it rides along in
  // navigation state from the launcher (falls back to the hunt id).
  const navTarget = location.state?.target;
  const reducedMotion = usePrefersReducedMotion();

  const [hunt, setHunt] = useState(null);
  const [rawState, setRawState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  // Unified terminal: live activity + think-aloud + findings, inline.
  const [entries, setEntries] = useState([]);
  const [follow, setFollow] = useState(true);
  const [unseen, setUnseen] = useState(0);
  // Live timeline — rendered from REAL SSE events only, newest first.
  const [timeline, setTimeline] = useState([]);
  const [currentFocus, setCurrentFocus] = useState('');
  const [findings, setFindings] = useState([]);
  const [tally, setTally] = useState(normalizeTally(null));
  // Agent presence + brains (Bug 5 / Bug 6).
  const [agent, setAgent] = useState(null); // null = unknown yet
  const [agentUnknown, setAgentUnknown] = useState(false);
  const [busy, setBusy] = useState(null); // pause | resume | report
  const [confirmStop, setConfirmStop] = useState(false);
  const [reportDone, setReportDone] = useState('');
  const [panelTab, setPanelTab] = useState('screen'); // screen | findings
  const [chat, setChat] = useState({ messages: [], thinking: false, error: '' });

  const bodyRef = useRef(null);
  const followRef = useRef(true);
  const stopBtnRef = useRef(null);
  const chatIdRef = useRef(0);

  // ── Agent presence (Bug 5 + Bug 6) ─────────────────────────────
  const refreshAgent = useCallback(async () => {
    try {
      const st = await getAgentStatus();
      setAgent(st || null);
      setAgentUnknown(!st);
    } catch {
      // Backend may predate the endpoint — fall back to a direct local
      // Runner probe before admitting we don't know.
      try {
        const r = await probeRunner(2500);
        if (r?.up) {
          setAgent({ connected: true, runner: 'local', brains: {} });
          setAgentUnknown(false);
          return;
        }
      } catch {
        /* ignore — unknown stays unknown */
      }
      setAgent(null);
      setAgentUnknown(true);
    }
  }, []);

  useEffect(() => {
    refreshAgent();
    const timer = setInterval(refreshAgent, 30000);
    return () => clearInterval(timer);
  }, [refreshAgent]);

  // ── Load initial state (refresh-safe) ────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError('');
    getHuntState(huntId)
      .then(({ hunt: h, tally: t, raw }) => {
        if (cancelled) return;
        setHunt(h);
        setRawState(raw || null);
        setTally(normalizeTally(t || h?.tally));
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

  // ── Terminal + timeline pumps ──────────────────────────────────
  const pushEntry = useCallback(entry => {
    setEntries(prev => [...prev, { ...entry, id: nextEntryId() }].slice(-400));
    if (!followRef.current) setUnseen(n => n + 1);
  }, []);

  const pushTimeline = useCallback(item => {
    setTimeline(prev =>
      [{ ...item, id: nextEntryId(), at: item.at || new Date().toISOString() }, ...prev].slice(
        0,
        80
      )
    );
  }, []);

  // ── Live SSE stream ──────────────────────────────────────────────
  // Until the stream opens, a light /tally poll keeps the console live.
  useEffect(() => {
    if (!huntId) return;
    let sseOpen = false;
    const refresh = async () => {
      if (sseOpen) return;
      try {
        const { hunt: h, tally: t, raw } = await getHuntState(huntId);
        setHunt(h);
        setRawState(raw || null);
        setTally(normalizeTally(t || h?.tally));
      } catch {
        /* keep last-known state */
      }
    };
    const pollTimer = setInterval(refresh, 10000);
    const unsubscribe = subscribeToHuntEvents(huntId, {
      onOpen: () => {
        sseOpen = true;
        clearInterval(pollTimer);
      },
      onEvent: event => {
        const type = event.__sseType || event.type || '';
        // The shared event bus wraps payloads: { id, scanId, type, level,
        // message, data: <payload>, timestamp }. Some publishers send the
        // payload flat — tolerate both shapes.
        const payload = event.data?.data ?? event.data ?? {};
        if (type === 'activity') {
          pushEntry({ kind: 'activity', level: activityLevel(event), text: activityText(event) });
          pushTimeline({ label: 'Tool output', detail: activityText(event), tone: 'dim' });
        } else if (type === 'vuln_tally') {
          const nt = normalizeTally(payload);
          setTally(nt);
          if (nt.total > 0)
            pushTimeline({
              label: 'Tally updated',
              detail: `${nt.total} findings (${nt.critical} critical, ${nt.high} high)`,
              tone: 'info',
            });
        } else if (type === 'think.trace') {
          const kind = traceKind(event);
          const text = traceText(event);
          pushEntry({ kind: 'think', label: prettyKind(kind), text });
          pushTimeline({ label: `Thinking — ${prettyKind(kind)}`, detail: text, tone: 'think' });
        } else if (type === 'hunt.state_changed') {
          const st = String(payload.state || payload.status || '');
          if (st) {
            const pretty = prettyKind(st.toLowerCase());
            setCurrentFocus(pretty);
            pushTimeline({ label: 'Agent moved to', detail: pretty, tone: 'state' });
            setHunt(prev => ({
              ...(prev || {}),
              loopState: st.toUpperCase(),
              status:
                st.toUpperCase() === 'PAUSED'
                  ? 'paused'
                  : st.toUpperCase() === 'FORCE_STOPPED'
                    ? 'force_stopped'
                    : 'running',
            }));
          }
        } else if (type === 'hunt.vm_booting') {
          pushTimeline({ label: 'Sandbox VM', detail: 'Booting the Kali sandbox…', tone: 'dim' });
        } else if (type === 'hunt.vm_ready' || type === 'hunt.started') {
          pushTimeline({
            label: type === 'hunt.vm_ready' ? 'Sandbox VM' : 'Hunt',
            detail: type === 'hunt.vm_ready' ? 'Sandbox is ready.' : 'Hunt started.',
            tone: 'info',
          });
        } else if (
          type === 'hunt.paused' ||
          type === 'hunt.resumed' ||
          type === 'hunt.force_stopped'
        ) {
          const label =
            type === 'hunt.paused' ? 'Paused' : type === 'hunt.resumed' ? 'Resumed' : 'Force stopped';
          pushTimeline({ label: 'Hunt', detail: label, tone: type === 'hunt.force_stopped' ? 'err' : 'warn' });
          setHunt(prev => ({
            ...(prev || {}),
            status:
              type === 'hunt.paused' ? 'paused' : type === 'hunt.resumed' ? 'running' : 'force_stopped',
            loopState:
              type === 'hunt.paused'
                ? 'PAUSED'
                : type === 'hunt.resumed'
                  ? prev?.loopState || 'UNDERSTANDING'
                  : 'FORCE_STOPPED',
          }));
        } else if (type === 'finding.created' || type === 'finding.updated') {
          const p = typeof payload === 'object' ? payload : {};
          const title = p.title || p.name || 'Finding recorded';
          const severity = String(p.severity || '').toLowerCase();
          pushEntry({ kind: 'finding', severity, text: title });
          pushTimeline({
            label: `Finding${severity ? ` — ${severity}` : ''}`,
            detail: title,
            tone: severity === 'critical' || severity === 'high' ? 'err' : 'warn',
          });
          if (type === 'finding.created') {
            setFindings(prev =>
              [
                {
                  id: nextEntryId(),
                  title,
                  severity: severity || 'unknown',
                  detail: p.description || p.detail || '',
                  at: new Date().toISOString(),
                },
                ...prev,
              ].slice(0, 100)
            );
          }
        }
      },
      onError: () => {},
    });
    return () => {
      clearInterval(pollTimer);
      unsubscribe?.();
    };
  }, [huntId, pushEntry, pushTimeline]);

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

  useEffect(() => {
    if (!follow) return;
    const el = bodyRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: reducedMotion ? 'auto' : 'smooth' });
  }, [entries, follow, reducedMotion]);

  // ── Controls ─────────────────────────────────────────────────────
  const doPause = useCallback(async () => {
    setBusy('pause');
    setError('');
    try {
      const body = await pauseHunt(huntId);
      const st = String(body?.state || 'PAUSED').toUpperCase();
      setHunt(prev => ({
        ...(prev || {}),
        loopState: st,
        status: 'paused',
        tick: body?.tick ?? prev?.tick,
      }));
      pushTimeline({ label: 'Hunt', detail: 'Paused', tone: 'warn' });
    } catch (err) {
      setError(err.message || 'Could not pause the hunt.');
    } finally {
      setBusy(null);
    }
  }, [huntId, pushTimeline]);

  const doResume = useCallback(async () => {
    setBusy('resume');
    setError('');
    try {
      const body = await resumeHunt(huntId);
      const st = String(body?.state || 'UNDERSTANDING').toUpperCase();
      setHunt(prev => ({
        ...(prev || {}),
        loopState: st,
        status: 'running',
        tick: body?.tick ?? prev?.tick,
      }));
      pushTimeline({ label: 'Hunt', detail: 'Resumed', tone: 'info' });
    } catch (err) {
      setError(err.message || 'Could not resume the hunt.');
    } finally {
      setBusy(null);
    }
  }, [huntId, pushTimeline]);

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
      pushTimeline({ label: 'Hunt', detail: 'Force stopped', tone: 'err' });
      setConfirmStop(false);
    } catch (err) {
      setError(err.message || 'Could not force-stop the hunt.');
    } finally {
      setBusy(null);
    }
  }, [huntId, pushTimeline]);

  // Move focus into the confirm dialog when it opens (keyboard + SR users).
  useEffect(() => {
    if (confirmStop) stopBtnRef.current?.focus();
  }, [confirmStop]);

  // ── Mid-hunt chat (grounded in the live loop context) ─────────────
  const sendChat = useCallback(
    async text => {
      const clean = String(text || '').trim();
      if (!clean) return;
      const id = ++chatIdRef.current;
      setChat(prev => ({
        ...prev,
        error: '',
        thinking: true,
        messages: [...prev.messages, { id: `u-${id}`, author: 'user', text: clean }],
      }));
      try {
        const body = await askHunt(huntId, clean);
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
          <Loader2 size={18} className="sg-spin" aria-hidden="true" /> Loading hunt…
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
  const agentRunning = status === 'running';
  const target = hunt?.target || rawState?.target || navTarget || huntId;
  const brains = agent?.brains || {};
  const agentConnected = Boolean(agent?.connected);

  return (
    <div className="chc-console">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="chc-head">
        <div className="chc-head-main">
          <div className="chc-title-row">
            <Link to="/agent" className="chc-back" aria-label="Back to home">
              <ChevronLeft size={15} aria-hidden="true" />
            </Link>
            <h1 className="chc-title">Hunt AI</h1>
            <HuntStatusPill status={status} />
          </div>
          <p className="chc-target">{target}</p>
          {currentFocus && (
            <p className="chc-focus">
              <Brain size={13} aria-hidden="true" /> Current focus: {currentFocus}
            </p>
          )}
          <span className="visually-hidden" role="status">
            Hunt status: {status}
            {currentFocus ? `. Current focus: ${currentFocus}` : ''}. Findings: {tallySummary}
          </span>
        </div>

        {/* ── Control bar ──────────────────────────────────────── */}
        <div className="chc-controls" role="toolbar" aria-label="Hunt controls">
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
          <button
            type="button"
            className="dm-btn dm-btn-secondary chc-btn"
            disabled={busy !== null || ended}
            onClick={doReport}
            aria-label="Generate report snapshot without stopping the hunt"
            title="Download a report snapshot — the hunt keeps running"
          >
            {busy === 'report' ? (
              <Loader2 size={15} className="sg-spin" aria-hidden="true" />
            ) : (
              <FileText size={15} aria-hidden="true" />
            )}
            Report
          </button>
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

      {/* ── Agent + brain presence (Bugs 5/6) ──────────────────── */}
      <section className="chc-agentstrip" aria-label="Agent and brain status">
        <span
          className={`chc-agent-chip${agentConnected ? ' chc-agent-on' : ''}${
            agentUnknown ? ' chc-agent-unknown' : ''
          }`}
          role="status"
        >
          <Cpu size={13} aria-hidden="true" />
          {agentConnected
            ? `Agent connected${agent?.runner ? ` · ${agent.runner}` : ''}`
            : agentUnknown
              ? 'Agent status unknown'
              : 'Agent offline'}
        </span>
        {agent && brains && (
          <>
            <span className={`chc-brain-chip chc-brain-${brainTone(brains.vision)}`}>
              {brainLabel('Vision', brains.vision)}
            </span>
            <span className={`chc-brain-chip chc-brain-${brainTone(brains.hacking)}`}>
              {brainLabel('Hacking', brains.hacking)}
            </span>
            <span className={`chc-brain-chip chc-brain-${brainTone(brains.grounding)}`}>
              {brainLabel('Grounding', brains.grounding)}
            </span>
          </>
        )}
      </section>

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
        <span className="visually-hidden" role="status" aria-live="polite">
          Findings: {tallySummary}
        </span>
      </section>

      {/* ── Main grid: terminal hero + live timeline ───────────── */}
      <div className="chc-grid">
        {/* ── Live terminal: activity + think-aloud + findings ─── */}
        <section className="chc-panel chc-terminal" aria-label="Live terminal">
          <div className="chc-panel-head">
            <TerminalSquare size={14} aria-hidden="true" />
            <span>Live terminal</span>
            <span className="chc-hint">activity · thinking · findings</span>
            <span className="chc-spacer" aria-hidden="true" />
            {!follow && entries.length > 0 && (
              <button
                type="button"
                className="chc-jump"
                onClick={jumpToLatest}
                aria-label={
                  unseen > 0
                    ? `Jump to latest output, ${unseen} new lines missed`
                    : 'Jump to latest output'
                }
              >
                <ArrowDown size={13} aria-hidden="true" /> Latest
                {unseen > 0 && ` · ${unseen} new`}
              </button>
            )}
            <button
              type="button"
              className={`chc-follow${follow ? ' chc-follow-on' : ''}`}
              onClick={() =>
                follow ? (followRef.current = false, setFollow(false)) : jumpToLatest()
              }
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
            {entries.length === 0 && (
              <div className="chc-terminal-dim">
                $ waiting for the agent<span className="chc-cursor" aria-hidden="true" />…
              </div>
            )}
            {entries.map(e => (
              <div
                key={e.id}
                className={`chc-terminal-line chc-line-${e.kind}${
                  e.level === 'err' ? ' chc-line-err' : e.level === 'warn' ? ' chc-line-warn' : ''
                }`}
              >
                {e.kind === 'think' && (
                  <span className="chc-line-tag">
                    <Brain size={12} aria-hidden="true" /> {e.label || 'Thinking'}
                  </span>
                )}
                {e.kind === 'finding' && (
                  <span className={`chc-line-tag chc-sev-${e.severity || 'unknown'}`}>
                    <Target size={12} aria-hidden="true" /> {e.severity || 'finding'}
                  </span>
                )}
                <span className="chc-line-text">{e.text}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Live timeline: real events, newest first (Bug 3) ── */}
        <section className="chc-panel chc-timeline" aria-label="Live timeline">
          <div className="chc-panel-head">
            <span className="chc-timeline-title">Live timeline</span>
            <span className="chc-hint">what the agent is actually doing</span>
          </div>
          <div className="chc-timeline-body" role="log" aria-label="Agent event timeline">
            {timeline.length === 0 && (
              <p className="chc-terminal-dim">
                Events from the hunt stream will appear here as they happen.
              </p>
            )}
            {timeline.map(t => (
              <div key={t.id} className={`chc-tl-entry chc-tl-${t.tone || 'dim'}`}>
                <time className="chc-tl-at">
                  {new Date(t.at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </time>
                <div className="chc-tl-main">
                  <span className="chc-tl-label">{t.label}</span>
                  {t.detail && <span className="chc-tl-detail">{t.detail}</span>}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ── Secondary tabs: live screen + findings ─────────────── */}
      <section className="chc-panel chc-tabs-panel" aria-label="Hunt panels">
        <div className="chc-panel-head chc-tabs" role="tablist" aria-label="Hunt panels">
          {[
            { id: 'screen', label: 'Live screen', icon: Monitor },
            { id: 'findings', label: `Findings${findings.length ? ` (${findings.length})` : ''}`, icon: Target },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={panelTab === id}
              className={`chc-tab${panelTab === id ? ' chc-tab-active' : ''}`}
              onClick={() => setPanelTab(id)}
            >
              <Icon size={14} aria-hidden="true" /> {label}
            </button>
          ))}
        </div>
        <div className="chc-tabpanel" role="tabpanel">
          {panelTab === 'screen' && (
            <HuntLiveScreen
              hunt={hunt}
              agent={agent}
              agentRunning={agentRunning}
              onRetry={refreshAgent}
            />
          )}
          {panelTab === 'findings' && (
            <div className="chc-findings">
              {findings.length === 0 ? (
                <p className="chc-terminal-dim">
                  No findings yet — they land here the moment the agent records one.
                </p>
              ) : (
                findings.map(f => (
                  <article key={f.id} className="chc-finding">
                    <span className={`chc-line-tag chc-sev-${f.severity}`}>
                      {f.severity}
                    </span>
                    <div className="chc-finding-main">
                      <h4 className="chc-finding-title">{f.title}</h4>
                      {f.detail && <p className="chc-finding-detail">{f.detail}</p>}
                      <time className="chc-finding-at">
                        {new Date(f.at).toLocaleTimeString()}
                      </time>
                    </div>
                  </article>
                ))
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── Bottom-docked chat + tap-to-talk ───────────────────── */}
      <section className="chc-chatdock" aria-label="Chat with the hunting brain">
        {(chat.messages.length > 0 || chat.thinking || chat.error) && (
          <div className="chc-chatdock-list" aria-label="Conversation">
            {chat.messages.length > 0 && <MessageList messages={chat.messages} compact />}
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
        )}
        <div className="chc-chatdock-row">
          <div className="chc-chatdock-composer">
            <MessageComposer onSend={sendChat} disabled={chat.thinking || ended} />
          </div>
          <MicButton
            onFinal={transcript => {
              if (transcript && transcript.trim()) sendChat(transcript.trim());
            }}
            title="Tap to talk — speak your question"
          />
        </div>
      </section>

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
