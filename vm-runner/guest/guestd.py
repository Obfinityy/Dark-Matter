#!/usr/bin/env python3
"""
Infinity guest agent (infinity-guestd).

Runs INSIDE the Kali sandbox VM (as root via systemd), listening on the
guest's 127.0.0.1:1024. The host runner reaches it through QEMU's hostfwd
(127.0.0.1:<guestPort> -> guest 1024).

Endpoints (all JSON unless noted; all require Authorization: Bearer <token>):
  GET  /health                        -> { ok, version }
  GET  /proof?nonce=<hex>             -> { proof }  (HMAC-SHA256 proof-of-possession)
  POST /exec            {command,cwd?,timeoutMs?} -> { exit_code, stdout, stderr, timed_out }
  POST /exec/start      {command,cwd?,timeoutMs?} -> { execId }
  GET  /exec/<id>/poll                -> { done, exit_code?, stdout, stderr } (cumulative)
  POST /exec/<id>/kill                -> { ok }
  GET  /screenshot?width=1280         -> image/jpeg bytes
  GET  /display                       -> { width, height }
  POST /input  {type,...}             -> { ok }   (xdotool; coordinates in pixels)
  POST /shell/start     {cols?,rows?} -> { shellId }
  GET  /shell/<id>/poll               -> { output: base64, alive }
  POST /shell/<id>/input {data: base64} -> { ok }
  POST /shell/<id>/resize {cols,rows} -> { ok }
  POST /shell/<id>/kill               -> { ok }
  POST /poweroff                      -> { ok } then the guest powers off

Token resolution order: INFINITY_GUESTD_TOKEN env -> QEMU fw_cfg
(opt/infinity/session-token) -> /etc/infinity-guestd/token.

Python standard library only.
"""

import base64
import fcntl
import hashlib
import hmac
import json
import os
import pty
import re
import select
import signal
import struct
import subprocess
import sys
import tempfile
import termios
import threading
import time
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

VERSION = "0.1.0"
LISTEN_HOST = "127.0.0.1"
LISTEN_PORT = 1024
MAX_BODY_BYTES = 4 * 1024 * 1024
OUTPUT_CAP_BYTES = 2 * 1024 * 1024  # per stream, sync exec
DISPLAY = os.environ.get("DISPLAY", ":0")

# ---------------------------------------------------------------- token ---

def resolve_token():
    env = os.environ.get("INFINITY_GUESTD_TOKEN")
    if env:
        return env
    fwcfg = "/sys/firmware/qemu_fw_cfg/by_name/opt/infinity/session-token/raw"
    try:
        with open(fwcfg, "r") as f:
            token = f.read().strip()
            if token:
                return token
    except OSError:
        pass
    try:
        with open("/etc/infinity-guestd/token", "r") as f:
            token = f.read().strip()
            if token:
                return token
    except OSError:
        pass
    return None


TOKEN = resolve_token()

# --------------------------------------------------------------- state ---

_exec_jobs = {}   # execId -> dict
_exec_lock = threading.Lock()
_exec_counter = [0]

_shells = {}      # shellId -> dict(master_fd, pid)
_shell_lock = threading.Lock()
_shell_counter = [0]


def next_id(prefix, counter):
    counter[0] += 1
    return "%s-%d-%d" % (prefix, int(time.time() * 1000), counter[0])


def run(cmd, **kwargs):
    env = dict(os.environ)
    env["DISPLAY"] = DISPLAY
    return subprocess.run(cmd, env=env, **kwargs)


# --------------------------------------------------------------- http ----

class Handler(BaseHTTPRequestHandler):
    server_version = "infinity-guestd/" + VERSION

    def log_message(self, fmt, *args):  # keep logs quiet; no screenshots in logs
        sys.stderr.write("guestd: " + fmt % args + "\n")

    # -- helpers ----------------------------------------------------------
    def _send_json(self, code, obj):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_bytes(self, code, content_type, data):
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _read_json(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0:
            return {}
        if length > MAX_BODY_BYTES:
            raise ValueError("request body too large")
        raw = self.rfile.read(length)
        return json.loads(raw.decode("utf-8")) if raw else {}

    def _authorized(self):
        if not TOKEN:
            return False
        auth = self.headers.get("Authorization") or ""
        m = re.match(r"(?i)^Bearer\s+(.+)$", auth.strip())
        return bool(m) and hmac.compare_digest(m.group(1), TOKEN)

    def _route(self):
        parsed = urllib.parse.urlparse(self.path)
        return parsed.path, urllib.parse.parse_qs(parsed.query)

    # -- dispatch ---------------------------------------------------------
    def do_GET(self):
        if not self._authorized():
            return self._send_json(401, {"ok": False, "code": "bad_token"})
        path, query = self._route()
        try:
            if path == "/health":
                return self._send_json(200, {"ok": True, "version": VERSION})
            if path == "/proof":
                return self._handle_proof(query)
            if path == "/screenshot":
                return self._handle_screenshot(query)
            if path == "/display":
                return self._handle_display()
            m = re.match(r"^/exec/([^/]+)/poll$", path)
            if m:
                return self._handle_exec_poll(m.group(1))
            m = re.match(r"^/shell/([^/]+)/poll$", path)
            if m:
                return self._handle_shell_poll(m.group(1))
            return self._send_json(404, {"ok": False, "code": "not_found"})
        except Exception as e:  # never leak a traceback with screen contents
            return self._send_json(500, {"ok": False, "code": "error", "message": str(e)[:300]})

    def do_POST(self):
        if not self._authorized():
            return self._send_json(401, {"ok": False, "code": "bad_token"})
        path, _ = self._route()
        try:
            body = self._read_json()
        except Exception as e:
            return self._send_json(400, {"ok": False, "code": "bad_request", "message": str(e)[:200]})
        try:
            if path == "/exec":
                return self._handle_exec(body)
            if path == "/exec/start":
                return self._handle_exec_start(body)
            if path == "/input":
                return self._handle_input(body)
            if path == "/shell/start":
                return self._handle_shell_start(body)
            if path == "/poweroff":
                return self._handle_poweroff()
            m = re.match(r"^/exec/([^/]+)/kill$", path)
            if m:
                return self._handle_exec_kill(m.group(1))
            m = re.match(r"^/shell/([^/]+)/input$", path)
            if m:
                return self._handle_shell_input(m.group(1), body)
            m = re.match(r"^/shell/([^/]+)/resize$", path)
            if m:
                return self._handle_shell_resize(m.group(1), body)
            m = re.match(r"^/shell/([^/]+)/kill$", path)
            if m:
                return self._handle_shell_kill(m.group(1))
            return self._send_json(404, {"ok": False, "code": "not_found"})
        except Exception as e:
            return self._send_json(500, {"ok": False, "code": "error", "message": str(e)[:300]})

    # -- proof ------------------------------------------------------------
    def _handle_proof(self, query):
        nonce = (query.get("nonce") or [""])[0]
        if not nonce or not re.match(r"^[0-9a-fA-F]{8,128}$", nonce):
            return self._send_json(400, {"ok": False, "code": "bad_request", "message": "nonce required"})
        proof = hmac.new(TOKEN.encode(), ("infinity-guest-proof:" + nonce).encode(), hashlib.sha256).hexdigest()
        return self._send_json(200, {"proof": proof})

    # -- exec ---------------------------------------------------------------
    def _handle_exec(self, body):
        command = body.get("command")
        if not command or not isinstance(command, str):
            return self._send_json(400, {"ok": False, "code": "bad_request", "message": "command required"})
        cwd = body.get("cwd") or None
        timeout_s = max(1, min(3600, int(body.get("timeoutMs") or 120000) / 1000))
        try:
            completed = subprocess.run(
                command, shell=True, executable="/bin/bash", cwd=cwd,
                capture_output=True, timeout=timeout_s,
                env={**os.environ, "DISPLAY": DISPLAY},
            )
            timed_out = False
            stdout_b, stderr_b = completed.stdout or b"", completed.stderr or b""
            code = completed.returncode
        except subprocess.TimeoutExpired as e:
            timed_out = True
            stdout_b, stderr_b = e.stdout or b"", e.stderr or b""
            code = -1
        stdout = stdout_b[-OUTPUT_CAP_BYTES:].decode("utf-8", "replace")
        stderr = stderr_b[-OUTPUT_CAP_BYTES:].decode("utf-8", "replace")
        return self._send_json(200, {
            "exit_code": code, "stdout": stdout, "stderr": stderr, "timed_out": timed_out,
        })

    def _handle_exec_start(self, body):
        command = body.get("command")
        if not command or not isinstance(command, str):
            return self._send_json(400, {"ok": False, "code": "bad_request", "message": "command required"})
        cwd = body.get("cwd") or None
        out_f = tempfile.NamedTemporaryFile(prefix="guestd-exec-out-", delete=False)
        err_f = tempfile.NamedTemporaryFile(prefix="guestd-exec-err-", delete=False)
        proc = subprocess.Popen(
            command, shell=True, executable="/bin/bash", cwd=cwd,
            stdout=out_f, stderr=err_f, env={**os.environ, "DISPLAY": DISPLAY},
        )
        out_f.close()
        err_f.close()
        exec_id = next_id("exec", _exec_counter)
        with _exec_lock:
            _exec_jobs[exec_id] = {
                "proc": proc, "out": out_f.name, "err": err_f.name,
                "started": time.time(),
            }
        return self._send_json(200, {"execId": exec_id})

    def _read_job_output(self, job):
        def tail_bytes(p, n=OUTPUT_CAP_BYTES):
            try:
                size = os.path.getsize(p)
                with open(p, "rb") as f:
                    if size > n:
                        f.seek(size - n)
                    return f.read()
            except OSError:
                return b""
        return (tail_bytes(job["out"]).decode("utf-8", "replace"),
                tail_bytes(job["err"]).decode("utf-8", "replace"))

    def _handle_exec_poll(self, exec_id):
        with _exec_lock:
            job = _exec_jobs.get(exec_id)
        if not job:
            return self._send_json(404, {"ok": False, "code": "not_found"})
        done = job["proc"].poll() is not None
        stdout, stderr = self._read_job_output(job)
        resp = {"done": done, "stdout": stdout, "stderr": stderr}
        if done:
            resp["exit_code"] = job["proc"].returncode
        return self._send_json(200, resp)

    def _handle_exec_kill(self, exec_id):
        with _exec_lock:
            job = _exec_jobs.pop(exec_id, None)
        if not job:
            return self._send_json(404, {"ok": False, "code": "not_found"})
        try:
            job["proc"].kill()
        except OSError:
            pass
        for p in (job["out"], job["err"]):
            try:
                os.unlink(p)
            except OSError:
                pass
        return self._send_json(200, {"ok": True})

    # -- screenshot / display ----------------------------------------------
    def _handle_screenshot(self, query):
        width = int((query.get("width") or ["1280"])[0] or 1280)
        width = max(320, min(2560, width))
        tmp = tempfile.NamedTemporaryFile(prefix="guestd-shot-", suffix=".png", delete=False)
        tmp.close()
        try:
            r = run(["scrot", "-z", tmp.name], capture_output=True, timeout=20)
            if r.returncode != 0:
                # fallback: ImageMagick import
                r = run(["import", "-window", "root", tmp.name], capture_output=True, timeout=20)
                if r.returncode != 0:
                    raise RuntimeError("screenshot capture failed (scrot/import)")
            r = run(
                ["convert", tmp.name, "-resize", "%dx" % width, "-quality", "82", "jpg:-"],
                capture_output=True, timeout=30,
            )
            if r.returncode != 0 or not r.stdout:
                raise RuntimeError("screenshot JPEG conversion failed")
            return self._send_bytes(200, "image/jpeg", r.stdout)
        finally:
            try:
                os.unlink(tmp.name)
            except OSError:
                pass

    def _handle_display(self):
        r = run(["xdotool", "getdisplaygeometry"], capture_output=True, text=True, timeout=10)
        m = re.match(r"\s*(\d+)\s+(\d+)", r.stdout or "")
        if not m:
            raise RuntimeError("could not determine display geometry")
        return self._send_json(200, {"width": int(m.group(1)), "height": int(m.group(2))})

    # -- input ---------------------------------------------------------------
    def _handle_input(self, body):
        kind = body.get("type")
        if kind == "click":
            x, y = int(body.get("x", 0)), int(body.get("y", 0))
            btn = {"left": "1", "right": "3", "middle": "2"}.get(body.get("button", "left"), "1")
            r = run(["xdotool", "mousemove", str(x), str(y), "click", btn], capture_output=True, timeout=15)
        elif kind == "move":
            r = run(["xdotool", "mousemove", str(int(body.get("x", 0))), str(int(body.get("y", 0)))],
                    capture_output=True, timeout=15)
        elif kind == "type":
            text = body.get("text", "")
            if not isinstance(text, str) or not text:
                return self._send_json(400, {"ok": False, "code": "bad_request", "message": "text required"})
            r = run(["xdotool", "type", "--delay", "12", "--", text], capture_output=True, timeout=60)
        elif kind == "key":
            key = body.get("key", "")
            if not isinstance(key, str) or not key:
                return self._send_json(400, {"ok": False, "code": "bad_request", "message": "key required"})
            r = run(["xdotool", "key", "--", key], capture_output=True, timeout=15)
        elif kind == "scroll":
            dy = body.get("dy", 0)
            btn = "4" if dy < 0 else "5"  # 4 = up, 5 = down
            clicks = max(1, min(20, abs(int(dy)) // 120 or 1))
            r = run(["xdotool", "click", "--repeat", str(clicks), btn], capture_output=True, timeout=15)
        else:
            return self._send_json(400, {"ok": False, "code": "bad_request",
                                         "message": "unknown input type: %s" % kind})
        if r.returncode != 0:
            return self._send_json(500, {"ok": False, "code": "input_failed",
                                         "message": (r.stderr or b"").decode()[:200]})
        return self._send_json(200, {"ok": True})

    # -- interactive shells ----------------------------------------------------
    def _handle_shell_start(self, body):
        cols = max(20, min(500, int(body.get("cols") or 80)))
        rows = max(5, min(200, int(body.get("rows") or 24)))
        pid, master = pty.fork()
        if pid == 0:
            os.execv("/bin/bash", ["bash", "-i"])
        flags = fcntl.fcntl(master, fcntl.F_GETFL)
        fcntl.fcntl(master, fcntl.F_SETFL, flags | os.O_NONBLOCK)
        fcntl.ioctl(master, termios.TIOCSWINSZ, struct.pack("HHHH", rows, cols, 0, 0))
        shell_id = next_id("shell", _shell_counter)
        with _shell_lock:
            _shells[shell_id] = {"fd": master, "pid": pid}
        return self._send_json(200, {"shellId": shell_id})

    def _get_shell(self, shell_id):
        with _shell_lock:
            return _shells.get(shell_id)

    def _handle_shell_poll(self, shell_id):
        sh = self._get_shell(shell_id)
        if not sh:
            return self._send_json(404, {"ok": False, "code": "not_found"})
        out = b""
        try:
            while True:
                r, _, _ = select.select([sh["fd"]], [], [], 0)
                if not r:
                    break
                chunk = os.read(sh["fd"], 65536)
                if not chunk:
                    break
                out += chunk
                if len(out) > 256 * 1024:
                    break
        except OSError:
            pass
        alive = True
        try:
            os.kill(sh["pid"], 0)
        except OSError:
            alive = False
        return self._send_json(200, {
            "output": base64.b64encode(out).decode("ascii"),
            "alive": alive,
        })

    def _handle_shell_input(self, shell_id, body):
        sh = self._get_shell(shell_id)
        if not sh:
            return self._send_json(404, {"ok": False, "code": "not_found"})
        data = base64.b64decode(body.get("data") or "")
        try:
            os.write(sh["fd"], data)
        except OSError as e:
            return self._send_json(500, {"ok": False, "code": "write_failed", "message": str(e)[:200]})
        return self._send_json(200, {"ok": True})

    def _handle_shell_resize(self, shell_id, body):
        sh = self._get_shell(shell_id)
        if not sh:
            return self._send_json(404, {"ok": False, "code": "not_found"})
        cols = max(20, min(500, int(body.get("cols") or 80)))
        rows = max(5, min(200, int(body.get("rows") or 24)))
        try:
            fcntl.ioctl(sh["fd"], termios.TIOCSWINSZ, struct.pack("HHHH", rows, cols, 0, 0))
        except OSError as e:
            return self._send_json(500, {"ok": False, "code": "resize_failed", "message": str(e)[:200]})
        return self._send_json(200, {"ok": True})

    def _handle_shell_kill(self, shell_id):
        with _shell_lock:
            sh = _shells.pop(shell_id, None)
        if not sh:
            return self._send_json(404, {"ok": False, "code": "not_found"})
        try:
            os.kill(sh["pid"], signal.SIGKILL)
        except OSError:
            pass
        try:
            os.close(sh["fd"])
        except OSError:
            pass
        try:
            os.waitpid(sh["pid"], os.WNOHANG)
        except OSError:
            pass
        return self._send_json(200, {"ok": True})

    # -- poweroff --------------------------------------------------------------
    def _handle_poweroff(self):
        def _off():
            time.sleep(0.5)
            os.system("/sbin/poweroff")
        threading.Thread(target=_off, daemon=True).start()
        return self._send_json(200, {"ok": True})


def main():
    if not TOKEN:
        sys.stderr.write(
            "infinity-guestd: no bearer token found (INFINITY_GUESTD_TOKEN env, "
            "QEMU fw_cfg opt/infinity/session-token, or /etc/infinity-guestd/token). Refusing to start.\n"
        )
        sys.exit(1)
    server = ThreadingHTTPServer((LISTEN_HOST, LISTEN_PORT), Handler)
    sys.stderr.write("infinity-guestd %s listening on %s:%d\n" % (VERSION, LISTEN_HOST, LISTEN_PORT))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
