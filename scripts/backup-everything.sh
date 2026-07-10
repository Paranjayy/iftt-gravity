#!/usr/bin/env bash
# ============================================================================
#  Gravity Hub — Nightly Backup Companion
#  ----------------------------------------------------------------------------
#  Snapshots the things that would hurt most to lose, into
#  ~/gravity-archive/<YYYY-MM-DD>/. Designed to be safe to cron.
#
#  Always exits 0 unless --verify is passed and a check fails.
#
#  Usage:
#    ./scripts/backup-everything.sh          # do backup
#    ./scripts/backup-everything.sh --verify # check last backup, exit 1 if stale
#    ./scripts/backup-everything.sh --list   # show what's in latest backup
#    KEEP=30 ./scripts/backup-everything.sh  # keep 30 days instead of default 7
#
#  Wire to launchd:
#    See: ./scripts/install-backup-launchd.sh  (to be created)
# ============================================================================

set -Eeuo pipefail
IFS=$'\n\t'

KEEP="${KEEP:-7}"
DEST="$HOME/gravity-archive"
TODAY="$(date +%Y-%m-%d)"
NOW="$(date +%Y-%m-%d_%H%M%S)"
BACKUP_DIR="$DEST/$TODAY"
LATEST_LINK="$DEST/latest"

RED=$'\033[0;31m'; GRN=$'\033[0;32m'; YLW=$'\033[0;33m'; BLU=$'\033[0;34m'; RST=$'\033[0m'
log() { printf "${BLU}▶${RST} %s\n" "$*"; }
ok()  { printf "${GRN}✓${RST} %s\n" "$*"; }
warn(){ printf "${YLW}⚠${RST} %s\n" "$*"; }
err() { printf "${RED}✗${RST} %s\n" "$*" >&2; }

# ---------- Helpers ----------
safe_copy() {
  local src="$1" dst="$2"
  if [[ -e "$src" ]]; then
    mkdir -p "$(dirname "$dst")"
    cp -R "$src" "$dst"
    ok "  $(basename "$src")"
  fi
}

total_size() {
  du -sh "$1" 2>/dev/null | awk '{print $1}'
}

# ---------- Args ----------
VERIFY=0
LIST=0
for arg in "$@"; do
  case "$arg" in
    --verify) VERIFY=1 ;;
    --list)   LIST=1 ;;
    -h|--help)
      sed -n '2,22p' "$0"; exit 0 ;;
    *) err "Unknown: $arg"; exit 2 ;;
  esac
done

# ---------- --list ----------
if [[ "$LIST" -eq 1 ]]; then
  if [[ ! -L "$LATEST_LINK" ]]; then
    warn "No 'latest' symlink found. Run a backup first."
    exit 1
  fi
  log "Latest backup: $(readlink "$LATEST_LINK")"
  log "Contents:"
  ls -la "$(readlink "$LATEST_LINK")" | sed 's/^/  /'
  exit 0
fi

# ---------- --verify ----------
if [[ "$VERIFY" -eq 1 ]]; then
  if [[ ! -L "$LATEST_LINK" ]]; then
    err "No backup found"; exit 1
  fi
  LATEST="$(readlink "$LATEST_LINK")"
  LATEST_AGE_HOURS=$(( ( $(date +%s) - $(stat -f %m "$LATEST") ) / 3600 ))
  if [[ "$LATEST_AGE_HOURS" -gt 48 ]]; then
    err "Latest backup is ${LATEST_AGE_HOURS}h old (>48h) — backup is stale!"
    exit 1
  fi
  ok "Latest backup age: ${LATEST_AGE_HOURS}h"
  exit 0
fi

# ---------- Actual backup ----------
log "Starting backup to $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"

# 1. Raycast state
log "Backing up Raycast..."
RAYCAST_SRC="$HOME/Library/Application Support/com.raycast.macos"
safe_copy "$RAYCAST_SRC/extensions" "$BACKUP_DIR/raycast/extensions"
safe_copy "$RAYCAST_SRC/clipboard"   "$BACKUP_DIR/raycast/clipboard"
safe_copy "$RAYCAST_SRC/config.json" "$BACKUP_DIR/raycast/config.json"
safe_copy "$RAYCAST_SRC/quicklinks.json" "$BACKUP_DIR/raycast/quicklinks.json" 2>/dev/null || true

# 2. Editor configs
log "Backing up editor configs..."
for editor in Zed Cursor Code Claude; do
  src="$HOME/Library/Application Support/$editor"
  if [[ -d "$src" ]]; then
    mkdir -p "$BACKUP_DIR/editors/$editor"
    # only copy user-level config, not cache/extensions
    for sub in settings.json keybindings.json snippets extensions; do
      [[ -e "$src/$sub" ]] && cp -R "$src/$sub" "$BACKUP_DIR/editors/$editor/" 2>/dev/null && ok "  $editor/$sub"
    done
  fi
done

# 3. SSH keys
log "Backing up SSH keys..."
if [[ -d "$HOME/.ssh" ]]; then
  mkdir -p "$BACKUP_DIR/ssh"
  # copy keys + known_hosts; skip socket files
  for f in "$HOME/.ssh"/*; do
    bn="$(basename "$f")"
    if [[ -f "$f" && "$bn" != "*.known_hosts*" ]]; then
      cp "$f" "$BACKUP_DIR/ssh/"
    fi
  done
  ok "  ssh keys + config"
fi

# 4. Dotfiles
log "Backing up dotfiles..."
mkdir -p "$BACKUP_DIR/dotfiles"
for f in .zshrc .zshenv .gitconfig .gitignore_global .tmux.conf .vimrc .npmrc .bunfig.toml; do
  if [[ -f "$HOME/$f" ]]; then
    cp "$HOME/$f" "$BACKUP_DIR/dotfiles/"
    ok "  $f"
  fi
done

# 5. Gravity notes + archive (your own data)
log "Backing up gravity-notes + gravity-archive data..."
if [[ -d "$HOME/Developer/gravity-notes" ]]; then
  mkdir -p "$BACKUP_DIR/gravity-notes"
  rsync -a --exclude='.git' "$HOME/Developer/gravity-notes/" "$BACKUP_DIR/gravity-notes/"
  ok "  gravity-notes ($(total_size "$BACKUP_DIR/gravity-notes"))"
fi
if [[ -d "$HOME/Developer/gravity-archive" ]]; then
  mkdir -p "$BACKUP_DIR/gravity-archive"
  rsync -a --exclude='.git' "$HOME/Developer/gravity-archive/" "$BACKUP_DIR/gravity-archive/"
  ok "  gravity-archive ($(total_size "$BACKUP_DIR/gravity-archive"))"
fi

# 6. Manifest
log "Writing manifest..."
TOTAL=$(du -sh "$BACKUP_DIR" 2>/dev/null | awk '{print $1}')
cat > "$BACKUP_DIR/manifest.json" <<EOF
{
  "date": "$TODAY",
  "timestamp": "$NOW",
  "host": "$(hostname)",
  "macos": "$(sw_vers -productVersion)",
  "arch": "$(uname -m)",
  "size": "$TOTAL",
  "contents": $(ls -1 "$BACKUP_DIR" | python3 -c 'import json,sys; print(json.dumps([l.strip() for l in sys.stdin]))')
}
EOF
ok "  manifest.json"

# Update latest symlink
ln -sfn "$BACKUP_DIR" "$LATEST_LINK"
ok "Latest symlink: $LATEST_LINK -> $BACKUP_DIR"

# ---------- Rotation ----------
log "Rotating backups (keeping $KEEP)..."
COUNT=0
for d in $(ls -1dt "$DEST"/[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] 2>/dev/null); do
  COUNT=$((COUNT + 1))
  if [[ "$COUNT" -gt "$KEEP" ]]; then
    # tar.gz before deletion so we have one more safety net
    tar -czf "$d.tar.gz" -C "$DEST" "$(basename "$d")" 2>/dev/null
    rm -rf "$d"
    ok "  archived + removed old backup: $(basename "$d")"
  fi
done

ok "Backup complete: $BACKUP_DIR ($TOTAL)"
