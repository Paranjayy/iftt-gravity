# 🌌 Gravity: Future Evolution Ideas

This file tracks the "God Build" roadmap for Telegram, macOS, and IFTTT integrations.

## 📱 Telegram & Interactive UX
- **Smart Reminders**: `/remind 10m check the water` -> Gravity pings you exactly when needed.
- **Sticky Notes**: `/note Buy milk` -> Gravity keeps it in a "Pinned Message" or a `/todo` list.
- **Visual Status Card**: Instead of text, Gravity generates a beautiful PNG image using Puppeteer and sends it to you as a summary.
- **Timer Countdown**: `/event Tomorrow Exam` -> Gravity shows a live countdown in the `/status` view.
- **Bulk Control**: "Sleep Mode" button that turns off everything and sets the AC to 27°C in one tap.

## 🖥 macOS Desktop Hooks
- **Active App Vibe**:
  - Open **VS Code** -> Trigger "Focus Vibe" (Blue lights + 24°C).
  - Open **Zoom** -> Trigger "Mute Hub" (Stop speech + Red bias light).
  - Open **Netflix** -> Trigger "Cinema Vibe" (Dim lights + Silence).
- **Screenshot Command**: `/screen` -> Gravity captures your Mac's screen and sends it to Telegram (great for checking if something is running).
- **CCTV Sentry**: If Ghost Sentry triggers, take a photo with the FaceTime camera and send it to the owner instantly.
- **Media Controller**: `/vol up`, `/next`, `/pause` commands to control music playing on the Mac.
- **System Health**: Monitor CPU temperature and fan speeds.

## 🔗 IFTTT & Smart Home
- **Solar/Sunset Sync**: `/schedule sunset lights on` -> Gravity calculates the sunset time for Junagadh every day automatically.
- **Geofencing v2**: Use the phone's "Critical Alerts" to notify the master if the house is vacant but the AC is still running at max power.
- **Analog Weighting**: Prioritize habits learned from physical remotes (100% human intent) over automated scenes.
- **Utility Multi-Payer**: Calculate split-wise energy bills if guests are staying over.

## ⚙️ DevOps & Stability
- **Auto-Healer**: If MQTT or WiZ connection drops, Gravity automatically tries to restart the adapter without crashing the whole bot.
- **Local-Check-In**: A 3030 port health check that Raycast can use to show a "Green/Red" status in the Mac menu bar.
- **Docker Home**: A one-command setup for the whole hub.
