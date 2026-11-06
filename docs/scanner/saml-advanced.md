# SAML Advanced Attacks — XSW, XXE, Issuer Confusion

Extends `docs/scanner/saml.md`. Covers spreadsheet rows **#67 / #441** (XSW),
**#443** (XXE in SAML parsing), **#445** (IdP metadata spoofing / issuer
confusion). Implemented in `backend/src/scanner/probes/saml.js`, inside the
existing `probeSaml(url, opts)` (depth-aware), wired as phase `saml` in
`index.js`. Every verdict sits behind a differential oracle per the 100% truth
rule: a control request must fail exactly where the attack must succeed.

Defensive framing: this probe is a *detection* tool. All identities are
per-run canaries (`DarkMatterProbe-*`); it never forges a real IdP session,
never touches a live IdP, never follows redirects, and never exfiltrates
real files.

## 1. XML Signature Wrapping — XSW (#67, #441) [Critical]

### What it is
The SP cryptographically validates an XML signature over **one** element of
the SAML Response but then consumes a **different**, attacker-controlled
element as the authenticated identity. Classic shapes: duplicate assertions
(signed decoy + unsigned malicious assertion in one Response) and
ID-confusion (the signature's `Reference URI` resolves to a different node
than the one whose `NameID` is trusted). Outcome: account takeover without
the IdP's key.

### How the probe tests it
1. **Gate:** XSW tests run only when T1's unsigned assertion was **rejected**.
   If the ACS accepts unsigned assertions outright, wrapping is moot — the
   tests are skipped (with this comment in code), because there is nothing
   to wrap around.
2. **Key minting:** the probe generates a throwaway 2048-bit RSA keypair via
   `node:crypto` (per run). It never claims to hold the real IdP's key.
3. **Payload** (`buildXswResponse`): a `Response` containing
   - **Assertion-1** (dummy identity) carrying an enveloped RSA-SHA256
     `ds:Signature` whose `Reference URI` points at assertion-1's own ID.
     The digest is SHA-256 over assertion-1's exact bytes, emitted in
     near-canonical form (attributes lexicographically sorted, empty
     elements self-closed, namespaces declared on the apex, no whitespace
     text nodes) so the digest matches what an inclusive-C14N validator
     hashes over the same node.
   - **Assertion-2** (our canary `NameID`), completely **unsigned**.
   - Two POSTs: signed-decoy-last (catches last-assertion consumers) and
     signed-decoy-first (catches first-assertion consumers). In both, the
     signature's Reference URI binds the dummy assertion while the canary
     rides in the other one — the ID-confusion variant.
4. **Differential oracle:** control = a fresh single *unsigned* assertion for
   the same canary (must be rejected); attack = the wrapped pair. CONFIRMED
   (`saml_xsw`, critical) **only if** the attack grants a session for the
   **canary** `NameID` while the control did not.

### Honest limits
- We cannot know the IdP's real key, so this does not test "forging the
  IdP's signature". It tests **reference binding + trust validation** —
  which is exactly the XSW bug class (Duo 2018, XSW1 family).
- A fully standards-compliant validator that correctly binds
  signature→consumed-assertion rejects our payload; the probe then reports
  nothing. That is the correct negative.
- XSW tests are skipped at `depth: 'quick'` (each variant is one POST, but
  RSA key generation costs ~100–200 ms per run).

## 2. XXE in SAML parsing (#443) [High]

### What it is
The ACS parses attacker-controlled XML. If its parser resolves entities,
internal-entity expansion (and worse, external entities / file disclosure)
is possible through the SSO callback.

### How the probe tests it
- **(a) Internal entity expansion** (`saml_xxe_entities`, info): an unsigned
  assertion carrying `<!DOCTYPE samlp:Response [<!ENTITY dmxxe "DMXXE-<canary>">]>`
  with `NameID` = `&dmxxe;`. If the response body reflects the **expanded**
  value (not the literal `&dmxxe;`), the parser processes entities → the
  endpoint is XXE-capable. Oracle is strict: only the expanded canary
  counts.
- **(b) OOB external parameter entity** (`saml_xxe_oob`, high when confirmed;
  `saml_xxe_oob_sent`, info when only dispatched): sends
  `<!ENTITY % dmxxe SYSTEM "<canary-url>"> %dmxxe;` pointing at a canary URL.
  This variant runs **only** when `opts.oobCallback` is set **and** the host
  matches `opts.labTargets` (same `/[,\s]+/` split + host-includes pattern as
  `index.js`'s `allowWrite` gate). It never targets real files — canary URLs
  only. Confirmation is out-of-band via the collaborator
  (`backend/src/scanner/oobCollaborator.js`, 6 Nov 2026): `runScan` starts an
  in-process HTTP listener for the duration of the `saml` phase on lab-gated
  targets (callback host defaults to the docker bridge gateway `172.17.0.1`,
  overridable via `opts.oobCallbackHost` / `DM_OOB_CALLBACK_HOST`) and passes
  its base URL + a waiter into the probe. A callback hit for the probe's
  token CONFIRMS blind XXE in-scan — the finding carries `oobHit: true` in
  evidence, judged under the SSRF/OOB protocol. No hit → no finding (100%
  truth rule). When only a bare `oobCallback` string is passed (no waiter),
  the probe keeps the old `saml_xxe_oob_sent` info record instead.

### Honest limits
- `backend/src/scanner/probes/xxe.js` currently has **no collaborator/OOB
  infrastructure** of its own (the shared collaborator module exists, but
  xxe.js does not use it yet) — so the generic XXE probe still has no OOB
  variant. Variant (a) alone still proves entity processing, which is the
  necessary precondition for XXE.
- Severity for (a) is `info`, not higher: expansion alone is evidence of an
  entity-processing parser, not yet of file disclosure. It is the gateway
  signal, meant to trigger manual follow-up.

## 3. IdP metadata spoofing / issuer confusion (#445) [High]

### 3a. Metadata integrity (`saml_metadata_unsigned`, low)
If SP metadata was discovered (`discoverSamlMetadata`), the probe checks two
spoofability signals: metadata served over **plain HTTP** (MITM-substitutable)
and a missing **`validUntil`** attribute (unbounded trust). Either (or both)
emits the low-severity finding noting the metadata is spoofable; HTTPS +
`validUntil`-bounded metadata emits nothing.

### 3b. Issuer-confusion differential (`saml_issuer_spoof`, high)
- **Gate:** runs only when unsigned assertions are **rejected** (if unsigned
  is accepted, issuer string trust is irrelevant — T1 already fired).
- **Requires** a discovered SP `entityID` from metadata (the "trusted"
  issuer string to spoof).
- **Differential:** two unsigned assertions with fresh canaries — one with
  `Issuer` = the SP's entityID from metadata (spoofed trusted issuer), one
  with a random issuer. CONFIRMED **only if** the spoofed-issuer one grants
  a session while the random-issuer one is rejected. Both rejected = correct
  behavior, no finding.

### Honest limits
- The "trusted issuer" is approximated by the SP's own entityID from
  metadata — a confused-deputy variant. A deployment whose real trust anchor
  is a separate IdP entityID is tested against the same principle (unsigned
  + trusted-looking string), but the exact trusted string is whatever the
  metadata exposes.
- Without discovered metadata, 3b is skipped (no trusted string to spoof).

## Payload shapes (summary)

| Test | Finding class | Severity | Requests | Gate |
|---|---|---|---|---|
| XSW wrap (×2 orders) | `saml_xsw` | critical | 1 control + ≤2 attacks | unsigned rejected, depth ≠ quick |
| XXE internal entity | `saml_xxe_entities` | info | 1 | depth ≠ quick |
| XXE OOB param entity | `saml_xxe_oob` (confirmed) / `saml_xxe_oob_sent` (dispatched only) | high / info | 1 + ≤8s callback wait | `opts.oobCallback` + lab-gated host; waiter → confirmed on hit |
| Metadata integrity | `saml_metadata_unsigned` | low | 0 (reuse discovery) | metadata found |
| Issuer confusion | `saml_issuer_spoof` | high | 2 | unsigned rejected + entityID known, depth ≠ quick |

All findings carry `parameter`, `url`, and `evidence: {request, response,
impact_demo, signalCorrelated: true}` per the probe contract. Redirects are
never followed (`redirect: 'manual'`); UA is
`DarkMatter-Scanner/1.0 (+authorized-scan)`.
