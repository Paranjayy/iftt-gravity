#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Gravity Scene
# @raycast.mode compact
# @raycast.refreshTime 1d

# Optional parameters:
# @raycast.icon 🌌
# @raycast.argument1 { "type": "text", "placeholder": "tv, away, home, party..." }
# @raycast.packageName Gravity Hub

# Documentation:
# @raycast.description Toggle Gravity Smart Home scenes via local Hub API.
# @raycast.author Paranjay
# @raycast.authorURL https://github.com/Paranjayy

SCENE=$(echo "$1" | tr '[:lower:]' '[:upper:]')
curl -s "http://localhost:3030/scene/$SCENE"
echo "Activated $SCENE Mode"
