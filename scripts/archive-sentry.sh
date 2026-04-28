#!/bin/bash

# 🪐 Gravity Archive Sentry
# Monitors clipboard in the background
# Usage: ./scripts/archive-sentry.sh

echo "🪐 Gravity Archive Sentry: Launching Protocol..."
# The main logic is now handled by archive.ts which has length safety and timeouts.
bun src/lib/archive.ts
