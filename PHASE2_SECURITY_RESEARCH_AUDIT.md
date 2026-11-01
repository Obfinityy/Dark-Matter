# PHASE 2: SECURITY RESEARCH CAPABILITY AUDIT

**Date:** 1 Nov 2026, 00:55 IST  
**Method:** Code inspection (no live brain required)

---

## Vulnerability Class Coverage

| Class | Probes | Validators | Genuine Findings | Status |
|-------|--------|------------|------------------|--------|
| SQL Injection | 8 | ✅ `validateSqliAuthBypass` | 1 (UNION dump) | IMPLEMENTED_AND_VERIFIED |
| XSS Reflected | 11* | ✅ `validateXssClaim` | 1 (PBRN7719) | IMPLEMENTED_AND_VERIFIED |
| XSS Stored | — | ✅ | 1 (#624) | IMPLEMENTED_AND_VERIFIED |
| XSS DOM | — | ✅ | 1 (#826) | IMPLEMENTED_AND_VERIFIED |
| Command Injection | 4 | ✅ `validateCommandInjection` | 1 (#450 CRITICAL) | IMPLEMENTED_AND_VERIFIED |
| Path Traversal | 2 | ✅ `validatePathTraversal` | 0 | IMPLEMENTED_BUT_UNVERIFIED |
| CSRF | 2 | — | 1 (#89f265ce) | IMPLEMENTED_AND_VERIFIED |
| SSRF | 2 | — | 0 | IMPLEMENTED_BUT_UNVERIFIED |
| Auth Bypass | 1 | ✅ | 0 | PARTIALLY_IMPLEMENTED |
| IDOR | 0 | — | 0 | NOT_IMPLEMENTED |
| JWT Weakness | 0 | — | 0 | NOT_IMPLEMENTED |
| Session Fixation | 0 | — | 0 | NOT_IMPLEMENTED |

*XSS probes include reflected, stored, DOM, cookie-based variants.

---

## Probe Quality Assessment

**Total probes:** 46 files in `backend/brain-py/brain-probes/`

**Probe structure (verified):**
- Each probe is a self-contained script (Python or Shell)
- Probes target specific sinks (e.g., `probe_sink_sqli.py`, `probe_sink_cookiexss.py`)
- Probes include payload generation and result parsing

**Strengths:**
- Good coverage of injection classes (SQLi, XSS, CMDi)
- Sink-specific probes (header, cookie, JSON, stored)
- Variant probes (mixed case, second-order)

**Gaps:**
- No IDOR probes (object ID enumeration, access control testing)
- No JWT probes (algorithm confusion, none algorithm, weak secrets)
- No session management probes
- No API-specific probes (mass assignment, excessive data exposure)
- SSRF probes exist but no validators (cannot confirm findings)

---

## Hypothesis Generation

**Current:** Brain (LLM) generates hypotheses via `why_this` field in structured output.

**Verified:**
- `actionPlan.js` validates hypothesis structure
- Brain receives target info, scope, memory, prior actions
- Hypotheses are recorded in events

**Limitations:**
- No systematic hypothesis prioritization (brain chooses arbitrarily)
- No coverage-guided hypothesis generation
- 8B model quality issues (semantically broken probes observed)

**Status:** IMPLEMENTED_BUT_UNVERIFIED (works, but quality depends on model)

---

## Attack Surface Discovery

**Implemented:**
- `understandTarget` runs at hunt start
- Technology identification via headers and content
- Endpoint discovery via crawling (limited)

**Not implemented:**
- Systematic API endpoint enumeration
- JavaScript file analysis for hidden endpoints
- Parameter discovery via wordlists

**Status:** PARTIALLY_IMPLEMENTED

---

## Scope Enforcement in Research

**Verified:**
- `scopeGuard.js` blocks out-of-scope commands before execution
- Immutable scope at hunt creation
- Fail-closed on validation errors

**Tests:** 29/29 pass

**Status:** IMPLEMENTED_AND_VERIFIED (deployed in 0051b61)

---

## Recommendations

### High Priority
1. **IDOR probes:** Implement object ID enumeration and access control tests
2. **JWT probes:** Algorithm confusion, weak secret brute force
3. **SSRF validators:** Cannot confirm SSRF findings without validators

### Medium Priority
4. **API discovery:** Endpoint enumeration from JS files and sitemaps
5. **Hypothesis scoring:** Prioritize by attack surface relevance

### Low Priority
6. **Session probes:** Fixation, prediction, insecure handling

---

## Conclusion

**Research capability:** STRONG for injection vulnerabilities (SQLi, XSS, CMDi). WEAK for logic flaws (IDOR, authz).

**Blocking issue:** None for code audit. Brain quality (8B) limits hypothesis quality, but infrastructure is the blocker, not code.

**Next:** Phase 3 (verification) can proceed via unit tests.
