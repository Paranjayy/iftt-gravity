#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Gravity Hub (Archive Only)
# @raycast.mode silent
# @raycast.packageName Gravity Tools

# Optional parameters:
# @raycast.icon 🪐
# @raycast.currentDirectoryPath /Users/paranjay/Developer/iftt

# Documentation:
# @raycast.description Start the Gravity Hub in minimal CLIPBOARD_ONLY mode.
# @raycast.author antigravity

# Rebuild the extension to bake in latest logic/UI
echo "⚒️ Gravity: Syncing Archive UI..."
cd /Users/paranjay/Developer/iftt/raycast-ext && /Users/paranjay/.bun/bin/bun run build > /dev/null 2>&1
if [ $? -ne 0 ]; then
  echo "❌ Gravity: BUILD ERROR. Fix raycast-ext first."
  exit 1
fi

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

# Start Gravity Archive (Port 3031)
/Users/paranjay/.bun/bin/bun src/lib/archive.ts > /tmp/gravity-archive.log 2>&1 &
echo "  ↳ 📂 Gravity Archive engaged."

# Start Gravity Hub (Port 3030)
/Users/paranjay/.bun/bin/bun src/lib/bot.ts > /tmp/gravity-bot.log 2>&1 &
echo "  ↳ 🤖 Gravity Hub ambassador live."
