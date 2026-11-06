#!/bin/bash
# SSH to EC2 Dark Matter backend via Tailscale, with fallback to the
# direct public-IP route.
# Usage: ec2.sh "command to run"
#    or: ec2.sh (interactive shell)
#
# Fix (6 Nov 2026, Tailscale-flap lane): the old script ran a single
# `exec ssh` over the Tailscale tunnel proxy (port 3130), so one
# dropped CONNECT ("Proxy closed connection") failed the whole call
# and every worker had to fall back to the direct route by hand —
# inconsistently, and sometimes misreading the failure as a shadow
# box or stale state. This script now:
#   1. tries the Tailscale route once (proxy_ssh.py itself retries a
#      dropped CONNECT up to 3 times before giving up);
#   2. if ssh exits 255 AND its stderr shows a connect failure (never
#      a remote-command failure), falls back ONCE to the direct route
#      (ec2-direct.sh, same arguments) and returns that result.
# The remote command is only re-run when ssh never connected, so the
# identity-proof command the caller passes (hostname + test -d
# /opt/Dark-Matter/backend/data/hunts) runs exactly once against a
# verified session — the proof rule is preserved on either route.
# A remote command that itself exits 255, or any non-255 exit, is
# returned immediately with no fallback and no re-run.
set -u
DIR="$(cd "$(dirname "$0")" && pwd)"

# stderr text ssh (or the proxy) prints only when the connection
# itself fails — never when a connected remote command fails.
CONNECT_FAIL_RE='Proxy closed connection|Proxy CONNECT failed|Connection closed|Connection timed out|Connection reset|Connection refused|connect to host|Could not resolve|No route to host|Network is unreachable|ssh_exchange_identification|kex_exchange_identification|Broken pipe'

errfile="$(mktemp)"
trap 'rm -f "$errfile"' EXIT

ssh -o ConnectTimeout=20 -o StrictHostKeyChecking=no \
  -o ProxyCommand="$DIR/proxy_ssh.py %h %p" \
  -i /home/hatch/.ssh/id_ed25519 \
  ubuntu@100.72.152.111 "$@" 2>"$errfile"
rc=$?
if [ "$rc" -ne 255 ]; then
  cat "$errfile" >&2
  exit "$rc"
fi
if ! grep -Eq "$CONNECT_FAIL_RE" "$errfile"; then
  cat "$errfile" >&2
  exit 255
fi
echo "ec2.sh: Tailscale route failed to connect (ssh exit 255); falling back to direct route" >&2
cat "$errfile" >&2
rm -f "$errfile"  # exec replaces the shell, so the EXIT trap would not run
trap - EXIT
exec "$DIR/ec2-direct.sh" "$@"
