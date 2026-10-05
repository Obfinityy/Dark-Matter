# Third-party notices — Infinity Voice TTS tier

This directory (`backend/src/voice/`) contains only original Infinity AI
scaffold code. The voice engines it integrates with are separate upstream
open-source projects, **not vendored here**. Their licenses are reproduced
below as required; keep these notices intact.

None of these project names appear in the product UI — every user-visible
surface says **Infinity AI** / **Infinity Voice**.

---

## 1. Chatterbox (Resemble AI)

- Project: https://github.com/resemble-ai/chatterbox
- What we use: the Chatterbox Multilingual v3 TTS model, served via a
  sidecar at runtime (weights download on the operator's machine; nothing
  is copied into this repo).
- License: MIT

```
MIT License

Copyright (c) Resemble AI

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Note: Chatterbox audio carries the PerTh responsible-AI watermark
(upstream feature, not a restriction on use).

## 2. Chatterbox-TTS-Server (devnen)

- Project: https://github.com/devnen/Chatterbox-TTS-Server
- What we use: the community FastAPI server (OpenAI-compatible
  `/v1/audio/speech`, SSE streaming) run as a sidecar process; referenced
  by URL via `INFINITY_TTS_URL`, never copied into this repo.
- License: MIT

```
MIT License

Copyright (c) devnen

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 3. Piper (rhasspy)

- Project: https://github.com/rhasspy/piper
- What we use: the `piper` binary + ONNX voice models
  (`hi_IN-priyamvada-medium`, `hi_IN-pratham-medium`) as the no-GPU
  fallback tier, invoked as a local subprocess; installed on the
  operator's machine, never copied into this repo.
- License: MIT

```
MIT License

Copyright (c) rhasspy

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## Concept-only reference (NOT used, NOT vendored)

- **VoiceStudio** ("voice studio.sh") — https://github.com/debpalash/VoiceStudio
  — evaluated during research as a *concept reference* for the pluggable
  engine catalog + OpenAI-compatible audio API design. It is **AGPL-3.0**
  licensed, so none of its code, assets, or weights are vendored, linked,
  or shipped anywhere in this project. No attribution is owed for
  concept-level inspiration, and none is claimed.
