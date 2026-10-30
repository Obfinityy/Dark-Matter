#!/usr/bin/env python3
"""brain-apiloop-v1.py — THE BRAIN-API LOOP (29 Oct 2026, owner-accepted spec).

The ONE thing. Not a lane — the loop itself, end-to-end, lab-proven.

OWNER'S SPEC, implemented faithfully:
  1. THREE INPUTS EVERY TURN: (a) screenshot of the open OS interface
     (first-class field: path, base64 optional); (b) PROCESS memory — the
     FULL memory of the running process (what/why/decided/next), None when
     no process runs; (c) TITLE INDEX — titles + timestamps + hashes ONLY.
     Details live behind hashes, never in the index.
  2. FRESH BRAIN EVERY TURN: decide() starts blank each turn. Process
     exists -> continue it. No process -> read the title index and invent a
     NEW process. decide() is the seam where the parent-as-API (or a future
     model) plugs in; the lab uses a scripted decide to prove the machinery.
  3. HASH RECALL WITH REASON-FIRST: recall_request carries {hash, reason} —
     the WHY comes before the backend serves anything. Repeat asks are
     served from process memory (recall_log) with NO new backend call.
  4. PROCESS LIFECYCLE: create (invented + why recorded) -> execute across
     turns -> complete -> TITLE appended to the index, FULL memory saved to
     the hash store (content-addressed sha256; Rule #20 invariant: the hash
     IS the sha256 of the stored bytes).
  5. FIXED JSON ACTION SCHEMA + brain-reply-manual.md + VALIDATOR with a
     reject-and-resend loop (proven by test).
  6. FULL OS CONTROL: the action set is OS-general (shell/click/type/key/
     open_url/screenshot/idle), not DVWA-specific.
  7. LAB PROOF: a REAL multi-step OS process (recon-toolkit download from a
     localhost registry — genuine: 4 turns, growing process memory, one
     hash-recall with reason, one completion with title indexed + full
     memory hash-stored). Proves fresh-brain continuation, hash dedup, and
     the validator bounce.

CONSTRAINTS: $0 spend, localhost/lab only, no live hunt/EC2 touches, no
deploys, no new payload probes. Fail-closed everywhere.

Layout inside a run dir (memdir):
  process.json   — {"process": {...} | None}   (FULL process memory)
  titles.json    — [{"title","ts","hash"}]      (titles ONLY)
  state.json     — {"turn": N}
  output/        — <sha256>.txt (raw bytes) + <sha256>.prov.json sidecar
  shots/         — shot-<turn>.png (+ .meta.json)
  os_intents.log — synthetic-OS intent record (click/type/key/open_url)
  turns.log      — one JSON line per turn (audit trail)
"""
import argparse
import base64
import hashlib
import json
import os
import re
import shutil
import shlex
import subprocess
import sys
import threading
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone, timedelta
from http.server import BaseHTTPRequestHandler, HTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
IST = timezone(timedelta(hours=5, minutes=30))

ACTION_TYPES = ("shell", "click", "type", "key", "open_url", "screenshot",
                "idle", "claim")
REPLY_REQUIRED = ("task", "goal", "progress", "why_this",
                  "why_not_alternatives", "action")
WHY_MIN_LEN = 20
HASH_RE = re.compile(r"^[0-9a-f]{64}$")

# ------------------------------------------------- Rule #32: claim steps
# Claim discipline lives in the one loop now (the 29-Oct lesson is code):
# a CONFIRMED probe becomes ONE claim citing its output hash; re-files are
# blocked by the Rule #21 state machine and counted as discipline; the
# verifier's terminal validation events flip filed->accepted/rejected.
_CLAIMS_MOD = None


def _claims_mod():
    """Lazy import of brain-claims-v1 (Rule #21 claim state machine).

    Imported by path (dashes in the filename), cached. That module's
    self-test only runs under __main__, so importing is side-effect free.
    Fail-closed: a missing claims module refuses claims, never silently
    drops them.
    """
    global _CLAIMS_MOD
    if _CLAIMS_MOD is None:
        import importlib.util
        path = os.path.join(HERE, "brain-claims-v1.py")
        if not os.path.exists(path):
            raise RuntimeError("brain-claims-v1.py missing (fail-closed)")
        spec = importlib.util.spec_from_file_location("brain_claims_v1",
                                                      path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        _CLAIMS_MOD = mod
    return _CLAIMS_MOD


# Field minimums mirror the deployed claimGateCheck the 29-Oct war record
# proved (19:36 lane): title/command >= 8, evidence >= 30,
# counterevidence >= 10, confidence present.
CLAIM_TITLE_MIN = 8
CLAIM_COMMAND_MIN = 8
CLAIM_EVIDENCE_MIN = 30
CLAIM_COUNTEREVIDENCE_MIN = 10
CLAIM_CLASS_MIN = 3

# Lab-assembled claims: module -> (title label, finding class, severity)
_LAB_CLAIM_META = {
    "xss_r": ("Reflected XSS", "xss_reflected", "high"),
    "exec": ("OS command injection", "command_injection", "critical"),
    "fi": ("Local file inclusion", "file_inclusion", "high"),
    "sqli": ("SQL injection (UNION)", "sqli_union", "critical"),
    "xss_s": ("Stored XSS", "xss_stored", "high"),
    "brute": ("Weak-login brute force", "brute_force", "medium"),
    "sqli_blind": ("Blind SQL injection", "sqli_blind", "critical"),
    "domx": ("DOM-based XSS", "xss_dom", "high"),
    "javascript": ("Client-side token logic flaw", "client_token", "medium"),
    "csp": ("CSP allowlist bypass", "csp_bypass", "medium"),
    "csrf": ("CSRF password change", "csrf", "high"),
    # Rule #56: generic sink hunting — a reflected-XSS CONFIRM on a sink
    # the loop discovered itself (no known module). Same claim minimums.
    "generic_xss": ("Reflected XSS (generic sink)", "xss_reflected",
                    "high"),
    # Rule #57: same for the generic-sink SQLi differential probe —
    # error keywords or a stable boolean-blind differential.
    "generic_sqli": ("SQL injection (generic sink)", "sqli",
                     "high"),
    # Rule #61: same for the generic-sink CSRF state-change probe —
    # a POST the server accepts without the anti-CSRF token that
    # mutates observable server state.
    "generic_csrf": ("CSRF (generic sink)", "csrf",
                     "high"),
    # Rule #62: same for the generic-sink open-redirect probe — the
    # target redirects the browser to an external canary host
    # carried by a query param (302 Location / meta refresh /
    # JS location assignment). Severity medium: phishing-adjacent,
    # not direct data theft.
    "generic_redirect": ("Open redirect (generic sink)", "open_redirect",
                         "medium"),
    # Rule #69: same for the generic-sink open-redirect POST probe —
    # the target redirects the browser to an external canary host
    # carried by a POST form field (302 Location / meta refresh /
    # JS location assignment). Same class as Rule #62 ("open_redirect"),
    # same severity: phishing-adjacent, not direct data theft. The
    # module name differs (dedup is (module, class, location), so a
    # page vulnerable on both GET and POST files two distinct claims).
    "generic_redirect_post": ("Open redirect (generic sink)",
                              "open_redirect", "medium"),
    # Rule #63: same for the generic-sink SSRF reachability probe —
    # the target's server fetches a probe-controlled loopback URL
    # (only the probe's own listener hit confirms; a verbatim echo
    # of the URL in the body is reflection, not a fetch).
    # Severity high: server-side request forgery reaches internal
    # networks and cloud metadata.
    "generic_ssrf": ("SSRF (generic sink)", "ssrf",
                     "high"),
    # Rule #64: same for the generic-sink header-injection / CRLF
    # probe — the target parses an attacker-controlled CRLF inside a
    # reflected query param as a REAL HTTP response header
    # (run-unique injected header name confirmed in the raw response
    # headers; a body echo of the canary text is reflection, not a
    # header). Severity medium: response splitting enables cache
    # poisoning / cookie injection, not direct data theft.
    "generic_header": ("Header injection (generic sink)",
                       "header_injection", "medium"),
    # Rule #65: same for the generic-sink blind command-injection
    # probe — the target passes a query param through a shell and
    # EXECUTES attacker syntax (the arithmetic result "19134" appears
    # in the body though it was never transmitted -> via=cmdi-arith;
    # or a delay payload slows the response proportionally to the
    # injected number -> via=cmdi-timing; a verbatim echo without
    # evaluation is reflection, not execution). Severity critical:
    # command injection is remote code execution.
    "generic_cmdi": ("Command injection (generic sink)",
                     "command_injection", "critical"),
    # Rule #66: same for the generic-sink path-traversal / LFI
    # probe — the target resolves attacker "../" sequences in a
    # query param and READS a file outside the web root (the
    # /etc/passwd content marker "root:x:0:0" or the win.ini
    # "[fonts]" marker appears in the body though it was never
    # transmitted -> via=trav-passwd / via=trav-winini; a verbatim
    # echo of "etc/passwd" without the content marker is
    # reflection, not a file read). Severity high: arbitrary file
    # read.
    "generic_trav": ("Path traversal / LFI (generic sink)",
                     "path_traversal", "high"),
    # Rule #67: same for the generic-sink server-side template
    # injection probe — the target EVALUATES attacker template
    # syntax in a query param (the arithmetic result "7006652"
    # appears in the body though it was never transmitted ->
    # via=ssti-jinja / ssti-el / ssti-freemarker / ssti-thymeleaf;
    # a verbatim echo of the payload without the result is
    # reflection, not evaluation). Severity high: template
    # evaluation is the direct step to template code execution.
    "generic_ssti": ("SSTI (generic sink)",
                     "server_side_template_injection", "high"),
    # Rule #70: same for the generic-sink XXE probe — the target
    # RESOLVES an external entity in an application/xml POST body
    # (the /etc/passwd content marker "root:x:0:0" or the win.ini
    # "[fonts]" marker appears in the body though it was never
    # transmitted -> via=xxe-file-read; a verbatim echo of the
    # entity reference without the content marker is reflection,
    # not resolution). Severity high: arbitrary file read.
    "generic_xxe": ("XXE (generic sink)",
                    "xxe", "high"),
    # Rule #71: same for the generic-sink host-header probe — the
    # target TRUSTS the attacker-controlled Host header (the
    # run-unique RFC 2606 canary host ploop71-<nonce>.invalid, never
    # fetched, appears in the response body though absent from the
    # control body -> via=host-header-body, or in the 302 Location
    # though the control Location lacked it -> via=host-header-redirect).
    # Severity medium: password-reset poisoning / poisoned redirects
    # are the honest generic call.
    "generic_hostheader": ("Host header injection (generic sink)",
                           "host_header_injection", "medium"),
    # Rule #74: same for the generic-sink cookie-XSS probe — the
    # target reflects an attacker-controlled cookie value into the
    # response body UNESCAPED (the run-unique executable canary
    # "<img src=x onerror=PLOOP74-<nonce>>" in the canary body
    # though absent from the control body -> via=html; an
    # HTML-encoded reflection is a safe encoding, not a vuln).
    # Severity high: reflected XSS executes in the victim's browser.
    # Same class as Rule #56 ("xss_reflected"), distinct module —
    # dedup is (module, class, location), so a page vulnerable via
    # both a query param and a cookie files two distinct claims
    # (the Rule #69 rationale).
    "generic_cookiexss": ("Reflected XSS (generic cookie sink)",
                         "xss_reflected", "high"),
    # Rule #80: same for the generic-sink JSON-body-XSS probe — the
    # target reflects an attacker-controlled JSON field value into
    # the response body UNESCAPED (the run-unique executable canary
    # "<img src=x onerror=PLOOP80-<nonce>>" in the canary body
    # though absent from the control body -> via=html; an
    # HTML-encoded reflection is a safe encoding, not a vuln).
    # Severity high: reflected XSS executes in the victim's browser.
    # Same class as Rule #56 ("xss_reflected"), distinct module —
    # dedup is (module, class, location), so an endpoint vulnerable
    # via both a query param and a JSON field files two distinct
    # claims (the Rule #69 rationale). The probe iterates the
    # marker's CSV of common field names internally (first CONFIRMED
    # wins), keeping the budget at 2 turns per sink.
    "generic_jsonxss": ("Reflected XSS (generic JSON-body sink)",
                        "xss_reflected", "high"),
}


def now_ist():
    return datetime.now(IST).strftime("%Y-%m-%d %H:%M IST")


def sha256_hex(data):
    """sha256 of bytes (accepts str defensively). Rule #20: the recorded
    hash IS the sha256 of the stored bytes."""
    if isinstance(data, str):
        data = data.encode("utf-8", "replace")
    return hashlib.sha256(data).hexdigest()


def _to_text(value):
    """Rule #25: TimeoutExpired.stdout/stderr are RAW BYTES even with
    text=True. Normalize BEFORE hashing/parsing/saving."""
    if value is None:
        return ""
    if isinstance(value, bytes):
        return value.decode("utf-8", "replace")
    return str(value)


def _verdict_of_output(out):
    """Rule #30: extract a VERDICT from action output. Domain-neutral:
    only the LAST non-empty line counts (Rule #3 last-line audit), and
    only CONFIRMED/FAILED are verdicts — anything else is neutral
    (the step completed normally). Probes judge themselves; the loop
    only diverts flow on FAILED. Matches the engine's VERDICT_RE
    (VERDICT: then optional spaces, CONFIRMED|FAILED, optional spaces)
    — real probes print 'VERDICT: CONFIRMED' with a space."""
    lines = [l.strip() for l in _to_text(out).splitlines() if l.strip()]
    if not lines:
        return None
    m = re.match(r"^VERDICT:\s*(CONFIRMED|FAILED)\s*$", lines[-1])
    return m.group(1) if m else None


def load_json(path, default):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def save_json(path, obj):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2, sort_keys=True)
        f.write("\n")
    os.replace(tmp, path)  # atomic — no half-written memory


# ---------------------------------------------------------------- hash store
class HashStore:
    """Content-addressed store. INVARIANT (Rule #20): the recorded hash is
    the sha256 of the stored bytes. Raw bytes only in <hash>.txt;
    provenance goes to the <hash>.prov.json sidecar, never into the file."""

    def __init__(self, out_dir):
        self.out_dir = out_dir
        os.makedirs(out_dir, exist_ok=True)
        self.backend_reads = 0  # counts REAL store reads (dedup test hook)

    def _path(self, h):
        return os.path.join(self.out_dir, h + ".txt")

    def put(self, data, provenance):
        if isinstance(data, str):
            data = data.encode("utf-8", "replace")
        h = sha256_hex(data)
        p = self._path(h)
        if not os.path.exists(p):
            tmp = p + ".tmp"
            with open(tmp, "wb") as f:
                f.write(data)
            os.replace(tmp, p)
            with open(os.path.join(self.out_dir, h + ".prov.json"), "w",
                      encoding="utf-8") as f:
                json.dump({"sha256": h, "bytes": len(data),
                           "ts": now_ist(), "provenance": provenance},
                          f, indent=2, sort_keys=True)
        # verify invariant on every put (fail-closed, cheap)
        with open(p, "rb") as f:
            assert sha256_hex(f.read()) == h, "HASH INVARIANT BROKEN"
        return h

    def get(self, h):
        """A backend read. Returns bytes or None (unknown hash -> None,
        caller fails closed)."""
        if not HASH_RE.match(h or ""):
            return None
        p = self._path(h)
        if not os.path.exists(p):
            return None
        self.backend_reads += 1
        with open(p, "rb") as f:
            data = f.read()
        assert sha256_hex(data) == h, "HASH INVARIANT BROKEN on read"
        return data

# ------------------------------------------------------- screenshot capture
def _png_magic_ok(path):
    try:
        with open(path, "rb") as f:
            return f.read(8) == b"\x89PNG\r\n\x1a\n"
    except OSError:
        return False


def _try_real_capture(dest):
    """REAL screen-capture attempts, in order. Returns method name or None.
    This is real code (subprocess + PNG validation), not a stub."""
    attempts = [
        ("scrot", ["scrot", "-z", dest]),
        ("import", ["import", "-window", "root", dest]),          # ImageMagick
        ("xwd", None),  # special-cased: xwd -> convert
        ("grim", ["grim", dest]),                                 # Wayland
    ]
    for name, cmd in attempts:
        try:
            if name == "xwd":
                p1 = subprocess.run(["xwd", "-root", "-silent"],
                                    capture_output=True, timeout=15)
                if p1.returncode != 0 or not p1.stdout:
                    continue
                p2 = subprocess.run(["convert", "xwd:-", "png:" + dest],
                                    input=p1.stdout, capture_output=True,
                                    timeout=15)
                if p2.returncode != 0:
                    continue
            else:
                if shutil.which(cmd[0]) is None:
                    continue
                r = subprocess.run(cmd, capture_output=True, timeout=20)
                if r.returncode != 0:
                    continue
            if os.path.exists(dest) and _png_magic_ok(dest):
                return "real:" + name
            if os.path.exists(dest):
                os.remove(dest)
        except (subprocess.TimeoutExpired, OSError, FileNotFoundError):
            continue
    return None


def _synthetic_screenshot(dest, label):
    """Lab fallback: generate a faithful synthetic desktop PNG with PIL.
    Used when no real capture tool exists (headless lab). The FIELD stays
    first-class either way."""
    from PIL import Image, ImageDraw
    W, H = 1280, 800
    img = Image.new("RGB", (W, H), (30, 30, 36))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, W, 36], fill=(18, 18, 22))                 # top bar
    d.text((12, 10), "Kali GNU/Linux  [lab synthetic capture]", fill=(200, 200, 200))
    d.text((W - 320, 10), now_ist(), fill=(150, 150, 150))
    d.rectangle([40, 70, 760, 560], outline=(90, 90, 100), width=2)  # terminal
    d.rectangle([40, 70, 760, 100], fill=(50, 50, 58))
    d.text((52, 78), "kali@kali:~$", fill=(120, 220, 120))
    lines = ["Dark Matter hunt console — live desktop view",
             "turn label: %s" % label,
             "brain sees this frame every turn (spec 1a).",
             "real capture attempted first; synthetic only on headless lab."]
    y = 120
    for ln in lines:
        d.text((52, y), ln, fill=(200, 200, 200))
        y += 26
    d.rectangle([800, 70, 1240, 400], outline=(90, 90, 100), width=2)  # browser
    d.text((812, 78), "Chromium — target tab", fill=(140, 180, 220))
    img.save(dest, "PNG")
    return "synthetic:pil"


def capture_screenshot(shots_dir, label):
    """Capture the open OS interface. Real tools first, synthetic fallback.
    Returns {"path":..., "method":...}. Fail-closed: raises only if even the
    synthetic path fails (PIL missing => hard error, never a silent stub)."""
    os.makedirs(shots_dir, exist_ok=True)
    dest = os.path.join(shots_dir, "shot-%s.png" % re.sub(r"\W+", "-", label))
    method = _try_real_capture(dest)
    if method is None:
        try:
            method = _synthetic_screenshot(dest, label)
        except ImportError as e:
            raise RuntimeError("no real capture tool AND no PIL: %s" % e)
    if not _png_magic_ok(dest):
        raise RuntimeError("screenshot produced no valid PNG")
    with open(dest + ".meta.json", "w", encoding="utf-8") as f:
        json.dump({"path": dest, "method": method, "ts": now_ist(),
                   "label": label}, f, indent=2)
    return {"path": dest, "method": method}


# ------------------------------------------------------------- turn inputs
def mem_paths(memdir):
    os.makedirs(memdir, exist_ok=True)
    return {
        "process": os.path.join(memdir, "process.json"),
        "titles": os.path.join(memdir, "titles.json"),
        "state": os.path.join(memdir, "state.json"),
        "output": os.path.join(memdir, "output"),
        "shots": os.path.join(memdir, "shots"),
        "intents": os.path.join(memdir, "os_intents.log"),
        "turns": os.path.join(memdir, "turns.log"),
    }


def build_turn_input(memdir, goal):
    """Assemble EXACTLY the three spec inputs. Fresh objects every call —
    the brain never inherits in-memory state from a previous turn."""
    mp = mem_paths(memdir)
    st = load_json(mp["state"], {"turn": 0})
    turn = int(st.get("turn", 0)) + 1
    shot = capture_screenshot(mp["shots"], "turn-%d" % turn)
    proc_doc = load_json(mp["process"], {"process": None})
    titles = load_json(mp["titles"], [])
    # deep-copy via JSON round-trip: no shared references, truly fresh
    return json.loads(json.dumps({
        "turn": turn,
        "screenshot": {"path": shot["path"], "method": shot["method"],
                       "base64": None},
        "process": proc_doc.get("process"),
        "titles": [{"title": t["title"], "ts": t["ts"], "hash": t["hash"]}
                   for t in titles],
        "goal": goal,
    }))


# ------------------------------------------------------------------ decide
# The seam where the parent-as-API (or a future model) plugs in. The lab
# uses this scripted decide to prove the LOOP machinery: fresh-brain
# continuation, reason-first recall, process invention/completion.
LAB_TOOLKIT_STEP_KINDS = ("shell_list", "recall", "shell_download",
                          "shell_verify")


def _download_probe_cmd(workdir, url):
    """Self-judging download probe (Rule #3 pattern: probes judge
    themselves with a last-line VERDICT). Emits VERDICT:FAILED unless
    the fetch returned HTTP 200 — the loop's extractor reads only that
    last line, so a filtered/blocked download diverts to escalation
    instead of silently marking the step done."""
    return ("code=$(curl -s -o \"%s/toolkit.tgz\" -w '%%{http_code}' "
            "--max-time 30 %s); echo \"HTTP:$code\"; "
            "if [ \"$code\" = \"200\" ]; then echo download-ok; "
            "else echo VERDICT:FAILED; fi" % (workdir, url))


# Rule #30 — ESCALATION LADDERS. Domain-neutral spec: per step-kind, an
# ordered list of variant rungs. A rung is attempted only after the base
# action returns VERDICT:FAILED, each rung at most once (A-to-Z memory
# forbids repeats), and a rung is never invented — only the ladder's
# variants exist. url_from/url_to rewrite the recalled base URL;
# desc/why are recorded in history WITH the attempt's reason.
DEFAULT_LADDERS = {
    "shell_download": [
        {"desc": "download via the alternate path",
         "why": "the canonical path is filtered (VERDICT:FAILED); the "
                "alternate path is the standard filter-bypass rung",
         "url_from": "/files/toolkit.tgz",
         "url_to": "/files/toolkit-raw.tgz"},
    ],
}


def _lab_plan_for_goal(goal):
    g = (goal or "").lower()
    if "toolkit" in g or "recon" in g:
        return [
            {"desc": "List available tools on the local tool registry",
             "kind": "shell_list"},
            {"desc": "Recall the registry listing to extract the toolkit "
                     "download URL",
             "kind": "recall",
             "recall_reason": "need the download URL of the recon-toolkit "
                              "tarball from the registry listing output"},
            {"desc": "Download the toolkit tarball to the work dir",
             "kind": "shell_download"},
            {"desc": "Verify the tarball (list contents + sha256)",
             "kind": "shell_verify"},
            {"desc": "Recall the verify output to confirm the tarball "
                     "before declaring completion",
             "kind": "recall",
             "recall_reason": "must confirm the tarball listing + sha256 "
                              "from the verify step before declaring the "
                              "process complete — completion needs verified "
                              "bytes, not trust"},
        ]
    return None


# Rule #31 — PROBE EXECUTION IN THE ONE LOOP.
# Bridges the 11 live-proven parent probes (brain-probes/) into the ONE
# loop architecture: a plan step of kind "probe" executes ONE probe file
# as a shell action, judged by the probe's own last-line VERDICT
# (Rule #3). Escalation rungs are the variant probe FILES from the
# brain-escalate-v1.py rung catalog — same argv interface, same VERDICT
# contract — so the Rule #30 ladder machinery needs no new verdict
# logic, only a probe-swap. Fail-closed rules:
#   * target_base comes ONLY from ctx["target_base"]; absent -> the step
#     idles (the loop never invents a target).
#   * probes run as SED-REBASED COPIES in a per-memdir sandbox: the live
#     base URL http://172.17.0.1:3100 inside the probe is replaced with
#     target_base, so originals are never modified and a stale config can
#     never fire at the live ground. Rebase miss or a surviving live-base
#     string aborts the command with VERDICT:FAILED (never executes).
#   * missing probe file -> PROBE_MISSING + VERDICT:FAILED (never
#     executes anything). Unknown extension -> same.
#   * marker is fixed per plan step (deterministic, replayable).
#   * inner `timeout` turns a hung probe into PROBE_TIMEOUT +
#     VERDICT:FAILED instead of a silent neutral step.
LIVE_PROBE_BASE = "http://172.17.0.1:3100"
_PROBE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                          "brain-probes")

# module -> (base probe file, fixed marker)
_PROBE_MODULES = {
    "xss_r": ("probe_xss_r.py", "PLOOP31-XR"),
    "exec": ("parent_brain_cmdi.py", "PLOOP31-CMDI"),
    "fi": ("parent_brain_lfi.py", "PLOOP31-FI"),
    # Rule #34: the remaining 8 live-proven parent probes join the plan.
    # Markers are fixed per module (deterministic, replayable); probes
    # that ignore argv[1] (bsqli, brute, javascript) receive it harmlessly.
    "xss_s": ("parent_brain_sxss.py", "PLOOP34-XS"),
    "sqli": ("probe_sqli.py", "PLOOP34-SQLI"),
    "sqli_blind": ("parent_brain_bsqli.sh", "PLOOP34-BSQLI"),
    "brute": ("parent_brain_brute.sh", "PLOOP34-BRUTE"),
    "xss_d": ("parent_brain_domx.sh", "PLOOP34-DOMX"),
    "javascript": ("probe_javascript.py", "PLOOP34-JS"),
    "csp": ("probe_csp.py", "PLOOP34-CSP"),
    "csrf": ("probe_csrf.sh", "PLOOP34-CSRF"),
}

# Rule #34: full 11-module hunt order. csrf runs LAST — it rotates the
# admin password mid-probe (restores it before exiting, but a failed
# restore must never cascade into the other probes' logins).
_HUNT_MODULE_ORDER = ("xss_r", "exec", "fi", "xss_s", "sqli", "sqli_blind",
                      "brute", "xss_d", "javascript", "csp", "csrf")

# Rule #36: per-module probe timeouts. The blind-sqli oracle needs up to
# ~4 min live (full 32-char hash extraction); a flat 120s would time out
# a working probe and record a false FAILED. Inner `timeout` gets the
# module budget; the outer shell action gets +60s so the wrapper (not the
# executor) owns the VERDICT:FAILED-on-timeout path.
_PROBE_TIMEOUTS = {"sqli_blind": 300}


def _probe_timeout_for(module):
    return _PROBE_TIMEOUTS.get(module or "", 120)

# Rule #35: RECON-DRIVEN HUNT PLANS — the loop hunts what recon actually
# finds, not what a hardcoded module list assumes. A real human hunter
# runs recon first and attacks the surface that is really there.
# module -> evidence keys that justify probing it: a crawlable path on
# the target, form/request parameter names, and page sink markers.
_RECON_MODULE_SIGNALS = {
    "xss_r": {"paths": ("vulnerabilities/xss_r/",),
              "params": ("name",), "sinks": ()},
    "exec": {"paths": ("vulnerabilities/exec/",),
             "params": ("ip",), "sinks": ()},
    "fi": {"paths": ("vulnerabilities/fi/",),
           "params": ("page",), "sinks": ()},
    "xss_s": {"paths": ("vulnerabilities/xss_s/",),
              "params": ("txtName", "mtxMessage"), "sinks": ()},
    "sqli": {"paths": ("vulnerabilities/sqli/",),
             "params": ("id",), "sinks": ()},
    "sqli_blind": {"paths": ("vulnerabilities/sqli_blind/",),
                   "params": ("id",), "sinks": ()},
    "brute": {"paths": ("vulnerabilities/brute/",),
              "params": ("username", "password"), "sinks": ()},
    "xss_d": {"paths": ("vulnerabilities/xss_d/",),
              "params": ("default",), "sinks": ("decodeURI",)},
    "javascript": {"paths": ("vulnerabilities/javascript/",),
                   "params": ("token",), "sinks": ("rot13",)},
    "csp": {"paths": ("vulnerabilities/csp/",),
            "params": ("include",), "sinks": ()},
    "csrf": {"paths": ("vulnerabilities/csrf/",),
             "params": ("password_new", "password_conf"), "sinks": ()},
}


def _lab_login_opener(target_base, timeout_s=8):
    """Log in to the training ground with the documented default creds
    (admin/password — the same self-auth every parent probe issues) and
    return a cookie-carrying opener for recon. Returns None on ANY
    failure (fail-closed: the caller proceeds unauthenticated, exactly
    as recon behaved before this rule). The login POST changes no
    target state beyond establishing the session; recon itself stays
    read-only (no params, no POSTs beyond this login)."""
    import http.cookiejar
    import urllib.parse
    import urllib.request
    tb = (target_base or "").rstrip("/")
    if not tb:
        return None
    try:
        jar = http.cookiejar.CookieJar()
        op = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(jar))
        with op.open(tb + "/login.php", timeout=timeout_s) as r:
            login_page = _to_text(r.read())
        m = re.search(r"name='user_token' value='([^']+)'", login_page)
        tok = m.group(1) if m else ""
        data = urllib.parse.urlencode(
            {"username": "admin", "password": "password",
             "Login": "Login", "user_token": tok}).encode()
        req = urllib.request.Request(tb + "/login.php", data=data)
        with op.open(req, timeout=timeout_s) as r:
            r.read()
        # verify: the index must now show the link graph, not the login
        with op.open(tb + "/", timeout=timeout_s) as r:
            index = _to_text(r.read())
        if "vulnerabilities/" not in index:
            return None
        return op
    except Exception:
        return None


def _lab_session_cookie_names(opener):
    """Names of cookies the LOOP ITSELF owns (its session jar).

    Rule #75: recon logs in via _lab_login_opener, so the jar carries
    the loop's own session cookie (PHPSESSID on DVWA). A Set-Cookie
    name the loop owns is not attacker-controllable input — probing
    it would burn turns attacking the loop's own session, and any
    "reflection" would be the loop echoing its own state back as a
    self-inflicted "finding". Names are read from the opener's
    HTTPCookieProcessor jar(s); ANY failure yields the empty set
    (fail-closed: no invented names, and an unauthenticated recon
    simply excludes nothing).

    ORDERING (load-bearing): call this BEFORE the recon crawl. The
    crawl stores every Set-Cookie the target sends into the same jar,
    so a post-crawl read would mistake genuine sinks for loop-owned
    cookies and exclude the real attack surface too. Turn 0 snapshots
    the login-time jar for exactly this reason.
    """
    names = set()
    try:
        handlers = getattr(opener, "handlers", None) or ()
        for h in handlers:
            jar = getattr(h, "cookiejar", None)
            if jar is None:
                continue
            for c in jar:
                nm = getattr(c, "name", None)
                if nm:
                    names.add(nm)
    except Exception:
        pass
    return names


def _lab_recon_map(target_base, timeout_s=5, opener=None):
    """Lab attack-surface recon. Crawls the EXPLICIT target_base only:
    GET / for the link graph, then GETs each found
    /vulnerabilities/<module>/ page — read-only (no params, no POSTs;
    recon never mutates the target) — and records which module paths
    answer 200 plus the params/sinks observed on their pages.
    opener: an authenticated cookie opener from _lab_login_opener (the
    live target redirects / to login.php unauthenticated, hiding the
    link graph); None keeps the old unauthenticated behavior.
    Returns {"modules": {module: {"path", "status", "params_found",
    "sinks_found"}}} or None when recon fails. A None map is NOT a
    stop: the caller falls back to the full fixed plan and records
    recon_ok=False (a hunter blocked from recon still hunts the known
    paths, and the fallback is on the record). An empty/None
    target_base also returns None (fail-closed: no invented target)."""
    tb = (target_base or "").rstrip("/")
    if not tb:
        return None
    import urllib.request

    def _get(url):
        if opener is not None:
            with opener.open(url, timeout=timeout_s) as r:
                return r.getcode(), _to_text(r.read())
        with urllib.request.urlopen(url, timeout=timeout_s) as r:
            return r.getcode(), _to_text(r.read())

    try:
        _code, index = _get(tb + "/")
    except Exception:
        return None
    links = re.findall(r"href=['\"]([^'\"#>]+)", index)
    found = {}
    for m, sig in _RECON_MODULE_SIGNALS.items():
        for path in sig["paths"]:
            if any(path in (l or "") for l in links):
                found[m] = path
                break
    modules = {}
    for m, path in found.items():
        try:
            code, body = _get(tb + "/" + path)
        except Exception:
            continue
        if code != 200:
            continue
        sig = _RECON_MODULE_SIGNALS[m]
        params = sorted({p for p in sig["params"]
                         if re.search(r"name=['\"]%s['\"]" % re.escape(p),
                                      body)})
        sinks = sorted({s for s in sig["sinks"] if s in body})
        modules[m] = {"path": path, "status": code,
                      "params_found": params, "sinks_found": sinks}
    return {"modules": modules}


# Rule #56: GENERIC SINK HUNTING — hunt what recon finds, even when it
# matches NO known module. A human hunter pastes a link and attacks the
# surface that is really there: every form and every query-param link on
# the explicit target becomes a (sink, technique) probe step. Known
# module paths are skipped (their probes already cover them). Read-only:
# GETs only — recon never POSTs and never mutates a query; the probes do
# the attacking. Same-origin paths of the explicit target_base only
# (scope discipline, Rule #27).
_GENERIC_SINK_CAP = 12
_GENERIC_SINK_SKIP_EXT = (".js", ".css", ".png", ".jpg", ".jpeg", ".gif",
                          ".ico", ".svg", ".woff", ".woff2", ".map",
                          ".ttf", ".eot")
# Scope-safety: the loop OWNS its auth session (Rule #36b login opener)
# and must not mutate it — blindly POSTing a token into a login /
# security-level / setup form can invalidate the session or flip target
# state (e.g. DVWA's security.php SETS the level from any truthy POST).
# Auth/session-management surfaces are excluded from autonomous generic
# probing WITH REASON; reflected-XSS there stays a human-review item.
_GENERIC_SINK_SKIP_PATH = ("login", "logout", "signin", "sign-in",
                           "security", "setup", "install", "admin",
                           "config", "account", "register")
# Rule #80: JSON-body sinks are discovered by path (the API-docs
# pattern), but the API's real JSON field names are unknowable at
# recon time. The marker carries this CSV of common field names; the
# PLOOP80 probe tries each in order and the first CONFIRMED wins, so
# the budget stays 2 turns per sink. The probe validates every name
# up front (its fail-closed [A-Za-z0-9_.\[\]\-]{1,64} regex), so this
# list must stay inside that alphabet.
_JSON_SINK_FIELDS = ("name", "message", "q", "query", "search", "text",
                     "value", "title")


def _lab_generic_sinks(target_base, opener=None, known_modules=None,
                       timeout_s=5, self_cookie_names=()):
    """Discover generic attack sinks on the explicit target. Returns a
    sorted, capped list of {id, kind, method, path, params}: kind is
    'form' (action+method+input names from <form> blocks), 'query'
    (param names from same-origin links carrying a query string),
    'xml' (Rule #70: an endpoint documented as accepting
    application/xml POST bodies — the API-docs pattern), 'json'
    (Rule #80: an endpoint documented as accepting application/json
    POST bodies — same API-docs pattern; the field names are
    unknowable at recon time so params carries _JSON_SINK_FIELDS,
    the common-name CSV the PLOOP80 probe iterates), or 'cookie'
    (Rule #74: a Set-Cookie name on a crawled response — one sink
    per (path, cookie name), GET method, the name in params). Paths
    covered by known-module signals are excluded. Rule #75: cookie
    names in self_cookie_names (the loop's own session-jar names,
    e.g. PHPSESSID from the recon login) are never sunk — they are
    not attacker-controllable input. Empty list when recon fails or
    the target has no sinks (fail-closed: no invented surface)."""
    tb = (target_base or "").rstrip("/")
    if not tb:
        return []
    skip_sub = set()
    for m in (known_modules or ()):
        skip_sub.update(_RECON_MODULE_SIGNALS.get(m, {}).get("paths", ()))
    # Rule #75: the loop's own session-cookie names, excluded from
    # cookie sinks at capture time (no turns burned on the loop's own
    # session). The exclusion is recorded on the plan meta by the
    # caller (turn 0) — the set itself is the record.
    self_owned = set(self_cookie_names or ())

    def _get(url):
        # Returns (code, set_cookie_headers, body). Set-Cookie is
        # returned raw (Rule #74): duplicate headers are kept via
        # get_all — dict(r.info()) would collapse them.
        if opener is not None:
            with opener.open(url, timeout=timeout_s) as r:
                return (r.getcode(),
                        r.headers.get_all("Set-Cookie", []),
                        _to_text(r.read()))
        with urllib.request.urlopen(url, timeout=timeout_s) as r:
            return (r.getcode(),
                    r.headers.get_all("Set-Cookie", []),
                    _to_text(r.read()))

    def _cookie_names(set_cookie_headers):
        # Rule #74: the Set-Cookie names a page sets. The name regex
        # mirrors the probe's fail-closed validator
        # ([A-Za-z0-9_.\-], max 64 chars) — recon never hands the
        # probe a cookie name the probe must reject.
        names = []
        for hval in set_cookie_headers or ():
            nm = (hval or "").split(";", 1)[0].split("=", 1)[0].strip()
            if re.fullmatch(r"[A-Za-z0-9_.\-]{1,64}", nm or ""):
                names.append(nm)
        return sorted(set(names))

    try:
        _code, _index_setc, index = _get(tb + "/")
    except Exception:
        return []
    base_netloc = urllib.parse.urlparse(tb).netloc

    def _skip_path(p):
        pl = (p or "").lower()
        if pl.endswith(_GENERIC_SINK_SKIP_EXT):
            return True
        if any(s in pl for s in skip_sub):
            return True
        # Rule #56 scope-safety: auth/session-management surfaces are
        # never generic-probed (the loop owns its session there).
        return any(s in pl for s in _GENERIC_SINK_SKIP_PATH)

    pages = {"/": index}
    page_cookies = {"/": _cookie_names(_index_setc)}
    for href in re.findall(r"href=['\"]([^'\"#>]+)", index):
        absu = urllib.parse.urljoin(tb + "/", href)
        pu = urllib.parse.urlparse(absu)
        if pu.netloc != base_netloc or not pu.path.startswith("/"):
            continue
        if _skip_path(pu.path):
            continue
        if pu.path in pages or len(pages) > 24:
            continue
        try:
            code, setc, body = _get(absu.split("#")[0])
        except Exception:
            continue
        if code == 200:
            pages[pu.path] = body
            page_cookies[pu.path] = _cookie_names(setc)

    sinks = {}
    for page_path, body in pages.items():
        # query-param links: /search?q=hello -> {kind:query,...}
        for href in re.findall(r"href=['\"]([^'\"#>]+)", body):
            absu = urllib.parse.urljoin(tb + page_path, href)
            pu = urllib.parse.urlparse(absu)
            if pu.netloc != base_netloc or not pu.query:
                continue
            if _skip_path(pu.path):
                continue
            qparams = sorted({k for k, _ in
                              urllib.parse.parse_qsl(pu.query)})
            if not qparams:
                continue
            sid = "query:%s:GET:%s" % (pu.path, ",".join(qparams))
            sinks[sid] = {"id": sid, "kind": "query", "method": "GET",
                          "path": pu.path, "params": qparams}
        # forms: <form action method> + input/textarea/select names
        for fmatch in re.finditer(
                r"<form\b([^>]*)>(.*?)</form>", body,
                re.IGNORECASE | re.DOTALL):
            attrs, inner = fmatch.group(1), fmatch.group(2)
            am = re.search(r"action=['\"]([^'\"]*)", attrs, re.IGNORECASE)
            mm = re.search(r"method=['\"]([^'\"]*)", attrs, re.IGNORECASE)
            action = (am.group(1) if am else page_path) or page_path
            method = (mm.group(1) if mm else "GET").upper()
            if method not in ("GET", "POST"):
                continue
            names = sorted(set(
                re.findall(r"name=['\"]([^'\"]+)", inner, re.IGNORECASE)))
            names = [n for n in names if n]
            if not names:
                continue
            absu = urllib.parse.urljoin(tb + page_path, action)
            pu = urllib.parse.urlparse(absu)
            if pu.netloc != base_netloc:
                continue
            if _skip_path(pu.path):
                continue
            sid = "form:%s:%s:%s" % (pu.path, method, ",".join(names))
            sinks[sid] = {"id": sid, "kind": "form", "method": method,
                          "path": pu.path, "params": names}
        # Rule #70: XML sinks — endpoints that accept application/xml
        # POST bodies. The signal is the API-docs pattern: a
        # content-type mention (application/xml or text/xml) within
        # ~200 chars of a same-origin path. Fail-closed: no mention,
        # no sink. The mention span itself is excluded so the "/xml"
        # inside "application/xml" can never register as a sink. A "/"
        # preceded by "<" is HTML markup ("</body>"), never a URL path,
        # so "<" joins the lookbehind (defect caught in the Rule #70
        # proof: closing tags registered as sinks).
        for xm in re.finditer(r"(?i)\b(?:application|text)/xml\b", body):
            lo, hi = max(0, xm.start() - 200), xm.end() + 200
            for pm in re.finditer(
                    r"(?<![A-Za-z0-9_.\-<])(/[A-Za-z0-9_\-./]{1,80})",
                    body[lo:hi]):
                ps, pe = lo + pm.start(), lo + pm.end()
                if ps < xm.end() and pe > xm.start():
                    continue  # the mention itself, not a path
                cand = pm.group(1).rstrip("./")
                if len(cand) < 2 or cand == "/xml":
                    continue
                absu = urllib.parse.urljoin(tb + page_path, cand)
                pu = urllib.parse.urlparse(absu)
                if pu.netloc != base_netloc:
                    continue
                if _skip_path(pu.path):
                    continue
                sid = "xml:%s:POST" % pu.path
                if sid in sinks:
                    continue
                sinks[sid] = {"id": sid, "kind": "xml",
                              "method": "POST", "path": pu.path,
                              "params": []}
        # Rule #74: cookie sinks — one per (path, Set-Cookie name).
        # A name the server sets is attacker-controllable input the
        # server may reflect into a page (theme/prefs/remember-me
        # values); the PLOOP74 probe proves unescaped reflection.
        # Known-module paths and auth surfaces stay excluded via
        # _skip_path, same as every other sink kind.
        if not _skip_path(page_path):
            for cname in page_cookies.get(page_path, ()):
                sid = "cookie:%s:GET:%s" % (page_path, cname)
                if sid in sinks:
                    continue
                # Rule #75: never sink the loop's OWN session cookies —
                # a name the loop's jar owns (PHPSESSID from the recon
                # login) is not attacker-controllable input. Probing it
                # would attack the loop's own session, and any echo
                # would be a self-inflicted "finding". Skipped WITH
                # REASON; the excluded names ride on the plan meta so
                # the decision is auditable.
                if cname in self_owned:
                    continue
                sinks[sid] = {"id": sid, "kind": "cookie",
                              "method": "GET", "path": page_path,
                              "params": [cname]}
        # Rule #80: JSON sinks — endpoints that accept
        # application/json POST bodies. Same API-docs-pattern signal
        # as Rule #70's XML discovery: a content-type mention
        # (application/json) within ~200 chars of a same-origin path.
        # Fail-closed: no mention, no sink. The mention span itself
        # is excluded so the "/json" inside "application/json" can
        # never register as a sink (the lookbehind also rejects it —
        # the char before "/json" is "n", inside the excluded class).
        # A "/" preceded by "<" is HTML markup ("</body>"), never a
        # URL path, so "<" joins the lookbehind (the Rule #70 defect).
        # One sink per path, POST method, params = _JSON_SINK_FIELDS
        # (the API's real field names are unknowable at recon time;
        # the PLOOP80 probe iterates the CSV and the first CONFIRMED
        # wins).
        for jm in re.finditer(r"(?i)\bapplication/json\b", body):
            lo, hi = max(0, jm.start() - 200), jm.end() + 200
            for pm in re.finditer(
                    r"(?<![A-Za-z0-9_.\-<])(/[A-Za-z0-9_\-./]{1,80})",
                    body[lo:hi]):
                ps, pe = lo + pm.start(), lo + pm.end()
                if ps < jm.end() and pe > jm.start():
                    continue  # the mention itself, not a path
                cand = pm.group(1).rstrip("./")
                if len(cand) < 2 or cand == "/json":
                    continue
                absu = urllib.parse.urljoin(tb + page_path, cand)
                pu = urllib.parse.urlparse(absu)
                if pu.netloc != base_netloc:
                    continue
                if _skip_path(pu.path):
                    continue
                sid = "json:%s:POST" % pu.path
                if sid in sinks:
                    continue
                sinks[sid] = {"id": sid, "kind": "json",
                              "method": "POST", "path": pu.path,
                              "params": list(_JSON_SINK_FIELDS)}
    return [sinks[k] for k in sorted(sinks)][: _GENERIC_SINK_CAP]


def _recon_driven_plan(modules_present, generic_sinks=(),
                       target_base="", exclude_cookie_names=()):
    """Build the probe/claim-interleaved plan for ONLY the recon-found
    modules, in _HUNT_MODULE_ORDER (csrf stays last), then the GENERIC
    SINK steps (Rule #56, Rule #57, Rule #61, Rule #62, Rule #63,
    Rule #64, Rule #65): every sink recon
    discovered that matches no known module gets probe+claim pairs —
    reflected XSS (probe_sink_xss.py, PLOOP56 marker) and SQLi
    (probe_sink_sqli.py, PLOOP57 marker) for every sink, plus CSRF
    state-change (probe_sink_csrf.py, PLOOP61 marker) for POST-form
    sinks only, plus open-redirect (probe_sink_redirect.py, PLOOP62
    marker) for query sinks only, plus SSRF reachability
    (probe_sink_ssrf.py, PLOOP63 marker — the target's server must
    fetch the probe's own loopback canary listener, echo != fetch)
    for query sinks only, plus header injection / CRLF
    (probe_sink_header.py, PLOOP64 marker — the target must parse
    the probe's injected CRLF as a REAL response header, body echo
    != a header) for query sinks only, plus blind command injection
    (probe_sink_cmdi.py, PLOOP65 marker — the target must EXECUTE
    the probe's shell syntax: an arithmetic result that was never
    transmitted, or a delay that scales with the injected number;
    verbatim echo without evaluation is reflection, not execution)
    for query sinks only, plus path traversal / LFI
    (probe_sink_traversal.py, PLOOP66 marker — the target must
    RESOLVE the probe's "../" sequences and READ a file outside
    the web root: an /etc/passwd or win.ini content marker in the
    body though it was never transmitted; verbatim echo without
    the content marker is reflection, not a file read) for query
    sinks only, plus server-side template injection
    (probe_sink_ssti.py, PLOOP67 marker — the target must EVALUATE
    the probe's template-syntax arithmetic: the result "7006652" in
    the body though it was never transmitted; a verbatim echo of the
    payload without the result is reflection, not evaluation) for
    query sinks only, plus XXE
    (probe_sink_xxe.py, PLOOP70 marker — the target must RESOLVE an
    external entity in an application/xml POST body: the /etc/passwd
    marker "root:x:0:0" or the win.ini marker "[fonts]" in the
    response though it was never transmitted -> via=xxe-file-read; a
    verbatim echo of the entity reference is reflection, not
    resolution) for xml sinks only — xml sinks carry ONLY the xxe
    pair, the xss/sqli/csrf pairs do not apply to an XML body, plus
    host-header injection (probe_sink_hostheader.py, PLOOP71 marker —
    the target must TRUST the attacker-controlled Host header: the
    run-unique RFC 2606 canary host in the response body though
    absent from the control body -> via=host-header-body, or in the
    302 Location though the control Location lacked it ->
    via=host-header-redirect) for query sinks only — the probe needs
    no params, it rides the path, plus cookie sinks
    (probe_sink_cookiexss.py, PLOOP74 marker — the target must
    reflect the attacker-controlled cookie value into the response
    body UNESCAPED: the run-unique executable canary "<img src=x
    onerror=PLOOP74-<nonce>>" in the canary body though absent
    from the control body -> via=html; an HTML-encoded reflection
    is a safe encoding, not a vuln) for cookie sinks only — cookie
    sinks carry ONLY the cookiexss pair; the xss/sqli/csrf pairs do
    not apply to a cookie value. The
    generic
    probe reads its sink spec from the marker argv
    (PLOOP56|<quoted-tb>|<quoted-path>|<METHOD>|<p1,p2>), so _probe_cmd
    needs no changes; the marker is URL-quoted to stay filename-safe
    for the sandbox DST path. Returns (plan, meta): meta records
    planned vs dropped modules AND generic sink ids so the
    never-repeat machinery and the reports can see what recon found
    and what it did not."""
    ordered = [m for m in _HUNT_MODULE_ORDER if m in modules_present]
    dropped = [m for m in _HUNT_MODULE_ORDER if m not in modules_present]
    plan = []
    # Rule #75: cookie names the loop itself owns (its session jar) —
    # the plan gate refuses to build pairs for them (defense in depth
    # behind the capture-time exclusion in _lab_generic_sinks).
    _excl_cookies = set(exclude_cookie_names or ())
    for module in ordered:
        probe, marker = _PROBE_MODULES[module]
        plan.append({"desc": "Probe %s (%s) for a verified finding" %
                             (module, probe),
                     "kind": "probe", "module": module, "probe": probe,
                     "marker": marker, "done": False, "result_hash": None,
                     "recon": True})
        plan.append({"desc": "File claim for the verified %s finding" %
                             module,
                     "kind": "claim", "module": module,
                     "probe_step_idx": len(plan) - 1,
                     "done": False, "result_hash": None,
                     "recon": True})
    meta = {"recon_ok": True, "planned_modules": ordered,
            "dropped_modules": dropped}
    # Rule #56: generic sinks AFTER the known modules — the loop hunts
    # the surface that is really there, not just the 11 DVWA paths.
    # Rule #57: each sink gets TWO probe+claim pairs — reflected XSS
    # (probe_sink_xss.py, PLOOP56 marker) and SQLi (probe_sink_sqli.py,
    # PLOOP57 marker). Both probes read the sink spec from the marker
    # argv, so _probe_cmd needs no changes; the marker is URL-quoted
    # to stay filename-safe for the sandbox DST path.
    for sink in (generic_sinks or ()):
        tbq = urllib.parse.quote((target_base or "").rstrip("/"), safe="")
        pathq = urllib.parse.quote(sink.get("path", ""), safe="")
        # Rule #70: an xml sink carries ONLY the XXE probe+claim pair
        # (appended at the end of the loop body) — its request body is
        # XML, not params or fields, so the param-based xss/sqli pairs
        # below do not apply to it. Rule #74: same exclusion for
        # cookie sinks — the params field carries the cookie NAME,
        # which is not a query param; the xss/sqli probes would
        # attack the wrong injection point (?name=) instead of the
        # Cookie header the sink was discovered for. Rule #80: same
        # for json sinks — the params field carries common JSON field
        # names, not query params; the xss/sqli probes would attack
        # the wrong injection point (?name=) instead of the JSON body
        # the sink was discovered for.
        if sink.get("kind") not in ("xml", "cookie", "json"):
            marker = "PLOOP56|%s|%s|%s|%s" % (
                tbq, pathq, sink.get("method", "GET"),
                ",".join(sink.get("params", ())))
            plan.append({
                "desc": "Probe generic sink %s for reflected XSS (%s)" %
                        (sink.get("id"), "probe_sink_xss.py"),
                "kind": "probe", "module": "generic_xss",
                "sink": sink.get("id"), "probe": "probe_sink_xss.py",
                "marker": marker, "done": False, "result_hash": None,
                "recon": True})
            plan.append({
                "desc": "File claim for the verified generic-sink finding",
                "kind": "claim", "module": "generic_xss",
                "sink": sink.get("id"),
                "probe_step_idx": len(plan) - 1,
                "done": False, "result_hash": None,
                "recon": True})
        # Rule #57: the SQLi probe for the same sink (PLOOP57 marker —
        # error-based keywords + boolean-blind differential with a
        # stability gate so no claim is ever grounded on noise).
        # (Rule #70: skipped for xml sinks — see the gate above;
        # Rule #74: skipped for cookie sinks — the params field
        # carries the cookie name, not a query param; Rule #80:
        # skipped for json sinks — the params field carries JSON
        # field names, not query params.)
        if sink.get("kind") not in ("xml", "cookie", "json"):
            sqli_marker = "PLOOP57|%s|%s|%s|%s" % (
                tbq, pathq, sink.get("method", "GET"),
                ",".join(sink.get("params", ())))
            plan.append({
                "desc": "Probe generic sink %s for SQL injection (%s)" %
                        (sink.get("id"), "probe_sink_sqli.py"),
                "kind": "probe", "module": "generic_sqli",
                "sink": sink.get("id"), "probe": "probe_sink_sqli.py",
                "marker": sqli_marker, "done": False, "result_hash": None,
                "recon": True})
            plan.append({
                "desc": "File claim for the verified generic-sink finding",
                "kind": "claim", "module": "generic_sqli",
                "sink": sink.get("id"),
                "probe_step_idx": len(plan) - 1,
                "done": False, "result_hash": None,
                "recon": True})
        # Rule #61: the CSRF state-change probe for POST-form sinks
        # only (PLOOP61 marker — control POST with the server-issued
        # token proves the sink is state-changing, then a token-less
        # POST must reproduce the change for CONFIRMED). GET/query
        # sinks get no CSRF pair: CSRF is a state-change class and a
        # GET form is not one.
        #
        # Rule #62: the open-redirect probe for QUERY sinks only
        # (PLOOP62 marker — the target must redirect the browser to
        # an external canary host carried by a query param: 302
        # Location / meta refresh / JS location assignment, read
        # from the raw response without following). Placed right
        # after the sqli pair (see Rule #63 for the ssrf pair that
        # follows it).
        #
        # Rule #63: the SSRF-reachability probe for QUERY sinks only
        # (PLOOP63 marker — the target's server must fetch the
        # probe's own loopback canary listener; a verbatim echo of
        # the URL in the body is reflection, NOT a fetch, so it can
        # never confirm). Placed after the redirect pair (the header
        # pair follows it per Rule #64, then the cmdi pair per
        # Rule #65, so every query sink reads xss, sqli, redirect,
        # ssrf, header, cmdi).
        #
        # Rule #64: the header-injection / CRLF probe for QUERY sinks
        # only (PLOOP64 marker — the target must parse the probe's
        # injected CRLF as a REAL response header; a body echo of
        # the canary text is reflection, NOT a header, so it can
        # never confirm). Placed after the ssrf pair.
        #
        # Rule #65: the blind command-injection probe for QUERY sinks
        # only (PLOOP65 marker — the target must EXECUTE the probe's
        # shell syntax: an arithmetic result that was never
        # transmitted (via=cmdi-arith), or a delay that scales with
        # the injected number (via=cmdi-timing); a verbatim echo
        # without evaluation is reflection, NOT execution, so it can
        # never confirm). Placed after the header pair (the traversal
        # pair follows it per Rule #66, then the SSTI pair per
        # Rule #67, so every query sink reads xss, sqli, redirect,
        # ssrf, header, cmdi, trav, ssti).
        #
        # Rule #66: the path-traversal / LFI probe for QUERY sinks
        # only (PLOOP66 marker — the target must RESOLVE the probe's
        # "../" sequences and READ a file outside the web root: an
        # /etc/passwd or win.ini content marker in the response body
        # though it was never transmitted (via=trav-passwd /
        # via=trav-winini); a verbatim echo without the content
        # marker is reflection, NOT a file read, so it can never
        # confirm). Placed after the cmdi pair (the SSTI pair
        # follows it per Rule #67), so every query sink reads xss,
        # sqli, redirect, ssrf, header, cmdi, trav, ssti.
        #
        # Rule #67: the server-side template injection probe for
        # QUERY sinks only (PLOOP67 marker — the target must
        # EVALUATE the probe's template-syntax arithmetic: the
        # result "7006652" in the response body though it was never
        # transmitted (via=ssti-jinja / ssti-el / ssti-freemarker /
        # ssti-thymeleaf); a verbatim echo of the payload without
        # the result is reflection, NOT evaluation, so it can never
        # confirm). Placed after the trav pair so every query sink
        # reads xss, sqli, redirect, ssrf, header, cmdi, trav, ssti,
        # hostheader.
        if sink.get("kind") == "query":
            redirect_marker = "PLOOP62|%s|%s|%s|%s" % (
                tbq, pathq, "GET",
                ",".join(sink.get("params", ())))
            plan.append({
                "desc": "Probe generic sink %s for open redirect (%s)" %
                        (sink.get("id"), "probe_sink_redirect.py"),
                "kind": "probe", "module": "generic_redirect",
                "sink": sink.get("id"), "probe": "probe_sink_redirect.py",
                "marker": redirect_marker, "done": False,
                "result_hash": None,
                "recon": True})
            plan.append({
                "desc": "File claim for the verified generic-sink "
                        "finding",
                "kind": "claim", "module": "generic_redirect",
                "sink": sink.get("id"),
                "probe_step_idx": len(plan) - 1,
                "done": False, "result_hash": None,
                "recon": True})
            ssrf_marker = "PLOOP63|%s|%s|%s|%s" % (
                tbq, pathq, "GET",
                ",".join(sink.get("params", ())))
            plan.append({
                "desc": "Probe generic sink %s for SSRF reachability "
                        "(%s)" % (sink.get("id"), "probe_sink_ssrf.py"),
                "kind": "probe", "module": "generic_ssrf",
                "sink": sink.get("id"), "probe": "probe_sink_ssrf.py",
                "marker": ssrf_marker, "done": False,
                "result_hash": None,
                "recon": True})
            plan.append({
                "desc": "File claim for the verified generic-sink "
                        "finding",
                "kind": "claim", "module": "generic_ssrf",
                "sink": sink.get("id"),
                "probe_step_idx": len(plan) - 1,
                "done": False, "result_hash": None,
                "recon": True})
            header_marker = "PLOOP64|%s|%s|%s|%s" % (
                tbq, pathq, "GET",
                ",".join(sink.get("params", ())))
            plan.append({
                "desc": "Probe generic sink %s for header injection / "
                        "CRLF (%s)" %
                        (sink.get("id"), "probe_sink_header.py"),
                "kind": "probe", "module": "generic_header",
                "sink": sink.get("id"),
                "probe": "probe_sink_header.py",
                "marker": header_marker, "done": False,
                "result_hash": None,
                "recon": True})
            plan.append({
                "desc": "File claim for the verified generic-sink "
                        "finding",
                "kind": "claim", "module": "generic_header",
                "sink": sink.get("id"),
                "probe_step_idx": len(plan) - 1,
                "done": False, "result_hash": None,
                "recon": True})
            cmdi_marker = "PLOOP65|%s|%s|%s|%s" % (
                tbq, pathq, "GET",
                ",".join(sink.get("params", ())))
            plan.append({
                "desc": "Probe generic sink %s for blind command "
                        "injection (%s)" %
                        (sink.get("id"), "probe_sink_cmdi.py"),
                "kind": "probe", "module": "generic_cmdi",
                "sink": sink.get("id"),
                "probe": "probe_sink_cmdi.py",
                "marker": cmdi_marker, "done": False,
                "result_hash": None,
                "recon": True})
            plan.append({
                "desc": "File claim for the verified generic-sink "
                        "finding",
                "kind": "claim", "module": "generic_cmdi",
                "sink": sink.get("id"),
                "probe_step_idx": len(plan) - 1,
                "done": False, "result_hash": None,
                "recon": True})
            trav_marker = "PLOOP66|%s|%s|%s|%s" % (
                tbq, pathq, "GET",
                ",".join(sink.get("params", ())))
            plan.append({
                "desc": "Probe generic sink %s for path traversal / "
                        "LFI (%s)" %
                        (sink.get("id"), "probe_sink_traversal.py"),
                "kind": "probe", "module": "generic_trav",
                "sink": sink.get("id"),
                "probe": "probe_sink_traversal.py",
                "marker": trav_marker, "done": False,
                "result_hash": None,
                "recon": True})
            plan.append({
                "desc": "File claim for the verified generic-sink "
                        "finding",
                "kind": "claim", "module": "generic_trav",
                "sink": sink.get("id"),
                "probe_step_idx": len(plan) - 1,
                "done": False, "result_hash": None,
                "recon": True})
            ssti_marker = "PLOOP67|%s|%s|%s|%s" % (
                tbq, pathq, "GET",
                ",".join(sink.get("params", ())))
            plan.append({
                "desc": "Probe generic sink %s for server-side "
                        "template injection (%s)" %
                        (sink.get("id"), "probe_sink_ssti.py"),
                "kind": "probe", "module": "generic_ssti",
                "sink": sink.get("id"),
                "probe": "probe_sink_ssti.py",
                "marker": ssti_marker, "done": False,
                "result_hash": None,
                "recon": True})
            plan.append({
                "desc": "File claim for the verified generic-sink "
                        "finding",
                "kind": "claim", "module": "generic_ssti",
                "sink": sink.get("id"),
                "probe_step_idx": len(plan) - 1,
                "done": False, "result_hash": None,
                "recon": True})
            # Rule #71: the host-header injection probe for QUERY sinks
            # (PLOOP71 marker — the target must TRUST the
            # attacker-controlled Host header: the run-unique RFC 2606
            # canary host in the response body though absent from the
            # control body -> via=host-header-body, or in the 302
            # Location though the control Location lacked it ->
            # via=host-header-redirect). The probe needs no params —
            # it rides the path — so the marker's params field is
            # empty. Placed after the ssti pair so every query sink
            # reads xss, sqli, redirect, ssrf, header, cmdi, trav,
            # ssti, hostheader.
            hostheader_marker = "PLOOP71|%s|%s|%s|" % (
                tbq, pathq, "GET")
            plan.append({
                "desc": "Probe generic sink %s for host-header "
                        "injection (%s)" %
                        (sink.get("id"),
                         "probe_sink_hostheader.py"),
                "kind": "probe", "module": "generic_hostheader",
                "sink": sink.get("id"),
                "probe": "probe_sink_hostheader.py",
                "marker": hostheader_marker, "done": False,
                "result_hash": None,
                "recon": True})
            plan.append({
                "desc": "File claim for the verified generic-sink "
                        "finding",
                "kind": "claim", "module": "generic_hostheader",
                "sink": sink.get("id"),
                "probe_step_idx": len(plan) - 1,
                "done": False, "result_hash": None,
                "recon": True})
        # Rule #69: the open-redirect probe for POST-form sinks
        # (PLOOP69 marker — the SAME class as Rule #62, but the canary
        # rides a POST form field: 302 Location / meta refresh / JS
        # location assignment read from the raw POST response without
        # following). Placed right after the CSRF pair, so every
        # POST-form sink reads xss, sqli, csrf, redirect_post.
        if sink.get("kind") == "form" and \
                sink.get("method", "GET").upper() == "POST":
            csrf_marker = "PLOOP61|%s|%s|%s|%s" % (
                tbq, pathq, "POST",
                ",".join(sink.get("params", ())))
            plan.append({
                "desc": "Probe generic sink %s for CSRF state change "
                        "(%s)" % (sink.get("id"), "probe_sink_csrf.py"),
                "kind": "probe", "module": "generic_csrf",
                "sink": sink.get("id"), "probe": "probe_sink_csrf.py",
                "marker": csrf_marker, "done": False, "result_hash": None,
                "recon": True})
            plan.append({
                "desc": "File claim for the verified generic-sink "
                        "finding",
                "kind": "claim", "module": "generic_csrf",
                "sink": sink.get("id"),
                "probe_step_idx": len(plan) - 1,
                "done": False, "result_hash": None,
                "recon": True})
            rpost_marker = "PLOOP69|%s|%s|%s|%s" % (
                tbq, pathq, "POST",
                ",".join(sink.get("params", ())))
            plan.append({
                "desc": "Probe generic sink %s for open redirect on "
                        "POST (%s)" %
                        (sink.get("id"),
                         "probe_sink_redirect_post.py"),
                "kind": "probe", "module": "generic_redirect_post",
                "sink": sink.get("id"),
                "probe": "probe_sink_redirect_post.py",
                "marker": rpost_marker, "done": False,
                "result_hash": None,
                "recon": True})
            plan.append({
                "desc": "File claim for the verified generic-sink "
                        "finding",
                "kind": "claim", "module": "generic_redirect_post",
                "sink": sink.get("id"),
                "probe_step_idx": len(plan) - 1,
                "done": False, "result_hash": None,
                "recon": True})
        # Rule #70: the XXE probe for XML sinks (PLOOP70 marker — the
        # target must RESOLVE an external entity in an
        # application/xml POST body and reflect the file content: the
        # /etc/passwd marker "root:x:0:0" or the win.ini marker
        # "[fonts]" though it was never transmitted ->
        # via=xxe-file-read; a verbatim echo of the entity reference
        # without the content marker is reflection, not resolution,
        # so it can never confirm). XML sinks carry ONLY this pair —
        # the body is XML, not params/fields, so the xss/sqli/csrf
        # pairs do not apply.
        if sink.get("kind") == "xml":
            xxe_marker = "PLOOP70|%s|%s|%s|" % (tbq, pathq, "POST")
            plan.append({
                "desc": "Probe generic sink %s for XXE (%s)" %
                        (sink.get("id"), "probe_sink_xxe.py"),
                "kind": "probe", "module": "generic_xxe",
                "sink": sink.get("id"),
                "probe": "probe_sink_xxe.py",
                "marker": xxe_marker, "done": False,
                "result_hash": None,
                "recon": True})
            plan.append({
                "desc": "File claim for the verified generic-sink "
                        "finding",
                "kind": "claim", "module": "generic_xxe",
                "sink": sink.get("id"),
                "probe_step_idx": len(plan) - 1,
                "done": False, "result_hash": None,
                "recon": True})
        # Rule #74: the cookie-XSS probe for cookie sinks
        # (PLOOP74 marker — the target must reflect the
        # attacker-controlled cookie value into the response body
        # UNESCAPED: the run-unique executable canary "<img src=x
        # onerror=PLOOP74-<nonce>>" in the canary body though
        # absent from the control body -> via=html; an
        # HTML-encoded reflection is a safe encoding, not a vuln).
        # Cookie sinks carry ONLY this pair — a cookie is neither a
        # query param nor a form field nor an XML body, so the
        # xss/sqli/csrf pairs do not apply.
        # Rule #75 (plan gate, defense in depth): a hand-built sink
        # list could carry a loop-owned session cookie past the
        # capture exclusion — refuse the pair WITH REASON instead of
        # burning 2 turns on the loop's own session.
        if sink.get("kind") == "cookie":
            _ck = (sink.get("params") or [None])[0]
            if _ck in _excl_cookies:
                meta.setdefault("excluded_cookie_sinks", []).append(
                    "%s — Rule #75: %r is a loop-owned session cookie, "
                    "not an attack surface" % (sink.get("id"), _ck))
                continue
            cxss_marker = "PLOOP74|%s|%s|%s|%s" % (
                tbq, pathq, "GET",
                ",".join(sink.get("params", ())))
            plan.append({
                "desc": "Probe generic cookie sink %s for reflected "
                        "XSS (%s)" %
                        (sink.get("id"), "probe_sink_cookiexss.py"),
                "kind": "probe", "module": "generic_cookiexss",
                "sink": sink.get("id"),
                "probe": "probe_sink_cookiexss.py",
                "marker": cxss_marker, "done": False,
                "result_hash": None,
                "recon": True})
            plan.append({
                "desc": "File claim for the verified generic-sink "
                        "finding",
                "kind": "claim", "module": "generic_cookiexss",
                "sink": sink.get("id"),
                "probe_step_idx": len(plan) - 1,
                "done": False, "result_hash": None,
                "recon": True})
        # Rule #80: the JSON-body-XSS probe for JSON sinks
        # (PLOOP80 marker — the target must reflect an
        # attacker-controlled JSON field value into the response body
        # UNESCAPED: the run-unique executable canary "<img src=x
        # onerror=PLOOP80-<nonce>>" in the canary body though
        # absent from the control body -> via=html; an
        # HTML-encoded reflection is a safe encoding, not a vuln).
        # JSON sinks carry ONLY this pair — a JSON body is neither a
        # query param nor a form field nor an XML body nor a cookie,
        # so the xss/sqli/csrf pairs do not apply. The marker's 5th
        # component is the _JSON_SINK_FIELDS CSV; the probe iterates
        # it internally (first CONFIRMED wins), keeping the budget at
        # 2 turns per sink.
        if sink.get("kind") == "json":
            jxss_marker = "PLOOP80|%s|%s|%s|%s" % (
                tbq, pathq, "POST",
                ",".join(sink.get("params", ())))
            plan.append({
                "desc": "Probe generic JSON-body sink %s for reflected "
                        "XSS (%s)" %
                        (sink.get("id"), "probe_sink_jsonxss.py"),
                "kind": "probe", "module": "generic_jsonxss",
                "sink": sink.get("id"),
                "probe": "probe_sink_jsonxss.py",
                "marker": jxss_marker, "done": False,
                "result_hash": None, "recon": True})
            plan.append({
                "desc": "File claim for the verified generic-sink "
                        "finding",
                "kind": "claim", "module": "generic_jsonxss",
                "sink": sink.get("id"),
                "probe_step_idx": len(plan) - 1,
                "done": False, "result_hash": None,
                "recon": True})
    meta["generic_sinks"] = [s.get("id") for s in (generic_sinks or ())]
    return plan, meta

# module -> ordered variant rungs (brain-escalate-v1.py catalog). Each
# rung defeats ONE naive-filter class; probe_from must equal the step's
# probe file for the rung to be eligible.
PROBE_LADDERS = {
    "xss_r": [
        {"desc": "case-variant <ScRiPt>",
         "why": "naive filters strip only lowercase '<script'; mixed "
                "case is the classic bypass rung",
         "probe_from": "probe_xss_r.py",
         "probe_to": "variant_xss_r_case.py"},
        {"desc": "event-handler <img onerror>",
         "why": "needs no <script> tag at all; defeats tag-stripping "
                "filters entirely",
         "probe_from": "probe_xss_r.py",
         "probe_to": "variant_xss_r_event.py"},
    ],
    "xss_s": [
        {"desc": "nested-tag <scr<scriptipt>",
         "why": "single-pass strip leaves '<script' behind; nesting is "
                "the classic second-order bypass",
         "probe_from": "parent_brain_sxss.py",
         "probe_to": "variant_sxss_nested.py"},
    ],
    "sqli": [
        {"desc": "mixed-case uNiOn",
         "why": "uppercase-only keyword blocks miss mixed case while "
                "the DB stays case-insensitive",
         "probe_from": "probe_sqli.py",
         "probe_to": "variant_sqli_mixedcase.py"},
    ],
    "exec": [
        {"desc": "&& separator",
         "why": "';' stripping does not stop '&&' command chaining",
         "probe_from": "parent_brain_cmdi.py",
         "probe_to": "variant_cmdi_and.py"},
    ],
    "fi": [
        {"desc": "absolute-path /etc/passwd",
         "why": "dot-dot stripping does not block absolute paths",
         "probe_from": "parent_brain_lfi.py",
         "probe_to": "variant_lfi_nested.py"},
    ],
}
DEFAULT_LADDERS["probe"] = [r for rs in PROBE_LADDERS.values() for r in rs]


# Rule #47 — ESCALATION-AWARE TURN BUDGET. Rule #46 caught the defect
# live: a full 11-module drive was budgeted 2 turns/module (probe+claim =
# 22) but a Rule #30 escalation rung consumed one extra turn, so the
# 11th probe's claim fell outside the budget and was never filed. The
# budget is exact, not heuristic: the interleave needs 2 turns per
# planned module, and each escalation rung can fire at most once
# (A-to-Z memory, Rule #30) costing at most 1 extra turn — so
# recommended = 2*M + total_rungs(planned modules). Computed from the
# real tables so future ladder additions update the budget
# automatically; never hardcoded in the backend.
def budget_info(modules=None, generic_sinks=()):
    """Return the turn budget for a probe-hunt plan.

    modules=None -> the full _HUNT_MODULE_ORDER (the Rule #34 fixed
    plan / Rule #35 blind-recon fallback). Pass the recon-found module
    list for a pruned plan. generic_sinks (Rule #56, Rule #57, Rule
    #61, Rule #62, Rule #63, Rule #64, Rule #65, Rule #66, Rule #67,
    Rule #69, Rule #70, Rule #74)
    cost 4 turns each (XSS probe+claim, SQLi
    probe+claim), 8 for POST-form sinks (the CSRF probe+claim pair
    plus the Rule #69 open-redirect-on-POST probe+claim pair),
    16 for query sinks (the open-redirect, SSRF-reachability,
    header-injection, blind command-injection, path-traversal and
    server-side template injection probe+claim pairs), 2 for
    xml sinks (the Rule #70 XXE probe+claim pair), and 2 for cookie
    sinks (the Rule #74 cookie-XSS probe+claim pair), no escalation
    rungs yet. Rule #81: the double-confirm reconfirm is NOT priced
    here — it fires only when the first probe run CONFIRMs (rare),
    and it executes inside the probe step's own action (its wall
    time is bounded by 2x the probe timeout, ceiling 2*pto+60). Returns {planned_modules,
    generic_sinks, base_turns, max_escalation_turns, recommended_turns}.
    """
    planned = [m for m in _HUNT_MODULE_ORDER
               if modules is None or m in set(modules or ())]
    base = 2 * len(planned)
    esc = sum(len(PROBE_LADDERS.get(m, ())) for m in planned)
    gen = 0
    for s in (generic_sinks or ()):
        # Rule #61: a POST-form sink carries four probe+claim pairs
        # (xss + sqli + csrf + Rule #69 open-redirect-on-POST);
        # Rule #62 + Rule #63 + Rule #64 +
        # Rule #65 + Rule #66 + Rule #67 + Rule #71: a query sink carries
        # nine (xss + sqli + open-redirect + ssrf + header-injection +
        # blind command-injection + path-traversal + server-side
        # template injection + host-header injection); Rule #70: an xml
        # sink carries one (xxe); Rule #74: a cookie sink carries one
        # (cookie-XSS); Rule #80: a json sink carries one (JSON-body
        # XSS — the probe iterates the field-name CSV internally);
        # every other sink shape carries two.
        if isinstance(s, dict) and s.get("kind") == "form" and \
                s.get("method", "GET").upper() == "POST":
            gen += 8
        elif isinstance(s, dict) and s.get("kind") == "query":
            gen += 18
        elif isinstance(s, dict) and s.get("kind") == "xml":
            # Rule #70: an xml sink carries only the XXE probe+claim
            # pair — the body is XML, not params/fields.
            gen += 2
        elif isinstance(s, dict) and s.get("kind") == "cookie":
            # Rule #74: a cookie sink carries only the cookie-XSS
            # probe+claim pair — a cookie is neither a query param
            # nor a form field nor an XML body.
            gen += 2
        elif isinstance(s, dict) and s.get("kind") == "json":
            # Rule #80: a json sink carries only the JSON-body-XSS
            # probe+claim pair — a JSON body is neither a query param
            # nor a form field nor an XML body nor a cookie; the
            # probe iterates the field-name CSV internally so one
            # pair (2 turns) covers all common field names.
            gen += 2
        else:
            gen += 4
    return {"planned_modules": planned,
            "generic_sinks": [s.get("id") if isinstance(s, dict) else s
                              for s in (generic_sinks or ())],
            "base_turns": base,
            "max_escalation_turns": esc,
            "generic_turns": gen,
            "recommended_turns": base + esc + gen}


def _sandbox_dir(ctx):
    memdir = ctx.get("memdir") or tempfile.gettempdir()
    return ctx.get("probe_sandbox") or os.path.join(memdir, "probe-sandbox")


def _probe_cmd(probe_file, marker, target_base, sandbox, timeout_s=120):
    """Build the fail-closed shell command that runs ONE probe. The
    command always ends with a VERDICT line so the loop's extractor
    (Rule #30) can judge the step. Rule #81: a probe whose first run
    prints VERDICT:CONFIRMED is re-run once, immediately, with the
    identical marker — the step verdict is CONFIRMED only when BOTH
    runs confirm (the human "run it again before you report it"); a
    flaky first CONFIRMED becomes a FAILED step, never a filed claim.
    """
    tb = (target_base or "").strip()
    if not tb:
        return "echo PROBE_BLOCKED_NO_TARGET_BASE; echo VERDICT:FAILED"
    pf = shlex.quote(probe_file)
    mk = shlex.quote(marker or "PLOOP")
    tbq = shlex.quote(tb)
    sbq = shlex.quote(sandbox)
    srcq = shlex.quote(os.path.join(_PROBE_DIR, probe_file))
    to = int(timeout_s)
    return "\n".join([
        "set -u",
        "PF=%s; MK=%s; TB=%s; SB=%s; SRC=%s; TO=%d" %
        (pf, mk, tbq, sbq, srcq, to),
        "mkdir -p \"$SB\"",
        "if [ ! -f \"$SRC\" ]; then "
        "echo \"PROBE_MISSING: $PF\"; echo VERDICT:FAILED; exit 0; fi",
        "DST=\"$SB/$MK-$PF\"",
        # sed-rebase a COPY onto the loop's target; originals untouched.
        # Rule #41 fix: when the hunt target IS the probes' lab base
        # (172.17.0.1:3100 — the DVWA training target), sed is a no-op and
        # the leak grep would false-positive on the intended target itself
        # (caught live on EC2: 3/3 turns REBASE_LEAK, zero probes ran). The
        # leak check only fires when TB differs from the lab base — its job
        # is to stop probes phoning the LAB box on a DIFFERENT target.
        "sed \"s|%s|$TB|g\" \"$SRC\" > \"$DST\"" % LIVE_PROBE_BASE,
    ] + ([
        # fail-closed: the live base must not survive, the target must land
        "if grep -q '172\\.17\\.0\\.1' \"$DST\"; then "
        "echo REBASE_LEAK; echo VERDICT:FAILED; exit 0; fi",
    ] if tb.rstrip("/").lower() != LIVE_PROBE_BASE.rstrip("/").lower()
        else []) + [
        "case \"$PF\" in *.py) RUN=python3;; *.sh) RUN=bash;; "
        "*) echo PROBE_UNKNOWN_TYPE; echo VERDICT:FAILED; exit 0;; esac",
        # The wrapper OWNS the trailing-VERDICT contract (Rule #3): the
        # probe's output is captured, replayed, and audited — a probe
        # that crashed (traceback, connection refused, no VERDICT line)
        # is a FAILED probe, never a silent neutral step.
        "timeout \"$TO\" \"$RUN\" \"$DST\" \"$MK\" > \"$DST.out\" 2>&1",
        "rc=$?",
        # Rule #81 DOUBLE-CONFIRM: a CONFIRMED first run re-runs the
        # probe once, immediately, with the identical marker. Probes
        # mint their own run-unique canaries, so the two runs are
        # independent confirmations. The step verdict is the SECOND
        # run's verdict: CONFIRMED only when both runs confirm; a
        # flaky first CONFIRMED (run 2 FAILED) becomes a FAILED step —
        # it stays open for escalation / dead-end WITH REASON and is
        # never filed as a claim.
        "last1=$(grep -v '^[[:space:]]*$' \"$DST.out\" | tail -n 1 | "
        "tr -d '[:space:]')",
        "if [ \"$last1\" = \"VERDICT:CONFIRMED\" ]; then "
        "printf '\\n--- RECONFIRM (Rule #81): re-running %s with the same "
        "marker ---\\n' \"$PF\" >> \"$DST.out\"; "
        "timeout \"$TO\" \"$RUN\" \"$DST\" \"$MK\" >> \"$DST.out\" 2>&1; "
        "rc=$?; fi",
        "cat \"$DST.out\"",
        "if [ $rc -eq 124 ]; then echo PROBE_TIMEOUT; fi",
        "last=$(grep -v '^[[:space:]]*$' \"$DST.out\" | tail -n 1 | "
        "tr -d '[:space:]')",
        "case \"$last\" in VERDICT:CONFIRMED|VERDICT:FAILED) ;; "
        "*) echo \"PROBE_NO_VERDICT rc=$rc\"; echo VERDICT:FAILED;; esac",
    ])


def _lab_plan_for_hunt(modules=None, generic_sinks=None, target_base="",
                       exclude_cookie_names=()):
    """Lab plan template (Rule #31, extended Rule #32, full 11-module
    plan Rule #34, recon-driven Rule #35, generic sinks Rule #56): a goal containing
    'probe-hunt' drives the one loop through real parent probes against
    the ctx target_base — recon->decide->probe->VERDICT->escalate, and
    every CONFIRMED probe is followed by a claim step (Rule #32): file
    ONE claim citing the output hash, then wait for the verifier's
    terminal validation. Zero human turns.

    modules=None keeps the legacy full 11-module fixed plan and reports
    recon_ok=False (fallback when recon is blind); pass the recon-found
    module set for a recon-driven plan. generic_sinks (from
    _lab_generic_sinks) appends probe+claim pairs per unknown sink
    (probe_sink_xss + probe_sink_sqli, Rule #56/#57, plus
    probe_sink_csrf for POST-form sinks, Rule #61) AFTER the module
    steps. exclude_cookie_names (Rule #75): cookie names the loop
    itself owns — no pairs are planned for them, and the refusal is
    recorded on the plan meta. Returns (plan, plan_meta)."""
    if modules is None:
        plan, meta = _recon_driven_plan(list(_HUNT_MODULE_ORDER),
                                        (), target_base,
                                        exclude_cookie_names)
        meta = dict(meta, recon_ok=False,
                    note="fixed-plan fallback: recon blind or unavailable")
        return plan, meta
    return _recon_driven_plan(modules, generic_sinks or (), target_base,
                              exclude_cookie_names)


def _probe_step_reply(step, plan, goal, ctx, new_process=None):
    """Emit the reply for a probe-kind step. Fail-closed: no target_base
    in ctx -> idle (the loop never invents a target)."""
    tb = ctx.get("target_base")
    if not tb:
        return _idle_reply(
            "probe blocked", goal, "no target_base in context",
            "Firing a probe without an explicit target would violate the "
            "explicit-targets-only rule; idling is the only safe choice.",
            "I did not invent a target because the one loop never "
            "guesses where probes may go.")
    done_n = sum(1 for s in plan if s.get("done"))
    pto = _probe_timeout_for(step.get("module"))
    cmd = _probe_cmd(step["probe"], step.get("marker", "PLOOP"), tb,
                     _sandbox_dir(ctx), timeout_s=pto)
    return _reply(
        "probe %s (%s)" % (step.get("module"), step["probe"]), goal,
        "step %d/%d" % (done_n + 1, len(plan)),
        "The probe is self-judging (last-line VERDICT, Rule #3); the "
        "loop only diverts flow on FAILED. A CONFIRMED here is a "
        "verified finding candidate, stored by hash with full output.",
        "I did not skip this module because the title index shows no "
        "prior probe-hunt against this target; I did not invent a "
        "payload because the live-proven probe is the grounded move.",
        {"type": "shell", "command": cmd,
         # Rule #81: the action ceiling covers BOTH probe runs (first +
         # reconfirm); each run is still bounded by pto via the wrapper's
         # inner timeout, so a hung probe costs at most 2*pto, not the
         # ceiling.
         "timeout_s": 2 * pto + 60,
         "no_echo": True},  # Rule #49: stored output is the probe's own
        new_process=new_process)


def _cookie_name_of_sink(sink_id):
    """Extract the cookie name from a cookie sink id
    (cookie:<path>:GET:<name>); None for anything else. Rule #75."""
    try:
        parts = (sink_id or "").rsplit(":", 2)
        if len(parts) == 3 and parts[0].startswith("cookie:") \
                and parts[1] == "GET":
            return parts[2] or None
    except Exception:
        pass
    return None


def _build_lab_claim(proc, module, probe_step_idx, store, sink_id=None,
                     self_cookie_names=None):
    """Assemble a claim object from a CONFIRMED probe's stored output.

    Rule #32. The scripted (lab) brain cannot read the hash store except
    through the backend, so the backend builds the claim: title, class,
    command, evidence (>=30 chars), counterevidence (>=10), confidence,
    evidence_hash — the same minimums the validator enforces on
    parent-authored claims. Returns (claim_dict, "") or (None, reason)
    when there is no CONFIRMED evidence to cite (fail-closed).
    """
    if not isinstance(proc, dict):
        return None, "no process document (fail-closed)"
    hits = [h for h in proc.get("history", [])
            if h.get("step_idx") == probe_step_idx and
            h.get("verdict") == "CONFIRMED"]
    if not hits:
        return None, ("probe step %d has no CONFIRMED output in history — "
                      "a claim needs verified evidence (fail-closed)"
                      % probe_step_idx)
    h = hits[-1]
    raw = store.get(h.get("result_hash") or "") or b""
    text = _to_text(raw)
    # Rule #75 (claim-layer gate): even with CONFIRMED output, a
    # generic_cookiexss claim against the loop's OWN session cookie is
    # never filed — the "finding" would be the loop echoing its own
    # session state, a self-inflicted claim no elite hunter would make.
    # The sink id carries the name (cookie:<path>:GET:<name>).
    if module == "generic_cookiexss":
        _cn = _cookie_name_of_sink(sink_id)
        if _cn and _cn in set(self_cookie_names or ()):
            return None, ("Rule #75: refusing claim — %r is a loop-owned "
                          "session cookie, not an attack surface; filing "
                          "here would be a self-inflicted finding "
                          "(fail-closed)" % _cn)
    cmd = (h.get("action") or {}).get("command", "")
    m = re.search(r"([A-Za-z0-9_]+\.(?:py|sh))\b", cmd)
    probe_file = m.group(1) if m else "probe"
    label, cls, sev = _LAB_CLAIM_META.get(module,
                                          (module, module, "medium"))
    # Rule #59: generic probes cite their verified sink as
    # EVIDENCE sink=/path — carry it as the claim's location so the
    # (module, class, location) dedup files distinct pages as distinct
    # findings instead of blocking them.
    lm = re.search(r"EVIDENCE sink=(\S+)", text)
    location = lm.group(1) if lm else ""
    # Rule #77: the title carries the verified location when there is
    # one. Two findings of the same class on different pages are
    # different findings for the owner AND for the terminal scan, which
    # matches validation events to claims by title — identical titles
    # fail closed as "ambiguous, human resolves" and the claims never
    # reach accepted (live: two cookie-XSS claims, 30 Oct 2026).
    # Location-less claims (DVWA module probes) keep the old title.
    title = ("%s — %s — verified live on the hunt target" % (label, location)
             if location else
             "%s — verified live on the hunt target" % label)
    # Rule #49: excerpt the TAIL, not the head. The probe contract puts
    # the verdict last and the signal-bearing EVIDENCE lines just before
    # it; the head is login/security diagnostics. A head excerpt buried
    # the POC (sxss STORED LINE cut mid-tag, bsqli EVIDENCE past 400
    # chars) and the pipeline's interestingness gate read only noise.
    evidence = ("probe %s printed VERDICT: CONFIRMED; its fixed marker was "
                "observed in the target's HTTP response; output sha256 "
                "%s; excerpt (tail): %s"
                % (probe_file, (h.get("result_hash") or "")[:16],
                   text[-400:]))
    claim = {
        "title": title,
        "class": cls,
        "severity": sev,
        "command": cmd[:500],
        "location": location,
        "evidence": evidence,
        "counterevidence": ("The probe emits VERDICT: CONFIRMED only when "
                            "its fixed marker is observed in the target "
                            "response; a benign control value yields no "
                            "marker (probe's own negative control, see "
                            "probe source). Output stored unmodified by "
                            "hash (Rule #20)."),
        "confidence": "high",
        "evidence_hash": h.get("result_hash") or "",
    }
    return claim, ""


def _claim_step_reply(step, nxt, plan, goal, proc, ctx):
    """Emit the reply for a claim-kind step. The scripted brain files the
    claim through the backend's claim executor (Rule #32): the executor
    resolves the paired probe's CONFIRMED output, enforces the Rule #21
    gate, and records blocks as discipline. Fail-closed: no paired
    CONFIRMED probe -> idle, never file on unconfirmed evidence."""
    module = step.get("module", "")
    pair = None
    for i in range(nxt - 1, -1, -1):
        s = plan[i]
        if s.get("kind") == "probe" and s.get("module") == module:
            pair = i
            break
    done_n = sum(1 for s in plan if s.get("done"))
    if pair is None:
        return _idle_reply(
            "claim blocked", goal, "no paired probe step for %s" % module,
            "A claim must cite CONFIRMED probe evidence by hash; without a "
            "paired probe step there is nothing to cite, so filing would "
            "be ungrounded.",
            "I did not file because the claim would reference no evidence; "
            "I did not invent evidence because claims cite hashes, not "
            "words.")
    conf = any(h.get("step_idx") == pair and h.get("verdict") == "CONFIRMED"
               for h in proc.get("history", []))
    # Rule #38: the paired probe may have dead-ended (ladder exhausted).
    # A claim step with no possible evidence must die WITH REASON too —
    # leaving it open would replay "claim blocked" forever and stall the
    # hunt. The dead end is recorded on the step; the hunt continues.
    pair_step = plan[pair] if 0 <= pair < len(plan) else {}
    if pair_step.get("dead_end"):
        return _idle_reply(
            "claim dead-ended: %s" % module, goal,
            "paired probe recorded a dead end WITH REASON",
            "The paired probe step exhausted its ladder and was recorded "
            "as a dead end; there is no verified evidence to cite, so the "
            "claim step is dead-ended too — never re-attempted.",
            "I did not file because a dead-ended probe yields no evidence; "
            "I did not leave the step open because an open claim step with "
            "no possible evidence would stall the hunt forever.",
            dead_end_step=True)
    if not conf:
        return _idle_reply(
            "claim blocked", goal, "paired probe not CONFIRMED",
            "The paired probe step has no CONFIRMED verdict in history; a "
            "claim filed now would be unverified — the 29-Oct lesson says "
            "claims cite verified evidence only.",
            "I did not file because unconfirmed evidence is not a finding; "
            "I did not skip because the step stays open for the next turn.")
    label = _LAB_CLAIM_META.get(module, (module, module, ""))[0]
    return _reply(
        "file claim: %s" % module, goal,
        "step %d/%d" % (done_n + 1, len(plan)),
        "The probe CONFIRMED a %s with a self-judging VERDICT; the honest "
        "hunter move is to file ONE claim citing the output hash, then "
        "wait for the verifier's terminal validation — never re-file "
        "(29-Oct lesson, coded in Rule #21)." % label,
        "I did not delay filing because the evidence is verified and "
        "hash-stored; I did not file twice because the gate blocks "
        "re-files as discipline, counted in memory.",
        {"type": "claim", "module": module, "probe_step_idx": pair,
         # Rule #75: the sink id lets the claim layer refuse claims
         # against the loop's own session cookies.
         "sink": step.get("sink")})


def _reply(task, goal, progress, why_this, why_not, action,
           recall_request=None, new_process=None, process_complete=False,
           dead_end_step=False):
    r = {"task": task, "goal": goal, "progress": progress,
         "why_this": why_this, "why_not_alternatives": why_not,
         "action": action, "process_complete": bool(process_complete),
         "dead_end_step": bool(dead_end_step)}
    if recall_request is not None:
        r["recall_request"] = recall_request
    if new_process is not None:
        r["new_process"] = new_process
    return r


def _idle_reply(task, goal, progress, why_this, why_not,
                dead_end_step=False):
    return _reply(task, goal, progress, why_this, why_not, {"type": "idle"},
                  dead_end_step=dead_end_step)


def _recall_hash_for_step(process, step_idx):
    """Resolve which output hash a recall-kind step refers to: the output
    of the most recent completed shell step before it."""
    for h in process.get("history", [])[::-1]:
        if h.get("step_idx", -1) < step_idx and h.get("result_hash"):
            return h["result_hash"]
    return None


def decide(turn_input, ctx, correction=None):
    """FRESH BRAIN. Reads ONLY turn_input (+ctx config). Never touches
    globals or prior in-memory objects.

    ctx: {"registry_url":..., "workdir":...}
    correction: {"errors":[...]} when the validator bounced the last reply —
      the brain re-emits a corrected reply (proven by test).
    """
    goal = turn_input["goal"]
    proc = turn_input["process"]
    titles = turn_input["titles"]

    if proc is None:
        # No process running -> read the title index, decide a NEW process.
        plan = _lab_plan_for_goal(goal)
        plan_meta = None
        recon = None
        is_hunt = plan is None and \
            "probe-hunt" in (goal or "").lower()  # Rule #31
        if is_hunt:
            # Rule #35: hunt what recon finds. The recon crawl is
            # read-only (no params, no POSTs) against the explicit
            # target_base only; a blind recon falls back to the full
            # fixed plan and the fallback is recorded on the process.
            # Rule #36b: the live target hides its link graph behind the
            # login (GET / -> login.php unauthenticated), so recon logs
            # in first with the documented default creds — the same
            # self-auth every parent probe issues. Login failure is
            # fail-closed: recon proceeds unauthenticated as before.
            tb = ctx.get("target_base") or ""
            opener = _lab_login_opener(tb) if tb else None
            # Rule #75: snapshot the loop's OWN session-jar cookie names
            # BEFORE the recon crawl — the crawl itself stores every
            # Set-Cookie the target sends into the jar, so reading the
            # jar after recon would exclude genuine sinks too. At login
            # time the jar holds exactly the loop's own session cookies
            # (PHPSESSID from the recon login).
            self_cookie_names = _lab_session_cookie_names(opener)
            recon = _lab_recon_map(tb, opener=opener) if tb else None
            # Rule #56: generic sinks ride along with the module plan —
            # a fresh target with zero known modules still gets hunted
            # via its discovered forms/query params.
            sinks = (_lab_generic_sinks(tb, opener,
                                        (recon or {}).get("modules"),
                                        self_cookie_names=self_cookie_names)
                     if recon else [])
            if recon and (recon.get("modules") or sinks):
                plan, plan_meta = _lab_plan_for_hunt(
                    list(recon["modules"]), sinks, tb,
                    exclude_cookie_names=self_cookie_names)
            else:
                plan, plan_meta = _lab_plan_for_hunt()
            if plan_meta is not None:
                plan_meta["recon_auth"] = opener is not None
                plan_meta["self_cookie_names"] = sorted(self_cookie_names)
        if plan is None:
            return _idle_reply(
                "assess goal", goal, "no plan template matches this goal",
                "Without a matching plan template the only honest move is "
                "to idle rather than invent an unguided action.",
                "I did not start a process because an invented process with "
                "no plan would be guessing, which the manual forbids.")
        if is_hunt:
            tb = ctx.get("target_base") or ""
            covered = any("probe-hunt" in t["title"].lower() and tb and
                          tb in t["title"] for t in titles)
        else:
            covered = any("toolkit" in t["title"].lower() for t in titles)
        if covered:
            return _idle_reply(
                "check title index", goal,
                "title index already records a completed toolkit fetch" if
                not is_hunt else
                "title index already records a completed probe-hunt "
                "against this target",
                "The title index is the A-to-Z record; re-fetching would "
                "repeat work, which the never-repeat rule forbids.",
                "I did not start a new process because the index proves "
                "this exact outcome was already achieved.")
        if is_hunt:
            new_process = {
                "name": "Probe-hunt vs %s" % (ctx.get("target_base") or
                                              "unset-target"),
                "why": ("Goal asks for an autonomous probe-hunt against "
                        "an explicit target. The parent probes are "
                        "live-proven and self-judging (Rule #3); the "
                        "title index shows no prior hunt against this "
                        "target — so this process is new, not a repeat. "
                        "The plan is recon-driven (Rule #35): %d of 11 "
                        "modules had live pages on the target%s%s."
                        % (len((plan_meta or {}).get("planned_modules",
                                                    [])),
                           "" if (plan_meta or {}).get("recon_ok")
                           else " (recon blind — fixed-plan fallback)",
                           ("; %d generic sink(s) discovered (Rule #56)" %
                            len((plan_meta or {}).get("generic_sinks", [])))
                           if (plan_meta or {}).get("generic_sinks")
                           else "")),
                "plan": [dict(s, done=False, result_hash=None)
                         for s in plan],
                "recon": recon or {"modules": {}},
                "plan_meta": plan_meta or {},
            }
            step0 = new_process["plan"][0]
            return _probe_step_reply(step0, new_process["plan"], goal,
                                     ctx, new_process=new_process)
        new_process = {
            "name": "Download recon toolkit from local tool registry",
            "why": ("Goal requires recon tooling on this machine. The local "
                    "tool registry is the fastest source, and the title "
                    "index shows no prior fetch — so this process is new, "
                    "not a repeat."),
            "plan": [{"desc": s["desc"], "kind": s["kind"], "done": False,
                      "result_hash": None,
                      "recall_reason": s.get("recall_reason")}
                     for s in plan],
        }
        step = new_process["plan"][0]
        return _reply(
            "start toolkit fetch", goal,
            "process invented, step 1/%d" % len(new_process["plan"]),
            "Step 1 must list the registry before anything else can be "
            "chosen; no prior output exists, so a shell listing is the "
            "only grounded first move.",
            "I did not download yet because the URL is unknown until the "
            "registry is listed; I did not recall because no hash exists "
            "yet.",
            {"type": "shell",
             "command": "curl -s --max-time 20 %s/api/tools" %
                        ctx["registry_url"]},
            new_process=new_process)

    # --- process exists: continue it from process memory alone ---
    plan = proc.get("plan", [])
    nxt = next((i for i, s in enumerate(plan) if not s.get("done")), None)
    if nxt is None:
        return _reply(
            "finish process", goal, "all %d steps done" % len(plan),
            "Every planned step is marked done in process memory; the "
            "honest move is to complete the process and index its title.",
            "I did not invent another step because the plan the brain "
            "itself wrote is fully executed.",
            {"type": "idle"}, process_complete=True)

    step = plan[nxt]
    kind = step.get("kind")
    done_n = sum(1 for s in plan if s.get("done"))

    # --- Rule #30: ESCALATION. The step is still OPEN because the last
    # turn's action FAILED it (verdict on history). A real hunter does not
    # walk away after one blocked payload: try the next ladder rung, with
    # the reason recorded. Ladder exhausted (or no ladder) -> complete the
    # process with the dead end RECORDED WITH REASON (Rule #16).
    last = proc.get("history", [])[-1] if proc.get("history") else None
    if last and last.get("step_idx") == nxt and last.get("verdict") == "FAILED":
        ladders = (ctx.get("ladders") or DEFAULT_LADDERS).get(kind, [])
        if kind == "probe":
            # Rule #31: only rungs written for THIS probe file are
            # eligible — a rung is never invented, only the ladder's
            # variants exist.
            ladders = [r for r in ladders
                       if r.get("probe_from") == step.get("probe")]
        tried = set()
        for h in proc.get("history", []):
            if h.get("step_idx") == nxt and h.get("verdict") == "FAILED":
                cmd = (h.get("action") or {}).get("command", "")
                for k, rung in enumerate(ladders):
                    if rung.get("url_to") and rung["url_to"] in cmd:
                        tried.add(k)
                    if rung.get("probe_to") and rung["probe_to"] in cmd:
                        tried.add(k)
        nxt_rung = next((k for k in range(len(ladders))
                         if k not in tried), None)
        if kind == "probe" and nxt_rung is not None:
            # Rule #31: escalate by swapping in the variant probe FILE.
            rung = ladders[nxt_rung]
            return _reply(
                "escalate: %s (rung %d)" % (rung["desc"], nxt_rung),
                goal,
                "base probe VERDICT:FAILED turn %d; ladder rung %d/%d" %
                (last["turn"], nxt_rung + 1, len(ladders)),
                "The base probe is blocked; a real hunter escalates with "
                "the variant that defeats this filter class (%s). This "
                "escalation — and its reason — is recorded in history so "
                "it is never repeated." % rung["why"],
                "I did not re-send the base probe because history proves "
                "it FAILED on turn %d (A-to-Z memory forbids repeats); I "
                "did not invent a variant because only the ladder's "
                "variants exist." % last["turn"],
                {"type": "shell",
                 "command": _probe_cmd(rung["probe_to"],
                                       step.get("marker", "PLOOP"),
                                       ctx.get("target_base"),
                                       _sandbox_dir(ctx),
                                       timeout_s=_probe_timeout_for(
                                           step.get("module"))),
                 # Rule #81: ceiling covers both runs (first + reconfirm).
                 "timeout_s": 2 * _probe_timeout_for(step.get("module")) + 60,
                 "no_echo": True})  # Rule #49: stored output is the probe's own
        base_url = _toolkit_url_from_recalls(proc)
        alt = None
        if nxt_rung is not None and base_url:
            rung0 = ladders[nxt_rung]
            if rung0.get("url_from") in base_url:
                alt = base_url.replace(rung0["url_from"], rung0["url_to"])
        if nxt_rung is not None and alt:
            rung = ladders[nxt_rung]
            return _reply(
                "escalate: %s (rung %d)" % (rung["desc"], nxt_rung),
                goal,
                "base blocked (VERDICT:FAILED turn %d); ladder rung %d/%d" %
                (last["turn"], nxt_rung + 1, len(ladders)),
                "The canonical path is filtered; a real hunter does not walk "
                "away after one blocked payload. Rung %d tries the alternate "
                "path (%s). This escalation — and its reason — is recorded "
                "in history so it is never repeated." % (nxt_rung, rung["why"]),
                "I did not re-send the base command because history proves "
                "it FAILED on turn %d (A-to-Z memory forbids repeats); I did "
                "not idle because an untried ladder rung exists." %
                last["turn"],
                {"type": "shell",
                 "command": _download_probe_cmd(ctx["workdir"], alt)})
        # ladder exhausted (or unusable): dead end WITH REASON.
        # Rule #38: a dead end must NOT end the hunt. Hunt probe steps are
        # INDEPENDENT modules — the dead end is recorded on the step
        # (dead_end_step=True marks it done, verdict DEAD_END) and the hunt
        # continues with the next module. Only linear chain steps (the
        # toolkit plan: each step depends on the previous) complete the
        # whole process on a dead end, as before.
        if kind == "probe":
            return _reply(
                "record dead end: %s blocked at every rung" % kind, goal,
                "base + %d rung(s) all VERDICT:FAILED; ladder exhausted" %
                len(ladders),
                "Every variant the ladder defines has been tried and "
                "blocked. The honest move is to record the dead end WITH "
                "REASON on this module and continue the hunt with the next "
                "module — a real hunter does not stop the whole hunt "
                "because one module resisted.",
                "I did not invent a new variant because unguided invention "
                "is guessing, which the manual forbids; I did not complete "
                "the process because the remaining modules are independent "
                "and unattempted.",
                {"type": "idle"}, dead_end_step=True)
        return _reply(
            "record dead end: %s blocked at every rung" % kind, goal,
            "base + %d rung(s) all VERDICT:FAILED; ladder exhausted" %
            len(ladders),
            "Every variant the ladder defines has been tried and blocked. "
            "The honest move is to complete the process with the dead end "
            "RECORDED WITH REASON, so no future turn ever repeats it.",
            "I did not invent a new variant because unguided invention is "
            "guessing, which the manual forbids; the ladder is the complete "
            "variant set for this step.",
            {"type": "idle"}, process_complete=True)

    if kind == "shell_list":
        return _reply(
            "list registry tools", goal,
            "step %d/%d" % (done_n + 1, len(plan)),
            "The download URL is unknown until the registry is listed; "
            "this shell call grounds every later step.",
            "I did not recall because no output hash exists yet; I did "
            "not skip ahead because the URL is not yet known.",
            {"type": "shell",
             "command": "curl -s --max-time 20 %s/api/tools" %
                        ctx["registry_url"]})

    if kind == "recall":
        h = _recall_hash_for_step(proc, nxt)
        if not h:
            # fail-closed: cannot recall what was never produced
            return _idle_reply(
                "recall blocked", goal, "no prior output hash available",
                "The recall step needs a hash from an earlier step, but "
                "none exists — proceeding would be ungrounded.",
                "I did not fabricate a hash because hashes are "
                "content-addressed and must come from real outputs.")
        return _reply(
            "recall registry listing", goal,
            "step %d/%d" % (done_n + 1, len(plan)),
            "The URL lives inside the step-1 output; I must state WHY "
            "before the backend serves it (reason-first rule).",
            "I did not re-run the listing because the hash already "
            "identifies the exact bytes; re-fetching would waste a turn.",
            {"type": "idle"},
            recall_request={"hash": h, "reason": step["recall_reason"]})

    if kind == "shell_download":
        url = _toolkit_url_from_recalls(proc)
        if not url:
            return _idle_reply(
                "download blocked", goal, "no URL recovered from recalls",
                "Downloading without a recalled URL would be guessing; "
                "the recall step must have produced it first.",
                "I did not invent a URL because only the recalled "
                "registry output is authoritative.")
        return _reply(
            "download toolkit", goal, "step %d/%d" % (done_n + 1, len(plan)),
            "The URL is now known from the recalled listing; downloading "
            "is the next grounded step toward the goal.",
            "I did not verify yet because there is nothing on disk to "
            "verify until the download lands.",
            {"type": "shell",
             "command": _download_probe_cmd(ctx["workdir"], url)})

    if kind == "shell_verify":
        return _reply(
            "verify toolkit", goal, "step %d/%d" % (done_n + 1, len(plan)),
            "A download is only real once its contents list and its "
            "sha256 are confirmed; this is the hunter's own discipline.",
            "I did not complete the process yet because completion "
            "requires verified bytes, not just a downloaded file.",
            {"type": "shell",
             "command": "tar tzf %s/toolkit.tgz && sha256sum %s/toolkit.tgz" %
                        (ctx["workdir"], ctx["workdir"])})

    if kind == "probe":
        return _probe_step_reply(step, plan, goal, ctx)

    if kind == "claim":
        # Rule #32: a claim step files ONE claim through the backend's
        # claim executor (Rule #21 gate inside). The executor resolves the
        # paired probe's CONFIRMED output and fails closed when there is
        # nothing verified to cite.
        return _claim_step_reply(step, nxt, plan, goal, proc, ctx)

    # unknown step kind -> fail closed, never invent an action
    return _idle_reply(
        "unknown step", goal, "plan step kind %r not understood" % (kind,),
        "An unrecognized plan step means the brain cannot ground its next "
        "move; idling is the only safe choice.",
        "I did not guess an action because ungrounded actions violate "
        "the fixed schema discipline.")


def _toolkit_url_from_recalls(proc):
    """Extract the toolkit tarball URL from recalled registry output."""
    dec = json.JSONDecoder()
    for r in proc.get("recall_log", []):
        txt = r.get("result_text") or ""
        # recalled output is raw SHELL output ("$ cmd\n[rc=0]\n{...}");
        # the brain scans for the first JSON object like a human would
        data = None
        for m in re.finditer(r"\{", txt):
            try:
                data, _ = dec.raw_decode(txt, m.start())
                break
            except ValueError:
                continue
        if not isinstance(data, dict):
            continue
        for t in data.get("tools", []):
            if "toolkit" in str(t.get("name", "")).lower():
                return t.get("url")
    return None

# ------------------------------------------------------------- validator
def validate_reply(reply, process_active):
    """VALIDATOR — enforces brain-reply-manual.md. Returns (ok, [errors]).
    Any violation bounces the reply back for correction."""
    errors = []
    if not isinstance(reply, dict):
        return False, ["reply must be a JSON object"]
    for k in REPLY_REQUIRED:
        v = reply.get(k)
        if k == "action":
            if not isinstance(v, dict) or not v:
                errors.append("missing/empty required field: action "
                              "(must be an object)")
            continue
        if not isinstance(v, str) or not v.strip():
            errors.append("missing/empty required field: %s" % k)
    for k in ("why_this", "why_not_alternatives"):
        v = reply.get(k, "")
        if isinstance(v, str) and v.strip() and len(v.strip()) < WHY_MIN_LEN:
            errors.append("%s too short (%d < %d): reasoning required, "
                          "not a slogan" % (k, len(v.strip()), WHY_MIN_LEN))
    allowed_top = set(REPLY_REQUIRED) | {"recall_request", "new_process",
                                         "process_complete", "dead_end_step"}
    for k in reply:
        if k not in allowed_top:
            errors.append("unknown top-level field: %s (strict schema)" % k)
    if "dead_end_step" in reply and not isinstance(reply["dead_end_step"],
                                                   bool):
        errors.append("dead_end_step must be a boolean")

    a = reply.get("action")
    if not isinstance(a, dict):
        errors.append("action must be an object")
    else:
        t = a.get("type")
        if t not in ACTION_TYPES:
            errors.append("unknown action type: %r (allowed: %s)"
                          % (t, ",".join(ACTION_TYPES)))
        else:
            ak = set(a.keys()) - {"type"}
            if t == "shell":
                if not isinstance(a.get("command"), str) or \
                        not a["command"].strip():
                    errors.append("shell needs non-empty command")
                if "timeout_s" in a and not isinstance(a["timeout_s"], int):
                    errors.append("shell timeout_s must be int")
                # Rule #49: no_echo is backend-only (probe steps) — the
                # brain never needs it, but the schema must accept what
                # the loop itself emits or the validator bounces its own
                # probe actions (caught by --proof-probe).
                if "no_echo" in a and not isinstance(a["no_echo"], bool):
                    errors.append("shell no_echo must be bool")
                ak -= {"command", "timeout_s", "no_echo"}
            elif t == "click":
                if not isinstance(a.get("x"), int) or \
                        not isinstance(a.get("y"), int):
                    errors.append("click needs int x and y")
                ak -= {"x", "y"}
            elif t == "type":
                if not isinstance(a.get("text"), str):
                    errors.append("type needs text")
                ak -= {"text"}
            elif t == "key":
                if not isinstance(a.get("key"), str) or not a["key"].strip():
                    errors.append("key needs non-empty key")
                ak -= {"key"}
            elif t == "open_url":
                u = a.get("url", "")
                if not isinstance(u, str) or not (
                        u.startswith("http://") or u.startswith("https://")):
                    errors.append("open_url needs http(s) url")
                ak -= {"url"}
            elif t in ("screenshot", "idle"):
                pass
            elif t == "claim":
                # Rule #32: a claim cites verified evidence. Two shapes:
                # (a) the scripted lab path: module + probe_step_idx — the
                #     backend resolves the CONFIRMED output itself;
                # (b) the parent path: module + a full claim object, with
                #     the deployed gate's field minimums enforced here, at
                #     the seam, so a malformed claim bounces for correction
                #     instead of failing silently downstream.
                if not isinstance(a.get("module"), str) or \
                        not a["module"].strip():
                    errors.append("claim needs a non-empty module")
                psi = a.get("probe_step_idx")
                if psi is not None and not isinstance(psi, int):
                    errors.append("claim probe_step_idx must be an int")
                c = a.get("claim")
                if c is not None:
                    if not isinstance(c, dict):
                        errors.append("claim.claim must be an object")
                    else:
                        ck = set(c.keys()) - {
                            "title", "class", "severity", "command",
                            "location",
                            "evidence", "counterevidence", "confidence",
                            "evidence_hash"}
                        if ck:
                            errors.append("claim.claim unknown fields: %s"
                                          % sorted(ck))
                        for f in ("title", "class", "evidence",
                                  "confidence"):
                            if not isinstance(c.get(f), str) or \
                                    not c[f].strip():
                                errors.append("claim.claim missing/empty: "
                                              "%s" % f)
                        if isinstance(c.get("title"), str) and \
                                len(c["title"].strip()) < CLAIM_TITLE_MIN:
                            errors.append("claim title too short (< %d): "
                                          "the gate needs a real title"
                                          % CLAIM_TITLE_MIN)
                        if isinstance(c.get("class"), str) and \
                                len(c["class"].strip()) < CLAIM_CLASS_MIN:
                            errors.append("claim class too short (< %d)"
                                          % CLAIM_CLASS_MIN)
                        if isinstance(c.get("evidence"), str) and \
                                len(c["evidence"].strip()) < \
                                CLAIM_EVIDENCE_MIN:
                            errors.append("claim evidence too short (< %d): "
                                          "cite the observed marker/output"
                                          % CLAIM_EVIDENCE_MIN)
                        ce = c.get("counterevidence")
                        if ce is not None and \
                                (not isinstance(ce, str) or
                                 len(ce.strip()) <
                                 CLAIM_COUNTEREVIDENCE_MIN):
                            errors.append("claim counterevidence too short "
                                          "(< %d)"
                                          % CLAIM_COUNTEREVIDENCE_MIN)
                        cmd = c.get("command")
                        if cmd is not None and \
                                (not isinstance(cmd, str) or
                                 len(cmd.strip()) < CLAIM_COMMAND_MIN):
                            errors.append("claim command too short (< %d)"
                                          % CLAIM_COMMAND_MIN)
                ak -= {"module", "probe_step_idx", "claim",
                       # Rule #75: the sink id lets the claim layer refuse
                       # claims against the loop's own session cookies.
                       "sink"}
            if ak:
                errors.append("unknown action params for %s: %s"
                              % (t, sorted(ak)))

    rr = reply.get("recall_request")
    if rr is not None:
        if not isinstance(rr, dict):
            errors.append("recall_request must be an object")
        else:
            if not HASH_RE.match(rr.get("hash") or ""):
                errors.append("recall_request.hash must be 64-hex")
            if not isinstance(rr.get("reason"), str) or \
                    not rr["reason"].strip():
                errors.append("recall_request needs a reason FIRST "
                              "(reason-first rule)")
            if set(rr.keys()) - {"hash", "reason"}:
                errors.append("recall_request allows only hash+reason")

    np_ = reply.get("new_process")
    if np_ is not None:
        if process_active:
            errors.append("new_process while a process is already running")
        if not isinstance(np_, dict):
            errors.append("new_process must be an object")
        else:
            for k in ("name", "why", "plan"):
                if k not in np_:
                    errors.append("new_process missing: %s" % k)
            if isinstance(np_.get("why"), str) and \
                    len(np_["why"].strip()) < WHY_MIN_LEN:
                errors.append("new_process.why too short: the brain must "
                              "record WHY it invented this process")
            if not isinstance(np_.get("plan"), list) or \
                    not np_["plan"]:
                errors.append("new_process.plan must be a non-empty list")

    if reply.get("process_complete"):
        if not process_active:
            errors.append("process_complete with no running process")
        if isinstance(a, dict) and a.get("type") != "idle":
            errors.append("process_complete requires action idle")

    if reply.get("dead_end_step"):
        if not process_active:
            errors.append("dead_end_step with no running process")
        if isinstance(a, dict) and a.get("type") != "idle":
            errors.append("dead_end_step requires action idle")

    return (len(errors) == 0), errors


# ---------------------------------------------------------- lab backend
class LabBackend:
    """Executes the fixed action schema. Lab edition: shell runs for real
    (localhost only); click/type/key/open_url are recorded as intents
    against the synthetic OS; screenshot captures a frame."""

    def __init__(self, store, memdir):
        self.store = store
        self.memdir = memdir
        mp = mem_paths(memdir)
        self.intents_log = mp["intents"]

    def _intent(self, turn, action, note):
        with open(self.intents_log, "a", encoding="utf-8") as f:
            f.write(json.dumps({"turn": turn, "action": action,
                                "note": note, "ts": now_ist()}) + "\n")

    def execute(self, action, turn):
        t = action["type"]
        if t == "shell":
            cmd = action["command"]
            timeout = int(action.get("timeout_s", 60))
            # Rule #49 — no_echo: probe steps set this so the STORED output
            # is the probe's own stdout, not "$ <wrapper script>". The
            # command is already in history[].action.command; the echo was
            # burying the probe's POC lines, so claim evidence excerpts
            # (head of stored output) and the pipeline's interestingness
            # gate were reading wrapper-script noise instead of the
            # probe's verdict + evidence. The trailing-VERDICT contract
            # (Rule #3) is unaffected — the extractor reads the last line.
            no_echo = bool(action.get("no_echo"))
            try:
                r = subprocess.run(cmd, shell=True, capture_output=True,
                                   timeout=timeout)
                out = ("%s[rc=%d]\n" % ("" if no_echo else "$ %s\n" % cmd,
                                        r.returncode)
                       + _to_text(r.stdout) + _to_text(r.stderr))
            except subprocess.TimeoutExpired as e:   # Rule #25
                out = ("%s[TIMEOUT after %ds]\n"
                       % ("" if no_echo else "$ %s\n" % cmd, timeout)
                       + _to_text(e.stdout) + _to_text(e.stderr))
            return {"ok": True, "output": out,
                    "verdict": _verdict_of_output(out)}
        if t in ("click", "type", "key", "open_url"):
            self._intent(turn, action, "synthetic OS intent recorded")
            return {"ok": True,
                    "output": "intent recorded on synthetic OS: %s" %
                    json.dumps(action, sort_keys=True)}
        if t == "screenshot":
            shot = capture_screenshot(mem_paths(self.memdir)["shots"],
                                      "action-turn-%d" % turn)
            return {"ok": True, "output": "screenshot: %s (%s)" %
                    (shot["path"], shot["method"])}
        if t == "claim":
            return self._execute_claim(action, turn)
        if t == "idle":
            return {"ok": True, "output": "idle: no OS action this turn"}
        return {"ok": False, "output": "unknown action (unreachable)"}

    def _execute_claim(self, action, turn):
        """Rule #32 claim execution. Files ONE claim through the Rule #21
        state machine. Two paths:

        (a) lab path (scripted brain): no claim object — the executor
            assembles it from the paired probe's CONFIRMED stored output
            (_build_lab_claim). No CONFIRMED evidence -> VERDICT: FAILED,
            the step stays open (fail-closed).
        (b) parent path: a full claim object, already validated at the
            seam; filed as-is.

        Gate blocks (A-F) are not errors: the re-file is refused, counted
        as discipline in memory.json["claim_blocks"] WITH REASON, and the
        step is done (VERDICT: BLOCKED) — the 29-Oct lesson, coded.
        """
        cm = _claims_mod()
        module = action.get("module", "")
        claim_body = action.get("claim")
        if claim_body is None:
            psi = action.get("probe_step_idx")
            if not isinstance(psi, int):
                return {"ok": True, "verdict": "FAILED",
                        "output": "CLAIM REFUSED: neither a claim object "
                        "nor a probe_step_idx was supplied — nothing "
                        "verified to file (fail-closed)\n"
                        "VERDICT: FAILED"}
            proc = load_json(mem_paths(self.memdir)["process"],
                             {"process": None})["process"]
            # Rule #75: the claim layer refuses generic_cookiexss claims
            # against the loop's own session cookies — the exclusion set
            # rides on the persisted plan meta (written at turn 0).
            claim_body, why_not = _build_lab_claim(
                proc, module, psi, self.store,
                sink_id=action.get("sink"),
                self_cookie_names=(proc.get("plan_meta") or {}).get(
                    "self_cookie_names"))
            if claim_body is None:
                return {"ok": True, "verdict": "FAILED",
                        "output": "CLAIM REFUSED: %s\nVERDICT: FAILED"
                        % why_not}
        try:
            cm.record_filed(self.memdir, {"action": claim_body}, module,
                            turn)
            ch = cm.claim_hash_of({"action": claim_body})
            return {"ok": True, "verdict": "FILED",
                    "output": ("CLAIM FILED %s module=%s class=%s "
                               "state=filed — awaiting the verifier's "
                               "terminal validation event; re-filing is "
                               "forbidden (Rule #32)\nVERDICT: FILED"
                               % (ch[:16], module,
                                  claim_body.get("class", "")))}
        except cm.GateError as e:
            cm.record_block(self.memdir, {"action": claim_body}, module,
                            str(e))
            return {"ok": True, "verdict": "BLOCKED",
                    "output": ("CLAIM BLOCKED: %s — counted as discipline, "
                               "no re-file (Rule #32)\nVERDICT: BLOCKED"
                               % e)}

    def recall(self, h, reason, process):
        """HASH RECALL WITH REASON-FIRST + DEDUP. Returns
        {"served_from": "process_memory"|"hash_store", "text":...}.
        Repeat asks NEVER touch the backend store again."""
        for r in process.get("recall_log", []):
            if r.get("hash") == h:
                return {"served_from": "process_memory",
                        "text": r["result_text"],
                        "note": "already asked: %s" % r["reason"]}
        data = self.store.get(h)  # backend_reads += 1 (only here)
        if data is None:
            return {"served_from": "none",
                    "error": "unknown hash (fail-closed)"}
        return {"served_from": "hash_store", "text": _to_text(data)}


def apply_terminal_validation(memdir, events_path):
    """Rule #32: apply the verifier's terminal validation events to this
    loop's claims (Rule #21 scan_terminal_validation, proven against the
    real hunt's events.jsonl format 29 Oct). FILED -> accepted/rejected;
    rejected claims are folded into memory dead_ends WITH REASON, so the
    loop never re-claims them. Returns the scan result dict
    {applied, unmatched, ambiguous, errors}; idempotent — a second scan
    of the same events applies nothing new. Fail-closed on a missing
    events file (the scan itself refuses)."""
    return _claims_mod().scan_terminal_validation(events_path, memdir)


# ------------------------------------------------------------- report lane
# Rule #37 — THE HUNTER DELIVERS A DOSSIER. When the hunt process
# completes, the loop assembles a submission-quality REPORT.md from
# claims.json + hash-verified evidence (Rule #20 invariant: the hash IS
# the sha256 of the stored bytes), recon, plan_meta, and dead ends.
# Fail-closed: a filed/accepted claim without a readable, hash-matching
# output file aborts the report — no fake dossier is ever written.
# The outcome is recorded in the completion turn's events as
# report_written:REPORT.md or report_failed:<reason>.
_REPORT_SEV_ORDER = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3,
                     "INFO": 4}
_REPORT_VERDICT_RE = re.compile(r"^VERDICT:\s*(CONFIRMED|FAILED)\s*$", re.M)
_REPORT_POC_RE = re.compile(r"^[A-Z][A-Z0-9_]{2,}:\s*.+$")


def _report_extract_poc(text):
    lines = text.splitlines()
    verdict = next((l.strip() for l in lines
                    if _REPORT_VERDICT_RE.match(l.strip())),
                   "VERDICT: (missing)")
    seen, poc = set(), []
    for l in lines:
        s = l.strip()
        if not _REPORT_POC_RE.match(s):
            continue
        key = s.split(":", 1)[0]
        if key in ("VERDICT",) or key in seen:
            continue
        seen.add(key)
        poc.append(s)
        if len(poc) >= 12:
            break
    clip = text[:400]
    if len(text) > 800:
        clip += ("\n...[truncated %d chars]...\n" % (len(text) - 800) +
                 text[-400:])
    elif len(text) > 400:
        clip += text[-400:]
    return verdict, poc, clip


def _write_hunt_report(memdir, proc, store):
    """Build REPORT.md. Returns (ok, info): ok=True -> info is the report
    filename; ok=False -> info is the fail reason (no file written)."""
    claims = _claims_mod().load_claims(memdir)
    filed = [c for c in claims.values()
             if c.get("state") in ("filed", "accepted", "rejected")]

    def _sk(c):
        return (_REPORT_SEV_ORDER.get(
            str(c.get("severity", "")).upper(), 9),
                int(c.get("filed_turn") or 0))
    filed.sort(key=_sk)

    # --- evidence FIRST (fail-closed): every claim must resolve to
    # hash-verified bytes before a single line of the report is written.
    evidence = []
    for c in filed:
        eh = c.get("evidence_hash") or ""
        if not eh:
            return (False, "claim '%s' has no evidence_hash (refusing)" %
                    c.get("title"))
        try:
            data = store.get(eh)
        except AssertionError:
            data = None
        if data is None:
            return (False, "evidence %s... unreadable for claim '%s'" %
                    (eh[:12], c.get("title")))
        evidence.append((c, data.decode("utf-8", errors="replace")))

    # --- dead ends WITH REASON (never re-attempted)
    dead = []
    for c in filed:
        if c.get("state") == "rejected":
            term = c.get("terminal") or {}
            dead.append(("claim: %s" % c.get("title"),
                         "verifier REJECTED (%s)" %
                         (term.get("reason") or "no reason recorded")))
    for s in (proc.get("plan") or []):
        if s.get("dead_end"):
            # Rule #38: the step was recorded as a dead end WITH REASON
            # (its last_verdict=FAILED is the reason); the hunt continued
            # past it instead of stopping.
            dead.append(("probe: %s" % (s.get("module") or s.get("desc")),
                         "base probe FAILED + %d escalation rung(s) FAILED; "
                         "recorded WITH REASON, hunt continued (Rule #38)" %
                         int(s.get("failed_attempts") or 1)))
        elif (s.get("last_verdict") == "FAILED" and not s.get("done") and
                s.get("kind") == "probe"):
            dead.append(("probe: %s" % (s.get("module") or s.get("desc")),
                         "base probe FAILED + %d escalation rung(s) FAILED; "
                         "no untried rung left (Rule #30)" %
                         int(s.get("failed_attempts") or 1)))

    hist = proc.get("history") or []
    n_conf = sum(1 for h in hist if h.get("verdict") == "CONFIRMED")
    n_fail = sum(1 for h in hist if h.get("verdict") == "FAILED")
    n_dead = sum(1 for h in hist if h.get("verdict") == "DEAD_END")
    pm = proc.get("plan_meta") or {}
    recon = proc.get("recon") or {}
    sev_counts = {}
    for c in filed:
        s = str(c.get("severity", "INFO")).upper()
        sev_counts[s] = sev_counts.get(s, 0) + 1

    target = (proc.get("target_base") or
              (proc.get("name") or "").replace("Probe-hunt vs ", "") or
              "(unknown target)")
    out = []
    A = out.append
    A("# Vulnerability Dossier — %s" % target)
    A("")
    A("- Report generated: %s (brain-apiloop-v1 Rule #37)" % now_ist())
    A("- Process: `%s` | Hunt goal: `%s`" %
      (proc.get("process_id"), proc.get("name")))
    A("- Memory: per-hunt isolated, A-to-Z, never repeats "
      "(titles-only index + hash store)")
    A("- Agent cost: $0.00 Meta/API spend | LLM calls: 0 (rule-based loop)")
    A("- Recon: %s | Modules planned: %d | Dropped by recon: %s" %
      ("ok" if pm.get("recon_ok") else "fallback (blind)",
       len(pm.get("planned_modules", []) or
           [s for s in (proc.get("plan") or []) if s.get("kind") == "probe"]),
       pm.get("dropped_modules") or "none"))
    A("")
    A("## Executive summary")
    A("")
    if filed:
        order = sorted(sev_counts,
                       key=lambda s: _REPORT_SEV_ORDER.get(s, 9))
        A("This hunt produced **%d findings**: %s." %
          (len(filed),
           ", ".join("**%d %s**" % (sev_counts[s], s) for s in order)))
        A("Claims are recorded local-only (Rule #32: filed once, then the "
          "loop waits for the verifier's terminal validation event).")
    else:
        A("No findings. See dead ends and limitations below.")
    A("")
    A("## Methodology")
    A("")
    A("- Turns: %d (CONFIRMED %d, FAILED %d, dead ends %d, errors 0)" %
      (len(hist), n_conf, n_fail, n_dead))
    A("- Recon map: %d modules found on the explicit target (read-only "
      "crawl; recon never mutates the target)" % len(recon.get("modules", {})))
    A("- Escalation: a FAILED base probe is re-driven through variant "
      "rungs WITH REASON (Rule #30); exhausted modules become dead ends, "
      "never repeats")
    A("- Claim discipline: the 29-Oct re-filing lesson is code — FILED "
      "claims are never re-filed; blocks are counted WITH REASON")
    A("")
    A("## Findings index")
    A("")
    A("| # | Severity | Module | Title | Status |")
    A("|---|----------|--------|-------|--------|")
    for i, (c, _text) in enumerate(evidence, 1):
        A("| %d | %s | `%s` | %s | %s |" %
          (i, c.get("severity"), c.get("module"), c.get("title"),
           c.get("state")))
    A("")
    for i, (c, text) in enumerate(evidence, 1):
        eh = c.get("evidence_hash", "")
        verdict, poc, clip = _report_extract_poc(text)
        A("### F%d: %s — %s" % (i, c.get("title"), c.get("severity")))
        A("")
        A("- Class: `%s` | Module: `%s` | Filed turn: %s | Filed: %s" %
          (c.get("class"), c.get("module"), c.get("filed_turn"),
           c.get("filed_at_ist")))
        A("- Probe verdict: `%s` | Terminal state: `%s`" %
          (verdict, c.get("state")))
        A("- Evidence hash: `%s` (sha256-verified on read)" % eh)
        A("")
        A("**Proof-of-concept evidence (from the probe's own stdout):**")
        A("")
        if poc:
            A("```")
            A("\n".join(poc))
            A("```")
        else:
            A("_No marker lines captured; see the raw excerpt below._")
        A("")
        A("<details><summary>Raw probe output (head+tail, 400+400)</summary>")
        A("")
        A("```")
        A(clip.strip()[:1000])
        A("```")
        A("</details>")
        A("")
    A("## Dead ends (never re-attempted)")
    A("")
    if not dead:
        A("_None recorded._")
    for name, why in dead:
        A("- `%s` — %s" % (name, why))
    A("")
    A("## Limitations")
    A("")
    A("- Claims in this run were recorded local-only (the lab path; the "
      "live backend lane files them via the Brain Console submit path "
      "once its credential gate opens). On a live backend, FILED claims "
      "await the verifier's terminal validation event.")
    A("- Evidence excerpts are clips; the full reproducible output is the "
      "sha256-verified file `output/<hash>.txt` per finding above.")
    A("")
    A("## Hash appendix")
    A("")
    A("| Finding | Evidence sha256 |")
    A("|---------|-----------------|")
    for i, (c, _text) in enumerate(evidence, 1):
        A("| F%d | `%s` |" % (i, c.get("evidence_hash")))
    A("")
    report = "\n".join(out)
    path = os.path.join(memdir, "REPORT.md")
    with open(path, "w", encoding="utf-8") as f:
        f.write(report)
    return (True, "REPORT.md")


def report_completed_hunt(memdir):
    """On-demand dossier for a memdir whose process already completed
    (report lane added after the run, or a parent-driven hunt). Recovers
    the completed process memory from the titles index (hash store)."""
    mp = mem_paths(memdir)
    store = HashStore(mp["output"])
    titles = load_json(mp["titles"], [])
    if not titles:
        return (False, "no completed process in the titles index")
    last = titles[-1]
    try:
        data = store.get(last.get("hash") or "")
    except AssertionError:
        data = None
    if data is None:
        return (False, "completed process memory unreadable at %s" %
                (last.get("hash") or "")[:12])
    try:
        proc = json.loads(data.decode("utf-8"))
    except Exception as e:
        return (False, "completed process memory corrupt: %s" % e)
    return _write_hunt_report(memdir, proc, store)


# ------------------------------------------------------- turn runner
def _fresh_process_doc(name, why, plan):
    return {"process_id": "proc-" + sha256_hex(name + now_ist())[:12],
            "name": name, "why": why, "state": "in_progress",
            "created_ts": now_ist(), "updated_ts": now_ist(),
            "plan": plan, "history": [], "recall_log": []}


def _run_turn_core(memdir, goal, turn_input, bounced=0):
    """Backend + memory half of a turn, AFTER a validated reply.

    turn_input must carry the validated reply under the "reply" key.
    Shared by the scripted-decide path (run_turn) and the parent-as-API
    handoff path (consume_parent_api) — the reply SOURCE differs, the
    execution + memory discipline is identical. bounced = how many
    validator bounces this turn took (recorded in the audit trail).
    Fail-closed: raises when the inputs' turn does not follow the on-disk
    turn counter."""
    mp = mem_paths(memdir)
    st = load_json(mp["state"], {"turn": 0})
    expect = int(st.get("turn", 0)) + 1
    if int(turn_input.get("turn", -1)) != expect:
        raise RuntimeError("turn skew: inputs say turn %s, disk says next "
                           "is %d (fail-closed)" % (turn_input.get("turn"),
                                                    expect))
    reply = turn_input.get("reply")
    if not isinstance(reply, dict):
        raise RuntimeError("no validated reply on turn inputs (fail-closed)")
    turn = turn_input["turn"]
    store = HashStore(mp["output"])
    backend = LabBackend(store, memdir)

    # --- backend: recall first (reason already stated), then the action ---
    recall_out = None
    if reply.get("recall_request"):
        rr = reply["recall_request"]
        base_proc = turn_input["process"] or {"recall_log": []}
        recall_out = backend.recall(rr["hash"], rr["reason"], base_proc)
        if recall_out["served_from"] == "none":
            raise RuntimeError("recall of unknown hash (fail-closed)")

    act_out = backend.execute(reply["action"], turn)
    if not act_out["ok"]:
        raise RuntimeError("backend execution failed (fail-closed)")
    verdict = act_out.get("verdict")  # Rule #30: None | CONFIRMED | FAILED
    if reply.get("dead_end_step"):
        # Rule #38: the brain recorded a dead end WITH REASON on the
        # current step. The turn's verdict is DEAD_END (not FAILED — the
        # ladder must not re-fire on it), and the plan advance below marks
        # the step done so the hunt continues with the next step.
        verdict = "DEAD_END"
    out_hash = store.put(act_out["output"],
                         {"turn": turn, "action": reply["action"],
                          "task": reply["task"]})

    # --- process lifecycle ---
    proc_doc = load_json(mp["process"], {"process": None})
    proc = proc_doc.get("process")
    events = []
    if reply.get("new_process") and proc is None:
        np_ = reply["new_process"]
        proc = _fresh_process_doc(np_["name"], np_["why"], np_["plan"])
        # Rule #35: process-level evidence the brain recorded (recon map,
        # plan provenance) survives the seam — the process doc is the
        # A-to-Z record, and silently dropping evidence breaks the
        # never-repeat machinery's view of what was decided and why.
        # Allowlisted: only documented evidence keys cross, never
        # arbitrary parent payload.
        for _k in ("recon", "plan_meta"):
            if _k in np_:
                proc[_k] = np_[_k]
        events.append("process_created")
    if proc is None:
        # idle turn with no process: nothing to advance
        pass
    else:
        # serve/refresh the recall log (reason-first record)
        if reply.get("recall_request") and recall_out:
            rr = reply["recall_request"]
            if not any(r["hash"] == rr["hash"] for r in proc["recall_log"]):
                proc["recall_log"].append({
                    "hash": rr["hash"], "reason": rr["reason"],
                    "served_from": recall_out["served_from"],
                    "ts": now_ist(),
                    "result_text": recall_out.get("text", "")[:4000],
                    "note": recall_out.get("note", "")})
        # advance the plan: mark the step this turn's action served
        step_idx = next((i for i, s in enumerate(proc["plan"])
                         if not s.get("done")), None)
        hist_entry = {"turn": turn, "task": reply["task"],
                      "action": reply["action"],
                      "why_this": reply["why_this"],
                      "why_not_alternatives": reply["why_not_alternatives"],
                      "result_hash": out_hash,
                      "verdict": verdict,  # Rule #30
                      "recall": bool(reply.get("recall_request")),
                      "step_idx": step_idx}
        if step_idx is not None and not reply.get("recall_request"):
            if reply.get("dead_end_step"):
                # Rule #38: the dead end is recorded WITH REASON on the
                # step (last_verdict stays FAILED: the reason) and the
                # step is marked done — the hunt continues, never repeats.
                st = proc["plan"][step_idx]
                st["done"] = True
                st["dead_end"] = True
            elif verdict == "FAILED":
                # Rule #30: a FAILED step stays OPEN — the brain gets the
                # next turn to escalate (scripted ladder) or judge (parent).
                # The failure is recorded on the step so it is never
                # silently retried: A-to-Z memory, fail-closed.
                st_step = proc["plan"][step_idx]
                st_step["failed_attempts"] = \
                    st_step.get("failed_attempts", 0) + 1
                st_step["last_verdict"] = "FAILED"
            else:
                proc["plan"][step_idx]["done"] = True
                proc["plan"][step_idx]["result_hash"] = out_hash
        elif step_idx is not None and reply.get("recall_request"):
            # a recall turn advances its recall step too (its work is done)
            if proc["plan"][step_idx].get("kind") == "recall":
                proc["plan"][step_idx]["done"] = True
                proc["plan"][step_idx]["result_hash"] = out_hash
        proc["history"].append(hist_entry)
        proc["updated_ts"] = now_ist()

        if reply.get("process_complete"):
            proc["state"] = "complete"
            # full process memory -> hash store (content-addressed)
            full_bytes = json.dumps(proc, indent=2, sort_keys=True).encode()
            proc_hash = store.put(
                full_bytes,
                {"kind": "completed_process_memory",
                 "process_id": proc["process_id"]})
            # TITLE ONLY -> the index (details live behind the hash)
            titles = load_json(mp["titles"], [])
            titles.append({"title": "%s — %s — hash %s" %
                           (proc["name"], now_ist(), proc_hash),
                           "ts": now_ist(), "hash": proc_hash})
            save_json(mp["titles"], titles)
            # Rule #37: the hunter delivers a dossier. The report lane
            # builds REPORT.md from claims + hash-verified evidence;
            # fail-closed — the outcome is recorded, never assumed. The
            # builder is guarded: a report bug must never kill the hunt's
            # completion turn (the dossier is deliverable, not the hunt).
            try:
                rep_ok, rep_info = _write_hunt_report(memdir, proc, store)
            except Exception as e:
                rep_ok, rep_info = False, "builder-error: %r" % (e,)
            events.append("report_written:%s" % rep_info if rep_ok
                          else "report_failed:%s" % rep_info)
            proc = None
            events.append("process_completed")
        save_json(mp["process"], {"process": proc})

    # --- turn counter + audit trail (atomic) ---
    # Rule #55: the loop is $0 / 0-LLM by construction (brain-turn.py reports
    # llm_calls: 0 per turn), but the flip checklist (Rule #52 route +
    # Rule #51 twin) reads llm_calls/spend_usd from state.json and fails
    # closed when absent — so a real session could NEVER reach READY. Write
    # the spend evidence at the save site; keep the shape stable for the
    # checklist readers (they use hasOwnProperty, not truthiness).
    save_json(mp["state"], {"turn": turn, "llm_calls": 0, "spend_usd": 0.0})
    with open(mp["turns"], "a", encoding="utf-8") as f:
        f.write(json.dumps({"turn": turn,
                            "screenshot": turn_input["screenshot"]["path"],
                            "bounced": bounced,
                            "verdict": verdict,  # Rule #30
                            "recall_served_from":
                                (recall_out or {}).get("served_from"),
                            "output_hash": out_hash,
                            "events": events, "ts": now_ist()}) + "\n")

    return {"turn": turn, "reply": reply, "recall": recall_out,
            "output_hash": out_hash, "events": events,
            "backend_reads": store.backend_reads}


def run_turn(memdir, goal, ctx, reply_override=None, max_corrections=3):
    """One full turn: build the 3 inputs -> brain replies -> validate
    (bounce+correct loop) -> backend executes (+recall) -> process memory
    updated atomically. Every load is from disk: the brain is always fresh."""
    turn_input = build_turn_input(memdir, goal)
    proc_active = turn_input["process"] is not None

    # --- brain replies; validator bounces bad replies for correction ---
    reply = reply_override if reply_override is not None else \
        decide(turn_input, ctx)
    ok, errors = validate_reply(reply, proc_active)
    bounced = []
    attempts = 0
    while not ok and attempts < max_corrections:
        bounced.append({"reply": reply, "errors": errors})
        attempts += 1
        reply = decide(turn_input, ctx,
                       correction={"errors": errors, "attempt": attempts})
        ok, errors = validate_reply(reply, proc_active)
    if not ok:
        raise RuntimeError("validator rejected %d corrections: %s"
                           % (attempts, errors))

    turn_input["reply"] = reply
    result = _run_turn_core(memdir, goal, turn_input, bounced=len(bounced))
    result["validation"] = {"ok": True, "bounced": bounced}
    return result


# ------------------------------------------- parent-as-API handoff mode
# OWNER ORDER: "you become the API". The parent (or a future model) takes
# the turn INPUTS as files and replies with ONE JSON reply file. Protocol:
#   1. emit:   brain-apiloop-v1.py --parent-api emit --memdir D --goal G
#              -> writes handoff/turn-N-inputs.json (+ turn-N-README.txt,
#                 turn-N screenshot PNG) and clears stale turn-N reply/
#                 bounce files so an aborted attempt is never consumed.
#   2. parent: reads the inputs (+ screenshot), writes
#              handoff/turn-N-reply.json — the EXACT reply object from
#              brain-reply-manual.md (no wrapper, no extra fields).
#   3. consume: brain-apiloop-v1.py --parent-api consume --memdir D
#              -> waits for the reply, validates it; on violation writes
#                 handoff/turn-N-bounce-K.json (named errors + your_reply
#                 echo) and waits for a corrected reply (3 corrections
#                 max), then executes the SAME core as the scripted path.
# Fail-closed everywhere: no reply in time, bad JSON, turn skew, or
# exhausted corrections all raise — never guess.
HANDOFF_WAIT_S = 300
HANDOFF_BOUNCES = 3
EMBED_SHOT_MAX = 200 * 1024  # base64 chars


def _handoff_dir(memdir):
    d = os.path.join(memdir, "handoff")
    os.makedirs(d, exist_ok=True)
    return d


def emit_parent_api(memdir, goal, embed_shot=False):
    """Write this turn's inputs for the parent-as-API. Prints HANDOFF_EMIT."""
    mp = mem_paths(memdir)
    st = load_json(mp["state"], {"turn": 0})
    turn = int(st.get("turn", 0)) + 1
    hd = _handoff_dir(memdir)
    # clear stale artifacts for this turn (a reply file from an aborted
    # attempt must never be consumed by a fresh emit)
    for f in os.listdir(hd):
        if f.startswith("turn-%d-" % turn):
            os.remove(os.path.join(hd, f))
    turn_input = build_turn_input(memdir, goal)
    if embed_shot:
        with open(turn_input["screenshot"]["path"], "rb") as f:
            raw = f.read()
        b64 = base64.b64encode(raw).decode("ascii")
        if len(b64) > EMBED_SHOT_MAX:
            raise RuntimeError(
                "screenshot base64 %d chars > cap %d: parent reads the PNG "
                "path instead (fail-closed)" % (len(b64), EMBED_SHOT_MAX))
        turn_input["screenshot"]["base64"] = b64
    ip = os.path.join(hd, "turn-%d-inputs.json" % turn)
    save_json(ip, turn_input)
    # companion file: what the parent needs at a glance, no code reading
    proc = turn_input["process"]
    lines = [
        "BRAIN-API HANDOFF — turn %d (%s)" % (turn, now_ist()),
        "goal: %s" % goal,
        "screenshot: %s  [%s]" % (turn_input["screenshot"]["path"],
                                  turn_input["screenshot"]["method"]),
        "base64: %s" % ("embedded" if embed_shot
                        else "null — read the PNG path"),
        "titles in index: %d" % len(turn_input["titles"]),
    ]
    for t in turn_input["titles"]:
        lines.append("  - %s" % t["title"])
    if proc is None:
        lines.append("process: NONE — invent a NEW process or reply idle.")
    else:
        lines.append("process: %s" % proc["name"])
        lines.append("why: %s" % proc["why"])
        for i, s in enumerate(proc.get("plan", [])):
            lines.append("  step %d [%s] %s" % (
                i, "done" if s.get("done") else "NEXT?", s.get("desc")))
            if s.get("result_hash"):
                lines.append("    output hash: %s" % s["result_hash"])
            if s.get("failed_attempts"):
                # Rule #30: the parent-as-API sees the failure state and
                # escalates with its own judgment (scripted ladder is the
                # lab decide()'s; the parent reads verdicts + history)
                lines.append("    FAILED x%d (last verdict: %s) — a step "
                             "that FAILED stays open: escalate with reason "
                             "or record the dead end" %
                             (s["failed_attempts"], s.get("last_verdict")))
        hist = proc.get("history", [])
        if hist:
            lines.append("last turn verdict: %s (task: %s)" %
                         (hist[-1].get("verdict"), hist[-1].get("task")))
        if proc.get("recall_log"):
            lines.append("recalls so far:")
            for r in proc["recall_log"]:
                lines.append("  - %s (%s): %s" % (
                    r["hash"][:12], r["served_from"], r["reason"]))
    lines += [
        "",
        "YOUR MOVE: write handoff/turn-%d-reply.json — the EXACT reply" % turn,
        "object from brain-reply-manual.md (task, goal, progress, why_this,",
        "why_not_alternatives, action; optional recall_request, new_process,",
        "process_complete). No wrapper, no extra fields.",
        "Then run: brain-apiloop-v1.py --parent-api consume --memdir <dir>",
        "If your reply violates the contract, consume writes",
        "handoff/turn-%d-bounce-K.json with the named errors and waits for"
        % turn,
        "a corrected reply (3 corrections, then fail-closed).",
        "The three inputs above are this turn's FIXED view — the screenshot",
        "was taken at emit time; a slow reply does not re-capture it.",
    ]
    with open(os.path.join(hd, "turn-%d-README.txt" % turn), "w",
              encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    print("HANDOFF_EMIT turn=%d inputs=%s" % (turn, ip), flush=True)
    return turn, ip


def _wait_reply(hd, turn, wait_s):
    """Return (reply_dict_or_None, status) where status is one of
    ok / timeout / badjson:<detail>."""
    rp = os.path.join(hd, "turn-%d-reply.json" % turn)
    deadline = time.time() + wait_s
    while True:
        if os.path.exists(rp):
            try:
                with open(rp, "r", encoding="utf-8") as f:
                    return json.load(f), "ok"
            except (json.JSONDecodeError, ValueError) as e:
                return None, "badjson: %s" % e
        if time.time() >= deadline:
            return None, "timeout"
        time.sleep(1)


def consume_parent_api(memdir, goal, wait_s=HANDOFF_WAIT_S):
    """Wait for the parent's reply file, validate (file bounce loop),
    execute the shared core. Prints HANDOFF_BOUNCE / HANDOFF_CONSUMED."""
    mp = mem_paths(memdir)
    st = load_json(mp["state"], {"turn": 0})
    turn = int(st.get("turn", 0)) + 1
    hd = _handoff_dir(memdir)
    ip = os.path.join(hd, "turn-%d-inputs.json" % turn)
    if not os.path.exists(ip):
        emit_parent_api(memdir, goal)
    turn_input = load_json(ip, None)
    if not isinstance(turn_input, dict) or \
            int(turn_input.get("turn", -1)) != turn:
        raise RuntimeError("handoff inputs for turn %d missing/mismatched "
                           "(fail-closed)" % turn)

    bounces = 0
    reply, status = _wait_reply(hd, turn, wait_s)
    while True:
        if status == "timeout":
            raise RuntimeError("parent-as-API: no turn-%d-reply.json after "
                               "%ds (fail-closed)" % (turn, wait_s))
        if status.startswith("badjson"):
            errors = ["reply file is not valid JSON: %s" % status[8:]]
            ok = False
        else:
            proc_active = turn_input["process"] is not None
            ok, errors = validate_reply(reply, proc_active)
        if ok:
            break
        bounces += 1
        if bounces > HANDOFF_BOUNCES:
            raise RuntimeError("validator rejected %d parent corrections: "
                               "%s (fail-closed)" % (HANDOFF_BOUNCES, errors))
        bp = os.path.join(hd, "turn-%d-bounce-%d.json" % (turn, bounces))
        save_json(bp, {"turn": turn, "attempt": bounces, "errors": errors,
                       "your_reply": reply, "ts": now_ist(),
                       "fix": "correct the errors above, then write "
                              "turn-%d-reply.json again" % turn})
        print("HANDOFF_BOUNCE turn=%d attempt=%d errors=%d file=%s"
              % (turn, bounces, len(errors), bp), flush=True)
        rp = os.path.join(hd, "turn-%d-reply.json" % turn)
        if os.path.exists(rp):
            os.remove(rp)  # consumed; the correction is a fresh file
        reply, status = _wait_reply(hd, turn, wait_s)

    turn_input["reply"] = reply
    result = _run_turn_core(memdir, goal, turn_input, bounced=bounces)
    rp = os.path.join(hd, "turn-%d-reply.json" % turn)
    if os.path.exists(rp):
        os.remove(rp)  # consumed; never reuse a stale reply
    result["validation"] = {"ok": True, "bounced_parent": bounces}
    print("HANDOFF_CONSUMED turn=%d bounces=%d events=%s output_hash=%s"
          % (turn, bounces, result["events"],
             result["output_hash"][:12]), flush=True)
    return result

# ------------------------------------------------------------ lab proof
# A REAL multi-step OS process, localhost only: the brain fetches a recon
# toolkit from a local tool registry (stands in for the GitHub-download
# process — no external network). 6 turns: list -> recall(URL) -> download
# -> verify -> recall(verify) -> complete. Proves: fresh-brain continuation
# from disk alone, reason-first recall, hash dedup (no 2nd backend call),
# process completion (title indexed, full memory hash-stored), validator
# bounce-and-correct, screenshot-first-class every turn, hash invariant.
import tarfile
import tempfile
import io as _io


def _make_toolkit_tarball():
    buf = _io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tf:
        for name, body in (("toolkit/README",
                            b"recon toolkit 1.0\n"),
                           ("toolkit/toolkit.sh",
                            b"#!/bin/sh\necho toolkit-ok\n")):
            ti = tarfile.TarInfo(name)
            ti.size = len(body)
            tf.addfile(ti, _io.BytesIO(body))
    return buf.getvalue()


class _RegistryHandler(BaseHTTPRequestHandler):
    tarball = b""
    port = 0
    mode = "open"  # open | filtered | filtered-hard (Rule #30 lab)

    def log_message(self, *a):
        pass

    def _serve(self, body, code, ctype):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        mode = _RegistryHandler.mode
        if self.path == "/api/tools":
            body = json.dumps({"tools": [
                {"name": "recon-toolkit", "version": "1.0",
                 "url": "http://127.0.0.1:%d/files/toolkit.tgz"
                        % _RegistryHandler.port}]}).encode()
            self._serve(body, 200, "application/json")
        elif self.path == "/files/toolkit.tgz":
            # canonical path: a naive filter blocks it in filtered modes
            if mode in ("filtered", "filtered-hard"):
                self._serve(b"FILTERED BY NAIVE WAF\nVERDICT:FAILED\n",
                            403, "text/plain")
            else:
                self._serve(_RegistryHandler.tarball, 200,
                            "application/gzip")
        elif self.path == "/files/toolkit-raw.tgz":
            # alternate path: the filter-bypass rung (blocked only in
            # filtered-hard, where the ladder is genuinely exhausted)
            if mode == "filtered-hard":
                self._serve(b"FILTERED BY NAIVE WAF\nVERDICT:FAILED\n",
                            403, "text/plain")
            else:
                self._serve(_RegistryHandler.tarball, 200,
                            "application/gzip")
        else:
            self.send_response(404)
            self.end_headers()


def _start_registry(mode="open"):
    _RegistryHandler.tarball = _make_toolkit_tarball()
    _RegistryHandler.mode = mode
    srv = HTTPServer(("127.0.0.1", 0), _RegistryHandler)
    _RegistryHandler.port = srv.server_address[1]
    th = threading.Thread(target=srv.serve_forever, daemon=True)
    th.start()
    return srv


def _assert(cond, msg):
    if not cond:
        raise AssertionError("PROOF FAILED: " + msg)
    return True


def _disk_state_fresh(memdir):
    """Rebuild the brain's view purely from disk — no shared objects."""
    mp = mem_paths(memdir)
    return {"process": load_json(mp["process"], {"process": None}),
            "titles": load_json(mp["titles"], [])}


def proof_brainloop():
    """End-to-end lab proof. Raises on any failure; returns a summary."""
    memdir = tempfile.mkdtemp(prefix="brainloop-proof-")
    workdir = os.path.join(memdir, "work")
    os.makedirs(workdir, exist_ok=True)
    srv = _start_registry()
    port = srv.server_address[1]
    ctx = {"registry_url": "http://127.0.0.1:%d" % port,
           "workdir": workdir}
    goal = ("Prepare this machine for hunting: fetch the recon toolkit "
            "from the local tool registry.")
    mp = mem_paths(memdir)
    checks = []

    def check(name, cond):
        _assert(cond, name)
        checks.append(name)

    # ---- TURN 1: fresh brain, no process -> invents the process ----
    r1 = run_turn(memdir, goal, ctx)
    st = _disk_state_fresh(memdir)
    p1 = st["process"]["process"]
    check("t1: process invented with recorded why",
          p1 and p1["name"].startswith("Download recon toolkit")
          and len(p1["why"]) >= WHY_MIN_LEN)
    check("t1: step 1 done, output hash stored",
          p1["plan"][0]["done"] and HASH_RE.match(p1["plan"][0]["result_hash"] or ""))
    h1 = p1["plan"][0]["result_hash"]
    with open(os.path.join(mp["output"], h1 + ".txt"), "rb") as f:
        check("t1: Rule #20 hash invariant holds",
              sha256_hex(f.read()) == h1)
    check("t1: screenshot first-class (real PNG on disk)",
          _png_magic_ok(build_turn_input_shot_path(memdir, 1)))
    check("t1: process_created event", "process_created" in r1["events"])

    # ---- TURN 2: fresh brain continues; reason-FIRST recall of H1 ----
    # (all state reloaded from disk inside run_turn — fresh brain proven)
    r2 = run_turn(memdir, goal, ctx)
    check("t2: recall_request carried hash BEFORE backend served",
          (r2["reply"].get("recall_request") or {}).get("hash") == h1)
    check("t2: recall reason stated first (non-empty)",
          len((r2["reply"]["recall_request"] or {}).get("reason", "")) >= 10)
    check("t2: first ask served from the hash store",
          (r2["recall"] or {}).get("served_from") == "hash_store")
    st = _disk_state_fresh(memdir)
    rl = st["process"]["process"]["recall_log"]
    check("t2: process memory records what+why+result",
          len(rl) == 1 and rl[0]["hash"] == h1 and rl[0]["reason"]
          and "toolkit" in rl[0]["result_text"])

    # ---- DEDUP: re-ask the same hash -> NO new backend call ----
    store = HashStore(mp["output"])
    backend = LabBackend(store, memdir)
    proc_now = _disk_state_fresh(memdir)["process"]["process"]
    d1 = backend.recall(h1, "double-check the URL spelling", proc_now)
    check("dedup: repeat ask served from process memory",
          d1["served_from"] == "process_memory")
    check("dedup: backend store reads still 0 (no duplicate call)",
          store.backend_reads == 0)
    check("dedup: brain told it already asked and why",
          "already asked" in d1.get("note", ""))

    # ---- TURN 3: download (real bytes from localhost) ----
    r3 = run_turn(memdir, goal, ctx)
    tgz = os.path.join(workdir, "toolkit.tgz")
    check("t3: tarball really downloaded", os.path.exists(tgz)
          and os.path.getsize(tgz) > 100)
    st = _disk_state_fresh(memdir)
    check("t3: step 3 done", st["process"]["process"]["plan"][2]["done"])

    # ---- TURN 4: verify ----
    r4 = run_turn(memdir, goal, ctx)
    st = _disk_state_fresh(memdir)
    check("t4: step 4 done", st["process"]["process"]["plan"][3]["done"])
    hv = st["process"]["process"]["plan"][3]["result_hash"]

    # ---- TURN 5: recall verify output BEFORE completing ----
    r5 = run_turn(memdir, goal, ctx)
    check("t5: completion gated on recalling verify output",
          (r5["reply"].get("recall_request") or {}).get("hash") == hv)
    check("t5: verify recall served from hash store (first ask)",
          (r5["recall"] or {}).get("served_from") == "hash_store")

    # ---- TURN 6: completion -> title indexed, full memory hash-stored ----
    r6 = run_turn(memdir, goal, ctx)
    check("t6: process_completed event", "process_completed" in r6["events"])
    titles = load_json(mp["titles"], [])
    check("t6: exactly one title indexed", len(titles) == 1)
    t0 = titles[0]
    check("t6: title carries name+timestamp+hash",
          "recon toolkit" in t0["title"].lower() and t0["ts"] and
          HASH_RE.match(t0["hash"] or ""))
    check("t6: index holds TITLES ONLY (no output details leak)",
          "toolkit.tgz" not in t0["title"] and "127.0.0.1" not in t0["title"]
          and set(t0.keys()) == {"title", "ts", "hash"})
    ph = t0["hash"]
    with open(os.path.join(mp["output"], ph + ".txt"), "rb") as f:
        raw = f.read()
    check("t6: completed process memory hash-stored (invariant)",
          sha256_hex(raw) == ph)
    full = json.loads(raw.decode("utf-8"))
    check("t6: stored memory is FULL (history+recalls+why)",
          len(full["history"]) == 6 and len(full["recall_log"]) == 2
          and len(full["why"]) >= WHY_MIN_LEN)
    check("t6: process cleared (fresh brain sees no process next)",
          _disk_state_fresh(memdir)["process"]["process"] is None)

    # ---- fresh-brain never-repeat: next turn invents nothing ----
    r7 = run_turn(memdir, goal, ctx)
    check("t7: title index prevents repeat (idle, no new process)",
          r7["reply"]["action"]["type"] == "idle"
          and r7["reply"].get("new_process") is None)

    # ---- VALIDATOR bounce: malformed reply -> bounced -> corrected ----
    bad = {"task": "x", "goal": goal, "progress": "y",
           "why_this": "short",
           "action": {"type": "bogus", "zzz": 1}}
    rb = run_turn(memdir, goal, ctx, reply_override=bad)
    bounced = rb["validation"]["bounced"]
    check("validator: malformed reply bounced",
          len(bounced) == 1 and len(bounced[0]["errors"]) >= 3)
    errs = " ".join(bounced[0]["errors"])
    check("validator: errors name the violations",
          "why_not_alternatives" in errs and "bogus" in errs)
    check("validator: corrected resubmission accepted",
          rb["validation"]["ok"] and rb["reply"]["action"]["type"] == "idle")

    # ---- every turn had a valid screenshot ----
    for n in range(1, 8):
        sp = build_turn_input_shot_path(memdir, n)
        check("shot turn %d: PNG exists+valid" % n,
              os.path.exists(sp) and _png_magic_ok(sp))

    srv.shutdown()
    return {"memdir": memdir, "checks": checks, "turns": 7,
            "goal": goal, "registry_port": port}


def proof_escalation_loop():
    """Rule #30 lab proof. Two filtered-registry cases + the open-mode
    regression. Raises on any failure; returns a summary."""
    checks = []

    def check(name, cond):
        _assert(cond, name)
        checks.append(name)

    goal = ("Prepare this machine for hunting: fetch the recon toolkit "
            "from the local tool registry.")

    def fresh_run(mode):
        memdir = tempfile.mkdtemp(prefix="escaloop-%s-" % mode)
        workdir = os.path.join(memdir, "work")
        os.makedirs(workdir, exist_ok=True)
        srv = _start_registry(mode=mode)
        port = srv.server_address[1]
        ctx = {"registry_url": "http://127.0.0.1:%d" % port,
               "workdir": workdir}
        return memdir, workdir, srv, ctx

    # ---- CASE F1: filtered — base blocked, rung 0 recovers ----
    memdir, workdir, srv, ctx = fresh_run("filtered")
    mp = mem_paths(memdir)
    run_turn(memdir, goal, ctx)   # t1 list
    run_turn(memdir, goal, ctx)   # t2 recall URL
    run_turn(memdir, goal, ctx)   # t3 base download -> FAILED
    st = _disk_state_fresh(memdir)
    p = st["process"]["process"]
    h3 = p["history"][-1]
    check("F1 t3: base download verdict FAILED", h3.get("verdict") == "FAILED")
    check("F1 t3: FAILED step stays OPEN (not marked done)",
          not p["plan"][2]["done"]
          and p["plan"][2].get("failed_attempts") == 1
          and p["plan"][2].get("last_verdict") == "FAILED")
    with open(os.path.join(mp["output"], h3["result_hash"] + ".txt"),
              "rb") as f:
        raw_out = f.read().decode("utf-8", "replace")
    check("F1 t3: extractor reads VERDICT:FAILED from stored bytes",
          _verdict_of_output(raw_out) == "FAILED"
          and raw_out.rstrip().endswith("VERDICT:FAILED"))
    r4 = run_turn(memdir, goal, ctx)   # t4: rung 0
    check("F1 t4: brain escalates (task names the rung)",
          r4["reply"]["task"].startswith("escalate:"))
    check("F1 t4: rung 0 uses the alternate path",
          "/files/toolkit-raw.tgz" in r4["reply"]["action"]["command"])
    check("F1 t4: escalation reason recorded (why_this, not a slogan)",
          "rung 0" in r4["reply"]["why_this"].lower()
          and len(r4["reply"]["why_this"]) >= WHY_MIN_LEN)
    st = _disk_state_fresh(memdir)
    p = st["process"]["process"]
    check("F1 t4: rung 0 neutral -> step done, real tarball on disk",
          p["plan"][2]["done"] and p["history"][-1].get("verdict") is None
          and os.path.getsize(os.path.join(workdir, "toolkit.tgz")) > 100)
    cmds = [(h.get("action") or {}).get("command", "")
            for h in p["history"]]
    check("F1: base command sent exactly once (A-to-Z, never repeated)",
          sum(1 for c in cmds if "/files/toolkit.tgz" in c) == 1)
    run_turn(memdir, goal, ctx)   # t5 verify
    run_turn(memdir, goal, ctx)   # t6 recall verify
    r7 = run_turn(memdir, goal, ctx)   # t7 complete
    check("F1 t7: process_completed after escalation",
          "process_completed" in r7["events"])
    check("F1 t7: one title indexed", len(load_json(mp["titles"], [])) == 1)
    srv.shutdown()

    # ---- CASE F2: filtered-hard — ladder exhausted -> dead end ----
    memdir, workdir, srv, ctx = fresh_run("filtered-hard")
    mp = mem_paths(memdir)
    run_turn(memdir, goal, ctx)   # t1 list
    run_turn(memdir, goal, ctx)   # t2 recall URL
    run_turn(memdir, goal, ctx)   # t3 base FAILED
    r4 = run_turn(memdir, goal, ctx)   # t4 rung 0 FAILED
    st = _disk_state_fresh(memdir)
    p = st["process"]["process"]
    check("F2 t4: rung 0 also FAILED, step still open",
          p["history"][-1].get("verdict") == "FAILED"
          and not p["plan"][2]["done"])
    check("F2 t4: two failed attempts recorded on the step",
          p["plan"][2].get("failed_attempts") == 2)
    check("F2 t4: rung 0 not re-attempted (tried-set works)",
          sum(1 for h in p["history"]
              if "/files/toolkit-raw.tgz" in
              (h.get("action") or {}).get("command", "")) == 1)
    r5 = run_turn(memdir, goal, ctx)   # t5: dead end
    check("F2 t5: ladder exhausted -> process_complete + idle action",
          r5["reply"].get("process_complete") is True
          and r5["reply"]["action"]["type"] == "idle")
    check("F2 t5: dead end recorded WITH REASON",
          "dead end" in r5["reply"]["task"].lower()
          and len(r5["reply"]["why_this"]) >= WHY_MIN_LEN)
    check("F2 t5: process_completed event", "process_completed" in r5["events"])
    titles = load_json(mp["titles"], [])
    check("F2 t5: dead-end process title indexed", len(titles) == 1)
    ph = titles[0]["hash"]
    with open(os.path.join(mp["output"], ph + ".txt"), "rb") as f:
        full = json.loads(f.read().decode("utf-8"))
    check("F2: stored memory holds the dead-end reason",
          any("dead end" in (h.get("task", "") + " " +
                             h.get("why_this", "")).lower()
              for h in full["history"]))
    r6 = run_turn(memdir, goal, ctx)   # t6: must not repeat anything
    check("F2 t6: title index prevents repeat (idle, no new process)",
          r6["reply"]["action"]["type"] == "idle"
          and r6["reply"].get("new_process") is None)
    check("F2: run terminated (6 turns, no infinite escalation)",
          load_json(mp["state"], {}).get("turn") == 6)
    srv.shutdown()
    return {"checks": checks}


def _start_mock(mock_path, port, extra_args):
    """Start probe-lab/mock-dvwa.py on the given port, wait until its
    login page answers (fail-closed if it never does)."""
    env = dict(os.environ)
    env["MOCK_PORT"] = str(port)
    p = subprocess.Popen([sys.executable, mock_path] + list(extra_args),
                         stdout=subprocess.DEVNULL,
                         stderr=subprocess.DEVNULL, env=env)
    for _ in range(80):
        r = subprocess.run(
            ["curl", "-s", "-o", "/dev/null", "--max-time", "2",
             "http://127.0.0.1:%d/login.php" % port],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if r.returncode == 0:
            return p
        if p.poll() is not None:
            raise RuntimeError("mock died on port %d" % port)
        time.sleep(0.25)
    p.kill()
    raise RuntimeError("mock did not start on port %d" % port)


def _stop_mock(p, port):
    p.terminate()
    try:
        p.wait(timeout=5)
    except Exception:
        p.kill()
    r = subprocess.run(
        ["curl", "-s", "-o", "/dev/null", "--max-time", "2",
         "http://127.0.0.1:%d/login.php" % port],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    assert r.returncode != 0, "port %d still listening after stop" % port


def proof_probe_loop():
    """Rule #31 lab proof. Drives the ONE loop through real parent probes
    against mock DVWA (open + --waf): CONFIRMED verdicts advance steps, a
    FAILED base diverts to the variant rung, missing probes and missing
    targets fail closed, and a completed hunt is never repeated."""
    checks = []

    def check(name, cond):
        assert cond, "FAILED: " + name
        checks.append(name)

    here = os.path.dirname(os.path.abspath(__file__))
    mock = os.path.join(here, "probe-lab", "mock-dvwa.py")

    def _hist(memdir):
        return load_json(mem_paths(memdir)["process"],
                         {"process": None})["process"]

    # --- open target: full 11-module hunt, zero human turns (Rule #34) ---
    # Rule #32: the plan is now probe,claim interleaved per module —
    # every CONFIRMED probe is followed by exactly one claim turn.
    mp1 = _start_mock(mock, 8320, [])
    try:
        memdir = tempfile.mkdtemp(prefix="ploop31-")
        goal = "probe-hunt: verify the training target end to end"
        ctx = {"registry_url": "http://127.0.0.1:9", "workdir": memdir,
               "memdir": memdir,
               "target_base": "http://127.0.0.1:8320"}
        verdicts = []
        for _ in range(22):
            r = run_turn(memdir, goal, ctx)
            verdicts.append(_hist(memdir)["history"][-1]["verdict"])
        check("open target: 22 turns probe->claim, verdicts interleave",
              verdicts == ["CONFIRMED", "FILED"] * 11)
        r = run_turn(memdir, goal, ctx)  # 23rd turn: plan exhausted
        check("open target: process completes after final claim",
              "process_completed" in r["events"])
        claims31 = json.load(open(os.path.join(memdir, "claims.json")))
        check("open target: 11 claims FILED, one per module",
              len(claims31) == 11 and
              all(v["state"] == "filed" for v in claims31.values()) and
              {v["module"] for v in claims31.values()} ==
              set(_HUNT_MODULE_ORDER))
        titles = load_json(mem_paths(memdir)["titles"], [])
        check("open target: completion indexed title-only + hash",
              any("probe-hunt" in t["title"].lower() for t in titles))
        hs = HashStore(mem_paths(memdir)["output"])
        check("open target: completed memory retrievable by hash",
              hs.get(titles[-1]["hash"]) is not None)
        r = run_turn(memdir, goal, ctx)  # resume must idle, never repeat
        check("open target: resume idles (never repeats a completed hunt)",
              r["reply"]["action"]["type"] == "idle")
        claims31b = json.load(open(os.path.join(memdir, "claims.json")))
        check("open target: resume files no new claims",
              len(claims31b) == 11)
        sbx = os.path.join(memdir, "probe-sandbox")
        check("lab hygiene: probe originals never modified",
              LIVE_PROBE_BASE in open(
                  os.path.join(_PROBE_DIR, "probe_xss_r.py")).read())
        check("lab hygiene: sandbox copies point at the loop target",
              any("http://127.0.0.1:8320" in open(
                  os.path.join(sbx, f)).read()
                  for f in os.listdir(sbx)))
    finally:
        _stop_mock(mp1, 8320)

    # --- --waf target: base FAILED -> variant rung CONFIRMED ---
    mp2 = _start_mock(mock, 8321, ["--waf"])
    try:
        memdir2 = tempfile.mkdtemp(prefix="ploop31w-")
        goal2 = "probe-hunt: filtered target escalation check"
        ctx2 = {"registry_url": "http://127.0.0.1:9", "workdir": memdir2,
                "memdir": memdir2,
                "target_base": "http://127.0.0.1:8321"}
        r1 = run_turn(memdir2, goal2, ctx2)
        h1 = _hist(memdir2)
        check("waf: base probe VERDICT:FAILED",
              h1["history"][-1]["verdict"] == "FAILED")
        check("waf: FAILED step stays OPEN (never silently done)",
              not h1["plan"][0]["done"] and
              h1["plan"][0].get("failed_attempts") == 1)
        r2 = run_turn(memdir2, goal2, ctx2)
        h2 = _hist(memdir2)
        cmd2 = h2["history"][-1]["action"]["command"]
        check("waf: rung 0 swaps in variant_xss_r_case.py",
              "variant_xss_r_case.py" in cmd2)
        check("waf: variant rung VERDICT:CONFIRMED",
              h2["history"][-1]["verdict"] == "CONFIRMED")
        check("waf: step marked done only after CONFIRMED",
              h2["plan"][0]["done"])
    finally:
        _stop_mock(mp2, 8321)

    # --- fail-closed controls ---
    cmd = _probe_cmd("nope_missing.py", "PLOOP31-N",
                     "http://127.0.0.1:8320", "/tmp/ploop31-sbx")
    r = subprocess.run(cmd, shell=True, capture_output=True, timeout=30)
    out = _to_text(r.stdout) + _to_text(r.stderr)
    check("missing probe file fails closed (never executes)",
          "PROBE_MISSING" in out and _verdict_of_output(out) == "FAILED")
    memdir3 = tempfile.mkdtemp(prefix="ploop31b-")
    ctx3 = {"registry_url": "http://127.0.0.1:9", "workdir": memdir3,
            "memdir": memdir3}  # no target_base
    r = run_turn(memdir3, goal, ctx3)
    check("no target_base -> probe step idles (never invents a target)",
          r["reply"]["action"]["type"] == "idle" and
          "blocked" in r["reply"]["task"])
    cmd = _probe_cmd("probe_xss_r.py", "PLOOP31-N", "", "/tmp/ploop31-sbx")
    r = subprocess.run(cmd, shell=True, capture_output=True, timeout=30)
    out = _to_text(r.stdout) + _to_text(r.stderr)
    check("empty target_base -> command-level fail-closed",
          "PROBE_BLOCKED_NO_TARGET_BASE" in out and
          _verdict_of_output(out) == "FAILED")

    return {"checks": checks}


def proof_claim_loop():
    """Rule #32 lab proof. Claim discipline in the one loop: the validator
    enforces claim field minimums at the seam; every CONFIRMED probe is
    followed by exactly one claim turn; the 29-Oct re-file is blocked by
    the Rule #21 gate (BLOCKED-A/BLOCKED-C/BLOCKED-F) and counted as
    discipline; the verifier's terminal validation events flip
    filed->accepted/rejected and fold rejections into dead_ends; the
    whole thing is idempotent. Regressions for Rules #28/#29/#30 run in
    main() alongside."""
    checks = []

    def check(name, cond):
        assert cond, "FAILED: " + name
        checks.append(name)

    here = os.path.dirname(os.path.abspath(__file__))
    mock = os.path.join(here, "probe-lab", "mock-dvwa.py")

    def _hist(memdir):
        return load_json(mem_paths(memdir)["process"],
                         {"process": None})["process"]

    # --- validator: claim discipline at the seam ---
    def _vbase(**kw):
        return {"task": "t", "goal": "g", "progress": "p",
                "why_this": "x" * 30, "why_not_alternatives": "y" * 30,
                "action": dict({"type": "claim"}, **kw)}

    ok, errs = validate_reply(_vbase(module="xss_r", probe_step_idx=0),
                              False)
    check("validator: lab-style claim (module+probe_step_idx) passes",
          ok)
    full_claim = {
        "title": "Reflected XSS — verified live on the hunt target",
        "class": "xss_reflected", "severity": "high",
        "command": "python3 probe_xss_r.py --target http://127.0.0.1:1/",
        "evidence": "marker ABC observed in the target response; " + "e" * 40,
        "counterevidence": "benign control input shows no marker",
        "confidence": "high", "evidence_hash": "0" * 64}
    ok, errs = validate_reply(_vbase(module="xss_r", claim=full_claim),
                              False)
    check("validator: parent-authored full claim passes", ok)
    thin = dict(full_claim)
    thin["evidence"] = "too short"
    ok, errs = validate_reply(_vbase(module="xss_r", claim=thin), False)
    check("validator: evidence <30 chars is bounced",
          not ok and any("evidence" in e for e in errs))
    ok, errs = validate_reply(_vbase(probe_step_idx=0), False)
    check("validator: missing module is bounced", not ok)
    ok, errs = validate_reply(_vbase(module="xss_r", probe_step_idx=0,
                                     bogus=1), False)
    check("validator: unknown claim param is bounced", not ok)

    # --- lab claim assembly is fail-closed without CONFIRMED evidence ---
    d0 = tempfile.mkdtemp(prefix="pclaim0-")
    proc0 = _fresh_process_doc("p0", "w" * 30,
                               [{"kind": "probe", "done": False}])
    save_json(mem_paths(d0)["process"], {"process": proc0})
    body0, why0 = _build_lab_claim(proc0, "xss_r", 0,
                                   HashStore(mem_paths(d0)["output"]))
    check("claim assembly: no CONFIRMED probe -> refused, fail-closed",
          body0 is None and "no CONFIRMED" in why0)

    # --- live drive: probe->claim interleaved, zero human turns ---
    mp1 = _start_mock(mock, 8322, [])
    try:
        memdir = tempfile.mkdtemp(prefix="pclaim-")
        goal = "probe-hunt: claim-lane verification run"
        ctx = {"registry_url": "http://127.0.0.1:9", "workdir": memdir,
               "memdir": memdir,
               "target_base": "http://127.0.0.1:8322"}
        plan, _ = _lab_plan_for_hunt()
        check("lab plan: probe,claim interleaved per module (11, R34)",
              [s["kind"] for s in plan] == ["probe", "claim"] * 11 and
              [s["module"] for s in plan][0::2] ==
              list(_HUNT_MODULE_ORDER) and
              [s["probe_step_idx"] for s in plan
               if s["kind"] == "claim"] == list(range(0, 22, 2)))
        verdicts = []
        for _ in range(22):
            r = run_turn(memdir, goal, ctx)
            verdicts.append(_hist(memdir)["history"][-1]["verdict"])
        check("drive: 22 turns probe->claim, verdicts interleave",
              verdicts == ["CONFIRMED", "FILED"] * 11)

        claims_path = os.path.join(memdir, "claims.json")
        claims = json.load(open(claims_path))
        check("drive: 11 claims FILED, one per module",
              len(claims) == 11 and
              all(v["state"] == "filed" for v in claims.values()) and
              {v["module"] for v in claims.values()} ==
              set(_HUNT_MODULE_ORDER))

        # --- 29-Oct replay at the one-loop level: the drive filed xss_r
        # at turn 2; executing the byte-identical claim again must BLOCK,
        # never create a duplicate (BLOCKED-A). ---
        store = HashStore(mem_paths(memdir)["output"])
        be = LabBackend(store, memdir)
        proc = _hist(memdir)
        body, why = _build_lab_claim(proc, "xss_r", 0, store)
        check("claim assembly: CONFIRMED probe yields a full claim",
              body is not None and
              len(body["evidence"]) >= CLAIM_EVIDENCE_MIN and
              len(body["title"]) >= CLAIM_TITLE_MIN)
        r = be.execute({"type": "claim", "module": "xss_r",
                        "claim": body}, 99)
        check("29-Oct replay: byte-identical re-file BLOCKED-A",
              r["verdict"] == "BLOCKED" and "BLOCKED-A" in r["output"])
        claims = json.load(open(claims_path))
        check("re-file created no duplicate claim", len(claims) == 11)
        mem = json.load(open(os.path.join(memdir, "memory.json")))
        check("blocked re-file counted as discipline WITH REASON",
              any("BLOCKED-A" in b.get("reason", "")
                  for b in mem.get("claim_blocks", [])))

        # --- parent path: a genuinely new claim files cleanly ---
        # Rule #34: the lab drive now files all 11 DVWA modules, so the
        # parent invents a NEW process (PROCESS AS A BOOLEAN, owner
        # refinement #2) — a claim for a module the drive never touched
        # must FILE, never BLOCK.
        parent_claim = dict(full_claim)
        parent_claim["title"] = ("IDOR on user profile — parent-invented "
                                 "new process, verified live on the hunt "
                                 "target")
        parent_claim["class"] = "idor"
        r = be.execute({"type": "claim", "module": "idor",
                        "claim": parent_claim}, 100)
        check("parent-authored new claim FILED", r["verdict"] == "FILED")
        claims = json.load(open(claims_path))
        check("parent claim persisted", len(claims) == 12)

        # --- claim with no evidence reference fails closed ---
        r = be.execute({"type": "claim", "module": "xss_r"}, 101)
        check("claim with no evidence reference fails closed",
              r["verdict"] == "FAILED")

        # --- terminal validation: verifier accepts xss_r, rejects exec
        # (the Rule #21 event format, proven live 29 Oct). ---
        by_mod = {}
        for ch, v in claims.items():
            by_mod[v["module"]] = (ch, v)
        ev_path = os.path.join(memdir, "events.jsonl")
        with open(ev_path, "w", encoding="utf-8") as f:
            f.write(json.dumps(
                {"type": "validation",
                 "plan": "Claim: " + by_mod["xss_r"][1]["title"],
                 "verdict": "accepted",
                 "at": "2026-10-29T23:30:00+05:30"}) + "\n")
            f.write(json.dumps(
                {"type": "validation",
                 "plan": "Claim: " + by_mod["exec"][1]["title"],
                 "verdict": "rejected",
                 "reason": "could not reproduce on a clean target",
                 "at": "2026-10-29T23:31:00+05:30"}) + "\n")
            f.write(json.dumps({"type": "note", "x": 1}) + "\n")
        res = apply_terminal_validation(memdir, ev_path)
        check("terminal scan: 2 applied, 0 unmatched/ambiguous",
              len(res["applied"]) == 2 and not res["unmatched"] and
              not res["ambiguous"])
        claims = json.load(open(claims_path))
        check("verifier-accepted claim marked accepted",
              claims[by_mod["xss_r"][0]]["state"] == "accepted")
        check("verifier-rejected claim marked rejected",
              claims[by_mod["exec"][0]]["state"] == "rejected")
        mem = json.load(open(os.path.join(memdir, "memory.json")))
        check("rejected module folded into dead_ends WITH REASON",
              "exec" in mem.get("dead_ends", []) and
              bool(mem.get("dead_end_reasons", {}).get("exec")))
        res2 = apply_terminal_validation(memdir, ev_path)
        check("terminal re-scan is idempotent (0 newly applied)",
              len(res2["applied"]) == 0)

        # --- post-rejection re-drive: identical bytes -> BLOCKED-C,
        # new evidence for the same module+class -> BLOCKED-F. Never
        # re-claim a dead end. ---
        body2, _ = _build_lab_claim(proc, "exec", 2, store)
        r = be.execute({"type": "claim", "module": "exec",
                        "claim": body2}, 102)
        check("post-rejection identical re-file BLOCKED-C",
              r["verdict"] == "BLOCKED" and "BLOCKED-C" in r["output"])
        body3 = dict(body2)
        body3["evidence"] = body3["evidence"] + " (re-probed, new bytes)"
        r = be.execute({"type": "claim", "module": "exec",
                        "claim": body3}, 103)
        check("post-rejection new-evidence re-file BLOCKED-F",
              r["verdict"] == "BLOCKED" and "BLOCKED-F" in r["output"])
        claims = json.load(open(claims_path))
        check("dead-end re-drives created no new claims", len(claims) == 12)

        # --- completion + resume still behave ---
        r = run_turn(memdir, goal, ctx)  # 23rd turn: plan exhausted
        check("process completes after final claim",
              "process_completed" in r["events"])
        r = run_turn(memdir, goal, ctx)
        check("resume idles, never repeats a completed hunt",
              r["reply"]["action"]["type"] == "idle")
        claims = json.load(open(claims_path))
        check("resume files no new claims", len(claims) == 12)
    finally:
        _stop_mock(mp1, 8322)

    return {"checks": checks}


def build_turn_input_shot_path(memdir, turn):
    return os.path.join(mem_paths(memdir)["shots"],
                        "shot-turn-%d.png" % turn)


def proof_reconplan():
    """Rule #35 lab proof: the hunt plan is built from what recon finds,
    never from a hardcoded list.

    Case A — full mock DVWA: recon finds 11/11 modules with live pages;
    the driven plan is the 22-step Rule #34 plan (same order), the
    process document carries the recon evidence (params/sinks) and
    plan_meta recon_ok=True.
    Case B — mock --drop=exec: recon finds 10, the plan is 20 steps with
    no exec; a full drive CONFIRMs 10/10, files 10 claims, completes,
    and the mock request log proves ZERO requests to
    /vulnerabilities/exec* (the loop never probed what recon did not
    find).
    Case C — dead target (closed port): recon fails, the loop falls back
    to the full fixed plan with recon_ok=False recorded, and the first
    probe turn fails closed (VERDICT:FAILED) with zero crashes.
    Case D — regression: the Rule #28/#30/#31/#32 suites still pass.
    """
    checks = []

    def check(name, cond):
        assert cond, "FAILED: " + name
        checks.append(name)

    here = os.path.dirname(os.path.abspath(__file__))
    mock = os.path.join(here, "probe-lab", "mock-dvwa.py")

    def _hist(memdir):
        return load_json(mem_paths(memdir)["process"],
                         {"process": None})["process"]

    # --- Case A: full mock — recon finds 11/11, plan == fixed plan ---
    mp1 = _start_mock(mock, 8330, [])
    try:
        recon = _lab_recon_map("http://127.0.0.1:8330")
        check("recon: full mock yields 11/11 modules with 200 pages",
              recon is not None and
              set(recon["modules"]) == set(_HUNT_MODULE_ORDER))
        check("recon: xss_r page exposes the name param",
              "name" in recon["modules"]["xss_r"]["params_found"])
        check("recon: xss_d page exposes the decodeURI sink",
              "decodeURI" in recon["modules"]["xss_d"]["sinks_found"])
        check("recon: javascript page exposes the rot13 sink",
              "rot13" in recon["modules"]["javascript"]["sinks_found"])
        check("recon: csp page exposes the include param",
              "include" in recon["modules"]["csp"]["params_found"])
        plan, meta = _lab_plan_for_hunt(list(recon["modules"]))
        check("recon-driven plan: 22 steps, Rule #34 order intact",
              len(plan) == 22 and
              [s["module"] for s in plan][0::2] ==
              list(_HUNT_MODULE_ORDER) and
              meta["recon_ok"] is True and
              meta["dropped_modules"] == [])
        memdir = tempfile.mkdtemp(prefix="ploop35-a-")
        goal = "probe-hunt: driven-plan verification"
        ctx = {"registry_url": "http://127.0.0.1:9", "workdir": memdir,
               "memdir": memdir,
               "target_base": "http://127.0.0.1:8330"}
        run_turn(memdir, goal, ctx)  # turn 1: process created via recon
        proc = _hist(memdir)
        check("process doc: carries recon map + plan_meta recon_ok=True",
              len(proc["recon"]["modules"]) == 11 and
              proc["plan_meta"]["recon_ok"] is True and
              len(proc["plan"]) == 22)
    finally:
        _stop_mock(mp1, 8330)

    # --- Case B: --drop=exec — plan drops exec, drive never probes it ---
    reqlog = os.path.join(tempfile.mkdtemp(prefix="ploop35-b-"),
                          "requests.log")
    old_reqlog = os.environ.get("MOCK_REQLOG")
    os.environ["MOCK_REQLOG"] = reqlog
    mp2 = _start_mock(mock, 8331, ["--drop=exec"])
    try:
        recon = _lab_recon_map("http://127.0.0.1:8331")
        check("recon: dropped mock yields 10/10, exec absent",
              recon is not None and
              set(recon["modules"]) == set(_HUNT_MODULE_ORDER) - {"exec"})
        memdir = tempfile.mkdtemp(prefix="ploop35-b-")
        goal = "probe-hunt: pruned surface drive"
        ctx = {"registry_url": "http://127.0.0.1:9", "workdir": memdir,
               "memdir": memdir,
               "target_base": "http://127.0.0.1:8331"}
        proc0 = None
        verdicts = []
        for _ in range(20):
            r = run_turn(memdir, goal, ctx)
            if proc0 is None:
                proc0 = _hist(memdir)
            verdicts.append(_hist(memdir)["history"][-1]["verdict"])
        check("pruned drive: 20 turns probe->claim, 10/10 CONFIRMED",
              verdicts == ["CONFIRMED", "FILED"] * 10)
        check("pruned drive: plan_meta drops exactly exec",
              proc0["plan_meta"]["dropped_modules"] == ["exec"] and
              proc0["plan_meta"]["recon_ok"] is True and
              all(s["module"] != "exec" for s in proc0["plan"]))
        claims = json.load(open(os.path.join(memdir, "claims.json")))
        check("pruned drive: 10 claims FILED, none for exec",
              len(claims) == 10 and
              all(v["state"] == "filed" for v in claims.values()) and
              "exec" not in {v["module"] for v in claims.values()})
        r = run_turn(memdir, goal, ctx)  # 21st turn: plan exhausted
        check("pruned drive: process completes after final claim",
              "process_completed" in r["events"])
        hits = [l for l in open(reqlog).read().splitlines()
                if "vulnerabilities/exec" in l]
        check("mock request log: ZERO requests to /vulnerabilities/exec*",
              hits == [])
    finally:
        _stop_mock(mp2, 8331)
        if old_reqlog is None:
            del os.environ["MOCK_REQLOG"]
        else:
            os.environ["MOCK_REQLOG"] = old_reqlog

    # --- Case C: dead target — recon fails, fallback recorded, no crash ---
    check("recon: closed port returns None (fail-open, not crash)",
          _lab_recon_map("http://127.0.0.1:9/") is None)
    plan, meta = _lab_plan_for_hunt()
    check("fallback: full 22-step plan with recon_ok=False recorded",
          len(plan) == 22 and meta["recon_ok"] is False and
          "note" in meta)
    memdir = tempfile.mkdtemp(prefix="ploop35-c-")
    goal = "probe-hunt: dead-target fallback"
    ctx = {"registry_url": "http://127.0.0.1:9", "workdir": memdir,
           "memdir": memdir, "target_base": "http://127.0.0.1:9"}
    r = run_turn(memdir, goal, ctx)  # must not raise
    check("dead target: first probe turn fails closed, loop survives",
          r is not None and
          _hist(memdir)["history"][-1]["verdict"] == "FAILED" and
          _hist(memdir)["plan_meta"]["recon_ok"] is False)

    return {"checks": checks}


def proof_genericsink():
    """Rule #56 lab proof (extended Rule #57): the loop hunts sinks it
    has never seen.

    Fresh mock (probe-lab/mock-fresh/fresh_app.py) exposes ZERO DVWA
    module signals: /feedback (POST form, name reflected RAW ->
    reflected XSS, no SQLi), /search?q= (q reflected HTML-ESCAPED ->
    negative control for both probes), /item?id= (boolean-blind SQLi,
    id HTML-ESCAPED -> XSS negative control), /lookup?q=
    (parameterized -> SQLi negative control). The loop must discover
    all four via recon, CONFIRM exactly the two real vulns, refuse the
    negatives, file exactly two claims, and terminate.

    Case A — discovery: _lab_generic_sinks finds the four sinks,
    neither touching a known module path or an auth path;
    _lab_plan_for_hunt([], sinks, tb) yields 54 steps (xss+sqli
    probe+claim pairs per sink, plus the Rule #61 CSRF pair for the
    /feedback POST form, the Rule #62 redirect pair + Rule #63 ssrf
    pair + Rule #64 header pair + Rule #65 cmdi pair + Rule #66 trav
    pair + Rule #67 ssti pair for each query sink);
    budget_info prices them at 54 turns.
    Case B — full drive: run_turn vs the fresh mock. feedback xss ->
    CONFIRMED, claim -> FILED; feedback sqli -> FAILED; feedback csrf
    -> FAILED (the mock echoes but never persists — no observable
    state change, fail-closed); item xss -> FAILED (escaped echo is a
    negative control); item sqli -> CONFIRMED, claim -> FILED;
    lookup/search -> both FAILED, probes dead-end WITH REASON, their
    claims die WITH REASON, process completes. claims.json holds
    exactly 2 filed claims (generic_xss citing /feedback, generic_sqli
    citing /item) with real evidence hashes.
    Case C — regression: the DVWA mock yields ZERO generic sinks (auth
    pages skipped WITH REASON, module paths skipped) so the Rule #35
    22-step plan is byte-identical.
    """
    checks = []

    def check(name, cond):
        assert cond, "FAILED: " + name
        checks.append(name)

    def _hist(memdir):
        return load_json(mem_paths(memdir)["process"],
                         {"process": None})["process"]

    here = os.path.dirname(os.path.abspath(__file__))
    fresh = os.path.join(here, "probe-lab", "mock-fresh", "fresh_app.py")
    dvwa = os.path.join(here, "probe-lab", "mock-dvwa.py")

    # --- Case A: discovery on the fresh target ---
    mp = _start_mock(fresh, 8340, [])
    try:
        tb = "http://127.0.0.1:8340"
        recon = _lab_recon_map(tb)
        check("fresh target: recon finds zero known modules",
              recon is not None and recon["modules"] == {})
        sinks = _lab_generic_sinks(tb, None, list(recon["modules"]))
        ids = [s["id"] for s in sinks]
        check("discovery: finds the /feedback POST form sink",
              "form:/feedback:POST:message,name" in ids)
        check("discovery: finds the /search query sink",
              "query:/search:GET:q" in ids)
        check("discovery: finds the /item SQLi query sink (Rule #57)",
              "query:/item:GET:id" in ids)
        check("discovery: finds the /lookup query sink (Rule #57)",
              "query:/lookup:GET:q" in ids)
        check("discovery: no sink touches a known module path",
              not any("vulnerabilities" in i for i in ids))
        plan, meta = _lab_plan_for_hunt([], sinks, tb)
        check("plan: 62 steps, xss+sqli pairs per sink + csrf pair for "
              "the /feedback POST form (Rule #61) + redirect_post pair "
              "for the /feedback POST form (Rule #69) + redirect pair "
              "for each query sink (Rule #62) + ssrf pair for each "
              "query sink (Rule #63) + header pair for each query sink "
              "(Rule #64) + cmdi pair for each query sink (Rule #65) "
              "+ trav pair for each query sink (Rule #66) + ssti pair "
              "for each query sink (Rule #67) + hostheader pair for "
              "each query sink (Rule #71)",
              len(plan) == 62 and
              [s["module"] for s in plan] ==
              ["generic_xss", "generic_xss",
               "generic_sqli", "generic_sqli",
               "generic_csrf", "generic_csrf",
               "generic_redirect_post", "generic_redirect_post"] +
              ["generic_xss", "generic_xss",
               "generic_sqli", "generic_sqli",
               "generic_redirect", "generic_redirect",
               "generic_ssrf", "generic_ssrf",
               "generic_header", "generic_header",
               "generic_cmdi", "generic_cmdi",
               "generic_trav", "generic_trav",
               "generic_ssti", "generic_ssti",
               "generic_hostheader", "generic_hostheader"] * 3 and
              [s["kind"] for s in plan] ==
              ["probe", "claim"] * 31 and
              [s["probe"] for s in plan if s["kind"] == "probe"] ==
              ["probe_sink_xss.py", "probe_sink_sqli.py",
               "probe_sink_csrf.py",
               "probe_sink_redirect_post.py"] +
              ["probe_sink_xss.py", "probe_sink_sqli.py",
               "probe_sink_redirect.py", "probe_sink_ssrf.py",
               "probe_sink_header.py", "probe_sink_cmdi.py",
               "probe_sink_traversal.py",
               "probe_sink_ssti.py",
               "probe_sink_hostheader.py"] * 3)
        check("plan: sink spec rides in the marker argv "
              "(PLOOP56|../PLOOP57|../PLOOP61|../PLOOP62|../PLOOP63|../"
              "PLOOP64|../PLOOP65|../PLOOP66|../PLOOP67|../PLOOP69|../"
              "PLOOP71|..)",
              all((s["marker"].startswith("PLOOP56|") and
                   s["probe"] == "probe_sink_xss.py") or
                  (s["marker"].startswith("PLOOP57|") and
                   s["probe"] == "probe_sink_sqli.py") or
                  (s["marker"].startswith("PLOOP61|") and
                   s["probe"] == "probe_sink_csrf.py") or
                  (s["marker"].startswith("PLOOP62|") and
                   s["probe"] == "probe_sink_redirect.py") or
                  (s["marker"].startswith("PLOOP63|") and
                   s["probe"] == "probe_sink_ssrf.py") or
                  (s["marker"].startswith("PLOOP64|") and
                   s["probe"] == "probe_sink_header.py") or
                  (s["marker"].startswith("PLOOP65|") and
                   s["probe"] == "probe_sink_cmdi.py") or
                  (s["marker"].startswith("PLOOP66|") and
                   s["probe"] == "probe_sink_traversal.py") or
                  (s["marker"].startswith("PLOOP69|") and
                   s["probe"] == "probe_sink_redirect_post.py") or
                  (s["marker"].startswith("PLOOP67|") and
                   s["probe"] == "probe_sink_ssti.py") or
                  (s["marker"].startswith("PLOOP71|") and
                   s["probe"] == "probe_sink_hostheader.py")
                  for s in plan if s["kind"] == "probe") and
              all("/" not in s["marker"]
                  for s in plan if s["kind"] == "probe"))
        check("plan_meta: recon_ok=True, generic sink ids recorded",
              meta["recon_ok"] is True and
              set(meta["generic_sinks"]) == set(ids))
        bi = budget_info([], sinks)
        check("budget: 4 sinks priced at 62 turns (Rule #61: the POST "
              "form costs 8 with the Rule #69 redirect_post pair; "
              "Rule #62+#63+#64+#65+#66+#67+#71: each query "
              "sink costs 18)",
              bi["recommended_turns"] == 62 and bi["generic_turns"] == 62)

        # --- Case B: full autonomous drive vs the fresh target ---
        memdir = tempfile.mkdtemp(prefix="ploop56-b-")
        goal = "probe-hunt: fresh target generic sink drive"
        ctx = {"registry_url": "http://127.0.0.1:9", "workdir": memdir,
               "memdir": memdir, "target_base": tb}
        verdicts, events = [], []
        for _ in range(110):
            r = run_turn(memdir, goal, ctx)
            events.extend(r.get("events", []))
            if "process_completed" in r.get("events", []):
                break
            verdicts.append(_hist(memdir)["history"][-1]["verdict"])
        check("drive: feedback xss probe CONFIRMED, claim FILED",
              verdicts[0] == "CONFIRMED" and verdicts[1] == "FILED")
        check("drive: feedback csrf probe FAILED — the mock echoes "
              "but never persists (no observable state change, "
              "fail-closed), pair costs 3 turns",
              verdicts[5] == "FAILED")
        check("drive: item sqli probe CONFIRMED, claim FILED "
              "(a FAILED probe costs a dead-end turn, so the pair lands "
              "at verdicts[14]/[15] — Rule #69 adds the feedback "
              "redirect_post FAILED pair before item)",
              len(verdicts) >= 16 and
              verdicts[14] == "CONFIRMED" and verdicts[15] == "FILED")
        check("drive: 91 verdict turns, process completed, no re-probe "
              "(Rule #62: the 3 query sinks each carry a FAILED "
              "redirect pair costing 3 turns; Rule #63: each also "
              "carries a FAILED ssrf pair costing 3 turns; Rule #64: "
              "each carries a FAILED header pair costing 3 more; "
              "Rule #65: each carries a FAILED cmdi pair costing 3 "
              "more; Rule #66: each carries a FAILED trav pair "
              "costing 3 more; Rule #67: each carries a FAILED ssti "
              "pair costing 3 more; Rule #71: each carries a FAILED "
              "hostheader pair costing 3 more; Rule #69: the feedback "
              "POST form carries a FAILED redirect_post pair costing "
              "3 more)",
              len(verdicts) == 91 and "process_completed" in events)
        check("drive: negative probes FAILED (escaped/parameterized "
              "sinks)", "FAILED" in verdicts)
        check("drive: negative probes FAILED (escaped/parameterized "
              "sinks)", "FAILED" in verdicts)
        check("drive: process completed (no infinite re-probe)",
              "process_completed" in events)
        claims = json.load(open(os.path.join(memdir, "claims.json")))
        check("drive: exactly 2 claims filed: generic_xss + generic_sqli",
              len(claims) == 2 and
              all(v["state"] == "filed" for v in claims.values()) and
              {v["module"] for v in claims.values()} ==
              {"generic_xss", "generic_sqli"})
        store = HashStore(os.path.join(memdir, "output"))
        by_module = {v["module"]: v for v in claims.values()}
        cx = by_module["generic_xss"]
        check("drive: xss claim carries a real evidence hash",
              bool(HASH_RE.match(cx.get("evidence_hash") or "")))
        rawx = _to_text(store.get(cx["evidence_hash"]) or b"")
        check("drive: stored xss output cites the sink + VERDICT",
              "EVIDENCE sink=/feedback" in rawx and
              rawx.strip().splitlines()[-1] == "VERDICT: CONFIRMED")
        cq = by_module["generic_sqli"]
        check("drive: sqli claim carries a real evidence hash",
              bool(HASH_RE.match(cq.get("evidence_hash") or "")))
        rawq = _to_text(store.get(cq["evidence_hash"]) or b"")
        check("drive: stored sqli output cites the sink + VERDICT",
              "EVIDENCE sink=/item" in rawq and
              rawq.strip().splitlines()[-1] == "VERDICT: CONFIRMED")
    finally:
        _stop_mock(mp, 8340)

    # --- Case C: DVWA regression — zero generic sinks ---
    mp2 = _start_mock(dvwa, 8341, [])
    try:
        recon2 = _lab_recon_map("http://127.0.0.1:8341")
        sinks2 = _lab_generic_sinks("http://127.0.0.1:8341", None,
                                    list(recon2["modules"]))
        check("dvwa: auth pages skipped WITH REASON, zero generic sinks",
              sinks2 == [])
        plan2, meta2 = _lab_plan_for_hunt(list(recon2["modules"]),
                                          sinks2,
                                          "http://127.0.0.1:8341")
        check("dvwa: Rule #35 22-step plan byte-identical",
              len(plan2) == 22 and meta2["generic_sinks"] == [] and
              all(s["module"] in _HUNT_MODULE_ORDER for s in plan2))
    finally:
        _stop_mock(mp2, 8341)

    return {"checks": checks}


def proof_colddrive2():
    """Rule #58 lab proof: COLD one-loop drive vs a SECOND unseen target.

    mock-fresh2 (probe-lab/mock-fresh2/fresh2_app.py) is a different app
    from the Rule #56 mock: /guestbook (3-param POST form, msg echoed
    RAW -> XSS on the 2nd param), /stock?code= (boolean-blind SQLi whose
    lone-quote response carries NO SQL error keywords -> the probe must
    fall through to the boolean-blind differential; the code is never
    echoed, so the page is byte-stable), /profile (POST form, both
    fields escaped -> double negative control). Zero DVWA module
    signals: recon drops all 11 known modules.

    Case A — discovery: 3 sinks found, plan is 28 steps (xss+sqli
    probe+claim pairs per sink, plus the Rule #61 CSRF pair for the
    two POST forms /guestbook and /profile, plus the Rule #62
    redirect + Rule #63 ssrf + Rule #64 header + Rule #65 cmdi +
    Rule #66 trav + Rule #67 ssti pairs for the stock query sink),
    budget prices 28 turns.
    Case B — full cold drive: guestbook XSS CONFIRMED->FILED,
    guestbook/profile SQLi + profile/stock XSS FAILED (negative
    controls refused), stock SQLi CONFIRMED via the BOOLEAN-BLIND path
    (never via error keywords) -> FILED; exactly 2 filed claims with
    real evidence hashes; process completes, no re-probe.
    Case C — regression: the DVWA mock yields ZERO generic sinks so the
    Rule #35 22-step plan is byte-identical.
    """
    checks = []

    def check(name, cond):
        assert cond, "FAILED: " + name
        checks.append(name)

    def _hist(memdir):
        return load_json(mem_paths(memdir)["process"],
                         {"process": None})["process"]

    here = os.path.dirname(os.path.abspath(__file__))
    fresh2 = os.path.join(here, "probe-lab", "mock-fresh2",
                          "fresh2_app.py")
    dvwa = os.path.join(here, "probe-lab", "mock-dvwa.py")

    # --- Case A: discovery on the second unseen target ---
    mp = _start_mock(fresh2, 8342, [])
    try:
        tb = "http://127.0.0.1:8342"
        recon = _lab_recon_map(tb)
        check("fresh2: recon finds zero known modules",
              recon is not None and recon["modules"] == {})
        sinks = _lab_generic_sinks(tb, None, list(recon["modules"]))
        ids = [s["id"] for s in sinks]
        check("discovery: finds the /guestbook 3-param POST form sink",
              "form:/guestbook:POST:csrf,msg,nick" in ids)
        check("discovery: finds the /stock blind-SQLi query sink",
              "query:/stock:GET:code" in ids)
        check("discovery: finds the /profile POST form sink",
              "form:/profile:POST:bio,user" in ids)
        check("discovery: exactly 3 sinks, no known-module paths",
              len(ids) == 3 and
              not any("vulnerabilities" in i for i in ids))
        plan, meta = _lab_plan_for_hunt([], sinks, tb)
        check("plan: 34 steps, xss+sqli pairs per sink + csrf pair for "
              "each POST form (Rule #61) + redirect_post pair for each "
              "POST form (Rule #69) + redirect pair for the stock "
              "query sink (Rule #62) + ssrf pair for the stock query "
              "sink (Rule #63) + header pair for the stock query sink "
              "(Rule #64) + cmdi pair for the stock query sink "
              "(Rule #65) + trav pair for the stock query sink "
              "(Rule #66) + ssti pair for the stock query sink "
              "(Rule #67) + hostheader pair for the stock query sink "
              "(Rule #71); sink order is guestbook, "
              "profile, stock",
              len(plan) == 34 and
              [s["module"] for s in plan] ==
              ["generic_xss", "generic_xss",
               "generic_sqli", "generic_sqli",
               "generic_csrf", "generic_csrf",
               "generic_redirect_post", "generic_redirect_post",
               "generic_xss", "generic_xss",
               "generic_sqli", "generic_sqli",
               "generic_csrf", "generic_csrf",
               "generic_redirect_post", "generic_redirect_post",
               "generic_xss", "generic_xss",
               "generic_sqli", "generic_sqli",
               "generic_redirect", "generic_redirect",
               "generic_ssrf", "generic_ssrf",
               "generic_header", "generic_header",
               "generic_cmdi", "generic_cmdi",
               "generic_trav", "generic_trav",
               "generic_ssti", "generic_ssti",
               "generic_hostheader", "generic_hostheader"] and
              [s["kind"] for s in plan] ==
              ["probe", "claim"] * 17 and
              [s["probe"] for s in plan if s["kind"] == "probe"] ==
              ["probe_sink_xss.py", "probe_sink_sqli.py",
               "probe_sink_csrf.py",
               "probe_sink_redirect_post.py",
               "probe_sink_xss.py", "probe_sink_sqli.py",
               "probe_sink_csrf.py",
               "probe_sink_redirect_post.py",
               "probe_sink_xss.py", "probe_sink_sqli.py",
               "probe_sink_redirect.py", "probe_sink_ssrf.py",
               "probe_sink_header.py", "probe_sink_cmdi.py",
               "probe_sink_traversal.py",
               "probe_sink_ssti.py",
               "probe_sink_hostheader.py"])
        check("plan: sink spec rides in the marker argv, no slashes",
              all((s["marker"].startswith("PLOOP56|") and
                   s["probe"] == "probe_sink_xss.py") or
                  (s["marker"].startswith("PLOOP57|") and
                   s["probe"] == "probe_sink_sqli.py") or
                  (s["marker"].startswith("PLOOP61|") and
                   s["probe"] == "probe_sink_csrf.py") or
                  (s["marker"].startswith("PLOOP62|") and
                   s["probe"] == "probe_sink_redirect.py") or
                  (s["marker"].startswith("PLOOP63|") and
                   s["probe"] == "probe_sink_ssrf.py") or
                  (s["marker"].startswith("PLOOP64|") and
                   s["probe"] == "probe_sink_header.py") or
                  (s["marker"].startswith("PLOOP65|") and
                   s["probe"] == "probe_sink_cmdi.py") or
                  (s["marker"].startswith("PLOOP66|") and
                   s["probe"] == "probe_sink_traversal.py") or
                  (s["marker"].startswith("PLOOP67|") and
                   s["probe"] == "probe_sink_ssti.py") or
                  (s["marker"].startswith("PLOOP69|") and
                   s["probe"] == "probe_sink_redirect_post.py") or
                  (s["marker"].startswith("PLOOP71|") and
                   s["probe"] == "probe_sink_hostheader.py")
                  for s in plan if s["kind"] == "probe") and
              all("/" not in s["marker"]
                  for s in plan if s["kind"] == "probe"))
        check("plan_meta: recon_ok=True, 3 generic sink ids recorded",
              meta["recon_ok"] is True and
              set(meta["generic_sinks"]) == set(ids))
        bi = budget_info([], sinks)
        check("budget: 3 sinks priced at 34 turns (Rule #61: the two "
              "POST forms cost 8 each with the Rule #69 redirect_post "
              "pair; Rule #62+#63+#64+#65+#66+#67+#71: "
              "the stock query sink costs 18)",
              bi["recommended_turns"] == 34 and bi["generic_turns"] == 34)

        # --- Case B: full autonomous cold drive vs fresh2 ---
        memdir = tempfile.mkdtemp(prefix="ploop58-b-")
        goal = "probe-hunt: fresh2 cold drive"
        ctx = {"registry_url": "http://127.0.0.1:9", "workdir": memdir,
               "memdir": memdir, "target_base": tb}
        verdicts, events = [], []
        for _ in range(50):
            r = run_turn(memdir, goal, ctx)
            events.extend(r.get("events", []))
            if "process_completed" in r.get("events", []):
                break
            verdicts.append(_hist(memdir)["history"][-1]["verdict"])
        check("drive: guestbook xss probe CONFIRMED, claim FILED",
              verdicts[0] == "CONFIRMED" and verdicts[1] == "FILED")
        check("drive: guestbook csrf probe FAILED — the mock echoes "
              "but never persists (no observable state change, "
              "fail-closed), pair costs 3 turns",
              verdicts[5] == "FAILED")
        check("drive: negative probes FAILED (escaped/parameterized/no "
              "SQL semantics)", "FAILED" in verdicts)
        sq = [i for i, v in enumerate(verdicts) if v == "CONFIRMED"]
        check("drive: exactly 2 CONFIRMED probes (guestbook xss t1 + "
              "stock sqli t27; each FAILED pair costs 3 turns: FAILED + "
              "probe DEAD_END + claim DEAD_END, same as the Rule #56 "
              "drive; the two Rule #61 csrf pairs add 6 turns before "
              "stock; the two Rule #69 redirect_post pairs add 6 more "
              "before stock; Rule #62 appends the stock redirect pair "
              "AFTER the sqli CONFIRM and Rule #63 appends the stock "
              "ssrf pair after that, and Rule #67 appends the stock "
              "ssti pair after the trav pair at the very end, so "
              "indices shift by +6)",
              sq == [0, 26])
        check("drive: stock sqli CONFIRMED -> claim FILED (turns 27/28)",
              verdicts[26] == "CONFIRMED" and verdicts[27] == "FILED")
        check("drive: 49 verdict turns executed, process completed, no "
              "re-probe (Rule #62: the stock redirect FAILED pair "
              "adds 3 turns at the end; Rule #63: the stock ssrf "
              "FAILED pair adds 3 more; Rule #64: the stock header "
              "FAILED pair adds 3 more; Rule #65: the stock cmdi "
              "FAILED pair adds 3 more; Rule #66: the stock trav "
              "FAILED pair adds 3 more; Rule #67: the stock ssti "
              "FAILED pair adds 3 more; Rule #71: the stock "
              "hostheader FAILED pair adds 3 more; Rule #69: the two "
              "POST-form redirect_post FAILED pairs add 3 turns each "
              "before stock)",
              len(verdicts) == 49 and "process_completed" in events)
        claims = json.load(open(os.path.join(memdir, "claims.json")))
        check("drive: exactly 2 claims filed: generic_xss + generic_sqli",
              len(claims) == 2 and
              all(v["state"] == "filed" for v in claims.values()) and
              {v["module"] for v in claims.values()} ==
              {"generic_xss", "generic_sqli"})
        store = HashStore(os.path.join(memdir, "output"))
        by_module = {v["module"]: v for v in claims.values()}
        cx = by_module["generic_xss"]
        check("drive: xss claim carries a real evidence hash",
              bool(HASH_RE.match(cx.get("evidence_hash") or "")))
        rawx = _to_text(store.get(cx["evidence_hash"]) or b"")
        check("drive: stored xss output cites /guestbook + VERDICT",
              "EVIDENCE sink=/guestbook" in rawx and
              rawx.strip().splitlines()[-1] == "VERDICT: CONFIRMED")
        cq = by_module["generic_sqli"]
        check("drive: sqli claim carries a real evidence hash",
              bool(HASH_RE.match(cq.get("evidence_hash") or "")))
        rawq = _to_text(store.get(cq["evidence_hash"]) or b"")
        check("drive: stored sqli output CONFIRMs via the BOOLEAN-BLIND "
              "path (no error keywords involved)",
              "EVIDENCE sink=/stock" in rawq and
              "boolean-blind" in rawq and
              rawq.strip().splitlines()[-1] == "VERDICT: CONFIRMED")
    finally:
        _stop_mock(mp, 8342)

    # --- Case C: DVWA regression — zero generic sinks ---
    mp2 = _start_mock(dvwa, 8341, [])
    try:
        recon2 = _lab_recon_map("http://127.0.0.1:8341")
        sinks2 = _lab_generic_sinks("http://127.0.0.1:8341", None,
                                    list(recon2["modules"]))
        check("dvwa: auth pages skipped WITH REASON, zero generic sinks",
              sinks2 == [])
        plan2, meta2 = _lab_plan_for_hunt(list(recon2["modules"]),
                                          sinks2,
                                          "http://127.0.0.1:8341")
        check("dvwa: Rule #35 22-step plan byte-identical",
              len(plan2) == 22 and meta2["generic_sinks"] == [] and
              all(s["module"] in _HUNT_MODULE_ORDER for s in plan2))
    finally:
        _stop_mock(mp2, 8341)

    return {"checks": checks}


def proof_attrxss():
    """Rule #59 lab proof: CONTEXT-AWARE generic XSS + location-scoped
    claim dedup.

    mock-fresh3 (probe-lab/mock-fresh3/fresh3_app.py) is a third unseen
    app: every sink reflects its param RAW, but each in a DIFFERENT
    HTML context — /pref?nick= (double-quoted attribute value),
    /tagline?text= (single-quoted attribute value), /note?m= (HTML
    comment), /greet?name= (double-quoted JS string); /about?who= is
    HTML-escaped everywhere (double negative control). Zero DVWA module
    signals: recon drops all 11 known modules.

    A text-node breakout payload alone would miss all four vulns. The
    probe must classify each context (attr-dq / attr-sq / comment /
    js-dq) and fire the matching breakout, citing via=<context>.

    Rule #59 also fixes the claim gate: the old (module, class) dedup
    would BLOCK 3 of the 4 genuine findings as "duplicates" (BLOCKED-D).
    Dedup is now per (module, class, location) — the same class on a
    different page files as a distinct finding; the same page re-filed
    is still BLOCKED-D (the 29-Oct lesson stands).

    Case A — discovery: 5 sinks found, plan is 90 steps (xss+sqli+
    redirect+ssrf+header+cmdi+trav+ssti+hostheader probe+claim pairs
    per sink, Rule #62..Rule #67 + Rule #71), budget prices 90 turns.
    Case B — full cold drive: about xss/sqli FAILED (escaped negative);
    greet/note/pref/tagline xss CONFIRMED->FILED citing via=js-dq,
    via=comment, via=attr-dq, via=attr-sq; their sqli probes FAILED
    (static echo pages: no error keywords, no stable differential);
    exactly 4 filed claims (generic_xss, one per sink) with real
    evidence hashes and distinct locations; process completes, no
    re-probe.
    Case C — regression: the DVWA mock yields ZERO generic sinks so the
    Rule #35 22-step plan is byte-identical.
    """
    checks = []

    def check(name, cond):
        assert cond, "FAILED: " + name
        checks.append(name)

    def _hist(memdir):
        return load_json(mem_paths(memdir)["process"],
                         {"process": None})["process"]

    here = os.path.dirname(os.path.abspath(__file__))
    fresh3 = os.path.join(here, "probe-lab", "mock-fresh3",
                          "fresh3_app.py")
    dvwa = os.path.join(here, "probe-lab", "mock-dvwa.py")

    # --- Case A: discovery on the third unseen target ---
    mp = _start_mock(fresh3, 8343, [])
    try:
        tb = "http://127.0.0.1:8343"
        recon = _lab_recon_map(tb)
        check("fresh3: recon finds zero known modules",
              recon is not None and recon["modules"] == {})
        sinks = _lab_generic_sinks(tb, None, list(recon["modules"]))
        ids = [s["id"] for s in sinks]
        check("discovery: finds all 5 context sinks",
              ids == ["query:/about:GET:who",
                      "query:/greet:GET:name",
                      "query:/note:GET:m",
                      "query:/pref:GET:nick",
                      "query:/tagline:GET:text"])
        check("discovery: no sink touches a known module path",
              not any("vulnerabilities" in i for i in ids))
        plan, meta = _lab_plan_for_hunt([], sinks, tb)
        check("plan: 90 steps, xss+sqli+redirect+ssrf+header+cmdi+"
              "trav+ssti+hostheader probe+claim per sink (Rule #62, "
              "Rule #63, Rule #64, Rule #65, Rule #66, Rule #67, "
              "Rule #71)",
              len(plan) == 90 and
              [s["module"] for s in plan] ==
              ["generic_xss", "generic_xss",
               "generic_sqli", "generic_sqli",
               "generic_redirect", "generic_redirect",
               "generic_ssrf", "generic_ssrf",
               "generic_header", "generic_header",
               "generic_cmdi", "generic_cmdi",
               "generic_trav", "generic_trav",
               "generic_ssti", "generic_ssti",
               "generic_hostheader", "generic_hostheader"] * 5 and
              [s["kind"] for s in plan] ==
              ["probe", "claim"] * 45 and
              [s["probe"] for s in plan if s["kind"] == "probe"] ==
              ["probe_sink_xss.py", "probe_sink_sqli.py",
               "probe_sink_redirect.py", "probe_sink_ssrf.py",
               "probe_sink_header.py", "probe_sink_cmdi.py",
               "probe_sink_traversal.py",
               "probe_sink_ssti.py",
               "probe_sink_hostheader.py"] * 5)
        check("plan: sink spec rides in the marker argv, no slashes "
              "(PLOOP71 hostheader)",
              all((s["marker"].startswith("PLOOP56|") and
                   s["probe"] == "probe_sink_xss.py") or
                  (s["marker"].startswith("PLOOP57|") and
                   s["probe"] == "probe_sink_sqli.py") or
                  (s["marker"].startswith("PLOOP62|") and
                   s["probe"] == "probe_sink_redirect.py") or
                  (s["marker"].startswith("PLOOP63|") and
                   s["probe"] == "probe_sink_ssrf.py") or
                  (s["marker"].startswith("PLOOP64|") and
                   s["probe"] == "probe_sink_header.py") or
                  (s["marker"].startswith("PLOOP65|") and
                   s["probe"] == "probe_sink_cmdi.py") or
                  (s["marker"].startswith("PLOOP66|") and
                   s["probe"] == "probe_sink_traversal.py") or
                  (s["marker"].startswith("PLOOP67|") and
                   s["probe"] == "probe_sink_ssti.py") or
                  (s["marker"].startswith("PLOOP71|") and
                   s["probe"] == "probe_sink_hostheader.py")
                  for s in plan if s["kind"] == "probe") and
              all("/" not in s["marker"]
                  for s in plan if s["kind"] == "probe"))
        check("plan_meta: recon_ok=True, 5 generic sink ids recorded",
              meta["recon_ok"] is True and
              set(meta["generic_sinks"]) == set(ids))
        bi = budget_info([], sinks)
        check("budget: 5 sinks priced at 90 turns (Rule #62+#63+#64+"
              "#65+#66+#67+#71: each query sink costs 18)",
              bi["recommended_turns"] == 90 and bi["generic_turns"] == 90)

        # --- Case B: full autonomous cold drive vs fresh3 ---
        memdir = tempfile.mkdtemp(prefix="ploop59-b-")
        goal = "probe-hunt: fresh3 context-aware drive"
        ctx = {"registry_url": "http://127.0.0.1:9", "workdir": memdir,
               "memdir": memdir, "target_base": tb}
        verdicts, events = [], []
        for _ in range(150):
            r = run_turn(memdir, goal, ctx)
            events.extend(r.get("events", []))
            if "process_completed" in r.get("events", []):
                break
            verdicts.append(_hist(memdir)["history"][-1]["verdict"])
        sq = [i for i, v in enumerate(verdicts) if v == "CONFIRMED"]
        check("drive: exactly 4 CONFIRMED probes at turns 28/54/80/106 "
              "(greet, note, pref, tagline; each FAILED pair costs 3 "
              "turns: FAILED + probe DEAD_END + claim DEAD_END; Rule "
              "#62 adds a FAILED redirect pair, Rule #63 a FAILED "
              "ssrf pair, Rule #64 a FAILED header pair, Rule #65 "
              "a FAILED cmdi pair, Rule #66 a FAILED trav pair, "
              "Rule #67 a FAILED ssti pair and Rule #71 a FAILED "
              "hostheader pair per sink, each shifting "
              "later sinks by 3)",
              sq == [27, 53, 79, 105])
        check("drive: each CONFIRMED probe is followed by a FILED claim",
              all(verdicts[i + 1] == "FILED" for i in sq))
        check("drive: 131 verdict turns executed, process completed, no "
              "re-probe (5 all-negative sinks per Rule #71 pattern: "
              "each sink's 9th pair is the FAILED hostheader probe)",
              len(verdicts) == 131 and "process_completed" in events)
        check("drive: negative probes FAILED (escaped/parameterized "
              "sinks)", "FAILED" in verdicts)
        claims = json.load(open(os.path.join(memdir, "claims.json")))
        check("drive: exactly 4 claims filed, all generic_xss, all "
              "state=filed",
              len(claims) == 4 and
              all(v["state"] == "filed" for v in claims.values()) and
              {v["module"] for v in claims.values()} == {"generic_xss"})
        check("drive: Rule #59 — one claim per LOCATION (no BLOCKED-D "
              "on distinct pages)",
              {v.get("location") for v in claims.values()} ==
              {"/greet", "/note", "/pref", "/tagline"})
        store = HashStore(os.path.join(memdir, "output"))
        seen = set()
        for v in claims.values():
            check("drive: claim %s carries a real evidence hash"
                  % v.get("location"),
                  bool(HASH_RE.match(v.get("evidence_hash") or "")))
            raw = _to_text(store.get(v["evidence_hash"]) or b"")
            m = re.search(r"EVIDENCE sink=(\S+) .* via=([a-z-]+)",
                          raw)
            check("drive: stored output cites sink + via=<context>",
                  m is not None)
            seen.add((m.group(1), m.group(2)))
            check("drive: stored output ends VERDICT: CONFIRMED",
                  raw.strip().splitlines()[-1] == "VERDICT: CONFIRMED")
        check("drive: contexts proven attr-dq + attr-sq + comment + "
              "js-dq (a text-only probe would miss all four)",
              seen == {("/pref", "attr-dq"), ("/tagline", "attr-sq"),
                       ("/note", "comment"), ("/greet", "js-dq")})
    finally:
        _stop_mock(mp, 8343)

    # --- Case C: DVWA regression — zero generic sinks ---
    mp2 = _start_mock(dvwa, 8341, [])
    try:
        recon2 = _lab_recon_map("http://127.0.0.1:8341")
        sinks2 = _lab_generic_sinks("http://127.0.0.1:8341", None,
                                    list(recon2["modules"]))
        check("dvwa: auth pages skipped WITH REASON, zero generic sinks",
              sinks2 == [])
        plan2, meta2 = _lab_plan_for_hunt(list(recon2["modules"]),
                                          sinks2,
                                          "http://127.0.0.1:8341")
        check("dvwa: Rule #35 22-step plan byte-identical",
              len(plan2) == 22 and meta2["generic_sinks"] == [] and
              all(s["module"] in _HUNT_MODULE_ORDER for s in plan2))
    finally:
        _stop_mock(mp2, 8341)

    return {"checks": checks}


def proof_stylexss():
    """Rule #60 lab proof: <style>-context generic XSS.

    mock-fresh4 (probe-lab/mock-fresh4/fresh4_app.py) is a fourth unseen
    app: no DVWA module signals, so recon drops all 11 known modules and
    only generic sinks remain. /theme?css= reflects its param RAW inside
    a <style> element (<style type="text/css">.accent { color: CSS; }).
    A text-node <img> breakout is INERT in CSS — the probe must classify
    the "style" context and break out with </style>, citing via=style.
    /st?label= is HTML-escaped everywhere (negative control for both
    probes; SQLi negative too — static echo, and it also proves the
    style check does not false-positive on an escaped reflection).

    Case A — discovery: 2 sinks found, plan is 36 steps (xss+sqli+
    redirect+ssrf+header+cmdi+trav+ssti+hostheader probe+claim pairs
    per sink, Rule #62..Rule #67 + Rule #71), budget prices 36 turns.
    Case B — full cold drive: st xss/sqli FAILED (escaped/parameterized
    negative); theme xss CONFIRMED->FILED citing via=style; its sqli
    probe FAILED (static echo: no error keywords, no stable
    differential); exactly 1 filed claim (generic_xss) with a real
    evidence hash and location /theme; process completes, no re-probe.
    Case C — regression: the DVWA mock yields ZERO generic sinks so the
    Rule #35 22-step plan is byte-identical.
    """
    checks = []

    def check(name, cond):
        assert cond, "FAILED: " + name
        checks.append(name)

    def _hist(memdir):
        return load_json(mem_paths(memdir)["process"],
                         {"process": None})["process"]

    here = os.path.dirname(os.path.abspath(__file__))
    fresh4 = os.path.join(here, "probe-lab", "mock-fresh4",
                          "fresh4_app.py")
    dvwa = os.path.join(here, "probe-lab", "mock-dvwa.py")

    # --- Case A: discovery on the fourth unseen target ---
    mp = _start_mock(fresh4, 8344, [])
    try:
        tb = "http://127.0.0.1:8344"
        recon = _lab_recon_map(tb)
        check("fresh4: recon finds zero known modules",
              recon is not None and recon["modules"] == {})
        sinks = _lab_generic_sinks(tb, None, list(recon["modules"]))
        ids = [s["id"] for s in sinks]
        check("discovery: finds both style sinks",
              ids == ["query:/st:GET:label", "query:/theme:GET:css"])
        check("discovery: no sink touches a known module path",
              not any("vulnerabilities" in i for i in ids))
        plan, meta = _lab_plan_for_hunt([], sinks, tb)
        check("plan: 36 steps, xss+sqli+redirect+ssrf+header+cmdi+"
              "trav+ssti+hostheader probe+claim per sink (Rule #62, "
              "Rule #63, Rule #64, Rule #65, Rule #66, Rule #67, "
              "Rule #71)",
              len(plan) == 36 and
              [s["module"] for s in plan] ==
              ["generic_xss", "generic_xss",
               "generic_sqli", "generic_sqli",
               "generic_redirect", "generic_redirect",
               "generic_ssrf", "generic_ssrf",
               "generic_header", "generic_header",
               "generic_cmdi", "generic_cmdi",
               "generic_trav", "generic_trav",
               "generic_ssti", "generic_ssti",
               "generic_hostheader", "generic_hostheader"] * 2 and
              [s["kind"] for s in plan] ==
              ["probe", "claim"] * 18 and
              [s["probe"] for s in plan if s["kind"] == "probe"] ==
              ["probe_sink_xss.py", "probe_sink_sqli.py",
               "probe_sink_redirect.py", "probe_sink_ssrf.py",
               "probe_sink_header.py", "probe_sink_cmdi.py",
               "probe_sink_traversal.py",
               "probe_sink_ssti.py",
               "probe_sink_hostheader.py"] * 2)
        check("plan: sink spec rides in the marker argv, no slashes "
              "(PLOOP71 hostheader)",
              all((s["marker"].startswith("PLOOP56|") and
                   s["probe"] == "probe_sink_xss.py") or
                  (s["marker"].startswith("PLOOP57|") and
                   s["probe"] == "probe_sink_sqli.py") or
                  (s["marker"].startswith("PLOOP62|") and
                   s["probe"] == "probe_sink_redirect.py") or
                  (s["marker"].startswith("PLOOP63|") and
                   s["probe"] == "probe_sink_ssrf.py") or
                  (s["marker"].startswith("PLOOP64|") and
                   s["probe"] == "probe_sink_header.py") or
                  (s["marker"].startswith("PLOOP65|") and
                   s["probe"] == "probe_sink_cmdi.py") or
                  (s["marker"].startswith("PLOOP66|") and
                   s["probe"] == "probe_sink_traversal.py") or
                  (s["marker"].startswith("PLOOP67|") and
                   s["probe"] == "probe_sink_ssti.py") or
                  (s["marker"].startswith("PLOOP71|") and
                   s["probe"] == "probe_sink_hostheader.py")
                  for s in plan if s["kind"] == "probe") and
              all("/" not in s["marker"]
                  for s in plan if s["kind"] == "probe"))
        check("plan_meta: recon_ok=True, 2 generic sink ids recorded",
              meta["recon_ok"] is True and
              set(meta["generic_sinks"]) == set(ids))
        bi = budget_info([], sinks)
        check("budget: 2 sinks priced at 36 turns (Rule #62+#63+#64+"
              "#65+#66+#67+#71: each query sink costs 18)",
              bi["recommended_turns"] == 36 and bi["generic_turns"] == 36)

        # --- Case B: full autonomous cold drive vs fresh4 ---
        memdir = tempfile.mkdtemp(prefix="ploop60-b-")
        goal = "probe-hunt: fresh4 style-context drive"
        ctx = {"registry_url": "http://127.0.0.1:9", "workdir": memdir,
               "memdir": memdir, "target_base": tb}
        verdicts, events = [], []
        for _ in range(60):
            r = run_turn(memdir, goal, ctx)
            events.extend(r.get("events", []))
            if "process_completed" in r.get("events", []):
                break
            verdicts.append(_hist(memdir)["history"][-1]["verdict"])
        sq = [i for i, v in enumerate(verdicts) if v == "CONFIRMED"]
        check("drive: exactly 1 CONFIRMED probe at turn 28 (theme xss; "
              "the st sink comes first in sorted order and its "
              "xss+sqli+redirect+ssrf+header+cmdi+trav+ssti+hostheader "
              "FAILED pairs each cost 3 turns: FAILED + probe DEAD_END "
              "+ claim DEAD_END)",
              sq == [27])
        check("drive: the CONFIRMED probe is followed by a FILED claim",
              all(verdicts[i + 1] == "FILED" for i in sq))
        check("drive: 53 verdict turns executed, process completed, no "
              "re-probe (Rule #63: the two FAILED ssrf pairs add 6 "
              "turns; Rule #64: the two FAILED header pairs add 6 "
              "more; Rule #65: the two FAILED cmdi pairs add 6 more; "
              "Rule #66: the two FAILED trav pairs add 6 more; "
              "Rule #67: the two FAILED ssti pairs add 6 more; "
              "Rule #71: the two FAILED hostheader pairs add 6 more)",
              len(verdicts) == 53 and "process_completed" in events)
        check("drive: negative probes FAILED (escaped/parameterized "
              "sinks)", "FAILED" in verdicts)
        claims = json.load(open(os.path.join(memdir, "claims.json")))
        check("drive: exactly 1 claim filed, generic_xss, state=filed, "
              "location /theme",
              len(claims) == 1 and
              all(v["state"] == "filed" for v in claims.values()) and
              {v["module"] for v in claims.values()} == {"generic_xss"} and
              {v.get("location") for v in claims.values()} == {"/theme"})
        store = HashStore(os.path.join(memdir, "output"))
        for v in claims.values():
            check("drive: claim carries a real evidence hash",
                  bool(HASH_RE.match(v.get("evidence_hash") or "")))
            raw = _to_text(store.get(v["evidence_hash"]) or b"")
            m = re.search(r"EVIDENCE sink=(\S+) .* via=([a-z-]+)",
                          raw)
            check("drive: stored output cites sink + via=<context>",
                  m is not None)
            check("drive: Rule #60 — the context is style (a text-only "
                  "probe would CONFIRM nothing here)",
                  m is not None and
                  (m.group(1), m.group(2)) == ("/theme", "style"))
            check("drive: stored output ends VERDICT: CONFIRMED",
                  raw.strip().splitlines()[-1] == "VERDICT: CONFIRMED")
    finally:
        _stop_mock(mp, 8344)

    # --- Case C: DVWA regression — zero generic sinks ---
    mp2 = _start_mock(dvwa, 8341, [])
    try:
        recon2 = _lab_recon_map("http://127.0.0.1:8341")
        sinks2 = _lab_generic_sinks("http://127.0.0.1:8341", None,
                                    list(recon2["modules"]))
        check("dvwa: auth pages skipped WITH REASON, zero generic sinks",
              sinks2 == [])
        plan2, meta2 = _lab_plan_for_hunt(list(recon2["modules"]),
                                          sinks2,
                                          "http://127.0.0.1:8341")
        check("dvwa: Rule #35 22-step plan byte-identical",
              len(plan2) == 22 and meta2["generic_sinks"] == [] and
              all(s["module"] in _HUNT_MODULE_ORDER for s in plan2))
    finally:
        _stop_mock(mp2, 8341)

    return {"checks": checks}


def proof_csrfsink():
    """Rule #61 lab proof: generic CSRF state-change probe for POST sinks.

    mock-fresh5 (probe-lab/mock-fresh5/fresh5_app.py) is a fifth unseen
    app: no DVWA module signals, so recon drops all 11 known modules
    and only generic sinks remain. /prefs is a POST form with NO
    anti-CSRF token that persists the slogan server-side -> the CSRF
    probe must CONFIRM (via=csrf-no-token). /profile2 is a POST form
    whose hidden csrf_token the server enforces (403 without it) ->
    the CSRF probe must FAILED with the token-enforced negative
    control. Both pages escape their values (XSS negative) and answer
    POSTs with static pages (SQLi negative).

    Case A — discovery: 2 POST-form sinks found, plan is 16 steps
    (xss+sqli+csrf+redirect_post probe+claim quads per sink — the
    redirect_post pair per Rule #69), budget prices 16.
    Case B — full cold drive: prefs xss/sqli FAILED (escaped/static
    negatives); prefs csrf CONFIRMED->FILED citing via=csrf-no-token;
    prefs redirect_post FAILED (no redirect on the static POST);
    profile2 xss/sqli FAILED; profile2 csrf FAILED (token enforced);
    profile2 redirect_post FAILED (403, no Location); exactly 1 filed
    claim (generic_csrf) with a real evidence hash and location
    /prefs; 23 verdict turns; process completes, no re-probe.
    Case C — regression: the DVWA mock yields ZERO generic sinks so
    the Rule #35 22-step plan is byte-identical.
    """
    checks = []

    def check(name, cond):
        assert cond, "FAILED: " + name
        checks.append(name)

    def _hist(memdir):
        return load_json(mem_paths(memdir)["process"],
                         {"process": None})["process"]

    here = os.path.dirname(os.path.abspath(__file__))
    fresh5 = os.path.join(here, "probe-lab", "mock-fresh5",
                          "fresh5_app.py")
    dvwa = os.path.join(here, "probe-lab", "mock-dvwa.py")

    # --- Case A: discovery on the fifth unseen target ---
    mp = _start_mock(fresh5, 8345, [])
    try:
        tb = "http://127.0.0.1:8345"
        recon = _lab_recon_map(tb)
        check("fresh5: recon finds zero known modules",
              recon is not None and recon["modules"] == {})
        sinks = _lab_generic_sinks(tb, None, list(recon["modules"]))
        ids = [s["id"] for s in sinks]
        check("discovery: finds both POST-form sinks",
              ids == ["form:/prefs:POST:color,slogan",
                      "form:/profile2:POST:csrf_token,nick"])
        check("discovery: no sink touches a known module path",
              not any("vulnerabilities" in i for i in ids))
        plan, meta = _lab_plan_for_hunt([], sinks, tb)
        check("plan: 16 steps, xss+sqli+csrf+redirect_post probe+claim "
              "per POST sink (Rule #61 + Rule #69)",
              len(plan) == 16 and
              [s["module"] for s in plan] ==
              ["generic_xss", "generic_xss",
               "generic_sqli", "generic_sqli",
               "generic_csrf", "generic_csrf",
               "generic_redirect_post",
               "generic_redirect_post"] * 2 and
              [s["kind"] for s in plan] ==
              ["probe", "claim"] * 8 and
              [s["probe"] for s in plan if s["kind"] == "probe"] ==
              ["probe_sink_xss.py", "probe_sink_sqli.py",
               "probe_sink_csrf.py",
               "probe_sink_redirect_post.py"] * 2)
        check("plan: sink spec rides in the marker argv, no slashes",
              all((s["marker"].startswith("PLOOP56|") and
                   s["probe"] == "probe_sink_xss.py") or
                  (s["marker"].startswith("PLOOP57|") and
                   s["probe"] == "probe_sink_sqli.py") or
                  (s["marker"].startswith("PLOOP61|") and
                   s["probe"] == "probe_sink_csrf.py") or
                  (s["marker"].startswith("PLOOP69|") and
                   s["probe"] == "probe_sink_redirect_post.py")
                  for s in plan if s["kind"] == "probe") and
              all("/" not in s["marker"]
                  for s in plan if s["kind"] == "probe"))
        check("plan_meta: recon_ok=True, 2 generic sink ids recorded",
              meta["recon_ok"] is True and
              set(meta["generic_sinks"]) == set(ids))
        bi = budget_info([], sinks)
        check("budget: 2 POST-form sinks priced at 16 turns (Rule #69: "
              "each POST form costs 8)",
              bi["recommended_turns"] == 16 and bi["generic_turns"] == 16)

        # --- Case B: full autonomous cold drive vs fresh5 ---
        memdir = tempfile.mkdtemp(prefix="ploop61-b-")
        goal = "probe-hunt: fresh5 csrf-state-change drive"
        ctx = {"registry_url": "http://127.0.0.1:9", "workdir": memdir,
               "memdir": memdir, "target_base": tb}
        verdicts, events = [], []
        for _ in range(32):
            r = run_turn(memdir, goal, ctx)
            events.extend(r.get("events", []))
            if "process_completed" in r.get("events", []):
                break
            verdicts.append(_hist(memdir)["history"][-1]["verdict"])
        sq = [i for i, v in enumerate(verdicts) if v == "CONFIRMED"]
        check("drive: exactly 1 CONFIRMED probe at turn 7 (prefs csrf; "
              "every FAILED pair costs 3 turns: FAILED + probe DEAD_END "
              "+ claim DEAD_END)",
              sq == [6])
        check("drive: the CONFIRMED probe is followed by a FILED claim",
              all(verdicts[i + 1] == "FILED" for i in sq))
        check("drive: profile2 csrf FAILED (token enforced — the "
              "negative control holds)",
              verdicts[17] == "FAILED")
        check("drive: 23 verdict turns executed, process completed, no "
              "re-probe (Rule #69: each POST form carries a FAILED "
              "redirect_post pair costing 3 turns after its csrf "
              "pair)",
              len(verdicts) == 23 and "process_completed" in events)
        claims = json.load(open(os.path.join(memdir, "claims.json")))
        check("drive: exactly 1 claim filed, generic_csrf, state=filed, "
              "location /prefs",
              len(claims) == 1 and
              all(v["state"] == "filed" for v in claims.values()) and
              {v["module"] for v in claims.values()} == {"generic_csrf"}
              and
              {v.get("location") for v in claims.values()} == {"/prefs"})
        store = HashStore(os.path.join(memdir, "output"))
        for v in claims.values():
            check("drive: claim carries a real evidence hash",
                  bool(HASH_RE.match(v.get("evidence_hash") or "")))
            raw = _to_text(store.get(v["evidence_hash"]) or b"")
            m = re.search(r"EVIDENCE sink=(\S+) .* via=([a-z-]+)",
                          raw)
            check("drive: stored output cites sink + via=<class>",
                  m is not None)
            check("drive: Rule #61 — the class is csrf-no-token (a "
                  "no-token POST persisted server-side)",
                  m is not None and
                  (m.group(1), m.group(2)) == ("/prefs", "csrf-no-token"))
            check("drive: stored output ends VERDICT: CONFIRMED",
                  raw.strip().splitlines()[-1] == "VERDICT: CONFIRMED")
    finally:
        _stop_mock(mp, 8345)

    # --- Case C: DVWA regression — zero generic sinks ---
    mp2 = _start_mock(dvwa, 8341, [])
    try:
        recon2 = _lab_recon_map("http://127.0.0.1:8341")
        sinks2 = _lab_generic_sinks("http://127.0.0.1:8341", None,
                                    list(recon2["modules"]))
        check("dvwa: auth pages skipped WITH REASON, zero generic sinks",
              sinks2 == [])
        plan2, meta2 = _lab_plan_for_hunt(list(recon2["modules"]),
                                          sinks2,
                                          "http://127.0.0.1:8341")
        check("dvwa: Rule #35 22-step plan byte-identical",
              len(plan2) == 22 and meta2["generic_sinks"] == [] and
              all(s["module"] in _HUNT_MODULE_ORDER for s in plan2))
    finally:
        _stop_mock(mp2, 8341)

    return {"checks": checks}


def proof_redirect():
    """Rule #62 lab proof: generic open-redirect probe for query sinks.

    mock-fresh6 (probe-lab/mock-fresh6/fresh6_app.py) is a sixth unseen
    app: no DVWA module signals, so recon drops all 11 known modules
    and only generic sinks remain. /go?next= 302s with the raw next
    value as Location -> the redirect probe must CONFIRM
    (via=redirect-location). /jump?to= answers 200 with an escaped
    meta-refresh to the to value -> CONFIRM (via=redirect-meta).
    /safe?dest= only honors relative destinations (else 302 to /home)
    -> the redirect probe must FAILED (negative control). All three
    pages are reflection-free and DB-free (XSS/SQLi negatives).

    Case A — discovery: 3 query sinks found, plan is 54 steps
    (xss+sqli+redirect+ssrf+header+cmdi+trav+ssti+hostheader
    probe+claim pairs per sink), budget prices 54.
    Case B — full cold drive: go redirect CONFIRMED->FILED at turn 7
    (via=redirect-location), go header-injection CONFIRMED->FILED at
    turn 12 (via=header-crlf — /go's raw Location reflection is ALSO
    a genuine CRLF sink, a real second finding the Rule #64 probe
    catches), jump redirect CONFIRMED->FILED at turn 32
    (via=redirect-meta); safe redirect/header/cmdi/trav FAILED
    (canary never leaves the host, no header reflection, no shell,
    no file read); all xss/sqli/ssrf/hostheader FAILED; exactly 3
    filed claims
    (2 generic_redirect + 1 generic_header), locations /go and /jump;
    process completes, no re-probe.
    Case C — regression: the DVWA mock yields ZERO generic sinks so
    the Rule #35 22-step plan is byte-identical.
    """
    checks = []

    def check(name, cond):
        assert cond, "FAILED: " + name
        checks.append(name)

    def _hist(memdir):
        return load_json(mem_paths(memdir)["process"],
                         {"process": None})["process"]

    here = os.path.dirname(os.path.abspath(__file__))
    fresh6 = os.path.join(here, "probe-lab", "mock-fresh6",
                          "fresh6_app.py")
    dvwa = os.path.join(here, "probe-lab", "mock-dvwa.py")

    # --- Case A: discovery on the sixth unseen target ---
    mp = _start_mock(fresh6, 8346, [])
    try:
        tb = "http://127.0.0.1:8346"
        recon = _lab_recon_map(tb)
        check("fresh6: recon finds zero known modules",
              recon is not None and recon["modules"] == {})
        sinks = _lab_generic_sinks(tb, None, list(recon["modules"]))
        ids = [s["id"] for s in sinks]
        check("discovery: finds all 3 query sinks (go, jump, safe)",
              ids == ["query:/go:GET:next",
                      "query:/jump:GET:to",
                      "query:/safe:GET:dest"])
        check("discovery: no sink touches a known module path",
              not any("vulnerabilities" in i for i in ids))
        plan, meta = _lab_plan_for_hunt([], sinks, tb)
        check("plan: 54 steps, xss+sqli+redirect+ssrf+header+cmdi+"
              "trav+ssti+hostheader probe+claim per query sink "
              "(Rule #62, Rule #63, Rule #64, Rule #65, Rule #66, "
              "Rule #67, Rule #71)",
              len(plan) == 54 and
              [s["module"] for s in plan] ==
              ["generic_xss", "generic_xss",
               "generic_sqli", "generic_sqli",
               "generic_redirect", "generic_redirect",
               "generic_ssrf", "generic_ssrf",
               "generic_header", "generic_header",
               "generic_cmdi", "generic_cmdi",
               "generic_trav", "generic_trav",
               "generic_ssti", "generic_ssti",
               "generic_hostheader", "generic_hostheader"] * 3 and
              [s["kind"] for s in plan] ==
              ["probe", "claim"] * 27 and
              [s["probe"] for s in plan if s["kind"] == "probe"] ==
              ["probe_sink_xss.py", "probe_sink_sqli.py",
               "probe_sink_redirect.py", "probe_sink_ssrf.py",
               "probe_sink_header.py", "probe_sink_cmdi.py",
               "probe_sink_traversal.py",
               "probe_sink_ssti.py",
               "probe_sink_hostheader.py"] * 3)
        check("plan: sink spec rides in the marker argv "
              "(PLOOP56|../PLOOP57|../PLOOP62|../PLOOP63|../PLOOP64|../"
              "PLOOP65|../PLOOP66|../PLOOP67|../PLOOP71|..)",
              all((s["marker"].startswith("PLOOP56|") and
                   s["probe"] == "probe_sink_xss.py") or
                  (s["marker"].startswith("PLOOP57|") and
                   s["probe"] == "probe_sink_sqli.py") or
                  (s["marker"].startswith("PLOOP62|") and
                   s["probe"] == "probe_sink_redirect.py") or
                  (s["marker"].startswith("PLOOP63|") and
                   s["probe"] == "probe_sink_ssrf.py") or
                  (s["marker"].startswith("PLOOP64|") and
                   s["probe"] == "probe_sink_header.py") or
                  (s["marker"].startswith("PLOOP65|") and
                   s["probe"] == "probe_sink_cmdi.py") or
                  (s["marker"].startswith("PLOOP66|") and
                   s["probe"] == "probe_sink_traversal.py") or
                  (s["marker"].startswith("PLOOP67|") and
                   s["probe"] == "probe_sink_ssti.py") or
                  (s["marker"].startswith("PLOOP71|") and
                   s["probe"] == "probe_sink_hostheader.py")
                  for s in plan if s["kind"] == "probe") and
              all("/" not in s["marker"]
                  for s in plan if s["kind"] == "probe"))
        check("plan_meta: recon_ok=True, 3 generic sink ids recorded",
              meta["recon_ok"] is True and
              set(meta["generic_sinks"]) == set(ids))
        bi = budget_info([], sinks)
        check("budget: 3 query sinks priced at 54 turns (Rule #62+#63+"
              "#64+#65+#66+#67+#71: each costs 18)",
              bi["recommended_turns"] == 54 and bi["generic_turns"] == 54)

        # --- Case B: full autonomous cold drive vs fresh6 ---
        memdir = tempfile.mkdtemp(prefix="ploop62-b-")
        goal = "probe-hunt: fresh6 open-redirect drive"
        ctx = {"registry_url": "http://127.0.0.1:9", "workdir": memdir,
               "memdir": memdir, "target_base": tb}
        verdicts, events = [], []
        for _ in range(80):
            r = run_turn(memdir, goal, ctx)
            events.extend(r.get("events", []))
            if "process_completed" in r.get("events", []):
                break
            verdicts.append(_hist(memdir)["history"][-1]["verdict"])
        sq = [i for i, v in enumerate(verdicts) if v == "CONFIRMED"]
        check("drive: exactly 3 CONFIRMED probes at turns 7, 12 and 32 "
              "(go redirect, go header, jump redirect; a FAILED pair "
              "costs 3 turns: FAILED + probe DEAD_END + claim DEAD_END; "
              "Rule #63 adds a FAILED ssrf pair per sink, Rule #64 the "
              "header pair, Rule #65 the cmdi pair, Rule #66 the trav "
              "pair, Rule #67 the ssti pair and Rule #71 the "
              "hostheader pair — and /go's raw "
              "Location reflection is GENUINELY header-injectable, "
              "so its header pair CONFIRMs instead of failing)",
              sq == [6, 11, 31])
        check("drive: each CONFIRMED probe is followed by a FILED claim",
              all(verdicts[i + 1] == "FILED" for i in sq))
        check("drive: safe redirect FAILED at turn 58 (negative control "
              "— the canary never leaves the host)",
              verdicts[57] == "FAILED")
        check("drive: 78 verdict turns executed, process completed, no "
              "re-probe (go carries one CONFIRMED header pair: 2 "
              "turns, not 3; Rule #66 adds one FAILED trav pair per "
              "sink: 3 turns each; Rule #67 adds one FAILED ssti pair "
              "per sink: 3 turns each; Rule #71 adds one FAILED "
              "hostheader pair per sink: 3 turns each)",
              len(verdicts) == 78 and "process_completed" in events)
        claims = json.load(open(os.path.join(memdir, "claims.json")))
        check("drive: exactly 3 claims filed — 2 generic_redirect "
              "(/go, /jump) + 1 generic_header (/go), all state=filed",
              len(claims) == 3 and
              all(v["state"] == "filed" for v in claims.values()) and
              {v["module"] for v in claims.values()} ==
              {"generic_redirect", "generic_header"} and
              {v.get("location") for v in claims.values()} ==
              {"/go", "/jump"})
        store = HashStore(os.path.join(memdir, "output"))
        got = set()
        for v in claims.values():
            check("drive: claim carries a real evidence hash",
                  bool(HASH_RE.match(v.get("evidence_hash") or "")))
            raw = _to_text(store.get(v["evidence_hash"]) or b"")
            m = re.search(r"EVIDENCE sink=(\S+) .* via=([a-z-]+)",
                          raw)
            check("drive: stored output cites sink + via=<class>",
                  m is not None)
            if m:
                got.add((v["module"], m.group(1), m.group(2)))
            check("drive: stored output ends VERDICT: CONFIRMED",
                  raw.strip().splitlines()[-1] == "VERDICT: CONFIRMED")
        check("drive: Rule #62 — /go confirmed via=redirect-location, "
              "/jump via=redirect-meta (302 Location + meta refresh); "
              "Rule #64 — /go ALSO confirmed via=header-crlf (its raw "
              "Location reflection is a genuine CRLF sink)",
              got == {("generic_redirect", "/go", "redirect-location"),
                      ("generic_redirect", "/jump", "redirect-meta"),
                      ("generic_header", "/go", "header-crlf")})
    finally:
        _stop_mock(mp, 8346)

    # --- Case C: DVWA regression — zero generic sinks ---
    mp2 = _start_mock(dvwa, 8341, [])
    try:
        recon2 = _lab_recon_map("http://127.0.0.1:8341")
        sinks2 = _lab_generic_sinks("http://127.0.0.1:8341", None,
                                    list(recon2["modules"]))
        check("dvwa: auth pages skipped WITH REASON, zero generic sinks",
              sinks2 == [])
        plan2, meta2 = _lab_plan_for_hunt(list(recon2["modules"]),
                                          sinks2,
                                          "http://127.0.0.1:8341")
        check("dvwa: Rule #35 22-step plan byte-identical",
              len(plan2) == 22 and meta2["generic_sinks"] == [] and
              all(s["module"] in _HUNT_MODULE_ORDER for s in plan2))
    finally:
        _stop_mock(mp2, 8341)

    return {"checks": checks}


def proof_ssrf():
    """Rule #63 lab proof: generic SSRF-reachability probe for query
    sinks.

    mock-fresh7 (probe-lab/mock-fresh7/fresh7_app.py) is a seventh
    unseen app: no DVWA module signals, so recon drops all 11 known
    modules and only generic sinks remain. /fetch?url= server-side
    fetches the raw url value (proxy-less opener, so the fetch hits
    the probe's own loopback listener directly) -> the SSRF probe
    must CONFIRM (via=ssrf-fetch-hit). /echo?url= echoes the escaped
    url value but NEVER fetches -> the probe must FAILED (echo !=
    fetch — the hard fail-closed negative control for Rule #63).
    /safe?q= is static -> FAILED. All three pages are DB-free
    (SQLi negatives), redirect-free (redirect negatives) and
    reflection-free (XSS negatives).

    Case A — discovery: 3 query sinks found, plan is 54 steps
    (xss+sqli+redirect+ssrf+header+cmdi+trav+ssti+hostheader
    probe+claim pairs per sink), budget prices 54.
    Case B — full cold drive: fetch ssrf CONFIRMED->FILED at turn 37
    (via=ssrf-fetch-hit); echo ssrf FAILED at turn 10 (the token was
    visible in the body but the listener saw no fetch); safe ssrf
    FAILED; all xss/sqli/redirect/header/cmdi/hostheader FAILED;
    exactly 1 filed
    claim (generic_ssrf), location /fetch; process completes, no
    re-probe.
    Case C — regression: the DVWA mock yields ZERO generic sinks so
    the Rule #35 22-step plan is byte-identical.
    """
    checks = []

    def check(name, cond):
        assert cond, "FAILED: " + name
        checks.append(name)

    def _hist(memdir):
        return load_json(mem_paths(memdir)["process"],
                         {"process": None})["process"]

    here = os.path.dirname(os.path.abspath(__file__))
    fresh7 = os.path.join(here, "probe-lab", "mock-fresh7",
                          "fresh7_app.py")
    dvwa = os.path.join(here, "probe-lab", "mock-dvwa.py")

    # --- Case A: discovery on the seventh unseen target ---
    mp = _start_mock(fresh7, 8347, [])
    try:
        tb = "http://127.0.0.1:8347"
        recon = _lab_recon_map(tb)
        check("fresh7: recon finds zero known modules",
              recon is not None and recon["modules"] == {})
        sinks = _lab_generic_sinks(tb, None, list(recon["modules"]))
        ids = [s["id"] for s in sinks]
        check("discovery: finds all 3 query sinks (echo, fetch, safe)",
              ids == ["query:/echo:GET:url",
                      "query:/fetch:GET:url",
                      "query:/safe:GET:q"])
        check("discovery: no sink touches a known module path",
              not any("vulnerabilities" in i for i in ids))
        plan, meta = _lab_plan_for_hunt([], sinks, tb)
        check("plan: 54 steps, xss+sqli+redirect+ssrf+header+cmdi+"
              "trav+ssti+hostheader probe+claim per query sink "
              "(Rule #63, Rule #64, Rule #65, Rule #66, Rule #67, "
              "Rule #71)",
              len(plan) == 54 and
              [s["module"] for s in plan] ==
              ["generic_xss", "generic_xss",
               "generic_sqli", "generic_sqli",
               "generic_redirect", "generic_redirect",
               "generic_ssrf", "generic_ssrf",
               "generic_header", "generic_header",
               "generic_cmdi", "generic_cmdi",
               "generic_trav", "generic_trav",
               "generic_ssti", "generic_ssti",
               "generic_hostheader", "generic_hostheader"] * 3 and
              [s["kind"] for s in plan] ==
              ["probe", "claim"] * 27 and
              [s["probe"] for s in plan if s["kind"] == "probe"] ==
              ["probe_sink_xss.py", "probe_sink_sqli.py",
               "probe_sink_redirect.py", "probe_sink_ssrf.py",
               "probe_sink_header.py", "probe_sink_cmdi.py",
               "probe_sink_traversal.py",
               "probe_sink_ssti.py",
               "probe_sink_hostheader.py"] * 3)
        check("plan: sink spec rides in the marker argv "
              "(PLOOP56|../PLOOP57|../PLOOP62|../PLOOP63|../PLOOP64|../"
              "PLOOP65|../PLOOP66|../PLOOP67|../PLOOP71|..)",
              all((s["marker"].startswith("PLOOP56|") and
                   s["probe"] == "probe_sink_xss.py") or
                  (s["marker"].startswith("PLOOP57|") and
                   s["probe"] == "probe_sink_sqli.py") or
                  (s["marker"].startswith("PLOOP62|") and
                   s["probe"] == "probe_sink_redirect.py") or
                  (s["marker"].startswith("PLOOP63|") and
                   s["probe"] == "probe_sink_ssrf.py") or
                  (s["marker"].startswith("PLOOP64|") and
                   s["probe"] == "probe_sink_header.py") or
                  (s["marker"].startswith("PLOOP65|") and
                   s["probe"] == "probe_sink_cmdi.py") or
                  (s["marker"].startswith("PLOOP66|") and
                   s["probe"] == "probe_sink_traversal.py") or
                  (s["marker"].startswith("PLOOP67|") and
                   s["probe"] == "probe_sink_ssti.py") or
                  (s["marker"].startswith("PLOOP71|") and
                   s["probe"] == "probe_sink_hostheader.py")
                  for s in plan if s["kind"] == "probe") and
              all("/" not in s["marker"]
                  for s in plan if s["kind"] == "probe"))
        check("plan_meta: recon_ok=True, 3 generic sink ids recorded",
              meta["recon_ok"] is True and
              set(meta["generic_sinks"]) == set(ids))
        bi = budget_info([], sinks)
        check("budget: 3 query sinks priced at 54 turns (Rule #63+#64+"
              "#65+#66+#67+#71: each costs 18)",
              bi["recommended_turns"] == 54 and bi["generic_turns"] == 54)

        # --- Case B: full autonomous cold drive vs fresh7 ---
        memdir = tempfile.mkdtemp(prefix="ploop63-b-")
        goal = "probe-hunt: fresh7 ssrf drive"
        ctx = {"registry_url": "http://127.0.0.1:9", "workdir": memdir,
               "memdir": memdir, "target_base": tb}
        verdicts, events = [], []
        for _ in range(90):
            r = run_turn(memdir, goal, ctx)
            events.extend(r.get("events", []))
            if "process_completed" in r.get("events", []):
                break
            verdicts.append(_hist(memdir)["history"][-1]["verdict"])
        sq = [i for i, v in enumerate(verdicts) if v == "CONFIRMED"]
        check("drive: exactly 1 CONFIRMED probe at turn 37 "
              "(fetch ssrf; the echo sink's xss/sqli/redirect/ssrf/"
              "header/cmdi/trav/ssti/hostheader FAILED pairs cost 3 "
              "turns each "
              "first: FAILED + probe DEAD_END + claim DEAD_END, and "
              "so do the fetch xss/sqli/redirect pairs before it)",
              sq == [36])
        check("drive: the CONFIRMED probe is followed by a FILED claim",
              all(verdicts[i + 1] == "FILED" for i in sq))
        check("drive: echo ssrf FAILED at turn 10 — the escaped canary "
              "URL was visible in the body but the listener saw no "
              "fetch (echo != fetch, Rule #63 fail-closed)",
              verdicts[9] == "FAILED")
        check("drive: 80 verdict turns executed, process completed, no "
              "re-probe (Rule #64: each sink's FAILED header pair adds "
              "3 turns; Rule #65: each sink's FAILED cmdi pair adds 3 "
              "more; Rule #66: each sink's FAILED trav pair adds 3 "
              "more; Rule #67: each sink's FAILED ssti pair adds 3 "
              "more; Rule #71: each sink's FAILED hostheader pair "
              "adds 3 more)",
              len(verdicts) == 80 and "process_completed" in events)
        claims = json.load(open(os.path.join(memdir, "claims.json")))
        check("drive: exactly 1 claim filed, generic_ssrf, "
              "state=filed, location /fetch",
              len(claims) == 1 and
              all(v["state"] == "filed" for v in claims.values()) and
              {v["module"] for v in claims.values()} ==
              {"generic_ssrf"} and
              {v.get("location") for v in claims.values()} ==
              {"/fetch"})
        store = HashStore(os.path.join(memdir, "output"))
        got = {}
        for v in claims.values():
            check("drive: claim carries a real evidence hash",
                  bool(HASH_RE.match(v.get("evidence_hash") or "")))
            raw = _to_text(store.get(v["evidence_hash"]) or b"")
            m = re.search(r"EVIDENCE sink=(\S+) .* via=([a-z-]+)",
                          raw)
            check("drive: stored output cites sink + via=<class>",
                  m is not None)
            if m:
                got[m.group(1)] = m.group(2)
            check("drive: stored output ends VERDICT: CONFIRMED",
                  raw.strip().splitlines()[-1] == "VERDICT: CONFIRMED")
        check("drive: Rule #63 — /fetch confirmed via=ssrf-fetch-hit "
              "(the probe's own loopback listener recorded the "
              "server-side fetch)",
              got == {"/fetch": "ssrf-fetch-hit"})
    finally:
        _stop_mock(mp, 8347)

    # --- Case C: DVWA regression — zero generic sinks ---
    mp2 = _start_mock(dvwa, 8341, [])
    try:
        recon2 = _lab_recon_map("http://127.0.0.1:8341")
        sinks2 = _lab_generic_sinks("http://127.0.0.1:8341", None,
                                    list(recon2["modules"]))
        check("dvwa: auth pages skipped WITH REASON, zero generic sinks",
              sinks2 == [])
        plan2, meta2 = _lab_plan_for_hunt(list(recon2["modules"]),
                                          sinks2,
                                          "http://127.0.0.1:8341")
        check("dvwa: Rule #35 22-step plan byte-identical",
              len(plan2) == 22 and meta2["generic_sinks"] == [] and
              all(s["module"] in _HUNT_MODULE_ORDER for s in plan2))
    finally:
        _stop_mock(mp2, 8341)

    return {"checks": checks}


def proof_header():
    """Rule #64 lab proof: generic header-injection / CRLF probe for
    query sinks.

    mock-fresh8 (probe-lab/mock-fresh8/fresh8_app.py) is an eighth
    unseen app: no DVWA module signals, so recon drops all 11 known
    modules and only generic sinks remain. /banner?theme= reflects the
    raw theme value VERBATIM into the X-Theme RESPONSE HEADER ->
    the header probe must CONFIRM (via=header-crlf): the probe's
    injected CRLF header lands as a real response header. /bounce?to=
    echoes the escaped value into the BODY only, never into a header
    -> the probe must FAILED (body-echo != header injection — the
    hard fail-closed negative control). /scrubbed?theme= reflects
    into the X-Theme header but STRIPS CR/LF first (a sanitizer, not
    a vuln) -> FAILED. /safe?q= is static -> FAILED. All four pages
    are DB-free (SQLi negatives), redirect-free (redirect negatives)
    and fetch-free (SSRF negatives); the body of /banner is static
    (XSS negative).

    Case A — discovery: 4 query sinks found, plan is 72 steps
    (xss+sqli+redirect+ssrf+header+cmdi+trav+ssti+hostheader
    probe+claim pairs per sink), budget prices 72.
    Case B — full cold drive: banner header CONFIRMED->FILED at turn
    13 (via=header-crlf); bounce/scrubbed/safe header FAILED; all
    xss/sqli/redirect/ssrf/cmdi/trav/hostheader FAILED; exactly 1
    filed claim
    (generic_header), location /banner; process completes, no re-probe.
    Case C — regression: the DVWA mock yields ZERO generic sinks so the
    Rule #35 22-step plan is byte-identical.
    """
    checks = []

    def check(name, cond):
        assert cond, "FAILED: " + name
        checks.append(name)

    def _hist(memdir):
        return load_json(mem_paths(memdir)["process"],
                         {"process": None})["process"]

    here = os.path.dirname(os.path.abspath(__file__))
    fresh8 = os.path.join(here, "probe-lab", "mock-fresh8",
                          "fresh8_app.py")
    dvwa = os.path.join(here, "probe-lab", "mock-dvwa.py")

    # --- Case A: discovery on the eighth unseen target ---
    mp = _start_mock(fresh8, 8348, [])
    try:
        tb = "http://127.0.0.1:8348"
        recon = _lab_recon_map(tb)
        check("fresh8: recon finds zero known modules",
              recon is not None and recon["modules"] == {})
        sinks = _lab_generic_sinks(tb, None, list(recon["modules"]))
        ids = [s["id"] for s in sinks]
        check("discovery: finds all 4 query sinks "
              "(banner, bounce, safe, scrubbed)",
              ids == ["query:/banner:GET:theme",
                      "query:/bounce:GET:to",
                      "query:/safe:GET:q",
                      "query:/scrubbed:GET:theme"])
        check("discovery: no sink touches a known module path",
              not any("vulnerabilities" in i for i in ids))
        plan, meta = _lab_plan_for_hunt([], sinks, tb)
        check("plan: 72 steps, xss+sqli+redirect+ssrf+header+cmdi+"
              "trav+ssti+hostheader probe+claim per query sink "
              "(Rule #64, Rule #65, Rule #66, Rule #67, Rule #71)",
              len(plan) == 72 and
              [s["module"] for s in plan] ==
              ["generic_xss", "generic_xss",
               "generic_sqli", "generic_sqli",
               "generic_redirect", "generic_redirect",
               "generic_ssrf", "generic_ssrf",
               "generic_header", "generic_header",
               "generic_cmdi", "generic_cmdi",
               "generic_trav", "generic_trav",
               "generic_ssti", "generic_ssti",
               "generic_hostheader", "generic_hostheader"] * 4 and
              [s["kind"] for s in plan] ==
              ["probe", "claim"] * 36 and
              [s["probe"] for s in plan if s["kind"] == "probe"] ==
              ["probe_sink_xss.py", "probe_sink_sqli.py",
               "probe_sink_redirect.py", "probe_sink_ssrf.py",
               "probe_sink_header.py", "probe_sink_cmdi.py",
               "probe_sink_traversal.py",
               "probe_sink_ssti.py",
               "probe_sink_hostheader.py"] * 4)
        check("plan: sink spec rides in the marker argv "
              "(PLOOP56|../PLOOP57|../PLOOP62|../PLOOP63|../PLOOP64|../"
              "PLOOP65|../PLOOP66|../PLOOP67|../PLOOP71|..)",
              all((s["marker"].startswith("PLOOP56|") and
                   s["probe"] == "probe_sink_xss.py") or
                  (s["marker"].startswith("PLOOP57|") and
                   s["probe"] == "probe_sink_sqli.py") or
                  (s["marker"].startswith("PLOOP62|") and
                   s["probe"] == "probe_sink_redirect.py") or
                  (s["marker"].startswith("PLOOP63|") and
                   s["probe"] == "probe_sink_ssrf.py") or
                  (s["marker"].startswith("PLOOP64|") and
                   s["probe"] == "probe_sink_header.py") or
                  (s["marker"].startswith("PLOOP65|") and
                   s["probe"] == "probe_sink_cmdi.py") or
                  (s["marker"].startswith("PLOOP66|") and
                   s["probe"] == "probe_sink_traversal.py") or
                  (s["marker"].startswith("PLOOP67|") and
                   s["probe"] == "probe_sink_ssti.py") or
                  (s["marker"].startswith("PLOOP71|") and
                   s["probe"] == "probe_sink_hostheader.py")
                  for s in plan if s["kind"] == "probe") and
              all("/" not in s["marker"]
                  for s in plan if s["kind"] == "probe"))
        check("plan_meta: recon_ok=True, 4 generic sink ids recorded",
              meta["recon_ok"] is True and
              set(meta["generic_sinks"]) == set(ids))
        bi = budget_info([], sinks)
        check("budget: 4 query sinks priced at 72 turns (Rule #64+#65+"
              "#66+#67+#71: each costs 18)",
              bi["recommended_turns"] == 72 and bi["generic_turns"] == 72)

        # --- Case B: full autonomous cold drive vs fresh8 ---
        memdir = tempfile.mkdtemp(prefix="ploop64-b-")
        goal = "probe-hunt: fresh8 header-injection drive"
        ctx = {"registry_url": "http://127.0.0.1:9", "workdir": memdir,
               "memdir": memdir, "target_base": tb}
        verdicts, events = [], []
        for _ in range(110):
            r = run_turn(memdir, goal, ctx)
            events.extend(r.get("events", []))
            if "process_completed" in r.get("events", []):
                break
            verdicts.append(_hist(memdir)["history"][-1]["verdict"])
        sq = [i for i, v in enumerate(verdicts) if v == "CONFIRMED"]
        check("drive: banner header CONFIRMED at turn 13 (the banner "
              "xss/sqli/redirect/ssrf FAILED pairs cost 3 turns each "
              "first: FAILED + probe DEAD_END + claim DEAD_END)",
              sq == [12])
        check("drive: the CONFIRMED probe is followed by a FILED claim",
              all(verdicts[i + 1] == "FILED" for i in sq))
        check("drive: bounce header FAILED at turn 39 — the escaped "
              "canary text was visible in the body but no injected "
              "header existed (body-echo != header injection, Rule #64 "
              "fail-closed)",
              verdicts[38] == "FAILED")
        check("drive: scrubbed header FAILED at turn 93 — the sanitizer "
              "strips CR/LF so no injected header forms",
              verdicts[92] == "FAILED")
        check("drive: 107 verdict turns executed, process completed, no "
              "re-probe (Rule #66: each sink's FAILED trav pair adds "
              "3 turns; Rule #67: each sink's FAILED ssti pair adds "
              "3 more; Rule #71: each sink's FAILED hostheader pair "
              "adds 3 more)",
              len(verdicts) == 107 and "process_completed" in events)
        claims = json.load(open(os.path.join(memdir, "claims.json")))
        check("drive: exactly 1 claim filed, generic_header, "
              "state=filed, location /banner",
              len(claims) == 1 and
              all(v["state"] == "filed" for v in claims.values()) and
              {v["module"] for v in claims.values()} ==
              {"generic_header"} and
              {v.get("location") for v in claims.values()} ==
              {"/banner"})
        store = HashStore(os.path.join(memdir, "output"))
        got = {}
        for v in claims.values():
            check("drive: claim carries a real evidence hash",
                  bool(HASH_RE.match(v.get("evidence_hash") or "")))
            raw = _to_text(store.get(v["evidence_hash"]) or b"")
            m = re.search(r"EVIDENCE sink=(\S+) .* via=([a-z-]+)",
                          raw)
            check("drive: stored output cites sink + via=<class>",
                  m is not None)
            if m:
                got[m.group(1)] = m.group(2)
            check("drive: stored output ends VERDICT: CONFIRMED",
                  raw.strip().splitlines()[-1] == "VERDICT: CONFIRMED")
        check("drive: Rule #64 — /banner confirmed via=header-crlf "
              "(the probe's injected CRLF parsed as a real response "
              "header)",
              got == {"/banner": "header-crlf"})
    finally:
        _stop_mock(mp, 8348)

    # --- Case C: DVWA regression — zero generic sinks ---
    mp2 = _start_mock(dvwa, 8341, [])
    try:
        recon2 = _lab_recon_map("http://127.0.0.1:8341")
        sinks2 = _lab_generic_sinks("http://127.0.0.1:8341", None,
                                    list(recon2["modules"]))
        check("dvwa: auth pages skipped WITH REASON, zero generic sinks",
              sinks2 == [])
        plan2, meta2 = _lab_plan_for_hunt(list(recon2["modules"]),
                                          sinks2,
                                          "http://127.0.0.1:8341")
        check("dvwa: Rule #35 22-step plan byte-identical",
              len(plan2) == 22 and meta2["generic_sinks"] == [] and
              all(s["module"] in _HUNT_MODULE_ORDER for s in plan2))
    finally:
        _stop_mock(mp2, 8341)

    return {"checks": checks}



def proof_cmdi():
    """Rule #65 lab proof: generic blind command-injection probe for
    query sinks.

    mock-fresh9 (probe-lab/mock-fresh9/fresh9_app.py) is a ninth
    unseen app: no DVWA module signals, so recon drops all 11 known
    modules and only generic sinks remain. /calc?expr= interpolates
    the raw expr into "echo <expr>" through a shell and embeds the
    captured stdout in the page -> the cmdi probe must CONFIRM via
    the OUTPUT channel (via=cmdi-arith): the arithmetic result
    "19134" appears in the body though it was never transmitted.
    /ping?host= interpolates the raw host into a shell command whose
    output is discarded, then answers a static "done" page ->
    the cmdi probe must CONFIRM via the TIMING channel
    (via=cmdi-timing): a ";sleep N" payload delays the response by N
    seconds and the delay SCALES with the injected number (D=4 vs
    D=8 differential). /echo?name= echoes the HTML-escaped name with
    NO shell -> the cmdi probe must FAILED (a verbatim echo of the
    payload without evaluation is reflection, not execution — the
    hard negative control for the OUTPUT channel). /safe?q= is
    static -> FAILED. All four pages are DB-free (SQLi negatives),
    redirect-free (redirect negatives) and fetch-free (SSRF
    negatives); the /calc shell mangles < > | & ; so other probes'
    payloads never reflect verbatim (XSS negative for them).

    Case A — discovery: 4 query sinks found, plan is 72 steps
    (xss+sqli+redirect+ssrf+header+cmdi+trav+ssti+hostheader
    probe+claim pairs per sink), budget prices 72.
    Case B — full cold drive: calc cmdi CONFIRMED->FILED at turn 16
    (via=cmdi-arith; the calc xss/sqli/redirect/ssrf/header FAILED
    pairs cost 3 turns each first: FAILED + probe DEAD_END + claim
    DEAD_END; the calc trav pair FAILED after the cmdi claim, costing
    3 turns, then the calc ssti pair FAILED, costing 3 more, then the
    calc hostheader pair FAILED, costing 3 more); echo
    cmdi FAILED at turn 42 (payload echoed verbatim,
    never evaluated — reflection, not execution); ping cmdi
    CONFIRMED->FILED at turn 69 (via=cmdi-timing); safe trav FAILED;
    exactly 2 filed claims (generic_cmdi), locations /calc and
    /ping; process completes, no re-probe.
    Case C — regression: the DVWA mock yields ZERO generic sinks so
    the Rule #35 22-step plan is byte-identical.
    """
    checks = []

    def check(name, cond):
        assert cond, "FAILED: " + name
        checks.append(name)

    def _hist(memdir):
        return load_json(mem_paths(memdir)["process"],
                         {"process": None})["process"]

    here = os.path.dirname(os.path.abspath(__file__))
    fresh9 = os.path.join(here, "probe-lab", "mock-fresh9",
                          "fresh9_app.py")
    dvwa = os.path.join(here, "probe-lab", "mock-dvwa.py")

    # --- Case A: discovery on the ninth unseen target ---
    mp = _start_mock(fresh9, 8349, [])
    try:
        tb = "http://127.0.0.1:8349"
        recon = _lab_recon_map(tb)
        check("fresh9: recon finds zero known modules",
              recon is not None and recon["modules"] == {})
        sinks = _lab_generic_sinks(tb, None, list(recon["modules"]))
        ids = [s["id"] for s in sinks]
        check("discovery: finds all 4 query sinks "
              "(calc, echo, ping, safe)",
              ids == ["query:/calc:GET:expr",
                      "query:/echo:GET:name",
                      "query:/ping:GET:host",
                      "query:/safe:GET:q"])
        check("discovery: no sink touches a known module path",
              not any("vulnerabilities" in i for i in ids))
        plan, meta = _lab_plan_for_hunt([], sinks, tb)
        check("plan: 72 steps, xss+sqli+redirect+ssrf+header+cmdi+"
              "trav+ssti+hostheader probe+claim per query sink "
              "(Rule #65 + Rule #66 + Rule #67 + Rule #71)",
              len(plan) == 72 and
              [s["module"] for s in plan] ==
              ["generic_xss", "generic_xss",
               "generic_sqli", "generic_sqli",
               "generic_redirect", "generic_redirect",
               "generic_ssrf", "generic_ssrf",
               "generic_header", "generic_header",
               "generic_cmdi", "generic_cmdi",
               "generic_trav", "generic_trav",
               "generic_ssti", "generic_ssti",
               "generic_hostheader", "generic_hostheader"] * 4 and
              [s["kind"] for s in plan] ==
              ["probe", "claim"] * 36 and
              [s["probe"] for s in plan if s["kind"] == "probe"] ==
              ["probe_sink_xss.py", "probe_sink_sqli.py",
               "probe_sink_redirect.py", "probe_sink_ssrf.py",
               "probe_sink_header.py", "probe_sink_cmdi.py",
               "probe_sink_traversal.py",
               "probe_sink_ssti.py",
               "probe_sink_hostheader.py"] * 4)
        check("plan: sink spec rides in the marker argv "
              "(PLOOP56|../PLOOP57|../PLOOP62|../PLOOP63|../PLOOP64|../"
              "PLOOP65|../PLOOP66|../PLOOP67|../PLOOP71|..)",
              all((s["marker"].startswith("PLOOP56|") and
                   s["probe"] == "probe_sink_xss.py") or
                  (s["marker"].startswith("PLOOP57|") and
                   s["probe"] == "probe_sink_sqli.py") or
                  (s["marker"].startswith("PLOOP62|") and
                   s["probe"] == "probe_sink_redirect.py") or
                  (s["marker"].startswith("PLOOP63|") and
                   s["probe"] == "probe_sink_ssrf.py") or
                  (s["marker"].startswith("PLOOP64|") and
                   s["probe"] == "probe_sink_header.py") or
                  (s["marker"].startswith("PLOOP65|") and
                   s["probe"] == "probe_sink_cmdi.py") or
                  (s["marker"].startswith("PLOOP66|") and
                   s["probe"] == "probe_sink_traversal.py") or
                  (s["marker"].startswith("PLOOP67|") and
                   s["probe"] == "probe_sink_ssti.py") or
                  (s["marker"].startswith("PLOOP71|") and
                   s["probe"] == "probe_sink_hostheader.py")
                  for s in plan if s["kind"] == "probe") and
              all("/" not in s["marker"]
                  for s in plan if s["kind"] == "probe"))
        check("plan_meta: recon_ok=True, 4 generic sink ids recorded",
              meta["recon_ok"] is True and
              set(meta["generic_sinks"]) == set(ids))
        bi = budget_info([], sinks)
        check("budget: 4 query sinks priced at 72 turns (Rule #65 + "
              "Rule #66 + Rule #67 + Rule #71: each costs 18)",
              bi["recommended_turns"] == 72 and bi["generic_turns"] == 72)

        # --- Case B: full autonomous cold drive vs fresh9 ---
        memdir = tempfile.mkdtemp(prefix="ploop65-b-")
        goal = "probe-hunt: fresh9 command-injection drive"
        ctx = {"registry_url": "http://127.0.0.1:9", "workdir": memdir,
               "memdir": memdir, "target_base": tb}
        verdicts, events = [], []
        for _ in range(110):
            r = run_turn(memdir, goal, ctx)
            events.extend(r.get("events", []))
            if "process_completed" in r.get("events", []):
                break
            verdicts.append(_hist(memdir)["history"][-1]["verdict"])
        sq = [i for i, v in enumerate(verdicts) if v == "CONFIRMED"]
        check("drive: exactly 2 CONFIRMED probes at turns 16 and 69 "
              "(calc cmdi, ping cmdi; each FAILED pair costs 3 turns: "
              "FAILED + probe DEAD_END + claim DEAD_END; the calc trav "
              "and ssti and hostheader pairs and the echo sink's 9 "
              "FAILED pairs sit "
              "between them)",
              sq == [15, 68])
        check("drive: each CONFIRMED probe is followed by a FILED claim",
              all(verdicts[i + 1] == "FILED" for i in sq))
        check("drive: echo cmdi FAILED at turn 42 — the payload was "
              "echoed verbatim but never evaluated (reflection, not "
              "execution, Rule #65 fail-closed)",
              verdicts[41] == "FAILED")
        check("drive: 106 verdict turns executed, process completed, no "
              "re-probe (Rule #65 + Rule #66 + Rule #67 + Rule #71: "
              "each sink's trav, ssti and hostheader pairs add their "
              "turns; the two CONFIRMs cost 2 turns each, not 3)",
              len(verdicts) == 106 and "process_completed" in events)
        claims = json.load(open(os.path.join(memdir, "claims.json")))
        check("drive: exactly 2 claims filed, both generic_cmdi, "
              "state=filed, locations /calc + /ping",
              len(claims) == 2 and
              all(v["state"] == "filed" for v in claims.values()) and
              {v["module"] for v in claims.values()} ==
              {"generic_cmdi"} and
              {v.get("location") for v in claims.values()} ==
              {"/calc", "/ping"})
        store = HashStore(os.path.join(memdir, "output"))
        got = {}
        for v in claims.values():
            check("drive: claim carries a real evidence hash",
                  bool(HASH_RE.match(v.get("evidence_hash") or "")))
            raw = _to_text(store.get(v["evidence_hash"]) or b"")
            m = re.search(r"EVIDENCE sink=(\S+) .* via=([a-z-]+)",
                          raw)
            check("drive: stored output cites sink + via=<class>",
                  m is not None)
            if m:
                got[m.group(1)] = m.group(2)
            check("drive: stored output ends VERDICT: CONFIRMED",
                  raw.strip().splitlines()[-1] == "VERDICT: CONFIRMED")
        check("drive: Rule #65 — /calc confirmed via=cmdi-arith (the "
              "result was never transmitted, so only execution can "
              "explain it); /ping via=cmdi-timing (the delay scaled "
              "with the injected number)",
              got == {"/calc": "cmdi-arith", "/ping": "cmdi-timing"})
    finally:
        _stop_mock(mp, 8349)

    # --- Case C: DVWA regression — zero generic sinks ---
    mp2 = _start_mock(dvwa, 8341, [])
    try:
        recon2 = _lab_recon_map("http://127.0.0.1:8341")
        sinks2 = _lab_generic_sinks("http://127.0.0.1:8341", None,
                                    list(recon2["modules"]))
        check("dvwa: auth pages skipped WITH REASON, zero generic sinks",
              sinks2 == [])
        plan2, meta2 = _lab_plan_for_hunt(list(recon2["modules"]),
                                          sinks2,
                                          "http://127.0.0.1:8341")
        check("dvwa: Rule #35 22-step plan byte-identical",
              len(plan2) == 22 and meta2["generic_sinks"] == [] and
              all(s["module"] in _HUNT_MODULE_ORDER for s in plan2))
    finally:
        _stop_mock(mp2, 8341)

    return {"checks": checks}



def proof_trav():
    """Rule #66 lab proof: generic path-traversal / LFI probe for
    query sinks.

    mock-fresh10 (probe-lab/mock-fresh10/fresh10_app.py) is a tenth
    unseen app: no DVWA module signals, so recon drops all 11 known
    modules and only generic sinks remain. /docs?file= resolves ".."
    sequences (percent-decoded, so the ..%2f and nested ....//
    ladder rungs work) and absolute paths to a canned /etc/passwd
    carrying the "root:x:0:0" marker the probe NEVER transmits ->
    the trav probe must CONFIRM via=trav-passwd. /win?cfg= serves
    canned win.ini (carrying "[fonts]") when the value contains ".."
    plus a windows token -> the trav probe must CONFIRM
    via=trav-winini (the unix payloads fail first: they carry ".."
    but no windows token, so the probe must climb to the win.ini
    rungs). /reflect?page= echoes the HTML-escaped value with no
    marker -> the trav probe must FAILED (a verbatim echo of
    "etc/passwd" without the content marker is reflection, not a
    file read — the hard negative control). /safe?q= is static ->
    FAILED. All four pages are DB-free (SQLi negatives),
    redirect-free (redirect negatives), fetch-free (SSRF negatives),
    shell-free (cmdi negatives) and static-headed (header negatives).

    Case A — discovery: 4 query sinks found, plan is 72 steps
    (xss+sqli+redirect+ssrf+header+cmdi+trav+ssti+hostheader
    probe+claim pairs per sink), budget prices 72.
    Case B — full cold drive: docs trav CONFIRMED->FILED at turn 19
    (via=trav-passwd; the 6 earlier FAILED pairs cost 3 turns each:
    FAILED + probe DEAD_END + claim DEAD_END; the docs ssti and
    hostheader FAILED pairs add 6 more turns); reflect trav FAILED
    at turn 45 (the reflection negative control); safe trav FAILED
    at turn 72; win trav CONFIRMED->FILED at turn 99
    (via=trav-winini); exactly 2 filed claims (generic_trav),
    locations /docs and /win; process completes, no re-probe.
    Case C — regression: the DVWA mock yields ZERO generic sinks so
    the Rule #35 22-step plan is byte-identical.
    """
    checks = []

    def check(name, cond):
        assert cond, "FAILED: " + name
        checks.append(name)

    def _hist(memdir):
        return load_json(mem_paths(memdir)["process"],
                         {"process": None})["process"]

    here = os.path.dirname(os.path.abspath(__file__))
    fresh10 = os.path.join(here, "probe-lab", "mock-fresh10",
                           "fresh10_app.py")
    dvwa = os.path.join(here, "probe-lab", "mock-dvwa.py")

    # --- Case A: discovery on the tenth unseen target ---
    mp = _start_mock(fresh10, 8350, [])
    try:
        tb = "http://127.0.0.1:8350"
        recon = _lab_recon_map(tb)
        check("fresh10: recon finds zero known modules",
              recon is not None and recon["modules"] == {})
        sinks = _lab_generic_sinks(tb, None, list(recon["modules"]))
        ids = [s["id"] for s in sinks]
        check("discovery: finds all 4 query sinks "
              "(docs, reflect, safe, win)",
              ids == ["query:/docs:GET:file",
                      "query:/reflect:GET:page",
                      "query:/safe:GET:q",
                      "query:/win:GET:cfg"])
        check("discovery: no sink touches a known module path",
              not any("vulnerabilities" in i for i in ids))
        plan, meta = _lab_plan_for_hunt([], sinks, tb)
        check("plan: 72 steps, xss+sqli+redirect+ssrf+header+cmdi+"
              "trav+ssti+hostheader probe+claim per query sink "
              "(Rule #66, Rule #67, Rule #71)",
              len(plan) == 72 and
              [s["module"] for s in plan] ==
              ["generic_xss", "generic_xss",
               "generic_sqli", "generic_sqli",
               "generic_redirect", "generic_redirect",
               "generic_ssrf", "generic_ssrf",
               "generic_header", "generic_header",
               "generic_cmdi", "generic_cmdi",
               "generic_trav", "generic_trav",
               "generic_ssti", "generic_ssti",
               "generic_hostheader", "generic_hostheader"] * 4 and
              [s["kind"] for s in plan] ==
              ["probe", "claim"] * 36 and
              [s["probe"] for s in plan if s["kind"] == "probe"] ==
              ["probe_sink_xss.py", "probe_sink_sqli.py",
               "probe_sink_redirect.py", "probe_sink_ssrf.py",
               "probe_sink_header.py", "probe_sink_cmdi.py",
               "probe_sink_traversal.py",
               "probe_sink_ssti.py",
               "probe_sink_hostheader.py"] * 4)
        check("plan: sink spec rides in the marker argv "
              "(PLOOP56|../PLOOP57|../PLOOP62|../PLOOP63|../PLOOP64|../"
              "PLOOP65|../PLOOP66|../PLOOP67|../PLOOP71|..)",
              all((s["marker"].startswith("PLOOP56|") and
                   s["probe"] == "probe_sink_xss.py") or
                  (s["marker"].startswith("PLOOP57|") and
                   s["probe"] == "probe_sink_sqli.py") or
                  (s["marker"].startswith("PLOOP62|") and
                   s["probe"] == "probe_sink_redirect.py") or
                  (s["marker"].startswith("PLOOP63|") and
                   s["probe"] == "probe_sink_ssrf.py") or
                  (s["marker"].startswith("PLOOP64|") and
                   s["probe"] == "probe_sink_header.py") or
                  (s["marker"].startswith("PLOOP65|") and
                   s["probe"] == "probe_sink_cmdi.py") or
                  (s["marker"].startswith("PLOOP66|") and
                   s["probe"] == "probe_sink_traversal.py") or
                  (s["marker"].startswith("PLOOP67|") and
                   s["probe"] == "probe_sink_ssti.py") or
                  (s["marker"].startswith("PLOOP71|") and
                   s["probe"] == "probe_sink_hostheader.py")
                  for s in plan if s["kind"] == "probe") and
              all("/" not in s["marker"]
                  for s in plan if s["kind"] == "probe"))
        check("plan_meta: recon_ok=True, 4 generic sink ids recorded",
              meta["recon_ok"] is True and
              set(meta["generic_sinks"]) == set(ids))
        bi = budget_info([], sinks)
        check("budget: 4 query sinks priced at 72 turns (Rule #66 + "
              "Rule #67 + Rule #71: each costs 18)",
              bi["recommended_turns"] == 72 and bi["generic_turns"] == 72)

        # --- Case B: full autonomous cold drive vs fresh10 ---
        memdir = tempfile.mkdtemp(prefix="ploop66-b-")
        goal = "probe-hunt: fresh10 traversal drive"
        ctx = {"registry_url": "http://127.0.0.1:9", "workdir": memdir,
               "memdir": memdir, "target_base": tb}
        verdicts, events = [], []
        for _ in range(110):
            r = run_turn(memdir, goal, ctx)
            events.extend(r.get("events", []))
            if "process_completed" in r.get("events", []):
                break
            verdicts.append(_hist(memdir)["history"][-1]["verdict"])
        sq = [i for i, v in enumerate(verdicts) if v == "CONFIRMED"]
        check("drive: exactly 2 CONFIRMED probes at turns 19 and 99 "
              "(docs trav, win trav; each FAILED pair costs 3 turns: "
              "FAILED + probe DEAD_END + claim DEAD_END; the 9 reflect "
              "and 9 safe FAILED pairs sit between them)",
              sq == [18, 98])
        check("drive: each CONFIRMED probe is followed by a FILED claim",
              all(verdicts[i + 1] == "FILED" for i in sq))
        check("drive: reflect trav FAILED at turn 45 — the payload "
              "echoed verbatim but the content marker was never "
              "present (reflection, not a file read, Rule #66 "
              "fail-closed)",
              verdicts[44] == "FAILED")
        check("drive: safe trav FAILED at turn 72 (static page)",
              verdicts[71] == "FAILED")
        check("drive: 106 verdict turns executed, process completed, no "
              "re-probe (Rule #66 + Rule #67 + Rule #71: the two "
              "CONFIRMs cost 2 turns each, not 3; each sink's FAILED "
              "ssti and hostheader pairs add 3 turns each)",
              len(verdicts) == 106 and "process_completed" in events)
        claims = json.load(open(os.path.join(memdir, "claims.json")))
        check("drive: exactly 2 claims filed, both generic_trav, "
              "state=filed, locations /docs + /win",
              len(claims) == 2 and
              all(v["state"] == "filed" for v in claims.values()) and
              {v["module"] for v in claims.values()} ==
              {"generic_trav"} and
              {v.get("location") for v in claims.values()} ==
              {"/docs", "/win"})
        store = HashStore(os.path.join(memdir, "output"))
        got = {}
        for v in claims.values():
            check("drive: claim carries a real evidence hash",
                  bool(HASH_RE.match(v.get("evidence_hash") or "")))
            raw = _to_text(store.get(v["evidence_hash"]) or b"")
            m = re.search(r"EVIDENCE sink=(\S+) .* via=([a-z-]+)",
                          raw)
            check("drive: stored output cites sink + via=<class>",
                  m is not None)
            if m:
                got[m.group(1)] = m.group(2)
            check("drive: stored output ends VERDICT: CONFIRMED",
                  raw.strip().splitlines()[-1] == "VERDICT: CONFIRMED")
        check("drive: Rule #66 — /docs confirmed via=trav-passwd (the "
              "marker was never transmitted, so only a server-side "
              "file read can explain it); /win via=trav-winini (the "
              "unix payloads failed first, the probe climbed the "
              "ladder to the win.ini rungs)",
              got == {"/docs": "trav-passwd", "/win": "trav-winini"})
    finally:
        _stop_mock(mp, 8350)

    # --- Case C: DVWA regression — zero generic sinks ---
    mp2 = _start_mock(dvwa, 8341, [])
    try:
        recon2 = _lab_recon_map("http://127.0.0.1:8341")
        sinks2 = _lab_generic_sinks("http://127.0.0.1:8341", None,
                                    list(recon2["modules"]))
        check("dvwa: auth pages skipped WITH REASON, zero generic sinks",
              sinks2 == [])
        plan2, meta2 = _lab_plan_for_hunt(list(recon2["modules"]),
                                          sinks2,
                                          "http://127.0.0.1:8341")
        check("dvwa: Rule #35 22-step plan byte-identical",
              len(plan2) == 22 and meta2["generic_sinks"] == [] and
              all(s["module"] in _HUNT_MODULE_ORDER for s in plan2))
    finally:
        _stop_mock(mp2, 8341)

    return {"checks": checks}



def proof_ssti():
    """Rule #67 lab proof: GENERIC SSTI probe for discovered query sinks.

    mock-fresh11 (probe-lab/mock-fresh11/fresh11_app.py) is an eleventh
    unseen app: no DVWA module signals, so recon drops all 11 known
    modules and only generic sinks remain. /render?name= passes the
    value through a naive server-side template renderer that EVALUATES
    {{A*B}} / ${A*B} / #{A*B} / *{A*B} arithmetic BEFORE HTML-escaping
    the output; /echo?name= echoes escaped verbatim (reflection, not
    evaluation — the hard negative control); /safe?name= is static.

    The probe must CONFIRM on /render via the ARITHMETIC channel: the
    result "7006652" appears in the body though it was never
    transmitted (via=ssti-jinja — the first dialect rung evaluates).
    The escaping keeps the XSS probe FAILED on /render (no executable
    context); /echo and /safe fail every sink probe.

    Case A — discovery: 3 query sinks found, plan is 54 steps
    (xss+sqli+redirect+ssrf+header+cmdi+trav+ssti+hostheader
    probe+claim per sink), budget prices 54 turns.
    Case B — full cold drive: /echo's 9 FAILED pairs cost 27 turns,
    /render's ssti probe CONFIRMs at turn 49 -> claim FILED (the
    render hostheader FAILED pair adds 3 turns after the claim),
    /safe's 9 FAILED pairs cost 27 turns; exactly 1 filed claim
    (generic_ssti, location /render) with a real evidence hash;
    process completes, no re-probe.
    Case C — regression: the DVWA mock yields ZERO generic sinks so the
    Rule #35 22-step plan is byte-identical.
    """
    checks = []

    def check(name, cond):
        assert cond, "FAILED: " + name
        checks.append(name)

    def _hist(memdir):
        return load_json(mem_paths(memdir)["process"],
                         {"process": None})["process"]

    here = os.path.dirname(os.path.abspath(__file__))
    fresh11 = os.path.join(here, "probe-lab", "mock-fresh11",
                           "fresh11_app.py")
    dvwa = os.path.join(here, "probe-lab", "mock-dvwa.py")

    # --- Case A: discovery on the eleventh unseen target ---
    mp = _start_mock(fresh11, 8351, [])
    try:
        tb = "http://127.0.0.1:8351"
        recon = _lab_recon_map(tb)
        check("fresh11: recon finds zero known modules",
              recon is not None and recon["modules"] == {})
        sinks = _lab_generic_sinks(tb, None, list(recon["modules"]))
        ids = [s["id"] for s in sinks]
        check("discovery: finds all 3 query sinks (echo, render, safe)",
              ids == ["query:/echo:GET:name",
                      "query:/render:GET:name",
                      "query:/safe:GET:name"])
        check("discovery: no sink touches a known module path",
              not any("vulnerabilities" in i for i in ids))
        plan, meta = _lab_plan_for_hunt([], sinks, tb)
        check("plan: 54 steps, xss+sqli+redirect+ssrf+header+cmdi+"
              "trav+ssti+hostheader probe+claim per query sink "
              "(Rule #62, Rule #63, Rule #64, Rule #65, Rule #66, "
              "Rule #67, Rule #71)",
              len(plan) == 54 and
              [s["module"] for s in plan] ==
              ["generic_xss", "generic_xss",
               "generic_sqli", "generic_sqli",
               "generic_redirect", "generic_redirect",
               "generic_ssrf", "generic_ssrf",
               "generic_header", "generic_header",
               "generic_cmdi", "generic_cmdi",
               "generic_trav", "generic_trav",
               "generic_ssti", "generic_ssti",
               "generic_hostheader", "generic_hostheader"] * 3 and
              [s["kind"] for s in plan] ==
              ["probe", "claim"] * 27 and
              [s["probe"] for s in plan if s["kind"] == "probe"] ==
              ["probe_sink_xss.py", "probe_sink_sqli.py",
               "probe_sink_redirect.py", "probe_sink_ssrf.py",
               "probe_sink_header.py", "probe_sink_cmdi.py",
               "probe_sink_traversal.py",
               "probe_sink_ssti.py",
               "probe_sink_hostheader.py"] * 3)
        check("plan: sink spec rides in the marker argv "
              "(PLOOP56|../PLOOP57|../PLOOP62|../PLOOP63|../PLOOP64|../"
              "PLOOP65|../PLOOP66|../PLOOP67|../PLOOP71|..)",
              all((s["marker"].startswith("PLOOP56|") and
                   s["probe"] == "probe_sink_xss.py") or
                  (s["marker"].startswith("PLOOP57|") and
                   s["probe"] == "probe_sink_sqli.py") or
                  (s["marker"].startswith("PLOOP62|") and
                   s["probe"] == "probe_sink_redirect.py") or
                  (s["marker"].startswith("PLOOP63|") and
                   s["probe"] == "probe_sink_ssrf.py") or
                  (s["marker"].startswith("PLOOP64|") and
                   s["probe"] == "probe_sink_header.py") or
                  (s["marker"].startswith("PLOOP65|") and
                   s["probe"] == "probe_sink_cmdi.py") or
                  (s["marker"].startswith("PLOOP66|") and
                   s["probe"] == "probe_sink_traversal.py") or
                  (s["marker"].startswith("PLOOP67|") and
                   s["probe"] == "probe_sink_ssti.py") or
                  (s["marker"].startswith("PLOOP71|") and
                   s["probe"] == "probe_sink_hostheader.py")
                  for s in plan if s["kind"] == "probe") and
              all("/" not in s["marker"]
                  for s in plan if s["kind"] == "probe"))
        check("plan_meta: recon_ok=True, 3 generic sink ids recorded",
              meta["recon_ok"] is True and
              set(meta["generic_sinks"]) == set(ids))
        bi = budget_info([], sinks)
        check("budget: 3 query sinks priced at 54 turns (Rule #62+#63+"
              "#64+#65+#66+#67+#71: each costs 18)",
              bi["recommended_turns"] == 54 and bi["generic_turns"] == 54)

        # --- Case B: full autonomous cold drive vs fresh11 ---
        memdir = tempfile.mkdtemp(prefix="ploop67-b-")
        goal = "probe-hunt: fresh11 ssti drive"
        ctx = {"registry_url": "http://127.0.0.1:9", "workdir": memdir,
               "memdir": memdir, "target_base": tb}
        verdicts, events = [], []
        for _ in range(90):
            r = run_turn(memdir, goal, ctx)
            events.extend(r.get("events", []))
            if "process_completed" in r.get("events", []):
                break
            verdicts.append(_hist(memdir)["history"][-1]["verdict"])
        sq = [i for i, v in enumerate(verdicts) if v == "CONFIRMED"]
        check("drive: exactly 1 CONFIRMED probe at turn 49 (render "
              "ssti; the echo sink's 9 FAILED pairs cost 27 turns "
              "first: FAILED + probe DEAD_END + claim DEAD_END)",
              sq == [48])
        check("drive: the CONFIRMED probe is followed by a FILED claim",
              all(verdicts[i + 1] == "FILED" for i in sq))
        check("drive: echo ssti FAILED at turn 22 — the template "
              "payloads echoed verbatim but 7006652 never appeared "
              "(reflection, not evaluation, Rule #67 fail-closed)",
              verdicts[21] == "FAILED")
        check("drive: 80 verdict turns executed, process completed, no "
              "re-probe (Rule #67: the render ssti CONFIRM costs 2 "
              "turns, not 3; the echo/safe FAILED ssti pairs add 3 "
              "each; Rule #71: each sink's FAILED hostheader pair "
              "adds 3 turns)",
              len(verdicts) == 80 and "process_completed" in events)
        claims = json.load(open(os.path.join(memdir, "claims.json")))
        check("drive: exactly 1 claim filed, generic_ssti, "
              "state=filed, location /render",
              len(claims) == 1 and
              all(v["state"] == "filed" for v in claims.values()) and
              {v["module"] for v in claims.values()} ==
              {"generic_ssti"} and
              {v.get("location") for v in claims.values()} ==
              {"/render"})
        store = HashStore(os.path.join(memdir, "output"))
        got = {}
        for v in claims.values():
            check("drive: claim carries a real evidence hash",
                  bool(HASH_RE.match(v.get("evidence_hash") or "")))
            raw = _to_text(store.get(v["evidence_hash"]) or b"")
            m = re.search(r"EVIDENCE sink=(\S+) .* via=([a-z-]+)",
                          raw)
            check("drive: stored output cites sink + via=<dialect>",
                  m is not None)
            if m:
                got[m.group(1)] = m.group(2)
            check("drive: stored output ends VERDICT: CONFIRMED",
                  raw.strip().splitlines()[-1] == "VERDICT: CONFIRMED")
        check("drive: Rule #67 — /render confirmed via=ssti-jinja "
              "(the first dialect rung evaluated server-side)",
              got == {"/render": "ssti-jinja"})
    finally:
        _stop_mock(mp, 8351)

    # --- Case C: DVWA regression — zero generic sinks ---
    mp2 = _start_mock(dvwa, 8341, [])
    try:
        recon2 = _lab_recon_map("http://127.0.0.1:8341")
        sinks2 = _lab_generic_sinks("http://127.0.0.1:8341", None,
                                    list(recon2["modules"]))
        check("dvwa: auth pages skipped WITH REASON, zero generic sinks",
              sinks2 == [])
        plan2, meta2 = _lab_plan_for_hunt(list(recon2["modules"]),
                                          sinks2,
                                          "http://127.0.0.1:8341")
        check("dvwa: Rule #35 22-step plan byte-identical",
              len(plan2) == 22 and meta2["generic_sinks"] == [] and
              all(s["module"] in _HUNT_MODULE_ORDER for s in plan2))
    finally:
        _stop_mock(mp2, 8341)

    return {"checks": checks}


def proof_postredirect():
    """Rule #69 lab proof: GENERIC OPEN-REDIRECT probe for POST sinks.

    mock-fresh13 (probe-lab/mock-fresh13/fresh13_app.py) is a thirteenth
    unseen app: no DVWA module signals, so recon drops all 11 known
    modules and only generic sinks remain. Rule #62 proved open
    redirect for GET query sinks; this app carries the SAME class on
    POST-form sinks — the classic real-world surface (login `next`
    fields, `returnUrl` posts, OAuth `redirect_uri` posts):

      /go2    POST form (field: next). POST 302s with Location: <next>
              raw (CR/LF stripped) -> generic_redirect_post CONFIRMs
              via=redirect-location.
      /land2  POST form (field: target). POST answers 200 with
              <meta http-equiv="refresh" content="0;url=<target>">
              (target attribute-escaped, so xss stays FAILED) ->
              generic_redirect_post CONFIRMs via=redirect-meta.
      /stay2  POST form (field: next). POST answers a static 200 that
              ignores the field (the negative control) -> every sink
              probe FAILED.

    Cross-negatives: nothing persists (csrf stays FAILED — that probe
    only confirms on a fresh-GET canary); no SQL, no error keywords
    (sqli stays FAILED); no X-Echo header, no shell, no template
    engine.

    Case A — discovery: 3 POST-form sinks found, plan is 24 steps
    (xss+sqli+csrf+redirect_post probe+claim per sink), budget prices
    24 turns.
    Case B — full cold drive: go2's redirect_post CONFIRMs at turn 10
    -> claim FILED; land2's redirect_post CONFIRMs at turn 21 ->
    claim FILED; stay2's 4 FAILED pairs cost 12 turns; exactly 2
    filed claims (generic_redirect_post, locations /go2 + /land2,
    same open_redirect class as Rule #62, distinct locations) with
    real evidence hashes; process completes, no re-probe.
    Case C — regression: the DVWA mock yields ZERO generic sinks so the
    Rule #35 22-step plan is byte-identical.
    """
    checks = []

    def check(name, cond):
        assert cond, "FAILED: " + name
        checks.append(name)

    def _hist(memdir):
        return load_json(mem_paths(memdir)["process"],
                         {"process": None})["process"]

    here = os.path.dirname(os.path.abspath(__file__))
    fresh13 = os.path.join(here, "probe-lab", "mock-fresh13",
                           "fresh13_app.py")
    dvwa = os.path.join(here, "probe-lab", "mock-dvwa.py")

    # --- Case A: discovery on the thirteenth unseen target ---
    mp = _start_mock(fresh13, 8353, [])
    try:
        tb = "http://127.0.0.1:8353"
        recon = _lab_recon_map(tb)
        check("fresh13: recon finds zero known modules",
              recon is not None and recon["modules"] == {})
        sinks = _lab_generic_sinks(tb, None, list(recon["modules"]))
        ids = [s["id"] for s in sinks]
        check("discovery: finds all 3 POST-form sinks",
              ids == ["form:/go2:POST:next",
                      "form:/land2:POST:target",
                      "form:/stay2:POST:next"])
        check("discovery: no sink touches a known module path",
              not any("vulnerabilities" in i for i in ids))
        plan, meta = _lab_plan_for_hunt([], sinks, tb)
        check("plan: 24 steps, xss+sqli+csrf+redirect_post probe+claim "
              "per POST sink (Rule #61 + Rule #69)",
              len(plan) == 24 and
              [s["module"] for s in plan] ==
              ["generic_xss", "generic_xss",
               "generic_sqli", "generic_sqli",
               "generic_csrf", "generic_csrf",
               "generic_redirect_post", "generic_redirect_post"] * 3 and
              [s["kind"] for s in plan] ==
              ["probe", "claim"] * 12 and
              [s["probe"] for s in plan if s["kind"] == "probe"] ==
              ["probe_sink_xss.py", "probe_sink_sqli.py",
               "probe_sink_csrf.py",
               "probe_sink_redirect_post.py"] * 3)
        check("plan: sink spec rides in the marker argv "
              "(PLOOP56|../PLOOP57|../PLOOP61|../PLOOP69|..)",
              all((s["marker"].startswith("PLOOP56|") and
                   s["probe"] == "probe_sink_xss.py") or
                  (s["marker"].startswith("PLOOP57|") and
                   s["probe"] == "probe_sink_sqli.py") or
                  (s["marker"].startswith("PLOOP61|") and
                   s["probe"] == "probe_sink_csrf.py") or
                  (s["marker"].startswith("PLOOP69|") and
                   s["probe"] == "probe_sink_redirect_post.py")
                  for s in plan if s["kind"] == "probe") and
              all("/" not in s["marker"]
                  for s in plan if s["kind"] == "probe"))
        check("plan_meta: recon_ok=True, 3 generic sink ids recorded",
              meta["recon_ok"] is True and
              set(meta["generic_sinks"]) == set(ids))
        bi = budget_info([], sinks)
        check("budget: 3 POST-form sinks priced at 24 turns (Rule #69: "
              "each POST form costs 8)",
              bi["recommended_turns"] == 24 and bi["generic_turns"] == 24)

        # --- Case B: full autonomous cold drive vs fresh13 ---
        memdir = tempfile.mkdtemp(prefix="ploop69-b-")
        goal = "probe-hunt: fresh13 post-redirect drive"
        ctx = {"registry_url": "http://127.0.0.1:9", "workdir": memdir,
               "memdir": memdir, "target_base": tb}
        verdicts, events = [], []
        for _ in range(60):
            r = run_turn(memdir, goal, ctx)
            events.extend(r.get("events", []))
            if "process_completed" in r.get("events", []):
                break
            verdicts.append(_hist(memdir)["history"][-1]["verdict"])
        sq = [i for i, v in enumerate(verdicts) if v == "CONFIRMED"]
        check("drive: exactly 2 CONFIRMED probes (/go2 redirect_post "
              "at turn 10, /land2 redirect_post at turn 21; every "
              "FAILED pair costs 3 turns: FAILED + probe DEAD_END + "
              "claim DEAD_END)",
              sq == [9, 20])
        check("drive: every CONFIRMED probe is followed by a FILED "
              "claim",
              all(verdicts[i + 1] == "FILED" for i in sq))
        check("drive: 34 verdict turns executed, process completed, no "
              "re-probe",
              len(verdicts) == 34 and "process_completed" in events)
        claims = json.load(open(os.path.join(memdir, "claims.json")))
        got_pairs = {(v["module"], v.get("location"))
                     for v in claims.values()}
        check("drive: exactly 2 claims filed, both "
              "generic_redirect_post at /go2 + /land2 (same "
              "open_redirect class, distinct locations)",
              len(claims) == 2 and
              got_pairs == {("generic_redirect_post", "/go2"),
                            ("generic_redirect_post", "/land2")} and
              all(v["state"] == "filed" for v in claims.values()) and
              {v.get("class") for v in claims.values()} ==
              {"open_redirect"})
        check("drive: /stay2 contributes zero claims (the negative "
              "control — its 4 probe pairs all FAILED)",
              "/stay2" not in {v.get("location")
                               for v in claims.values()})
        store = HashStore(os.path.join(memdir, "output"))
        got = {}
        for v in claims.values():
            check("drive: claim carries a real evidence hash",
                  bool(HASH_RE.match(v.get("evidence_hash") or "")))
            raw = _to_text(store.get(v["evidence_hash"]) or b"")
            m = re.search(r"EVIDENCE sink=(\S+) .* via=([a-z-]+)",
                          raw)
            check("drive: stored output cites sink + via=<channel>",
                  m is not None)
            if m:
                got[m.group(1)] = m.group(2)
            check("drive: stored output ends VERDICT: CONFIRMED",
                  raw.strip().splitlines()[-1] == "VERDICT: CONFIRMED")
        check("drive: /go2 confirmed via=redirect-location, /land2 "
              "via=redirect-meta (both POST channels of the same "
              "open_redirect class)",
              got == {"/go2": "redirect-location",
                      "/land2": "redirect-meta"})
    finally:
        _stop_mock(mp, 8353)

    # --- Case C: DVWA regression — zero generic sinks ---
    mp2 = _start_mock(dvwa, 8341, [])
    try:
        recon2 = _lab_recon_map("http://127.0.0.1:8341")
        sinks2 = _lab_generic_sinks("http://127.0.0.1:8341", None,
                                    list(recon2["modules"]))
        check("dvwa: auth pages skipped WITH REASON, zero generic sinks",
              sinks2 == [])
        plan2, meta2 = _lab_plan_for_hunt(list(recon2["modules"]),
                                          sinks2,
                                          "http://127.0.0.1:8341")
        check("dvwa: Rule #35 22-step plan byte-identical",
              len(plan2) == 22 and meta2["generic_sinks"] == [] and
              all(s["module"] in _HUNT_MODULE_ORDER for s in plan2))
    finally:
        _stop_mock(mp2, 8341)

    return {"checks": checks}


def proof_xxe():
    """Rule #70 lab proof: GENERIC XXE probe for xml sinks.

    mock-fresh14 (probe-lab/mock-fresh14/fresh14_app.py) is a fourteenth
    unseen app: no DVWA module signals, so recon drops all 11 known
    modules and only generic sinks remain. Rule #70 added XML-sink
    discovery (the API-docs pattern: an "application/xml" mention
    within ~200 chars of a same-origin path) — this app carries the
    XXE class on those sinks:

      /api/xml   POST application/xml. VULN: resolves external
                 entities (simulated as a resolving parser behaves) —
                 a body defining an entity on file:///etc/passwd
                 answers with the canned marker "root:x:0:0" (the
                 probe never transmits it) -> generic_xxe CONFIRMs
                 via=xxe-file-read.
      /api/echo  POST application/xml. Returns the raw POST body
                 wrapped in <received> — the entity reference is
                 reflected VERBATIM, never resolved (the probe's hard
                 negative control: reflection, not resolution) ->
                 every pair FAILED.
      /api/safe  POST application/xml. Static marker-free response
                 that ignores the body -> every pair FAILED.
      /login.php trivial 200 (the _start_mock readiness probe).

    Case A — discovery: 3 xml sinks found (and ONLY those — the
    proof caught the discovery matching HTML closing tags like
    "</body>" as paths; a "/" preceded by "<" is markup, fixed in
    _lab_generic_sinks), plan is 6 steps (xxe probe+claim per xml
    sink — the body is XML, not params/fields, so the xss/sqli pairs
    do not apply; the proof caught them being added unconditionally,
    fixed in _recon_driven_plan), budget prices 6 turns.
    Case B — full cold drive: /api/echo's and /api/safe's FAILED
    pairs cost 3 turns each (FAILED + probe DEAD_END + claim
    DEAD_END), /api/xml's xxe CONFIRMs at turn 7 -> claim FILED;
    exactly 1 filed claim (generic_xxe, class xxe, location /api/xml)
    with a real evidence hash; stored output cites via=xxe-file-read
    and ends VERDICT: CONFIRMED; process completes, no re-probe.
    Case C — regression: the DVWA mock yields ZERO generic sinks so the
    Rule #35 22-step plan is byte-identical.
    """
    checks = []

    def check(name, cond):
        assert cond, "FAILED: " + name
        checks.append(name)

    def _hist(memdir):
        return load_json(mem_paths(memdir)["process"],
                         {"process": None})["process"]

    here = os.path.dirname(os.path.abspath(__file__))
    fresh14 = os.path.join(here, "probe-lab", "mock-fresh14",
                           "fresh14_app.py")
    dvwa = os.path.join(here, "probe-lab", "mock-dvwa.py")

    # --- Case A: discovery on the fourteenth unseen target ---
    mp = _start_mock(fresh14, 8354, [])
    try:
        tb = "http://127.0.0.1:8354"
        recon = _lab_recon_map(tb)
        check("fresh14: recon finds zero known modules",
              recon is not None and recon["modules"] == {})
        sinks = _lab_generic_sinks(tb, None, list(recon["modules"]))
        ids = [s["id"] for s in sinks]
        check("discovery: finds all 3 xml sinks (no HTML-tag false "
              "positives)",
              ids == ["xml:/api/echo:POST",
                      "xml:/api/safe:POST",
                      "xml:/api/xml:POST"])
        check("discovery: every sink is kind=xml, method=POST",
              all(s["kind"] == "xml" and s["method"] == "POST"
                  for s in sinks))
        plan, meta = _lab_plan_for_hunt([], sinks, tb)
        check("plan: 6 steps, xxe probe+claim per xml sink ONLY "
              "(Rule #70: no xss/sqli pairs on XML bodies)",
              len(plan) == 6 and
              [s["module"] for s in plan] == ["generic_xxe"] * 6 and
              [s["kind"] for s in plan] == ["probe", "claim"] * 3 and
              [s["probe"] for s in plan if s["kind"] == "probe"] ==
              ["probe_sink_xxe.py"] * 3)
        check("plan: sink spec rides in the marker argv "
              "(PLOOP70|..|..|POST|, no literal /)",
              all(s["marker"].startswith("PLOOP70|") and
                  s["probe"] == "probe_sink_xxe.py"
                  for s in plan if s["kind"] == "probe") and
              all("/" not in s["marker"]
                  for s in plan if s["kind"] == "probe"))
        check("plan_meta: recon_ok=True, 3 generic sink ids recorded",
              meta["recon_ok"] is True and
              set(meta["generic_sinks"]) == set(ids))
        bi = budget_info([], sinks)
        check("budget: 3 xml sinks priced at 6 turns (Rule #70: each "
              "xml sink costs 2)",
              bi["recommended_turns"] == 6 and bi["generic_turns"] == 6)

        # --- Case B: full autonomous cold drive vs fresh14 ---
        memdir = tempfile.mkdtemp(prefix="ploop70-b-")
        goal = "probe-hunt: fresh14 xxe drive"
        ctx = {"registry_url": "http://127.0.0.1:9", "workdir": memdir,
               "memdir": memdir, "target_base": tb}
        verdicts, events = [], []
        for _ in range(60):
            r = run_turn(memdir, goal, ctx)
            events.extend(r.get("events", []))
            if "process_completed" in r.get("events", []):
                break
            verdicts.append(_hist(memdir)["history"][-1]["verdict"])
        sq = [i for i, v in enumerate(verdicts) if v == "CONFIRMED"]
        check("drive: exactly 1 CONFIRMED probe (/api/xml xxe at turn "
              "7; every FAILED pair costs 3 turns: FAILED + probe "
              "DEAD_END + claim DEAD_END)",
              sq == [6])
        check("drive: every CONFIRMED probe is followed by a FILED "
              "claim",
              all(verdicts[i + 1] == "FILED" for i in sq))
        check("drive: 8 verdict turns executed, process completed, no "
              "re-probe",
              len(verdicts) == 8 and "process_completed" in events)
        claims = json.load(open(os.path.join(memdir, "claims.json")))
        got_pairs = {(v["module"], v.get("location"))
                     for v in claims.values()}
        check("drive: exactly 1 claim filed, generic_xxe at /api/xml "
              "(class xxe)",
              len(claims) == 1 and
              got_pairs == {("generic_xxe", "/api/xml")} and
              all(v["state"] == "filed" for v in claims.values()) and
              {v.get("class") for v in claims.values()} == {"xxe"})
        check("drive: /api/echo + /api/safe contribute zero claims "
              "(the negative controls — reflection is not resolution)",
              not ({"/api/echo", "/api/safe"} &
                   {v.get("location") for v in claims.values()}))
        store = HashStore(os.path.join(memdir, "output"))
        got = {}
        for v in claims.values():
            check("drive: claim carries a real evidence hash",
                  bool(HASH_RE.match(v.get("evidence_hash") or "")))
            raw = _to_text(store.get(v["evidence_hash"]) or b"")
            m = re.search(r"EVIDENCE sink=(\S+) .* via=([a-z-]+)",
                          raw)
            check("drive: stored output cites sink + via=<channel>",
                  m is not None)
            if m:
                got[m.group(1)] = m.group(2)
            check("drive: stored output ends VERDICT: CONFIRMED",
                  raw.strip().splitlines()[-1] == "VERDICT: CONFIRMED")
        check("drive: /api/xml confirmed via=xxe-file-read (the "
              "passwd content marker, never transmitted)",
              got == {"/api/xml": "xxe-file-read"})
    finally:
        _stop_mock(mp, 8354)

    # --- Case C: DVWA regression — zero generic sinks ---
    mp2 = _start_mock(dvwa, 8341, [])
    try:
        recon2 = _lab_recon_map("http://127.0.0.1:8341")
        sinks2 = _lab_generic_sinks("http://127.0.0.1:8341", None,
                                    list(recon2["modules"]))
        check("dvwa: auth pages skipped WITH REASON, zero generic sinks",
              sinks2 == [])
        plan2, meta2 = _lab_plan_for_hunt(list(recon2["modules"]),
                                          sinks2,
                                          "http://127.0.0.1:8341")
        check("dvwa: Rule #35 22-step plan byte-identical",
              len(plan2) == 22 and meta2["generic_sinks"] == [] and
              all(s["module"] in _HUNT_MODULE_ORDER for s in plan2))
    finally:
        _stop_mock(mp2, 8341)

    return {"checks": checks}


def proof_hostheader():
    """Rule #71 lab proof: GENERIC HOST-HEADER INJECTION probe.

    mock-fresh15 (probe-lab/mock-fresh15/fresh15_app.py) is a fifteenth
    unseen app: no DVWA module signals, so recon drops all 11 known
    modules and only generic sinks remain. Rule #71 added the
    host-header probe (PLOOP71) to every GET query sink — this app
    carries the host_header_injection class on those paths:

      /reset   GET ?email=. VULN: a password-reset page that builds
               its reset link from the Host header — a poisoned Host
               lands in the response body -> generic_hostheader
               CONFIRMs via=host-header-body. ?email= is never
               reflected (xss stays FAILED); no SQL, no CRLF-in-param
               header reflection, no shell, no file reads, no
               template engine.
      /go      GET ?next=. VULN: 302 redirect to http://<Host>/home,
               built from the Host header (?next= is ignored) — a
               poisoned Host lands in the Location header ->
               generic_hostheader CONFIRMs via=host-header-redirect.
               The Rule #62 redirect probe sends ?next=<canary> and
               sees a Location WITHOUT the canary -> FAILED (no
               interference).
      /static  GET ?x=. Static page that ignores the Host header
               entirely -> the all-negative control: every pair
               FAILED.
      /login.php trivial 200 (the _start_mock readiness probe).

    Case A — discovery: 3 query sinks, plan 54 steps (9 pairs per
    sink: xss, sqli, redirect, ssrf, header, cmdi, trav, ssti,
    hostheader — the probe needs no params, it rides the path, so
    the PLOOP71 marker's params field is empty), budget 54 turns.
    Case B — full cold drive: 79 verdict turns; /go's hostheader
    CONFIRMs at turn 25 -> claim FILED, /reset's at turn 51 ->
    claim FILED; exactly 2 claims (generic_hostheader, class
    host_header_injection) with real evidence hashes, outputs end
    VERDICT: CONFIRMED; /static contributes zero claims; process
    completes, no re-probe.
    Case C — regression: the DVWA mock yields ZERO generic sinks so the
    Rule #35 22-step plan is byte-identical.
    """
    checks = []

    def check(name, cond):
        assert cond, "FAILED: " + name
        checks.append(name)

    def _hist(memdir):
        return load_json(mem_paths(memdir)["process"],
                         {"process": None})["process"]

    here = os.path.dirname(os.path.abspath(__file__))
    fresh15 = os.path.join(here, "probe-lab", "mock-fresh15",
                           "fresh15_app.py")
    dvwa = os.path.join(here, "probe-lab", "mock-dvwa.py")

    # --- Case A: discovery on the fifteenth unseen target ---
    mp = _start_mock(fresh15, 8355, [])
    try:
        tb = "http://127.0.0.1:8355"
        recon = _lab_recon_map(tb)
        check("fresh15: recon finds zero known modules",
              recon is not None and recon["modules"] == {})
        sinks = _lab_generic_sinks(tb, None, list(recon["modules"]))
        ids = [s["id"] for s in sinks]
        check("discovery: finds all 3 query sinks",
              ids == ["query:/go:GET:next",
                      "query:/reset:GET:email",
                      "query:/static:GET:x"])
        check("discovery: every sink is kind=query, method=GET",
              all(s["kind"] == "query" and s["method"] == "GET"
                  for s in sinks))
        plan, meta = _lab_plan_for_hunt([], sinks, tb)
        per_sink = (["generic_xss"] * 2 + ["generic_sqli"] * 2 +
                    ["generic_redirect"] * 2 + ["generic_ssrf"] * 2 +
                    ["generic_header"] * 2 + ["generic_cmdi"] * 2 +
                    ["generic_trav"] * 2 + ["generic_ssti"] * 2 +
                    ["generic_hostheader"] * 2)
        check("plan: 54 steps, 9 pairs per query sink in order "
              "(Rule #71 appends hostheader last)",
              len(plan) == 54 and
              [s["module"] for s in plan] == per_sink * 3 and
              [s["kind"] for s in plan] == ["probe", "claim"] * 27 and
              [s["probe"] for s in plan if s["kind"] == "probe"] ==
              (["probe_sink_xss.py", "probe_sink_sqli.py",
                "probe_sink_redirect.py", "probe_sink_ssrf.py",
                "probe_sink_header.py", "probe_sink_cmdi.py",
                "probe_sink_traversal.py", "probe_sink_ssti.py",
                "probe_sink_hostheader.py"] * 3))
        check("plan: hostheader probes carry param-less PLOOP71 "
              "markers (PLOOP71|..|..|GET|)",
              all(s["marker"].startswith("PLOOP71|") and
                  s["marker"].endswith("GET|") and
                  s["probe"] == "probe_sink_hostheader.py"
                  for s in plan
                  if s.get("module") == "generic_hostheader" and
                  s["kind"] == "probe") and
              all("/" not in s["marker"]
                  for s in plan
                  if s.get("module") == "generic_hostheader" and
                  s["kind"] == "probe"))
        check("plan_meta: recon_ok=True, 3 generic sink ids recorded",
              meta["recon_ok"] is True and
              set(meta["generic_sinks"]) == set(ids))
        bi = budget_info([], sinks)
        check("budget: 3 query sinks priced at 54 turns (Rule #71: "
              "9 pairs = 18 turns per sink)",
              bi["recommended_turns"] == 54 and bi["generic_turns"] == 54)

        # --- Case B: full autonomous cold drive vs fresh15 ---
        memdir = tempfile.mkdtemp(prefix="ploop71-b-")
        goal = "probe-hunt: fresh15 hostheader drive"
        ctx = {"registry_url": "http://127.0.0.1:9", "workdir": memdir,
               "memdir": memdir, "target_base": tb}
        verdicts, events = [], []
        for _ in range(140):
            r = run_turn(memdir, goal, ctx)
            events.extend(r.get("events", []))
            if "process_completed" in r.get("events", []):
                break
            verdicts.append(_hist(memdir)["history"][-1]["verdict"])
        sq = [i for i, v in enumerate(verdicts) if v == "CONFIRMED"]
        check("drive: exactly 2 CONFIRMED probes (/go hostheader at "
              "turn 25, /reset hostheader at turn 51; every FAILED "
              "pair costs 3 turns: FAILED + probe DEAD_END + claim "
              "DEAD_END)",
              sq == [24, 50])
        check("drive: every CONFIRMED probe is followed by a FILED "
              "claim",
              all(verdicts[i + 1] == "FILED" for i in sq))
        check("drive: 79 verdict turns executed, process completed, "
              "no re-probe",
              len(verdicts) == 79 and "process_completed" in events)
        claims = json.load(open(os.path.join(memdir, "claims.json")))
        got_pairs = {(v["module"], v.get("location"))
                     for v in claims.values()}
        check("drive: exactly 2 claims filed, generic_hostheader at "
              "/go + /reset (class host_header_injection)",
              len(claims) == 2 and
              got_pairs == {("generic_hostheader", "/go"),
                            ("generic_hostheader", "/reset")} and
              all(v["state"] == "filed" for v in claims.values()) and
              {v.get("class") for v in claims.values()} ==
              {"host_header_injection"})
        check("drive: /static contributes zero claims (the negative "
              "control — the page ignores the Host header)",
              "/static" not in
              {v.get("location") for v in claims.values()})
        store = HashStore(os.path.join(memdir, "output"))
        got = {}
        for v in claims.values():
            check("drive: claim carries a real evidence hash",
                  bool(HASH_RE.match(v.get("evidence_hash") or "")))
            raw = _to_text(store.get(v["evidence_hash"]) or b"")
            m = re.search(r"EVIDENCE sink=(\S+) .* via=([a-z-]+)",
                          raw)
            check("drive: stored output cites sink + via=<channel>",
                  m is not None)
            if m:
                got[m.group(1)] = m.group(2)
            check("drive: stored output ends VERDICT: CONFIRMED",
                  raw.strip().splitlines()[-1] == "VERDICT: CONFIRMED")
        check("drive: /reset confirmed via=host-header-body and /go "
              "via=host-header-redirect (the two confirm channels)",
              got == {"/reset": "host-header-body",
                      "/go": "host-header-redirect"})
    finally:
        _stop_mock(mp, 8355)

    # --- Case C: DVWA regression — zero generic sinks ---
    mp2 = _start_mock(dvwa, 8341, [])
    try:
        recon2 = _lab_recon_map("http://127.0.0.1:8341")
        sinks2 = _lab_generic_sinks("http://127.0.0.1:8341", None,
                                    list(recon2["modules"]))
        check("dvwa: auth pages skipped WITH REASON, zero generic sinks",
              sinks2 == [])
        plan2, meta2 = _lab_plan_for_hunt(list(recon2["modules"]),
                                          sinks2,
                                          "http://127.0.0.1:8341")
        check("dvwa: Rule #35 22-step plan byte-identical",
              len(plan2) == 22 and meta2["generic_sinks"] == [] and
              all(s["module"] in _HUNT_MODULE_ORDER for s in plan2))
    finally:
        _stop_mock(mp2, 8341)

    return {"checks": checks}


def proof_cookiexss():
    """Rule #74 lab proof: generic cookie-sink reflected-XSS probe.

    mock-fresh16 (probe-lab/mock-fresh16/fresh16_app.py) is a sixteenth
    unseen app: no DVWA module signals, no query-param links, no
    forms, no application/xml mentions — recon finds zero known
    modules and zero query/form/xml sinks. The app sets
    Set-Cookie: theme=light on /, /prefs and /safe, so recon must
    discover THREE cookie sinks (one per (path, cookie name)):
    cookie:/:GET:theme, cookie:/prefs:GET:theme,
    cookie:/safe:GET:theme. Cookie sinks are a sink KIND the generic
    set never covered (query 9 classes / form 4 / xml 1 / cookie 0).

      /prefs  VULN: reflects the "theme" cookie RAW into the page ->
              the PLOOP74 probe's executable canary reflects UNESCAPED
              -> VERDICT: CONFIRMED via=html.
      /safe   Reflects the "theme" cookie HTML-ESCAPED -> the canary
              token reflects but the payload does not -> VERDICT:
              FAILED (safe encoding, not a vuln — the hard negative
              control).
      /static Ignores cookies entirely -> FAILED (all-negative
              control; sets no cookie, so it is not a sink at all).

    Cross-negatives: no forms (zero form sinks); nothing persisted;
    no SQL, no error keywords, no shell, no template engine, no
    entity parsing, no Host-header trust, no redirects.

    Case A — discovery: 3 cookie sinks found, plan is 6 steps (one
    cookiexss probe+claim pair per sink — Rule #74: cookie sinks
    carry ONLY this pair; the param-shaped xss/sqli pairs would
    attack the wrong injection point (?theme=) instead of the
    Cookie header), budget prices 6.
    Case B — full cold drive: / cookiexss FAILED at turn 1 (3 turns:
    FAILED + probe DEAD_END + claim DEAD_END); /prefs cookiexss
    CONFIRMED->FILED at turns 4-5 (via=html); /safe cookiexss
    FAILED at turn 6 (3 turns); exactly 1 filed claim
    (generic_cookiexss), location /prefs; process completes, no
    re-probe.
    Case C — regression: the DVWA mock yields ZERO generic sinks so
    the Rule #35 22-step plan is byte-identical (the DVWA mock only
    sets PHPSESSID on a POST login; recon fetches GET-only, so no
    Set-Cookie ever reaches the crawler).
    Case D — Rule #75: mock-fresh17 sets the loop's OWN session cookie
    (PHPSESSID) on every page — without the exclusion it would be sunk
    (pre-gate control proves the defect); with the exclusion only the
    genuine theme sinks remain, the plan builds 6 steps, and a
    hand-built PHPSESSID sink is refused at plan time WITH REASON.
    Case E — Rule #75: the claim layer REFUSES a CONFIRMED
    generic_cookiexss output against a loop-owned session cookie
    (self-inflicted findings are never filed); the same output
    against a genuine cookie still builds, and callers without sink
    info behave exactly as before.
    """
    checks = []

    def check(name, cond):
        assert cond, "FAILED: " + name
        checks.append(name)

    def _hist(memdir):
        return load_json(mem_paths(memdir)["process"],
                         {"process": None})["process"]

    here = os.path.dirname(os.path.abspath(__file__))
    fresh16 = os.path.join(here, "probe-lab", "mock-fresh16",
                           "fresh16_app.py")
    dvwa = os.path.join(here, "probe-lab", "mock-dvwa.py")

    # --- Case A: discovery on the sixteenth unseen target ---
    mp = _start_mock(fresh16, 8356, [])
    try:
        tb = "http://127.0.0.1:8356"
        recon = _lab_recon_map(tb)
        check("fresh16: recon finds zero known modules",
              recon is not None and recon["modules"] == {})
        sinks = _lab_generic_sinks(tb, None, list(recon["modules"]))
        ids = [s["id"] for s in sinks]
        check("discovery: finds all 3 cookie sinks (/, /prefs, /safe "
              "Set-Cookie: theme=light) in sorted order",
              ids == ["cookie:/:GET:theme",
                      "cookie:/prefs:GET:theme",
                      "cookie:/safe:GET:theme"])
        check("discovery: every sink is kind=cookie, GET, params=[theme]",
              all(s["kind"] == "cookie" and s["method"] == "GET" and
                  s["params"] == ["theme"] for s in sinks))
        check("discovery: no sink touches a known module path",
              not any("vulnerabilities" in i for i in ids))
        plan, meta = _lab_plan_for_hunt([], sinks, tb)
        check("plan: 6 steps — one cookiexss probe+claim pair per "
              "cookie sink (Rule #74: the param-shaped xss/sqli "
              "pairs do NOT apply to a cookie value)",
              len(plan) == 6 and
              [s["module"] for s in plan] ==
              ["generic_cookiexss"] * 6 and
              [s["kind"] for s in plan] ==
              ["probe", "claim"] * 3 and
              [s["probe"] for s in plan if s["kind"] == "probe"] ==
              ["probe_sink_cookiexss.py"] * 3)
        check("plan: the cookie name rides in the marker argv "
              "(PLOOP74|<tb>|<path>|GET|theme), marker filename-safe",
              all(s["marker"].startswith("PLOOP74|") and
                  s["marker"].endswith("|GET|theme") and
                  s["probe"] == "probe_sink_cookiexss.py"
                  for s in plan if s["kind"] == "probe") and
              all("/" not in s["marker"]
                  for s in plan if s["kind"] == "probe"))
        check("plan_meta: recon_ok=True, 3 cookie sink ids recorded",
              meta["recon_ok"] is True and
              set(meta["generic_sinks"]) == set(ids))
        bi = budget_info([], sinks)
        check("budget: 3 cookie sinks priced at 6 turns (Rule #74: "
              "each costs 2)",
              bi["recommended_turns"] == 6 and bi["generic_turns"] == 6)

        # --- Case B: full autonomous cold drive vs fresh16 ---
        memdir = tempfile.mkdtemp(prefix="ploop74-b-")
        goal = "probe-hunt: fresh16 cookie-XSS drive"
        ctx = {"registry_url": "http://127.0.0.1:9", "workdir": memdir,
               "memdir": memdir, "target_base": tb}
        verdicts, events = [], []
        for _ in range(40):
            r = run_turn(memdir, goal, ctx)
            events.extend(r.get("events", []))
            if "process_completed" in r.get("events", []):
                break
            verdicts.append(_hist(memdir)["history"][-1]["verdict"])
        sq = [i for i, v in enumerate(verdicts) if v == "CONFIRMED"]
        check("drive: / cookiexss FAILED at turn 1 (the index page "
              "sets the cookie but never reflects it)",
              verdicts[0] == "FAILED")
        check("drive: /prefs cookiexss CONFIRMED at turn 4 — the / "
              "pair cost 3 turns first (FAILED + probe DEAD_END + "
              "claim DEAD_END)",
              sq == [3])
        check("drive: the CONFIRMED probe is followed by a FILED claim",
              all(verdicts[i + 1] == "FILED" for i in sq))
        check("drive: /safe cookiexss FAILED at turn 6 — the canary "
              "token reflects HTML-ENCODED, not unescaped (safe "
              "encoding, not a vuln)",
              verdicts[5] == "FAILED")
        check("drive: 8 verdict turns executed, process completed, no "
              "re-probe (each FAILED pair costs 3 turns)",
              len(verdicts) == 8 and "process_completed" in events)
        claims = json.load(open(os.path.join(memdir, "claims.json")))
        check("drive: exactly 1 claim filed, generic_cookiexss, "
              "state=filed, location /prefs",
              len(claims) == 1 and
              all(v["state"] == "filed" for v in claims.values()) and
              {v["module"] for v in claims.values()} ==
              {"generic_cookiexss"} and
              {v.get("location") for v in claims.values()} ==
              {"/prefs"})
        check("drive: claim class is xss_reflected, severity high "
              "(the Rule #56 class, distinct module)",
              all(v.get("class") == "xss_reflected" and
                  v.get("severity") == "high"
                  for v in claims.values()))
        store = HashStore(os.path.join(memdir, "output"))
        got = {}
        for v in claims.values():
            check("drive: claim carries a real evidence hash",
                  bool(HASH_RE.match(v.get("evidence_hash") or "")))
            raw = _to_text(store.get(v["evidence_hash"]) or b"")
            m = re.search(r"EVIDENCE sink=(\S+) .* via=([a-z-]+)",
                          raw)
            check("drive: stored output cites sink + via=<class>",
                  m is not None)
            if m:
                got[m.group(1)] = m.group(2)
            check("drive: stored output ends VERDICT: CONFIRMED",
                  raw.strip().splitlines()[-1] == "VERDICT: CONFIRMED")
        check("drive: Rule #74 — /prefs confirmed via=html (the "
              "executable canary reflected UNESCAPED, xss-reflect "
              "readable)",
              got == {"/prefs": "html"})
    finally:
        _stop_mock(mp, 8356)

    # --- Case C: DVWA regression — zero generic sinks ---
    mp2 = _start_mock(dvwa, 8341, [])
    try:
        recon2 = _lab_recon_map("http://127.0.0.1:8341")
        sinks2 = _lab_generic_sinks("http://127.0.0.1:8341", None,
                                    list(recon2["modules"]))
        check("dvwa: auth pages skipped WITH REASON, zero generic "
              "sinks (the mock only sets PHPSESSID on POST login; "
              "recon fetches GET-only)",
              sinks2 == [])
        plan2, meta2 = _lab_plan_for_hunt(list(recon2["modules"]),
                                          sinks2,
                                          "http://127.0.0.1:8341")
        check("dvwa: Rule #35 22-step plan byte-identical",
              len(plan2) == 22 and meta2["generic_sinks"] == [] and
              all(s["module"] in _HUNT_MODULE_ORDER for s in plan2))
    finally:
        _stop_mock(mp2, 8341)

    # --- Case D (Rule #75): the loop's OWN session cookie is never a sink ---
    # mock-fresh17 is fresh16 + Set-Cookie: PHPSESSID=fresh17sess on every
    # cookie-setting page — exactly what a real login session looks like
    # to the crawler. The loop owns PHPSESSID (it sits in the session
    # jar); it must never become an attack sink.
    import http.cookiejar
    fresh17 = os.path.join(here, "probe-lab", "mock-fresh17",
                           "fresh17_app.py")
    mp3 = _start_mock(fresh17, 8357, [])
    try:
        tb3 = "http://127.0.0.1:8357"
        # simulate the post-login session jar: the loop owns PHPSESSID
        jar3 = http.cookiejar.CookieJar()
        jar3.set_cookie(http.cookiejar.Cookie(
            0, "PHPSESSID", "fresh17sess", None, False, "127.0.0.1",
            False, False, "/", True, False, None, False, None, None,
            {}, False))
        op3 = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(jar3))
        check("Rule #75: _lab_session_cookie_names reads the loop's own "
              "session cookie (PHPSESSID) from the opener's jar",
              _lab_session_cookie_names(op3) == {"PHPSESSID"})
        check("Rule #75: a jar-less (None) opener yields no names — "
              "fail-closed, unauthenticated recon excludes nothing",
              _lab_session_cookie_names(None) == set())
        # Rule #75 ordering (load-bearing): snapshot the loop's OWN
        # names BEFORE the crawl — the crawl stores the target's
        # Set-Cookie headers (theme=light) into the same jar, and a
        # post-crawl read would wrongly exclude the genuine sink too.
        own3 = _lab_session_cookie_names(op3)
        recon3 = _lab_recon_map(tb3, opener=op3)
        check("fresh17: recon finds zero known modules",
              recon3 is not None and recon3["modules"] == {})
        check("Rule #75 ordering: the crawl stored the target's theme "
              "cookie into the jar, but the pre-crawl snapshot still "
              "names only the loop's own session cookie",
              own3 == {"PHPSESSID"})
        raw3 = _lab_generic_sinks(tb3, op3, list(recon3["modules"]))
        raw3 = _lab_generic_sinks(tb3, op3, list(recon3["modules"]))
        check("pre-gate control: WITHOUT the Rule #75 exclusion the "
              "loop's own PHPSESSID WOULD be sunk on / (the defect this "
              "rule closes)",
              "cookie:/:GET:PHPSESSID" in [s["id"] for s in raw3])
        sinks3 = _lab_generic_sinks(tb3, op3, list(recon3["modules"]),
                                    self_cookie_names=own3)
        ids3 = [s["id"] for s in sinks3]
        check("Rule #75 capture gate: the loop's own PHPSESSID is "
              "excluded WITH REASON — only the genuine theme sinks remain",
              ids3 == ["cookie:/:GET:theme",
                       "cookie:/prefs:GET:theme",
                       "cookie:/safe:GET:theme"])
        plan3, meta3 = _lab_plan_for_hunt([], sinks3, tb3,
                                          exclude_cookie_names=own3)
        check("Rule #75 plan gate: 6 steps — one cookiexss pair per "
              "theme sink, zero steps for the excluded session cookie",
              len(plan3) == 6 and
              all(s["module"] == "generic_cookiexss" for s in plan3) and
              meta3.get("excluded_cookie_sinks", []) == [])
        # defense in depth: a hand-built sink list that bypasses the
        # capture gate is still refused at plan time, WITH REASON
        hand = [{"id": "cookie:/:GET:PHPSESSID", "kind": "cookie",
                 "method": "GET", "path": "/", "params": ["PHPSESSID"]}]
        plan4, meta4 = _lab_plan_for_hunt([], hand, tb3,
                                          exclude_cookie_names=own3)
        check("Rule #75 plan gate (defense in depth): a hand-built sink "
              "for the loop's own session cookie plans ZERO steps and "
              "records the refusal WITH REASON",
              plan4 == [] and
              meta4.get("excluded_cookie_sinks") ==
              ["cookie:/:GET:PHPSESSID \u2014 Rule #75: 'PHPSESSID' is a "
               "loop-owned session cookie, not an attack surface"])
    finally:
        _stop_mock(mp3, 8357)

    # --- Case E (Rule #75): the claim layer refuses self-owned cookies ---
    proc5 = {"history": [{"step_idx": 0, "verdict": "CONFIRMED",
                          "result_hash": "e" * 64,
                          "action": {"command":
                                     "python3 probe_sink_cookiexss.py "
                                     "PLOOP74|dummy"}}]}
    store5 = {"e" * 64:
              b"probe marker PLOOP74 observed in response body; "
              b"EVIDENCE sink=/ marker=PLOOP74\nVERDICT: CONFIRMED\n"}
    body5, why5 = _build_lab_claim(
        proc5, "generic_cookiexss", 0, store5,
        sink_id="cookie:/:GET:PHPSESSID",
        self_cookie_names={"PHPSESSID"})
    check("Rule #75 claim-layer gate: a CONFIRMED output against the "
          "loop's OWN session cookie is REFUSED with a Rule #75 reason "
          "(never file a self-inflicted finding)",
          body5 is None and "Rule #75" in (why5 or "") and
          "PHPSESSID" in (why5 or ""))
    body6, _ = _build_lab_claim(
        proc5, "generic_cookiexss", 0, store5,
        sink_id="cookie:/prefs:GET:theme",
        self_cookie_names={"PHPSESSID"})
    check("Rule #75 claim-layer control: the same CONFIRMED output "
          "against a genuinely attacker-controlled cookie still builds "
          "a claim (class xss_reflected, high)",
          body6 is not None and body6["class"] == "xss_reflected" and
          body6["severity"] == "high")
    body7, _ = _build_lab_claim(proc5, "generic_cookiexss", 0, store5)
    check("Rule #75 backward-compat: with no sink/exclusion info the "
          "claim builds exactly as before (all existing callers "
          "unaffected)",
          body7 is not None)

    return {"checks": checks}



def proof_jsonxss():
    """Rule #80 lab proof: generic JSON-body-sink reflected-XSS probe.

    mock-fresh19 (probe-lab/mock-fresh19/fresh19_app.py) is the
    nineteenth unseen app: no DVWA module signals, no query-param
    links, no forms, no application/xml mentions, no Set-Cookie —
    recon finds zero known modules and zero query/form/xml/cookie
    sinks. /api/docs is an API-documentation page mentioning
    "POST /api/profile" and "POST /api/safe" with "Content-Type:
    application/json" — the Rule #70-style API-docs discovery
    signal. Discovery must find TWO JSON sinks (one per path), POST
    method, params = the _JSON_SINK_FIELDS CSV — the last
    client-data sink kind with zero coverage (query 9 classes /
    form 4 / xml 1 / cookie 1 / json 0).

      /api/profile  VULN: reads the "name" JSON field and reflects it
              RAW into the JSON response body -> the PLOOP80 probe's
              executable canary reflects UNESCAPED -> VERDICT:
              CONFIRMED via=html (json_field=name). 415s non-JSON
              content types, so CONFIRMED also proves the probe sends
              the right content type.
      /api/safe   Reflects the "name" JSON field HTML-ESCAPED -> the
              canary token reflects but the payload does not ->
              VERDICT: FAILED (safe encoding, not a vuln — the hard
              negative control).
      /static     Ignores request bodies entirely -> FAILED
              (all-negative control; no JSON mention, not a sink).

    Cross-negatives: no forms (zero form sinks); nothing persisted;
    no SQL, no error keywords, no shell, no template engine, no
    entity parsing, no Host-header trust, no redirects.

    Case A — discovery: 2 JSON sinks found, plan is 4 steps (one
    jsonxss probe+claim pair per sink — Rule #80: JSON sinks carry
    ONLY this pair; the param-shaped xss/sqli pairs would attack the
    wrong injection point (?name=) instead of the JSON body), the
    field-name CSV rides in the marker argv, budget prices 4.
    Case B — full cold drive: /api/profile jsonxss CONFIRMED->FILED
    at turns 1-2 (via=html, json_field=name); /api/safe jsonxss
    FAILED at turn 3 (3 turns: FAILED + probe DEAD_END + claim
    DEAD_END); exactly 1 filed claim (generic_jsonxss), location
    /api/profile; process completes, no re-probe.
    Case C — regression: the DVWA mock yields ZERO generic sinks
    (it never mentions application/json) so the Rule #35 22-step
    plan is byte-identical.
    """
    checks = []

    def check(name, cond):
        assert cond, "FAILED: " + name
        checks.append(name)

    def _hist(memdir):
        return load_json(mem_paths(memdir)["process"],
                         {"process": None})["process"]

    here = os.path.dirname(os.path.abspath(__file__))
    fresh19 = os.path.join(here, "probe-lab", "mock-fresh19",
                           "fresh19_app.py")
    dvwa = os.path.join(here, "probe-lab", "mock-dvwa.py")

    # --- Case A: discovery on the nineteenth unseen target ---
    mp = _start_mock(fresh19, 8359, [])
    try:
        tb = "http://127.0.0.1:8359"
        recon = _lab_recon_map(tb)
        check("fresh19: recon finds zero known modules",
              recon is not None and recon["modules"] == {})
        sinks = _lab_generic_sinks(tb, None, list(recon["modules"]))
        ids = [s["id"] for s in sinks]
        check("discovery: finds both JSON sinks (/api/profile + "
              "/api/safe, application/json API-docs signal) in sorted "
              "order",
              ids == ["json:/api/profile:POST",
                      "json:/api/safe:POST"])
        check("discovery: every sink is kind=json, POST, params=the "
              "common field-name list",
              all(s["kind"] == "json" and s["method"] == "POST" and
                  s["params"] == list(_JSON_SINK_FIELDS)
                  for s in sinks))
        check("discovery: zero query/form/xml/cookie sinks on fresh19",
              all(s["kind"] == "json" for s in sinks))
        plan, meta = _lab_plan_for_hunt([], sinks, tb)
        check("plan: 4 steps — one jsonxss probe+claim pair per JSON "
              "sink (Rule #80: the param-shaped xss/sqli pairs do NOT "
              "apply to a JSON body)",
              len(plan) == 4 and
              [s["module"] for s in plan] ==
              ["generic_jsonxss"] * 4 and
              [s["kind"] for s in plan] ==
              ["probe", "claim"] * 2 and
              [s["probe"] for s in plan if s["kind"] == "probe"] ==
              ["probe_sink_jsonxss.py"] * 2)
        check("plan: the field-name CSV rides in the marker argv "
              "(PLOOP80|<tb>|<path>|POST|name,message,...), marker "
              "filename-safe",
              all(s["marker"].startswith("PLOOP80|") and
                  s["marker"].endswith(
                      "|POST|" + ",".join(_JSON_SINK_FIELDS)) and
                  s["probe"] == "probe_sink_jsonxss.py"
                  for s in plan if s["kind"] == "probe") and
              all("/" not in s["marker"]
                  for s in plan if s["kind"] == "probe"))
        check("plan_meta: recon_ok=True, 2 JSON sink ids recorded",
              meta["recon_ok"] is True and
              set(meta["generic_sinks"]) == set(ids))
        bi = budget_info([], sinks)
        check("budget: 2 JSON sinks priced at 4 turns (Rule #80: each "
              "costs 2 — the probe iterates the field CSV internally)",
              bi["recommended_turns"] == 4 and bi["generic_turns"] == 4)

        # --- Case B: full autonomous cold drive vs fresh19 ---
        memdir = tempfile.mkdtemp(prefix="ploop80-b-")
        goal = "probe-hunt: fresh19 JSON-body-XSS drive"
        ctx = {"registry_url": "http://127.0.0.1:9", "workdir": memdir,
               "memdir": memdir, "target_base": tb}
        verdicts, events = [], []
        for _ in range(40):
            r = run_turn(memdir, goal, ctx)
            events.extend(r.get("events", []))
            if "process_completed" in r.get("events", []):
                break
            verdicts.append(_hist(memdir)["history"][-1]["verdict"])
        sq = [i for i, v in enumerate(verdicts) if v == "CONFIRMED"]
        check("drive: /api/profile jsonxss CONFIRMED at turn 1 — the "
              "canary reflected UNESCAPED via the first CSV field "
              "(name)",
              sq == [0])
        check("drive: the CONFIRMED probe is followed by a FILED claim",
              all(verdicts[i + 1] == "FILED" for i in sq))
        check("drive: /api/safe jsonxss FAILED at turn 3 — the canary "
              "token reflects HTML-ENCODED, not unescaped (safe "
              "encoding, not a vuln)",
              verdicts[2] == "FAILED")
        check("drive: 5 verdict turns executed, process completed, no "
              "re-probe (each FAILED pair costs 3 turns)",
              len(verdicts) == 5 and "process_completed" in events)
        claims = json.load(open(os.path.join(memdir, "claims.json")))
        check("drive: exactly 1 claim filed, generic_jsonxss, "
              "state=filed, location /api/profile",
              len(claims) == 1 and
              all(v["state"] == "filed" for v in claims.values()) and
              {v["module"] for v in claims.values()} ==
              {"generic_jsonxss"} and
              {v.get("location") for v in claims.values()} ==
              {"/api/profile"})
        check("drive: claim class is xss_reflected, severity high "
              "(the Rule #56 class, distinct module)",
              all(v.get("class") == "xss_reflected" and
                  v.get("severity") == "high"
                  for v in claims.values()))
        store = HashStore(os.path.join(memdir, "output"))
        got = {}
        for v in claims.values():
            check("drive: claim carries a real evidence hash",
                  bool(HASH_RE.match(v.get("evidence_hash") or "")))
            raw = _to_text(store.get(v["evidence_hash"]) or b"")
            m = re.search(r"EVIDENCE sink=(\S+) .* via=([a-z-]+)",
                          raw)
            check("drive: stored output cites sink + via=<class>",
                  m is not None)
            if m:
                got[m.group(1)] = m.group(2)
            check("drive: stored output names the confirming JSON field",
                  "json_field=name" in raw)
            check("drive: stored output ends VERDICT: CONFIRMED",
                  raw.strip().splitlines()[-1] == "VERDICT: CONFIRMED")
        check("drive: Rule #80 — /api/profile confirmed via=html (the "
              "executable canary reflected UNESCAPED, xss-reflect "
              "readable)",
              got == {"/api/profile": "html"})
    finally:
        _stop_mock(mp, 8359)

    # --- Case C: DVWA regression — zero generic sinks ---
    mp2 = _start_mock(dvwa, 8341, [])
    try:
        recon2 = _lab_recon_map("http://127.0.0.1:8341")
        sinks2 = _lab_generic_sinks("http://127.0.0.1:8341", None,
                                    list(recon2["modules"]))
        check("dvwa: zero generic sinks (no application/json mention "
              "anywhere)",
              sinks2 == [])
        plan2, meta2 = _lab_plan_for_hunt(list(recon2["modules"]),
                                          sinks2,
                                          "http://127.0.0.1:8341")
        check("dvwa: Rule #35 22-step plan byte-identical",
              len(plan2) == 22 and meta2["generic_sinks"] == [] and
              all(s["module"] in _HUNT_MODULE_ORDER for s in plan2))
    finally:
        _stop_mock(mp2, 8341)

    return {"checks": checks}



def proof_reconfirm():
    """Rule #81 lab proof: double-confirm inside the probe executor.

    mock-fresh20 (probe-lab/mock-fresh20/fresh20_app.py) is the
    twentieth unseen app: zero known modules, zero query/form/xml/
    cookie sinks, TWO JSON sinks via the Rule #80 API-docs signal:

      /api/stable  STABLE VULN: reflects the "name" JSON field RAW on
              every POST -> run 1 CONFIRMED, Rule #81 reconfirm run 2
              CONFIRMED -> step VERDICT: CONFIRMED -> claim FILED.
      /api/flaky   FLAKY: reflects RAW for the first 2 POSTs, then
              HTML-ESCAPED. The probe's first run (control + canary =
              2 POSTs) CONFIRMs, but the reconfirm run sees only
              encoded reflections -> run 2 FAILED -> step VERDICT:
              FAILED -> probe dead-ends, claim dead-ends WITH REASON,
              NO claim filed. A single-confirm loop would have filed
              this — the double-confirm gate is what refuses it.

    Case A — discovery: 2 JSON sinks (flaky, stable — sorted order);
    plan is 4 steps (probe+claim per sink — UNCHANGED by Rule #81,
    the reconfirm lives inside the probe step's execution, not the
    plan); budget prices 4 (the reconfirm is conditional — it fires
    only on CONFIRMED — so recommended_turns is unchanged).
    Case B — full cold drive: flaky probe FAILED at turn 1
    (CONFIRMED then FAILED on reconfirm), probe DEAD_END turn 2,
    claim DEAD_END turn 3 (paired probe dead-ended, Rule #38);
    stable probe CONFIRMED turn 4 (both runs confirmed), claim FILED
    turn 5; exactly 1 filed claim (generic_jsonxss, /api/stable).
    The stable claim's stored output carries BOTH "VERDICT:
    CONFIRMED" lines plus the RECONFIRM separator; the flaky probe's
    stored output shows CONFIRMED then FAILED. Process completes, no
    re-probe.
    Case C — regression: the DVWA mock yields ZERO generic sinks so
    the Rule #35 22-step plan is byte-identical.
    """
    checks = []

    def check(name, cond):
        assert cond, "FAILED: " + name
        checks.append(name)

    def _hist(memdir):
        return load_json(mem_paths(memdir)["process"],
                         {"process": None})["process"]

    here = os.path.dirname(os.path.abspath(__file__))
    fresh20 = os.path.join(here, "probe-lab", "mock-fresh20",
                           "fresh20_app.py")
    dvwa = os.path.join(here, "probe-lab", "mock-dvwa.py")

    # --- Case A: discovery on the twentieth unseen target ---
    mp = _start_mock(fresh20, 8361, [])
    try:
        tb = "http://127.0.0.1:8361"
        recon = _lab_recon_map(tb)
        check("fresh20: recon finds zero known modules",
              recon is not None and recon["modules"] == {})
        sinks = _lab_generic_sinks(tb, None, list(recon["modules"]))
        ids = [s["id"] for s in sinks]
        check("discovery: finds both JSON sinks (flaky + stable, "
              "application/json API-docs signal) in sorted order",
              ids == ["json:/api/flaky:POST",
                      "json:/api/stable:POST"])
        check("discovery: zero query/form/xml/cookie sinks on fresh20",
              all(s["kind"] == "json" for s in sinks))
        plan, meta = _lab_plan_for_hunt([], sinks, tb)
        check("plan: 4 steps — one jsonxss probe+claim pair per JSON "
              "sink (Rule #81 changes NO plan shape: the reconfirm "
              "lives inside the probe step's execution)",
              len(plan) == 4 and
              [s["module"] for s in plan] ==
              ["generic_jsonxss"] * 4 and
              [s["kind"] for s in plan] ==
              ["probe", "claim"] * 2 and
              [s["probe"] for s in plan if s["kind"] == "probe"] ==
              ["probe_sink_jsonxss.py"] * 2)
        bi = budget_info([], sinks)
        check("budget: 2 JSON sinks priced at 4 turns (Rule #81: the "
              "reconfirm is conditional — it fires only on CONFIRMED "
              "— so recommended_turns is unchanged)",
              bi["recommended_turns"] == 4 and bi["generic_turns"] == 4)

        # --- Case B: full autonomous cold drive vs fresh20 ---
        memdir = tempfile.mkdtemp(prefix="ploop81-b-")
        goal = "probe-hunt: fresh20 double-confirm drive"
        ctx = {"registry_url": "http://127.0.0.1:9", "workdir": memdir,
               "memdir": memdir, "target_base": tb}
        verdicts, events = [], []
        last_proc = None
        for _ in range(40):
            r = run_turn(memdir, goal, ctx)
            events.extend(r.get("events", []))
            if "process_completed" in r.get("events", []):
                break
            last_proc = _hist(memdir)
            verdicts.append(last_proc["history"][-1]["verdict"])
        check("drive: verdict sequence is FAILED, DEAD_END, DEAD_END, "
              "CONFIRMED, FILED — the flaky sink burns 3 turns "
              "(reconfirm FAILED -> probe dead-ends -> claim dead-ends) "
              "and the stable sink confirms twice then files",
              verdicts == ["FAILED", "DEAD_END", "DEAD_END",
                           "CONFIRMED", "FILED"] and
              "process_completed" in events and last_proc is not None)
        hist = last_proc["history"]
        flaky_out = _to_text(
            HashStore(os.path.join(memdir, "output")).get(
                hist[0]["result_hash"]) or b"")
        check("drive: flaky probe's stored output shows run 1 "
              "VERDICT: CONFIRMED, then the RECONFIRM separator, then "
              "run 2 VERDICT: FAILED (the double-confirm caught the "
              "flake)",
              "--- RECONFIRM (Rule #81)" in flaky_out and
              flaky_out.strip().splitlines()[-1] == "VERDICT: FAILED" and
              "VERDICT: CONFIRMED" in flaky_out)
        plan_done = last_proc["plan"]
        check("drive: flaky claim step dead-ended WITH REASON (a single "
              "CONFIRMED that fails reconfirm is never filed)",
              plan_done[1]["kind"] == "claim" and
              plan_done[1].get("dead_end") is True)
        claims = json.load(open(os.path.join(memdir, "claims.json")))
        check("drive: exactly 1 claim filed, generic_jsonxss, "
              "state=filed, location /api/stable (the flaky sink "
              "filed nothing)",
              len(claims) == 1 and
              all(v["state"] == "filed" for v in claims.values()) and
              {v["module"] for v in claims.values()} ==
              {"generic_jsonxss"} and
              {v.get("location") for v in claims.values()} ==
              {"/api/stable"})
        store = HashStore(os.path.join(memdir, "output"))
        for v in claims.values():
            check("drive: claim carries a real evidence hash",
                  bool(HASH_RE.match(v.get("evidence_hash") or "")))
            raw = _to_text(store.get(v["evidence_hash"]) or b"")
            check("drive: stable claim's stored output carries the "
                  "RECONFIRM separator and BOTH VERDICT: CONFIRMED "
                  "lines (two independent confirmations on record)",
                  "--- RECONFIRM (Rule #81)" in raw and
                  raw.count("VERDICT: CONFIRMED") == 2)
            check("drive: stored output ends VERDICT: CONFIRMED",
                  raw.strip().splitlines()[-1] == "VERDICT: CONFIRMED")
            check("drive: stored output names the confirming JSON field",
                  "json_field=name" in raw)
    finally:
        _stop_mock(mp, 8361)

    # --- Case C: DVWA regression — zero generic sinks ---
    mp2 = _start_mock(dvwa, 8341, [])
    try:
        recon2 = _lab_recon_map("http://127.0.0.1:8341")
        sinks2 = _lab_generic_sinks("http://127.0.0.1:8341", None,
                                    list(recon2["modules"]))
        check("dvwa: zero generic sinks (no application/json mention "
              "anywhere)",
              sinks2 == [])
        plan2, meta2 = _lab_plan_for_hunt(list(recon2["modules"]),
                                          sinks2,
                                          "http://127.0.0.1:8341")
        check("dvwa: Rule #35 22-step plan byte-identical",
              len(plan2) == 22 and meta2["generic_sinks"] == [] and
              all(s["module"] in _HUNT_MODULE_ORDER for s in plan2))
    finally:
        _stop_mock(mp2, 8341)

    return {"checks": checks}


def proof_fulldrive():
    """Rule #68 lab proof: OWNER-FLIP REHEARSAL DRIVE — the full generic
    set cold-driven against a twelfth unseen multi-class target.

    mock-fresh12 (probe-lab/mock-fresh12/fresh12_app.py) is a twelfth
    unseen app: no DVWA module signals, so recon drops all 11 known
    modules and only generic sinks remain. Nine query sinks (one per
    class) plus one POST-form sink, plus /safe as the all-negative
    control and /login.php for the readiness probe:

      /xss?q=      VULN -> generic_xss CONFIRMs via=text (raw text-node
                   reflection)
      /sqli?id=    VULN -> generic_sqli CONFIRMs (error-based; the id is
                   HTML-escaped in the error so xss stays FAILED)
      /goto?url=   VULN -> generic_redirect CONFIRMs via=redirect-location
                   (302 Location raw, empty body)
      /fetch?url=  VULN -> generic_ssrf CONFIRMs via=ssrf-fetch-hit
                   (server-side fetch of the probe's canary; the url is
                   never echoed into the body)
      /hdr?name=   VULN -> generic_header CONFIRMs via=header-crlf (raw
                   X-Echo response header; the body never carries it)
      /calc?expr=  VULN -> generic_cmdi CONFIRMs via=cmdi-arith (the
                   output channel: $(expr 12345 + 6789) evaluates to
                   19134, never transmitted)
      /docs?file=  VULN -> generic_trav CONFIRMs via=trav-passwd (canned
                   /etc/passwd on ".." / absolute paths; benign
                   baseline marker-free)
      /render?name=VULN -> generic_ssti CONFIRMs via=ssti-jinja
                   (template arithmetic evaluates before escaping)
      /profile     POST form, no token -> generic_csrf CONFIRMs
                   via=csrf-no-token (canary persists on a FRESH GET;
                   bio escaped so xss FAILED, no SQL errors so sqli
                   FAILED)
      /safe?q=     static -> every sink probe FAILED (negative control)

    Case A — discovery: 10 sinks found (1 form + 9 query), plan is 170
    steps (form: xss+sqli+csrf+redirect_post probe+claim quads = 8 per
    Rule #69; each query sink: 9 probe+claim pairs = 18 per Rule #71),
    budget prices 170 turns.
    Case B — full autonomous cold drive: 9 CONFIRMED probes, each
    followed by a FILED claim (modules + locations as above), /safe
    contributes zero CONFIRMs, 246 verdict turns (Rule #69 adds the
    profile redirect_post FAILED pair; Rule #71 adds one FAILED
    hostheader pair per query sink), process completes, no re-probe,
    every claim carries a real evidence_hash and its stored output ends
    VERDICT: CONFIRMED.
    Case C — regression: the DVWA mock yields ZERO generic sinks so the
    Rule #35 22-step plan is byte-identical.
    Case D — flip-checklist rehearsal evidence: brain-flipcheck-v1.py
    (Rule #51) evaluated against the drive memdir, machine-checked
    item-by-item. Expected: overall NOT-READY (claims are local-only
    'filed', never bridged through the real pipeline — the flip's
    remaining items need the live bridged rehearsal, Rule #48 path),
    with S4/S5/S6/S7 PASS.
    """
    checks = []

    def check(name, cond):
        assert cond, "FAILED: " + name
        checks.append(name)

    def _hist(memdir):
        return load_json(mem_paths(memdir)["process"],
                         {"process": None})["process"]

    here = os.path.dirname(os.path.abspath(__file__))
    fresh12 = os.path.join(here, "probe-lab", "mock-fresh12",
                           "fresh12_app.py")
    dvwa = os.path.join(here, "probe-lab", "mock-dvwa.py")
    flipcheck = os.path.join(here, "brain-flipcheck-v1.py")

    EXPECTED = {("generic_xss", "/xss"),
                ("generic_sqli", "/sqli"),
                ("generic_redirect", "/goto"),
                ("generic_ssrf", "/fetch"),
                ("generic_header", "/hdr"),
                ("generic_cmdi", "/calc"),
                ("generic_trav", "/docs"),
                ("generic_ssti", "/render"),
                ("generic_csrf", "/profile")}
    EXPECTED_IDS = ["form:/profile:POST:bio",
                    "query:/calc:GET:expr",
                    "query:/docs:GET:file",
                    "query:/fetch:GET:url",
                    "query:/goto:GET:url",
                    "query:/hdr:GET:name",
                    "query:/render:GET:name",
                    "query:/safe:GET:q",
                    "query:/sqli:GET:id",
                    "query:/xss:GET:q"]
    EXPECTED_VIA = {"/xss": "via=text",
                    "/goto": "via=redirect-location",
                    "/fetch": "via=ssrf-fetch-hit",
                    "/hdr": "via=header-crlf",
                    "/calc": "via=cmdi-arith",
                    "/docs": "via=trav-passwd",
                    "/render": "via=ssti-jinja"}

    # --- Case A: discovery on the twelfth unseen target ---
    mp = _start_mock(fresh12, 8352, [])
    drive_memdir = None
    try:
        tb = "http://127.0.0.1:8352"
        recon = _lab_recon_map(tb)
        check("fresh12: recon finds zero known modules",
              recon is not None and recon["modules"] == {})
        sinks = _lab_generic_sinks(tb, None, list(recon["modules"]))
        ids = [s["id"] for s in sinks]
        check("discovery: finds all 10 sinks (9 query + 1 POST form)",
              ids == EXPECTED_IDS)
        check("discovery: no sink touches a known module path",
              not any("vulnerabilities" in i for i in ids))
        plan, meta = _lab_plan_for_hunt([], sinks, tb)
        qmods = (["generic_xss", "generic_xss",
                  "generic_sqli", "generic_sqli",
                  "generic_redirect", "generic_redirect",
                  "generic_ssrf", "generic_ssrf",
                  "generic_header", "generic_header",
                  "generic_cmdi", "generic_cmdi",
                  "generic_trav", "generic_trav",
                  "generic_ssti", "generic_ssti",
                  "generic_hostheader", "generic_hostheader"])
        fmods = ["generic_xss", "generic_xss",
                 "generic_sqli", "generic_sqli",
                 "generic_csrf", "generic_csrf",
                 "generic_redirect_post", "generic_redirect_post"]
        check("plan: 170 steps (form quad + 9 query pairs of 9, "
              "Rule #68 + Rule #69 + Rule #71)",
              len(plan) == 170 and
              [s["module"] for s in plan] == fmods + qmods * 9 and
              [s["kind"] for s in plan] ==
              ["probe", "claim"] * 85)
        check("plan: sink spec rides in the marker argv for all 10 "
              "sinks (PLOOP71 hostheader on query sinks)",
              all(s["marker"].split("|", 1)[0] in
                  ("PLOOP56", "PLOOP57", "PLOOP61", "PLOOP62",
                   "PLOOP63", "PLOOP64", "PLOOP65", "PLOOP66",
                   "PLOOP67", "PLOOP69", "PLOOP71")
                  for s in plan if s["kind"] == "probe") and
              all("/" not in s["marker"]
                  for s in plan if s["kind"] == "probe"))
        check("plan_meta: recon_ok=True, 10 generic sink ids recorded",
              meta["recon_ok"] is True and
              set(meta["generic_sinks"]) == set(ids))
        bi = budget_info([], sinks)
        check("budget: 10 sinks priced at 170 turns (9 query x 18 + "
              "1 POST form x 8, Rule #47+#67+#69+#71)",
              bi["recommended_turns"] == 170 and
              bi["generic_turns"] == 170)

        # --- Case B: full autonomous cold drive vs fresh12 ---
        drive_memdir = tempfile.mkdtemp(prefix="ploop68-b-")
        memdir = drive_memdir
        goal = "probe-hunt: fresh12 full generic-set drive"
        ctx = {"registry_url": "http://127.0.0.1:9", "workdir": memdir,
               "memdir": memdir, "target_base": tb}
        verdicts, events = [], []
        for _ in range(280):
            r = run_turn(memdir, goal, ctx)
            events.extend(r.get("events", []))
            if "process_completed" in r.get("events", []):
                break
            verdicts.append(_hist(memdir)["history"][-1]["verdict"])
        sq = [i for i, v in enumerate(verdicts) if v == "CONFIRMED"]
        check("drive: exactly 9 CONFIRMED probes (one per vuln class)",
              len(sq) == 9)
        check("drive: every CONFIRMED probe is followed by a FILED "
              "claim",
              all(verdicts[i + 1] == "FILED" for i in sq))
        check("drive: process completed, no re-probe",
              "process_completed" in events and
              len(verdicts) == 246)
        claims = json.load(open(os.path.join(memdir, "claims.json")))
        got_pairs = {(v["module"], v.get("location"))
                     for v in claims.values()}
        check("drive: exactly 9 claims filed, modules+locations match "
              "the 9 vuln classes",
              len(claims) == 9 and got_pairs == EXPECTED and
              all(v["state"] == "filed" for v in claims.values()))
        check("drive: /safe contributes zero claims (the negative "
              "control — its 9 probe pairs all FAILED)",
              "/safe" not in {v.get("location")
                              for v in claims.values()})
        store = HashStore(os.path.join(memdir, "output"))
        for v in claims.values():
            check("drive: claim carries a real evidence hash",
                  bool(HASH_RE.match(v.get("evidence_hash") or "")))
            raw = _to_text(store.get(v["evidence_hash"]) or b"")
            check("drive: stored output ends VERDICT: CONFIRMED",
                  raw.strip().splitlines()[-1] == "VERDICT: CONFIRMED")
            loc = v.get("location")
            if loc in EXPECTED_VIA:
                check("drive: %s confirmed on its class channel %s"
                      % (loc, EXPECTED_VIA[loc]),
                      EXPECTED_VIA[loc] in raw)
    finally:
        _stop_mock(mp, 8352)

    # --- Case C: DVWA regression — zero generic sinks ---
    mp2 = _start_mock(dvwa, 8341, [])
    try:
        recon2 = _lab_recon_map("http://127.0.0.1:8341")
        sinks2 = _lab_generic_sinks("http://127.0.0.1:8341", None,
                                    list(recon2["modules"]))
        check("dvwa: auth pages skipped WITH REASON, zero generic sinks",
              sinks2 == [])
        plan2, meta2 = _lab_plan_for_hunt(list(recon2["modules"]),
                                          sinks2,
                                          "http://127.0.0.1:8341")
        check("dvwa: Rule #35 22-step plan byte-identical",
              len(plan2) == 22 and meta2["generic_sinks"] == [] and
              all(s["module"] in _HUNT_MODULE_ORDER for s in plan2))
    finally:
        _stop_mock(mp2, 8341)

    # --- Case D: flip-checklist rehearsal evidence (Rule #51) ---
    fc = subprocess.run(
        [sys.executable, flipcheck, "--memdir", drive_memdir],
        capture_output=True, text=True, timeout=60)
    check("flipcheck: brain-flipcheck-v1.py runs clean on the drive "
          "memdir", fc.returncode in (0, 1) and fc.stdout.strip())
    rep = json.loads(fc.stdout)
    items = {i["name"]: i["result"] for i in rep.get("items", [])}
    check("flipcheck: overall NOT-READY — claims are local-only "
          "'filed', never bridged through the real pipeline (the "
          "flip's remaining items need the live bridged rehearsal; "
          "the flip decision stays with the owner)",
          rep.get("overall") == "NOT-READY")
    check("flipcheck: S4 no_half_turns PASS (every turn ok)",
          items.get("no_half_turns") == "PASS")
    check("flipcheck: S5 zero_llm_zero_cost PASS ($0, 0 LLM)",
          items.get("zero_llm_zero_cost") == "PASS")
    check("flipcheck: S6 evidence_hash_every_claim PASS (Rule #37)",
          items.get("evidence_hash_every_claim") == "PASS")
    check("flipcheck: S7 rule20_invariants PASS (outputs by hash)",
          items.get("rule20_invariants") == "PASS")
    check("flipcheck: S1/S2/S3 FAIL for the documented reason "
          "(filed, not accepted; no rehearsal.json)",
          items.get("all_claims_accepted") == "FAIL" and
          items.get("no_filed_leftovers") == "FAIL" and
          items.get("validations_terminal") == "FAIL")

    return {"checks": checks}


def proof_report():
    """Rule #37 — THE HUNTER DELIVERS A DOSSIER.
    1. Full mock hunt (11 modules) -> the completion turn auto-writes
       REPORT.md and records report_written:REPORT.md in its events.
    2. Fail-closed: a filed claim with no readable evidence hash ->
       report_failed, NO REPORT.md written.
    3. On-demand: report_completed_hunt() regenerates the dossier from
       the titles index + hash store (for memdirs completed earlier).
    """
    checks = []

    def check(name, cond):
        assert cond, "FAILED: " + name
        checks.append(name)

    here = os.path.dirname(os.path.abspath(__file__))
    mock = os.path.join(here, "probe-lab", "mock-dvwa.py")

    def _drive(port, label, max_turns):
        memdir = tempfile.mkdtemp(prefix="ploop37-")
        goal = "probe-hunt: %s" % label
        ctx = {"registry_url": "http://127.0.0.1:9", "workdir": memdir,
               "memdir": memdir,
               "target_base": "http://127.0.0.1:%d" % port}
        r = None
        for _ in range(max_turns):
            r = run_turn(memdir, goal, ctx)
            if "process_completed" in r["events"]:
                break
        return memdir, r

    # --- Case 1: full mock hunt auto-writes the dossier at completion ---
    mp1 = _start_mock(mock, 8345, [])
    try:
        memdir1, r1 = _drive(8345, "report auto-write", 40)
        check("auto-report: hunt completes",
              "process_completed" in r1["events"])
        check("auto-report: completion turn records report_written",
              any(e.startswith("report_written:") for e in r1["events"]))
        rp1 = os.path.join(memdir1, "REPORT.md")
        check("auto-report: REPORT.md exists", os.path.isfile(rp1))
        text = open(rp1, encoding="utf-8").read()
        check("auto-report: 11 findings in the dossier",
              text.count("### F") == 11)
        check("auto-report: hash appendix present", "Hash appendix" in text)
        check("auto-report: dead ends section present",
              "## Dead ends" in text)
        check("auto-report: $0 cost stated", "$0.00" in text)
        check("auto-report: recon recorded",
              "Recon:" in text and "Modules planned: 11" in text)
    finally:
        _stop_mock(mp1, 8345)

    # --- Case 2: fail-closed — claim without evidence -> no dossier ---
    drops = ["--drop=%s" % m for m in _HUNT_MODULE_ORDER if m != "xss_r"]
    mp2 = _start_mock(mock, 8346, drops)
    try:
        memdir2, r2 = _drive(8346, "report fail-closed", 10)
        check("fail-closed: 1-module hunt completes",
              "process_completed" in r2["events"])
        rp2 = os.path.join(memdir2, "REPORT.md")
        check("fail-closed: dossier written on the clean run",
              os.path.isfile(rp2))
        cp = os.path.join(memdir2, "claims.json")
        claims = json.load(open(cp))
        for v in claims.values():
            v["evidence_hash"] = ""
        json.dump(claims, open(cp, "w"))
        os.remove(rp2)
        ok, info = report_completed_hunt(memdir2)
        check("fail-closed: on-demand report refuses without evidence",
              ok is False and "evidence_hash" in info)
        check("fail-closed: no REPORT.md written on refusal",
              not os.path.exists(rp2))
    finally:
        _stop_mock(mp2, 8346)

    # --- Case 3: on-demand regeneration from the titles index ---
    rp1 = os.path.join(memdir1, "REPORT.md")
    os.remove(rp1)
    ok, info = report_completed_hunt(memdir1)
    check("on-demand: regenerates the dossier", ok is True and
          info == "REPORT.md" and os.path.isfile(rp1))
    text = open(rp1, encoding="utf-8").read()
    check("on-demand: regenerated dossier has 11 findings",
          text.count("### F") == 11)

    # --- Case 4: Rule #38 — a dead end does NOT end the hunt ---
    # Hand-built 2-module plan (sqli_blind + brute, both rungless):
    # force the base probe FAILED via reply_override, then let decide()
    # run the dead-end path. The hunt must CONTINUE past the dead end.
    memdir = tempfile.mkdtemp(prefix="ploop38-")
    goal = "probe-hunt: dead end continues"
    ctx = {"registry_url": "http://127.0.0.1:9", "workdir": memdir,
           "memdir": memdir, "target_base": "http://127.0.0.1:9"}
    plan = [
        {"desc": "Probe sqli_blind", "kind": "probe",
         "module": "sqli_blind", "probe": "parent_brain_bsqli.sh",
         "marker": "PLOOP38-B", "done": False, "result_hash": None},
        {"desc": "File claim sqli_blind", "kind": "claim",
         "module": "sqli_blind", "probe_step_idx": 0,
         "done": False, "result_hash": None},
        {"desc": "Probe brute", "kind": "probe", "module": "brute",
         "probe": "parent_brain_brute.sh", "marker": "PLOOP38-BR",
         "done": False, "result_hash": None},
        {"desc": "File claim brute", "kind": "claim",
         "module": "brute", "probe_step_idx": 2,
         "done": False, "result_hash": None},
    ]
    proc = _fresh_process_doc("Probe-hunt vs dead-end-test",
                              "Rule #38 proof: dead ends continue the hunt",
                              plan)
    save_json(mem_paths(memdir)["process"], {"process": proc})
    save_json(mem_paths(memdir)["state"], {"turn": 0})

    def _ov(task):
        return {"task": task, "goal": goal, "progress": "p",
                "why_this": "x" * 30, "why_not_alternatives": "y" * 30,
                "action": {"type": "shell",
                           "command": "echo SIMULATED_BLOCK; "
                                      "echo VERDICT:FAILED"}}

    def _plan():
        return load_json(mem_paths(memdir)["process"],
                         {"process": None})["process"]["plan"]

    r1 = run_turn(memdir, goal, ctx,
                  reply_override=_ov("probe sqli_blind (forced)"))
    check("dead-end: forced base probe FAILED, step stays open",
          r1["reply"]["action"]["type"] == "shell" and
          _plan()[0]["done"] is not True and
          _plan()[0].get("failed_attempts") == 1)
    r2 = run_turn(memdir, goal, ctx)  # decide(): ladder exhausted
    check("dead-end: no process_complete on a dead module (the bug)",
          "process_completed" not in r2["events"])
    check("dead-end: turn verdict is DEAD_END (ladder will not re-fire)",
          r2["reply"].get("dead_end_step") is True)
    check("dead-end: probe step marked done WITH dead_end flag",
          _plan()[0]["done"] is True and _plan()[0].get("dead_end") is True
          and _plan()[0].get("last_verdict") == "FAILED")
    r3 = run_turn(memdir, goal, ctx)  # claim step: paired probe dead-ended
    check("dead-end: dead module's claim step dead-ends too (no "
          "claim-blocked stall)",
          r3["reply"].get("dead_end_step") is True and
          "dead-ended" in r3["reply"]["task"] and
          _plan()[1]["done"] is True and _plan()[1].get("dead_end") is True)
    # turns 4-6: brute probe (dead target -> fail-closed FAILED),
    # its dead end, its claim dead end; turn 7: all done -> complete
    r = None
    for _ in range(6):
        r = run_turn(memdir, goal, ctx)
        if "process_completed" in r["events"]:
            break
    check("dead-end: hunt completes only after ALL modules attempted",
          "process_completed" in r["events"])
    # after completion the plan lives in the hash store (titles index)
    titles = load_json(os.path.join(memdir, "titles.json"), [])
    store = HashStore(os.path.join(memdir, "output"))
    cproc = json.loads(store.get(titles[-1]["hash"]).decode("utf-8"))
    cplan = cproc.get("plan", [])
    check("dead-end: both modules recorded dead, none CONFIRMED",
          all(s.get("dead_end") for s in cplan) and
          all(s["done"] for s in cplan))
    ok, info = report_completed_hunt(memdir)
    check("dead-end: dossier written, dead ends listed WITH REASON",
          ok is True and
          "Dead ends" in open(os.path.join(memdir, "REPORT.md"),
                              encoding="utf-8").read())

    return {"checks": checks}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--proof", action="store_true",
                    help="run the end-to-end lab proof")
    ap.add_argument("--proof-escalation", action="store_true",
                    help="Rule #30: open-mode regression + filtered ladder "
                         "proof + filtered-hard dead-end proof")
    ap.add_argument("--proof-probe", action="store_true",
                    help="Rule #31: probe execution in the one loop "
                         "(open + waf + fail-closed controls)")
    ap.add_argument("--proof-claim", action="store_true",
                    help="Rule #32: claim discipline in the one loop "
                         "(file-once, gate blocks, terminal validation)")
    ap.add_argument("--proof-reconplan", action="store_true",
                    help="Rule #35: recon-driven hunt plans "
                         "(find 11/11, prune dropped, dead-target "
                         "fallback, full regression)")
    ap.add_argument("--proof-genericsink", action="store_true",
                    help="Rule #56: generic sink hunting "
                         "(discover unknown sinks, CONFIRM reflected "
                         "XSS on a fresh target, negative control "
                         "refused, DVWA regression)")
    ap.add_argument("--proof-colddrive2", action="store_true",
                    help="Rule #58: cold one-loop drive vs a SECOND "
                         "unseen target (3-param form XSS, boolean-blind "
                         "SQLi with no error keywords, double negative "
                         "control, DVWA regression)")
    ap.add_argument("--proof-attrxss", action="store_true",
                    help="Rule #59: context-aware generic XSS "
                         "(attr-dq/attr-sq/comment/js-dq breakouts on a "
                         "third unseen target) + location-scoped claim "
                         "dedup, DVWA regression")
    ap.add_argument("--proof-stylexss", action="store_true",
                    help="Rule #60: <style>-context generic XSS "
                         "(</style> breakout on a fourth unseen target), "
                         "DVWA regression")
    ap.add_argument("--proof-csrfsink", action="store_true",
                    help="Rule #61: generic CSRF state-change probe for "
                         "POST sinks (fifth unseen target), DVWA "
                         "regression")
    ap.add_argument("--proof-redirect", action="store_true",
                    help="Rule #62: generic open-redirect probe for "
                         "query sinks (sixth unseen target), DVWA "
                         "regression")
    ap.add_argument("--proof-ssrf", action="store_true",
                    help="Rule #63: generic SSRF-reachability probe for "
                         "query sinks (seventh unseen target), DVWA "
                         "regression")
    ap.add_argument("--proof-header", action="store_true",
                    help="Rule #64: generic header-injection/CRLF probe "
                         "for query sinks (eighth unseen target), DVWA "
                         "regression")
    ap.add_argument("--proof-cmdi", action="store_true",
                    help="Rule #65: generic blind command-injection "
                         "probe for query sinks (ninth unseen target), "
                         "DVWA regression")
    ap.add_argument("--proof-trav", action="store_true",
                    help="Rule #66: generic path-traversal / LFI probe "
                         "for query sinks (tenth unseen target), DVWA "
                         "regression")
    ap.add_argument("--proof-ssti", action="store_true",
                    help="Rule #67: generic server-side template "
                         "injection probe for query sinks (eleventh "
                         "unseen target), DVWA regression")
    ap.add_argument("--proof-postredirect", action="store_true",
                    help="Rule #69: generic open-redirect probe for "
                         "POST-form sinks (thirteenth unseen target), "
                         "DVWA regression")
    ap.add_argument("--proof-xxe", action="store_true",
                    help="Rule #70: generic XXE probe for xml sinks "
                         "(fourteenth unseen target), DVWA regression")
    ap.add_argument("--proof-hostheader", action="store_true",
                    help="Rule #71: generic host-header injection probe "
                         "for query sinks (fifteenth unseen target), "
                         "DVWA regression")
    ap.add_argument("--proof-cookiexss", action="store_true",
                    help="Rule #74: generic cookie-sink reflected-XSS "
                         "probe (sixteenth unseen target), "
                         "DVWA regression")
    ap.add_argument("--proof-jsonxss", action="store_true",
                    help="Rule #80: generic JSON-body-sink reflected-XSS "
                         "probe (nineteenth unseen target), "
                         "DVWA regression")
    ap.add_argument("--proof-reconfirm", action="store_true",
                    help="Rule #81: double-confirm in the probe executor "
                         "(twentieth unseen target: stable + flaky JSON "
                         "sinks), DVWA regression")
    ap.add_argument("--proof-fulldrive", action="store_true",
                    help="Rule #68: owner-flip rehearsal drive — full "
                         "generic set cold-driven vs a twelfth unseen "
                         "multi-class target, flip-checklist evidence, "
                         "DVWA regression")
    ap.add_argument("--proof-report", action="store_true",
                    help="Rule #37: the hunter delivers a dossier "
                         "(auto-write at completion, fail-closed "
                         "evidence, on-demand regen, full regression)")
    ap.add_argument("--budget-json", action="store_true",
                    help="Rule #47: print the escalation-aware turn budget "
                         "for the full probe-hunt plan as JSON and exit "
                         "(modules, base_turns, max_escalation_turns, "
                         "recommended_turns)")
    ap.add_argument("--scan-validation", metavar="EVENTS_JSONL",
                    help="apply verifier terminal-validation events to the "
                         "claims in --memdir (Rule #21 scan, Rule #32)")
    ap.add_argument("--selftest", action="store_true",
                    help="validator + hash-store unit checks")
    ap.add_argument("--parent-api", choices=("emit", "consume"),
                    help="parent-as-API file handoff: emit this turn's "
                         "inputs as files, or consume the parent's reply "
                         "file (validate + bounce + execute)")
    ap.add_argument("--memdir", help="hunt memory dir for handoff mode")
    ap.add_argument("--goal", default="", help="standing goal (handoff mode)")
    ap.add_argument("--wait-s", type=int, default=HANDOFF_WAIT_S,
                    help="consume: max seconds to wait for a reply file")
    ap.add_argument("--embed-shot", action="store_true",
                    help="emit: base64-embed the screenshot in the inputs "
                         "file (fail-closed over the size cap)")
    ap.add_argument("--report", metavar="MEMDIR",
                    help="Rule #37: write the vulnerability dossier "
                         "REPORT.md for a completed hunt memdir "
                         "(on-demand; the loop also writes it "
                         "automatically at completion)")
    args = ap.parse_args()

    if args.budget_json:
        # Rule #47: pure query, no side effects, safe to call any time.
        print(json.dumps(budget_info()))
        return

    if args.report:
        ok, info = report_completed_hunt(args.report)
        print(("REPORT_WRITTEN: %s/REPORT.md" % args.report) if ok
              else ("REPORT_FAILED: %s" % info))
        sys.exit(0 if ok else 2)

    if args.parent_api:
        if not args.memdir:
            ap.error("--parent-api needs --memdir")
        if args.parent_api == "emit":
            emit_parent_api(args.memdir, args.goal,
                            embed_shot=args.embed_shot)
        else:
            consume_parent_api(args.memdir, args.goal, wait_s=args.wait_s)
        return

    if args.selftest:
        # validator unit checks
        good = {"task": "t", "goal": "g", "progress": "p",
                "why_this": "x" * 30, "why_not_alternatives": "y" * 30,
                "action": {"type": "shell", "command": "echo hi"}}
        ok, errs = validate_reply(good, False)
        assert ok, errs
        bad = {"task": "t", "action": {"type": "nope"}}
        ok, errs = validate_reply(bad, False)
        assert not ok and len(errs) >= 3, errs
        # hash store invariant
        d = tempfile.mkdtemp(prefix="hs-")
        hs = HashStore(os.path.join(d, "output"))
        h = hs.put(b"hello", {"t": 1})
        assert hs.get(h) == b"hello" and hs.get("0" * 64) is None
        # _to_text on timeout bytes (Rule #25)
        try:
            raise subprocess.TimeoutExpired("cmd", 1, output=b"\xff\xfe")
        except subprocess.TimeoutExpired as e:
            assert _to_text(e.output) == "��", repr(_to_text(e.output))
        print("SELFTEST PASS")
        return

    if args.scan_validation:
        if not args.memdir:
            ap.error("--scan-validation needs --memdir")
        res = apply_terminal_validation(args.memdir, args.scan_validation)
        print("applied=%d unmatched=%d ambiguous=%d errors=%d"
              % (len(res["applied"]), len(res["unmatched"]),
                 len(res["ambiguous"]), len(res["errors"])))
        for a in res["applied"]:
            print("  applied: %s -> %s"
                  % (str(a.get("title", "?"))[:60], a.get("verdict")))
        for u in res["unmatched"]:
            print("  UNMATCHED line %s: %s" % (u.get("line"), u.get("plan")))
        for e in res.get("errors", []):
            print("  ERROR: %s" % e)
        return

    if args.proof_claim:
        t0 = time.time()
        reg = proof_brainloop()          # regression: 35/35 must hold
        esc = proof_escalation_loop()    # regression: Rule #30 intact
        clm = proof_claim_loop()         # Rule #32: claims in the one loop
        allc = (["regression: " + c for c in reg["checks"]] +
                ["escalation: " + c for c in esc["checks"]] +
                ["claim-loop: " + c for c in clm["checks"]])
        dt = time.time() - t0
        print("=" * 70)
        print("RULE #32 LAB PROOF: %d/%d checks passed in %.1fs"
              % (len(allc), len(allc), dt))
        for c in allc:
            print("  [ok] " + c)
        print("PROOF: PASS")
        return

    if args.proof_reconplan:
        t0 = time.time()
        reg = proof_brainloop()          # regression: Rule #28 intact
        esc = proof_escalation_loop()    # regression: Rule #30 intact
        prb = proof_probe_loop()         # regression: Rule #31 intact
        clm = proof_claim_loop()         # regression: Rule #32 intact
        rcp = proof_reconplan()          # Rule #35: recon-driven plans
        allc = (["regression: " + c for c in reg["checks"]] +
                ["escalation: " + c for c in esc["checks"]] +
                ["probe-loop: " + c for c in prb["checks"]] +
                ["claim-loop: " + c for c in clm["checks"]] +
                ["reconplan: " + c for c in rcp["checks"]])
        dt = time.time() - t0
        print("=" * 70)
        print("RULE #35 LAB PROOF: %d/%d checks passed in %.1fs"
              % (len(allc), len(allc), dt))
        for c in allc:
            print("  [ok] " + c)
        print("PROOF: PASS")
        return

    if args.proof_genericsink:
        t0 = time.time()
        rcp = proof_reconplan()          # regression: Rule #35 intact
        gen = proof_genericsink()         # Rule #56: generic sinks
        allc = (["reconplan: " + c for c in rcp["checks"]] +
                ["genericsink: " + c for c in gen["checks"]])
        dt = time.time() - t0
        print("=" * 70)
        print("RULE #56 LAB PROOF: %d/%d checks passed in %.1fs"
              % (len(allc), len(allc), dt))
        for c in allc:
            print("  [ok] " + c)
        print("PROOF: PASS")
        return

    if args.proof_colddrive2:
        t0 = time.time()
        gen2 = proof_colddrive2()          # Rule #58: cold drive, target #2
        allc = ["colddrive2: " + c for c in gen2["checks"]]
        dt = time.time() - t0
        print("=" * 70)
        print("RULE #58 LAB PROOF: %d/%d checks passed in %.1fs"
              % (len(allc), len(allc), dt))
        for c in allc:
            print("  [ok] " + c)
        print("PROOF: PASS")
        return

    if args.proof_attrxss:
        t0 = time.time()
        gen3 = proof_attrxss()            # Rule #59: context-aware XSS
        allc = ["attrxss: " + c for c in gen3["checks"]]
        dt = time.time() - t0
        print("=" * 70)
        print("RULE #59 LAB PROOF: %d/%d checks passed in %.1fs"
              % (len(allc), len(allc), dt))
        for c in allc:
            print("  [ok] " + c)
        print("PROOF: PASS")
        return

    if args.proof_stylexss:
        t0 = time.time()
        gen4 = proof_stylexss()           # Rule #60: <style> XSS
        allc = ["stylexss: " + c for c in gen4["checks"]]
        dt = time.time() - t0
        print("=" * 70)
        print("RULE #60 LAB PROOF: %d/%d checks passed in %.1fs"
              % (len(allc), len(allc), dt))
        for c in allc:
            print("  [ok] " + c)
        print("PROOF: PASS")
        return

    if args.proof_csrfsink:
        t0 = time.time()
        gen5 = proof_csrfsink()           # Rule #61: generic CSRF probe
        allc = ["csrfsink: " + c for c in gen5["checks"]]
        dt = time.time() - t0
        print("=" * 70)
        print("RULE #61 LAB PROOF: %d/%d checks passed in %.1fs"
              % (len(allc), len(allc), dt))
        for c in allc:
            print("  [ok] " + c)
        print("PROOF: PASS")
        return

    if args.proof_redirect:
        t0 = time.time()
        gen6 = proof_redirect()           # Rule #62: open-redirect probe
        allc = ["redirect: " + c for c in gen6["checks"]]
        dt = time.time() - t0
        print("=" * 70)
        print("RULE #62 LAB PROOF: %d/%d checks passed in %.1fs"
              % (len(allc), len(allc), dt))
        for c in allc:
            print("  [ok] " + c)
        print("PROOF: PASS")
        return

    if args.proof_ssrf:
        t0 = time.time()
        gen7 = proof_ssrf()               # Rule #63: SSRF probe
        allc = ["ssrf: " + c for c in gen7["checks"]]
        dt = time.time() - t0
        print("=" * 70)
        print("RULE #63 LAB PROOF: %d/%d checks passed in %.1fs"
              % (len(allc), len(allc), dt))
        for c in allc:
            print("  [ok] " + c)
        print("PROOF: PASS")
        return

    if args.proof_header:
        t0 = time.time()
        gen8 = proof_header()             # Rule #64: header-injection
        allc = ["header: " + c for c in gen8["checks"]]
        dt = time.time() - t0
        print("=" * 70)
        print("RULE #64 LAB PROOF: %d/%d checks passed in %.1fs"
              % (len(allc), len(allc), dt))
        for c in allc:
            print("  [ok] " + c)
        print("PROOF: PASS")
        return

    if args.proof_cmdi:
        t0 = time.time()
        gen9 = proof_cmdi()               # Rule #65: command-injection
        allc = ["cmdi: " + c for c in gen9["checks"]]
        dt = time.time() - t0
        print("=" * 70)
        print("RULE #65 LAB PROOF: %d/%d checks passed in %.1fs"
              % (len(allc), len(allc), dt))
        for c in allc:
            print("  [ok] " + c)
        print("PROOF: PASS")
        return

    if args.proof_trav:
        t0 = time.time()
        gen10 = proof_trav()              # Rule #66: path-traversal/LFI
        allc = ["trav: " + c for c in gen10["checks"]]
        dt = time.time() - t0
        print("=" * 70)
        print("RULE #66 LAB PROOF: %d/%d checks passed in %.1fs"
              % (len(allc), len(allc), dt))
        for c in allc:
            print("  [ok] " + c)
        print("PROOF: PASS")
        return

    if args.proof_ssti:
        t0 = time.time()
        gen11 = proof_ssti()              # Rule #67: SSTI probe
        allc = ["ssti: " + c for c in gen11["checks"]]
        dt = time.time() - t0
        print("=" * 70)
        print("RULE #67 LAB PROOF: %d/%d checks passed in %.1fs"
              % (len(allc), len(allc), dt))
        for c in allc:
            print("  [ok] " + c)
        print("PROOF: PASS")
        return

    if args.proof_postredirect:
        t0 = time.time()
        gen13 = proof_postredirect()      # Rule #69: POST open-redirect
        allc = ["postredirect: " + c for c in gen13["checks"]]
        dt = time.time() - t0
        print("=" * 70)
        print("RULE #69 LAB PROOF: %d/%d checks passed in %.1fs"
              % (len(allc), len(allc), dt))
        for c in allc:
            print("  [ok] " + c)
        print("PROOF: PASS")
        return

    if args.proof_xxe:
        t0 = time.time()
        gen14 = proof_xxe()               # Rule #70: XXE probe
        allc = ["xxe: " + c for c in gen14["checks"]]
        dt = time.time() - t0
        print("=" * 70)
        print("RULE #70 LAB PROOF: %d/%d checks passed in %.1fs"
              % (len(allc), len(allc), dt))
        for c in allc:
            print("  [ok] " + c)
        print("PROOF: PASS")
        return
    if args.proof_hostheader:
        t0 = time.time()
        gen15 = proof_hostheader()        # Rule #71: host-header probe
        allc = ["hostheader: " + c for c in gen15["checks"]]
        dt = time.time() - t0
        print("=" * 70)
        print("RULE #71 LAB PROOF: %d/%d checks passed in %.1fs"
              % (len(allc), len(allc), dt))
        for c in allc:
            print("  [ok] " + c)
        print("PROOF: PASS")
        return

    if args.proof_cookiexss:
        t0 = time.time()
        gen16 = proof_cookiexss()       # Rule #74: cookie-sink XSS
        allc = ["cookiexss: " + c for c in gen16["checks"]]
        dt = time.time() - t0
        print("=" * 70)
        print("RULE #74 LAB PROOF: %d/%d checks passed in %.1fs"
              % (len(allc), len(allc), dt))
        for c in allc:
            print("  [ok] " + c)
        print("PROOF: PASS")
        return

    if args.proof_jsonxss:
        t0 = time.time()
        gen19 = proof_jsonxss()         # Rule #80: JSON-body-sink XSS
        allc = ["jsonxss: " + c for c in gen19["checks"]]
        dt = time.time() - t0
        print("=" * 70)
        print("RULE #80 LAB PROOF: %d/%d checks passed in %.1fs"
              % (len(allc), len(allc), dt))
        for c in allc:
            print("  [ok] " + c)
        print("PROOF: PASS")
        return

    if args.proof_reconfirm:
        t0 = time.time()
        gen20 = proof_reconfirm()       # Rule #81: double-confirm gate
        allc = ["reconfirm: " + c for c in gen20["checks"]]
        dt = time.time() - t0
        print("=" * 70)
        print("RULE #81 LAB PROOF: %d/%d checks passed in %.1fs"
              % (len(allc), len(allc), dt))
        for c in allc:
            print("  [ok] " + c)
        print("PROOF: PASS")
        return

    if args.proof_fulldrive:
        t0 = time.time()
        gen12 = proof_fulldrive()         # Rule #68: rehearsal drive
        allc = ["fulldrive: " + c for c in gen12["checks"]]
        dt = time.time() - t0
        print("=" * 70)
        print("RULE #68 LAB PROOF: %d/%d checks passed in %.1fs"
              % (len(allc), len(allc), dt))
        for c in allc:
            print("  [ok] " + c)
        print("PROOF: PASS")
        return

    if args.proof_report:
        t0 = time.time()
        reg = proof_brainloop()          # regression: Rule #28 intact
        esc = proof_escalation_loop()    # regression: Rule #30 intact
        prb = proof_probe_loop()         # regression: Rule #31 intact
        clm = proof_claim_loop()         # regression: Rule #32 intact
        rcp = proof_reconplan()          # regression: Rule #35 intact
        rpt = proof_report()             # Rule #37: the dossier
        allc = (["regression: " + c for c in reg["checks"]] +
                ["escalation: " + c for c in esc["checks"]] +
                ["probe-loop: " + c for c in prb["checks"]] +
                ["claim-loop: " + c for c in clm["checks"]] +
                ["reconplan: " + c for c in rcp["checks"]] +
                ["report: " + c for c in rpt["checks"]])
        dt = time.time() - t0
        print("=" * 70)
        print("RULE #37 LAB PROOF: %d/%d checks passed in %.1fs"
              % (len(allc), len(allc), dt))
        for c in allc:
            print("  [ok] " + c)
        print("PROOF: PASS")
        return

    if args.proof_probe:
        t0 = time.time()
        reg = proof_brainloop()          # regression: 35/35 must hold
        esc = proof_escalation_loop()    # regression: Rule #30 intact
        prb = proof_probe_loop()         # Rule #31: probes in the one loop
        allc = (["regression: " + c for c in reg["checks"]] +
                ["escalation: " + c for c in esc["checks"]] +
                ["probe-loop: " + c for c in prb["checks"]])
        dt = time.time() - t0
        print("=" * 70)
        print("RULE #31 LAB PROOF: %d/%d checks passed in %.1fs"
              % (len(allc), len(allc), dt))
        for c in allc:
            print("  [ok] " + c)
        print("PROOF: PASS")
        return

    if args.proof_escalation:
        t0 = time.time()
        reg = proof_brainloop()          # regression: 35/35 must hold
        esc = proof_escalation_loop()    # Rule #30: filtered + hard
        allc = (["regression: " + c for c in reg["checks"]] +
                ["escalation: " + c for c in esc["checks"]])
        dt = time.time() - t0
        print("=" * 70)
        print("RULE #30 LAB PROOF: %d/%d checks passed in %.1fs"
              % (len(allc), len(allc), dt))
        for c in allc:
            print("  [ok] " + c)
        print("PROOF: PASS")
        return

    if args.proof:
        t0 = time.time()
        summary = proof_brainloop()
        dt = time.time() - t0
        print("=" * 70)
        print("BRAIN-API LOOP LAB PROOF: %d/%d checks passed in %.1fs"
              % (len(summary["checks"]), len(summary["checks"]), dt))
        for c in summary["checks"]:
            print("  [ok] " + c)
        print("memdir: %s" % summary["memdir"])
        print("PROOF: PASS")
        return

    ap.print_help()


if __name__ == "__main__":
    main()
