# Dark-Matter IDEAS — Batch 12: Deeper Surfaces (101005–102004)

> 1,000 ideas 101005–102004, generated 2026-10-03.
> Professional English. Defensive/product framing.

Batch 12 goes deeper into the surfaces that sit beside the classic web-app hunt:
crypto & PKI, identity federation, browser internals, serverless runtimes,
AI-powered targets, privacy & consent, messaging channels, secret lifecycles,
third-party embeds, and the network/DNS layer underneath it all.

| # | Category | Ideas |
|---|----------|-------|
| 1 | Cryptographic hygiene & PKI hunting | 101005–101104 |
| 2 | Identity federation & passwordless testing | 101105–101204 |
| 3 | Client-side internals & browser-API testing | 101205–101304 |
| 4 | Serverless & edge runtime security | 101305–101404 |
| 5 | LLM-powered target security testing | 101405–101504 |
| 6 | Data privacy & consent verification | 101505–101604 |
| 7 | Email & notification channel security | 101605–101704 |
| 8 | Secrets & credential lifecycle management | 101705–101804 |
| 9 | Third-party embed & tag-manager risk | 101805–101904 |
| 10 | Network-protocol & DNS-layer surfaces | 101905–102004 |

101005. **Legacy TLS version floor enforcer** — probes every TLS endpoint for acceptance of TLS 1.0 and 1.1 so deprecated protocol versions can be disabled before attackers force a downgrade to them.
101006. **SSLv2 and SSLv3 residual detector** — attempts handshakes with ancient SSL protocol versions to confirm they are fully disabled, since any residual support re-opens DROWN-class attacks.
101007. **TLS fallback SCSV verifier** — checks that servers honor the fallback signaling cipher suite value, proving clients cannot be silently downgraded through protocol-confusion tricks.
101008. **Secure renegotiation indicator checker** — verifies RFC 5746 secure-renegotiation support on every endpoint so the legacy plaintext-injection renegotiation flaw stays permanently closed.
101009. **Extended master secret adoption mapper** — tests for RFC 7627 extended-master-secret support to confirm triple-handshake attack mitigations are actually deployed in the fleet.
101010. **TLS 1.3-only mode validator** — confirms high-security endpoints accept only TLS 1.3, eliminating entire classes of legacy-protocol vulnerabilities by construction rather than patching.
101011. **ALPN negotiation consistency auditor** — compares advertised ALPN protocols against actually negotiated values to expose misconfigurations that break HTTP/2 and gRPC security assumptions.
101012. **SNI routing consistency checker** — sends mismatched SNI and Host headers to verify the server returns the certificate matching the requested name instead of a default that leaks other tenants.
101013. **Encrypted Client Hello readiness mapper** — detects ECH support across endpoints to measure how much SNI metadata currently leaks to passive network observers.
101014. **STARTTLS stripping posture assessor** — tests SMTP, IMAP, and FTP endpoints for STARTTLS support and downgrade resistance so opportunistic encryption cannot be silently removed in transit.
101015. **Weak cipher suite enumerator** — completes full handshakes with every offered cipher suite to catalog 3DES, RC4, DES, and export-grade ciphers that must be removed from configuration.
101016. **NULL and anonymous cipher probe** — attempts handshakes with NULL-encryption and anonymous-DH suites to prove no endpoint will ever negotiate an unauthenticated or unencrypted session.
101017. **Static RSA key-exchange deprecation scanner** — flags static-RSA cipher suites that lack forward secrecy, since one stolen private key would decrypt all historically captured traffic.
101018. **Forward secrecy coverage checker** — measures the share of negotiated sessions using ECDHE or DHE so operators can confirm past traffic stays safe even after a key compromise.
101019. **Logjam weak-DH parameter prober** — offers export-grade DHE parameters to detect servers still using 512-bit or 1024-bit groups that precomputation attacks can break.
101020. **Custom Diffie-Hellman group auditor** — inspects server-provided DH parameters for safe-prime construction and sufficient size to rule out precomputation and small-subgroup attacks.
101021. **Elliptic curve selection reviewer** — inventories negotiated curves to confirm only modern choices such as X25519 and P-256 are offered and weak legacy curves are gone.
101022. **Server cipher-preference enforcement verifier** — tests whether the server's suite order actually wins over the client's, preventing weak-client negotiation from dictating session security.
101023. **GCM versus CBC mode inventory** — maps which endpoints still negotiate CBC-mode suites so padding-oracle risk can be retired in favor of authenticated encryption everywhere.
101024. **TLS compression disabled verifier** — confirms compression is switched off on every handshake, closing the CRIME attack that leaks secrets through compressed ciphertext size.
101025. **Heartbleed residual probe** — sends a malformed heartbeat request and verifies the server rejects it or runs a patched build, catching forgotten legacy services still exposed.
101026. **ROBOT oracle detector** — crafts PKCS#1 v1.5 padding variations to confirm RSA-decryption oracles are closed and servers fail closed on malformed ciphertext.
101027. **Bleichenbacher oracle posture tester** — measures timing and error uniformity across RSA key-exchange attempts to prove no padding oracle leaks key material.
101028. **POODLE downgrade verifier** — checks that CBC-mode SSLv3 fallback paths are unreachable so padding-oracle downgrades cannot be forced by an active attacker.
101029. **FREAK export-RSA residual checker** — offers export RSA suites to prove no endpoint will negotiate deliberately weakened 512-bit RSA keys under downgrade pressure.
101030. **SWEET32 session-volume assessor** — estimates how much data 64-bit-block ciphers would encrypt per session to show exactly where 3DES must be removed before birthday-bound collisions.
101031. **Lucky13 timing-side-channel reviewer** — audits CBC-mode TLS 1.2 handling for constant-time decryption behavior that defeats Lucky13-style timing attacks.
101032. **Ticketbleed session-ticket checker** — inspects session-ticket handling to confirm tickets cannot leak server memory contents back to clients.
101033. **Session-ticket key rotation monitor** — tracks how often servers rotate ticket-encryption keys, since stale keys let previously captured sessions be decrypted retroactively.
101034. **Triple-handshake mitigation reviewer** — verifies extended-master-secret and secure-renegotiation mitigations jointly so session-resumption confusion attacks stay impossible.
101035. **Certificate expiry horizon scanner** — inventories every in-scope certificate's notAfter date and ranks them by days remaining so renewals happen before outages or browser distrust.
101036. **Renewal automation failure predictor** — correlates ACME history, automation age, and past near-misses to flag certificates likely to expire despite auto-renewal tooling being in place.
101037. **Shadow-IT certificate discovery engine** — mines Certificate Transparency logs for the organization's domains to find certificates that nobody in IT knows exist.
101038. **Staging-versus-production certificate mix-up detector** — compares served certificates against expected production issuers to catch test certificates leaked into production traffic.
101039. **Self-signed certificate identifier** — flags any self-signed certificate on internet-facing endpoints, since they train users to click through warnings and camouflage real attacks.
101040. **Expired-certificate residual scanner** — sweeps forgotten subdomains, legacy APIs, and internal services for certificates already past expiry that break clients silently.
101041. **Short-lived certificate operations readiness checker** — verifies ACME automation can sustain 90-day or shorter lifetimes across the fleet without manual intervention.
101042. **Maximum validity lifetime compliance checker** — validates that no public certificate exceeds the industry maximum validity period so renewals stay on the mandated cadence.
101043. **Certificate expiry alerting SLA designer** — builds 60/30/14/7-day alert thresholds per certificate criticality so renewals never depend on a single calendar reminder.
101044. **Mobile-backend certificate expiry sentinel** — monitors certificates behind mobile APIs separately, since an expired certificate there bricks every installed app version at once.
101045. **Incomplete certificate chain detector** — verifies every endpoint serves its full intermediate chain so mobile and strict clients do not fail validation that desktop browsers forgive.
101046. **Cross-signed certificate ambiguity resolver** — maps cross-signed paths to confirm clients converge on one valid chain instead of failing on an expired alternate path.
101047. **Name-constraints enforcement verifier** — tests subordinate CAs for name-constraints compliance so a constrained intermediate cannot issue outside its permitted namespace.
101048. **Key-usage and extended-key-usage sanity checker** — audits certificates for correct keyUsage and EKU flags so a server-authentication certificate can never sign code or other certificates.
101049. **CA compromise blast-radius estimator** — models which in-scope certificates chain to each CA so incident response knows exactly what to distrust if a CA is compromised.
101050. **Private-PKI trust boundary auditor** — inventories internally issued certificates and confirms they never appear in public trust paths where they could enable interception.
101051. **Mutual-TLS client certificate posture reviewer** — checks mTLS endpoints for proper client-certificate verification, expiry handling, and revocation so service identity stays enforced.
101052. **mTLS certificate expiry cascade predictor** — models client and server certificate expiries together to predict the outage that follows when one side of mutual TLS rotates late.
101053. **Baseline-requirements certificate linting engine** — runs CA/Browser Forum lint checks over every certificate to catch mis-issuance before browsers distrust it in the field.
101054. **Root-store inclusion readiness verifier** — confirms chains terminate in roots present in the major browser and OS trust stores so no client segment silently fails validation.
101055. **Rogue-issuance CT watcher** — streams Certificate Transparency logs for the organization's domains and alerts within minutes when an unknown CA issues a certificate.
101056. **Precertificate versus leaf mismatch detector** — compares logged precertificates with served leaf certificates to catch issuance that never completed proper logging.
101057. **SCT delivery completeness checker** — verifies every served certificate carries valid Signed Certificate Timestamps via TLS extension, OCSP stapling, or embedded SCTs.
101058. **CT-driven subdomain takeover mapper** — correlates CT-discovered subdomains with dangling DNS records to find takeover targets before attackers claim them.
101059. **Internal hostname leakage reviewer** — scans public CT logs for certificates exposing internal hostnames, staging names, or codenames that aid targeted attacks.
101060. **Multi-perspective issuance validation awareness checker** — verifies CAs perform validation from multiple network vantage points so BGP-hijack issuance attacks fail.
101061. **CT log disqualification watcher** — monitors log-operator status changes so certificates relying on a disqualified log get re-logged before browsers reject them.
101062. **DNS CAA record coverage verifier** — checks CAA records on every domain to confirm only authorized CAs may issue, shrinking the rogue-issuance surface.
101063. **CAA iodef contact liveness verifier** — tests that CAA iodef reporting contacts actually receive violation reports so unauthorized issuance attempts do not go unnoticed.
101064. **Unauthorized-CA issuance alert correlator** — joins CT sightings with CAA policy to raise high-severity alerts only when issuance violates the declared CA allowlist.
101065. **OCSP stapling deployment verifier** — confirms servers staple fresh OCSP responses so clients get revocation status without privacy-leaking direct OCSP fetches.
101066. **OCSP Must-Staple extension adoption checker** — audits certificates for the Must-Staple flag to prove revocation checks cannot be silently skipped by stripping staples.
101067. **OCSP responder reachability monitor** — continuously probes CA OCSP responders so an outage is known before clients start soft-failing revocation checks.
101068. **CRL freshness and staleness checker** — downloads published CRLs and verifies thisUpdate and nextUpdate windows so revocation data never goes silently stale.
101069. **Fail-open versus fail-closed revocation policy reviewer** — documents each client's revocation-checking behavior to expose where a blocked OCSP responder means quietly accepting revoked certificates.
101070. **Revocation propagation latency measurer** — times how long a test revocation takes to appear in OCSP and CRL outputs so incident response knows the real distrust window.
101071. **Long-lived revocation cache risk assessor** — estimates client-side OCSP and CRL caching durations to show how long a compromised certificate stays trusted after revocation.
101072. **OCSP nonce behavior auditor** — checks whether responders honor nonces correctly so replayed stale "good" responses cannot mask a genuine revocation.
101073. **Delegated OCSP responder certificate validator** — verifies delegated responder certificates carry the correct EKU and limited scope so a responder cannot sign arbitrary certificates.
101074. **Aggregated-revocation readiness checker** — assesses whether clients support compressed revocation sets such as CRLite so revocation actually scales to the full certificate population.
101075. **HSTS preload-list membership verifier** — confirms critical domains are submitted to the browser HSTS preload list so the very first visit is already HTTPS-only.
101076. **HSTS includeSubDomains consistency checker** — verifies the includeSubDomains directive is set everywhere so attackers cannot peel off an unprotected subdomain.
101077. **HSTS max-age sufficiency auditor** — checks that max-age values meet preload requirements of a year or more instead of short windows that expire between visits.
101078. **First-hop redirect chain integrity checker** — follows the initial HTTP-to-HTTPS redirect to prove no plaintext hop can be intercepted before HSTS engages.
101079. **HTTPS upgrade header auditor** — verifies Upgrade-Insecure-Requests and related headers are sent so browsers rewrite legacy HTTP subresource requests automatically.
101080. **Mixed active-content scanner** — crawls pages served over HTTPS to find scripts, iframes, and XHR calls still loaded over plaintext HTTP that attackers can replace.
101081. **Mixed passive-content inventory** — catalogs images and media loaded over HTTP so operators can quantify remaining mixed-content exposure even where browsers only warn.
101082. **Expect-CT legacy posture reviewer** — audits Expect-CT deployment status to confirm the transition to mandatory SCT enforcement left no coverage gaps.
101083. **Subdomain HSTS coverage mapper** — enumerates all discovered subdomains and reports which ones lack HSTS headers, since one uncovered host undermines the whole policy.
101084. **Preload-ready submission validator** — dry-runs a domain against preload-list requirements of valid certificate, HTTPS redirects, and apex HSTS before the real submission.
101085. **Private-key exposure hunter** — scans public repositories, pastes, and adjacent public sources for leaked PEM private keys tied to in-scope domains.
101086. **Key-reuse across domains detector** — compares public-key moduli across the organization's certificates to find one private key shared by many hosts, multiplying compromise blast radius.
101087. **ROCA vulnerable-key detector** — tests RSA public keys for the Infineon prime-generation flaw so affected hardware-generated keys are replaced before factorization.
101088. **Debian weak-key legacy scanner** — checks keys against the 2008 Debian OpenSSL predictable-RNG blocklist to catch ancient vulnerable keys still in service.
101089. **Duplicate serial-number issuance detector** — flags certificates sharing serial numbers, since uniqueness violations break revocation targeting and indicate CA process failure.
101090. **Serial-number entropy checker** — measures serial-number randomness to confirm CAs use unpredictable 64-bit-plus serials that resist hash-collision forgery.
101091. **Hardcoded keystore password finder** — inspects mobile apps and deployment artifacts for embedded keystore passwords that turn private-key files into public ones.
101092. **Mobile app private-key bundle detector** — scans shipped app bundles for embedded private keys or client certificates that attackers can extract from any download.
101093. **ACME account-key protection reviewer** — verifies ACME account keys are stored securely and scoped per environment so one leaked key cannot reissue the whole fleet's certificates.
101094. **Key-rotation evidence collector** — gathers rotation timestamps and old-key destruction records to prove keys actually rotate on schedule for audits and incident response.
101095. **Post-quantum hybrid handshake mapper** — probes endpoints for X25519 plus ML-KEM hybrid key exchange to measure readiness for quantum-resistant TLS.
101096. **Quantum-vulnerability key inventory** — catalogs every RSA and ECC key in the estate by algorithm and size so harvest-now-decrypt-later exposure is quantified.
101097. **ML-KEM negotiation detector** — tests which post-quantum KEM identifiers servers accept to track standardized algorithm adoption across the fleet.
101098. **Crypto-agility migration planner** — scores each system on how quickly it could swap algorithms, turning quantum readiness from a slogan into a measured capability.
101099. **Algorithm deprecation timeline watcher** — tracks vendor and standards-body deprecation dates for SHA-1, 3DES, and RSA-1024 so migrations start before the cutoff.
101100. **SHA-1 signature residual scanner** — finds certificates and signatures still using SHA-1 so collision attacks cannot forge trust anywhere in the chain.
101101. **EdDSA adoption tracker** — measures Ed25519 and Ed448 usage across SSH, TLS, and signing pipelines to confirm modern signature algorithms are actually deployed.
101102. **Curve deprecation readiness checker** — inventories reliance on elliptic curves slated for deprecation so migrations to X25519 and post-quantum hybrids are planned in time.
101103. **Encrypt-then-MAC adoption auditor** — checks TLS 1.2 sessions for RFC 7366 encrypt-then-MAC support so padding-oracle attacks lose their timing and error signals.
101104. **Cipher-suite preference-order optimizer reviewer** — audits server suite ordering to confirm the strongest mutually supported suite is preferred, not merely offered.
101105. **Authorization-code replay detector** — attempts to redeem the same OAuth2 authorization code twice to verify the server invalidates it after first use and prevents session theft.
101106. **State parameter absence checker** — initiates login flows without a `state` value to confirm the IdP rejects CSRF-prone requests that lack request-binding tokens.
101107. **Nonce verification tester** — replays an OIDC `id_token` from a previous session to verify the relying party rejects tokens whose `nonce` does not match the current login attempt.
101108. **Implicit-flow leakage auditor** — scans configured clients for legacy implicit grants that expose tokens in URL fragments to browser history and referer headers.
101109. **Response-mode fragment exposure probe** — requests `response_mode=fragment` explicitly and checks whether long-lived tokens land in fragments that analytics scripts or shared devices could harvest.
101110. **Hybrid-flow code misuse scanner** — validates that codes issued in hybrid flows cannot be exchanged outside the original session binding, closing a front-channel interception window.
101111. **Token-endpoint client-auth bypass tester** — submits a code-exchange request with a missing or wrong `client_secret` to confirm confidential clients cannot mint tokens unauthenticated.
101112. **Authorization-code interception simulator** — emulates a leaked code arriving from an untrusted redirect to verify PKCE or session binding blocks its redemption by a second party.
101113. **Code-challenge mismatch detector** — exchanges a code with a PKCE verifier that does not match the challenge to confirm the IdP rejects the token request outright.
101114. **Session-bound code redemption checker** — confirms an authorization code issued to one browser session cannot be redeemed from a different session or IP context.
101115. **PKCE plain-method downgrade tester** — forces `code_challenge_method=plain` to verify the IdP refuses the weak method and requires S256 for public clients.
101116. **PKCE omission probe for public clients** — starts an authorization request without any PKCE parameters to confirm native and SPA clients cannot complete login unprotected.
101117. **PKCE verifier truncation checker** — submits a verifier shorter than the RFC minimum to verify the IdP enforces the 43–128 character entropy requirement.
101118. **PKCE verifier reuse detector** — reuses one verifier across two code exchanges to confirm the IdP treats verifiers as single-use and blocks the replay.
101119. **Confidential-client PKCE gap analyzer** — checks whether server-side clients skip PKCE entirely, leaving stolen codes redeemable by anyone holding them.
101120. **Challenge entropy measurer** — analyzes generated challenges for low entropy or predictable patterns that would let an observer brute-force the verifier.
101121. **Code-verifier character-set validator** — sends verifiers with illegal characters to confirm strict input validation rather than silent truncation or hashing errors.
101122. **PKCE downgrade-via-authorize-endpoint probe** — tampers with the challenge at the authorize step to confirm the token endpoint binds to the original registered challenge.
101123. **Redirect-URI open-redirect chain tester** — chains a registered redirect URI into an open-redirect path to verify codes never flow to attacker-controlled hosts.
101124. **Redirect-URI suffix-match bypass checker** — registers `evil-example.com` against a `example.com` allow-list to confirm the IdP compares full hosts, not string suffixes.
101125. **Redirect-URI path-traversal probe** — appends `../` sequences to a whitelisted path to verify the IdP normalizes URIs before matching them.
101126. **Wildcard redirect-URI detector** — tests whether a client registered with a wildcard pattern can be abused to land codes on arbitrary subdomains.
101127. **Redirect-URI port-confusion tester** — varies the port on a registered URI to confirm the IdP treats different ports as different destinations.
101128. **Encoded-character redirect bypass probe** — uses percent-encoded slashes and dots in redirect URIs to verify decoding happens before allow-list comparison.
101129. **Trailing-dot domain bypass checker** — requests `example.com.` (trailing dot) to confirm the IdP normalizes DNS-equivalent hostnames against the allow-list.
101130. **Query-parameter injection on redirect tester** — appends attacker query parameters to a registered URI to verify the IdP enforces exact query matching where required.
101131. **SAML signature-stripping detector** — submits a SAML response with the signature removed to confirm the service provider rejects unsigned assertions.
101132. **SAML XML-signature-wrapping probe** — wraps a signed assertion inside a forged outer element to verify the SP validates the signature over the correct node.
101133. **SAML audience-restriction checker** — replays an assertion meant for a different SP to confirm audience conditions bind the token to its intended recipient.
101134. **SAML NameID spoofing tester** — alters the NameID to another user's identifier while keeping the signature wrapper to verify the SP binds identity to signed data.
101135. **SAML RelayState open-redirect verifier** — passes a malicious URL in RelayState to confirm the SP sanitizes post-login navigation targets.
101136. **SAML assertion-encryption auditor** — inspects whether assertions carrying PII travel unencrypted, exposing them to any proxy in the login path.
101137. **SAML OneTimeUse enforcement checker** — replays a single-use assertion to confirm the SP tracks assertion IDs and rejects duplicates.
101138. **SAML clock-skew abuse probe** — submits assertions with manipulated NotBefore/NotOnOrAfter windows to verify tight time validation against replay.
101139. **Account-linking email-collision tester** — links a social account whose email matches an existing local user to confirm the flow requires verified-ownership proof before merging.
101140. **Unverified-email merge blocker** — attempts to merge accounts using an unverified email claim to verify the platform refuses identity linkage without verification.
101141. **IdP-attribute mutation linkage probe** — changes the email at the IdP after linking to confirm the SP re-verifies identity instead of silently following the new attribute.
101142. **Forced-linking CSRF checker** — drives the account-linking endpoint cross-site to verify anti-CSRF tokens protect the link action from forced merges.
101143. **Dangling unverified account scanner** — hunts for accounts created by social login that never completed verification yet hold sessions or permissions.
101144. **Link-then-change-email takeover probe** — links accounts, then changes the email to a victim's address to verify re-verification gates block the takeover.
101145. **Duplicate verified-email resolver** — checks how the platform handles two IdPs asserting the same verified email so the wrong account is never silently merged.
101146. **Account-linking consent-screen auditor** — verifies the linking UI discloses exactly which attributes and permissions are being merged before the user approves.
101147. **Magic-link token entropy analyzer** — measures token randomness to confirm magic links resist brute-force guessing within their validity window.
101148. **Magic-link forwarding resistance tester** — forwards a magic link to a different device and network to verify the token is bound to the original requester and cannot be replayed elsewhere.
101149. **Magic-link expiry validator** — uses an aged magic link to confirm short expiration windows actually invalidate stale tokens.
101150. **Magic-link referer-leak detector** — follows a magic link to a page with third-party resources to verify tokens never leak via the Referer header.
101151. **Magic-link email-change flow tester** — requests an email change via magic link to confirm both old and new addresses get verification before the switch.
101152. **Magic-link forwarding safety checker** — examines whether forwarded magic links bind to the original device or context, limiting damage from inbox forwarding.
101153. **Magic-link request rate-limit probe** — floods the magic-link endpoint to verify throttling stops email-bombing and account enumeration.
101154. **Magic-link account-enumeration tester** — compares responses for existing versus unknown emails to confirm the endpoint reveals nothing about account existence.
101155. **WebAuthn attestation-policy auditor** — registers a credential with `attestation=none` to confirm high-assurance policies reject self-attested authenticators.
101156. **WebAuthn user-verification bypass checker** — attempts login with `uv=false` to verify the relying party enforces user verification where its policy requires it.
101157. **WebAuthn origin-binding validator** — replays a credential response from a different origin to confirm the authenticator data is bound to the registered site.
101158. **Passkey challenge-reuse detector** — reuses a server challenge across two authentication ceremonies to confirm challenges are single-use and unpredictable.
101159. **WebAuthn authData-flags inspector** — parses authenticator flags to confirm user-presence and user-verification bits match what the session actually grants.
101160. **Credential-ID confusion tester** — swaps credential IDs between users at login to confirm the server binds each credential to exactly one account.
101161. **Passkey backup-eligibility reviewer** — checks whether synced passkeys on shared devices receive the same trust as hardware-bound keys when policy distinguishes them.
101162. **WebAuthn registration replay probe** — replays a captured registration ceremony to confirm the server rejects already-registered credential IDs.
101163. **OAuth token-exchange impersonation tester** — requests an exchanged token with a forged `subject_token` to verify the authorization server validates token origin and signature.
101164. **Token-exchange audience-gap checker** — inspects exchanged tokens for missing audience restrictions that would let a delegated token roam across services.
101165. **Delegation-chain length limiter** — chains token exchanges repeatedly to confirm the IdP caps delegation depth and prevents runaway impersonation chains.
101166. **On-behalf-of scope-expansion probe** — requests broader scopes during exchange than the original token held to verify scopes can only shrink, never grow.
101167. **Act-claim forgery detector** — tampers with the `act` (actor) claim in delegation tokens to confirm downstream services validate the full delegation chain.
101168. **Exchanged-token lifetime auditor** — verifies exchanged tokens expire no later than the source token so delegation cannot outlive the original grant.
101169. **Subject-token-type confusion tester** — submits a token with a mismatched `subject_token_type` to confirm the server rejects type-confusion attacks.
101170. **Token-exchange consent verifier** — confirms the resource owner approved delegation when the exchange crosses trust boundaries instead of silently minting tokens.
101171. **IdP-SP session lifetime mismatch analyzer** — compares IdP and SP session durations to flag SP sessions that survive long after the IdP session died.
101172. **Silent re-authentication bypass probe** — manipulates `prompt=none` flows to verify the SP does not grant fresh sessions without a live IdP session.
101173. **IdP session-fixation checker** — tests whether the IdP rotates its session identifier at login to prevent pre-login session fixation.
101174. **Post-password-change session invalidator** — changes the account password and confirms all SP sessions derived from the IdP session are terminated.
101175. **Concurrent-session limit enforcer** — opens sessions beyond the allowed count to verify the IdP caps parallel sessions and evicts the oldest.
101176. **Step-up context preservation tester** — crosses from IdP to SP after step-up authentication to confirm the elevated assurance level travels with the session.
101177. **IdP-SP cookie partition reviewer** — inspects cookie scoping between IdP and SP domains to confirm one application's compromise cannot hijack the other's session.
101178. **ID-token versus session-sync checker** — compares the claims in the ID token with live session state to catch drift where revoked users keep valid tokens.
101179. **Front-channel logout coverage tester** — logs out and confirms every registered SP receives the logout signal instead of only the initiating application.
101180. **Back-channel logout implementation verifier** — checks that SPs expose and honor back-channel logout endpoints so server-side sessions actually die.
101181. **Post-logout SP-session survivor scanner** — attempts to reuse SP session cookies after SLO to confirm no application session outlives the logout.
101182. **Logout CSRF protector** — drives the logout endpoint cross-site to confirm logout requires an anti-CSRF token and cannot be triggered by attackers.
101183. **Session-cookie clearance auditor** — inspects the browser after logout to confirm all session cookies are expired server-side, not merely hidden client-side.
101184. **IdP-initiated logout flow tester** — starts logout from the IdP and confirms every downstream SP session terminates, not just the IdP session.
101185. **Logout-token validation checker** — submits a forged OIDC logout token to the back-channel endpoint to confirm the SP validates its signature and claims.
101186. **Single-logout error-handling reviewer** — simulates a failing SP during SLO to confirm the IdP reports partial logout instead of claiming full success.
101187. **Social-login test-app credential scanner** — hunts for development or test OAuth app credentials active in production, which bypass production app review and policies.
101188. **Deprecated social-SDK flow detector** — identifies logins still using retired provider SDK versions that lack current signature and state protections.
101189. **Social-login permission overreach auditor** — compares requested OAuth scopes against actual product need to flag data harvesting disguised as login.
101190. **Deauthorization webhook verifier** — revokes app access at the provider and confirms the SP handles the deauthorization callback by downgrading the account.
101191. **Social token server-side caching reviewer** — checks whether long-lived provider tokens are stored server-side with encryption instead of in client-accessible storage.
101192. **App-scoped ID confusion tester** — swaps app-scoped user IDs between applications to confirm the SP never treats them as globally unique identifiers.
101193. **Social-login email-verification gap checker** — logs in via providers that do not verify emails and confirms the SP marks those emails unverified until proven.
101194. **Provider account-recovery linkage probe** — tests whether a recovered social account at the provider automatically regains linked SP access without re-verification.
101195. **Cross-tenant issuer confusion tester** — presents a token issued for tenant A to tenant B's endpoints to confirm the audience and issuer checks reject it.
101196. **Tenant-parameter tampering probe** — alters the tenant identifier in authorization requests to verify users cannot hop into another tenant's login context.
101197. **Common-endpoint tenant-hopping checker** — uses the shared `common` login endpoint to confirm the final token is pinned to the correct tenant, not the attacker's.
101198. **Tenant discovery-document leakage scanner** — inspects multi-tenant discovery endpoints for tenant lists or metadata that enumerate other customers.
101199. **Cross-tenant client-ID reuse detector** — checks whether one OAuth client ID is valid across tenants, which would let an app in tenant A mint tokens for tenant B.
101200. **Organization-claim confusion tester** — tampers with `org_id` or tenant claims to confirm APIs authorize against the token's verified tenant, not a request parameter.
101201. **Tenant-scoped consent bypass probe** — grants consent in one tenant and attempts to use it in another to verify consent records are strictly tenant-bound.
101202. **Email-domain tenant-routing takeover checker** — registers a domain matching another tenant's email-based routing to confirm domain verification blocks tenant hijack.
101203. **Tenant-registration allow-list verifier** — attempts self-registration into a restricted tenant to confirm the IdP enforces invitation or allow-list controls.
101204. **Tenant-branding phishing reviewer** — examines per-tenant login-page customization to confirm one tenant cannot spoof another tenant's branding to harvest credentials.
101205. **postMessage origin validator** — statically and dynamically audits every message event listener to confirm it checks event.origin against an explicit allow-list before acting, because unvalidated listeners let any site drive privileged handlers.
101206. **postMessage wildcard listener hunter** — finds handlers that accept messages from any origin without verification, since "*" origin acceptance turns cross-site messages into remote commands.
101207. **postMessage message-shape fuzzer** — delivers malformed and mistyped payloads to postMessage handlers to detect type-confusion paths that reach DOM sinks.
101208. **postMessage sensitive-action gate checker** — confirms handlers that trigger navigation, payments, or token use require both origin validation and an explicit intent token.
101209. **postMessage child-frame relay mapper** — traces iframe-to-parent-to-grandchild relay chains that can launder an untrusted origin into a trusted-looking one.
101210. **postMessage origin allow-list drift detector** — compares deployed origin allow-lists against current DNS and deployments to catch stale trusted domains an attacker could acquire.
101211. **Service-worker scope boundary verifier** — checks that every service-worker registration scope stays within its intended path prefix so one app cannot intercept another's traffic.
101212. **Service-worker cache poisoning probe** — writes canary entries through the app's own cache APIs to confirm responses are keyed with integrity and cannot be swapped.
101213. **Service-worker update cadence checker** — verifies update checks run frequently enough that a compromised worker cannot persist unnoticed for months.
101214. **Service-worker navigation preload abuse check** — confirms navigation preload cannot be tricked into caching attacker-influenced responses for later victims.
101215. **Service-worker fetch handler auth mapper** — maps which fetch routes serve cached authenticated content without revalidation, exposing session bleed between users.
101216. **Service-worker foreign-script detector** — flags workers importing scripts from unvetted third-party origins that could turn the worker into a persistent backdoor.
101217. **Web Worker isolation auditor** — verifies dedicated workers run with no DOM access and expose only a minimal typed message surface.
101218. **SharedWorker cross-tab leakage tester** — checks whether a shared worker exposes one tab's session data to another tab from a different origin.
101219. **Worker importScripts integrity checker** — confirms scripts pulled in via importScripts carry subresource integrity or same-origin guarantees.
101220. **Worker termination hygiene checker** — verifies workers that handled secrets terminate promptly and release memory instead of lingering with sensitive state.
101221. **WebAssembly module inventory mapper** — enumerates every .wasm module a target loads and records each module's imports and exports for review.
101222. **WebAssembly import surface reviewer** — inspects host-function imports to ensure sandboxed modules are not granted dangerous capabilities like raw memory or network access.
101223. **WebAssembly memory bounds checker** — validates linear-memory growth limits so a malicious module cannot exhaust the tab's memory and crash the client.
101224. **WebAssembly indirect-call table auditor** — reviews function tables for type-confusion-prone indirect calls that could redirect execution inside the module.
101225. **WebAssembly embedded secret scanner** — scans wasm binaries and data segments for hard-coded keys, tokens, or credentials shipped to every client.
101226. **WebAssembly obfuscation transparency reporter** — flags heavily obfuscated modules that hide security-relevant logic from legitimate review.
101227. **Client-side key storage detector** — finds encryption keys or API secrets embedded in JavaScript bundles or wasm data that any visitor can extract.
101228. **Hard-coded IV and nonce misuse checker** — detects reused or static initialization vectors in client-side encryption that destroy ciphertext uniqueness.
101229. **Client-side cipher mode auditor** — flags ECB or unauthenticated encryption modes in browser crypto code that must provide both confidentiality and integrity.
101230. **WebCrypto key extractability reviewer** — checks that generated CryptoKeys are marked non-extractable so page scripts cannot exfiltrate them.
101231. **Custom crypto implementation flagger** — identifies hand-rolled ciphers or hashes in client code that should use audited platform primitives instead.
101232. **Client-side credential protection verifier** — confirms passwords are never reversibly "encrypted" client-side and that real hashing uses memory-hard KDFs.
101233. **DOM-clobbering source mapper** — catalogs named elements and ids that shadow window or document properties, the raw material for clobbering attacks.
101234. **DOM-clobbering sink tracer** — traces clobberable globals into dangerous sinks like script src, form action, or base href.
101235. **Clobbering guard effectiveness tester** — verifies defensive checks such as own-property guards actually block crafted markup instead of giving false confidence.
101236. **Trusted Types policy inventory** — lists every Trusted Types policy and confirms each one has a narrow, reviewed purpose.
101237. **Trusted Types enforcement verifier** — checks that require-trusted-types-for is enforced so raw string assignments to sinks are rejected.
101238. **Trusted Types default-policy reviewer** — audits the default policy for over-permissive sanitization that silently waves attacks through.
101239. **Extension content-script interference detector** — detects installed extensions whose content scripts mutate the target's DOM or network calls during a hunt.
101240. **Content-script namespace collision checker** — verifies page scripts keep working when common extensions alter prototypes or inject DOM nodes.
101241. **Extension request-tampering monitor** — observes whether an extension rewrites the target's requests in ways that mask the site's real behavior.
101242. **localStorage secret scanner** — scans localStorage entries for tokens, session identifiers, or personal data persisted longer than necessary.
101243. **sessionStorage lifetime verifier** — confirms sensitive values live only in sessionStorage and disappear when the tab closes.
101244. **IndexedDB exposure mapper** — inventories object stores and flags databases readable across origins or holding credentials.
101245. **IndexedDB encryption-at-rest checker** — verifies sensitive stores hold encrypted values rather than plaintext records anyone with device access can read.
101246. **Cookie Store API auditor** — reviews JavaScript cookie reads and writes for HttpOnly, Secure, and SameSite regressions.
101247. **Storage quota abuse limiter check** — tests that unbounded writes cannot fill the storage quota and brick the app for the user.
101248. **WebRTC ICE candidate IP leak tester** — captures ICE candidates to confirm proxied users do not leak their real IP addresses.
101249. **WebRTC mDNS obfuscation verifier** — checks that local interface addresses are hidden behind mDNS hostnames instead of exposed directly.
101250. **WebRTC data-channel auth checker** — verifies data channels authenticate peers before exchanging any sensitive payload.
101251. **WebRTC DTLS fingerprint validator** — confirms certificate fingerprints are pinned or verified rather than trusted blindly on first use.
101252. **Clipboard read permission gate checker** — verifies clipboard reads only fire after an explicit user gesture and permission prompt.
101253. **Clipboard write sanitization reviewer** — checks copied rich content is sanitized so paste targets never receive active markup.
101254. **Clipboard event hijack detector** — monitors copy and cut handlers that silently rewrite clipboard content, such as swapping payment addresses.
101255. **File System Access API scope verifier** — confirms directory handles stay scoped to user-picked folders and never to broad filesystem roots.
101256. **File System Access permission persistence checker** — verifies granted file handles expire or re-prompt instead of persisting silently forever.
101257. **Origin Private File System exposure mapper** — inventories OPFS usage and flags sensitive files written without encryption.
101258. **Drag-and-drop path disclosure tester** — checks drop handlers do not expose full local file paths or read unintended files.
101259. **Beacon API exfiltration monitor** — watches navigator.sendBeacon calls for sensitive payloads smuggled out on page unload.
101260. **Fetch keepalive abuse checker** — tests whether keepalive requests can smuggle data out after the user navigates away.
101261. **Navigation timing leak analyzer** — measures which performance entries expose cross-origin timing usable for history sniffing.
101262. **Resource timing cross-origin verifier** — confirms timing-allow-origin is restrictive so attackers cannot profile internal resources.
101263. **Client-hints exposure minimizer check** — verifies User-Agent Client Hints only request high-entropy values when genuinely needed.
101264. **Battery Status API absence confirmer** — confirms the deprecated battery API is unavailable so charge state cannot fingerprint users.
101265. **Canvas fingerprinting detector** — identifies scripts that render hidden canvases purely to derive stable device fingerprints.
101266. **WebGL renderer string exposure checker** — verifies debug renderer info is gated so GPU strings do not leak to fingerprinters.
101267. **Font enumeration guard tester** — checks the page does not expose the full installed-font list through measurement tricks.
101268. **Idle Detection API permission checker** — verifies idle detection requires explicit permission rather than enabling silent observation.
101269. **Geolocation permission flow auditor** — confirms geolocation prompts are contextual and cached positions expire promptly.
101270. **Media device enumeration gate checker** — verifies device labels stay empty until camera or microphone permission is granted.
101271. **getDisplayMedia consent verifier** — checks screen-share flows show clear consent UI indicating exactly what is being captured.
101272. **Notification permission abuse detector** — finds notification prompts triggered without user intent or repeated until the user surrenders.
101273. **Push subscription endpoint auditor** — reviews push endpoints and VAPID keys for cross-app reuse or accidental exposure.
101274. **Payment Request API data minimizer** — verifies payment sheets request only necessary fields and never log full card data client-side.
101275. **Credential Management API store checker** — confirms stored credentials use the platform credential store securely instead of plaintext fallbacks.
101276. **WebAuthn registration ceremony reviewer** — audits attestation options for weak algorithms or missing user-verification requirements.
101277. **WebUSB permission posture checker** — verifies USB device requests are gesture-gated and device filters are narrowly scoped.
101278. **WebBluetooth pairing scope tester** — checks Bluetooth characteristic access is limited to the services the feature actually needs.
101279. **WebNFC tag write guard** — confirms NFC writes require explicit user action and validate tag content before committing.
101280. **WebHID device filter auditor** — reviews HID filters so pages cannot enumerate arbitrary human-interface devices.
101281. **Serial API port filter checker** — verifies serial port requests use strict vendor and product filters instead of open selection.
101282. **Web MIDI SysEx gate checker** — confirms System Exclusive MIDI access is permission-gated rather than silently enabled.
101283. **iframe sandbox attribute verifier** — checks every iframe carries the minimal sandbox token set required for its function.
101284. **Permissions Policy allow-list mapper** — maps per-iframe allow attributes to confirm camera, microphone, and geolocation are not over-granted.
101285. **Cross-origin isolation header checker** — verifies COOP, COEP, and CORP headers isolate the page from cross-origin window attacks.
101286. **Frame-ancestors clickjacking verifier** — confirms framing defenses are present and not undermined by overly broad allow-lists.
101287. **Base tag hijack detector** — checks for attacker-influenced base tags that reroute relative URLs to malicious hosts.
101288. **Form action override scanner** — scans forms for off-origin action attributes set through injection or DOM clobbering.
101289. **Shadow DOM encapsulation tester** — verifies shadow roots use closed mode where secrets render and that slotted content is sanitized.
101290. **CSS exfiltration guard checker** — tests that injected CSS cannot exfiltrate attribute values through selector-triggered external requests.
101291. **Visited-link history sniffing mitigator check** — confirms computed-style reads on visited links stay restricted by the browser's privacy profile.
101292. **Speculation rules abuse tester** — checks that prefetch and prerender rules cannot be abused to trigger state-changing URLs.
101293. **Fenced frame data leakage checker** — verifies fenced frames cannot communicate measurement results back to their embedders.
101294. **Shared Storage access gate reviewer** — audits sharedStorage worklet access for cross-site data leakage paths.
101295. **Topics API exposure checker** — confirms the Topics API is disabled or consent-gated where the product promises no ad profiling.
101296. **Attribution Reporting verifier** — checks attribution sources do not leak fine-grained conversion data across sites.
101297. **Protocol handler registration tester** — verifies custom protocol handler registrations are limited to vetted schemes and origins.
101298. **PWA manifest scope checker** — audits manifest scope and start_url so installed apps cannot be steered to attacker pages.
101299. **Share-target endpoint reviewer** — checks Web Share Target endpoints validate incoming shared data before processing it.
101300. **Background Sync tag auditor** — verifies background sync tags cannot replay sensitive operations without fresh authentication.
101301. **Periodic Sync permission checker** — confirms periodic background sync requires an installed app plus permission, not silent polling.
101302. **WebTransport origin validator** — checks WebTransport sessions validate origin and pin certificates where the threat model requires it.
101303. **WebSocket origin check verifier** — confirms the server validates the Origin header instead of accepting connections from any page.
101304. **Server-sent events auth tester** — verifies event streams require authentication and never leak one user's events to another.
101305. **S3 trigger event payload injection tester** — feeds malformed and oversized S3 object-key names into a function handler to confirm it validates event fields before trusting them.
101306. **S3 notification loop storm detector** — checks whether a function's S3 writes re-trigger its own bucket notifications, which can spawn a runaway recursive execution loop.
101307. **SQS visibility-timeout race analyzer** — measures whether poison-pill messages can be re-driven concurrently when visibility timeouts overlap across parallel invocations.
101308. **Webhook trigger signature forgery tester** — replays captured webhook payloads with altered signatures to verify the function rejects unsigned or replayed events.
101309. **EventBridge rule scoping auditor** — inspects EventBridge patterns feeding functions for overly broad wildcards that route unrelated events into privileged handlers.
101310. **SNS cross-account subscription validator** — verifies SNS topics behind functions cannot be subscribed by arbitrary external accounts that then inject events.
101311. **Event-source mapping batch-size abuser** — tests whether oversized batched events (SQS/Kinesis/DynamoDB streams) bypass per-record validation logic in the handler.
101312. **Dead-letter queue poisoning probe** — injects crafted failures into a DLQ-fed function to confirm it does not re-execute attacker-controlled dead-letter payloads unsafely.
101313. **S3 object-metadata header smuggler** — passes hostile metadata headers through S3 events to check the function sanitizes them before use in downstream calls.
101314. **Stream checkpoint tampering reviewer** — examines Kinesis/DynamoDB stream handlers for reliance on mutable checkpoint state that an attacker could skew.
101315. **Function IAM wildcard permission scanner** — enumerates the execution role's policy for star-actions or resources that grant far more than the function needs.
101316. **Cross-function role assumption checker** — tests whether one function's role can be assumed by another, enabling privilege escalation across the serverless estate.
101317. **Least-privilege policy diff engine** — compares observed CloudTrail API calls against granted permissions to highlight rights the function never exercises.
101318. **Resource-based policy trust-boundary mapper** — maps Lambda resource policies to find external principals allowed to invoke functions they should not reach.
101319. **PassRole chain exploitation guard** — verifies functions holding iam:PassRole cannot be tricked into attaching admin roles to new resources.
101320. **Temporary credential exfiltration timer** — measures how long function credentials remain valid so hunters can assess the blast radius of a leaked execution context.
101321. **VPC-less function network egress auditor** — confirms functions without VPC attachment cannot reach internal resources they were never meant to touch.
101322. **Secrets-manager over-grant detector** — flags functions that can read every secret in Secrets Manager instead of only the ones their config references.
101323. **KMS decrypt scope reviewer** — checks that function roles decrypt only their designated keys rather than any key in the account.
101324. **Tag-based access control bypass probe** — tests whether functions can modify their own tags to slip into more permissive tag-conditioned policies.
101325. **Environment variable secret exposure scanner** — scans function configurations and CI logs for plaintext secrets stored in environment variables.
101326. **KMS-wrapped env value conformance checker** — verifies every variable flagged as sensitive is stored as a KMS-encrypted value rather than a plaintext default, closing silent misconfiguration gaps.
101327. **Env var inheritance leak tracer** — tracks which variables propagate from shared configs or layers into functions that never needed them.
101328. **CI/CD env snapshot harvester** — checks build artifacts and pipeline logs for dumped environment blocks that expose production secrets.
101329. **Warm-container secret remnant scanner** — inspects recycled execution environments for credentials left in memory or /tmp by an earlier invocation that failed to scrub state.
101330. **/tmp persistence cross-invocation probe** — writes canary files to /tmp during one invocation and checks whether a later invocation of the same warm container can read them.
101331. **Memory snapshot cross-tenant analyzer** — assesses whether freed-but-unscrubbed memory in recycled runtimes could leak data between unrelated tenants.
101332. **Init-phase secret caching reviewer** — reviews initialization code that caches secrets in globals so they survive across invocations without re-authentication.
101333. **Snapshot-restore secret staleness tester** — confirms provisioned-concurrency snapshots do not serve revoked credentials long after rotation.
101334. **Log-stream secret redaction verifier** — replays function logs to ensure secrets are masked before they reach CloudWatch or third-party log sinks.
101335. **Edge KV namespace isolation tester** — probes edge KV bindings to confirm one site's workers cannot read another tenant's keys.
101336. **Edge KV TTL confusion analyzer** — tests whether stale cached secrets in edge KV are served past their intended expiry.
101337. **Worker route shadowing detector** — checks whether an overly broad edge route pattern intercepts traffic meant for a stricter, more specific handler.
101338. **Edge middleware auth bypass scanner** — evaluates edge middleware chains for paths that skip authentication when matched by a wildcard route.
101339. **Durable-object ID predictability probe** — tests whether durable object identifiers are guessable, allowing cross-user state access at the edge.
101340. **Edge cache poisoning validator** — sends varied request keys to verify the edge cache keys on the right attributes and does not serve one user's response to another.
101341. **Subrequest credential forwarding reviewer** — inspects edge subrequests to ensure internal tokens are not forwarded to third-party origins.
101342. **Edge scheduled-cron abuse tester** — checks edge cron triggers for missing authorization that lets anyone schedule privileged background work.
101343. **Geofencing bypass at the edge** — probes edge geo-routing controls to confirm region-restricted content cannot be fetched through edge failover paths.
101344. **Edge analytics exfiltration guard** — verifies edge telemetry pipelines do not carry PII or secrets back to analytics endpoints in cleartext.
101345. **Function URL auth-mode gap finder** — enumerates function URLs to find ones set to NONE authentication that should require IAM or authorizer checks.
101346. **Function URL CORS over-permissiveness probe** — tests function-URL CORS settings for wildcard origins combined with credentialed access.
101347. **Function URL throttling absence detector** — confirms publicly reachable function URLs have concurrency or WAF throttling so they cannot be abused for free compute.
101348. **Presigned URL lifetime abuser** — measures presigned function invocation URLs for excessive expiry windows that outlive their business need.
101349. **Function URL path-traversal smuggler** — sends encoded path segments to function URLs to verify the handler normalizes paths before routing.
101350. **Invoke-mode response streaming leaker** — checks streaming function URLs for partial-response leaks that expose data before authorization completes.
101351. **Function URL version pinning reviewer** — verifies URLs invoke a pinned, reviewed version rather than always routing to $LATEST.
101352. **Dual-stack function URL exposure mapper** — maps IPv6 and custom-domain bindings of function URLs to catch endpoints reachable outside the intended network boundary.
101353. **Function URL query-param injection tester** — fuzzes query parameters on function URLs to find handlers that interpolate them into commands or queries unsafely.
101354. **Orphaned function URL hunter** — discovers function URLs left enabled on deprecated functions that still execute old, unpatched code.
101355. **Deployment zip integrity hasher** — compares deployed package hashes against the CI-built artifact to catch tampering between build and deploy.
101356. **Layer version pinning auditor** — flags functions referencing $LATEST or unpinned layer versions that silently pick up unreviewed code.
101357. **Layer supply-chain provenance checker** — verifies layers come from trusted accounts and signed publishes rather than anonymous public ARNs.
101358. **Zip-slip in deployment package scanner** — inspects deployment archives for path-traversal entries that would write outside the task root on extraction.
101359. **Dependency confusion in layer builder** — tests whether private package names in layers can be shadowed by public-registry packages of the same name.
101360. **Container image tag mutability guard** — confirms serverless container functions pin immutable digests instead of mutable tags an attacker could repoint.
101361. **Build-time secret in package detector** — scans deployment zips for embedded credentials accidentally baked in during the build step.
101362. **Unsigned code-signing policy enforcer** — verifies code-signing configs actually reject unsigned packages instead of merely warning.
101363. **Stale runtime deprecation tracker** — lists functions still on end-of-life runtimes that no longer receive security patches.
101364. **Post-deploy drift reconciler** — diffs live function configuration against the IaC template to surface manual changes that bypass review.
101365. **Provisioned-concurrency warm-state leak tester** — checks whether pre-warmed instances retain request-specific data in globals across unrelated invocations.
101366. **Connection-pool cross-request contaminator** — tests reused database connections for session state that bleeds from one invocation into the next.
101367. **Global-variable request mixing probe** — injects distinct canary values in parallel invocations to detect shared mutable globals.
101368. **Async background-task orphan reviewer** — examines handlers that spawn background work after returning, which can execute under the next request's identity.
101369. **Context-object reuse validator** — verifies the invocation context is not cached and replayed across calls with different callers.
101370. **Warm-container fingerprinting guard** — assesses whether attackers can detect warm versus cold starts to time state-leakage attacks.
101371. **Snapshot-restore identity confusion tester** — confirms restored snapshots re-resolve caller identity instead of trusting the pre-snapshot context.
101372. **Concurrency-limit exhaustion DoS probe** — measures whether reserved concurrency limits let an attacker starve legitimate traffic with cheap requests.
101373. **Unreserved-concurrency noisy-neighbor analyzer** — evaluates whether burst traffic from one function degrades neighbors sharing the account's concurrency pool.
101374. **Idle-timeout session residue checker** — inspects long-lived warm instances for authentication tokens that outlive their session.
101375. **State-machine choice-state logic flaw finder** — models Step Functions choice conditions to find branches reachable with attacker-controlled input.
101376. **Parallel-branch race detector** — tests parallel states for race conditions where ordering assumptions break under concurrent execution.
101377. **Wait-state timeout abuse analyzer** — checks long wait states that attackers could exploit to hold resources or delay detection indefinitely.
101378. **Task-token hijacking reviewer** — verifies callback task tokens are unguessable and bound to a single execution so outsiders cannot complete tasks.
101379. **Input-path JSONPath injection probe** — tests InputPath/ResultPath expressions for injection that lets event data escape its intended field.
101380. **State-machine IAM role over-scope checker** — audits the state machine's execution role for permissions beyond what its task states actually call.
101381. **Nested workflow privilege escalator** — examines nested state-machine invocations for child workflows running with broader permissions than the parent.
101382. **Error-retry amplification guard** — measures retry/catch configurations that could turn one bad input into a costly infinite retry loop.
101383. **Distributed-map cost explosion tester** — tests Map states processing attacker-sized arrays to confirm item-count and concurrency caps hold before cloud bills explode.
101384. **Execution-history data exposure reviewer** — confirms state-machine execution histories redact sensitive payloads before they are stored or displayed.
101385. **DLQ redrive storm simulator** — models dead-letter redrives to ensure mass replays cannot overwhelm downstream systems or replay stale privileged actions.
101386. **Timeout-based exfiltration channel tester** — checks whether error messages and timeout durations vary with secret data, creating a timing side channel.
101387. **VPC-attached function lateral-movement mapper** — maps what internal subnets and security groups a VPC-attached function can reach to bound lateral movement.
101388. **Egress-domain allowlist validator** — verifies functions only call approved external domains so a compromised handler cannot exfiltrate elsewhere.
101389. **Scheduled-event privilege reviewer** — audits cron-scheduled functions to confirm they run with minimal roles rather than inherited admin credentials.
101390. **Event-source disabled-but-reachable probe** — finds event mappings marked disabled that are still invocable through direct invoke paths.
101391. **Alias traffic-shifting integrity checker** — verifies weighted alias deployments cannot be manipulated to route all traffic to a tampered version.
101392. **Concurrency auto-scaling cost bomb guard** — estimates worst-case scaling cost from adversarial traffic so finance and security share one abuse ceiling.
101393. **X-Ray body capture hygiene reviewer** — verifies tracing integrations capture metadata only, never request bodies that embed secrets or PII, so observability does not become a leak channel.
101394. **Function-tag governance drift detector** — flags untagged or mistagged functions that evade ownership, cost, and compliance tracking.
101395. **Vendor lock-in escape-path analyzer** — maps proprietary service dependencies per function to quantify migration effort if the vendor relationship must end.
101396. **Proprietary-event-schema portability reviewer** — scores how deeply function code depends on vendor-specific event shapes that resist porting.
101397. **Multi-cloud function parity tester** — deploys the same handler logic to two providers' runtimes to expose behavioral gaps that hide security assumptions.
101398. **IaC vendor-abstraction coverage mapper** — measures what fraction of the serverless estate is described in portable IaC versus console-clicked vendor-specific config.
101399. **Egress-fee exfiltration economics model** — models data-transfer pricing so defenders can spot exfiltration patterns that are cheap for attackers but costly to detect.
101400. **Contractual data-residency verifier** — checks that function regions and edge locations match the data-residency commitments in customer contracts.
101401. **Exit-ramp secret rotation planner** — produces a rotation plan that re-keys every function secret without downtime during a vendor migration.
101402. **Proprietary-identity dependency breaker** — identifies functions hard-wired to vendor identity services and designs abstraction seams for portable auth.
101403. **Cross-vendor audit-trail normalizer** — normalizes logs from multiple serverless vendors into one schema so hunts do not miss events during migration.
101404. **Lock-in risk scoring dashboard** — rolls the estate's portability metrics into a single lock-in score that executives can track quarter over quarter.
101405. **Prompt-injection benchmark battery for customer chatbots** — runs a standardized suite of authorized injection attempts against a target's support chatbot to grade how consistently it resists instruction overrides.
101406. **Delimiter-framing injection tester** — wraps fake system or developer blocks in user input to verify the target's chatbot does not honor forged role delimiters.
101407. **Role-hijack probe for support assistants** — feeds the target assistant prompts that reassign its role to confirm it stays within its intended support persona.
101408. **Jailbreak-resistance regression suite** — replays a curated set of known jailbreak patterns after each target AI update so regressions in refusal behavior are caught before customers see them.
101409. **Multilingual injection probe** — translates injection attempts into several languages to check whether the target's guardrails hold when the attack is not in English.
101410. **Obfuscated-injection probe** — encodes hostile instructions with unicode tricks, homoglyphs, and base64 to verify the target model normalizes text before enforcing policy.
101411. **Context-window overflow probe** — floods a long-context customer chatbot with filler to test whether buried instructions can hijack the session once the window saturates.
101412. **Error-path instruction disclosure probe** — triggers malformed requests to see whether the target's error responses echo system instructions or internal configuration.
101413. **Conversation-history poisoning probe** — injects fake prior turns into the chat history to confirm the target chatbot cannot be steered by fabricated context.
101414. **Multi-turn social-engineering resistance evaluator** — conducts slow, multi-message manipulation dialogues to grade whether the target agent holds its boundaries over long conversations.
101415. **Uploaded-document injection scanner** — scans a target's document-upload AI feature with files containing hidden instructions to verify embedded commands are treated as data, not directives.
101416. **Webpage-ingestion injection probe** — feeds the target's URL-summarization feature pages carrying concealed instructions to confirm it summarizes content instead of obeying it.
101417. **OCR text-injection probe** — embeds hostile instructions in an image's text layer to check whether the target's vision pipeline treats OCR output as untrusted data.
101418. **Spreadsheet formula-instruction probe** — uploads CSV and spreadsheet files laced with natural-language commands to verify the target's data-analysis assistant does not execute them.
101419. **Email-content injection tester** — tests AI email assistants against incoming messages that carry hidden directives so mail-triage agents cannot be puppeted by senders.
101420. **Calendar-invite injection probe** — plants directives inside calendar event titles and descriptions to confirm the target's scheduling assistant does not follow attacker-authored instructions.
101421. **Shared-document comment injection probe** — adds instructions in comments of collaboratively edited documents to test whether the target's doc-summarizer stays loyal to the document owner.
101422. **Codebase-ingestion injection probe** — checks AI code-review features against repositories containing comment-buried instructions so the reviewer critiques code instead of obeying hidden commands.
101423. **Tool-output poisoning probe** — returns poisoned API responses to the target's tool-using agent to verify it validates tool outputs before acting on them.
101424. **Plugin-content injection evaluator** — tests third-party plugin data flows for instruction smuggling so the target agent does not inherit attacker intent from plugin results.
101425. **RAG knowledge-base poisoning detector** — hunts for attacker-inserted documents in a target's retrieval corpus that could steer answers, then flags them for owner review.
101426. **Knowledge-base tampering monitor** — watches a target's RAG corpus over time for unauthorized document edits that could silently change the assistant's answers.
101427. **Contradictory-source conflict tester** — plants conflicting documents in a test knowledge base to see whether the target RAG system resolves conflicts safely or parrots the poisoned version.
101428. **RAG citation fabrication detector** — compares generated citations against retrieved chunks to confirm the target assistant cannot invent sources that do not exist.
101429. **Retrieval-ranking manipulation probe** — crafts documents designed to outrank legitimate ones in a test corpus to check whether the target's retriever can be gamed by keyword stuffing.
101430. **Chunk-boundary injection probe** — splits hostile instructions across document chunk boundaries to verify the target's chunking pipeline cannot be stitched back into an attack by the model.
101431. **FAQ-instruction injection tester** — embeds directives inside FAQ-style support articles to confirm the target's help-center bot answers from content without obeying it.
101432. **RAG tenant-isolation verifier** — queries a multi-tenant knowledge base from a low-privilege test account to prove other tenants' documents never leak into answers.
101433. **Stale-document exploitation tester** — checks whether retired or superseded documents in the target's corpus can still be retrieved to produce outdated and unsafe guidance.
101434. **RAG grounding auditor** — measures how often the target assistant's claims trace back to retrieved sources versus hallucinated filler so owners can tighten grounding.
101435. **Function-calling parameter injection probe** — feeds the target agent adversarial parameters to verify it sanitizes arguments before invoking backend functions.
101436. **Untrusted tool-result handling evaluator** — assesses whether the target's agent treats tool results as untrusted input rather than authoritative instructions.
101437. **Unauthorized tool-invocation attempt detector** — tries to make the target agent call tools it should not have, confirming tool access is gated by policy and not by suggestion.
101438. **Tool-chaining abuse limiter verifier** — chains tool calls in a test session to verify the target agent enforces step limits and cannot recurse into runaway loops.
101439. **Argument-confusion probe for function calls** — swaps and duplicates named arguments to confirm the target's function-calling layer validates schemas strictly.
101440. **Tool-schema leakage detector** — asks the target assistant about its available tools to verify internal tool definitions and credentials are not disclosed.
101441. **Privileged-function gating verifier** — attempts to trigger payment, deletion, and admin functions through the target agent to confirm they require explicit authorization steps.
101442. **Tool-error message leakage probe** — forces tool failures to check whether the target's error messages expose stack traces, credentials, or internal paths.
101443. **Agentic loop guard tester** — drives the target agent toward recursive self-invocation to verify watchdog limits halt runaway tool loops before costs explode.
101444. **Tool-permission scoping auditor** — maps every tool the target agent exposes against least-privilege principles and flags over-broad grants for the owner.
101445. **Guardrail bypass regression battery** — replays bypass patterns against a target AI after each model or prompt change so safety regressions surface in testing, not production.
101446. **Persona-switching bypass evaluator** — tries to push the target assistant into alternate personas that relax its rules, confirming persona locks hold.
101447. **Hypothetical-scenario framing probe** — wraps disallowed requests in hypothetical or fictional framing to verify the target model's refusal logic sees through the disguise.
101448. **Token-smuggling bypass probe** — splits sensitive terms across tokens and punctuation to check whether the target's filters operate on meaning rather than literal strings.
101449. **Policy-evasion paraphrase tester** — rephrases blocked requests in progressively indirect language to grade the target guardrail's semantic coverage.
101450. **Cross-language guardrail consistency checker** — runs identical safety probes in many languages to expose locales where the target's guardrails are weaker.
101451. **System-prompt extraction attempt monitor** — issues extraction-style requests to confirm the target assistant refuses to reveal its system instructions.
101452. **Developer-message injection probe** — tests APIs that accept a developer role for injection of forged developer messages that could override application policy.
101453. **Refusal-quality auditor** — grades refusals to ensure the target model gives safe completions without leaking partial unsafe detail in the process.
101454. **Guardrail coverage gap mapper** — aggregates probe results into a heatmap showing which harm categories the target's guardrails cover weakly so owners can prioritize fixes.
101455. **System-prompt leakage probe battery** — systematically attempts prompt-extraction techniques against the target to measure how well its system prompt is protected.
101456. **Prompt-reconstruction analyzer** — compares the target assistant's outputs across many queries to detect whether system instructions can be statistically reconstructed.
101457. **Few-shot example extraction detector** — probes whether proprietary examples embedded in the target's prompt can be pulled out verbatim by an authorized tester.
101458. **Instruction-hierarchy violation tester** — checks that user-level instructions cannot override higher-priority developer or system instructions on the target.
101459. **System-prompt version leak detector** — looks for the target assistant disclosing prompt versioning or internal codenames that aid future extraction attempts.
101460. **Excessive-agency action-scope auditor** — inventories every real-world action the target agent can take and flags capabilities beyond what its product role requires.
101461. **Unauthorized transaction attempt probe** — tries to drive the target agent into purchases or transfers to verify financial actions always need explicit user confirmation.
101462. **Agent data-exfiltration probe** — attempts to make the target agent send sensitive data to external destinations to confirm exfiltration guardrails hold.
101463. **Agent-initiated communication abuse tester** — checks whether the target agent can be steered into sending emails or messages on the user's behalf without consent.
101464. **Coding-agent filesystem scope probe** — asks a target coding agent to touch files outside its workspace to verify sandbox boundaries are enforced.
101465. **Approval-step circumvention detector** — attempts to skip required confirmation steps in the target's agentic workflow to confirm critical actions cannot self-authorize.
101466. **Agent self-modification monitor** — watches whether the target agent can alter its own instructions, tools, or memory in ways that persist beyond the session.
101467. **Privilege-escalation via agent probe** — uses the target's agent as a confused deputy to reach admin functions and verifies the underlying APIs still enforce authorization.
101468. **Destructive-action confirmation verifier** — tries to trigger deletions and irreversible changes through the target agent to confirm confirmation gates actually block them.
101469. **Agent goal-drift monitor** — runs long-horizon tasks against the target agent to detect when it silently substitutes its own objectives for the user's.
101470. **Agent permission-creep tracker** — diffs the target agent's granted permissions over time so owners can spot scope expansion before it becomes risky.
101471. **Model API key exposure scanner** — inspects the target's frontend JavaScript, mobile apps, and config files for embedded model API keys that attackers could harvest.
101472. **Quota-exhaustion abuse probe** — measures whether unauthenticated users can burn the target's model quota or budget, flagging missing rate limits as a cost risk.
101473. **API key scope auditor** — verifies the target's model keys carry only the permissions they need and that high-privilege keys never ship to clients.
101474. **Key-rotation verification helper** — confirms rotated model keys actually invalidate old ones on the target so leaked credentials stop working promptly.
101475. **Model-usage anomaly detector** — baselines the target's AI endpoint traffic to flag sudden spikes that suggest key theft or automated abuse.
101476. **XSS-via-LLM-output probe** — feeds the target assistant inputs designed to produce script-bearing responses, verifying output encoding before rendering.
101477. **Markdown render-injection probe** — checks whether the target's chat UI safely handles model-generated markdown links and images that could phish users.
101478. **LLM-output sink tester** — traces model-generated text into SQL, shell, and code-execution sinks on the target to confirm untrusted output is never executed raw.
101479. **Auto-executed snippet safety reviewer** — evaluates features that run AI-generated code to verify sandboxing and review gates contain malicious or mistaken output.
101480. **Citation URL phishing probe** — tests whether the target assistant can be made to emit attacker-controlled links disguised as legitimate citations.
101481. **HTML email generation injection probe** — checks the target's AI email composer for output that could inject tracking pixels or malicious markup into recipients' inboxes.
101482. **Output-encoding consistency checker** — compares how the target renders model output across web, mobile, and email to find channels where encoding is missing.
101483. **Training-data extraction probe** — tests the target's exposed model with extraction-style queries to measure verbatim memorization risk of its training data.
101484. **PII regurgitation detector** — probes the target model for reproduction of personal data, confirming privacy filters catch memorized records.
101485. **Membership-inference probe** — runs controlled membership-inference tests against the target model to assess whether training-set membership can be determined.
101486. **Secret regurgitation scanner** — checks whether the target model emits API keys, tokens, or credentials that may have been absorbed during training.
101487. **Copyrighted-text reproduction probe** — measures how much copyrighted text the target model reproduces verbatim so owners can set safer generation limits.
101488. **Model-inversion risk assessor** — evaluates whether the target's prediction API leaks enough signal for an attacker to reconstruct sensitive inputs.
101489. **Adversarial-suffix robustness probe** — appends optimized gibberish suffixes to blocked requests to verify the target model's defenses hold against automated attacks.
101490. **Voice-assistant audio injection probe** — tests the target's voice AI against audio carrying hidden commands to confirm speech pipelines do not obey inaudible instructions.
101491. **Avatar jailbreak probe** — evaluates the target's AI avatar persona for consistency, confirming character framing cannot be used to relax its safety rules.
101492. **Multimodal injection probe** — combines image and text attacks against the target's vision-language features to verify cross-modal guardrails stay aligned.
101493. **Fine-tuning poisoning risk reviewer** — assesses the target's fine-tuning pipeline for controls that stop poisoned training samples from degrading model behavior.
101494. **Model-endpoint provenance verifier** — confirms the target's AI endpoints serve the intended model version so silently swapped or shadow models cannot go unnoticed.
101495. **Shadow AI feature discovery scanner** — crawls the target's product for undocumented AI endpoints and assistants that may lack the security review of official features.
101496. **Third-party model supply-chain reviewer** — inventories external models and providers the target depends on, flagging opaque supply chains for owner review.
101497. **AI incident-response drill simulator** — runs tabletop prompt-injection incidents against the target's team workflows so responders practice containment before a real event.
101498. **Chatbot PII overcollection auditor** — reviews what personal data the target's chatbot requests versus what its task needs, flagging unnecessary collection.
101499. **Conversation-log privacy checker** — verifies the target's chat logs are retained, encrypted, and purged per policy so sensitive conversations do not linger.
101500. **AI finding report compiler** — turns confirmed AI-application weaknesses into bounty-ready reports with reproduction steps, impact, and remediation guidance.
101501. **Prompt-injection canary deployer** — plants benign canary instructions in the target's content pipelines so successful injections announce themselves in test logs.
101502. **AI abuse rate-limit tester** — hammers the target's AI endpoints with automated request patterns to verify throttling stops bulk abuse.
101503. **Model-output disclosure checker** — confirms the target labels AI-generated content clearly so users are never misled about what a human wrote.
101504. **LLM security posture dashboard** — aggregates every AI-surface probe result for a target into one dashboard so owners can track their AI risk over time.
101505. **Cross-endpoint PII field mapper** — crawls every API response to catalog where personal data appears so the full exposure scope stays visible to defenders.
101506. **PII leakage drift detector** — re-scans endpoints after each deployment to catch newly exposed personal fields before real users are affected.
101507. **DSAR request flow tester** — exercises the data-subject-access-request path end to end to confirm requests reach the right handler and complete on time.
101508. **DSAR response completeness auditor** — compares data returned to a DSAR against the known PII map to verify no data categories were omitted.
101509. **Right-to-erasure evidence collector** — issues an erasure request then probes APIs, caches, and exports to prove personal records are actually gone.
101510. **Soft-delete residue scanner** — checks whether supposedly deleted records persist in backups, logs, or soft-delete flags that the API still serves.
101511. **Cookie consent pre-fire tracker** — loads pages without touching the consent banner to detect trackers firing before consent is given.
101512. **Consent-banner bypass prober** — verifies trackers stay dormant when consent is declined or the banner is dismissed without a choice.
101513. **Post-consent tracker delta analyzer** — diffs network requests before and after acceptance to show exactly which trackers each consent choice enables.
101514. **Consent revocation propagation checker** — withdraws consent and confirms third-party scripts stop firing across pages and sessions.
101515. **Data-retention age auditor** — flags records older than the stated retention period that remain queryable through normal endpoints.
101516. **Retention schedule extractor** — reads privacy policies and system configuration to build the declared retention matrix the agent then tests against.
101517. **Cross-border transfer sniffer** — inspects request destinations and IP geolocation to surface personal data leaving its declared region.
101518. **Transfer safeguard verifier** — checks that cross-border flows are backed by declared safeguards such as standard contractual clauses.
101519. **Purpose-limitation misuse prober** — replays consented data into unrelated features to confirm purpose boundaries are enforced server side.
101520. **Consent-scope drift monitor** — watches for new features consuming data that was consented for older purposes without fresh permission.
101521. **Children's data age-gate tester** — probes age gates and child-directed sections to confirm minor data collection stays within policy.
101522. **Parental consent flow validator** — tests parental-verification steps for gaps that let child accounts proceed without proper consent.
101523. **De-identification re-identification assessor** — attempts linkage attacks against anonymized exports to measure the real re-identification risk.
101524. **K-anonymity threshold checker** — verifies aggregated datasets meet their stated anonymity thresholds across query combinations.
101525. **Policy-to-practice consistency scanner** — compares stated data practices in the privacy policy against observed collection behavior.
101526. **Dark-pattern consent UX grader** — scores consent interfaces for manipulative design such as pre-ticked boxes or misleading accept buttons.
101527. **Granular consent choice verifier** — confirms users can opt into data categories individually rather than accepting an all-or-nothing bundle.
101528. **Consent receipt generator** — captures a timestamped record of what was consented to so later behavior can be audited against it.
101529. **Global-privacy-control signal honorer** — sends the GPC opt-out header and checks that sale and sharing flags respect it.
101530. **Do-not-sell endpoint tester** — exercises the do-not-sell request flow and verifies the backend flags actually change.
101531. **Third-party data-share mapper** — identifies every third party receiving personal data through network traffic and SDK calls.
101532. **Subprocessor disclosure checker** — compares the published subprocessor list against the domains actually receiving user data.
101533. **SDK data-collection auditor** — inventories embedded SDKs and measures what each transmits before and after consent.
101534. **Email tracking pixel detector** — finds tracking pixels and link rewriters in transactional emails that phone home without consent.
101535. **Geolocation precision consent tester** — checks that precise location is only collected after explicit permission and never inferred silently.
101536. **Coarse-versus-fine location prober** — verifies the app respects coarse-location grants instead of requesting fine coordinates anyway.
101537. **Biometric template storage reviewer** — checks where biometric templates live and whether they ever leave the device or server.
101538. **Data-minimization over-collection flagger** — flags form fields and API inputs collecting more than the feature demonstrably needs.
101539. **Optional-field enforcement checker** — confirms optional fields are truly optional server side rather than silently required.
101540. **Account-deletion completeness tester** — deletes a test account and verifies associated data across endpoints is removed or anonymized.
101541. **Export-portability format validator** — tests data-portability exports for machine-readable completeness and correct schemas.
101542. **Profile-enrichment consent auditor** — checks that inferred attributes like interests and segments are only built with a lawful basis.
101543. **Ad-targeting segment leak prober** — tests whether advertising segments expose sensitive inferences to third parties or the user.
101544. **Session-replay consent gate verifier** — confirms session-replay tools only activate after analytics consent instead of on page load.
101545. **Fingerprinting vector inventory** — enumerates device-fingerprinting signals collected without consent so policy gaps surface.
101546. **CNAME-cloaking tracker detector** — reveals first-party-subdomain trackers that disguise third-party collection behind a friendly hostname.
101547. **Consent-string integrity validator** — parses IAB TCF consent strings to confirm they match the user's actual choices.
101548. **Vendor-list drift monitor** — alerts when new vendors appear in the consent framework without user notification.
101549. **Legitimate-interest objection tester** — checks that legitimate-interest claims can be objected to and that objection stops processing.
101550. **Opt-out propagation latency measurer** — measures how long opt-outs take to reach every processor and flags stale caches.
101551. **Marketing-consent separation checker** — verifies marketing opt-ins are collected separately from service terms instead of being bundled.
101552. **Pre-ticked box scanner** — detects pre-selected consent checkboxes that violate opt-in requirements.
101553. **Consent fatigue pattern detector** — flags nagging re-prompts that coerce consent after a user has already refused.
101554. **Withdrawal-ease comparer** — scores whether withdrawing consent is as easy as giving it and flags asymmetric flows.
101555. **Breach-notification readiness checker** — verifies breach-notification contacts and timelines are documented and reachable.
101556. **Incident retention override auditor** — distinguishes legal-hold retention from unlawful over-retention so incident workflows stay compliant.
101557. **Backup erasure propagation tracker** — follows an erasure request into backups to confirm propagation within declared windows.
101558. **Log-pipeline PII scrubber** — scans application logs for raw personal data that should have been masked or redacted.
101559. **Cache TTL personal-data reviewer** — checks CDN and application caches for personal data persisting past declared retention.
101560. **Search-index stale-data prober** — tests whether erased content lingers in internal search indexes or autocomplete suggestions.
101561. **Analytics-ID rotation checker** — verifies analytics identifiers rotate or reset when consent is withdrawn.
101562. **Attribution-window data cap tester** — confirms ad-attribution storage holds only the data and duration the policy allows.
101563. **CRM sync consent gatekeeper** — checks CRM syncs exclude users who withdrew consent before the next sync cycle.
101564. **Data-warehouse consent partition validator** — verifies warehouse partitions honor consent flags so withdrawn users drop out of pipelines.
101565. **Cross-device identity consent linker** — tests whether cross-device graphs only merge profiles when proper consent exists.
101566. **Household-inference boundary tester** — checks shared-household inferences do not leak one member's data to another.
101567. **Employee-access audit prober** — tests admin tooling for access controls and logging on personal data views.
101568. **Support-tool PII masking verifier** — confirms support dashboards mask personal data by default and log every unmasking.
101569. **API-key scope leakage checker** — tests whether scoped API keys can pull personal data outside their declared scope.
101570. **Webhook payload minimization auditor** — inspects outbound webhooks for personal fields beyond what integrations need.
101571. **OAuth scope overreach detector** — flags OAuth authorizations requesting scopes broader than the integration's function.
101572. **Partner-data-return erasure tester** — verifies data shared with partners is deleted there when the user erases it at the source.
101573. **Data-processing-agreement gap scanner** — checks that every detected processor has a declared agreement on file.
101574. **Minor-profiling prohibition tester** — confirms profiling and behavioral advertising stay off for accounts identified as children.
101575. **Sensitive-category inference blocker tester** — checks the app does not infer health, religion, or political data without explicit consent.
101576. **Health-data special-category gate** — verifies stricter consent gates around health-related inputs and wearables data.
101577. **Financial-data purpose lock tester** — confirms payment data is not reused for marketing without separate consent.
101578. **Precise-address minimization checker** — flags full addresses stored where only a postal code or city is needed.
101579. **Photo-metadata consent reviewer** — checks EXIF location and device data is stripped or consented before upload processing.
101580. **Voice-recording retention tester** — verifies voice clips and transcripts expire according to the stated retention policy.
101581. **Chat-transcript deletion prober** — tests that support chat transcripts honor user deletion requests across systems.
101582. **Face-blur enforcement checker** — confirms face-detection pipelines blur or consent-gate faces in user-uploaded media.
101583. **Age-estimation data minimizer** — checks age-verification flows discard source images after the check completes.
101584. **Document-upload lifecycle tracker** — follows ID-document uploads from capture to deletion to confirm no stray copies remain.
101585. **Consent-language clarity scorer** — grades consent copy for plain-language clarity versus legalese that obscures meaning.
101586. **Layered-notice depth tester** — verifies layered privacy notices actually reveal details instead of burying them.
101587. **Just-in-time notice trigger checker** — confirms contextual notices appear when sensitive data is collected and not only in the policy.
101588. **Privacy-dashboard accuracy auditor** — compares the user-facing privacy dashboard against the real backend data map.
101589. **Download-your-data diff engine** — diffs successive data exports to reveal newly collected categories the user never noticed.
101590. **Shadow-profile existence prober** — tests whether non-users or logged-out visitors accumulate identifiable profiles.
101591. **Guest-checkout data retention checker** — verifies guest purchases do not create persistent profiles without consent.
101592. **Newsletter double-opt-in verifier** — confirms email subscriptions require confirmation before marketing begins.
101593. **Unsubscribe cascade tester** — unsubscribes and checks every channel including email, SMS, and push actually stops.
101594. **Re-permission campaign auditor** — checks re-consent campaigns honor prior refusals instead of resetting them.
101595. **Transfer-impact assessment helper** — generates draft transfer-risk summaries from observed flows for reviewer sign-off.
101596. **Records-of-processing auto-drafter** — drafts Article-30-style processing records from the agent's data map for human review.
101597. **DPIA trigger detector** — flags new high-risk processing such as biometrics or large-scale profiling that should trigger an impact assessment.
101598. **Privacy-by-design checklist runner** — scores new features against a minimization and consent checklist before release.
101599. **Vendor-risk tiering engine** — ranks detected processors by data sensitivity and volume for review prioritization.
101600. **Consent-version migration tracker** — follows users across consent-policy versions to confirm re-consent happened where required.
101601. **Legacy-consent grandfathering auditor** — checks old consents collected under prior rules were refreshed rather than assumed valid.
101602. **Regulator-request readiness packager** — assembles evidence packs of consent logs, data maps, and erasure proofs for audit responses.
101603. **Breach-scope data classifier** — classifies exposed fields in an incident to estimate notification obligations by data category.
101604. **Privacy-maturity scorecard builder** — rolls findings into a maturity score so teams can track privacy posture over time.
101605. **DMARC policy coverage mapper** — queries _dmarc records for the domain and every active subdomain to flag any lacking a DMARC policy, since one unprotected subdomain can be spoofed to impersonate the brand.
101606. **SPF record presence checker** — verifies each sending domain publishes a valid SPF record so receiving servers can authenticate outbound mail and reject forgeries.
101607. **DKIM selector discovery sweep** — enumerates published DKIM selectors for a domain to find stale or weak selectors that attackers could abuse for signature forgery.
101608. **DMARC alignment verifier** — tests whether SPF and DKIM results actually align with the visible From domain, because authentication without alignment still lets lookalike domains pass.
101609. **Enforcement-depth grader** — distinguishes p=none monitoring policies from quarantine and reject enforcement so teams know whether their published policy actually blocks spoofed mail.
101610. **Aggregate-report ingestion monitor** — parses DMARC rua aggregate reports into a dashboard tracking authentication pass rates and flagging unauthorised senders using the brand's identity.
101611. **Failure-report triage assistant** — processes DMARC ruf forensic reports to separate real spoofing campaigns from misconfigured legitimate senders before deliverability is damaged.
101612. **Lookalike domain authentication scanner** — checks cousin and homograph domains for missing authentication records, since attackers register these specifically to bypass the real domain's protections.
101613. **Subdomain policy inheritance auditor** — confirms the DMARC sp tag and wildcard policies actually cascade to subdomains instead of leaving gaps attackers can exploit.
101614. **Authentication-result drift tracker** — compares current SPF, DKIM and DMARC evaluation results against a baseline so configuration regressions are caught before spoofers notice.
101615. **SPF DNS lookup budget auditor** — counts the DNS lookups a flattened SPF record would trigger and warns past the 10-lookup limit, because exceeding it returns permerror and fails authentication.
101616. **SPF include-chain mapper** — recursively expands all include and redirect mechanisms into the full IP and range list so overly broad third-party sends become visible.
101617. **SPF softfail-vs-fail reviewer** — flags records ending in ~all instead of -all, because softfail leaves receiving servers accepting forged mail rather than rejecting it.
101618. **Overpermissive SPF range detector** — identifies SPF entries authorising entire cloud-provider ranges or /16 blocks where only a single mail server's /32 is needed.
101619. **Orphaned vendor include pruner** — cross-references SPF includes against active vendor contracts and flags senders the company stopped using so stale authorisations can be removed.
101620. **DKIM key-length adequacy checker** — reads published public keys and flags RSA keys under 2048 bits that an attacker could factor to forge signatures.
101621. **DKIM selector rotation monitor** — tracks selector creation dates and alerts on keys older than the rotation policy so long-lived keys do not accumulate exposure.
101622. **DKIM canonicalization reviewer** — inspects the chosen canonicalization algorithm and signed header list because relaxed modes and unsigned headers let attackers alter content while keeping the signature valid.
101623. **Unused selector cleanup scanner** — finds published selectors no longer used in signing that should be revoked, since every live selector is a target for cryptanalysis.
101624. **DKIM replay protection assessor** — checks whether signed messages can be replayed verbatim to new recipients, recommending short-lived signatures or body-hash bindings where replay would matter.
101625. **DMARC record syntax validator** — parses the DMARC TXT record for ordering errors, unknown tags and malformed URIs that silently disable reporting or enforcement.
101626. **Report mailbox deliverability tester** — verifies rua and ruf endpoints actually receive reports so the team does not operate blind while believing monitoring is active.
101627. **Report volume anomaly detector** — watches aggregate-report volume for spikes indicating either a spoofing campaign or a newly deployed legitimate sender failing authentication.
101628. **Graduated enforcement planner** — recommends a staged path from p=none through quarantine to reject with per-stage pass-rate thresholds so enforcement rolls out without breaking legitimate mail.
101629. **External reporting domain authorizer** — confirms third-party report recipients have published the required external-verification records so reports are not silently discarded.
101630. **Authorised spoofing test harness** — sends controlled spoofed messages against the client's own domains with written approval to prove whether DMARC reject actually stops them at the gateway.
101631. **Display-name deception probe** — tests whether the mail gateway flags messages whose display name mimics executives while the envelope address differs, since display-name spoofing drives most CEO fraud.
101632. **Unicode lookalike sender tester** — uses authorised homograph variants of the domain to check that the gateway flags or quarantines them rather than delivering them normally.
101633. **Reply-To mismatch detector** — crafts messages whose Reply-To points off-domain and verifies the gateway surfaces the mismatch, because reply-to hijacking is the quietest social-engineering vector.
101634. **Sender-header spoofing audit** — inspects whether the MTA strips or rewrites deceptive Sender, Resent-From and Return-Path headers instead of passing them through to users.
101635. **Null-envelope handling tester** — checks how the gateway treats null bounce addresses that bypass SPF, confirming it falls back to HELO checks rather than waving the message through.
101636. **Forwarded-mail authentication assessor** — evaluates how mailing-list forwarding and SRS rewriting affect SPF results on the client's domains so forwarded mail is neither spoofed nor needlessly dropped.
101637. **Attachment-name deception checker** — tests whether the gateway flags double extensions and RTL-override filenames that disguise executables as documents in brand-impersonating mail.
101638. **BEC pattern rule evaluator** — runs sample business-email-compromise phrasing such as urgent wire transfers and gift-card requests past the gateway's detection rules to measure how much still reaches inboxes.
101639. **Spoofing test results ledger** — records every authorised spoofing test with its disposition so the client can prove improvement over time and auditors can replay the evidence.
101640. **Push token registration abuse tester** — verifies the API binds device tokens to authenticated sessions so an attacker cannot register a victim's token and harvest their notifications.
101641. **Cross-user push leakage probe** — tests whether push endpoints can be called for another user's ID to trigger notifications that leak account events or enable harassment.
101642. **Push payload minimisation reviewer** — inspects notification payloads for sensitive fields like balances, OTPs and names that sit on third-party push infrastructure longer than necessary.
101643. **Notification preference bypass checker** — confirms disabled categories stay silent and that marketing cannot ride on transactional channels after an opt-out.
101644. **Push deep-link authorization audit** — opens every deep link a notification can carry under a different session to ensure the target screen still enforces its own access control.
101645. **Silent-push wakeup abuse tester** — measures whether the app honours silent pushes as background wakeups beyond documented limits, which would enable battery drain or covert data sync.
101646. **Rich push content validator** — checks images and actions attached to notifications for origin verification so a compromised push service cannot inject arbitrary content.
101647. **Push receipt metadata exposure audit** — reviews delivery and read receipts for metadata revealing whether a recipient is online, asleep or ignoring messages.
101648. **Expired-token push retention tester** — verifies that uninstalled or revoked devices stop receiving pushes promptly instead of lingering in the fan-out table.
101649. **Emergency-alert channel integrity test** — confirms high-priority alert channels cannot be triggered by non-emergency API calls that would let attackers panic a user base.
101650. **SMS OTP interception risk assessor** — evaluates whether OTPs are the sole factor and whether the flow detects SIM-change or number-port events that indicate interception.
101651. **OTP brute-force rate-limit tester** — measures how many code guesses the verification endpoint tolerates, because an unthrottled six-digit space falls quickly.
101652. **OTP reuse and replay checker** — verifies a consumed or expired code cannot be replayed in a second session, since replayable OTPs defeat the entire channel.
101653. **Sender-ID spoofing awareness check** — tests whether the app educates users that SMS sender IDs can be faked, and whether support scripts confirm codes only through the app itself.
101654. **OTP fallback-channel auditor** — inspects voice-call and SMS fallback logic to ensure a downgraded channel does not strip the rate limits and expiry that protect the primary one.
101655. **OTP error-message enumeration tester** — checks whether wrong-code, expired-code and unknown-number responses are indistinguishable so attackers cannot harvest valid accounts.
101656. **Concurrent OTP session tester** — requests multiple codes in parallel to confirm only the latest is valid and older ones cannot be raced against new logins.
101657. **OTP length and entropy reviewer** — audits code length, lifetime and randomness source because short predictable codes sent over SMS are the weakest link in the login chain.
101658. **SIM-swap signal reviewer** — checks whether the backend consumes carrier or device signals on number changes and forces step-up verification when the SIM looks new.
101659. **SMS OTP cost-abuse monitor** — watches outbound OTP volume for toll-fraud patterns where attackers trigger floods of messages to premium or attacker-controlled numbers.
101660. **Contact-form header injection tester** — submits newline characters in name, subject and email fields to confirm the mailer rejects or sanitises them instead of injecting extra headers.
101661. **BCC injection probe** — tests whether a crafted recipient field can smuggle BCC headers into the outgoing message, turning the form into a spam relay.
101662. **Subject-line injection checker** — verifies subject input cannot inject additional headers or alter MIME boundaries that would let an attacker attach arbitrary content.
101663. **Reply-to poisoning tester** — confirms the form does not copy attacker-supplied Reply-To values into outbound mail, which would redirect victim replies to the attacker.
101664. **MIME boundary tampering probe** — checks whether file-upload fields in contact forms can inject MIME parts that execute or exfiltrate when the recipient opens the message.
101665. **Form From-address limiter** — ensures the form's From address is fixed to the site's own address with the user's address only in Reply-To, preventing the form from sending mail as arbitrary people.
101666. **Contact-form rate-limit auditor** — measures submission throttling so the form cannot be weaponised as an anonymous mail cannon against third parties.
101667. **Auto-responder reflection checker** — tests whether confirmation emails echo attacker input unsanitised, which would make the responder a reflected-content delivery service.
101668. **Attachment mail-flow reviewer** — audits whether user-supplied attachments pass through malware scanning and type enforcement before the mailer forwards them.
101669. **Multi-recipient parameter tester** — verifies recipient lists cannot be expanded through array or comma injection in form fields, keeping each submission to its intended destination.
101670. **Webhook signature verification tester** — replays a captured notification webhook with an altered payload and no valid HMAC to confirm the receiver rejects it.
101671. **Webhook secret rotation reviewer** — checks that signing secrets can be rotated without downtime and that old secrets stop working, so a leaked secret has a short blast radius.
101672. **Timestamped-signature freshness checker** — verifies the receiver enforces a tight timestamp window on signed webhooks so captured requests cannot be replayed hours later.
101673. **Webhook endpoint authentication audit** — confirms every notification endpoint requires its signature check and that no legacy unsigned route remains reachable.
101674. **Out-of-order webhook handler tester** — sends duplicate and reordered webhooks to confirm idempotency keys prevent double-processing of payments and state changes.
101675. **Webhook source-IP control checker** — tests whether documented source-IP restrictions are actually enforced or merely described in docs, since allowlists without signatures leave endpoints exposed.
101676. **Event-type confusion probe** — delivers a test event with a swapped event type to confirm the receiver validates the type against its subscription instead of acting on any well-formed payload.
101677. **Webhook retry-storm limiter** — measures whether failed deliveries trigger bounded exponential backoff rather than unbounded retries that could overwhelm the receiver.
101678. **Secret exposure in logs scanner** — greps receiver logs and error responses for leaked webhook secrets that would let anyone forge future notifications.
101679. **Dead-letter queue reviewer** — audits how undeliverable webhooks are stored and who can read them, since queued payloads often contain PII and payment data.
101680. **Unsubscribe token entropy tester** — checks that one-click unsubscribe tokens are unguessable so attackers cannot mass-unsubscribe users or harvest valid addresses.
101681. **Unsubscribe token binding checker** — verifies tokens are bound to a specific recipient and campaign so one token cannot unsubscribe arbitrary users.
101682. **Unsubscribe CSRF exposure tester** — confirms GET-based unsubscribe links cannot be triggered by third-party image loads and that state-changing unsubscribes need a tokenised POST.
101683. **List-unsubscribe header auditor** — inspects List-Unsubscribe and List-Unsubscribe-Post headers for correct one-click support, which keeps complaint rates low and deliverability high.
101684. **Resubscribe flow integrity tester** — checks that resubscribing after an unsubscribe requires fresh consent rather than silently reactivating, to stay on the right side of anti-spam rules.
101685. **Password-reset token strength reviewer** — audits reset-token entropy, single-use enforcement and expiry so a leaked or guessed token cannot hand over the account.
101686. **Reset-link context binding tester** — checks whether reset links are bound to the requesting session or network context, limiting the damage if a link is intercepted.
101687. **Email-change confirmation flow auditor** — verifies changing the account email requires confirming both the old and new addresses, otherwise an attacker can silently steal the account.
101688. **Magic-link replay tester** — confirms passwordless login links work exactly once and expire quickly, since a replayable magic link is a permanent backdoor.
101689. **Verification-link scope limiter** — ensures email verification tokens cannot be reused for password resets or other actions, keeping each token's blast radius narrow.
101690. **Calendar-invite phishing assessor** — tests whether the mail gateway strips or flags unsolicited .ics invites with deceptive titles and URLs, a vector users rarely suspect.
101691. **Auto-added event injection tester** — checks whether calendar apps auto-add events from unauthenticated senders, which would let attackers plant fake meetings and malicious links.
101692. **Invite-update spoofing checker** — sends forged event updates that move or cancel real meetings to confirm the client verifies the organiser's identity before applying changes.
101693. **RSVP phishing redirect probe** — tests whether RSVP accept and decline flows can redirect users to credential-harvesting pages disguised as calendar confirmations.
101694. **Calendar attachment scanning tester** — verifies .ics attachments pass through the same malware scanning as other attachments rather than being trusted as benign scheduling data.
101695. **Transactional-template injection reviewer** — submits template variables containing markup and script syntax to confirm the mail templating engine escapes them instead of executing them.
101696. **Subject-line template tester** — checks whether user data merged into email subjects can inject newlines or control characters that alter the message structure.
101697. **Template preview access-control audit** — verifies email template preview endpoints require authentication so attackers cannot iterate injection attempts against live templates.
101698. **Locale-template fallback reviewer** — inspects how missing translations fall back between locales, since a fallback path that skips escaping would open injection in one language only.
101699. **Merge-tag disclosure limiter** — tests whether template error messages reveal internal merge tags and data fields that an attacker could then target.
101700. **BIMI readiness checker** — validates the BIMI DNS record and its verified mark certificate so the brand logo only appears when authentication is genuinely enforced.
101701. **MTA-STS deployment tester** — confirms the MTA-STS policy and TLS-RPT reporting are published and enforced, closing the door on SMTP downgrade and interception.
101702. **Bounce information-leak tester** — checks that non-delivery reports do not expose internal routing, usernames or the existence of valid internal addresses.
101703. **Tracking-pixel consent auditor** — reviews whether open-tracking pixels honour consent choices and do not fire in sensitive transactional mail where tracking was never agreed.
101704. **Reply-all storm guard reviewer** — tests whether mailing lists and notification groups enforce reply-to-list controls and size limits so one message cannot cascade into an organisation-wide storm.
101705. **Vault storage backend encryption audit** — verifies the secrets vault's storage backend encrypts data at rest with managed keys so a stolen disk never yields plaintext secrets.
101706. **Vault seal-status drift monitor** — watches seal and unseal state transitions to catch unauthorized unseal operations that would expose the master key.
101707. **Vault audit device coverage checker** — confirms every secrets engine has an audit device enabled so no secret read ever goes unlogged.
101708. **Vault AppRole secret-ID TTL enforcer** — validates AppRole secret IDs carry short TTLs and single-use constraints so stolen role credentials expire before abuse.
101709. **Vault token max-TTL compliance scanner** — audits issued tokens against max-TTL policy to surface long-lived tokens that bypass rotation expectations.
101710. **Vault policy least-privilege reviewer** — diffs granted vault policies against actual access patterns to flag overbroad paths that expand blast radius.
101711. **Vault root-token existence detector** — checks whether an initialized root token still exists and pushes for its revocation since standing root access defeats all controls.
101712. **Vault transit engine key-rotation verifier** — confirms data-encryption keys in the transit engine rotate on schedule and old versions are disabled after rewrap.
101713. **Kubernetes etcd secret-encryption validator** — verifies the API server encrypts secrets at rest in etcd rather than storing readable base64 blobs.
101714. **Idle pod service-token automount remover** — flags pods that automount service-account tokens they never use, shrinking the token theft surface.
101715. **Kubernetes imagePullSecret scope reviewer** — checks registry credentials are namespaced and minimal so one compromised pull secret cannot reach every registry.
101716. **Helm values secret-plaintext scanner** — scans rendered Helm values and charts for plaintext passwords that should live in sealed or external secrets.
101717. **Sealed-secrets key-custody checker** — verifies the sealed-secrets controller key is backed up and rotated so encrypted secrets remain recoverable after cluster rebuilds.
101718. **External-secrets operator misconfiguration hunter** — audits external-secrets refresh intervals and deletion policies so stale or orphaned secrets do not linger.
101719. **SOPS age-key rotation tracker** — confirms SOPS encryption keys rotate and old recipients are removed, preventing former maintainers from decrypting current secrets.
101720. **Terraform state secret-residue scanner** — inspects Terraform state files and remote backends for embedded credentials that state snapshots silently preserve.
101721. **Terraform plan output redaction tester** — runs plans in CI to confirm sensitive values are masked rather than printed into pipeline logs.
101722. **Docker build-arg secret leakage probe** — builds images while monitoring layers to prove build-time secrets never persist in final image history.
101723. **Docker image layer secret harvester** — scans every layer of published images for credentials baked in by accident so exposed images can be revoked and rebuilt.
101724. **Build-stage credential containment verifier** — verifies secrets used in build stages are not copied into runtime stages of multi-stage Dockerfiles.
101725. **Container registry credential rotation validator** — tests that registry tokens rotate and old tokens are revoked so leaked pull credentials lose value quickly.
101726. **Git history secret residue scanner** — walks full git history including rewritten branches for credentials that survive in old commits.
101727. **Repository hook secret-scan enforcement checker** — confirms secret-scanning hooks run on every developer clone so new credentials never reach the remote.
101728. **Fork and PR secret-leak watcher** — monitors forks, PR diffs, and comments for pasted credentials before they merge into the mainline.
101729. **GitHub Actions secret-masking verifier** — runs workflows with canary values to prove masked secrets never appear in logs, annotations, or error output.
101730. **GitHub Actions OIDC migration checker** — identifies workflows still using long-lived cloud credentials that could switch to short-lived OIDC federation.
101731. **Workflow artifact env-dump detector** — scans uploaded CI artifacts for environment dumps and debug archives that bundle secrets.
101732. **CI cache secret-poisoning tester** — checks whether cached dependencies or layers can smuggle credentials between unrelated pipeline runs.
101733. **CI log retention secret scrubber** — verifies log-retention pipelines redact detected secrets even in archived runs from before redaction was enabled.
101734. **Self-hosted runner credential isolation audit** — confirms ephemeral runners wipe disks and credential stores between jobs so one job cannot read another's secrets.
101735. **Deploy-key staleness reviewer** — lists repository deploy keys with age and last use so forgotten keys with write access get rotated or removed.
101736. **Stale OAuth grant revoker** — enumerates third-party OAuth authorizations per user and flags grants that outlive their business need.
101737. **Offboarded-employee token sweeper** — cross-references HR offboarding dates with active tokens to catch credentials that survived deprovisioning.
101738. **Shared team-credential vault migrator** — finds shared passwords in chat and docs and migrates them into the vault with individual access controls.
101739. **Emergency-access account activity sentinel** — watches emergency access accounts for any use outside declared incidents and forces credential rotation after each use.
101740. **IAM access-key age enforcer** — flags cloud access keys older than the rotation policy and confirms unused keys are deleted rather than disabled.
101741. **Unused credential detector** — correlates secret last-access timestamps with activity logs to retire credentials nobody has touched in months.
101742. **Root and break-glass cloud key hunter** — searches for active root or owner-level API keys that should be replaced with scoped service identities.
101743. **Workload impersonation privilege-path grapher** — graphs which service accounts can impersonate which others to expose privilege-escalation paths through chained trust.
101744. **Workload-identity federation verifier** — confirms workloads authenticate via federated identity instead of static keys that need rotation.
101745. **Database connection-string vaulting checker** — scans app configs for embedded database passwords and verifies they resolve from the vault at runtime.
101746. **RDS IAM-auth adoption tester** — checks database fleets for password auth that could move to short-lived IAM authentication tokens.
101747. **Connection-pool credential scoping reviewer** — verifies pooled database credentials carry minimal grants per service instead of shared superuser access.
101748. **SSH authorized-keys hygiene scanner** — inventories authorized keys across fleets to remove unknown, duplicated, or departed-user keys.
101749. **SSH certificate-authority adoption checker** — evaluates migration from static authorized keys to short-lived SSH certificates that expire automatically.
101750. **TLS private-key exposure hunter** — scans repos, artifacts, and endpoints for private keys that must never leave the HSM or vault.
101751. **Certificate expiry early-warning engine** — tracks every certificate's expiry with escalation so services never fail over to emergency self-signed certs.
101752. **ACME automation coverage auditor** — measures what fraction of certificates renew automatically to eliminate manual renewals that get forgotten.
101753. **JWT signing-key rotation verifier** — confirms signing keys rotate on schedule and that tokens signed by retired keys are rejected.
101754. **Long-lived JWT discovery scanner** — inventories issued tokens by lifetime to find multi-year tokens that should be short-lived with refresh rotation.
101755. **Refresh-token rotation and reuse detector** — tests that refresh tokens rotate on use and that reuse triggers revocation, blocking token replay.
101756. **OAuth client-secret storage reviewer** — checks that OAuth client secrets live in the vault with rotation rather than in code or config files.
101757. **Webhook shared-secret rotation tester** — verifies webhook signing secrets rotate without downtime and old secrets stop validating after cutover.
101758. **API-key scoping and quota auditor** — reviews API keys for environment, IP, and permission scoping so a leaked key cannot reach production data.
101759. **Mobile-app embedded secret extractor** — decompiles shipped apps to find hardcoded API keys and backend credentials that ship to every device.
101760. **JavaScript bundle secret scanner** — parses production bundles for embedded tokens and keys that any visitor can read from source.
101761. **Error-page secret leakage probe** — triggers application errors to confirm stack traces and debug pages never echo credentials or connection strings.
101762. **Debug-endpoint credential exposure tester** — probes staging and forgotten debug routes for endpoints that dump configuration including secrets.
101763. **Support-ticket credential scrubber** — scans helpdesk tickets and attachments for pasted passwords and redacts them before agents or archives see them.
101764. **ChatOps secret-paste detector** — watches team chat and incident channels for credential pastes and triggers rotation when one is found.
101765. **Session-replay password capture blocker** — verifies analytics and session-replay tools mask password and card fields so recordings never store secrets.
101766. **APM header-capture redaction verifier** — confirms observability agents redact authorization headers and cookies before shipping traces off-host.
101767. **Structured-log secret scrubbing tester** — injects canary credentials through the app to prove log pipelines redact them at every hop.
101768. **Crash-dump secret sanitizer** — checks core dumps, minidumps, and crash reports for in-memory secrets and enforces sanitization before upload.
101769. **Shell-history credential cleaner** — scans shell histories across jump hosts for typed passwords and enforces history-ignore protections.
101770. **Process-list secret exposure probe** — inspects running process arguments for credentials passed on command lines visible to every local user.
101771. **Proc-environ leakage tester** — verifies /proc environment reads are restricted so container and process secrets are not world-readable.
101772. **Memory-protection (mlock) adoption checker** — confirms secret-handling processes lock sensitive pages out of swap so secrets never reach disk.
101773. **Backup-archive credential residue scanner** — opens database dumps, VM snapshots, and file backups to find credentials that backups silently preserve.
101774. **Snapshot-sharing exposure reviewer** — audits shared cloud snapshots and AMIs for embedded secrets before they reach other accounts.
101775. **Backup vault customer-key encryption confirmer** — confirms backup vaults and archives encrypt with customer-managed keys that rotate independently.
101776. **Log-archive secret retro-scrubber** — reprocesses historical log archives to redact credentials that were logged before redaction rules existed.
101777. **Email credential-hygiene scanner** — searches mail archives for password resets and shared credentials to drive migration into the vault.
101778. **Secret-sharing link expiry enforcer** — audits one-time secret-sharing links for expiry and burn-after-read so shared secrets do not live forever.
101779. **Honeytoken deployment manager** — plants canary credentials across repos, vaults, and configs so any use triggers an immediate intrusion alert.
101780. **Impossible-access secret anomaly detector** — baselines normal secret-access patterns to flag reads from new geographies or at unusual hours.
101781. **Secret-access velocity alerter** — watches for sudden spikes in secret reads that indicate bulk exfiltration rather than normal use.
101782. **Dormant-secret reactivation watcher** — alerts when a long-unused credential suddenly becomes active, a classic sign of compromise.
101783. **KMS key-rotation compliance dashboard** — tracks every customer-managed key against its rotation schedule with evidence for auditors.
101784. **Envelope-encryption adoption verifier** — confirms application-layer encryption wraps data keys per record instead of sharing one global key.
101785. **Vault replication-scope minimizer** — checks that secrets replicate only to regions with a business need, shrinking cross-border exposure.
101786. **Cross-account secret-sharing auditor** — inventories secrets shared across cloud accounts and verifies each share still has an owner and expiry.
101787. **Third-party webhook-secret inventory** — catalogs vendor webhook secrets with rotation dates so partner integrations do not run on forgotten credentials.
101788. **Vendor API-key least-privilege reviewer** — audits third-party API keys for minimal scopes and IP allowlists so vendor breaches stay contained.
101789. **Service-mesh certificate rotation monitor** — watches mesh-issued workload certificates for healthy automatic rotation without manual intervention.
101790. **SPIFFE workload-identity coverage checker** — measures which services use short-lived SPIFFE identities versus static credentials that need rotation.
101791. **Just-in-time secret-access workflow tester** — validates that privileged secret checkouts require approval, expire automatically, and log every access.
101792. **Secret-checkout session recorder** — ensures just-in-time secret sessions are recorded and tied to tickets so access is always attributable.
101793. **Rotation game-day drill scheduler** — runs simulated mass-rotation exercises to prove the organization can rotate everything within its recovery targets.
101794. **Rotation-evidence collector for auditors** — compiles timestamped rotation logs into auditor-ready evidence without manual spreadsheet work.
101795. **Secret-version lifecycle pruner** — finds old but still-enabled secret versions in vaults and disables them after confirming nothing references them.
101796. **Soft-delete and purge-protection verifier** — confirms key vaults enforce soft-delete and purge protection so a compromised admin cannot permanently destroy secrets.
101797. **Developer-laptop credential sweeper** — scans workstations for plaintext AWS keys, kubeconfigs, and npm tokens that belong in the vault or SSO.
101798. **Dotenv and config-file secret hunter** — finds .env files committed or synced outside the vault and migrates them to managed secrets.
101799. **npmrc and pypirc token auditor** — inventories package-registry tokens on dev machines and in CI to replace long-lived tokens with short-lived ones.
101800. **Screenshot and recording secret redactor** — detects credentials visible in shared screenshots, demos, and recordings before they are published.
101801. **Analytics-key exposure limiter** — checks that only publishable keys ship client-side while secret keys stay server-side with rotation.
101802. **Feature-flag service key scoper** — verifies feature-flag SDK keys are environment-scoped so a leaked client key cannot toggle production flags.
101803. **DNS TXT record secret cleaner** — finds verification tokens and credentials lingering in DNS TXT records long after their one-time use.
101804. **Decommissioned-service credential tombstoner** — tracks credentials of retired services to confirm they are revoked rather than lingering as forgotten access.
101805. **Live vendor script census engine** — constructs a live census of every externally loaded script across rendered pages so security teams see the true vendor footprint instead of an outdated spreadsheet.
101806. **Script provenance timeline tracker** — records which tag manager, CMS plugin, or commit introduced each third-party script so ownership is traceable when a vendor turns hostile.
101807. **Subresource integrity drift monitor** — compares live script hashes against the pinned SRI values in the page to catch silently altered vendor code before users run it.
101808. **Script content-change alerting engine** — diffs fetched vendor scripts between scheduled snapshots so an unexpected code change triggers review instead of silent execution.
101809. **Shadow vendor appearance detector** — flags scripts loading from domains never seen in the approved vendor inventory so unapproved trackers get caught on first sight.
101810. **Orphaned tag cleanup finder** — identifies third-party scripts firing on pages where their tag was supposed to be removed so stale vendor access cannot linger after offboarding.
101811. **Script load-order dependency mapper** — reconstructs the sequence in which third-party scripts bootstrap each other so a compromised early loader's blast radius is fully understood.
101812. **Fourth-party dependency chain graph** — follows script-initiated loads two levels deep to expose hidden sub-vendors that inherit full page privileges without any contract.
101813. **Vendor bundle diff viewer** — renders a readable diff of changed vendor bundles between versions so reviewers can judge whether the change is routine or suspicious.
101814. **CDN endpoint swap detector** — watches the resolved hostnames of vendor scripts to spot a quiet redirect from a trusted CDN to an attacker-controlled domain.
101815. **Unpinned script version auditor** — flags vendor loaders fetching floating versions such as latest that let the vendor push arbitrary code with no change control.
101816. **Minified-bundle anomaly scanner** — compares minified vendor payloads against size and structure baselines to catch injected code hiding inside routine updates.
101817. **Async execution-order verifier** — checks that async and deferred third-party scripts cannot race ahead of first-party security initialization such as consent enforcement.
101818. **Resource-hint leakage checker** — audits preconnect and prefetch hints that reveal planned third-party destinations before any user interaction justifies them.
101819. **Consent-gated loading verifier** — confirms non-essential vendor scripts actually wait for consent instead of loading on page start while treating the banner as decoration.
101820. **Tag-manager container permission auditor** — enumerates every user, role, and publish right on the tag container to close over-privileged vendor and agency accounts.
101821. **Container snapshot differ** — exports the full tag-manager configuration before and after each publish to highlight added tags, changed triggers, and loosened permissions.
101822. **Custom HTML tag code reviewer** — statically scans custom tags inside the container for data harvesting, obfuscation, or off-domain exfiltration before they reach production.
101823. **Container user-access roster auditor** — cross-checks tag-manager users against HR and vendor-contract lists so departed contractors lose publish rights.
101824. **Publish-history forensics timeline** — reconstructs who published which change and when so a malicious tag insertion can be traced to its origin.
101825. **Tag firing-trigger condition auditor** — reviews every trigger rule for over-broad conditions such as all-pages that hand tags data they never needed.
101826. **Data-layer schema enumerator** — catalogs every key pushed to the data layer so reviewers know exactly which user facts are available to any tag.
101827. **Data-layer PII push detector** — scans data-layer pushes for emails, names, and identifiers that tags can read and forward without restriction.
101828. **Container rollback integrity checker** — verifies that a rolled-back container version actually restores the prior state and that no orphaned tags survive the revert.
101829. **Multi-container conflict detector** — finds pages running two or more tag containers that can override each other's blocking rules and consent gates.
101830. **Server-side tag gateway auditor** — inspects server-side tag gateways for unauthenticated event ingestion that lets anyone inject forged conversion data.
101831. **Container preview-mode exposure checker** — confirms container preview and debug endpoints are not publicly reachable with live production data flowing through them.
101832. **Custom JavaScript variable reviewer** — audits tag-manager variables for unsafe DOM scraping logic that reads passwords, card fields, or session tokens.
101833. **Tag blocking-trigger gap analyzer** — finds pages and events where blocking triggers are missing so consent-exempted tags cannot slip through unprotected paths.
101834. **Container ownership transfer verifier** — validates that container admin ownership moved cleanly after agency handoffs instead of lingering with the old vendor.
101835. **Chat-widget keystroke capture detector** — monitors whether support chat widgets record keystrokes before the visitor presses send, which turns casual typing into exfiltrated data.
101836. **Chat transcript retention auditor** — checks the vendor's stated retention period against actual API behavior to confirm old conversations really become unretrievable.
101837. **Chatbot PII redaction verifier** — feeds synthetic personal data into the chat and inspects stored transcripts to prove redaction rules actually strip it.
101838. **Chat consent-timing checker** — verifies the widget loads and initializes only after the visitor accepts the relevant cookie and privacy consent.
101839. **Co-browsing data-scope limiter reviewer** — audits co-browse sessions to confirm masked fields stay masked for the support agent and no full-page control is granted silently.
101840. **Chat vendor subprocessor mapper** — lists the chat provider's own subprocessors and data centers so user conversations do not transit unvetted fourth parties.
101841. **Chat idle-tab persistence checker** — tests whether a chat session keeps sensitive transcript data in storage after the tab idles so stale sessions can be expired safely.
101842. **Proactive-chat trigger abuse reviewer** — examines automatic chat pop-ups for pretexting patterns that trick visitors into volunteering account details.
101843. **Support attachment handling checker** — verifies chat and ticket widgets scan uploads and store them in isolated buckets instead of executable web roots.
101844. **Chat transcript export-path auditor** — traces every route by which transcripts leave the vendor, from exports to webhooks to CRM sync, to close unmonitored data exits.
101845. **Payment-iframe isolation verifier** — confirms card fields render inside a properly isolated cross-origin iframe that no first-party script can read keystrokes from.
101846. **Payment-iframe origin allowlist checker** — validates that only the vetted payment provider origin may frame or message the checkout iframe.
101847. **Card-iframe sandbox attribute reviewer** — audits sandbox flags on payment iframes to ensure the least-privilege set that still processes payments.
101848. **Payment-button overlay detector** — scans the checkout DOM for invisible elements layered over pay buttons that could intercept clicks or card data.
101849. **PCI scope-creep detector** — finds cardholder data fields rendered outside the provider iframe, which silently expands the site's PCI compliance burden.
101850. **Digital-wallet token flow auditor** — traces wallet callbacks such as Apple Pay and Google Pay to confirm tokens never touch merchant servers in readable form.
101851. **Payment-iframe postMessage reviewer** — audits cross-origin messages around the payment iframe for missing origin checks that could leak transaction state.
101852. **3-D Secure challenge origin checker** — verifies 3DS challenge iframes load from the card scheme's genuine domains and not lookalike hosts.
101853. **Saved-card autofill scope verifier** — confirms browser autofill fills card data only into the provider's iframe and never into first-party fields.
101854. **Payment-vendor footprint minimizer** — measures how many vendor scripts and cookies run on checkout pages so non-essential trackers can be evicted from the payment flow.
101855. **Consent-banner tracker bypass detector** — loads the site while refusing consent and flags any analytics or ad requests that fire anyway, proving the banner is cosmetic.
101856. **Pre-consent beacon blocker verifier** — confirms tracking pixels and beacons are physically blocked before consent rather than merely flagged as pending.
101857. **Consent-signal propagation auditor** — checks that the user's choice propagates to every vendor through the consent framework so no tag reads a stale accepted default.
101858. **Consent-refusal path tester** — verifies rejecting cookies is as easy and functional as accepting them, closing dark patterns that coerce consent.
101859. **Geo-consent differential tester** — compares tracker behavior across regions to catch vendors that honor consent in the EU but ignore it elsewhere.
101860. **Consent-mode modeled-data leakage checker** — audits consent-mode analytics pipelines to ensure modeled conversions cannot be reverse-engineered to identify individuals.
101861. **Post-opt-out re-identification detector** — watches for fingerprinting or ID syncing that rebuilds a user profile after the user opted out of tracking.
101862. **Cookie respawn-after-withdrawal detector** — withdraws consent and re-scans storage to catch trackers that resurrect deleted identifiers.
101863. **Vendor-list freshness checker** — verifies the consent banner's vendor list matches the vendors actually firing so new trackers cannot hide behind an old list.
101864. **First-party proxy tracker disclosure checker** — detects tracking endpoints disguised as first-party subdomains and confirms they are disclosed in the privacy policy.
101865. **Embedded-video SDK leakage checker** — inspects video players for watch-history and identifier beacons sent to ad networks beyond the stated video host.
101866. **Analytics SDK field-redaction verifier** — sends synthetic PII through site forms while the analytics SDK runs to prove its redaction rules strip the sensitive fields.
101867. **Session-replay masking auditor** — replays recorded sessions in a test environment to confirm passwords and card fields appear masked rather than in cleartext.
101868. **Heatmap input-capture reviewer** — checks heatmap tools for configurations that record text input instead of only aggregated click and scroll data.
101869. **Video ad-network chain mapper** — traces the ad calls a video player makes to map every downstream ad exchange receiving viewer data.
101870. **Analytics event-schema PII sweeper** — audits the full event and property schema for free-text fields where PII routinely lands unnoticed.
101871. **Event-volume anomaly detector** — baselines analytics event rates per vendor and flags sudden spikes that signal a compromised or misconfigured SDK.
101872. **Cross-domain linker token checker** — reviews cross-domain analytics linker parameters for tokens that let third parties stitch user identities across sites.
101873. **Podcast-player tracker auditor** — inspects embedded audio players for listener-tracking pixels that follow users beyond the episode page.
101874. **Livestream embed data checker** — audits live video embeds and their chat overlays for viewer identifiers shared with streaming vendors.
101875. **Compromised-CDN substitution detector** — compares served vendor scripts against known-good hashes and reputations to catch a CDN serving tampered code.
101876. **Vendor TLS downgrade checker** — confirms third-party script and beacon endpoints enforce HTTPS with valid certificates so page assets cannot be intercepted.
101877. **Script-domain reputation monitor** — continuously scores vendor domains against threat feeds so a newly blacklisted domain triggers immediate review.
101878. **Typosquatted CDN domain detector** — scans script sources for lookalike CDN hostnames that mimic trusted vendors to slip in malicious code.
101879. **CDN cache-poisoning indicator checker** — probes vendor CDN URLs with cache-busting variants to detect poisoned cached copies served to visitors.
101880. **Script-behavior baseline anomaly detector** — profiles each vendor script's normal network and DOM behavior and flags new exfiltration endpoints or DOM scraping.
101881. **Vendor breach cross-reference engine** — matches the site's vendor inventory against public breach disclosures so a compromised supplier prompts urgent re-audit.
101882. **Emergency vendor kill-switch planner** — generates a tested removal plan per vendor, listing which tags to pause and what breaks, so a hostile script can be cut in minutes.
101883. **Last-known-good script restorer** — keeps signed snapshots of vendor bundles so a compromised version can be rolled back instantly without waiting for the vendor.
101884. **Multi-CDN failover integrity checker** — verifies fallback CDN URLs for critical scripts are pinned and integrity-checked so failover cannot be abused to inject code.
101885. **Embedded payment frame data-leak monitor** — watches payment iframe traffic for cardholder data reaching non-processor domains so checkout widgets cannot quietly exfiltrate PANs.
101886. **Sandbox allowlist gap analyzer** — reviews sandbox exception tokens such as allow-same-origin and allow-scripts for combinations that effectively remove the sandbox.
101887. **Nested-iframe privilege mapper** — traces privilege inheritance through nested iframes to find inner frames that gain more capability than intended.
101888. **postMessage origin-validation auditor** — fuzzes cross-origin messages to embedded widgets and flags handlers that act without verifying the sender origin.
101889. **iframe referrer-leakage checker** — inspects referrer policies on iframes to stop full page URLs, including tokens, from leaking to embedded third parties.
101890. **Embedded-map widget data checker** — audits map embeds for location queries and identifiers forwarded to the map provider beyond the visible tile request.
101891. **Iframe clickjacking exposure tester** — verifies embedded widgets and checkout iframes cannot be framed by attacker pages to hijack user clicks.
101892. **Cross-origin iframe read-access verifier** — confirms first-party scripts cannot read inside cross-origin iframes, preserving the isolation the design assumes.
101893. **Social-login token-leakage checker** — traces OAuth callback flows to ensure tokens and codes never pass through third-party scripts or referrer headers.
101894. **OAuth-button referrer detector** — checks that social login buttons do not leak the current page URL and session context to the identity provider's trackers.
101895. **Social-share widget tracker auditor** — measures which share buttons phone home on page load, identifying widgets that track visitors who never share anything.
101896. **One-tap login spoofing detector** — verifies one-tap sign-in prompts render only from the genuine identity provider origin and not from spoofable overlays.
101897. **Social-plugin data-scope reviewer** — audits social plugins for data access beyond login, such as friend lists or profile fields the product never uses.
101898. **A/B-testing tamper checker** — verifies experiment scripts cannot be manipulated by visitors to force winning variants or leak test-group assignments.
101899. **Experiment-variant leakage reviewer** — checks that A/B test payloads do not expose unreleased features or pricing logic to anyone reading the variant code.
101900. **Personalization-segment exfiltration checker** — audits personalization engines for audience segments and behavioral scores sent to third-party ad platforms.
101901. **Survey-widget data-collector auditor** — reviews popup surveys for questions and hidden fields that collect more personal data than the survey states.
101902. **Review-widget phishing detector** — scans embedded review and rating widgets for fake login prompts or credential fields that phish site visitors.
101903. **Accessibility-overlay risk reviewer** — audits accessibility widgets for full-page script access and DOM scraping that exceeds their assistive purpose.
101904. **Embedded vendor trust scorecard** — scores every third-party vendor on script privileges, data access, consent behavior, and breach history into a single prioritized risk ranking.
101905. **QUIC handshake misconfiguration prober** — negotiates QUIC with target endpoints to flag disabled address validation or weak state limits that invite amplification abuse.
101906. **HTTP/3 version-negotiation downgrade checker** — forces version negotiation back toward HTTP/2 to confirm security headers and access controls survive the fallback intact.
101907. **HTTP/3 Alt-Svc advertisement auditor** — validates that Alt-Svc headers advertise only real, reachable QUIC endpoints so clients never leak metadata to dead or spoofed ports.
101908. **QUIC amplification surface measurer** — estimates each QUIC endpoint's UDP amplification factor to confirm it cannot be weaponized as a reflection vector.
101909. **HTTP/3 connection-migration hijack tester** — checks whether migrated QUIC connection IDs are validated before acceptance, preventing session theft via spoofed path changes.
101910. **QUIC retry-token absence detector** — verifies the server issues Retry tokens under load so spoofed-source handshakes cannot exhaust connection state.
101911. **HTTP/3 prior-knowledge endpoint discoverer** — probes likely UDP ports for enabled-but-undocumented HTTP/3 services hiding outside the normal asset inventory.
101912. **HTTP/3 zero-RTT replay risk evaluator** — tests whether the server accepts 0-RTT early data and confirms only idempotent, replay-safe operations are permitted.
101913. **QUIC path-validation tamper checker** — confirms QUIC path validation resists on-path observers so migration state cannot be manipulated by middleboxes or attackers.
101914. **IPv6-only host exposure mapper** — queries AAAA records and v6 ranges to surface assets reachable only over IPv6 that standard tooling usually overlooks.
101915. **IPv6 shadow-service discoverer** — scans IPv6 deployments for admin panels and APIs that exist on v6 but never entered the IPv4 inventory.
101916. **IPv6 reverse-DNS inconsistency flagger** — compares PTR records against forward DNS to catch v6 hosts whose footprint was never properly registered.
101917. **IPv6 firewall-parity auditor** — tests whether v6 endpoints enforce the same WAF and ACL rules as their v4 twins so defenses never silently differ.
101918. **NAT64/DNS64 traversal leak detector** — checks whether DNS64 synthesis exposes internal v6 topology or synthesis patterns to external resolvers.
101919. **IPv6 unique-local-address leakage hunter** — searches public records and service banners for leaked ULA ranges that reveal internal addressing plans.
101920. **DNSSEC chain-of-trust validator** — walks DS to DNSKEY to RRSIG chains to prove every in-scope zone validates end-to-end for real resolvers.
101921. **DNSSEC signature-expiry watchdog** — monitors RRSIG inception and expiration timestamps so zones cannot silently go bogus during key rollovers.
101922. **DNSSEC algorithm-rollover gap scanner** — detects zones stranded on deprecated algorithms mid-rollover that break validating resolvers for legitimate users.
101923. **DNSSEC zone-walk resistance checker** — verifies NSEC3 hashing with salt and opt-out so zone contents cannot be enumerated by attackers.
101924. **DNSSEC negative-answer authenticity verifier** — confirms unsigned denial-of-existence gaps cannot be forged into NXDOMAIN answers for real names.
101925. **CAA record enforcement verifier** — queries CAA records and cross-references issuance paths to confirm only authorized CAs can issue for the domain.
101926. **CAA issuewild coverage checker** — ensures wildcard issuance is explicitly constrained so a CAA gap cannot permit rogue wildcard certificates.
101927. **CAA contact-URI reachability monitor** — validates CAA contactemail and contactphone entries stay current so CAs can reach the owner during incidents.
101928. **CAA versus issuance-log reconciler** — cross-checks Certificate Transparency logs against CAA policy to catch certificates issued outside declared policy.
101929. **CAA account-URI pinning checker** — verifies CAA accounturi records restrict issuance to the correct ACME accounts, blocking account-substitution abuse.
101930. **BGP route-hijack monitor hook** — subscribes to BGP update feeds to alert the moment a target prefix is announced by an unauthorized ASN.
101931. **BGP RPKI ROA coverage auditor** — checks every announced prefix against RPKI so invalid-origin announcements are flagged before traffic shifts.
101932. **BGP prefix-deaggregation drift detector** — watches for new more-specific announcements that signal hijack attempts or accidental misconfiguration.
101933. **BGP path-prepending anomaly flagger** — detects sudden prepending changes that reroute target traffic through unexpected networks or providers.
101934. **BGP community-tag leakage reviewer** — scans announced communities for internal tags accidentally exposed, which reveal routing policy to adversaries.
101935. **Anycast routing-consistency checker** — queries the target from multiple vantage points to confirm anycast delivers consistent, authentic responses everywhere.
101936. **Anycast origin-server unmasker** — compares edge and direct responses to find origin IPs accidentally exposed behind anycast layers.
101937. **Dangling DNS record continuous watcher** — re-polls CNAME and A records on a schedule to catch records whose destinations were deleted or released.
101938. **Dangling-record claim-probability ranker** — scores dangling records by how easily their destination service allows re-registration, prioritizing genuine takeover risk.
101939. **DNS-history origin-exposure reconstructor** — diffs historical DNS snapshots to recover past A records pointing at origin IPs now hidden behind CDNs.
101940. **Passive-DNS first-seen anomaly alerter** — flags subdomains whose first passive-DNS sighting shows mass creation or fast-flux patterns.
101941. **DNS-over-HTTPS resolver posture tester** — checks whether the target's DoH endpoints enforce authentication and logging policy consistently with plaintext resolvers.
101942. **DNS-over-TLS certificate-pinning verifier** — confirms DoT endpoints present expected certificates so clients cannot be silently redirected to impostors.
101943. **DoH policy-bypass channel auditor** — tests whether internal hosts can evade DNS policy through external DoH, measuring exactly where policy goes blind.
101944. **Encrypted-DNS policy-parity checker** — verifies DoH and DoT deployments apply the same blocklists and logging as the organization's plaintext resolvers.
101945. **Passive-source subdomain enumerator** — combines certificate transparency, passive DNS, and curated wordlists to enumerate subdomains with minimal active probing.
101946. **Passive-source subdomain freshness ranker** — orders discovered subdomains by recency of first sighting so live assets get tested before stale ones.
101947. **Subdomain wildcard-masking piercer** — identifies wildcard DNS that hides real subdomains and adjusts enumeration technique to see through the mask.
101948. **Subdomain census drift tracker** — re-runs enumeration on a cadence to catch new subdomains appearing between hunts.
101949. **BIMI record validity verifier** — checks BIMI records for valid VMC certificates and correct logo hosting so brand impersonation stays blocked.
101950. **BIMI and DMARC alignment drift monitor** — tracks DMARC policy, SPF, DKIM, and BIMI together to catch alignment regressions that re-enable spoofing.
101951. **DMARC aggregate-report ingestor** — parses DMARC rua reports to surface unauthorized senders abusing the domain before complaints arrive.
101952. **DMARC forensic-report triage helper** — correlates ruf failure samples to pinpoint exactly which mail stream broke authentication alignment.
101953. **SPF lookup-limit counter** — counts DNS lookups across SPF include chains to ensure they stay under the ten-lookup limit so mail keeps authenticating.
101954. **SPF macro-expansion safety reviewer** — checks SPF macros for expansions that could be abused to exfiltrate data through crafted DNS lookups.
101955. **DKIM key-strength and rotation auditor** — verifies DKIM selectors use strong keys and that retired selectors are removed so old keys cannot sign mail.
101956. **DKIM selector discovery enumerator** — finds published DKIM selectors, including retired ones, to map the domain's complete signing footprint.
101957. **MTA-STS policy enforcement checker** — verifies MTA-STS policies and TLS-RPT reporting so mail servers cannot be silently downgraded to plaintext.
101958. **DANE TLSA alignment verifier** — confirms TLSA records match the real certificates on mail and web servers to catch stale or mismatched pins.
101959. **SMTP STARTTLS downgrade resistance tester** — probes stripping conditions on mail submission paths to ensure delivery cannot be silently downgraded.
101960. **DNS zone-transfer exposure checker** — attempts AXFR against every authoritative nameserver to confirm zone transfers are not world-readable.
101961. **DNS NOTIFY spoofing risk assessor** — checks whether nameservers honor unauthenticated NOTIFY messages that could trigger cache or zone poisoning.
101962. **Open DNS recursion hunter** — tests the target's nameservers for open recursion that attackers could abuse in amplification attacks.
101963. **DNS cache-poisoning surface estimator** — evaluates source-port randomness and case randomization to gauge resistance to classic poisoning attacks.
101964. **DNS response-fragmentation abuse analyzer** — measures DNS response sizes to flag answers that fragment and could be abused in fragmentation-based attacks.
101965. **DNS glue-record consistency verifier** — compares parent-side and child-side glue records to catch lame delegations that break resolution.
101966. **Lame-delegation detector** — finds nameservers answering authoritatively for zones they no longer serve, which attackers can exploit.
101967. **DNS TTL policy auditor** — reviews TTL values across the zone to flag dangerously long TTLs that slow incident response and fast-flux cleanup.
101968. **DNS wildcard scope limiter** — verifies wildcard records cover only intended levels so they never swallow typosquats or staging hostnames.
101969. **EDNS0 compliance and downgrade tester** — checks EDNS support and fallback behavior to ensure resolvers never silently lose DNSSEC data.
101970. **DNS cookie adoption checker** — tests whether servers and resolvers use DNS cookies to blunt spoofed-query floods.
101971. **Response-policy-zone coverage verifier** — confirms RPZ feeds block known-malicious domains across every resolver the target operates.
101972. **DNS firewall egress-visibility tester** — verifies DNS-layer security controls still see queries when clients use nonstandard ports or protocols.
101973. **Split-horizon DNS parity reviewer** — compares internal and external views to ensure internal-only records never leak into public answers.
101974. **Split-horizon view-escape probe** — tests whether crafted queries can coax internal-only records out of the public-facing view.
101975. **DNS analytics exfiltration-channel hunter** — looks for TXT and NULL record patterns consistent with DNS tunneling so data-theft channels get found.
101976. **DNS tunneling baseline profiler** — profiles normal query entropy per domain so anomalous tunneling stands out during continuous monitoring.
101977. **Fast-flux behavior flagger** — detects rapidly changing A records on target-adjacent domains that suggest malicious infrastructure.
101978. **Lookalike-domain proximity scanner** — flags algorithmically generated lookalike domains registered near the target's brand for early review.
101979. **Typosquat DNS footprint mapper** — enumerates registered typo variants of the target and checks which resolve to live, potentially hostile hosts.
101980. **Typosquat mail-record checker** — verifies whether typosquat domains publish MX or SPF records that could intercept misdirected email.
101981. **Homograph domain registration watcher** — monitors IDN registrations visually similar to the target to catch phishing domains early.
101982. **Expired-domain re-registration risk scorer** — ranks recently expired target-adjacent domains by residual trust so defenders can reclaim the dangerous ones.
101983. **Registrar-lock status auditor** — confirms registrar and registry locks are set on critical domains so they cannot be transferred out.
101984. **WHOIS contact drift monitor** — watches registrant contact changes to catch social-engineering-driven domain updates early.
101985. **Nameserver diversity and health checker** — verifies authoritative nameservers are geographically and network-diverse so one outage cannot kill resolution.
101986. **DNS SOA serial propagation tracker** — monitors SOA serials across nameservers to catch synchronization failures before they cause stale answers.
101987. **DNSSEC-aware CDN edge validator** — confirms CDN edge nodes serve DNSSEC-validated responses that match origin policy.
101988. **CDN cache-key collision tester** — probes CDN cache-key normalization for flaws that could serve one tenant's content to another.
101989. **CDN origin-protection header verifier** — checks that origin servers reject requests lacking the CDN's secret header so attackers cannot bypass the edge.
101990. **Direct-origin CDN-bypass probe** — attempts to reach origin IPs recovered from DNS history to verify the CDN's protections cannot be skipped.
101991. **HTTP/2-to-HTTP/3 migration gap auditor** — compares security headers and controls across protocol versions to catch settings lost during migration.
101992. **Alt-Svc cleartext-fallback checker** — verifies clients cannot be tricked into cleartext fallback when Alt-Svc endpoints misbehave or go stale.
101993. **QUIC version-alias fingerprinting reducer** — checks the server does not advertise excessive version aliases that aid fingerprinting and targeted attacks.
101994. **Happy Eyeballs fallback abuse monitor** — tests whether fast-fallback behavior lets attackers steer clients onto weaker protocol paths.
101995. **IPv6 extension-header filtering verifier** — confirms firewalls drop malicious IPv6 extension-header chains commonly used for evasion.
101996. **IPv6 neighbor-discovery spoofing guard checker** — verifies RA-guard or SEND equivalents protect the target's v6 segments from spoofing.
101997. **IPv6 temporary-address privacy auditor** — checks that hosts use privacy extensions so stable interface identifiers cannot enable tracking.
101998. **Legacy tunnel-endpoint exposure scanner** — finds 6to4 and Teredo transition endpoints that bypass perimeter filtering unnoticed.
101999. **Service-discovery DNS leakage hunter** — probes for exposed SRV and TXT service-discovery records that map internal infrastructure.
102000. **mDNS cross-boundary leak detector** — checks whether multicast DNS announcements escape their intended network segments.
102001. **Legacy name-resolution exposure checker** — tests whether LLMNR and NBT-NS answer on target networks, enabling name spoofing.
102002. **DNS search-domain hijack risk assessor** — evaluates resolver search-domain lists for entries that let attackers intercept short-name lookups.
102003. **Stale NS record hygiene sweeper** — finds NS records pointing at decommissioned nameservers that attackers could re-register.
102004. **DNS change-audit trail builder** — maintains a versioned log of every in-scope DNS change so unauthorized modifications are instantly visible.
