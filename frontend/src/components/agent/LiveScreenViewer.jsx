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
import { getBackendMode, BACKEND_MODES } from '../../services/backendMode';

const ACTION_LABELS = {
  screenshot: '📸 Taking screenshot',
  click: '🖱️ Clicking',
  double_click: '🖱️ Double-clicking',
  move_mouse: '🖱️ Moving cursor',
  type: '⌨️ Typing',
  press_key: '⌨️ Pressing key',
  hotkey: '⌨️ Pressing hotkey',
  scroll: '🖱️ Scrolling',
  open_application: '🚀 Opening app',
  navigate: '🌐 Navigating',
  get_active_window: '👁️ Checking active window',
  get_browser_state: '👁️ Checking browser',
  sleep: '⏳ Waiting'
};

function describeAction(event) {
  const action = event.data?.action || event.action;
  if (!action) return event.message || event.text || '';
  const label = ACTION_LABELS[action.type] || `⚙️ ${action.type}`;
  const detail = action.params?.text
    ? `: "${String(action.params.text).slice(0, 60)}"`
    : action.params?.url
      ? ` → ${action.params.url}`
      : action.params?.name
        ? `: ${action.params.name}`
        : action.params?.x != null
          ? ` at (${action.params.x}, ${action.params.y})`
          : '';
  return `${label}${detail}`;
}

export function LiveScreenViewer({
  assessmentId,
  subscribe,
  initialPaused = false
}) {
  const [screenshot, setScreenshot] = useState(null);
  const [paused, setPaused] = useState(initialPaused);
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);

  // Live screen only makes sense on localhost — the backend IS the user's
  // machine there. On a remote backend, the server's screen is meaningless
  // to the user (remote viewing comes later — see TODO at top of file).
  const isLocalBackend = getBackendMode() === BACKEND_MODES.LOCALHOST;

  if (!isLocalBackend) {
    return (
      <div className="dm-screen-viewer">
        <div className="dm-screen-head">
          <Monitor size={15} />
          <span className="dm-screen-title">live screen</span>
        </div>
        <div className="dm-screen-empty">
          🖥️ Live screen is available in <strong>Localhost mode</strong> — switch
          backends in Settings to watch the agent on your own machine.
          <br />
          <span style={{ fontSize: 12, color: '#64748b' }}>
            (Remote screen viewing comes later.)
          </span>
        </div>
      </div>
    );
  }

  const fetchScreenshot = useCallback(async () => {
    if (!assessmentId || paused) return;
    setLoading(true);
    try {
      const result = await takeComputerScreenshot({ includeBase64: true });
      if (result.ok && result.base64) {
        setScreenshot(`data:image/png;base64,${result.base64}`);
        setError(null);
      } else if (result.error) {
        setError(result.error.message || 'Screenshot unavailable');
      }
    } catch (e) {
      setError('Could not reach computer control');
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
    const onEvent = (event) => {
      const t = event.__sseType || event.type || '';
      if (t.startsWith('computer.') || t === 'action' || t === 'observation') {
        const line = {
          id: event.id || `ca-${Date.now()}-${Math.random()}`,
          at: event.at || new Date().toISOString(),
          text: describeAction(event)
        };
        setActions((prev) => [...prev.slice(-49), line]);
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
    <div className="dm-screen-viewer">
      <div className="dm-screen-head">
        <Monitor size={15} />
        <span className="dm-screen-title">live screen</span>
        <span className={`dm-screen-status ${paused ? 'paused' : 'live'}`}>
          {paused ? '⏸ paused' : '● live'}
        </span>
        <div className="dm-screen-controls">
          {paused ? (
            <button className="dm-btn dm-btn-primary dm-btn-sm" onClick={handleResume}>
              <Play size={13} /> Resume control
            </button>
          ) : (
            <button className="dm-btn dm-btn-warn dm-btn-sm" onClick={handlePause}>
              <Pause size={13} /> Pause control
            </button>
          )}
          <button className="dm-btn dm-btn-ghost dm-btn-sm" onClick={fetchScreenshot} disabled={loading}>
            <Camera size={13} /> {loading ? '…' : 'Refresh'}
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
            onDragStart={(e) => e.preventDefault()}
          />
        ) : (
          <div className="dm-screen-empty">
            {error || (paused ? 'Paused — resume to keep watching' : 'Waiting for screen…')}
          </div>
        )}
        {paused && <div className="dm-screen-paused-overlay">⏸ computer control paused</div>}
      </div>

      <div className="dm-screen-note">
        👀 Read-only view — you can watch but not click. The agent works on its own.
      </div>

      {/* What the agent is doing right now, in plain words. */}
      <div className="dm-screen-actions">
        <div className="dm-screen-actions-title">what the agent is doing</div>
        {actions.length === 0 ? (
          <div className="dm-screen-actions-empty">waiting for the agent to act…</div>
        ) : (
          actions.slice(-8).reverse().map((a) => (
            <div key={a.id} className="dm-screen-action-line">
              <span className="dm-term-ts">
                {new Date(a.at).toLocaleTimeString('en-GB', { hour12: false })}
              </span>
              <span>{a.text}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
