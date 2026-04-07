#!/bin/bash
# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Gravity Events
# @raycast.mode inline
# @raycast.refreshTime 1m
# Optional parameters:
# @raycast.icon 📜
# @raycast.packageName Gravity Hub
# @raycast.description View the last 5 house activity logs.
# @raycast.author Paranjay
# @raycast.authorURL https://github.com/Paranjayy

LOG_FILE="/Users/paranjay/Developer/iftt/house_log.md"

if [ ! -f "$LOG_FILE" ]; then
  echo "📜 No activity logged yet."
  exit 0
fi

# Show the last 1-4 lines depending on length
tail -n 3 "$LOG_FILE" | sed 's/\[.*\] //g' | paste -sd " | " -
