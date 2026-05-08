#!/bin/bash

# 🪐 Gravity Hub: Sovereign Start Sequence
# ----------------------------------------
# This script re-initializes the entire workstation orchestration engine.
# It ensures total telemetry, bot presence, and archival integrity.

PROJECT_DIR="/Users/paranjay/Developer/iftt"
BUN_BIN="/Users/paranjay/.bun/bin/bun"

echo "🪐 Initializing Gravity Sovereign State..."

# 1. Total Purge (Cleanup existing leaks)
echo "🧹 Purging existing leakages..."
pkill -9 -f "bot.ts" 2>/dev/null
pkill -9 -f "archive.ts" 2>/dev/null
pkill -9 -f "watcher.ts" 2>/dev/null
pkill -9 -f "server.ts" 2>/dev/null

# 2. Launch Engines
echo "🚀 Manifesting Core Engines..."

cd "$PROJECT_DIR"

# Launch Primary Bot
nohup "$BUN_BIN" src/lib/bot.ts >> /tmp/gravity-bot.log 2>&1 &
echo "   [BOT] Launched (Logging to /tmp/gravity-bot.log)"

# Launch Sovereign Archive (API + Watcher)
nohup "$BUN_BIN" src/lib/archive.ts >> /tmp/gravity-archive.log 2>&1 &
echo "   [ARCHIVE] Launched (Logging to /tmp/gravity-archive.log)"

# 3. Final Pulse
echo "✨ Gravity Hub & Sovereign Archive are now ONLINE."
echo "🔗 API Endpoint: http://localhost:3031"
echo "🪐 Sovereign Status: SATURATED"
