// Composer — ChatGPT idiom: rounded-[26px] #2f2f2f bar, "+" attach menu,
// mic (dictation), voice-mode (spoken replies), white send / ■ stop button.
import React, { useEffect, useRef, useState } from 'react';
import { stt, tts } from '../lib/api';
import { toast } from '../lib/toast';

function getVoice() {
  try {
    return localStorage.getItem('dm.voice') || 'aria';
  } catch {
    return 'aria';
  }
}

function IconPlus() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

function IconMic() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" strokeLinecap="round" />
    </svg>
  );
}

function IconWave() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4" strokeLinecap="round" />
    </svg>
  );
}

function IconArrowUp() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
      <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconStop() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

function IconVoiceCircle() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default function ChatInput({
  onSend,
  sending,
  generating,
  onStop,
  onStartHunt,
  speakerOn,
  onToggleSpeaker,
  onOpenVoice,
  editText,
}) {
  const [value, setValue] = useState('');
  // External edit request (from message edit button) fills the composer.
  useEffect(() => {
    if (editText) {
      setValue(editText);
      try { textareaRef.current && textareaRef.current.focus(); } catch {}
    }
  }, [editText]);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const audioRef = useRef(null);
  const textareaRef = useRef(null);
  const attachRef = useRef(null);

  useEffect(() => {
    return () => {
      stopTracks();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!attachOpen) return;
    function onDocClick(e) {
      if (attachRef.current && !attachRef.current.contains(e.target)) setAttachOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [attachOpen]);

  function stopTracks() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  function autoresize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }

  async function toggleRecording() {
    if (recording) {
      stopRecording();
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast('Microphone is not available in this browser.', 'error');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = handleRecorded;
      recorder.start();
      setRecording(true);
    } catch (err) {
      toast('Microphone access was denied.', 'error');
    }
  }

  function stopRecording() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    } else {
      setRecording(false);
    }
    stopTracks();
  }

  async function handleRecorded() {
    setRecording(false);
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
    chunksRef.current = [];
    if (blob.size === 0) {
      toast('No audio was captured.', 'error');
      return;
    }
    setTranscribing(true);
    const res = await stt(blob);
    setTranscribing(false);
    if (res.ok && res.data.text) {
      setValue((prev) => {
        const next = prev ? `${prev} ${res.data.text}` : res.data.text;
        requestAnimationFrame(autoresize);
        return next;
      });
      toast('Voice transcribed.', 'success');
    } else {
      toast(res.error || 'Could not transcribe the audio.', 'error');
    }
  }

  /** Speak a reply aloud. Called by the parent on new replies. */
  async function speak(text) {
    if (!speakerOn) return;
    const res = await tts(text, getVoice());
    if (!res.ok) {
      toast(res.error || 'Could not generate speech.', 'error');
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(res.data.url);
    audioRef.current = audio;
    setSpeaking(true);
    audio.onended = () => setSpeaking(false);
    audio.onerror = () => {
      setSpeaking(false);
      toast('Could not play the generated audio.', 'error');
    };
    audio.play().catch(() => {
      setSpeaking(false);
      toast('Could not play the generated audio.', 'error');
    });
  }

  function submit() {
    const text = value.trim();
    if (!text || sending || generating) return;
    setValue('');
    requestAnimationFrame(() => {
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    });
    onSend(text, speak);
  }

  const hasText = value.trim().length > 0;

  return (
    <div className="composer-wrap">
      <div className="composer">
        <div className="composer-left" ref={attachRef}>
          <button
            className="plus-btn"
            title="More actions"
            aria-label="More actions"
            aria-haspopup="menu"
            onClick={() => setAttachOpen((v) => !v)}
          >
            <IconPlus />
          </button>
          {attachOpen && (
            <div className="attach-menu" role="menu">
              <button
                role="menuitem"
                onClick={() => {
                  setAttachOpen(false);
                  onStartHunt();
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <circle cx="12" cy="12" r="4.5" />
                  <circle cx="12" cy="12" r="1" fill="currentColor" />
                </svg>
                New hunt
              </button>
            </div>
          )}
        </div>
        <textarea
          ref={textareaRef}
          placeholder="Ask anything"
          value={value}
          rows={1}
          aria-label="Message Dark Matter"
          onChange={(e) => {
            setValue(e.target.value);
            autoresize();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <div className="composer-right">
          <button
            className={`icon-btn${recording ? ' recording' : ''}`}
            title={recording ? 'Stop recording' : 'Voice input'}
            aria-label={recording ? 'Stop recording' : 'Voice input'}
            onClick={toggleRecording}
            disabled={transcribing}
          >
            <IconMic />
          </button>
          <button
            className="icon-btn"
            title="Voice conversation"
            aria-label="Voice conversation"
            onClick={onOpenVoice}
          >
            <IconVoiceCircle />
          </button>
          <button
            className="icon-btn"
            title={speakerOn ? 'Voice mode on — tap to mute spoken replies' : 'Voice mode — speak replies aloud'}
            aria-label={speakerOn ? 'Mute spoken replies' : 'Speak replies aloud'}
            aria-pressed={speakerOn}
            onClick={onToggleSpeaker}
            style={speakerOn || speaking ? { color: 'var(--dm-text)' } : undefined}
          >
            <IconWave />
          </button>
          {generating ? (
            <button className="send-btn stop" onClick={onStop} title="Stop" aria-label="Stop generating">
              <IconStop />
            </button>
          ) : (
            <button
              className={`send-btn${hasText ? ' ready' : ''}`}
              disabled={!hasText}
              onClick={submit}
              title="Send message"
              aria-label="Send message"
            >
              <IconArrowUp />
            </button>
          )}
        </div>
      </div>
      {(recording || transcribing) && (
        <div className="voice-status">
          {recording ? 'Listening… tap the mic to stop.' : 'Transcribing…'}
        </div>
      )}
      <div className="disclaimer">Dark Matter is AI. Check important info.</div>
    </div>
  );
}
