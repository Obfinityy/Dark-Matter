#!/usr/bin/env python3
"""
Brain Proxy v1 — forward proxy + request audit + scope enforcement (Rule #28).

Why: Rule #27 wired every lane with a scope gate, but a gate in each lane
only sees the turn's *declared* URL. A proxy sees EVERY request the agent's
tools actually send — it is the one enforcement point that cannot be dodged
by a probe shelling out somewhere the lane never checked. It also produces
the audit trail a submission-quality report needs: every request, every
response code, every block.

Usage:
  python3 brain-proxy-v1.py --port 0 --audit-log audit.jsonl \
      [--scope-file scope.json] [--pid-file proxy.pid]
  python3 brain-proxy-v1.py --self-test

Curl/requests route through it with:
  http_proxy=http://127.0.0.1:PORT https_proxy=http://127.0.0.1:PORT
  (no_proxy/NO_PROXY must be CLEARED or the target bypasses the proxy.)

Design (stdlib only — no mitmdump on the VM):
- HTTP/1.0 semantics (one connection per request): simple, curl and
  requests handle it fine, no keep-alive state bugs.
- Bodies forwarded as RAW BYTES, never decoded (Rule #20 hash invariant:
  a page fetched through the proxy must hash identically).
- Fail-closed: Scope.url_allowed never raises (returns (False, reason) on
  anything malformed); denied requests get 403 with ZERO bytes sent to the
  origin; any forwarding exception -> 502 + audit entry; the proxy itself
  never dies on a bad request.
- CONNECT (https_proxy): host-level gate only. Path enforcement over a
  blind tunnel would need MITM certs — documented limit, denied CONNECTs
  get 403, allowed ones are byte-tunneled.

Audit log (JSONL, one line per request):
  {ts_ist, method, url, host, path, req_bytes, resp_status, resp_bytes,
   blocked, block_reason, error, elapsed_ms}
"""

import argparse
import http.client
import http.server
import importlib.util
import json
import os
import select
import socket
import socketserver
import sys
import threading
import time
import urllib.parse
from datetime import datetime, timezone, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
IST = timezone(timedelta(hours=5, minutes=30))

HOP_HEADERS = {
    "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
    "proxy-connection", "te", "trailer", "transfer-encoding", "upgrade",
}


def now_ist():
    return datetime.now(IST).strftime("%Y-%m-%d %H:%M:%S")


def load_scope_module():
    spec = importlib.util.spec_from_file_location(
        "brain_scope_v1", os.path.join(HERE, "brain-scope-v1.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class AuditLog:
    def __init__(self, path):
        self.path = path
        self.lock = threading.Lock()
        self.count = 0
        self.blocked = 0

    def write(self, entry):
        entry = dict(entry)
        entry["ts_ist"] = now_ist()
        line = json.dumps(entry, separators=(",", ":"))
        with self.lock:
            with open(self.path, "a", encoding="utf-8") as f:
                f.write(line + "\n")
            self.count += 1
            if entry.get("blocked"):
                self.blocked += 1


class ProxyHandler(http.server.BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.0"  # one connection per request; no keep-alive bugs
    server_version = "BrainProxy/1.0"

    def log_message(self, *a):  # audit log owns observability; stay quiet
        pass

    # ---- request body ----
    def _read_body(self):
        length = self.headers.get("Content-Length")
        if length:
            try:
                n = int(length)
            except ValueError:
                n = 0
            if n > 0:
                return self.rfile.read(n)
            return b""
        if self.headers.get("Transfer-Encoding", "").lower() == "chunked":
            return self._read_chunked()
        return b""

    def _read_chunked(self):
        out = b""
        while True:
            line = self.rfile.readline(8192).decode("ascii", "replace").strip()
            try:
                n = int(line.split(";")[0], 16)
            except ValueError:
                break
            if n == 0:
                self.rfile.readline(8192)
                break
            out += self.rfile.read(n)
            self.rfile.readline(8192)
            if len(out) > 50 * 1024 * 1024:
                break
        return out

    # ---- target resolution ----
    def _target_url(self):
        """Absolute URI from the request line (proxy form), else Host header."""
        p = self.path or ""
        if p.startswith("http://") or p.startswith("https://"):
            return p
        host = self.headers.get("Host", "")
        if host:
            return "http://" + host + (p if p.startswith("/") else "/" + p)
        return None

    def _deny(self, reason, url, method, req_len, audit):
        body = ("SCOPE-BLOCK: " + reason).encode("utf-8")
        try:
            self.send_response(403, "Scope Blocked")
            self.send_header("Content-Type", "text/plain")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass
        audit.write({"method": method, "url": url,
                     "host": urllib.parse.urlsplit(url or "").netloc,
                     "path": urllib.parse.urlsplit(url or "").path,
                     "req_bytes": req_len, "resp_status": 403,
                     "resp_bytes": len(body), "blocked": True,
                     "block_reason": reason, "error": None, "elapsed_ms": 0})

    # ---- plain HTTP forwarding ----
    def _forward(self):
        audit = self.server.audit
        scope = self.server.scope
        start = time.time()
        url = self._target_url()
        body = self._read_body()
        if not url:
            self.send_error(400, "no target URL")
            return
        if scope is not None:
            try:
                ok, reason = scope.url_allowed(url)
            except Exception as e:  # belt and suspenders: never raise
                ok, reason = False, f"scope check crashed: {e}"
            if not ok:
                self._deny(reason, url, self.command, len(body), audit)
                return
        parts = urllib.parse.urlsplit(url)
        err = None
        status, rheaders, rbody = 502, [], b"Bad Gateway"
        try:
            if parts.scheme == "https":
                conn = http.client.HTTPSConnection(parts.hostname,
                                                   parts.port or 443,
                                                   timeout=30)
            else:
                conn = http.client.HTTPConnection(parts.hostname,
                                                  parts.port or 80,
                                                  timeout=30)
            path = parts.path or "/"
            if parts.query:
                path += "?" + parts.query
            fwd = {}
            for k, v in self.headers.items():
                if k.lower() not in HOP_HEADERS:
                    fwd[k] = v
            fwd["Connection"] = "close"
            conn.request(self.command, path, body=body, headers=fwd)
            resp = conn.getresponse()
            rbody = resp.read()
            status = resp.status
            rheaders = [(k, v) for k, v in resp.getheaders()
                        if k.lower() not in HOP_HEADERS]
            conn.close()
        except Exception as e:
            err = f"{type(e).__name__}: {e}"
            status, rbody = 502, b"Bad Gateway"
        try:
            self.send_response(status)
            self.send_header("Content-Length", str(len(rbody)))
            for k, v in rheaders:
                if k.lower() != "content-length":
                    self.send_header(k, v)
            self.end_headers()
            if self.command != "HEAD" and rbody:
                self.wfile.write(rbody)
        except (BrokenPipeError, ConnectionResetError):
            pass
        audit.write({"method": self.command, "url": url, "host": parts.netloc,
                     "path": parts.path, "req_bytes": len(body),
                     "resp_status": status, "resp_bytes": len(rbody),
                     "blocked": False, "block_reason": None, "error": err,
                     "elapsed_ms": round((time.time() - start) * 1000, 1)})

    do_GET = _forward
    do_POST = _forward
    do_PUT = _forward
    do_DELETE = _forward
    do_HEAD = _forward
    do_OPTIONS = _forward
    do_PATCH = _forward

    # ---- CONNECT (https_proxy) ----
    def do_CONNECT(self):
        audit = self.server.audit
        scope = self.server.scope
        start = time.time()
        hostport = (self.path or "").strip()
        host = hostport.split(":")[0] if hostport else ""
        port = 443
        if ":" in hostport:
            try:
                port = int(hostport.rsplit(":", 1)[1])
            except ValueError:
                port = 443
        # Host-level gate: the tunnel is opaque, so only the host can be
        # checked (documented limit — no MITM certs in the lab).
        blocked_reason = None
        # Host-level gate: the tunnel is opaque, so only the host can be
        # checked (documented limit — no MITM certs in the lab; path rules
        # cannot apply to a path we cannot see). The security property that
        # matters — foreign hosts never get a tunnel — holds.
        blocked_reason = None
        if scope is not None:
            try:
                cp = urllib.parse.urlsplit(f"https://{hostport}/")
                chost = (cp.hostname or "").lower()
                cport = cp.port
                # Mirror brain-scope-v1._norm_host for https exactly.
                if cport and cport != 443:
                    chost = f"{chost}:{cport}"
                if chost not in scope.allow_hosts:
                    blocked_reason = (
                        f"blocked: CONNECT host {chost!r} not in allow_hosts "
                        f"{sorted(scope.allow_hosts)}")
            except Exception as e:
                blocked_reason = f"fail-closed: {type(e).__name__}: {e}"
        url = f"CONNECT {hostport}"
        if blocked_reason or not host:
            body = ("SCOPE-BLOCK: " + (blocked_reason or "empty CONNECT target")
                    ).encode()
            try:
                self.send_response(403, "Scope Blocked")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            except (BrokenPipeError, ConnectionResetError):
                pass
            audit.write({"method": "CONNECT", "url": url, "host": host,
                         "path": "", "req_bytes": 0, "resp_status": 403,
                         "resp_bytes": len(body), "blocked": True,
                         "block_reason": blocked_reason or "empty target",
                         "error": None,
                         "elapsed_ms": round((time.time() - start) * 1000, 1)})
            return
        try:
            upstream = socket.create_connection((host, port), timeout=30)
        except Exception as e:
            try:
                self.send_error(502, f"tunnel failed: {e}")
            except (BrokenPipeError, ConnectionResetError):
                pass
            audit.write({"method": "CONNECT", "url": url, "host": host,
                         "path": "", "req_bytes": 0, "resp_status": 502,
                         "resp_bytes": 0, "blocked": False,
                         "block_reason": None,
                         "error": f"tunnel failed: {e}",
                         "elapsed_ms": round((time.time() - start) * 1000, 1)})
            return
        try:
            self.send_response(200, "Connection established")
            self.end_headers()
        except (BrokenPipeError, ConnectionResetError):
            upstream.close()
            return
        tunneled = self._tunnel(self.connection, upstream)
        upstream.close()
        audit.write({"method": "CONNECT", "url": url, "host": host,
                     "path": "", "req_bytes": 0, "resp_status": 200,
                     "resp_bytes": tunneled, "blocked": False,
                     "block_reason": None, "error": None,
                     "elapsed_ms": round((time.time() - start) * 1000, 1)})

    @staticmethod
    def _tunnel(a, b, idle_s=30, cap_s=300):
        """Byte-relay between two sockets. Returns bytes relayed."""
        total = 0
        deadline = time.time() + cap_s
        socks = [a, b]
        try:
            while time.time() < deadline:
                r, _, _ = select.select(socks, [], [], idle_s)
                if not r:
                    break
                for s in r:
                    try:
                        data = s.recv(65536)
                    except OSError:
                        return total
                    if not data:
                        return total
                    (b if s is a else a).sendall(data)
                    total += len(data)
        except OSError:
            pass
        return total


class ProxyServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def __init__(self, addr, audit, scope):
        self.audit = audit
        self.scope = scope
        super().__init__(addr, ProxyHandler)


def run_proxy(port, audit_log, scope_file=None):
    audit = AuditLog(audit_log)
    scope = None
    if scope_file:
        smod = load_scope_module()
        scope = smod.load_scope(scope_file)
        print(f"[proxy] scope enforced from {scope_file}", flush=True)
    srv = ProxyServer(("127.0.0.1", port), audit, scope)
    real_port = srv.server_address[1]
    print(f"[proxy] listening on 127.0.0.1:{real_port} audit={audit_log}",
          flush=True)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    return real_port


# ---------------------------------------------------------------- self-test

def _free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    p = s.getsockname()[1]
    s.close()
    return p


class _OriginHandler(http.server.BaseHTTPRequestHandler):
    hits = {}
    lock = threading.Lock()
    protocol_version = "HTTP/1.0"

    def log_message(self, *a):
        pass

    def _rec(self):
        with _OriginHandler.lock:
            _OriginHandler.hits[self.path] = \
                _OriginHandler.hits.get(self.path, 0) + 1

    def do_GET(self):
        self._rec()
        length = int(self.headers.get("Content-Length") or 0)
        if length:
            self.rfile.read(length)
        body = ("ORIGIN-BODY path=" + self.path).encode()
        self.send_response(200)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        self._rec()
        length = int(self.headers.get("Content-Length") or 0)
        data = self.rfile.read(length) if length else b""
        body = b"ECHO:" + data
        self.send_response(200)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def _start_origin(host="127.0.0.1"):
    srv = http.server.HTTPServer((host, 0), _OriginHandler)
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    return srv, srv.server_address[1]


def _start_proxy(audit_path, scope_file=None):
    port = _free_port()
    audit = AuditLog(audit_path)
    scope = None
    if scope_file:
        scope = load_scope_module().load_scope(scope_file)
    srv = ProxyServer(("127.0.0.1", port), audit, scope)
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    time.sleep(0.2)
    return srv, port, audit


def _via_proxy(proxy_port, url, method="GET", data=None):
    conn = http.client.HTTPConnection("127.0.0.1", proxy_port, timeout=15)
    headers = {}
    if data is not None:
        headers["Content-Length"] = str(len(data))
    conn.request(method, url, body=data, headers=headers)
    r = conn.getresponse()
    body = r.read()
    conn.close()
    return r.status, body


def _wait_audit(path, n, timeout=5.0):
    """Poll until the audit file holds >= n lines (the handler thread
    writes the audit entry after the response bytes leave the socket, so
    an immediate read races it)."""
    end = time.time() + timeout
    while time.time() < end:
        try:
            with open(path, encoding="utf-8") as f:
                lines = f.readlines()
            if len(lines) >= n:
                return [json.loads(l) for l in lines]
        except FileNotFoundError:
            pass
        time.sleep(0.05)
    with open(path, encoding="utf-8") as f:
        return [json.loads(l) for l in f.readlines()]


def self_test():
    import tempfile
    tmp = tempfile.mkdtemp(prefix="proxyselftest")
    passed, failed = [], []

    def check(name, cond, detail=""):
        (passed if cond else failed).append(name)
        print(("  PASS " if cond else "  FAIL ") + name +
              (f" — {detail}" if detail and not cond else ""), flush=True)

    print("[self-test] origin + proxy, no scope", flush=True)
    _OriginHandler.hits = {}
    osrv, oap = _start_origin()
    audit_p = os.path.join(tmp, "audit.jsonl")
    psrv, pap, audit = _start_proxy(audit_p)
    target = f"http://127.0.0.1:{oap}/hello?x=1"

    # 1. GET through proxy == direct fetch (body integrity, Rule #20)
    direct = http.client.HTTPConnection("127.0.0.1", oap, timeout=10)
    direct.request("GET", "/hello?x=1")
    dr = direct.getresponse()
    dbody, dstatus = dr.read(), dr.status
    direct.close()
    st, pbody = _via_proxy(pap, target)
    import hashlib
    check("get-200", st == 200, f"status={st}")
    check("body-identical",
          hashlib.sha256(pbody).hexdigest() == hashlib.sha256(dbody).hexdigest(),
          "proxy mutated the body")

    # 2. POST echo both directions intact
    st, pbody = _via_proxy(pap, target, "POST", b"marker=PX7719&x=<s>")
    check("post-echo", st == 200 and pbody == b"ECHO:marker=PX7719&x=<s>",
          f"status={st} body={pbody!r}")

    # 3. audit entries written, fields sane
    lines = _wait_audit(audit_p, 2)
    check("audit-count", len(lines) >= 2, f"lines={len(lines)}")
    g = [l for l in lines if l["method"] == "GET"][0]
    check("audit-fields",
          g["url"] == target and g["resp_status"] == 200
          and g["resp_bytes"] == len(dbody) and not g["blocked"]
          and g["host"] == f"127.0.0.1:{oap}",
          json.dumps(g)[:200])
    p = [l for l in lines if l["method"] == "POST"][0]
    check("audit-post-bytes", p["req_bytes"] == len(b"marker=PX7719&x=<s>"))

    # 4. scope enforcement: allow /ok exact, deny everything else + foreign host
    print("[self-test] scope enforcement", flush=True)
    _, obp = _start_origin("127.0.0.2")  # foreign-host listener with counter
    scope_spec = {
        "target_base": f"http://127.0.0.1:{oap}",
        # NOTE: _norm_host keeps non-default ports, so allow_hosts must
        # carry them too (same as default_scope() builds from target_base).
        "allow_hosts": [f"127.0.0.1:{oap}"],
        "allow_exact_paths": ["/ok"],
        # Empty prefix list would default to ["/"] (match-all) — use a
        # non-matching prefix to prove exact-only restriction.
        "allow_path_prefixes": ["/never-matches-anything-zzz/"],
        "deny_path_prefixes": [],
    }
    spath = os.path.join(tmp, "scope.json")
    json.dump(scope_spec, open(spath, "w", encoding="utf-8"))
    audit2_p = os.path.join(tmp, "audit2.jsonl")
    psrv2, pap2, _ = _start_proxy(audit2_p, spath)
    _OriginHandler.hits = {}
    st, _ = _via_proxy(pap2, f"http://127.0.0.1:{oap}/ok")
    check("scope-allow-exact", st == 200, f"status={st}")
    st, body = _via_proxy(pap2, f"http://127.0.0.1:{oap}/nope")
    check("scope-deny-path", st == 403 and b"SCOPE-BLOCK" in body,
          f"status={st}")
    check("scope-deny-zero-origin-bytes",
          _OriginHandler.hits.get("/nope", 0) == 0,
          f"hits={_OriginHandler.hits}")
    st, _ = _via_proxy(pap2, f"http://127.0.0.2:{obp}/")
    check("scope-deny-foreign-host", st == 403, f"status={st}")
    check("scope-deny-foreign-zero-bytes",
          _OriginHandler.hits.get("/", 0) == 0,
          f"hits={_OriginHandler.hits}")
    lines2 = _wait_audit(audit2_p, 3)
    blocked = [l for l in lines2 if l["blocked"]]
    check("audit-blocked-with-reason",
          len(blocked) == 2 and all(b["block_reason"] for b in blocked),
          f"blocked={len(blocked)}")
    check("audit-allowed-not-blocked",
          any(not l["blocked"] and l["resp_status"] == 200 for l in lines2))

    # 5. CONNECT gate: denied host -> 403; allowed host -> 200 tunnel setup
    print("[self-test] CONNECT gate", flush=True)
    s = socket.create_connection(("127.0.0.1", pap2), timeout=10)
    s.sendall(b"CONNECT 127.0.0.2:443 HTTP/1.1\r\nHost: 127.0.0.2:443\r\n\r\n")
    resp = s.recv(4096).decode("ascii", "replace")
    s.close()
    check("connect-deny-foreign", resp.startswith("HTTP/1.0 403"),
          resp.splitlines()[0] if resp else "no response")
    s = socket.create_connection(("127.0.0.1", pap2), timeout=10)
    s.sendall(f"CONNECT 127.0.0.1:{oap} HTTP/1.1\r\n"
              f"Host: 127.0.0.1:{oap}\r\n\r\n".encode())
    resp = s.recv(4096).decode("ascii", "replace")
    s.close()
    check("connect-allow-tunnel", resp.startswith("HTTP/1.0 200"),
          resp.splitlines()[0] if resp else "no response")

    # 6. malformed input must not kill the proxy
    print("[self-test] robustness", flush=True)
    s = socket.create_connection(("127.0.0.1", pap), timeout=10)
    s.sendall(b"\x00\xff garbage \r\n\r\n")
    try:
        s.recv(4096)
    except OSError:
        pass
    s.close()
    time.sleep(0.3)
    st, _ = _via_proxy(pap, target)
    check("survives-garbage", st == 200, f"status={st}")

    print(f"[self-test] {len(passed)} passed, {len(failed)} failed",
          flush=True)
    for f in failed:
        print(f"  FAILED: {f}", flush=True)
    return 1 if failed else 0


# ---------------------------------------------------------------- main

def main():
    p = argparse.ArgumentParser(description="Brain proxy v1 — audit + scope")
    p.add_argument("--port", type=int, default=0)
    p.add_argument("--audit-log", default="proxy-audit.jsonl")
    p.add_argument("--scope-file", default=None)
    p.add_argument("--pid-file", default=None)
    p.add_argument("--self-test", action="store_true")
    args = p.parse_args()
    if args.self_test:
        sys.exit(self_test())
    if args.pid_file:
        with open(args.pid_file, "w", encoding="utf-8") as f:
            f.write(str(os.getpid()))
    run_proxy(args.port, args.audit_log, args.scope_file)


if __name__ == "__main__":
    main()
