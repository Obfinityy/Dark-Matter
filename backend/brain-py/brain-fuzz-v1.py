#!/usr/bin/env python3
"""brain-fuzz-v1 — generic autonomous fuzzer + anomaly triage.

WHAT IT IS: the capability that turns the brain from a DVWA-playbook
executor into a human-like hunter. Recon maps forms; the fuzzer fires a
payload corpus at EVERY injectable input of EVERY form (one payload at a
time, others benign) and triages anomalies deterministically. Works on ANY
target — the exact muscle needed for Juice Shop / Infomaniak later.

SAFETY (human-like restraint, enforced in code):
  * never injects into type=password inputs (left at benign default)
  * never touches token/csrf-named hidden inputs
  * skips password-change-style forms entirely (state-changing auth)
  * same-origin only; fail-closed if target unreachable; --max-requests cap
  * one CONFIRMED per (input, class) then stops that class on that input

DETECTION (deterministic, no guessing):
  * cmdi:      run marker reflected in response body
  * traversal: /etc/passwd or win.ini signature in body
  * xss:       raw marker + raw tag token (<svg/<script/<img/onerror=/onload=)
               in body; POST forms re-GET the page -> stored vs reflected
  * sqli:      SQL error keywords, OR oracle_true/false differential,
               OR <tr> row-count growth >=3
  * time:      elapsed >= baseline + 4.0s
  * redirect:  marker in any hop's Location header
  * header:    marker in any response header name/value

VERDICT: exact 'VERDICT: CONFIRMED' / 'VERDICT: FAILED' as the LAST line
(the engine's exact-match audit rule). llm_calls=0, meta_spend=$0.
"""
import argparse, hashlib, importlib.util, json, os, re, sys, time, urllib.parse
import http.cookiejar as cookiejar

import requests

HERE = os.path.dirname(os.path.abspath(__file__))
BENIGN = "fuzzbenign7"
SKIP_INPUT_RE = re.compile(r"token|csrf", re.I)
PWCHANGE_RE = re.compile(r"password_new|password_conf|new.?pass|change.?pass", re.I)
INJECTABLE_TYPES = {"text", "search", "textarea", "hidden", "select", "url",
                    "email", "number", "tel"}
VOLATILE_RES = [
    re.compile(r"value='[0-9a-f]{8,}'"),   # rotating CSRF hex tokens (real
    re.compile(r'value="[0-9a-f]{8,}"'),   # apps rotate these per response)
    re.compile(r"name='user_token' value='[^']*'"),
]


def normalize(text):
    """Strip volatile per-response values before any differential compare."""
    for rx in VOLATILE_RES:
        text = rx.sub("value='TOKEN'", text)
    return text


def now_ist():
    return time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(time.time() + 19800))


def load_mod(name, fname):
    spec = importlib.util.spec_from_file_location(
        name, os.path.join(HERE, fname))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def build_session(cookie_jar):
    s = requests.Session()
    s.headers.update({"User-Agent": "DarkMatter-Fuzz/1.0 (security research)"})
    if cookie_jar and os.path.exists(cookie_jar):
        jar = cookiejar.MozillaCookieJar(cookie_jar)
        try:
            jar.load(ignore_discard=True, ignore_expires=True)
            s.cookies = jar
        except Exception:
            pass
    return s


def submit(sess, form, values, timeout=15):
    """Submit one form with given name->value map. Returns (resp, elapsed)."""
    method = form["method"].upper()
    action = form["action"]
    t0 = time.time()
    try:
        if method == "GET":
            r = sess.get(action, params=values, timeout=timeout,
                         allow_redirects=True)
        else:
            r = sess.post(action, data=values, timeout=timeout,
                          allow_redirects=True)
        return r, time.time() - t0
    except requests.RequestException:
        return None, 0.0


def benign_values(form):
    vals = {}
    for i in form["inputs"]:
        n = i.get("name", "")
        if not n:
            continue
        t = (i.get("type") or "text").lower()
        if t in ("submit", "button", "file", "checkbox", "radio"):
            continue
        if t == "password":
            vals[n] = BENIGN
        elif t == "select":
            vals[n] = BENIGN
        elif SKIP_INPUT_RE.search(n):
            vals[n] = BENIGN  # tokens stay valid/benign, never fuzzed
        else:
            vals[n] = BENIGN
    return vals


def injectable_inputs(form):
    """Inputs safe to fuzz. Whole form skipped if password-change-shaped."""
    names = [i.get("name", "") for i in form["inputs"]]
    if any(PWCHANGE_RE.search(n) for n in names) and \
            any((i.get("type") or "").lower() == "password" for i in form["inputs"]):
        return None  # state-changing auth form: a human does not fuzz this
    out = []
    for i in form["inputs"]:
        n = i.get("name", "")
        t = (i.get("type") or "text").lower()
        if not n or t == "password" or SKIP_INPUT_RE.search(n):
            continue
        if t in INJECTABLE_TYPES:
            out.append(i)
    return out


def triage(sess, form, inp, payload, marker, baseline, corpus):
    """Fire one payload at one input. Returns (finding_dict|None, detail).

    Anti-false-positive core: mere REFLECTION is not execution. `stripped`
    is the body with every verbatim copy of the sent payload removed — a
    marker that survives stripping was produced by the APP (executed
    command, included file), not echoed back.
    """
    name, ptext = payload["name"], payload["payload"].replace("{M}", marker)
    # Per-payload unique marker: the run marker is shared across payloads and
    # stored state accumulates (guestbook etc.), so attribution must use the
    # full token incl. the payload's unique suffix (C1..C4, X1.., ...).
    pm = re.search(re.escape(marker) + r"[A-Za-z0-9]+", ptext)
    pmark = pm.group(0) if pm else marker
    vals = benign_values(form)
    vals[inp["name"]] = ptext
    r, elapsed = submit(sess, form, vals)
    if r is None:
        return None, "request failed"
    body = r.text or ""
    stripped = body.replace(ptext, "")
    cls = None
    for c, plist in corpus.items():
        if c.startswith("_") or c == "sqli_error_keywords" or \
                c.endswith("_signature"):
            continue
        if any(p["name"] == name for p in plist):
            cls = c
            break

    # --- cmdi: the PAYLOAD's own marker must survive reflection-stripping ---
    if cls == "cmdi" and pmark in stripped:
        return {"class": "cmdi", "severity": "HIGH",
                "title": f"Command injection via {form['action']} [{inp['name']}]",
                "evidence": f"payload {name!r}: marker {pmark} present after "
                            f"stripping verbatim payload echo (executed, not reflected)",
                "payload": ptext[:200]}, "marker executed"
    # --- traversal: file signature must survive stripping too ---
    if cls == "traversal" and (corpus["passwd_signature"] in stripped or
                               corpus["winini_signature"] in stripped):
        return {"class": "lfi", "severity": "HIGH",
                "title": f"Local file inclusion via {form['action']} [{inp['name']}]",
                "evidence": f"payload {name!r} returned file signature",
                "payload": ptext[:200]}, "file signature"
    # --- xss: the RAW payload must be reflected verbatim (unescaped) ---
    if cls == "xss" and name != "xss_plain_marker" and ptext in body:
        stored = False
        if form["method"].upper() == "POST":
            g = sess.get(form["action"], timeout=15)
            stored = g is not None and ptext in (g.text or "")
        return {"class": "xss_s" if stored else "xss_r",
                "severity": "HIGH",
                "title": f"{'Stored' if stored else 'Reflected'} XSS via {form['action']} [{inp['name']}]",
                "evidence": f"payload {name!r} reflected verbatim unescaped; stored={stored}",
                "payload": ptext[:200]}, "unescaped reflection"
    # --- sqli: error keywords (payload stripped, so our own text can't match) ---
    if cls == "sqli" and any(k in stripped.lower()
                             for k in corpus["sqli_error_keywords"]):
        return {"class": "sqli", "severity": "CRITICAL",
                "title": f"SQL injection (error-based) via {form['action']} [{inp['name']}]",
                "evidence": f"payload {name!r} triggered SQL error text",
                "payload": ptext[:200]}, "sql error text"
    # --- sqli: row-count growth ---
    if cls == "sqli":
        base_tr = baseline["text"].lower().count("<tr")
        now_tr = body.lower().count("<tr")
        if now_tr >= base_tr + 3 and now_tr >= 3:
            return {"class": "sqli", "severity": "CRITICAL",
                    "title": f"SQL injection (UNION) via {form['action']} [{inp['name']}]",
                    "evidence": f"payload {name!r}: <tr> rows {base_tr}->{now_tr}",
                    "payload": ptext[:200]}, "row growth"
    # --- time ---
    if cls == "time" and elapsed >= baseline["elapsed"] + 4.0:
        return {"class": "bsqli", "severity": "HIGH",
                "title": f"Time-based blind SQLi via {form['action']} [{inp['name']}]",
                "evidence": f"payload {name!r}: {elapsed:.1f}s vs baseline {baseline['elapsed']:.1f}s",
                "payload": ptext[:200]}, "time delta"
    # --- redirect ---
    if cls == "redirect":
        for h in r.history:
            if pmark in (h.headers.get("Location", "")):
                return {"class": "open_redirect", "severity": "MEDIUM",
                        "title": f"Open redirect via {form['action']} [{inp['name']}]",
                        "evidence": f"payload {name!r}: Location -> {h.headers.get('Location')[:120]}",
                        "payload": ptext[:200]}, "location header"
    # --- header ---
    if cls == "header":
        for k, v in r.headers.items():
            if pmark in k or pmark in v:
                return {"class": "header_injection", "severity": "LOW",
                        "title": f"Header injection via {form['action']} [{inp['name']}]",
                        "evidence": f"payload {name!r}: response header {k}: {v[:80]}",
                        "payload": ptext[:200]}, "response header"
    return None, "no anomaly"


def oracle_differential(sess, form, inp, marker, baseline, corpus, reqs,
                        timeout):
    """Boolean-blind oracle: strip each payload's own text from its response,
    then compare. Reflection alone can no longer fake an oracle — the two
    payloads differ textually (O1 vs O2), so un-normalized comparison ALWAYS
    differs on reflecting pages (the classic fuzzer false positive)."""
    otexts = {}
    opayloads = {}
    for pname in ("oracle_true", "oracle_false"):
        for op in corpus["oracle"]:
            if op["name"] != pname:
                continue
            ptext = op["payload"].replace("{M}", marker)
            ov = benign_values(form)
            ov[inp["name"]] = ptext
            orr, _ = submit(sess, form, ov, timeout=timeout)
            reqs[0] += 1
            body = orr.text if orr is not None else ""
            otexts[pname] = body.replace(ptext, "")
            opayloads[pname] = ptext
            break
    nbase = normalize(baseline["text"].replace(BENIGN, ""))
    t, f_ = otexts.get("oracle_true", ""), otexts.get("oracle_false", "")
    # Stored state grows BETWEEN the two shots: the true-shot's payload is
    # already persisted when the false-shot's response renders. Strip BOTH
    # payload texts (and the benign filler) from BOTH sides, or the hunter's
    # own earlier payload fakes an oracle difference.
    for _qn, qptext in opayloads.items():
        t = t.replace(qptext, "")
        f_ = f_.replace(qptext, "")
    t = normalize(t.replace(BENIGN, ""))
    f_ = normalize(f_.replace(BENIGN, ""))
    if t and f_ and t != f_ and (t != nbase or f_ != nbase):
        return {"class": "bsqli", "severity": "HIGH",
                "title": f"Boolean-blind SQLi via {form['action']} [{inp['name']}]",
                "evidence": "oracle_true vs oracle_false responses differ "
                            "after payload-text normalization",
                "payload": opayloads["oracle_true"][:200],
                "page": form["page"], "input": inp["name"],
                "method": form["method"], "marker": marker}
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--target", required=True)
    ap.add_argument("--recon", default=None, help="recon.json from brain-recon-v1")
    ap.add_argument("--cookie-jar", default=None)
    ap.add_argument("--memory-dir", default=None)
    ap.add_argument("--out", default=None)
    ap.add_argument("--max-requests", type=int, default=400)
    ap.add_argument("--timeout", type=int, default=15)
    ap.add_argument("--scope-file", default=None,
                    help="Rule #27 scope spec JSON (sweep stays inside scope)")
    ap.add_argument("--proxy-port", type=int, default=0,
                    help="Rule #28: route requests via the brain proxy on "
                         "127.0.0.1:PORT (audit + scope enforcement); 0 = direct")
    args = ap.parse_args()

    # Rule #28: requests honors http_proxy/https_proxy env per request.
    if args.proxy_port:
        os.environ.pop("no_proxy", None)
        os.environ.pop("NO_PROXY", None)
        proxy_url = f"http://127.0.0.1:{args.proxy_port}"
        os.environ["http_proxy"] = proxy_url
        os.environ["https_proxy"] = proxy_url
        print(f"[fuzz] Rule #28: requests route via brain proxy {proxy_url}",
              flush=True)

    # Rule #27 startup gate: the target itself must be in scope, else
    # fail-closed with zero requests.
    scope = None
    if args.scope_file:
        scope_mod = load_mod("brain_scope_v1", "brain-scope-v1.py")
        try:
            scope = scope_mod.load_scope(args.scope_file, args.target)
        except ValueError as e:
            print(f"fail-closed: {e}", file=sys.stderr)
            return 2
        ok, why = scope.url_allowed(args.target)
        if not ok:
            print(f"fail-closed: target out of scope: {why} (0 requests sent)",
                  file=sys.stderr)
            return 2
        print(f"[scope] {why}", flush=True)

    marker = "FUZZ" + time.strftime("%H%M%S", time.localtime())
    corpus = json.load(open(os.path.join(HERE, "brain-probes", "fuzz_corpus.json"),
                            encoding="utf-8"))

    # --- fail-closed preflight ---
    try:
        chk = requests.get(args.target.rstrip("/") + "/", timeout=10)
        if chk.status_code >= 500:
            print(f"[fuzz] target error {chk.status_code} — refusing to fuzz",
                  file=sys.stderr)
            sys.exit(1)
    except requests.RequestException as e:
        print(f"[fuzz] target unreachable: {e} — refusing to fuzz",
              file=sys.stderr)
        sys.exit(1)

    # --- inventory: recon forms (crawl fresh if no recon file) ---
    if args.recon and os.path.exists(args.recon):
        recon = json.load(open(args.recon, encoding="utf-8"))
        # brain-recon-v1 writes a top-level "forms" list (each carries "page")
        forms = recon.get("forms", []) or [
            f for ep in recon.get("endpoints", []) for f in ep.get("forms", [])
            if isinstance(f, dict)]
        pages_n = recon.get("pages_crawled", len(forms))
        if scope is not None:
            # Defense in depth: a stale/unscoped recon.json must not let the
            # sweep touch out-of-scope forms.
            kept = []
            for f in forms:
                ok, why = scope.url_allowed(f.get("action", ""))
                if ok:
                    kept.append(f)
                else:
                    print(f"[scope] fuzz skips out-of-scope form "
                          f"{f.get('action', '')}: {why}", flush=True)
            forms = kept
    else:
        recon_mod = load_mod("brain_recon_v1", "brain-recon-v1.py")
        pages, _fp = recon_mod.crawl(args.target, cookie_jar=args.cookie_jar,
                                     scope=scope,
                                     crawl_delay=(scope.crawl_delay_s
                                                  if scope else 0))
        forms = []
        for pg in pages:
            for f in pg.get("forms", []):
                f = dict(f)
                f.setdefault("page", pg.get("url", ""))
                forms.append(f)
        pages_n = len(pages)
    for f in forms:
        f.setdefault("page", f.get("action", ""))
    print(f"[fuzz] inventory: {pages_n} pages, {len(forms)} forms, marker={marker}",
          flush=True)

    sess = build_session(args.cookie_jar)
    findings, tried, reqs = [], [], [0]

    def note(form, inp):
        tried.append(f"fuzz:{urllib.parse.urlparse(form['action']).path}:{inp['name']}")

    for form in forms:
        inps = injectable_inputs(form)
        if inps is None:
            print(f"[fuzz] SKIP password-change form {form['action']}", flush=True)
            continue
        if not inps:
            continue
        base_vals = benign_values(form)
        br, bel = submit(sess, form, base_vals, timeout=args.timeout)
        reqs[0] += 1
        if br is None:
            continue
        baseline = {"text": br.text or "", "elapsed": bel,
                    "status": br.status_code}
        confirmed_classes = set()
        for inp in inps:
            for cls, plist in corpus.items():
                if cls.startswith("_") or cls in ("sqli_error_keywords",) or \
                        cls.endswith("_signature") or cls in confirmed_classes \
                        or cls == "oracle":
                    # oracle payloads are handled below as a true/false
                    # differential pair, not as single shots
                    continue
                for payload in plist:
                    if reqs[0] >= args.max_requests:
                        print("[fuzz] max-requests cap hit — stopping (fail-closed)",
                              flush=True)
                        break
                    if cls in confirmed_classes:
                        break
                    f, detail = triage(sess, form, inp, payload, marker,
                                       baseline, corpus)
                    reqs[0] += 1
                    if f:
                        f.update({"page": form["page"], "input": inp["name"],
                                  "method": form["method"], "marker": marker})
                        findings.append(f)
                        confirmed_classes.add(cls)
                        print(f"[fuzz] CONFIRMED {f['class']} {form['action']} "
                              f"[{inp['name']}] via {payload['name']}", flush=True)
                        break
                if reqs[0] >= args.max_requests:
                    break
            # oracle differential as its own step (normalized, no
            # reflection false positives — see oracle_differential).
            # Precondition: the page must NOT accumulate stored state between
            # requests (a human notices "this page keeps my old inputs" and
            # knows true/false diffing is meaningless there). Detect by
            # re-taking the benign baseline: if it drifted, skip the oracle.
            if "bsqli" not in confirmed_classes and \
                    reqs[0] + 3 <= args.max_requests:
                br2, _ = submit(sess, form, benign_values(form),
                                timeout=args.timeout)
                reqs[0] += 1
                if br2 is not None and normalize(br2.text or "") != \
                        normalize(baseline["text"]):
                    print(f"[fuzz] oracle skipped {form['action']} "
                          f"[{inp['name']}]: page accumulates stored state",
                          flush=True)
                else:
                    of = oracle_differential(sess, form, inp, marker, baseline,
                                             corpus, reqs, args.timeout)
                    if of:
                        findings.append(of)
                        confirmed_classes.add("bsqli")
                        print(f"[fuzz] CONFIRMED bsqli {form['action']} "
                              f"[{inp['name']}] via oracle differential",
                              flush=True)
            note(form, inp)

    result = {"tool": "brain-fuzz-v1", "target": args.target, "marker": marker,
              "finished_ist": now_ist(), "requests": reqs[0],
              "forms_seen": len(forms), "inputs_tried": len(tried),
              "findings": findings, "tried": tried,
              "VERDICT": "CONFIRMED" if findings else "FAILED"}
    if args.out:
        json.dump(result, open(args.out, "w", encoding="utf-8"), indent=2)

    # --- memory: A-to-Z never-repeat (per-hunt file) ---
    if args.memory_dir:
        fb = load_mod("brain_feedback_v1", "brain-feedback-v1.py")
        mem_path, _pp, out_dir = fb.paths(args.memory_dir)
        memory = fb.load_json(mem_path, {}) or {}
        for t in tried:
            if t not in memory.setdefault("tried", []):
                memory["tried"].append(t)
        for f in findings:
            h = hashlib.sha256(
                (f["title"] + f["evidence"]).encode()).hexdigest()[:16]
            memory.setdefault("findings", []).append({
                "title": f["title"], "class": f["class"],
                "severity": f["severity"], "module": "fuzz",
                "turn": "fuzz", "claim_hash": h, "output_hash": h,
                "status": "fuzz-local (API gate closed)"})
            os.makedirs(out_dir, exist_ok=True)
            with open(os.path.join(out_dir, h + ".txt"), "w",
                      encoding="utf-8") as fh:
                fh.write(f"# fuzz finding {h}\n# {now_ist()}\n\n"
                         f"{json.dumps(f, indent=2)}\n")
        fb.save_json(mem_path, memory)

    print(f"[fuzz] requests={reqs[0]} inputs={len(tried)} "
          f"findings={len(findings)}", flush=True)
    for f in findings:
        print(f"  - [{f['severity']}] {f['title']}", flush=True)
    if not findings:
        print("[fuzz] reason: no payload produced a deterministic anomaly "
              "on any fuzzed input", flush=True)
    print(f"VERDICT: {'CONFIRMED' if findings else 'FAILED'}", flush=True)


if __name__ == "__main__":
    main()
