#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Gravity Hub Reset
# @raycast.mode compact
# @raycast.packageName Gravity Tools

# Optional parameters:
# @raycast.icon 🪐
# @raycast.currentDirectoryPath /Users/paranjay/Developer/iftt

# Documentation:
# @raycast.description Purge and Restart the Gravity Hub & Archive.
# @raycast.author antigravity

# Argument Handling for Standalone Boot
if [ "$1" == "archive" ]; then
  echo "📦 Gravity: Launching Archive Sentry alone..."
  ps aux | grep "src/lib/archive.ts" | grep -v grep | awk '{print $2}' | xargs kill -9 2>/dev/null
  nohup /Users/paranjay/.bun/bin/bun src/lib/archive.ts > /tmp/gravity-archive.log 2>&1 &
  disown
  echo "✅ Archive Sentry is now live (Port 3031)."
  exit 0
fi

# Rebuild the extension to bake in latest logic/UI
echo "⚒️ Gravity: Syncing Archive UI..."
cd /Users/paranjay/Developer/iftt/raycast-ext && /Users/paranjay/.bun/bin/bun run build > /dev/null 2>&1

# Evict any existing process on 3030 and 3031 surgically
echo "☢️ Gravity: Purging active pulses..."
for port in 3030 3031; do
  PIDS=$(lsof -t -i:$port)
  if [ ! -z "$PIDS" ]; then
    echo "  ↳ Stopping stragglers on Port $port: $PIDS"
    echo $PIDS | xargs kill -9 2>/dev/null
  fi
done
ps aux | grep -E "src/lib/bot.ts|src/lib/archive.ts" | grep -v grep | awk '{print $2}' | xargs kill -9 2>/dev/null
sleep 1

# Launch the Dual-Core Hub
echo "🟢 Gravity: Launching Heart & Archive..."
cd /Users/paranjay/Developer/iftt

# Spawn as detached background processes with logging
echo "  ↳ 📂 Gravity Archive engaged."
nohup /Users/paranjay/.bun/bin/bun src/lib/archive.ts > /tmp/gravity-archive.log 2>&1 &
disown

echo "  ↳ 🤖 Gravity Hub ambassador live."
nohup /Users/paranjay/.bun/bin/bun src/lib/bot.ts > /tmp/gravity-bot.log 2>&1 &
disown

sleep 3
# Final Pulse Check
if lsof -i:3031 >/dev/null && lsof -i:3030 >/dev/null; then
  echo "✅ Gravity Hub Restoration: SUCCESS."
else
  echo "⚠️ Gravity Partial Boot. Check logs at /tmp/gravity-*.log"
fi
