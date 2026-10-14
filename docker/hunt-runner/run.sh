#!/bin/bash
# Dark Matter hunt container entrypoint.
# Emits JSON event lines on stdout -> backend tails `docker logs`.
# Env: DM_HUNT_ID, DM_TARGET, DM_MODE, AWS_* / BEDROCK_MODEL

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

# Phase 3: hand off to the Bedrock agent loop (node)
if [ -f /opt/hunt/agent.js ]; then
  emit "{\"type\":\"thinking\",\"huntId\":\"$HUNT_ID\",\"text\":\"Starting Bedrock agent loop\"}"
  node /opt/hunt/agent.js
  rc=$?
  if [ $rc -ne 0 ]; then
    emit "{\"type\":\"status\",\"state\":\"failed\",\"huntId\":\"$HUNT_ID\",\"error\":\"agent loop exited $rc\"}"
    exit $rc
  fi
else
  emit "{\"type\":\"thinking\",\"huntId\":\"$HUNT_ID\",\"text\":\"Recon complete (agent loop not bundled)\"}"
fi

emit "{\"type\":\"status\",\"state\":\"finished\",\"huntId\":\"$HUNT_ID\"}"
