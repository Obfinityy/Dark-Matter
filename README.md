# Dark Matter — Autonomous Bug-Bounty Agent

> **Hire an elite bug-bounty hunter. Give it a link. It does the rest.**

Dark Matter by **Obfinity** is an autonomous AI security researcher that thinks and works like an elite human bug-bounty hunter — not a vulnerability scanner. You hand it a target you are authorized to test, and it takes it from there: understanding the application, following its curiosity, testing its own hypotheses, verifying what it finds, and writing you a professional report.

---

## What it is

Most security tools run a checklist: test for SQL injection, then XSS, then move on. Dark Matter doesn't work that way. It works the way a hired expert works:

1. **You give it a link** — a target you own or are authorized to test.
2. **It gets its own machine** — a dedicated cloud environment where it runs every test in isolated containers. Your infrastructure is never touched.
3. **It understands the app first** — before testing anything, it builds a mental model: *What does this app do? Where does money flow? Where does trust flow? Who controls this number?*
4. **It follows curiosity, not a checklist** — like a human, it notices things that look odd and wonders "what if I…". A price it can see, an ID that looks guessable, a step in a checkout that could be skipped — it pulls those threads.
5. **It verifies before it reports** — every finding goes through confirmation probes. Unreproducible results are discarded, not reported. Only verified vulnerabilities reach you.
6. **It remembers** — everything it learns is saved to its persistent memory, so each hunt makes it sharper.

The brain is an **uncensored AI model running on our own infrastructure** — no third-party API, no data leaving our servers, no rate limits deciding when it can think.

---

## What it can do

- **Reconnaissance** — maps the attack surface: endpoints, parameters, technologies, authentication flows.
- **Business-logic testing** — the bugs scanners miss: price manipulation, quantity tampering, IDOR, workflow bypasses, coupon/credit abuse, state-machine flaws.
- **Classic vulnerability classes** — SQL/NoSQL injection, XSS, SSRF, authentication bypasses, access-control flaws.
- **Exploit chaining** — connects smaller findings into higher-impact chains (three mediums can become one critical).
- **Differential verification** — every finding is confirmed with true/false control probes before it's reported.
- **Professional reporting** — one-click reports (Markdown/PDF) with evidence, reproduction steps, and impact — ready for human review before any submission.
- **Mid-hunt collaboration** — chat with the agent while it works: ask what it's found, steer it toward an area, pause or stop anytime.

---

## How it works

```
You paste a target link (authorized)
        │
        ▼
┌─────────────────────────────┐
│  Dark Matter Cloud (AWS)    │
│                             │
│  ┌───────────────────────┐  │
│  │ AI Brain              │  │  Uncensored model, thinks like
│  │ (elite hunter mind)   │  │  a human hunter
│  └───────────┬───────────┘  │
│              │ plans        │
│  ┌───────────▼───────────┐  │
│  │ Hunt Engine           │  │  Isolated Docker container
│  │ (hands)               │  │  per hunt — nothing escapes
│  └───────────┬───────────┘  │
│              │ tests        │
│  ┌───────────▼───────────┐  │
│  │ Verification Gate     │  │  Confirm or discard
│  └───────────┬───────────┘  │
│              │              │
│  ┌───────────▼───────────┐  │
│  │ Memory                │  │  Learns across hunts
│  └───────────────────────┘  │
└─────────────────────────────┘
        │
        ▼
You get a report with verified findings
```

**Topology:** frontend (`hack.thebhavesh.online`) + backend API (`api.thebhavesh.online`) + hunt engine + AI brain — all on dedicated AWS infrastructure. Hunts run in per-hunt Docker containers that are destroyed when the hunt ends.

---

## Current status

Dark Matter is in **active development** toward a single goal: a hunter that can stand next to an elite human bug-bounty hunter and outperform them — verified by blind benchmarks against deliberately vulnerable targets, not by claims.

What's working today: autonomous hunting loop, human-like reasoning engine, isolated execution, verification gates, persistent memory, live hunt chat and control.

What's being hardened: model reliability under sustained load, reasoning-memory influence on decisions, and the agent's ability to fetch its own tools and knowledge mid-hunt — the way a hired human would.

---

## Quick start (developers)

```bash
# Backend (API + orchestrator)
cd backend && npm install && npm start        # → http://localhost:4000

# Frontend
cd frontend && npm install && npm run dev     # → http://localhost:5173
```

**Deploy:** frontend auto-deploys on push to `main`. Backend runs on AWS EC2 via systemd (`darkmatter-backend.service`).

**Env (backend):** `JWT_SECRET`, `ALLOWED_TARGETS` (comma-separated, required for hunts), `CORS_ORIGINS`, `DATA_DIR`, `OLLAMA_MODEL`, `OLLAMA_NUM_CTX`, `OLLAMA_TIMEOUT_MS`.

---

## Safety

- **Authorized targets only.** Every hunt requires an explicitly named target plus `confirmedAuthorized: true`, enforced against an `ALLOWED_TARGETS` allowlist.
- **Non-destructive testing.** The agent never runs denial-of-service, brute-force, or destructive payloads.
- **Isolated execution.** Every hunt runs in its own Docker container with no access to host infrastructure. Containers are destroyed on hunt end.
- **Human review before submission.** Reports are for your review. The agent never submits to a bounty program on its own.

---

## License

Dark Matter © Obfinity. Third-party components retain their own licenses — see `THIRD_PARTY_NOTICES.md`.
