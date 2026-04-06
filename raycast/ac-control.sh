#!/bin/bash

# Raycast Script Command:
# @raycast.schemaVersion 1
# @raycast.title ❄️ Control AC
# @raycast.mode compact
# @raycast.packageName Gravity
# @raycast.argument1 { "type": "text", "placeholder": "Cmd: on, off, 24, cool, fan, auto" }

# @raycast.icon ❄️
# @raycast.description Control the Panasonic AC via Gravity API

# Send the command to local Gravity server
response=$(curl -s -X POST http://localhost:3000/api/control/ac \
  -H "Content-Type: application/json" \
  -d "{\"command\":\"$1\"}")

if [[ $response == *"success\":true"* ]]; then
  echo "✅ AC set to $1"
else
  echo "❌ Error: $response"
fi
