/**
 * AgentChat — live chat with the hunting agent.
 *
 * A side panel for HuntView. Ask the agent what it's doing in plain
 * language, get answers with an emoji reaction and
 * follow-up suggestion chips.
 *
 * Backend contract: POST /api/v1/jobs/:id/ask { message } ->
 *   { reply, reaction (emoji string), suggestions[] }
 * (api.js `askJob` passes the body through; we tolerate reply/answer/message.)
 *
 * Rules:
 * - Never fake a reply. If the endpoint is unreachable or errors, show a
 *   clear error bubble — never invented agent text.
 * - Graceful empty state when there is no active hunt (jobId == null).
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Bot, Send, Loader2, MessageCircle, AlertTriangle, Square } from 'lucide-react';
import { askJob } from '../../services/api';
import { speak } from '../../services/voice';
import { MicButton } from './VoiceInput';
import { useVoiceConversation } from '../../hooks/useVoiceConversation';
import './AgentChat.polish.css';

const DEFAULT_SUGGESTIONS = [
  'What are you doing?',
  'What have you found so far?',
  'How much longer will this take?',
  'Which model are you using?',
];

const WELCOME = {
  role: 'agent',
  text: 'Hello! I am your hunting agent. Ask me anything — what I am doing, what I have found so far, or what the plan is next.',
  reaction: '👋',
  suggestions: DEFAULT_SUGGESTIONS,
};

function timeNow() {
  return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function AgentChat({
  jobId = null,
  huntRunning = false,
  voiceMode = false,
  onVoiceStateChange,
  onToggleVoiceMode,
  onEmotion = null,
  onActivity = null,
}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [waiting, setWaiting] = useState(false);
  const logRef = useRef(null);
  const jobRef = useRef(jobId);
  jobRef.current = jobId;
  const waitingRef = useRef(false);
  const voiceStateCbRef = useRef(onVoiceStateChange);
  voiceStateCbRef.current = onVoiceStateChange;

  // (Re)seed the welcome message whenever the hunt changes.
  useEffect(() => {
    if (jobId) {
      setMessages([{ ...WELCOME, at: timeNow() }]);
      setWaiting(false);
    } else {
      setMessages([]);
      setWaiting(false);
    }
    setInput('');
  }, [jobId]);

  // Auto-scroll to the latest message.
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, waiting]);

  const askAgent = useCallback(async rawText => {
    const text = String(rawText || '').trim();
    if (!text || waitingRef.current || !jobRef.current) return null;

    const userMsg = { role: 'user', text, at: timeNow() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    waitingRef.current = true;
    setWaiting(true);
    onActivity?.('thinking');

    try {
      const body = await askJob(jobRef.current, text);
      const reply = body?.reply ?? body?.answer ?? body?.message ?? '';
      if (!String(reply).trim()) throw new Error('empty');
      const clean = String(reply);
      // The backend picks one emotion per reply (see
      // backend/src/avatar/emotionPicker.js); the avatar reacts to it.
      const emotion = typeof body?.emotion === 'string' ? body.emotion : 'neutral';
      onEmotion?.(emotion);
      onActivity?.('speaking');
      setMessages(prev => [
        ...prev,
        {
          role: 'agent',
          text: clean,
          reaction: body?.reaction || null,
          suggestions: Array.isArray(body?.suggestions) ? body.suggestions : [],
          at: timeNow(),
        },
      ]);
      return clean;
    } catch (err) {
      // Never fake a reply — say plainly that the agent couldn't be reached.
      onEmotion?.('neutral');
      const why =
        err?.code === 'ASK_NOT_SUPPORTED'
          ? 'This backend version does not support agent chat.'
          : err?.message
            ? `Reason: ${err.message}`
            : 'This looks like a network or server issue.';
      setMessages(prev => [
        ...prev,
        {
          role: 'agent',
          error: true,
          text: `Could not reach the agent. ${why} Please try again shortly.`,
          at: timeNow(),
        },
      ]);
      return null;
    } finally {
      waitingRef.current = false;
      setWaiting(false);
      // Let the avatar finish its "speaking" beat, then idle.
      setTimeout(() => onActivity?.('idle'), 2600);
    }
  }, []);

  const askAgentRef = useRef(askAgent);
  askAgentRef.current = askAgent;
  const speakAbortRef = useRef(null);

  const send = rawText => {
    askAgent(rawText);
  };

  // Hands-free voice conversation (driven by the Hunt header mic toggle):
  // transcript auto-sends, the agent's reply is spoken aloud, mic re-opens.
  const handleVoiceTranscript = useCallback(async text => {
    const reply = await askAgentRef.current(text);
    if (reply) {
      voiceStateCbRef.current?.('speaking');
      speakAbortRef.current = new AbortController();
      try {
        await speak(reply, { voice: 'aria', signal: speakAbortRef.current.signal });
      } catch {
        /* stopped mid-reply or TTS failed — text reply is on screen */
      } finally {
        speakAbortRef.current = null;
      }
    }
  }, []);

  // Leaving voice mode silences any in-flight reply immediately.
  useEffect(() => {
    if (!voiceMode) {
      try {
        speakAbortRef.current?.abort();
      } catch {
        /* noop */
      }
      voiceStateCbRef.current?.('idle');
    }
  }, [voiceMode]);

  const voiceConvo = useVoiceConversation({
    active: voiceMode && !!jobId,
    onTranscript: handleVoiceTranscript,
    onStateChange: s => voiceStateCbRef.current?.(s),
  });

  const onSubmit = e => {
    e.preventDefault();
    send(input);
  };

  return (
    <section className="dm-chat" aria-label="Chat with the hunting agent">
      <header className="dm-chat-head">
        <span className="dm-chat-avatar">
          <Bot size={20} aria-hidden="true" />
        </span>
        <div className="dm-chat-head-text">
          <strong>Chat with the agent</strong>
          <span className={`dm-chat-status${huntRunning ? ' on' : ''}`}>
            <span className="dm-live-dot" />
            {voiceMode && jobId
              ? 'Voice chat on — speak and the agent will answer'
              : huntRunning
                ? 'Hunt live — the agent is listening'
                : jobId
                  ? 'Hunt finished — report ready'
                  : 'No hunt active'}
          </span>
        </div>
        {voiceMode && (
          <button
            type="button"
            className="dm-chat-voice-stop"
            onClick={() => onToggleVoiceMode?.(false)}
            title="Stop the voice conversation"
          >
            <Square size={13} /> Stop voice
          </button>
        )}
      </header>

      {!jobId ? (
        <div className="dm-chat-empty">
          <MessageCircle size={30} aria-hidden="true" />
          <strong>No hunt is running right now</strong>
          <p>
            Start a hunt on a target from the home page — then you can talk to the agent live here.
          </p>
        </div>
      ) : (
        <>
          <div className="dm-chat-log" ref={logRef} role="log" aria-label="Agent conversation">
            {messages.map((msg, i) => (
              <div
                key={i}
                role={msg.error ? 'alert' : undefined}
                className={`dm-chat-msg ${msg.role}${msg.error ? ' error' : ''}`}
              >
                <div className="dm-chat-bubble">
                  {msg.error && (
                    <AlertTriangle size={13} style={{ verticalAlign: -2, marginRight: 6 }} />
                  )}
                  {msg.text}
                  {msg.reaction && (
                    <span className="dm-chat-reaction" aria-hidden>
                      {msg.reaction}
                    </span>
                  )}
                </div>
                {msg.at && <span className="dm-chat-time">{msg.at}</span>}
                {msg.role === 'agent' &&
                  !msg.error &&
                  msg.suggestions?.length > 0 &&
                  i === messages.length - 1 &&
                  !waiting && (
                    <div className="dm-chat-chips">
                      {msg.suggestions.slice(0, 4).map((s, j) => (
                        <button
                          key={j}
                          type="button"
                          className="dm-chat-chip"
                          disabled={waiting}
                          onClick={() => send(s)}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
              </div>
            ))}
            {waiting && (
              <div className="dm-chat-msg agent">
                <div className="dm-chat-bubble dm-chat-typing" aria-label="Agent is typing">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}
          </div>

          <form className="dm-chat-form" onSubmit={onSubmit}>
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask the agent… e.g. “what are you doing?”"
              aria-label="Message the hunting agent"
              aria-describedby="dm-chat-hint"
              disabled={waiting}
              maxLength={2000}
            />
            <MicButton
              onFinal={t => setInput(prev => (prev ? `${prev} ${t}` : t))}
              disabled={waiting || voiceMode}
              title="Voice input — speak instead of typing"
            />
            <button
              type="submit"
              className="dm-chat-send"
              disabled={waiting || !input.trim()}
              aria-label="Send message"
            >
              {waiting ? <Loader2 size={18} className="dm-spin" /> : <Send size={18} />}
            </button>
          </form>
          {voiceMode && jobId && (
            <p className="dm-chat-voice-status" role="status" aria-live="polite">
              <span className="dm-voice-dot" aria-hidden="true" />
              {!voiceConvo.supported
                ? 'Voice input isn\u2019t supported in this browser \u2014 try Chrome or Edge'
                : voiceConvo.processing
                  ? 'The agent is answering…'
                  : voiceConvo.listening
                    ? voiceConvo.interim
                      ? `Heard: “${voiceConvo.interim}…”`
                      : 'Listening — go ahead'
                    : 'Voice chat on'}
            </p>
          )}
          <p className="dm-chat-hint" id="dm-chat-hint">
            Connected directly to the hunting agent — answers come from the hunt's live state.
          </p>
        </>
      )}
    </section>
  );
}
