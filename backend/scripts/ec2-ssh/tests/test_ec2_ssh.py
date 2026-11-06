#!/usr/bin/env python3
"""Tests for the EC2 SSH transport scripts (Tailscale-flap lane, 6 Nov 2026).

Proves, against the scripts under test (default: this repo's
backend/scripts/ec2-ssh/ copies):
  * proxy_ssh.py retries a dropped CONNECT and then relays (flap fix);
  * proxy_ssh.py gives up after a bounded number of attempts;
  * proxy_ssh.py never retries a 4xx, but does retry a 502;
  * proxy_ssh.py keeps an idle session alive (60s idle-break fix);
  * ec2.sh falls back to the direct route only on a connect failure,
    never on a remote-command failure.

Run:  python3 backend/scripts/ec2-ssh/tests/test_ec2_ssh.py
Negative control (old code): run with the live workspace copies, which
are the pre-fix versions —
  PROXY_SSH_UNDER_TEST=/home/hatch/workspace/proxy_ssh.py \
  EC2_SH_UNDER_TEST=/home/hatch/workspace/ec2.sh python3 <this file>
Expected old-code failures: retry-then-success, bounded-attempts,
502-then-ok, the idle static guard, and the ec2.sh fallback-on-connect-
failure test. (The idle *behavioral* test passes on old code too: its
hardcoded 60s timeout exceeds the test's 1s idle wait — the behavioral
proof for idle is the live `sleep 75` experiment in the lane report,
plus the static guard here. A 65s behavioral test would prove it
directly and is intentionally not in this suite.)
"""
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPT_DIR = os.path.dirname(HERE)
PROXY_SCRIPT = os.environ.get(
    "PROXY_SSH_UNDER_TEST", os.path.join(SCRIPT_DIR, "proxy_ssh.py")
)
EC2_SH = os.environ.get(
    "EC2_SH_UNDER_TEST", os.path.join(SCRIPT_DIR, "ec2.sh")
)


class FakeProxy:
    """A fake HTTP CONNECT proxy on 127.0.0.1. Modes:

    drop_first_n: close the first N CONNECTs with no response (the flap),
        then answer 200 and relay.
    always_drop: close every CONNECT with no response.
    always_status: answer every CONNECT with this status line, then close.
    status_then_ok: answer the first CONNECT with this status, then 200.
    After a 200 the connection stays open: bytes the client sends are
    recorded in `received`; bytes pushed to `send_queue` are sent back.
    """

    def __init__(self, mode="ok", drop_first_n=0, status="HTTP/1.1 403 Forbidden"):
        self.mode = mode
        self.drop_first_n = drop_first_n
        self.status = status
        self.connections = 0
        self.received = []
        self.send_queue = []
        self._stop = threading.Event()
        self._lock = threading.Lock()
        self._srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self._srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self._srv.bind(("127.0.0.1", 0))
        self.port = self._srv.getsockname()[1]
        self._srv.listen(16)
        self._srv.settimeout(0.2)
        self._threads = []
        self._clients = []

    def __enter__(self):
        t = threading.Thread(target=self._accept_loop, daemon=True)
        t.start()
        self._threads.append(t)
        return self

    def __exit__(self, *exc):
        self._stop.set()
        try:
            self._srv.close()
        except OSError:
            pass
        with self._lock:
            clients = list(self._clients)
        for c in clients:
            try:
                c.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass
            try:
                c.close()
            except OSError:
                pass
        for t in self._threads:
            t.join(timeout=2)

    def proxy_url(self):
        return f"http://user:pass@127.0.0.1:{self.port}"

    def _accept_loop(self):
        while not self._stop.is_set():
            try:
                conn, _ = self._srv.accept()
            except socket.timeout:
                continue
            except OSError:
                return
            with self._lock:
                self._clients.append(conn)
            t = threading.Thread(target=self._handle, args=(conn,), daemon=True)
            t.start()
            self._threads.append(t)

    def _handle(self, conn):
        try:
            conn.settimeout(5)
            with self._lock:
                self.connections += 1
                n = self.connections
            buf = b""
            while b"\r\n\r\n" not in buf:
                chunk = conn.recv(4096)
                if not chunk:
                    return
                buf += chunk
            if self.mode == "always_drop":
                return
            if self.mode == "drop_first_n" and n <= self.drop_first_n:
                return
            if self.mode == "always_status":
                conn.sendall((self.status + "\r\n\r\n").encode())
                return
            if self.mode == "status_then_ok" and n == 1:
                conn.sendall((self.status + "\r\n\r\n").encode())
                return
            conn.sendall(b"HTTP/1.1 200 Connection Established\r\n\r\n")
            conn.settimeout(0.1)
            while not self._stop.is_set():
                with self._lock:
                    queued = list(self.send_queue)
                    self.send_queue.clear()
                for data in queued:
                    try:
                        conn.sendall(data)
                    except OSError:
                        return
                try:
                    data = conn.recv(65536)
                except socket.timeout:
                    continue
                except OSError:
                    return
                if not data:
                    return
                with self._lock:
                    self.received.append(data)
        except OSError:
            return
        finally:
            try:
                conn.close()
            except OSError:
                pass

    def send(self, data):
        with self._lock:
            self.send_queue.append(data)

    def received_bytes(self):
        with self._lock:
            return b"".join(self.received)


def run_proxy(proxy_script, proxy_url, extra_env=None, stdin_data=None, wait_s=0):
    """Start proxy_ssh.py as a subprocess; return the Popen object."""
    env = dict(os.environ)
    env["HTTPS_PROXY"] = proxy_url
    env["https_proxy"] = proxy_url
    if extra_env:
        env.update(extra_env)
    proc = subprocess.Popen(
        [sys.executable, proxy_script, "127.0.0.1", "22"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=env,
    )
    if stdin_data is not None:
        try:
            proc.stdin.write(stdin_data)
            proc.stdin.flush()
        except (BrokenPipeError, OSError):
            pass
    if wait_s:
        time.sleep(wait_s)
    return proc


def read_stdout_nonblocking(proc, timeout=3.0):
    """Collect whatever the process wrote to stdout within `timeout`."""
    import select

    out = b""
    end = time.monotonic() + timeout
    fd = proc.stdout.fileno()
    while time.monotonic() < end:
        r, _, _ = select.select([fd], [], [], 0.1)
        if r:
            try:
                chunk = os.read(fd, 65536)
            except OSError:
                break
            if not chunk:
                break
            out += chunk
        if proc.poll() is not None and not r:
            break
    return out


class ProxyRetryTests(unittest.TestCase):
    def test_retry_then_success_relays(self):
        """Flap: first 2 CONNECTs dropped, 3rd succeeds -> relay works."""
        with FakeProxy(mode="drop_first_n", drop_first_n=2) as proxy:
            proc = run_proxy(
                PROXY_SCRIPT,
                proxy.proxy_url(),
                extra_env={
                    "PROXY_SSH_CONNECT_ATTEMPTS": "3",
                    "PROXY_SSH_CONNECT_BACKOFF_S": "0.05,0.05",
                },
            )
            try:
                self.assertIsNone(proc.poll(), "proxy died on dropped CONNECTs")
                proc.stdin.write(b"HELLO-RELAY\n")
                proc.stdin.flush()
                time.sleep(1.0)
                self.assertIn(b"HELLO-RELAY", proxy.received_bytes())
                proxy.send(b"SSH-2.0-FAKE\r\n")
                out = read_stdout_nonblocking(proc, timeout=3.0)
                self.assertIn(b"SSH-2.0-FAKE", out)
                self.assertEqual(proxy.connections, 3)
            finally:
                proc.kill()
                proc.wait()

    def test_bounded_attempts_on_persistent_drop(self):
        """Always dropping proxy: exactly N attempts, then exit 1."""
        with FakeProxy(mode="always_drop") as proxy:
            proc = run_proxy(
                PROXY_SCRIPT,
                proxy.proxy_url(),
                extra_env={
                    "PROXY_SSH_CONNECT_ATTEMPTS": "3",
                    "PROXY_SSH_CONNECT_BACKOFF_S": "0.05,0.05",
                },
            )
            rc = proc.wait(timeout=15)
            _, err = proc.communicate()
            self.assertEqual(rc, 1)
            self.assertIn(b"Proxy closed connection", err)
            self.assertEqual(proxy.connections, 3)

    def test_no_retry_on_403(self):
        """A 4xx is terminal: exactly 1 attempt."""
        with FakeProxy(mode="always_status", status="HTTP/1.1 403 Forbidden") as proxy:
            proc = run_proxy(
                PROXY_SCRIPT,
                proxy.proxy_url(),
                extra_env={
                    "PROXY_SSH_CONNECT_ATTEMPTS": "3",
                    "PROXY_SSH_CONNECT_BACKOFF_S": "0.05,0.05",
                },
            )
            rc = proc.wait(timeout=15)
            _, err = proc.communicate()
            self.assertEqual(rc, 1)
            self.assertIn(b"Proxy CONNECT failed", err)
            self.assertEqual(proxy.connections, 1)

    def test_retry_on_502_then_ok(self):
        """A 502 is transient: retried, then relay works."""
        with FakeProxy(
            mode="status_then_ok", status="HTTP/1.1 502 Bad Gateway"
        ) as proxy:
            proc = run_proxy(
                PROXY_SCRIPT,
                proxy.proxy_url(),
                extra_env={
                    "PROXY_SSH_CONNECT_ATTEMPTS": "3",
                    "PROXY_SSH_CONNECT_BACKOFF_S": "0.05,0.05",
                },
            )
            try:
                self.assertIsNone(proc.poll(), "proxy died after a 502")
                end = time.monotonic() + 5
                while proxy.connections < 2 and time.monotonic() < end:
                    time.sleep(0.05)
                self.assertEqual(proxy.connections, 2)
            finally:
                proc.kill()
                proc.wait()

    def test_tcp_connect_refused_retried_then_gives_up(self):
        """Unreachable proxy host: bounded retries, then exit 1."""
        env = dict(os.environ)
        env["HTTPS_PROXY"] = "http://user:pass@127.0.0.1:1"
        env["PROXY_SSH_CONNECT_ATTEMPTS"] = "3"
        env["PROXY_SSH_CONNECT_BACKOFF_S"] = "0.05,0.05"
        proc = subprocess.Popen(
            [sys.executable, PROXY_SCRIPT, "127.0.0.1", "22"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=env,
        )
        rc = proc.wait(timeout=20)
        self.assertEqual(rc, 1)


class ProxyIdleTests(unittest.TestCase):
    def test_idle_session_survives_and_still_relays(self):
        """Hold the tunnel silent past several relay timeouts: the
        process must stay alive and relay afterwards (60s idle-break
        fix). Relay timeout shortened via env for test speed."""
        with FakeProxy(mode="ok") as proxy:
            proc = run_proxy(
                PROXY_SCRIPT,
                proxy.proxy_url(),
                extra_env={"PROXY_SSH_RELAY_TIMEOUT_S": "0.2"},
            )
            try:
                time.sleep(1.2)  # 6x the 0.2s relay timeout, zero traffic
                self.assertIsNone(
                    proc.poll(), "proxy exited during an idle period"
                )
                proxy.send(b"IDLE-THEN-DATA\r\n")
                out = read_stdout_nonblocking(proc, timeout=3.0)
                self.assertIn(b"IDLE-THEN-DATA", out)
                proc.stdin.write(b"AFTER-IDLE\n")
                proc.stdin.flush()
                time.sleep(0.5)
                self.assertIn(b"AFTER-IDLE", proxy.received_bytes())
            finally:
                proc.kill()
                proc.wait()

    def test_idle_fix_present_in_source(self):
        """Static guard: the relay loop must continue (not break) on a
        select timeout. Catches a reintroduction of the 60s idle kill
        even though the behavioral test above cannot fail fast on old
        code (its hardcoded 60s timeout exceeds the test's idle wait)."""
        with open(PROXY_SCRIPT) as f:
            src = f.read()
        self.assertIn("continue  # idle wake-up, not an exit", src)
        self.assertNotIn("if not r:\n            break", src)


class Ec2ShFallbackTests(unittest.TestCase):
    """ec2.sh with a fake `ssh` and a fake `ec2-direct.sh` on PATH."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="ec2sh-test-")
        self.bindir = os.path.join(self.tmp, "bin")
        os.makedirs(self.bindir)
        # Copy the ec2.sh under test next to the fakes so $DIR resolves.
        self.ec2sh = os.path.join(self.tmp, "ec2.sh")
        shutil.copy2(EC2_SH, self.ec2sh)
        self.calls = os.path.join(self.tmp, "calls.log")
        self._write_fake_ssh()
        self._write_fake_direct()
        self.env = dict(os.environ)
        self.env["PATH"] = self.bindir + os.pathsep + self.env.get("PATH", "")

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def _write_fake_ssh(self):
        # FAKE_SSH_MODE: ok | connect_fail | remote_fail | fail_quiet
        script = (
            "#!/bin/bash\n"
            f'echo "ssh $@" >> "{self.calls}"\n'
            'case "$FAKE_SSH_MODE" in\n'
            '  ok) echo SSH_OK; exit 0;;\n'
            '  connect_fail) echo "Connection closed by UNKNOWN port 65535" >&2; exit 255;;\n'
            '  remote_fail) echo "remote command failed" >&2; exit 3;;\n'
            '  fail_quiet) exit 255;;\n'
            'esac\n'
        )
        path = os.path.join(self.bindir, "ssh")
        with open(path, "w") as f:
            f.write(script)
        os.chmod(path, 0o755)

    def _write_fake_direct(self):
        # Lives NEXT TO the ec2.sh copy: ec2.sh resolves the fallback
        # as $DIR/ec2-direct.sh, so the fake must sit in the same dir.
        script = (
            "#!/bin/bash\n"
            f'echo "direct $@" >> "{self.calls}"\n'
            'echo DIRECT_OK\n'
            'exit ${FAKE_DIRECT_RC:-0}\n'
        )
        path = os.path.join(self.tmp, "ec2-direct.sh")
        with open(path, "w") as f:
            f.write(script)
        os.chmod(path, 0o755)

    def _run(self, mode, direct_rc="0"):
        env = dict(self.env)
        env["FAKE_SSH_MODE"] = mode
        env["FAKE_DIRECT_RC"] = direct_rc
        proc = subprocess.run(
            ["bash", self.ec2sh, "echo hi"],
            capture_output=True,
            text=True,
            env=env,
            timeout=30,
        )
        calls = ""
        if os.path.exists(self.calls):
            with open(self.calls) as f:
                calls = f.read()
        return proc, calls

    def test_success_no_fallback(self):
        proc, calls = self._run("ok")
        self.assertEqual(proc.returncode, 0)
        self.assertIn("SSH_OK", proc.stdout)
        self.assertNotIn("direct ", calls)

    def test_connect_failure_falls_back_to_direct(self):
        proc, calls = self._run("connect_fail")
        self.assertEqual(proc.returncode, 0)
        self.assertIn("DIRECT_OK", proc.stdout)
        self.assertIn("direct ", calls)
        self.assertIn("ssh ", calls)

    def test_remote_failure_never_falls_back(self):
        proc, calls = self._run("remote_fail")
        self.assertEqual(proc.returncode, 3)
        self.assertNotIn("direct ", calls)

    def test_255_without_connect_evidence_never_falls_back(self):
        proc, calls = self._run("fail_quiet")
        self.assertEqual(proc.returncode, 255)
        self.assertNotIn("direct ", calls)

    def test_direct_failure_propagates(self):
        proc, calls = self._run("connect_fail", direct_rc="255")
        self.assertEqual(proc.returncode, 255)
        self.assertIn("direct ", calls)


if __name__ == "__main__":
    unittest.main(verbosity=2)
