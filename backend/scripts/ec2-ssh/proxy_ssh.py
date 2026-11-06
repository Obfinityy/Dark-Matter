#!/usr/bin/env python3
"""HTTP CONNECT proxy for SSH through the Tailscale tunnel proxy.

Fixes (6 Nov 2026, Tailscale-flap lane):
1. CONNECT RETRY — the runtime tunnel proxy (port 3130) intermittently
   drops a CONNECT with no response ("Proxy closed connection") and the
   failure is transient: a retry seconds later succeeds (observed
   6 Nov 00:26/00:27/01:20/15:28/21:03 IST and 2 Nov). The old code
   failed the whole SSH session on the first dropped CONNECT. The
   CONNECT phase now retries a bounded number of times (default 3,
   backoff 1s then 2s) on transport-level failures only — TCP connect
   failure/timeout, proxy closing without a response, or a 502/503/504
   from the proxy. A 4xx (auth/forbidden) is never retried, and nothing
   is ever re-sent to the SSH server: the retry happens before any
   tunnel exists, so it cannot duplicate a remote command.
2. IDLE SESSIONS — the old relay loop broke out on a 60s select()
   timeout, which killed any SSH session idle for >60s (proven live
   6 Nov 22:2x IST: `sleep 75` over the Tailscale route died at ~63s
   with "Broken pipe", exit 255, while the direct route survived).
   The loop now continues on timeout (like proxy_ssh_direct.py) and
   only exits on EOF or error, so idle sessions stay alive.

Env overrides (tests + tuning; defaults are the production values):
  PROXY_SSH_CONNECT_ATTEMPTS (default 3), PROXY_SSH_CONNECT_BACKOFF_S
  (default "1.0,2.0"), PROXY_SSH_RELAY_TIMEOUT_S (default 60).
"""
import socket
import sys
import base64
import os
import time
import urllib.parse

CONNECT_ATTEMPTS_DEFAULT = 3
CONNECT_BACKOFF_S_DEFAULT = (1.0, 2.0)
RELAY_TIMEOUT_S_DEFAULT = 60

# A proxy response in this set means the proxy's upstream failed
# transiently; anything else non-200 (notably 4xx) is terminal.
RETRYABLE_PROXY_STATUS = ("502", "503", "504")


def _env_int(name, default):
    try:
        return max(1, int(os.environ.get(name, "") or default))
    except ValueError:
        return default


def _env_backoff(name, default):
    raw = os.environ.get(name, "")
    if not raw:
        return default
    try:
        vals = tuple(float(v) for v in raw.split(",") if v.strip() != "")
    except ValueError:
        return default
    return vals if vals else default


def connect_attempts():
    return _env_int("PROXY_SSH_CONNECT_ATTEMPTS", CONNECT_ATTEMPTS_DEFAULT)


def connect_backoff():
    return _env_backoff("PROXY_SSH_CONNECT_BACKOFF_S", CONNECT_BACKOFF_S_DEFAULT)


def relay_timeout_s():
    try:
        return max(0.05, float(os.environ.get("PROXY_SSH_RELAY_TIMEOUT_S", "") or RELAY_TIMEOUT_S_DEFAULT))
    except ValueError:
        return RELAY_TIMEOUT_S_DEFAULT


def parse_proxy():
    """Return (host, port, user, pass) for the tunnel proxy (port 3130).

    HTTPS_PROXY carries the egress proxy at :3128; the port selects
    Tailscale, so :3128 is rewritten to :3130 (same host/credentials).
    """
    https_proxy = os.environ.get("HTTPS_PROXY", "")
    if https_proxy.endswith(":3128"):
        https_proxy = https_proxy[:-5] + ":3130"
    parsed = urllib.parse.urlparse(https_proxy)
    proxy_host = parsed.hostname
    proxy_port = parsed.port or 3130
    proxy_user = parsed.username or ""
    proxy_pass = parsed.password or ""
    return proxy_host, proxy_port, proxy_user, proxy_pass


class _RetryableError(Exception):
    pass


class _FatalError(Exception):
    pass


def _connect_once(target_host, target_port, proxy_host, proxy_port, proxy_user, proxy_pass):
    """One CONNECT attempt. Returns the connected socket on success.

    Raises _RetryableError with a short message on a transient failure,
    _FatalError on a terminal failure (e.g. 4xx). The socket is closed
    on every failure path; on success the caller owns it.
    """
    sock = socket.create_connection((proxy_host, proxy_port), timeout=15)
    try:
        auth = base64.b64encode(f"{proxy_user}:{proxy_pass}".encode()).decode()
        req = (
            f"CONNECT {target_host}:{target_port} HTTP/1.1\r\n"
            f"Host: {target_host}:{target_port}\r\n"
            f"Proxy-Authorization: Basic {auth}\r\n"
            f"\r\n"
        )
        sock.sendall(req.encode())
        resp = b""
        while b"\r\n\r\n" not in resp:
            chunk = sock.recv(4096)
            if not chunk:
                raise _RetryableError("Proxy closed connection")
            resp += chunk
        status_line = resp.split(b"\r\n", 1)[0].decode("latin-1")
        if " 200 " not in status_line:
            code = status_line.split()[1] if len(status_line.split()) > 1 else ""
            if code in RETRYABLE_PROXY_STATUS:
                raise _RetryableError(f"Proxy CONNECT failed: {status_line}")
            raise _FatalError(f"Proxy CONNECT failed: {status_line}")
        return sock
    except BaseException:
        try:
            sock.close()
        except OSError:
            pass
        raise


def connect_with_retry(target_host, target_port):
    """Establish the CONNECT tunnel, retrying transient failures.

    Returns the connected socket. Exits the process (status 1) when all
    attempts fail or a terminal failure occurs, printing the last error
    to stderr in the same words the old code used, so existing log
    greps ("Proxy closed connection") keep matching.
    """
    proxy_host, proxy_port, proxy_user, proxy_pass = parse_proxy()
    if not proxy_host:
        sys.stderr.write("proxy_ssh: no HTTPS_PROXY configured\n")
        sys.exit(1)
    attempts = connect_attempts()
    backoff = connect_backoff()
    last_error = "Proxy closed connection"
    for attempt in range(1, attempts + 1):
        try:
            return _connect_once(
                target_host, target_port, proxy_host, proxy_port, proxy_user, proxy_pass
            )
        except _FatalError as e:
            sys.stderr.write(f"{e}\n")
            sys.exit(1)
        except (_RetryableError, OSError) as e:
            last_error = str(e) or type(e).__name__
            if attempt < attempts:
                delay = backoff[min(attempt - 1, len(backoff) - 1)] if backoff else 0
                sys.stderr.write(
                    f"proxy_ssh: CONNECT attempt {attempt}/{attempts} failed: "
                    f"{last_error}; retrying in {delay}s\n"
                )
                time.sleep(delay)
    sys.stderr.write(f"{last_error}\n")
    sys.exit(1)


def relay(sock):
    """Relay between stdin/stdout and the tunnel socket until EOF/error.

    A select() timeout is NOT an exit: an idle session (remote command
    producing no output) must stay alive. Only EOF on either side, or
    a socket error, ends the relay. This matches proxy_ssh_direct.py.
    """
    import select
    sock.setblocking(False)
    stdin_fd = sys.stdin.fileno()
    stdout_fd = sys.stdout.fileno()

    import fcntl
    for fd in (stdin_fd, stdout_fd):
        flags = fcntl.fcntl(fd, fcntl.F_GETFL)
        fcntl.fcntl(fd, fcntl.F_SETFL, flags | os.O_NONBLOCK)

    timeout = relay_timeout_s()
    while True:
        r, _, _ = select.select([sock, stdin_fd], [], [], timeout)
        if not r:
            continue  # idle wake-up, not an exit (6 Nov 2026 fix)
        if sock in r:
            try:
                data = sock.recv(65536)
            except BlockingIOError:
                data = None
            if not data:
                break
            os.write(stdout_fd, data)
        if stdin_fd in r:
            try:
                data = os.read(stdin_fd, 65536)
            except BlockingIOError:
                data = None
            if not data:
                break
            sock.sendall(data)


def main():
    if len(sys.argv) != 3:
        sys.stderr.write(f"Usage: {sys.argv[0]} <host> <port>\n")
        sys.exit(1)

    target_host = sys.argv[1]
    target_port = sys.argv[2]

    sock = connect_with_retry(target_host, target_port)
    relay(sock)


if __name__ == "__main__":
    main()
