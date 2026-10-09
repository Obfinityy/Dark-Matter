"""
Infinity Voice — Dark-Matter's built-in neural voice engine.

Converts text to natural human-like speech, fully offline, zero API cost.
Powers the Infinity AI avatar's spoken replies.

Internal engine: VoxCPM2 (Apache-2.0, 2B params, 48kHz studio quality)
with Kokoro-82M as automatic fallback when VoxCPM2 isn't installed.
Exposed to the platform only as "Infinity Voice" — the underlying
engine is an implementation detail, never user-facing.

HTTP API (localhost only):
  GET  /health            → { ok: true, voices: [...] }
  POST /speak             → { text, voice } → WAV audio bytes (24kHz mono)

Voices (mapped to friendly names):
  - "aria"   → warm female (default)
  - "aria2"  → soft female
  - "kai"    → warm male
  - "kai2"   → deep male
"""

import io
import json
import logging
import os
import sys
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

logging.basicConfig(level=logging.INFO, format='[infinity-voice] %(message)s')
log = logging.getLogger(__name__)

# Sanitize proxy env vars: some sandboxes set no_proxy entries like "[::1]"
# that older httpx versions cannot parse, breaking model downloads.
# We strip bracketed IPv6 entries rather than dropping the proxy entirely.
for _key in ('no_proxy', 'NO_PROXY'):
    _val = os.environ.get(_key)
    if _val:
        _clean = ','.join(p for p in _val.split(',') if '[' not in p and ']' not in p)
        os.environ[_key] = _clean

PORT = int(os.environ.get('INFINITY_VOICE_PORT', '4120'))

# Friendly voice names → VoxCPM2 voice-design descriptions.
# Never expose engine internals externally.
VOICE_DESIGN = {
    'aria': '(A warm and friendly young woman)',
    'aria2': '(A soft and calm young woman, gentle tone)',
    'kai': '(A warm young man)',
    'kai2': '(A deep, authoritative middle-aged man)',
}
# Fallback: friendly names → Kokoro voice IDs (used only when VoxCPM2 missing).
VOICE_MAP = {
    'aria': 'af_heart',   # warm female — default avatar voice
    'aria2': 'af_bella',  # soft female
    'kai': 'am_adam',     # warm male
    'kai2': 'am_michael', # deep male
}
DEFAULT_VOICE = 'aria'

_pipeline = None
_pipeline_lock = threading.Lock()
_engine = None  # 'voxcpm2' or 'kokoro'


def get_pipeline():
    """Lazy-load VoxCPM2 (preferred) or Kokoro (fallback); thread-safe."""
    global _pipeline, _engine
    if _pipeline is not None:
        return _pipeline
    with _pipeline_lock:
        if _pipeline is not None:
            return _pipeline
        # Try VoxCPM2 first — studio-quality 48kHz, Hindi-capable.
        try:
            from voxcpm import VoxCPM
            log.info('Loading VoxCPM2 voice engine (first run downloads ~9.5GB)...')
            _pipeline = VoxCPM.from_pretrained("openbmb/VoxCPM2", load_denoiser=False)
            _engine = 'voxcpm2'
            log.info('VoxCPM2 voice engine ready.')
            return _pipeline
        except ImportError:
            log.info('VoxCPM2 not installed, falling back to Kokoro.')
        except Exception as e:
            log.warning(f'VoxCPM2 load failed ({e}), falling back to Kokoro.')
        # Fallback: Kokoro-82M (lightweight, CPU-friendly).
        log.info('Loading Kokoro voice engine (first run downloads ~300MB)...')
        try:
            from kokoro import KPipeline
            _pipeline = KPipeline(lang_code='a')
            _engine = 'kokoro'
            log.info('Kokoro voice engine ready (fallback).')
        except Exception as e:
            log.error(f'Failed to load voice engine: {e}')
            raise
        return _pipeline


def synthesize(text, voice='aria'):
    """Text → WAV bytes (48kHz mono 16-bit via VoxCPM2, 24kHz via Kokoro)."""
    import numpy as np
    import soundfile as sf

    pipeline = get_pipeline()

    if _engine == 'voxcpm2':
        design = VOICE_DESIGN.get(voice, VOICE_DESIGN[DEFAULT_VOICE])
        # Voice-design mode: description prefix creates a consistent voice.
        wav = pipeline.generate(
            text=f"{design}{text}",
            cfg_value=2.0,
            inference_timesteps=10,
        )
        buf = io.BytesIO()
        sf.write(buf, wav, 48000, format='WAV', subtype='PCM_16')
        buf.seek(0)
        return buf.read()

    # Kokoro fallback path.
    kokoro_voice = VOICE_MAP.get(voice, VOICE_MAP[DEFAULT_VOICE])
    chunks = []
    generator = pipeline(text, voice=kokoro_voice)
    for _, _, audio in generator:
        chunks.append(audio)
    if not chunks:
        raise RuntimeError('Engine produced no audio')
    full = np.concatenate(chunks)
    buf = io.BytesIO()
    sf.write(buf, full, 24000, format='WAV', subtype='PCM_16')
    buf.seek(0)
    return buf.read()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass  # keep logs clean; we log what matters ourselves

    def _json(self, obj, code=200):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == '/health':
            try:
                get_pipeline()
                ready = True
            except Exception:
                ready = False
            self._json({'ok': True, 'ready': ready, 'voices': list(VOICE_MAP.keys()), 'engine': _engine or 'none'})
        else:
            self._json({'error': 'not found'}, 404)

    def do_POST(self):
        if self.path != '/speak':
            self._json({'error': 'not found'}, 404)
            return
        try:
            length = int(self.headers.get('Content-Length', 0))
            data = json.loads(self.rfile.read(length) or b'{}')
            text = str(data.get('text', '')).strip()
            voice = str(data.get('voice', DEFAULT_VOICE))
            if not text:
                self._json({'error': 'text is required'}, 400)
                return
            if len(text) > 2000:
                self._json({'error': 'text too long (max 2000 chars)'}, 400)
                return
            wav = synthesize(text, voice)
            self.send_response(200)
            self.send_header('Content-Type', 'audio/wav')
            self.send_header('Content-Length', str(len(wav)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(wav)
            log.info(f'Spoke {len(text)} chars as "{voice}" ({len(wav)//1024}KB)')
        except Exception as e:
            log.error(f'/speak failed: {e}')
            self._json({'error': str(e)[:200]}, 500)


def main():
    # Pre-load in background so first /speak is fast.
    threading.Thread(target=lambda: get_pipeline(), daemon=True).start()
    server = HTTPServer(('127.0.0.1', PORT), Handler)
    log.info(f'Listening on 127.0.0.1:{PORT}')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
