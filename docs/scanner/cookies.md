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

## Scope leg (14 Nov 2026, row #260)
The same pass also parses `Domain=` / `Path=` and flags a cookie whose
`Domain` is a **parent of the target host** (e.g. `Domain=.example.com`
on `app.example.com`) — class `cookie_scope`, **medium** for
session-like names, **low** otherwise. A `Domain` equal to the host, or
a foreign `Domain` that is not a suffix of the host, never flags.
`Path=/` alone is **not** a finding: it is the near-universal default
for session cookies, and flagging it would fire on essentially every
site — the discriminating signal for overly broad scope is the parent
`Domain`.

## Payloads
None — pure response-header analysis.

## Limits
- Cannot know which cookies are truly session-critical; the name heuristic
  (`sess|auth|token|sid`) decides severity.
- `__Host-`/`__Secure-` prefix enforcement is not checked yet.
