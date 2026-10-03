"""
Infinity Voice — Dark-Matter's built-in neural voice engine.

Converts text to natural human-like speech, fully offline, zero API cost.
Powers the Infinity AI avatar's spoken replies.

Internal engine: Kokoro-82M (Apache-2.0, 82M params, CPU-friendly).
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

# Friendly voice names → Kokoro voice IDs. Never expose Kokoro IDs externally.
VOICE_MAP = {
    'aria': 'af_heart',   # warm female — default avatar voice
    'aria2': 'af_bella',  # soft female
    'kai': 'am_adam',     # warm male
    'kai2': 'am_michael', # deep male
}
DEFAULT_VOICE = 'aria'

_pipeline = None
_pipeline_lock = threading.Lock()


def get_pipeline():
    """Lazy-load Kokoro once; thread-safe."""
    global _pipeline
    if _pipeline is not None:
        return _pipeline
    with _pipeline_lock:
        if _pipeline is not None:
            return _pipeline
        log.info('Loading neural voice engine (first run downloads ~300MB)...')
        try:
            from kokoro import KPipeline
            # 'a' = American English; works well for Hinglish too (Latin script).
            _pipeline = KPipeline(lang_code='a')
            log.info('Voice engine ready.')
        except Exception as e:
            log.error(f'Failed to load voice engine: {e}')
            raise
        return _pipeline


def synthesize(text, voice='aria'):
    """Text → WAV bytes (24kHz mono 16-bit)."""
    import numpy as np
    import soundfile as sf

    pipeline = get_pipeline()
    kokoro_voice = VOICE_MAP.get(voice, VOICE_MAP[DEFAULT_VOICE])

    # Kokoro handles long text by chunking internally via the generator.
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
            self._json({'ok': True, 'ready': ready, 'voices': list(VOICE_MAP.keys())})
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
