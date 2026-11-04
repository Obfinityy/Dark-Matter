# SAML 2.0 ACS Probe

## What it is

SAML 2.0 SSO: the browser POSTs a signed `SAMLResponse` (XML) to the app's
Assertion Consumer Service (ACS) endpoint. The app must verify the XML
signature and enforce the conditions. Every failure is server-side config and
testable with PREDEFINED crafted assertions — no AI, no victim browser:

- **XML Signature Wrapping (XSW):** signature validates a detached element
  while the app consumes a DIFFERENT (attacker-modified) element — signature
  OK, assertion rewritten. Classic account-takeover primitive.
- **XXE in the SAML parser:** the response is XML — if the parser expands
  external entities, classic XXE exfil happens through the ACS.
- **Missing/ignored signature enforcement:** some ACS implementations accept
  UNSIGNED assertions (signature element absent, response still accepted).
- **Conditions abuse:** `NotOnOrAfter` / `Audience` not enforced — expired or
  wrong-audience assertions accepted (replay / cross-app).
- **Redirect/relay-state validation:** `RelayState` reflected into a 302
  Location without validation = open redirect on the ACS callback.

The scanner is NOT a SAML IdP and never claims to be the user's IdP: every
test crafts responses with per-run canary NameIDs (`DarkMatterProbe-<canary>`)
precisely to prove the ACS verifies trust — a genuine trust anchor MUST
reject all of them.

## Detection surface

1. **Metadata discovery**: GET `/saml/metadata`, `/metadata/saml`,
   `/.well-known/saml-metadata` → XML with `AssertionConsumerService`
   `Location` (INFO finding: endpoint enumeration).
2. **Known ACS paths** (max 5): `/saml/acs`, `/sso/acs`, `/saml2/acs`,
   `/Shibboleth.sso/SAML2/POST`, `/acs` — a canary POST that answers anything
   but 404/405 silence = live endpoint.
3. **Passive bundle scan**: `SAMLResponse`, `SAMLRequest`, `/saml/acs`,
   `Shibboleth.sso`, `RelayState`, `urn:oasis:names:tc:SAML`.

**Safety:** per-run canary NameIDs; ACS POSTs only; never submit assertions
for a REAL user account; never replay an assertion captured from a live
login. Redirects never followed. Read-only by construction.

## Sub-tests

### T1. Unsigned SAMLResponse accepted — CRITICAL (differential)

Build a well-formed `SAMLResponse` (deflate+base64) with NO signature
element, NameID = our canary, Audience = the discovered SP entityID.
- **ORACLE** (kills generic 200s): CONFIRMED CRITICAL ("ACS accepts unsigned
  SAMLResponse — authentication bypass") ONLY if the response grants a
  session for the canary NameID (session-like Set-Cookie, or the canary
  rendered in body/Location).
- **Differential control:** the same payload with a GARBLED audience is
  POSTed too — if BOTH "succeed", the endpoint isn't actually processing
  assertions (static success page): NOT confirmed, downgraded to INFO.
- **Reference:** XSW1 family, Duo "SAML Authentication Bypass" 2018.

### T2. XML Signature Wrapping — PENDING (v1 honest limit)

A true XSW test needs a cryptographically VALID enveloped XML-DSig signature
over the wrapped structure, which requires XML canonicalization (C14N) —
not implemented in v1. A syntactically-present-but-invalid signature would
only re-test "signature not validated" (T1 territory), not wrapping. Marked
pending, not silently skipped.

### T3. XXE via the SAML envelope — PENDING (v1 honest limit)

Needs an out-of-band listener for the differential oracle (same standard as
`xxe.js`). Not attempted without one — documented skip, not a silent pass.

### T4. Conditions enforcement — MEDIUM (only when T1 confirmed)

- **Expired assertion:** `NotOnOrAfter` = now − 10 min, POSTed twice.
  CONFIRMED MEDIUM ("ACS accepts expired SAML assertion — replay exposure")
  only if BOTH posts grant an identical session for the canary.
- **Wrong audience:** `Audience` = `https://evil.example/` — accepted =
  MEDIUM ("audience restriction not enforced").
- Runs only when T1 proved unsigned assertions are processed; otherwise the
  conditions surface isn't testable without real signing.

### T5. RelayState open redirect — LOW / MEDIUM

POST with `RelayState=https://evil.example/<canary>`; read the 302 Location,
do NOT follow.
- **ORACLE:** CONFIRMED only if Location points at evil.example AND echoes
  the canary. MEDIUM if the redirect carries session material
  (`token=`/`session=`/`code=` in query/fragment), LOW otherwise.
- Reuses the `redirect.js` canary-in-Location oracle.

## Depth gating

- **Quick:** metadata discovery + T1 + T5.
- **Standard / Deep:** full battery (T1, T4 when applicable, T5).

## Wiring

`probeSaml(url, opts)` — exported from `backend/src/scanner/probes/saml.js`,
wired into `backend/src/scanner/index.js` (`'saml'` in DEFAULT_PHASES, step
after `oauth`, before `nuclei`). Scan-time budget: ~14 POSTs per ACS
endpoint, each <1s — seconds-scale, $0 AI.

## v1 limits (documented, not silently skipped)

- T2 XSW: needs real XML-DSig/C14N — pending.
- T3 XXE-OOB: needs a listener — pending.
- Forging IdP trust (always our own canary key/identities), tampering a live
  IdP session, IdP-initiated flows needing a real IdP account,
  XML-encryption attacks (need the SP's private key).
