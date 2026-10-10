# Infinity AI VM Runner

A standalone Node.js service that runs **on the user's own machine** (their
Windows box) and hosts the hardware-accelerated QEMU/Kali sandbox VM used by
Infinity AI Control mode and Hunt AI execution. It is **not** part of the cloud
backend — the backend never sees model inference, screenshots, or
computer-control commands.

Listens on `http://127.0.0.1:4100` (HTTP + WebSocket) — loopback only.

## Quick start (user's Windows machine)

1. Double-click **`Start-VM-Runner.bat`** in the repository root. It checks
   Node.js, installs dependencies, locates QEMU, and starts the runner.
2. On the very first run, complete the one-time setup below (QEMU, Windows
   Hypervisor Platform, Kali image), then re-run the script.
3. Sanity check: `GET http://127.0.0.1:4100/doctor` should report no
   `problems`.

The full step-by-step guide follows. If anything fails, start with
`GET /doctor` — it lists concrete blockers first.

## Full setup guide (Windows)

### Step 1 — Install Node.js 20+

Download the LTS installer from https://nodejs.org and run it. Verify in a
new terminal:

```powershell
node --version   # v20.x.x or newer
```

### Step 2 — Install QEMU for Windows

1. Download the official installer from https://www.qemu.org/download/
   ("QEMU for Windows").
2. Run the installer. The default location is `C:\Program Files\qemu`.
3. Adding QEMU to `PATH` is recommended but optional — the starter script
   and the runner also check `%ProgramFiles%\qemu` automatically.
4. Verify:
   ```powershell
   qemu-system-x86_64 --version
   ```

### Step 3 — Enable Windows Hypervisor Platform

This is the hardware accelerator QEMU uses on Windows. Without it the
runner refuses to boot the VM (software emulation would be unusably slow).

1. Open **"Turn Windows features on or off"** (search it in the Start menu;
   requires administrator rights).
2. Tick **"Windows Hypervisor Platform"** and click OK.
   - Note: this is a separate feature from "Hyper-V" — tick the
     **Windows Hypervisor Platform** entry specifically.
3. **Restart Windows.** The feature reports `EnablePending` until you reboot,
   and QEMU cannot use it before then.
4. After rebooting, confirm the state in an (elevated) PowerShell:
   ```powershell
   (Get-WindowsOptionalFeature -Online -FeatureName HypervisorPlatform).State
   # Expected: Enabled
   ```

### Step 4 — Download and place the Kali Linux image (one-time, ~3–4 GB)

1. Download the official QEMU image:
   `https://cdimage.kali.org/kali-2026.2/kali-linux-2026.2-qemu-amd64.7z`
2. Verify integrity — compare the SHA256 of the download against the pinned
   value in `vm-runner/images/kali.json` (or the published `SHA256SUMS`):
   ```powershell
   Get-FileHash .\kali-linux-2026.2-qemu-amd64.7z -Algorithm SHA256
   ```
3. Extract the archive with 7-Zip (or equivalent). Inside is a single
   `.qcow2` disk image.
4. Copy the extracted `.qcow2` to the runner's images directory, keeping the
   exact file name:
   ```
   C:\Users\<you>\DarkMatter\vm\images\kali-linux-2026.2-qemu-amd64.qcow2
   ```
   (If you set `INFINITY_VM_RUNNER_HOME`, use
   `%INFINITY_VM_RUNNER_HOME%\images\` instead.)
   - The file must be several gigabytes. A **0-byte** file means the
     download or extraction did not complete — `/doctor` reports this
     explicitly.
   - If a previous attempt left a 0-byte file behind, delete it before
     copying the fresh one.

### Step 5 — Start the runner

**Option A (recommended):** double-click `Start-VM-Runner.bat` in the
repository root. It performs every check above in order and prints exactly
what it found (QEMU location, dependencies) or what is missing.

**Option B (manual):**
```powershell
cd vm-runner
npm install
npm start
```

The runner prints `Infinity AI VM Runner v0.1.0 listening on 127.0.0.1:4100`.
Keep this window open — closing it stops the runner (local mode).

### Step 6 — Verify with /doctor

```powershell
curl http://127.0.0.1:4100/doctor
```

Every field should be healthy and `problems` should be an empty array:
`qemuPath` set, `accel: "whpx"`, `whpxEnabled: true`,
`kaliImage.present: true` with a multi-GB `bytes` value and
`readable: true`.

### Step 7 — First boot: install the in-guest agent (one-time)

1. Start a session: `POST http://127.0.0.1:4100/vm/start` with
   `{ "sessionId": "first-boot" }` → returns a `sessionToken`.
2. Open the VM display (via the app's noVNC view, or any VNC client to the
   reported `vncPort`).
3. Log in as `kali` / `kali`.
4. Run the provisioner once:
   ```bash
   sudo bash /path/to/provision/install-guestd.sh
   ```
   (The script is in `vm-runner/provision/` in this repository — copy it into
   the VM, e.g. via the shared clipboard or `curl` from a local file share.)
5. The guest agent (`guestd`) starts automatically on subsequent boots. Stop
   the session: `POST /vm/stop`.

Later sessions boot the golden image with a throwaway per-session overlay
disk, so the base image is never modified.

## API

All calls carry `Authorization: Bearer <sessionToken>` except `POST /vm/start`
(which issues the token) and the public `GET /health`, `GET /doctor`.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | `{ ok, version, qemu: { found, accel } }` |
| GET | `/doctor` | QEMU/accel/WHPX/image/disk diagnostics + `problems[]` |
| POST | `/vm/start` | `{ sessionId, cpus?, memoryMiB?, diskBytes?, target? }` → `{ pid, guestPort, vncPort, state, sessionToken }` |
| GET | `/vm/status?sessionId=` | `{ state, pid, uptimeS, detail? }` |
| POST | `/vm/stop` | `{ sessionId }` → `{ ok }` |
| POST | `/vm/exec` | `{ sessionId, command, cwd?, timeoutMs? }` → `{ exit_code, stdout, stderr, timed_out }` |
| POST | `/vm/exec/start` | long-running command → `{ execId }` |
| GET | `/vm/exec/:execId/poll` | `{ done, exit_code?, outputDelta, stdout, stderr }` |
| POST | `/vm/exec/:execId/kill` | `{ ok }` |
| POST | `/vm/screenshot` | `{ sessionId, width? }` → JPEG bytes |
| POST | `/vm/input` | `{ sessionId, action }` → `{ ok }`; action: `click`/`move` (`x`,`y` 0–1000), `type` (`text`), `key` (`key`), `scroll` (`dy`) |
| WS | `/vm/vnc?sessionId=&token=` | RFB proxy to the VM display (noVNC client) |
| WS | `/vm/terminal?sessionId=&token=` | xterm.js frames `{t:"in"\|"out"\|"resize", ...}` |

Errors: `{ ok: false, code, message }` — codes include `bad_token`,
`out_of_scope`, `guest_unreachable`, `qemu_missing`, `image_missing`.

## Security model

- Binds **127.0.0.1 only**; CORS locked to local frontend origins.
- Per-session 32-byte bearer tokens; the runner proves possession via an HMAC
  handshake **before** the token ever crosses to a guest port.
- **Target allowlist**: each session declares its authorized target at start;
  commands referencing other external hosts are refused (`out_of_scope`).
  Loopback and the QEMU guest NAT range (10.0.2.0/24) are always allowed.
- The VM is a sandbox: NAT networking only, no host shared folders, throwaway
  per-session overlay disk. It never touches the user's real desktop.
- No API keys anywhere. Per-session memory lives in
  `%USERPROFILE%\DarkMatter\vm\sessions\<sessionId>\memory\` — local files
  only, never the cloud. Screenshots are request attachments and are never
  persisted.

## Layout

```
vm-runner/
  package.json            express, ws (+ optional node-pty for the terminal)
  src/index.js            service entry: routes, auth, WS upgrades (127.0.0.1:4100)
  src/qemu.js             QEMU discovery, WHPX/KVM detect, args builder
  src/vmManager.js        dir-per-session lifecycle, pid re-attach, overlay disks
  src/guestClient.js      bearer + proof-handshake client for the guest agent
  src/execSessions.js     long-running exec registry (poll deltas, kill)
  src/terminal.js         node-pty bridge to the guest shell (WS /vm/terminal)
  src/guestShellBridge.js pty child: shuttles bytes between pty and guestd
  src/vnc.js              RFB-over-WebSocket proxy (WS /vm/vnc)
  src/memory.js           per-session local memory dir
  src/token.js            session tokens + proof HMAC
  src/targetGate.js       authorized-target allowlist for exec/input
  images/kali.json        pinned official Kali QEMU image (URL + SHA256)
  provision/install-guestd.sh   one-time first-boot provisioning (run in the VM)
  guest/guestd.py         Infinity guest agent (Python stdlib only)
  tests/                  unit tests — `npm test`
```

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `INFINITY_VM_RUNNER_PORT` | `4100` | listen port (loopback only) |
| `INFINITY_VM_RUNNER_HOME` | `%USERPROFILE%\DarkMatter\vm` | VM home (sessions, images) |
| `INFINITY_VM_RUNNER_QEMU_DIR` | auto-detect | override QEMU install dir |
| `INFINITY_VM_RUNNER_BOOT_TIMEOUT_MS` | `240000` | guest-agent boot wait |

## Testing

```powershell
npm test   # node --test, pure-logic unit tests + HTTP wiring tests
```

Real QEMU boot, VNC streaming, and desktop screenshot/input are verified on
the owner's Windows machine (cannot run in a Linux container).

## Troubleshooting

- `/doctor` lists concrete blockers first — start there.
- `state: "error"` on `/vm/status`: read `detail`, then the session's
  `serial.log`.
- QEMU on Windows refuses non-ASCII/comma paths: set
  `INFINITY_VM_RUNNER_HOME` to a plain ASCII path.

### Common setup issues

**`Start-VM-Runner.bat` says "QEMU nahi mila" but QEMU is installed.**
The script checks `PATH`, then `%ProgramFiles%\qemu`,
`%ProgramW6432%\qemu`, then `C:\Program Files\qemu`. If QEMU is installed
elsewhere, either add it to `PATH` or set the `INFINITY_VM_RUNNER_QEMU_DIR`
environment variable to its directory before running the script.

**`/doctor` says WHPX is not enabled, but the feature is ticked.**
The feature reports `EnablePending` until Windows is rebooted — reboot, then
restart the runner. The runner also detects the accelerator once at startup,
so any WHPX change requires a runner restart. (Note: querying the feature
state requires elevation; the runner degrades gracefully when run
non-elevated.)

**`/vm/start` fails with `no_accel`.**
No hardware accelerator is available. On Windows this means Windows
Hypervisor Platform is off or pending a reboot (see above). The runner
deliberately refuses software emulation — a Kali desktop under TCG is
unusably slow.

**`/doctor` reports the Kali image is 0 bytes.**
The download or extraction did not complete (or a previous failed attempt
left an empty file). Re-extract the `.qcow2` from the `.7z` — or re-download
it — and copy the multi-GB file over the empty one, then restart the runner.

**`/vm/start` fails with "Access is denied" on the golden image.**
The image file exists but the runner cannot open it: it is still being
written (download/extraction in progress), locked by another process, or its
ACLs block your user. Wait for the extraction to finish; otherwise check
Properties → Security on the file, or re-extract without administrator
rights.

**`/vm/start` fails with `qemu_missing`.**
The runner could not find `qemu-system-x86_64` at startup. Install QEMU and
restart the runner (detection runs once at startup).
