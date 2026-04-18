# 🪐 Gravity Hub: The God Build Cortex (v3.0.0 GOD MODE)

Gravity is a production-grade, 24/7 autonomous IoT intelligence hub running locally on a macOS host. This file serves as the system's "Long-Term Memory" to ensure continuity across future AI sessions. 

## 🔋 Core Architecture
- **Language**: TypeScript / Bun 1.x
- **Host**: Local Mac (with `launchd` persistence)
- **Persistence**: Managed via `./install_service.sh`
- **Agent Path**: `~/Library/LaunchAgents/com.gravity.hub.plist` (Ensures the hub runs 24/7).
- **Control API**: Port `3030` (REST) for Raycast/Shortcuts
- **UI**: Raycast Extension (`raycast-ext`) & Telegram Bot (`@if2opensource_bot`)

## 📡 Registered Hardware (as per config.json)
- **❄️ ACs**: 2x Panasonic (via MirAie Adapter)
- **💡 Bulbs**: 1x WiZ Bedroom (via Wiz-Local Adapter)
- **🔋 Mac**: System-level controls (Lock/Sleep/Say/Volume)

## 🛡 Ghost Sentry Status (DEPLOYED v3.0.0)
- **Active**: Monitoring mouse/keyboard activity via `ioreg`.
- **Logic**: If `isPhoneOnline === false` AND system activity detected (idle < 10s) → Instant Local Voice Warning + Telegram Alert.

## 🌦 Weather Intelligence (DEPLOYED v3.0.0)
- **Engine**: Open-Meteo Integration (Junagadh).
- **Eco-Logic**: Auto-adjusts AC targets based on outdoor temperature (23°C if hot, 26°C if cool).

## 🎙 Narrative Hub (DEPLOYED v3.0.0)
- **Morning Brief**: When phone is detected at 8 AM, speak "Good morning Master. Hub is at peak health. AC ran for X hours."
- **Telegram Sync**: Parallel briefing sent to Telegram channel.

## 🚀 God Mode v4.0: Future Roadmap Ideas
- **📷 Ghost-Snap**: Use `imagesnap` to take a secret photo during Sentry triggers.
- **📊 Slab Guardian**: Predictive billing alerts for PGVCL slabs.
- **📺 TV TIME Auto-Vibe**: Auto-pause Mac media if the phone leaves the grid.

---
🪐🏆 **The Grid is documented. God Mode Secured.** 🪐🏆🚀