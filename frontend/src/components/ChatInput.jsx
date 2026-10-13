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

export default function ChatInput({
  onSend,
  sending,
  onStartHunt,
  speakerOn,
  onToggleSpeaker,
}) {
  const [value, setValue] = useState('');
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const audioRef = useRef(null);

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

  function stopTracks() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
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
      setValue((prev) => (prev ? `${prev} ${res.data.text}` : res.data.text));
      toast('Voice transcribed.', 'success');
    } else {
      toast(res.error || 'Could not transcribe the audio.', 'error');
    }
  }

  /** Speak a reply aloud. Exported for the parent to trigger on new replies. */
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
    if (!text || sending) return;
    setValue('');
    onSend(text, speak);
  }

  return (
    <div className="chat-input-wrap">
      <div className="chat-input-bar">
        <button
          className="icon-btn"
          title="Start a new bug-bounty hunt"
          aria-label="Start hunt"
          onClick={onStartHunt}
        >
          <span aria-hidden="true">🎯</span>
        </button>
        <textarea
          className="chat-textarea"
          placeholder="Message Infinity AI…"
          value={value}
          rows={1}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button
          className={`icon-btn${recording ? ' recording' : ''}`}
          title={recording ? 'Stop recording' : 'Voice input'}
          aria-label={recording ? 'Stop recording' : 'Voice input'}
          onClick={toggleRecording}
          disabled={transcribing}
        >
          <span aria-hidden="true">{recording ? '⏺' : '🎙'}</span>
        </button>
        <button
          className={`icon-btn${speakerOn ? ' active-toggle' : ''}`}
          title={speakerOn ? 'Mute spoken replies' : 'Speak replies aloud'}
          aria-label={speakerOn ? 'Mute spoken replies' : 'Speak replies aloud'}
          onClick={onToggleSpeaker}
        >
          <span aria-hidden="true">{speaking ? '🔊' : speakerOn ? '🔈' : '🔇'}</span>
        </button>
        <button
          className="btn btn-primary send-btn"
          disabled={!value.trim() || sending}
          onClick={submit}
          aria-label="Send message"
        >
          {sending ? '…' : '↑'}
        </button>
      </div>
      {(recording || transcribing) && (
        <div className="voice-status">
          {recording ? 'Listening… tap the mic to stop.' : 'Transcribing…'}
        </div>
      )}
      <div className="input-hint">
        Enter to send · Shift+Enter for a new line · Replies can be spoken aloud with the speaker toggle
      </div>
    </div>
  );
}
