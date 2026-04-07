#!/bin/bash
# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Gravity Vibe
# @raycast.mode compact
# Optional parameters:
# @raycast.icon 🎨
# @raycast.argument1 { "type": "text", "placeholder": "vibe name (e.g. gaming, relax...)" }
# @raycast.packageName Gravity Hub
# @raycast.description Activate a custom saved vibe.
# @raycast.author Paranjay
# @raycast.authorURL https://github.com/Paranjayy

VIBE=$(echo "$1" | tr '[:lower:]' '[:upper:]')
RESULT=$(curl -s "http://localhost:3030/scene/VIBE_$VIBE")
echo "🎨 Vibe: $VIBE activated."
