# EC2 SSH transport — Tailscale route hardening (6 Nov 2026)

The live wrappers are `~/workspace/ec2.sh` (Tailscale route) and
`~/workspace/proxy_ssh.py` (its CONNECT proxy). The files in this
directory are the canonical copies; the parent syncs them to
`~/workspace/` at merge time (see "Sync" below). Do not edit the
`~/workspace/` copies and this directory independently — they will
drift. `~/workspace/ec2-direct.sh` (direct public-IP route) is
unchanged by this lane and stays the fallback target.

## What was wrong

Two defects in the Tailscale route, both proven live 6 Nov 2026:

1. **CONNECT flap (transient, runtime side).** The runtime tunnel
   proxy (port 3130) intermittently drops a CONNECT with no response
   (`Proxy closed connection`). Observed 6 Nov 00:26, 00:27, 01:20,
   15:28, 21:03 IST and 2 Nov — always transient, a retry seconds
   later succeeds, EC2 itself healthy throughout (the direct route
   lands on the real box immediately). Measurement 6 Nov ~22:0x IST:
   150/150 CONNECTs OK on the tunnel route (p50 690ms) — the flap is
   bursty and not reproducible on demand. The break is inside the
   runtime's tunnel proxy, which this repo cannot fix; what this lane
   fixes is the *handling*: the old `proxy_ssh.py` failed the whole
   SSH session on the first dropped CONNECT, and the old `ec2.sh`
   failed hard with no fallback.
2. **60s idle kill (our bug, in `proxy_ssh.py`).** The relay loop
   broke out on a 60s `select()` timeout, killing any SSH session
   idle for >60s. Proven live: `sleep 75` over the Tailscale route
   died at ~63s (`Broken pipe`, exit 255); the same command over the
   direct route printed `ALIVE_AFTER_75S` (exit 0). The direct proxy
   (`proxy_ssh_direct.py`) already loops on timeout — the tunnel
   proxy was the odd one out.

## What changed

- **`proxy_ssh.py`** — the CONNECT phase retries a bounded number of
  times (default 3 attempts, backoff 1s then 2s) on transport-level
  failures only: TCP connect failure/timeout, proxy closing without a
  response, or a 502/503/504. A 4xx is never retried. The retry
  happens before any tunnel exists, so nothing is ever re-sent to the
  SSH server and no remote command can run twice. The relay loop now
  continues on `select()` timeout instead of breaking, so idle
  sessions stay alive (matches `proxy_ssh_direct.py`).
- **`ec2.sh`** — tries the Tailscale route once (the proxy retries
  internally first). If `ssh` exits 255 *and* its stderr shows a
  connect failure, it falls back once to `ec2-direct.sh` with the
  same arguments and returns that result. A remote command exiting
  255, or any non-255 exit, is returned immediately with no fallback
  and no re-run. The caller's identity-proof command (hostname +
  `test -d /opt/Dark-Matter/backend/data/hunts`) therefore runs
  exactly once against a verified session, on either route.

## Tests

`tests/test_ec2_ssh.py` — Python stdlib `unittest`, no dependencies.
Run it from anywhere:

```bash
python3 backend/scripts/ec2-ssh/tests/test_ec2_ssh.py
```

12 tests, ~10s: a fake CONNECT proxy (drops first N CONNECTs, always
drops, 403, 502-then-OK, unreachable host) plus a fake `ssh` /
`ec2-direct.sh` pair for the fallback matrix. Negative control
(against the pre-fix `~/workspace/` copies):

```bash
PROXY_SSH_UNDER_TEST=/home/hatch/workspace/proxy_ssh.py \
EC2_SH_UNDER_TEST=/home/hatch/workspace/ec2.sh \
python3 backend/scripts/ec2-ssh/tests/test_ec2_ssh.py
```

6 fail on old code (retry-then-success, bounded attempts, 502-then-OK,
idle static guard, fallback-on-connect-failure, direct-failure
propagation); 6 pass (no-retry-on-403, TCP-refused exit 1, idle
behavioral, ssh-OK, remote-failure no-fallback, 255-quiet
no-fallback). Note: the idle *behavioral* test passes on old code too
— its hardcoded 60s timeout exceeds the test's 1s idle wait. The
behavioral proof for idle is the live `sleep 75` experiment above,
plus the static guard in the suite; re-run `sleep 75` through the
synced `ec2.sh` after merge as the live proof.

## Sync (parent, at merge)

```bash
cp backend/scripts/ec2-ssh/proxy_ssh.py ~/workspace/proxy_ssh.py
cp backend/scripts/ec2-ssh/ec2.sh ~/workspace/ec2.sh
chmod +x ~/workspace/ec2.sh ~/workspace/proxy_ssh.py
~/workspace/ec2.sh "hostname; test -d /opt/Dark-Matter/backend/data/hunts && echo BOX_OK"
~/workspace/ec2.sh "sleep 75; echo ALIVE_AFTER_75S"  # idle live proof
```

## Known limits (not fixed here)

- The tunnel proxy itself still drops CONNECTs occasionally; this lane
  makes the drop invisible to callers (retry + fallback), it does not
  repair the runtime proxy. If drops become sustained (all 3 CONNECT
  attempts fail repeatedly), the cause is outside this repo — report
  it with the proxy's stderr, do not raise the retry count blindly.
- The relay still uses `sock.sendall` on a non-blocking socket (same
  as the direct proxy): a far end that stops reading can raise
  `BlockingIOError` and kill the session. Pre-existing, identical in
  both proxies, out of scope.
- A remote command that itself exits 255 *and* prints a
  connect-failure-shaped string to stderr would trigger one fallback
  re-run. Read-only probe commands do not do this; the gate is
  documented in `ec2.sh`.
