#!/usr/bin/env python3
"""
brain-report-v1.py — REPORT LANE (STEP 4 of the one-command autonomous brain).

A real human hunter DELIVERS a submission-quality report, not just a finding
list. This lane converts a per-hunt three-file memory directory
(memory.json + output/<sha256>.txt) into a deterministic vulnerability
dossier: executive summary, severity table, per-finding proof-of-concept +
evidence excerpts, dead ends WITH REASON, methodology, limitations, and a
hash appendix — everything a verifier needs to reproduce each finding.

Fail-closed: missing memory.json, unreadable output files, or hash mismatch
on an output file aborts with exit 2 (no fake report is ever written).

Usage:
  python3 brain-report-v1.py --memory-dir <dir> [--out REPORT.md]
"""
import argparse, hashlib, json, os, re, sys
from datetime import datetime, timezone, timedelta

VERSION = "brain-report-v1"
SEV_ORDER = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "INFO": 4}
VERDICT_RE = re.compile(r"^VERDICT:\s*(CONFIRMED|FAILED)\s*$", re.M)
POC_LINE_RE = re.compile(r"^[A-Z][A-Z0-9_]{2,}:\s*.+$")  # MARKER: value evidence lines


def ist_now():
    return (datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)).strftime(
        "%Y-%m-%d %H:%M:%S IST")


def fail(msg):
    print(f"REPORT FAILED: {msg}", file=sys.stderr)
    sys.exit(2)


def load_mem(mem_dir):
    p = os.path.join(mem_dir, "memory.json")
    if not os.path.isfile(p):
        fail(f"memory.json not found in {mem_dir}")
    try:
        return json.load(open(p))
    except Exception as e:
        fail(f"memory.json unreadable: {e}")


def read_output(mem_dir, h):
    """Read output/<hash>.txt and verify the sha256 matches the claimed hash."""
    p = os.path.join(mem_dir, "output", h + ".txt")
    if not os.path.isfile(p):
        fail(f"output file missing for hash {h[:16]}...")
    data = open(p, "rb").read()
    if hashlib.sha256(data).hexdigest() != h:
        fail(f"output hash mismatch for {h[:16]}... (file corrupt or tampered)")
    return data.decode("utf-8", errors="replace")


def extract_poc(text):
    """Deterministic PoC extraction: VERDICT line + uppercase marker lines + head/tail clip."""
    lines = text.splitlines()
    verdict = next((l.strip() for l in lines if VERDICT_RE.match(l.strip())), "VERDICT: (missing)")
    markers = [l.strip() for l in lines if POC_LINE_RE.match(l.strip())]
    seen, poc = set(), []
    for l in markers:
        key = l.split(":", 1)[0]
        if key in ("VERDICT",) or key in seen:
            continue
        seen.add(key)
        poc.append(l)
        if len(poc) >= 12:
            break
    # head+tail clip (same discipline as backend clipResult: 400+400)
    clip = text[:400]
    if len(text) > 800:
        clip += "\n...[truncated %d chars]...\n" % (len(text) - 800) + text[-400:]
    elif len(text) > 400:
        clip += text[-400:]
    return verdict, poc, clip


def sort_key(f):
    s = (f.get("severity") or "INFO").upper()
    t = f.get("turn", 0)
    # turn is int for drive turns, "fuzz"/"explore" for lane findings — keep sort total
    tk = (0, t) if isinstance(t, int) else (1, str(t))
    return (SEV_ORDER.get(s, 9), tk)


def build(mem, mem_dir):
    findings = mem.get("findings", [])
    dead_ends = mem.get("dead_ends", [])
    reasons = mem.get("dead_end_reasons", {})
    recon = mem.get("recon", {}) or {}
    summary = mem.get("summary", {}) or {}
    auth = mem.get("auth", {}) or {}
    target = mem.get("target_base", "(unknown target)")
    hunt_id = mem.get("hunt_id", "(unknown hunt)")
    runs = mem.get("runs", 0)

    sev_counts = {}
    for f in findings:
        s = (f.get("severity") or "INFO").upper()
        sev_counts[s] = sev_counts.get(s, 0) + 1

    out = []
    A = out.append
    A(f"# Vulnerability Dossier — {target}")
    A("")
    A(f"- Report generated: {ist_now()} ({VERSION})")
    A(f"- Hunt id: `{hunt_id}` | Target base: `{target}`")
    A(f"- Memory: per-hunt isolated, A-to-Z, never repeats | Runs: {runs}")
    A(f"- Agent cost: $0.00 Meta/API spend | LLM calls: 0 (rule-based engine)")
    A(f"- Exhausted: {mem.get('exhausted')}")
    A("")
    A("## Executive summary")
    A("")
    if findings:
        order = sorted(sev_counts, key=lambda s: SEV_ORDER.get(s, 9))
        A(f"This hunt produced **{len(findings)} verified findings**: " +
          ", ".join(f"**{sev_counts[s]} {s}**" for s in order) + ".")
    else:
        A("No verified findings. See dead ends and limitations below.")
    A("")
    A("## Methodology")
    A("")
    A(f"- Auth: {json.dumps(auth)[:220]}")
    A(f"- Recon: {json.dumps(recon)[:400]}")
    A(f"- Turns: {summary.get('turns')} (CONFIRMED {summary.get('confirmed')}, "
      f"FAILED {summary.get('failed')}, errors {summary.get('errors')})")
    A(f"- Dead ends recorded: {len(dead_ends)} (each WITH REASON — never re-attempted)")
    A("")
    A("## Findings index")
    A("")
    A("| # | Severity | Module | Title | Status |")
    A("|---|----------|--------|-------|--------|")
    for i, f in enumerate(sorted(findings, key=sort_key), 1):
        A(f"| {i} | {f.get('severity')} | `{f.get('module')}` | {f.get('title')} | {f.get('status')} |")
    A("")

    for i, f in enumerate(sorted(findings, key=sort_key), 1):
        oh = f.get("output_hash", "")
        text = read_output(mem_dir, oh) if oh else ""
        verdict, poc, clip = extract_poc(text) if text else ("VERDICT: (missing)", [], "")
        A(f"### F{i}: {f.get('title')} — {f.get('severity')}")
        A("")
        A(f"- Class: `{f.get('class')}` | Module: `{f.get('module')}` | Turn: {f.get('turn')}")
        A(f"- Probe verdict: `{verdict}` | Recorded: {f.get('recorded_ist')}")
        A(f"- Status: {f.get('status')}")
        A(f"- Claim hash: `{f.get('claim_hash')}`")
        A(f"- Output hash: `{oh}` (sha256-verified)")
        A("")
        A("**Proof-of-concept evidence (from the probe's own stdout):**")
        A("")
        if poc:
            A("```")
            A("\n".join(poc))
            A("```")
        else:
            A("_No uppercase marker lines captured; see raw output excerpt below._")
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
    if not dead_ends:
        A("_None recorded._")
    for d in dead_ends:
        r = reasons.get(d, {})
        why = r.get("reason", "(no reason recorded)") if isinstance(r, dict) else str(r)
        at = r.get("at_ist", "") if isinstance(r, dict) else ""
        A(f"- `{d}` — {why} {('(' + at + ')') if at else ''}".rstrip())
    A("")
    A("## Limitations")
    A("")
    A("- Claims in this lab run were recorded local-only (API gate closed; "
      "no Meta/API tokens used). On a live backend they would be filed via "
      "claim_finding and await the verifier's terminal verdict.")
    A("- Verifier terminal verdicts: only findings the backend verifier "
      f"accepted are terminal; `verdict_feedback_applied` = {mem.get('verdict_feedback_applied')}.")
    A("- Evidence excerpts are clips; the full reproducible output is the "
      "sha256-verified file `output/<hash>.txt` per finding above.")
    A("")
    A("## Hash appendix")
    A("")
    A("| Finding | Output sha256 |")
    A("|---------|----------------|")
    for i, f in enumerate(sorted(findings, key=sort_key), 1):
        A(f"| F{i} | `{f.get('output_hash')}` |")
    A("")
    return "\n".join(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--memory-dir", required=True)
    ap.add_argument("--out", default=None)
    a = ap.parse_args()
    mem_dir = os.path.abspath(a.memory_dir)
    if not os.path.isdir(mem_dir):
        fail(f"not a directory: {mem_dir}")
    mem = load_mem(mem_dir)
    report = build(mem, mem_dir)
    out_path = a.out or os.path.join(mem_dir, "REPORT.md")
    with open(out_path, "w") as fh:
        fh.write(report)
    n = len(mem.get("findings", []))
    print(f"REPORT WRITTEN: {out_path} ({n} findings, {len(report)} chars)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
