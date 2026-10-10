/**
 * HuntLiveScreen — the "watch the agent work" panel for a continuous hunt.
 *
 * Truth-first behavior driven by GET /api/v1/agent/status:
 *   - Agent connected    → the real noVNC view-only stream (VmScreen). The VM
 *                          and the brains run on the user's own machine — the
 *                          browser only watches, it never hosts the hunt.
 *   - Agent NOT connected → a kind one-step card: "Start your agent" with the
 *                          existing one-click Start-Runner path (download the
 *                          ZIP, double-click Start-Runner — no terminal, no
 *                          npm). Never a technical error dump.
 *
 * Props:
 *   hunt        — hunt record (may carry sessionId / vmSessionId when the
 *                 backend attaches the VM session to the hunt)
 *   sessionId   — explicit VM session id override (optional)
 *   agent       — result of GET /api/v1/agent/status, or null while unknown
 *   agentRunning — true while the hunt loop is running (locks screen input)
 *   onRetry     — re-check agent presence (parent refetches)
 */
import React, { useState } from 'react';
import { Monitor, Play, RefreshCw, Download, Loader2 } from 'lucide-react';
import { VmScreen } from '../agent/VmScreen';
import { RUNNER_DOWNLOAD_URL, probeRunner } from '../../services/runnerDownload.js';
import './HuntLiveScreen.css';
import './HuntLiveScreen.css';

export function HuntLiveScreen({ hunt, sessionId: sessionIdProp, agent, agentRunning, onRetry }) {
  const [checking, setChecking] = useState(false);

  const connected = Boolean(agent?.connected);
  const sessionId =
    sessionIdProp || hunt?.sessionId || hunt?.vmSessionId || hunt?.raw?.sessionId || null;

  const checkAgain = async () => {
    setChecking(true);
    try {
      // A direct local probe as well — the user may have just double-clicked
      // Start-Runner and the backend heartbeat may lag a beat behind.
      await probeRunner(2500).catch(() => null);
    } finally {
      setChecking(false);
    }
    onRetry?.();
  };

  // ── Agent is up: the real screen ────────────────────────────────
  if (connected) {
    if (sessionId) {
      return (
        <div className="hls-wrap">
          <VmScreen sessionId={sessionId} agentRunning={agentRunning} canConnect={true} />
          <p className="hls-note">
            Live from your agent machine{agent?.runner ? ` (${agent.runner})` : ''} — view-only
            while the hunt runs. The VM and the brains live on your machine, not in this browser.
          </p>
        </div>
      );
    }
    return (
      <div className="hls-card" role="status">
        <span className="hls-icon" aria-hidden="true">
          <Monitor size={22} />
        </span>
        <h3 className="hls-title">Agent connected — screen coming up</h3>
        <p className="hls-copy">
          Your agent is online, but this hunt hasn't shared its live screen session yet. It usually
          appears once the sandbox VM finishes booting.
        </p>
        <button
          type="button"
          className="dm-btn dm-btn-secondary hls-btn"
          onClick={checkAgain}
          disabled={checking}
        >
          {checking ? (
            <Loader2 size={15} className="sg-spin" aria-hidden="true" />
          ) : (
            <RefreshCw size={15} aria-hidden="true" />
          )}
          Check again
        </button>
      </div>
    );
  }

  // ── Agent is down: one clear step, no tech dump ─────────────────
  return (
    <div className="hls-card" role="region" aria-label="Start your agent">
      <span className="hls-icon" aria-hidden="true">
        <Monitor size={22} />
      </span>
      <h3 className="hls-title">Start your agent to watch it work</h3>
      <p className="hls-copy">
        The Kali sandbox and the AI brains run on <strong>your own machine</strong> — not inside
        this browser. One-time setup, about a minute, no terminal:
      </p>
      <ol className="hls-steps">
        <li>Download the Infinity AI Runner below and extract the ZIP anywhere</li>
        <li>
          Double-click <strong>Start-Runner</strong> and keep its window open
        </li>
        <li>Come back here — the live screen appears on its own</li>
      </ol>
      <div className="hls-actions">
        <a className="dm-btn dm-btn-primary hls-btn" href={RUNNER_DOWNLOAD_URL}>
          <Download size={15} aria-hidden="true" /> Download Infinity AI Runner
        </a>
        <button
          type="button"
          className="dm-btn dm-btn-secondary hls-btn"
          onClick={checkAgain}
          disabled={checking}
        >
          {checking ? (
            <Loader2 size={15} className="sg-spin" aria-hidden="true" />
          ) : (
            <Play size={15} aria-hidden="true" />
          )}
          I've started it — check again
        </button>
      </div>
    </div>
  );
}
