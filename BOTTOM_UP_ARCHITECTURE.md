# BOTTOM-UP ARCHITECTURE

**Date:** 1 Nov 2026  
**Mission:** Dark Matter — Bottom-Up Human-Level Autonomous Agent

---

## Layer Stack

```
┌─────────────────────────────────────────┐
│ L8: Observation-Driven Feedback         │ ← Next action from previous result
├─────────────────────────────────────────┤
│ L7: Tool Registry & Orchestration       │ ← Validated dispatch (dual paths)
├─────────────────────────────────────────┤
│ L6: Planning & Task Management          │ ← Goal→Hypothesis→Action (partial)
├─────────────────────────────────────────┤
│ L5: Persistent Memory                   │ ← 7 memory types, survives reboot
├─────────────────────────────────────────┤
│ L4: Context Engineering                 │ ← 12K SOM budget, deterministic
├─────────────────────────────────────────┤
│ L3: Brain (LLM Reasoning)               │ ← Ollama 8B (BLOCKED: OOM)
├─────────────────────────────────────────┤
│ L2: Eyes (Perception)                   │ ← Text-only (screenshots not seen)
├─────────────────────────────────────────┤
│ L1: Hands (OS Execution)                │ ← 17 actions, Kali container
├─────────────────────────────────────────┤
│ L0: Machine Runtime                     │ ← Docker, checkpoint recovery
└─────────────────────────────────────────┘
```

---

## Data Flow

1. **Hunt created:** User submits target + scope via frontend
2. **Container spawned:** `huntRunner.js` creates `dm-hunt-<id>` with `--init`
3. **Loop begins:** `huntAgent.js` drives iterations
4. **Context built:** `huntMemory.js` assembles STATE OF MIND (12K budget)
5. **Brain called:** Ollama 8B (or mock) returns structured JSON
6. **Action validated:** `actionPlan.js` → `actionVerify.js` → `scopeGuard.js`
7. **Executed:** `docker exec` in Kali container
8. **Observed:** stdout/stderr/exit code captured
9. **Assessed:** `assessResult()` classifies outcome
10. **Verified:** Class-specific validators check evidence
11. **Learned:** Events appended; dead-ends recorded; global memory updated
12. **Repeat:** Next iteration uses updated state

---

## Key Design Decisions

1. **File-based storage:** No database; JSONL append-only logs
2. **Per-hunt isolation:** Memory never crosses hunt boundaries
3. **Fail-closed scope:** `scopeGuard.js` blocks before execution
4. **Evidence-first:** Validators require demonstrated impact, not keywords
5. **Checkpoint resume:** Survives backend restart, container restart, reboot

---

## Known Limitations

1. **Brain is text-only:** 8B model never sees screenshots (fundamental)
2. **Dual dispatch:** `huntAgent.js` vs `humanLoop.js` (consolidation risky)
3. **8B unreliable:** OOM kills on 8GB box; 1.5B works but weaker
4. **No IDOR:** Logic flaw testing not implemented
5. **No visual planning:** Cannot use screenshots for decisions
