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

## 🚨 Safety: AC Auto-On & 7am Cap (Asked 2026-07-11)

> *“is there any automation that ac turns on at 7 am if yes then please turn it off within 10 mins else i would get frozen lol my ac is too strong”*

**Answer: NO 7am AC auto-on exists today.** The bot has zero scheduled jobs:
`config.json` → `"scheduler": []`. The only AC schedule helper is the
**Sleep Curve** (manual `/sleep_curve` start) which steps 18→25→26→27°C
over 6 hours. There is no clock-triggered AC-on.

**If you want a 7am auto-on WITH a 10-minute safety cap**, the bot's
`/schedule_add 07:00 ac_on` is the right tool — but it does **not**
auto-shut-off. You would need a paired `/schedule_add 07:10 ac_off` job.

### Safe 7am routine (copy-paste to the bot or save as a snippet)

```
/schedule_add 07:00 ac_on
/schedule_add 07:10 ac_off
```

This turns the AC on at 07:00 daily and forces it off at 07:10 — a
hard 10-minute safety cap that prevents the freeze scenario. You can
also add a third job to bring the temp back to a normal comfort level:

```
/schedule_add 07:00 ac_on
/schedule_add 07:10 ac_off
/schedule_add 07:15 ac_set?temp=26
```

⚠️ **Caveat:** the scheduler in `bot.ts` currently has daily recurrence
but no per-weekday filter — these would run **every day**, not just
weekdays. If you want weekday-only, you'd need a small server-side
patch (filter by `now.getDay() !== 0 && now.getDay() !== 6` before
firing). Track that in Phase 3.

### One-tap option via the extension
The new "Custom AC Timer" form in the AC detail view (added 2026-07-11)
is perfect for ad-hoc "I want AC off in 10 min" — just open it, type
10, done. Not recurring, but no setup.

---

## 📣 Phase 5 — Cross-Extension Store Push (P1, discussed 2026-07-11)

> *“svgl & instagram media hub & gravity hub i would like to publish soon. i already did 7tv lol and would update 7tv too soon lol”*

Three extensions to ship to the public Raycast Store. Each needs its
own pre-flight + a small README + a per-extension launch.

### 5.1 SVGL Search Pro (`~/Developer/svgl-raycast/`)
- **Status**: installed in Raycast, built and published previously
- **Pre-flight**: same checklist as Gravity Hub (privacy scan, no
  hardcoded tokens, README with screenshots)
- **Action items**:
  - [ ] Re-verify `package.json` icon path (`icon` field — relative to
    `assets/`, not the project root; this is the bug that bit Gravity Hub)
  - [ ] `bun run validate` clean
  - [ ] `bunx @raycast/api@latest publish` (private → public)

### 5.2 Instagram Media Hub (`~/Developer/instagram-media-hub/`)
- **Status**: installed in Raycast
- **Risk**: uses an Instagram scraper; ensure no API keys in source
- **Pre-flight**:
  - [ ] `grep -rE "token|password|api_key" src/` returns nothing
  - [ ] README documents the unofficial nature + rate-limit risk
  - [ ] `bun run validate` clean

### 5.3 Gravity Hub (this repo)
- **Status**: 9 commands, build clean, icons generated, version 1.2.0
- **Pre-flight** (carried from Phase 1):
  - [x] Build reproducible
  - [x] Per-command icons (11 generated, 9 used)
  - [ ] Privacy scan: grep `src/` for hardcoded IPs/ports
  - [ ] Convert remaining `127.0.0.1` references to a `HUB_URL`
        preference (default `http://127.0.0.1:3030`)
  - [ ] README with screenshots of: Control House, Bulb Detail,
        Quick Scene, Hub Pulse, Custom Timer Form
  - [ ] CHANGELOG entry for v1.2.0
  - [ ] LICENSE (MIT) verified
  - [ ] Privacy policy URL (a single GitHub gist works)

### 5.4 7TV Emotes Search Pro (`~/Developer/7tv-raycast/`) — update
- **Status**: published previously; user plans to update
- **Pre-flight**: bump version, re-validate, publish new version

### Shared publishing rules (learned from 7TV)
1. Icon path in `package.json` is `assets/<icon>.png` — NOT
   `assets/commands/...`. Got bitten by this in Gravity Hub.
2. Raycast caches script metadata — after a big change, remove &
   re-add the script directory.
3. Run `bunx @raycast/api@latest validate` BEFORE every publish.
4. Ship a one-page README in the repo root with screenshots.

---


## 📝 Decisions log

| Date       | Decision                                                                  |
|:-----------|:--------------------------------------------------------------------------|
| 2026-07-11 | Icons: per-command tinted variants, master icon preserved in `_archive/`  |
| 2026-07-11 | Bulb detail view: 6 sections (Power / Brightness / Color / Temp / Scene / Lifestyle) |
| 2026-07-11 | Bootstrap script: dry-run by default, `BLAST_RADIUS=read-only` env gate  |
| 2026-07-11 | Bulb reads `stats.light.status` for real power; brightness/scenes use optimistic local state (server doesn't expose WiZ pilot) |
| 2026-07-11 | `package.json` icon path is `assets/<name>.png` (not `assets/.../...`) — fixed for extension entry icon |
| 2026-07-11 | Added `/control/bulb/timer?mins=N\|at=HH:MM` endpoint + Custom Timer Forms in both AC and Bulb detail views |
| 2026-07-11 | New script commands: `Backup Everything Now`, `Backup Health Check`, `List Last Backup`, `New-Mac Bootstrap (Preview)` — all in Gravity Tools package |
| 2026-07-11 | Added Hub Pulse command (9th) — sovereign overview of all device health at a glance |
| 2026-07-11 | Confirmed: no 7am AC auto-on exists; documented safe 7am routine in Phase 5 section |
| 2026-07-11 | New: Mood Presets command (10th) — 16 multi-step scene combos |
| 2026-07-11 | New: 3 schedule HTTP endpoints (add/list/clear) in bot.ts — requires bot restart to load |
| 2026-07-11 | Control House now has Schedules section with Add/View/Clear items (Forms-based) |
| 2026-07-11 | Never commit `~/.config/raycast-x/extensions/` — that's the runtime, not source |
