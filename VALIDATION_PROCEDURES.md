# VALIDATION PROCEDURES — Mock Mode and Authorized Lab

**Date:** 31 Oct 2026  
**Phase:** 5 (Validate)

---

## Part A: Deterministic Mock Mode

### Purpose
Validate the full agent pipeline without a live LLM or real target.
Exercises the SAME code path as production.

### Setup

1. **Enable mock mode:**
   ```bash
   export MOCK_BRAIN=1
   cd ~/workspace/dm-wt-finalverify/backend
   ```

2. **Verify mock is active:**
   ```bash
   node -e "import('./src/brain-mock.js').then(m => console.log(m.isMockBrain()))"
   # Should print: true
   ```

### Test Scenarios

| Scenario | How to trigger | Expected behavior |
|----------|---------------|-------------------|
| Valid plan | `mockScenario: 'valid'` | JSON with shell action; passes actionPlan validation |
| Invalid JSON | `mockScenario: 'invalid-json'` | JSON.parse throws; error handled gracefully |
| Missing action | `mockScenario: 'missing-action'` | Validation fails; no execution |
| Scope violation | `mockScenario: 'scope-violation'` | scopeGuard blocks evil.com |
| Probe title | `mockScenario: 'probe-title'` | claimTitleGuard bounces probe_* title |

### Running Mock Tests

```bash
# Unit tests for mock provider
node --test 'src/brain-mock.test.js'

# Integration tests (mock → callBrain → validation)
node --test 'src/brain-mock-integration.test.js'
```

**Expected:** 14 tests, all pass.

### What Mock Mode Validates

- [x] Brain response parsing (valid and invalid JSON)
- [x] Action plan structure validation
- [x] Scope violation blocking
- [x] Probe title bouncing
- [x] Null response handling

### What Mock Mode Does NOT Validate

- Real LLM reasoning quality
- Real tool execution outputs
- Real vulnerability discovery
- Timing/latency behavior

---

## Part B: Authorized Lab Validation

### Purpose
Validate the system end-to-end against a real vulnerable target (DVWA)
with the real LLM provider, in a controlled environment.

### Prerequisites (ALL must be met)

- [ ] P1+P2+verifier hardening DEPLOYED to EC2
- [ ] Live T1-T18 egress battery PASSED
- [ ] Owner approval for lab hunt
- [ ] DVWA available at http://172.17.0.1:3100 (lab target)

### Procedure

**Step 1: Create fresh hunt**
```bash
curl -X POST https://api.thebhavesh.online/api/v1/hunts \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "target": "http://172.17.0.1:3100",
    "scope": {
      "hosts": ["172.17.0.1"],
      "labTargets": "172.17.0.1"
    },
    "brain": "ollama"
  }'
```

**Step 2: Monitor (read-only)**
- Check meta.json every 10 min: iteration, state
- Check events.jsonl for new findings
- DO NOT intervene

**Step 3: Acceptance criteria (§11b)**

| Criterion | How to verify |
|-----------|---------------|
| ≥1 genuine finding | Finding with non-probe title, verified:true, evidence shows real vuln |
| Frontend report | Finding appears in UI with evidence |
| Pause/resume no-dup | Pause hunt, resume, verify no duplicate findings |
| SIGKILL recovery | Kill container mid-turn, verify resume from checkpoint |
| Out-of-scope blocked (app) | Attempt evil.com, verify scope_block event |
| Out-of-scope blocked (net) | Attempt evil.com, verify iptables DROP |

**Step 4: Record evidence**
- Save events.jsonl finding entries
- Screenshot frontend
- Document timestamps

### Expected Results

Based on historical data:
- 11 genuine DVWA findings proven (4 critical, 5 high, 2 medium)
- 0 retractions
- Verifier correctly rejects false-positives

### Current Status

**BLOCKED.** Cannot proceed until:
1. Idle gap appears (hunt h_6e909d3c1965 is active)
2. Owner approves deploy
3. P1+P2 deployed and live battery passes

---

## Validation Summary

| Mode | Status | Coverage |
|------|--------|----------|
| Mock unit | ✅ DONE | 9 tests, all pass |
| Mock integration | ✅ DONE | 5 tests, all pass |
| Lab e2e | ❌ BLOCKED | Requires deploy |

**The mock mode validates the pipeline logic. The lab validates real-world behavior. Both are needed for full confidence.**
