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
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from '../config.js';
import { requireAuth } from './auth.js';

const router = Router();
// FIX (#331): uploads used to buffer up to 50MB per request IN MEMORY,
// so concurrent voice uploads could exhaust RAM. Files now spool to
// disk (OS tmp, random names) and are unlinked after forwarding; the
// cap is 25MB (generous for multi-minute clips).
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, os.tmpdir()),
    filename: (_req, file, cb) => cb(null, `dm-voice-${crypto.randomUUID()}-${path.basename(file.originalname || 'audio.wav')}`),
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
});

// TTS text cap: synthesis of unbounded text is an unbounded upstream
// cost (the JSON body parser already caps at ~100kb; 5000 chars is
// several minutes of speech and far above any legitimate voice line).
const TTS_MAX_CHARS = 5000;

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

router.post('/stt', requireAuth, (req, res, next) => {
  // Multer errors (e.g. over the 25MB cap) must be a clean 413, not
  // the server's generic 500, and any partial spool file is removed.
  upload.single('audio')(req, res, (err) => {
    if (err) {
      try { if (req.file && req.file.path) fs.unlinkSync(req.file.path); } catch { /* best-effort */ }
      const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return res.status(status).json({ ok: false, error: err.code || 'upload_error', message: err.message });
    }
    next();
  });
}, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      ok: false,
      error: 'missing_audio',
      message: 'Send multipart/form-data with an "audio" file field.',
    });
  }
  try {
    const buf = fs.readFileSync(req.file.path);
    const form = new FormData();
    form.append(
      'audio',
      new Blob([buf], { type: req.file.mimetype || 'audio/wav' }),
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
  } finally {
    // Uploaded audio never lingers on disk past the forward.
    try { if (req.file && req.file.path) fs.unlinkSync(req.file.path); } catch { /* best-effort */ }
  }
});

router.post('/tts', requireAuth, async (req, res) => {
  const { text, voice } = req.body || {};
  if (typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ ok: false, error: 'missing_text' });
  }
  if (text.length > TTS_MAX_CHARS) {
    return res.status(400).json({ ok: false, error: 'text_too_long', message: `Text must be at most ${TTS_MAX_CHARS} characters.` });
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
