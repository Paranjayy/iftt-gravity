#!/bin/bash

# 🪐 Gravity Master Launcher
# Starts the entire God Build Ecosystem

echo "🌌 Launching Gravity Hub God Build..."

# 1. Start the main Bot Hub
/Users/paranjay/.bun/bin/bun src/lib/bot.ts &
HUB_PID=$!

# 2. Wait for API to warm up
sleep 3

# 3. Start the Archive Sentry
./scripts/archive-sentry.sh &
SENTRY_PID=$!

echo "🚀 Gravity Ecosystem is LIVE (PID: $HUB_PID, SENTRY: $SENTRY_PID)"
echo "Type 'stop' to shut down the mission."

read input
if [ "$input" == "stop" ]; then
    kill $HUB_PID
    kill $SENTRY_PID
    echo "🌑 Mission Controlled Shutdown Complete."
fi
