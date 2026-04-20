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
# @raycast.description Launch the Full Gravity Hub God Build.
# @raycast.author antigravity

echo "🧱 Waking up the Intelligence Core..."

# 1. Clear Port 3030 to prevent domino collisions
lsof -ti :3030 | xargs kill -9 2>/dev/null
sleep 1

# 2. Start the FULL Hub in the background
/Users/paranjay/.bun/bin/bun src/lib/bot.ts > /tmp/gravity-hub.log 2>&1 &

echo "🚀 Gravity Hub: MISSION START"
