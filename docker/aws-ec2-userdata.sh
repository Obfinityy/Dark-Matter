#!/bin/bash
# Dark Matter engine — AWS EC2 one-click deploy (user-data script).
#
# Launch an EC2 instance (Ubuntu 22.04+, t3.large recommended) with this as
# user-data. It installs Docker, Node.js, the backend deps, and Ollama, and
# starts pulling the uncensored model in the background — so backend +
# engine + model all run on this one box (~$65/mo all-in).
#
# After boot:
#   1. SSH in and create /opt/Dark-Matter/backend/.env from backend/.env.example:
#      - LLM_PROVIDER=ollama  (uncensored self-hosted; or keep bedrock)
#      - JWT_SECRET, ADMIN_USERNAME + hash via node scripts/make-admin-hash.js
#      - ENGINE_URL=http://127.0.0.1:8080, CORS_ORIGINS
#   2. sudo systemctl start dark-matter-backend   (service is enabled, not started)
#   3. Check the model pull: tail -f /var/log/ollama-pull.log
#   4. cd /opt/Dark-Matter/docker && ./setup-linux.sh   (engine stack)
#
# Security: restrict backend port 4000 + engine port 8080 in the EC2 security
# group (22 = your IP only). Never expose the engine publicly without
# ENGINE_TOKEN auth (setup-linux.sh mints it).

set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y ca-certificates curl gnupg git

# Docker
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
usermod -aG docker ubuntu || true
systemctl enable --now docker

# Repo (public clone; private needs a deploy key)
if [ ! -d /opt/Dark-Matter ]; then
  git clone https://github.com/Obfinityy/Dark-Matter.git /opt/Dark-Matter
fi
chown -R ubuntu:ubuntu /opt/Dark-Matter

# Node.js 20 (backend runtime)
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

# Backend dependencies (the owner fills backend/.env via SSH afterwards)
(cd /opt/Dark-Matter/backend && sudo -u ubuntu npm ci --omit=dev)

# Backend as a systemd service — reads /opt/Dark-Matter/backend/.env.
# Enabled but NOT started: the owner must create .env first (see header).
cat >/etc/systemd/system/dark-matter-backend.service <<'EOF'
[Unit]
Description=Dark Matter backend (orchestrator)
After=network.target ollama.service
Wants=ollama.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/Dark-Matter/backend
EnvironmentFile=-/opt/Dark-Matter/backend/.env
ExecStart=/usr/bin/node src/server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable dark-matter-backend.service

# Ollama (uncensored local model host). Install script ships an ollama.service.
if ! command -v ollama >/dev/null 2>&1; then
  curl -fsSL https://ollama.com/install.sh | sh
fi
systemctl enable --now ollama || true

# Pull the default uncensored model in the background (~4.5GB, ~10-20 min).
# Box stays usable while this runs; progress in /var/log/ollama-pull.log.
# Override at launch time via OLLAMA_MODEL_PULL env in the EC2 console.
OLLAMA_MODEL_PULL="${OLLAMA_MODEL_PULL:-dolphin-mistral:7b}"
nohup bash -c "sleep 30; ollama pull $OLLAMA_MODEL_PULL" >/var/log/ollama-pull.log 2>&1 &
chown ubuntu:ubuntu /var/log/ollama-pull.log

echo "=== Dark Matter all-in-one host ready ==="
echo "Next: ssh in, create /opt/Dark-Matter/backend/.env (see header), then:"
echo "  sudo systemctl start dark-matter-backend"
echo "  tail -f /var/log/ollama-pull.log   # model download progress"
echo "  cd /opt/Dark-Matter/docker && ./setup-linux.sh   # engine stack"
