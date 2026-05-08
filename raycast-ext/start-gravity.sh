#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Start Gravity Hub
# @raycast.mode compact
# @raycast.icon 🪐
# @raycast.packageName Gravity Tools

# Documentation:
# @raycast.description Starts the total Gravity Sovereign engine (Bot + Archive).

HUB_DIR="/Users/paranjay/Developer/iftt"
cd "$HUB_DIR"

if [ -f "./gravity-start.sh" ]; then
    ./gravity-start.sh
else
    echo "❌ Error: gravity-start.sh missing in root."
    exit 1
fi
