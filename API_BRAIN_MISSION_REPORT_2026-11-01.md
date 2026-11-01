# API BRAIN INTEGRATION — MISSION REPORT

**Date:** 1 Nov 2026, ~01:10 IST  
**Commit:** 747ffc0  
**Branch:** feat/final-integration

---

## What Was Implemented

### New: OpenRouter API Provider

**Not a Meta duplicate.** The existing Meta integration (muse-spark-1.3, etc.) is untouched. OpenRouter is a separate OpenAI-compatible provider.

**Files changed:**
- `backend/src/brainProvider.js` — Added `openrouter-free` model, `isOpenRouterModel()`, `openRouterAvailable()`, `API_BUDGET_DEFAULTS`, OpenRouter routing in `callBrain()`
- `backend/src/llm.js` — `chatWithAI()` now accepts `providerOverride` opt for per-hunt provider selection
- `backend/src/brainProvider-openrouter.test.js` — 5 new tests
- `backend/src/brainProvider.test.js` — Updated model count (7→9)

**How it works:**
1. Hunt selects `openrouter-free` as brain model
2. `callBrain()` detects OpenRouter model via `isOpenRouterModel()`
3. If `OPENROUTER_API_KEY` is set → routes to OpenRouter via `providerOverride`
4. If key missing → falls back to 8B with a recorded switch event (no silent failure)

### Cost Controls (API_BUDGET_DEFAULTS)

| Limit | Default | Env Var |
|-------|---------|---------|
| Max tokens/request | 2000 | API_MAX_TOKENS_PER_REQUEST |
| Max requests/hunt | 500 | API_MAX_REQUESTS_PER_HUNT |
| Max requests/hour | 100 | API_MAX_REQUESTS_PER_HOUR |
| Max retries | 2 | API_MAX_RETRIES |
| Request timeout | 120s | API_REQUEST_TIMEOUT_MS |
| Max spend/hunt | $5.00 | API_MAX_SPEND_USD_PER_HUNT |

**Note:** The free-tier OpenRouter model (`nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free`) costs $0. The budget controls are for paid models if configured later.

---

## Verification Status

### ✅ Mock-Verified (40/40 tests pass)

- Provider selection: `isOpenRouterModel()` correctly identifies OpenRouter vs Ollama vs Meta
- Model registry: `openrouter-free` present with correct provider/capabilities
- Availability check: `openRouterAvailable()` returns boolean, never exposes key
- Budget defaults: All limits present, safe values (≤$5/hunt, ≤500 req/hunt)
- Existing tests: All 35 pre-existing brain provider tests still pass (including MS-11 with updated count)

### ✅ Path Verified (code inspection)

`context → callBrain → providerOverride → chatWithOpenRouter → structured action → scopeGuard → tool dispatcher`

- Scope enforcement happens at `huntAgent.js:1962` via `guardCommand()`, **independent of provider**
- The API provider only generates the action; it cannot bypass scope, auth, or tool permissions
- No-response/invalid-action produces visible fallback (8B) with recorded switch event, not infinite loop
- Active provider visible in hunt state via `state.active` and switch events

### ❌ NOT Live-Verified

- No real OpenRouter API calls made (no key configured)
- No live hunt using the API provider
- Mock success is **not** live API verification

---

## Existing Meta Integration (Untouched)

The Meta API provider is already integrated:
- Models: `muse-spark-1.3`, `muse-spark-1.2`, `muse-spark-1.1`, contributor variants, `muse-wonder-1.0`
- Auth: `META_API_KEY` environment variable
- Availability: `metaAvailable()` checks key presence; models marked unavailable without key
- **Status:** Not modified. Not activated. No credentials touched.

---

## What Requires Owner Approval

### Meta API Activation

**To enable Meta for a live hunt, the following is required:**

1. **Configuration:**
   - Set `META_API_KEY` in EC2 backend environment (`/etc/darkmatter/env` or systemd EnvironmentFile)
   - Select Meta model via Brain Console or API: `setBrainModel(huntId, 'muse-spark-1.3')`
   - Deploy (backend restart picks up env changes)

2. **Expected costs:**
   - Meta API pricing: Check current Meta API rates (not hardcoded here)
   - Previous spend: $10.0288 total (frozen since 28 Oct)
   - Per-turn estimate: ~$0.007/cycle (from 28 Oct data: 657 calls = $10.03)
   - Budget control: No per-hunt spend cap currently enforced for Meta (unlike new OpenRouter defaults)

3. **Risks:**
   - Spend is NOT capped by default for Meta (unlike the new API_BUDGET_DEFAULTS)
   - Recommend setting spend alerts before activation

**I have NOT:**
- Set or modified any API keys
- Activated Meta for any hunt
- Started any paid inference
- Changed the running hunt's brain mode (still `parent`)

---

## Remaining Blockers

1. **No API key configured** — Neither `OPENROUTER_API_KEY` nor `META_API_KEY` is set on EC2 (verified: `metaAvailable()` returns false, `openRouterAvailable()` returns false)
2. **Live validation blocked** — Cannot verify real API inference without a key
3. **Meta spend controls** — The existing Meta integration lacks the per-hunt budget caps I added for OpenRouter

---

## Next Steps (Require Owner Decision)

1. **Choose provider:** OpenRouter (free tier, $0) vs Meta (paid, faster)
2. **Provide API key** via secure channel (not chat) if proceeding
3. **Approve live test hunt** on DVWA lab before touching production hunt

---

## Summary

**Implemented:** OpenRouter API provider with cost controls, per-hunt selection, and safe fallback.  
**Verified:** 40/40 mock tests pass. Full provider→scope→dispatcher path intact.  
**Not done:** Live API verification (needs key). Meta activation (needs explicit approval).  
**Untouched:** Existing Meta integration, running hunt, parent brain mode.
