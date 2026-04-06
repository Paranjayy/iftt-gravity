# 🌌 Gravity: The God Build Roadmap 🏆

This document outlines the master vision for your home automation ecosystem.

## ✅ Completed (Infrastructure Built)
- **MirAie**: Low-level MQTT control with physical "Beep" feedback.
- **WiZ**: Local UDP control with 0-100% brightness and daylight white modes.
- **Homey**: SDK-ready integration for external smart hubs.
- **Self-Healing Sync**: Background router scraper to fix dynamic IP issues.
- **Auth Lock**: "First-Owner" Master Identity system for Telegram security.
- **Scenes**: Initial "TV Mode" (10% Dim, 24°C Cool).

---

## 🛠️ Upcoming: Phase 2 (Local Intelligence)
1. **Presence Detection (Ping-Based)**: 
   - Gravity pings your phone's IP every 5 mins.
   - If "Away", turn off AC/Lights. If "Home", turn on Welcome Scene.
2. **Automated Sleep Cycle**:
   - Gradually dim lights from 11 PM to 12 AM.
   - Set AC to 26°C at 4 AM to save energy.
3. **Multi-Account `/allow` Management**:
   - UI in the dashboard to see/remove authorized Telegram IDs.
4. **Energy Analytics**:
   - Basic charts of how many hours the AC has been live.

---

## 🌩️ Upcoming: Phase 3 (Cloud & Mobile)
1. **Native PWA (iOS/Android App)**:
   - "Install" Gravity as a real app from Safari/Chrome.
2. **Cloudflare Tunnel (Cloud Access)**:
   - Access your home from any network without a VPN.
3. **Docker Persistence**:
   - Run Gravity 24/7 as a background Docker container (`docker-compose up -d`).

3. 🗓️ Roadmap Updated: Raycast/Menubar
I’ve added Raycast & Mac Menubar extensions to your GRAVITY_TODO.md roadmap (Phase 3). This will let you toggle your whole house with a single Mac shortcut without even opening Telegram.


---

## 🧩 Ideas for Further Expansion
- **PC/Mac Controller**: Turn off lights when your PC goes to sleep.
- **Weather-Sync**: If it's raining (via API), set lights to "Deep Sea Blue".
- **Homey Flows**: Use Gravity as a trigger for other Homey devices.
- **Webhooks**: Control your house from Raycast or iOS Shortcuts.
