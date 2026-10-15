# VNC / PiP Live Screen Streaming — Implementation Plan

**Status:** PLAN ONLY — not implemented. For main-agent review.
**Date:** 15 Oct 2026
**Goal:** Picture-in-Picture: a small live view of what the Kali hunt container is
doing; click to expand. Read-only for viewers (chat remains the steering channel).

---

## 1. Key architectural fact (drives the whole recommendation)

The hunt container (`darkmatter/hunt:latest`, `docker/Dockerfile.hunt`) is
**headless and CLI-only**:

- Entrypoint is `docker/hunt-runner/run.sh` — emits JSON event lines on stdout.
- The backend drives everything via `docker exec` (`execInHuntContainer()` in
  `backend/src/huntRunner.js`) and tails `docker logs`.
- There is **no X server, no window manager, no desktop** in the container.
- The agent's real work = terminal commands (nmap, nuclei, sqlmap, curl…).
  Browser work is headless chromium + selenium (no visible GUI).

**Consequence:** a classic VNC desktop would show an *empty, idle desktop* —
not what the agent is doing — unless we re-architect all agent execution to
run inside a GUI terminal. That is heavy and low-truth-value. The honest
"screen" of this agent is its **terminal**.

---

## 2. Recommendation: ttyd + tmux + xterm.js (NOT full VNC)

### Chosen approach

| Layer | Choice |
|---|---|
| In-container terminal server | **ttyd** (single static C binary, WebSocket PTY) |
| Agent shell session | **tmux** session `huntshell` — all agent commands routed through it |
| Backend | Authenticated WebSocket reverse-proxy to the container's ttyd port |
| Frontend | **xterm.js** in a floating PiP component, read-only |
| Browser moments | Selenium `save_screenshot()` → `GET /api/v1/hunts/:id/screenshot` (Phase 2) |

### Why not full VNC (Option A: Xvfb + xfce + x11vnc + noVNC)

| | Full VNC | ttyd (chosen) |
|---|---|---|
| Image size delta | +400–600 MB (xfce4, x11vnc, xvfb, websockify, fonts) | **+~4 MB** (ttyd binary + tmux) |
| Runtime RAM | ~200–350 MB (Xvfb + WM + x11vnc + websockify) | **~5–15 MB** (ttyd idle ≈ 0% CPU) |
| CPU | Constant framebuffer poll + encode on 2 vCPU shared with Ollama | Encodes only on terminal output |
| Truthfulness | Shows idle desktop; agent commands run via `docker exec`, invisible in VNC | Shows the **actual** agent shell, every command live |
| Auth | VNC password to manage/rotate per hunt | Backend JWT ticket (existing auth infra) |

### Why not screenshot-polling (Option B: `docker exec` + screencapture → MJPEG)

- There is no X framebuffer to capture — would need Xvfb anyway (same cost as VNC).
- Polling `docker exec` every 1–2 s adds backend exec overhead and latency; ttyd
  pushes over WebSocket with no polling.
- Rendering the transcript as images is derived/fake-ish; a real PTY stream is better.

### Why ttyd over alternatives (wetty, gotty, webtty, tty-share)

- **ttyd** is a single static binary, actively maintained (tsl0922/ttyd), no
  Node/Python runtime needed in the container, ~2–3 MB.
- Speaks raw WebSocket; xterm.js is the standard browser renderer (~150 KB gz).
- **Read-only by default** — viewers watch; no `--writable` flag means no
  keystroke injection into the hunt. (wetty/gotty need extra config for this.)

---

## 3. Docker image changes (`docker/Dockerfile.hunt`)

```dockerfile
# --- Live terminal streaming (PiP) ---
# ttyd: single static binary, serves the agent's PTY over WebSocket.
RUN curl -sL https://github.com/tsl0922/ttyd/releases/latest/download/ttyd.x86_64 \
      -o /usr/local/bin/ttyd && chmod +x /usr/local/bin/ttyd
RUN apt-get update && apt-get install -y --no-install-recommends tmux \
    && rm -rf /var/lib/apt/lists/*
```

`docker/hunt-runner/run.sh` additions (at startup, after the existing emits):

```bash
# Start the agent's persistent shell inside tmux (the "screen" users watch).
tmux new-session -d -s huntshell -x 120 -y 32
# Serve it read-only over WebSocket on loopback only. Port from env.
TTYD_PORT="${DM_TTYD_PORT:-17681}"
ttyd --port "$TTYD_PORT" --interface 127.0.0.1 \
     tmux attach-session -t huntshell &
```

Notes:
- **No `--writable`** → read-only. This is a deliberate security decision.
- Binds `127.0.0.1` only; the port is published on the host loopback
  (`-p 127.0.0.1:<port>:<port>`) so only the backend can reach it.
- One hunt runs at a time (one-hunt guard + queue), so a **fixed port**
  (e.g. `17681`, env-overridable via `DM_TTYD_PORT`) is safe. If the
  one-hunt invariant ever changes, allocate per-hunt ports and store in hunt meta.

---

## 4. Backend changes (`backend/src/huntRunner.js`)

### 4a. Publish the ttyd port (loopback only)

In `spawnHuntContainer()`, add to the `docker run` args:

```js
'-p', `127.0.0.1:${TTYD_PORT}:${TTYD_PORT}`,
'-e', `DM_TTYD_PORT=${TTYD_PORT}`,
```

with `const TTYD_PORT = process.env.HUNT_TTYD_PORT || '17681';`

### 4b. Route agent commands through tmux (makes the terminal truthful)

Today `execInHuntContainer(huntId, cmd)` runs one-shot `docker exec` — each
command is a separate shell, invisible in any shared terminal. Change it to:

1. `docker exec <c> tmux send-keys -t huntshell -l <shell-escaped cmd>`
2. `docker exec <c> tmux send-keys -t huntshell Enter`
3. Wrap: actually send `{ <cmd>; echo "DM_EXIT:$?"; }` so we can capture the
   exit code deterministically.
4. Poll `docker exec <c> tmux capture-pane -p -t huntshell` until the
   `DM_EXIT:` sentinel appears (or timeout).
5. Parse stdout (text between command echo and sentinel) + exit code.

This keeps the existing `{stdout, stderr, code}` contract — callers
(`huntAgent.js`, `orchestrator.js`) don't change — while every command and its
output appears live in the tmux session that ttyd streams.

**Caveats to handle in implementation:**
- `send-keys -l` sends literal text (no shell interpretation of the keys
  themselves); still shell-escape/validate `cmd` length as today (500–1000 chars).
- Long-running commands: keep the existing timeout params; on timeout,
  `tmux send-keys -t huntshell C-c` to interrupt, then read partial pane.
- Interactive commands (e.g. prompts) — the agent already avoids these; add a
  `timeout` wrapper inside the shell as a backstop.
- Fallback: if tmux isn't running in the container (old image), fall back to
  the current one-shot `docker exec` behaviour so hunts don't break.

### 4c. New API endpoints (all auth-gated)

```
GET /api/v1/hunts/:id/terminal/ticket
  → { ok, ticket } — short-lived (60 s) JWT bound to {userId, huntId}.
    Requires: logged in + owns the hunt (or admin). Hunt must be active.

WS  /api/v1/hunts/:id/terminal?ticket=<ticket>
  → Validates ticket (no session cookie needed — WS-friendly), checks the
    hunt is still active and the container's ttyd port is reachable, then
    proxies bidirectionally: client WS ↔ http://127.0.0.1:17681/ws
    (ttyd's own WebSocket endpoint). Read-only: ttyd was started without
    --writable, so client input is ignored server-side anyway; ALSO drop
    client→server messages at the proxy as defence in depth.
    Rate-limit: max 2 concurrent viewers per hunt (configurable).

GET /api/v1/hunts/:id/screenshot   (Phase 2)
  → Latest selenium screenshot if the agent captured one, else 204.
    Agent captures via driver.save_screenshot('/tmp/dm-shot.png');
    backend pulls with `docker cp` or `docker exec cat | base64`.
```

Proxy implementation: use the `ws` package (check if already a dep; the
existing `/api/v1/hunts/:id/stream` WS can serve as the code pattern).
Do NOT expose ttyd directly — always through the backend, always ticketed.

---

## 5. Frontend changes (`frontend/src/`)

New files:

```
src/components/HuntPiP.jsx
  - Floating, draggable mini window (bottom-right), ~320×200.
  - xterm.js Terminal with the fit addon; connects via useHuntTerminal(huntId).
  - Header: red "● LIVE" dot, hunt target (truncated), expand + close buttons.
  - Auto-scroll locked to bottom; shows "reconnecting…" on drop.
  - Only rendered when the hunt is active (running/paused) and the user owns it.

src/components/HuntTerminalModal.jsx   (expanded view)
  - Larger terminal + tabs: [ Terminal | Browser ] (Browser tab = Phase 2).
  - Same read-only stream; bigger scrollback.
  - Opened from PiP expand button. (Voice "Talk with AI" button lives here
    too — separate voice-call feature, not this plan.)

src/hooks/useHuntTerminal.js
  - Fetches ticket from /terminal/ticket, opens WS, wires xterm.js,
    exponential-backoff reconnect (max ~5 tries), cleanup on unmount.
```

Integration points:
- `HuntCard.jsx`: mount `<HuntPiP huntId={...}/>` when hunt state is
  `running`/`paused`. PiP is per-hunt; closing it is per-session UI state
  (don't persist — reopen on next visit if hunt still active).
- Deps to add: `xterm`, `@xterm/addon-fit` (check `package.json` first).

Styling: match the ChatGPT-exact dark UI (#212121/#171717); monospace
terminal with the existing accent colour for the LIVE dot.

---

## 6. Security considerations

1. **Read-only by design.** ttyd started without `--writable`; the backend
   proxy additionally drops all client→server frames. Viewers cannot type
   into the agent's shell — steering stays in mid-hunt chat (existing).
2. **No direct exposure.** ttyd binds `127.0.0.1` inside the container; the
   host publishes it on `127.0.0.1` only. The only path in is the ticketed
   backend WS. nginx should NOT add a location for the ttyd port.
3. **Ticket auth.** 60-second single-purpose JWTs bound to (userId, huntId);
   validated on WS upgrade. Hunt-ownership check (or admin role) on both
   ticket issue and WS connect. Ticket cannot be reused after hunt ends —
   proxy re-checks hunt state on connect.
4. **Scope isolation.** The terminal shows only that hunt's container shell;
   the container itself is already network-scoped per hunt (existing).
5. **Secrets.** The agent shell may print tokens/keys in output (existing
   risk, same as `docker logs`). No new secret surface: don't log tickets.
6. **Resource abuse.** Cap viewers (2/hunt), WS idle timeout (e.g. 10 min),
   and kill the proxy when the container is torn down (hook into
   `teardownHuntContainer`).
7. **Container escape.** ttyd is a small audited C program; still, it runs
   as the container user — keep the existing non-root guidance for the image
   if/when that's hardened (out of scope for this plan).

---

## 7. Estimated resource overhead (EC2: 2 vCPU / 8 GB, backend + Ollama)

| Item | Cost |
|---|---|
| Image size | +~4 MB (ttyd + tmux) — negligible vs current Kali image |
| ttyd process | ~5–15 MB RAM, ~0% CPU idle; brief spikes only when terminal output bursts |
| tmux server | ~3–8 MB RAM |
| Backend WS proxy | ~1–2 MB per viewer; 2 viewers max |
| Frontend | xterm.js ~150 KB gz, one-time |
| vs full VNC | saves ~200–350 MB RAM and constant CPU — the reason VNC was rejected |

Ollama (dolphin3-abliterated:8b) remains the dominant consumer; the PiP stack
is noise next to it.

---

## 8. Phased rollout

- **Phase 1 (this plan):** image + run.sh + spawn port + tmux-routed exec +
  ticket/WS proxy + PiP component + expanded modal. Read-only terminal streaming.
- **Phase 2:** browser-screenshot tab — agent calls `save_screenshot()` during
  selenium recon; `GET /screenshot` serves the latest; shown beside the terminal.
- **Phase 3 (optional):** session recording (tmux logging → replay), viewer
  count, admin view of any hunt's terminal.

## 9. Testing checklist (for implementation)

1. Spawn hunt → `curl 127.0.0.1:17681` on EC2 responds (ttyd up).
2. `docker exec <c> tmux ls` shows `huntshell`.
3. Run a hunt command → appears in `tmux capture-pane` AND returns correct
   `{stdout, stderr, code}` via `execInHuntContainer`.
4. Ticket without auth → 401; ticket for another user's hunt → 403.
5. WS with expired ticket → rejected at upgrade.
6. PiP shows live `nmap` output during a real hunt; expand works; close works.
7. Kill container mid-view → frontend shows "hunt ended", WS closes cleanly.
8. 2 viewers OK; 3rd viewer rejected (or queued — decide at implementation).

---

## 10. Open questions for main agent

1. Keep the fixed port `17681`, or allocate per-hunt now in anticipation of
   multi-hunt? (Recommendation: fixed — the one-hunt guard + queue make
   collisions impossible today; revisit if that invariant changes.)
2. Should paused hunts keep the terminal attached (frozen frame) or show
   "paused"? (Recommendation: keep attached, stream idles — cheapest.)
3. xterm.js vs plain `<pre>` + SSE fallback for very old browsers?
   (Recommendation: xterm.js; the user base is modern browsers.)
