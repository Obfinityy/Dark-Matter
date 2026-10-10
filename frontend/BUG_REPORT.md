# Dark-Matter Frontend Bug Report
**Date:** 11 October 2026, ~02:15 IST
**Scope:** `frontend/src` (React 18 + Vite 8, 836 source files)
**Method:** Manual code review of priority areas + 3 parallel specialist hunters (pages, services, auth/hooks/components) — all reports delivered and merged
**Build status:** ✅ `npm run build` passes (2082 modules transformed, 3.44s)

---

## CRITICAL BUGS (must fix)

### C1. VM Control brains never wired — control loop always fails on start
- **File:** `src/components/agent/VmControlPanel.jsx:43-47`
- **What's wrong:**
  ```js
  function resolveBrains() {
    // TODO(workstream-3): resolve the configured Hacking/Vision/Grounding brain
    // slots (browser-direct inference) here and pass them to the loop.
    return { hacker: null, vision: null, grounding: null };
  }
  ```
- **Why it's a bug:** `resolveBrains()` is called at line 175 when starting the VM control loop: `createVmControlLoop({ runnerApi, brains: resolveBrains(), ... })`. The loop implementation (`src/agent/vmControlLoop.js:732`) throws `'hacking brain unavailable — connect a hacker brain to start the loop'` when `brains.hacker` is null. Since the stub always returns nulls, **starting VM Control always fails** — the entire feature is non-functional. The user-configured brain links from the Models page are never read.
- **Severity:** Critical
- **Suggested fix:** Implement `resolveBrains()` to read configured brain slots via `getAllKaggleSlots()` from `src/services/gradioDirect.js` and construct adapter objects exposing `generate(messages, { timeoutMs })` (hacker, vision) and `generateStructured(messages, schema, { timeoutMs })` (grounding).

### C2. Dead SSE streams — scan/assessment events never send the JWT
- **File:** `src/services/api.js:458` (`subscribeToScanEvents`), `src/services/api.js:580` (`subscribeToAssessmentEvents`)
- **What's wrong:** These two `EventSource` subscriptions are built as raw URLs with only `{ withCredentials: true }` — they do not go through `sseUrl()`, so the JWT is never attached. Every *other* SSE subscription in this file (jobs line 945, hunts line 1130, computer-tasks line 796, crew line 897, model-runner lines 1397/1426/1574) explicitly appends `?accessToken=<jwt>` with comments warning "without it the stream 401s and the feed stays empty."
- **Why it's a bug:** When cookie auth is absent (JWT-only login, cross-tab session, deployed frontend talking to a different-origin backend), these two streams 401 and silently stay empty — the Scan live terminal and Assessment event feed are dead while every other stream works.
- **Severity:** Critical
- **Suggested fix:** Build both URLs with `sseUrl(...)` like the other subscriptions.

### C3. Wrong auth query-param name on local-model SSE streams
- **File:** `src/services/localModelApi.js:167`, `src/services/localModelApi.js:275`
- **What's wrong:** These two `EventSource` URLs attach the JWT as `?token=<jwt>`. The rest of the codebase (api.js `sseUrl`, line 1390) uses `?accessToken=<jwt>`, and the backend contract documented in this repo supports `accessToken`, not `token`. Additionally these two `EventSource` calls omit `withCredentials: true`, unlike every subscription in api.js.
- **Why it's a bug:** If the backend only honors `accessToken`, both streams (model-download progress, engine-download progress) 401 — the Models page progress UI never updates on the local backend path.
- **Severity:** Critical
- **Suggested fix:** Unify on `?accessToken=` and add `{ withCredentials: true }` (or better: extract one shared `sseUrl` helper used by both files).

### C4. `setSlotAssignments` is not defined — successful slot runs throw ReferenceError
- **File:** `src/pages/agent/ModelLibrary.jsx:1343`
- **What's wrong:** `runSlotHandler` calls `setSlotAssignments(a => ({ ...a, [slot]: modelId }))` when the backend confirms the slot started (`data?.slot`). A grep of the entire file shows `setSlotAssignments` appears exactly once — it is never declared as state or imported.
- **Why it's a bug:** The model actually starts on the backend, but the `ReferenceError` is caught by the surrounding `try/catch`, so the UI shows an error and never calls `refresh()` — a successful operation presents as a failure, and slot state never refreshes.
- **Severity:** Critical
- **Suggested fix:** Define the missing state (e.g. `const [slotAssignments, setSlotAssignments] = useState({})`) or remove the call if leftover from a refactor (the file already tracks assignment via `slotServers` and `activeBrains`).

### C5. `Login` ignores the `initialMode` prop — the `/register` route is broken
- **Files:** `src/pages/Auth/Login.jsx:59` (`export function Login()` — takes no props), `src/App.jsx:121,129`
- **What's wrong:** `App.jsx` renders `<Login initialMode="signin" />` on `/login` and `<Login initialMode="signup" />` on `/register`, but `Login` destructures no props and always initializes `mode` to `'login'`. The word `initialMode` appears nowhere in `Login.jsx`. Compounding it: the prop values `'signin'`/`'signup'` don't even match the component's internal mode strings `'login'`/`'register'`.
- **Why it's a bug:** Navigating to `/register` shows the "Sign in" tab instead of "Create account" — the registration entry point is silently broken.
- **Severity:** Critical
- **Suggested fix:** Accept the prop and initialize state from it: `export function Login({ initialMode }) { const [mode, setMode] = useState(initialMode === 'signup' ? 'register' : 'login'); … }` (and normalize the prop values in `App.jsx`).

---

## HIGH-PRIORITY BUGS (should fix)

### H1. Main API client has no request timeout — requests can hang forever
- **File:** `src/services/api.js:84-128` (central `request()`)
- **What's wrong:** No `AbortController`/timeout is used in the central request helper. ~150 exported functions funnel through `request()`, which waits indefinitely. Every other service file added timeouts (`vmRunnerApi` 15s default, `gradioDirect` 120s, `backendMode` 10s), but not this one.
- **Why it's a bug:** Long-running calls (`controlComputer`, `buildWithInfinity`, `reportHuntSnapshot`, hunt pause/resume) can hang forever on a stalled connection — no UI spinner ever resolves, and pending promises pile up (memory leak under repeated retries).
- **Severity:** High
- **Suggested fix:** Add a configurable default timeout (e.g. 60s, overridable per-call) via `AbortController` in `request()`, mapping abort to `ApiError(0, 'REQUEST_TIMEOUT')`.

### H2. `streamDirectChat` sends no Authorization header and cannot be aborted
- **File:** `src/services/api.js:219-290`
- **What's wrong:** (a) The fetch headers are only `Content-Type` + `Accept` — no `Authorization: Bearer <jwt>`, unlike the central `request()` which attaches it. It relies solely on `credentials: 'include'` (cookie). (b) There is no `signal` option, so a component unmount leaves the `while (true)` reader loop running forever.
- **Why it's a bug:** (a) JWT-only sessions get 401 on chat streaming while non-streamed chat works. (b) The abandoned reader keeps consuming the stream and invoking stale handlers — a memory leak plus potential setState-on-unmounted-component crashes.
- **Severity:** High
- **Suggested fix:** Attach the JWT header (mirror `reportHuntSnapshot`'s manual-fetch pattern); accept an `AbortSignal` in options and wire it to the fetch, closing the reader on abort.

### H3. `chatWithGradio` retry math yields up to ~15 minutes before an error surfaces
- **File:** `src/services/gradioDirect.js:107-133`
- **What's wrong:** Each of 3 attempts runs `callPredict` (poll loop deadline `Date.now() + timeoutMs`, default 120s) and *then* the legacy `/gradio_api/api/chat` (another 120s), plus a 2s backoff. Worst case ≈ 3 × 242s ≈ 12 minutes before the caller sees an error.
- **Why it's a bug:** The per-call `timeoutMs` contract ("times out in 2 minutes") is broken by the retry wrapper — the UI appears hung. A dead Kaggle link blocks the caller for an entire hunt tick window.
- **Severity:** High
- **Suggested fix:** Budget the total across attempts (e.g. deadline = start + timeoutMs shared across attempts) or reduce to 1 predict attempt + 1 legacy attempt within the caller's timeout.

### H4. `downloadModelDirect` buffers multi-GB GGUF files entirely in browser memory
- **File:** `src/services/modelDownload.js:31-83`
- **What's wrong:** Every chunk is pushed into `chunks[]`, then assembled into one `Blob`. A 4–8 GB model download holds the full file in RAM twice (chunks + blob).
- **Why it's a bug:** The tab will OOM/crash on realistic model sizes; the browser download mechanism then receives a multi-GB in-memory blob.
- **Severity:** High
- **Suggested fix:** Stream to disk (Streams API + File System Access API `createWritable()`), with the blob-assembly path as fallback.

### H5. `controlComputer` defaults `simulate = true` — silently routes real control calls through the mock adapter
- **File:** `src/services/api.js:413-422`
- **What's wrong:** The signature is `controlComputer(instruction, conversationId, { dryRun = false, simulate = true } = {})`. The standing product rule bans the simulate/mock path entirely ("Control mode shows only the real brain-driven agent loop").
- **Why it's a bug:** Any caller that omits `simulate` gets a simulated run that *looks* like control — silently violating the product contract and producing misleading "success" results.
- **Severity:** High
- **Suggested fix:** Default `simulate = false` (or remove the parameter and let the backend decide).

### H6. Auth boot failure nukes the session on any network error
- **File:** `src/auth/AuthContext.jsx:39-41`
- **What's wrong:** The boot effect's `.catch()` calls `storeJwt(null)` for *every* failure — including transient network outages (`ApiError` status 0 / `BACKEND_UNAVAILABLE`) and 5xx errors.
- **Why it's a bug:** A backend restart at page load silently logs the user out and deletes their JWT; they must re-enter credentials even though the session was valid. Only 401 (invalid/expired token) should clear the token.
- **Severity:** High
- **Suggested fix:** Check `err?.status === 401` before clearing the JWT; on network errors, keep the token and set `user` to null with a distinct "backend unreachable" state.

### H7. Catalog "Run" writes the server under the wrong slot key — hacker brain never shows as running
- **File:** `src/pages/agent/ModelLibrary.jsx:1679` (inside `run()`)
- **What's wrong:** `run()` maps the category to the backend slot correctly (`model.category === 'hacking' ? 'hacker' : model.category`) for the API call, but then stores the optimistic UI state under the raw category: `setSlotServers(prev => ({ ...prev, [model.category]: { … } }))`. For hacker-category models this writes key `'hacking'`, while `refreshSlotServers`, `stopSlotHandler`, and `slotSetup` all use `'hacker'`.
- **Why it's a bug:** `BrainSlotCard` reads `slotServers?.[slotId]` (slotId `'hacker'` from the backend), so after pressing Run on a Hacker-brain model from the catalog, the card does not show the "Running" state — the user gets no confirmation.
- **Severity:** High
- **Suggested fix:** Use the already-computed `slot` variable in the `setSlotServers` call instead of `model.category`.

### H8. Failed/cancelled catalog download is a dead end — no Retry or Dismiss
- **File:** `src/pages/agent/ModelLibrary.jsx:293-311` (`ModelCard`)
- **What's wrong:** `isDownloading` is true for statuses `error`/`cancelled`, so the progress block renders "Failed: …"/"Cancelled" — but every action button is guarded by `{!dlFailed && !isPaused && …}` or `{isPaused && …}`. When `dlFailed` is true, zero buttons render.
- **Why it's a bug:** After a failed or cancelled download, the card is stuck with no way to retry or dismiss short of a full page reload.
- **Severity:** High
- **Suggested fix:** Add Retry and Dismiss buttons to the `dlFailed` branch, mirroring the slot-row UI (lines 720-727).

### H9. Catalog Stop/Remove hit the configured backend while Download/Run hit localhost
- **File:** `src/pages/agent/ModelLibrary.jsx:1718-1738` (`stop`, `remove`)
- **What's wrong:** The catalog card's `onRun` → `runModelOnLocal` (localhost) and `onDownload` → `downloadModelLocal` (localhost), but `onStop` → `stopRunnerModel()` and `onRemove` → `removeRunnerModel(modelId)`, both imported from `services/api` (the configured backend, e.g. Render in production).
- **Why it's a bug:** Per the file's own architecture ("Models run on the USER'S LOCAL MACHINE … never the cloud backend"), pressing Stop or Remove on a locally-running model sends the request to the wrong server — the model keeps running and files stay on disk, with a success-looking UI.
- **Severity:** High
- **Suggested fix:** Route the catalog card's Stop/Remove through `stopSlotOnLocal` / `removeModelLocal`.

### H10. Landing hero discards the pasted target URL
- **File:** `src/pages/Landing/Landing.jsx:93-96`
- **What's wrong:** The hero form collects `url` in state (with a `type="url"` input and "Paste a link" headline), but `start` does only `navigate('/agent')` — the URL is never passed along.
- **Why it's a bug:** The page's primary call-to-action promises "Paste a link. AI hunts the bugs." but silently drops the link; the user's target never reaches the console.
- **Severity:** High
- **Suggested fix:** Pass it through, e.g. `navigate('/agent', { state: { target: url } })`, and consume it in the hunt console — or remove the input if not meant to be functional yet.

### H11. Permission-mode sync failure is an unhandled rejection with silent state divergence
- **File:** `src/pages/agent/Settings.jsx:79-90` (`choosePermissionMode`)
- **What's wrong:** localStorage/state are updated first, then `await syncPermissionModeToServer()` runs inside `try { … } finally { … }` with no `catch`. If the sync throws, the rejection propagates out of the `onClick` handler unhandled, and the UI keeps showing the new mode while the backend never received it.
- **Why it's a bug:** Unhandled promise rejection plus UI/backend disagreeing about the agent's safety-critical permission mode.
- **Severity:** High
- **Suggested fix:** Add a `catch` that surfaces the failure (error notice + optionally roll back the local change).

---

## MEDIUM BUGS (nice to fix)

### M1. Chat messages use array index as React key
- **File:** `src/components/agent/AgentChat.jsx:231` (`key={i}`)
- **What's wrong:** Messages are rendered via `messages.map((msg, i) => <div key={i} ...>)`. Message objects contain only `{ role, text, at, ... }` — no unique `id`.
- **Why it's a bug:** Index keys cause React to reuse DOM nodes incorrectly if the list is ever reordered, filtered, or if two messages share the same timestamp.
- **Severity:** Medium (list is append-only today, so risk is latent)
- **Suggested fix:** Add `id: crypto.randomUUID()` when creating each message object and render with `key={msg.id}`.

### M2. Index keys in VM Control feed and chat turns
- **File:** `src/components/agent/VmControlPanel.jsx:432`, `:446`, `:310`
- **What's wrong:** Same index-as-key pattern for VM chat log, event feed, and cloud-problem list.
- **Severity:** Medium/Low
- **Suggested fix:** Use `ev.id || ev.at` or generate stable IDs for feed events.

### M3. JWT travels in query strings — exposure in logs/history
- **File:** `src/services/api.js:1388-1394` (`sseUrl`), `src/services/vmRunnerApi.js:207-211` (WS `?token=`)
- **What's wrong:** The JWT is appended as `?accessToken=` (SSE) and `?token=` (noVNC/xterm WebSockets). URLs land in backend access logs, proxy logs, and browser history.
- **Why it's a bug:** Token-in-URL is a known exposure vector; a leaked log line = full account takeover until JWT expiry.
- **Severity:** Medium (acknowledged as necessary for EventSource/WS, but blast radius should be reduced)
- **Suggested fix:** Issue short-lived single-purpose stream tokens server-side instead of the full session JWT.

### M4. `removeModelLocal` crashes on empty (204) DELETE responses
- **File:** `src/services/localModelApi.js:52-66` (`localFetch`)
- **What's wrong:** `localFetch` does `return res.json()` after any `res.ok` — including a `204 No Content` DELETE response, where `.json()` throws `SyntaxError`.
- **Why it's a bug:** A successful model deletion surfaces as a JSON-parse error to the UI instead of success.
- **Severity:** Medium
- **Suggested fix:** Return `null`/`{}` when `res.status === 204` or the body is empty.

### M5. `startVm` timeout (60s) is shorter than a real Kali first boot
- **File:** `src/services/vmRunnerApi.js:122-128`
- **What's wrong:** `startVm` aborts the client request after 60s, but a first-time Kali VM boot takes several minutes. The server keeps booting after the client gives up — and the session token was already stored.
- **Why it's a bug:** UI reports "start failed" while the VM actually boots in the background; a retry creates a duplicate/conflicting session.
- **Severity:** Medium
- **Suggested fix:** Make start asynchronous (return 202 immediately, poll `/vm/status`) or raise the timeout substantially.

### M6. `callPredict` parses the first `data:` line instead of the final one
- **File:** `src/services/gradioDirect.js:153-162`
- **What's wrong:** `text.match(/data: (.*)/)` takes the *first* `data:` line of the SSE poll response. Gradio queue responses contain multiple `data:` lines; the completion payload is the last one. The `JSON.parse(m[1])` is also unguarded.
- **Why it's a bug:** Wrong/partial brain replies, or spurious "Empty reply" failures on healthy Gradio endpoints.
- **Severity:** Medium
- **Suggested fix:** Match all `data:` lines and parse the last one; wrap `JSON.parse` and continue polling on failure.

### M7. Duplicated JWT-key constant + duplicated fetch helpers in `localModelApi.js`
- **File:** `src/services/localModelApi.js:67-74`, lines ~34-50 vs ~52-66
- **What's wrong:** The JWT localStorage key is duplicated as a string literal instead of importing `getStoredJwt` from api.js; two fetch wrappers (`localMachineFetch` vs `localFetch`) do exactly the same thing.
- **Why it's a bug:** If `api.js` ever changes `JWT_KEY`, these calls silently lose auth. Duplicate code drifts (the C3 param-name bug exists only in the local copies).
- **Severity:** Medium
- **Suggested fix:** Import `getStoredJwt` from `./api.js`; delete one of the two fetch wrappers.

### M8. Voice abort resolves as success instead of rejecting
- **File:** `src/services/voice.js:174-190` (abort handler inside `playWavWithLipSync`)
- **What's wrong:** On abort, the handler calls `done()` (which calls `resolve()`) and then `reject(...)` — the reject is a no-op after resolve, so the promise *fulfills*.
- **Why it's a bug:** Callers awaiting `speak()` cannot distinguish "speech finished" from "speech was interrupted" — interruption logic (e.g. barge-in) misbehaves.
- **Severity:** Medium
- **Suggested fix:** On abort, stop the source and reject with `AbortError` *without* calling `done()`'s resolve path.

### M9. Unencoded path parameters in three ingestion endpoints
- **File:** `src/services/api.js:312`, `:325`, `:330`
- **What's wrong:** `getIngestion`, `getExactChunk`, `summarizeDocument` interpolate `conversationId`/`inputId`/`chunkRef` without `encodeURIComponent`, while nearly every other function in the file encodes path params.
- **Why it's a bug:** IDs containing `/`, `?`, `#`, or spaces break the route or get truncated (404s).
- **Severity:** Medium
- **Suggested fix:** Wrap each interpolated segment in `encodeURIComponent(...)`.

### M10. SSE `onerror` fires on transient reconnects — spurious "interrupted" errors
- **File:** `src/services/api.js` (all 10 `subscribeTo*` functions, e.g. lines 478, 620, 972)
- **What's wrong:** `source.onerror` unconditionally calls `onError(...)` with a terminal-sounding message, but EventSource fires `error` on every transient drop *and then auto-reconnects*. No reconnection backoff/limit either.
- **Why it's a bug:** UI shows "connection interrupted" banners while the stream is actually recovering; infinite default retries = request churn against a dead backend.
- **Severity:** Medium
- **Suggested fix:** Debounce the error (only report after N consecutive failures or a grace period); implement capped exponential-backoff reconnection.

### M11. `createTopupOrder` passes the amount through with zero client validation
- **File:** `src/services/api.js:1798-1803`
- **What's wrong:** `amountInr` is stringified as-is — negative, zero, NaN, or fractional values go straight to `/billing/topup/order`.
- **Why it's a bug:** The product rule is "min ₹10 top-up" — the client should enforce its own floor rather than relying entirely on server validation.
- **Severity:** Medium
- **Suggested fix:** Validate `Number.isFinite(amountInr) && amountInr >= 10` and throw before the request.

### M12. Permission mode sync has a last-write-wins race
- **File:** `src/services/permissions.js:74-94`
- **What's wrong:** `loadPermissionModeFromServer()` overwrites localStorage with the server value whenever it resolves. If the user toggles the mode locally while a load is in flight, the stale server value clobbers the fresh choice.
- **Why it's a bug:** The safety-critical "ask every time" mode can be silently flipped back to "full" by a delayed response.
- **Severity:** Medium
- **Suggested fix:** Track a local revision/timestamp; only apply the server value if no local change happened after the request started.

### M13. `speakWithInfinityVoice` drops cookie auth
- **File:** `src/services/voice.js:37-52`
- **What's wrong:** The voice `/speak` fetch attaches the JWT header but omits `credentials: 'include'`, which the central `request()` always sends.
- **Why it's a bug:** Cookie-only sessions get 401 on voice while everything else works.
- **Severity:** Medium
- **Suggested fix:** Add `credentials: 'include'`.

### M14. Stale hunt data can overwrite the current hunt's panels
- **File:** `src/pages/agent/HuntView.jsx` (mount effect ~lines 129-150)
- **What's wrong:** `refreshDetail()` and `refreshReport()` are fired inside the effect but are not guarded by the `cancelled` flag that protects `getJobState`. If `jobId` changes while those fetches are in flight, late responses call `setFindings`/`setDiary`/`setSurface`/`setReport` with the previous hunt's data.
- **Why it's a bug:** Classic stale-overwrite race — opening hunt B quickly after hunt A can paint A's findings onto B's screen.
- **Severity:** Medium
- **Suggested fix:** Check the `cancelled` flag before applying results in `refreshDetail`/`refreshReport`, or use `AbortController`.

### M15. Terminal backfill can land after live events — log goes out of order
- **File:** `src/pages/agent/HuntTerminal.jsx` (~lines 88-105)
- **What's wrong:** The effect fires `getJobActivity(jobId, 120)` (backfill) and `subscribeToJobEvents` (live stream) concurrently. The backfill `.then` appends older items whenever it resolves — possibly after SSE events were already pushed.
- **Why it's a bug:** The terminal is a chronological log; older backfilled lines appearing after newer live lines breaks ordering.
- **Severity:** Medium
- **Suggested fix:** Buffer SSE events until the backfill resolves, or tag items with timestamps and sort.

### M16. Composer stays disabled up to 8 seconds after every reply when voice is muted
- **File:** `src/pages/agent/InfinityAI.jsx:571-581` (`sendText`, in `ChatPane`)
- **What's wrong:** When TTS is unavailable/muted, the code simulates the speaking animation with `await new Promise(r => setTimeout(r, speakMs))` where `speakMs` scales with reply length, up to 8000 ms — all while `sending` is true, which disables the input, mic, and send button.
- **Why it's a bug:** A long reply locks the user out of typing for up to 8 seconds for a purely cosmetic animation.
- **Severity:** Medium
- **Suggested fix:** Don't gate the composer on the fake animation (release `sending` right after the reply renders).

### M17. File-preview race — rapid clicks can show the wrong file
- **File:** `src/pages/agent/InfinityAI.jsx:952-961` (`openPreview`, in `BuildPane`)
- **What's wrong:** `openPreview` awaits `readWorkspaceFile(filePath)` then calls `setPreview(...)`. Two quick clicks on different files race; the last response to resolve wins, regardless of click order.
- **Why it's a bug:** The preview pane can display file A's content labeled as file B.
- **Severity:** Medium
- **Suggested fix:** Track a request token (or `AbortController`) and only apply the result if it matches the latest requested path.

### M18. Slot rows hardcode `Q4_K_M`, ignoring the actual quant
- **File:** `src/pages/agent/ModelLibrary.jsx:714, 723, 774` (`BrainSlotCard`)
- **What's wrong:** Slot-model rows call `onResumeDownload(m.id, 'Q4_K_M')`, `onDownload(m.id, 'Q4_K_M')`, and Retry with `'Q4_K_M'` hardcoded, while the catalog `ModelCard` lets the user pick a quant.
- **Why it's a bug:** Resuming a paused Q8 download forces a Q4_K_M download instead — wrong artifact, wasted bandwidth.
- **Severity:** Medium
- **Suggested fix:** Pass through the model's selected/default quant.

### M19. No guard against concurrent downloads — the first download is orphaned
- **File:** `src/pages/agent/ModelLibrary.jsx` (`startDownload`, ~line 1510)
- **What's wrong:** `startDownload` unsubscribes the SSE progress listener and overwrites the single global `download` state, but never cancels an in-flight backend download for another model. Download buttons have no disabled state while a download is active.
- **Why it's a bug:** Two backend downloads can run simultaneously while the UI tracks only the latest; the first becomes invisible and un-cancellable.
- **Severity:** Medium
- **Suggested fix:** Disable other Download buttons while `download` is active, and cancel the previous backend download.

### M20. No client-side JWT expiry validation, no refresh
- **File:** `src/services/api.js:43-57`, `src/auth/AuthContext.jsx`
- **What's wrong:** `getStoredJwt()` returns the raw token with no `exp`-claim check, and `loginAccount`/`registerAccount` ignore the `jwtExpiresAt` the backend returns. An expired token sits in `localStorage` and is attached to every request until a 401 arrives. No refresh mechanism exists.
- **Why it's a bug:** Users hit avoidable 401s; the app could proactively re-authenticate.
- **Severity:** Medium
- **Suggested fix:** Decode the JWT `exp` client-side in `getStoredJwt()` and treat expired tokens as absent.

### M21. Stale closure: `askAgent` captures first-render `onActivity`/`onEmotion` forever
- **File:** `src/components/agent/AgentChat.jsx:80` (`useCallback(..., [])`)
- **What's wrong:** The callback uses `onActivity?.(...)` and `onEmotion?.(...)` but deps are `[]`, so it permanently calls the *first render's* prop functions.
- **Why it's a bug:** If the parent passes new inline callbacks, avatar activity/emotion updates silently go to stale handlers.
- **Severity:** Medium
- **Suggested fix:** Add `onActivityRef`/`onEmotionRef` refs (same pattern as the existing `voiceStateCbRef`).

### M22. In-flight `askAgent` reply lands in the wrong hunt's log
- **File:** `src/components/agent/AgentChat.jsx:80` + jobId reseed effect (~lines 60-69)
- **What's wrong:** If `jobId` changes mid-request, the reseed clears `messages`, but the old request's `setMessages(prev => [...prev, reply])` still fires afterwards, appending hunt A's reply into hunt B's conversation. `waitingRef` also stays `true`, blocking input on the new hunt.
- **Why it's a bug:** Cross-hunt message pollution; input blocked.
- **Severity:** Medium
- **Suggested fix:** Capture the `jobId` at request start and ignore the response if `jobRef.current` no longer matches; reset `waitingRef` in the reseed effect.

### M23. Uncleaned `setTimeout` in `askAgent`'s `finally`
- **File:** `src/components/agent/AgentChat.jsx:135`
- **What's wrong:** `setTimeout(() => onActivity?.('idle'), 2600)` is never cleared on unmount or on a new request.
- **Why it's a bug:** After navigation within 2.6s of an ask, it fires against an unmounted component's captured props.
- **Severity:** Medium
- **Suggested fix:** Store the timer id in a ref; clear on unmount and before starting a new ask.

### M24. VNC stays input-locked after reconnect when the agent is idle
- **File:** `src/components/agent/VmScreen.jsx:55` + `93-97`
- **What's wrong:** `connect()` hardcodes `viewOnly: true`, and the enforcement effect only re-runs when `locked` changes. On any reconnect while `agentRunning === false`, the RFB instance is recreated view-only and nothing ever sets it back — the user sees an unlocked-looking screen they cannot click.
- **Why it's a bug:** User cannot interact with the VM screen after reconnect without toggling agent state.
- **Severity:** Medium
- **Suggested fix:** Pass the current `locked` value into `connect()` (`viewOnly: locked`).

### M25. `seenIdsRef` Set grows unboundedly in HackerTerminal
- **File:** `src/components/agent/HackerTerminal.jsx:89-103`
- **What's wrong:** `lines` are capped at 2000, but the dedup `Set` in `seenIdsRef` is never pruned.
- **Why it's a bug:** Over very long hunts it accumulates every event id ever seen (memory growth).
- **Severity:** Medium
- **Suggested fix:** Prune the set when trimming `lines`, or use a bounded LRU.

---

## LOW BUGS (polish)

### L1. Dead theme state in App.jsx
- **File:** `src/App.jsx:108` — `const [theme] = useState('dark');`
- **What's wrong:** The state setter is destructured away; `theme` is hardcoded and can never change.
- **Severity:** Low
- **Suggested fix:** Remove `useState` or implement the theme toggle properly.

### L2. Production bundle exceeds recommended size
- **File:** Build output — `dist/assets/index-*.js` is 1,198 KB (335 KB gzip); Vite emits a chunk-size warning.
- **Severity:** Low (performance)
- **Suggested fix:** `React.lazy()` + `Suspense` for route-level code splitting.

### L3. `request()` error message hardcodes port 4000
- **File:** `src/services/api.js:90-96`
- **What's wrong:** When `VITE_BACKEND_URL` points elsewhere (e.g. Render), the "Start the backend on port 4000" message is wrong.
- **Severity:** Low
- **Suggested fix:** Use the configured base URL in the message.

### L4. `normalizeTargetUrl` strips trailing `!` and `?`
- **File:** `src/services/api.js:132-135`
- **What's wrong:** A legitimate URL ending in `?` or `!` gets mangled.
- **Severity:** Low
- **Suggested fix:** Restrict stripping to `>,;)]}"'` characters.

### L5. `apiClient` omits several exported functions
- **File:** `src/services/api.js:1636-1725`
- **What's wrong:** `streamDirectChat`, `takeComputerScreenshot`, `pauseComputer`, `resumeComputer`, `parseActionIntent`, `getBillingSubscription`, `subscribeToEngineStream` are exported but missing from the `apiClient` map.
- **Severity:** Low
- **Suggested fix:** Add the missing functions to the map.

### L6. `connectKaggleSlot` accepts plain `http://` URLs
- **File:** `src/services/gradioDirect.js:65-79`
- **What's wrong:** Only checks `^https?://` — an http:// brain link is sniffable.
- **Severity:** Low
- **Suggested fix:** Warn or require https.

### L7. `vmEndpoint.getVmEndpoint` returns local URLs even in cloud mode
- **File:** `src/services/vmEndpoint.js:74-86`
- **What's wrong:** `baseUrl` falls back to local defaults regardless of `mode`; only `isVmConnectable()` gates use.
- **Severity:** Low
- **Suggested fix:** Return `baseUrl: null` for cloud to make misuse impossible.

### L8. `doctorOnFailure`'s `/doctor` probe has no timeout
- **File:** `src/services/vmRunnerApi.js:48-62`
- **What's wrong:** If the runner accepts the connection but hangs, the friendly error never arrives.
- **Severity:** Low
- **Suggested fix:** Add an AbortController (~5s).

### L9. `downloadModelLocal`/`runModelOnLocal` don't encode/validate path params
- **File:** `src/services/localModelApi.js:187, 224`
- **Severity:** Low
- **Suggested fix:** Encode `modelId`; validate `slot` against `['vision','grounding','hacker']`.

### L10. Index keys + truncation churn in the terminal
- **File:** `src/pages/agent/HuntTerminal.jsx` — lines render with `key={i}` while the list is capped via `.slice(-400)`; once over the cap, every new line shifts all indices and forces a full re-render of ~400 rows.
- **Severity:** Low (perf)
- **Suggested fix:** Use a stable id (timestamp + counter) as the key.

### L11. Avatar-idle timers never cleaned up
- **File:** `src/pages/agent/InfinityAI.jsx:536,545` — `setTimeout(() => onAvatarState?.('idle'), 2500)` fires even if the pane unmounted.
- **Severity:** Low
- **Suggested fix:** Track and clear the timer.

### L12. Mode-switch links don't clear errors
- **File:** `src/pages/Auth/Login.jsx` — the bottom "Create an account"/"Sign in" switch buttons call only `setMode(...)`; a previous error message persists (the tab buttons above correctly call `setError('')`).
- **Severity:** Low
- **Suggested fix:** Call `setError('')` in the switch handlers too.

### L13. Title flash on every navigation
- **File:** `src/pages/agent/AgentConsole.jsx` (`RouteTitle`) — the effect cleanup resets `document.title = 'Dark Matter'` before the next effect sets the real title, causing a tab-title flash.
- **Severity:** Low
- **Suggested fix:** Remove the unnecessary cleanup.

### L14. Unguarded `fit.fit()` on terminal mount
- **File:** `src/components/agent/VmTerminal.jsx:115`
- **What's wrong:** If the host div has zero size at mount, `FitAddon.fit()` throws, aborting the effect *before* React registers the cleanup — the xterm instance is never disposed on unmount (leak).
- **Severity:** Low
- **Suggested fix:** Wrap in try/catch like the resize handler at line 117.

### L15. Double dispose of xterm subscriptions
- **File:** `src/components/agent/VmTerminal.jsx:138` + `closeSocket` (44-50) — cleanup calls `termSubsRef.current?.()` then `closeSocket()`, which calls it again.
- **Severity:** Low (xterm tolerates it, but fragile)
- **Suggested fix:** Have `closeSocket` null `termSubsRef.current` after invoking it.

### L16. RFB listeners never removed
- **File:** `src/components/agent/VmScreen.jsx:63-78` — `addEventListener` per `connect()` but `disconnect()` never calls `removeEventListener`.
- **Severity:** Low (old instances are GC'd, but stale closures survive until GC)
- **Suggested fix:** Remove listeners in `disconnect()`.

### L17. `refreshKey` churns on every navigation
- **File:** `src/components/agent/AgentShell.jsx:295` — `location.key` is unique per history entry, so histories refetch on *every* navigation.
- **Severity:** Low (perf)
- **Suggested fix:** Key the refresh only on `${location.pathname}:${histTick}`.

### L18. RunnerStatusCard has no in-flight guard on its 15s poll
- **File:** `src/components/agent/RunnerStatusCard.jsx:28-42` — `setInterval(check, 15000)` can overlap `check()` calls if probes stall.
- **Severity:** Low
- **Suggested fix:** Skip a tick while a check is in flight, or use chained `setTimeout`.

### L19. Speech recognition has no stuck-state recovery
- **File:** `src/hooks/useSpeechRecognition.js:88` — `start()` silently returns if `recRef.current` exists; if a recognizer wedges, the mic button becomes permanently dead until unmount.
- **Severity:** Low
- **Suggested fix:** In `start()`, if an existing instance is present and not listening, `teardown()` it first.

### L20. `useVoiceConversation.handleFinal` doesn't guard `processing`
- **File:** `src/hooks/useVoiceConversation.js:35-46` — checks `activeRef` but not `processing`, so in `continuous: true` mode a second transcript arriving mid-turn starts an overlapping turn.
- **Severity:** Low
- **Suggested fix:** `if (!activeRef.current || processingRef.current || !text) return;`.

### L21. Kaggle-cell copy timer not cleaned up
- **File:** `src/pages/agent/ModelLibrary.jsx` (inside `BrainSlotCard`'s modal) — `setTimeout(() => setCellCopied(false), 2000)` has no unmount cleanup.
- **Severity:** Low
- **Suggested fix:** Track and clear the timer.

---

## VERIFIED CLEAN (reviewed, no bugs found)

| File | Area checked | Result |
|------|--------------|--------|
| `src/main.jsx` | Mount-node guard, StrictMode | ✅ Proper loud failure if `#root` missing |
| `src/auth/AuthContext.jsx` | Token lifecycle, route guards | ✅ `cancelled` flag; stale JWT cleared on 401; loading handled; redirect target preserved |
| `src/services/backendMode.js` | Backend URL resolution | ✅ Single source of truth; 10s timeout with proper cleanup |
| `src/services/vmEndpoint.js` | Runner endpoint config | ✅ Tokens never persisted to localStorage |
| `src/components/agent/LiveScreenViewer.jsx` | Screenshot polling | ✅ Interval cleared; `useCallback` memoization; backoff on failure |
| `src/components/agent/RunnerStatusCard.jsx` | Runner health polling | ✅ Interval cleared; `alive` flag guards stale updates |
| `src/components/agent/VmControlPanel.jsx` (polling) | VM status polling | ✅ Interval cleared on cleanup/session change |
| `src/hooks/useSpeechRecognition.js` | Speech API lifecycle | ✅ Proper teardown |
| `src/pages/agent/HuntView.jsx` | Data fetching, SSE | ✅ `cancelled` flag; SSE unsubscribe; errors handled |
| Global | `console.log` / `debugger` | ✅ None in production code |
| `src/services/api.js` | Logout, backend-URL resolution | ✅ JWT cleared in `finally`; `lib/apiBase.js` single source of truth honored |

---

## SUMMARY

| Severity | Count | IDs |
|----------|-------|-----|
| Critical | 5 | C1 (VM brains never wired), C2 (dead SSE: scan/assessment), C3 (wrong SSE auth param), C4 (`setSlotAssignments` undefined), C5 (`/register` route broken) |
| High | 11 | H1 (no API timeout), H2 (chat stream: no auth + no abort), H3 (Gradio retry ~15min), H4 (model download OOM), H5 (`simulate=true` default), H6 (auth boot nukes session), H7 (wrong slot key), H8 (download dead-end), H9 (Stop/Remove wrong backend), H10 (landing drops URL), H11 (permission sync unhandled) |
| Medium | 25 | M1–M25 (keys, JWT-in-URL, 204 crash, VM start timeout, Gradio SSE parse, dup JWT key, voice abort, unencoded params, SSE onerror, topup validation, permission race, voice cookie, stale hunt data, terminal ordering, composer lock, preview race, hardcoded quant, concurrent downloads, JWT expiry, stale closures, cross-hunt reply, uncleaned timeout, VNC input lock, unbounded Set) |
| Low | 21 | L1–L21 (theme state, bundle size, port-4000 message, URL strip, apiClient gaps, http brain links, cloud endpoint, doctor timeout, path params, terminal keys, avatar timers, login errors, title flash, fit guard, double dispose, RFB listeners, refresh churn, poll guard, speech stuck, voice processing, copy timer) |

**Top priority for the morning:**
1. **C1** — VM Control is completely inoperable (flagship feature).
2. **C4** — Model slot runs crash with ReferenceError (successful ops show as failures).
3. **C5** — `/register` route shows sign-in instead of sign-up.
4. **C2 + C3** — two SSE stream families are dead under JWT-only auth.
5. **H1** — hung backend freezes the UI with no recovery.
6. **H5** — `simulate=true` default silently violates the no-mock product rule.
7. **H6** — any network blip at load logs the user out.

**Note:** All three specialist hunter reports (pages, services, auth/hooks/components) are fully merged above. No fixes were applied per the find-only constraint.
