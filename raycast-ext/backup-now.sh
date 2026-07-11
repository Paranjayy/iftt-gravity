#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Backup Everything Now
# @raycast.mode fullOutput
# @raycast.packageName Gravity Tools
# @raycast.icon ./hub.png
# @raycast.currentDirectoryPath /Users/paranjay/Developer/iftt

# Documentation:
# @raycast.description Snapshots Raycast state, editor configs, SSH keys, dotfiles, and gravity notes/archives into ~/gravity-archive/<YYYY-MM-DD>/. Safe to run any time.

bash "$(dirname "$0")/../scripts/backup-everything.sh"
echo ""
echo "✓ Done. Run 'Backup List' to inspect."
