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
# @raycast.description Total shutdown of all Gravity processes.
# @raycast.author antigravity

# 1. Iron Stop: Terminate all Gravity processes
ps aux | grep "src/lib/bot.ts" | grep -v grep | awk '{print $2}' | xargs kill -9 2>/dev/null
lsof -ti :3030 | xargs kill -9 2>/dev/null

echo "🌑 Gravity Stopped."
