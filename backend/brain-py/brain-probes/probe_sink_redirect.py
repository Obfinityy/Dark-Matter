#!/usr/bin/env python3
"""Generic open-redirect probe for an UNKNOWN query sink.

Rule #62: the one loop hunts targets it has never seen — this probe
takes the sink spec from its marker argv (the loop encodes it there so
_probe_cmd needs no changes):

    MARKER = PLOOP62|<target_base>|<path>|GET|<p1,p2>

An open-redirect claim needs the TARGET to redirect the hunter's
browser to an EXTERNAL canary host controlled by the probe. The probe,
for each sink param in turn:

  1. CONTROL: GET path?<p>=ploop62-benign. The response must NOT
     redirect externally at all (an app that bounces every request to
     a login host is not param-controlled — fail closed for this
     param and try the next one). Relative redirects are ignored.
  2. CANARY: the same GET with <p> set to two canary forms —
     absolute (https://<canary>/...) and protocol-relative
     (//<canary>/...), each carrying a run-unique nonce path. The
     canary host is ploop62-canary.invalid (RFC 2606 — guaranteed
     unresolvable); it is never fetched, only matched verbatim in
     the response.
  3. CONFIRM signals (read from the RAW response — the probe never
     follows redirects, http.client is used for header access):
       - 301/302/303/307/308 with a Location header containing the
         canary host                          -> via=redirect-location
       - 200 with <meta http-equiv="refresh" ... url=<canary>>
         (case-insensitive, quote-tolerant)   -> via=redirect-meta
       - 200 with a JS redirect whose target is exactly the canary
         URL the probe sent (location= / location.href= /
         location.replace())                  -> via=redirect-js

  A verbatim canary echo in a NON-redirect context (plain text,
  attribute, script) is NOT a redirect — it is an XSS signal for the
  sibling probe and counts as FAILED here (fail-closed).

The canary is only ever checked against the response to the request
that carried it — the control request can never confirm (it carries
no canary). One self-contained reproducible command, fixed marker
from argv, own VERDICT line (probe lesson, 29 Oct). Any exception ->
PROBE_ERROR + VERDICT: FAILED (fail-closed).
"""
import http.client
import os
import re
import sys
import urllib.parse

TIMEOUT = 15
CANARY_HOST = "ploop62-canary.invalid"
_BENIGN = "ploop62-benign"
_REDIRECT_CODES = (301, 302, 303, 307, 308)


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
                     headers={"User-Agent": "PLOOP62",
                              "Host": pu.netloc})
        resp = conn.getresponse()
        body = resp.read().decode("utf-8", "replace")
        headers = {k.lower(): v for k, v in resp.getheaders()}
        return resp.status, headers, body
    finally:
        conn.close()


def _external_location(headers, tb):
    """The Location header iff it points to a DIFFERENT host than tb."""
    loc = headers.get("location")
    if not loc:
        return None
    absu = urllib.parse.urljoin(tb.rstrip("/") + "/", loc)
    pu = urllib.parse.urlparse(absu)
    tbu = urllib.parse.urlparse(tb.rstrip("/") + "/")
    if pu.scheme in ("http", "https") and \
            pu.netloc.lower() != tbu.netloc.lower():
        return loc
    return None


def _meta_refresh_target(body):
    m = re.search(
        r'<meta\b[^>]*http-equiv\s*=\s*["\']?refresh["\']?[^>]*'
        r'content\s*=\s*["\']?[^"\'>]*?url\s*=\s*([^"\'>\s;]+)',
        body, re.IGNORECASE | re.DOTALL)
    return m.group(1) if m else None


def _js_redirect_target(body, canary_url):
    """True only when the exact canary URL sits in a JS redirect
    assignment — a bare echo of the canary in page text does NOT
    count (that is an XSS signal, not a redirect)."""
    q = re.escape(canary_url)
    pat = (r'(?:window\.)?location(?:\.href)?\s*=\s*["\']?%s["\']?'
           r'|location\.replace\(\s*["\']?%s["\']?\s*\)'
           r'|location\.assign\(\s*["\']?%s["\']?\s*\)') % (q, q, q)
    return re.search(pat, body, re.IGNORECASE) is not None


def main():
    # argv[1] is the marker: the _probe_cmd wrapper invokes
    #   python3 "$DST" "$MK"   (DST=argv[0], marker=argv[1])
    marker = sys.argv[1] if len(sys.argv) > 1 else "PLOOP62"
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
              "(open-redirect needs a GET query sink)")
        print("VERDICT: FAILED")
        return
    msuffix = re.sub(r"[^A-Za-z0-9]", "", marker.split("|", 1)[0])[:12]
    nonce = os.urandom(3).hex()

    for p in params:
        # 1. CONTROL: a benign value must not redirect externally.
        try:
            ccode, cheaders, _ = _raw_get(tb, path, {p: _BENIGN})
        except Exception as e:
            print("PROBE_ERROR control fetch failed for param %s: %s"
                  % (p, e))
            print("VERDICT: FAILED")
            return
        ext = _external_location(cheaders, tb)
        if ext:
            # The endpoint bounces every request elsewhere — the
            # redirect is not param-controlled. Next param.
            print("PROBE_NOTE param %s: control redirects externally "
                  "regardless of the param (not sink-controlled)" % p)
            continue
        # 2. CANARY forms for this param.
        canary_abs = ("https://%s/ploop62-%s/" % (CANARY_HOST, nonce))
        canary_proto = ("//%s/ploop62-%s/" % (CANARY_HOST, nonce))
        confirmed = None
        for canary in (canary_abs, canary_proto):
            try:
                code, headers, body = _raw_get(tb, path, {p: canary})
            except Exception as e:
                print("PROBE_ERROR canary fetch failed for param %s: "
                      "%s" % (p, e))
                print("VERDICT: FAILED")
                return
            if code in _REDIRECT_CODES:
                loc = headers.get("location") or ""
                if CANARY_HOST in loc.lower():
                    confirmed = ("redirect-location", code, canary)
                    break
            elif code == 200:
                mt = _meta_refresh_target(body)
                if mt and CANARY_HOST in mt.lower():
                    confirmed = ("redirect-meta", code, canary)
                    break
                if _js_redirect_target(body, canary):
                    confirmed = ("redirect-js", code, canary)
                    break
        if confirmed:
            via, code, canary = confirmed
            print("EVIDENCE sink=%s param=%s via=%s code=%d "
                  "canary=%s" % (path, p, via, code, canary))
            print("EVIDENCE class=open_redirect via=%s" % via)
            print("VERDICT: CONFIRMED")
            return
        print("PROBE_NOTE param %s: no external redirect to the "
              "canary" % p)

    print("VERDICT: FAILED")


if __name__ == "__main__":
    main()
