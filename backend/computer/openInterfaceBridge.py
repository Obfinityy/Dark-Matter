#!/usr/bin/env python3
"""
Open-Interface ↔ DARKMATTER computer bridge.

WHY THIS FILE EXISTS
--------------------
Open-Interface (https://github.com/AmberSahdev/Open-Interface) is a Python app
whose executor (`app/interpreter.py`) and screen layer (`app/utils/screen.py`)
are exactly the "hands" DARKMATTER needs:

    app/utils/screen.py   -> pyautogui.screenshot() / base64 PNG / temp file
    app/interpreter.py    -> sleep(secs) or getattr(pyautogui, name)(**params)
    app/resources/context.txt -> {"steps":[{"function","parameters","human_readable_justification"}], "done"}

Two unavoidable facts shape this bridge:

  1. DARKMATTER's backend is Node (ESM). Python cannot be imported from Node,
     so the computer layer is bridged over a process boundary — the same pattern
     DARKMATTER already uses for its Kali worker (KALI_WORKER_URL).
  2. Open-Interface's executor dispatches ANY pyautogui attribute by name
     (`hasattr(pyautogui, function_name)`), which is the Python equivalent of
     giving the LLM a raw shell. DARKMATTER must not do that.

So this bridge keeps Open-Interface's *primitives* and drops its *open
dispatch*:

  * ALLOWED_FUNCTIONS below is a closed whitelist. There is no generic
    command execution, no shell, no getattr-by-name.
  * THE LLM IS NOT CALLED HERE. This process never talks to a model. It only
    observes the screen and performs approved actions. The brain lives in
    DARKMATTER (local phone Gemma) — one brain, one place.

Protocol (newline-delimited JSON on stdin/stdout)
-------------------------------------------------
  request : {"id": "<str>", "cmd": "<action type>", "params": {...}}
  response: {"id": "<str>", "ok": true, "result": {...}}
            {"id": "<str>", "ok": false, "error": {"message": "...", "kind": "..."}}

Run:
  python bridge.py --probe        # print capabilities JSON, exit (no daemon)
  python bridge.py                # daemon mode
"""

import argparse
import base64
import hashlib
import io
import json
import os
import platform
import sys
import time
import traceback

# ── Optional imports: availability is reported honestly, never faked ────────
pyautogui = None
try:  # pragma: no cover - depends on the host desktop
    import pyautogui as _pyautogui  # type: ignore

    pyautogui = _pyautogui
    pyautogui.FAILSAFE = True  # Open-Interface's interrupt: cursor to a corner
    pyautogui.PAUSE = 0.05
except Exception as exc:  # pragma: no cover
    PYAUTOGUI_ERROR = f"{type(exc).__name__}: {exc}"
else:
    PYAUTOGUI_ERROR = None

PIL_AVAILABLE = True
try:  # pragma: no cover
    from PIL import Image  # noqa: F401
except Exception as exc:  # pragma: no cover
    PIL_AVAILABLE = False
    PIL_ERROR = f"{type(exc).__name__}: {exc}"
else:
    PIL_ERROR = None

# ── The closed action whitelist ────────────────────────────────────────────
ALLOWED_FUNCTIONS = {
    "screenshot",
    "click",
    "double_click",
    "move_mouse",
    "type",
    "press_key",
    "hotkey",
    "scroll",
    "sleep",
    "open_application",
    "navigate",
    "get_active_window",
    "get_browser_state",
}

SCREENSHOT_DIR = os.environ.get("COMPUTER_SCREENSHOT_DIR") or os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "..", "data", "computer"
)
MAX_SCREENSHOT_BYTES = int(os.environ.get("COMPUTER_MAX_SCREENSHOT_BYTES", "4000000"))
IS_WINDOWS = platform.system() == "Windows"
IS_MAC = platform.system() == "Darwin"
IS_LINUX = platform.system() == "Linux"


class BridgeError(Exception):
    def __init__(self, message, kind="bridge_error"):
        super().__init__(message)
        self.kind = kind


# ── Observation primitives (Open-Interface app/utils/screen.py) ─────────────
def screen_size():
    if pyautogui is None:
        raise BridgeError("pyautogui is not installed", "unavailable")
    width, height = pyautogui.size()
    return int(width), int(height)


def capture_screenshot():
    """pyautogui.screenshot() -> PNG bytes (the same call Open-Interface makes).

    Returns a persistence-friendly result: the PNG is written to
    COMPUTER_SCREENSHOT_DIR and also returned as base64 so the caller can store
    it as evidence. Large screenshots are never inlined into the model prompt.
    """
    if pyautogui is None:
        raise BridgeError("pyautogui is not installed", "unavailable")

    image = pyautogui.screenshot()  # ~100ms, same as Open-Interface
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    payload = buffer.getvalue()

    digest = hashlib.sha256(payload).hexdigest()
    os.makedirs(SCREENSHOT_DIR, exist_ok=True)
    filename = f"screenshot-{int(time.time() * 1000)}-{digest[:12]}.png"
    filepath = os.path.abspath(os.path.join(SCREENSHOT_DIR, filename))
    with open(filepath, "wb") as handle:
        handle.write(payload)

    width, height = image.size
    result = {
        "width": int(width),
        "height": int(height),
        "bytes": len(payload),
        "sha256": digest,
        "path": filepath,
        "capturedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    if len(payload) <= MAX_SCREENSHOT_BYTES:
        result["base64"] = base64.b64encode(payload).decode("ascii")
    else:
        result["base64Omitted"] = True
    return result


# ── Active window / browser state (best effort, reported honestly) ──────────
def active_window():
    """Return the foreground window. Honestly reports `supported: false`."""
    try:
        if IS_WINDOWS:  # pragma: no cover - Windows only
            import ctypes

            user32 = ctypes.windll.user32
            handle = user32.GetForegroundWindow()
            if not handle:
                return {"supported": True, "title": None, "reason": "no foreground window"}
            length = user32.GetWindowTextLengthW(handle)
            buffer = ctypes.create_unicode_buffer(length + 1)
            user32.GetWindowTextW(handle, buffer, length + 1)
            return {"supported": True, "title": buffer.value or None, "handle": int(handle)}
        if IS_LINUX:  # pragma: no cover - Linux only
            import subprocess

            title = subprocess.run(
                ["xdotool", "getactivewindow", "getwindowname"],
                capture_output=True,
                text=True,
                timeout=5,
            )
            if title.returncode == 0:
                return {"supported": True, "title": title.stdout.strip() or None}
            return {"supported": False, "reason": "xdotool unavailable"}
        if IS_MAC:  # pragma: no cover - macOS only
            # No AppleScript and no elevated helpers: report unsupported rather
            # than silently doing something privileged.
            return {"supported": False, "reason": "macOS active-window lookup not enabled"}
    except Exception as exc:  # pragma: no cover
        return {"supported": False, "reason": f"{type(exc).__name__}: {exc}"}
    return {"supported": False, "reason": f"unsupported platform {platform.system()}"}


def browser_state(params):
    """Browser state we can actually justify: window title + last navigation.

    Open-Interface does not read the address bar from the DOM; it reasons from
    screenshots. We do not invent a URL we cannot verify. When the caller has
    performed a `navigate`, it passes that in `params.lastUrl` and we return it
    explicitly tagged as remembered-not-observed.
    """
    window = active_window()
    title = window.get("title") if window.get("supported") else None
    browsers = ("chrome", "edge", "firefox", "brave", "safari", "opera", "vivaldi", "chromium")
    looks_like_browser = bool(title) and any(name in title.lower() for name in browsers)
    return {
        "supported": bool(window.get("supported")),
        "activeWindowTitle": title,
        "isBrowser": looks_like_browser,
        "rememberedUrl": params.get("lastUrl") or None,
        "urlSource": "remembered-from-last-navigate" if params.get("lastUrl") else None,
        "observedVia": "screenshot" if pyautogui is not None else None,
    }


# ── Action execution (Open-Interface app/interpreter.py semantics) ──────────
def require_pyautogui():
    if pyautogui is None:
        raise BridgeError(f"pyautogui is not installed on this host ({PYAUTOGUI_ERROR})", "unavailable")


def action_sleep(params):
    seconds = params.get("seconds", params.get("secs"))
    if not isinstance(seconds, (int, float)) or seconds < 0:
        raise BridgeError("sleep requires non-negative seconds", "invalid_params")
    if seconds > 300:
        raise BridgeError("sleep is capped at 300 seconds", "invalid_params")
    time.sleep(float(seconds))
    return {"slept": float(seconds)}


def action_type(params):
    require_pyautogui()
    text = params.get("text") or params.get("string")
    if not isinstance(text, str) or not text:
        raise BridgeError("type requires non-empty text", "invalid_params")
    interval = params.get("interval", 0.05)  # Open-Interface: keep the interval low
    pyautogui.write(text, interval=float(interval))
    return {"typed": len(text)}


def action_press_key(params):
    require_pyautogui()
    keys = params.get("keys") or params.get("key")
    if keys is None:
        raise BridgeError("press_key requires keys", "invalid_params")
    presses = int(params.get("presses", 1))
    interval = float(params.get("interval", 0.05))
    pyautogui.press(keys, presses=presses, interval=interval)
    return {"pressed": keys, "presses": presses}


def action_hotkey(params):
    require_pyautogui()
    keys = params.get("keys") or params.get("key")
    if isinstance(keys, str):
        keys = [keys]
    if not isinstance(keys, list) or len(keys) < 2:
        raise BridgeError("hotkey requires at least two keys", "invalid_params")
    pyautogui.hotkey(*[str(k) for k in keys])
    return {"hotkey": keys}


def action_click(params, clicks=1):
    require_pyautogui()
    x, y = params.get("x"), params.get("y")
    if not isinstance(x, (int, float)) or not isinstance(y, (int, float)):
        raise BridgeError("click requires numeric x and y", "invalid_params")
    button = params.get("button", "left")
    if button not in ("left", "right", "middle"):
        raise BridgeError(f"unsupported mouse button: {button}", "invalid_params")
    pyautogui.click(x=int(x), y=int(y), clicks=clicks, button=button)
    return {"clicked": {"x": int(x), "y": int(y), "button": button, "clicks": clicks}}


def action_move_mouse(params):
    require_pyautogui()
    if params.get("to"):
        pyautogui.moveTo(params["to"])
        return {"movedTo": params["to"]}
    x, y = params.get("x"), params.get("y")
    if not isinstance(x, (int, float)) or not isinstance(y, (int, float)):
        raise BridgeError("move_mouse requires numeric x and y", "invalid_params")
    duration = float(params.get("duration", 0.2))
    pyautogui.moveTo(int(x), int(y), duration=duration)
    return {"movedTo": [int(x), int(y)]}


def action_scroll(params):
    require_pyautogui()
    amount = params.get("amount", params.get("clicks"))
    if not isinstance(amount, (int, float)) or amount == 0:
        raise BridgeError("scroll requires a non-zero numeric amount", "invalid_params")
    x, y = params.get("x"), params.get("y")
    if isinstance(x, (int, float)) and isinstance(y, (int, float)):
        pyautogui.moveTo(int(x), int(y))
    pyautogui.scroll(int(amount))
    return {"scrolled": int(amount)}


def action_open_application(params):
    """Launch an app using the OS's own launcher — never a shell string.

    `name` is validated in Node against a strict pattern, and here it is passed
    as a *single* argv element to the platform launcher (no shell=True), so it
    cannot smuggle shell syntax.
    """
    name = (params.get("name") or params.get("application") or "").strip()
    if not name:
        raise BridgeError("open_application requires a name", "invalid_params")
    if len(name) > 120:
        raise BridgeError("open_application name is too long", "invalid_params")

    import subprocess

    if IS_WINDOWS:  # pragma: no cover - Windows only
        subprocess.Popen(["cmd", "/c", "start", "", name], shell=False)
    elif IS_MAC:  # pragma: no cover - macOS only
        subprocess.Popen(["open", "-a", name], shell=False)
    else:  # pragma: no cover - Linux only
        subprocess.Popen([name], shell=False)
    return {"launched": name}


def action_navigate(params):
    """Open a URL in the default browser via the OS launcher (no shell)."""
    url = (params.get("url") or "").strip()
    if not url.startswith(("http://", "https://")):
        raise BridgeError("navigate requires an http/https url", "invalid_params")

    import subprocess
    import webbrowser

    try:
        opened = webbrowser.open(url, new=2)
    except Exception as exc:  # pragma: no cover
        raise BridgeError(f"could not open browser: {exc}", "bridge_error")

    if not opened:  # pragma: no cover
        if IS_WINDOWS:
            subprocess.Popen(["cmd", "/c", "start", "", url], shell=False)
        elif IS_MAC:
            subprocess.Popen(["open", url], shell=False)
        else:
            subprocess.Popen(["xdg-open", url], shell=False)
    return {"navigatedTo": url}


DISPATCH = {
    "screenshot": lambda p: capture_screenshot(),
    "click": lambda p: action_click(p, clicks=1),
    "double_click": lambda p: action_click(p, clicks=2),
    "move_mouse": action_move_mouse,
    "type": action_type,
    "press_key": action_press_key,
    "hotkey": action_hotkey,
    "scroll": action_scroll,
    "sleep": action_sleep,
    "open_application": action_open_application,
    "navigate": action_navigate,
    "get_active_window": lambda p: active_window(),
    "get_browser_state": browser_state,
}


def capabilities():
    return {
        "bridge": "open-interface-adapter",
        "bridgeVersion": 1,
        "platform": platform.system(),
        "platformRelease": platform.release(),
        "pythonVersion": platform.python_version(),
        "pyautoguiAvailable": pyautogui is not None,
        "pyautoguiError": PYAUTOGUI_ERROR,
        "pilAvailable": PIL_AVAILABLE,
        "pilError": PIL_ERROR,
        "screenshotDir": os.path.abspath(SCREENSHOT_DIR),
        "actions": sorted(ALLOWED_FUNCTIONS),
        # Which actions actually need pyautogui vs. which still work without it.
        # This lets the agent degrade precisely instead of claiming the whole
        # computer layer is dead when only input simulation is missing.
        "pyautoguiActions": sorted([
            "click", "double_click", "move_mouse", "type", "press_key", "hotkey",
            "scroll", "screenshot",
        ]),
        "nonPyautoguiActions": sorted([
            "get_active_window", "get_browser_state", "navigate", "open_application", "sleep",
        ]),
        "neverCallsLlm": True,
        "shellAccess": False,
        "screen": (lambda: (lambda s: {"width": s[0], "height": s[1]})(screen_size()))()
        if pyautogui is not None
        else None,
        "activeWindowSupported": bool(active_window().get("supported")),
        "failSafe": True,
    }


def handle(request):
    if not isinstance(request, dict):
        raise BridgeError("request must be a JSON object", "invalid_request")
    cmd = request.get("cmd")
    params = request.get("params") or {}
    if cmd not in ALLOWED_FUNCTIONS:
        # A malformed/hallucinated action must fail loudly, not fall through to
        # some generic dispatch.
        raise BridgeError(
            f"command '{cmd}' is not in the computer whitelist", "not_allowed"
        )
    if not isinstance(params, dict):
        raise BridgeError("params must be a JSON object", "invalid_params")

    started = time.time()
    result = DISPATCH[cmd](params)
    result = {"result": result} if not isinstance(result, dict) else result
    return {
        "command": cmd,
        "output": result,
        "durationMs": int((time.time() - started) * 1000),
    }


def write_message(payload):
    sys.stdout.write(json.dumps(payload, separators=(",", ":")) + "\n")
    sys.stdout.flush()


def main():
    parser = argparse.ArgumentParser(description="DARKMATTER computer bridge (Open-Interface primitives)")
    parser.add_argument("--probe", action="store_true", help="print capabilities JSON and exit")
    args = parser.parse_args()

    if args.probe:
        write_message({"type": "capabilities", "ok": True, "result": capabilities()})
        return 0

    write_message({"type": "ready", "ok": True, "result": capabilities()})

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            request = json.loads(line)
        except Exception as exc:
            write_message({"id": None, "ok": False, "error": {"message": f"invalid json: {exc}", "kind": "invalid_json"}})
            continue

        request_id = request.get("id") if isinstance(request, dict) else None

        if isinstance(request, dict) and request.get("cmd") == "__shutdown__":
            write_message({"id": request_id, "ok": True, "result": {"shutdown": True}})
            return 0

        try:
            write_message({"id": request_id, "ok": True, **handle(request)})
        except BridgeError as exc:
            write_message({"id": request_id, "ok": False, "error": {"message": str(exc), "kind": exc.kind}})
        except Exception as exc:  # pragma: no cover - unexpected host failure
            write_message({
                "id": request_id,
                "ok": False,
                "error": {
                    "message": f"{type(exc).__name__}: {exc}",
                    "kind": "bridge_error",
                    "trace": traceback.format_exc()[-800:],
                },
            })
    return 0


if __name__ == "__main__":
    sys.exit(main())
