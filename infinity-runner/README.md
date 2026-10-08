# Infinity AI Runner

One-click desktop companion for **Dark Matter** (by **Obfinity**).

The user installs it once on their Windows PC. It lives in the system tray and
runs two local services with **zero setup — no terminal, no Node, no folders**:

| Service | What it does |
|---|---|
| `vm-runner` | The Kali Linux / QEMU sandbox VM. Serves the VM control API on `127.0.0.1:4100` (screen, terminal, exec). |
| `agent-poller` | The 24/7 hunt agent. Polls the Dark Matter backend for hunt jobs, runs them on the local VM, posts results. Starts after sign-in. |

Both services are bundled and launched inside Electron **utility processes**
(`utilityProcess.fork()`), which run on Electron's own Node runtime — the user
never installs Node.js.

## For the user

1. On the Dark Matter website, open **Infinity AI → Control** (or **Models**).
2. Press **⬇ Download Infinity AI Runner for Windows**, run the installer.
3. The Runner starts automatically and sits in the system tray (near the clock).
4. Open the status window from the tray to sign in (enables the 24/7 hunt
   agent), start/stop the Runner, or open Dark Matter.
5. The website shows **"Infinity AI Runner connected ✅"** when it's running.

## For developers

### Layout

```
infinity-runner/
  main/
    main.js      — Electron app: tray, status window, IPC, auto-start
    preload.js   — context-isolated IPC bridge
    services.js  — service lifecycle (Electron-agnostic, unit-tested)
    auth.js      — sign-in → JWT in ~/.infinity-ai/poller.json (mode 600)
  renderer/      — status window UI (vanilla HTML/CSS/JS, no terminal output)
  assets/        — icon.png (source) / icon.ico (generated)
  scripts/
    make-icon.mjs          — wraps icon.png into a valid .ico (PNG-in-ICO)
    prepare-resources.mjs  — stages vm-runner + agent-poller with prod deps
  tests/         — node --test suites
```

### Build the installer (Windows machine or Windows CI runner)

```powershell
cd infinity-runner
npm install
npm run dist
# → dist/Infinity-AI-Runner-Setup.exe
```

`npm run dist` runs three steps:

1. `make-icon` — generates `assets/icon.ico` from `assets/icon.png`.
2. `prepare-resources` — copies `../vm-runner` and `../agent-poller` into
   `build-resources/` (dev files excluded) and runs `npm install --omit=dev`
   in each. Native modules are skipped on purpose: `node-pty` is optional and
   the runner degrades gracefully without it.
3. `electron-builder --win nsis --x64` — one-click NSIS installer.

> The `.exe` **cannot** be built on Linux/macOS (NSIS + code signing need
> Windows). `npm run dist:dir` validates the packaging pipeline on any OS by
> producing an unpacked directory instead.

### Release process

1. Bump `version` in `infinity-runner/package.json`.
2. Build on Windows: `npm run dist`.
3. Create a GitHub Release on `Obfinityy/Dark-Matter` (tag e.g.
   `runner-v1.0.0`) and attach `dist/Infinity-AI-Runner-Setup.exe`.
4. The asset name is **stable** (no version in the filename — see
   `electron-builder.yml` → `artifactName`), so the website's download button
   always points at the newest release:
   `https://github.com/Obfinityy/Dark-Matter/releases/latest/download/Infinity-AI-Runner-Setup.exe`

### Tests

```bash
cd infinity-runner
npm test   # 12 tests: service lifecycle, restart backoff, sign-in/token storage
```

### Notes

- The website detects the Runner via `GET http://127.0.0.1:4100/health`
  (see `frontend/src/services/runnerDownload.js`). No manual URL entry.
- Sign-in stores **only** the JWT in `~/.infinity-ai/poller.json` (mode 600) —
  the same file the standalone `agent-poller` uses, so both stay compatible.
  Passwords are never stored.
- Service output goes to `%APPDATA%/Infinity AI Runner/logs/runner.log`
  ("View logs" in the status window). No terminal is ever shown.
- Auto-start on Windows login defaults to **ON** (set on first run, toggle in
  the status window).
- Branding: the product is **Dark Matter**, the company is **Obfinity**, this
  component is **Infinity AI Runner**. Never surface internal repo names.
