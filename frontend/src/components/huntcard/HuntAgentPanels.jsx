// Agent-chat + AI-analysis panels — extracted from HuntCard.jsx (P6).
// Shown for Autonomous (scanner) hunts only.
//
// AGENT CHAT (3 Nov 2026, owner order): text chat with the scan agent —
// scoped to this hunt's findings.
//
// AI BEHAVIOUR ANALYSIS (8 Nov 2026, owner idea): Meta AI read the
// hunt's full behaviour and proposes NEW vulnerabilities the predefined
// battery may have missed. Suggestions are LEADS — labelled
// "AI-suggested lead — unverified" — never confirmed findings, and never
// counted in the findings totals above.
import React from 'react';

export default function HuntAgentPanels({
  isScanner,
  agentChatOpen,
  agentChatMsgs,
  agentChatInput,
  onAgentChatInput,
  agentChatBusy,
  onSendAgentChat,
  aiAnalysis,
}) {
  if (!isScanner) return null;
  return (
    <>
      {/* AGENT CHAT (3 Nov 2026, owner order): text chat with the scan agent
          for Autonomous hunts — scoped to this hunt's findings. */}
      {agentChatOpen && (
        <div className="hunt-agent-chat">
          <div className="hunt-agent-chat-title">💬 Agent chat — is scan ke findings pe sawal poocho</div>
          <div className="hunt-agent-chat-feed">
            {agentChatMsgs.length === 0 && (
              <div className="hunt-agent-chat-empty">
                e.g. "kitni findings mili?", "sabse serious kaunsi hai?", "ise kaise fix karun?"
              </div>
            )}
            {agentChatMsgs.map((m, idx) => (
              <div key={idx} className={`hunt-agent-chat-line ${m.role}`}>
                <span className="hunt-agent-chat-who">{m.role === 'user' ? 'You' : 'Agent'}</span>
                <span>{m.text}</span>
              </div>
            ))}
            {agentChatBusy && <div className="hunt-agent-chat-line agent"><span className="hunt-agent-chat-who">Agent</span><span>soch raha hai…</span></div>}
          </div>
          <div className="hunt-agent-chat-row">
            <input
              className="hunt-agent-chat-input"
              value={agentChatInput}
              onChange={(e) => onAgentChatInput(e.target.value)}
              placeholder="Is scan ke baare me poocho…"
              maxLength={500}
              disabled={agentChatBusy}
              onKeyDown={(e) => { if (e.key === 'Enter') onSendAgentChat(); }}
            />
            <button
              className="hunt-pill-btn"
              disabled={!agentChatInput.trim() || agentChatBusy}
              onClick={onSendAgentChat}
            >
              {agentChatBusy ? '…' : 'Send'}
            </button>
          </div>
        </div>
      )}

      {/* AI BEHAVIOUR ANALYSIS (8 Nov 2026, owner idea): Meta AI read
          the hunt's full behaviour and proposes NEW vulnerabilities the
          predefined battery may have missed. Suggestions are LEADS —
          labelled "AI-suggested lead — unverified" — never confirmed
          findings, and never counted in the findings totals above. */}
      {aiAnalysis && (
        <div className="hunt-agent-chat">
          <div className="hunt-agent-chat-title">🤖 AI analysis — behaviour se nayi leads</div>
          {aiAnalysis.state === 'loading' && (
            <div className="hunt-agent-chat-empty">AI analysis chal rahi hai…</div>
          )}
          {aiAnalysis.state === 'ready' && aiAnalysis.suggestions.length === 0 && (
            <div className="hunt-agent-chat-empty">AI ko behaviour se koi nayi lead nahi mili.</div>
          )}
          {aiAnalysis.state === 'ready' && aiAnalysis.suggestions.length > 0 && (
            <div className="hunt-agent-chat-feed">
              {aiAnalysis.suggestions.map((s, idx) => (
                <div key={idx} className="hunt-agent-chat-line agent">
                  <span className="hunt-agent-chat-who">Lead</span>
                  <span>
                    <strong>{s.title}</strong> [{s.severity}]
                    <br />AI-suggested lead — unverified
                    {s.reasoning ? (<><br />{s.reasoning}</>) : null}
                    {s.verification ? (<><br />Verify: {s.verification}</>) : null}
                  </span>
                </div>
              ))}
            </div>
          )}
          {aiAnalysis.state === 'unavailable' && (
            <div className="hunt-agent-chat-empty">Meta AI abhi available nahi hai{aiAnalysis.error ? ` (${aiAnalysis.error})` : ''}.</div>
          )}
          {aiAnalysis.state === 'error' && (
            <div className="hunt-agent-chat-empty">{aiAnalysis.error || 'AI analysis ka jawab nahi mila.'}</div>
          )}
        </div>
      )}
    </>
  );
}
