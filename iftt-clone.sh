#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Gravity Hub Start
# @raycast.mode compact
# @raycast.packageName Gravity Tools

# Optional parameters:
# @raycast.icon 🪐
# @raycast.currentDirectoryPath /Users/paranjay/Developer/iftt

# Documentation:
# @raycast.description Purge and Restart the Gravity Hub & Archive.
# @raycast.author antigravity

BUN="/Users/paranjay/.bun/bin/bun"
ROOT="/Users/paranjay/Developer/iftt"
WEB_LOG="/tmp/gravity-web.log"
BOT_LOG="/tmp/gravity-bot.log"
ARCHIVE_LOG="/tmp/gravity-archive.log"

wait_for_port() {
  local port="$1"
  local attempts=30
  while [ "$attempts" -gt 0 ]; do
    if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
    attempts=$((attempts - 1))
  done
  return 1
}

launch_detached() {
  local log_file="$1"
  shift
  nohup "$@" > "$log_file" 2>&1 < /dev/null &
}

# Argument Handling for Standalone Boot
if [ "$1" == "archive" ]; then
  echo "📦 Gravity: Launching Archive Sentry alone..."
  ps aux | grep "src/lib/archive.ts" | grep -v grep | awk '{print $2}' | xargs kill -9 2>/dev/null
  launch_detached "$ARCHIVE_LOG" "$BUN" src/lib/archive.ts
  echo "✅ Archive Sentry is now live (Port 3031)."
  exit 0
fi

# Rebuild the extension to bake in latest logic/UI
echo "⚒️ Gravity: Syncing Archive UI..."
cd "$ROOT/raycast-ext" && $BUN run build > /dev/null 2>&1

# Evict any existing process on 3000, 3030 and 3031 surgically
echo "☢️ Gravity: Purging active pulses..."
for port in 3000 3030 3031; do
  PIDS=$(lsof -t -i:$port)
  if [ ! -z "$PIDS" ]; then
    echo "  ↳ Stopping stragglers on Port $port: $PIDS"
    echo $PIDS | xargs kill -9 2>/dev/null
  fi
done
ps aux | grep -E "src/lib/bot.ts|src/lib/archive.ts|next dev" | grep -v grep | awk '{print $2}' | xargs kill -9 2>/dev/null
sleep 1

# Launch the Full Gravity Stack
echo "🟢 Gravity: Launching Web, Heart & Archive..."
cd "$ROOT"

# Spawn the Next.js app
echo "  ↳ 🌐 Gravity Web shell engaged."
launch_detached "$WEB_LOG" "$BUN" run dev

# Spawn as detached background processes with logging
echo "  ↳ 📂 Gravity Archive engaged."
launch_detached "$ARCHIVE_LOG" "$BUN" src/lib/archive.ts

echo "  ↳ 📂 Gravity Hub ambassador live."
launch_detached "$BOT_LOG" "$BUN" src/lib/bot.ts

sleep 4
# Final Pulse Check
if wait_for_port 3000 && wait_for_port 3030 && wait_for_port 3031; then
  echo "✅ Gravity Hub Restoration: SUCCESS."
else
  echo "❌ Gravity Boot Failed."
  echo "🌐 Web Error: $(tail -n 1 "$WEB_LOG")"
  echo "🤖 Bot Error: $(tail -n 1 "$BOT_LOG")"
  exit 1
fi
