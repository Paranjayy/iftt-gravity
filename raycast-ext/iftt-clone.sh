#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Gravity Hub Reset
# @raycast.mode silent
# @raycast.packageName Gravity Tools

# Optional parameters:
# @raycast.icon 🪐
# @raycast.currentDirectoryPath /Users/paranjay/Developer/iftt

# Documentation:
# @raycast.description Purge and Restart the Gravity Hub & Archive.
# @raycast.author antigravity

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
nohup /Users/paranjay/.bun/bin/bun src/lib/archive.ts > /tmp/gravity-archive.log 2>&1 &
nohup /Users/paranjay/.bun/bin/bun src/lib/bot.ts > /tmp/gravity-bot.log 2>&1 &

echo "  ↳ 📂 Gravity Archive engaged."
echo "  ↳ 🤖 Gravity Hub ambassador live."
