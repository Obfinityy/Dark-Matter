/**
 * VoiceInput — microphone controls for Infinity AI.
 *
 *   MicButton       — self-contained dictation button. Tap to talk, tap to
 *                     stop; the final transcript is delivered via `onFinal`
 *                     (the parent decides: fill the input, or auto-send).
 *                     Shows live interim text while listening, a clear
 *                     "mic blocked" notice when permission is denied, and a
 *                     disabled state with a tooltip where the Web Speech API
 *                     isn't available (instead of vanishing silently).
 *
 *   VoiceModeToggle — enters/exits hands-free voice conversation. Inactive:
 *                     "Voice chat"; active: "Stop". The parent wires it to
 *                     useVoiceConversation for the listen→reply→listen loop.
 *
 * Speech-to-text uses the browser's built-in Web Speech API — zero new
 * dependencies, no audio leaves the device for our servers.
 */

import React, { useEffect } from 'react';
import { Mic, MicOff, Square } from 'lucide-react';
import { useSpeechRecognition, detectSpeechLang } from '../../hooks/useSpeechRecognition';
import './VoiceInput.css';

export function MicButton({
  onFinal,
  onInterim,
  onListeningChange,
  disabled = false,
  lang,
  className = '',
  title,
}) {
  const rec = useSpeechRecognition({
    lang: lang || detectSpeechLang(),
    onFinal: (text) => onFinal?.(text),
  });

  useEffect(() => {
    onListeningChange?.(rec.listening);
  }, [rec.listening, onListeningChange]);

  useEffect(() => {
    if (rec.interim) onInterim?.(rec.interim);
  }, [rec.interim, onInterim]);

  if (!rec.supported) {
    return (
      <button
        type="button"
        className={`voice-mic-btn voice-mic-unsupported ${className}`}
        disabled
        title="Voice input isn't supported in this browser — try Chrome or Edge"
        aria-label="Voice input not supported in this browser"
      >
        <MicOff size={17} />
      </button>
    );
  }

  return (
    <span className="voice-mic-wrap">
      <button
        type="button"
        className={`voice-mic-btn${rec.listening ? ' voice-mic-listening' : ''} ${className}`}
        onClick={rec.toggle}
        title={title || (rec.listening ? 'Stop listening' : 'Voice input — speak instead of typing')}
        aria-label={rec.listening ? 'Stop voice input' : 'Start voice input'}
        aria-pressed={rec.listening}
        disabled={disabled}
      >
        {rec.listening ? <MicOff size={17} /> : <Mic size={17} />}
        {rec.listening && <span className="voice-mic-pulse" aria-hidden="true" />}
      </button>
      {rec.listening && rec.interim && (
        <span className="voice-mic-caption" role="status" aria-live="polite">
          {rec.interim}…
        </span>
      )}
      {rec.error === 'permission-denied' && (
        <span className="voice-mic-error" role="alert">
          Mic is blocked — allow microphone access in the browser, then tap again.
        </span>
      )}
      {rec.error === 'no-speech' && (
        <span className="voice-mic-caption" role="status">
          Didn't catch that — try again.
        </span>
      )}
    </span>
  );
}

export function VoiceModeToggle({ active, onToggle, disabled = false, className = '' }) {
  return (
    <button
      type="button"
      className={`voice-mode-btn${active ? ' voice-mode-active' : ''} ${className}`}
      onClick={onToggle}
      disabled={disabled}
      title={active ? 'Stop the voice conversation' : 'Talk hands-free — I listen, reply, and listen again'}
      aria-label={active ? 'Stop voice conversation' : 'Start voice conversation'}
      aria-pressed={active}
    >
      {active ? <Square size={15} /> : <Mic size={15} />}
      <span className="voice-mode-label">{active ? 'Stop' : 'Voice chat'}</span>
      {active && <span className="voice-mic-pulse" aria-hidden="true" />}
    </button>
  );
}
