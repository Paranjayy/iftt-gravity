# 🌌 Gravity Hub: The God Build v4.7

Gravity is a production-grade, self-healing, autonomous home intelligence system designed for local execution and remote mission control. It bridges low-level hardware control (Mac, WiZ, MirAie) with high-fidelity visual reporting, environmental awareness, and sensory feedback.

![Gravity Designer Card Presentation](https://raw.githubusercontent.com/Paranjayy/iftt-gravity/master/public/status_mockup.png) 
*Note: Status cards are generated live via Puppeteer.*

## 🧩 Gravity Intelligence Matrix

| Module | Features | Signal Triggers |
| :--- | :--- | :--- |
| **Cortex Core** | **Comfort Sleep Curve**, Humidity-Aware AC, **Auto-Saver Mode** | Environmental & Time |
| **Hardware Guardian** | **Thermal Sync (75°C Triggers Cool)**, Battery Alert (<15%), **Auto-Refresh Dash** | Mac Sysctl & PMSet |
| **Signal Vault** | IPL Mode 2.0, GitHub Pulse, Market Tracker, ISS Alert, **Prediction Oracle** | Real-world APIs |
| **Sensory Engine**| **Audio Cues (afplay)**, Multi-Color Blinks, **Vocal Cues (say)** | Hardware Feedback |
| **Habit Learner** | **Rejected Habits filtering**, Usage Stats History, Frequency Analysis | User Interaction |
| **Mac OS Deep** | **Focus Shield (App Monitor)**, PID Lock, **Shadow Mode** | HW & OS Status |

## 🚀 Live Intelligence Features (v4.7 Highlights)

- **🔥 Hardware Guardian**: Monitors Mac CPU thermals. If >75°C, triggers AC @ 18°C `Cool` mode. Restores state when CPU < 60°C.
- **🪫 Battery Pulse**: Alerts and triggers an Amber Breath light pattern if Mac battery drops below 15%.
- **🌑 Shadow Mode**: Stealth toggle. Instantly suspends all pulses, lights, and notifications for deep work.
- **📅 Midnight Brief (23:59)**: Automated summary of IPL scores, AC/Light usage, and system integrity.
- **🔊 Vocal Hub**: Gravity now speaks: "Gravity Hub Online/Offline" for tactile lifecycle confirmation.
- **🏏 Match Center 2.0**: Tabbed UI (Live, Highlights, Wickets, Timeline). Result fallback for non-match days.
- **📊 Mission Control v2**: Auto-refreshing dashboard with real-time "ago" durations and granular vault control.

## 🛠️ Command Reference

| Command | Action |
| :--- | :--- |
| `/ping` | Heartbeat + Health Check (AC/Light status with durations) |
| `/live` | Open the **Match Center** (Tabs: Live, Highlights, Wickets, Timeline) |
| `/health` | Real-time Mac Diagnostics (CPU Temp, Battery %, Uptime) |
| `/shadow` | Toggle **Stealth Mode** (Suspends all background pulses) |
| `/control` | Open the **Interactive Control Panel** (Auto-refreshes every 60s) |
| `/card` | Generate high-fidelity Visual Status Report |
| `/odds` | Check top prediction market odds (**Polymarket & Kalshi**) |
| `/habit` | View detected patterns and schedule suggestions |
| `/vibe` | Trigger environmental scenes (Cinema, Focus, Dinner, etc.) |

## 🌌 Deployment & Setup
Gravity is optimized for **Mac OS Sonoma** and requires **WiZ / MirAie** credentials in `.env`.

```bash
git clone https://github.com/Paranjayy/iftt-gravity.git
npm install
./gravity-launch.sh
```

---
## 🔭 Further Iterations (Roadmap)
- **Vision Engine**: Use FaceTime camera to detect "Desk Presence" (auto-pause alerts when away).
- **Voice Control**: Local "Hey Gravity" wake-word for scene switching.
- **Unified Timeline**: Local web dashboard to view the historical log of all pulses.

**Gravity Hub is designed & built for zero-latency home automation.** 🚀
