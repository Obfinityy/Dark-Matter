# TLS / Certificate / Crypto-Transport Scan

## What it is
A transport-layer measurement probe (`backend/src/scanner/probes/tlsScan.js`,
entry `probeTls(url, opts)`). It runs **once per scan** (not per parameter)
and holds a hard <30s budget (25s deadline; stages stop early on failure).
Every stage is a defensive measurement: open a handshake, read what the
server *presents*, close the socket. Nothing is exploited or mutated.

## Handshake mechanics
- `node:tls` `tls.connect` with `rejectUnauthorized: false` captures the
  presented certificate via `getPeerCertificate(true)`; the certificate is
  then **analysed locally** (expiry, issuer==subject, SAN/CN vs hostname,
  chain depth) — the handshake is never trusted for the verdict.
- A second handshake with `rejectUnauthorized: true` asks the honest
  question "would a strict validating client accept this chain?" and its
  error code is mapped (see Proof criteria).
- Weak cipher/protocol stages send **restricted ClientHellos only**
  (e.g. offering only `RC4-SHA:RC4-MD5`, or `maxVersion: TLSv1`). A
  successful handshake *is* the finding — it proves the server offers the
  weak option. Each attempt has a 5s cap and runs only after a successful
  baseline handshake (skip-fast on failure).
- SNI is sent for DNS names; omitted for IP literals. All fetches use
  `User-Agent: DarkMatter-Scanner/1.0 (+authorized-scan)` and
  `redirect: 'manual'`.

## Checks and proof criteria
| Check | ID | Severity | Proof |
|---|---|---|---|
| Cert expired | `tls_cert_expired` | medium | `valid_to` < now on the captured cert (#125) |
| Cert self-signed | `tls_cert_selfsigned` | medium | issuer == subject on the captured cert (#125) |
| Hostname mismatch | `tls_cert_hostname_mismatch` | medium | no SAN/CN (wildcard-aware) covers the target host (#125) |
| Chain incomplete | `tls_cert_chain_incomplete` | medium | presented chain depth is 1 and the leaf is not self-signed → missing intermediates (#451) |
| Chain untrusted | `tls_cert_untrusted` | high | strict handshake fails with `SELF_SIGNED_CERT_IN_CHAIN` / `UNABLE_TO_VERIFY_LEAF_SIGNATURE` / `CERT_UNTRUSTED` — cryptographically invalid, beyond expiry (#451) |
| Cleartext HTTP | `tls_cleartext_http` | high | `http://` target returns 2xx/3xx — content served without TLS (#129) |
| Cleartext downgrade | `tls_cleartext_downgrade` | high | `https://` target whose `http://host/` returns 200 with a login form or session cookie instead of redirecting (#129) |
| RC4 suites | `tls_weak_cipher_rc4` | high | restricted-offer handshake succeeds (#133) |
| 3DES (SWEET32) | `tls_weak_cipher_3des` | medium | restricted-offer handshake succeeds (#450) |
| Single-DES / export | `tls_weak_cipher_des_export` | high | restricted-offer handshake succeeds (#133) |
| TLS 1.0 accepted | `tls_weak_protocol_1_0` | medium | `maxVersion: TLSv1` handshake succeeds (#134) |
| BEAST | `tls_beast` | medium | TLS 1.0 negotiated **with a CBC-mode cipher** — the BEAST precondition (#447) |
| TLS 1.1 accepted | `tls_weak_protocol_1_1` | low | `maxVersion: TLSv1.1` handshake succeeds (#134) |
| SSLv3 | `tls_sslv3_offered` | high | `maxVersion: SSLv3` handshake succeeds (node throws for unsupported → not offered → silent, correct) |
| BREACH surface | `tls_breach_surface` | medium | raw (non-decompressed) response has `Content-Encoding: gzip/deflate` **and** the same page reflects secret-shaped values (CSRF token field, session-id pattern) — the BREACH oracle precondition (#448 surface) |

Every finding sets `parameter` (`certificate`, `scheme`, `tls-protocol`,
`tls-cipher`, `http-compression`) and `evidence.signalCorrelated: true`;
`evidence.response` carries the actual cert fields / negotiated cipher /
observed headers.

## Honest gaps (not faked — mark GAP)
- **#123 Improper certificate validation (client/API):** requires observing
  the *client* application's TLS behaviour (mobile app / API client traffic
  interception). A black-box HTTP scanner cannot see it. **GAP.**
- **#126 Sensitive data at rest unencrypted:** server-side storage is
  unobservable from outside. **GAP.**
- **#449 DROWN (SSLv2):** `node:tls` has zero SSLv2 support — the handshake
  cannot even be attempted. **GAP.**
- **CRIME (full, #448):** TLS-level compression is never offered by
  `node:tls`, so no active test exists from node. Only the HTTP-layer
  BREACH *surface* is measurable (covered above). **GAP (full exploitation).**
- **BREACH (full, #448):** real exploitation needs thousands of adaptive
  oracle requests; the probe reports the precondition surface only, by
  design. **GAP (full exploitation).**

## Deliberate non-findings (avoiding false positives)
- Strict-handshake `CERT_HAS_EXPIRED` / `DEPTH_ZERO_SELF_SIGNED_CERT` do not
  raise `tls_cert_untrusted` — those defects already fired as medium
  findings; double-counting would inflate the report.
- `UNABLE_TO_GET_ISSUER_CERT_LOCALLY` is a fact about the *scanner's* trust
  store, not the certificate — never a finding.
- A weak-cipher/protocol attempt that fails (no cipher match, handshake
  alert, timeout) means "not offered" → silent. On modern OpenSSL 3 builds
  RC4/3DES/export suites are compiled out, so those stages usually stay
  silent — an honest negative, not a probe failure.
