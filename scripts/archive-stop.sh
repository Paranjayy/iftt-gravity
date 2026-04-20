#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Stop Gravity Archive
# @raycast.mode compact
# @raycast.icon 🛑
# @raycast.packageName Gravity Tools

# Documentation:
# @raycast.description Stops the clipboard archive watcher service.

PROJECT_DIR="/Users/paranjay/Developer/iftt"
cd "$PROJECT_DIR"

echo "🛑 Stopping Archive Watcher..."
./scripts/archive-runner.sh stop
echo "✅ Watcher Stopped."
