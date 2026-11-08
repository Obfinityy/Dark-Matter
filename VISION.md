# VISION.md — What We Are Building

> **Read this first.** This is the product definition for Dark Matter.
> Every engineer and AI contributor working on this repository builds toward it.

## The product

**Dark Matter** is an elite autonomous AI bug-bounty agent that replaces human
bug-bounty hunters — it thinks, hunts, verifies, writes PoCs, and delivers
submission-quality reports by itself. Around it sits **Infinity AI**, an
autonomous coding agent, and **Infinity Crew**, persistent AI coworkers.

One application. Three capabilities. Fully autonomous operation.

## The three pillars

### 1. Hunt (bug-bounty agent)
- An Obfinity operator submits ONE authorized target link → the agent does
  everything autonomously:
  recon → vulnerability detection → finding validation → exploit chaining →
  PoC generation → professional PDF report.
- Mid-hunt chat: the operator can ask for a status update at any time, in
  their own language, and the agent answers honestly.
- Hunt memory is persistent: resubmitting a hunted target returns its saved
  report instantly. Pause, resume, and continue are supported. Full-memory
  export and import are available.
- Hunt state is stored on Obfinity infrastructure, not in a capped cloud
  database.

### 2. Infinity AI (coding agent) — Chat / Plan / Build / Control
- **Chat**: answers questions, explains, reasons.
- **Plan**: breaks work into steps using the configured brain.
- **Build**: an autonomous coding agent that reads and writes real workspace
  files (for example, "build me a portfolio site" produces real files on disk).
- **Control**: genuine computer control — opens applications, types, and
  executes multi-step desktop workflows. No simulations, no mock controls.

### 3. Infinity Crew (persistent AI coworkers)
- An operator creates coworkers with a name, role, and instructions.
- Each coworker has its own computer (browser, files, terminal), persists
  across restarts, and is chat-driven, stoppable, and viewable live on screen.

## The brain

- Per-slot brains (Vision / Grounding / Hacking): a local model or a Kaggle
  Gradio link, configured on the Models page. No Ollama. No external API keys.
- The operator downloads a model (0–100%), presses Run, and the brain switches.
- A local heuristic learning layer improves payloads and strategies from
  completed hunts (stored on Obfinity infrastructure only — no remote training).

## The bar (acceptance criteria)

1. Paste link → autonomous hunt → mid-hunt chat → PoC + PDF. Fully working.
2. Model download → Run → active brain switch. Fully working.
3. Control mode performs REAL desktop actions (verified on a real Windows
   machine, not in a sandbox).
4. Infinity-level UX: never a generic chatbot look; responsive on every device.
5. **No rate limits. No usage quotas. No API keys.** Operators work without limits.

## Non-goals (never build these)

- Mock/simulated UI or demo-ware ("Simulate" buttons, template plans).
- Anything that hunts unauthorized targets or performs destructive testing.
- Features that require an operator to paste third-party API keys.

## How we work (for AI developers)

- `COORDINATION.md` — who owns what, claims, and inter-AI messages.
- `AGENTS.md` — technical onboarding: stack, commands, conventions.
- `ideas/manifest.json` — the 100,000+ idea roadmap being implemented wave by wave.
- GitHub-facing text (commits, PRs, issues): professional English only.
- Verify before push: frontend builds, backend boots, tests pass.
