# Disk Space Analysis

**Disk:** 228GB total, **164MB free (99% full!)** — CRITICAL

---

## Safe to Clean (won't break anything)

| Location | Size | What | Risk |
|----------|------|------|------|
| `~/Library/Caches/com.spotify.client` | 2.0GB | Spotify cache | None — rebuilds automatically |
| `~/Library/Caches/Homebrew` | 1.0GB | Homebrew downloads | None — re-downloads as needed |
| `~/Library/Caches/Arc` | 644MB | Arc browser cache | None |
| `~/Library/Caches/com.google.antigravity` | 318MB | Google updater cache | None |
| `~/Library/Caches/antigravity-updater` | 316MB | Google updater cache | None |
| `~/Library/Caches/t3code-updater` | 294MB | T3 Code updater | None |
| `~/Library/Caches/copilot` | 173MB | GitHub Copilot cache | None |
| `~/Library/Caches/github-copilot-sdk` | 153MB | Copilot SDK cache | None |
| `~/Library/Caches/pnpm` | 82MB | pnpm store | None |
| `~/Library/Logs/com.apple.diagnosticextensionsd` | 1.0GB | macOS diagnostic logs | None |
| `~/.npm` | 247MB | npm cache | None — `npm cache clean --force` |
| `~/.bun` | 863MB | Bun cache | Safe to clear部分 |
| `~/.Trash` | check | Trash | Empty trash |
| **Old installers in Downloads** | **~2GB** | .dmg files | None — already installed |

**Total safe savings: ~8-10GB**

---

## Review First (might want to keep)

| Location | Size | What | Notes |
|----------|------|------|-------|
| `~/Library/Application Support/com.docker.install` | 2.1GB | Docker installer | Can re-download |
| `~/Library/Application Support/Arc` | 1.4GB | Arc profile data | Keeps login state |
| `~/Library/Application Support/app.glaze.macos.main` | 1.1GB | Glaze app data | Check if still used |
| `~/Library/Application Support/Zed` | 1.1GB | Zed editor | Keeps settings |
| `~/Library/Caches/com.todesktop.230313mzl4w4u92.ShipIt` | 1.1GB | Todesktop updater | None |
| `~/Library/Developer/Xcode` | 721MB | Xcode derived data | Can clean with `xcodebuild clean` |
| `~/Downloads/scraped/` | ~1.5GB | Scraped data | Review contents |
| `~/Downloads/1core/` | ~1.3GB | ChatGPT exports | Review |
| `~/Downloads/DELETED/` | 306MB | Deleted items | Can trash |

**Potential additional savings: ~8GB**

---

## Old Installers to Delete

| File | Size | Status |
|------|------|--------|
| `Try.Omarchy.dmg` | 1.1GB | Already installed |
| `ChatGPT.dmg` | 609MB | Already installed |
| `ZCode-3.9.2-mac-arm64.dmg` | 223MB | Already installed |
| `fdm.dmg` | 55MB | Already installed |

**Total: ~2GB**

---

## Quick Wins (run these commands)

```bash
# 1. Clear Spotify cache (2GB)
rm -rf ~/Library/Caches/com.spotify.client

# 2. Clear Homebrew cache (1GB)
brew cleanup

# 3. Clear npm cache (247MB)
npm cache clean --force

# 4. Clear browser caches (1GB+)
rm -rf ~/Library/Caches/Arc
rm -rf ~/Library/Caches/com.google.antigravity

# 5. Clear old logs (1GB)
rm -rf ~/Library/Logs/com.apple.diagnosticextensionsd

# 6. Delete old installers (2GB)
rm ~/Downloads/Try.Omarchy.dmg ~/Downloads/ChatGPT.dmg ~/Downloads/ZCode-*.dmg ~/Downloads/fdm.dmg

# 7. Empty trash
rm -rf ~/.Trash/*
```

**Total potential recovery: ~10-15GB**

---

## Don't Touch (keeps apps working)

- `~/Library/Application Support/com.raycast.macos` — Raycast data
- `~/Library/Application Support/Google` — Chrome profile
- `~/Library/Application Support/Telegram Desktop` — Telegram data
- `~/Library/Application Support/obsidian` — Obsidian vault
- `~/.docker` — Docker config (only 24KB)
