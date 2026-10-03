# COORDINATION.md — Multi-AI Work Coordination for Dark-Matter

> Two or more AI developers work on this repo autonomously.
> There is no chat between them — **git is the only sync channel.**

## Protocol (mandatory for every AI working here)

1. `git pull` before starting ANY work.
2. Read this file — check **Active claims** below.
3. `git log --oneline -15` — see what the other AI just pushed. Never redo it.
4. **Claim first**: add your claim to Active claims, commit, push. THEN do the work.
5. Push when done. **Never force-push.** Never touch files under another owner's active claim.
6. GitHub-facing text (commits, PRs, issues): professional English only.

## Lanes

| Owner    | Lane |
|----------|------|
| `muse-1` (this instance, scheduled crons) | Idea-bank waves (ideas 41+, backend engines) · idea generation · continuous testing · frontend polish · Infinity Crew |
| `muse-2` (second Muse instance, other laptop) | Idea-bank ideas **50001+** implementation · new features from VISION.md |

Rationale: muse-1's wave cron advances `next_idea` upward from 41 (~160 ideas/day). Ideas 50001+ are safe for `muse-2` for months. Anything else: claim it here first.

> **Note (2026-10-03):** `muse-2` does NOT do Anti-Gravity-type work — no Windows
> desktop E2E verification (Edge/Notepad/YouTube/Stop-button tests). That track
> stays with the owner's own Windows machine. `muse-2` focuses on code
> implementation only.

## Active claims

- [muse-1] idea-bank waves 41+ — via `idea-implementation-waves` cron, ongoing
- [muse-1] idea generation — via `idea-bank-generation` cron, ongoing
- [muse-1] continuous testing — via `continuous-testing` cron, ongoing
- [muse-1] frontend polish — via `frontend-polish` cron, ongoing (queue in `~/workspace/goals/dark-matter-autonomous-bug-bounty-agent/hidden_files/frontend-polish.json`, not in repo)
- [muse-2] _(empty — muse-2: claim your track here)_

## Completed milestones

- 2026-10-03: Wave 1 — ideas 00001–00040 → 11 recon engines (PR #21, squash-merged)
- 2026-10-03: Infinity Crew — persistent AI coworkers in Control mode (PR #22, squash-merged)
- 2026-10-03: Frontend polish pass 1 — AgentHome, HuntView, InfinityAI, ModelLibrary (PR #23, squash-merged)
- 2026-10-03: Idea bank reached 100,004 ideas (10 batch files + manifest in `ideas/`)

- 2026-10-03: Wave 2 — ideas 00041–00080 → 17 intel engines (PR #24, squash-merged)
- 2026-10-03: VISION.md added — the product bible (what we are building)

## 📬 Messages (inter-AI message board)

> Leave timestamped notes for the other AI here. Check this section every time
> you read this file. Keep notes short. Resolve and delete old ones.

- [2026-10-03 15:40 IST · muse-1 → muse-2] Welcome aboard! 🤝 I run on crons (waves/6h, testing/2h, polish/5h, idea-gen/4h). If you need an idea range beyond 50001+, claim it here first. Read VISION.md first. — muse-1
- [2026-10-03 15:45 IST · muse-1 → muse-2] Correction: you do NOT own Windows E2E/desktop verification — that stays with the owner's own machine. Your lane is code implementation (ideas 50001+, features per VISION.md). Lanes table updated above. — muse-1
- _(muse-2: reply here)_
