# HomePulse / Gravity file tools — agent rules

## Desktop is a live surface, not a library

Finder icon-preview of thousands of images will OOM an 8 GB Mac. Screenshots do not live on the Desktop.

## Clean & Group (no knobs)

`Gravity Notes → Clean & Group Desktop` is screenshot-only:

- Matches `Screenshot …`, `Screen Shot …`, `SCR-`, `scr_`
- Destination is always `~/Desktop/Organised Screenshots/{ISO week}/` using the **date in the filename**, not mtime
- **Never** moves other files, folders, aliases, or third-party drops
- If anything else is sitting loose on the Desktop, write `DESKTOP-STRAY-WARNING.md` to **Desktop and Downloads** — do not relocate those files

## Guard / breaking point

- Break: **48** loose screenshots (`DESKTOP_SCREENSHOT_BREAK`)
- Over the break, `desktop_guard` (and any later launchd) auto-sweeps screenshots the same way as Clean & Group
- Moves run in batches of **32** (`DESKTOP_MOVE_BATCH`) so Finder is not slammed in one burst
- Under the break, the guard does nothing unless the user force-runs Clean & Group / Curate

## Curate Desktop (knobs)

Calendar grain only (year/month/day, month, week, day). Still screenshots-only. Same stray warning.

## Do not

- Depend on archive port 3031 for file moves (PNG→JPG and organize are local)
- Touch `Organised *` folders, hidden files, or the warning markdown
- Delete user files; undo is rename-back via `desktop_undo_history.json`
- Commit `config.json`, tokens, `house_log.md`, or clipboard dumps

## Verify

```sh
bun test src/__test__/organize-desktop.spec.ts
```

Then `bun run build` in `raycast-ext` before asking the human to use a new command.

## Surface etiquette (every change)

- Version: bump `raycast-ext/package.json` (feat = minor, fix = patch).
- Changelog: add a Round entry at top of `raycast-ext/CHANGELOG.md` under "What's been built".
- Build the surface you touched: `bun run build` in `raycast-ext` for any ext change.
- Test: `bun test src/__test__/organize-desktop.spec.ts` for file-tool changes.
- Commit + push only intended files. Never commit `config.json`, tokens,
  `house_log.md`, `gravity-archive/`, `OPERATIONS_LOG.md`, `desktop_undo_history.json`,
  `next-env.d.ts`.
- Logs are general stats only (moved / skipped / failed counts). Never log full
  from→to paths. Sweep logs `Desktop organize (grain)`, reshape logs
  `Reshape library (grain)` to `OPERATIONS_LOG.md`.
- Top-level Desktop files only. Never descend into Desktop subfolders.
  Screenshot names only (`Screenshot`, `Screen Shot`, `scr_`, `SCR-`).
  Everything else: leave + warn, don't relocate.

## Clipboard export (how it works)

- `Clipboard Export` reads Raycast's clipboard store directly from
  `~/Library/Application Support/com.raycast.macos/clipboard` (that's the
  reverse-engineered bit — no wiki, just the on-disk files).
- Classifies text / html / image / file, exports Markdown or JSON with
  metadata (chars, words, size, timestamps) to `~/Developer/clipboard-backup/`.
  Full-JSON action keeps complete text content; standard JSON keeps a
  500-char preview.

## house_log.md

- Local append-only log of smart-device life: scene triggers, presence
  AWAY/HOME, weather polls (~15 min), AC state with source
  (`Manual/Remote` vs `Bot`). `Recent Hub Activity` tails it. Never commit it.
