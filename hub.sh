#!/bin/bash

# 🪐 Gravity: Unified Terminal Control
CMD=$1

if [ "$CMD" == "start" ]; then
  ./raycast-ext/hub-start.sh
  echo "🪐 Gravity: Launch Pulse Sent."
elif [ "$CMD" == "stop" ]; then
  ./raycast-ext/hub-stop.sh
elif [ "$CMD" == "status" ]; then
  if lsof -ti :3030 > /dev/null; then
    echo "🟢 Gravity: ONLINE (Port 3030)"
  else
    echo "🔴 Gravity: OFFLINE"
  fi
else
  echo "Usage: ./hub.sh [start|stop|status]"
fi
