#!/usr/bin/env python3
"""Generic reflected-XSS probe for an UNKNOWN sink (Rule #56).

A real human hunter pastes a link and attacks the surface that is really
there — not a hardcoded module list. This probe takes the sink spec from
its marker argv (the one loop encodes it there so _probe_cmd needs no
changes):

    MARKER = PLOOP56|<target_base>|<path>|<METHOD>|<p1,p2>

Flow (stdlib only):
  1. GET the sink page (confirms it exists, read-only).
  2. REFLECTION TEST: inject a token containing markup chars
     (GX56R<b>QZ + marker suffix) into every sink param via the sink's
     method. If the RAW token appears in the response, the param reflects
     unescaped (candidate). If only the HTML-escaped form appears, the
     sink is a negative control -> keep looking.
  3. CONFIRMATION: inject a second unique token wrapped in a real HTML
     break-out payload (<GX56Psuffix><img src=x>). Raw reflection of the
     full payload string == unescaped HTML injection == CONFIRMED.

One self-contained reproducible command, fixed marker from argv, own
VERDICT line (probe lesson, 29 Oct). Any exception -> PROBE_ERROR +
VERDICT: FAILED (fail-closed).
"""
import html
import re
import sys
import urllib.parse
import urllib.request

TIMEOUT = 15


def _fetch(url, data=None, headers=None):
    req = urllib.request.Request(url, data=data,
                                 headers=headers or {"User-Agent": "PLOOP56"})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        return r.getcode(), r.read().decode("utf-8", "replace")


def main():
    # argv[1] is the marker: the _probe_cmd wrapper invokes
    #   python3 "$DST" "$MK"   (DST=argv[0], marker=argv[1])
    marker = sys.argv[1] if len(sys.argv) > 1 else "PLOOP56"
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
            method not in ("GET", "POST"):
        print("PROBE_ERROR invalid sink spec")
        print("VERDICT: FAILED")
        return
    msuffix = re.sub(r"[^A-Za-z0-9]", "", marker.split("|", 1)[0])[:12]

    # 1. sink page must exist (read-only)
    try:
        code, _ = _fetch(tb.rstrip("/") + path)
    except Exception as e:
        print("PROBE_ERROR sink page fetch failed: %s" % e)
        print("VERDICT: FAILED")
        return
    if code != 200:
        print("PROBE_ERROR sink page status %s" % code)
        print("VERDICT: FAILED")
        return

    # 2. reflection test, one param at a time
    vuln_param = None
    for param in params:
        token = "GX56R%s<b>QZ" % msuffix
        q = {p: ("benign" if p != param else token) for p in params}
        try:
            if method == "GET":
                url = tb.rstrip("/") + path + "?" + urllib.parse.urlencode(q)
                _, body = _fetch(url)
            else:
                url = tb.rstrip("/") + path
                _, body = _fetch(url,
                                 data=urllib.parse.urlencode(q).encode())
        except Exception as e:
            print("PROBE_NOTE param %s submit failed: %s" % (param, e))
            continue
        if token in body:
            print("EVIDENCE sink=%s method=%s param=%s reflection=RAW "
                  "marker=%s" % (path, method, param, msuffix))
            vuln_param = param
            break
        if html.escape(token) in body:
            print("PROBE_NOTE param %s reflects ESCAPED only (negative "
                  "control)" % param)
    if not vuln_param:
        print("VERDICT: FAILED")
        return

    # 3. confirmation with an HTML break-out payload
    payload = "GX56P%s<img src=x>" % msuffix
    q = {p: ("benign" if p != vuln_param else payload) for p in params}
    try:
        if method == "GET":
            url = tb.rstrip("/") + path + "?" + urllib.parse.urlencode(q)
            _, body = _fetch(url)
        else:
            url = tb.rstrip("/") + path
            _, body = _fetch(url, data=urllib.parse.urlencode(q).encode())
    except Exception as e:
        print("PROBE_ERROR confirm submit failed: %s" % e)
        print("VERDICT: FAILED")
        return
    if payload in body:
        print("EVIDENCE sink=%s method=%s param=%s payload reflected "
              "UNESCAPED: %s" % (path, method, vuln_param, payload))
        print("VERDICT: CONFIRMED")
    else:
        print("PROBE_NOTE confirm payload did not reflect raw")
        print("VERDICT: FAILED")


if __name__ == "__main__":
    main()
