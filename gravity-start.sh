#!/bin/bash

# 🪐 Gravity Hub: Sovereign Start Sequence (v4.0)
# -----------------------------------------------

PROJECT_DIR="/Users/paranjay/Developer/iftt"
BUN_BIN="/Users/paranjay/.bun/bin/bun"

echo ""
echo "███████████████████████████████████████████████████████"
echo "█ 🌌 GRAVITY SOVEREIGN STATE: BOOT SEQUENCE INITIATED █"
echo "███████████████████████████████████████████████████████"
echo ""

# 1. Total Purge (Cleanup existing leaks)
echo "[1/4] 🧹 Purging active memory leaks and ghost nodes..."
pkill -9 -f "bot.ts" 2>/dev/null
pkill -9 -f "archive.ts" 2>/dev/null
pkill -9 -f "watcher.ts" 2>/dev/null
pkill -9 -f "server.ts" 2>/dev/null
sleep 1
echo "      => Workspace Purified."

# 2. Launching Subsystems
echo "[2/4] 🚀 Manifesting Core Orchestration Engines..."
cd "$PROJECT_DIR" || exit

echo "      => Booting Sovereign Archive Node (Port 3031)..."
nohup "$BUN_BIN" src/lib/archive.ts >> /tmp/gravity-archive.log 2>&1 &
sleep 1

echo "      => Booting Master Intelligence Bot (Telegram Hub)..."
nohup "$BUN_BIN" src/lib/bot.ts >> /tmp/gravity-bot.log 2>&1 &
sleep 1

# 3. Validation
echo "[3/4] 🧬 Validating process topology..."
if pgrep -f "bot.ts" > /dev/null && pgrep -f "archive.ts" > /dev/null; then
  echo "      => Topology verified. All engines stable."
else
  echo "      => WARNING: Subsystem anomaly detected. Check logs."
fi

# 4. Final Pulse
echo "[4/4] ✨ Gravity Hub & Sovereign Archive are now ONLINE."
echo "-------------------------------------------------------"
echo "🔗 Archive API Endpoint: http://localhost:3031"
echo "📝 Bot Log: tail -f /tmp/gravity-bot.log"
echo "-------------------------------------------------------"
echo "Ready for God Mode."
echo ""
