#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Stop Gravity Hub
# @raycast.mode compact
# @raycast.packageName Gravity Tools

# Optional parameters:
# @raycast.icon 🛑

echo "🛑 Nuking Gravity Hub..."

# Polite kill (Gives bot time to send offline report)
pkill -SIGINT -f "bot.ts" 2>/dev/null

echo "💀 Gravity Hub is now OFFLINE."
