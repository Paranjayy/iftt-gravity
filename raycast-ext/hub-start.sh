#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Gravity Hub
# @raycast.mode silent
# @raycast.packageName Gravity Tools

# Optional parameters:
# @raycast.icon 🪐
# @raycast.currentDirectoryPath /Users/paranjay/Developer/iftt

# Documentation:
# @raycast.description Launch the Full Gravity Hub.
# @raycast.author antigravity

# 1. Iron Stop: Kill any existing Hubs first
ps aux | grep "src/lib/bot.ts" | grep -v grep | awk '{print $2}' | xargs kill -9 2>/dev/null
lsof -ti :3030 | xargs kill -9 2>/dev/null
sleep 1

# 2. Start Gravity
/Users/paranjay/.bun/bin/bun src/lib/bot.ts > /tmp/gravity-hub.log 2>&1 &

echo "🪐 Gravity Online."
