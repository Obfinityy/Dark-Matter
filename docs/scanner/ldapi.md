# LDAP Injection

## What it is
Apps that authenticate or search against LDAP/Active Directory interpolate
user input into filters like `(uid=<input>)`. Breaking out of the filter
(`*)(uid=*))(|(uid=*`) widens it to match every entry — authentication
bypass and directory dump.

## How the scanner checks it
Per URL parameter (max 10), against a benign baseline:

1. **Boolean:** the breakout payloads `*)(uid=*))(|(uid=*`, `*`,
   `admin)(uid=*` must return a result set diverging >25% (>200 chars).
2. **Error:** LDAP engine text (`LDAP:`, `javax.naming`, `Invalid DN`,
   `LDAPException`) on the breakout, absent on benign.

**Proof oracle:** `evidence.signalCorrelated=true` (boolean variant also
sets `diverged`) → default protocol → **confirmed** (severity **high**).

## Payloads
The three breakout shapes above — no list needed; the filter breakout IS
the test.

## Limits
- Blind LDAP (no output difference, no errors) is not confirmed — the
  oracle requires a visible differential.
- Only URL params today.
