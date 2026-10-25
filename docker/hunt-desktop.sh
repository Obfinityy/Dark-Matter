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
#   xfce4         FULL desktop — xfce4-session + xfwm4 + xfce4-panel +
#                 xfdesktop + thunar + xfce4-terminal (owner order
#                 25 Oct 2026: a complete OS, not a bare window manager)
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

# XFCE session liveness — the desktop is only "already running" when
# the session manager is up too (a dead panel with a live Xvfb is not
# a desktop; the script then falls through and restarts the session).
xfce_alive() {
  pgrep -x xfce4-session >/dev/null 2>&1
}

# --- Real Kali look (25 Oct 2026) -------------------------------------------
# The image ships the Kali XFCE theme (kali-themes): Kali-Dark GTK + xfwm4
# theme, Flat-Remix-Blue-Dark icons (incl. the kali-panel-menu dragon),
# the kali-cubes dragon wallpaper, the Kali whisker menu + panel layout
# and the Kali menu categories. Installing the packages makes them the
# SYSTEM defaults — kali-themes' postinst copies them to /etc/xdg — so a
# fresh session already looks like Kali. This function enforces the same
# look on the LIVE session via xfconf-query: it heals a session that
# started with the stock XFCE values, and it is idempotent (fast-path
# return when theme and wallpaper are already Kali), so the supervisor
# re-runs cost two xfconf reads. Guarded throughout: a missing theme, a missing
# xfconf-query, or an unreachable xfconfd logs once and moves on — the
# desktop must never fail because of a theme. Paths are overridable for
# tests (DM_KALI_THEME_DIR / DM_KALI_WALLPAPER); production leaves them
# unset and gets /usr/share/....
KALI_THEME_DIR="${DM_KALI_THEME_DIR:-/usr/share/themes/Kali-Dark}"
KALI_WALLPAPER="${DM_KALI_WALLPAPER:-/usr/share/backgrounds/kali-16x9/default}"

apply_kali_theme() {
  [ -d "$KALI_THEME_DIR" ] || return 0
  command -v xfconf-query >/dev/null 2>&1 || return 0
  # Wait for xfconfd (started with the session) — bounded, never fatal.
  # 5s is ample (the session already had 2s before this runs) and the
  # screenshot poller re-runs this script every ~3s while the owner
  # watches, so a missed apply is retried on the next poll.
  local i
  for i in $(seq 1 25); do
    if xfconf-query -c xsettings -l >/dev/null 2>&1; then break; fi
    sleep 0.2
  done
  if ! xfconf-query -c xsettings -l >/dev/null 2>&1; then
    log "kali theme: xfconf not reachable after 5s — skipping live apply (file defaults still apply at next session start)"
    return 0
  fi
  # Which monitor xfdesktop 4.20 keys the backdrop to: the RandR output
  # name (Xvfb reports "screen"), NOT the numeric monitor0. xrandr may
  # be absent — then fall back to monitor0.
  local current wallpaper_now monitor_name
  current=$(xfconf-query -c xsettings -p /Net/ThemeName 2>/dev/null) || current=""
  monitor_name=$(xrandr --query 2>/dev/null | awk '$2 == "connected" {print $1; exit}') || monitor_name=""
  [ -n "$monitor_name" ] || monitor_name="0"
  wallpaper_now=$(xfconf-query -c xfce4-desktop -p "/backdrop/screen0/monitor${monitor_name}/workspace0/image-path" 2>/dev/null) || wallpaper_now=""
  # Fast path: already the Kali look — theme AND wallpaper both set.
  # (26 Oct 2026: a theme-only check skipped the wallpaper entirely on
  # a fresh session, whose theme already comes up Kali-Dark from the
  # /etc/xdg defaults — the desktop stayed black.) No wallpaper file in
  # this image: nothing to check for it, the theme alone decides.
  if [ "$current" = "Kali-Dark" ] && { [ ! -e "$KALI_WALLPAPER" ] || [ "$wallpaper_now" = "$KALI_WALLPAPER" ]; }; then return 0; fi
  # GTK + icons + fonts (Kali defaults, kali-themes' xsettings.xml).
  xfconf-query -c xsettings -p /Net/ThemeName -n -t string -s Kali-Dark
  xfconf-query -c xsettings -p /Net/IconThemeName -n -t string -s Flat-Remix-Blue-Dark
  xfconf-query -c xsettings -p /Gtk/FontName -n -t string -s 'Cantarell 11'
  xfconf-query -c xsettings -p /Gtk/MonospaceFontName -n -t string -s 'Fira Code Medium 10'
  # Window-manager theme + title font (kali-themes' xfwm4.xml).
  xfconf-query -c xfwm4 -p /general/theme -n -t string -s Kali-Dark
  xfconf-query -c xfwm4 -p /general/title_font -n -t string -s 'Cantarell Bold 9'
  # Dragon wallpaper (Kali default: the path is a symlink to kali-cubes.jpg;
  # image-style 5 = zoomed). xfdesktop 4.20 reads the backdrop from the
  # PER-MONITOR-NAME properties — /backdrop/screen0/monitor<NAME>/workspace0/
  # — where <NAME> is the RandR output name (Xvfb: "screen"). The numeric
  # monitor0 paths and the monitor-level path are legacy locations this
  # xfdesktop migrates away from and never reads; they are still set below
  # so older xfdesktop versions and the /etc/xdg default stay in agreement.
  # The session's user config can carry empty image-path values that
  # override the /etc/xdg default, so set it explicitly on the live
  # session every apply. last-image is for older xfdesktop; the unused
  # one is inert. xfdesktop picks the change up via the xfconf
  # notification and redraws (proven live 26 Oct 2026: blue -> purple
  # with no restart) — `xfdesktop --reload` cannot reach the running
  # instance here (no session bus: it exits "xfdesktop is not running"),
  # so there is no reload call.
  if [ -e "$KALI_WALLPAPER" ]; then
    local m
    for m in "monitor${monitor_name}" monitor0; do
      xfconf-query -c xfce4-desktop -p "/backdrop/screen0/${m}/workspace0/image-path" -n -t string -s "$KALI_WALLPAPER"
      xfconf-query -c xfce4-desktop -p "/backdrop/screen0/${m}/workspace0/last-image" -n -t string -s "$KALI_WALLPAPER"
      xfconf-query -c xfce4-desktop -p "/backdrop/screen0/${m}/workspace0/image-style" -n -t int -s 5
      xfconf-query -c xfce4-desktop -p "/backdrop/screen0/${m}/workspace0/image-show" -n -t bool -s true
    done
    xfconf-query -c xfce4-desktop -p /backdrop/screen0/monitor0/image-path -n -t string -s "$KALI_WALLPAPER"
    xfconf-query -c xfce4-desktop -p /backdrop/screen0/monitor0/image-style -n -t int -s 5
    xfconf-query -c xfce4-desktop -p /backdrop/screen0/monitor0/image-show -n -t bool -s true
  fi
  # Menu button: a fresh session already gets whiskermenu first with
  # button-icon=kali-panel-menu (the dragon) from Kali's panel default.
  # If this session's panel still has the stock applicationsmenu (an older
  # ~/.config), swap that one plugin to whiskermenu. The panel is restarted
  # only if the restart answers (timeout-bounded; the container has no
  # reliable D-Bus session bus, so a failed restart just means the dragon
  # appears at the next panel start — the config is already correct).
  if command -v xfce4-panel >/dev/null 2>&1; then
    local j val
    for j in $(seq 1 30); do
      val=$(xfconf-query -c xfce4-panel -p "/plugins/plugin-$j" 2>/dev/null) || continue
      if [ "$val" = "applicationsmenu" ]; then
        xfconf-query -c xfce4-panel -p "/plugins/plugin-$j" -t string -s whiskermenu
        xfconf-query -c xfce4-panel -p "/plugins/plugin-$j/button-icon" -n -t string -s kali-panel-menu
        log "kali theme: panel plugin-$j applicationsmenu -> whiskermenu (dragon menu button)"
        if command -v timeout >/dev/null 2>&1; then
          timeout 5 xfce4-panel -r >>"$LOG_FILE" 2>&1 || log "kali theme: panel restart not available — dragon menu appears at next panel start"
        else
          xfce4-panel -r >>"$LOG_FILE" 2>&1 || log "kali theme: panel restart not available — dragon menu appears at next panel start"
        fi
        break
      fi
    done
  fi
  log "kali theme applied (Kali-Dark + Flat-Remix-Blue-Dark + kali-cubes wallpaper)"
}

if [ -f "$READY_FILE" ] && pgrep -x Xvfb >/dev/null 2>&1 && chromium_healthy && xfce_alive; then
  apply_kali_theme
  echo "desktop already running"
  exit 0
fi

for bin in Xvfb startxfce4 xfce4-terminal chromium x11vnc websockify xdotool scrot; do
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

# --- Window manager: XFCE full desktop --------------------------------------
# Owner order 25 Oct 2026: a complete operating system — applications
# menu, panel, desktop icons, file manager — not a bare window manager
# with a thin taskbar. startxfce4 starts the session (xfce4-session +
# xfwm4 + xfce4-panel + xfdesktop).
# Ctrl+Alt+T: XFCE reads ~/.config/xfce4/xfconf/xfce-perchannel-xml/
# xfce4-keyboard-shortcuts.xml at session start, so write the binding
# BEFORE the session first starts. Only created when missing — never
# clobber an existing config.
XFCONF_DIR="${HOME:-/root}/.config/xfce4/xfconf/xfce-perchannel-xml"
mkdir -p "$XFCONF_DIR"
if [ ! -f "$XFCONF_DIR/xfce4-keyboard-shortcuts.xml" ]; then
  cat > "$XFCONF_DIR/xfce4-keyboard-shortcuts.xml" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<channel name="xfce4-keyboard-shortcuts" version="1.0">
  <property name="commands" type="empty">
    <property name="custom" type="empty">
      <property name="&lt;Primary&gt;&lt;Alt&gt;t" type="string" value="xfce4-terminal"/>
    </property>
  </property>
</channel>
EOF
  log "xfce shortcut: Ctrl+Alt+T -> xfce4-terminal"
fi

if ! xfce_alive; then
  log "starting xfce (startxfce4)"
  startxfce4 >>"$LOG_FILE" 2>&1 &
  sleep 2
fi

# Real Kali look: enforce Kali-Dark + dragon wallpaper + dragon menu on the
# live session (file defaults in /etc/xdg already do this for a fresh
# session; this heals one that started with stock values). Idempotent.
apply_kali_theme

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
