#!/bin/zsh
# Sync the local vault, stage only vault-managed files, then commit and push.
# This never touches the Raycast cache or Social Companion download folder.
set -euo pipefail

vault="/Users/paranjay/Developer/personal-wiki-vault"
sync_script="/Users/paranjay/Developer/iftt/raycast-ext/scripts/clipboard-vault-sync.ts"

if [[ ! -d "$vault/.git" ]]; then
  print -u2 "Vault Git repository is missing: $vault"
  exit 1
fi

bun "$sync_script"
cd "$vault"
git add -- .gitignore AGENTS.md README.md log.md raw generated wiki

if git diff --cached --quiet; then
  print "Vault is already backed up; no managed changes to commit."
  exit 0
fi

git commit -m "vault: backup $(date '+%Y-%m-%d %H:%M')"
git push
print "Vault synced, committed, and pushed."
