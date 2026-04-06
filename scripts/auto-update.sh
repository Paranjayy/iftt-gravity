#!/bin/bash
# =============================================================
# Gravity Bot — Auto-Update Script
# Polls GitHub every 5 minutes, pulls new code, restarts bot
# =============================================================
# Usage: bash scripts/auto-update.sh
# To install as a cron job:
#   crontab -e
#   */5 * * * * /bin/bash /path/to/iftt/scripts/auto-update.sh >> ~/Library/Logs/Gravity/autoupdate.log 2>&1
# =============================================================

BOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG="$HOME/Library/Logs/Gravity/autoupdate.log"
mkdir -p "$(dirname "$LOG")"

cd "$BOT_DIR" || exit 1

# Get current commit hash before pull
BEFORE=$(git rev-parse HEAD 2>/dev/null)

# Fetch latest from origin silently
git fetch origin master --quiet 2>/dev/null

# Get latest remote commit
AFTER=$(git rev-parse origin/master 2>/dev/null)

# Only restart if there's actually new code
if [ "$BEFORE" != "$AFTER" ]; then
  TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
  echo "[$TIMESTAMP] 🔄 New code detected: $BEFORE → $AFTER" | tee -a "$LOG"
  
  # Pull the new code
  git pull origin master --quiet 2>&1 | tee -a "$LOG"
  
  # Restart the bot
  echo "[$TIMESTAMP] 🔁 Restarting Gravity Bot..." | tee -a "$LOG"
  pkill -f "src/lib/bot.ts" 2>/dev/null
  sleep 2
  
  BUN_PATH=$(which bun)
  nohup "$BUN_PATH" src/lib/bot.ts >> "$HOME/Library/Logs/Gravity/bot.log" 2>&1 &
  
  echo "[$TIMESTAMP] ✅ Bot restarted with PID $!" | tee -a "$LOG"
else
  # No update — silent (don't spam logs)
  exit 0
fi
