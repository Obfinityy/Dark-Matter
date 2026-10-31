# SECURITY REVIEW — Boundaries, Secrets, Scope, Recovery

**Date:** 31 Oct 2026  
**Phase:** 6 (Harden)

---

## 1. Security Boundaries

### Application Layer (P1)

| Control | Status | Location |
|---------|--------|----------|
| Scope validation before exec | ✅ Built, not deployed | `scopeGuard.js`, gate at `huntAgent.js:1898` |
| Probe title bouncing | ✅ Built, not deployed | `claimTitleGuard.js`, gates at `assessResult` and `finding()` |
| Command injection prevention | ✅ Verified | `executionFailed()` blocks failed exec evidence |
| XSS in findings | ✅ Verified | Output sanitized in frontend |

**Gap:** Brain Console manual shell path is NOT gated by scopeGuard. A user with Brain Console access can run arbitrary commands without scope checks.

**Recommendation:** Gate the manual shell path or document as admin-only.

### Network Layer (P2)

| Control | Status | Location |
|---------|--------|----------|
| Per-hunt iptables | ✅ Built, not deployed | `egressControl.js` |
| Filtering proxy | ✅ Built, not deployed | `egressProxy.js` |
| Fail-closed | ✅ Built, not deployed | Default DROP |
| Private IP blocking | ✅ Built, not deployed | scopeGuard + egress |

**Gap:** Live T1-T18 battery never executed. Firewall rules unproven in production.

---

## 2. Secrets Handling

### Audit Results

| Secret | Location | Status | Risk |
|--------|----------|--------|------|
| JWT secret | `/etc/darkmatter/env` (0600) | ✅ Secure | Low — systemd EnvironmentFile, not in code |
| GitHub token | `~/.git-credentials` | ✅ Secure | Low — user home, 0600 |
| Razorpay test keys | `backend/.env` (gitignored) | ⚠️ Review | Medium — in chat history; rotation recommended after testing |
| META_API_KEY | EC2 `.env`, GitHub secrets | ✅ Secure | Low — presence verified, value never shown |
| Ollama | No auth (localhost) | ✅ OK | Low — loopback only |
| SSH key | `~/.ssh/id_ed25519` | ✅ Secure | Low — 0600, never exposed |

### Secrets in Code

**Verified:** No secrets in source code (git history checked).
**Verified:** No secrets in logs (checked).
**Verified:** No secrets in LLM prompts (sanitizeForModel).

### Recommendations

1. **Rotate Razorpay keys** after testing complete (they appeared in chat history).
2. **Document** secret rotation procedure.
3. **Audit** `.env` files for accidental commits (pre-commit hook).

---

## 3. Scope Enforcement

### Defense in Depth

| Layer | Control | Status |
|-------|---------|--------|
| 1. UI | Scope input in NewHuntModal | ✅ Live |
| 2. API | Scope persisted immutably | ✅ Built, not deployed |
| 3. App | scopeGuard validates commands | ✅ Built, not deployed |
| 4. Network | iptables + proxy | ✅ Built, not deployed |

**Current production:** Only Layer 1 is live. Layers 2-4 are code-complete but not deployed.

**Risk:** Without Layers 2-4, a compromised brain could target out-of-scope hosts.

**Mitigation:** Deploy P1+P2 at idle gap (blocked).

---

## 4. Finding Integrity

### Controls

| Control | Status |
|---------|--------|
| Probe titles bounced | ✅ Built, not deployed (claimTitleGuard) |
| Class-specific validators | ✅ Built, not deployed (validateSqliAuthBypass, etc.) |
| Re-run verification | ✅ Live (evidenceReproduced) |
| Immutable evidence | ✅ Live (events.jsonl append-only) |
| Retraction support | ✅ Live (retraction events) |

**Incident (31 Oct):** 2 false-positives (probe_sqli_bypass, probe_special_chars_password) verified on OLD code. New validators correctly reject both.

**Risk:** Until deployed, false-positives can still be verified.

---

## 5. Recovery

### Hunt Recovery

| Scenario | Status |
|----------|--------|
| Backend restart | ✅ Auto-resumes from checkpoint (live) |
| Container destroyed | ✅ Auto-respawn (live) |
| Ollama wedge | ✅ Watchdog v8 kills and recovers (live) |
| Ollama crash | ✅ Loop survives via retry (live) |
| SIGKILL mid-turn | ❌ Never tested |

### Data Recovery

| Scenario | Status |
|----------|--------|
| Hunt data loss | ✅ File-based, survives restarts |
| Accidental delete | ⚠️ No backups; DELETE preserves data dir by design |
| Corruption | ❌ No checksums or validation |

**Recommendations:**
1. Test SIGKILL recovery (acceptance).
2. Implement periodic backups of hunt data.
3. Add data integrity checks.

---

## 6. Resource Limits

| Limit | Status |
|-------|--------|
| Command timeout | ✅ 120s enforced (live) |
| Budget cap | ✅ $10 enforced (live, hit 28 Oct) |
| Disk quota | ❌ Not implemented |
| Memory limit | ⚠️ Docker defaults only |
| Max runtime | ❌ Not implemented (only budget) |
| Rate limiting | ❌ Not implemented (mission forbids) |

**Risk:** Runaway hunt could fill disk (no quota).

**Mitigation:** P3 resource work planned (log rotation, quotas).

---

## Summary

| Area | Rating |
|------|--------|
| Boundaries (app) | 🟡 Built, not deployed |
| Boundaries (net) | 🟡 Built, not deployed |
| Secrets | 🟢 Good (1 rotation recommended) |
| Scope | 🟡 Partial (1 layer live of 4) |
| Integrity | 🟡 Built, not deployed |
| Recovery | 🟢 Good (1 gap: SIGKILL) |
| Resources | 🟡 Partial (no disk quota) |

**Overall:** Security architecture is SOUND but NOT DEPLOYED. The code is ready; operational deployment is blocked.
