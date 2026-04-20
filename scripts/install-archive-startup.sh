#!/bin/bash

# 🚀 Gravity Archive: Startup Installer
# Registers the clipboard watcher to start automatically on Mac login.

PLIST_NAME="com.gravity.archive.plist"
PLIST_PATH="$HOME/Library/LaunchAgents/$PLIST_NAME"
PROJECT_DIR="/Users/paranjay/Developer/iftt"
BUN_BIN="/Users/paranjay/.bun/bin/bun"

echo "🛠 Creating LaunchAgent plist..."

cat <<EOF > "$PLIST_PATH"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.gravity.archive</string>
    <key>ProgramArguments</key>
    <array>
        <string>$BUN_BIN</string>
        <string>$PROJECT_DIR/src/archive/watcher.ts</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>WorkingDirectory</key>
    <string>$PROJECT_DIR</string>
    <key>StandardOutPath</key>
    <string>/tmp/gravity-archive.stdout.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/gravity-archive.stderr.log</string>
</dict>
</plist>
EOF

chmod 644 "$PLIST_PATH"
launchctl unload "$PLIST_PATH" 2>/dev/null
launchctl load "$PLIST_PATH"

echo "✅ Gravity Archive is now installed as a startup service!"
echo "✨ It will start automatically every time you log in."
