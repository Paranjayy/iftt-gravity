#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Start Gravity Archive
# @raycast.mode compact
# @raycast.icon 📎
# @raycast.packageName Gravity Tools

# Documentation:
# @raycast.description Starts the clipboard archive watcher service.

PROJECT_DIR="/Users/paranjay/Developer/iftt"
cd "$PROJECT_DIR"

if pgrep -f "src/archive/watcher.ts" > /dev/null
then
    echo "📎 Archive Watcher is already running."
else
    echo "🚀 Starting Archive Watcher..."
    ./scripts/archive-runner.sh start
    echo "✅ Watcher Started."
fi
