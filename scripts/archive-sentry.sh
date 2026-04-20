#!/bin/bash

# 🪐 Gravity Archive Sentry
# Monitors clipboard in the background
# Usage: ./scripts/archive-sentry.sh

echo "📋 Starting Clipboard Archive Sentry..."
while true; do
  CLIP=$(pbpaste)
  if [ "$CLIP" != "$LAST_CLIP" ]; then
    if [ ${#CLIP} -gt 3 ]; then
       # Call the Gravity Archive API to store
       curl -s -X POST "http://localhost:3030/archive/add" \
            -H "Content-Type: application/json" \
            -d "{\"text\": \"$CLIP\"}" > /dev/null
       echo "📎 Captured: ${CLIP:0:30}..."
       LAST_CLIP=$CLIP
    fi
  fi
  sleep 2
done
