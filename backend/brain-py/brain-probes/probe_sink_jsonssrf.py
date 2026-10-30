#!/usr/bin/env python3
"""Generic JSON-body-sink SSRF-reachability probe for an UNKNOWN JSON
sink.

Rule #86: the one loop hunts targets it has never seen — JSON-body
sinks covered reflected XSS (Rule #80), SQLi (Rule #84) and command
injection (Rule #85), but APIs that take a URL-ish JSON field
(webhook registration, avatar URL, link preview, oEmbed, PDF-from-URL)
and fetch it server-side are a fourth JSON class the generic set
never covered: query-SSRF (Rule #63) attacks ?params only, never the
JSON body, so a JSON-field server-side fetch never trips it. A real
human hunter posts {"url": "http://evil"} too.

The probe takes the sink spec from its marker argv (the one loop
encodes it there so _probe_cmd needs no changes):

    MARKER = PLOOP86|<target_base>|<path>|POST|<field_csv>

Rule #80 PART 2 pattern: the 5th component is a CSV of common JSON
field names (the engine cannot know the API's real field names). The
probe tries each name in order — control+differential per field — and
the first CONFIRMED wins, so the engine budget stays 2 turns per
sink. Every name is validated up front; one bad name fails the whole
probe closed (a quote or brace in the marker must never reach
json.dumps as a key).

An SSRF-reachability claim needs the TARGET'S SERVER to make an HTTP
request to a probe-controlled URL. The probe proves this with its own
tiny listener (no third party, no external egress — the canary URL
points at the listener bound to 0.0.0.0 on an ephemeral port):

  1. LISTENER: a threaded HTTP server on 0.0.0.0:0 records every
     request whose path carries the canary token
     ("ploop86-canary-<nonce>"). It is the ONLY confirm channel.
  2. STABILITY GATE: POST the same benign JSON twice per field. If
     the two bodies differ, the endpoint is dynamic/noisy and no
     claim can be grounded -> skip that field (the Rule #55
     false-positive lesson). The control carries no canary so it can
     never confirm.
  3. CANARY: POST {field: <canary URL>}, the full listener URL
     http://<target-routable IP>:<port>/ploop86-canary-<nonce>. The
     probe polls the hit log for ~3s.
  4. CONFIRM only when the listener recorded a hit carrying the
     canary token after the canary request for that field
     -> via=ssrf-fetch-hit.

The benign base is run-unique (benign86-<nonce>): every run is an
independent reconfirm (Rule #81) — no replayed evidence.

Evidence vocabulary (Rule #73): mirrors probe_sink_ssrf.py —
  EVIDENCE sink=<path> json_field=<f> via=ssrf-fetch-hit code=<code>
    canary=<url> hit=<hitpath>
  EVIDENCE class=ssrf via=ssrf-fetch-hit;
the future claim class is "ssrf" (same class as Rule #63, distinct
module generic_jsonssrf — dedup is (module, class, location), so an
endpoint fetchable via both a query param and a JSON field files two
distinct claims, the Rule #69 rationale).

Fail-closed rules (the probe lesson, 29 Oct):
  - Marker must be PLOOP86|<tb>|<path>|POST|<csv>; non-POST fails
    closed (JSON sinks are POST-only).
  - The JSON field name is validated ([A-Za-z0-9_.[\\]-]{1,64}) —
    a bad name aborts instead of injecting JSON syntax.
  - The control requests can never confirm (benign value, no
    canary).
  - A verbatim echo of the canary URL in the response BODY is NOT a
    fetch — it is a reflection/XSS signal for the sibling probe and
    counts as FAILED here (echo != fetch).
  - A hit that does not carry the token (a coincidental request)
    never confirms.
  - No hit within the poll window -> that field FAILED; all fields
    FAILED -> VERDICT: FAILED.
  - The canary never leaves the target's own fetch path; the probe
    opens no outbound connection beyond the target itself.

One self-contained reproducible command, fixed marker from argv, own
VERDICT line. Any exception -> PROBE_ERROR + VERDICT: FAILED.
"""
import http.client
import json
import os
import re
import socket
import sys
import threading
import time
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

REQ_TIMEOUT = 15
POLL_SECS = 3.0
_FIELD_NAME_RE = re.compile(r"[A-Za-z0-9_.\[\]-]{1,64}\Z")


class _CanaryHandler(BaseHTTPRequestHandler):
    token = ""
    hits = []
    lock = threading.Lock()

    def _answer(self):
        data = b"ploop86-ok"
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


def _post_json(tb, path, body_dict, timeout=REQ_TIMEOUT):
    """POST JSON without following redirects. Returns (code, body).
    Error-status bodies are signal too; transport errors raise and
    the caller fails closed."""
    pu = urllib.parse.urlparse(tb.rstrip("/") + path)
    host, port = pu.hostname, pu.port
    use_ssl = pu.scheme == "https"
    conn_cls = (http.client.HTTPSConnection if use_ssl
                else http.client.HTTPConnection)
    raw = json.dumps(body_dict).encode("utf-8")
    conn = conn_cls(host, port or (443 if use_ssl else 80),
                    timeout=timeout)
    try:
        conn.request("POST", pu.path, body=raw,
                     headers={"User-Agent": "PLOOP86",
                              "Content-Type": "application/json",
                              "Content-Length": str(len(raw))})
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
    marker = sys.argv[1] if len(sys.argv) > 1 else "PLOOP86"
    try:
        _, tb_q, path_q, method, field_csv = marker.split("|", 4)
    except ValueError:
        print("PROBE_ERROR bad marker spec: %r" % marker)
        print("VERDICT: FAILED")
        return
    tb = urllib.parse.unquote(tb_q)
    path = urllib.parse.unquote(path_q)
    method = (method or "POST").upper()
    fields = [f.strip() for f in (field_csv or "").split(",")]
    fields = [f for f in fields if f]
    if not tb or not path.startswith("/") or method != "POST":
        print("PROBE_ERROR invalid sink spec "
              "(JSON-SSRF needs a POST JSON-body sink)")
        print("VERDICT: FAILED")
        return
    # Every name is validated UP FRONT — one bad name fails the whole
    # probe closed (a quote or brace in the marker must never reach
    # json.dumps as a key).
    for f in fields:
        if not _FIELD_NAME_RE.match(f):
            print("PROBE_ERROR invalid JSON field name %r (fail-closed: "
                  "no JSON-syntax injection via the marker)" % f)
            print("VERDICT: FAILED")
            return
    if not fields:
        print("PROBE_ERROR no JSON field names in marker (fail-closed)")
        print("VERDICT: FAILED")
        return
    nonce = os.urandom(4).hex()
    base = "benign86-" + nonce  # run-unique benign value (Rule #81)
    print("RUN_NONCE %s" % nonce)
    print("EVIDENCE sink=%s marker=%s" % (path, marker))
    token = "ploop86-canary-%s" % os.urandom(3).hex()
    listener, port = _start_listener(token)
    try:
        for field in fields:
            # STABILITY GATE + CONTROL: the identical benign JSON
            # POST twice. It carries no canary so it can never
            # confirm; a dynamic endpoint fails closed for the field.
            try:
                _, b1 = _post_json(tb, path, {field: base})
                _, b2 = _post_json(tb, path, {field: base})
            except Exception as exc:
                print("PROBE_ERROR field %s control fetch failed: %s"
                      % (field, exc))
                print("VERDICT: FAILED")
                return
            if b1 != b2:
                print("FIELD %s: skipped (dynamic endpoint, baseline "
                      "unstable — no claim grounded)" % field)
                continue
            with _CanaryHandler.lock:
                seen = len(_CanaryHandler.hits)
            # CANARY: the full listener URL as the field value.
            # Rule #73: advertise a target-routable IP, not
            # 127.0.0.1 — the verifier re-runs this probe inside the
            # hunt container.
            canary = "http://%s:%d/%s" % (_advertise_ip(tb), port,
                                         token)
            try:
                code, body = _post_json(tb, path, {field: canary})
            except Exception as exc:
                print("PROBE_ERROR field %s canary fetch failed: %s"
                      % (field, exc))
                print("VERDICT: FAILED")
                return
            hit = _wait_for_hit(token, seen)
            if hit:
                print("EVIDENCE sink=%s json_field=%s "
                      "via=ssrf-fetch-hit code=%d canary=%s hit=%s"
                      % (path, field, code, canary, hit))
                print("EVIDENCE class=ssrf via=ssrf-fetch-hit")
                print("VERDICT: CONFIRMED")
                return
            # Fail-closed: a verbatim echo of the canary URL in the
            # body is reflection, NOT a server-side fetch.
            if canary in body or token in body:
                print("PROBE_NOTE field %s: canary echoed in the "
                      "body but the listener saw no fetch "
                      "(echo != fetch)" % field)
            else:
                print("PROBE_NOTE field %s: no server-side fetch "
                      "of the canary" % field)
    finally:
        listener.shutdown()
        listener.server_close()

    print("VERDICT: FAILED")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("PROBE_ERROR: %s" % exc)
        print("VERDICT: FAILED")
