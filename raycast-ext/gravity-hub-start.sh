#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title 🪐 Start Gravity Hub
# @raycast.mode fullOutput
# @raycast.icon 🌌
# @raycast.packageName Gravity Tools

# Documentation:
# @raycast.description Manifests the total Gravity Sovereign engine (Bot + Archive).
# @raycast.author Paranjay

PROJECT_DIR="/Users/paranjay/Developer/iftt"
BUN_BIN="/Users/paranjay/.bun/bin/bun"

echo "🌌 Gravity Hub: Sovereign Start Sequence"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. Cleanup
echo "🧹 Purging existing processes..."
pkill -9 -f "bot.ts" 2>/dev/null
pkill -9 -f "archive.ts" 2>/dev/null
pkill -9 -f "watcher.ts" 2>/dev/null
pkill -9 -f "server.ts" 2>/dev/null
sleep 1

# 2. Launch
echo "🚀 Manifesting Core Engines..."

cd "$PROJECT_DIR"

# Launch Primary Bot
nohup "$BUN_BIN" src/lib/bot.ts > /tmp/gravity-bot.log 2>&1 &
BOT_PID=$!
sleep 2

if ps -p $BOT_PID > /dev/null; then
    echo "✅ [BOT] Launched (PID: $BOT_PID)"
else
    echo "❌ [BOT] Failed to start. Last log:"
    tail -n 5 /tmp/gravity-bot.log
fi

# Launch Sovereign Archive
nohup "$BUN_BIN" src/lib/archive.ts > /tmp/gravity-archive.log 2>&1 &
ARCHIVE_PID=$!
sleep 2

if ps -p $ARCHIVE_PID > /dev/null; then
    echo "✅ [ARCHIVE] Launched (PID: $ARCHIVE_PID)"
else
    echo "❌ [ARCHIVE] Failed to start. Last log:"
    tail -n 5 /tmp/gravity-archive.log
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if ps -p $BOT_PID > /dev/null && ps -p $ARCHIVE_PID > /dev/null; then
    echo "🪐 Gravity Hub is now ONLINE."
    echo "🔗 Bot: @if2opensource_bot"
    echo "🔗 API: http://localhost:3031"
else
    echo "⚠️ Gravity Hub is partially ONLINE or FAILED."
fi
