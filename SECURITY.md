# Security Policy

## Supported versions

Only the code on `main` is supported. There are no versioned releases yet — if you are reading this from a fork or an old checkout, update to `main` first and re-check whether the issue still reproduces.

## Reporting a vulnerability

This is a security-testing product, so please report vulnerabilities **in Dark Matter itself** (the operator UI, the backend API, authentication, access control, payment handling) through the channel below. Do **not** use this channel to report vulnerabilities the product found in a third-party target — those go through the product's normal report flow to the operator.

**Preferred channel: GitHub private vulnerability reporting.**

1. Go to the repository's **Security** tab.
2. Click **Report a vulnerability**.
3. Describe the issue: what you found, where (file/route/version), and how to reproduce it. Include impact, but do not include a full working exploit if a short description is enough.

A private report lets us fix the issue before it becomes public. We will acknowledge receipt, keep you updated while we fix it, and credit you in the fix (unless you prefer to stay anonymous).

**If private vulnerability reporting is unavailable** (it is not yet enabled on this repository), open an issue titled `[SECURITY]` with a high-level description only — do not post exploit code, target details, or credentials publicly. The maintainers will move the report to a private channel.

**Do not:**

- Test against the live site (`hackwithai.xyz`) or the live API with real attacks. Reproduce locally from a checkout instead.
- Hunt unauthorized targets "to demonstrate" an issue. Lab targets only.
- Disclose a vulnerability publicly before it is fixed.

## Scope

In scope: the frontend app, the backend API (`/api/v1/*`), authentication and authorization, payment claim handling, and the hunt-engine sandbox boundary (a finding that escapes the per-hunt container is in scope and high severity).

Out of scope: vulnerabilities in third-party targets found by the product, social engineering, and issues that require physical access to the operator's machines.

## Secrets and credentials

If you find a leaked credential (API key, token, private key) in the repository or its history, report it the same way — do not use it, and do not post it publicly. The affected credential will be rotated.
