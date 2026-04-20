#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Gravity Hub (Archive Only)
# @raycast.mode silent
# @raycast.packageName Gravity Tools

# Optional parameters:
# @raycast.icon 🪐
# @raycast.currentDirectoryPath /Users/paranjay/Developer/iftt

# Documentation:
# @raycast.description Start the Gravity Hub in minimal CLIPBOARD_ONLY mode.
# @raycast.author antigravity

# Evict any existing process on 3030 first to prevent domino crashes
lsof -ti :3030 | xargs kill -9 2>/dev/null

# Launch the Brain in the background
CLIPBOARD_ONLY=true /Users/paranjay/.bun/bin/bun src/lib/bot.ts > /tmp/gravity-archive.log 2>&1 &

echo "🌌 Gravity Archive Sentry: ACTIVE"
