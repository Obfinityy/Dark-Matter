// VoiceMode — ChatGPT-style full-screen voice conversation.
// Tap the orb to talk: record -> STT -> chat -> TTS -> auto-listen again.
// Closes cleanly: stops the mic and any playing audio.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { stt, tts, sendChat } from '../lib/api';
import { toast } from '../lib/toast';

function getVoice() {
  try {
    return localStorage.getItem('dm.voice') || 'aria';
  } catch {
    return 'aria';
  }
}

export default function VoiceMode({ huntId, onExchange, onClose }) {
  const [phase, setPhase] = useState('idle'); // idle | listening | thinking | speaking
  const [lastText, setLastText] = useState('');
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const audioRef = useRef(null);
  const aliveRef = useRef(true);
  const phaseRef = useRef('idle');
  const setPhaseSafe = (p) => {
    phaseRef.current = p;
    if (aliveRef.current) setPhase(p);
  };

  const stopTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      try {
        audioRef.current.pause();
      } catch { /* noop */ }
      audioRef.current = null;
    }
  }, []);

  const listen = useCallback(async () => {
    if (!aliveRef.current || phaseRef.current === 'listening') return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast('Microphone is not available in this browser.', 'error');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!aliveRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stopTracks();
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        chunksRef.current = [];
        if (!aliveRef.current) return;
        if (blob.size === 0) {
          setPhaseSafe('idle');
          return;
        }
        setPhaseSafe('thinking');
        const res = await stt(blob);
        if (!aliveRef.current) return;
        if (!res.ok || !res.data.text || !res.data.text.trim()) {
          toast(res.error || 'Did not catch that — try again.', 'error');
          setPhaseSafe('idle');
          return;
        }
        const userText = res.data.text.trim();
        setLastText(userText);
        // Ask the agent.
        const chatRes = await sendChat(userText, huntId);
        if (!aliveRef.current) return;
        const reply = (chatRes.ok && chatRes.data && chatRes.data.reply) || '';
        if (!reply) {
          toast(chatRes.error || 'The agent did not reply.', 'error');
          setPhaseSafe('idle');
          return;
        }
        setLastText(reply);
        onExchange && onExchange(userText, reply);
        // Speak it.
        const ttsRes = await tts(reply.slice(0, 1200), getVoice());
        if (!aliveRef.current) return;
        if (!ttsRes.ok) {
          toast(ttsRes.error || 'Could not generate speech.', 'error');
          setPhaseSafe('idle');
          return;
        }
        setPhaseSafe('speaking');
        const audio = new Audio(ttsRes.data.url);
        audioRef.current = audio;
        audio.onended = () => {
          if (!aliveRef.current) return;
          setPhaseSafe('idle');
          listen(); // continuous conversation
        };
        audio.onerror = () => {
          if (!aliveRef.current) return;
          toast('Could not play the generated audio.', 'error');
          setPhaseSafe('idle');
        };
        audio.play().catch(() => {
          if (!aliveRef.current) return;
          setPhaseSafe('idle');
        });
      };
      recorder.start();
      setPhaseSafe('listening');
    } catch {
      toast('Microphone access was denied.', 'error');
    }
  }, [huntId, onExchange, stopTracks]);

  const stopListening = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop(); // onstop continues the turn
    } else {
      stopTracks();
      setPhaseSafe('idle');
    }
  }, [stopTracks]);

  const toggle = useCallback(() => {
    if (phaseRef.current === 'listening') {
      stopListening();
    } else if (phaseRef.current === 'idle') {
      stopAudio();
      listen();
    } else if (phaseRef.current === 'speaking') {
      stopAudio();
      setPhaseSafe('idle');
      listen();
    }
  }, [listen, stopAudio, stopListening]);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      try {
        const r = recorderRef.current;
        if (r && r.state !== 'inactive') r.stop();
      } catch { /* noop */ }
      stopTracks();
      stopAudio();
    };
  }, [stopTracks, stopAudio]);

  const hint =
    phase === 'listening' ? 'Listening… tap to send'
    : phase === 'thinking' ? 'Thinking…'
    : phase === 'speaking' ? 'Speaking… tap to interrupt'
    : 'Tap the orb to talk';

  return (
    <div className="voice-overlay" role="dialog" aria-modal="true" aria-label="Voice conversation">
      <button className="voice-close" onClick={onClose} aria-label="Close voice mode">✕</button>
      <div className={`voice-orb voice-${phase}`} onClick={toggle} role="button" aria-label={hint} tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }}>
        <div className="voice-orb-core" />
      </div>
      <div className="voice-hint">{hint}</div>
      {lastText && <div className="voice-transcript">{lastText}</div>}
    </div>
  );
}
