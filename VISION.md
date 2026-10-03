# VISION.md — What We Are Building

> **Read this first.** This is the product bible for Dark-Matter.
> Every AI working on this repo must understand and build toward this.

## The product

**Dark-Matter** is an elite autonomous AI bug-bounty agent that replaces human
bug-bounty hunters — it thinks, hunts, verifies, writes PoCs, and delivers
submission-quality reports by itself. Around it sits **Infinity AI**, an
autonomous coding agent, and **Infinity Crew**, persistent AI coworkers.

One app. Three powers. Zero human babysitting.

## The three pillars

### 1. Hunt (bug-bounty agent)
- User pastes ONE target link → the agent does everything autonomously:
  recon → vulnerability detection → finding validation → exploit chaining →
  PoC generation → professional PDF report.
- Mid-hunt chat: the user can ask "kya kar raha hai?" anytime, in their own
  language, and the agent answers honestly.
- Hunt memory is local and persistent: re-pasting a hunted target returns its
  saved report instantly. Pause/resume/continue. Full-memory ZIP export/import.
- Local-first: hunt state lives on the user's machine, not in a capped cloud DB.

### 2. Infinity AI (coding agent) — Chat / Plan / Build / Control
- **Chat**: answers questions, explains, reasons.
- **Plan**: breaks work into steps using the configured brain.
- **Build**: autonomous coding agent that reads/writes REAL workspace files
  (e.g. "build me a portfolio site" → real files on disk).
- **Control**: REAL computer control — opens Edge, types in Notepad,
  multi-step desktop workflows. No simulations, no mock buttons. Ever.

### 3. Infinity Crew (persistent AI coworkers)
- The user creates coworkers with a name, role, and instructions.
- Each coworker has its own computer (browser, files, terminal) and persists
  across restarts. Chat-driven, stoppable, live screen view.

## The brain

- Per-slot brains (Vision / Grounding / Hacking): local model OR Kaggle Gradio
  link, configured on the Models page. No Ollama. No external API keys. Ever.
- The user downloads a model 0–100%, presses Run, and the brain switches.
- A local heuristic learning layer improves payloads/strategies from completed
  hunts (local files only — no remote training).

## The bar (acceptance criteria)

1. Paste link → autonomous hunt → mid-hunt chat → PoC + PDF. Fully working.
2. Model download → Run → active brain switch. Fully working.
3. Control mode performs REAL desktop actions (verified on a real Windows
   machine, not in a sandbox).
4. Infinity-level UX: never a generic chatbot look; responsive on every device.
5. **No rate limits. No usage quotas. No API keys.** The user is unlimited.

## Non-goals (never build these)

- Mock/simulated UI or demo-ware ("Simulate" buttons, template plans).
- Anything that hunts unauthorized targets or performs destructive testing.
- Features that require the user to paste third-party API keys.

## How we work (for AI developers)

- `COORDINATION.md` — who owns what, claims, and inter-AI messages.
- `AGENTS.md` — technical onboarding: stack, commands, conventions.
- `ideas/manifest.json` — the 100,000+ idea roadmap being implemented wave by wave.
- GitHub-facing text (commits, PRs, issues): professional English only.
- Verify before push: frontend builds, backend boots, tests pass.
