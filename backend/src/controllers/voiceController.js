/**
 * voiceController.js — Infinity Voice API.
 *
 * POST /api/v1/voice/speak  { text, voice? } → audio/wav
 * GET  /api/v1/voice/health  → { ok, ready, voices }
 * GET  /api/v1/voice/voices  → [{ id, label, gender }]
 *
 * Branded as "Infinity Voice" throughout — the neural engine underneath
 * is an implementation detail.
 */

const VOICES = [
  {
    id: 'aria',
    label: 'Aria',
    gender: 'female',
    description: 'Warm and friendly — the default avatar voice',
  },
  { id: 'aria2', label: 'Aria Soft', gender: 'female', description: 'Soft and calm female voice' },
  { id: 'kai', label: 'Kai', gender: 'male', description: 'Warm male voice' },
  { id: 'kai2', label: 'Kai Deep', gender: 'male', description: 'Deep, authoritative male voice' },
];

export function createVoiceController({ voiceManager }) {
  const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

  return {
    /** GET /api/v1/voice/health */
    health: asyncHandler(async (request, response) => {
      const h = await voiceManager.health();
      response.json({
        ok: true,
        service: 'infinity-voice',
        ready: !!(h.ok && h.ready),
        voices: VOICES.map(v => v.id),
      });
    }),

    /** GET /api/v1/voice/voices */
    voices: asyncHandler(async (request, response) => {
      response.json({ voices: VOICES });
    }),

    /**
     * POST /api/v1/voice/speak { text, voice? }
     * Returns WAV audio (24kHz mono). Starts the engine on first use
     * (may take ~30-60s while the model loads — subsequent calls are fast).
     */
    speak: asyncHandler(async (request, response) => {
      const { text, voice = 'aria' } = request.body || {};
      if (!text || typeof text !== 'string' || !text.trim()) {
        return response
          .status(400)
          .json({ error: { code: 'BAD_REQUEST', message: 'text is required' } });
      }
      if (text.length > 2000) {
        return response
          .status(400)
          .json({ error: { code: 'BAD_REQUEST', message: 'text too long (max 2000 chars)' } });
      }
      const voiceIds = VOICES.map(v => v.id);
      const v = voiceIds.includes(voice) ? voice : 'aria';
      try {
        const wav = await voiceManager.speak(text.trim(), v);
        response.set({
          'Content-Type': 'audio/wav',
          'Content-Length': String(wav.length),
          'Cache-Control': 'no-store',
          'X-Voice': v,
        });
        response.send(wav);
      } catch (error) {
        const msg = error.message || 'Voice synthesis failed';
        const code = /not installed|requirements/i.test(msg) ? 503 : 500;
        response.status(code).json({
          error: {
            code: code === 503 ? 'VOICE_NOT_INSTALLED' : 'VOICE_FAILED',
            message:
              code === 503
                ? 'Infinity Voice is not installed on this machine yet. Run: pip install torch --index-url https://download.pytorch.org/whl/cpu && pip install -r backend/voice/requirements.txt'
                : msg.slice(0, 300),
          },
        });
      }
    }),
  };
}
