#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Gravity Hub
# @raycast.mode silent
# @raycast.packageName Gravity Tools

# Optional parameters:
# @raycast.icon 🪐
# @raycast.currentDirectoryPath /Users/paranjay/Developer/iftt/raycast-ext

# Documentation:
# @raycast.description Launch the Dual-Core Gravity Hub (Bot + Archive).
# @raycast.author antigravity

# Execute Master Launcher
nohup ./iftt-clone.sh >/dev/null 2>&1 &
disown

echo "🪐 Dual-Core Gravity Online."
