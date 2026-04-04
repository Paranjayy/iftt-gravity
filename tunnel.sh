#!/bin/bash
# Gravity — Remote Tunnel via Cloudflare
# Works on macOS, Linux, Windows (WSL)
# Makes your local Gravity dashboard accessible from ANYWHERE

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT=3000

echo "🌐 Starting Gravity Remote Tunnel..."
echo "   This gives you a public HTTPS URL to control your devices from anywhere."
echo ""

# Check if cloudflared is installed
if ! command -v cloudflared &> /dev/null; then
  echo "📦 Installing cloudflared (Cloudflare Tunnel)..."
  if command -v brew &> /dev/null; then
    brew install cloudflared
  elif command -v apt-get &> /dev/null; then
    curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o /tmp/cloudflared.deb
    sudo dpkg -i /tmp/cloudflared.deb
  else
    echo "❌ Please install cloudflared manually: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
    exit 1
  fi
fi

echo "🚀 Starting tunnel on port $PORT..."
echo "   Your public URL will appear below (share it or open on your phone):"
echo ""
cloudflared tunnel --url http://localhost:$PORT
