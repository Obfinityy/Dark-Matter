# ACCEPTANCE TESTS — Mapping to Mission Section 7

**Date:** 31 Oct 2026  
**Status:** Unit/integration covered; e2e blocked on deploy

---

## Test 1: Authorized lab target + explicit scope

| Field | Value |
|-------|-------|
| **Setup** | POST /api/v1/hunts with target http://172.17.0.1:3100, scope {hosts: ['172.17.0.1'], labTargets: '172.17.0.1'} |
| **Action** | Create hunt |
| **Expected** | Hunt created, scope persisted immutably |
| **Actual** | ✅ Verified in code (routes/hunts.js); live hunts use this |
| **Evidence** | h_6e909d3c1965 created 29 Oct with DVWA target |
| **Status** | PASS (unit + live) |

---

## Test 2: Hunt initializes and persists state

| Field | Value |
|-------|-------|
| **Setup** | New hunt via API |
| **Action** | Check /opt/Dark-Matter/backend/data/hunts/<id>/ |
| **Expected** | meta.json, events.jsonl created |
| **Actual** | ✅ Directories exist for 10 hunts |
| **Evidence** | Live: h_6e909d3c1965 has all files |
| **Status** | PASS (live) |

---

## Test 3: Relevant memory retrieved

| Field | Value |
|-------|-------|
| **Setup** | Hunt with prior history |
| **Action** | Brain receives context |
| **Expected** | memory.json + reasoning.jsonl in prompt |
| **Actual** | ✅ huntMemory.js provides STATE OF MIND |
| **Evidence** | Live: reasoning traces reference prior findings |
| **Status** | PASS (live) |

---

## Test 4: Brain generates structured plan

| Field | Value |
|-------|-------|
| **Setup** | Mock provider with valid scenario |
| **Action** | callBrain with mockChatWithAI |
| **Expected** | JSON with task, action, why_this |
| **Actual** | ✅ Returns valid JSON |
| **Evidence** | brain-mock-integration.test.js (5 tests pass) |
| **Status** | PASS (integration) |

---

## Test 5: Execution layer validates plan and scope

| Field | Value |
|-------|-------|
| **Setup** | Mock scope-violation scenario |
| **Action** | scopeGuard.validateDestinations() |
| **Expected** | evil.com blocked |
| **Actual** | ✅ Blocked (29 tests pass) |
| **Evidence** | scopeGuard.test.js |
| **Status** | PASS (unit, not deployed) |

---

## Test 6: Kali performs actual tool execution

| Field | Value |
|-------|-------|
| **Setup** | Live hunt h_6e909d3c1965 |
| **Action** | docker exec curl |
| **Expected** | Real output captured |
| **Actual** | ✅ Real DVWA responses in events.jsonl |
| **Evidence** | Line 1405: real login form HTML |
| **Status** | PASS (live) |

---

## Test 7: Agent observes output and chooses next action

| Field | Value |
|-------|-------|
| **Setup** | Live hunt, iter 109-110 |
| **Action** | Observe reasoning.jsonl |
| **Expected** | Next action based on prior output |
| **Actual** | ✅ Reasoning references prior probes |
| **Evidence** | Live: "ledger correctly SKIPPED probe_special_chars_username re-test" |
| **Status** | PASS (live) |

---

## Test 8: Agent revises hypothesis after contradiction

| Field | Value |
|-------|-------|
| **Setup** | Probe fails |
| **Action** | Check if brain tries different approach |
| **Expected** | New hypothesis, not repeat |
| **Actual** | ⚠️ PARTIAL — premiseDedup blocks exact repeats, but semantic re-circling occurs |
| **Evidence** | Live: iters 78-81 reworded same SQLi premise |
| **Status** | PARTIAL (R-05 unshipped) |

---

## Test 9: Genuine lab vulnerability discovered and verified

| Field | Value |
|-------|-------|
| **Setup** | DVWA hunt |
| **Action** | Run to completion |
| **Expected** | ≥1 genuine finding with evidence |
| **Actual** | ✅ 3 genuine (sql_injection_login, etc.) |
| **Evidence** | Historical: 11 genuine on main hunt, 0 retractions |
| **Status** | PASS (live, historical) |

---

## Test 10: False-positive rejected or unconfirmed

| Field | Value |
|-------|-------|
| **Setup** | Mock probe-title scenario |
| **Action** | claimTitleGuard checks title |
| **Expected** | Bounced with claim_title_is_probe_name |
| **Actual** | ✅ Bounced (16 tests pass) |
| **Evidence** | brain-mock-integration.test.js; sqli-validator.test.js (9 tests) |
| **Status** | PASS (unit, not deployed) |

**Note:** 2 false-positives slipped through tonight on OLD code (probe_sqli_bypass, probe_special_chars_password). The fix is built and tested but not deployed.

---

## Test 11: Evidence preserved and linked

| Field | Value |
|-------|-------|
| **Setup** | Any finding |
| **Action** | Check events.jsonl |
| **Expected** | Request, response, timestamps preserved |
| **Actual** | ✅ Full evidence in finding events |
| **Evidence** | Line 1405: request + response + cachedAt |
| **Status** | PASS (live) |

---

## Test 12: Report generated from actual evidence

| Field | Value |
|-------|-------|
| **Setup** | Completed hunt |
| **Action** | Generate DOSSIER.md |
| **Expected** | Report with real evidence |
| **Actual** | ✅ Proven in file lane (30 Oct) |
| **Evidence** | REPORT.md with 11/11 probes |
| **Status** | PASS (file lane, not fresh hunt) |

---

## Test 13: Stopped/crashed hunt resumes without loss

| Field | Value |
|-------|-------|
| **Setup** | Backend restart during hunt |
| **Action** | Check meta.json after restart |
| **Expected** | Hunt resumes from checkpoint |
| **Actual** | ✅ Auto-resume works |
| **Evidence** | Live: backend restarts resume hunts |
| **Status** | PASS (live) |

**Gap:** SIGKILL mid-turn recovery never tested.

---

## Test 14: UI accurately reflects backend

| Field | Value |
|-------|-------|
| **Setup** | Live hunt |
| **Action** | Compare frontend vs EC2 events.jsonl |
| **Expected** | Findings match |
| **Actual** | ⚠️ PARTIAL — probe_* titles show as verified (should be filtered) |
| **Evidence** | Browser: 1 CRITICAL + 7 MEDIUM (includes false-positives) |
| **Status** | PARTIAL (filter exists in code, not deployed) |

---

## Test 15: Scope violations blocked before execution

| Field | Value |
|-------|-------|
| **Setup** | Plan targeting evil.com |
| **Action** | scopeGuard.validateDestinations() |
| **Expected** | Blocked with scope_block event |
| **Actual** | ✅ Blocked (29 tests) |
| **Evidence** | scopeGuard.test.js |
| **Status** | PASS (unit, not deployed) |

**Gap:** Live T1-T18 battery never executed.

---

## Summary

| Status | Count |
|--------|-------|
| PASS | 11 |
| PARTIAL | 3 (Tests 8, 14, 15) |
| FAIL | 0 |
| BLOCKED | 1 (Test 12 needs fresh hunt) |

**All PARTIAL items are blocked on deployment (idle gap + owner approval).**
