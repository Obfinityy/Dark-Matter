/**
 * LiveScreenViewer — watch the agent control the computer, live.
 *
 * Read-only: the user SEES everything (screenshots stream in, actions are
 * narrated) but CANNOT click or interfere with the agent's screen. Control
 * is limited to Pause / Resume buttons.
 *
 * When paused, the agent stops clicking/typing and asks the user to resume —
 * in the user's own language.
 *
 * IMPORTANT — LOCAL MODE ONLY:
 * This viewer shows the screen of the machine where the BACKEND runs. It only
 * makes sense when the backend is on localhost (the user's own machine) —
 * showing a remote server's screen would be meaningless to the user.
 * In Vercel/remote mode this component shows an explanatory note instead.
 *
 * TODO (future): Remote screen viewing — when the backend runs on a server,
 * implement a proper remote-desktop stream (e.g. the user's local agent
 * reporting its screen to the hosted backend, or a paired local viewer).
 * See issue: "Remote backend screen viewing not implemented".
 *
 * Props:
 *   assessmentId — the authorized assessment to watch
 *   subscribe    — (assessmentId, handlers) => unsubscribe (SSE)
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Monitor, Pause, Play, Camera } from 'lucide-react';
import { takeComputerScreenshot, pauseComputer, resumeComputer } from '../../services/api';
import { isLocalBackend } from '../../services/backendMode';
import './LiveScreenViewer.css';

const ACTION_LABELS = {
  screenshot: { label: '📸 Taking screenshot', tone: 'shot' },
  click: { label: '🖱️ Clicking', tone: 'pointer' },
  double_click: { label: '🖱️ Double-clicking', tone: 'pointer' },
  move_mouse: { label: '🖱️ Moving cursor', tone: 'pointer' },
  type: { label: '⌨️ Typing', tone: 'type' },
  press_key: { label: '⌨️ Pressing key', tone: 'type' },
  hotkey: { label: '⌨️ Pressing hotkey', tone: 'type' },
  scroll: { label: '🖱️ Scrolling', tone: 'pointer' },
  open_application: { label: '🚀 Opening app', tone: 'nav' },
  navigate: { label: '🌐 Navigating', tone: 'nav' },
  get_active_window: { label: '👁️ Checking active window', tone: 'observe' },
  get_browser_state: { label: '👁️ Checking browser', tone: 'observe' },
  sleep: { label: '⏳ Waiting', tone: 'wait' },
};

function describeAction(event) {
  const action = event.data?.action || event.action;
  if (!action) return { text: event.message || event.text || '', tone: null };
  const entry = ACTION_LABELS[action.type];
  const label = entry?.label || `⚙️ ${action.type}`;
  const detail = action.params?.text
    ? `: "${String(action.params.text).slice(0, 60)}"`
    : action.params?.url
      ? ` → ${action.params.url}`
      : action.params?.name
        ? `: ${action.params.name}`
        : action.params?.x != null
          ? ` at (${action.params.x}, ${action.params.y})`
          : '';
  return { text: `${label}${detail}`, tone: entry?.tone || null };
}

export function LiveScreenViewer({ assessmentId, subscribe, initialPaused = false }) {
  const [screenshot, setScreenshot] = useState(null);
  const [paused, setPaused] = useState(initialPaused);
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);

  // Live screen only makes sense when the backend IS the user's machine
  // (VITE_BACKEND_URL unset → localhost:4000). On a remote backend, the
  // server's screen is meaningless to the user (remote viewing comes later —
  // see TODO at top of file).
  const localBackend = isLocalBackend();

  if (!localBackend) {
    return (
      <div className="dm-screen-viewer" role="region" aria-label="Live screen viewer">
        <div className="dm-screen-head">
          <Monitor size={15} aria-hidden="true" />
          <h2 className="dm-screen-title">live screen</h2>
        </div>
        <div className="dm-screen-empty">
          🖥️ Live screen needs the <strong>local backend</strong> — remove{' '}
          <code>VITE_BACKEND_URL</code> from <code>.env</code> and run <code>npm start</code> in{' '}
          <code>backend/</code> to watch the agent on your own machine.
          <br />
          <span className="dm-screen-footnote">(Remote screen viewing comes later.)</span>
        </div>
      </div>
    );
  }

  const failCount = useRef(0);

  const fetchScreenshot = useCallback(async () => {
    if (!assessmentId || paused) return;
    // Back off: after 3 consecutive failures the endpoint is down — stop
    // hammering it and show the unavailable state until the user retries.
    if (failCount.current >= 3) return;
    setLoading(true);
    try {
      const result = await takeComputerScreenshot({ includeBase64: true });
      if (result.ok && result.base64) {
        setScreenshot(`data:image/png;base64,${result.base64}`);
        setError(null);
        failCount.current = 0;
      } else if (result.error) {
        failCount.current += 1;
        setError(
          failCount.current >= 3 ? 'unavailable' : result.error.message || 'Screenshot unavailable'
        );
      }
    } catch (e) {
      failCount.current += 1;
      setError(failCount.current >= 3 ? 'unavailable' : 'Could not reach computer control');
    } finally {
      setLoading(false);
    }
  }, [assessmentId, paused]);

  // Poll screenshots every 3s while watching (read-only stream).
  useEffect(() => {
    fetchScreenshot();
    timerRef.current = setInterval(fetchScreenshot, 3000);
    return () => clearInterval(timerRef.current);
  }, [fetchScreenshot]);

  // Listen for computer action events to narrate what the agent is doing.
  useEffect(() => {
    if (!subscribe || !assessmentId) return;
    const onEvent = event => {
      const t = event.__sseType || event.type || '';
      if (t.startsWith('computer.') || t === 'action' || t === 'observation') {
        const described = describeAction(event);
        const line = {
          id: event.id || `ca-${Date.now()}-${Math.random()}`,
          at: event.at || new Date().toISOString(),
          text: described.text,
          tone: described.tone,
        };
        setActions(prev => [...prev.slice(-49), line]);
      }
      if (t === 'computer.paused') setPaused(true);
      if (t === 'computer.resumed') setPaused(false);
    };
    const unsub = subscribe(assessmentId, { onEvent });
    return () => unsub?.();
  }, [subscribe, assessmentId]);

  const handlePause = async () => {
    try {
      await pauseComputer();
      setPaused(true);
    } catch (e) {
      setError('Could not pause computer control');
    }
  };

  const handleResume = async () => {
    try {
      await resumeComputer();
      setPaused(false);
      fetchScreenshot();
    } catch (e) {
      setError('Could not resume computer control');
    }
  };

  return (
    <div className="dm-screen-viewer" role="region" aria-label="Live screen viewer">
      <div className="dm-screen-head">
        <Monitor size={15} aria-hidden="true" />
        <h2 className="dm-screen-title">live screen</h2>
        <span className={`dm-screen-status ${paused ? 'paused' : 'live'}`}>
          {paused ? '⏸ paused' : '● live'}
        </span>
        <div className="dm-screen-controls">
          {paused ? (
            <button
              type="button"
              className="dm-btn dm-btn-primary dm-btn-sm"
              onClick={handleResume}
            >
              <Play size={13} aria-hidden="true" /> Resume control
            </button>
          ) : (
            <button type="button" className="dm-btn dm-btn-warn dm-btn-sm" onClick={handlePause}>
              <Pause size={13} aria-hidden="true" /> Pause control
            </button>
          )}
          <button
            type="button"
            className="dm-btn dm-btn-ghost dm-btn-sm"
            onClick={fetchScreenshot}
            disabled={loading}
          >
            <Camera size={13} aria-hidden="true" /> {loading ? '…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Read-only screen — pointer events disabled so the user can watch
          but never click into the agent's session. */}
      <div className="dm-screen-frame dm-screen-readonly">
        {screenshot ? (
          <img
            src={screenshot}
            alt="Agent's live screen (read-only)"
            className="dm-screen-img"
            draggable={false}
            onDragStart={e => e.preventDefault()}
          />
        ) : (
          <div className="dm-screen-empty">
            {error === 'unavailable' ? (
              <>
                🖥️ Computer control isn't running on this machine.
                <br />
                <span className="dm-screen-footnote">
                  Start the local backend with computer control enabled, then{' '}
                </span>
                <button
                  type="button"
                  className="dm-btn dm-btn-ghost dm-btn-sm lsv-retry"
                  onClick={() => {
                    failCount.current = 0;
                    setError(null);
                    fetchScreenshot();
                  }}
                >
                  Retry
                </button>
              </>
            ) : (
              error || (paused ? 'Paused — resume to keep watching' : 'Waiting for screen…')
            )}
          </div>
        )}
        {paused && (
          <div className="dm-screen-paused-overlay" role="status">
            ⏸ computer control paused
          </div>
        )}
      </div>

      <div className="dm-screen-note">
        👀 Read-only view — you can watch but not click. The agent works on its own.
      </div>

      {/* What the agent is doing right now, in plain words. */}
      <div className="dm-screen-actions" role="log" aria-label="What the agent is doing">
        <div className="dm-screen-actions-title">what the agent is doing</div>
        {actions.length === 0 ? (
          <div className="dm-screen-actions-empty">waiting for the agent to act…</div>
        ) : (
          actions
            .slice(-8)
            .reverse()
            .map(a => (
              <div key={a.id} className={`dm-screen-action-line${a.tone ? ` tone-${a.tone}` : ''}`}>
                <time className="dm-term-ts" dateTime={a.at}>
                  {new Date(a.at).toLocaleTimeString('en-GB', { hour12: false })}
                </time>
                <span>{a.text}</span>
              </div>
            ))
        )}
      </div>
    </div>
  );
}
