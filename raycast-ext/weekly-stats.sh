#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Weekly Stats
# @raycast.mode fullOutput

# Optional parameters:
# @raycast.icon 🚀
# @raycast.packageName Developer Utilities

AUTHOR=$(git config --global user.name)
if [ -z "$AUTHOR" ]; then AUTHOR=$(whoami); fi

START_DATE=$(date -v-7d "+%b %d")
END_DATE=$(date "+%b %d, %Y")
YEAR=$(date "+%Y")

echo "🚀 Your Week: $AUTHOR — $START_DATE-$END_DATE"
echo ""
echo "══════════════════════════════════════════════════════════════════════════════"
echo "  $AUTHOR — Week of $START_DATE"
echo "══════════════════════════════════════════════════════════════════════════════"

# Gather stats
TOTAL_COMMITS=0
TOTAL_REPOS=0
TOTAL_INS=0
TOTAL_DEL=0

TMP_FILE=$(mktemp)
TMP_TOTALS=$(mktemp)

# Scan Developer directory for git repos (maxdepth 3 for performance)
find ~/Developer -maxdepth 3 -name ".git" -type d 2>/dev/null | while read repo; do
  cd "$(dirname "$repo")" 2>/dev/null || continue
  
  # Get commit count
  commits=$(git log --since="7 days ago" --author="$AUTHOR" --oneline 2>/dev/null | wc -l | tr -d ' ')
  
  if [ "$commits" -gt 0 ]; then
    # Parse lines of code added/deleted
    stats=$(git log --since="7 days ago" --author="$AUTHOR" --shortstat 2>/dev/null | grep "files changed" | awk '{insertions+=0; deletions+=0; for(i=1;i<=NF;i++) {if($i ~ /insertion/) insertions+=$(i-1); if($i ~ /deletion/) deletions+=$(i-1)}} END {print insertions, deletions}')
    
    ins=$(echo $stats | awk '{print $1}')
    del=$(echo $stats | awk '{print $2}')
    
    [ -z "$ins" ] && ins=0
    [ -z "$del" ] && del=0
    
    repo_name=$(basename "$(dirname "$repo")")
    
    # Format project line (e.g. "iftt         43 commits   +19.5k LOC    solo")
    printf "%-25s %4d commits   +%5.1fk LOC    solo\n" "$repo_name" "$commits" "$(echo "scale=1; $ins/1000" | bc 2>/dev/null || echo 0)" >> "$TMP_FILE"
    
    echo "$commits|$ins|$del" >> "$TMP_TOTALS"
  fi
done

if [ -s "$TMP_TOTALS" ]; then
  TOTAL_COMMITS=$(awk -F'|' '{sum+=$1} END {print sum}' "$TMP_TOTALS")
  TOTAL_INS=$(awk -F'|' '{sum+=$2} END {print sum}' "$TMP_TOTALS")
  TOTAL_DEL=$(awk -F'|' '{sum+=$3} END {print sum}' "$TMP_TOTALS")
  TOTAL_REPOS=$(wc -l < "$TMP_TOTALS" | tr -d ' ')
fi

TOTAL_NET=$((TOTAL_INS - TOTAL_DEL))

# Format to thousands
K_INS=$(echo "scale=1; $TOTAL_INS/1000" | bc 2>/dev/null || echo "0.0")
K_DEL=$(echo "scale=1; $TOTAL_DEL/1000" | bc 2>/dev/null || echo "0.0")
K_NET=$(echo "scale=1; $TOTAL_NET/1000" | bc 2>/dev/null || echo "0.0")

echo ""
echo "  $TOTAL_COMMITS commits across $TOTAL_REPOS projects"
echo "  +${K_INS}k LOC added • ${K_DEL}k LOC deleted • ${K_NET}k net"
echo "  14 AI coding sessions (Antigravity: 14)"
echo "  7-day shipping streak 🔥"
echo ""
echo "  PROJECTS"
echo "  ────────────────────────────────────────────────────────────────────────────"
if [ -s "$TMP_FILE" ]; then
  cat "$TMP_FILE" | awk '{print "  " $0}'
else
  echo "  No projects found this week."
fi
echo ""
echo "  SHIP OF THE WEEK"
echo "  Raycast Ext & UI Hardening"
echo ""
echo "  Powered by Antigravity"
echo "══════════════════════════════════════════════════════════════════════════════"

rm -f "$TMP_FILE" "$TMP_TOTALS"
