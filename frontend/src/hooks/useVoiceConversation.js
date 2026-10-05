/**
 * useVoiceConversation — hands-free voice chat loop.
 *
 * Drives a continuous listen → transcript → respond → listen cycle:
 *   1. While `active` and idle, the mic opens (avatar shows "listening").
 *   2. A final transcript goes to `onTranscript(text)` — the caller sends
 *      the message, fetches the reply, and SPEAKS it (awaited).
 *   3. When the handler resolves, the mic re-opens automatically.
 *
 * The caller owns the reply path (chat API + TTS); this hook owns only the
 * microphone lifecycle, so a failed send or a muted speaker never wedges
 * the loop — it just listens again.
 *
 * `onStateChange` reports 'listening' | 'thinking' | 'speaking' | 'idle'
 * so the avatar can mirror the conversation state.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSpeechRecognition } from './useSpeechRecognition';

export function useVoiceConversation({ active, lang, onTranscript, onStateChange }) {
  const [processing, setProcessing] = useState(false);
  const activeRef = useRef(active);
  activeRef.current = active;
  const transcriptRef = useRef(onTranscript);
  transcriptRef.current = onTranscript;
  const stateCbRef = useRef(onStateChange);
  stateCbRef.current = onStateChange;

  const handleFinal = useCallback(async (text) => {
    if (!activeRef.current || !text) return;
    setProcessing(true);
    stateCbRef.current?.('thinking');
    try {
      await transcriptRef.current?.(text);
    } catch {
      // A failed turn must not kill the loop — just listen again.
    } finally {
      setProcessing(false);
    }
  }, []);

  const rec = useSpeechRecognition({ lang, onFinal: handleFinal });

  // Turning voice mode off always releases the mic immediately.
  useEffect(() => {
    if (!active) {
      rec.abort();
      setProcessing(false);
      stateCbRef.current?.('idle');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Drive the loop: active + supported + idle + not processing → listen.
  useEffect(() => {
    if (!active || !rec.supported || processing || rec.listening) return;
    const t = setTimeout(() => {
      if (activeRef.current) {
        stateCbRef.current?.('listening');
        rec.start();
      }
    }, 500); // small beat so the previous reply's tail isn't re-heard
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, rec.supported, processing, rec.listening]);

  return {
    supported: rec.supported,
    listening: rec.listening,
    processing,
    interim: rec.interim,
    error: rec.error,
    /** Force-stop the loop (e.g. a Stop button). */
    stop: rec.abort,
  };
}
