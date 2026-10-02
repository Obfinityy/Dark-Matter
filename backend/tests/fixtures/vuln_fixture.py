#!/usr/bin/env python3
"""
Deliberately vulnerable LOCAL fixture for Dark-Matter PoC/report verification.

Listens ONLY on 127.0.0.1. Used exclusively by Worker 5 (proof-report) to:
  1. capture a REAL screenshot of a reflected-XSS alert firing,
  2. generate REAL hunt findings (3 vulns) for the PDF report pipeline,
  3. prove reproducible curl/python repro snippets by re-running them.

Run:  python3 vuln_fixture.py [port]   (default 4567)
Stop: Ctrl-C
"""
import http.server
import json
import socketserver
import urllib.parse
import html as htmlmod

HOST = "127.0.0.1"
PORT = 4567

COMMENTS = []  # in-memory only

PAGE = """<!DOCTYPE html><html><head><title>Fixture</title></head><body>
<h1>Vulnerable Fixture (local only)</h1>
<ul>
<li><a href="/search?q=hello">/search?q=&lt;input&gt;</a> — reflected input (XSS)</li>
<li><a href="/guestbook">/guestbook</a> — stored comments (stored XSS)</li>
<li><a href="/user?id=1">/user?id=1</a> — user lookup (SQLi boolean probe)</li>
</ul></body></html>"""


class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args):  # quiet
        pass

    def _send(self, body, code=200, ctype="text/html; charset=utf-8"):
        data = body.encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        qs = urllib.parse.parse_qs(parsed.query, keep_blank_values=True)

        if parsed.path == "/":
            return self._send(PAGE)

        # 1. REFLECTED XSS — reflects q without escaping
        if parsed.path == "/search":
            q = qs.get("q", [""])[0]
            return self._send(
                f"<!DOCTYPE html><html><head><title>Search</title></head><body>"
                f"<h2>Search results for:</h2><div id='echo'>{q}</div>"
                f"<p><a href='/'>home</a></p></body></html>"
            )

        # 2. STORED XSS — comments rendered without escaping
        if parsed.path == "/guestbook":
            items = "".join(f"<li>{c}</li>" for c in COMMENTS)
            return self._send(
                "<!DOCTYPE html><html><head><title>Guestbook</title></head><body>"
                "<h2>Guestbook</h2><ul>" + items + "</ul>"
                "<form method='POST' action='/guestbook'>"
                "<input name='comment' placeholder='leave a comment'>"
                "<button>Post</button></form>"
                "<p><a href='/'>home</a></p></body></html>"
            )

        # 3. SQLi boolean probe — different response for ' AND '1'='1 vs '1'='2
        if parsed.path == "/user":
            uid = qs.get("id", ["1"])[0]
            if "' AND '1'='1" in uid or '" AND "1"="1' in uid:
                return self._send(
                    "<html><body><h2>User profile</h2><p>id=1, name=fixture-user</p></body></html>"
                )
            if "' AND '1'='2" in uid or '" AND "1"="2' in uid:
                return self._send(
                    "<html><body><h2>User profile</h2><p>No such user</p></body></html>"
                )
            if "'" in uid or '"' in uid:
                return self._send(
                    "<html><body><h2>SQL error</h2>"
                    "<p>You have an error in your SQL syntax near ''1'' at line 1</p>"
                    "</body></html>", code=500
                )
            return self._send(
                f"<html><body><h2>User profile</h2><p>id={htmlmod.escape(uid)}, name=fixture-user</p></body></html>"
            )

        if parsed.path == "/health":
            return self._send(json.dumps({"ok": True}), ctype="application/json")

        return self._send("<html><body>404</body></html>", code=404)

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/guestbook":
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length).decode(errors="ignore")
            form = urllib.parse.parse_qs(body)
            comment = form.get("comment", [""])[0][:500]
            COMMENTS.append(comment)  # stored raw — deliberately vulnerable
            self.send_response(303)
            self.send_header("Location", "/guestbook")
            self.end_headers()
            return
        return self._send("<html><body>404</body></html>", code=404)


def main():
    import sys
    port = int(sys.argv[1]) if len(sys.argv) > 1 else PORT
    # Bind strictly to loopback — this fixture must never be reachable externally.
    with socketserver.TCPServer((HOST, port), Handler, bind_and_activate=False) as srv:
        srv.allow_reuse_address = True
        srv.server_bind()
        srv.server_activate()
        print(f"fixture listening on http://{HOST}:{port}", flush=True)
        srv.serve_forever()


if __name__ == "__main__":
    main()
