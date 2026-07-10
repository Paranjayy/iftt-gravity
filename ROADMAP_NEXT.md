# 🌌 Gravity Hub: Sovereignty Roadmap v2

> **Status**: Living document. `GRAVITY_ROADMAP.md` covers v10.6.x product phases. This file tracks **operational + ecosystem** goals: Raycast Store launch, cross-machine reproducibility, and the safe-cleaner ritual.

---

## 🎯 Mission North Star

> *"Be the gravity that bends the rest of the workspace toward you, not the other way around."*

Gravity should be the only thing you have to think about. Everything else — Raycast, editors, terminals, tools — should be derivable from a single source of truth you control.

---

## 📦 Phase 1 — Raycast Store Submission (P0)

**Goal**: Publish `gravity-hub` to the public Raycast Store.

### Pre-flight
- [x] Build reproducible (verified Jul 11 — `bun run build` clean)
- [x] Per-command icons generated (`assets/commands/*.png`)
- [ ] **Privacy review**: scan all `fetch()` calls in `src/` for hardcoded `127.0.0.1` or local-network IPs that should be preferences
- [ ] **Token safety**: ensure `smartThingsPat` preference is `password` type (already done)
- [ ] **No bundled credentials**: grep `src/` for `token=`, `pat=`, `apiKey=`
- [ ] **README** in `raycast-ext/README.md` with screenshots, command reference, attribution
- [ ] **CHANGELOG.md** entry for v1.2.0 (per-command icons, bulb detail view)
- [ ] **LICENSE** file (MIT) — verify `package.json` matches
- [ ] **Privacy policy URL** (required for store)

### Launch checklist
- [ ] `bunx @raycast/api@latest validate` (no errors)
- [ ] `bunx @raycast/api@latest lint` (no errors)
- [ ] `bunx @raycast/api@latest publish` (private first, then promote to public)
- [ ] Tag repo `v1.2.0` after publish

### Post-launch
- [ ] Monitor Raycast Store reviews
- [ ] Add "Star on Store" action in extension footer
- [ ] Create demo GIFs of the AC + Bulb detail views

---

## 🚀 Phase 2 — New-Mac Bootstrap (P0, user pain-point)

**Problem**: You lost 2 months of Raycast clipboard + extension config in a cleanup. This phase makes a fresh Mac identical to your current one in <30 minutes.

### Components

#### 2.1 `iftt/scripts/new-mac-bootstrap.sh` — **dry-run by default**
```sh
# What it does (no destruction unless --execute):
#   1. Detect macOS + arch
#   2. Verify Homebrew installed (install if missing)
#   3. Verify bun installed (install if missing)
#   4. Install raycast, zed, cursor, code, iterm2, claude, figma, arc via brew
#   5. Sign in to Mac App Store (manual prompt)
#   6. Clone this repo to ~/Developer/iftt
#   7. Restore Raycast extensions from `~/gravity-archive/raycast-extensions-export.json`
#   8. Restore Raycast clipboard from `~/gravity-archive/raycast-clipboard.sqlite`
#   9. Restore editor configs (Zed, Cursor, VSCode) from `~/gravity-archive/editor-configs/`
#  10. Restore SSH keys from `~/gravity-archive/ssh/` (chmod 600)
#  11. Symlink dotfiles (`~/.zshrc`, `~/.gitconfig`) from `~/gravity-archive/dotfiles/`
#  12. Start Gravity Hub via launchd
#  13. Run safe-cleaner once (cache purge)
#  14. Print final report with next steps
```

#### 2.2 Backup companion: `iftt/scripts/backup-everything.sh`
- Runs nightly via `launchd` (or `cron`)
- Snapshots: `~/Library/Application Support/com.raycast.macos/`, `~/Library/Application Support/{Zed,Cursor,Code}/`, `~/Developer/gravity-archive/`, `~/.ssh/`, `~/.zshrc`, `~/.gitconfig`
- Output: `~/gravity-archive/<YYYY-MM-DD>/` (rotates 7 most recent, then tar.gz's older)
- Never touches source repos in `~/Developer/**` (those are git-backed)

#### 2.3 The "safe-cleaner"
- **Whitelist-cleanable** (default behavior, runs without confirmation):
  - `~/Library/Caches/*`
  - `~/Library/Logs/*` (older than 7 days)
  - `~/.cache/*`
  - `npm`, `bun`, `pip`, `brew`, `xcode` caches
  - `~/Downloads/*.{dmg,pkg,zip}` older than 30 days
- **NEVER touches** (hard-blocked, requires manual flag override):
  - `~/Developer/**` (entire dir)
  - `~/Library/Application Support/com.raycast.macos/**` (clipboard + ext state)
  - `~/Library/Application Support/{Zed,Cursor,Code,Claude}/**`
  - `~/gravity-archive/**`
  - Any path matching `iftt/.gitignore` patterns
  - `~/Documents/**`, `~/Desktop/**`, `~/Pictures/**`
- **BLAST_RADIUS env var**:
  - `BLAST_RADIUS=read-only` (default) — dry-run, prints what it would delete
  - `BLAST_RADIUS=destructive` — actually deletes; requires `--i-know-what-im-doing`

---

## 🛠 Phase 3 — Robust Extension Features (P1)

> *"The seamless, friction-free Mac experience"*

### 3.1 Cross-Command Quick Actions
- [ ] Add a **"Quick Scene Launcher"** command (single Cmd+Space search → scene by name)
- [ ] Add a **"Hub Whisper"** command (low-urgency notifications: battery low, sunrise in 15m, etc.)
- [ ] Add a **"Status Card"** command (export current state as PNG, like the bot's `/card`)

### 3.2 New Detail Views (P1)
- [x] **Bulb Detail View** — done Jul 11 (color picker, scene selector, brightness presets)
- [ ] **SmartThings Detail View** — per-device full control panel
- [ ] **SolisCloud Solar Detail** — daily/weekly/monthly yield with ROI calc
- [ ] **Archive Detail** — fragment preview, edit, re-tag

### 3.3 Form-Driven Quick Add
- [ ] "Create Note" form (writes to `~/Developer/gravity-notes/`)
- [ ] "Archive Snippet" form (manually add a fragment to the vault)
- [ ] "Schedule Scene" form (time + scene + days-of-week)

### 3.4 Hub Health Surface
- [ ] Live CPU temp in `control.tsx` header accessory
- [ ] Hub restart action with toast confirmation
- [ ] "Last 24h uptime" chart (mini sparkline)

---

## 🧪 Phase 4 — Hardening (P2)

### 4.1 Error handling
- [ ] Add a global ErrorBoundary so a single bad command doesn't break the hub
- [ ] Auto-retry on 5xx from `127.0.0.1:3030` with backoff
- [ ] Display last successful refresh timestamp in detail views

### 4.2 Preferences audit
- [ ] All local-network IPs in `src/` are exposed as Raycast preferences
- [ ] Hub URL preference (default `http://127.0.0.1:3030`)
- [ ] Polling interval preference (default 5s, range 1-30s)

### 4.3 Testing
- [ ] `bun test` for pure helper functions (color hex parsing, cost calc, time formatting)
- [ ] Mock fetch for integration tests
- [ ] Visual regression on detail views (Playwright + Raycast headless?)

---

## 💡 Idea Backlog (no commitment)

- "Meeting Mode" — auto-dim lights, mute notifications, set AC to 24°C for N minutes
- "Sunset Anticipation" — start dimming lights 30 min before sunset
- "Sleep Curve" — gradually dim + cool AC over 60 min
- "Guest Mode" — single command to set whole-house to "company" state
- "Movie Mode" — pre-defined scene+light+sound+AC combo
- "Energy Saver" — auto-suspend non-essential when solar < 100W
- "Telegram" — forward status card to bot on demand
- "AirPods Pro ping" — last-known location for lost earbuds
- "Time Machine health" — alert if backup > 24h old

---

## 📝 Decisions log

| Date       | Decision                                                                  |
|:-----------|:--------------------------------------------------------------------------|
| 2026-07-11 | Icons: per-command tinted variants, master icon preserved in `_archive/`  |
| 2026-07-11 | Bulb detail view: 6 sections (Power / Brightness / Color / Temp / Scene / Lifestyle) |
| 2026-07-11 | Bootstrap script: dry-run by default, `BLAST_RADIUS=read-only` env gate  |
| 2026-07-11 | Never commit `~/.config/raycast-x/extensions/` — that's the runtime, not source |
