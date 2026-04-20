#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Gravity Hub
# @raycast.mode compact
# @raycast.packageName Gravity Tools

# Optional parameters:
# @raycast.icon 🪐

echo "🪐 Initializing Gravity Hub..."

# Direct detached boot (bypass hub.sh nesting)
/Users/paranjay/.bun/bin/bun /Users/paranjay/Developer/iftt/src/lib/bot.ts >> /tmp/gravity-bot.log 2>&1 &

echo "🚀 Gravity Hub is now active!"
