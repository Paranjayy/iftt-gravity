#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Gravity Pulse Check
# @raycast.mode silent
# @raycast.packageName Gravity Tools

# Optional parameters:
# @raycast.icon 💓
# @raycast.currentDirectoryPath /Users/paranjay/Developer/iftt/raycast-ext

# Documentation:
# @raycast.description Verify the status of the Dual-Core Hub (Bot + Archive).
# @raycast.author antigravity

BOT_STATUS=$(curl -s http://localhost:3030/status 2>/dev/null)
ARCH_STATUS=$(curl -s http://localhost:3031/ 2>/dev/null)

MSG=""

if [ ! -z "$BOT_STATUS" ]; then
  MSG="🤖 Ambassador: ONLINE"
else
  MSG="🤖 Ambassador: OFFLINE"
fi

if [ ! -z "$ARCH_STATUS" ]; then
  MSG="$MSG | 📂 Archive: ONLINE"
else
  MSG="$MSG | 📂 Archive: OFFLINE"
fi

echo "$MSG"
