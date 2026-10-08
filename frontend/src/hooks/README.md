# hooks/ — React Hooks

Shared custom hooks for cross-cutting UI concerns.

## Key files

- `useSpeechRecognition.js` — browser speech-to-text for voice input
- `useVoiceConversation.js` — full voice conversation loop (record → transcribe →
  Infinity AI reply → Infinity Voice playback with lip-sync)

## Conventions

- Hooks are UI-only; data fetching lives in `services/`.
- The voice chain ends at `POST /api/v1/voice/speak` via `services/voice.js`.
