// Controls row + steer row — extracted from HuntCard.jsx (P6). Pause /
// Resume / Stop, Re-run, Start from scratch, Talk with AI, Agent Chat,
// Get Report, Live Terminal, Be a Brain, the brain model selector, and
// the "Steer the hunter" input.
//
// Button visibility rule (owner's spec): a live hunt shows Pause + Stop;
// a paused hunt shows Resume + Stop. Terminal hunts show nothing clickable.
import React from 'react';
import { pauseHunt, resumeHunt, stopHunt, steerHunt } from '../../lib/api';
import { toast } from '../../lib/toast';

export default function HuntControls({
  hunt,
  isScanner,
  cost,
  isPaused,
  isTerminal,
  isActive,
  busy,
  onBusy,
  runControl,
  onRerun,
  onStartFresh,
  onTalkWithAI,
  agentChatOpen,
  onToggleAgentChat,
  onGetReport,
  brainMode,
  showPiP,
  onTogglePiP,
  brainModeBusy,
  onTakeOverAsBrain,
  brain,
  brainBusy,
  onBrainSelect,
  brainLabel,
  parentBrainValue,
  steerMsg,
  setSteerMsg,
  steerSent,
  setSteerSent,
  steerBusy,
  setSteerBusy,
}) {
  function sendSteer() {
    if (!steerMsg.trim() || steerBusy) return;
    setSteerBusy(true);
    steerHunt(hunt.huntId, steerMsg.trim()).then((r) => {
      setSteerBusy(false);
      if (r.ok) { setSteerSent(true); setSteerMsg(''); }
      else toast(r.error || 'Could not send instruction', 'error');
    });
  }

  return (
    <>
      <div className="hunt-controls">
        {/* MONEY DISPLAY (owner order 3 Nov): scanner hunts show $0 and no
            spend UI — hide the burnt-money pill like the money strip. */}
        {!isScanner && cost && cost.totalUsd > 0 && (
          <span className="hunt-cost" title="Money burnt on this hunt (AWS)">
            🔥 ${cost.totalUsd.toFixed(2)}
          </span>
        )}
        {isPaused ? (
          <button
            className="hunt-pill-btn"
            disabled={busy}
            onClick={() => runControl('resume', resumeHunt, 'Hunt resumed.')}
          >
            ▶ Resume
          </button>
        ) : (
          <button
            className="hunt-pill-btn"
            disabled={busy || isTerminal}
            onClick={() => runControl('pause', pauseHunt, 'Hunt paused.')}
          >
            ❚❚ Pause
          </button>
        )}
        <button
          className="hunt-pill-btn danger"
          disabled={busy || isTerminal}
          onClick={() => runControl('stop', stopHunt, 'Hunt stopped.')}
        >
          ■ Stop
        </button>
        {isTerminal && onRerun && (
          <button
            className="hunt-pill-btn"
            disabled={busy}
            onClick={() => {
              onBusy(true);
              onRerun(hunt).finally(() => onBusy(false));
            }}
            title="Start a fresh hunt against the same target"
          >
            ↻ Re-run
          </button>
        )}
        {isPaused && onStartFresh && (
          <button
            className="hunt-pill-btn"
            disabled={busy}
            onClick={() => {
              onBusy(true);
              onStartFresh(hunt).finally(() => onBusy(false));
            }}
            title="Start a brand-new hunt against the same target — fresh memory, the paused hunt stays untouched with its checkpoint"
          >
            ↻ Start from scratch
          </button>
        )}
        {onTalkWithAI && (
          <button
            className="hunt-pill-btn talk"
            onClick={() => onTalkWithAI(hunt.huntId)}
            title="Talk with the AI about this hunt — voice conversation, works anytime"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" strokeLinecap="round" />
            </svg>
            Talk with AI
          </button>
        )}
        {isScanner && (
          <button
            className="hunt-pill-btn talk"
            onClick={onToggleAgentChat}
            aria-expanded={agentChatOpen}
            title="Chat with the scan agent about this hunt's findings — answers from the scan data, stays on topic"
          >
            💬 {agentChatOpen ? 'Hide Agent Chat' : 'Chat with Agent'}
          </button>
        )}
        {onGetReport && (
          <button
            className="hunt-pill-btn"
            onClick={() => onGetReport(hunt.huntId, isScanner ? 'scanner' : brainMode)}
            title="Generate a professional bug bounty report from this hunt's findings and memory"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Get Report
          </button>
        )}
        {isActive && (
          <button
            className="hunt-pill-btn"
            onClick={onTogglePiP}
            title="Watch live terminal — see what the AI is doing"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="2" y="4" width="20" height="14" rx="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M8 22h8M12 18v4" strokeLinecap="round" />
            </svg>
            {showPiP ? 'Hide Terminal' : 'Live Terminal'}
          </button>
        )}
        {isActive && !isScanner && (
          <button
            className="hunt-pill-btn brain-takeover"
            disabled={brainModeBusy}
            onClick={onTakeOverAsBrain}
            title={brainMode === 'parent'
              ? 'Open the Brain Console — you are already the brain'
              : 'Become the brain: pause the AI loop and drive the next actions yourself'}
          >
            {brainModeBusy ? 'Taking over…' : brainMode === 'parent' ? '🧠 Open Brain Console' : '🧠 Be a Brain'}
          </button>
        )}
        {brain && !isScanner && (
          <label className="hunt-model" title="The brain thinking for this hunt — switch mid-hunt; the new brain continues with the same state, history and memory">
            <span className="hunt-model-label">Brain:</span>
            <select
              className="hunt-model-select"
              value={brainMode === 'parent' ? parentBrainValue : brain.selected}
              disabled={brainBusy || isTerminal}
              onChange={onBrainSelect}
            >
              {/* BRAIN JSON: the parent as a selectable "model" — same
                  takeover as the gold "Be a Brain" button. While the
                  parent is the brain this option stays selected. */}
              <option value={parentBrainValue}>🧠 Be a Brain (you)</option>
              {(brain.models || []).map((m) => (
                <option key={m.id} value={m.id} disabled={!m.available} title={m.available ? m.blurb : 'Not available — the Meta API key is not configured on the backend'}>
                  {m.label}{m.available ? '' : ' (unavailable)'}
                </option>
              ))}
            </select>
            {brain.fallback && (
              <span className="hunt-model-fallback" title={`Meta (${brainLabel(brain.selected)}) is not responding — the hunt is answering on Dark Matter V1 until Meta recovers`}>
                fallback: answering on V1
              </span>
            )}
          </label>
        )}
        <span className="hunt-id">ID: {hunt.huntId}</span>
      </div>

      {isActive && (
        <div className="hunt-steer">
          <div className="hunt-steer-title">💬 Steer the hunter</div>
          <div className="hunt-steer-row">
            <input
              className="hunt-steer-input"
              value={steerMsg}
              onChange={(e) => { setSteerMsg(e.target.value); setSteerSent(false); }}
              placeholder="e.g. focus on the login page, try harder on XSS…"
              maxLength={500}
              disabled={steerBusy}
              onKeyDown={(e) => {
                if (e.key === 'Enter') sendSteer();
              }}
            />
            <button
              className="hunt-pill-btn"
              disabled={!steerMsg.trim() || steerBusy}
              onClick={sendSteer}
            >
              {steerBusy ? 'Sending…' : 'Send'}
            </button>
          </div>
          {steerSent && <div className="hunt-steer-ok">✓ The hunter will follow your instruction next round.</div>}
        </div>
      )}
    </>
  );
}
