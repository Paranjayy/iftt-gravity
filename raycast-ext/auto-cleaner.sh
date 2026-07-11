#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Auto-Cleaner (Safe Cache Purge)
# @raycast.mode fullOutput
# @raycast.packageName Gravity Tools
# @raycast.icon ./hub.png
# @raycast.currentDirectoryPath /Users/paranjay/Developer/iftt

# Documentation:
# @raycast.description Dry-run preview of safe cache purge. Caches/Logs older than 7d, npm/bun/pip caches. NEVER touches Developer, Raycast, editors, gravity-archive. Re-run with --execute to actually purge.

bash "$(dirname "$0")/../scripts/auto-cleaner.sh" --execute
