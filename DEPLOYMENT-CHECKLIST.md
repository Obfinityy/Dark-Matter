# Deployment Checklist — Verifier False-Positive Hardening

**Branch:** `feat/final-integration` (local, unpushed)  
**Status:** NOT READY — required live tests unexecuted  
**Date:** 31 Oct 2026

## Pre-Deployment Gates (ALL must pass)

### 1. Safe Idle-Gap Criteria
- [ ] Hunt `h_6e909d3c1965` driver.lock stale >5 minutes
- [ ] No new events in events.jsonl for >5 minutes
- [ ] BOTH conditions met simultaneously (not just one)
- [ ] Evidence: timestamps of lock file and last event recorded
- [ ] Owner approval obtained (required per 15:52 + 17:33 IST orders)

**Current status:** Hunt is ACTIVE (iter 109-110). NO idle gap has occurred.

### 2. Final Clean Dependency Installation
- [ ] Fresh worktree from origin/main
- [ ] `rm -rf node_modules && npm ci` in backend/
- [ ] Verify 122 packages installed, no audit errors
- [ ] **Lesson (31 Oct 20:00 IST):** Stale node_modules caused 31 phantom failures. Always fresh install before trusting counts.

### 3. Full Regression Suite
- [ ] `node --test 'src/**/*.test.js'` in backend/
- [ ] Expected: 831 tests, 820 pass, 0 fail, 11 skipped
- [ ] Frontend suite: `npm test` in frontend/ (if applicable)
- [ ] All new validator tests pass:
  - [ ] sqli-validator.test.js (9 tests)
  - [ ] vuln-class-validators.test.js (18 tests)

**Current status:** ✅ 820/0/11 locally (31 Oct 23:30 IST)

### 4. Merge and Push Steps
- [ ] Create fresh worktree from origin/main: `git worktree add ~/workspace/dm-deploy origin/main`
- [ ] Merge integration branch: `git merge feat/final-integration`
- [ ] Resolve conflicts (if any) — previous merge had 1 conflict in llm.js (resolved)
- [ ] Verify `git log --oneline -1` shows merge commit
- [ ] Push via token URL: `git -c credential.helper= push "https://Obfinity:${TOKEN}@github.com/Obfinityy/Dark-Matter.git" main`
- [ ] **DO NOT** use GIT_ASKPASS (fails with "Invalid username or token")
- [ ] Verify push succeeded: `git ls-remote origin main`

**⚠️ WARNING:** Push triggers EC2 deploy workflow. Only push during idle gap.

### 5. CI Status
- [ ] GitHub Actions "Deploy backend to EC2" workflow triggered
- [ ] Workflow run completes successfully (green)
- [ ] Check run ID and logs for errors
- [ ] Verify workflow skipped restart if hunt active (by design)

### 6. EC2 Deployment Procedure
- [ ] SSH to EC2: `ssh -o ProxyCommand="python3 ~/workspace/proxy_ssh_direct.py %h %p" -o StrictHostKeyChecking=no -i ~/.ssh/id_ed25519 ubuntu@13.233.230.240`
- [ ] `cd /opt/Dark-Matter && git fetch origin`
- [ ] Verify: `git log --oneline -1 origin/main` matches pushed commit
- [ ] Deploy: `git merge --ff-only origin/main` (NOT `git pull` — fails with "Cannot fast-forward to multiple branches")
- [ ] If workflow already pulled, verify HEAD matches
- [ ] Restart backend ONLY if hunt is paused or in idle gap: `sudo systemctl restart darkmatter-backend`
- [ ] **DO NOT** restart during active hunt (auto-resume may work, but risky)

### 7. Health Check
- [ ] `curl https://api.thebhavesh.online/api/v1/health` returns 200
- [ ] Response time <2s
- [ ] Backend logs show no errors: `sudo journalctl -u darkmatter-backend -n 50`
- [ ] Hunt auto-resumed (if restarted): check meta.json state=running
- [ ] Verify new code is live: check for `validateSqliAuthBypass` in deployed differential.js

### 8. Live Egress Battery Prerequisites and Results
**Prerequisites (verify BEFORE running):**
- [ ] `sudo -n true` works (passwordless sudo for firewall rules)
- [ ] `EGRESS_USE_SUDO=1` in backend/.env
- [ ] `DM_PINNED_RESOLVER` set (DNS pinning for egress control)
- [ ] `CAP_NET_ADMIN` available (for iptables/ipset)

**Battery:**
- [ ] Run: `node --test 'src/egressBattery.test.js'` on EC2
- [ ] Expected: 17 pass, 11 skipped (require live firewall)
- [ ] Document results

**Current status:** ❌ NEVER EXECUTED. This is a deployment blocker.

### 9. Controlled DVWA Acceptance
**Only after steps 1-8 pass:**
- [ ] Create fresh hunt via real API: POST /api/v1/hunts with DVWA target
- [ ] Brain: default 8B (not parent)
- [ ] Zero intervention during hunt
- [ ] PASS criteria:
  - [ ] ≥1 genuine verified finding (not probe_*, not false-accept)
  - [ ] Finding appears on frontend
  - [ ] Pause/resume works without duplicates
  - [ ] SIGKILL recovery works
  - [ ] Out-of-scope blocked at BOTH layers (scopeGuard + egress)
- [ ] Record verbatim evidence

**Current status:** ❌ NOT EXECUTED. This is a deployment blocker.

### 10. Rollback Plan
**If deployment fails:**
1. `git revert <merge-commit>` on main
2. Push via token URL
3. On EC2: `git fetch origin && git merge --ff-only origin/main`
4. Restart backend: `sudo systemctl restart darkmatter-backend`
5. Verify health check passes
6. Verify hunt resumed

**Emergency rollback (if main is broken):**
1. On EC2: `git merge --ff-only origin/main~1` (previous known-good)
2. Restart backend
3. Fix forward on branch, re-deploy

**Known-good commit:** `88c8b0c` (currently deployed, stable)

## Deployment Blockers (Must Resolve Before "READY")

1. ❌ **No idle gap:** Hunt h_6e909d3c1965 is active. Cannot push during active hunt (triggers restart).
2. ❌ **Live egress battery never executed:** T1-T18 tests require production firewall. Cannot mark "ready" without this.
3. ❌ **DVWA acceptance not run:** §11b requires fresh hunt with ≥1 genuine finding. Not yet executed.
4. ❌ **Owner approval:** Required per standing orders (15:52 + 17:33 IST).

## Post-Deployment Verification

After successful deployment:
- [ ] probe_sqli_bypass re-audit: Verify the finding is now classified as "probe note" (not "verified")
- [ ] New probe_* titles are bounced by claimTitleGuard
- [ ] SQLi auth-bypass claims require demonstrated state change
- [ ] Frontend "Confirmed" count drops to genuine unique findings
- [ ] No regressions in hunt loop (turns continue, no crashes)

## Files Changed (This Deployment)

**New files:**
- `backend/src/probe_sqli_bypass-reaudit.md` (assessment, not code)
- `backend/src/vuln-class-verification-audit.md` (documentation)
- `backend/src/hunt-intel/sqli-validator.test.js` (9 tests)
- `backend/src/hunt-intel/vuln-class-validators.test.js` (18 tests)
- `DEPLOYMENT-CHECKLIST.md` (this file)

**Modified files:**
- `backend/src/hunt-intel/differential.js`:
  - Added `validateSqliAuthBypass()` (SQLi auth-bypass validator)
  - Added `isWeakSignalOnly()` (generic weak-signal rejector)
  - Added `validateXssClaim()` (XSS validator)
  - Added `validateCommandInjection()` (CMDi validator)
  - Added `validatePathTraversal()` (Path traversal validator)
  - Added `validateVulnClaim()` (dispatcher)

**Test results:** 831 tests, 820 pass, 0 fail, 11 skipped
