# Infinity AI Agent Poller

Headless service that runs on the **agent machine** (your dedicated box or an
Oracle Cloud free-tier VM). It **pulls** hunt jobs from the Infinity AI backend
and executes them on the local Kali VM — 24/7, even with your browser closed.

**Architecture (owner's standing rule): the poller PULLS.** The backend
(Render) never pushes commands and never routes computer-control. It is pure
orchestration: job queue + results. All execution stays on this machine.

```
Browser → POST /jobs (executor: 'agent') → Render queues it
                                                    ↓
Agent machine: poller polls GET /jobs every 30s → claims → fetches YOUR
brain links (GET /brain-links, your token) → drives the Kali VM via
vm-runner (127.0.0.1:4100) → POSTs progress events → completion + report
                                                    ↓
Browser (anytime): live progress, mid-hunt chat, VM screen, final PDF
```

## Setup (Oracle free-tier VM or your own machine)

```bash
# 1. Node 18+ must be installed.
# 2. The vm-runner must be running on this same machine:
cd ~/Dark-Matter/vm-runner && npm install && node src/index.js
#    (keep it running — serves 127.0.0.1:4100)

# 3. Install + authenticate the poller (one time):
cd ~/Dark-Matter/agent-poller
npm run login
#    Prompts for your Infinity AI email + password, exchanges them for a
#    token, stores ONLY the token in ~/.infinity-ai/poller.json (mode 600).
#    Your password is never stored.

# 4. Run the poller (keep it running — systemd/pm2 recommended):
node src/index.js
```

## How hunts reach the poller

1. In the browser: **Hunt AI → paste target → Start hunt** (with the agent
   machine connected, jobs are created with `executor: 'agent'`).
2. The poller claims the job within ~30s and starts the Kali VM.
3. Progress streams back as events — reopen the browser anytime to watch,
   chat mid-hunt ("how far along is it?"), or view the live VM screen.
4. Pause from the browser → the poller saves a VM snapshot and stops;
   Continue → it restores the snapshot and resumes exactly where it left off.
5. On completion the PDF report lands in your account (existing pipeline).

## Brain links

Your 3 Kaggle links are saved per-account (Models page → "Save to my
account", encrypted at rest with AES-256-GCM). The poller fetches them with
your token at hunt start — the browser does not need to be open.

## Config

`~/.infinity-ai/poller.json` (or env vars):

| Key | Env | Default |
|-----|-----|---------|
| `backendUrl` | `BACKEND_URL` | `https://dark-matter-90nw.onrender.com` |
| `token` | `POLLER_TOKEN` | (from `npm run login`) |
| `pollerId` | `POLLER_ID` | `poller-<hostname>` |
| `pollIntervalMs` | `POLLER_INTERVAL_MS` | `30000` |
| `vmRunnerUrl` | `VM_RUNNER_URL` | `http://127.0.0.1:4100` |

If the token expires (HTTP 401), run `npm run login` again.

## Oracle Cloud free tier (always-free, not a trial)

1. Sign up at oracle.com/cloud/free — create an **Ampere A1** VM
   (4 OCPUs, 24 GB RAM, 200 GB disk — all always-free).
2. Open **no** inbound ports (the poller only makes outbound connections;
   the VM screen is viewed through your Infinity AI browser session).
3. Install Node 18+, QEMU (`sudo apt install qemu-system-x86`), clone
   Dark-Matter, then follow steps 2–4 above.

Note: nested KVM is unavailable on Oracle A1; QEMU runs in emulation
(TCG) mode — fine for network hunting tools, slower for heavy GUI work.
Your dedicated local box (with WHPX/KVM) is faster when it's online.
