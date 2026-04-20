#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Gravity Hub
# @raycast.mode compact
# @raycast.packageName Gravity Tools

# Optional parameters:
# @raycast.icon 🪐

echo "🪐 Initializing Gravity Hub..."

# 1. Kill any existing instances to avoid port 3030 conflict
pkill -f "src/lib/bot.ts" 2>/dev/null

# 2. Direct detached boot from project root
cd /Users/paranjay/Developer/iftt
nohup /Users/paranjay/.bun/bin/bun src/lib/bot.ts >> /tmp/gravity-bot.log 2>&1 &

# 3. Brief pause for heartbeat
sleep 1

echo "🚀 Gravity Hub is now active!"
