#!/bin/bash
# Dark Matter — Kali hunt environment setup for EC2.
# Run this ONCE on the EC2 machine (ubuntu@ip-172-31-36-149).
#
# What it does:
#   1. Ensures Docker is installed and running
#   2. Builds the darkmatter/hunt:latest image (Kali + elite tooling)
#   3. Verifies the image works
#
# After this, every hunt spawns an isolated Kali container from this image —
# the agent's "computer" that it controls like a human hacker.

set -e

echo "=== Dark Matter Kali Hunt Setup ==="

# 1. Docker check
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker ubuntu
    echo "Docker installed. You may need to re-login for group permissions."
fi

sudo systemctl enable docker 2>/dev/null || true
sudo systemctl start docker 2>/dev/null || true

echo "Docker version: $(docker --version)"

# 2. Build the hunt image
echo ""
echo "Building darkmatter/hunt:latest (Kali + tools)..."
echo "This takes 5-15 minutes on first build."

cd /opt/Dark-Matter
docker build -f docker/Dockerfile.hunt -t darkmatter/hunt:latest .

# 3. Verify
echo ""
echo "Verifying image..."
docker run --rm darkmatter/hunt:latest nmap --version 2>/dev/null | head -1 || echo "nmap check skipped"
docker run --rm darkmatter/hunt:latest python3 --version

echo ""
echo "=== Setup complete ==="
echo "The hunt image is ready. New hunts will spawn isolated Kali containers from it."
echo "Rebuild after Dockerfile changes: docker build -f docker/Dockerfile.hunt -t darkmatter/hunt:latest /opt/Dark-Matter"
