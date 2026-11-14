#!/usr/bin/env python3
"""Regenerate backend/src/self/checklist.js from Go.xlsx + the coverage map.

Sources:
  - ~/workspace/user/files/Go.xlsx (17 sheets, 232 rows -> 202 distinct checks
    after dedup by check name; A11-A16 focused views + 15 REC cross-listings
    are exact duplicates of home-sheet checks)
  - ~/workspace/goals/dark-matter-autonomous-bug-bounty-agent/hidden_files/go-xlsx-coverage-map-20261114.md
    (per-check LIVE / GAP-partial / GAP status, parsed from its table)

AI tagging rule (conservative, documented in docs/self-mode.md):
  kind='ai' ONLY when the sheet's Tools column says the check needs manual
  review ("manual review" / "manual log review") — 14 checks (A06 x13 + A09 x1).
  GAP-partial checks keep kind='rule-based' (their predefined leg runs) and
  carry needsAiReview=true so the UI can flag the judgment leg as deferred.
  No fully rule-based check is ever tagged AI.

Tool-spec assignment: each check gets 1-3 named tool specs (defined in
toolRunner.js TOOL_SPECS). Missing-tool legs (testssl.sh, dnsx, naabu,
whois, ysoserial-auto) are recorded with available:false + a reason so the
runner reports them blocked/skipped instead of faking a result.

Usage: python3 backend/src/self/generate-checklist.py
Writes: backend/src/self/checklist.js (do not hand-edit; re-run this script)
"""
import json
import re
import sys
from pathlib import Path

try:
    import openpyxl
except ImportError:
    sys.exit("openpyxl required: pip install openpyxl")

REPO = Path(__file__).resolve().parents[3]
XLSX = Path.home() / "workspace/user/files/Go.xlsx"
MAP = (Path.home() / "workspace/goals/dark-matter-autonomous-bug-bounty-agent"
       / "hidden_files/go-xlsx-coverage-map-20261114.md")

SHEET_ORDER = [
    ("Reconnaissance", "REC"),
    ("A01 Broken Access Control", "A01"),
    ("A02 Security Misconfiguration", "A02"),
    ("A03 Supply Chain Failures", "A03"),
    ("A04 Cryptographic Failures", "A04"),
    ("A05 Injection", "A05"),
    ("A06 Insecure Design", "A06"),
    ("A07 Authentication Failures", "A07"),
    ("A08 Data Integrity Failures", "A08"),
    ("A09 Logging and Alerting", "A09"),
    ("A10 Exceptional Conditions", "A10"),
    ("A11 SSRF", "A11"),
    ("A12 CSRF", "A12"),
    ("A13 XXE", "A13"),
    ("A14 XSS", "A14"),
    ("A15 Deserialization", "A15"),
    ("A16 Open Redirect", "A16"),
]

CATEGORY_TITLES = {
    "REC": "Reconnaissance",
    "A01": "Broken Access Control",
    "A02": "Security Misconfiguration",
    "A03": "Supply Chain Failures",
    "A04": "Cryptographic Failures",
    "A05": "Injection",
    "A06": "Insecure Design",
    "A07": "Authentication Failures",
    "A08": "Data Integrity Failures",
    "A09": "Logging and Alerting",
    "A10": "Exceptional Conditions",
    "A11": "SSRF (focused view)",
    "A12": "CSRF (focused view)",
    "A13": "XXE (focused view)",
    "A14": "XSS (focused view)",
    "A15": "Deserialization (focused view)",
    "A16": "Open Redirect (focused view)",
}


def load_status():
    status = {}
    pat = re.compile(
        r"\| ([A-Z][A-Z0-9]+-[0-9]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \| (LIVE|GAP-partial|GAP|AIB) \|")
    for line in MAP.read_text().splitlines():
        m = pat.match(line)
        if m:
            cid = m.group(1).strip()
            status.setdefault(cid, m.group(5).strip())
    return status


def spec(name, **kw):
    d = {"spec": name}
    d.update(kw)
    return d


# Per-check tool assignment. Rules are evaluated in order; first match wins
# for the "specific" table, otherwise the category default applies.
SPECIFIC = [
    (re.compile(r"^REC-01$"), ["subfinder", "amass"]),
    (re.compile(r"^REC-02$"), ["dig", "dnsx-missing"]),
    (re.compile(r"^REC-03$"), ["httpx"]),
    (re.compile(r"^REC-04$"), ["nmap", "naabu-missing"]),
    (re.compile(r"^REC-05$"), ["curl-headers"]),
    (re.compile(r"^REC-06$"), ["curl-headers"]),
    (re.compile(r"^REC-07$"), ["katana", "curl-js"]),
    (re.compile(r"^REC-08$"), ["katana", "nuclei-openapi"]),
    (re.compile(r"^REC-09$"), ["gobuster", "ffuf"]),
    (re.compile(r"^REC-10$"), ["katana"]),
    (re.compile(r"^REC-11$"), ["curl-sourcemap"]),
    (re.compile(r"^REC-12$"), ["curl-robots"]),
    (re.compile(r"^REC-13$"), ["katana", "curl-headers"]),
    (re.compile(r"^REC-14$"), ["dig", "curl-headers"]),
    (re.compile(r"^REC-15$"), ["subfinder", "dig"]),
    (re.compile(r"^INJ-01$"), ["sqlmap", "curl-sqli"]),
    (re.compile(r"^INJ-02$"), ["sqlmap", "curl-sqli"]),
    (re.compile(r"^INJ-03$"), ["curl-sqli", "nuclei"]),
    (re.compile(r"^INJ-04$"), ["curl-xss", "nuclei"]),
    (re.compile(r"^INJ-05$"), ["curl-xss", "nuclei"]),
    (re.compile(r"^INJ-06$"), ["curl-xss", "nuclei"]),
    (re.compile(r"^INJ-10$"), ["curl-ssti", "nuclei"]),
    (re.compile(r"^INJ-11$"), ["curl-ssti", "curl-xss"]),
    (re.compile(r"^SRV-01$"), ["curl-ssrf", "ffuf"]),
    (re.compile(r"^SRV-02$"), ["curl-xxe", "nuclei"]),
    (re.compile(r"^SRV-03$"), ["curl-deser", "ysoserial-manual"]),
    (re.compile(r"^SRV-11$"), ["curl-redirect"]),
    (re.compile(r"^CLI-06$"), ["curl-redirect"]),
    (re.compile(r"^CLI-03$"), ["curl-csrf", "katana"]),
    (re.compile(r"^CLI-01$"), ["curl-xss", "nuclei"]),
    (re.compile(r"^CLI-02$"), ["curl-xss", "nuclei"]),
    (re.compile(r"^CLI-08$"), ["curl-xss", "nuclei"]),
    (re.compile(r"^FILE-10$"), ["curl-xss"]),
    (re.compile(r"^INFRA-05$"), ["curl-ssrf"]),
    (re.compile(r"^AUTH-08$"), ["curl-auth", "hydra-manual"]),
    (re.compile(r"^AUTH-15$"), ["curl-headers", "nuclei"]),
    (re.compile(r"^LOG-"), ["nikto", "curl-headers"]),
]

CATEGORY_DEFAULTS = {
    "REC": ["subfinder", "httpx"],
    "A01": ["curl-unauth", "nuclei"],
    "A02": ["nuclei", "nikto", "curl-headers"],
    "A03": ["curl-deps", "nuclei"],
    "A04": ["openssl-tls", "testssl-missing", "curl-headers"],
    "A05": ["curl-sqli", "curl-xss", "nuclei"],
    "A06": [],
    "A07": ["curl-auth", "nikto"],
    "A08": ["curl-deser", "nuclei"],
    "A09": [],
    "A10": ["ffuf", "curl-headers"],
    "A11": ["curl-ssrf", "ffuf"],
    "A12": ["curl-csrf", "katana"],
    "A13": ["curl-xxe", "nuclei"],
    "A14": ["curl-xss", "nuclei"],
    "A15": ["curl-deser", "ysoserial-manual"],
    "A16": ["curl-redirect"],
}


def tools_for(check_id, category):
    for pat, specs in SPECIFIC:
        if pat.search(check_id):
            return specs
    return list(CATEGORY_DEFAULTS.get(category, ["curl-headers"]))


def main():
    status = load_status()
    wb = openpyxl.load_workbook(XLSX, data_only=True)
    seen = {}
    categories = []
    for sheet_title, code in SHEET_ORDER:
        ws = wb[sheet_title]
        rows = []
        for r in ws.iter_rows(min_row=5, values_only=True):
            if r[1] is None:
                continue
            raw = str(r[1]).strip()
            tools_col = str(r[2]).strip() if r[2] else ""
            if " — " in raw:
                cid, name = raw.split(" — ", 1)
                cid, name = cid.strip(), name.strip()
            else:
                cid, name = raw, raw
            key = " ".join(raw.lower().split())
            if key in seen:
                continue  # exact duplicate (REC cross-listing / A11-A16 focused view)
            seen[key] = code
            is_manual = ("manual review" in tools_col.lower()
                         or "manual log review" in tools_col.lower())
            cov = status.get(cid, "GAP")
            kind = "ai" if is_manual else "rule-based"
            specs = [] if kind == "ai" else tools_for(cid, code)
            rows.append({
                "id": cid,
                "category": code,
                "name": name,
                "sheetTools": tools_col,
                "coverage": cov,
                "kind": kind,
                "needsAiReview": (cov == "GAP-partial"),
                "tools": specs,
            })
        categories.append({"code": code, "sheet": sheet_title,
                           "title": CATEGORY_TITLES[code], "checks": len(rows)})
        # stash rows on the category for assembly below
        categories[-1]["_rows"] = rows

    checks = [c for cat in categories for c in cat.pop("_rows")]
    ai = [c for c in checks if c["kind"] == "ai"]
    print(f"categories={len(categories)} checks={len(checks)} "
          f"rule-based={len(checks) - len(ai)} ai={len(ai)}")
    assert len(checks) == 202, f"expected 202 distinct checks, got {len(checks)}"
    assert len(ai) == 14, f"expected 14 AI checks, got {len(ai)}: {[c['id'] for c in ai]}"
    from collections import Counter
    print("coverage:", dict(Counter(c["coverage"] for c in checks)))

    def js_str(s):
        return json.dumps(s)

    out = []
    out.append("// Self (Hunter Self) mode — checklist config (GENERATED — do not hand-edit).")
    out.append("// Generated by backend/src/self/generate-checklist.py from:")
    out.append("//   - Go.xlsx (17 sheets; 232 rows -> 202 distinct checks after dedup")
    out.append("//     by check name; A11-A16 focused views + 15 REC cross-listings are")
    out.append("//     exact duplicates of home-sheet checks and are counted once)")
    out.append("//   - go-xlsx-coverage-map-20261114.md (per-check LIVE / GAP-partial / GAP)")
    out.append("// AI tagging is conservative: kind='ai' ONLY when the sheet's Tools column")
    out.append("// says the check needs manual review (A06 x13 + A09 x1 = 14 checks).")
    out.append("// GAP-partial checks stay rule-based (their predefined leg runs) and carry")
    out.append("// needsAiReview=true — the judgment leg is deferred, never auto-run.")
    out.append("// Per-check `tools` are named specs defined in toolRunner.js (TOOL_SPECS).")
    out.append("// A spec listed here with available:false in TOOL_SPECS is a missing-tool")
    out.append("// leg: the runner reports it blocked/skipped, NEVER faked.")
    out.append("")
    out.append("export const CATEGORIES = [")
    for cat in categories:
        out.append(f"  {{ code: {js_str(cat['code'])}, sheet: {js_str(cat['sheet'])}, "
                   f"title: {js_str(cat['title'])}, checks: {cat['checks']} }},")
    out.append("];")
    out.append("")
    out.append("export const CHECKS = [")
    for c in checks:
        tools = "[" + ", ".join(js_str(t) for t in c["tools"]) + "]"
        out.append(f"  {{ id: {js_str(c['id'])}, category: {js_str(c['category'])}, "
                   f"name: {js_str(c['name'])}, sheetTools: {js_str(c['sheetTools'])}, "
                   f"coverage: {js_str(c['coverage'])}, kind: {js_str(c['kind'])}, "
                   f"needsAiReview: {str(c['needsAiReview']).lower()}, tools: {tools} }},")
    out.append("];")
    out.append("")
    out.append("export const CHECK_COUNT = CHECKS.length;")
    out.append("export const AI_CHECK_COUNT = CHECKS.filter((c) => c.kind === 'ai').length;")
    out.append("export const RULE_BASED_CHECK_COUNT = CHECK_COUNT - AI_CHECK_COUNT;")
    out.append("")
    out.append("export function getCheck(checkId) {")
    out.append("  return CHECKS.find((c) => c.id === checkId) || null;")
    out.append("}")
    out.append("")
    out.append("export function getCategoryChecks(code) {")
    out.append("  return CHECKS.filter((c) => c.category === code);")
    out.append("}")
    out.append("")
    out.append("export function checksByCategory() {")
    out.append("  const out = {};")
    out.append("  for (const cat of CATEGORIES) out[cat.code] = getCategoryChecks(cat.code);")
    out.append("  return out;")
    out.append("}")
    out.append("")
    target = REPO / "backend/src/self/checklist.js"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text("\n".join(out) + "\n")
    print("wrote", target)


if __name__ == "__main__":
    main()
