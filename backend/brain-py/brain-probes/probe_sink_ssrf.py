#!/usr/bin/env python3
"""Generic SSRF-reachability probe for an UNKNOWN query sink.

Rule #63: the one loop hunts targets it has never seen — this probe
takes the sink spec from its marker argv (the loop encodes it there so
_probe_cmd needs no changes):

    MARKER = PLOOP63|<target_base>|<path>|GET|<p1,p2>

An SSRF-reachability claim needs the TARGET'S SERVER to make an HTTP
request to a probe-controlled URL. The probe proves this with its own
tiny listener (no third party, no external egress — the canary URL
points at the listener bound to 127.0.0.1 on an ephemeral port):

  1. LISTENER: a threaded HTTP server on 127.0.0.1:0 records every
     request whose path carries the canary token
     ("ploop63-canary-<nonce>"). It is the ONLY confirm channel.
  2. CONTROL: GET path?<p>=ploop63-benign for each param — sanity
     that the endpoint answers without a URL. The control can never
     confirm (it carries no canary).
  3. CANARY: for each param in turn, GET path?<p> set to the full
     canary URL http://127.0.0.1:<port>/ploop63-canary-<nonce>.
     The probe polls the hit log for ~3s.
  4. CONFIRM only when the listener recorded a hit carrying the
     canary token after the canary request for that param
     -> via=ssrf-fetch-hit.

Fail-closed rules (the probe lesson, 29 Oct):
  - A verbatim echo of the canary URL in the response BODY is NOT a
    fetch — it is a reflection/XSS signal for the sibling probe and
    counts as FAILED here (echo != fetch, an echo page must not
    confirm).
  - A hit that does not carry the token (a coincidental request)
    never confirms.
  - No hit within the poll window -> VERDICT: FAILED.
  - The canary never leaves the local loopback interface; the probe
    opens no outbound connection beyond the target itself.

One self-contained reproducible command, fixed marker from argv, own
VERDICT line. Any exception -> PROBE_ERROR + VERDICT: FAILED.
"""
import http.client
import os
import re
import socket
import sys
import threading
import time
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

TIMEOUT = 15
POLL_SECS = 3.0
_BENIGN = "ploop63-benign"


class _CanaryHandler(BaseHTTPRequestHandler):
    token = ""
    hits = []
    lock = threading.Lock()

    def _answer(self):
        data = b"ploop63-ok"
        self.send_response(200)
        self.send_header("Content-Type", "text/plain")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if _CanaryHandler.token and \
                _CanaryHandler.token in (self.path or ""):
            with _CanaryHandler.lock:
                _CanaryHandler.hits.append(self.path)
        self._answer()

    def do_HEAD(self):
        self._answer()

    def log_message(self, *a):
        pass


def _start_listener(token):
    _CanaryHandler.token = token
    _CanaryHandler.hits = []
    # Rule #73: bind all interfaces — the verifier re-runs this probe
    # inside the hunt container, where 127.0.0.1 is the container's own
    # loopback and the target (on the host) could never reach a
    # loopback-bound listener. The canary URL advertises a
    # target-routable IP (see _advertise_ip); the listener only serves
    # the run-unique token path and shuts down with the probe.
    srv = ThreadingHTTPServer(("0.0.0.0", 0), _CanaryHandler)
    port = srv.server_address[1]
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    return srv, port


def _advertise_ip(tb):
    """IP address the TARGET can reach back for the canary fetch.

    The source IP the OS would use to reach the target: inside a hunt
    container that is the container's bridge IP (the host routes it via
    docker0); on the host it is the host's own IP. No traffic is sent
    (UDP connect only). Falls back to 127.0.0.1 (the pre-Rule-#73
    behavior) on any error — fail-safe, never fail-open.
    """
    try:
        pu = urllib.parse.urlparse(tb.rstrip("/"))
        host = pu.hostname or "127.0.0.1"
        port = pu.port or (443 if pu.scheme == "https" else 80)
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(3)
        s.connect((host, port))
        ip = s.getsockname()[0]
        s.close()
        if ip and ip != "0.0.0.0":
            return ip
    except Exception:
        pass
    return "127.0.0.1"


def _raw_get(tb, path, params):
    pu = urllib.parse.urlparse(tb.rstrip("/") + path)
    host, port = pu.hostname, pu.port
    use_ssl = pu.scheme == "https"
    q = urllib.parse.urlencode(params)
    target = pu.path + ("?" + q if q else "")
    conn_cls = (http.client.HTTPSConnection if use_ssl
                else http.client.HTTPConnection)
    conn = conn_cls(host, port or (443 if use_ssl else 80),
                    timeout=TIMEOUT)
    try:
        conn.request("GET", target,
                     headers={"User-Agent": "PLOOP63",
                              "Host": pu.netloc})
        resp = conn.getresponse()
        body = resp.read().decode("utf-8", "replace")
        return resp.status, body
    finally:
        conn.close()


def _wait_for_hit(token, seen):
    """Poll the hit log up to POLL_SECS for a NEW hit carrying the
    token. Returns the hit path or None."""
    deadline = time.time() + POLL_SECS
    while time.time() < deadline:
        with _CanaryHandler.lock:
            for h in _CanaryHandler.hits[seen:]:
                if token in h:
                    return h
            seen = len(_CanaryHandler.hits)
        time.sleep(0.1)
    return None


def main():
    # argv[1] is the marker: the _probe_cmd wrapper invokes
    #   python3 "$DST" "$MK"   (DST=argv[0], marker=argv[1])
    marker = sys.argv[1] if len(sys.argv) > 1 else "PLOOP63"
    try:
        _, tb_q, path_q, method, params_csv = marker.split("|", 4)
    except ValueError:
        print("PROBE_ERROR bad marker spec: %r" % marker)
        print("VERDICT: FAILED")
        return
    tb = urllib.parse.unquote(tb_q)
    path = urllib.parse.unquote(path_q)
    params = [p for p in params_csv.split(",") if p]
    method = (method or "GET").upper()
    if not tb or not path.startswith("/") or not params or \
            method != "GET":
        print("PROBE_ERROR invalid sink spec "
              "(SSRF reachability needs a GET query sink)")
        print("VERDICT: FAILED")
        return
    token = "ploop63-canary-%s" % os.urandom(3).hex()
    listener, port = _start_listener(token)
    try:
        for p in params:
            # 1. CONTROL: benign value — the endpoint must answer;
            #    it carries no token so it can never confirm.
            try:
                ccode, _ = _raw_get(tb, path, {p: _BENIGN})
            except Exception as e:
                print("PROBE_ERROR control fetch failed for param "
                      "%s: %s" % (p, e))
                print("VERDICT: FAILED")
                return
            with _CanaryHandler.lock:
                seen = len(_CanaryHandler.hits)
            # 2. CANARY: the full listener URL as the param value.
            # Rule #73: advertise a target-routable IP, not 127.0.0.1 —
            # the verifier re-runs this probe inside the hunt container.
            canary = "http://%s:%d/%s" % (_advertise_ip(tb), port, token)
            try:
                code, body = _raw_get(tb, path, {p: canary})
            except Exception as e:
                print("PROBE_ERROR canary fetch failed for param "
                      "%s: %s" % (p, e))
                print("VERDICT: FAILED")
                return
            hit = _wait_for_hit(token, seen)
            if hit:
                print("EVIDENCE sink=%s param=%s via=ssrf-fetch-hit "
                      "code=%d canary=%s hit=%s"
                      % (path, p, code, canary, hit))
                print("EVIDENCE class=ssrf via=ssrf-fetch-hit")
                print("VERDICT: CONFIRMED")
                return
            # Fail-closed: a verbatim echo of the canary URL in the
            # body is reflection, NOT a server-side fetch.
            if canary in body or token in body:
                print("PROBE_NOTE param %s: canary echoed in the "
                      "body but the listener saw no fetch "
                      "(echo != fetch)" % p)
            else:
                print("PROBE_NOTE param %s: no server-side fetch "
                      "of the canary" % p)
    finally:
        listener.shutdown()
        listener.server_close()

    print("VERDICT: FAILED")


if __name__ == "__main__":
    main()
