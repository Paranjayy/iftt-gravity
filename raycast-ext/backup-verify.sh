#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Backup Health Check
# @raycast.mode compact
# @raycast.packageName Gravity Tools
# @raycast.icon ./hub.png
# @raycast.currentDirectoryPath /Users/paranjay/Developer/iftt

# Documentation:
# @raycast.description Verifies the most recent gravity-archive backup is <48h old. Exits 1 if stale.

bash "$(dirname "$0")/../scripts/backup-everything.sh" --verify
RC=$?
if [ $RC -eq 0 ]; then
  echo "✓ Backup is fresh"
else
  echo "⚠️  Backup is stale (>48h old)"
fi
exit $RC
