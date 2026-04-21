#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Stop Gravity Hub
# @raycast.mode silent
# @raycast.packageName Gravity Tools

# Optional parameters:
# @raycast.icon 🛑
# @raycast.currentDirectoryPath /Users/paranjay/Developer/iftt

# Documentation:
# @raycast.description Precision shutdown via PID Lock.
# @raycast.author antigravity

# 1. PID Strike: Kill the exact process
if [ -f /tmp/gravity-hub.pid ]; then
  PID=$(cat /tmp/gravity-hub.pid)
  kill -9 $PID 2>/dev/null
  rm /tmp/gravity-hub.pid
fi

# 2. Iron Backup: Kill any stragglers
lsof -ti :3030 | xargs kill -9 2>/dev/null
ps aux | grep "src/lib/bot.ts" | grep -v grep | awk '{print $2}' | xargs kill -9 2>/dev/null

echo "🌑 Gravity Stopped."
