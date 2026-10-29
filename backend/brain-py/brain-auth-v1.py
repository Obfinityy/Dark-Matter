#!/usr/bin/env python3
"""brain-auth-v1.py — AUTONOMOUS AUTHENTICATION LANE (29 Oct 2026).

A real human hunter's FIRST move on DVWA/Juice Shop is getting a session.
This lane runs ONCE per hunt, before recon, and is the single place in the
whole brain where credentials are tried:

  1. detect: GET /vulnerabilities/xss_r/ with NO cookies.
     302 -> login.php, or a login form (username+password inputs) in the
     body -> auth is required. Anything else -> not required.
  2. not required -> VERDICT: CONFIRMED (method=none_required). Nothing
     stored; recon + probes run exactly as before.
  3. required -> try the agent-vault defaults ONCE each (DVWA:
     admin/password). Like a human, it fetches /login.php first, extracts
     the user_token anti-CSRF field, then POSTs the login form.
  4. success -> the session is verified END-TO-END: GET / with the jar must
     show "Welcome to DVWA"/"Logout". The Netscape cookie jar is saved to
     <memory-dir>/auth.cookies for recon + probes; the auth record goes
     into memory.json. VERDICT: CONFIRMED (method=default_login).
  5. every credential fails -> auth_blocked dead end WITH REASON in
     memory.json, VERDICT: FAILED, exit 1 (FAIL-CLOSED).

Why fail-closed: without this gate, an auth-required target with wrong
creds makes every probe FALSE-FAILED, and the loop would record 11+
false-negative dead ends — permanently poisoning the A-to-Z memory the
owner ordered (never repeat, but also never learn the WRONG lesson).
The agent must run ZERO probes when it cannot authenticate, and say why.

Zero LLM, zero Meta, zero spend. Live hunt / backend never touched.
"""
import argparse
import importlib.util
import json
import os
import re
import sys
import time
from datetime import datetime, timezone, timedelta

import requests
from http.cookiejar import MozillaCookieJar

IST = timezone(timedelta(hours=5, minutes=30))
HERE = os.path.dirname(os.path.abspath(__file__))


def _load_scope(scope_file, target_base):
    """Import brain-scope-v1.py and load the spec (fail-closed)."""
    spec = importlib.util.spec_from_file_location(
        "brain_scope_v1", os.path.join(HERE, "brain-scope-v1.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.load_scope(scope_file, target_base)

# The agent vault: default credentials a human hunter tries first.
# Extendable via --creds-json: [{"user": "...", "pw": "...", "label": "..."}].
VAULT_DEFAULTS = [
    {"user": "admin", "pw": "password", "label": "admin"},
]


def now_ist():
    return datetime.now(IST).strftime("%Y-%m-%d %H:%M:%S IST")


def load_engine_dead_ends():
    """Single source of truth: the static dead ends live in the engine."""
    spec = importlib.util.spec_from_file_location(
        "brain_engine_v2", os.path.join(HERE, "brain-engine-v2.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return sorted(mod.DEAD_ENDS)


def ensure_schema(memory, hunt_id, target_base):
    """Fill the loop's memory schema so later lanes never KeyError on a
    memory.json the auth lane created first (tester-found defect, 29 Oct)."""
    if "tried" not in memory:
        memory.setdefault("hunt_id", hunt_id)
        memory.setdefault("target_base", target_base)
        memory.setdefault("tried", [])
        memory.setdefault("explore_tried", [])
        memory.setdefault("findings", [])
        memory.setdefault("verdict_feedback_applied", [])
        memory.setdefault("started_ist", now_ist())
        memory.setdefault("runs", 0)
    if "dead_ends" not in memory:
        memory["dead_ends"] = load_engine_dead_ends()
    memory.setdefault("dead_end_reasons", {})
    return memory


def load_json(path, default):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def save_json(path, obj):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2, sort_keys=True)
        f.write("\n")
    os.replace(tmp, path)


def has_login_form(html):
    low = html.lower()
    return ("name='username'" in low or 'name="username"' in low) and \
           ("name='password'" in low or 'name="password"' in low)


def extract_token(html):
    m = re.search(r"name='user_token' value='([^']+)'", html)
    return m.group(1) if m else ""


def main():
    p = argparse.ArgumentParser(description="Autonomous authentication lane")
    p.add_argument("--target-base", required=True)
    p.add_argument("--memory-dir", required=True)
    p.add_argument("--hunt-id", default="local-auth")
    p.add_argument("--creds-json", default=None,
                   help="extra vault creds: [{\"user\",\"pw\",\"label\"}]")
    p.add_argument("--timeout", type=int, default=15)
    p.add_argument("--scope-file", default=None,
                   help="Rule #27 scope spec JSON — the auth canary uses an "
                        "in-scope URL (scope.probe_url()); the target itself "
                        "is fail-closed gated at startup")
    p.add_argument("--proxy-port", type=int, default=0,
                   help="Rule #28: route requests via the brain proxy on "
                        "127.0.0.1:PORT (audit + scope enforcement); 0 = direct")
    args = p.parse_args()

    # Rule #28: requests honors http_proxy/https_proxy env per request.
    if args.proxy_port:
        os.environ.pop("no_proxy", None)
        os.environ.pop("NO_PROXY", None)
        proxy_url = f"http://127.0.0.1:{args.proxy_port}"
        os.environ["http_proxy"] = proxy_url
        os.environ["https_proxy"] = proxy_url
        print(f"[auth] Rule #28: requests route via brain proxy {proxy_url}",
              flush=True)

    base = args.target_base.rstrip("/")
    mem_dir = args.memory_dir
    os.makedirs(mem_dir, exist_ok=True)
    jar_path = os.path.join(mem_dir, "auth.cookies")
    mem_path = os.path.join(mem_dir, "memory.json")
    memory = ensure_schema(load_json(mem_path, {}), args.hunt_id, base)

    # Rule #27 startup gate: the target itself must be in scope, else
    # fail-closed with ZERO requests (auth_blocked WITH REASON).
    scope = None
    if args.scope_file:
        scope = _load_scope(args.scope_file, args.target_base)
        ok, why = scope.url_allowed(args.target_base)
        if not ok:
            reason = f"fail-closed: target out of scope: {why} (0 requests sent)"
            print(f"VERDICT: FAILED\nREASON: {reason}", file=sys.stderr)
            record({"required": "unknown", "at_ist": now_ist(),
                    "reason": reason, "scope_blocked": True})
            sys.exit(1)
        print(f"[scope] {why}", flush=True)

    creds = list(VAULT_DEFAULTS)
    if args.creds_json and os.path.exists(args.creds_json):
        creds += load_json(args.creds_json, [])
    tried_labels = [c.get("label", c.get("user")) for c in creds]

    def record(result):
        memory["auth"] = result
        save_json(mem_path, memory)

    # ---- STEP 1: detect whether auth is required ----
    # Rule #27: the canary must be an IN-SCOPE URL — the lane never invents
    # one outside the scope. Without a scope file the legacy xss_r canary
    # is used (back-compatible lab).
    canary = (scope.probe_url() if scope
              else base + "/vulnerabilities/xss_r/")
    probe = requests.Session()
    required = False
    detect_detail = ""
    try:
        r = probe.get(canary, timeout=args.timeout,
                      allow_redirects=True)
        final = r.url
        if "login.php" in final or has_login_form(r.text):
            required = True
            detect_detail = ("redirected-to-login" if "login.php" in final
                             else "login-form-in-body")
        else:
            detect_detail = "vuln-page-served-unauthenticated"
    except requests.RequestException as e:
        print(f"VERDICT: FAILED\nREASON: detect request failed: {e}",
              file=sys.stderr)
        record({"required": "unknown", "at_ist": now_ist(),
                "reason": f"detect request failed: {e}"})
        sys.exit(1)

    if not required:
        record({"required": False, "method": "none_required",
                "detect": detect_detail, "at_ist": now_ist()})
        print("MARKER: auth-detection")
        print(f"DETECT: {detect_detail}")
        print("METHOD: none_required")
        print("VERDICT: CONFIRMED")
        sys.exit(0)

    # ---- STEP 2: auth required — try the vault, one human-style login ----
    for cred in creds:
        sess = requests.Session()
        sess.cookies = MozillaCookieJar()  # empty until login succeeds
        try:
            g = sess.get(base + "/login.php", timeout=args.timeout)
            token = extract_token(g.text)
            sess.post(base + "/login.php",
                      data={"username": cred["user"], "password": cred["pw"],
                            "Login": "Login", "user_token": token},
                      timeout=args.timeout)
            v = sess.get(base + "/", timeout=args.timeout)
            if "Welcome to DVWA" in v.text or "Logout" in v.text:
                # Cross-tool jar: session cookies (no Expires) are written by
                # MozillaCookieJar with an EMPTY expires field, which curl
                # parses as epoch-expired and silently drops. Stamp them so
                # curl, python and the drive all honor the proved session.
                for ck in sess.cookies:
                    if ck.expires is None:
                        ck.expires = int(time.time()) + 30 * 86400
                sess.cookies.save(jar_path, ignore_discard=True,
                                  ignore_expires=True)
                label = cred.get("label", cred["user"])
                record({"required": True, "method": "default_login",
                        "creds_label": label,
                        "creds_tried": tried_labels[:tried_labels.index(label) + 1],
                        "jar": jar_path, "at_ist": now_ist()})
                print("MARKER: auth-login")
                print(f"METHOD: default_login ({label})")
                print(f"SESSION: verified end-to-end (Welcome/Logout on /)")
                print(f"JAR: {jar_path}")
                print("VERDICT: CONFIRMED")
                sys.exit(0)
        except requests.RequestException:
            continue  # next credential; transport error is not a verdict

    # ---- STEP 3: fail CLOSED — record the dead end WITH REASON ----
    reason = ("auth required (%s) but no vault credential worked "
              "(tried: %s)" % (detect_detail, ", ".join(tried_labels)))
    memory.setdefault("dead_ends", [])
    memory.setdefault("dead_end_reasons", {})
    if "auth_blocked" not in memory["dead_ends"]:
        memory["dead_ends"].append("auth_blocked")
        memory["dead_ends"] = sorted(memory["dead_ends"])
    memory["dead_end_reasons"]["auth_blocked"] = {
        "reason": reason, "at_ist": now_ist(), "source": "brain-auth-v1"}
    record({"required": True, "blocked": True, "reason": reason,
            "creds_tried": tried_labels, "at_ist": now_ist()})
    print("MARKER: auth-blocked")
    print(f"REASON: {reason}")
    print("EFFECT: zero probes will run — no false-negative dead ends recorded")
    print("VERDICT: FAILED")
    sys.exit(1)


if __name__ == "__main__":
    main()
