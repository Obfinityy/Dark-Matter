# Weak / Default Credentials

## What it is
Login forms that accept factory defaults (`admin/admin`,
`admin/password`, …). Still one of the most common real-world findings —
and fully checkable without any AI.

## How the scanner checks it
1. **Find login forms** heuristically: a password-like input name plus a
   user-like name, or an action URL containing login/signin/auth. Non-login
   forms are never touched (zero requests).
2. **Baseline:** log in as `admin` with a random wrong password. The
   response must show NO authenticated state — otherwise the oracle is
   unusable and the form is skipped.
3. **Attempts:** try the tiny default list (`admin/admin`,
   `admin/password`, `msfadmin/msfadmin`, `guest/guest`, `root/root`) with
   **≤1 attempt / 2s** rate limiting. Hidden fields (CSRF tokens) are read
   from the live form page so the POST is shaped like the real one.
4. **Success oracle (differential vs baseline):** the response shows a
   logout link / welcome text the baseline lacks, a new session cookie is
   set, or the redirect target differs from the baseline's.

**Proof oracle:** authenticated state with defaults, none with wrong
password → `evidence.signalCorrelated=true` → **confirmed** (severity
**high**). One confirmed pair per form is enough — the probe stops there.

## Payloads
The 5-pair default list above. This is a factory-default smoke check, NOT
a brute-force — password spraying and credential stuffing stay out of the
rule-based scanner by design.

## Limits
- Logins needing CAPTCHA, MFA or multi-step flows are not attempted.
- CSRF-token logins work only when the token is a plain hidden field.
- Authorized targets only; 5 attempts max per form.
