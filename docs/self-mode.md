# Self (Hunter Self) mode — backend

Owner order: 14 Nov 2026 ~22:28 IST. Self is the third mode next to Chat
and Autonomous: the user pastes one URL, and Dark Matter runs the
Go.xlsx checklist for it — one check at a time, or a whole category, or
the whole series (Recon → A16) — returning **short, filtered, processed
results** (counts + top findings + a few evidence lines), never a raw
tool dump.

## Checklist config

`backend/src/self/checklist.js` — **generated**, do not hand-edit.
Regenerate with `python3 backend/src/self/generate-checklist.py` from:

- `Go.xlsx` — 17 sheets, 232 rows → **202 distinct checks** after dedup
  by check name (the 15 REC cross-listings in A01/A02/A03/A04 and the 15
  A11–A16 focused-view rows are exact duplicates of home-sheet checks).
- `go-xlsx-coverage-map-20261114.md` — per-check coverage status.

Counts (verified by `backend/src/routes/self.test.js`):
**17 categories · 202 checks · 188 rule-based · 14 AI · coverage 108 LIVE /
64 GAP-partial / 30 GAP.**

### AI tagging (conservative)

`kind: 'ai'` **only** when the sheet's Tools column says the check needs
manual review (`"manual review"` / `"manual log review"`) — 13 A06 checks
(BIZ-01/02/06/09/10/11/13/15/18/19, API-08, ADV-04/05) + 1 A09 check
(CRYPT-11). No fully rule-based check is ever tagged AI.

GAP-partial checks stay `rule-based` (their predefined leg runs) and carry
`needsAiReview: true` — the judgment leg is flagged deferred, never
auto-run. This is a deliberate interpretation of the brief's "or GAP-partial
needing judgment" clause: tagging all 64 GAP-partial checks AI would stop
the series at REC-01 (GAP-partial) and no predefined work would ever run.

## Tool runner

`backend/src/self/toolRunner.js` — `runCheck(check, target, {execFn})`.

- Tools run inside **ephemeral** `darkmatter/hunt:latest` (Kali) containers
  via `docker/tools/kali-exec.sh` (`docker run --rm`, no `--privileged`,
  no host network, no volume mounts). The script's
  `--entrypoint /bin/bash` override is load-bearing: the image's
  hunt-runner entrypoint swallows bare command args (verified 14 Nov 2026
  on EC2: without it every tool returns
  `{"error":"no target"}`). Default executor `dockerExec`
  shells to that script; tests inject a stub `execFn`.
- One failed tool never kills the check: the failure is recorded and the
  next tool runs. A check with some legs failed/blocked is `partial`.
- Output caps (short by construction): stdout truncated to 200,000 chars
  before parsing; ≤ 10 findings per check; ≤ 5 evidence lines per finding;
  each evidence line ≤ 200 chars; summary ≤ 280 chars.
- Verdicts (checklist Yes/No): `yes` = a finding (evidence found);
  `no` = tools ran clean; `partial` = some legs blocked/failed;
  `unknown` = nothing ran.

### Tool inventory (verified inside the image, 14 Nov 2026)

Present: nmap, subfinder, amass, httpx, nuclei, nikto, sqlmap, ffuf,
hydra, gobuster, dirb, katana, dig, curl, python3 (+bs4, dnspython,
requests), openssl, ysoserial.

**Missing — reported as blocked, never faked** (specs `testssl-missing`,
`dnsx-missing`, `naabu-missing` in `TOOL_SPECS`):
testssl.sh (A04 TLS deep-scan leg; `openssl-tls` leg still runs), dnsx
(REC-02 DNS brute-force leg; `dig` still runs), naabu (REC-04 fast
port-scan leg; `nmap` still runs), whois (no leg defined — no check
depends on it alone). Also not in the image: go, dalfox, XSStrike,
Commix, SSRFmap, OpenRedireX, hashcat, trivy, snyk, Burp Suite, ZAP —
checks whose sheet tools are only those are covered by the curl/nuclei
legs defined in `TOOL_SPECS`, or are AI-kind (manual review).

**Manual legs — installed but never auto-run** (`hydra-manual`,
`ysoserial-manual`): hydra needs a login form + credentials the user
supplies; ysoserial payload execution would be destructive. Both are
recorded `skipped` with the reason, never executed.

### Probes that send payloads

`curl-xss` / `curl-ssti` / `curl-sqli` / `curl-xxe` / `curl-ssrf` send a
single benign marker payload to the **authorized target only** and check
whether the marker (or an error keyword) appears in the response. No
script executes anywhere, no file content is exfiltrated (the XXE probe
checks only whether the entity resolved; the SSRF probe checks only for
metadata markers in the target's response). All of them run only after
the run-creation `confirmedAuthorized` + SSRF gates (see below).

## Series runner + the AI gate

`backend/src/self/seriesRunner.js`.

- Run state machine: `phase: 'predefined' | 'awaiting-ai-consent' | 'ai' |
  'done'`, `aiConsent: null | true | false`.
- `runAll` / `runCategory` execute checks in sheet order (Recon → A16,
  rule-based legs first). On reaching the first AI-tagged check they stop
  and transition to `awaiting-ai-consent` — with **no AI call**.
- `runSingleCheck` enforces the same gate: an AI check with
  `aiConsent !== true` returns `{gated: true}` and nothing executes.
- `applyAiConsent(run, false)` marks all AI checks `skipped` and completes
  the run. `applyAiConsent(run, true)` resumes AI legs through an injected
  `aiExecutor`.
- **This build ships no `aiExecutor`.** There is no brain call anywhere in
  `backend/src/self/` (asserted by a test that greps the modules for brain
  imports). A consented AI leg is therefore recorded `blocked` with reason
  `ai-executor-not-configured` — honestly, never faked, never auto-approved.
  This upholds the standing **$0 Meta spend** order. Wiring a real executor
  is a separate, owner-approved step; it must go through `applyAiConsent`.
- Finished checks are never re-run (resume-safe: `runAll`/`runCategory`
  skip non-`pending` checks).

## Persistence

`backend/src/self/store.js` — one directory per run,
`<dataDir>/self-runs/<runId>/run.json` (atomic tmp+rename writes,
mirroring `backend/data/hunts/<id>/meta.json`). Checklist state survives
backend restarts; every mutation is written before the route replies
(background runs persist on every completed check via `onCheck`).

## Endpoints

All require `requireAuth`. Run creation requires
`confirmedAuthorized === true` and the same SSRF check as
`POST /api/v1/hunts` (private/internal IPs blocked; `LAB_TARGETS` env
exception for authorized lab targets). Runs belong to their creator
(admin may read any run).

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v1/self/checklist` | 202-check config for the UI |
| POST | `/api/v1/self/runs` | `{target, confirmedAuthorized:true}` → 201 |
| GET | `/api/v1/self/runs` | own runs, newest first |
| GET | `/api/v1/self/runs/:id` | run state + checklist Yes/No + evidence per check |
| POST | `/api/v1/self/runs/:id/checks/:checkId/run` | one check, synchronous; AI check without consent → 403 `ai_gate` |
| POST | `/api/v1/self/runs/:id/run-category` | `{category}`; background, 202 |
| POST | `/api/v1/self/runs/:id/run-all` | whole series; background, 202; stops at the AI boundary |
| POST | `/api/v1/self/runs/:id/ai-consent` | `{consent:true\|false}`; single decision (second call → 409) |

Registered in `backend/src/server.js` as `app.use('/api/v1/self', selfRouter)`
(next to the hunts registration).

Concurrent execution is guarded per run (second run while one is running
→ 409 `already_running`); a completed run cannot be re-run (`already_done`).

## Tests

`backend/src/routes/self.test.js` — 26 tests, `node --test`:

- checklist counts + coverage match to the map; every rule-based check
  references a real tool spec; AI checks declare no tools.
- parser tests (subdomains, nuclei JSONL, headers, reflection) and the
  short-output guarantee (5,000 raw lines collapse to a <20 KB object).
- runner resilience (failed tool, missing-tool blocked, manual skipped).
- **gate tests**: AI single-check without consent executes nothing
  (executor call count = 0); `runAll` stops at the first AI check;
  `consent:false` skips all 14; `consent:true` with no executor blocks
  all 14 with `ai-executor-not-configured`; `consent:true` with an
  injected executor resumes through it.
- route tests mounted for real (auth, confirmedAuthorized, owner-only,
  persistence on disk, run-all → boundary → consent flow).

## Live verification (EC2)

See the handoff report for the verification log. Lanes run against the
EC2 labs via the bridge IP `172.17.0.1` (never `127.0.0.1`) from a scratch
backend copy; the live `darkmatter-backend` service is never restarted.
EC2 driver runs use `/opt/node24/bin/node` (shell `node` is v20, no
WebSocket). Full-suite runs on EC2 need a **full repo-layout copy**
(backend-only scratch breaks tests reading `../../docs/` + lab scripts).
