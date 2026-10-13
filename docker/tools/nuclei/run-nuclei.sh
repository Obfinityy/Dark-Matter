#!/bin/bash
# Dark Matter — nuclei wrapper (technique 2a/2b, re-implemented as a runner).
#
# Runs projectdiscovery/nuclei (MIT) as a Docker container against an
# authorized target, emitting JSONL for the hunt pipeline.
# Technique: verified-check templates + differential confirmation —
# every template encodes the exact request/response workflow that CONFIRMS
# a vulnerability (near-zero false positives by construction).
#
# Usage: run-nuclei.sh <target-url> [severity-filter]
#   e.g. run-nuclei.sh https://target.test critical,high
#
# Output: JSONL on stdout, one finding per line.
# Requires: Docker. Authorized targets only.

set -euo pipefail
TARGET="${1:?usage: run-nuclei.sh <target-url> [severity]}"
SEVERITY="${2:-critical,high,medium}"

# Update templates weekly in production; -ut on every run is too slow.
docker run --rm \
  -v "${HOME}/.cache/nuclei:/root/nuclei" \
  projectdiscovery/nuclei:latest \
  -u "$TARGET" \
  -severity "$SEVERITY" \
  -jsonl \
  -silent \
  -timeout 10 \
  -retries 1 \
  -rate-limit 50
