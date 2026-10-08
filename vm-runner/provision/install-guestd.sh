#!/usr/bin/env bash
#
# install-guestd.sh — one-time first-boot provisioning for the Infinity AI
# Kali sandbox VM.
#
# Installs the Infinity guest agent (guest/guestd.py) plus the desktop
# automation tools it needs, then enables the systemd service and SSH.
#
# Run ONCE inside the Kali VM (as root):
#   sudo bash install-guestd.sh [/path/to/guestd.py]
#
# The guest agent reads its per-session bearer token from QEMU fw_cfg
# (opt/infinity/session-token, injected by the runner at every boot), so no
# token configuration is needed here.
#
set -euo pipefail

GUESTD_SRC="${1:-$(dirname "$0")/../guest/guestd.py}"
INSTALL_DIR="/opt/infinity-guestd"
TOKEN_DIR="/etc/infinity-guestd"
SERVICE_FILE="/etc/systemd/system/infinity-guestd.service"

if [[ "${EUID}" -ne 0 ]]; then
  echo "install-guestd.sh must run as root (use sudo)" >&2
  exit 1
fi

if [[ ! -f "${GUESTD_SRC}" ]]; then
  echo "guestd.py not found at ${GUESTD_SRC} — pass its path as \$1" >&2
  exit 1
fi

echo "==> Installing packages (scrot, xdotool, imagemagick, openssh-server, audit tools)…"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq \
  python3 \
  scrot \
  xdotool \
  imagemagick \
  openssh-server \
  nmap \
  sqlmap \
  gobuster \
  nikto \
  curl \
  ca-certificates

if ! command -v firefox >/dev/null 2>&1; then
  echo "==> Installing Firefox…"
  apt-get install -y -qq firefox-esr || echo "WARNING: firefox-esr install failed; install Firefox manually"
fi

echo "==> Installing infinity-guestd to ${INSTALL_DIR}…"
mkdir -p "${INSTALL_DIR}" "${TOKEN_DIR}"
cp "${GUESTD_SRC}" "${INSTALL_DIR}/guestd.py"
chmod 755 "${INSTALL_DIR}/guestd.py"
chmod 700 "${TOKEN_DIR}"

echo "==> Writing systemd unit…"
cat > "${SERVICE_FILE}" <<'UNIT'
[Unit]
Description=Infinity AI guest agent (exec/screenshot/input inside the sandbox VM)
After=network.target graphical.target
Wants=graphical.target

[Service]
Type=simple
User=root
Environment=DISPLAY=:0
ExecStart=/usr/bin/python3 /opt/infinity-guestd/guestd.py
Restart=always
RestartSec=3
# The per-session token arrives via QEMU fw_cfg; a static fallback token can
# be placed in /etc/infinity-guestd/token for manual testing.
EnvironmentFile=-/etc/infinity-guestd/env

[Install]
WantedBy=graphical.target
UNIT

systemctl daemon-reload
systemctl enable --now infinity-guestd.service

echo "==> Enabling SSH (for operator access)…"
systemctl enable --now ssh.service || true

echo "==> Verifying…"
sleep 2
if systemctl is-active --quiet infinity-guestd.service; then
  echo "infinity-guestd is running."
else
  echo "WARNING: infinity-guestd did not start — check: journalctl -u infinity-guestd" >&2
  exit 1
fi

echo
echo "Done. The guest agent listens on 127.0.0.1:1024 inside the VM."
echo "It authenticates with the per-session token the runner injects via QEMU fw_cfg."
echo "Verify from the runner host with: POST /vm/status (state should become 'running')."
