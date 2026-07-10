#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title SmartThings
# @raycast.mode fullOutput
# @raycast.packageName Gravity Tools

# Optional parameters:
# @raycast.icon ./smartthings.png
# @raycast.currentDirectoryPath /Users/paranjay/Developer/iftt/raycast-ext

# Documentation:
# @raycast.description SmartThings status plus a direct jump into Gravity's device sync page.
# @raycast.author antigravity

STATUS_JSON=$(curl -s http://127.0.0.1:3030/status 2>/dev/null || true)

if [ -z "$STATUS_JSON" ]; then
  echo "SmartThings backend is offline."
  echo
  echo "Open the local device sync page:"
  echo "http://127.0.0.1:3000/device-sync"
  exit 0
fi

DEVICE_COUNT=$(echo "$STATUS_JSON" | sed -n 's/.*"deviceCount":[[:space:]]*\([0-9]\+\).*/\1/p' | head -n 1)
LOCATION_ID=$(echo "$STATUS_JSON" | sed -n 's/.*"locationId":[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1)
LAST_SYNC=$(echo "$STATUS_JSON" | sed -n 's/.*"lastSyncedAt":[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1)

if [ -z "$DEVICE_COUNT" ]; then
  DEVICE_COUNT="0"
fi

echo "SmartThings is online."
echo
echo "Devices indexed: $DEVICE_COUNT"

if [ -n "$LOCATION_ID" ]; then
  echo "Location ID: $LOCATION_ID"
else
  echo "Location ID: not saved yet"
fi

if [ -n "$LAST_SYNC" ]; then
  echo "Last sync: $LAST_SYNC"
fi

echo
echo "Open the local device sync page:"
echo "http://127.0.0.1:3000/device-sync"
