#!/bin/bash
# Dark Matter engine — AWS EC2 one-click deploy (user-data script).
#
# Launch an EC2 instance (Ubuntu 22.04+, t3.medium or bigger) with this as
# user-data. It installs Docker, clones the repo, and starts the PentAGI
# engine stack. Hunts then run on AWS instead of the local machine.
#
# After boot:
#   1. SSH in and run: cd Dark-Matter/docker && ./setup-linux.sh
#   2. Note the engine URL: http://<EC2-PUBLIC-IP>:8080
#   3. On Render (backend): set ENGINE_URL=http://<EC2-PUBLIC-IP>:8080
#      and redeploy. The backend orchestrates; the engine hunts on AWS.
#
# Security: restrict port 8080 in the EC2 security group to the Render
# outbound IPs (or put the engine behind a VPN). Never expose it publicly
# without ENGINE_TOKEN auth (setup-linux.sh mints it).

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

echo "=== Dark Matter engine host ready ==="
echo "Next: ssh in, then: cd /opt/Dark-Matter/docker && ./setup-linux.sh"
