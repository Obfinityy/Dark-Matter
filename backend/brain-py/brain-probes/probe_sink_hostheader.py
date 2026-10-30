#!/usr/bin/env python3
"""Generic host-header injection probe for an UNKNOWN query sink.

Rule #71: the one loop hunts targets it has never seen — this probe
takes the sink spec from its marker argv (the loop encodes it there so
_probe_cmd needs no changes):

    MARKER = PLOOP71|<target_base>|<path>|GET|

A host-header injection claim needs the TARGET's server to TRUST an
attacker-controlled Host header (password-reset poisoning, poisoned
redirects, cache-key poisoning, ...). The probe proves this with a
run-unique RFC 2606 canary host (never fetched) through two confirm
channels:

  1. CONTROL: GET path with Host=<real host> — the endpoint must
     answer; the evil canary is never sent, so it can never confirm.
  2. CANARY: GET path with Host=<evil> —
     - via=host-header-body: the evil host appears in the response
       BODY (e.g. reflected into a reset link) though it was ABSENT
       from the control body.
     - via=host-header-redirect: the Location header points at the
       evil host though the control Location did not.

The canary host is run-unique (ploop71-<nonce>.invalid), so a
pre-existing mention can never false-positive.

Fail-closed rules (the probe lesson, 29 Oct):
  - The control request can never confirm (it carries the real Host).
  - The evil canary present in the CONTROL body aborts fail-closed
    (a pre-seeded collision would poison the confirm channel).
  - A body that echoes the canary only inside a reflected Host of a
    *different* case/encoding still confirms — the server trusted the
    attacker value. No further normalization is attempted.
  - Errors, timeouts -> FAILED. An empty CONTROL body is a valid
    baseline (redirect endpoints legitimately send none) — the
    confirm channels compare the canary body/Location against the
    control body/Location, so an empty control body can never
    confirm by itself.
  - No evil host in the canary body AND no evil host in the canary
    Location -> VERDICT: FAILED.

One self-contained reproducible command, fixed marker from argv, own
VERDICT line. Any exception -> PROBE_ERROR + VERDICT: FAILED. The
probe never fetches anything external; it only asks the TARGET for
URLs the loop's own scope gate already allowed.
"""
import http.client
import os
import sys
import urllib.parse

REQ_TIMEOUT = 15


def _raw_get(tb, path, host_header):
    """GET without following redirects. Returns (code, headers, body)."""
    pu = urllib.parse.urlparse(tb.rstrip("/") + path)
    host, port = pu.hostname, pu.port
    use_ssl = pu.scheme == "https"
    conn_cls = (http.client.HTTPSConnection if use_ssl
                else http.client.HTTPConnection)
    conn = conn_cls(host, port or (443 if use_ssl else 80),
                    timeout=REQ_TIMEOUT)
    try:
        # http.client only auto-adds Host when absent from headers —
        # passing it explicitly poisons the Host the server sees
        # while the TCP connection still goes to the real target.
        conn.request("GET", pu.path,
                     headers={"User-Agent": "PLOOP71",
                              "Host": host_header})
        resp = conn.getresponse()
        body = resp.read().decode("utf-8", "replace")
        headers = {k.lower(): v for k, v in resp.getheaders()}
        return resp.status, headers, body
    finally:
        conn.close()


def main():
    # argv[1] is the marker: the _probe_cmd wrapper invokes
    #   python3 "$DST" "$MK"   (DST=argv[0], marker=argv[1])
    marker = sys.argv[1] if len(sys.argv) > 1 else "PLOOP71"
    try:
        _, tb_q, path_q, method, _params_csv = marker.split("|", 4)
    except ValueError:
        print("PROBE_ERROR bad marker spec: %r" % marker)
        print("VERDICT: FAILED")
        return
    tb = urllib.parse.unquote(tb_q)
    path = urllib.parse.unquote(path_q)
    method = (method or "GET").upper()
    if not tb or not path.startswith("/") or method != "GET":
        print("PROBE_ERROR invalid sink spec "
              "(host-header injection needs a GET path sink)")
        print("VERDICT: FAILED")
        return
    real_host = urllib.parse.urlparse(tb.rstrip("/")).netloc
    nonce = os.urandom(4).hex()
    evil = "ploop71-%s.invalid" % nonce  # RFC 2606, never fetched
    print("EVIDENCE sink=%s marker=%s" % (path, marker))
    # 1. Control: the real Host must answer; it can never confirm.
    # An empty body is a legitimate baseline (a 302 endpoint sends
    # none) — only a transport error fails closed here.
    try:
        _ccode, cheaders, cbody = _raw_get(tb, path, real_host)
    except Exception as exc:
        print("PROBE_ERROR control errored: %s" % exc)
        print("VERDICT: FAILED")
        return
    if evil in cbody:
        # Run-unique canary already present without being sent —
        # the confirm channel is poisoned; fail closed.
        print("PROBE_ERROR fail-closed: canary host present in the "
              "control body without being sent")
        print("VERDICT: FAILED")
        return
    cloc = cheaders.get("location", "")
    # 2. Canary: poison the Host header, read body + Location raw.
    try:
        code, headers, body = _raw_get(tb, path, evil)
    except Exception as exc:
        print("PROBE_ERROR canary errored: %s" % exc)
        print("VERDICT: FAILED")
        return
    if evil in body and evil not in cbody:
        print("EVIDENCE sink=%s channel=body-reflection "
              "via=host-header-body" % path)
        print("detail: the attacker-controlled Host %r appears in the "
              "response body though it was absent from the control "
              "body (password-reset/link poisoning shape)" % evil)
        print("VERDICT: CONFIRMED")
        return
    loc = headers.get("location", "")
    if evil in loc and evil not in cloc:
        print("EVIDENCE sink=%s channel=location-reflection "
              "via=host-header-redirect" % path)
        print("detail: the 302 Location %r points at the "
              "attacker-controlled Host though the control Location "
              "did not" % loc)
        print("VERDICT: CONFIRMED")
        return
    print("PROBE_NOTE: attacker Host ignored (no canary host in body "
          "or Location)")
    print("VERDICT: FAILED")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("PROBE_ERROR: %s" % exc)
        print("VERDICT: FAILED")
