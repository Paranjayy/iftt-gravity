#!/bin/bash
# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Gravity Status
# @raycast.mode inline
# @raycast.refreshTime 5m
# Optional parameters:
# @raycast.icon 📊
# @raycast.packageName Gravity Hub
# @raycast.description Live house status: presence, AC, and light hours.
# @raycast.author Paranjay
# @raycast.authorURL https://github.com/Paranjayy

STATUS=$(curl -s --max-time 2 "http://localhost:3030/status" 2>/dev/null)
if [ -z "$STATUS" ]; then
  echo "⚠️ Gravity Offline"
  exit 0
fi

ONLINE=$(echo "$STATUS" | grep -o '"online": [^,}]*' | awk '{print $2}')
AC=$(echo "$STATUS" | grep -o '"acMinutes": [^,}]*' | awk '{print $2}')
LIGHT=$(echo "$STATUS" | grep -o '"lightMinutes": [^,}]*' | awk '{print $2}')

AC=${AC:-0}
LIGHT=${LIGHT:-0}
AC_HRS=$((AC / 60))
LIGHT_HRS=$((LIGHT / 60))

if [ "$ONLINE" = "true" ]; then
  PRESENCE="🏠 Home"
else
  PRESENCE="🚶 Away"
fi

echo "Gravity: $PRESENCE | ❄️ ${AC_HRS}h | 💡 ${LIGHT_HRS}h"
