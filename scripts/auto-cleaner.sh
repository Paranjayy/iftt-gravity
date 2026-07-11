#!/usr/bin/env bash
# ============================================================================
#  Gravity Hub — Safe Auto-Cleaner
#  ----------------------------------------------------------------------------
#  One-shot cache + temp purge. SAFE by default — never touches:
#    - ~/Developer/**                  (your code, never touch)
#    - ~/Library/Application Support/{Raycast,Zed,Cursor,Code,Claude}/**
#    - ~/gravity-archive/**            (your backups)
#    - ~/Documents/**, ~/Desktop/**, ~/Pictures/**
#
#  DEFAULT MODE = dry-run. Pass --execute to actually delete.
#  Set BLAST_RADIUS=destructive + --i-know-what-im-doing to override.
#
#  Usage:
#    ./scripts/auto-cleaner.sh                    # dry-run preview
#    ./scripts/auto-cleaner.sh --execute          # actually purge safe items
#    ./scripts/auto-cleaner.sh --execute --aggressive  # also purge xcode/sim caches
# ============================================================================

set -Eeuo pipefail

RED=$'\033[0;31m'; GRN=$'\033[0;32m'; YLW=$'\033[0;33m'; BLU=$'\033[0;34m'; RST=$'\033[0m'
log()  { printf "${BLU}▶${RST} %s\n" "$*"; }
ok()   { printf "${GRN}✓${RST} %s\n" "$*"; }
warn() { printf "${YLW}⚠${RST} %s\n" "$*"; }
err()  { printf "${RED}✗${RST} %s\n" "$*" >&2; }

EXECUTE=0
AGGRESSIVE=0
for arg in "$@"; do
  case "$arg" in
    --execute)         EXECUTE=1 ;;
    --aggressive)      AGGRESSIVE=1 ;;
    --i-know-what-im-doing) ;;
    -h|--help)
      sed -n '2,20p' "$0"; exit 0 ;;
    *) err "Unknown: $arg"; exit 2 ;;
  esac
done

if [[ "${BLAST_RADIUS:-read-only}" != "destructive" && $EXECUTE -eq 0 ]]; then
  warn "DRY-RUN MODE — no files will be touched. Re-run with --execute to apply."
fi

# Whitelist of cleanable paths
SAFE_TARGETS=(
  "$HOME/Library/Caches"
  "$HOME/Library/Logs"
  "$HOME/.cache"
  "$HOME/.npm"
  "$HOME/.bun/install/cache"
  "$HOME/Library/Caches/pip"
  "$HOME/Library/Caches/Homebrew"
  "$HOME/Library/Developer/CoreSimulator/Caches"
)

AGGRESSIVE_TARGETS=(
  "$HOME/Library/Developer/Xcode/DerivedData"
  "$HOME/Library/Developer/CoreSimulator/Volumes"
  "$HOME/Library/Containers/com.apple.dt.Xcode"
)

# Hard protection list (NEVER clean these)
PROTECTED=(
  "$HOME/Developer"
  "$HOME/Library/Application Support/com.raycast.macos"
  "$HOME/Library/Application Support/Zed"
  "$HOME/Library/Application Support/Cursor"
  "$HOME/Library/Application Support/Code"
  "$HOME/Library/Application Support/Claude"
  "$HOME/gravity-archive"
  "$HOME/Documents"
  "$HOME/Desktop"
  "$HOME/Pictures"
)

safe_to_clean() {
  local target="$1"
  for prot in "${PROTECTED[@]}"; do
    # realpath comparison to catch symlinks too
    local r_target r_prot
    r_target=$(realpath "$target" 2>/dev/null || echo "$target")
    r_prot=$(realpath "$prot" 2>/dev/null || echo "$prot")
    case "$r_target" in
      "$r_prot"*) return 1 ;;  # target is inside protected
    esac
  done
  return 0  # safe
}

total_size() {
  du -sh "$1" 2>/dev/null | awk '{print $1}'
}

free_before=$(df -h "$HOME" | tail -1 | awk '{print $4}')

log "Auto-Cleaner (mode: $([[ $EXECUTE -eq 1 ]] && echo EXECUTE || echo DRY-RUN))"
log "Free before: $free_before"
log ""

# Header: what we'll scan
log "Scanning ${#SAFE_TARGETS[@]} standard targets + $([[ $AGGRESSIVE -eq 1 ]] && echo ${#AGGRESSIVE_TARGETS[@]} || echo 0) aggressive"
log "Protected (never touched): ${#PROTECTED[@]} paths"
log ""

total_freed=0
for target in "${SAFE_TARGETS[@]}"; do
  if [[ ! -d "$target" ]]; then
    continue
  fi
  if ! safe_to_clean "$target"; then
    err "  SKIP (protected): $target"
    continue
  fi
  size=$(total_size "$target")
  if [[ $EXECUTE -eq 1 ]]; then
    log "  PURGE: $target ($size)"
    # Only delete files inside the cache dir, keep the dir structure
    find "$target" -mindepth 1 -maxdepth 3 -type f -mtime +7 -delete 2>/dev/null || true
    find "$target" -mindepth 1 -maxdepth 3 -type d -empty -delete 2>/dev/null || true
    ok "    done"
  else
    log "  [dry-run] would purge: $target ($size)"
  fi
done

if [[ $AGGRESSIVE -eq 1 ]]; then
  log ""
  log "Aggressive targets (xcode/sim caches):"
  for target in "${AGGRESSIVE_TARGETS[@]}"; do
    if [[ ! -d "$target" ]]; then continue; fi
    if ! safe_to_clean "$target"; then
      err "  SKIP (protected): $target"; continue
    fi
    size=$(total_size "$target")
    if [[ $EXECUTE -eq 1 ]]; then
      log "  PURGE: $target ($size)"
      rm -rf "$target"/* 2>/dev/null || true
      ok "    done"
    else
      log "  [dry-run] would purge: $target ($size)"
    fi
  done
fi

log ""
free_after=$(df -h "$HOME" | tail -1 | awk '{print $4}')
log "Free after: $free_after"

if [[ $EXECUTE -eq 1 ]]; then
  ok "Auto-cleaner complete"
else
  warn "DRY-RUN complete — re-run with --execute to actually purge"
fi
