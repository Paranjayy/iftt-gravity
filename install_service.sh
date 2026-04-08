#!/bin/bash
# 🪐 Gravity: 24/7 Persistence Installer

PLIST_NAME="com.gravity.hub.plist"
PLIST_PATH="$HOME/Library/LaunchAgents/$PLIST_NAME"
HUB_DIR="/Users/paranjay/Developer/iftt"

echo "🌌 Gravity: Establishing God Mode Persistence..."

cat <<EOF > "$PLIST_PATH"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.gravity.hub</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/bun</string>
        <string>run</string>
        <string>src/lib/bot.ts</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$HUB_DIR</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/gravity-stdout.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/gravity-stderr.log</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    </dict>
</dict>
</plist>
EOF

echo "🚀 Loading Hub Agent..."
launchctl unload "$PLIST_PATH" 2>/dev/null
launchctl load "$PLIST_PATH"

echo "✅ Gravity is now a System Service! It will start automatically on login and run 24/7."
echo "📜 View logs via: tail -f /tmp/gravity-stdout.log"
