# DARK MATTER — LIVE PROOFS

Every claim in this file is a live proof: a real scanner hunt run against a real lab
target on EC2, verified first-hand (direct EC2 read, never a relay), with hunt IDs,
title-exact baselines and zero retractions. Nothing here is a unit-test result alone
and nothing is claimed without evidence.

## Live status (10 Nov 2026, ~22:08 IST)

- Coverage: **346/478 = 72.4% LIVE**, 148 phases in `backend/src/scanner/index.js`
- HEAD: `1bd5c1a0` (behaviour-analysis round-2 lane 695eb413 — compact prompt, retry cap 2000 = first call, truncated-JSON salvage, full rawReply persisted), **134th deploy verified** (workflow 42854372155, backend PID 3596968, health ok, LAB_TARGETS 9/9, PHASES 148)
- Suite at HEAD: 3801 tests / 3790 pass / 0 fail / 11 skipped (merged-tree gate, `hidden_files/ai-analysis-round2-merged-gate.log`)
- AI hunt `h_7d49c6ef7447` paused at iter 296 (owner zero-Meta order, 3 Nov 2026);
  spend $38.9482 / 4682 entries
- **Proof #44 COMPLETE 10 Nov ~22:24 IST — both legs PASS** — behaviour-analysis round-2 fix live-proven on the 134th build (Juice 31/0 + DVWA 20/0, each with 5 valid AI suggestions, first call, outputTokens 1460/1748 < 2000 cap). Proof #43 FAILED on the same leg (both calls truncated at caps). Frontend AI-panel wrapper fix merged 10846e06 + live-verified on the Juice hunt page.
- **Multi-page crawl: NOT live-proven on Juice (proof #45, 10 Nov ~22:45 IST) or DVWA (proof #45 DVWA leg, ~22:57 IST)** — site-scope hunts scanned exactly 1 page on both labs, by different verified mechanisms: Juice is an Angular SPA shell (no raw-HTML links); DVWA's `/` 302s to `/login.php`, whose only link is external (crawl runs pre-login). The crawler works as designed; it only follows pre-login raw-HTML links. Discriminating test next: GitHub site-scope hunt (public multi-page site).
- Baselines: DVWA **20** titles, Juice Shop **31** titles (30 + #79 anti-automation, proof #42), LLM lab **17** titles (first baseline, proof #37) (listed below)
- Corrected baseline (10 Nov 2026 reconciliation, `hidden_files/coverage-reconciliation-20261110.md`): the 341/478 = 71.3% figure in the old Live status was WRONG in every bucket (proof #30 phantom +2 LIVE rows; proof #37 counted scout row #512 inside the 478). True pin before proof #42 was **338/478 = 70.7%** (338 LIVE + 24 AIB + 116 GAP). Proof #42 moves it to **346/478 = 72.4%**.

## How a proof works

1. The proof driver (`lab_reval_driver.mjs`, md5
   `2513f06c1cc0c25134fbbc1cb462c9b4`) mints a 3h owner JWT in-process and creates
   one scanner hunt per lab: DVWA (`http://172.17.0.1:3100`) and Juice Shop
   (`http://172.17.0.1:3000`). Lanes run sequentially, never during a deploy.
2. A leg passes when its `scannerSummary` is `{confirmed, unconfirmed}` with the
   expected confirmed count, every title matches the pinned baseline exactly
   (no missing, no extra), and retractions are 0.
3. `scannerSummary` confirmed/unconfirmed is authoritative. Phase rollups are
   read as total / ok-non-skipped / skipped / failed / timedOut (skipped phases
   carry `ok:true` and are never counted as ok). Unconfirmed is a finalize-time
   count with no event record.
4. Every proof is verified by a direct EC2 read of `meta.json` + `events.jsonl`
   (meta state, `scannerSummary`, title extraction from `type:"finding"` events,
   retraction check). Worker relays are never trusted for a verdict.
5. The LLM-lab leg uses a separate driver (`lab_llm_proof_driver.mjs`,
   `~/workspace/dm-v2/probes/lab_llm_proof_driver.mjs`) with the same JWT-mint +
   hunt pattern. It MUST pass `labCreds` (any username/password — the lab has
   no login; the creds are only the llmGate token) or the llm-injection probe
   and all 7 llm-limits probes early-return in 0ms and the leg is
   INCONCLUSIVE, not a pass (proof #37 run 1 proved this the hard way).

## Proof table — re-proofs #4 to #25

| # | Date (IST) | Deploy | DVWA leg | Juice leg | Verdict |
|---|-----------|--------|----------|-----------|---------|
| 4 | 8 Nov ~07:06 | 48th `b187d477` | `h_eca900918f75` {20,0} | `h_e6baa175bbba` {19,0} | PASS, 0 retractions. #474 pinned 295/478. |
| 5 | 8 Nov ~11:47 | 50th `0e6eba37` | `h_c756738adef6` {20,0} | `h_f625c6ee7a6b` {20,0} | PASS, 0 retractions. NEW [Low] jQuery@2.2.4 on Juice. Juice baseline becomes 20. |
| 6 | 8 Nov ~12:24 | 51st `fe42b633` | `h_5fd5512874a2` {20,0} | `h_97767c851fee` {20,0} | PASS, 0 retractions. SMTP canary-inbox true negative. |
| 7 | 8 Nov ~12:52 | 52nd `f6e0a95a` | `h_0ae914f1cc03` {20,0} | `h_87ea87ae96f4` {20,0} | PASS, 0 retractions. SMTP T3/T4 true negative. |
| 8 | 8 Nov ~13:47 | 53rd `8c361c31` | `h_19eeeb9bb2db` {20,0} | `h_e9d4a4a1408c` {20,0} | PASS, 0 retractions. |
| 9 | 8 Nov ~14:26 | 54th `c8b90adb` | `h_2786f4cf1df9` {20,0} | `h_710f6ec27863` {17,0} then re-run `h_441e4ee3266f` {20,0} | PASS on re-run, 0 retractions. First Juice leg missed only the 3 verb-tampering titles: lab page-state flake (the `?email=dmprobe_` probe point was absent from that run's events); re-run recovered all 3 with no code change. |
| 10 | 8 Nov ~15:00 | 55th `73095ab0` | `h_2b83aca0032e` {20,0} | `h_0a048d2b45fc` {20,0} | PASS, 0 retractions. |
| 11 | 8 Nov ~15:47 | 56th `705a5c4e` | `h_aad0db3033c0` {20,0} | `h_fa016410f317` {20,0} | PASS, 0 retractions. Fetch-options jsRoutes true negative on both labs. |
| 12 | 8 Nov ~17:11 | 57th `b6d3dc6b` | `h_bf1fe54d7f3a` {20,0} | `h_dc133ac830dc` {21,0} | PASS, 0 retractions. NEW [Low] DOM XSS sink fingerprint on Juice (`bypassSecurityTrustHtml x9, innerHTML x22, document.write x1`). Row #115 GAP to LIVE. Coverage 296/478. Juice baseline becomes 21. |
| 13 | 8 Nov ~17:58 | 58th `153e3373` | `h_e0886f32c6c1` {20,0} | `h_be57533a551b` {21,0} | PASS on titles, 0 retractions. CDP authenticated render NOT live: `authDom: false` (127.0.0.1 published-port RST, curl 56; browser healthy on container loopback). |
| 14 | 8 Nov ~18:52 | 59th `ae0f45ba` | `h_4fcc323cd67f` {20,0} | `h_58458e51b647` {21,0} | PASS on titles, 0 retractions. `authDom` still FALSE: `docker port` prints the bare form `172.17.0.1:32769` (parser required the `9222/tcp ->` prefix) and this Chrome build binds DevTools to 127.0.0.1:9222 only. Proven fix: `--network host`. |
| 15 | 8 Nov ~20:00 | 61st `3c2a86a8` | `h_4d444fe51078` {20,0} | `h_5894a14c4069` {21,0} | PASS, 0 retractions, scan errors []. **CDP authenticated render LIVE-PROVEN for the first time: `authDom: true`, `authSession: "token"`, `authInputs: 1`, `authError: null`** (Juice dom-render phase, 39158ms, 3 findings, 6 domRoutes). DVWA skips dom-render ('static elements found', expected). |
| 16 | 8 Nov ~22:05 | 62nd `b1fa279f` | `h_c52efad4ae64` {20,0} | `h_a704a2334c12` {22,0} | PASS, 0 retractions. **NEW [High] on Juice: 'Business logic — negative quantity reduces the basket total'** (PUT qty -1 → total 23.93→15.97, +1 control + same-value replay verified, class `business_logic`). Rows #82 + #370 + #374 AIB to LIVE. Coverage 299/478. Juice baseline becomes 22. DVWA basket-logic honest no-op (basketRoutes 0). `authDom: true` again on Juice (token, authInputs 1). |
| 17 | 8 Nov ~23:33 | 64th `3766ae49` | `h_c85f8704056b` {20,0} | `h_37a4b84183dc` {23,0} | PASS, 0 retractions. **NEW [High] on Juice: 'Business logic — checkout accepted for an empty basket'** (control order `5267-24588cdcc50768b4`, empty-basket checkout returned DISTINCT order `5267-50d75690371f6492`, class `business_logic`). Row #87 AIB to LIVE. Coverage 300/478. Juice baseline becomes 23. DVWA workflow-skip honest no-op (workflowRoutes 0). `authDom: true` again on Juice (token, authInputs 1). |
| 18 | 9 Nov ~00:20 | 65th `d48a083d` | `h_6d50fb50491c` {20,0} | `h_d4f0d605dadf` {24,0} | PASS on re-run, 0 retractions. **NEW [High] on Juice: '2FA verification accepts repeated wrong codes without rate limiting'** (POST `/rest/2fa/verify`, 10 distinct wrong `totpToken` codes, all invalid-code answers, no throttle signal, class `auth_2fa`; `twofa-bruteforce` phase `findingsCount=1, twoFaRoutes=1, controlOk=true, attempts=10`). Row #326 AIB to LIVE. Coverage 301/478. Juice baseline becomes 24. The 2FA finding fired on BOTH runs. First run was noisy, not a regression: DVWA `h_cba0a9fdd19c` {21,0} carried 1 SSTI FALSE POSITIVE (DVWA login `user_token` contained `9352`; live re-test proved no evaluation — `ssti.js` fix lane spawned); Juice `h_f98dd828078b` {21,0} missed the 3 verb titles (`?email=dmprobe_` probe point absent, known flake) and dom-render failed on dbus noise. Re-run legs are baseline-exact. `authDom: true` again on Juice (token, authInputs 1). |
| 19 | 9 Nov ~01:08 | 66th `69bef482` | `h_8af7f168482f` {20,0} | `h_9a1c6701cd13` {24,0} | PASS on re-run, 0 retractions. **SSTI-oracle FP fix live-proven** (shared guards `oracleGuards.js`: strip hidden inputs + token-like attribute values, repeat request must re-show the value at the same reflection point; applied to ssti, elInject, evalInject D2/D4). 0-row fix — coverage unchanged 301/478, Juice baseline stays 24. First run: DVWA `h_f9f7b3aeece4` {20,0} baseline-exact (SSTI FP gone) + Juice `h_f1feba6f2ded` {25,0} — 24 baseline + WS frame-replay title AGAIN (2nd firing in ~9 Juice runs; verdict revised from one-off to INTERMITTENT, never a baseline title). Re-run legs baseline-exact. `authDom: true` again on Juice (token, authInputs 1). |
| 20 | 9 Nov ~02:05 | 67th `07473376` | `h_77b886746f1a` {20,0} | `h_19732cd931c7` {24,0} | PASS, 0 retractions. **Row #275 AIB to LIVE — proven true negative** (two-tier oracle: tier-1 static mine found ZERO `location.hash` reads in Juice first-party bundles + inline blocks, `hashReads=0, hashNearSink=0, driveAttempted=false` — no drive needed; DVWA `dom-xss-location-hash` phase skipped 'no script targets'). Coverage 302/478. Baselines unchanged: DVWA 20, Juice 24. `authDom: true` again on Juice. |
| 21 | 9 Nov ~03:35 | 68th `82132710` | `h_54fe3c4a646a` {20,0} | `h_9630c6259ee7` {25,0} | PASS, 0 retractions. **NEW [High] on Juice: 'Login accepts repeated wrong passwords without rate limiting'** (POST `/rest/user/login`, 10 distinct wrong passwords, all ordinary invalid-credential answers, no throttle signal, class `auth_bruteforce`; `credential-stuffing` phase `findingsCount=1, loginRoutes=1, controlOk=true, attempts=10`). Row #42 AIB to LIVE. Coverage 303/478. Juice baseline becomes 25. DVWA credential-stuffing honest no-op (form-only login, probe is JSON-only by design; `loginRoutes=1, controlOk=false, attempts=0`). `authDom: true` again on Juice (token, authInputs 1); scan errors []. |
| 22 | 9 Nov ~05:20 | 69th `074e3623` | `h_a6e97190c890` {20,0} | `h_22d5bfb65fb9` {25,0} | PASS, 0 retractions. **Row #274 AIB to LIVE — proven true negative** (two-tier oracle: tier-1 static mine found ZERO `message` listeners in Juice first-party bundles + inline blocks, `listeners=0, listenersNearSink=0, driveAttempted=false` — no drive needed; DVWA `dom-postmessage` phase skipped 'no script targets'). Coverage 304/478. Baselines unchanged: DVWA 20, Juice 25. `authDom: true` again on Juice (token, authInputs 1); scan errors []. |
| 23 | 9 Nov ~06:25 | 70th `e3eac1e2` | `h_8009e3793f25` {20,0} | `h_b13b38519fc1` {25,0} | PASS, 0 retractions. **Row #190 AIB to LIVE — proven true negative** (two-tier oracle: tier-1 static mine found ZERO runtime template-engine calls in Juice first-party bundles + inline blocks, `engines=0, enginesNearSink=0, driveAttempted=false` — no drive needed; DVWA `csti` phase skipped 'no script targets'). Coverage 305/478. Baselines unchanged: DVWA 20, Juice 25. `authDom: true` again on Juice (token, authInputs 1); scan errors []. |
| 24 | 9 Nov ~07:45 | 71st `cdf4a2d7` | `h_1487805ad95e` {20,0} | `h_a6eb0c43fde8` {25,0} | INCONCLUSIVE for row #40, 0 retractions. Both legs baseline-exact, but the Juice captcha drive never ran (`feedbackRoutes=0, controlOk=false, attempts=0` — the miner's templated write target `/api/Feedbacks/dmprobe4_2e69` was rejected by the probe's exact-end matcher). DVWA captcha phase skipped 'no script targets' (designed). Coverage stays 305/478. |
| 25 | 9 Nov ~08:47 | 72nd `5f3ecf64` | `h_e49818888c34` {20,0} | `h_6c10630921ab` {25,0} | PASS, 0 retractions. **Row #40 AIB to LIVE — proven true negative** (feedback-route fix: the probe now resolves the templated write target to the collection URL; Juice captcha drive RAN: `feedbackRoutes=1, controlOk=true, attempts=2`, control accepted; manual repro: missing-captcha POST → HTTP 500, wrong-answer POST → HTTP 401, neither created feedback — bypass refuted on both variants. DVWA captcha phase skipped 'no script targets', designed). Coverage 306/478. Baselines unchanged: DVWA 20, Juice 25. `authDom: true` again on Juice (token, authInputs 1); scan errors []. |
| 26 | 9 Nov ~10:15 | 73rd `c5b25f26` | `h_a59ff524bb70` {20,0} | `h_07048340864f` {25,0} | PASS, 0 retractions. **Row #194 AIB to LIVE — proven true negative** (two-tier oracle: tier-1 mines the served page HTML + first-party JS for CSS contexts; DVWA `css-injection` phase ok:true, 1ms, `cssSinks=0, cssNearSink=0, driveAttempted=false` — zero CSS contexts on the served page, no drive needed; Juice `css-injection` phase ok:true, 82s, `cssSinks=1, cssNearSink=0, driveAttempted=true, driveExecuted=false` — one `<style>` block mined, tier-2 CDP drive RAN with the canary marker colour, no execution observed. DVWA phases 96/86/10/0/0, 142 events; Juice phases 531/531/0/0/0, 589 events). Coverage 306/478 (count corrected 9 Nov ~11:10 IST — ledger recount: 306 unique LIVE ids). Baselines unchanged: DVWA 20, Juice 25. `authDom: true` again on Juice (token, authInputs 1); scan errors []. |
| 27 | 9 Nov ~12:15 | 74th `a8e5b276` | `h_29263e3fb529` {20,0} | `h_a9d50377d29f` {26,0} | PASS, 0 retractions. **NEW [High] on Juice: 'BFLA — admin endpoint callable by low-privilege user'** (GET `/api/Users` with a low-privilege Bearer token → HTTP 200, 64264 bytes vs admin control 64264 bytes, same admin data; no-token 401; class `bfla_bypass`; `bfla` phase `findingsCount=1, adminRoutes=2, registerOk=true, controlOk=true, attempts=1, bypassKind='low-priv-admin-route'`). Row #340 AIB to LIVE. Coverage 307/478. Juice baseline becomes 26. DVWA `bfla` honest no-op (0 admin routes mined; `adminRoutes=0, registerOk=false, controlOk=false, attempts=0`). DVWA phases 97/87/10/0/0, 143 events; Juice phases 532/532/0/0/0, 591 events. `authDom: true` again on Juice (token, authInputs 1); scan errors []. |
| 28 | 9 Nov ~13:20 | 75th `ee975835` | `h_a19f89014171` {20,0} | `h_77808a4ab3e9` {26,0} | PASS, 0 retractions. **Row #116 AIB to LIVE — proven true negative** (two-tier DOM-sink oracle: tier-1 mined first-party JS for HTML-write assignments; DVWA `mutation-xss` phase skipped 'no script targets' by design, 0ms — DVWA serves no JS; Juice `mxssSinks=1, mxssNearSink=1, driveAttempted=true, driveExecuted=false` — tier-2 CDP drive RAN all renders (control + 2 canary shapes x 2 vectors), control clean, canary inert in every render = proven true negative, no #116 finding). Coverage 308/478. Baselines unchanged: DVWA 20, Juice 26. DVWA phases 98/87/11/0/0, 144 events; Juice phases 533/533/0/0/0, 592 events. `authDom: true` again on Juice (token, authInputs 1); scan errors []. |
| 29 | 9 Nov ~14:05 | 77th `18900b2f` | `h_7fb2db4ca4f4` {20,0} | `h_a02f5b2ea2b5` {26,0} | INCONCLUSIVE for rows #78 + #371, 0 retractions. Both legs baseline-exact, but the Juice coupon drive never ran (`couponRoutes=1, couponCodes=0, controlOk=false, attempts=0` — this Juice Shop build (v17.3.0) has NO coupon-list endpoint: GET /api/Coupons returns HTTP 500, and the bundle publishes no codes; the probe never guesses codes by design). DVWA `coupon-abuse` phase ok:true, 0ms, `couponRoutes=0, couponCodes=0, attempts=0` — DVWA has no coupon surface at all. Coverage stays 308/478. Fix: a dedicated coupon lab (port 3610) is built and parent-verified; re-proof runs on it. |
| 30 | 9 Nov ~14:46 | 78th `e0ef10a4` | `h_0f285f54870d` {20,0} | `h_b03922828348` {26,0} | PASS, 0 retractions. **Rows #91 + #89 + #90 AIB to LIVE — proven true negatives** (three two-tier DOM-sink oracles sharing the #275/#274 CDP harness; DVWA trio phases all skipped 'no script targets' by design — DVWA serves no JS; Juice `dom-open-redirect` ok:true, 8s, `redirectSinks=11, redirectNearSink=0, driveAttempted=true, driveExecuted=false` — CDP drive RAN (control + canary shapes, generic params redirect/next), canary never navigated; `dom-clobbering` ok:true, 19ms, `clobberSinks=0, clobberNearSink=0, driveAttempted=false` — ZERO sink-feeding global reads, no drive needed; `dom-cookie-manipulation` ok:true, 15ms, `cookieSinks=0, cookieNearSink=0, sessionOk=false, driveAttempted=false` — ZERO document.cookie writes, no drive needed; sessionOk false is the early-return artifact, the lab session existed (dom-render authDom true, token)). Coverage 313/478. Baselines unchanged: DVWA 20, Juice 26. DVWA phases 102/88/14/0/0, 148 events; Juice phases 537/537/0/0/0, 596 events. `authDom: true` again on Juice (token, authInputs 1); scan errors []. |
| 31 | 9 Nov ~15:50 | coupon lab `6e29eff5` (no backend deploy — labs-only) | `h_f9aac40ba461` {13,0} | `h_980af7709347` {13,0} | PASS, 0 retractions. **Rows #78 + #371 AIB to LIVE** (coupon-lab re-proof, port 3610 — both legs on the coupon lab, not DVWA/Juice: leg 1 default mode, `coupon-abuse` ok:true, `couponRoutes=1, couponCodes=2, controlOk=true, attempts=2, bypassKind='stacked'`, finding 'Business logic — two coupons stacked for a double discount (MEDIUM)'; leg 2 `COUPON_STACKING=fixed`, `coupon-abuse` ok:true, `couponRoutes=1, couponCodes=2, controlOk=true, attempts=3, bypassKind='reuse'`, finding 'Business logic — coupon code accepted again on a fresh basket (MEDIUM)'; other 12 titles identical across legs, stacking swapped for reuse exactly as designed; both legs 251 events). Coverage 315/478. Coupon lab is not a baseline lab. |
| 32 | 9 Nov ~16:35 | 79th `1fee5101` | `h_92b4e76cba79` {20,0} | `h_53e217a8729d` {26,0} | PASS, 0 retractions. **Row #342 GAP to LIVE — proven true negative** (api-token-auth probe: three-way differential on mined token-param API routes + two-login weak-token judgement, opaque tokens only; DVWA `api-token-auth` ok:true, `tokenUrlRoutes=0, tokenKind=null, tokenLen=0, tokensCompared=0, controlOk=false, attempts=0, bypassKind=null` — ZERO token-param routes on DVWA; Juice `api-token-auth` ok:true, `tokenUrlRoutes=0, tokenKind='jwt', tokenLen=732, tokensCompared=2, controlOk=false, attempts=0, bypassKind=null` — issued token is a JWT, leg silent by design (jwt.js owns those). Coverage 316/478. Baselines unchanged: DVWA 20, Juice 26. DVWA phases 103/89/0/14/0, 149 events; Juice phases 538/538/0/0/0, 597 events; scan errors []). |
| 33 | 9 Nov ~17:15 | 80th `619a8ba8` | `h_11df879eed51` {20,0} | `h_cbb5b38267b5` {27,0} | PASS, 0 retractions. **Batch of 9 lanes live-proven: #92 + #375 AIB to LIVE; scout rows #479-#484 to LIVE (extended 324/515).** DVWA phases 110/95/15/0/0, 156 events; Juice phases 110/110/0/0/0, 621 events. Juice baseline 26 -> 27: NEW title 'JWT payload carries sensitive data in its claims (MEDIUM)' (#481, tier secret, 2 sensitive fields, 15 claims scanned). Per-row: #92 CSWSH true negative both legs (wsSinks 0, wsEndpoints 0, driveAttempted true); #375 DVWA uncalibrated (workflowRoutes 0) + Juice calibrated silent (3 routes, controlOk true, 4 steps inspected); #479 calibrated true negative both legs (DVWA 4 params/40 attempts/0 oracle, Juice 2 params/20 attempts/0 oracle); #480 DVWA never ran (0 WS endpoints) + Juice 1 replay attempt, before==after==1, replayConfirmed false - snapshot oracle works live, WS title stays INTERMITTENT; #481 FIRED on Juice, DVWA true negative; #482 DVWA uncalibrated + Juice calibrated silent (controlOk true, attempts 5, failOpenKind null); #483 DVWA true negative (4 inputs, 1 sensitive, 0 unprotected - password input carries AUTOCOMPLETE='off', verified by direct curl; the lane's 'DVWA will fire' expectation was WRONG) + Juice 0 inputs (SPA shell); #484 DVWA skipped 'no script targets' + Juice ran (0 relaxations). #81 quota-bypass UNPROVEN - uncalibrated both legs (DVWA apiRoutes 0; Juice apiRoutes 2, controlOk false, attempts 0); feed is [...scanTargets, ...jsWriteTargets] so only templated write-targets were mined while /api/Products + /api/Feedbacks grant 200 JSON unauthenticated - fix lane: derive collection URLs from templated write targets. Coverage 318/478 = 66.5%. Baselines: DVWA 20, Juice 27. |
| 34 | 9 Nov ~18:10 | 81st `75f12de9` | `h_3446ed656867` {20,0} | `h_7a1342904b11` {27,0} | INCONCLUSIVE for row #81, 0 retractions. Both legs baseline-exact, but the quota-bypass drive never calibrated (DVWA `quota-bypass` ok:true, `apiRoutes=0, controlOk=false, attempts=0` - DVWA has no API surface at all; Juice `quota-bypass` ok:true, `apiRoutes=2, controlOk=false, attempts=0, throttled=false, bypassKind=null` - the control GET granted on NEITHER candidate, so no burst ran). The 81st-deploy fix (derive collection URLs from templated write targets) is live on EC2 (HEAD 75f12de9, PID 2499755, probe file carries deriveCollectionUrl), but the live record cannot show whether derivation ran: the new `derivedCollections` diagnostic was never wired into the phase extras in index.js (extras list only apiRoutes/controlOk/attempts/throttled/bypassKind). Decisive counter-evidence to the fix premise: the captcha probe in the SAME Juice hunt found `feedbackRoutes=1` from the identical feed ([...scanTargets, ...jsWriteTargets]), so a feedbacks-segment route WAS mined - the quota probe still did not calibrate. Next: a follow-up lane must reproduce the live feed, name the actual 2 candidates, fix the root cause (cap-2 cut, template shape, or wiring), wire the diagnostic into extras, and re-proof. Coverage stays 318/478 = 66.5%. Baselines unchanged: DVWA 20, Juice 27. DVWA phases 110/95/15/0/0, 156 events; Juice phases 110/110/0/0/0 (560 phase records), 621 events. |
| 35 | 10 Nov ~00:43 | 87th `74b3d733` | `h_a64dee98a867` {20,0} | `h_09574ffbb449` {25,0} | PASS, 0 retractions. **Zerodha FP-fix re-proof (sqlite regex `[_\s.]`): the genuine SQLi 'q' title is back on Juice; the 2 EL titles are confirmed old false positives and leave the baseline.** Row #197 (EL injection) LIVE to AIB — its only live evidence was those two titles (payload substring `dmElTesttoString` + SQLITE_ERROR echo, no evaluation; Juice is Node.js, no EL evaluator). Juice baseline 27 -> 25. Coverage 318 -> 317/478 = 66.3%. DVWA phases 110/95/15/0/0, 156 events; Juice phases 110/110/0/0/0 (560 phase records), 617 events. |
| 36 | 10 Nov ~02:13 | 88th `0f719c67` | `h_699c88a9225a` {20,0} | `h_58f21daaf58f` {26,0} | PASS, 0 retractions. **Row #81 AIB to LIVE — quota-bypass calibration fix live-proven** (control pass over all derived collections, MAX_CANDIDATES=12: Juice `quota-bypass` ok:true, `apiRoutes=12, derivedCollections=7, controlOk=true, attempts=15, throttled=false, bypassKind='no-rate-limit'`, NEW title 'API endpoint accepts repeated requests without rate limiting (MEDIUM)' — control GET /api/Products HTTP 200 -> 15 identical GETs unauthenticated, all 15 answered HTTP 200, no 429, no Retry-After, no refusal text; class `business_logic`, verified:true. DVWA `quota-bypass` honest no-op (apiRoutes=0, controlOk=false, attempts=0 — DVWA has no API surface). Coverage 317 -> 318/478 = 66.5%. Juice baseline 25 -> 26. DVWA phases 110/95/15/0/0, 156 events; Juice phases 110/110/0/0/0 (560 phase records), 619 events. |
| 37 | 10 Nov ~09:30 | 116th `1e88646f` | `h_d10b746ea393` {20,0} | `h_5f415ee3c617` {31,0} reported, 30 genuine | PASS with 1 FP retracted + LLM legs, 0 retractions. **Wave-2 re-proof: 23 rows AIB→LIVE. Coverage 318→341/478 = 71.3%.** DVWA baseline-exact 20/20 (175 events, phases 129/112/17/0/0, 390s). Juice: 26 baseline all present + 4 NEW genuine (678 events, phases 609/609/0/0/0, 646s): #55 weak password policy MEDIUM (POST /api/Users password 'a' → HTTP 201, id 279; strong-password control registered on the same route); #86 business-flow-access HIGH (GET /rest/basket/1 with canary token → 200, victim basket with seeded product 9, byte-identical to victim control; no-token 401); #171/#172 provisioning MEDIUM (fresh account GET /api/Users → 200, 78522 bytes = admin control; no-token 401); #259 session-timeout MEDIUM (login JWT carries no exp claim). Juice baseline becomes 30. **Race-condition [CRITICAL] title RETRACTED as false positive** (POST `/#/photo-wall` — the fragment never reaches the server, so the probe POSTed the SPA root; POST / returns the identical static shell 80117B every time; race.js `outcome()` counts a keyword match in that static body as 'success' with no state-change check) — NOT a baseline title; fix lane needed in race.js T1 (state-change check + skip fragment-only actions). LLM lab (port 3600) run 1 `h_b0c6316b408b` {11,0} INCONCLUSIVE for injection/limits (all 8 probes 0ms — llmGate needs labCreds and the driver passed none, so they never ran; 157 events, phases 129/81/48/0/0, 120s); run 2 `h_4e38aab168cd` {17,0} PASS with labCreds (169 events, phases 129/81/48/0/0, 120s) — all 6 expected legs fired: direct prompt injection leaks the system prompt (HIGH, #23/#20/#25), indirect prompt injection calls a tool from retrieved content (HIGH, #19/#376), RAG disclosure (HIGH, #24), rate-limit (HIGH, #26/#382), training-data regurgitation (MEDIUM, #512), training-poisoning (HIGH, #16/#378) — plus the LLM tools family ×4 (tool-misuse #384/#28, excessive-agency #17/#379, output-handling #18, misinformation #21/#381), request smuggling, and 5 header/cleartext titles. LLM lab baseline pinned at 17 (first baseline). **LLM lab crashed TWICE mid-proof** (04:19:28Z and 04:25:30Z, exit 1, `ERR_INVALID_URL` at server.js:296 — unguarded `new URL` on a scanner nuclei payload carrying an ANSI OSC-8 hyperlink to interact.sh); restarted both times, 200 again; needs a try/catch → 400 fix lane so a probe can never kill the target. sw-cache #460 NOT proven live (phase ran on Juice, 0 findings; tier-2 real-browser confirmation still outstanding). |
| 38 | 10 Nov ~12:06 | 119th `f45397a1` | — (Juice-only leg) | `h_ffed3b5abed9` {30,0} | PASS, 0 retractions. Race-condition [CRITICAL] title ABSENT — race fix validated live. Juice baseline 30. |
| 39 | 10 Nov ~13:10 | 120th `aa066b4e` | — (Juice-only leg) | `h_bbed67c68334` {30,0} | PASS, 0 retractions. Juice baseline 30. |
| 40 | 10 Nov ~14:29 | 124th `45b8f361` | — (Juice-only leg) | `h_5774b0204eb7` {28,0} | **FAIL — NOT a pass.** Two HIGH basket titles missing ('Business logic — negative quantity reduces the basket total' AND 'Unrestricted access to sensitive business flow — another user's basket readable'). Exclusive serialisation proven working, but the shared canary-basket/control-checkout step itself failed in isolation (product 9 at stock −1; Juice quantityCheck 400s). Fix: shared helper `seedFirstAddableProduct`, `MAX_SEED_PRODUCTS = 5` (lane c518c8b6 → 125th deploy). |
| 41 | 10 Nov ~15:37 | 125th `83001108` | — (Juice-only leg) | `h_6dd46e1c2e8f` {30,0} | PASS, 0 retractions. Title-set diff vs proof #39 baseline: EXACT MATCH 30/30 (1 critical / 9 high / 13 medium / 4 low / 3 info). Caveat: the Juice lab was freshly reset before the run, so the seed-fallback walk was NOT exercised live — covered by the lane's 5/5 unit tests. **This hunt was created by the driver (`lab_reval_driver.mjs`), which POSTs lab credentials — the fact that later explained Hunt A's 18/0.** |
| 42 | 10 Nov ~19:53–20:12 | 131st `bc623d9f` | `h_065db0ebd8df` {20,0} | `h_7f97eb9dac7d` {31,0} | **PASS, 0 retractions both legs. Feasible-remainder proof (8 rows) + lab-canary fallback proof. Coverage 338 → 346/478 = 72.4%.** Hunt A (Juice, website route, Infinity Autonomous, Standard, single page, created 19:45:52 IST, finished 19:53:03 IST, 651 events, 581 phases ok / 1 skipped / 0 failed / 0 timed out): **31 confirmed / 0 unconfirmed** — proof #41 baseline 30 exact + ONLY the new #79 title 'Login accepts repeated automated attempts with no bot challenge (MEDIUM)' (10 distinct wrong passwords to POST `/rest/user/login`, no bot challenge, no CAPTCHA widget; `anti-automation` phase `findingsCount=1, loginRoutes=1, controlOk=true, attempts=10, botChallengeSeen=false`). **Row #79 GAP → LIVE.** Both proof-#40-missing basket HIGH titles present. Per-row extras (verbatim, the proof): dom-render `domForms=1, authDom=true, authSession="token", authInputs=2, authForms=1` — the auth pass RAN on the website route for the first time (canary fallback: Juice `:3000` → the lab's public default admin account, role==='admin' + lab host only, fail-closed; lane a389081d, gate 3768/3757/0/11). #452–#455 CSTI **true negative**: `csti-frameworks` `frameworks=0, frameworkDetected=false, reactSink=false, skipReason='no matching framework'`. #459 WebRTC **true negative**: `driveExecuted=true, candidatesCollected=1, rfc1918Found=0, mdnsCandidates=1`. #460 SW cache **true negative**: tier 1 `swRegistered=false, swScripts=0, fetchHandlerPuts=0, keyNormalizedSinks=0` — no service worker registered in the scan context, nothing to poison (plan rule: no tier-2 signals → true negative). #475 remember-me **true negative**: `session-timeout` `loginRoutes=2, tokenFound=true, tokenJwt=true, expPresent=false, rememberMeSurface=false, rememberMeKind=null` (the 1 finding is the already-LIVE session-no-expiry title). #80/#83 closed out tried-and-negative in the same invocation that confirmed the −1 title in proof #41 — no new oracle, do NOT re-attempt. Hunt B (DVWA, website route, created 20:06:33 IST, finished 20:12:02 IST, 195 events, 128 phases ok / 20 skipped / 0 failed): **20 confirmed / 0 unconfirmed** — DVWA baseline 20 exact, no new titles (severity split 1 critical / 2 high / 9 medium / 8 low). DVWA extras: webrtc-leak `driveExecuted=true, candidatesCollected=1, rfc1918Found=0, mdnsCandidates=1` (true negative); session-timeout `loginRoutes=1, tokenFound=false, rememberMeSurface=false` (true negative for #475); anti-automation honest no-op `loginRoutes=1, controlOk=false, attempts=0` (DVWA login carries a per-session `user_token`, the control login did not calibrate — 0 findings, no false positive; #79 proof rides on Juice only); csti-frameworks + sw-cache-poisoning skipped 'no script targets' (DVWA serves no JS — Juice leg is the proof); basket-logic honest no-op `basketRoutes=0`; dom-render skipped 'static elements found' (designed). Behaviour-analysis fired on both legs (+$0.032662 Juice, +$0.018931 DVWA) but returned invalid JSON → 0 suggestions, 4th consecutive failure — parser-robustness fix lane queued. Evidence: `hidden_files/juice-reproof-131st-events.jsonl` (md5 7ea32cd4) + `hidden_files/dvwa-reproof-131st-events.jsonl` (md5 ca27bbde). Juice baseline becomes 31. |
| 43 | 10 Nov ~21:16 | 132nd `c15bf9c2` | — (Juice-only leg) | `h_d382c4489e18` {31,0} | **FAIL — scanner leg re-confirmed 31/0 (title set exact vs proof #42), behaviour-analysis leg FAILED.** Round-1 parser fix live on the 132nd build (retried:true, rawReply preview present), but BOTH provider calls truncated at their output-token caps — first call outputTokens 2000 (= cap), retry 1200 (= cap), suggestions [], 'AI reply was not valid JSON'. Cause confirmed from costs.json: the retry's tighter cap (1200 < 2000) made the second truncation certain. Fix: round-2 lane (compact prompt ≤5 suggestions, retry cap raised to 2000 = first call, truncated-JSON salvage, full rawReply persisted) → 134th deploy. |
| 44 | 10 Nov ~22:06 | 134th `1bd5c1a0` | — (Juice-only leg) | `h_8b66826a7ca8` {31,0} | **PASS, 0 retractions. Behaviour-analysis round-2 fix LIVE-PROVEN.** Hunt (website route, Infinity Autonomous, Standard, single page, created 21:58:40 IST, finished 22:05:56 IST, 714 events, phases 643 ok / 1 skipped / 0 failed / 0 timed out): **31 confirmed / 0 unconfirmed** — title-set diff vs proof #42 baseline: EXACT MATCH 31/31. aiAnalysis.json (status ok, provider meta, model muse-spark-1.3, created 22:06:20 IST): **5 valid suggestions, parsed on the FIRST call, no retry** — Reflected XSS on /snippets [high], JWT authentication bypass via tampering [high], Missing cookie security flags [medium], CSRF on state-changing actions [medium], User enumeration via login error oracle [medium]; all verified:false (leads only, no coverage impact). costs.json entry 16:36:20Z: inputTokens 19604, **outputTokens 1460 — below the 2000 cap** (+$0.03071; spend now $38.8815 / 4,679 entries). The round-2 salvage path was NOT exercised this run — the first call returned complete valid JSON, the stronger outcome. Evidence: `hidden_files/juice-proof44-events.jsonl` (md5 a82fe908). **DVWA leg (website route, Infinity Autonomous, Standard, single page, created 22:18:34 IST, finished 22:24:11 IST, 195 events, phases 128 ok / 20 skipped / 0 failed / 0 timed out): 20 confirmed / 0 unconfirmed** — title-set diff vs proof #42 Hunt B baseline: EXACT MATCH 20/20. aiAnalysis.json (status ok, provider meta, model muse-spark-1.3): **5 valid suggestions, first call, no retry** — Outdated Apache 2.4.25 [high], Login brute-force [medium], CSRF [medium], User enumeration [low], Password autocomplete [low]; all verified:false. costs.json entry 16:54:37Z: inputTokens 8388, **outputTokens 1748 — below the 2000 cap** (+$0.017914; spend now $38.8994 / 4,680 entries). Evidence: `hidden_files/dvwa-proof44-events.jsonl` (md5 4bc57af2). **Frontend panel fix live-verified 10 Nov ~22:26 IST** (merge 10846e06, gh-pages run 42859079931): the finished Juice hunt page shows all 5 AI leads, no 'jawab nahi mila', 31 confirmed still shown. **Proof #44 COMPLETE — both legs PASS.** |
| 45 | 10 Nov ~22:45 | 134th `1bd5c1a0` | Multi-page crawl (Juice, site scope) | `h_3ac68b859d4f` {31,0} | **Multi-page NOT proven — crawl scanned exactly 1 page.** Hunt (website route, Infinity Autonomous, Standard, scope site, created 22:38:15 IST, finished 22:45:17 IST, 713 events, phases 643 ok / 1 skipped / 0 failed / 0 timed out): **31 confirmed / 0 unconfirmed** — title-set diff vs proof #44 single-page baseline: EXACT MATCH 31/31. Crawl phase ok but `pagesScanned: 1` (5ms) — identical to the single-page proof #44 crawl (15ms, 1 page). Root cause read first-hand from `backend/src/scanner/crawl.js`: `crawlSite` BFS follows only raw-HTML `<a href>` links; Juice Shop is an Angular SPA shell whose routes render client-side, so no further links exist in raw HTML — the file's documented KNOWN LIMIT (9 Nov 2026). The crawler worked as designed; the target yields 1 HTML page. aiAnalysis.json (status ok): **5 valid suggestions, first call, no retry** — Reflected XSS in parameter 'q' [high], Stored XSS via log-viewer chain [high], JWT none-algorithm bypass [high], CSRF on basket/checkout [medium], User enumeration [medium]; all verified:false. costs.json entry 17:15:41Z: inputTokens 8388, **outputTokens 1499 — below the 2000 cap** (+$0.030905; spend now $38.9303 / 4,681 entries). Evidence: `hidden_files/juice-multipage-events.jsonl` (md5 1adf14e9). **DVWA leg (website route, Infinity Autonomous, Standard, scope site, created 22:51:20 IST, finished ~22:57 IST, 195 events, phases 128 ok / 20 skipped / 0 failed / 0 timed out): 20 confirmed / 0 unconfirmed** — title-set diff vs DVWA baseline: EXACT MATCH 20/20. Crawl phase ok but `pagesScanned: 1` (4ms) — multi-page NOT proven on DVWA either. Root cause verified first-hand: `/` → 302 to `/login.php`, and the login page carries exactly ONE `<a href>` (external `http://www.dvwa.co.uk/`), zero same-origin links; the crawl runs pre-login, so it never reaches the real nav. aiAnalysis.json (status ok): **3 valid suggestions, first call, no retry** — SQLi auth bypass on login.php [high], Reflected XSS on login.php [high], CSRF on login.php [medium]; all verified:false. costs.json entry 17:27:19Z: inputTokens 8420, **outputTokens 1731 — below the 2000 cap** (+$0.017882; spend now $38.9482 / 4,682 entries). Evidence: `hidden_files/dvwa-multipage-events.jsonl` (md5 907f8de9). **Proof #45 verdict: multi-page crawl NOT live-proven on either lab — Juice (SPA shell) and DVWA (login wall) both yield pagesScanned 1, by different verified mechanisms. The crawler works as designed in both cases; it only follows pre-login raw-HTML links.** Next: GitHub site-scope hunt (public multi-page site, no login needed) is the discriminating test. |

## Behaviour-analysis live proof (60th deploy `203c6d44`)

Lane `c4810c42` (11 files, +1346/-2). After a scanner hunt finishes, the frontend
fires ONE POST to `/ai-analysis`; the backend keeps one `behaviour.json` per hunt
(full behaviour per vulnerability) and hands it to Meta AI for NEW vulnerabilities
beyond the predefined ones. Suggestions are leads (`verified:false`), never
confirmed findings. Idempotent: a second POST returns the stored document, the
provider is never re-called. Provider failure stores `{status:'ai-unavailable'}`.

- DVWA `h_e624cc3bb325` — finished 13:52:44Z (360s), {20,0}, 133 events, 20/20
  titles baseline-exact, 0 retractions, `behaviour.json` on disk.
- Juice `h_5c62839bc56a` — finished 13:59:40Z (405s), {22,0}, 544 events, 22
  titles = 21 baseline + 1 NEW (WebSocket one-off, see below), 0 retractions,
  `behaviour.json` on disk.
- GET `/behaviour`: DVWA 200 (20 findings), Juice 200 (22 findings).
- POST `/ai-analysis` DVWA #1: 200, status ok, model `muse-spark-1.3`, 0
  suggestions (AI reply was not valid JSON, stored with a note). #2: stored:true,
  bodies equal — idempotency clean, no second provider call.
- POST `/ai-analysis` Juice #1: 200, status ok, **3 suggestions** (all
  verified:false): [high] exploitable DOM XSS via track-order orderId into
  `bypassSecurityTrustHtml`; [high] 2FA secret and setupToken disclosure via
  `/rest/2fa/status`; [medium] Cross-Site WebSocket Hijacking due to missing
  Origin validation. `aiAnalysis.json` on disk: DVWA ok/0, Juice ok/3.
- **Meta Model API key is ALIVE** (verified live 8 Nov ~19:36 IST with real
  `muse-spark-1.3` replies; it returned 401 on 4 Nov). The two API-check calls
  added $0.046 / 2 entries to the spend ledger (now $38.4464 / 4659).

## The WebSocket one-off (NOT a baseline finding)

- Title: "WebSocket — frame replay executes action twice (MEDIUM)", verified:true,
  class `websocket_tampering`. Fired once, 13:59:30Z, in Juice leg
  `h_5c62839bc56a` (behaviour proof). Emitter: `ws-messages` phase, T2 replay,
  LAB-ONLY probe.
- It never fired in proofs #12, #13 or #14. Confirmation re-run
  `h_7fb19f1c4e71` (Juice-only, finished 14:12:31Z, 420s): {21,0}, 542 events,
  21/21 baseline-exact, NO WebSocket title, 0 retractions. Proof #15 Juice leg
  also has no WebSocket title. Proof #16 Juice leg (`h_a704a2334c12`, {22,0})
  also has no WebSocket title. 6 Juice runs after the first fire, 0 reproductions.
- Verdict: **one-off** (lab socket.io state/timing). Juice baseline stays 21.
  The finding stands as verified inside its own hunt only. Nearest checklist rows
  #266/#268/#269/#270 are all already LIVE, so no coverage change either way.

## Pinned baselines (title sets)

### DVWA — 20 titles

1. Missing Strict-Transport-Security header
2. Missing Content-Security-Policy header
3. Missing X-Frame-Options header
4. Missing X-Content-Type-Options header
5. Missing Referrer-Policy header
6. Sensitive page cached by browser — Set-Cookie without Cache-Control: no-store (Medium, #96)
7. Reverse tabnabbing (MEDIUM)
8. Verb tampering — PUT
9. Verb tampering — DELETE
10. Verb tampering — PATCH
11. Server banner disclosure — Apache 2.4.25 (header)
12. Server banner disclosure — Apache 2.4.25 (error-page body)
13. Cookie 'PHPSESSID' missing security flags
14. Cookie 'security' missing security flags
15. HTTP request smuggling prerequisite
16. Target served over cleartext HTTP
17. DVWA Default Login
18. Sensitive Configuration Files Listing - Detect
19. Session fixation — session ID not regenerated on login (MEDIUM, T1)
20. Session fixation — planted session ID reaches authenticated state (HIGH, T2)

### Juice Shop — 26 titles

1. HTTP request smuggling (CL.TE desync proven)
2. Verb tampering — DELETE
3. Verb tampering — PATCH
4. Verb tampering — PUT
5. Missing Strict-Transport-Security header
6. Missing Subresource Integrity
7. Prometheus Metrics - Detect
8. Public Swagger API - Detect
9. Target served over cleartext HTTP
10. Error-based SQL injection in parameter 'q'
11. XPath injection (boolean) in parameter 'q'
12. Log injection — unescaped script in log-viewer surface (MEDIUM)
13. Information disclosure via error messages — SQLite error in an error response (malformed-query)
14. Missing Content-Security-Policy header
15. Missing Referrer-Policy header
16. Sensitive data stored in localStorage — 'token' written to browser storage that survives browser restart
17. Session lifecycle — bearer token remains valid after logout (MEDIUM, T4b)
18. Vulnerable merge library fingerprinted: jQuery@2.2.4 (INFO) (Low, since re-proof #5)
19. DOM XSS sink fingerprinted: bypassSecurityTrustHtml x9, innerHTML x22, document.write x1 (INFO) (Low, since re-proof #12, row #115)
20. Business logic — negative quantity reduces the basket total (HIGH) (since live-proof #16, rows #82/#370/#374)
21. Business logic — checkout accepted for an empty basket (HIGH) (since live-proof #17, row #87)
22. 2FA verification accepts repeated wrong codes without rate limiting (HIGH) (since live-proof #18, row #326)
23. Login accepts repeated wrong passwords without rate limiting (HIGH) (since live-proof #21, row #42)
24. BFLA — admin endpoint callable by low-privilege user (HIGH) (since live-proof #27, row #340)
25. JWT payload carries sensitive data in its claims (MEDIUM) (since live-proof #33, row #481)
26. API endpoint accepts repeated requests without rate limiting (MEDIUM) (since proof #36, row #81)
27. Weak password policy — trivial password accepted at registration (MEDIUM) (since proof #37, row #55)
28. Unrestricted access to sensitive business flow — another user's basket readable (HIGH) (since proof #37, row #86)
29. Insecure provisioning — freshly registered account can call an admin-only function (MEDIUM) (since proof #37, rows #171/#172)
30. Session token carries no expiry — it never times out (MEDIUM) (since proof #37, row #259)

### LLM lab — 17 titles (first baseline, proof #37 run 2 `h_4e38aab168cd`)

1. Missing Strict-Transport-Security header
2. Missing Content-Security-Policy header
3. Missing X-Frame-Options header
4. Missing X-Content-Type-Options header
5. Missing Referrer-Policy header
6. LLM endpoint accepts repeated requests without rate limiting (HIGH) (rows #26/#382)
7. LLM regurgitates memorised sensitive data verbatim from its knowledge store (MEDIUM) (row #512)
8. Poisoned retrieved content steers the model into an unrequested tool call (HIGH) (rows #16/#378)
9. HTTP request smuggling (CL.TE desync proven)
10. LLM tool invoked via prompt with no validation (HIGH) (rows #384/#28)
11. LLM agent deleted a user account with no confirmation step (CRITICAL) (rows #17/#379)
12. LLM output rendered as raw HTML without escaping (HIGH) (row #18)
13. LLM repeats a refund policy contradicted by its own knowledge base (MEDIUM) (rows #21/#381)
14. Direct prompt injection leaks the LLM system prompt (HIGH) (rows #23/#20/#25)
15. Indirect prompt injection makes the LLM call a tool from retrieved content (HIGH) (rows #19/#376)
16. LLM discloses sensitive data from its retrieval store (HIGH) (row #24)
17. Target served over cleartext HTTP

## Deploy chain (recent)

| Deploy | Commit | Workflow | Notes |
|--------|--------|----------|-------|
| 55th | `73095ab0` | 42465154054 | jsRoutes call-arg |
| 56th | `705a5c4e` | 42468137727 (rerun) | jsRoutes fetch-options (first attempt failed on GitHub-runner 504s, rerun green) |
| 57th | `b6d3dc6b` | 42475565023 | DOM-XSS sinks (#115) |
| 58th | `153e3373` | 42479212864 | CDP authenticated DOM render |
| 59th | `ae0f45ba` | 42482374251 | CDP connect bridge repair |
| 60th | `203c6d44` | 42486420990 | AI behaviour-analysis |
| 61st | `3c2a86a8` | 42488852862 | CDP host-network fix (`--network host`, fixed `http://127.0.0.1:9222`) |
| 62nd | `b1fa279f` | 42498808158 | Basket-logic probe, phase 88 (first AI-part lane) |
| 63rd | `66b02639` | 42502999724 | Professionalize repo to Obfinity company-product standard (docs/comments only, no live-proof) |
| 64th | `3766ae49` | 42506563300 | Workflow-skip probe, phase 89 (row #87) |
| 65th | `d48a083d` | 42509413641 | 2FA brute-force probe, phase 90 (row #326) |
| 66th | `69bef482` | 42513286560 | SSTI/EL/eval 9352-oracle FP fix (0-row, shared oracleGuards.js) |
| 67th | `07473376` | 42519158232 | DOM-XSS location.hash probe, phase 91 (row #275) |
| 68th | `82132710` | 42523100239 | Credential stuffing probe, phase 92 (row #42) |
| 69th | `074e3623` | 42534525078 | DOM postMessage probe, phase 93 (row #274) |
| 70th | `e3eac1e2` | 42538535922 | CSTI probe, phase 94 (row #190) |
| 71st | `cdf4a2d7` | 42548297209 | CAPTCHA bypass probe, phase 95 (row #40) |
| 72nd | `5f3ecf64` | 42554014971 | CAPTCHA feedback-route fix (row #40) |
| 73rd | `c5b25f26` | 42562053237 | CSS injection probe, phase 96 (row #194) |
| 74th | `a8e5b276` | 42572310222 | BFLA probe, phase 97 (row #340) |
| 75th | `ee975835` | 42579566956 | Mutation XSS probe, phase 98 (row #116) |
| 76th | `0eee858b` | 42582266153 | Site-crawl mode (scanScope page/site, route-grouped reporting; both proof legs baseline-exact with findingsByRoute live, but multi-page crawl NOT yet proven live — both legs crawled 1 page: Juice is an SPA with no <a> links, DVWA hits the login wall) |
| 77th | `18900b2f` | 42585263008 | Coupon-abuse probe, phase 99 (rows #78/#371, unproven — proof #29 INCONCLUSIVE) |
| 78th | `e0ef10a4` | 42587796527 | DOM trio probes, phase 102 (rows #91/#89/#90) |
| 79th | `1fee5101` | 42601378551 | API token auth probe, phase 103 (row #342) |
| 80th | `619a8ba8` | 42608825763 | Batch of 9 lanes (rows #92/#375/#479-#484), phase 110 |
| 81st | `75f12de9` | 42614065567 | Quota-bypass calibration fix (row #81, derive collection URLs from templated write targets; proof #34 INCONCLUSIVE - probe still uncalibrated live) |
| 82nd | `68c63b3b` | 42637255123 | PR #494 merged — repo professionalization (docs/comments, README/CONTRIBUTING/SECURITY; no live-proof) |
| 83rd | `41fe1c75` | 42640760239 | PR #418 merged — fix(#359): autofiler-no-fake-replay |
| 84th | `4fc3c2c9` | 42653597612 | PR #425 merged — fix(#366): brainaction-value-validation |
| 85th | `29368406` | 42656465347 | PR #402 merged — fix(#343): plugin-per-deployment-salt |
| 86th | `963ddea1` | 42666109813 | Zerodha FP fix (SSRF+SQLi, EL+LDAP oracle hardening) + CI Node 24 |
| 87th | `74b3d733` | 42678299299 | Sqlite DB-error regex fix `[_\s.]` (Zerodha re-proof #35) |
| 88th | `0f719c67` | 42682163321 | Quota-bypass calibration fix (row #81, proof #36) |
| 106th | `9cefeb4` | 42727384470 | Wave-2 lane 1: session-timeout probe, phase 111 (rows #259/#475) |
| 107th | `c4c396a` | 42729737822 | Wave-2 lane 2: provisioning probe, phase 112 (rows #171/#172) |
| 108th | `caedcef` | 42732195751 | Wave-2 lane 3: WebRTC probe, phase 113 (row #459) |
| 109th | `660e639` | 42734698008 | Wave-2 lane 4: LLM tools family probes, phases 114-117 |
| 110th | `ba3976d` | 42737395442 | Wave-2 lane 5: CSTI frameworks probes, phase 118 (rows #452-#455) |
| 111th | `3733696` | 42739692733 | Wave-2 lane 6: weak password policy probe, phase 119 (row #55) |
| 112th | `63a2427` | 42742174420 | Wave-2 lane 7: business flow access probe, phase 120 (row #86) |
| 113th | `67b4419` | 42745231992 | Wave-2 lane 8: LLM injection probe, phase 121 (rows #23/#20/#25/#19/#376/#24) |
| 114th | `feeb823` | 42747534689 | Wave-2 lane 9: LLM limits family probes, phases 122-128 |
| 115th | `bc1f4ea` | 42749770502 | Wave-2 lane 10: sw-cache poisoning probe, phase 129 (row #460) |
| 116th | `1e88646` | 42751955995 | Wave-2 lane 11: deep-coverage audit (no phase; proof #37) |

## Screenshots

Frontend captures of the Confirmed findings lists are added here as proofs land.
Proof #15 (8 Nov 2026) — captured from the live frontend
(https://hack.thebhavesh.online), signed in as the owner. The browser PDF save
captures the visible area, so each hunt is covered by overlapping segments
that together show the full detail view: hunt header (ID, finished status,
target), severity counts, and every confirmed finding.

Juice Shop `h_5894a14c4069` — 21 confirmed (1 CRITICAL, 5 HIGH, 8 MEDIUM,
7 LOW), finished 08/11/2026 19:52:42:

- `docs/proofs/proof-15-juice-h_5894a14c4069-top.pdf` — header, severity
  counts, findings 1–8.
- `docs/proofs/proof-15-juice-h_5894a14c4069-overlap-5-12.pdf` — findings
  5–12 in full (overlap segment).
- `docs/proofs/proof-15-juice-h_5894a14c4069-middle.pdf` — findings 9–17.
- `docs/proofs/proof-15-juice-h_5894a14c4069-bottom.pdf` — findings 16–21
  plus the hunt-ID footer.

DVWA `h_4d444fe51078` — 20 confirmed (1 CRITICAL, 2 HIGH, 9 MEDIUM,
8 LOW), finished 08/11/2026 19:46:32:

- `docs/proofs/proof-15-dvwa-h_4d444fe51078-top.pdf` — header, severity
  counts, findings 1–7.
- `docs/proofs/proof-15-dvwa-h_4d444fe51078-overlap-5-11.pdf` — findings
  5–11 in full (overlap segment).
- `docs/proofs/proof-15-dvwa-h_4d444fe51078-middle.pdf` — findings 9–16.
- `docs/proofs/proof-15-dvwa-h_4d444fe51078-bottom.pdf` — findings 16–20
  plus the hunt-ID footer.

## How to reproduce a proof

On EC2 (driver lives at `/tmp/lab_reval_driver.mjs`, local source
`~/workspace/dm-v2/probes/lab_reval_driver.mjs`, md5
`2513f06c1cc0c25134fbbc1cb462c9b4`):

```
node /tmp/lab_reval_driver.mjs DVWA JuiceShop
```

Run detached (`nohup` + log) — one lab takes 360-435s. The driver mints a 3h
owner JWT in-process from the backend process environment (never printed or
stored). Verify each leg by direct EC2 read: `meta.json` (`scannerSummary`),
title extraction from `events.jsonl` (`type:"finding"`), retraction check
(`grep -c retraction` must be 0).

## Maintenance

This file is the single record of live proofs (owner order, 8 Nov 2026). Every
new proof is appended here with its hunt IDs, legs, verdict and evidence — text
first, screenshots alongside. A proof is only listed once its legs are verified
by a direct EC2 read and pinned in memory.
