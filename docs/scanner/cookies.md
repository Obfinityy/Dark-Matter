# Cookie Security Flags

## What it is
Cookies carry sessions and tokens. Three flags protect them:
- **Secure** — only sent over HTTPS (blocks network sniffing).
- **HttpOnly** — invisible to JavaScript (blocks theft via XSS).
- **SameSite** — controls cross-site sending (blocks CSRF).

## How the scanner checks it
Reads every `Set-Cookie` from the target's response and parses the flags.

**Proof oracle:** a cookie missing any flag is reported.
- Session-like names (`sess*`, `auth*`, `token*`, `sid*`) → **medium**.
- Other cookies → **low**.
- `SameSite=None` without `Secure` is flagged (browsers reject it).

## Payloads
None — pure response-header analysis.

## Limits
- Cannot know which cookies are truly session-critical; the name heuristic
  (`sess|auth|token|sid`) decides severity.
- `__Host-`/`__Secure-` prefix enforcement is not checked yet.
