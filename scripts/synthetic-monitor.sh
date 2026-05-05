#!/bin/bash

# Gravity Synthetic Monitor 🧬
# Verifies the integrity of the Gravity ecosystem.

LOG_FILE="/tmp/gravity-monitor.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

echo "[$TIMESTAMP] Starting Synthetic Pulse Check..." > $LOG_FILE

# 1. Check Bot (3030)
BOT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3030/status)
if [ "$BOT_STATUS" == "200" ]; then
    echo "✅ Bot API: Online (200)" >> $LOG_FILE
else
    echo "❌ Bot API: OFFLINE ($BOT_STATUS)" >> $LOG_FILE
    # Potentially restart bot here if needed
fi

# 2. Check Archive (3031)
ARCH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3031/)
if [ "$ARCH_STATUS" == "200" ]; then
    echo "✅ Archive API: Online (200)" >> $LOG_FILE
else
    echo "❌ Archive API: OFFLINE ($ARCH_STATUS)" >> $LOG_FILE
fi

# 3. Check Data Integrity
CLIPS_JSON=$(curl -s http://localhost:3031/archive)
if [[ $CLIPS_JSON == \[* ]]; then
    echo "✅ Data Integrity: Archive returns valid JSON array" >> $LOG_FILE
else
    echo "❌ Data Integrity: Archive returns INVALID format" >> $LOG_FILE
fi

# 4. Check File Permissions
if [ -w "gravity-archive/clips.json" ]; then
    echo "✅ Filesystem: clips.json is writable" >> $LOG_FILE
else
    echo "❌ Filesystem: clips.json is NOT writable" >> $LOG_FILE
fi

echo "[$TIMESTAMP] Pulse Check Complete." >> $LOG_FILE

cat $LOG_FILE
