#!/bin/bash
# Absolute Start Script to bypass all shell aliases

# Force clear alias if it exists
unalias next 2>/dev/null
unalias node 2>/dev/null

echo "Starting Next.js..."
# Use absolute path to the node binary that bun provides, or the system node
NODE_BIN=$(which node 2>/dev/null)
if [ -z "$NODE_BIN" ]; then
  NODE_BIN=$(which bun 2>/dev/null)
fi

echo "Using node/bun bin: $NODE_BIN"
exec "$NODE_BIN" ./node_modules/next/dist/bin/next dev
