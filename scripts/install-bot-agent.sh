#!/bin/bash
# =============================================================
# Gravity Bot — macOS LaunchAgent Installer
# Auto-starts bot on login, auto-restarts on crash
# =============================================================

PLIST_NAME="com.gravity.bot"
PLIST_PATH="$HOME/Library/LaunchAgents/$PLIST_NAME.plist"
BOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BUN_PATH="$(which bun)"
LOG_DIR="$HOME/Library/Logs/Gravity"

mkdir -p "$LOG_DIR"

cat > "$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$PLIST_NAME</string>

    <key>ProgramArguments</key>
    <array>
        <string>$BUN_PATH</string>
        <string>src/lib/bot.ts</string>
    </array>

    <key>WorkingDirectory</key>
    <string>$BOT_DIR</string>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <true/>

    <key>StandardOutPath</key>
    <string>$LOG_DIR/bot.log</string>

    <key>StandardErrorPath</key>
    <string>$LOG_DIR/bot.error.log</string>

    <key>ThrottleInterval</key>
    <integer>10</integer>
</dict>
</plist>
EOF

# Load it
launchctl unload "$PLIST_PATH" 2>/dev/null
launchctl load -w "$PLIST_PATH"

echo ""
echo "✅ Gravity Bot LaunchAgent installed!"
echo "   → Bot starts automatically on login"
echo "   → Bot restarts automatically on crash"
echo ""
echo "📋 Useful commands:"
echo "   Start:   launchctl start $PLIST_NAME"
echo "   Stop:    launchctl stop $PLIST_NAME"
echo "   Logs:    tail -f $LOG_DIR/bot.log"
echo "   Remove:  launchctl unload $PLIST_PATH && rm $PLIST_PATH"
