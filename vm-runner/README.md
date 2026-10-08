# Infinity AI VM Runner

A standalone Node.js service that runs **on the user's own machine** (their
Windows box) and hosts the hardware-accelerated QEMU/Kali sandbox VM used by
Infinity AI Control mode and Hunt AI execution. It is **not** part of the cloud
backend — the backend never sees model inference, screenshots, or
computer-control commands.

Listens on `http://127.0.0.1:4100` (HTTP + WebSocket) — loopback only.

## Quick start (user's Windows machine)

1. Install prerequisites:
   - Node.js 20+
   - QEMU for Windows (official installer from qemu.org)
   - Enable **Windows Hypervisor Platform** in "Turn Windows features on or
     off" (needs admin + reboot)
2. Install dependencies:
   ```powershell
   cd vm-runner
   npm install
   ```
3. Fetch the Kali golden image (first run only, ~3–4 GB):
   - Download `https://cdimage.kali.org/kali-2026.2/kali-linux-2026.2-qemu-amd64.7z`
   - Verify the SHA256 against `images/kali.json` (or the published
     `SHA256SUMS`)
   - Extract the inner `.qcow2` to `%USERPROFILE%\DarkMatter\vm\images\`
4. First boot only — install the in-guest agent once inside the VM:
   - Start a session (see API below), open the VM display, log in as
     `kali`/`kali`, then run `sudo bash provision/install-guestd.sh`
5. Run the service:
   ```powershell
   npm start
   ```
6. Sanity check: `GET http://127.0.0.1:4100/doctor` should report no
   `problems`.

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
