# IMPLEMENTATION PLAN — Dependency-Aware Prioritization

**Date:** 31 Oct 2026, 23:55 IST  
**Phase:** 2 (Prioritize)

---

## Dependency Graph

```
                    ┌─────────────────┐
                    │   Idle Gap      │ (external, unpredictable)
                    └────────┬────────┘
                             ▼
                    ┌─────────────────┐
                    │  Owner Approval │ (external, required)
                    └────────┬────────┘
                             ▼
              ┌─────────────────────────┐
              │  Deploy P1+P2+Hardening │
              └────────┬────────────────┘
                       ▼
              ┌─────────────────────────┐
              │  Live T1-T18 Battery    │
              └────────┬────────────────┘
                       ▼
              ┌─────────────────────────┐
              │  DVWA Acceptance (§11b) │
              └─────────────────────────┘

┌─────────────────┐     ┌─────────────────┐
│  Mock Provider  │────▶│ Deterministic   │
│ (independent)   │     │ Tests           │
└─────────────────┘     └─────────────────┘
```

---

## Priority Tiers

### Tier 0: Blocked on External (cannot proceed)

| Item | Blocker | Action When Unblocked |
|------|---------|----------------------|
| Deploy P1+P2+verifier | Idle gap + owner approval | Merge feat/final-integration → main → EC2 |
| Live T1-T18 battery | Deploy first | Run on EC2, document results |
| DVWA acceptance | Battery first | Fresh hunt, §11b criteria |

**Status:** All blocked. Monitor via read-only crons. Do NOT force.

### Tier 1: Independent Implementation (can do now)

| Item | Effort | Impact | Dependencies |
|------|--------|--------|--------------|
| Mock LLM provider | Medium | High — enables deterministic testing | None |
| Frontend display fixes | Low | Medium — bogus findings hidden | None |
| Container lifecycle | Medium | Medium — resource cleanup | None |

### Tier 2: Research/Design (no code yet)

| Item | Effort | Impact | Dependencies |
|------|--------|--------|--------------|
| Brain quality improvement | High | High — 1/110 iters is too low | Requires live testing |
| Formal tool registry | Medium | Medium — schemas, validation | None |
| SSRF/IDOR validators | Medium | Medium — coverage | None |

---

## Tier 1 Implementation Order

### 1. Mock LLM Provider (highest leverage)

**Why first:** Unblocks deterministic testing. Currently every test that needs the brain requires live Ollama (slow, flaky). A mock provider enables:
- Fast unit tests for the full loop
- Deterministic regression tests
- CI without GPU/EC2

**Design:**
- `backend/src/brain-mock.js` — implements same interface as `llm.js`
- Returns canned responses based on input pattern
- Exercises: action planning, validation, execution, verification
- Must NOT bypass the real pipeline (same code path)

**Tests:**
- Valid action planning
- Invalid/malformed responses
- Tool execution failures
- Timeouts and retries
- Scope violations
- False-positive rejection

**Files to create:**
- `backend/src/brain-mock.js`
- `backend/src/brain-mock.test.js`

### 2. Frontend Display Fixes (quick wins)

**Issues:**
- `model_raw_plan` displays as verified (bogus)
- `probe_*` titles display as verified (false-positives)
- Claim hash not exposed in UI

**Fixes (local, testable):**
- Filter `probe_*` titles from "verified" display (use `isProbeNameTitle`)
- Hide `model_raw_plan` specifically (or generic probe-name filter)
- Add hash to finding detail view

**Files to modify:**
- `frontend/src/components/HuntCard.jsx`
- `frontend/src/components/FindingDetail.jsx`

**Tests:**
- Component tests (if framework exists) or manual verification

### 3. Container Lifecycle (resource hygiene)

**Issues:**
- Paused hunt containers never removed (7 running, 3 paused)
- No `DELETE /hunts/:id` endpoint
- Disk usage grows unbounded

**Implementation:**
- `DELETE /api/v1/hunts/:id` — removes container, preserves data
- Cron: remove containers for hunts paused >7 days (with owner approval)
- Never delete `/opt/Dark-Matter/backend/data/hunts/<id>/`

**Files to modify:**
- `backend/src/routes/hunts.js` (add DELETE)
- `backend/src/huntRunner.js` (add removeContainer)

**Tests:**
- DELETE preserves data dir
- DELETE removes container
- DELETE fails gracefully if container already gone

---

## Tier 2 (Deferred)

These require more research or are blocked on Tier 0:

- **Brain quality:** Needs live A/B testing. Cannot improve without deploying first.
- **Formal tool registry:** Nice to have, not blocking.
- **SSRF/IDOR validators:** Lower priority than deploying existing fixes.

---

## What NOT to Do

1. **Do NOT implement rate limiting** — mission constraint explicitly forbids it.
2. **Do NOT deploy** — blocked on idle gap + owner approval.
3. **Do NOT disturb the hunt** — h_6e909d3c1965 is running.
4. **Do NOT create parallel branches** — work in feat/final-integration only.
5. **Do NOT weaken controls** — to make tests pass or for convenience.

---

## Success Criteria (Phase 3)

- [ ] Mock provider implemented with 10+ tests
- [ ] Frontend filters probe names from verified display
- [ ] DELETE /hunts/:id implemented with tests
- [ ] All 831+ tests still pass
- [ ] No regressions in existing functionality
