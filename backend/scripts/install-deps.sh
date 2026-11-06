#!/bin/sh
# install-deps.sh — install backend production deps WITHOUT ever leaving
# the live node_modules half-built (NOT imported by the running server).
#
# WHY: `npm ci` deletes node_modules FIRST and then reinstalls (~2s with a
# warm cache). A backend restart landing inside that window dies at startup
# with MODULE_NOT_FOUND — 6 Nov 2026, 8db79ede deploy: the workflow's
# `npm ci` ran 12:31:08.313–12:31:09.991 UTC while a manual fallback
# restart landed at 12:31:09; the first start died on
# `Cannot find module '@smithy/core/retry'` (re-added late in the install),
# and systemd respawned it 5s later once the install had finished. The
# 840355de deploy nearly hit the same race (restart 12:24:24 vs npm ci
# ending 12:24:24.197) — a timing lottery, not a one-off. A failed `npm ci`
# is worse still: it leaves node_modules deleted, so the box cannot restart
# at all until the install is re-run.
#
# HOW: install into a staging tree next to the live one, then swap the
# finished tree in with ONE atomic renameat2(2) RENAME_EXCHANGE — the two
# directories trade names in a single syscall. There is no instant where
# node_modules is missing, and a node start straddling the swap still reads
# complete files: a path under node_modules/ lands on one complete tree or
# the other, never on a half-built one. (A two-rename swap was tried first
# and this lane's own race test caught it: a probe that resolved a file
# under the old tree and read it after the rename died with ENOENT, because
# the rename moved the tree out from under the load. The exchange has no
# such window.) If the install itself fails, the live tree is untouched and
# this script exits non-zero, so the deploy fails BEFORE any restart
# (fail-closed). If the exchange is unavailable on the host, the script
# fails closed too — it never falls back to a gapped swap.
#
# Run from backend/ (or pass the backend dir):  bash scripts/install-deps.sh [backendDir]
# Exits 0 when the new tree is live, non-zero otherwise (live tree kept).
# This exists as a file because appleboy/ssh-action (drone-ssh) mangles
# multi-line shell in the workflow step — same reason check-active-hunts
# lives in a file (see the workflow).

set -eu

BACKEND_DIR="${1:-$PWD}"
case "$BACKEND_DIR" in
  /*) ;;
  *) BACKEND_DIR="$PWD/$BACKEND_DIR" ;;
esac

[ -f "$BACKEND_DIR/package.json" ] || { echo "install-deps: no package.json in $BACKEND_DIR" >&2; exit 1; }
[ -f "$BACKEND_DIR/package-lock.json" ] || { echo "install-deps: no package-lock.json in $BACKEND_DIR (npm ci needs one)" >&2; exit 1; }

STAGE="$BACKEND_DIR/.node_modules.staging"

cleanup() {
  # Never leave staging behind. The live tree is never moved by this
  # script (the exchange swaps it in place), so there is nothing to
  # restore — a failure before the swap simply leaves the old tree live.
  rm -rf "$STAGE"
}
trap cleanup EXIT

rm -rf "$STAGE"
mkdir -p "$STAGE"
cp "$BACKEND_DIR/package.json" "$BACKEND_DIR/package-lock.json" "$STAGE/"

npm ci --omit=dev --prefix "$STAGE"

[ -d "$STAGE/node_modules" ] || { echo "install-deps: staging tree missing after npm ci — refusing to swap" >&2; exit 1; }

if [ -e "$BACKEND_DIR/node_modules" ]; then
  # Atomic exchange: live tree and staging tree trade names in one
  # syscall (renameat2 RENAME_EXCHANGE). python3 + libc ctypes is the
  # portable way to reach it from shell; ext4 (EC2 /) supports it.
  python3 - "$BACKEND_DIR/node_modules" "$STAGE/node_modules" <<'PYEOF'
import ctypes
import sys
libc = ctypes.CDLL("libc.so.6", use_errno=True)
AT_FDCWD = -100
RENAME_EXCHANGE = 2
libc.renameat2.argtypes = [ctypes.c_int, ctypes.c_char_p, ctypes.c_int, ctypes.c_char_p, ctypes.c_uint]
libc.renameat2.restype = ctypes.c_int
a, b = sys.argv[1].encode(), sys.argv[2].encode()
if libc.renameat2(AT_FDCWD, a, AT_FDCWD, b, RENAME_EXCHANGE) != 0:
    raise SystemExit("renameat2 exchange failed, errno=%d" % ctypes.get_errno())
PYEOF
  # The old tree now sits at the staging path; nothing can hold a
  # reference to it (nothing ever resolved through that name), so it is
  # safe to drop immediately.
  rm -rf "$STAGE"
else
  # Fresh checkout with no live tree yet — nothing to preserve.
  mv "$STAGE/node_modules" "$BACKEND_DIR/node_modules"
fi

echo "install-deps: production deps installed"
