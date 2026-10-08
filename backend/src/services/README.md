# services/ — Business Logic Services

Stateful business logic behind the controllers: auth, hunts, chat, voice,
billing, and the local model runner.

## Key files

- `authService.js`, `billingService.js` (if present) — identity and payments
- `brainChatService.js`, `askAgentService.js`, `chatMemoryService.js` — Infinity AI chat
- `huntScheduler.js`, `huntDiary.js`, `findingLifecycleService.js` — hunt lifecycle
- `voiceManager.js` — spawns/manages the Infinity Voice Python service
- `modelRunner/` — llama.cpp model download and local inference
- `computerTaskManager.js`, `engineLauncher.js`, `crewService.js` — execution support
- `alertService.js`, `eventService.js`, `assessmentService.js` — notifications/events

## Conventions

- Services own state and orchestration; controllers only translate HTTP.
- The voice chain is `services/voice.js` (frontend) → `/api/v1/voice/speak` →
  `voiceManager` → `backend/voice/voice_service.py` (Kokoro-82M).
