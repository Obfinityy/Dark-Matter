#!/usr/bin/env python3
"""Generic server-side template injection probe for an UNKNOWN query sink.

Rule #67: the one loop hunts targets it has never seen — this probe
takes the sink spec from its marker argv (the loop encodes it there so
_probe_cmd needs no changes):

    MARKER = PLOOP67|<target_base>|<path>|GET|<p1,p2>

An SSTI claim needs the TARGET's server to EVALUATE attacker template
syntax in a query param. The probe proves this per param through an
ARITHMETIC channel: it sends template-syntax arithmetic that must be
EVALUATED server-side, trying the four common dialects as a ladder:

  GET path?<p>={{1234*5678}}    (Jinja2 / Twig / Smarty)
  GET path?<p>=${1234*5678}     (JSP EL / Thymeleaf)
  GET path?<p>=#{1234*5678}     (FreeMarker)
  GET path?<p>=*{1234*5678}     (Thymeleaf)

The probe NEVER transmits the arithmetic result "7006652" — only a
server-side template engine can explain its presence in the response
body -> via=ssti-jinja / ssti-el / ssti-freemarker / ssti-thymeleaf.

CONFIRM only when the response body contains "7006652" which was never
in the request. A verbatim echo of the payload ("{{1234*5678}}"
visible, "7006652" absent) is reflection -> FAILED (the hard negative
control). If the BENIGN baseline already contains "7006652" (a static
page quoting it), the probe fails closed — a claim must never rest on
a result the app serves to everyone.

Fail-closed rules (the probe lesson, 29 Oct):
  - The control request can never confirm (benign value, no payload).
  - Result present in the benign baseline -> VERDICT: FAILED.
  - Reflected payload without the arithmetic result -> FAILED
    (reflection, not evaluation).
  - Errors, timeouts, empty bodies -> FAILED.
  - No result in any payload response -> VERDICT: FAILED.

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
_BENIGN = "ploop67-benign"
# Arithmetic channel: NEVER transmitted in any request. Only a
# server-side template engine can explain its presence in a response.
_A, _B = 1234, 5678
_RESULT = str(_A * _B)  # "7006652"
# Dialect ladder: (payload, via). The via cites the dialect the target
# actually evaluated.
_PAYLOADS = [
    ("{{%d*%d}}" % (_A, _B), "ssti-jinja"),
    ("${%d*%d}" % (_A, _B), "ssti-el"),
    ("#{%d*%d}" % (_A, _B), "ssti-freemarker"),
    ("*{%d*%d}" % (_A, _B), "ssti-thymeleaf"),
]


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
                     headers={"User-Agent": "PLOOP67",
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
    # Fail closed when the app serves the arithmetic result to
    # everyone: a claim could then never distinguish real evaluation.
    if _RESULT in base_body:
        return ("FAILED", None,
                "fail-closed: %s present in the benign baseline"
                % _RESULT)
    # 2. Dialect ladder.
    for payload, via in _PAYLOADS:
        try:
            code, body, _rtt = _get(tb, path, {param: payload})
        except Exception:
            continue  # one dead payload never aborts the ladder
        if _RESULT in body:
            return ("CONFIRMED", via,
                    "body contains the arithmetic result %s, which "
                    "was never transmitted (template evaluated "
                    "server-side)" % _RESULT)
        # Verbatim echo of the payload without the result is
        # reflection, not evaluation — note it and keep climbing (it
        # can never confirm).
    return "FAILED", None, "no evaluated arithmetic in any payload response"


def main():
    # argv[1] is the marker: the _probe_cmd wrapper invokes
    #   python3 "$DST" "$MK"   (DST=argv[0], marker=argv[1])
    marker = sys.argv[1] if len(sys.argv) > 1 else "PLOOP67"
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
              "(SSTI needs a GET query sink)")
        print("VERDICT: FAILED")
        return
    print("EVIDENCE sink=%s marker=%s params=%s" % (path, marker,
                                                   ",".join(params)))
    for param in params:
        verdict, via, detail = _probe_param(tb, path, param)
        print("param=%s verdict=%s via=%s detail=%s" % (
            param, verdict, via, detail))
        if verdict == "CONFIRMED":
            print("EVIDENCE sink=%s param=%s via=%s" % (path, param, via))
            print("VERDICT: CONFIRMED")
            return
    print("VERDICT: FAILED")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("PROBE_ERROR: %s" % exc)
        print("VERDICT: FAILED")
