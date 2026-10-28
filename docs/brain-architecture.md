# Brain Architecture — the autonomous bug bounty hunter agent

**Status:** built in the `feat/gui-type-target` lane (28 Oct 2026). Merged/deployed
only after tests pass + live UI verification, and only when no live hunt turn
is running. **The API gate is 200% sure: Meta's $140 is used ONLY when the
parent is 200% sure the agent delivers real vulnerabilities. Until then the
parent stays the API** (it replies with structured JSON through the Brain
Console, exactly like the API brain would — no manual hunting outside the
system, no tokens spent).

## The aim

An autonomous bug bounty agent that thinks BY ITSELF, does everything BY
ITSELF, and controls the machine BY ITSELF. If it wants a tool, it downloads
it on the machine itself. It searches on the machine itself. If it does not
know something, it can do ANYTHING on the machine — download a tool, run a
script, do anything — just with the brain. The brain is made, memory and all
things are made — now these things have to be done. **AT MINIMUM COST.**
How it is done is ours (parent + coordinator); the owner gives the target.

## The three files (the brain's context — `backend/src/brainFiles.js`)

Per hunt, on disk in `DATA_DIR/hunts/<huntId>/` (per-hunt isolated — x.com's
files are x.com's only, never shared, never global):

| File | Contents | Sent every turn? |
|---|---|---|
| `memory.json` | Titles + hashes ONLY — what was done, NOT the results. A-to-Z complete on disk (no cap), so the brain NEVER repeats work. | Yes (budgeted rendering: rollup + most recent) |
| `process.json` | The current process — task, goal, progress, `in_process` boolean, and EVERY line of what happened in it. | Yes (budgeted rendering: most recent lines + count) |
| `output.json` | The results — how/why/what was found, by hash. | **No** — stays on the backend; fetched ONE result at a time by hash/id (recall) |

Flow: the prompt is predefined (identity: elite bug bounty hunter agent +
process rules) + the file values (memory + process) every turn. The brain
replies with CLEAN structured JSON (`task`, `goal`, `progress`, `action`,
`recall`). The backend executes it, saves the output by hash, updates the
process file, and updates the memory file (title + hash) on task completion.

**Why files, not just `events.jsonl`:** the record already existed implicitly
in events + the reasoning ledger, but nothing said "this is the memory, this
is the process" — the brain was sent a rebuilt briefing each turn instead of
ITS OWN files. The files make the contract explicit and auditable.

**What already existed (built on, not rebuilt):** the brain-json lane's
action index (hashes), output-by-hash, per-hunt isolation, save-on-completion.
The files are the explicit form of that shape.

**Design note — budgeted screen, complete files:** the files on disk are
A-to-Z complete, but the block sent every turn renders them budgeted (the
memory rollup + most recent entries; the process's most recent lines + a
count of earlier ones), so the prompt budget holds. The full-ledger briefing
still rides beside the files block for now (it carries findings / dead-ends /
dossier the files do not yet); the files-only screen is the named next step,
not a silent cut.

## Process lifecycle (the boolean)

- `in_process: true` while a process runs, `false` when it finishes.
- Process identity is the brain's task string (normalised: case + whitespace
  folded). Same task = same process; a different task closes the old one into
  history and starts a new one.
- A `status: complete` task block flips `in_process` to false and closes the
  process; the memory file gains its title + hash.
- A failed step closes its process as `failed` and still lands in memory as
  failed work — the brain must know it tried this, so it never retries blind.
- When a process finishes (`false`), the brain thinks of a NEW process — a
  new vulnerability, a new curiosity, a new variety. Loop: process runs
  (true) → finishes (false) → brain creates the next process.
- Example process: intercept a request, then do a JWT token attack on it —
  that is ONE process.

## Recall with a reason

When the brain needs the output of something it did before, it gives the hash
and says WHY: `{"recall":{"id":7,"reason":"I need the exact UNION payload
that dumped the users, to reuse it on the next endpoint"}}`. The process file
records all three: the data was requested, the data was given (or not found),
and why it was asked for. The reason is **optional in validation** (never
block a recall over it — live hunting must not stall on a missing field) but
the prompt tells the brain to always give it; a missing reason is recorded as
`(no reason given)`.

## Full OS control (`backend/src/osControl.js`)

The brain controls the ENTIRE Kali Linux OS on EC2 through JSON actions —
browser + shell + desktop GUI + tools — for ALL THREE brains identically
(parent via Be a Brain / brain-json, API brain via Meta, local brain via 8B
darkmatter-v1). One shared path at the machine layer: the parent path
(`brainMode.executeBrainAction`) now dispatches the same 17 actions the API
brain already had, over the SAME helpers (`desktopControl.js`, `screenMap.js`,
`desktopAtspi.js`, `toolLaunch.js`, `proxyIntercept.js`, `guiTools.js`):

`browser_snapshot`, `screenshot`, `desktop_snapshot`, `desktop_click`,
`desktop_key`, `desktop_click_at`, `desktop_click_control`, `list_controls`,
`desktop_screenshot`, `see_screen`, `desktop_terminal`, `launch_tool`,
`download_tool`, `proxy_start`, `intercept_list`, `intercept_read`,
`intercept_replay`.

Plus the original fix that started this lane: `browser_type` takes a field
target (label OR CSS selector, same as `browser_click`); the driver focuses
the field, clears it, types, and verifies the value landed BEFORE any submit.
A type without a target is refused; a driver mismatch is a FAILED step, never
a fake success. After EVERY GUI action the observation names the focused
element, the current field values, the page URL, and a short snapshot.

**Known limitation (recorded, not fixed in this lane):** the action detail
still carries typed text in plain text — a password typed via `browser_type`
lands in the record. The vault fill path (`use_saved_credential`) is the
password-safe route; observations mask password values.

**Follow-up (named, not silently skipped):** the API brain's dispatch is
still a 600-line inline chain inside `humanIteration`, threaded through
session state. `osControl.js` shares the machine layer, not the dispatch.
Extracting ONE dispatch both call sites use is the next step — rewiring the
live loop mid-lane risked the hunt.

## The vision loop

The brain does NOT look at the machine directly. The AGENT sees the screen,
takes a screenshot (a photo), and SENDS it to the brain. The brain
understands the photo and decides. The agent also reports `in_process`
true/false. Loop: agent sees → agent sends photo + process state → brain
understands → brain replies with the next action (clean structured JSON) →
agent executes it on the OS → agent sends the next photo.

Built now: `see_screen` (screenshot → OCR text map with coordinates, the
working vision path for the agent — click from the map with
`desktop_click_at`, then `see_screen` again to confirm the screen changed)
and `desktop_screenshot` (the full desktop frame saved as a hunt artifact,
which the live UI shows). The multimodal photo leg — sending the actual
image to the API brain — waits for the API gate to lift (the brain never
sees the image until then; the parent brain sees the photo in the live UI).

## Live UI

The owner complaint (28 Oct 18:32 IST): the hunt showed `PAUSED` while the
parent-brain was actively working; the live machine, browser, and updates
were invisible. Fixed:

- Backend: `GET /:id/process` (`deriveProcessState`) now carries the live
  truth — `in_process`, a one-line `activity` ("Parent brain working — …"),
  the `lastAction` (tool + label + hash), the `lastScreenshot` artifact, and
  the last known `desktop` (window titles + focused app). Recorded in hunt
  meta whenever an OS/GUI action produces an artifact or desktop state.
- Frontend: the hunt card shows the live activity line (with a pulsing LIVE
  dot while `in_process`) beside the "You are the brain" badge, polls
  `/process` every 15s while the parent is the brain, and mounts the
  LiveMachine panel for a parent-brain hunt WITH a process running — a
  paused hunt with NO running process still shows no panel (the 27 Oct
  frozen-desktop fix stands).
- The Brain Console's process panel shows the live line, last action, desktop
  focus, and last screenshot name.
- `GET /:id/brain-files` serves the three files for inspection (output values
  never listed — one result at a time, by hash, via `/output/:hash`).

## The prompts are predefined and complete

The prompts tell the brain everything it needs — how to reply, how to
respond, what to do, what everything is — because the API will NOT have
every single thing on its own. The brain's reply is ABSOLUTELY clean
structured JSON. The vision loop lets the brain see everything of the machine
and control it with JSON. Everything shows on the frontend.

## Probe rules (lessons the parent-as-brain paid for)

- **Stored XSS probe** (`~/workspace/dm-v2/probes/parent_brain_sxss.py`,
  fixed 28 Oct 18:48 IST): the clean re-run showed control script TRUE, so
  nothing was filed — the guestbook keeps injected entries from earlier runs,
  and the probe reused one marker (`SXSS7719`) with a page-wide script check.
  Fix: a UNIQUE marker per run (base + random 8-hex suffix) AND an
  entry-scoped script check (the window after this run's marker, cut at the
  next entry boundary — never page-wide). The page-wide value is printed only
  as a diagnostic; the VERDICT uses entry-scoped values only. The candidate
  SXSS7719 stays recorded (unfiled, unverified) — the agent re-probes it
  correctly later. Genuine verified stays 2 (Reflected XSS HIGH + Command
  Injection CRITICAL). The container copy at `/opt/hunt/` is stale until
  re-copied from the workspace.
- **Evidence rules (for the API brain too):** evidence must be the raw
  multi-line probe output (real newlines), never a single-line summary; it
  needs a distinctive signal (a bare marker echo is rejected); a canary token
  only counts when its line also carries a supporting signal.

## Decision log — additions / removals WITH reason

| Change | Reason (why, what got better, what problem it solved, what else it enabled) |
|---|---|
| `browser_type` requires a field target (label or CSS selector) | The DVWA login failed while every action reported success — 'admin' then 'password' went into the same unfocused field. Now the driver focuses, clears, types, verifies. Enabled: GUI login, any form work, for all three brains. |
| GUI failure = FAILED step, never fake `task_complete` | Same login failure: the old code called `finish()` unconditionally. Now the brain sees its own failure and can correct itself. |
| `osControl.js` — full OS surface for the parent brain | The parent-as-API could not snapshot the desktop, click a window, press a key, or launch Burp — it could only do browser + shell. Now it drives the whole machine. Enabled: the vision loop + live UI + real tool use. |
| `osControl.js` as a separate module (not a humanLoop rewrite) | Rewiring the 600-line live dispatch mid-lane risked the hunt. The machine layer IS shared; the single-dispatch extraction is named as the next step. |
| Three explicit files on disk (`brainFiles.js`) | The record existed only implicitly; nothing said "this is the memory, this is the process". Explicit files make the brain's context auditable. Enabled: recall-by-hash, the process boolean, A-to-Z memory. |
| Process file carries FULL detail (every line) | The owner: "while a process runs, EVERY line goes into the process file". The brain knows exactly what it is doing and how far it reached. |
| Memory file A-to-Z complete on disk, budgeted on screen | Never repeat work (full history on disk) without blowing the prompt budget (rollup + most recent per turn). |
| Recall carries a reason (optional in validation) | The brain must say WHY it needs past data; the process file records request + gift + reason. Optional so live hunting never stalls on a missing field. |
| Live UI: activity line + `in_process` + LiveMachine for running parent processes | The owner could not see what was running. The hunt no longer looks dead while the parent works. |
| Stored XSS probe: unique marker + entry-scoped check | Control contamination (see Probe rules) made a real candidate unfileable. The fix makes re-probes trustworthy. |
| `desktop_terminal` heavy-scan gate BYPASSED for the parent | Its patterns live unexported in `humanLoop.js` and the parent is a human choosing one command at a time, not an AI looping. Follow-up: export the patterns and apply them here too. |
| API-brain ledger kept beside the files block (not removed) | It carries findings/dead-ends/dossier the files do not yet. Removing it in this lane would drop context the brain relies on. Files-only screen is the named next step. |
| Dedupe identity keeps `target ← text` (like with like) | Typing 'admin' into the username field and into a search box are different actions, not the same repeat. Consequence, recorded: pre-fix history has plain-text type records, which never match a new `target ← text` candidate — post-fix repeats count fresh. Safe direction (under-blocking, never over-blocking); no live hunt gets wrongly blocked. Test seeds moved to the new format for the same reason. |
| No new hunt / budget / model mutation in the console | Out of scope for this lane; the console stays a brain, not a hunt manager. |

## What remains (named, not hidden)

1. Single-dispatch extraction (API brain + parent brain call one dispatch).
2. Files-only per-turn screen (retire the full-ledger briefing once the files
   carry findings/dead-ends/dossier).
3. Multimodal vision leg (send the photo to the API brain) — after the gate.
4. Export the heavy-scan patterns from `humanLoop.js` and apply them to the
   parent path's `desktop_terminal`.
5. Live UI verification in the real browser UI (live GUI login to DVWA lands
   on the dashboard; a Burp-style tool action works from the brain's JSON;
   the activity line + LiveMachine show while the parent works) — the
   coordinator cannot drive a browser; the parent runs it after deploy.
6. Merge + deploy — ONLY when no live hunt turn is running, tests pass, and
   live UI verification is done. A push to main triggers a probable backend
   restart.
