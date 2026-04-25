#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Stop Gravity Hub
# @raycast.mode compact
# @raycast.packageName Gravity Tools

# Optional parameters:
# @raycast.icon 🛑
# @raycast.currentDirectoryPath /Users/paranjay/Developer/iftt/raycast-ext

# Documentation:
# @raycast.description Graceful shutdown for Bot and Archive.
# @raycast.author antigravity

# 1. Polite Stop (SIGINT for Telegram "Offline" Message)
echo "📡 Signaling Bot & Archive for graceful exit..."
pkill -INT -f "src/lib/bot.ts" 2>/dev/null
pkill -INT -f "src/lib/archive.ts" 2>/dev/null
sleep 2

# 2. Verify and Iron Sweep (Force Kill stragglers)
echo "☢️ Gravity: Executing final purge..."
for port in 3030 3031; do
  PIDS=$(lsof -t -i:$port)
  if [ ! -z "$PIDS" ]; then
    echo $PIDS | xargs kill -9 2>/dev/null
  fi
done

pkill -9 -f "src/lib/bot.ts" 2>/dev/null
pkill -9 -f "src/lib/archive.ts" 2>/dev/null

echo "🌑 Gravity Sovereign Shutdown Complete(Bot & Archive)."
