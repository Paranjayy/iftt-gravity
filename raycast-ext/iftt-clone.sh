#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Start Gravity Hub
# @raycast.mode compact
# @raycast.packageName Gravity Tools

# Optional parameters:
# @raycast.icon 🪐

echo "🪐 Initializing Gravity Hub..."

# Execute your hub launcher script directly using nohup to detach it
nohup bash /Users/paranjay/Developer/iftt/hub.sh > /dev/null 2>&1 &

echo "🚀 Gravity God Mode is now active!"
