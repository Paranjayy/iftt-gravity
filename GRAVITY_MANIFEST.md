# 🪐 Gravity Hub: The God Build Manifest (v4.9.5)

This document serves as the absolute context for the current state of the Gravity Hub ecosystem. Use this as a reference for any future development or troubleshooting.

## 🏗️ Core Architecture
- **Port 3030 (The Frequency)**: The central heartbeat. Both the Local API and the Webhook Gateway live here.
- **Minimal Brain (CLIPBOARD_ONLY)**: A lightweight mode that runs only the clipboard archiver and API, bypassing hardware (AC/Lights) and Telegram initialization.
- **Zapit Engine**: A custom IFTTT/Zapier killer that handles incoming webhooks and executes dynamic flows.

## 📋 Clipboard Archive (Infinite Memory)
- **Engine**: Hyper-fast 1-second polling of `pbpaste`.
- **Storage**: JSON-based archive in `gravity-archive/clips.json`.
- **UI**: Raycast Extension with a "Goated" detail sidebar and instant search.

## ⚡ Zapit (Automation Engine)
- **Webhook Gateway**: `POST http://localhost:3030/zapit/:key`
- **Execution**: Logic flows are stored in `config.zapit_flows`. 
- **Actions**: Supports standard scenes (`scene`), voice alerts (`speak`), and safety shutdowns (`ac_off`).

## 🪐 Mission Control (Raycast)
- **Gravity Hub**: Full ecosystem startup (automatically clears Port 3030).
- **Gravity Hub (Archive Only)**: Launches the minimal brain.
- **Stop Gravity Hub**: Total killswitch for all Gravity processes.

## 🚧 Known Integrations
- **MirAie**: Panasonic AC Control (Local/Remote).
- **WiZ**: RGB Light Sync (Liquid Aura 2.0).
- **Spotify**: Media-aware lighting synchronization.

## 🗺️ Next-Gen Roadmap
1. **Zapit 3.0**: Add support for conditional logic (e.g., "If time > 10PM and AC is ON, then...").
2. **Infinite Vision**: Support for image archiving and OCR in the clipboard sentry.
3. **Gravity Mobile**: Dedicated iOS Shortcuts bridge for triggering Zapit flows via Siri.

---
**Build something that matters today.** 🚀
