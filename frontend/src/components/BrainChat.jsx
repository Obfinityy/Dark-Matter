/**
 * BrainChat — dynamic chat with a local brain during a hunt.
 *
 * The user can ask ANYTHING, ANYTIME — even while the hunt is running.
 * Replies come from the Hacking Brain (local model), generated fresh each
 * time using the conversation's memory + hunt context. Nothing pre-defined.
 *
 * Each hunt has its own chatId → its own isolated memory on the local device.
 */
import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader2, Brain } from 'lucide-react';
import { chatWithBrain, getChatMemory } from '../services/localModelApi';
import './BrainChat.css';

export function BrainChat({ huntId, target, findingsCount, currentStep }) {
  const chatId = `hunt-${huntId}`;
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);

  // Load this hunt's chat memory on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mem = await getChatMemory(chatId);
        if (!cancelled && mem?.messages?.length) {
          setMessages(
            mem.messages.map(m => ({
              role: m.role,
              content: m.content,
              timestamp: m.timestamp,
            }))
          );
        }
      } catch {
        // No memory yet — start fresh
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chatId]);

  useEffect(() => {
    // Respect reduced-motion: jump straight to the bottom instead of
    // smooth-scrolling when the user prefers less movement.
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    bottomRef.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
  }, [messages]);

  const send = async e => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setInput('');
    setError('');
    const userMsg = { role: 'user', content: text, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setSending(true);

    try {
      const res = await chatWithBrain(chatId, 'hacker', text, {
        target,
        findingsCount,
        currentStep,
      });
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: res.reply,
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      const msg = err.message?.includes('BRAIN_NOT_RUNNING')
        ? 'Hacking Brain is not running. Go to Models, download and Run it first.'
        : `Brain error: ${err.message}`;
      setError(msg);
      // Remove the user message on failure so they can retry
      setMessages(prev => prev.slice(0, -1));
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="brain-chat">
      <div className="brain-chat-head">
        <Brain size={16} aria-hidden="true" />
        <strong>Chat with Hacking Brain</strong>
        <span className="sg-small brain-chat-hint">ask anything, anytime</span>
      </div>

      <div className="brain-chat-messages" role="log" aria-label="Hacking Brain conversation">
        {messages.length === 0 && (
          <div className="brain-chat-empty sg-small">
            Ask the Hacking Brain anything about this hunt — what it's doing, what it found, what to
            try next. It answers from live hunt data + its memory.
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`brain-chat-msg brain-chat-msg-${m.role}`}>
            <div className="brain-chat-bubble">{m.content}</div>
          </div>
        ))}
        {sending && (
          <div className="brain-chat-msg brain-chat-msg-assistant">
            <div className="brain-chat-bubble" role="status">
              <Loader2 size={14} className="sg-spin" aria-hidden="true" /> thinking…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && (
        <div className="sg-alert sg-auth-error brain-chat-error" role="alert">
          {error}
        </div>
      )}

      <form className="brain-chat-input" onSubmit={send}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask the Hacking Brain anything…"
          disabled={sending}
          aria-label="Chat with Hacking Brain"
        />
        <button
          type="submit"
          className="sg-btn sg-btn-primary"
          disabled={sending || !input.trim()}
          aria-label={sending ? 'Sending message…' : 'Send message'}
        >
          {sending ? (
            <Loader2 size={15} className="sg-spin" aria-hidden="true" />
          ) : (
            <Send size={15} aria-hidden="true" />
          )}
        </button>
      </form>
    </div>
  );
}
