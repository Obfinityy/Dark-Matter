# Agent Chat (Autonomous hunts)

## What it is
Inside an Autonomous hunt view the user can talk to the scan agent.
Meta API answers **from the hunt's own findings** — in the user's language,
strictly scoped to bug-bounty + the current target.

Owner order 3 Nov 2026: Meta API is authorized for exactly two uses —
(1) generating the hunt report from scanner data, (2) this in-hunt agent
chat. The AI-brain hunt stays paused; scanning itself uses zero AI.

## Scope rules (system prompt, enforced per call)
- MAY discuss: this scan's target, its confirmed findings, and the
  bug-bounty concepts needed to explain them (what it is, severity, fix).
- MUST refuse everything else (general questions, other sites, coding
  help, personal advice) — briefly, in the user's language, no lecture.
- Only CONFIRMED findings are real; leads are honestly labeled unconfirmed.
- Short answers (2–4 lines). Roman Hinglish default, never Devanagari
  unless the user writes it.

## How it works
`POST /api/v1/hunts/:id/agent-chat` (JWT + hunt ownership):
1. `buildAgentContext(huntId)` — target, brainMode, state, confirmed
   findings (via the same `panelFindings` source the report uses), lead
   count, scan stats. Deliberately small — findings list, not the event
   firehose.
2. `agentChatReply` — system prompt + context + user message →
   `callMetaModel` (brainProvider.js, `muse-spark-1.3`, max 400 tokens,
   45s timeout). Privacy gateway sanitizes every message.
3. Cost recorded (~$0.001/call) via costTracker — minimal by construction.

## Files
- `backend/src/scanner/agentChat.js` — context builder + reply function
  (Meta client lazy-loaded; `metaCall` injectable for tests).
- `backend/src/routes/hunts.js` — `POST /:id/agent-chat` route.
- `backend/src/scanner/agentChat.test.js` — 5 tests, no network/key/SDK.

## Limits
- One-shot answers, no multi-turn memory (each call carries the findings
  list fresh — stateless by design).
- If Meta API is down/key missing → `502 agent_unavailable`, honest error,
  no fallback babble.
