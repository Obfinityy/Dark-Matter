#!/usr/bin/env python3
"""AT-SPI helper — click a NAMED control inside a GUI app (REAL-HUMAN lane).

Runs INSIDE the hunt container (stdin pipe, no file install needed):
  echo <b64> | base64 -d | python3 - list [window-substring]
  echo <b64> | base64 -d | python3 - click <control-name> [window-substring]

The brain is text-only: it names a control ("Repeater", "Send"), and
this script resolves the name in the app's accessibility tree and
performs the click there. No pixel coordinates cross the wire.

  list  — dump the accessible tree of the matching window (or the
          active window when no substring is given): name/role/rect
          for every showing control, capped. Read-only.
  click — find the first control whose name contains the query
          (exact, then starts-with, then contains; actionable roles
          first) and invoke its "click" action. Reports what it
          clicked, or why it could not.

Exit contract: ALWAYS prints one JSON object to stdout and exits 0:
  {"ok": true, ...} on success, {"ok": false, "error": "..."} on
  any failure — a missing pyatspi, a missing registry, a missing
  session bus, or a control that is not there. The Node side never
  parses a traceback; the error string IS the observation.

Environment: the script finds the D-Bus session bus itself — the
docker-exec shell has no DBUS_SESSION_BUS_ADDRESS, but the running
xfce4-session does. It reads /proc/*/environ for the first address
it finds (the desktop session's own bus). If no bus exists, it
says so instead of hanging on D-Bus activation.
"""

import json
import os
import sys


def find_session_bus():
    addr = os.environ.get("DBUS_SESSION_BUS_ADDRESS")
    if addr:
        return addr
    try:
        for pid in os.listdir("/proc"):
            if not pid.isdigit():
                continue
            try:
                with open("/proc/%s/environ" % pid, "rb") as f:
                    env = f.read().split(b"\0")
            except (OSError, IOError):
                continue
            for item in env:
                if item.startswith(b"DBUS_SESSION_BUS_ADDRESS="):
                    return item.split(b"=", 1)[1].decode("utf-8", "replace")
    except OSError:
        pass
    return ""


def fail(msg):
    print(json.dumps({"ok": False, "error": msg}))
    return 0


def walk(acc, out, depth=0):
    """Depth-first walk of one accessible subtree, collecting showing controls."""
    if len(out) >= 200 or depth > 12:
        return
    try:
        name = acc.name or ""
    except Exception:
        name = ""
    try:
        role = acc.getRoleName()
    except Exception:
        role = ""
    rect = None
    try:
        comp = acc.queryComponent()
        x, y = comp.getPosition(0)  # DESKTOP_COORDS
        w, h = comp.getSize()
        rect = [int(x), int(y), int(w), int(h)]
    except Exception:
        rect = None
    try:
        state = acc.getState()
        showing = state.contains(pyatspi.STATE_SHOWING)  # 25 — NOT 9 (9 is EXPANDABLE; the old literal silently dropped every non-expandable control, so list/click always came back empty)
    except Exception:
        showing = True
    if name and rect and showing:
        out.append({"name": name, "role": role, "rect": rect})
    try:
        n = acc.childCount
    except Exception:
        return
    for i in range(n):
        try:
            walk(acc.getChildAtIndex(i), out, depth + 1)
        except Exception:
            continue


def find_windows(desktop, substr):
    """All top-level application windows whose title contains substr (or all)."""
    wins = []
    try:
        n = desktop.childCount
    except Exception:
        return wins
    for i in range(n):
        try:
            app = desktop.getChildAtIndex(i)
        except Exception:
            continue
        try:
            m = app.childCount
        except Exception:
            continue
        for j in range(m):
            try:
                win = app.getChildAtIndex(j)
            except Exception:
                continue
            try:
                title = win.name or ""
            except Exception:
                continue
            if not title:
                continue
            if substr and substr.lower() not in title.lower():
                continue
            wins.append(win)
    return wins


def main(argv):
    if len(argv) < 2 or argv[1] not in ("list", "click"):
        return fail("usage: list [window] | click <control-name> [window]")
    cmd = argv[1]
    if cmd == "click" and len(argv) < 3:
        return fail("click needs a control name")
    control_name = argv[2] if cmd == "click" else ""
    window_sub = argv[3] if cmd == "click" and len(argv) > 3 else (argv[2] if cmd == "list" and len(argv) > 2 else "")

    bus = find_session_bus()
    if not bus:
        return fail("no D-Bus session bus found in this container (the desktop session is not running a bus) — AT-SPI cannot work here")
    os.environ["DBUS_SESSION_BUS_ADDRESS"] = bus
    try:
        import pyatspi
    except ImportError:
        return fail("pyatspi is not installed in this image (python3-pyatspi missing) — in-app clicking needs the image rebuild; use desktop_key keyboard navigation instead")
    try:
        desktop = pyatspi.Registry.getDesktop(0)
    except Exception as e:
        return fail("AT-SPI registry is not reachable (%s) — at-spi2-core may be missing from this image; use desktop_key keyboard navigation instead" % str(e)[:160])

    wins = find_windows(desktop, window_sub)
    if not wins:
        if window_sub:
            return fail("no window matching \"%s\" exposes an accessibility tree" % window_sub)
        return fail("no application window exposes an accessibility tree right now (Java apps need the Java Access Bridge; some apps only expose a tree while focused)")

    if cmd == "list":
        controls = []
        for w in wins[:3]:
            walk(w, controls)
        print(json.dumps({"ok": True, "windows": [w.name for w in wins[:3]], "controls": controls[:200]}))
        return 0

    # click: exact name, then starts-with, then contains; actionable roles first.
    actionable = {"push button", "toggle button", "menu item", "page tab", "check box", "radio button", "link", "combo box", "list item", "tree item"}
    candidates = []
    for w in wins[:3]:
        controls = []
        walk(w, controls)
        for c in controls:
            candidates.append((w, c))
    q = control_name.lower()
    ranked = []
    for w, c in candidates:
        name = (c["name"] or "").lower()
        if not name:
            continue
        if name == q:
            rank = 0
        elif name.startswith(q):
            rank = 1
        elif q in name:
            rank = 2
        else:
            continue
        if c["role"].lower() in actionable:
            rank -= 0.5
        ranked.append((rank, w, c))
    if not ranked:
        return fail("no control named \"%s\" found in %s — the app may expose no accessibility tree (Java apps need the Java Access Bridge), or the control is named differently; list the window's controls first" % (control_name, ", ".join(w.name for w in wins[:3])))
    ranked.sort(key=lambda t: t[0])
    _, win, ctrl = ranked[0]
    # Re-find the live accessible object for the click (the walk kept
    # only its name/role/rect — re-walk the window to get the object).
    target = None
    stack = [win]
    want = ctrl["name"]
    while stack and target is None:
        acc = stack.pop()
        try:
            if (acc.name or "") == want:
                target = acc
                break
        except Exception:
            pass
        try:
            for i in range(acc.childCount):
                stack.append(acc.getChildAtIndex(i))
        except Exception:
            continue
    if target is None:
        return fail("found \"%s\" in the tree listing but could not re-resolve it to click — try again" % ctrl["name"])
    try:
        action = target.queryAction()
    except Exception:
        return fail("\"%s\" (%s) exposes no clickable action — use desktop_key keyboard navigation instead" % (ctrl["name"], ctrl["role"]))
    clicked = False
    try:
        for i in range(action.nActions):
            if action.getName(i).lower() == "click":
                action.doAction(i)
                clicked = True
                break
    except Exception as e:
        return fail("click on \"%s\" failed: %s" % (ctrl["name"], str(e)[:160]))
    if not clicked:
        return fail("\"%s\" (%s) has actions (%s) but no click — use desktop_key keyboard navigation instead" % (
            ctrl["name"], ctrl["role"],
            ", ".join(action.getName(i) for i in range(action.nActions))[:120]))
    print(json.dumps({"ok": True, "clicked": {"name": ctrl["name"], "role": ctrl["role"], "window": win.name}}))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
