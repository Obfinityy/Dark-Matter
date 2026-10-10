#!/usr/bin/env bash
#
# first-boot.sh — one-shot first-boot provisioning for the Infinity AI Kali VM.
#
# HOW TO USE (copy-paste works *inside* the VM):
#   1. In the Kali VM, open Firefox and go to:
#        github.com/Obfinityy/Dark-Matter/blob/main/vm-runner/provision/first-boot.sh
#   2. Select the 3 commands below (Ctrl+A, Ctrl+C in Firefox),
#      paste them into the VM terminal (Ctrl+Shift+V), press Enter.
#
# What it does: downloads the Infinity guest agent (guestd.py) and its
# installer, then installs it (needs sudo; takes 2–3 minutes for packages).
# After it finishes, the VM runner detects the agent within ~30 seconds —
# no VM restart needed.
#
set -euo pipefail

curl -sL https://raw.githubusercontent.com/Obfinityy/Dark-Matter/main/vm-runner/guest/guestd.py -o /tmp/guestd.py
curl -sL https://raw.githubusercontent.com/Obfinityy/Dark-Matter/main/vm-runner/provision/install-guestd.sh -o /tmp/install-guestd.sh
sudo bash /tmp/install-guestd.sh /tmp/guestd.py

echo "guestd installed — the runner will detect it within ~30 seconds."
