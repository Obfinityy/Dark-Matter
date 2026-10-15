#!/bin/bash
# Dark Matter hunt container entrypoint.
# Emits JSON event lines on stdout -> backend tails `docker logs`.
# Env: DM_HUNT_ID, DM_TARGET, DM_MODE (no cloud credentials — the host is the brain)

set -u

emit() {
  printf '%s\n' "$1"
}

TARGET="${DM_TARGET:-}"
HUNT_ID="${DM_HUNT_ID:-unknown}"
MODE="${DM_MODE:-normal}"

if [ -z "$TARGET" ]; then
  emit "{\"type\":\"status\",\"state\":\"failed\",\"huntId\":\"$HUNT_ID\",\"error\":\"no target\"}"
  exit 1
fi

HOST="$(echo "$TARGET" | sed -e 's|https\?://||' -e 's|/.*||')"

emit "{\"type\":\"status\",\"state\":\"started\",\"huntId\":\"$HUNT_ID\",\"target\":\"$TARGET\",\"mode\":\"$MODE\"}"
emit "{\"type\":\"thinking\",\"huntId\":\"$HUNT_ID\",\"text\":\"Profiling target $HOST\"}"

# Phase 1: DNS + port recon
if command -v nmap >/dev/null 2>&1; then
  emit "{\"type\":\"thinking\",\"huntId\":\"$HUNT_ID\",\"text\":\"Running port scan on $HOST\"}"
  nmap -T4 --top-ports 1000 "$HOST" 2>/dev/null | grep -E "^[0-9]+/tcp.*open" | head -20 | while read -r line; do
    port="$(echo "$line" | cut -d/ -f1)"
    svc="$(echo "$line" | awk '{print $3}')"
    emit "{\"type\":\"tool_call\",\"huntId\":\"$HUNT_ID\",\"tool\":\"nmap\",\"detail\":\"open port $port ($svc)\"}"
  done
fi

# Phase 2: nuclei scan (if templates present)
if command -v nuclei >/dev/null 2>&1; then
  emit "{\"type\":\"thinking\",\"huntId\":\"$HUNT_ID\",\"text\":\"Running nuclei vulnerability scan\"}"
  nuclei -u "$TARGET" -silent -json 2>/dev/null | head -50 | while read -r finding; do
    emit "{\"type\":\"finding\",\"huntId\":\"$HUNT_ID\",\"source\":\"nuclei\",\"raw\":$(echo "$finding" | jq -c . 2>/dev/null || echo null)}"
  done
fi

# Phase 3: stay alive — the HOST backend (backend/src/huntAgent.js) is the SOLE
# brain and drives this container via `docker exec`. There is intentionally NO
# in-container model loop (no Bedrock/AWS calls from inside the sandbox).
emit "{\"type\":\"thinking\",\"huntId\":\"$HUNT_ID\",\"text\":\"Hands ready — awaiting host brain instructions\"}"
emit "{\"type\":\"status\",\"state\":\"ready\",\"huntId\":\"$HUNT_ID\"}"

# --- Live terminal streaming (PiP) ---
# Start the agent's persistent shell inside tmux (the "screen" users watch).
# ttyd serves it read-only over WebSocket on loopback only.
if command -v tmux >/dev/null 2>&1 && command -v ttyd >/dev/null 2>&1; then
  tmux new-session -d -s huntshell -x 120 -y 32 2>/dev/null || true
  TTYD_PORT="${DM_TTYD_PORT:-17681}"
  ttyd --port "$TTYD_PORT" --interface 127.0.0.1 tmux attach-session -t huntshell >/dev/null 2>&1 &
  emit "{\"type\":\"thinking\",\"huntId\":\"$HUNT_ID\",\"text\":\"Live terminal streaming ready\"}"
fi

# Keep the container alive for the whole hunt; the host destroys it on
# terminal stop/timeout. `exec` replaces this shell so signals propagate.
exec sleep infinity
