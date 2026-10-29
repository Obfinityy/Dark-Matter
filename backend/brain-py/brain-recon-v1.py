"""
brain-recon-v1.py — autonomous attack-surface recon for the Dark-Matter brain.

Fills the "khud se recon" gap: a human hunter crawls the target first,
maps endpoints/forms/params, fingerprints tech, THEN chooses probe modules.
This module runs BEFORE brain-engine-v2's decide step and feeds it a
seeded crawl frontier + attack-surface map.

Usage:
  python3 brain-recon-v1.py --target http://127.0.0.1:8310 --out /path/recon.json
  python3 brain-recon-v1.py --target http://172.17.0.1:3100/ --max-pages 30 --out recon.json

Output JSON:
  {
    "target": ..., "started_ist": ..., "pages_crawled": N,
    "endpoints": [{"url":..., "status":..., "title":..., "forms":[...]}],
    "forms": [ {page, method, action, inputs:[{name,type}], password_fields:n, csrf_tokens:n} ],
    "fingerprints": {"server":..., "x_powered_by":..., "generator":..., "js_libs":[...]},
    "module_hits": { "sqli": [{"param":"id","url":...}], ... }   # mapped probe modules
    "VERDICT": "CONFIRMED" | "FAILED"     # last line, engine-compatible
  }
Recon "CONFIRMED" = crawled >=1 page AND mapped >=1 endpoint. The VERDICT
line convention matches the probe rule so the engine can parse uniformly.
"""
import argparse, json, os, re, sys, time, urllib.parse
from datetime import datetime, timezone, timedelta
from http.cookiejar import MozillaCookieJar

try:
    import requests
except ImportError:
    requests = None

IST = timezone(timedelta(hours=5, minutes=30))

# ---- regex HTML parsing (no bs4 dependency; stdlib-only) ----
HREF_RE   = re.compile(r'''(?:href|src)\s*=\s*["']([^"'#\s<>]+)["']''', re.I)
FORM_RE   = re.compile(r'<form\b([^>]*)>(.*?)</form>', re.I | re.S)
ATTR_RE   = re.compile(r'''(\w+)\s*=\s*["']([^"']*)["']''', re.I)
INPUT_RE  = re.compile(r'<(?:input|textarea|select|button)\b([^>]*)>', re.I)
TITLE_RE  = re.compile(r'<title[^>]*>(.*?)</title>', re.I | re.S)
COMMENT_RE = re.compile(r'<!--(.*?)-->', re.S)
GEN_RE    = re.compile(r'''<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)["']''', re.I)
SCRIPT_RE = re.compile(r'<script\b[^>]*src\s*=\s*["\']([^"\']+)["\']', re.I)
JS_LIB_RE = re.compile(r'(jquery|angular|react|vue|bootstrap|backbone|ember|knockout|prototype|mootools)', re.I)

# JS sink signatures a human hunter greps for on a page (DOM-XSS candidates)
SINK_RE = re.compile(r'(document\.write|innerHTML|outerHTML|eval\s*\(|decodeURI|location\.hash|postMessage|setTimeout\s*\(\s*["\'])', re.I)

# param-name -> probe-module mapping (the brain's A-to-Z memory, distilled)
PARAM_MODULES = {
    # reflected XSS: params echoed into HTML
    "name": ["xss_r"], "q": ["xss_r"], "query": ["xss_r"], "search": ["xss_r"],
    "keyword": ["xss_r"], "message": ["xss_r"], "comment": ["xss_r"],
    # command injection: OS-command-ish params
    "ip": ["cmdi"], "cmd": ["cmdi"], "command": ["cmdi"], "host": ["cmdi"], "ping": ["cmdi"],
    # SQLi: numeric/db-ish params
    "id": ["sqli", "bsqli"], "user_id": ["sqli", "bsqli"], "userid": ["sqli", "bsqli"],
    # LFI: file/page params
    "page": ["lfi"], "file": ["lfi"], "path": ["lfi"], "include": ["lfi", "csp"],
    "template": ["lfi"], "doc": ["lfi"],
    # stored XSS: persistent-content forms (POST w/ textarea or message fields)
    "txtname": ["sxss"], "mtxmessage": ["sxss"], "guestbook": ["sxss"],
    # brute force: credential forms
    "username": ["brute"], "password": ["brute"],
    # CSRF: state-changing sensitive forms
    "password_new": ["csrf"], "password_conf": ["csrf"], "new_password": ["csrf"],
    # javascript challenge: token-ish params
    "token": ["javascript"],
    # CSP bypass: script-src reflection
    "src": ["csp"],
}


def same_origin(url, base):
    u, b = urllib.parse.urlparse(url), urllib.parse.urlparse(base)
    return (u.scheme, u.netloc) == (b.scheme, b.netloc)


# Rule #27: when a scope is installed, the crawl stays inside it —
# out-of-scope links are never followed and out-of-scope form actions are
# never recorded (so fuzz can only fire at in-scope forms). Without a
# scope file the legacy same-origin rule applies (back-compatible lab).
_SCOPE = None


def set_scope(scope):
    global _SCOPE
    _SCOPE = scope


def _link_allowed(absu, page_url):
    if _SCOPE is not None:
        ok, _ = _SCOPE.url_allowed(absu)
        return ok
    return same_origin(absu, page_url)


def fetch(sess, url, timeout=10):
    try:
        r = sess.get(url, timeout=timeout, allow_redirects=True)
        return r
    except Exception:
        return None


def parse_page(url, resp):
    """Extract links, forms, sinks, fingerprints from one HTML response."""
    html = resp.text if resp is not None else ""
    info = {"url": url, "status": resp.status_code if resp is not None else 0,
            "title": "", "links": [], "forms": [], "sinks": [], "comments": []}
    if resp is None or "html" not in resp.headers.get("Content-Type", "").lower():
        return info
    m = TITLE_RE.search(html)
    if m:
        info["title"] = re.sub(r"\s+", " ", m.group(1)).strip()[:120]
    for href in HREF_RE.findall(html):
        absu = urllib.parse.urljoin(url, href)
        if _link_allowed(absu, url):
            info["links"].append(absu.split("?")[0])
    for fatts, fbody in FORM_RE.findall(html):
        fdict = dict((k.lower(), v) for k, v in ATTR_RE.findall(fatts))
        inputs = []
        for iatts in INPUT_RE.findall(fbody):
            idict = dict((k.lower(), v) for k, v in ATTR_RE.findall(iatts))
            inputs.append({"name": idict.get("name", ""), "type": idict.get("type", "text")})
        action = urllib.parse.urljoin(url, fdict.get("action", ""))
        if _SCOPE is not None:
            ok, why = _SCOPE.url_allowed(action)
            if not ok:
                continue  # Rule #27: out-of-scope form action, never fuzzed
        info["forms"].append({
            "page": url,
            "method": fdict.get("method", "get").upper(),
            "action": action,
            "inputs": inputs,
            "password_fields": sum(1 for i in inputs if i["type"] == "password"),
            "token_fields": [i["name"] for i in inputs
                             if "token" in i["name"].lower() or "csrf" in i["name"].lower()],
        })
    info["sinks"] = sorted(set(SINK_RE.findall(html)))
    info["comments"] = [c.strip()[:200] for c in COMMENT_RE.findall(html) if c.strip()][:10]
    info["js_libs"] = sorted(set(l.lower() for l in JS_LIB_RE.findall(html)))
    gm = GEN_RE.search(html)
    if gm:
        info["generator"] = gm.group(1)[:80]
    return info


def crawl(target, max_pages=30, timeout=10, cookie_jar=None, scope=None,
          crawl_delay=0):
    set_scope(scope)
    sess = requests.Session()
    sess.headers.update({"User-Agent": "DarkMatter-Recon/1.0 (security research)"})
    if cookie_jar and os.path.exists(cookie_jar):
        # Session the auth lane proved end-to-end: the crawler sees exactly
        # what the logged-in hunter sees (real DVWA gates the link graph).
        jar = MozillaCookieJar(cookie_jar)
        try:
            jar.load(ignore_discard=True, ignore_expires=True)
            sess.cookies = jar
        except Exception:
            pass
    seen, queue, pages = set(), [target.rstrip("/") + "/"], []
    fingerprints = {"server": None, "x_powered_by": None}
    while queue and len(pages) < max_pages:
        url = queue.pop(0)
        key = url.split("?")[0]
        if key in seen:
            continue
        seen.add(key)
        if crawl_delay and pages:
            time.sleep(crawl_delay)
        resp = fetch(sess, url, timeout)
        if resp is None:
            continue
        if len(pages) == 0:  # fingerprint from first response
            fingerprints["server"] = resp.headers.get("Server")
            fingerprints["x_powered_by"] = resp.headers.get("X-Powered-By")
        info = parse_page(url, resp)
        pages.append(info)
        for link in info["links"]:
            if link.split("?")[0] not in seen:
                queue.append(link)
    return pages, fingerprints


# URL-path pattern -> probe-module mapping. A human hunter reads a path like
# /vulnerabilities/exec and thinks "ping page -> command injection" BEFORE any
# payload is fired. Recon maps the surface; the engine's probes still verify.
PATH_MODULES = [
    (re.compile(r'/exec|/ping|/shell|/command', re.I), ["cmdi"]),
    (re.compile(r'/sqli?[_-]?blind', re.I), ["bsqli"]),
    (re.compile(r'/sqli?', re.I), ["sqli"]),
    (re.compile(r'/fi\b|/file|/lfi|/include|/page', re.I), ["lfi"]),
    (re.compile(r'/xss_r|/reflected', re.I), ["xss_r"]),
    (re.compile(r'/xss_s|/stored|/guestbook', re.I), ["sxss"]),
    (re.compile(r'/xss_d|/domx?|/dom\b', re.I), ["domx"]),
    (re.compile(r'/brute|/login|/signin', re.I), ["brute"]),
    (re.compile(r'/csrf|/xsrf', re.I), ["csrf"]),
    (re.compile(r'/javascript|/jschallenge', re.I), ["javascript"]),
    (re.compile(r'/csp\b', re.I), ["csp"]),
]


def map_modules(pages):
    """Map discovered params/forms/sinks/paths to the 11 probe modules."""
    hits = {}
    def add(mod, entry):
        hits.setdefault(mod, [])
        if entry not in hits[mod]:
            hits[mod].append(entry)
    for pg in pages:
        url = pg["url"]
        path = urllib.parse.urlparse(url).path
        for rx, mods in PATH_MODULES:
            if rx.search(path):
                for mod in mods:
                    add(mod, {"url": url, "via": "path-pattern"})
        qs = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)
        for pname in qs:
            for mod in PARAM_MODULES.get(pname.lower(), []):
                add(mod, {"param": pname, "url": url, "via": "query"})
        for form in pg["forms"]:
            names = [i["name"].lower() for i in form["inputs"] if i["name"]]
            for n in names:
                for mod in PARAM_MODULES.get(n, []):
                    add(mod, {"param": n, "url": form["action"], "via": "form"})
            # stored-XSS heuristic: POST form with textarea/message-ish input
            if form["method"] == "POST" and any(
                    "message" in n or "comment" in n or "mtxmessage" in n for n in names):
                add("sxss", {"form": form["action"], "via": "stored-form"})
            # login form heuristic
            if form["password_fields"] >= 1 and any("user" in n for n in names):
                add("brute", {"form": form["action"], "via": "login-form"})
            # CSRF: state-changing form without token fields
            if not form["token_fields"] and any(
                    k in names for k in ("password_new", "password_conf", "email", "change")):
                add("csrf", {"form": form["action"], "via": "no-token-state-change"})
        if pg["sinks"]:
            add("domx", {"url": url, "via": "js-sinks", "sinks": pg["sinks"]})
        if pg.get("js_libs") and any("jquery" in l for l in pg["js_libs"]):
            pass  # fingerprint only
    return hits


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--target", required=True)
    ap.add_argument("--max-pages", type=int, default=30)
    ap.add_argument("--out", default=None)
    ap.add_argument("--cookie-jar", default=None,
                    help="Netscape cookie jar from brain-auth-v1")
    ap.add_argument("--scope-file", default=None,
                    help="Rule #27 scope spec JSON (crawl stays inside scope)")
    ap.add_argument("--crawl-delay", type=float, default=0,
                    help="Rule #27 polite mode: seconds between page fetches")
    ap.add_argument("--proxy-port", type=int, default=0,
                    help="Rule #28: route requests via the brain proxy on "
                         "127.0.0.1:PORT (audit + scope enforcement); 0 = direct")
    args = ap.parse_args()

    if requests is None:
        print("FATAL: requests not installed")
        print("VERDICT: FAILED")
        return 2

    # Rule #28: requests honors http_proxy/https_proxy env per request.
    if args.proxy_port:
        os.environ.pop("no_proxy", None)
        os.environ.pop("NO_PROXY", None)
        proxy_url = f"http://127.0.0.1:{args.proxy_port}"
        os.environ["http_proxy"] = proxy_url
        os.environ["https_proxy"] = proxy_url
        print(f"[recon] Rule #28: requests route via brain proxy {proxy_url}",
              flush=True)

    # Rule #27 startup gate: the target itself must be in scope, else
    # fail-closed with zero requests.
    scope = None
    if args.scope_file:
        import importlib.util as _ilu
        _here = os.path.dirname(os.path.abspath(__file__))
        _spec = _ilu.spec_from_file_location(
            "brain_scope_v1", os.path.join(_here, "brain-scope-v1.py"))
        _mod = _ilu.module_from_spec(_spec)
        _spec.loader.exec_module(_mod)
        try:
            scope = _mod.load_scope(args.scope_file, args.target)
        except ValueError as e:
            print(f"fail-closed: {e}")
            print("VERDICT: FAILED")
            return 2
        ok, why = scope.url_allowed(args.target)
        if not ok:
            print(f"fail-closed: target out of scope: {why} (0 requests sent)")
            print("VERDICT: FAILED")
            return 2
        print(f"[scope] {why}", flush=True)

    t0 = time.time()
    pages, fingerprints = crawl(args.target, args.max_pages,
                                cookie_jar=args.cookie_jar, scope=scope,
                                crawl_delay=max(0.0, args.crawl_delay or
                                                (scope.crawl_delay_s if scope else 0)))
    module_hits = map_modules(pages)

    verdict = "CONFIRMED" if (pages and len(pages) >= 1 and module_hits) else "FAILED"
    result = {
        "target": args.target,
        "started_ist": datetime.now(IST).strftime("%Y-%m-%d %H:%M:%S"),
        "elapsed_s": round(time.time() - t0, 1),
        "pages_crawled": len(pages),
        "fingerprints": fingerprints,
        "endpoints": [{"url": p["url"], "status": p["status"], "title": p["title"],
                       "forms": len(p["forms"]), "sinks": p["sinks"]} for p in pages],
        "forms": [f for p in pages for f in p["forms"]],
        "module_hits": module_hits,
        "modules_mapped": sorted(module_hits.keys()),
        "VERDICT": verdict,
    }
    if args.out:
        with open(args.out, "w") as fh:
            json.dump(result, fh, indent=2)
        print("recon written: %s" % args.out)
    print("pages=%d endpoints=%d forms=%d modules_mapped=%d %s"
          % (len(pages), len(pages), len(result["forms"]),
             len(module_hits), ",".join(sorted(module_hits.keys()))))
    print("VERDICT: %s" % verdict)
    return 0 if verdict == "CONFIRMED" else 1


if __name__ == "__main__":
    sys.exit(main())
