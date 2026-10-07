/**
 * AgentChat — "agent se baat karo": live chat with the hunting agent.
 *
 * A side panel for HuntView. Ask the agent what it's doing in plain
 * language (Hinglish-friendly), get answers with an emoji reaction and
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
  'Kya kar raha hai?',
  'Ab tak kya mila?',
  'Kitna time lagega?',
  'Kaunsa model use kar raha hai?'
];

const WELCOME = {
  role: 'agent',
  text: 'Namaste! Main tumhara hunting agent hoon. Mujhse kuch bhi poochho — main kya kar raha hoon, ab tak kya mila, ya aage kya plan hai.',
  reaction: '👋',
  suggestions: DEFAULT_SUGGESTIONS
};

function timeNow() {
  return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function AgentChat({ jobId = null, huntRunning = false, voiceMode = false, onVoiceStateChange, onToggleVoiceMode, onEmotion = null, onActivity = null }) {
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

  const askAgent = useCallback(async (rawText) => {
    const text = String(rawText || '').trim();
    if (!text || waitingRef.current || !jobRef.current) return null;

    const userMsg = { role: 'user', text, at: timeNow() };
    setMessages((prev) => [...prev, userMsg]);
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
      setMessages((prev) => [
        ...prev,
        {
          role: 'agent',
          text: clean,
          reaction: body?.reaction || null,
          suggestions: Array.isArray(body?.suggestions) ? body.suggestions : [],
          at: timeNow()
        }
      ]);
      return clean;
    } catch (err) {
      // Never fake a reply — say plainly that the agent couldn't be reached.
      onEmotion?.('neutral');
      const why = err?.code === 'ASK_NOT_SUPPORTED'
        ? 'Yeh backend version agent-chat support nahi karta.'
        : err?.message
          ? `Wajah: ${err.message}`
          : 'Network ya server issue lag raha hai.';
      setMessages((prev) => [
        ...prev,
        {
          role: 'agent',
          error: true,
          text: `Agent se baat nahi ho paayi. ${why} Thodi der me dobara try karo.`,
          at: timeNow()
        }
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

  const send = (rawText) => { askAgent(rawText); };

  // Hands-free voice conversation (driven by the Hunt header mic toggle):
  // transcript auto-sends, the agent's reply is spoken aloud, mic re-opens.
  const handleVoiceTranscript = useCallback(async (text) => {
    const reply = await askAgentRef.current(text);
    if (reply) {
      voiceStateCbRef.current?.('speaking');
      speakAbortRef.current = new AbortController();
      try {
        await speak(reply, { voice: 'aria', signal: speakAbortRef.current.signal });
      } catch { /* stopped mid-reply or TTS failed — text reply is on screen */ }
      finally { speakAbortRef.current = null; }
    }
  }, []);

  // Leaving voice mode silences any in-flight reply immediately.
  useEffect(() => {
    if (!voiceMode) {
      try { speakAbortRef.current?.abort(); } catch { /* noop */ }
      voiceStateCbRef.current?.('idle');
    }
  }, [voiceMode]);

  const voiceConvo = useVoiceConversation({
    active: voiceMode && !!jobId,
    onTranscript: handleVoiceTranscript,
    onStateChange: (s) => voiceStateCbRef.current?.(s),
  });

  const onSubmit = (e) => {
    e.preventDefault();
    send(input);
  };

  return (
    <section className="dm-chat" aria-label="Chat with the hunting agent">
      <header className="dm-chat-head">
        <span className="dm-chat-avatar"><Bot size={20} aria-hidden="true" /></span>
        <div className="dm-chat-head-text">
          <strong>Agent se baat karo</strong>
          <span className={`dm-chat-status${huntRunning ? ' on' : ''}`}>
            <span className="dm-live-dot" />
            {voiceMode && jobId
              ? 'Voice chat on — bolo, agent jawab dega'
              : huntRunning ? 'Hunt live — agent sun raha hai' : jobId ? 'Hunt khatam — report ready' : 'Koi hunt active nahi'}
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
          <strong>Abhi koi hunt nahi chal rahi</strong>
          <p>Home page se ek target par hunt shuru karo — phir yahan agent se live baat kar sakte ho.</p>
        </div>
      ) : (
        <>
          <div className="dm-chat-log" ref={logRef} role="log" aria-label="Agent conversation">
            {messages.map((msg, i) => (
              <div key={i} role={msg.error ? 'alert' : undefined} className={`dm-chat-msg ${msg.role}${msg.error ? ' error' : ''}`}>
                <div className="dm-chat-bubble">
                  {msg.error && <AlertTriangle size={13} style={{ verticalAlign: -2, marginRight: 6 }} />}
                  {msg.text}
                  {msg.reaction && <span className="dm-chat-reaction" aria-hidden>{msg.reaction}</span>}
                </div>
                {msg.at && <span className="dm-chat-time">{msg.at}</span>}
                {msg.role === 'agent' && !msg.error && msg.suggestions?.length > 0 && i === messages.length - 1 && !waiting && (
                  <div className="dm-chat-chips">
                    {msg.suggestions.slice(0, 4).map((s, j) => (
                      <button key={j} type="button" className="dm-chat-chip" disabled={waiting} onClick={() => send(s)}>
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
                  <span /><span /><span />
                </div>
              </div>
            )}
          </div>

          <form className="dm-chat-form" onSubmit={onSubmit}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Agent se poochho… jaise “kya kar raha hai?”"
              aria-label="Message the hunting agent"
              aria-describedby="dm-chat-hint"
              disabled={waiting}
              maxLength={2000}
            />
            <MicButton
              onFinal={(t) => setInput((prev) => (prev ? `${prev} ${t}` : t))}
              disabled={waiting || voiceMode}
              title="Voice input — speak instead of typing"
            />
            <button type="submit" className="dm-chat-send" disabled={waiting || !input.trim()} aria-label="Send message">
              {waiting ? <Loader2 size={18} className="dm-spin" /> : <Send size={18} />}
            </button>
          </form>
          {voiceMode && jobId && (
            <p className="dm-chat-voice-status" role="status" aria-live="polite">
              <span className="dm-voice-dot" aria-hidden="true" />
              {!voiceConvo.supported
                ? 'Voice input isn\u2019t supported in this browser \u2014 try Chrome or Edge'
                : voiceConvo.processing
                ? 'Agent jawab de raha hai…'
                : voiceConvo.listening
                  ? (voiceConvo.interim ? `Suna: “${voiceConvo.interim}…”` : 'Sun raha hoon — bolo')
                  : 'Voice chat on'}
            </p>
          )}
          <p className="dm-chat-hint" id="dm-chat-hint">Seedha hunting agent se connected — jawab hunt ke live state se aata hai.</p>
        </>
      )}
    </section>
  );
}
