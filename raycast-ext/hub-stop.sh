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
# @raycast.description Polite shutdown via PID Lock.
# @raycast.author antigravity

# 1. PID Pulse: Send SIGTERM to allow for final Telegram sync
if [ -f /tmp/gravity-hub.pid ]; then
  PID=$(cat /tmp/gravity-hub.pid)
  kill -15 $PID 2>/dev/null
  
  # Wait for polite shutdown
  sleep 2
  
  # If still alive, execute Iron Strike
  if ps -p $PID > /dev/null; then
    kill -9 $PID 2>/dev/null
  fi
  rm /tmp/gravity-hub.pid
fi

# 2. Iron Backup: Kill any stragglers
lsof -ti :3030 | xargs kill -9 2>/dev/null
ps aux | grep "src/lib/bot.ts" | grep -v grep | awk '{print $2}' | xargs kill -9 2>/dev/null

echo "🌑 Gravity Stopped."
