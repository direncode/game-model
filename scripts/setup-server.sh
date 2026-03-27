#!/bin/bash
set -euo pipefail

# ══════════════════════════════════════════════
# Latent Intelligence — First-Time Server Setup
# ══════════════════════════════════════════════
# Run this ONCE on a fresh Ubuntu 22.04+ VPS:
#   curl -sSL https://raw.githubusercontent.com/<repo>/main/scripts/setup-server.sh | bash
#
# Or SSH in and run: bash scripts/setup-server.sh

echo "══════════════════════════════════════════"
echo " Latent Intelligence — Server Setup"
echo "══════════════════════════════════════════"

# ─── 1. System updates ───
echo "→ Updating system packages..."
sudo apt-get update -y
sudo apt-get upgrade -y

# ─── 2. Install Docker ───
if ! command -v docker &> /dev/null; then
    echo "→ Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker "$USER"
    echo "  Docker installed. You may need to log out and back in for group changes."
else
    echo "→ Docker already installed."
fi

# ─── 3. Install Docker Compose plugin ───
if ! docker compose version &> /dev/null; then
    echo "→ Installing Docker Compose plugin..."
    sudo apt-get install -y docker-compose-plugin
else
    echo "→ Docker Compose already installed."
fi

# ─── 4. Install useful tools ───
echo "→ Installing utilities..."
sudo apt-get install -y git htop curl wget unzip fail2ban ufw

# ─── 5. Firewall ───
echo "→ Configuring firewall (UFW)..."
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp    # HTTP (Cloudflare → Nginx)
sudo ufw allow 443/tcp   # HTTPS (if needed later)
sudo ufw --force enable
echo "  Firewall enabled: SSH + HTTP + HTTPS only."

# ─── 6. Fail2ban ───
echo "→ Enabling fail2ban..."
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# ─── 7. Create app directory ───
APP_DIR="/opt/latentocean"
echo "→ Creating application directory at $APP_DIR..."
sudo mkdir -p "$APP_DIR"
sudo chown "$USER":"$USER" "$APP_DIR"

# ─── 8. Clone repo ───
if [ ! -d "$APP_DIR/.git" ]; then
    echo "→ Clone your repo into $APP_DIR:"
    echo "  cd $APP_DIR"
    echo "  git clone --recurse-submodules <your-repo-url> ."
else
    echo "→ Repo already exists at $APP_DIR."
fi

# ─── 9. Create env file ───
if [ ! -f "$APP_DIR/.env.production" ]; then
    echo ""
    echo "══════════════════════════════════════════"
    echo " IMPORTANT: Create your .env.production"
    echo "══════════════════════════════════════════"
    echo ""
    echo "  cp $APP_DIR/.env.production.example $APP_DIR/.env.production"
    echo "  nano $APP_DIR/.env.production"
    echo ""
    echo "  Generate secrets with:"
    echo "    openssl rand -hex 32   (for POSTGRES_PASSWORD)"
    echo "    openssl rand -hex 64   (for JWT_SECRET_KEY)"
    echo ""
fi

echo ""
echo "══════════════════════════════════════════"
echo " Setup complete!"
echo "══════════════════════════════════════════"
echo ""
echo " Next steps:"
echo "  1. Clone your repo into $APP_DIR"
echo "  2. Create .env.production from the example"
echo "  3. Run: bash scripts/deploy.sh"
echo ""
