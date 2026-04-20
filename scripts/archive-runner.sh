#!/bin/bash

# 🪐 Gravity Archive: Standalone Runner
# This script manages the clipboard watcher independently.

PROJECT_DIR="/Users/paranjay/Developer/iftt"
BUN_BIN="/Users/paranjay/.bun/bin/bun"
LOG_PATH="/tmp/gravity-archive.log"

case "$1" in
  start)
    echo "📎 Starting Gravity Archive Suite..."
    nohup "$BUN_BIN" "$PROJECT_DIR/src/archive/watcher.ts" >> "$LOG_PATH" 2>&1 &
    nohup "$BUN_BIN" "$PROJECT_DIR/src/archive/server.ts" >> "/tmp/gravity-archive-api.log" 2>&1 &
    echo "✅ Archiver & API are running in background."
    echo "   DB: ~/.gravity/archive.db"
    echo "   API: http://localhost:3031"
    ;;
  stop)
    echo "🛑 Stopping Gravity Archive Suite..."
    pkill -f "watcher.ts"
    pkill -f "server.ts"
    echo "✅ Stopped."
    ;;
  status)
    W_PID=$(pgrep -f "watcher.ts")
    S_PID=$(pgrep -f "server.ts")
    if [ -z "$W_PID" ]; then echo "❌ Watcher is NOT running."; else echo "✅ Watcher is running (PID: $W_PID)"; fi
    if [ -z "$S_PID" ]; then echo "❌ API Server is NOT running."; else echo "✅ API Server is running (PID: $S_PID)"; fi
    ;;
  *)
    echo "Usage: $0 {start|stop|status}"
    exit 1
    ;;
esac
