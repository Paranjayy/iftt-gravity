#!/bin/bash

# Gravity God Mode v2.4 One-Click Hub Launcher
# 🪐 "One Hub to Rule Them All"

PROJECT_DIR="/Users/paranjay/Developer/iftt"
BUN_BIN="/Users/paranjay/.bun/bin/bun"
export PATH="$HOME/.bun/bin:/usr/local/bin:/opt/homebrew/bin:$PATH"

cd "$PROJECT_DIR"
echo "🪐 Gravity Hub: Initializing God Mode..."

# 1. Kill any floating instances
pkill -f "src/lib/bot.ts" 2>/dev/null

# 2. Update dependencies
echo "📦 Refreshing dependencies..."
bun install --silent
cd raycast-ext && bun install --silent && bun run build && cd ..

# 3. Start the Telegram Bot (God Mode Core)
echo "🧠 Starting the Cortex..."
nohup "$BUN_BIN" "$PROJECT_DIR/src/lib/bot.ts" >> /tmp/gravity-bot.log 2>&1 &

# 4. Wait for it to be ready
sleep 4

# 5. Check Heartbeat
if curl -s http://localhost:3030/status > /dev/null; then
  echo "✅ Gravity God Mode v2.4 is ONLINE!"
  echo "📡 Telegram Bot: Ready"
  echo "🌐 Mission Dashboard: http://localhost:3000/dashboard"
  echo "🚀 Mission Control: /system in Telegram"
else
  echo "❌ Gravity Hub failed to start. Check /tmp/gravity-bot.log"
fi
