#!/usr/bin/env python3
"""Generic reflected-XSS probe for an UNKNOWN sink.

Rule #56: the one loop hunts targets it has never seen — this probe
takes the sink spec from its marker argv (the loop encodes it there so
_probe_cmd needs no changes):

    MARKER = PLOOP56|<target_base>|<path>|<METHOD>|<p1,p2>

Rule #59 — CONTEXT-AWARE confirmation. A text-node breakout payload
alone misses the reflections a real human hunter catches: inside
attribute values (double/single/unquoted), inside JS strings, inside
HTML comments. This probe classifies WHERE the raw token lands and
fires the matching breakout payload.

Flow (stdlib only):
  1. GET the sink page (confirms it exists, read-only).
  2. REFLECTION TEST: inject a token containing markup chars
     (GX56R<b>QZ + marker suffix) into every sink param via the sink's
     method. If the RAW token appears in the response, the param reflects
     unescaped (candidate). If only the HTML-escaped form appears, the
     sink is a negative control -> keep looking.
  3. CONTEXT CLASSIFICATION: locate the raw token in the response:
       comment       — inside an unclosed <!-- -->
       js-dq / js-sq — inside <script>, token wrapped in " or '
       style         — inside an unclosed <style> element (Rule #60)
       attr-dq       — double-quoted attribute value (value="TOK)
       attr-sq       — single-quoted attribute value (title='TOK)
       attr-unquoted — bare attribute value (value=TOK)
       text          — element text node (default)

Rule #60: <style>-context reflection is its OWN context — a text-node
<img> payload is inert inside CSS, so the probe classifies it
separately and breaks out by closing the element.
  4. CONFIRMATION: fire the context-specific breakout payload:
       text            G59P<s><img src=x>
       attr-dq         G59P<s>" onGX59over="1
       attr-sq         G59P<s>' onGX59over='1
       attr-unquoted   G59P<s> onGX59over="1
       js-dq           G59P<s>";G59C//
       js-sq           G59P<s>';G59C//
       comment         G59P<s>-->
       style           G59P<s></style><img src=x>  (Rule #60)
     Raw reflection of the full payload == context breakout ==
     CONFIRMED (the EVIDENCE line cites via=<context>). A context we
     cannot ground a breakout for (js-unknown) -> PROBE_NOTE + FAILED
     (fail-closed, never claim on an ungrounded context).

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


def _classify_context(body, token):
    """Where does the RAW token sit in the response? (Rule #59)"""
    idx = body.find(token)
    if idx < 0:
        return None
    before = body[:idx]
    # 1. HTML comment: nearest <!-- before the token with no closing -->
    last_open = before.rfind("<!--")
    if last_open != -1 and "-->" not in before[last_open:]:
        return "comment"
    # 2. inside a tag's attribute? The nearest '<' before the token must
    #    have NO '>' between it and the token (an unclosed tag). Note:
    #    <script> itself is a CLOSED tag — content after its '>' is NOT
    #    inside a tag, it is script content (handled in step 3).
    lt = before.rfind("<")
    if lt != -1 and ">" not in before[lt:idx]:
        tag_tail = before[lt:]
        if re.search(r'=\s*"[^"]*$', tag_tail):
            return "attr-dq"
        if re.search(r"=\s*'[^']*$", tag_tail):
            return "attr-sq"
        if re.search(r"=\s*[^\s>\"']*$", tag_tail):
            return "attr-unquoted"
        return "tag-unknown"  # in a tag, but no grounded breakout
    # 3. inside <script> element content?
    ls = before.lower().rfind("<script")
    if ls != -1 and "</script" not in before[ls:].lower():
        tail = before.rstrip()
        if tail.endswith('"'):
            return "js-dq"
        if tail.endswith("'"):
            return "js-sq"
        return "js-unknown"  # in script, but no grounded breakout
    # 3b. inside <style> element content? (Rule #60) Nearest <style
    #     (case-insensitive) before the token with no closing </style.
    #     Placed after the script check: content written through
    #     document.write("<style>...") classifies as js-*, which is the
    #     correct breakout there. A text-node <img> payload is INERT
    #     inside CSS — the context breakout closes the element.
    lst = before.lower().rfind("<style")
    if lst != -1 and "</style" not in before[lst:].lower():
        return "style"
    # 4. default: element text node
    return "text"


def _confirm_payload(context, msuffix):
    p = "G59P" + msuffix
    return {
        "text": p + "<img src=x>",
        "attr-dq": p + '" onGX59over="1',
        "attr-sq": p + "' onGX59over='1",
        "attr-unquoted": p + ' onGX59over="1',
        "js-dq": p + '";G59C//',
        "js-sq": p + "';G59C//",
        "comment": p + "-->",
        "style": p + "</style><img src=x>",
    }.get(context)


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
    vuln_body = None
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
            vuln_param = param
            vuln_body = body
            break
        if html.escape(token) in body:
            print("PROBE_NOTE param %s reflects ESCAPED only (negative "
                  "control)" % param)
    if not vuln_param:
        print("VERDICT: FAILED")
        return

    # 3. context classification (Rule #59)
    context = _classify_context(vuln_body, token)
    print("EVIDENCE sink=%s method=%s param=%s reflection=RAW "
          "context=%s marker=%s" % (path, method, vuln_param, context,
                                    msuffix))

    # 4. confirmation with the context-specific breakout payload
    payload = _confirm_payload(context, msuffix)
    if payload is None:
        print("PROBE_NOTE context %s has no grounded breakout payload "
              "(fail-closed)" % context)
        print("VERDICT: FAILED")
        return
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
        print("EVIDENCE sink=%s method=%s param=%s via=%s payload "
              "reflected UNESCAPED: %s" % (path, method, vuln_param,
                                           context, payload))
        print("VERDICT: CONFIRMED")
    else:
        print("PROBE_NOTE confirm payload did not reflect raw "
              "(context=%s)" % context)
        print("VERDICT: FAILED")


if __name__ == "__main__":
    main()
