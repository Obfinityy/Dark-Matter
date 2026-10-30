#!/usr/bin/env python3
"""Generic JSON-body-sink reflected-XSS probe for an UNKNOWN JSON sink.

Rule #80: the one loop hunts targets it has never seen — JSON-body
sinks (a POST endpoint that reads a JSON field and reflects it, e.g.
SPA/API error messages and echoes rendered into the DOM) are a sink
KIND the generic set never covered (query: 9 classes; form: 4; xml: 1;
cookie: 1; json: 0). This probe takes the sink spec from its marker
argv (the loop encodes it there so _probe_cmd needs no changes):

    MARKER = PLOOP80|<target_base>|<path>|POST|<field_csv>

Rule #80 PART 2: the 5th component is a CSV of common JSON field
names (the engine cannot know the API's real field names). The probe
tries each name in order — control+canary per field — and the first
CONFIRMED wins, so the budget stays 2 turns per sink. Every name is
validated up front; one bad name fails the whole probe closed.

A JSON-XSS claim needs the TARGET to reflect an attacker-controlled
JSON field value into the response body UNESCAPED. The probe proves
this with a run-unique canary payload (never transmitted anywhere
else):

  1. CONTROL: POST JSON {"<field>": "benign80"} with
     Content-Type: application/json — the endpoint must answer; the
     canary is never sent, so it can never confirm.
  2. CANARY: POST JSON {"<field>": "<img src=x
     onerror=PLOOP80-<nonce>>"} — executable-shaped (Rule #59/#73:
     the pipeline's xss-reflect signal fires on real reflected
     executable content).

CONFIRMED only when the canary PAYLOAD appears in the canary body
UNESCAPED though it was ABSENT from the control body. A token that
reflects HTML-ENCODED (&lt;img ...) or JSON-mangled (payload broken
across escapes) is a safe encoding, not a vulnerability -> FAILED
(the differential, not the echo, confirms).

Fail-closed rules (the probe lesson, 29 Oct):
  - The JSON field name is validated ([A-Za-z0-9_.[\\]-]{1,64}) — a
    bad name aborts instead of injecting JSON syntax (a quote or
    brace in the marker must never reach json.dumps as a key).
  - The control request can never confirm (it carries no canary).
  - The canary token present in the CONTROL body aborts fail-closed
    (a pre-seeded collision would poison the confirm channel).
  - Errors, timeouts -> FAILED. Redirects are NOT followed (a
    redirect endpoint is a different class); the probe reads the raw
    body.
  - No unescaped canary payload in the canary body -> VERDICT: FAILED.

Evidence vocabulary (Rule #73): the CONFIRMED EVIDENCE line mirrors
probe_sink_xss.py's shape (sink= method= json_field= via=html payload
reflected UNESCAPED) so the backend's xss-reflect signal fires on the
real reflected executable content; the future claim class is
xss_reflected (same class, distinct module generic_jsonxss — dedup is
(module, class, location), so an endpoint vulnerable via both a query
param and a JSON field files two distinct claims, the Rule #69
rationale).

One self-contained reproducible command, fixed marker from argv, own
VERDICT line. Any exception -> PROBE_ERROR + VERDICT: FAILED. The
probe never fetches anything external; it only asks the TARGET for a
URL the loop's own scope gate already allowed.
"""
import http.client
import json
import os
import re
import sys
import urllib.parse

REQ_TIMEOUT = 15
_FIELD_NAME_RE = re.compile(r"[A-Za-z0-9_.\[\]\-]{1,64}\Z")


def _raw_post(tb, path, body_dict):
    """POST without following redirects. Returns (code, headers, body)."""
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
                     headers={"User-Agent": "PLOOP80",
                              "Content-Type": "application/json",
                              "Content-Length": str(len(raw))})
        resp = conn.getresponse()
        body = resp.read().decode("utf-8", "replace")
        headers = {k.lower(): v for k, v in resp.getheaders()}
        return resp.status, headers, body
    finally:
        conn.close()


def main():
    # argv[1] is the marker: the _probe_cmd wrapper invokes
    #   python3 "$DST" "$MK"   (DST=argv[0], marker=argv[1])
    marker = sys.argv[1] if len(sys.argv) > 1 else "PLOOP80"
    try:
        _, tb_q, path_q, method, field_csv = marker.split("|", 4)
    except ValueError:
        print("PROBE_ERROR bad marker spec: %r" % marker)
        print("VERDICT: FAILED")
        return
    tb = urllib.parse.unquote(tb_q)
    path = urllib.parse.unquote(path_q)
    method = (method or "POST").upper()
    # Rule #80 PART 2: the marker's 5th component is a CSV of common
    # JSON field names (the engine cannot know the API's real field
    # names); the probe tries each in order — control+canary per
    # field — and the first CONFIRMED wins, so the budget stays 2
    # turns per sink. One self-contained command, one VERDICT line.
    fields = [f.strip() for f in (field_csv or "").split(",")]
    fields = [f for f in fields if f]
    if not tb or not path.startswith("/") or method != "POST":
        print("PROBE_ERROR invalid sink spec "
              "(JSON-XSS needs a POST path sink)")
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
    token = "PLOOP80-%s" % nonce  # never transmitted except in payload
    payload = "<img src=x onerror=%s>" % token  # executable-shaped
    print("EVIDENCE sink=%s marker=%s" % (path, marker))
    tried = []
    for field in fields:
        # 1. Control: benign JSON field value; can never confirm.
        try:
            _ccode, _cheaders, cbody = _raw_post(tb, path,
                                                 {field: "benign80"})
        except Exception as exc:
            print("PROBE_ERROR control errored: %s" % exc)
            print("VERDICT: FAILED")
            return
        if token in cbody or payload in cbody:
            print("PROBE_ERROR fail-closed: canary token present in the "
                  "control body without being sent")
            print("VERDICT: FAILED")
            return
        # 2. Canary: attacker-controlled JSON field value, executable
        # shape.
        try:
            _code, _headers, body = _raw_post(tb, path, {field: payload})
        except Exception as exc:
            print("PROBE_ERROR canary errored: %s" % exc)
            print("VERDICT: FAILED")
            return
        if payload in body and payload not in cbody:
            print("EVIDENCE sink=%s method=POST json_field=%s via=html "
                  "payload reflected UNESCAPED: %s"
                  % (path, field, payload))
            print("detail: the attacker-controlled JSON field %r "
                  "reflected unescaped into the response body though it "
                  "was absent from the control body (executable shape, "
                  "xss-reflect readable)" % field)
            print("VERDICT: CONFIRMED")
            return
        if token in body and payload not in body:
            # Safe encoding on THIS field — keep trying the rest.
            tried.append("%s=encoded" % field)
            continue
        tried.append(field)
    print("PROBE_NOTE: JSON field values not reflected unescaped "
          "(tried: %s)" % ", ".join(tried))
    print("VERDICT: FAILED")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("PROBE_ERROR: %s" % exc)
        print("VERDICT: FAILED")
