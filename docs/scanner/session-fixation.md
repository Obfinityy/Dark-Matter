# Session Fixation Probe (#44, #262, #473, #474)

`backend/src/scanner/probes/sessionFixation.js`, exported as
`probeSessionFixation(forms, url, opts)` — wired as the `session-fixation`
phase. Owns ONLY the session-identifier lifecycle across authentication
(cookie flags stay in `cookies.js`; brute force in `weakCreds.js`; a
session token merely *appearing* in a URL is a different defect — see
`sessionTokenInUrl.js`, rows #265/#321, CWE-598).

## Method

Login forms are those with a password-type input. Per form (max 2, each
action probed once), with per-run canary `dmsessfix-<runid>` (PHP-valid
charset `[A-Za-z0-9,-]`):

**T1 — No-regeneration on login — MEDIUM** (`session_fixation`): GET the
login page (pre-auth session `S_pre`), POST the canary login with a freshly
re-fetched hidden token, compare the session cookie after login (`S_post`).
`S_pre == S_post` proves the fixation window: anyone who knew the pre-auth
ID shares the authenticated session. No pre-auth ID issued at all → the
rotation question is moot, no finding.

**T2 — Planted-ID adoption — HIGH, LAB-GATED** (`session_fixation`): two
jars, same planted ID. The victim jar plants the canary as its session
cookie, logs in; the server must keep the planted ID through login
(`kept`), and an attacker jar presenting only the planted cookie must
reach an authenticated page. Lab-gated on `isLabTargetHost`
(`opts.labTargets`); without lab targets it stays silent and T1 still
fires. Needs `opts.labCreds`, else the whole probe gracefully skips.

**T3 — Session ID in URL (planted via URL parameter) — MEDIUM, LAB-GATED**
(`session_fixation`, row #473, implemented 14 Nov 2026): same two-jar shape
as T2, but the planted ID travels in the URL (`?PHPSESSID=…`) instead of a
cookie. Confirms ONLY when (a) the victim login keeps the URL-planted ID
as its authenticated session, (b) an attacker jar with NO cookie reaches
an authenticated page carrying ONLY the URL parameter, (c) the same holds
on a repeat with a fresh jar, and (d) a control jar carrying a DIFFERENT
planted ID does not. Bare URL reflection of the planted ID never confirms,
and a server that merely accepts a URL session ID for anonymous requests
(never adopting it through login) stays silent — adoption is the finding.
The parameter name is the server's own session-cookie name (PHPSESSID for
PHP, JSESSIONID for Java, … — the names `sessionTokenInUrl.js`
recognises); PHPSESSID is the fallback when the login page issues no
session cookie at all. T3 plants its own canary, distinct from T2's, so
its proof never rides T2's adoption. Runs in standard/deep depth only
(like T4); quick depth skips it. Before 14 Nov 2026, T3 was a documented
ride on the T1 oracle — no URL-parameter leg existed.

**T4 — Logout does not invalidate (cookie) — MEDIUM** (`session_fixation`,
row #474, CWE-613): canary login, then logout via the common logout paths;
replay the old session cookie against the pasted page (following
redirects — never the login page's bare 302 body). Still authenticated →
the server never invalidated the session server-side.

**T4b — Logout does not invalidate (bearer) — MEDIUM** (`session_fixation`,
row #474): the API/SPA twin of T4. Runs ONLY when no HTML login form
exists and `opts.labCreds` are present; login + check endpoints come from
the already-discovered route set (`opts.apiRoutes`). Confirms on a content
anchor (the replay names the canary account and the anchor is absent from
the no-token body) or on status divergence (401/403 without a token vs
200 with the old one). A bare 200 both ways never fires (the whoami dead
oracle).

## Safety

Only our canary credentials/sessions; ≤5 logins per surface; T2/T3
lab-only. T4b additionally needs `opts.apiRoutes` — no login candidate or
no check endpoint means an honest `[]` (never fires on the SPA-root HTML
alone). $0, no new deps.

## Honest limits

- A server that rotates the session on login defeats planting by
  construction (T2/T3 stay silent; T1 is the finding there).
- A pure-URL-session app whose login flow never propagates the URL
  parameter (no URL rewriting on the login form action) fails T3 closed —
  the chain cannot be proven without the parameter surviving login.
- T3 tries one parameter name only: the server's own session-cookie
  name, else PHPSESSID.
