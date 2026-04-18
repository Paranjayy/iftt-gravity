# 🌌 Gravity Hub: The God Build v4.6

Gravity is a production-grade, self-healing, autonomous home intelligence system designed for local execution and remote mission control. It bridges low-level hardware control (Mac, WiZ, MirAie) with high-fidelity visual reporting and environmental awareness.

![Gravity Designer Card Presentation](https://raw.githubusercontent.com/Paranjayy/iftt-gravity/master/public/status_mockup.png) 
*Note: Status cards are generated live via Puppeteer.*

## 🚀 Key Evolutionary Features

### 🧠 Environment Intelligence (Cortex Core)
- **Comfort-Index Sleep Curve**: Automatically adjusts AC temperature throughout the night. It fetches real-time humidity from Open-Meteo to decide between `DRY` and `COOL` modes.
- **Auto-Saver Protection**: Automatically shuts down the AC if it has been running for >2.5 hours while you are away from home.
- **WeatherSync**: Dynamically adjusts lighting and AC vibes based on outdoor temperature and conditions.

### 🖼️ Visual Intelligence (Designer Engine)
- **Visual Status Cards (`/card`)**: Generates high-fidelity glassmorphic reporting cards using a headless Puppeteer browser.
- **Live Countdown Timer**: Remote timers for devices now feature a live-editing countdown button in Telegram (e.g., `⏳ 9:45 remaining`).
- **Habit Learner**: Scans manual patterns over 10 days to suggest and automate your repetitive house routines.

### 🔐 Mission Control & Security
- **Hub Token Authentication**: Port 3030 API is protected via unique Bearer tokens. Mobile dashboard access is restricted to authorized devices.
- **Physical Handshake**: All AC commands are injected with mandatory protocol handshakes (`ki`, `cnt`, `sid`) at the adapter level for 100% reliability.
- **Telegram Command Vault**: All interactions are logged into an atomic history file for AI context training.

### 🔋 Mac OS Deep-Integration
- **Battery Guardian**: Notifies you via Telegram when your Mac's battery drops below 20% while unplugged.
- **System Commands**: Remote lock, sleep, and volume control via `/lock`, `/sleep`, and `/vol`.
- **Presence Monitoring**: Tracks Mac idle time to determine accurately if you are at the desk or away.

## 🛠️ Command Reference

| Command | Action |
| :--- | :--- |
| `/ping` | Heartbeat + Platform Indicator (Local vs GitHub) |
| `/card` | Generate high-fidelity Visual Status Report |
| `/control` | Open the Interactive Mission Control Panel |
| `/once` | Set a temporary, self-destructing routine (e.g. `/once 10:30 ac_off`) |
| `/timer` | Start a live countdown timer for any device |
| `/login` | Retrieve your secure Hub Token for mobile dashboard access |
| `/vibe` | Trigger environmental scenes (Cinema, Focus, Dinner, etc.) |
| `/history` | View 7-day energy usage archive |

## 📦 Deployment & Setup

1.  **Environment Tokens**:
    - `TELEGRAM_TOKEN`: BotFather token.
    - `MIRAIE_MOBILE/PASSWORD`: Panasonic MirAie credentials.
    - `WIZ_IP`: Local IP of your primary light source.

2.  **Local Execution (Mac)**:
    ```bash
    bun install
    bun src/lib/bot.ts
    ```

3.  **Remote Dashboard**:
    - Deploy to Vercel/GitHub for the Dashboard UI.
    - Connect the Dashboard to your local Mac IP using the `hubToken`.

## 🌌 Future Roadmap
- [ ] **Solar Sync**: Automatically trigger "Sunset Vibes" based on real-time Junagadh sunset data.
- [ ] **Active App Sync**: Change room vibes based on the frontmost Mac application (e.g., VS Code -> Focus Lights).
- [ ] **CCTV Sentry**: Capture FaceTime camera shots upon unauthorized Mac movement.
- [ ] **Market Vibe**: Change LED colors based on Crypto/Stock market movement.

---
**Gravity Hub is designed & built for zero-latency home automation.** 🚀
