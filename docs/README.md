# Documentation index

Every document in this repository, what it is, and whether it is live or historical. Start here if you are new — the onboarding path is `README.md` → `DEVELOPERS.md` → this index.

## Start here

| Document | What it is |
|---|---|
| [`../README.md`](../README.md) | Product summary, architecture overview, quickstart, scripts, testing |
| [`../DEVELOPERS.md`](../DEVELOPERS.md) | Complete technical reference — brain, memory, OS control, hunt lifecycle, deployment |
| [`../CONTRIBUTING.md`](../CONTRIBUTING.md) | How to contribute (issues first, branches + PRs, style, testing) |
| [`../SECURITY.md`](../SECURITY.md) | How to report a vulnerability in Dark Matter itself |
| [`../AGENTS.md`](../AGENTS.md) | Onboarding guide for AI coding agents working in this repo |
| [`../VISION.md`](../VISION.md) | Product vision — the three pillars (Hunt, Infinity AI, Infinity Crew) |
| [`../PROOF.md`](../PROOF.md) | **Live.** The single record of verified live proofs, with evidence in `proofs/` |

## Architecture & operations

| Document | What it is |
|---|---|
| [`architecture.md`](architecture.md) | Architecture from the actual code — components, data flow, deployment, testing |
| [`aws-deploy.md`](aws-deploy.md) | **Internal runbook.** EC2 deployment (backend + hunt engine) |
| [`../backend/README.md`](../backend/README.md) | Backend API contract and environment variables |
| [`../frontend/README.md`](../frontend/README.md) | Frontend setup and structure |
| [`../docker/README.md`](../docker/README.md) | Hunt/engine images, Compose, setup scripts |
| [`../voice/README.md`](../voice/README.md) | STT/TTS services |
| [`../engine/pentagi/INTEGRATION.md`](../engine/pentagi/INTEGRATION.md) | Hunt-engine API contract (PentAGI, integrated by reference) |
| [`../docker/tools/README.md`](../docker/tools/README.md) | Sandbox tools (JWT battery, Nuclei, API sequencer) |
| [`../backend/PLAYBOOK.md`](../backend/PLAYBOOK.md) | Agent procedural memory — rules earned from validator-confirmed hunts |

## Scanner

| Document | What it is |
|---|---|
| [`scanner/README.md`](scanner/README.md) | The deterministic rule-based scanner — how it works, probe list |
| [`scanner/*.md`](scanner/) | One doc per vulnerability class probed (SQLi, XSS, SSRF, IDOR, …) |

## Research & evidence

| Document | Status |
|---|---|
| [`vuln-research-2026-10-13.md`](vuln-research-2026-10-13.md) | Research — vulnerability-discovery methods behind `hunt-intel/` |
| [`vuln-research-round2-2026-10-13.md`](vuln-research-round2-2026-10-13.md) | Research — second round |
| [`brain-architecture.md`](brain-architecture.md) | Design doc — brain architecture (Oct 2026) |
| [`ELITE-PROOF.md`](ELITE-PROOF.md) | **Historical.** Model-capability evidence from 16 Oct 2026 (Dolphin 3.0 8B) — not current live status |
| [`vnc-pip-plan.md`](vnc-pip-plan.md) | **Plan only, not implemented.** VNC / picture-in-picture live screen streaming (15 Oct 2026) |
| [`proofs/`](proofs/) | PDF evidence for `PROOF.md` (proof #15 screenshots) |
| [`probe_sqli_bypass-reaudit.md`](probe_sqli_bypass-reaudit.md) | Audit note — SQLi bypass probe re-audit (moved from `backend/src/`) |
| [`vuln-class-verification-audit.md`](vuln-class-verification-audit.md) | Audit note — vulnerability-class verification (moved from `backend/src/`) |

## Archive

| Document | What it is |
|---|---|
| [`archive/COORDINATION.md`](archive/COORDINATION.md) | **Frozen history.** The Infinity One / Infinity Two coordination log (Oct 2026). The wave pipeline it coordinated was stopped by owner order on 11 Oct 2026; the last entry is 8 Oct 2026. Kept for the record — do not resume it. |
