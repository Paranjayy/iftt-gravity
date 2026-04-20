# 💻 Mac Ultra-Evolution Ideas (Raycast & Automation)

This file tracks the roadmap for making the macOS environment feel like a "God Build" for developers.

## 🛠 Developer Productivity
- **Project Context Launcher**: 
  - Command: `Context: [Project Name]`
  - Action: Opens VS Code, specific Chrome profiles, Terminal with dev server, and specific Notion/Documentation pages in one tap.
- **Tailwind Palette Master**: 
  - Input: Base Hex color.
  - Output: Instant 50-950 palette generation copied to clipboard.
- **Dependency Clean-Burn**: 
  - A script that scans all `Developer/` folders and finds `node_modules` folders that haven't been touched in 30 days. Piles them up and asks to delete them to save GBs of space.
- **Git Sentinel**:
  - Periodically checks all local repos for uncommitted changes and shows a "Status Dashboard" in Raycast so nothing ever gets lost.

## 🛡 System Health & Sentry
- **CPU Resource Hunter**:
  - Monitors high-temp or high-usage processes. 
  - Action: If a process eats >50% CPU for 3m, show a Raycast notification with a "Nuke" button.
- **SSD Auto-Sync**: 
  - Detects when "Paranjay_Backup" SSD is plugged in.
  - Action: Automatically runs `rsync` for critical folders and sends a "Backup Done" ping to Telegram.
- **Battery Guardian**: 
  - If battery is <20% and Power Cable is NOT connected, dim screen and close battery-heavy apps like Simulator/Docker.

## 🎭 UX & Aesthetics
- **Gravity Window Scenes**: 
  - Command: `Scene: Focus` -> Snaps VS Code to 70% and Terminal to 30%.
  - Command: `Scene: Chill` -> Hides all apps except Music and a reading app.
- **Menu Bar Status Mirror**:
  - A script that reflects your Gravity Hub's "Home Status" (AC/Lights) directly in the Mac Menu Bar text.
- **Screensaver Sync**:
  - Change the Mac Wallpaper based on the current "IFTTT Vibe" (e.g., Sunset Vibe -> Warm Wallpaper).

## 🦾 Fun & Experimental
- **Face ID for Apps**: 
  - Use the FaceTime camera to only allow specific apps (like Personal Notes) to open if *your* face is detected.
- **Speech-to-Script**: 
  - "Gravity, create a new Next.js project called Test" -> Mac opens terminal and runs the `npx` command automatically.
