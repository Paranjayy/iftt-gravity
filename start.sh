#!/bin/bash
# Gravity IFTTT - Start Script
# Works on macOS, Linux, Windows (WSL)
# Cross-platform dev server launcher

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 Starting Gravity IFTTT Dashboard..."
echo "📂 Working from: $SCRIPT_DIR"

# Keep the dashboard and Raycast on the same backend path. The backend
# launcher is idempotent and can use native Bun or Docker when available.
if ! curl -fsS --max-time 1 http://127.0.0.1:3030/ >/dev/null 2>&1; then
  echo "🪐 Starting Gravity Hub backend..."
  "$SCRIPT_DIR/raycast-ext/start-gravity.sh" || exit 1
fi

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
