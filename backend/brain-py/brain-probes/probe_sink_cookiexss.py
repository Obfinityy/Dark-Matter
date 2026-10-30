#!/usr/bin/env python3
"""Generic cookie-sink reflected-XSS probe for an UNKNOWN cookie sink.

Rule #74: the one loop hunts targets it has never seen — cookie sinks
(a Set-Cookie name the server reflects, e.g. theme/prefs/remember-me
values echoed into a page) are a sink KIND the generic set never
covered (query: 9 classes; form: 4; xml: 1; cookie: 0). This probe
takes the sink spec from its marker argv (the loop encodes it there so
_probe_cmd needs no changes):

    MARKER = PLOOP74|<target_base>|<path>|GET|<cookie_name>

A cookie-XSS claim needs the TARGET to reflect an attacker-controlled
cookie value into the response body UNESCAPED. The probe proves this
with a run-unique canary payload (never transmitted anywhere else):

  1. CONTROL: GET path with Cookie: <name>=benign74 — the endpoint
     must answer; the canary is never sent, so it can never confirm.
  2. CANARY: GET path with Cookie: <name>=<img src=x
     onerror=PLOOP74-<nonce>> — executable-shaped (Rule #59/#73:
     the pipeline's xss-reflect signal fires on real reflected
     executable content).

CONFIRMED only when the canary PAYLOAD appears in the canary body
UNESCAPED though it was ABSENT from the control body. A token that
reflects HTML-ENCODED (&lt;img ...) is a safe encoding, not a
vulnerability -> FAILED (the differential, not the echo, confirms).

Fail-closed rules (the probe lesson, 29 Oct):
  - The cookie name is validated ([A-Za-z0-9_.\\-]{1,64}) — a bad
    name aborts instead of injecting header syntax.
  - The control request can never confirm (it carries no canary).
  - The canary token present in the CONTROL body aborts fail-closed
    (a pre-seeded collision would poison the confirm channel).
  - Errors, timeouts -> FAILED. Redirects are NOT followed (a
    redirect endpoint is a different class); the probe reads the raw
    body.
  - No unescaped canary payload in the canary body -> VERDICT: FAILED.

Evidence vocabulary (Rule #73): the CONFIRMED EVIDENCE line mirrors
probe_sink_xss.py's shape (sink= method= cookie= via=html payload
reflected UNESCAPED) so the backend's xss-reflect signal fires on the
real reflected executable content; the future claim class is
xss_reflected (same class, distinct module generic_cookiexss — dedup
is (module, class, location), so a page vulnerable via both a query
param and a cookie files two distinct claims, the Rule #69 rationale).

One self-contained reproducible command, fixed marker from argv, own
VERDICT line. Any exception -> PROBE_ERROR + VERDICT: FAILED. The
probe never fetches anything external; it only asks the TARGET for a
URL the loop's own scope gate already allowed.
"""
import http.client
import os
import re
import sys
import urllib.parse

REQ_TIMEOUT = 15
_COOKIE_NAME_RE = re.compile(r"[A-Za-z0-9_.\-]{1,64}\Z")


def _raw_get(tb, path, cookie_header):
    """GET without following redirects. Returns (code, headers, body)."""
    pu = urllib.parse.urlparse(tb.rstrip("/") + path)
    host, port = pu.hostname, pu.port
    use_ssl = pu.scheme == "https"
    conn_cls = (http.client.HTTPSConnection if use_ssl
                else http.client.HTTPConnection)
    conn = conn_cls(host, port or (443 if use_ssl else 80),
                    timeout=REQ_TIMEOUT)
    try:
        conn.request("GET", pu.path,
                     headers={"User-Agent": "PLOOP74",
                              "Cookie": cookie_header})
        resp = conn.getresponse()
        body = resp.read().decode("utf-8", "replace")
        headers = {k.lower(): v for k, v in resp.getheaders()}
        return resp.status, headers, body
    finally:
        conn.close()


def main():
    # argv[1] is the marker: the _probe_cmd wrapper invokes
    #   python3 "$DST" "$MK"   (DST=argv[0], marker=argv[1])
    marker = sys.argv[1] if len(sys.argv) > 1 else "PLOOP74"
    try:
        _, tb_q, path_q, method, cookie_csv = marker.split("|", 4)
    except ValueError:
        print("PROBE_ERROR bad marker spec: %r" % marker)
        print("VERDICT: FAILED")
        return
    tb = urllib.parse.unquote(tb_q)
    path = urllib.parse.unquote(path_q)
    method = (method or "GET").upper()
    cookie_name = (cookie_csv or "").split(",")[0].strip()
    if not tb or not path.startswith("/") or method != "GET":
        print("PROBE_ERROR invalid sink spec "
              "(cookie-XSS needs a GET path sink)")
        print("VERDICT: FAILED")
        return
    if not _COOKIE_NAME_RE.match(cookie_name):
        print("PROBE_ERROR invalid cookie name %r (fail-closed: no "
              "header-syntax injection via the marker)" % cookie_name)
        print("VERDICT: FAILED")
        return
    nonce = os.urandom(4).hex()
    token = "PLOOP74-%s" % nonce  # never transmitted except in payload
    payload = "<img src=x onerror=%s>" % token  # executable-shaped
    print("EVIDENCE sink=%s marker=%s" % (path, marker))
    # 1. Control: benign cookie value; can never confirm.
    try:
        _ccode, _cheaders, cbody = _raw_get(
            tb, path, "%s=benign74" % cookie_name)
    except Exception as exc:
        print("PROBE_ERROR control errored: %s" % exc)
        print("VERDICT: FAILED")
        return
    if token in cbody or payload in cbody:
        print("PROBE_ERROR fail-closed: canary token present in the "
              "control body without being sent")
        print("VERDICT: FAILED")
        return
    # 2. Canary: attacker-controlled cookie value, executable-shaped.
    try:
        _code, _headers, body = _raw_get(tb, path,
                                         "%s=%s" % (cookie_name, payload))
    except Exception as exc:
        print("PROBE_ERROR canary errored: %s" % exc)
        print("VERDICT: FAILED")
        return
    if payload in body and payload not in cbody:
        print("EVIDENCE sink=%s method=GET cookie=%s via=html payload "
              "reflected UNESCAPED: %s" % (path, cookie_name, payload))
        print("detail: the attacker-controlled cookie %r reflected "
              "unescaped into the response body though it was absent "
              "from the control body (executable shape, xss-reflect "
              "readable)" % cookie_name)
        print("VERDICT: CONFIRMED")
        return
    if token in body and payload not in body:
        print("PROBE_NOTE: cookie value reflected but HTML-ENCODED "
              "(safe encoding, not a vulnerability)")
        print("VERDICT: FAILED")
        return
    print("PROBE_NOTE: cookie value not reflected unescaped")
    print("VERDICT: FAILED")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("PROBE_ERROR: %s" % exc)
        print("VERDICT: FAILED")
