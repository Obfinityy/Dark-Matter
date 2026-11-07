#!/usr/bin/env python3
# lab-xxe — deliberately XXE-vulnerable lab service (Dark Matter lab stack).
#
# INTENTIONALLY VULNERABLE. Lab-only: this container exists so the scanner's
# XXE and SAML-XXE OOB probes have a live authorised target. It parses
# attacker-supplied XML with external entities ENABLED (lxml, resolve_entities
# + load_dtd + no_network=False) — the exact behaviour the probes test for.
# Never expose this service outside the lab bridge network: the compose file
# pins it to 172.17.0.1:3500 and it serves no other purpose.
#
# Endpoints (all unauthenticated, by design — the scanner's probes send no
# session cookies, exactly like the existing labs' public surfaces):
#   GET  /            — info page (what this lab is, which endpoints exist)
#   POST /  or /xml   — parse the request body as XML with the vulnerable
#                        parser; respond with the document's text content, so
#                        an expanded internal entity is REFLECTED (the xxe
#                        probe's oracle) and an external parameter entity is
#                        FETCHED (the xxe_oob probe's collaborator hit).
#   POST /saml/acs, /sso/acs, /saml2/acs, /acs
#                      — accept a form POST with a SAMLResponse field
#                        (base64, raw-deflate as the scanner mints it),
#                        parse the assertion with the same vulnerable parser,
#                        and echo the NameID in the response (the saml probe's
#                        XXE oracle, internal + OOB).
#
# Deps: Python 3.12 stdlib + lxml only. No other packages.
import base64
import os
import zlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs

# PROXY TRAP (verified 7 Nov 2026): libxml2 honours http_proxy/https_proxy
# when fetching external entities. If an egress proxy is set in the process
# environment, the OOB fetch is routed to the proxy and never reaches the
# collaborator — the probe then times out with no hit and no finding, even
# though the parser is vulnerable. A lab container must fetch direct, so
# strip any proxy variables inherited from the host environment at startup
# (the container image sets none; this is defence in depth).
for _v in ("http_proxy", "https_proxy", "HTTP_PROXY", "HTTPS_PROXY",
          "ALL_PROXY", "all_proxy"):
    os.environ.pop(_v, None)
os.environ["NO_PROXY"] = "172.17.0.1,127.0.0.1,localhost"
os.environ["no_proxy"] = "172.17.0.1,127.0.0.1,localhost"

from lxml import etree

PORT = 8000

# VULNERABLE parser, deliberately: external entities are resolved and
# fetched (no_network=False), DTDs are loaded, entities are expanded.
# This is the configuration the scanner's XXE probes are built to detect.
# lxml documents this exact combination as unsafe — that is the point.
def vulnerable_parser():
    return etree.XMLParser(
        resolve_entities=True,
        load_dtd=True,
        no_network=False,
        dtd_validation=False,
        huge_tree=True,
    )


def parse_vulnerable(xml_bytes):
    """Parse XML with the vulnerable parser; return the root element."""
    return etree.fromstring(xml_bytes, parser=vulnerable_parser())


def doc_text(root):
    """All text in the document, so an expanded entity is reflected."""
    return "".join(root.itertext())


INFO_PAGE = """<!doctype html>
<html><head><title>lab-xxe — XXE lab</title></head>
<body>
<h1>lab-xxe</h1>
<p>Deliberately XXE-vulnerable lab service for the Dark Matter scanner.
Parses submitted XML with external entities enabled.</p>
<ul>
<li>POST / or /xml — Content-Type: application/xml, raw XML body; the
response carries the document text (expanded entities reflected).</li>
<li>POST /saml/acs — form field SAMLResponse (base64, raw-deflate);
the response echoes the assertion NameID.</li>
</ul>
<p>Lab-only. Do not expose publicly.</p>
</body></html>
"""


def decode_saml_response(value):
    """SAMLResponse as the scanner mints it: base64 of raw-deflate XML."""
    raw = base64.b64decode(value)
    for wbits in (-15, 15):
        try:
            return zlib.decompressobj(wbits).decompress(raw)
        except zlib.error:
            continue
    return raw  # already plain XML


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *args):  # keep stdout quiet; the scanner logs
        pass

    def _send(self, status, body, ctype="text/html; charset=utf-8"):
        data = body.encode("utf-8", "ignore")
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path in ("/", "/index.html"):
            self._send(200, INFO_PAGE)
        else:
            self._send(404, "<h1>404</h1>")

    def do_POST(self):
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length) if length else b""
        if self.path in ("/saml/acs", "/sso/acs", "/saml2/acs", "/acs"):
            self._handle_saml(body)
        elif self.path in ("/", "/xml"):
            self._handle_xml(body)
        else:
            self._send(404, "<h1>404</h1>")

    def _handle_xml(self, body):
        if not body:
            self._send(400, "empty body")
            return
        try:
            root = parse_vulnerable(body)
        except Exception as e:
            self._send(400, "XML parse error: %s" % (e,))
            return
        self._send(
            200,
            "<html><body><p>parsed:</p><pre>%s</pre></body></html>"
            % (doc_text(root),),
        )

    def _handle_saml(self, body):
        fields = parse_qs(body.decode("utf-8", "ignore"))
        values = fields.get("SAMLResponse")
        if not values:
            self._send(400, "missing SAMLResponse")
            return
        try:
            xml = decode_saml_response(values[0])
            root = parse_vulnerable(xml)
        except Exception as e:
            self._send(400, "SAML parse error: %s" % (e,))
            return
        nameid = ""
        for el in root.iter():
            if el.tag.split("}")[-1] == "NameID":
                nameid = el.text or ""
                break
        self._send(
            200,
            "<html><body><p>authenticated as:</p><pre>%s</pre></body></html>"
            % (nameid,),
        )


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print("lab-xxe listening on 0.0.0.0:%d" % PORT, flush=True)
    server.serve_forever()
