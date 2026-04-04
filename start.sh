#!/bin/bash
# Gravity IFTTT - Start Script
# Works on macOS, Linux, Windows (WSL)
# Cross-platform dev server launcher

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 Starting Gravity IFTTT Dashboard..."
echo "📂 Working from: $SCRIPT_DIR"

# Try bun first, then npm, then npx
if command -v bun &> /dev/null; then
  echo "✅ Found Bun! Setting up local environment shims..."
  # Turbopack needs a binary explicitly named 'node' to spawn asset-processing workers.
  BUN_PATH=$(which bun)
  mkdir -p .bin
  ln -sf "$BUN_PATH" .bin/node
  export PATH="$PWD/.bin:/usr/local/bin:/opt/homebrew/bin:$PATH"
  
  # Launch the server using our hidden binary to stay bypass Opencode
  bun ./node_modules/next/dist/bin/start_app dev -p 3002
elif command -v npm &> /dev/null; then
  echo "✅ Using npm..."
  npm run dev
elif command -v npx &> /dev/null; then
  echo "✅ Using npx..."
  npx next dev
else
  echo "❌ No package manager found. Please install Node.js or Bun."
  exit 1
fi
