#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title List Last Backup
# @raycast.mode fullOutput
# @raycast.packageName Gravity Tools
# @raycast.icon ./hub.png
# @raycast.currentDirectoryPath /Users/paranjay/Developer/iftt

# Documentation:
# @raycast.description Lists the contents of the most recent backup in ~/gravity-archive/latest/.

bash "$(dirname "$0")/../scripts/backup-everything.sh" --list
