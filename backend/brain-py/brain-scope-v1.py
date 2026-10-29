#!/usr/bin/env python3
"""
brain-scope-v1.py — SCOPE DISCIPLINE lane (Playbook Rule #27).

A real human hunter only touches in-scope targets. Until this lane the
agent had NO scope concept: recon crawled, probes fired, fuzz swept —
everything under the target host. That is fine for the DVWA lab but
disqualifying for a real bounty (and it violates the owner's standing
"explicit targets only" order the moment a real target is pasted).

Design — fail-closed at every layer, zero requests when blocked:

- Scope spec (JSON): {target_base, allow_hosts, allow_path_prefixes,
  deny_path_prefixes, polite:{min_turn_gap_s, crawl_delay_s}}.
  Deny beats allow. Anything unparseable -> BLOCKED (never fail-open).
- Scope.url_allowed(url) -> (bool, reason): every turn's URL is checked
  BEFORE any probe subprocess launches. A blocked turn sends ZERO
  requests and is recorded in memory["scope_blocks"] WITH the reason
  (Rule: ADD/REMOVE WITH REASON — the block itself is a memory entry).
- Wiring: brain-drive-v1.py --scope-file (startup gate on target_base +
  per-turn gate on target_base+module_path, covers playbook, escalation
  ladders and explore — they all flow through one execute site),
  brain-recon-v1.py --scope-file (crawl stays inside scope),
  brain-chain-v1.py --scope-file (target_base gate),
  brain-agent-v1.py --scope-file/--polite (passthrough).
- brain-fuzz-v1 inherits scope via recon.json (it only fires at
  recon-mapped forms).

Polite mode: --polite in the agent sets min_turn_gap_s between executed
turns and crawl_delay_s between recon fetches, so a real target never
sees a burst. Lab default is 0 (fast lab); the gate logic is identical.

Usage:
  python3 brain-scope-v1.py --self-test
  python3 brain-scope-v1.py --target-base http://127.0.0.1:8310/ --emit /tmp/scope.json
  python3 brain-scope-v1.py --check http://127.0.0.1:8310/vulnerabilities/xss_r/ --scope-file /tmp/scope.json
"""
import argparse
import json
import os
import sys
import urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))


def _norm_host(parsed):
    host = (parsed.hostname or "").lower()
    port = parsed.port
    scheme = (parsed.scheme or "").lower()
    if port and not ((scheme == "http" and port == 80) or
                     (scheme == "https" and port == 443)):
        host = f"{host}:{port}"
    return host


def _norm_path(path):
    # Collapse //, resolve . and .. WITHOUT touching the filesystem
    # (PurePosixPath would also strip a trailing slash we want to keep).
    parts = []
    for seg in (path or "/").split("/"):
        if seg in ("", "."):
            continue
        if seg == "..":
            if parts:
                parts.pop()
            continue
        parts.append(seg)
    p = "/" + "/".join(parts)
    if (path or "/").endswith("/") and p != "/":
        p += "/"
    return p or "/"


class Scope:
    """Fail-closed scope gate. Construct via load_scope() or default_scope()."""

    # HARNESS_PATHS: session/login machinery the lab probes need
    # (login, logout, DVWA security-level/setup). These are NOT attack
    # surface — a human hunter logging in is not "testing out of scope".
    # They are allowed under ANY scope (deny still beats them), and every
    # allowance is logged with this reason. The vulnerability surface
    # itself (module paths, explore paths, fuzz forms) is gated strictly.
    HARNESS_PATHS = frozenset({
        "/login.php", "/logout.php", "/setup.php", "/security.php",
    })

    def __init__(self, spec):
        self.spec = dict(spec or {})
        tb = self.spec.get("target_base", "")
        try:
            tp = urllib.parse.urlparse(tb)
            if tp.scheme not in ("http", "https") or not tp.hostname:
                raise ValueError("target_base must be an http(s) URL with a host")
        except Exception as e:
            raise ValueError(f"fail-closed: bad target_base {tb!r}: {e}")
        self.target_base = tb
        self.target_host = _norm_host(tp)
        hosts = self.spec.get("allow_hosts") or [self.target_host]
        self.allow_hosts = {h.lower() for h in hosts}
        self.allow_prefixes = [_norm_path(p)
                               for p in (self.spec.get("allow_path_prefixes") or ["/"])]
        self.allow_exact = {_norm_path(p)
                            for p in (self.spec.get("allow_exact_paths") or [])}
        self.deny_prefixes = [_norm_path(p)
                              for p in (self.spec.get("deny_path_prefixes") or [])]
        polite = self.spec.get("polite") or {}
        self.min_turn_gap_s = float(polite.get("min_turn_gap_s", 0) or 0)
        self.crawl_delay_s = float(polite.get("crawl_delay_s", 0) or 0)

    @staticmethod
    def _prefix_hit(path, prefix):
        # Boundary-safe: prefix "/xss_r/" matches "/xss_r/" and
        # "/xss_r/sub" but NOT "/xss_r_evil". A bare "/xss_r" also matches
        # exactly "/xss_r".
        if prefix == "/":
            return True
        if path == prefix:
            return True
        stem = prefix if prefix.endswith("/") else prefix + "/"
        if path.startswith(stem):
            return True
        if not prefix.endswith("/") and path == prefix:
            return True
        return False

    def url_allowed(self, url):
        """-> (allowed: bool, reason: str). NEVER raises: fail-closed."""
        try:
            if not isinstance(url, str) or not url:
                return False, "fail-closed: empty/non-string URL"
            # Null bytes and control characters are request-smuggling
            # primitives (null-byte truncation, header injection): reject
            # before any normalization, fail-closed.
            if any(ord(c) < 32 or ord(c) == 127 for c in url):
                return False, "fail-closed: control character in URL"
            # urljoin against target_base so module paths ("vulnerabilities/xss_r/")
            # and absolute paths both resolve the way the probes use them.
            # A relative input can never escape the target host — safe by design.
            abs_url = urllib.parse.urljoin(
                self.target_base.rstrip("/") + "/", url)
            p = urllib.parse.urlparse(abs_url)
            if p.scheme not in ("http", "https"):
                return False, f"fail-closed: scheme {p.scheme!r} not http(s)"
            host = _norm_host(p)
            if host not in self.allow_hosts:
                return False, (f"blocked: host {host!r} not in allow_hosts "
                                f"{sorted(self.allow_hosts)}")
            path = _norm_path(p.path)
            for d in self.deny_prefixes:
                if self._prefix_hit(path, d):
                    return False, f"blocked: path {path!r} under deny prefix {d!r}"
            if path in self.HARNESS_PATHS:
                return True, (f"allowed: path {path!r} is session harness "
                               f"(login/logout/setup machinery, not attack surface)")
            if path in self.allow_exact:
                return True, f"allowed: path {path!r} exact-allowed"
            for a in self.allow_prefixes:
                if self._prefix_hit(path, a):
                    return True, f"allowed: path {path!r} under allow prefix {a!r}"
            return False, (f"blocked: path {path!r} matches no allow rule "
                            f"(exact={sorted(self.allow_exact)} "
                            f"prefixes={self.allow_prefixes})")
        except Exception as e:  # fail-closed, never fail-open
            return False, f"fail-closed: {type(e).__name__}: {e}"

    def probe_url(self):
        """One concrete in-scope URL for canary/detection requests.

        The auth lane needs a real page to detect the login gate; it must
        not invent one outside the scope. Prefers an exact-allowed path,
        else the first allow prefix. Fail-closed ValueError when the scope
        allows nothing concrete.
        """
        if self.allow_exact:
            return urllib.parse.urljoin(
                self.target_base.rstrip("/") + "/",
                sorted(self.allow_exact)[0].lstrip("/"))
        if self.allow_prefixes:
            return urllib.parse.urljoin(
                self.target_base.rstrip("/") + "/",
                self.allow_prefixes[0].lstrip("/"))
        raise ValueError("fail-closed: scope allows no concrete URL")


def default_scope(target_base):
    """Everything under the target host — the lab default."""
    return Scope({"target_base": target_base,
                  "allow_path_prefixes": ["/"],
                  "deny_path_prefixes": [],
                  "polite": {"min_turn_gap_s": 0, "crawl_delay_s": 0}})


import re as _re
_URL_RE = _re.compile(r"https?://([^/\"' \t\r\n]+)", _re.IGNORECASE)


def audit_probe_hosts(command_text, scope):
    """Advisory: distinct non-target hosts referenced in a probe command.

    Payload strings (e.g. the CSP probe's https://pastebin.com/raw/...
    bypass payload) are NOT requests — the probe never fetches them — so
    this is logged, never blocking. A future proxy lane can enforce it.
    Returns sorted list of external hosts (empty = clean).
    """
    try:
        found = set()
        for m in _URL_RE.finditer(command_text or ""):
            host = (m.group(1) or "").lower().split("@")[-1].split(":")[0]
            if not host:
                continue
            # normalize the same way url_allowed does (default ports)
            if host not in scope.allow_hosts and host != scope.target_host.split(":")[0]:
                found.add(m.group(1).lower())
        return sorted(found)
    except Exception:
        return ["<audit-error-fail-closed>"]


def load_scope(path, target_base=""):
    """Load a scope file; without one, build the default from target_base."""
    if path:
        with open(path, "r", encoding="utf-8") as f:
            spec = json.load(f)
        if target_base and spec.get("target_base") != target_base:
            raise ValueError(
                f"fail-closed: scope target_base {spec.get('target_base')!r} "
                f"!= run target_base {target_base!r}")
        return Scope(spec)
    if not target_base:
        raise ValueError("fail-closed: need --scope-file or --target-base")
    return Scope({"target_base": target_base})


def self_test():
    cases = [
        # (scope spec, url, expect_allowed, note)
        ({"target_base": "http://127.0.0.1:8310/"},
         "http://127.0.0.1:8310/vulnerabilities/xss_r/", True, "lab default allows all"),
        ({"target_base": "http://127.0.0.1:8310/",
          "allow_path_prefixes": ["/vulnerabilities/xss_r/", "/login.php"]},
         "http://127.0.0.1:8310/vulnerabilities/xss_r/", True, "restricted allow hit"),
        ({"target_base": "http://127.0.0.1:8310/",
          "allow_path_prefixes": ["/vulnerabilities/xss_r/", "/login.php"]},
         "http://127.0.0.1:8310/vulnerabilities/sqli/", False, "restricted: sqli blocked"),
        ({"target_base": "http://127.0.0.1:8310/",
          "allow_path_prefixes": ["/vulnerabilities/xss_r/", "/login.php"]},
         "vulnerabilities/sqli_blind/", False, "relative module path blocked"),
        ({"target_base": "http://127.0.0.1:8310/",
          "allow_path_prefixes": ["/vulnerabilities/xss_r/", "/login.php"]},
         "http://evil.example/", False, "hostile host blocked"),
        ({"target_base": "http://127.0.0.1:8310/",
          "allow_path_prefixes": ["/vulnerabilities/xss_r/", "/login.php"]},
         "http://127.0.0.1:8310.evil.example/", False, "suffix-spoof host blocked"),
        ({"target_base": "http://127.0.0.1:8310/",
          "allow_path_prefixes": ["/"],
          "deny_path_prefixes": ["/logout.php"]},
         "http://127.0.0.1:8310/logout.php", False, "deny beats allow"),
        ({"target_base": "http://127.0.0.1:8310/",
          "allow_exact_paths": ["/", "/login.php"],
          "allow_path_prefixes": ["/vulnerabilities/xss_r/"]},
         "http://127.0.0.1:8310/", True, "exact: index allowed"),
        ({"target_base": "http://127.0.0.1:8310/",
          "allow_exact_paths": ["/", "/login.php"],
          "allow_path_prefixes": ["/vulnerabilities/xss_r/"]},
         "http://127.0.0.1:8310/vulnerabilities/sqli/", False,
         "exact+prefix: sqli blocked (prefix / swallows nothing now)"),
        ({"target_base": "http://127.0.0.1:8310/",
          "allow_path_prefixes": ["/vulnerabilities/xss_r/"]},
         "http://127.0.0.1:8310/vulnerabilities/xss_r_evil/", False,
         "prefix boundary: no sibling match"),
        ({"target_base": "http://127.0.0.1:8310/",
          "allow_path_prefixes": ["/vulnerabilities/xss_r/"]},
         "http://127.0.0.1:8310/vulnerabilities/../vulnerabilities/sqli/",
         False, "dotdot traversal normalized then blocked"),
        ({"target_base": "http://127.0.0.1:8310/",
          "allow_path_prefixes": ["/"]},
         "http://127.0.0.1:8310//vulnerabilities//xss_r/", True,
         "double-slash normalized, allowed"),
        ({"target_base": "http://127.0.0.1:8310/"},
         "not a url \x00", False, "malformed URL fail-closed"),
        ({"target_base": "http://127.0.0.1:8310/",
          "allow_exact_paths": ["/"],
          "allow_path_prefixes": ["/vulnerabilities/xss_r/"]},
         "http://127.0.0.1:8310/security.php", True,
         "harness: security.php allowed under restricted scope"),
        ({"target_base": "http://127.0.0.1:8310/",
          "allow_exact_paths": ["/"],
          "allow_path_prefixes": ["/vulnerabilities/xss_r/"],
          "deny_path_prefixes": ["/security.php"]},
         "http://127.0.0.1:8310/security.php", False,
         "deny beats harness"),
    ]
    passed = 0
    for i, (spec, url, expect, note) in enumerate(cases):
        sc = Scope(spec)
        ok, why = sc.url_allowed(url)
        good = (ok == expect)
        passed += good
        print(f"[{'PASS' if good else 'FAIL'}] {i:02d} {note}: "
              f"allowed={ok} ({why})", flush=True)
    # default scope from target_base
    sc = default_scope("http://172.17.0.1:3100/")
    ok, _ = sc.url_allowed("http://172.17.0.1:3100/vulnerabilities/exec/")
    passed += ok
    print(f"[{'PASS' if ok else 'FAIL'}] {len(cases):02d} default_scope lab target",
          flush=True)
    total = len(cases) + 1
    # probe_url(): prefers exact paths, else first prefix, fail-closed empty
    sc2 = Scope({"target_base": "http://127.0.0.1:8310/",
                 "allow_exact_paths": ["/login.php", "/"],
                 "allow_path_prefixes": ["/vulnerabilities/xss_r/"]})
    pu = sc2.probe_url()
    good = pu == "http://127.0.0.1:8310/"
    passed += good
    total += 1
    print(f"[{'PASS' if good else 'FAIL'}] probe_url exact-first -> {pu}",
          flush=True)
    sc3 = Scope({"target_base": "http://127.0.0.1:8310/",
                 "allow_path_prefixes": ["/vulnerabilities/xss_r/"]})
    pu3 = sc3.probe_url()
    good3 = pu3 == "http://127.0.0.1:8310/vulnerabilities/xss_r/"
    passed += good3
    total += 1
    print(f"[{'PASS' if good3 else 'FAIL'}] probe_url prefix-fallback -> {pu3}",
          flush=True)
    # audit_probe_hosts(): advisory — pastebin payload string flagged but
    # the real target host never flagged
    sc4 = default_scope("http://127.0.0.1:8310/")
    ext = audit_probe_hosts(
        'curl http://127.0.0.1:8310/vulnerabilities/csp/ --data "x=https://pastebin.com/raw/M1"',
        sc4)
    good4 = ext == ["pastebin.com"]
    passed += good4
    total += 1
    print(f"[{'PASS' if good4 else 'FAIL'}] audit flags payload host only: {ext}",
          flush=True)
    print(f"SELF-TEST {passed}/{total} "
          f"{'PASS' if passed == total else 'FAIL'}", flush=True)
    return 0 if passed == total else 1


def main():
    ap = argparse.ArgumentParser(description="Brain scope lane v1 (Rule #27)")
    ap.add_argument("--self-test", action="store_true")
    ap.add_argument("--target-base", default="")
    ap.add_argument("--emit", default="",
                    help="write a default scope file for target_base")
    ap.add_argument("--scope-file", default="")
    ap.add_argument("--check", default="", help="URL to check against scope")
    args = ap.parse_args()
    if args.self_test:
        return self_test()
    if args.emit:
        if not args.target_base:
            print("fail-closed: --emit needs --target-base", flush=True)
            return 2
        sc = default_scope(args.target_base)
        with open(args.emit, "w", encoding="utf-8") as f:
            json.dump({"target_base": sc.target_base,
                       "allow_hosts": sorted(sc.allow_hosts),
                       "allow_exact_paths": sorted(sc.allow_exact),
                       "allow_path_prefixes": sc.allow_prefixes,
                       "deny_path_prefixes": sc.deny_prefixes,
                       "polite": {"min_turn_gap_s": sc.min_turn_gap_s,
                                  "crawl_delay_s": sc.crawl_delay_s}},
                      f, indent=2)
        print(f"wrote default scope -> {args.emit}", flush=True)
        return 0
    if args.check:
        sc = load_scope(args.scope_file, args.target_base)
        ok, why = sc.url_allowed(args.check)
        print(f"allowed={ok} reason={why}", flush=True)
        return 0 if ok else 1
    ap.print_help()
    return 2


if __name__ == "__main__":
    sys.exit(main())
