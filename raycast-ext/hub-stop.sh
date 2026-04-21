#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Stop Gravity Hub
# @raycast.mode silent
# @raycast.packageName Gravity Tools

# Optional parameters:
# @raycast.icon 🛑
# @raycast.currentDirectoryPath /Users/paranjay/Developer/iftt/raycast-ext

# Documentation:
# @raycast.description Graceful shutdown for Bot and Archive.
# @raycast.author antigravity

# 1. Polite Stop (Bot - Port 3030)
# Use SIGINT to trigger the 'Gravity went OFFLINE' Telegram broadcast
BOT_PID=$(lsof -t -i:3030)
if [ ! -z "$BOT_PID" ]; then
  kill -INT $BOT_PID 2>/dev/null
  echo "📡 Signaling Bot for graceful exit..."
  sleep 2
fi

# 2. Archive Stop (Port 3031)
ARCH_PID=$(lsof -t -i:3031)
if [ ! -z "$ARCH_PID" ]; then
  kill -INT $ARCH_PID 2>/dev/null
  echo "📂 Signaling Archive to park database..."
fi

# 3. Iron Sweep: Kill any stragglers if they refuse to die
sleep 1
lsof -ti :3030,3031 | xargs kill -9 2>/dev/null
ps aux | grep -E "src/lib/bot.ts|src/lib/archive.ts" | grep -v grep | awk '{print $2}' | xargs kill -9 2>/dev/null

echo "🌑 Gravity Sovereign Shutdown Complete."
