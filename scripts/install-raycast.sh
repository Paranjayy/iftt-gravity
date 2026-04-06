#!/bin/bash

echo "🌌 Gravity Hub - Raycast Integration Setup"
echo "------------------------------------------"

# Ensure the raycast directory exists
RAYCAST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../raycast" && pwd)"

if [ ! -d "$RAYCAST_DIR" ]; then
    echo "❌ Raycast directory not found at $RAYCAST_DIR"
    exit 1
fi

echo "1️⃣  Making Raycast scripts executable..."
chmod +x "$RAYCAST_DIR"/*.sh
echo "✅ Scripts are now executable."

echo ""
echo "2️⃣  How to install these in Raycast:"
echo "   1. Open Raycast (usually Cmd + Space)"
echo "   2. Type 'Extensions' and hit Enter"
echo "   3. Click the '+' button in the bottom right (or press Cmd+N)"
echo "   4. Select 'Add Script Directory'"
echo "   5. Choose this exact folder:"
echo "      👉 $RAYCAST_DIR"
echo ""
echo "🎉 Done! You can now trigger Gravity directly from Raycast."
echo "Try typing 'Gravity Scene TV' or 'Gravity Status' in Raycast!"
