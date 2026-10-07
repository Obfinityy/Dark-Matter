/**
 * AvatarOverlay — full-screen voice conversation with the Infinity AI avatar.
 *
 * Reusable from anywhere (Hunt view, Infinity AI, …). Tap the inline avatar
 * to open it; it shows the large avatar, live captions, a text field, a mic
 * button for voice questions, mute/unmute, and an end-conversation button.
 *
 * Closing the overlay always pauses cleanly: speech is stopped, the
 * microphone is released, and any pending ask is aborted.
 *
 * Props:
 *   open       — boolean, whether the overlay is shown
 *   onClose    — () => void
 *   onAsk      — async (question: string) => ({ reply: string, emotion?: string })
 *   gender     — 'female' | 'male'
 *   voice      — voice name passed to the speech service (e.g. 'aria' | 'kai')
 *   title      — overlay title; always Infinity AI branding (default)
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Mic, MicOff, Volume2, VolumeX, X, Send, Loader2 } from 'lucide-react';
import { Avatar } from '../fx/Avatar';
import { speak } from '../../services/voice';
import './AvatarOverlay.css';

const VALID_EMOTIONS = ['happy', 'angry', 'surprised', 'thinking', 'neutral'];

export function AvatarOverlay({
  open = false,
  onClose,
  onAsk,
  gender = 'female',
  voice = 'aria',
  title = 'Infinity AI',
}) {
  const [avatarState, setAvatarState] = useState('idle'); // idle | listening | thinking | speaking
  const [emotion, setEmotion] = useState('neutral');
  const [amplitude, setAmplitude] = useState(0);
  const [muted, setMuted] = useState(false);
  const [captions, setCaptions] = useState([]); // [{ role: 'user'|'agent', text }]
  const [interim, setInterim] = useState('');
  const [input, setInput] = useState('');
  const [supported, setSupported] = useState(false);

  const recRef = useRef(null);
  const abortRef = useRef(null);
  const timersRef = useRef([]);
  const captionBoxRef = useRef(null);
  const closeBtnRef = useRef(null);
  const stateRef = useRef(avatarState);
  stateRef.current = avatarState;

  const later = (fn, ms) => {
    const id = setTimeout(fn, ms);
    timersRef.current.push(id);
    return id;
  };

  // ── Clean pause: stop speech, mic, timers, pending asks ──────────────────
  const stopEverything = useCallback(() => {
    try { abortRef.current?.abort(); } catch { /* noop */ }
    abortRef.current = null;
    try { window.speechSynthesis?.cancel(); } catch { /* noop */ }
    try { recRef.current?.abort(); } catch { /* noop */ }
    recRef.current = null;
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setAmplitude(0);
    setInterim('');
    setAvatarState('idle');
  }, []);

  // Close (and clean up) when `open` flips to false or on unmount.
  useEffect(() => {
    if (!open) stopEverything();
    return () => stopEverything();
  }, [open, stopEverything]);

  // Speech recognition support probe.
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSupported(!!SR);
  }, []);

  // Move focus to the close button when the overlay opens.
  useEffect(() => {
    if (open) later(() => closeBtnRef.current?.focus(), 60);
  }, [open ]);

  // Escape closes the overlay.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Auto-scroll captions.
  useEffect(() => {
    const el = captionBoxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [captions, interim]);

  const pushCaption = (role, text) =>
    setCaptions((prev) => [...prev.slice(-19), { role, text }]);

  // ── Ask the agent and have the avatar deliver the answer ─────────────────
  const ask = useCallback(async (question) => {
    const q = String(question || '').trim();
    if (!q || stateRef.current === 'thinking' || stateRef.current === 'speaking') return;
    stopEverything();
    setInput('');
    setInterim('');
    pushCaption('user', q);
    setAvatarState('thinking');

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await onAsk?.(q);
      if (controller.signal.aborted) return;
      const reply = String(res?.reply || '').trim();
      const mood = VALID_EMOTIONS.includes(res?.emotion) ? res.emotion : 'neutral';
      setEmotion(mood);
      if (!reply) {
        pushCaption('agent', 'I could not reach the agent just now. Please try again.');
        setAvatarState('idle');
        return;
      }
      pushCaption('agent', reply);
      setAvatarState('speaking');
      if (!muted) {
        try {
          await speak(reply, { voice, onAmplitude: setAmplitude, signal: controller.signal });
        } catch { /* aborted or voice failed — captions already show the reply */ }
      } else {
        // Muted: animate the mouth for roughly the reply length.
        const ms = Math.min(9000, Math.max(1800, reply.length * 28));
        await new Promise((resolve, reject) => {
          const id = setTimeout(resolve, ms);
          timersRef.current.push(id);
          controller.signal.addEventListener('abort', () => { clearTimeout(id); reject(new Error('aborted')); }, { once: true });
        }).catch(() => {});
      }
    } catch {
      if (!controller.signal.aborted) {
        pushCaption('agent', 'I could not reach the agent just now. Please try again.');
      }
    } finally {
      if (!controller.signal.aborted) setAvatarState('idle');
      setAmplitude(0);
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [muted, onAsk, stopEverything, voice]);

  // ── Microphone: one-shot voice question ──────────────────────────────────
  const toggleListening = useCallback(() => {
    if (stateRef.current === 'listening') {
      try { recRef.current?.stop(); } catch { /* noop */ }
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    stopEverything();
    const rec = new SR();
    recRef.current = rec;
    rec.lang = navigator.language || 'en-US';
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e) => {
      let interimText = '';
      let finalText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += transcript;
        else interimText += transcript;
      }
      setInterim(interimText);
      if (finalText.trim()) {
        const q = finalText.trim();
        setInterim('');
        try { rec.stop(); } catch { /* noop */ }
        ask(q);
      }
    };
    rec.onend = () => {
      recRef.current = null;
      setInterim('');
      if (stateRef.current === 'listening') setAvatarState('idle');
    };
    rec.onerror = () => {
      recRef.current = null;
      setInterim('');
      if (stateRef.current === 'listening') setAvatarState('idle');
    };
    try {
      rec.start();
      setAvatarState('listening');
    } catch {
      recRef.current = null;
      setAvatarState('idle');
    }
  }, [ask, stopEverything]);

  // Muting mid-speech stops the voice immediately.
  const toggleMute = () => {
    if (!muted && stateRef.current === 'speaking') {
      try { abortRef.current?.abort(); } catch { /* noop */ }
      try { window.speechSynthesis?.cancel(); } catch { /* noop */ }
      setAvatarState('idle');
      setAmplitude(0);
    }
    setMuted((m) => !m);
  };

  if (!open) return null;

  const stateLabel = {
    idle: 'Idle', listening: 'Listening', thinking: 'Thinking', speaking: 'Speaking',
  }[avatarState];

  return (
    <div className="avo-scrim" onClick={onClose}>
      <div
        className="avo-panel"
        role="dialog"
        aria-modal="true"
        aria-label={`${title} voice conversation`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="avo-head">
          <div className="avo-title">
            <strong>{title}</strong>
            <span className={`avo-status avo-${avatarState}`} role="status">
              <span className="avo-dot" aria-hidden="true" />
              {stateLabel}
            </span>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            className="avo-icon-btn"
            onClick={onClose}
            aria-label="End conversation and close"
            title="End conversation"
          >
            <X size={20} />
          </button>
        </header>

        <div className="avo-avatar-wrap">
          <Avatar
            gender={gender}
            state={avatarState === 'thinking' ? 'thinking' : avatarState}
            emotion={emotion}
            speakAmplitude={amplitude}
            size={240}
            className="avo-avatar"
          />
        </div>

        <div className="avo-captions" ref={captionBoxRef} role="log" aria-label="Conversation captions" aria-live="polite">
          {captions.length === 0 && !interim && (
            <p className="avo-hint">
              {supported
                ? 'Tap the microphone and talk, or type a question below.'
                : 'Type a question below — voice input is not supported in this browser.'}
            </p>
          )}
          {captions.map((c, i) => (
            <p key={i} className={`avo-line avo-${c.role}`}>
              <span className="avo-speaker">{c.role === 'user' ? 'You' : title}</span>
              {c.text}
            </p>
          ))}
          {interim && <p className="avo-line avo-user avo-interim"><span className="avo-speaker">You</span>{interim}…</p>}
          {avatarState === 'thinking' && (
            <p className="avo-line avo-agent avo-typing" aria-label={`${title} is thinking`}>
              <span /><span /><span />
            </p>
          )}
        </div>

        <form
          className="avo-input-row"
          onSubmit={(e) => { e.preventDefault(); ask(input); }}
        >
          {supported && (
            <button
              type="button"
              className={`avo-icon-btn avo-mic${avatarState === 'listening' ? ' on' : ''}`}
              onClick={toggleListening}
              aria-label={avatarState === 'listening' ? 'Stop listening' : 'Ask with your voice'}
              title={avatarState === 'listening' ? 'Stop listening' : 'Ask with your voice'}
              disabled={avatarState === 'thinking' || avatarState === 'speaking'}
            >
              {avatarState === 'listening' ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
          )}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question…"
            aria-label="Type a question"
            maxLength={2000}
          />
          <button
            type="submit"
            className="avo-icon-btn avo-send"
            disabled={!input.trim() || avatarState === 'thinking' || avatarState === 'speaking'}
            aria-label="Send question"
            title="Send"
          >
            {avatarState === 'thinking' ? <Loader2 size={20} className="avo-spin" /> : <Send size={20} />}
          </button>
          <button
            type="button"
            className={`avo-icon-btn${muted ? ' off' : ''}`}
            onClick={toggleMute}
            aria-label={muted ? 'Unmute avatar voice' : 'Mute avatar voice'}
            title={muted ? 'Unmute voice' : 'Mute voice'}
            aria-pressed={muted}
          >
            {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
        </form>

        <button type="button" className="avo-end" onClick={onClose}>
          End conversation
        </button>
      </div>
    </div>
  );
}
