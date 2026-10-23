"""Dark Matter — mitmproxy capture addon (Lane U, 23 Oct 2026).

Loaded by mitmweb inside the hunt container (see backend/src/
proxyIntercept.js, which injects this file into the container and
starts the proxy). For every COMPLETED flow it appends exactly one
JSON line to the capture file, which the host backend reads back
with `docker exec cat` — the same transport the GUI tools use.

Capture path: $DM_CAPTURE_FILE (default /tmp/dm-intercept/capture.jsonl).

Design rules:
  - passive: the addon never holds, edits or drops a flow — the
    hunter's browser must never stall waiting for an "intercept"
    decision (Burp's hold queue is the wrong default for an
    autonomous browser). Inspection and replay happen afterwards,
    from the capture file.
  - capped at write time: bodies are stored truncated (4 KB) with a
    truncation flag and the true byte length, and binary payloads
    are replaced by a placeholder — a hunt runs for hours and the
    capture file must stay lean enough to tail.
  - silent failure: a capture error must never break the proxy;
    the whole hook is wrapped and swallows its own exceptions.
"""

import json
import os
import time

CAPTURE_FILE = os.environ.get("DM_CAPTURE_FILE", "/tmp/dm-intercept/capture.jsonl")

BODY_CAP = 4096          # chars of request/response body kept per flow
HEADER_VALUE_CAP = 512   # chars per header value
MAX_HEADERS = 60         # headers kept per message

# Content types whose bodies are not text a hunter reads; storing
# them would bloat the capture with base64-ish noise.
BINARY_PREFIXES = ("image/", "font/", "audio/", "video/")
BINARY_TYPES = (
    "application/octet-stream",
    "application/pdf",
    "application/zip",
    "application/gzip",
    "application/x-protobuf",
)


def _headers(headers):
    """Headers -> {name: value | [values]} with caps. Never raises."""
    out = {}
    try:
        fields = getattr(headers, "fields", None)
        if fields:
            pairs = [(k.decode("latin-1"), v.decode("latin-1")) for k, v in fields]
        else:
            pairs = [(str(k), str(v)) for k, v in headers.items()]
    except Exception:
        return out
    for key, val in pairs[:MAX_HEADERS]:
        val = val[:HEADER_VALUE_CAP]
        if key in out:
            prev = out[key]
            out[key] = (prev if isinstance(prev, list) else [prev]) + [val]
        else:
            out[key] = val
    return out


def _body(msg):
    """Message body -> (text, truncated, total_bytes). Never raises."""
    if msg is None:
        return "", False, 0
    try:
        raw = msg.raw_content or b""
    except Exception:
        return "", False, 0
    total = len(raw)
    if total == 0:
        return "", False, 0
    try:
        ctype = (msg.headers.get("content-type") or "").lower()
    except Exception:
        ctype = ""
    if any(ctype.startswith(p) for p in BINARY_PREFIXES) or ctype in BINARY_TYPES:
        return "[binary body not stored: %d bytes, %s]" % (total, ctype or "unknown type"), False, total
    try:
        text = msg.get_text(strict=False) or ""
    except Exception:
        text = raw.decode("utf-8", "replace")
    if len(text) > BODY_CAP:
        return text[:BODY_CAP], True, total
    return text, False, total


def response(flow):
    """mitmproxy hook: one JSON line per completed flow."""
    try:
        req = flow.request
        resp = flow.response
        req_body, req_trunc, req_len = _body(req)
        resp_body, resp_trunc, resp_len = _body(resp)
        record = {
            "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "method": req.method,
            "scheme": req.scheme,
            "host": req.host,
            "port": req.port,
            "path": req.path,
            "url": req.pretty_url,
            "status": resp.status_code if resp is not None else None,
            "req_headers": _headers(req.headers),
            "req_body": req_body,
            "req_body_truncated": req_trunc,
            "req_len": req_len,
            "resp_headers": _headers(resp.headers) if resp is not None else {},
            "resp_body": resp_body,
            "resp_body_truncated": resp_trunc,
            "resp_len": resp_len,
        }
        with open(CAPTURE_FILE, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(record) + "\n")
    except Exception:
        pass
