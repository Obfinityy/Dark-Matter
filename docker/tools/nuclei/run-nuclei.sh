#!/bin/bash
# Dark Matter — nuclei wrapper (technique 2a/2b, re-implemented as a runner).
#
# Runs projectdiscovery/nuclei (MIT) as a Docker container against an
# authorized target, emitting JSONL for the hunt pipeline.
# Technique: verified-check templates + differential confirmation —
# every template encodes the exact request/response workflow that CONFIRMS
# a vulnerability (near-zero false positives by construction).
#
# Usage: run-nuclei.sh <target-url> [severity-filter] [templates-csv]
#   e.g. run-nuclei.sh https://target.test critical,high
#   e.g. run-nuclei.sh https://target.test info,low,medium,high,critical http/miscellaneous/directory-listing.yaml,http/misconfiguration/missing-sri.yaml
# The optional 3rd arg runs ONLY the listed templates (nuclei -t). The scanner
# uses it for a targeted second pass over curated info/low-severity templates
# (see backend/src/scanner/nuclei.js NUCLEI_TARGETED_TEMPLATES): the main
# critical,high,medium sweep can never fire those templates, even when the
# condition exists on the target.
#
# Output: JSONL on stdout, one finding per line.
# Requires: Docker. Authorized targets only.

set -euo pipefail
TARGET="${1:?usage: run-nuclei.sh <target-url> [severity] [templates-csv]}"
SEVERITY="${2:-critical,high,medium}"
TEMPLATES="${3:-}"

# Modern nuclei images install templates at /root/nuclei-templates (verified
# against projectdiscovery/nuclei:latest: -update-templates installs there,
# NOT /root/nuclei). The host cache is mounted at that exact path so
# templates persist across --rm runs instead of being re-downloaded
# (~9000+ templates) into a throwaway container on every scan.
CACHE="${HOME}/.cache/nuclei"
mkdir -p "$CACHE"
MARKER="$CACHE/.dm-templates-ts"

# Refresh templates when missing or older than 7 days. -update-templates on
# every run is too slow for a scan, so this is a staleness gate, not a
# per-run flag. The gate is a marker file touched by THIS script (as the
# invoking user) — never a find over the template tree, because the tree is
# written by the container and may be unreadable to the backend user.
NEEDS_UPDATE=0
if [ ! -f "$MARKER" ]; then
  NEEDS_UPDATE=1
elif [ -n "$(find "$MARKER" -mtime +7 -print -quit 2>/dev/null || true)" ]; then
  NEEDS_UPDATE=1
fi
if [ "$NEEDS_UPDATE" = "1" ]; then
  # -u keeps template files owned by the invoking user so future reads
  # work no matter which user the backend runs as.
  if docker run --rm -u "$(id -u):$(id -g)" -v "$CACHE:/root/nuclei-templates" \
      projectdiscovery/nuclei:latest -update-templates; then
    touch "$MARKER"
  fi
fi

if [ -n "$TEMPLATES" ]; then
  docker run --rm \
    -v "$CACHE:/root/nuclei-templates" \
    projectdiscovery/nuclei:latest \
    -u "$TARGET" \
    -t "$TEMPLATES" \
    -severity "$SEVERITY" \
    -jsonl \
    -silent \
    -timeout 10 \
    -retries 1 \
    -rate-limit 50
else
  docker run --rm \
    -v "$CACHE:/root/nuclei-templates" \
    projectdiscovery/nuclei:latest \
    -u "$TARGET" \
    -severity "$SEVERITY" \
    -jsonl \
    -silent \
    -timeout 10 \
    -retries 1 \
    -rate-limit 50
fi
