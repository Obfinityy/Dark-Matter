#!/usr/bin/env python3
"""Generic CSRF state-change probe for an UNKNOWN POST sink.

Rule #61: the one loop hunts targets it has never seen — this probe
takes the sink spec from its marker argv (the loop encodes it there so
_probe_cmd needs no changes):

    MARKER = PLOOP61|<target_base>|<path>|POST|<p1,p2>

A CSRF claim needs a STATE CHANGE accepted WITHOUT the anti-CSRF
token. The probe:

  1. GETs the sink page (read-only) and finds the POST form whose
     inputs cover the sink params.
  2. Detects token-like hidden fields (csrf/_csrf/token/nonce/
     authenticity/xsrf, case-insensitive) and reads the
     server-issued value.
  3. CONTROL run: POSTs with the server-issued token (when the form
     has one), trying each non-token field as the canary in turn — a
     real hunter cannot know which field the server stores. The first
     field whose canary shows on a FRESH GET proves the sink is
     state-changing. If no canary persists, the sink has no observable
     state change — nothing a CSRF could exploit -> FAILED
     (fail-closed).
  4. TEST run: POSTs a second canary with the token field OMITTED
     entirely. If the fresh GET shows it, the state change was accepted
     without the token -> CONFIRMED. Token enforced (canary absent) ->
     PROBE_NOTE + FAILED. When the form has NO token field at all, the
     control POST is already a no-token POST: persistence there is the
     CONFIRM (via=csrf-no-token).

The canary is only ever checked on a FRESH GET — reflection inside the
POST response itself never counts (that is an XSS signal, not
persistence). The canary param is the first non-token sink param; a
sink with nothing but token fields cannot be state-changed by us ->
FAILED. One self-contained reproducible command, fixed marker from
argv, own VERDICT line (probe lesson, 29 Oct). Any exception ->
PROBE_ERROR + VERDICT: FAILED (fail-closed).
"""
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
                                 headers=headers or {"User-Agent": "PLOOP61"})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            return r.getcode(), r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        # A 4xx/5xx is a server ANSWER, not a transport failure — the
        # probe reads the code (403 on a token-less POST is the classic
        # "token enforced" negative signal).
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


def main():
    # argv[1] is the marker: the _probe_cmd wrapper invokes
    #   python3 "$DST" "$MK"   (DST=argv[0], marker=argv[1])
    marker = sys.argv[1] if len(sys.argv) > 1 else "PLOOP61"
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
        print("PROBE_ERROR invalid sink spec (CSRF needs a POST sink)")
        print("VERDICT: FAILED")
        return
    msuffix = re.sub(r"[^A-Za-z0-9]", "", marker.split("|", 1)[0])[:12]

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
              "state-change (fail-closed)")
        print("VERDICT: FAILED")
        return
    url = tb.rstrip("/") + path

    def _post(fields):
        data = urllib.parse.urlencode(fields).encode()
        code, _ = _fetch(url, data=data)
        return code

    def _fresh_get():
        _, fresh = _fetch(url)
        return fresh

    # 2+3. CONTROL run: with the server-issued token when the form has
    # one. No token field -> this IS the no-token POST. A real hunter
    # tries every field: the first param whose canary persists proves
    # the sink is state-changing (we cannot know which field the
    # server stores).
    state_param = None
    try:
        for cp in canary_params:
            canary_a = "GZ61C%s%sQ" % (msuffix, cp[:6])
            fields_a = {p: ("benign" if p != cp else canary_a)
                        for p in canary_params}
            fields_a.update(tokens)
            _post(fields_a)
            if canary_a in _fresh_get():
                state_param = cp
                break
    except Exception as e:
        print("PROBE_ERROR control run failed: %s" % e)
        print("VERDICT: FAILED")
        return
    if state_param is None:
        print("PROBE_NOTE no observable state change: no canary was "
              "persisted even WITH the token (nothing a CSRF could "
              "exploit)")
        print("VERDICT: FAILED")
        return
    if not tokens:
        print("EVIDENCE sink=%s method=POST param=%s token_present=false "
              "via=csrf-no-token marker=%s" % (path, state_param,
                                               msuffix))
        print("EVIDENCE state change accepted with NO anti-CSRF token: "
              "canary persisted on fresh GET")
        print("VERDICT: CONFIRMED")
        return

    # 4. TEST run: same state change, token field OMITTED entirely.
    canary_b = "GZ61T%sQ" % msuffix
    fields_b = {p: ("benign" if p != state_param else canary_b)
                for p in canary_params}
    try:
        _post(fields_b)
        fresh_b = _fresh_get()
    except Exception as e:
        print("PROBE_ERROR test run failed: %s" % e)
        print("VERDICT: FAILED")
        return
    if canary_b in fresh_b:
        print("EVIDENCE sink=%s method=POST param=%s token_present=true "
              "via=csrf-token-bypass marker=%s" % (path, state_param,
                                                   msuffix))
        print("EVIDENCE state change accepted WITHOUT the anti-CSRF "
              "token: canary persisted on fresh GET")
        print("VERDICT: CONFIRMED")
    else:
        print("PROBE_NOTE anti-CSRF token enforced: state change "
              "refused without it (negative control)")
        print("VERDICT: FAILED")


if __name__ == "__main__":
    main()
