#!/bin/bash
# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Gravity Scene
# @raycast.mode compact
# Optional parameters:
# @raycast.icon 🌌
# @raycast.argument1 { "type": "text", "placeholder": "tv, away, home, party, focus, dinner..." }
# @raycast.packageName Gravity Hub
# @raycast.description Toggle Gravity Smart Home scenes.
# @raycast.author Paranjay
# @raycast.authorURL https://github.com/Paranjayy

SCENE=$(echo "$1" | tr '[:lower:]' '[:upper:]')
RESULT=$(curl -s "http://localhost:3030/scene/$SCENE")
echo "✅ $RESULT"
