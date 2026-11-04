#!/bin/bash
# Dark Matter hunt container entrypoint.
# Emits JSON event lines on stdout -> backend tails `docker logs`.
# Env: DM_HUNT_ID, DM_TARGET, DM_MODE (no cloud credentials — the host is the brain)

set -u

emit() {
  printf '%s\n' "$1"
}

# json_escape (#353): run.sh used to interpolate raw $TARGET/$HOST straight
# into JSON event lines, so a target containing a double-quote or
# backslash emitted an unparseable line that any JSON consumer silently
# drops. Escape the JSON-critical characters (backslash first, then
# quote, then CR/LF/TAB) in pure bash — no jq dependency, so this works
# even on images where jq is absent.
json_escape() {
  local s="$1"
  s=${s//\\/\\\\}
  s=${s//\"/\\\"}
  s=${s//$'\n'/\\n}
  s=${s//$'\r'/\\r}
  s=${s//$'\t'/\\t}
  printf '%s' "$s"
}

TARGET="${DM_TARGET:-}"
HUNT_ID="${DM_HUNT_ID:-unknown}"
MODE="${DM_MODE:-normal}"

if [ -z "$TARGET" ]; then
  emit "{\"type\":\"status\",\"state\":\"failed\",\"huntId\":\"$(json_escape "$HUNT_ID")\",\"error\":\"no target\"}"
  exit 1
fi

HOST="$(echo "$TARGET" | sed -e 's|https\?://||' -e 's|/.*||')"

emit "{\"type\":\"status\",\"state\":\"started\",\"huntId\":\"$(json_escape "$HUNT_ID")\",\"target\":\"$(json_escape "$TARGET")\",\"mode\":\"$(json_escape "$MODE")\"}"
emit "{\"type\":\"thinking\",\"huntId\":\"$(json_escape "$HUNT_ID")\",\"text\":\"Profiling target $(json_escape "$HOST")\"}"

# Tool inventory (#352): the image build used to swallow install failures
# (|| true), so hunts ran degraded with no signal. Required tools now fail
# the build, but the one deliberate best-effort tool (ysoserial) and any
# future drift are REPORTED here in the event stream instead of silently
# skipping phases below. Uses the existing `thinking` event type so the
# backend parses it with no changes.
MISSING=""
for t in nmap nuclei tmux ttyd ysoserial jq; do
  command -v "$t" >/dev/null 2>&1 || MISSING="$MISSING $t"
done
if [ -n "$MISSING" ]; then
  emit "{\"type\":\"thinking\",\"huntId\":\"$(json_escape "$HUNT_ID")\",\"text\":\"Tool inventory: missing:$(json_escape "$MISSING") — phases using them will skip\"}"
fi

# Phase 1: DNS + port recon
if command -v nmap >/dev/null 2>&1; then
  emit "{\"type\":\"thinking\",\"huntId\":\"$(json_escape "$HUNT_ID")\",\"text\":\"Running port scan on $(json_escape "$HOST")\"}"
  nmap -T4 --top-ports 1000 "$HOST" 2>/dev/null | grep -E "^[0-9]+/tcp.*open" | head -20 | while read -r line; do
    port="$(echo "$line" | cut -d/ -f1)"
    svc="$(echo "$line" | awk '{print $3}')"
    emit "{\"type\":\"tool_call\",\"huntId\":\"$(json_escape "$HUNT_ID")\",\"tool\":\"nmap\",\"detail\":\"open port $(json_escape "$port") ($(json_escape "$svc"))\"}"
  done
fi

# Phase 2: nuclei scan (if templates present)
if command -v nuclei >/dev/null 2>&1; then
  emit "{\"type\":\"thinking\",\"huntId\":\"$(json_escape "$HUNT_ID")\",\"text\":\"Running nuclei vulnerability scan\"}"
  nuclei -u "$TARGET" -silent -json 2>/dev/null | head -50 | while read -r finding; do
    emit "{\"type\":\"finding\",\"huntId\":\"$(json_escape "$HUNT_ID")\",\"source\":\"nuclei\",\"raw\":$(echo "$finding" | jq -c . 2>/dev/null || echo null)}"
  done
fi

# Phase 3: stay alive — the HOST backend (backend/src/huntAgent.js) is the SOLE
# brain and drives this container via `docker exec`. There is intentionally NO
# in-container model loop (no Bedrock/AWS calls from inside the sandbox).
emit "{\"type\":\"thinking\",\"huntId\":\"$(json_escape "$HUNT_ID")\",\"text\":\"Hands ready — awaiting host brain instructions\"}"
emit "{\"type\":\"status\",\"state\":\"ready\",\"huntId\":\"$(json_escape "$HUNT_ID")\"}"

# --- Live terminal streaming (PiP) ---
# Start the agent's persistent shell inside tmux (the "screen" users watch).
# ttyd serves it read-only over WebSocket. It MUST bind 0.0.0.0 inside the
# container: docker publishes the port on host loopback only
# (-p 127.0.0.1:PORT:PORT), but published traffic arrives at the
# container's eth0 address — a container-loopback-only bind (127.0.0.1)
# accepts nothing there, so every host-side connection reset and every
# Live Terminal rendered blank. Host-side exposure is unchanged
# (loopback-only publish); only the container-side bind widens.
if command -v tmux >/dev/null 2>&1 && command -v ttyd >/dev/null 2>&1; then
  tmux new-session -d -s huntshell -x 120 -y 32 2>/dev/null || true
  TTYD_PORT="${DM_TTYD_PORT:-17681}"
  ttyd --port "$TTYD_PORT" --interface 0.0.0.0 tmux attach-session -t huntshell >/dev/null 2>&1 &
  emit "{\"type\":\"thinking\",\"huntId\":\"$(json_escape "$HUNT_ID")\",\"text\":\"Live terminal streaming ready\"}"
fi

# Keep the container alive for the whole hunt; the host destroys it on
# terminal stop/timeout. `exec` replaces this shell so signals propagate.
exec sleep infinity
