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

# Evict any existing process on 3030
if lsof -ti :3030 > /dev/null; then
  lsof -ti :3030 | xargs kill -9 2>/dev/null
  echo "🔴 Gravity: Pulse Stopped."
  exit 0
fi

# Rebuild the extension to bake in latest logic/UI
echo "⚒️ Rebuilding Iron Vault..."
cd raycast-ext && /Users/paranjay/.bun/bin/bun run build > /dev/null 2>&1
cd ..

# Launch the Brain in the background
echo "🟢 Gravity: Pulse Active. Sentry Engaged."
CLIPBOARD_ONLY=true /Users/paranjay/.bun/bin/bun src/lib/bot.ts > /tmp/gravity-archive.log 2>&1 &
