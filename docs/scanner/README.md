# Dark Matter Rule-Based Scanner — Documentation

No AI. No API spend. Fully predefined, deterministic vulnerability scanning:
paste a link → verified findings on the frontend.

## How it works

```
paste link
  → target intake + scope check      (target.js — user must confirm the target;
                                      every request is scope-checked)
  → recon: crawl + tech fingerprint  (crawl.js, fingerprint.js — same-origin
                                      links/forms/params; server, libs, DB family)
  → probe battery (26 probe modules)  (probes/ — one deterministic check per
                                      class, each with its own proof oracle)
  → Nuclei template battery          (nuclei.js — ~13k verified-check templates
                                      via docker/tools/nuclei/run-nuclei.sh)
  → differential verification        (verifier.js — wraps hunt-intel
                                      assessConfirmation; only CONFIRMED
                                      findings are reported — the 100% truth rule)
  → report                           (confirmed findings → hunts API → frontend)
```

Same target + same code = same result. Every probe runs its own
malicious-vs-benign control; a finding is recorded only when the control
proves the signal comes from the malicious input.

## Vulnerability classes (A-to-Z)

| Page | Class | Probe |
|---|---|---|
| [sqli.md](sqli.md) | SQL injection (error-based) | probes/sqliError.js |
| [xss.md](xss.md) | Reflected XSS | probes/xss.js |
| [cmdi.md](cmdi.md) | OS command injection (time-based) | probes/cmdi.js |
| [traversal.md](traversal.md) | Path traversal / LFI | probes/traversal.js |
| [ssti.md](ssti.md) | Server-side template injection | probes/ssti.js |
| [xxe.md](xxe.md) | XML external entity | probes/xxe.js |
| [ssrf.md](ssrf.md) | Server-side request forgery | probes/ssrf.js |
| [redirect.md](redirect.md) | Open redirect | probes/redirect.js |
| [csrf.md](csrf.md) | Cross-site request forgery | probes/csrf.js |
| [idor.md](idor.md) | Insecure direct object reference | probes/idor.js |
| [headers.md](headers.md) | Security headers + CORS + CSP directives | probes/headers.js |
| [files.md](files.md) | Sensitive file exposure | probes/files.js |
| [stored-xss.md](stored-xss.md) | Stored XSS (two-step oracle) | probes/storedXss.js |
| [weak-creds.md](weak-creds.md) | Weak / default credentials | probes/weakCreds.js |
| [host-header.md](host-header.md) | Host header injection | probes/hostHeader.js |
| [nosqli.md](nosqli.md) | NoSQL injection | probes/nosqli.js |
| [ldapi.md](ldapi.md) | LDAP injection | probes/ldapi.js |
| [xpathi.md](xpathi.md) | XPath injection | probes/xpathi.js |
| [ssi.md](ssi.md) | SSI injection | probes/ssi.js |
| [file-upload.md](file-upload.md) | Unrestricted file upload (lab-gated) | probes/fileUpload.js |
| [cache-poisoning.md](cache-poisoning.md) | Web cache poisoning | probes/cachePoison.js |
| [nuclei.md](nuclei.md) | Nuclei template battery (CVEs etc.) | nuclei.js |

## Honest limits

Covered A-to-Z: known vulnerability classes and known CVEs (thousands of
predefined checks) — none missed. NOT covered: novel 0-days, business-logic
flaws, multi-step chained exploits needing human reasoning, CAPTCHA or
complex-SSO contexts, race-condition and crypto-design bugs. Human triage
stays mandatory before any real bounty submission.
