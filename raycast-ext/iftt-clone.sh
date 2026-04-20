#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Gravity Hub
# @raycast.mode compact
# @raycast.packageName Gravity Tools

# Optional parameters:
# @raycast.icon 🪐

echo "🪐 Initializing Gravity Hub..."

# 1. Force kill any existing instances (Total Purge)
pkill -9 -f "bot.ts" 2>/dev/null

# 2. Direct detached boot from project root
cd /Users/paranjay/Developer/iftt
nohup /Users/paranjay/.bun/bin/bun src/lib/bot.ts >> /tmp/gravity-bot.log 2>&1 &

# 3. Wait for port 3030 to breathe
sleep 2

echo "🚀 Gravity Hub is now active!"
