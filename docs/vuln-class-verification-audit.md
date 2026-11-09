# Vulnerability Class Verification Audit (31 Oct 2026)

## Purpose
Document the false-accept pattern for each vulnerability class and define
what constitutes direct evidence vs weak signals that must NOT confirm a claim.

**Root pattern (all classes):** The 4-step `verifyPipeline` checks boolean flags
derived from keyword presence in output, not from demonstrated impact.
A finding is "verified" if the output contains the right keywords and is long
enough — regardless of whether the vulnerability was actually demonstrated.

## SQL Injection (sqli, sqli_blind)

### Direct Evidence (CONFIRMS)
- **Auth bypass:** Baseline (login form) → test (authenticated page with session indicators: logout link, welcome message, dashboard). Must show state change, not just keywords.
- **UNION-based:** Extracted database content (table names, column data) that was not present in baseline. Must be novel vs baseline, not just "data" in output.
- **Blind:** Statistically significant timing differential (e.g., SLEEP(5) causes ≥4s delay) or boolean differential (true/false payloads produce different responses) across multiple trials.
- **Error-based:** Database-specific error messages (MySQL syntax error, PostgreSQL error) that reveal query structure — not generic "error occurred".

### Weak Signals (MUST NOT CONFIRM)
- HTTP 200 response alone
- Login form HTML in response
- Generic error messages ("An error occurred")
- Keywords: bypass, injection, vulnerable, leak, sql (in probe output)
- Model assertion ("the payload worked") without demonstrated state change
- Response length >50 chars
- Repeated identical outputs (reproducibility of weak signal ≠ confirmation)

### False-Accept Example
`probe_sqli_bypass` (31 Oct 2026): payload `login.php?username=;--` returned login form HTML.
Verifier passed 4/4 because output contained "bypass" (from probe name) and was >50 chars.
**Fix:** `validateSqliAuthBypass()` requires demonstrated auth-state change.

---

## Cross-Site Scripting (xss_r, xss_s, xss_d)

### Direct Evidence (CONFIRMS)
- **Reflected:** Payload (e.g., `<script>alert(1)</script>`) appears in response UNENCODED and in an executable context (not inside HTML comment, not entity-encoded). Must verify the exact payload string is present verbatim, not just "script" keyword.
- **Stored:** Payload persists across requests — submit payload, then retrieve the page in a fresh request and confirm payload is present unencoded.
- **DOM:** JavaScript execution demonstrated (e.g., via browser automation showing alert/cookie access) — not just payload in DOM.

### Weak Signals (MUST NOT CONFIRM)
- Payload reflected but HTML-entity-encoded (`&lt;script&gt;`)
- Payload in HTML comment (`<!-- <script> -->`)
- Keywords: xss, script, alert, javascript (in probe output)
- HTTP 200 with payload in URL (not in response body)
- Model assertion without verifying encoding/context

### False-Accept Pattern
A probe that echoes "Testing XSS with <script>alert(1)</script>" in its own output would trigger keyword match. The verifier must check the RESPONSE body, not the probe's log output.

---

## Command Injection (exec, cmdi)

### Direct Evidence (CONFIRMS)
- Command output in response (e.g., `uid=33(www-data)` from `id` command, directory listing from `ls`)
- Time-based: `sleep 5` causes measurable delay (≥4s) vs baseline
- DNS callback: payload triggers DNS query to attacker-controlled domain (verified in DNS logs)
- File write: payload creates file, verified by subsequent read

### Weak Signals (MUST NOT CONFIRM)
- Generic error messages ("command not found" in output — this is the ERROR, not the command output)
- Keywords: exec, command, injection, shell (in probe output)
- HTTP 200 alone
- Payload in request without output evidence
- "The command executed" model assertion

### False-Accept Pattern
If the probe command FAILS (e.g., `curl: command not found`), the error text contains the command string. The verifier must check `executionFailed()` first — a failed execution produces NO evidence.

---

## Path Traversal / File Inclusion (fi, lfi, path_traversal)

### Direct Evidence (CONFIRMS)
- File content in response (e.g., `/etc/passwd` content with `root:x:0:0`, or `win.ini` content)
- Content must be NOVEL vs baseline (not just "file" keyword)
- For LFI: PHP code execution or file content, not just "file included" message

### Weak Signals (MUST NOT CONFIRM)
- Error messages ("File not found", "No such file")
- Keywords: traversal, inclusion, file, passwd, etc/passwd (in probe output or URL)
- HTTP 200 with error page
- Payload in URL without file content in response

### False-Accept Pattern
A 404 error page for `/etc/passwd` contains the string "/etc/passwd" — keyword match on the URL, not file content. Must verify ACTUAL file content markers (e.g., `root:x:`).

---

## Server-Side Request Forgery (ssrf)

### Direct Evidence (CONFIRMS)
- Internal service response in output (e.g., AWS metadata `169.254.169.254` returning instance data, internal admin page)
- DNS callback verified (attacker server receives request)
- Port scan differential (open vs closed ports produce different responses/timings)

### Weak Signals (MUST NOT CONFIRM)
- Request sent (without response evidence)
- Keywords: ssrf, metadata, 169.254.169.254 (in probe output, not in response)
- HTTP 200 from the vulnerable endpoint (not from the SSRF target)
- "The SSRF worked" model assertion

### False-Accept Pattern
Probe logs "Testing SSRF to 169.254.169.254" — keyword in probe output, not in response. Must verify the RESPONSE contains internal service data.

---

## IDOR / Broken Access Control (idor, bac)

### Direct Evidence (CONFIRMS)
- Unauthorized data access: User A retrieves User B's data (must show different user IDs, with baseline showing User A cannot access User B's data normally)
- Privilege escalation: Low-priv user accesses admin function (must show admin-only content)
- Differential: Same request with different auth returns different (unauthorized) data

### Weak Signals (MUST NOT CONFIRM)
- HTTP 200 alone (without showing unauthorized data)
- Keywords: idor, access, unauthorized, admin (in probe output)
- Accessing own data (not cross-user)
- Model assertion without user-differential

### False-Accept Pattern
Accessing `/api/user/123` when logged in as user 123 returns 200 with own data — this is NORMAL, not IDOR. Must demonstrate CROSS-USER access.

---

## Authentication / Session (auth, session)

### Direct Evidence (CONFIRMS)
- Brute force: Multiple login attempts with different passwords, one succeeds (must show successful auth, not just "attempts made")
- Session fixation: Session ID in URL is accepted and persists after login
- Weak session: Session IDs are predictable (demonstrate prediction, not just "session" keyword)

### Weak Signals (MUST NOT CONFIRM)
- Login form present (this is normal, not a vulnerability)
- Keywords: auth, session, brute, password (in probe output)
- "Many requests sent" without successful auth

---

## Sensitive Data Exposure (sensitive_data)

### Direct Evidence (CONFIRMS)
- Actual sensitive data in response: API keys, passwords, PII, private keys
- Data must be NOVEL (not in baseline) and actually sensitive (not placeholder/test data)

### Weak Signals (MUST NOT CONFIRM)
- Keywords: password, secret, key, api_key (in probe output or as field names without values)
- Field names without values (`"password": ""`)
- Test/placeholder data (`"api_key": "test123"`)

---

## Implementation Status

- ✅ SQLi auth-bypass: `validateSqliAuthBypass()` implemented + tested
- ✅ Generic weak-signal: `isWeakSignalOnly()` implemented + tested
- ⏳ XSS: Validator to be implemented (Phase 4)
- ⏳ Command injection: Validator to be implemented (Phase 4)
- ⏳ Path traversal: Validator to be implemented (Phase 4)
- ⏳ SSRF: Documented, validator deferred (lower priority)
- ⏳ IDOR: Documented, validator deferred (requires user-differential logic)
- ⏳ Auth/Session: Documented, validator deferred
- ⏳ Sensitive data: Documented, validator deferred

**Priority:** XSS, Command Injection, and Path Traversal are the highest-risk
for false-accepts (all have clear "content in response" vs "keyword in probe"
distinction). Implement these three in Phase 4.
