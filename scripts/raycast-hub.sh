#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Gravity Hub: Sync and Start
# @raycast.mode compact

# Optional parameters:
# @raycast.icon 🪐
# @raycast.packageName Gravity Utilities

# Documentation:
# @raycast.description Ensures the Gravity Hub backend (Bun) is running and synced.

HUB_DIR="/Users/paranjay/Developer/iftt"
cd "$HUB_DIR"

# Check if Bun is running Gravity
if pgrep -f "bun src/lib/bot.ts" > /dev/null
then
    echo "🪐 Gravity Hub is already active."
else
    echo "🚀 Starting Gravity Hub..."
    # Start in background
    nohup bun src/lib/bot.ts > hub.log 2>&1 &
    echo "✅ Hub Launched in Background."
fi
