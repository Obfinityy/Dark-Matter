#!/bin/bash
# Dark Matter hunt container — on-demand GUI desktop stack.
#
# Gives the hunt machine a real desktop the agent can drive (Chromium +
# xdotool) and the owner can watch (see backend GET /hunts/:id/desktop.jpg).
#
# Started ON DEMAND by the host backend (huntRunner.startHuntDesktop) via
# `docker exec` — never at container boot, so ordinary hunts pay nothing
# for it. Idempotent: re-running while the desktop is up is a no-op.
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
READY_FILE=/tmp/dm-desktop.ready
LOG_FILE=/tmp/dm-desktop.log
SCREEN_W="${DM_DESKTOP_WIDTH:-1280}"
SCREEN_H="${DM_DESKTOP_HEIGHT:-800}"

log() { printf '%s\n' "$*" >>"$LOG_FILE" 2>/dev/null || true; }

if [ -f "$READY_FILE" ] && pgrep -x Xvfb >/dev/null 2>&1; then
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
if ! pgrep -x fluxbox >/dev/null 2>&1; then
  log "starting fluxbox"
  fluxbox >>"$LOG_FILE" 2>&1 &
  sleep 1
fi

# --- Chromium (the agent's browser) -----------------------------------------
if ! pgrep -f 'remote-debugging-port=9222' >/dev/null 2>&1; then
  log "starting chromium (CDP 127.0.0.1:9222)"
  nohup chromium \
    --no-sandbox \
    --disable-dev-shm-usage \
    --disable-gpu \
    --no-first-run \
    --start-maximized \
    --remote-debugging-address=127.0.0.1 \
    --remote-debugging-port=9222 \
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
