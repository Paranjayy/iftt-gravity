#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Gravity Status
# @raycast.mode inline
# @raycast.refreshTime 5m

# Optional parameters:
# @raycast.icon 📊
# @raycast.packageName Gravity Hub

# Documentation:
# @raycast.description Check house state and energy usage via Raycast.
# @raycast.author Paranjay
# @raycast.authorURL https://github.com/Paranjayy

STATUS=$(curl -s "http://localhost:3030/status")
ONLINE=$(echo $STATUS | grep -o '"online": [^,]*' | cut -d' ' -f2)
AC=$(echo $STATUS | grep -o '"acMinutes": [^,]*' | cut -d' ' -f2)
LIGHT=$(echo $STATUS | grep -o '"lightMinutes": [^,]*' | cut -d' ' -f2)

if [ "$ONLINE" == "true" ]; then
  PRESENCE="🏠 Home"
else
  PRESENCE="🚶 Away"
fi

echo "Gravity: $PRESENCE | ❄️  $((AC/60))hr | 💡 $((LIGHT/60))hr"
