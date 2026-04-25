#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Gravity Hub(Start)
# @raycast.mode compact
# @raycast.packageName Gravity Tools

# Optional parameters:
# @raycast.icon 🪐
# @raycast.currentDirectoryPath /Users/paranjay/Developer/iftt/raycast-ext

# Documentation:
# @raycast.description Launch the Dual-Core Gravity Hub (Bot + Archive).
# @raycast.author antigravity

# Execute Master Launcher
nohup /Users/paranjay/Developer/iftt/raycast-ext/iftt-clone.sh >/dev/null 2>&1 &
disown

echo "🪐 Dual-Core Gravity Online.(Bot + Archive)"
