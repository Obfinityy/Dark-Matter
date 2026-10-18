#!/bin/bash
# Ollama wedge watchdog v3 (19 Oct 2026).
#
# v2 problem (seen live 19:47/19:52Z 18 Oct 2026): the probe is a full
# /api/chat inference with a 120s timeout. A real hunt inference takes
# 10-15 min on 2vCPU, so ANY two consecutive 5-min probes during one hunt
# inference both time out -> the watchdog kills a HEALTHY busy server.
# Kill -> model reload -> in-flight hunt request dies with HTTP 500
# "unexpected EOF" -> "Model gave no reply" -> 3x -> pause ai_no_reply ->
# monitor resumes -> the cycle repeats and no test ever executes.
#
# v3 fix: the backend writes an inference heartbeat
# ($AI_HEARTBEAT_PATH, default /opt/Dark-Matter/.ai-inference-active)
# carrying a deadline before every Ollama call and deletes it after.
# While the heartbeat is fresh, the server is BUSY (not wedged) — skip the
# kill and reset the failure counter. The deadline (not file existence) is
# the signal, so a crashed backend can never wedge the watchdog off.
#
# Kill conditions (unchanged otherwise): 2 CONSECUTIVE inference-probe
# failures with NO fresh heartbeat.
MODEL="${OLLAMA_MODEL:-dm-hunter}"
STATE_FILE="/opt/Dark-Matter/.ollama-watchdog-state"
HEARTBEAT="${AI_HEARTBEAT_PATH:-/opt/Dark-Matter/.ai-inference-active}"
LOG="/opt/Dark-Matter/ollama-watchdog.log"

heartbeat_fresh() {
  # Fresh = file exists AND (deadline in the future OR mtime < 25 min ago).
  # Deadline is authoritative; mtime is the fallback for hand-written files.
  if [ ! -f "$HEARTBEAT" ]; then return 1; fi
  local now deadline deadline_s mtime
  now=$(date +%s)
  # NOTE: the backend writes deadline in MILLISECONDS (Date.now()).
  deadline=$(python3 -c "import json,sys; print(json.load(open('$HEARTBEAT')).get('deadline',0))" 2>/dev/null || echo 0)
  deadline_s=$((deadline / 1000))
  if [ "$deadline_s" -gt "$now" ] 2>/dev/null; then return 0; fi
  mtime=$(stat -c %Y "$HEARTBEAT" 2>/dev/null || echo 0)
  if [ $((now - mtime)) -lt 1500 ]; then return 0; fi
  return 1
}

RESP=$(curl -s --max-time 120 -X POST http://127.0.0.1:11434/api/chat \
  -d "{\"model\":\"$MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"Say OK.\"}],\"stream\":false,\"options\":{\"num_predict\":3}}" \
  -o /dev/null -w '%{http_code}' 2>/dev/null)
if [ "$RESP" = "200" ]; then
  echo 0 > "$STATE_FILE"
  echo "$(date -u +%FT%TZ) Ollama OK (model=$MODEL)" >> "$LOG"
else
  if heartbeat_fresh; then
    echo 0 > "$STATE_FILE"
    echo "$(date -u +%FT%TZ) Ollama probe http=$RESP but inference heartbeat fresh — busy on hunt inference, NOT killing" >> "$LOG"
    exit 0
  fi
  FAILS=$(cat "$STATE_FILE" 2>/dev/null || echo 0)
  FAILS=$((FAILS + 1))
  echo $FAILS > "$STATE_FILE"
  if [ $FAILS -ge 2 ]; then
    echo "$(date -u +%FT%TZ) Ollama wedged 2x (http=$RESP, model=$MODEL, no heartbeat), killing stuck llama-server" >> "$LOG"
    echo 0 > "$STATE_FILE"
    sudo pkill -f 'llama-server --model'
  else
    echo "$(date -u +%FT%TZ) Ollama slow/unresponsive (http=$RESP, fail=$FAILS/2), not killing yet" >> "$LOG"
  fi
fi
