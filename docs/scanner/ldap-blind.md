# LDAP boolean-blind probe (`ldap-blind`, coverage row #32)

`backend/src/scanner/probes/ldapBlind.js` — POST-based login-oracle probe.

## How it works

- **T1 — boolean oracle inventory.** Posts a wrong-user baseline, then four
  wildcard payloads (`*`, `admin*`, `zzz<rand>*`, `*)(uid=*`) to the login
  form's username parameter. Each response is reduced to a *triple*
  (`status-class : outcome-signal : length-bucket`) and the matrix is judged
  for filter-logic consistency: a true wildcard should move the outcome, the
  nonsense wildcard `zzz*` should not.
- **T2 — boolean-blind extraction (Standard/Deep only).** Char-by-char
  extraction of the scanner's OWN canary record (`opts.ldapCanary`), with a
  false control per guess. CONFIRMED only if >= 3 extracted chars match the
  KNOWN canary value — never touches another user's data.

## Firing rule (T1)

A finding (`LDAP injection — boolean oracle detected`, Medium, class
`ldap_injection`) is filed only when ALL of these hold:

1. `star` and/or `paren` move the outcome vs the wrong-user baseline
   (at least 2 of the 3 consistency checks pass), AND
2. the nonsense-wildcard control `zzz*` STAYS at the baseline — a REQUIRED
   veto, not a vote. If `zzz*` moves the outcome, the oracle is not
   LDAP-specific (any `*` in the input changes the response) and no finding
   is filed.

## Signal hygiene (token-noise guard, 7 Nov 2026)

The outcome signal is read from **visible text only** (`visibleText`
strips markup, so hidden-input values, nonces and other attribute noise can
never flip the signal). The length bucket still uses the raw body length.

Why: DVWA login.php embeds a per-request random 32-hex-char CSRF token
(hidden `user_token`). The old whole-body keyword match saw the deny keyword
"bad" — which is hex-compatible — inside a baseline token, flipping the
baseline to `deny` while the probe tokens read `other`: a spurious 2/3 fire
(hunt `h_fb007db4d145`) on a page with no LDAP backend. A re-run DVWA hunt
(`h_344d3e9047b6`) on the same build finished `{12,0}` with no LDAP finding,
confirming the false positive. DVWA baseline stays 12.

## Honest limits

- LDAP has NO `SLEEP()`/benchmark primitive — time-based blind LDAP is not a
  reliable class. Any delay must reproduce under a control filter before being
  cited; otherwise it is a documented skip, never a finding.
- The sibling probe `ldapi.js` (error-based wildcards) is NOT affected by the
  token-noise mechanism: every `LDAP_ERRORS` keyword contains non-hex
  characters, so a hex token cannot match it, and its boolean leg is
  length-based (a fixed-length token creates no delta). Checked 7 Nov 2026.
- T2 needs a canary (`opts.ldapCanary`); without one it is skipped gracefully.
