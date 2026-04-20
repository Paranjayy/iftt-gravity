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
# @raycast.description Total shutdown of all Gravity Hub processes.
# @raycast.author antigravity

# 1. Kill any process on Port 3030 (The Frequency)
lsof -ti :3030 | xargs kill -9 2>/dev/null

# 2. Kill any wandering Bun processes related to the hub
pkill -f "bot.ts" 2>/dev/null
pkill -f "archive-brain.ts" 2>/dev/null

echo "🌑 Mission Controlled Shutdown Complete."
