#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Gravity Pulse Check
# @raycast.mode silent
# @raycast.packageName Gravity Tools

# Optional parameters:
# @raycast.icon 💓
# @raycast.currentDirectoryPath /Users/paranjay/Developer/iftt

# Documentation:
# @raycast.description Verify the status of the Hub, Zapit engine, and Clipboard Archive.
# @raycast.author antigravity

STATUS=$(curl -s http://localhost:3030/status 2>/dev/null)

if [ -z "$STATUS" ]; then
  echo "🌑 Gravity Hub is OFFLINE"
  exit 0
fi

PORT_CHECK=$(lsof -ti :3030)
HUB_MODE=$(echo $STATUS | grep -q "CLIPBOARD_ONLY" && echo "Minimal Brain" || echo "Full Hub")

echo "🟢 Gravity Hub: ONLINE ($HUB_MODE)"
echo "📡 Port 3030 PID: $PORT_CHECK"
