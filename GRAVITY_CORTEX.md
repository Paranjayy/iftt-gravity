# 🪐 Gravity Hub: The God Build Cortex (v2.9.20)

Gravity is a production-grade, 24/7 autonomous IoT intelligence hub running locally on a macOS host. This file serves as the system's "Long-Term Memory" to ensure continuity across future AI sessions. 

## 🔋 Core Architecture
- **Language**: TypeScript / Bun 1.x
- **Host**: Local Mac (with `launchd` persistence)
- **Persistence**: Managed via `./install_service.sh`
- **Agent Path**: `~/Library/LaunchAgents/com.gravity.hub.plist` (This ensures the hub runs 24/7 without Antigravity being active).
- **Control API**: Port `3030` (REST) for Raycast/Shortcuts
- **UI**: Raycast Extension (`raycast-ext`) & Telegram Bot (`@if2opensource_bot`)

## 📡 Registered Hardware (as per config.json)
- **❄️ ACs**: 2x Panasonic (via MirAie Adapter)
- **💡 Bulbs**: 1x WiZ Bedroom (via Wiz-Local Adapter)
- **🔋 Mac**: System-level controls (Lock/Sleep/Say/Volume)

## 🛡 Ghost Sentry Status
- **Active**: Monitoring mouse/keyboard activity via `iorep`.
- **Logic**: If `isPhoneOnline === false` & activity detected > 5s → Instant Telegram Alert.

## 🚀 God Mode v3.0: Future Roadmap Ideas (Added 2026-04-08)

### **1. 🌦 Met-Office Intelligence**
- **Dynamic AC**: Auto-set AC to 26°C if outdoor temp < 25°C, or 23°C if outdoor > 35°C.
- **Rain Warning**: Send Telegram "Close the windows!" if rain is forecast and phone is AWAY.

### **2. 📷 Security Ghost-Snap**
- **Trigger**: When Ghost Sentry fires, use `imagesnap` (via Homebrew) to take a secret photo of who is touching the Mac and send it to Telegram instantly.

### **3. 🎙 Narrative Hub (Voice)**
- **Hourly Chime**: Hub speaks "It is 10 PM. You have spent ₹40 on energy today."
- **Morning Brief**: When phone is detected at 8 AM, speak "Good morning. AC ran for 6 hours. System is at 90% battery."

### **4. 📊 PGVCL Pro Analytics**
- **Predictive Billing**: Predict the month-end bill based on current daily consumption trends.
- **Slab Guardian**: Alert if you're about to cross into a more expensive energy slab.

### **5. 📺 TV TIME Auto-Vibe**
- **Request**: When `/scene/tv` is started, check if the Mac is playing media (via `nowplaying`) and auto-pause if the phone is missing.

---
🪐🏆 **The Grid is documented. God Mode Secured.**

---
Edited GRAVITY_CORTEX.md

### **Gravity God Mode v2.9.21: The Evolution Cortex Update** 🪐🏆

Before you leave, I have documented the future vision of Gravity in your **[GRAVITY_CORTEX.md](file:///Users/paranjay/Developer/iftt/GRAVITY_CORTEX.md)**.

#### **🚀 Roadmap v3.0: High-Value Intelligence**
I've added the following future-proof ideas to your system's memory:
- **🌦 Weather Intelligence**: Auto-adjusting your 2 ACs based on Junagadh's outdoor temperature.
- **📷 Ghost-Snap**: If the **Ghost Sentry** detects movement while you're away, it will take a secret photo of whoever touched your Mac and send it to you.(weird creepy)
- **🎙 Narrative Hub**: Having your Mac speak a "Morning Briefing" when you first arrive at 8 AM (e.g. "Welcome back. You used 15 units tonight.")
- **📊 Slab Guardian**: An alert if your monthly **PGVCL** bill is approaching a more expensive energy slab.

#### **🏁 Current Mission Summary**
- **Deep Control**: Raycast now has **Granular +/-** for ACs, Bulbs, and Volume.
- **Multi-Device Sync**: Both of your ACs are now correctly targeted and synced.
- **Chat Vault**: Secured in `chat_vault.md` for your next session.
- **Persistence**: `./hub.sh` and `./install_service.sh` have been mission-hardened.

**Gravity is online and fully autonomous. The Grid is documented. God Mode Secured.** 🪐🏆🚀