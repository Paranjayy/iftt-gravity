#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title New-Mac Bootstrap (Preview)
# @raycast.mode fullOutput
# @raycast.packageName Gravity Tools
# @raycast.icon ./hub.png
# @raycast.currentDirectoryPath /Users/paranjay/Developer/iftt

# Documentation:
# @raycast.description Dry-run preview of new-mac-bootstrap. Shows what would be installed/restored if you ran --execute. Never modifies anything.

bash "$(dirname "$0")/../scripts/new-mac-bootstrap.sh"
