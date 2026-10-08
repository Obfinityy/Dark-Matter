/**
 * voice.js — Infinity Voice frontend client.
 *
 * Plays the avatar's spoken replies with real lip-sync: the Web Audio API
 * analyses the actual audio amplitude and drives the avatar's mouth.
 * Falls back to the browser's built-in speech synthesis if Infinity Voice
 * isn't installed on the backend machine.
 */

import { getApiBase } from './backendMode.js';
import { getStoredJwt } from './api.js';

/** Base URL for Infinity Voice endpoints (follows backend mode). */
export function voiceApiBase() {
  return getApiBase();
}

/** Auth headers for voice fetch calls. */
export function voiceAuthHeaders() {
  const jwt = getStoredJwt();
  return jwt ? { Authorization: `Bearer ${jwt}` } : {};
}

/**
 * Speak text through Infinity Voice (neural TTS).
 * @param {string} text
 * @param {object} opts — { voice: 'aria'|'aria2'|'kai'|'kai2', onAmplitude: (0..1) => void, signal }
 * @returns {Promise<void>} resolves when playback finishes
 */
export async function speakWithInfinityVoice(text, opts = {}) {
  const { voice = 'aria', onAmplitude = null, signal = null } = opts;
  const clean = cleanForSpeech(text);
  if (!clean) return;

  const res = await fetch(`${voiceApiBase()}/voice/speak`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...voiceAuthHeaders() },
    body: JSON.stringify({ text: clean.slice(0, 2000), voice }),
    signal,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Voice ${res.status}`);
  }
  const buf = await res.arrayBuffer();
  await playWavWithLipSync(buf, onAmplitude, signal);
}

/** Is Infinity Voice ready on the backend? */
export async function isVoiceReady() {
  try {
    const res = await fetch(`${voiceApiBase()}/voice/health`, { headers: voiceAuthHeaders() });
    const data = await res.json();
    return !!(data.ready || data.ok);
  } catch {
    return false;
  }
}

/** Available voices: [{ id, label, gender, description }] */
export async function getVoices() {
  try {
    const res = await fetch(`${voiceApiBase()}/voice/voices`, { headers: voiceAuthHeaders() });
    const data = await res.json();
    return data.voices || [];
  } catch {
    return [];
  }
}

/**
 * Strip markdown/code for natural speech. "```js..." → skipped,
 * "**bold**" → "bold", URLs → "link".
 */
export function cleanForSpeech(text) {
  return String(text || '')
    .replace(/```[\s\S]*?```/g, ' code snippet ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/g, 'link')
    .replace(/#{1,6}\s/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Play WAV bytes through an AnalyserNode; call onAmplitude with the
 * live 0..1 amplitude so the avatar's mouth moves with the real audio.
 */
export function playWavWithLipSync(wavBytes, onAmplitude, signal) {
  return new Promise((resolve, reject) => {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return reject(new Error('Web Audio not supported'));
    const ctx = new AudioCtx();

    if (signal?.aborted) {
      ctx.close();
      return reject(new DOMException('aborted', 'AbortError'));
    }

    ctx.decodeAudioData(
      wavBytes,
      audioBuf => {
        const src = ctx.createBufferSource();
        src.buffer = audioBuf;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        const data = new Uint8Array(analyser.frequencyBinCount);
        src.connect(analyser);
        analyser.connect(ctx.destination);

        let raf = 0;
        const pump = () => {
          analyser.getByteTimeDomainData(data);
          // RMS amplitude → 0..1
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / data.length);
          onAmplitude?.(Math.min(1, rms * 4));
          raf = requestAnimationFrame(pump);
        };
        pump();

        const done = () => {
          cancelAnimationFrame(raf);
          onAmplitude?.(0);
          ctx.close().catch(() => {});
          resolve();
        };
        src.onended = done;
        if (signal) {
          signal.addEventListener(
            'abort',
            () => {
              try {
                src.stop();
              } catch {
                /* ignore */
              }
              done();
              reject(new DOMException('aborted', 'AbortError'));
            },
            { once: true }
          );
        }
        src.start();
      },
      err => {
        ctx.close().catch(() => {});
        reject(err);
      }
    );
  });
}

/**
 * Browser fallback: speak with the OS voice when Infinity Voice
 * isn't available. Robotic, but always works.
 */
export function speakWithBrowser(text, opts = {}) {
  return new Promise(resolve => {
    const clean = cleanForSpeech(text);
    if (!clean || !('speechSynthesis' in window)) return resolve();
    const { onAmplitude = null, signal = null, rate = 1 } = opts;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(clean);
    utter.rate = rate;
    // Fake lip-sync: oscillate while speaking.
    let iv = null;
    utter.onstart = () => {
      iv = setInterval(() => onAmplitude?.(0.3 + Math.random() * 0.5), 120);
    };
    const stop = () => {
      if (iv) clearInterval(iv);
      onAmplitude?.(0);
      resolve();
    };
    utter.onend = stop;
    utter.onerror = stop;
    if (signal) {
      signal.addEventListener(
        'abort',
        () => {
          window.speechSynthesis.cancel();
          stop();
        },
        { once: true }
      );
    }
    window.speechSynthesis.speak(utter);
  });
}

/**
 * Smart speak: Infinity Voice when ready, browser fallback otherwise.
 */
export async function speak(text, opts = {}) {
  const { voice = 'aria', onAmplitude = null, signal = null } = opts;
  try {
    if (await isVoiceReady()) {
      await speakWithInfinityVoice(text, { voice, onAmplitude, signal });
      return 'infinity-voice';
    }
  } catch (e) {
    console.warn('[voice] Infinity Voice failed, falling back:', e.message);
  }
  await speakWithBrowser(text, { onAmplitude, signal });
  return 'browser';
}
