/**
 * ttsService.js — Infinity Voice studio-quality TTS engine.
 *
 * This is the "voice studio" tier of Infinity Voice: it talks to a
 * Chatterbox-TTS-Server sidecar (OpenAI-compatible audio API, SSE
 * streaming) and falls back to Piper (tiny CPU voices, real Hindi) when
 * the sidecar is unreachable. No GPU on this machine, so the sidecar
 * wiring is scaffold + config here — the real runtime plugs in on the
 * owner's machine (see README.md in this directory).
 *
 * Public surface (intentionally compatible with voiceManager):
 *   new TtsService(opts?)            — opts override the env config
 *   service.health()                — { ok, engine, url, detail }
 *   service.listVoices()            — the 4 Infinity Voice presets
 *   service.speak(text, voiceId?)   — Promise<Buffer> (WAV audio)
 *   service.speakStream(text, voiceId?) — AsyncGenerator<Buffer> audio chunks
 *
 * Voice presets keep the existing Infinity Voice ids (aria/aria2/kai/kai2)
 * so the frontend needs no changes; they map to sidecar voice names or
 * zero-shot-cloned reference clips (config only — no weights in this repo).
 */

import { spawn } from 'node:child_process';

const DEFAULT_CONFIG = {
  /** Base URL of the Chatterbox-TTS-Server sidecar, e.g. http://127.0.0.1:8004 */
  url: process.env.INFINITY_TTS_URL || '',
  /** 'auto' (sidecar → piper fallback) | 'sidecar' | 'piper' */
  engine: (process.env.INFINITY_TTS_ENGINE || 'auto').toLowerCase(),
  timeoutMs: Number(process.env.INFINITY_TTS_TIMEOUT_MS || 60000),
  /** BCP-47-ish language hint sent to the sidecar ('en', 'hi', …) */
  language: process.env.INFINITY_TTS_LANGUAGE || 'en',
  /** Chatterbox expression controls (0..1) */
  exaggeration: Number(process.env.INFINITY_TTS_EXAGGERATION ?? 0.5),
  temperature: Number(process.env.INFINITY_TTS_TEMPERATURE ?? 0.7),
  /** Preset → sidecar voice name (predefined voices live in the server's ./voices dir) */
  femaleVoice: process.env.INFINITY_TTS_FEMALE_VOICE || 'aria',
  maleVoice: process.env.INFINITY_TTS_MALE_VOICE || 'kai',
  /** Reference clips for zero-shot cloning, uploaded once via the server UI (paths for ops docs) */
  femaleRef: process.env.INFINITY_TTS_FEMALE_REF || '',
  maleRef: process.env.INFINITY_TTS_MALE_REF || '',
  /** Piper fallback (no-GPU tier): local binary + ONNX voice models */
  piperBin: process.env.INFINITY_PIPER_BIN || 'piper',
  piperFemaleModel: process.env.INFINITY_PIPER_MODEL_FEMALE || '',
  piperMaleModel: process.env.INFINITY_PIPER_MODEL_MALE || '',
};

export const INFINITY_VOICES = [
  { id: 'aria', label: 'Aria', gender: 'female', description: 'Warm and friendly — the default avatar voice' },
  { id: 'aria2', label: 'Aria Soft', gender: 'female', description: 'Soft and calm female voice' },
  { id: 'kai', label: 'Kai', gender: 'male', description: 'Warm male voice' },
  { id: 'kai2', label: 'Kai Deep', gender: 'male', description: 'Deep, authoritative male voice' },
];

const VOICE_IDS = new Set(INFINITY_VOICES.map((v) => v.id));

/** Error thrown when no TTS engine can produce audio. Never leaks internals. */
export class TtsNotAvailableError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TtsNotAvailableError';
    this.code = 'TTS_NOT_AVAILABLE';
  }
}

/**
 * Decode one SSE-streamed audio chunk from the sidecar.
 * Chunk encoding varies between server builds (base64 `data:` payloads vs
 * raw binary frames) — base64 is tried first, then raw bytes.
 * @param {string|Buffer} chunk
 * @returns {Buffer}
 */
export function decodeAudioChunk(chunk) {
  if (Buffer.isBuffer(chunk)) return chunk;
  const text = String(chunk).trim();
  if (/^[A-Za-z0-9+/=\s]+$/.test(text) && text.length % 4 === 0 && text.length > 0) {
    try {
      const buf = Buffer.from(text.replace(/\s+/g, ''), 'base64');
      if (buf.length > 0) return buf;
    } catch { /* fall through to raw */ }
  }
  return Buffer.from(text, 'utf8');
}

export class TtsService {
  /**
   * @param {object} [opts] — any DEFAULT_CONFIG key; overrides env.
   * @param {object} [deps] — { logger } for testability.
   */
  constructor(opts = {}, deps = {}) {
    this.config = { ...DEFAULT_CONFIG, ...opts };
    this.logger = deps.logger || console;
  }

  /** The 4 Infinity Voice presets (frontend-facing ids never change). */
  listVoices() {
    return INFINITY_VOICES;
  }

  /**
   * Resolve a preset id to engine-specific voice config.
   * @param {string} voiceId
   * @returns {{ preset: string, sidecarVoice: string, ref: string, piperModel: string, gender: string }}
   */
  resolveVoice(voiceId) {
    const id = VOICE_IDS.has(voiceId) ? voiceId : 'aria';
    const meta = INFINITY_VOICES.find((v) => v.id === id);
    const female = meta.gender === 'female';
    return {
      preset: id,
      sidecarVoice: female ? this.config.femaleVoice : this.config.maleVoice,
      ref: female ? this.config.femaleRef : this.config.maleRef,
      piperModel: female ? this.config.piperFemaleModel : this.config.piperMaleModel,
      gender: meta.gender,
    };
  }

  /** Is the sidecar reachable? Never throws. */
  async sidecarHealth() {
    const { url, timeoutMs } = this.config;
    if (!url) return { ok: false, reason: 'INFINITY_TTS_URL not set' };
    try {
      const res = await fetch(`${url.replace(/\/+$/, '')}/health`, {
        signal: AbortSignal.timeout(Math.min(timeoutMs, 8000)),
      });
      if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
      const data = await res.json().catch(() => ({}));
      return { ok: true, detail: data };
    } catch (err) {
      return { ok: false, reason: err?.cause?.code || err?.message || 'unreachable' };
    }
  }

  /** Overall readiness: which engine would serve a request right now. */
  async health() {
    const sidecar = await this.sidecarHealth();
    const piperReady = this.config.engine !== 'sidecar' && Boolean(this.config.piperBin);
    return {
      ok: sidecar.ok || (this.config.engine === 'piper' && piperReady),
      engine: sidecar.ok ? 'chatterbox-sidecar' : (this.config.engine === 'piper' ? 'piper' : 'none'),
      url: this.config.url || null,
      detail: { sidecar, piperConfigured: piperReady },
    };
  }

  /**
   * Text → WAV audio buffer.
   * @param {string} text — max 2000 chars (matches the voice API contract)
   * @param {string} [voiceId] — 'aria' | 'aria2' | 'kai' | 'kai2'
   * @returns {Promise<Buffer>}
   */
  async speak(text, voiceId = 'aria') {
    const clean = String(text || '').trim().slice(0, 2000);
    if (!clean) throw new TtsNotAvailableError('Nothing to speak: empty text.');
    const voice = this.resolveVoice(voiceId);

    const wantSidecar = this.config.engine !== 'piper';
    if (wantSidecar && this.config.url) {
      try {
        return await this.speakViaSidecar(clean, voice, { stream: false });
      } catch (err) {
        this.logger.warn?.(`[infinity-tts] sidecar failed (${err.message}) — trying Piper fallback`);
        if (this.config.engine === 'sidecar') throw err;
      }
    }
    if (this.config.engine === 'sidecar') {
      throw new TtsNotAvailableError(
        'Infinity Voice sidecar is not reachable. Set INFINITY_TTS_URL to the Chatterbox-TTS-Server URL (see backend/src/voice/README.md).'
      );
    }
    return this.speakViaPiper(clean, voice);
  }

  /**
   * Text → streamed audio chunks (SSE from the sidecar).
   * Falls back to yielding one buffered chunk when streaming is unavailable.
   * @param {string} text
   * @param {string} [voiceId]
   * @returns {AsyncGenerator<Buffer>}
   */
  async *speakStream(text, voiceId = 'aria') {
    const clean = String(text || '').trim().slice(0, 2000);
    if (!clean) return;
    const voice = this.resolveVoice(voiceId);

    if (this.config.engine !== 'piper' && this.config.url) {
      try {
        yield* this.streamViaSidecar(clean, voice);
        return;
      } catch (err) {
        this.logger.warn?.(`[infinity-tts] sidecar stream failed (${err.message}) — falling back to buffered audio`);
        if (this.config.engine === 'sidecar') throw err;
      }
    }
    // Buffered fallback (Piper has no streaming mode).
    yield await this.speakViaPiper(clean, voice);
  }

  /**
   * OpenAI-compatible audio call against the sidecar.
   * POST {url}/v1/audio/speech { model, input, voice, language, response_format }
   */
  async speakViaSidecar(text, voice, { stream = false } = {}) {
    const base = this.config.url.replace(/\/+$/, '');
    const res = await fetch(`${base}/v1/audio/speech`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: AbortSignal.timeout(this.config.timeoutMs),
      body: JSON.stringify({
        model: 'chatterbox',
        input: text,
        voice: voice.sidecarVoice,
        language: this.config.language,
        response_format: 'wav',
        exaggeration: this.config.exaggeration,
        temperature: this.config.temperature,
        ...(stream ? { stream: true } : {}),
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '').then((t) => t.slice(0, 200));
      throw new Error(`sidecar ${res.status}${errText ? `: ${errText}` : ''}`);
    }
    return Buffer.from(await res.arrayBuffer());
  }

  /**
   * SSE streaming variant. Parses `data:` lines and yields audio buffers as
   * they arrive, so the avatar can start talking before synthesis finishes.
   */
  async *streamViaSidecar(text, voice) {
    const base = this.config.url.replace(/\/+$/, '');
    const res = await fetch(`${base}/v1/audio/speech`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
      signal: AbortSignal.timeout(this.config.timeoutMs),
      body: JSON.stringify({
        model: 'chatterbox',
        input: text,
        voice: voice.sidecarVoice,
        language: this.config.language,
        response_format: 'wav',
        exaggeration: this.config.exaggeration,
        temperature: this.config.temperature,
        stream: true,
      }),
    });
    if (!res.ok || !res.body) {
      throw new Error(`sidecar stream ${res.status}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let pending = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      const lines = pending.split('\n');
      pending = lines.pop() || '';
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith('data:')) continue;
        const payload = t.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        yield decodeAudioChunk(payload);
      }
    }
  }

  /**
   * Piper fallback: local `piper` binary, argv arrays only (no shell).
   * Reads text on stdin, emits WAV on stdout ('--output_file -').
   */
  speakViaPiper(text, voice) {
    const model = voice.piperModel;
    if (!model) {
      throw new TtsNotAvailableError(
        'No TTS engine available: the sidecar is unreachable and no Piper model is configured. ' +
        'Set INFINITY_TTS_URL (sidecar) or INFINITY_PIPER_MODEL_FEMALE/_MALE (Piper ONNX voice). ' +
        'See backend/src/voice/README.md.'
      );
    }
    // argv array only — never interpolated into a shell string.
    const argv = ['--model', model, '--output_file', '-'];
    return new Promise((resolve, reject) => {
      let child;
      try {
        child = spawn(this.config.piperBin, argv, { stdio: ['pipe', 'pipe', 'pipe'] });
      } catch (err) {
        return reject(new TtsNotAvailableError(`Piper binary failed to start: ${err.message}`));
      }
      const chunks = [];
      let stderr = '';
      child.stdout.on('data', (d) => chunks.push(d));
      child.stderr.on('data', (d) => { stderr += String(d).slice(0, 500); });
      child.on('error', (err) => {
        reject(new TtsNotAvailableError(`Piper not found or not executable ("${this.config.piperBin}"): ${err.message}`));
      });
      child.on('close', (code) => {
        if (code === 0 && chunks.length) resolve(Buffer.concat(chunks));
        else reject(new TtsNotAvailableError(`Piper exited with code ${code}${stderr ? `: ${stderr}` : ''}`));
      });
      child.stdin.write(text);
      child.stdin.end();
      setTimeout(() => {
        try { child.kill('SIGKILL'); } catch { /* already exited */ }
        reject(new TtsNotAvailableError('Piper timed out.'));
      }, this.config.timeoutMs).unref?.();
    });
  }
}

/** Shared singleton using env config (mirrors how voiceManager is consumed). */
export const ttsService = new TtsService();
