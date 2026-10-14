#!/bin/bash
# Dark Matter — AWS EC2 all-in-one deploy (user-data).
#
# Launch: Ubuntu 22.04, t3.large, 50GB gp3, with this as user-data.
# Installs: Docker, Node 20, clones the repo, installs backend deps.
#
# After boot, SSH in and:
#   1. Create /opt/Dark-Matter/backend/.env (see backend/.env.example)
#   2. Build hunt image: docker build -f docker/Dockerfile.hunt -t darkmatter/hunt:latest /opt/Dark-Matter
#   3. Start backend: cd /opt/Dark-Matter/backend && npm start
#
# The backend auto-spawns an isolated container per hunt; Bedrock is the AI.

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

# Node 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Repo
if [ ! -d /opt/Dark-Matter ]; then
  git clone https://github.com/Obfinityy/Dark-Matter.git /opt/Dark-Matter
fi
chown -R ubuntu:ubuntu /opt/Dark-Matter

# Backend deps (as ubuntu)
sudo -u ubuntu bash -c 'cd /opt/Dark-Matter/backend && npm ci --omit=dev 2>&1 | tail -2'

echo "=== Dark Matter box ready ==="
echo "Next: SSH in, create backend/.env, build hunt image, npm start"
