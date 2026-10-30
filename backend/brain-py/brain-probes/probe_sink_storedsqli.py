#!/usr/bin/env python3
"""Generic STORED (second-order) SQLi probe for an UNKNOWN POST sink.

Rule #90: every SQLi probe so far (Rule #57 query, #84 json, #89
cookie) tests FIRST-order injection — the payload executes in the
SAME request that carries it. A real human hunter also thinks in
second order: inject into a stored field (comment, guestbook, profile
bio), then come back and check whether the stored value executes when
some OTHER code path SELECTs it (listing page, admin queue, report).

This probe tests exactly that: the canary counts only on a FRESH GET
— after the POST round-trip is over — when the page that renders the
stored rows newly carries SQL error keywords.

Marker (same shape as the Rule #88 stored-XSS probe):

    MARKER = PLOOP90|<target_base>|<path>|POST|<p1,p2>

Flow (stdlib only):
  1. GET the sink page (must be 200, read-only); find the POST form
     whose inputs cover the sink params (Rule #61 CSRF mechanics:
     token-like hidden fields are read and re-sent so the submit is
     a legitimate one).
  2. STABILITY GATE (Rule #55 lesson, adapted for stored sinks): two
     benign POSTs (run-unique benign90-<nonce> values, Rule #81) must
     leave the SQL-keyword MULTISET (per-keyword occurrence counts) of
     the fresh-GET page identical. Whole pages can never be byte-exact
     here — every POST appends a row — so the gate compares keyword
     counts, not the page.
  3. ERROR TEST (the Rule #57 flow, second-order): POST
     `b90-<nonce>'` (lone quote) into one param at a time, FRESH GET.
     If the fresh page carries MORE occurrences of SQL error keywords
     than the benign baseline, the stored value executed in a later
     query == second-order SQLi == CONFIRMED (EVIDENCE cites
     via=error_based, second_order=true). Count-based (not set-based):
     a previous run's confirmed quote row may still be listed, so a
     re-run must see the count GROW — this keeps Rule #81's
     independent-reconfirm true on polluted fixtures.
  4. BOOLEAN-BLIND second order is a DOCUMENTED OPEN GAP (not
     attempted): row accumulation makes whole-page differentials
     unsound, and per-row anchoring needs app-specific structure the
     generic probe cannot assume. Fail-closed: the probe reports the
     gap in PROBE_NOTE instead of guessing. The mock-fresh28 /notes
     page is a blind-only second-order fixture reserved for the future
     blind-channel rule.

A verbatim echo of the payload without evaluation can never confirm
(the error test needs NEW keywords, not the payload text). Any
exception -> PROBE_ERROR + VERDICT: FAILED (fail-closed).
"""
import hashlib
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

TIMEOUT = 15

# Copied verbatim from probe_sink_sqli.py (Rule #57) — one vocabulary
# for SQL error evidence across every SQLi probe (Rule #73).
ERROR_KEYWORDS = (
    "you have an error in your sql syntax",
    "warning: mysql", "mysqli", "mysql_fetch", "mysql_num_rows",
    "sqlite", "sqlite3", "pg_query", "postgresql", "unterminated",
    "odbc", "jdbc", "mssql", "sql server", "oracle error", "ora-",
    "sqlstate", "syntax error near",
)

_TOKEN_RE = re.compile(r"csrf|_csrf|token|nonce|authenticity|xsrf",
                       re.IGNORECASE)


def _fetch(url, data=None, headers=None):
    req = urllib.request.Request(url, data=data,
                                 headers=headers or {"User-Agent": "PLOOP90"})
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


def _error_hits(body):
    """Per-keyword OCCURRENCE COUNTS (multiset), not a set.

    Stored sinks accumulate rows across runs: a previous run's
    confirmed quote row keeps its error text on the listing page, so a
    set-based "new keywords" test goes blind on re-runs. Counting
    occurrences keeps the differential sound — exactly one row (the
    quote POST) is added between the baseline and the test page, so a
    count increase is attributable to the stored quote (Rule #81).
    """
    bl = body.lower()
    return {k: bl.count(k) for k in ERROR_KEYWORDS if k in bl}


def _digest(body):
    return hashlib.sha256(body.encode()).hexdigest()[:16]


def main():
    # argv[1] is the marker: the _probe_cmd wrapper invokes
    #   python3 "$DST" "$MK"   (DST=argv[0], marker=argv[1])
    marker = sys.argv[1] if len(sys.argv) > 1 else "PLOOP90"
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
        print("PROBE_ERROR invalid sink spec (stored-SQLi needs a POST "
              "sink)")
        print("VERDICT: FAILED")
        return
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

    # 2. stability gate: two benign POSTs (distinct run-unique values)
    # must leave the fresh-GET page's SQL-keyword SET identical.
    # Whole pages are never byte-exact for stored sinks (every POST
    # appends a row) — the gate compares the keyword set, not the page.
    try:
        _post({p: "benign90-%s-a" % nonce for p in canary_params}
              | tokens)
        b1 = _fresh_get()
        _post({p: "benign90-%s-b" % nonce for p in canary_params}
              | tokens)
        b2 = _fresh_get()
    except Exception as e:
        print("PROBE_ERROR stability gate fetch failed: %s" % e)
        print("VERDICT: FAILED")
        return
    h1, h2 = _error_hits(b1), _error_hits(b2)
    if h1 != h2:
        print("PROBE_NOTE baseline unstable (keyword counts differ: "
              "%s vs %s) — no claim grounded" % (h1, h2))
        print("VERDICT: FAILED")
        return

    # 3. error test, one param at a time. The lone quote is stored;
    # the FRESH GET must newly carry SQL error keywords.
    confirmed_param = None
    confirmed_hits = None
    confirmed_digest = None
    for param in canary_params:
        quote_val = "b90-%s'" % nonce
        try:
            _post({p: (quote_val if p == param else "benign90-%s-q"
                       % nonce) for p in canary_params} | tokens)
            qpage = _fresh_get()
        except Exception as e:
            print("PROBE_ERROR param %s quote fetch failed: %s"
                  % (param, e))
            continue
        qhits = _error_hits(qpage)
        grown = sorted(k for k, c in qhits.items()
                       if c > h1.get(k, 0))
        if grown:
            confirmed_param = param
            confirmed_hits = grown
            confirmed_digest = _digest(qpage)
            break
        print("PARAM %s: not injectable (no SQL-keyword count growth "
              "on the fresh GET)" % param)

    if confirmed_param:
        print("EVIDENCE sink=%s method=POST param=%s persistence=STORED "
              "second_order=true error_based hits=%s digest=%s"
              % (path, confirmed_param, ",".join(confirmed_hits[:3]),
                 confirmed_digest))
        print("EVIDENCE class=sql_injection via=error_based "
              "second_order=true")
        print("VERDICT: CONFIRMED")
    else:
        print("PROBE_NOTE boolean-blind second order is an open gap "
              "(Rule #90 PART 1 covers the error-based channel only; "
              "row accumulation makes whole-page blind differentials "
              "unsound — see mock-fresh28 /notes fixture)")
        print("VERDICT: FAILED")


if __name__ == "__main__":
    main()
