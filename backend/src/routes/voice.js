// Voice proxy — the backend is a thin forwarder to the voice service
// (default http://localhost:8001, override with VOICE_URL).
//
//   POST /api/v1/voice/stt          multipart/form-data {audio} -> {text, ...}
//   POST /api/v1/voice/tts          {text, voice?} -> audio stream
//
// The voice service owns model loading (Whisper/Piper). If it is unreachable,
// this returns 502 with a clear error — never hangs, never fakes audio.

import { Router } from 'express';
import multer from 'multer';
import { config } from '../config.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const VOICE_TIMEOUT_MS = parseInt(process.env.VOICE_TIMEOUT_MS || '30000', 10);

async function proxyToVoice(path, { method = 'POST', body, contentType } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VOICE_TIMEOUT_MS);
  try {
    const headers = {};
    if (contentType) headers['Content-Type'] = contentType;
    const res = await fetch(`${config.voiceUrl}${path}`, {
      method,
      headers,
      body,
      signal: controller.signal,
    });
    return res;
  } catch (err) {
    const reason = err && err.name === 'AbortError' ? `timed out after ${VOICE_TIMEOUT_MS}ms` : String((err && err.message) || err);
    const e = new Error(`Voice service unreachable at ${config.voiceUrl} (${reason})`);
    e.status = 502;
    e.code = 'voice_unreachable';
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

router.post('/stt', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      ok: false,
      error: 'missing_audio',
      message: 'Send multipart/form-data with an "audio" file field.',
    });
  }
  try {
    const form = new FormData();
    form.append(
      'audio',
      new Blob([req.file.buffer], { type: req.file.mimetype || 'audio/wav' }),
      req.file.originalname || 'audio.wav'
    );
    if (req.body && req.body.language) form.append('language', req.body.language);
    const upstream = await proxyToVoice('/stt', { body: form });
    const text = await upstream.text();
    res.status(upstream.status);
    const ct = upstream.headers.get('content-type');
    if (ct) res.setHeader('content-type', ct);
    res.send(text);
  } catch (err) {
    res.status(err.status || 500).json({ ok: false, error: err.code || 'internal_error', message: err.message });
  }
});

router.post('/tts', async (req, res) => {
  const { text, voice } = req.body || {};
  if (typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ ok: false, error: 'missing_text' });
  }
  try {
    const upstream = await proxyToVoice('/tts', {
      body: JSON.stringify({ text, voice }),
      contentType: 'application/json',
    });
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.status(upstream.status);
    res.setHeader('content-type', upstream.headers.get('content-type') || 'audio/wav');
    res.setHeader('content-length', String(buf.length));
    res.send(buf);
  } catch (err) {
    res.status(err.status || 500).json({ ok: false, error: err.code || 'internal_error', message: err.message });
  }
});

export default router;
