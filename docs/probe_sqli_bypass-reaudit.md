# Re-Audit: probe_sqli_bypass (CRITICAL, 31 Oct 2026)

## Original Finding (PRESERVED — do not modify historical record)
- **Title:** probe_sqli_bypass
- **Severity:** CRITICAL
- **Class:** sqli (SQL Injection)
- **Target:** http://172.17.0.1:3100/ (DVWA)
- **CachedAt:** 2026-10-31T17:27:27Z (22:57:27 IST)
- **Validation verdict:** "confirmed (all 4 steps passed)"
- **Payload:** `login.php?username=;--` (SQL comment-out bypass attempt)

## Evidence Audit (31 Oct 2026, 23:12 IST)

### What was retrieved
- Finding event (events.jsonl line 1360)
- Brain plan (events.jsonl line 1349)  
- Validation event (events.jsonl line 1361)

### What the evidence shows
- **Request:** GET `login.php?username=;--`
- **Response:** DVWA login-form HTML (HTTP 200)
- **Authentication state:** NOT logged in (login form returned, no session established)
- **Bypass demonstrated:** NO — the response is the login page, not an authenticated session

### Why the 4/4 checks passed (ROOT CAUSE)

The `verifyPipeline` in `src/hunt-intel/differential.js` checks boolean flags, not actual evidence:

1. **reachability:** `output.length > 50` → TRUE (login form HTML is >50 chars)
2. **payload_validation:** `/vulnerable|bypass|injection|leak/i.test(output)` → TRUE (output contains "bypass" from the probe's own name/description)
3. **impact_assessment:** Same keyword regex → TRUE (same reason)
4. **exploit_confirmation:** `confirmed` flag → TRUE (see below)

The `confirmed` flag (huntAgent.js:2466):
```javascript
confirmed = !executionFailed(retry, confirmOutput) && sig1.length > 0 && sig2.length > 0 && reproduced;
```

Where `sig1` and `sig2` are extracted via `evidenceSignalIds()` which finds keywords like "bypass" in the output. The re-run produced the same output (with the same keyword), so:
- sig1 = "bypass" (from probe name in output)
- sig2 = "bypass" (same)
- reproduced = true (same signals)
- confirmed = true

**The verifier checked "did the re-run produce the same keywords?" NOT "was the vulnerability demonstrated?"**

### Corrected Assessment

**VERDICT: NOT A PROVEN GENUINE FINDING**

**Reasons:**
1. **Title is a probe name:** `probe_sqli_bypass` matches the `^probe[_-]` pattern. Per the P0 finding-integrity fix (integrated but not deployed), this should be classified as a "probe note", not a verified vulnerability.
2. **No authentication bypass demonstrated:** The response was the login form HTML. A successful SQLi auth bypass would show an authenticated session, dashboard, or other protected resource — not the login page.
3. **Keyword-based false accept:** The 4/4 validation passed based on keyword presence ("bypass" in the probe's own output), not on demonstrated database-dependent impact.
4. **Payload cannot work:** `username=;--` with empty username cannot return rows. The payload is syntactically valid but semantically cannot bypass authentication.

**This finding should be re-audited/retracted before counting as genuine.**

## Preservation Note

The original event history (finding event, validation event, plan) is PRESERVED in `events.jsonl`. This re-audit is recorded separately and does not modify the historical record. A formal retraction (if approved) would add a new `retraction` event referencing the original, not delete it.

## Related Fixes

- **P0 finding-integrity** (integrated in `feat/final-integration`): `claimTitleGuard.js` would have bounced this title at creation time with `claim_title_is_probe_name`.
- **Verifier hardening** (Phase 2 of this mission): Requires claim-to-evidence validation; SQLi auth-bypass must demonstrate authentication-state change, not just keyword presence.
