/**
 * useSpeechRecognition — browser speech-to-text via the Web Speech API.
 *
 * Zero dependencies: recognition runs on-device / in-browser (Chrome, Edge,
 * and other Chromium browsers). No audio ever leaves the machine for our
 * servers — the browser handles transcription.
 *
 * Language defaults to the user's locale: Hindi browsers get 'hi-IN',
 * everything else gets 'en-US'. Pass an explicit `lang` to override.
 *
 * Returned state:
 *   supported  — false on browsers without the API (Firefox, older Safari)
 *   listening  — true while the mic is open
 *   interim    — live partial transcript (display while listening)
 *   error      — 'permission-denied' | 'no-speech' | null
 *   start/stop/toggle/abort
 */

import { useCallback, useEffect, useRef, useState } from 'react';

/** Pick a recognition language from the user's locale (Hindi → hi-IN). */
export function detectSpeechLang() {
  if (typeof navigator === 'undefined') return 'en-US';
  const nav = navigator.language || navigator.userLanguage || '';
  return /^hi/i.test(nav) ? 'hi-IN' : 'en-US';
}

/** Does this browser expose the Web Speech recognition API? */
export function isSpeechRecognitionSupported() {
  if (typeof window === 'undefined') return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/**
 * useSpeechRecognition — React hook for browser speech-to-text.
 * @param {object} [opts] - Options: { lang } to override the detected locale.
 * @returns {{ supported, listening, interim, error, start, stop, toggle, abort }}
 */
export function useSpeechRecognition({
  lang,
  onFinal,
  interimResults = true,
  continuous = false,
} = {}) {
  const [supported] = useState(isSpeechRecognitionSupported);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState(null);

  const recRef = useRef(null);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;
  const langRef = useRef(lang || detectSpeechLang());
  langRef.current = lang || detectSpeechLang();

  const teardown = useCallback(() => {
    const rec = recRef.current;
    recRef.current = null;
    if (rec) {
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      try {
        rec.abort();
      } catch {
        /* already stopped */
      }
    }
  }, []);

  // Always release the mic on unmount.
  useEffect(() => teardown, [teardown]);

  const start = useCallback(() => {
    if (!isSpeechRecognitionSupported() || recRef.current) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    recRef.current = rec;
    rec.lang = langRef.current;
    rec.interimResults = interimResults;
    rec.continuous = continuous;
    // Some browsers cap single utterances; keep results complete.
    rec.maxAlternatives = 1;

    rec.onresult = event => {
      let finalText = '';
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interimText += r[0].transcript;
      }
      if (interimText) setInterim(interimText);
      if (finalText.trim()) {
        setInterim('');
        onFinalRef.current?.(finalText.trim());
      }
    };

    rec.onerror = event => {
      const kind = event?.error;
      if (kind === 'not-allowed' || kind === 'service-not-allowed') {
        // Mic permission denied or blocked at browser/OS level.
        setError('permission-denied');
      } else if (kind === 'no-speech') {
        // Heard nothing — transient; keep the button usable.
        setError('no-speech');
      }
      // 'aborted' and 'network' just end the session quietly.
      setListening(false);
      recRef.current = null;
    };

    rec.onend = () => {
      setListening(false);
      setInterim('');
      recRef.current = null;
    };

    setError(null);
    try {
      rec.start();
      setListening(true);
    } catch {
      // start() throws if called twice in quick succession.
      setListening(false);
      recRef.current = null;
    }
  }, [interimResults, continuous]);

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* noop */
    }
  }, []);

  const abort = useCallback(() => {
    teardown();
    setListening(false);
    setInterim('');
  }, [teardown]);

  const toggle = useCallback(() => {
    if (recRef.current) stop();
    else start();
  }, [start, stop]);

  // A transient 'no-speech' notice clears itself so the next tap is clean.
  useEffect(() => {
    if (error !== 'no-speech') return;
    const t = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(t);
  }, [error]);

  return {
    supported,
    listening,
    interim,
    error,
    lang: langRef.current,
    start,
    stop,
    abort,
    toggle,
  };
}
