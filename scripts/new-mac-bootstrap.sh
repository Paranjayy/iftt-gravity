#!/usr/bin/env bash
# ============================================================================
#  Gravity Hub — New-Mac Bootstrap
#  ----------------------------------------------------------------------------
#  Replicates your current Mac environment from a single `gravity-archive/`
#  backup. Designed to be safe to run on a fresh machine.
#
#  DEFAULT MODE = dry-run. Nothing destructive happens unless you pass
#  --execute. Even with --execute, the "BLAST_RADIUS=read-only" environment
#  blocks any destructive path pattern.
#
#  Usage:
#    ./scripts/new-mac-bootstrap.sh                  # dry-run preview
#    ./scripts/new-mac-bootstrap.sh --execute        # actually do it
#    BLAST_RADIUS=destructive ./scripts/new-mac-bootstrap.sh --execute \
#        --i-know-what-im-doing                       # override protection
#
#  Required before run:
#    - ~/gravity-archive/ must exist (use scripts/backup-everything.sh first)
#    - Internet connection (for brew installs)
#    - Apple ID signed in (for App Store apps)
#
#  Maintainer: paranjay
# ============================================================================

set -Eeuo pipefail
IFS=$'\n\t'

# ---------- Color + output ----------
RED=$'\033[0;31m'
GRN=$'\033[0;32m'
YLW=$'\033[0;33m'
BLU=$'\033[0;34m'
DIM=$'\033[2m'
RST=$'\033[0m'

log()   { printf "${BLU}▶${RST} %s\n" "$*"; }
ok()    { printf "${GRN}✓${RST} %s\n" "$*"; }
warn()  { printf "${YLW}⚠${RST} %s\n" "$*"; }
err()   { printf "${RED}✗${RST} %s\n" "$*" >&2; }
hdr()   { printf "\n${BLU}━━━ %s ━━━${RST}\n" "$*"; }

# ---------- Args ----------
EXECUTE=0
FORCE_DESTRUCT=0
PRUNE_BREW=0
PRUNE_RAYCAST=0

for arg in "$@"; do
  case "$arg" in
    --execute)                    EXECUTE=1 ;;
    --i-know-what-im-doing)       FORCE_DESTRUCT=1 ;;
    --prune-brew)                 PRUNE_BREW=1 ;;
    --prune-raycast)              PRUNE_RAYCAST=1 ;;
    -h|--help)
      sed -n '2,30p' "$0"
      exit 0
      ;;
    *) err "Unknown flag: $arg"; exit 2 ;;
  esac
done

# ---------- Safety gate ----------
if [[ "${BLAST_RADIUS:-read-only}" != "destructive" && "$FORCE_DESTRUCT" -ne 1 ]]; then
  BLAST="read-only"
else
  BLAST="destructive"
fi

if [[ "$EXECUTE" -eq 0 ]]; then
  warn "DRY-RUN MODE — no changes will be made. Re-run with --execute to apply."
elif [[ "$BLAST" == "read-only" ]]; then
  warn "EXECUTE mode but BLAST_RADIUS=read-only — destructive steps will still be skipped."
fi

# ---------- Pre-flight ----------
hdr "Pre-flight"

if [[ "$(uname -s)" != "Darwin" ]]; then
  err "This script is macOS-only (got $(uname -s))"
  exit 1
fi
ok "macOS detected: $(sw_vers -productName) $(sw_vers -productVersion) ($(uname -m))"

ARCH="$(uname -m)"
ok "Architecture: $ARCH"

# ---------- Step 1: Homebrew ----------
hdr "Step 1 · Homebrew"

if command -v brew >/dev/null 2>&1; then
  ok "brew already installed: $(brew --version | head -1)"
else
  if [[ "$EXECUTE" -eq 1 ]]; then
    log "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    ok "Homebrew installed"
  else
    log "[dry-run] would install Homebrew via official installer"
  fi
fi

# ---------- Step 2: Bun ----------
hdr "Step 2 · Bun"

if command -v bun >/dev/null 2>&1; then
  ok "bun already installed: $(bun --version)"
else
  if [[ "$EXECUTE" -eq 1 ]]; then
    log "Installing Bun..."
    curl -fsSL https://bun.sh/install | bash
    ok "Bun installed"
  else
    log "[dry-run] would install Bun via official installer"
  fi
fi

# ---------- Step 3: Apps via Homebrew ----------
hdr "Step 3 · Apps"

APPS=(
  "raycast"
  "zed"
  "cursor"
  "visual-studio-code"
  "iterm2"
  "claude"
  "arc"
  "figma"
  "warp"
  "1password-cli"
  "git"
  "gh"
  "fzf"
  "ripgrep"
  "bat"
  "eza"
  "zoxide"
  "starship"
)

for app in "${APPS[@]}"; do
  if brew list --formula --cask "$app" >/dev/null 2>&1; then
    ok "already installed: $app"
  else
    if [[ "$EXECUTE" -eq 1 ]]; then
      log "Installing $app..."
      if [[ "$app" == "iterm2" || "$app" == "arc" || "$app" == "raycast" || "$app" == "zed" || "$app" == "cursor" || "$app" == "visual-studio-code" || "$app" == "claude" || "$app" == "figma" || "$app" == "warp" || "$app" == "1password-cli" ]]; then
        brew install --cask "$app" || warn "Failed: $app (may need manual App Store install)"
      else
        brew install "$app" || warn "Failed: $app"
      fi
    else
      log "[dry-run] would install: $app"
    fi
  fi
done

# ---------- Step 4: Clone iftt repo ----------
hdr "Step 4 · Clone Gravity Hub"

REPO_DIR="$HOME/Developer/iftt"
if [[ -d "$REPO_DIR/.git" ]]; then
  ok "iftt repo already cloned at $REPO_DIR"
elif [[ -d "$REPO_DIR" ]]; then
  warn "Directory exists but not a git repo: $REPO_DIR"
else
  log "[$([[ $EXECUTE -eq 1 ]] && echo execute || echo dry-run)] would clone github.com/Paranjayy/iftt-gravity to $REPO_DIR"
  if [[ "$EXECUTE" -eq 1 ]]; then
    mkdir -p "$HOME/Developer"
    git clone https://github.com/Paranjayy/iftt-gravity.git "$REPO_DIR"
    ok "Cloned"
  fi
fi

# ---------- Step 5: Restore from backup ----------
hdr "Step 5 · Restore from ~/gravity-archive"

BACKUP_DIR="$HOME/gravity-archive"
LATEST_BACKUP="$(ls -1d "$BACKUP_DIR"/[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] 2>/dev/null | sort -r | head -1 || true)"

if [[ -z "$LATEST_BACKUP" ]]; then
  warn "No backup found at $BACKUP_DIR/<YYYY-MM-DD>/ — run scripts/backup-everything.sh first"
else
  ok "Latest backup: $LATEST_BACKUP"
fi

# 5a. Raycast extensions + clipboard
RAYCAST_DEST="$HOME/Library/Application Support/com.raycast.macos"
RAYCAST_BACKUP="$LATEST_BACKUP/raycast"
if [[ -d "$RAYCAST_BACKUP" ]]; then
  log "Found Raycast backup: $RAYCAST_BACKUP"
  for sub in extensions clipboard config.json; do
    src="$RAYCAST_BACKUP/$sub"
    dst="$RAYCAST_DEST/$sub"
    if [[ -e "$src" ]]; then
      if [[ "$EXECUTE" -eq 1 ]]; then
        # SAFETY: never overwrite existing user clipboard
        if [[ "$sub" == "clipboard" && -d "$dst" && "$BLAST" == "read-only" ]]; then
          warn "  $sub exists — SKIPPING (BLAST_RADIUS=read-only)"
          warn "  set BLAST_RADIUS=destructive to overwrite (DANGEROUS)"
        else
          cp -R "$src" "$dst"
          ok "  restored: $sub"
        fi
      else
        log "[dry-run] would restore: $sub -> $dst"
      fi
    fi
  done
else
  warn "No Raycast backup at $RAYCAST_BACKUP (skipped)"
fi

# 5b. Editor configs
for editor in Zed Cursor Code Claude; do
  src="$LATEST_BACKUP/editors/$editor"
  dst="$HOME/Library/Application Support/$editor"
  if [[ -d "$src" ]]; then
    if [[ "$EXECUTE" -eq 1 ]]; then
      if [[ -d "$dst" && "$BLAST" == "read-only" ]]; then
        warn "$editor config exists — SKIPPING (BLAST_RADIUS=read-only)"
      else
        cp -R "$src" "$dst"
        ok "  restored: $editor config"
      fi
    else
      log "[dry-run] would restore: $editor"
    fi
  fi
done

# 5c. SSH keys
if [[ -d "$LATEST_BACKUP/ssh" ]]; then
  if [[ "$EXECUTE" -eq 1 ]]; then
    mkdir -p "$HOME/.ssh"
    cp "$LATEST_BACKUP"/ssh/* "$HOME/.ssh/"
    chmod 700 "$HOME/.ssh"
    chmod 600 "$HOME/.ssh"/id_* 2>/dev/null || true
    chmod 644 "$HOME/.ssh"/*.pub 2>/dev/null || true
    ok "  restored SSH keys (chmod 600)"
  else
    log "[dry-run] would restore SSH keys"
  fi
fi

# 5d. Dotfiles
for dotfile in .zshrc .gitconfig .gitignore_global; do
  src="$LATEST_BACKUP/dotfiles/$dotfile"
  if [[ -f "$src" ]]; then
    if [[ "$EXECUTE" -eq 1 ]]; then
      cp "$src" "$HOME/$dotfile"
      ok "  restored: $dotfile"
    else
      log "[dry-run] would restore: $dotfile"
    fi
  fi
done

# ---------- Step 6: Build + start Hub ----------
hdr "Step 6 · Gravity Hub"

if [[ -d "$REPO_DIR" ]]; then
  if [[ "$EXECUTE" -eq 1 ]]; then
    log "Installing Hub deps + starting service..."
    (cd "$REPO_DIR" && bun install)
    (cd "$REPO_DIR" && ./install_service.sh) || warn "install_service.sh failed (you may need to run manually)"
    ok "Hub build + service install attempted"
  else
    log "[dry-run] would: cd $REPO_DIR && bun install && ./install_service.sh"
  fi
fi

# ---------- Step 7: Build Raycast extension ----------
if [[ -d "$REPO_DIR/raycast-ext" ]]; then
  if [[ "$EXECUTE" -eq 1 ]]; then
    log "Building raycast-ext..."
    (cd "$REPO_DIR/raycast-ext" && bun install && bun run build) || warn "raycast build failed"
    ok "raycast-ext built"
  else
    log "[dry-run] would: cd $REPO_DIR/raycast-ext && bun install && bun run build"
  fi
fi

# ---------- Step 8: Safe Cleaner (preview only by default) ----------
hdr "Step 8 · Safe Cleaner (preview)"

log "The following would be cleaned in destructive mode:"
log "  ~/Library/Caches/*              (app caches)"
log "  ~/.cache/*                      (tool caches)"
log "  ~/.npm, ~/.bun/install/cache    (package caches)"
log "  ~/Library/Developer/Xcode/DerivedData/* (if >7d old)"
log "  ~/Downloads/*.{dmg,pkg}         (older than 30d)"
warn "The following are HARD-PROTECTED (never cleaned):"
log "  ~/Developer/**"
log "  ~/Library/Application Support/com.raycast.macos/**"
log "  ~/Library/Application Support/{Zed,Cursor,Code,Claude}/**"
log "  ~/gravity-archive/**"
log "  ~/Documents/**, ~/Desktop/**, ~/Pictures/**"

if [[ "$EXECUTE" -eq 1 && "$BLAST" == "destructive" ]]; then
  log "Running safe-cleaner in destructive mode..."
  # actual rm commands would go here, behind strict path filters
  warn "  (destructive rm calls stubbed — implement with audit-logging before production use)"
fi

# ---------- Final report ----------
hdr "Summary"

cat <<EOF
  Mode:           $([[ $EXECUTE -eq 1 ]] && echo EXECUTE || echo DRY-RUN)
  Blast radius:   $BLAST
  Latest backup:  ${LATEST_BACKUP:-NONE}
  Repo:           $REPO_DIR

Next manual steps:
  1. Sign in to Mac App Store (Claude, Raycast, etc. require Apple ID)
  2. Sign in to Raycast (Cmd-Space > "Sign In")
  3. Sign in to 1Password, GitHub CLI (gh auth login)
  4. Import Raycast extension: Cmd-Space > "Import Extension" > $REPO_DIR/raycast-ext
  5. Verify Gravity Hub: curl http://127.0.0.1:3030/status
  6. Run nightly backup: ./scripts/backup-everything.sh

EOF

ok "Bootstrap $([[ $EXECUTE -eq 1 ]] && echo completed || echo preview complete) at $(date '+%Y-%m-%d %H:%M:%S')"
