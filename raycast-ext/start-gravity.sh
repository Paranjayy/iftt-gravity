#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Start Gravity Hub
# @raycast.mode compact
# @raycast.icon ./hub.png
# @raycast.packageName Gravity Tools

# Documentation:
# @raycast.description Starts the total Gravity Sovereign engine (Bot + Archive).

HUB_DIR="/Users/paranjay/Developer/iftt"
LOG_FILE="/tmp/gravity-launcher.log"

wait_for_hub() {
    local attempts=30
    while [ "$attempts" -gt 0 ]; do
        if curl -fsS --max-time 1 "http://127.0.0.1:3030/" >/dev/null 2>&1; then
            return 0
        fi
        sleep 1
        attempts=$((attempts - 1))
    done
    return 1
}

log() {
    printf '[%s] %s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$*" >>"$LOG_FILE"
}

cd "$HUB_DIR" || exit 1
log "launcher invoked"

if wait_for_hub; then
    log "hub already healthy on 127.0.0.1:3030"
    echo "✅ Gravity Hub is already online (127.0.0.1:3030)."
    exit 0
fi

if [ ! -x "./iftt-clone.sh" ]; then
    echo "❌ Error: iftt-clone.sh missing in root."
    exit 1
fi

# Start the native Bun stack first. The launcher installs missing dependencies
# and verifies all required ports before returning success.
nohup ./iftt-clone.sh >"$LOG_FILE" 2>&1 < /dev/null &
log "native backend launch requested"
if wait_for_hub; then
    log "native backend healthy on 127.0.0.1:3030"
    echo "✅ Gravity Hub started locally (127.0.0.1:3030)."
    exit 0
fi

# Docker is an optional fallback for machines where the local Bun runtime is
# unavailable. Map 3030 because Raycast controls the bot API, not the web UI.
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    log "native backend did not become healthy; Docker is available"
    echo "⚠️ Local start failed; trying Docker…"
    docker compose up -d --build >>"$LOG_FILE" 2>&1
    if wait_for_hub; then
        log "Docker backend healthy on 127.0.0.1:3030"
        echo "✅ Gravity Hub started in Docker (127.0.0.1:3030)."
        exit 0
    fi
fi

log "startup failed; see backend logs"
echo "❌ Gravity Hub failed to start. See $LOG_FILE"
tail -n 3 "$LOG_FILE" 2>/dev/null
exit 1
