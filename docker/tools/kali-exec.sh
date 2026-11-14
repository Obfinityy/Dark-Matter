#!/bin/bash
# Dark Matter — Self mode: ephemeral Kali container exec wrapper.
#
# Runs one shell command inside the `darkmatter/hunt:latest` image (Kali
# GNU/Linux Rolling, verified 14 Nov 2026 to contain nmap, subfinder,
# amass, httpx, nuclei, nikto, sqlmap, ffuf, hydra, gobuster, dirb,
# katana, dig, curl, python3, openssl, ysoserial) and destroys the
# container when the command exits (`docker run --rm`).
#
# Usage:
#   kali-exec.sh '<shell command>'      # e.g. kali-exec.sh 'nmap -Pn -sV example.com'
#
# The `--entrypoint /bin/bash` override is LOAD-BEARING: the hunt image
# ships a hunt-runner entrypoint that swallows bare command arguments
# (verified 14 Nov 2026: `docker run darkmatter/hunt:latest nmap ...`
# returns `{"type":"status","state":"failed","error":"no target"}`).
# Without the override no tool ever runs. (Same precedent as
# backend/src/scanner/domRender.js, which overrides the entrypoint to
# `chromium` for the same reason.)
#
# Environment:
#   SELF_KALI_IMAGE  image to run (default darkmatter/hunt:latest)
#   SELF_KALI_NETWORK docker network (default: bridge; the container
#                      reaches EC2 labs via the bridge IP 172.17.0.1)
#   SELF_KALI_DNS    optional DNS server passed to docker
#
# Safety: this wrapper adds NO network or privilege flags beyond the
# defaults — no --privileged, no host network, no volume mounts, so a
# tool cannot write to the host or reach host-only services. Callers
# must only run it against targets the user confirmed they are
# authorized to test (the Self routes enforce confirmedAuthorized).
# Stdout is the tool's stdout; the exit code is the tool's exit code.
set -euo pipefail

IMAGE="${SELF_KALI_IMAGE:-darkmatter/hunt:latest}"
NETWORK="${SELF_KALI_NETWORK:-bridge}"

if [[ $# -ne 1 ]]; then
  echo "usage: kali-exec.sh '<shell command>'" >&2
  exit 2
fi

ARGS=()
if [[ -n "${SELF_KALI_DNS:-}" ]]; then
  ARGS+=(--dns "$SELF_KALI_DNS")
fi

exec docker run --rm --network "$NETWORK" "${ARGS[@]}" --entrypoint /bin/bash "$IMAGE" -c "$1"
