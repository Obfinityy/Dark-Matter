"""Dark Matter TTS service — local text-to-speech via Piper.

Exposes:
    GET  /health       -> service status (engine used, voices dir, loaded voices)
    GET  /tts/voices   -> [{"id","name","lang"}] (+ "available" flag per voice)
    POST /tts          -> {"text","voice"} in, audio/wav bytes out

Synthesis engine resolution (first available wins):
    1. `piper` Python package (pip install piper-tts) — needs espeak-ng present.
    2. `piper` CLI binary (env PIPER_BIN, default "piper" on PATH) — from
       https://github.com/rhasspy/piper/releases

Voice models live in PIPER_VOICES_DIR (default ~/.local/share/piper/voices)
as "<voice-id>.onnx" + "<voice-id>.onnx.json" pairs.

Env vars:
    TTS_PORT            port to listen on (default 8002)
    PIPER_VOICES_DIR    voice model directory
    PIPER_BIN           path to the piper CLI binary (default "piper")
    TTS_DEFAULT_VOICE   fallback voice id (default "en_US-amy-medium")
    TTS_LENGTH_SCALE    speaking rate, 1.0 = normal (default "1.0")
    TTS_NOISE_SCALE     default "0.667"
    TTS_NOISE_W         default "0.8"
    TTS_SPEAKER_ID      multi-speaker voice speaker index (default "0")
"""

import json
import logging
import os
import shutil
import subprocess
import tempfile

from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

log = logging.getLogger("dm-tts")

_HERE = os.path.dirname(os.path.abspath(__file__))
VOICES_DIR = os.path.expandvars(os.path.expanduser(
    os.environ.get("PIPER_VOICES_DIR",
                   os.path.join("~", ".local", "share", "piper", "voices"))))
PIPER_BIN = os.environ.get("PIPER_BIN", "piper")
DEFAULT_VOICE = os.environ.get("TTS_DEFAULT_VOICE", "en_US-amy-medium")
LENGTH_SCALE = float(os.environ.get("TTS_LENGTH_SCALE", "1.0"))
NOISE_SCALE = float(os.environ.get("TTS_NOISE_SCALE", "0.667"))
NOISE_W = float(os.environ.get("TTS_NOISE_W", "0.8"))
SPEAKER_ID = int(os.environ.get("TTS_SPEAKER_ID", "0"))

with open(os.path.join(_HERE, "voices.json"), encoding="utf-8") as fh:
    CURATED_VOICES = json.load(fh)

_engine = None  # "piper-python" | "piper-binary" | None


def _resolve_engine():
    """Pick the synthesis engine; resolved once, reported in /health."""
    global _engine
    if _engine is not None:
        return _engine
    try:
        import piper  # noqa: F401  (pip package "piper-tts")
        _engine = "piper-python"
    except ImportError:
        if shutil.which(PIPER_BIN):
            _engine = "piper-binary"
        else:
            _engine = None
    return _engine


def voice_model_path(voice_id):
    """Return the .onnx path for a voice id if downloaded, else None."""
    onnx = os.path.join(VOICES_DIR, f"{voice_id}.onnx")
    cfg = onnx + ".json"
    if os.path.isfile(onnx) and os.path.isfile(cfg):
        return onnx
    return None


def available_voices():
    """Curated voices annotated with whether the model is downloaded."""
    out = []
    for v in CURATED_VOICES:
        v = dict(v)
        v["available"] = voice_model_path(v["id"]) is not None
        out.append(v)
    return out


def _synthesize_with_python(text, model_path):
    """Synthesize using the `piper` pip package (piper-tts)."""
    import io
    import wave

    from piper import PiperVoice

    voice = PiperVoice.load(model_path)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav_file:
        voice.synthesize(
            text,
            wav_file,
            speaker_id=SPEAKER_ID,
            length_scale=LENGTH_SCALE,
            noise_scale=NOISE_SCALE,
            noise_w=NOISE_W,
        )
    return buf.getvalue()


def _synthesize_with_binary(text, model_path):
    """Synthesize by piping text to the `piper` CLI binary."""
    cmd = [
        PIPER_BIN,
        "--model", model_path,
        "--output_file", "/dev/stdout",
        "--length_scale", str(LENGTH_SCALE),
        "--noise_scale", str(NOISE_SCALE),
        "--noise_w", str(NOISE_W),
    ]
    proc = subprocess.run(cmd, input=text.encode("utf-8"),
                          capture_output=True, timeout=120)
    if proc.returncode != 0:
        raise RuntimeError(f"piper CLI failed: {proc.stderr.decode()[-500:]}")
    return proc.stdout


def synthesize(text, voice_id):
    if not text or not text.strip():
        raise ValueError("empty text")
    model_path = voice_model_path(voice_id)
    if model_path is None:
        raise FileNotFoundError(
            f"voice {voice_id!r} is not downloaded. "
            f"Run: python download_voice.py {voice_id}")
    engine = _resolve_engine()
    if engine == "piper-python":
        return _synthesize_with_python(text, model_path)
    if engine == "piper-binary":
        return _synthesize_with_binary(text, model_path)
    raise RuntimeError(
        "no Piper engine available: install the `piper-tts` pip package "
        "(needs espeak-ng) or set PIPER_BIN to a piper CLI binary from "
        "https://github.com/rhasspy/piper/releases")


app = FastAPI(title="Dark Matter TTS", version="1.0.0")


class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    voice: str = DEFAULT_VOICE


@app.get("/health")
def health():
    return {
        "ok": True,
        "service": "tts",
        "engine": _resolve_engine(),
        "voices_dir": VOICES_DIR,
        "default_voice": DEFAULT_VOICE,
        "voices_total": len(CURATED_VOICES),
        "voices_downloaded": sum(1 for v in available_voices() if v["available"]),
    }


@app.get("/tts/voices")
def list_voices():
    return [{"id": v["id"], "name": v["name"], "lang": v["lang"],
             "gender": v.get("gender"), "available": v["available"]}
            for v in available_voices()]


@app.post("/tts")
def tts(req: TTSRequest):
    try:
        wav = synthesize(req.text, req.voice)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    return Response(content=wav, media_type="audio/wav")


if __name__ == "__main__":
    import uvicorn

    os.makedirs(VOICES_DIR, exist_ok=True)
    uvicorn.run(app, host="127.0.0.1",
                port=int(os.environ.get("TTS_PORT", "8002")))
