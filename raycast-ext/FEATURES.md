# HomePulse Raycast Extension — Feature Brief

**Extension:** `homepulse` (28 commands)
**Location:** `~/Developer/iftt/raycast-ext/`
**Run:** `bun run dev` (hot-reloads)

---

## File Tools

### PNG → JPG (`png_to_jpg`)
Convert PNGs to JPG using native macOS `sips`. Shows per-file estimates before converting.
- **Quality dropdown:** High (90), Balanced (80), Small (60), Tiny (40)
- **Keep/Delete toggle:** Originals go to `~/.Trash` (recoverable) or kept alongside JPG
- **Estimates:** Samples 10 PNGs, extrapolates for 4000+ sets
- **Progress:** Live ETA, speed (items/sec), recent files
- **Preferences:** Default quality and keep/delete behavior in Raycast settings

### Flatten / Categorize (`flatten`)
Reorganize flat文件 dumps into folders by extension, MIME type, date created, day of week, or ISO week.
- **Modes:** ext, type, date, day, week
- **Trash-safe:** Moved files go to `~/.Trash`

### Dev Purge (`dev_purge`)
Trash-safe cleanup of dev junk: `node_modules`, `dist`, `.next`, `build`, `.cache`, `__pycache__`, etc.
- **Scope picker:** Desktop, Downloads, Documents, Developer, Home
- **Shows reclaimable bytes** before you confirm

### Dedupe Files (`dedup`)
Find duplicate files by SHA-256 hash, trash redundant copies (one kept per set).
- **Grouped view:** See all copies before deciding
- **Shows reclaimable space**

### Desktop Week Sort (`desktop_week`)
Sort top-level Desktop files into `YYYY-Www` week folders.
- **Auto-creates** week directories
- **Trash-safe**

### Screenshot Fixer (`screenshot_fix`)
Three-in-one: switch macOS screenshots to JPG, disable window shadows, shrink existing Desktop PNGs.
- **System-wide:** `defaults write com.apple.screencapture type jpg`
- **Shadows:** `defaults write com.apple.screencapture disable-shadow -bool true`
- **Convert:** Uses PNG→JPG engine with live progress

---

## Backup & Sync

### Repo Backup (`repo_backup`)
Scan all local git repos, show dirty/unpushed/remote status, back up to GitHub.
- **Auto-creates** private GitHub repos if no remote
- **Captures** uncommitted state before push
- **Progress:** Per-repo live status

### Clipboard Backup (`clipboard_backup`)
Export Raycast clipboard history (344+ entries) to local markdown.
- **Text content:** Full sequence with timestamps
- **Images/files:** Paths and sizes logged (not binary)
- **Filter:** By type (text/image/file)
- **Saves to:** `~/Developer/clipboard-backup/`

### Clipboard Vault (`clipboard_vault`)
Sync Raycast clipboard captures to a personal wiki vault.
- **Auto-categorizes:** AI, Productivity, Film, Comedy, Politics
- **Deduplicates:** By content hash
- **Generates:** Index, URL catalog, version comparisons
- **Vault:** `~/Developer/personal-wiki-vault/`

---

## Hub Commands

### File Curator (`file_curator`)
One-stop launcher for all 7 file tools. Pick any tool from a single menu.

### Hub Pulse (`hub_pulse`)
Dashboard for Home Assistant / SmartThings hub status.

### Control House (`control`)
Smart home control: lights, scenes, devices.

---

## Utility

### Quick Notes
*(Planned)* Jot notes, auto-saves with timestamp.

### Expense Logger
*(Planned)* Type "₹200 coffee" → logged to CSV.

### Decision Log
*(Planned)* Record decisions with reasoning.

---

## Settings (Raycast Preferences)

| Setting | Default | Description |
|---------|---------|-------------|
| `pngToJpgQuality` | `80` | Default JPG quality (40-90) |
| `pngToJpgKeepOriginals` | `false` | Keep PNGs after conversion |
| `devPurgeScope` | `~/Developer` | Default folder for dev purge |

---

## Architecture

```
src/
├── fileops.ts          # Core engine (sips, fs, git, crypto)
├── live-progress.tsx   # Reusable progress UI with ETA
├── selector.tsx        # Multi-select hook
├── scope-picker.tsx    # Folder picker component
├── png_to_jpg.tsx      # PNG→JPG converter
├── flatten.tsx         # File organizer
├── dev_purge.tsx       # Dev junk cleaner
├── dedup.tsx           # Duplicate finder
├── repo_backup.tsx     # GitHub backup
├── desktop_week.tsx    # Week folder sorter
├── screenshot_fix.tsx  # macOS screenshot tools
├── clipboard_backup.tsx # Clipboard exporter
├── clipboard_vault.tsx # Wiki vault sync
├── file_curator.tsx    # Hub launcher
└── ...                 # Other commands (SmartThings, HA, etc.)

scripts/
├── clipboard-vault-sync.ts    # Standalone vault sync
├── clipboard-vault-backup.sh  # Vault backup script
└── clipboard-vault-schedule.sh # Cron scheduler
```

---

## Key Patterns

- **Trash-safe:** All file ops use `trashPath()` → `~/.Trash` (recoverable)
- **Live progress:** `LiveProgress` component shows ETA, speed, recent items
- **Estimates before apply:** PNG→JPG samples files, shows savings %
- **Scope picker:** Consistent folder selection across commands
- **Multi-select:** `useSelection()` hook for batch operations
- **Preferences:** User defaults in Raycast settings
