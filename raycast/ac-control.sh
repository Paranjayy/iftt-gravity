#!/bin/bash
# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Gravity AC
# @raycast.mode compact
# Optional parameters:
# @raycast.icon ❄️
# @raycast.argument1 { "type": "text", "placeholder": "on, off, 24, cool, fan, auto" }
# @raycast.packageName Gravity Hub
# @raycast.description Control AC via Gravity Hub API.
# @raycast.author Paranjay
# @raycast.authorURL https://github.com/Paranjayy

curl -s "http://localhost:3030/scene/AC_${1}" > /dev/null
echo "❄️ AC → $1"
