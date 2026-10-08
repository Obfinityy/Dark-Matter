/**
 * VmControlPanel — the Control mode body for the Infinity AI VM.
 *
 * - Local/Cloud mode selector (Cloud visible but disabled — "Coming soon").
 * - Runner health check with the friendly "Start Infinity VM Runner on your
 *   PC" message on failure (auto /doctor).
 * - Start / Stop / Pause / Resume for the VM session, driven through the
 *   control loop interface:
 *     createVmControlLoop({ runnerApi, brains: { hacker, vision, grounding },
 *                           sessionId, onEvent }) → { start, pause, resume, stop, ask }
 *   (frontend/src/agent/vmControlLoop.js — workstream 3 owns the real
 *   think→act→observe loop; this panel codes against the interface.)
 * - Live status line from GET /vm/status (polled while a session exists).
 * - VmScreen (noVNC) + VmTerminal (xterm.js) embedded.
 * - Mid-session chat: free text + quick questions, answered by ask().
 * - Event feed reusing the dm-feed pattern from the old Control pane.
 *
 * Brain slots: the panel passes `brains` through to the loop. The slots
 * themselves (Hacking/Vision/Grounding) are resolved by the brain wiring —
 * workstream 3's integration point. Until then the panel passes explicit
 * nulls so the real loop can fall back to its defaults.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Server, Play, Square, Pause, CirclePlay, RefreshCw, Send,
  MessageCircleQuestion, Cloud, MonitorSmartphone, Stethoscope
} from 'lucide-react';
import { VmScreen } from './VmScreen';
import { VmTerminal } from './VmTerminal';
import { createVmControlLoop } from '../../agent/vmControlLoop';
import * as runnerApi from '../../services/vmRunnerApi';
import { vmHealth, vmStatus } from '../../services/vmRunnerApi';
import { getVmEndpoint, setVmEndpoint, isVmConnectable } from '../../services/vmEndpoint';
import { LOCAL_RUNNER_BASE_URL } from '../../lib/apiBase';
import './VmControl.css';

const QUICK_QUESTIONS = [
  "What's happening now?",
  'Which vulnerabilities found so far?'
];

/** Brain slots for the loop — integration point for workstream 3. */
function resolveBrains() {
  // TODO(workstream-3): resolve the configured Hacking/Vision/Grounding brain
  // slots (browser-direct inference) here and pass them to the loop.
  return { hacker: null, vision: null, grounding: null };
}

function VmFeedRow({ ev }) {
  const type = ev.type || '';
  let cls = '';
  if (type === 'loop.error') cls = ' bad';
  else if (type === 'loop.stopped' || type === 'loop.ready' || type === 'loop.resumed') cls = ' ok';
  else if (type === 'loop.answer') cls = ' answer';
  return (
    <div className={`dm-feed-row${cls}`}>
      <span className="dm-feed-ico"><MessageCircleQuestion size={14} aria-hidden="true" /></span>
      <span>{ev.message || type}</span>
    </div>
  );
}

function formatUptime(s) {
  if (s == null) return '';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

export function VmControlPanel() {
  const [endpoint, setEndpoint] = useState(() => getVmEndpoint());
  const [customUrl, setCustomUrl] = useState(() => getVmEndpoint().customUrl || '');
  const [health, setHealth] = useState(null); // { ok, version, qemu } | { error, hint, doctor }
  const [checking, setChecking] = useState(false);
  const [phase, setPhase] = useState('idle'); // idle | starting | running | paused | stopping | stopped | error
  const [task, setTask] = useState('');
  const [vmState, setVmState] = useState(null); // /vm/status payload
  const [feed, setFeed] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLog, setChatLog] = useState([]); // [{ q, a, at }]
  const [chatBusy, setChatBusy] = useState(false);
  const loopRef = useRef(null);
  const sessionIdRef = useRef(null);
  const pollRef = useRef(null);
  const feedEndRef = useRef(null);

  const running = phase === 'running';
  const paused = phase === 'paused';
  const busy = phase === 'starting' || phase === 'stopping';
  const sessionActive = Boolean(sessionIdRef.current) && ['starting', 'running', 'paused'].includes(phase);

  const pushFeed = useCallback((ev) => {
    setFeed((prev) => [...prev.slice(-249), ev]);
  }, []);

  const handleLoopEvent = useCallback((ev) => {
    pushFeed(ev);
    const t = ev.type || '';
    if (t === 'loop.started') setPhase('starting');
    else if (t === 'loop.ready') setPhase('running');
    else if (t === 'loop.paused') setPhase('paused');
    else if (t === 'loop.resumed') setPhase('running');
    else if (t === 'loop.stopping') setPhase('stopping');
    else if (t === 'loop.stopped') { setPhase('stopped'); setVmState(null); }
    else if (t === 'loop.error') setPhase((p) => (p === 'starting' ? 'error' : p));
  }, [pushFeed]);

  useEffect(() => {
    const smooth = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    feedEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'nearest' });
  }, [feed]);

  // Best effort: stop the VM if the panel unmounts mid-session (Local mode
  // sessions stop when the user leaves — tab close stops everything).
  useEffect(() => {
    return () => {
      clearInterval(pollRef.current);
      const loop = loopRef.current;
      if (loop && ['running', 'paused', 'starting'].includes(loop.getPhase?.() || '')) {
        loop.stop().catch(() => {});
      }
      loopRef.current = null;
    };
  }, []);

  const refreshStatus = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (!sid) return;
    try {
      const st = await vmStatus(sid);
      setVmState(st);
    } catch {
      /* status poll is best-effort; errors surface in the feed via the loop */
    }
  }, []);

  useEffect(() => {
    clearInterval(pollRef.current);
    if (sessionActive) {
      refreshStatus();
      pollRef.current = setInterval(refreshStatus, 5000);
    }
    return () => clearInterval(pollRef.current);
  }, [sessionActive, refreshStatus]);

  const checkRunner = useCallback(async () => {
    setChecking(true);
    try {
      const h = await vmHealth();
      setHealth({ ok: true, version: h.version, qemu: h.qemu });
    } catch (err) {
      setHealth({
        ok: false,
        error: err.message,
        hint: err.hint || '',
        doctor: err.doctor || null
      });
    } finally {
      setChecking(false);
    }
  }, []);

  const start = async () => {
    const instruction = task.trim();
    if (!instruction || busy || running) return;
    if (!isVmConnectable()) {
      pushFeed({ type: 'loop.error', message: 'Cloud mode is coming soon — the VM only runs locally for now.', at: new Date().toISOString() });
      return;
    }
    setFeed([]);
    setChatLog([]);
    setVmState(null);
    const loop = createVmControlLoop({
      runnerApi,
      brains: resolveBrains(),
      onEvent: handleLoopEvent
    });
    loopRef.current = loop;
    sessionIdRef.current = loop.sessionId;
    try {
      await loop.start(instruction);
    } catch {
      /* the loop already emitted a loop.error event; phase updated there */
    }
  };

  const stop = async () => {
    const loop = loopRef.current;
    if (!loop) return;
    try { await loop.stop(); } catch { /* already reported */ }
  };

  const pause = () => loopRef.current?.pause();
  const resume = () => loopRef.current?.resume();

  const reset = () => {
    loopRef.current = null;
    sessionIdRef.current = null;
    setPhase('idle');
    setTask('');
    setVmState(null);
    setFeed([]);
    setChatLog([]);
    setChatInput('');
  };

  const ask = async (question) => {
    const q = (question || '').trim();
    const loop = loopRef.current;
    if (!q || !loop || chatBusy) return;
    setChatBusy(true);
    try {
      const a = await loop.ask(q);
      setChatLog((prev) => [...prev.slice(-49), { q, a, at: new Date().toISOString() }]);
    } finally {
      setChatBusy(false);
      setChatInput('');
    }
  };

  const saveCustomUrl = () => {
    const next = setVmEndpoint({ customUrl });
    setEndpoint(next);
    setCustomUrl(next.customUrl || '');
    pushFeed({ type: 'loop.status', message: `Runner endpoint set to ${next.baseUrl}.`, at: new Date().toISOString() });
  };

  const cloudProblems = Array.isArray(health?.doctor?.problems) ? health.doctor.problems : [];

  return (
    <div className="vm-panel">
      {/* ── Mode + runner ── */}
      <div className="dm-card">
        <div className="dm-row-between" style={{ marginBottom: 'var(--dm-3)' }}>
          <h3 className="dm-card-title" style={{ margin: 0 }}>
            <Server size={15} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> Infinity VM
          </h3>
          <span className="dm-badge">{endpoint.baseUrl}</span>
        </div>
        <p className="dm-card-sub">
          The agent works inside a Kali Linux sandbox VM on your own PC — never your real
          desktop, never the cloud. Watch it live below.
        </p>

        <div className="vm-mode-row" role="group" aria-label="VM mode">
          <button
            type="button"
            className={`vm-mode-btn${endpoint.mode === 'local' ? ' is-active' : ''}`}
            onClick={() => { setEndpoint(setVmEndpoint({ mode: 'local' })); }}
            aria-pressed={endpoint.mode === 'local'}
          >
            <MonitorSmartphone size={14} aria-hidden="true" /> Local
            <span className="dm-hint">free, on this PC</span>
          </button>
          <button
            type="button"
            className="vm-mode-btn is-disabled"
            disabled
            title="Cloud-hosted VM is coming soon"
            aria-disabled="true"
          >
            <Cloud size={14} aria-hidden="true" /> Cloud
            <span className="dm-badge dm-badge-gold">Coming soon</span>
          </button>
          <button
            type="button"
            className="dm-btn dm-btn-ghost dm-btn-sm"
            onClick={checkRunner}
            disabled={checking}
          >
            <Stethoscope size={13} aria-hidden="true" /> {checking ? 'Checking…' : 'Check runner'}
          </button>
        </div>

        <div className="vm-url-row">
          <label className="dm-hint" htmlFor="vm-runner-url">Runner URL (advanced)</label>
          <div className="vm-url-inputs">
            <input
              id="vm-runner-url"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder={LOCAL_RUNNER_BASE_URL}
              aria-label="Custom VM runner URL"
              spellCheck={false}
            />
            <button type="button" className="dm-btn dm-btn-ghost dm-btn-sm" onClick={saveCustomUrl}>
              Save
            </button>
          </div>
        </div>

        {health && (
          <div className={`vm-health ${health.ok ? 'is-ok' : 'is-bad'}`} role="status">
            {health.ok ? (
              <>
                <span className="dm-badge">Runner reachable{health.version ? ` — v${health.version}` : ''}</span>
                {health.qemu && (
                  <span className="dm-hint">
                    QEMU {health.qemu.found ? 'found' : 'not found'}
                    {health.qemu.accel ? ` · accel ${health.qemu.accel}` : ''}
                  </span>
                )}
              </>
            ) : (
              <>
                <div className="vm-health-err">{health.error}</div>
                {health.hint && <div className="vm-health-hint">💡 {health.hint}</div>}
                {cloudProblems.length > 0 && (
                  <ul className="vm-health-problems">
                    {cloudProblems.slice(0, 4).map((p, i) => <li key={i}>{p}</li>)}
                  </ul>
                )}
                <button type="button" className="dm-btn dm-btn-ghost dm-btn-sm" onClick={checkRunner} disabled={checking}>
                  <RefreshCw size={13} aria-hidden="true" /> Retry
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Task + lifecycle ── */}
      <div className="dm-card dm-mt-4">
        <h3 className="dm-card-title">Tell the agent what to do in the VM</h3>
        <p className="dm-card-sub">
          For example: “Scan this target for SQL injection” or “Open Firefox and check the login page”.
          The Hacking brain thinks, the VM acts, Vision sees — you watch it all live.
        </p>
        <div className="dm-composer">
          <input
            value={task}
            onChange={(e) => setTask(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') start(); }}
            placeholder="Command the VM… e.g. “Nmap-scan the authorized target”"
            aria-label="Task for the VM agent"
            disabled={running || paused || busy}
          />
          {!sessionActive && !busy && (
            <button type="button" className="dm-icon-btn dm-icon-btn-primary" onClick={start} disabled={!task.trim()} aria-label="Start the VM agent">
              <Play size={17} />
            </button>
          )}
          {running && (
            <button type="button" className="dm-icon-btn" onClick={pause} aria-label="Pause the agent" title="Pause the agent">
              <Pause size={17} />
            </button>
          )}
          {paused && (
            <button type="button" className="dm-icon-btn dm-icon-btn-primary" onClick={resume} aria-label="Resume the agent" title="Resume the agent">
              <CirclePlay size={17} />
            </button>
          )}
          {sessionActive && (
            <button type="button" className="dm-icon-btn" onClick={stop} aria-label="Stop the VM" title="Stop the VM">
              <Square size={17} />
            </button>
          )}
        </div>

        {(sessionActive || phase === 'stopped' || phase === 'error') && (
          <div className="dm-row-between dm-mt-4">
            <span className="dm-badge">
              {busy ? <RefreshCw size={12} className="dm-spin" /> : running ? <CirclePlay size={12} /> : paused ? <Pause size={12} /> : <Square size={12} />}
              {' '}{phase}
              {vmState?.state ? ` · VM ${vmState.state}` : ''}
              {vmState?.uptimeS != null ? ` · up ${formatUptime(vmState.uptimeS)}` : ''}
            </span>
            {!sessionActive && (
              <button type="button" className="dm-btn dm-btn-ghost dm-btn-sm" onClick={reset}>New task</button>
            )}
          </div>
        )}
      </div>

      {/* ── Screen + terminal ── */}
      {(sessionIdRef.current || phase !== 'idle') && (
        <div className="vm-view-grid dm-mt-4">
          <VmScreen
            sessionId={sessionActive ? sessionIdRef.current : null}
            agentRunning={running}
            canConnect={sessionActive}
          />
          <VmTerminal
            sessionId={sessionActive ? sessionIdRef.current : null}
            enabled={sessionActive}
          />
        </div>
      )}

      {/* ── Mid-session chat ── */}
      {sessionActive && (
        <div className="dm-card dm-mt-4">
          <h3 className="dm-card-title">
            <MessageCircleQuestion size={15} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> Ask the agent
          </h3>
          <p className="dm-card-sub">Mid-session questions — answered by the Hacking brain.</p>
          <div className="vm-quick-row">
            {QUICK_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                className="dm-badge dm-clickable-badge"
                onClick={() => ask(q)}
                disabled={chatBusy}
              >
                {q}
              </button>
            ))}
          </div>
          <div className="dm-composer dm-mt-4">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') ask(chatInput); }}
              placeholder="Ask what the agent is doing…"
              aria-label="Ask the agent a question"
              disabled={chatBusy}
            />
            <button
              type="button"
              className="dm-icon-btn dm-icon-btn-primary"
              onClick={() => ask(chatInput)}
              disabled={!chatInput.trim() || chatBusy}
              aria-label="Send question"
            >
              <Send size={16} />
            </button>
          </div>
          {chatLog.length > 0 && (
            <div className="vm-chat-log" role="log" aria-label="Agent Q&A">
              {chatLog.map((c, i) => (
                <div key={i} className="vm-chat-turn">
                  <div className="vm-chat-q"><strong>You:</strong> {c.q}</div>
                  <div className="vm-chat-a"><strong>Agent:</strong> {c.a}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Event feed (same dm-feed pattern as the old Control pane) ── */}
      {feed.length > 0 && (
        <div className="dm-feed dm-mt-4">
          {feed.map((ev, i) => (
            <VmFeedRow key={i} ev={ev} />
          ))}
          <div ref={feedEndRef} />
        </div>
      )}
    </div>
  );
}
