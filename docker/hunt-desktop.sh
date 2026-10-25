#!/bin/bash
# Dark Matter hunt container — on-demand GUI desktop stack.
#
# Gives the hunt machine a real desktop the agent can drive (Chromium +
# xdotool) and the owner can watch (see backend GET /hunts/:id/desktop.jpg).
#
# Started ON DEMAND by the host backend (huntRunner.startHuntDesktop) via
# `docker exec` — never at container boot, so ordinary hunts pay nothing
# for it. Idempotent: re-running while the desktop is up is a no-op.
# Chromium supervisor (25 Oct 2026): re-running the script also revives
# a DEAD Chromium — the early exit below requires Chromium's CDP
# endpoint to answer, not just Xvfb + the ready file (Chromium died
# silently 11:35:11Z with no crash signature and nothing revived it).
# The backend's screenshot poller re-runs this script every ~3s while
# the owner watches, so a future death is caught within one poll cycle
# without waiting for a browser action.
#
# Components (all bound to the container's loopback — NOTHING is published
# to the host or the network):
#   Xvfb          virtual display :99 (1280x800x24)
#   fluxbox       minimal window manager
#   Chromium      --remote-debugging-port=9222 on 127.0.0.1 (agent drives
#                 it via CDP from inside its own sandbox; the hacking brain
#                 on the host remains the sole decision-maker)
#   x11vnc        port 5900, -localhost, ALWAYS -viewonly (nobody can drive
#                 the desktop through VNC; viewing in v1 is via screenshots)
#   websockify    127.0.0.1:6080 -> VNC, serving noVNC (reserved for the v2
#                 streaming viewer; unused by the v1 screenshot route)
#
# Env:
#   DM_VNC_PASSWORD   optional; if set, x11vnc requires it (stored hashed
#                     under /root/.vnc/passwd). If unset, x11vnc runs -nopw
#                     but stays loopback-only + view-only, so it is not
#                     reachable from outside the container.
#   DM_DESKTOP_URL    first page Chromium opens (default about:blank).

set -u

export DISPLAY=:99
# Paths are overridable for tests (DM_DESKTOP_READY_FILE /
# DM_DESKTOP_LOG_FILE); production leaves them unset and gets /tmp.
READY_FILE="${DM_DESKTOP_READY_FILE:-/tmp/dm-desktop.ready}"
LOG_FILE="${DM_DESKTOP_LOG_FILE:-/tmp/dm-desktop.log}"
SCREEN_W="${DM_DESKTOP_WIDTH:-1280}"
SCREEN_H="${DM_DESKTOP_HEIGHT:-800}"

log() { printf '%s\n' "$*" >>"$LOG_FILE" 2>/dev/null || true; }

# --- Chromium liveness (supervisor, 25 Oct 2026) --------------------------
# The pgrep/pkill patterns use the bracket trick: pgrep -f matches ANY
# command line containing the literal pattern, INCLUDING the shell
# running the check itself (a plain 'remote-debugging-port=9222' check
# matched the diagnostic shell's own command line and reported phantom
# "live Chromium" PIDs). '922[2]' as a regex matches the string "9222",
# but the checking shell's own command line contains "922[2]", not
# "9222" — so it can never self-match.
chromium_process_alive() {
  pgrep -f 'remote-debugging-port=922[2]' >/dev/null 2>&1
}

chromium_cdp_up() {
  command -v curl >/dev/null 2>&1 || return 1
  curl -s --max-time 2 http://127.0.0.1:9222/json/version 2>/dev/null | grep -q 'webSocketDebuggerUrl'
}

# Healthy = the CDP endpoint answers. If curl is unavailable in the
# image, fall back to "a Chromium process exists", so a missing curl
# can never make a healthy browser look dead (and never get it killed
# by the wedge handling below).
chromium_healthy() {
  if command -v curl >/dev/null 2>&1; then
    chromium_cdp_up
  else
    chromium_process_alive
  fi
}

if [ -f "$READY_FILE" ] && pgrep -x Xvfb >/dev/null 2>&1 && chromium_healthy; then
  echo "desktop already running"
  exit 0
fi

for bin in Xvfb fluxbox chromium x11vnc websockify xdotool scrot; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "desktop tool missing from image: $bin" >&2
    exit 127
  fi
done

# --- Xvfb -----------------------------------------------------------------
if ! pgrep -x Xvfb >/dev/null 2>&1; then
  log "starting Xvfb :99 (${SCREEN_W}x${SCREEN_H}x24)"
  Xvfb :99 -screen 0 "${SCREEN_W}x${SCREEN_H}x24" >>"$LOG_FILE" 2>&1 &
fi

# Wait until the display answers (max ~10s).
for _ in $(seq 1 50); do
  if xdotool getdisplaygeometry >/dev/null 2>&1; then break; fi
  sleep 0.2
done
if ! xdotool getdisplaygeometry >/dev/null 2>&1; then
  echo "X display :99 did not come up" >&2
  exit 1
fi

# --- Window manager ---------------------------------------------------------
# Terminal launcher: the image ships no terminal emulator by default, so
# Ctrl+Alt+T did nothing and the right-click menu had no terminal entry
# (verified live 25 Oct 2026). fluxbox reads ~/.fluxbox/keys and
# ~/.fluxbox/menu at startup, so write them BEFORE it first starts.
# Only created when missing — never clobber an existing config. The keys
# file intentionally holds just the one binding (window switching still
# works by mouse: click to focus, titlebar buttons to close); the menu is
# the minimal hunt set (Terminal, Chromium, Exit). No desktop icon:
# fluxbox has no desktop-icon support (that needs idesk or similar).
FLUXBOX_DIR="${HOME:-/root}/.fluxbox"
mkdir -p "$FLUXBOX_DIR"
if [ ! -f "$FLUXBOX_DIR/keys" ]; then
  cat > "$FLUXBOX_DIR/keys" <<'EOF'
Control Mod1 T :Exec xterm
EOF
  log "fluxbox keys: Ctrl+Alt+T -> xterm"
fi
if [ ! -f "$FLUXBOX_DIR/menu" ]; then
  cat > "$FLUXBOX_DIR/menu" <<'EOF'
[begin] (fluxbox)
[exec] (Terminal) {xterm}
[exec] (Chromium) {chromium}
[separator]
[exit] (Exit)
[end]
EOF
  log "fluxbox menu: Terminal entry added"
fi

if ! pgrep -x fluxbox >/dev/null 2>&1; then
  log "starting fluxbox"
  fluxbox >>"$LOG_FILE" 2>&1 &
  sleep 1
fi

# --- Chromium (the agent's browser) -----------------------------------------
# Lane U: when the intercept proxy has been started for this hunt
# (proxy_start writes the marker with the proxy URL), Chromium is
# launched THROUGH it so every request/response is captured. Without
# the marker the launch is unchanged.
DM_PROXY_FLAG=""
if [ -f /tmp/dm-intercept/proxy.on ]; then
  DM_PROXY_FLAG="--proxy-server=$(cat /tmp/dm-intercept/proxy.on)"
fi
if chromium_process_alive && ! chromium_healthy; then
  # Wedged: a Chromium process exists but its CDP endpoint does not
  # answer. A new Chromium cannot bind port 9222 or the same profile
  # while the old one holds them, so kill the stale process first.
  # The dead process's exit code is unrecoverable — it was started
  # detached by an earlier run of this script and already reaped — so
  # log what IS known (pid(s), time, CDP unresponsive) to leave the
  # signature the 11:35Z death never had.
  log "chromium wedged: process present ($(pgrep -f 'remote-debugging-port=922[2]' | tr '\n' ' ')) but CDP 127.0.0.1:9222 unresponsive — killing stale chromium"
  pkill -f 'remote-debugging-port=922[2]' 2>/dev/null || true
  for _ in $(seq 1 10); do
    chromium_process_alive || break
    sleep 0.5
  done
fi
if ! chromium_process_alive; then
  log "starting chromium (CDP 127.0.0.1:9222${DM_PROXY_FLAG:+, via intercept proxy})"
  nohup chromium \
    --no-sandbox \
    --disable-dev-shm-usage \
    --disable-gpu \
    --no-first-run \
    --start-maximized \
    --remote-debugging-address=127.0.0.1 \
    --remote-debugging-port=9222 \
    $DM_PROXY_FLAG \
    "${DM_DESKTOP_URL:-about:blank}" >>"$LOG_FILE" 2>&1 &
fi

# --- x11vnc (view-only, loopback) -------------------------------------------
if ! pgrep -x x11vnc >/dev/null 2>&1; then
  if [ -n "${DM_VNC_PASSWORD:-}" ]; then
    mkdir -p /root/.vnc
    x11vnc -storepasswd "$DM_VNC_PASSWORD" /root/.vnc/passwd >/dev/null 2>&1
    log "starting x11vnc (view-only, password set)"
    x11vnc -display :99 -localhost -viewonly -forever -shared \
      -rfbauth /root/.vnc/passwd -rfbport 5900 >>"$LOG_FILE" 2>&1 &
  else
    log "starting x11vnc (view-only, no password — loopback only)"
    x11vnc -display :99 -localhost -viewonly -forever -shared \
      -nopw -rfbport 5900 >>"$LOG_FILE" 2>&1 &
  fi
fi

# --- websockify + noVNC (v2 streaming viewer plumbing; loopback only) -------
if ! pgrep -f 'websockify' >/dev/null 2>&1; then
  log "starting websockify 127.0.0.1:6080 -> 127.0.0.1:5900 (noVNC web root)"
  websockify --web /usr/share/novnc 127.0.0.1:6080 127.0.0.1:5900 >>"$LOG_FILE" 2>&1 &
fi

touch "$READY_FILE"
echo "desktop ready on :99 (chromium CDP 127.0.0.1:9222, vnc view-only 127.0.0.1:5900, novnc 127.0.0.1:6080)"
exit 0
