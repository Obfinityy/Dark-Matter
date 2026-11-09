// Status line — the hunt card header row, extracted from HuntCard.jsx
// (P6). Status pill, hunt id, status text, brain-mode badges, live
// activity, elapsed timer, phase, and the terminal feed toggle.
import React from 'react';

function statusClass(status) {
  switch (status) {
    case 'running': return 'status-pill status-running';
    case 'idle':
    case 'created':
    case 'starting': return 'status-pill status-running';
    case 'paused': return 'status-pill status-paused';
    case 'out_of_credits': return 'status-pill status-paused';
    case 'done': return 'status-pill status-completed';
    case 'stopped': return 'status-pill status-stopped';
    case 'error': return 'status-pill status-failed';
    default: return 'status-pill status-paused';
  }
}

function statusLabel(status) {
  switch (status) {
    case 'running': return 'Running';
    case 'idle':
    case 'created':
    case 'starting': return 'Starting';
    case 'paused': return 'Paused';
    case 'out_of_credits': return 'Out of credits';
    case 'done': return 'Completed';
    case 'stopped': return 'Stopped';
    case 'error': return 'Failed';
    default: return status ? String(status) : 'Paused';
  }
}

function statusText(status, target) {
  switch (status) {
    case 'running': return `Hunting ${target}…`;
    case 'idle':
    case 'created':
    case 'starting': return 'Starting hunt…';
    case 'paused': return 'Hunt paused';
    case 'out_of_credits': return 'Out of credits — top up, then press Resume.';
    case 'done': return 'Hunt completed';
    case 'stopped': return 'Hunt stopped';
    case 'error': return 'Stream unavailable';
    default: return `Hunt ${status}`;
  }
}

export default function HuntStatusLine({
  status,
  huntId,
  target,
  huntBrainMode,
  brainMode,
  liveProc,
  elapsedStr,
  phase,
  hasLogs,
  showFeed,
  onToggleFeed,
  isPaused,
  isTerminal,
}) {
  return (
    <div className="hunt-statusline">
      <span className={statusClass(status)}><span className="dot" aria-hidden="true" />{statusLabel(status)}</span>
      <span className="hunt-id-badge" title={`Full hunt ID: ${huntId}`}>{huntId ? huntId.slice(0, 12) : ''}</span>
      <span className="hunt-status-text">{statusText(status, target)}</span>
      {brainMode === 'parent' && (
        <span className="brain-mode-badge" role="status" title={isPaused ? "The AI loop is paused — you are driving this hunt from the Brain Console" : "Parent-brain mode — the hunt loop is live; you supply each turn's decision from the Brain Console"}>
          🧠 You are the brain
        </span>
      )}
      {(brainMode === 'scanner' || (!brainMode && huntBrainMode === 'scanner')) && (
        <span className="brain-mode-badge" role="status" title="Infinity Autonomous — rule-based scan, no AI, $0">
          ⚡ Autonomous
        </span>
      )}
      {(brainMode === 'ai' || (huntBrainMode && huntBrainMode !== 'scanner')) && (
        <span className="brain-mode-badge" role="status" title="Infinity AI — AI agent hunts autonomously">
          🤖 AI
        </span>
      )}
      {brainMode === 'parent' && liveProc && liveProc.activity && (
        <span className="hunt-live-activity" role="status" title={liveProc.in_process ? 'A process is running right now' : 'No process running right now'}>
          <span className={liveProc.in_process ? 'hunt-live-dot live' : 'hunt-live-dot'} aria-hidden="true" />
          {liveProc.activity}
          {liveProc.in_process ? ' · in process' : ' · idle'}
        </span>
      )}
      {!isTerminal && (
        <span className="hunt-timer" title={isPaused ? "Total time elapsed (hunt paused)" : "Time since this hunt started"}>
          ⏱ {elapsedStr}
        </span>
      )}
      {phase && <span className="hunt-target-inline">{phase}</span>}
      {hasLogs && (
        <button
          className="hunt-toggle-feed"
          onClick={onToggleFeed}
          aria-expanded={showFeed}
        >
          {showFeed ? 'Hide terminal' : 'Show terminal'}
        </button>
      )}
    </div>
  );
}
