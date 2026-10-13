All 8 categories researched. Here is the structured report.

---

# RESEARCH REPORT — ROUND 2: Remaining unsolved problems
*Research-only. Nothing cloned, no code written. Techniques extracted for original implementation. Star counts were not returned by this search round — marked "not verified" where I have no data; do not cite publicly without re-verifying.*

## Context
Round 1 covered: chain engines, differential confirmation, variant mining, nuclei, RESTler-lite, JWT battery, exploitability rubrics. This round targets the 8 remaining blockers.

---

## 1. Authenticated multi-role testing automation — ✅ GOOD COVERAGE

**1a. joyghoshs/authmatrix-reloaded** — https://github.com/joyghoshs/authmatrix-reloaded — MIT — stars not verified
Burp extension that automates BOLA/BFLA/BOPLA testing: define tables of roles × users × endpoints, replay every request under every identity, layered verdict engine classifies outcomes into a color-coded matrix. Explicitly targets OWASP API Top 10: BOLA (API1), BFLA (API5), BOPLA (API3).
*Implementable techniques:*
- **Verdict matrix**: replay every captured request under every identity; classify (status/size diff) instead of manual one-by-one checks.
- **Three-class split**: test object-level (same role, other's object), function-level (low-priv calling privileged function), and property-level (privileged fields leaking) as distinct passes.

**1b. itxDeeni/idor-scan** — https://github.com/itxDeeni/idor-scan — license unverified — stars not verified
Go CLI: imports Postman collections/OpenAPI specs, replays requests with swapped user contexts, detects response anomalies (status/size). Free OSS tier covers IDOR/BOLA swapping; role-matrix testing is paid Pro.
*Implementable techniques:*
- **Context-swap replay**: feed N user sessions, auto-swap IDs/tokens across all endpoints, flag anomalies.
- **Collection-driven**: drive everything from Postman/OpenAPI imports so the agent tests the real API surface, not guessed URLs.

**1c. ria-jay/bac-detector** — https://github.com/ria-jay/bac-detector — license unverified — stars not verified
Python, focused authorization tester: IDOR, BOLA, horizontal + vertical escalation, plus **graph-based authorization analysis** — cross-endpoint reasoning to find inconsistencies isolated request-pair checks miss.
*Implementable techniques:*
- **Graph-based auth analysis**: model endpoints as a graph; flag where the same object is protected on one route but open on another.
- **IDOR pattern mutation**: numeric neighbors (id±1), negative-control IDs, cross-user session confirmation as the gold standard.

---

## 2. JS-heavy SPA crawling — ✅ GOOD COVERAGE

**2a. projectdiscovery/katana** — https://github.com/projectdiscovery/katana — MIT — stars not verified in this search (well-known ProjectDiscovery tool)
Go headless crawler with JavaScript parsing: crawls SPAs, extracts endpoints from JS, supports headless mode for JS-rendered content.
*Implementable techniques:*
- **Headless + JS-parse crawl**: render the SPA, harvest XHR/fetch URLs from the live DOM *and* from raw bundles.
- **Scope-aware field crawling**: feed discovered API paths straight into the authz and fuzzing phases.

**2b. BishopFox/jsluice + GerbenJavado/LinkFinder** (referenced across multiple recon guides in results; URLs from tool knowledge — verify before use)
JS bundle analyzers: extract URLs, endpoints, and secrets from minified bundles.
*Implementable techniques:*
- **Bundle → route map**: collect all JS (incl. async chunks + Wayback), extract hosts/routes/secrets; minified bundles store routes as string segments — reassemble against the API base.
- **Source-map recovery**: fetch `*.js.map` for unminified originals (API keys, internal endpoints, auth logic); re-derive the build hash live — a 404 on an old hash means a new deploy, not remediation.
- **Control-route verification**: hit a known-gated route unauthenticated to learn the 401 shape; then verify every extracted route — sibling 200 vs control = real authz gap.

---

## 3. WAF/bot-detection evasion — ✅ GOOD COVERAGE (tools exist; no "scanner-integrated" repo)

**3a. FlareSolverr/FlareSolverr** — https://github.com/FlareSolverr/FlareSolverr — license: verify (believed GPL-3.0 — do not vendor, extract technique) — stars not verified
Proxy server that solves Cloudflare challenges: spins up Selenium + undetected-chromedriver, opens the URL, waits for the challenge to clear, returns HTML + cookies (`cf_clearance`) for reuse in plain HTTP clients.
*Implementable techniques:*
- **Challenge-solving proxy**: isolate the heavy browser work in a sidecar; the scanner reuses solved cookies for fast HTTP follow-ups.
- **Cookie caching**: cache `cf_clearance` and reuse within its validity window instead of re-solving per request.

**3b. ultrafunkamsterdam/undetected-chromedriver** — license: verify (believed GPL-3.0) — stars not verified
Binary-patched chromedriver removing automation markers (`navigator.webdriver`, etc.); defeats Distil/Imperva/DataDome/Cloudflare IUAM class checks.
**3c. patchright (Kaliiiiiiiiii-Vinyzu)** — undetected Playwright (Python + Node variants), drop-in Playwright replacement — license/stars unverified.
*Implementable techniques (across 3b/3c):*
- **Stealth browser stack**: patched driver + real user-agents + human-like interaction timing for the crawl/recon phase.
- **Operational discipline**: residential proxies, human cadence (<1 req/s sustained), session warm-up on benign pages first, match cookies to the IP that obtained them.

---

## 4. Business-logic test generation — ⚠️ PARTIAL — closest repo found, but NO standalone black-box generator

**4a. zestor/atlas-llm-redteam** — https://github.com/zestor/atlas-llm-redteam — license/stars unverified
LLM pipeline that **infers business rules** from observed app behavior (returns JSON: rules, state machine, trust assumptions), then **generates testable flaw hypotheses** with concrete test sequences (method/endpoint/params + expected vulnerable response + impact), using per-app-type pattern profiles (ecommerce, etc.).
*Implementable techniques:*
- **Rule inference → hypothesis → test sequence**: the exact three-step shape to implement — observe workflows, infer the state machine, generate abuse cases from known logic-flaw patterns.
- **App-type profiles**: seed pattern packs per vertical (ecommerce: coupon/price/quantity; fintech: transfer/limits; SaaS: roles/quotas).

**Verdict: NO KNOWN REPO for a standalone, black-box, non-LLM business-logic test generator — needs original implementation.** Everything found is either LLM-prompt-driven (atlas) or white-box (GitHub Security Lab Taskflow does threat-model → audit on source code). The original work: combine our RESTler-lite sequencer (round 1) with atlas-style rule inference and invariant-violation oracles (e.g., "cart total must equal sum(items) − discounts" — any violation is a finding).

---

## 5. Hunt learning loop — ❌ NO KNOWN REPO — needs original implementation

No repository implements "a pentest agent that gets better at strategy from each hunt." What exists are *components*:

**5a. mem0ai/mem0** — https://github.com/mem0ai/mem0 — license: verify (believed Apache-2.0) — stars not verified
General-purpose agent memory layer: stores/retrieves memories across sessions so agents keep continuity. *Technique to borrow: persistent memory API (store fact → recall by semantic similarity) as the substrate.*

**5b. vectorize-io/hindsight** — https://github.com/vectorize-io/hindsight — license unverified — stars not verified
Long-term memory built around remember → recall → **reflect**: moves from simple recall toward reflection over accumulated experience. *Technique to borrow: post-hunt reflection pass that distills "what worked" into reusable lessons.*

**5c. GH05TCREW/pentestagent** — https://github.com/GH05TCREW/pentestagent — license unverified — stars not verified
Pentest agent framework with persistent notes (`loot/notes.json` categorized: credential/vulnerability/finding/artifact), RAG knowledge injection, and a **shadow graph** — a knowledge graph built from notes for strategic insight ("we have creds for host X"). *Technique to borrow: finding-graph as working memory during a hunt.*

**Original implementation needed:** experience-replay loop — (1) persist per-hunt (target profile → techniques tried → what yielded findings), (2) post-hunt reflection distills strategy lessons into a playbook store, (3) next hunt retrieves similar-target lessons *before* planning and replays successful sequences first. None of the above does the closed loop for offensive strategy.

---

## 6. Real-time collaborator / OOB — ✅ GOOD COVERAGE

**6a. projectdiscovery/interactsh** — https://github.com/projectdiscovery/interactsh — license: verify (believed MIT) — stars not verified
The canonical self-hostable OOB server: DNS + HTTP + SMTP + LDAP listeners, `interactsh-server` (own domain, Let's Encrypt) + `interactsh-client` (register → get `*.oast.fun`-style domain → poll JSON). Public instance exists but is sometimes blocklisted — self-host recommended for bounty work.
*Implementable techniques:*
- **Per-session correlation subdomains**: unique subdomain per injection point so late callbacks map to the exact payload.
- **Agent polling loop**: client polls JSON, correlates interactions back to the originating scan job/finding.

**6b. sdf1jpf/oob-collaborator** — https://github.com/sdf1jpf/oob-collaborator — license unverified — stars not verified
Self-hosted multi-protocol OOB (DNS/HTTP/HTTPS/SMTP) with PostgreSQL dashboard, Burp-style polling API, wildcard TLS via ACME DNS-01, hosted payload files for XXE.
*Implementable techniques:* polling API + dashboard pattern for operator visibility; payload hosting for XXE/DTD callbacks.

---

## 7. Mobile API testing — ✅ GOOD COVERAGE (tooling exists; agent-orchestrated flow is the gap)

**7a. mitmproxy/android-unpinner** — https://github.com/mitmproxy/android-unpinner — license unverified — stars not verified
Removes certificate pinning from APKs **without root**: marks app debuggable via frida-apk, injects Frida Gadget over ADB, uses HTTPToolkit's unpinning script. Single command: `android-unpinner all app.apk`.
*Implementable techniques:* non-root unpin → proxy all traffic → enumerate the full API surface including undocumented endpoints.

**7b. hilmi2018/apkit** — https://github.com/hilmi2018/apkit — license unverified — stars not verified
Android RE toolkit: Frida SSL unpinning automation, APK decompile, OWASP Mobile Top 10 checks, **API key + URL extraction** from decompiled sources.
*Implementable techniques:* static pass first (decompile → grep `https?://`, `/api/`, Retrofit/Volley interfaces, Alamofire configs) → dynamic pass (unpin → capture → map).

**7c. krackn88/android-mitm-ssl-interceptor** — https://github.com/krackn88/android-mitm-ssl-interceptor — MIT — stars not verified
Full MITM toolkit: Frida pinning bypass, **automatic protocol detection (REST/GraphQL/gRPC/WebSocket/MQTT)**, payload extraction, API mapping doc generation.
*Implementable techniques:* protocol auto-detection on captured traffic; captured payloads feed directly into the IDOR/BOLA matrix (problem 1) and the API sequencer (round 1).

---

## 8. GraphQL-specific security — ✅ GOOD COVERAGE

**8a. dolevf/graphql-cop** — https://github.com/dolevf/graphql-cop — license: verify before use — stars not verified
Automated misconfiguration scanner: introspection exposure, field suggestions, GET support, query batching, alias/directive overloading, deep recursion, missing char limits, mutation introspection. `pip install graphql-cop`.
*Implementable techniques:* run as a first-pass checklist; every enabled primitive becomes a follow-up attack (batching → brute-force; alias overloading → DoS).

**8b. doyensec/inql** — https://github.com/doyensec/inql — license: verify — stars not verified
Burp extension + CLI for GraphQL schema introspection, query generation, and vuln scanning during pentests.
*Implementable techniques:* introspection → schema → auto-generated queries per field, each tested for BOLA (swap IDs across roles).

**8c. graphw00f** (PyPI; engine fingerprinter, referenced in results) — license/stars unverified
Fingerprints the GraphQL engine (Hasura/Apollo/Graphene/WPGraphQL…) → maps to known CVEs per engine.
*Implementable techniques:* fingerprint first, then engine-specific attack packs (Hasura auth bypass, WPGraphQL IDOR, etc.); WAF bypass via content-type switching (`application/graphql`), GET introspection, comment/fragment smuggling.

---

## Summary: where NO repo exists (original implementation required)

| # | Problem | Status |
|---|---------|--------|
| 1 | Multi-role authz automation | ✅ repos exist (authmatrix-reloaded, idor-scan, bac-detector) |
| 2 | SPA crawling / JS endpoint discovery | ✅ repos exist (katana, jsluice/LinkFinder pattern) |
| 3 | WAF/bot evasion | ✅ tools exist (FlareSolverr, undetected-chromedriver, patchright) — scanner *integration* is the gap |
| 4 | Business-logic test generation | ⚠️ partial (atlas-llm-redteam is LLM-prompt-driven) — **black-box generator needs original work** |
| 5 | Hunt learning loop | ❌ **NO KNOWN REPO — needs original implementation** (borrow: mem0 memory API, hindsight reflection, pentestagent shadow graph) |
| 6 | OOB collaborator | ✅ repos exist (interactsh, oob-collaborator) |
| 7 | Mobile API testing | ✅ tools exist (android-unpinner, apkit, ssl-interceptor) — agent-orchestrated flow is the gap |
| 8 | GraphQL security | ✅ repos exist (graphql-cop, inql, graphw00f) |

**Highest-leverage original builds:** (a) the hunt learning loop (#5) — nothing in the open-source world does closed-loop offensive strategy learning; (b) the black-box business-logic generator (#4) — rule inference + invariant oracles over the RESTler-lite sequencer; (c) the integration fabric tying 1+2+3+6+7+8 together (challenge-solving proxy → stealth crawl → JS route map → role matrix → OOB confirmation), which no single repo provides.

**License caution:** FlareSolverr and undetected-chromedriver are believed GPL-3.0 — extract techniques, do not vendor. Verify licenses of inql, graphql-cop, apkit, mem0, hindsight, idor-scan, bac-detector before any vendoring.