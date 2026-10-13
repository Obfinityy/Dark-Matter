"""Dark Matter STT service — local speech-to-text via faster-whisper.

Exposes:
    GET  /health   -> service status + model info
    POST /stt      -> multipart audio file in, {"text": "..."} out

The whisper model is loaded lazily on the first /stt call (or at startup
when WHISPER_PRELOAD=1) and auto-downloads from Hugging Face on first use
into the standard HF/faster-whisper cache (~/.cache).

Env vars:
    STT_PORT               port to listen on (default 8001)
    WHISPER_MODEL          tiny | base | small (default "small")
    WHISPER_DEVICE         cpu | cuda (default "cpu")
    WHISPER_COMPUTE_TYPE   int8 | float32 ... (default "int8")
    WHISPER_LANGUAGE       e.g. "en" / "hi"; unset = auto-detect
    WHISPER_PRELOAD        1 = load model at startup, 0 = lazy (default 0)
"""

import logging
import os
import tempfile

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse

log = logging.getLogger("dm-stt")

MODEL = os.environ.get("WHISPER_MODEL", "small")
DEVICE = os.environ.get("WHISPER_DEVICE", "cpu")
COMPUTE_TYPE = os.environ.get("WHISPER_COMPUTE_TYPE", "int8")
LANGUAGE = os.environ.get("WHISPER_LANGUAGE") or None

_model = None
_model_error = None


def get_model():
    """Load (once) and return the faster-whisper model."""
    global _model, _model_error
    if _model is None and _model_error is None:
        try:
            from faster_whisper import WhisperModel

            log.info("loading whisper model %r (device=%s, compute=%s)",
                     MODEL, DEVICE, COMPUTE_TYPE)
            _model = WhisperModel(MODEL, device=DEVICE, compute_type=COMPUTE_TYPE)
        except Exception as exc:  # missing dep, no network, bad model id...
            _model_error = f"{type(exc).__name__}: {exc}"
            log.error("whisper model failed to load: %s", _model_error)
    if _model is None:
        raise RuntimeError(f"STT model unavailable: {_model_error}")
    return _model


app = FastAPI(title="Dark Matter STT", version="1.0.0")


@app.get("/health")
def health():
    loaded = _model is not None
    return {
        "ok": True,
        "service": "stt",
        "model": MODEL,
        "device": DEVICE,
        "compute_type": COMPUTE_TYPE,
        "language": LANGUAGE or "auto",
        "model_loaded": loaded,
        "model_error": _model_error,
    }


@app.post("/stt")
async def stt(file: UploadFile = File(...)):
    """Transcribe an uploaded audio file. Returns {"text": "..."}."""
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="empty audio payload")

    try:
        model = get_model()
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    suffix = os.path.splitext(file.filename or "")[1] or ".wav"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(data)
        tmp_path = tmp.name
    try:
        segments, info = model.transcribe(tmp_path, language=LANGUAGE)
        text = " ".join(seg.text.strip() for seg in segments).strip()
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass

    resp = {"text": text, "model": MODEL}
    if info is not None:
        resp["language"] = info.language
        resp["language_probability"] = round(info.language_probability, 3)
    return JSONResponse(resp)


if __name__ == "__main__":
    import uvicorn

    if os.environ.get("WHISPER_PRELOAD") == "1":
        get_model()
    uvicorn.run(app, host="127.0.0.1",
                port=int(os.environ.get("STT_PORT", "8001")))
