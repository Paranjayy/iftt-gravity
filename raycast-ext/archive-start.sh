#!/bin/bash
# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Start Gravity Archive (Alone)
# @raycast.mode silent
# @raycast.packageName Gravity Tools

# Optional parameters:
# @raycast.icon 📦
# @raycast.currentDirectoryPath /Users/paranjay/Developer/iftt/raycast-ext

# Documentation:
# @raycast.description Launch ONLY the Gravity Archive Sentry (clipboard backend).
# @raycast.author antigravity

# Execute Standalone Launcher via Cloner
nohup ./iftt-clone.sh archive >/dev/null 2>&1 &
disown

echo "📦 Gravity Archive Heart started alone."
