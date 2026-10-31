# RECOVERY PLAN — EC2 Degraded State

**Date:** 1 Nov 2026, 00:10 IST  
**Hunt:** h_6e909d3c1965 (RUNNING, iter 112)  
**Constraint:** Do NOT interrupt hunt without owner approval

---

## Priority 1: Immediate Non-Disruptive (no approval needed)

### 1.1 Monitor (ongoing)
- **Action:** Continue read-only monitoring via crons
- **Impact:** None
- **Risk:** None
- **Verification:** Hunt continues, driver.lock fresh

### 1.2 Document baseline
- **Action:** Record current zombie count, memory, disk
- **Impact:** None
- **Risk:** None
- **Verification:** Baseline in this document

**Baseline (00:10 IST):**
- Zombies: 514
- Memory avail: 211MB (2.7%)
- Swap: 100% used
- Disk: 89% used (11G free)
- Hunt: iter 112, RUNNING

---

## Priority 2: Requires Idle Gap (hunt paused, no owner approval for tech action)

### 2.1 Restart hunt containers (clears zombies)
- **Action:** `docker restart dm-hunt-h_6e909d3c1965`
- **Impact:** Hunt pauses, container restarts, hunt resumes from checkpoint
- **Risk:** LOW — checkpoint resume is proven
- **Verification:** 
  - Container Up with new start time
  - Zombie count drops to ~0
  - Hunt meta.json shows RUNNING, iteration preserved
  - Driver.lock fresh within 5 min
- **Rollback:** If resume fails, restore from checkpoint (manual)

### 2.2 Clear paused containers (frees resources)
- **Action:** `docker rm -f dm-hunt-h_bfb7a3a66bc8 dm-hunt-h_de4fc035049d dm-hunt-h_bench_d69e5746`
- **Impact:** Frees memory from 3 paused containers
- **Risk:** LOW — owner approved 31 Oct 14:31 (with resume verification)
- **Verification:**
  - `docker ps -a` no longer lists them
  - Hunt data dirs preserved in `/opt/Dark-Matter/backend/data/hunts/`
- **Rollback:** Containers can be recreated; data is preserved

**Note:** The 3 paused containers are also running `sleep infinity` with zombies. Removing them clears ~200 zombies.

---

## Priority 3: Requires Explicit Owner Approval

### 3.1 EC2 system restart
- **Action:** `sudo reboot`
- **Impact:** ALL hunts interrupted, backend down 2-3 min, auto-resume on boot
- **Risk:** MEDIUM — auto-resume is proven, but 17-day uptime suggests pending kernel updates
- **Why needed:** "System restart required" (MOTD), 514 zombies cleared, memory defragmented
- **Verification:**
  - Backend health 200 after reboot
  - Hunt auto-resumes from checkpoint
  - Zombie count = 0
  - Memory avail >1GB
- **Rollback:** None (reboot is one-way); data preserved on disk

### 3.2 Deploy P1+P2+hardening (unrelated to zombies, but blocked)
- **Action:** Merge feat/final-integration → main → EC2
- **Impact:** Backend restart, hunt auto-resumes
- **Risk:** LOW — tested, rollback via git revert
- **Why needed:** Security controls, verifier fixes
- **Verification:** Health 200, hunt resumes, new code live

---

## Tradeoffs

| Option | Zombies cleared | Hunt interrupted | Approval needed | Risk |
|--------|----------------|------------------|-----------------|------|
| Do nothing | No (grows) | No | No | Medium (OOM risk) |
| Restart hunt container | Yes (for that container) | Brief pause | Idle gap | Low |
| Remove paused containers | Partial (~200) | No (paused) | Idle gap* | Low |
| EC2 reboot | Yes (all) | Yes (2-3 min) | Owner | Medium |
| Deploy (restarts backend) | No (containers persist) | Brief | Owner | Low |

*Owner pre-approved 31 Oct 14:31, but idle gap still needed.

---

## Recommendation

**Short term (now):** Do nothing. Hunt is progressing (iter 112). Zombies are harmless (no memory impact). Monitor.

**Medium term (idle gap):** Restart the live hunt container + remove 3 paused containers. Clears ~400 zombies, frees memory, no data loss.

**Long term (owner decision):** EC2 reboot during a maintenance window. Clears all zombies, applies kernel updates.

**Do NOT:** Kill the sleep processes directly (kills containers). Kill zombies (impossible — they're already dead). Restart backend (doesn't affect containers).
