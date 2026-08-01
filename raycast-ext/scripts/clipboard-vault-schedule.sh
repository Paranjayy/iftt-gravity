#!/bin/zsh
# Installs or removes an optional hourly launchd job. It is never installed by sync.
set -eu

label="com.iftt.clipboard-vault"
agent="$HOME/Library/LaunchAgents/$label.plist"
script="/Users/paranjay/Developer/iftt/raycast-ext/scripts/clipboard-vault-sync.ts"

case "${1:-}" in
  enable)
    mkdir -p "$HOME/Library/LaunchAgents"
    cat > "$agent" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$label</string>
  <key>ProgramArguments</key><array><string>/opt/homebrew/bin/bun</string><string>$script</string></array>
  <key>StartInterval</key><integer>3600</integer>
  <key>RunAtLoad</key><false/>
  <key>StandardOutPath</key><string>/tmp/clipboard-vault-sync.log</string>
  <key>StandardErrorPath</key><string>/tmp/clipboard-vault-sync.error.log</string>
</dict></plist>
PLIST
    launchctl bootout "gui/$(id -u)" "$agent" 2>/dev/null || true
    launchctl bootstrap "gui/$(id -u)" "$agent"
    echo "Enabled hourly Clipboard Vault sync."
    ;;
  disable)
    launchctl bootout "gui/$(id -u)" "$agent" 2>/dev/null || true
    rm -f "$agent"
    echo "Disabled Clipboard Vault sync."
    ;;
  *)
    echo "Usage: $0 {enable|disable}" >&2
    exit 64
    ;;
esac
