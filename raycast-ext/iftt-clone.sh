#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Gravity Hub
# @raycast.mode compact
# @raycast.packageName Gravity Tools

# Optional parameters:
# @raycast.icon 🪐

echo "🪐 Initializing Gravity Hub..."

# 1. Polite kill (Gives bot time to send offline report)
pkill -SIGINT -f "bot.ts" 2>/dev/null

# 2. Direct detached boot from project root
cd /Users/paranjay/Developer/iftt
nohup /Users/paranjay/.bun/bin/bun src/lib/bot.ts >> /tmp/gravity-bot.log 2>&1 &

# 3. Fire and Forget
echo "🚀 Gravity Hub Launching..."
