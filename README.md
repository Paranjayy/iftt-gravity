# 🪐 Gravity: The God Mode v2.4 Hub

Gravity is now a professional-grade IoT and Intelligence Hub. It provides a unified cinematic experience for your home, utility tracking, and direct Mac control.

## 🚀 One-Click Startup
To start the Hub and all its intelligence features, run:
```bash
chmod +x hub.sh
./hub.sh
```
This will start the **Telegram Bot** and all background services (`MirAie`, `WiZ`, `PGVCL Scraper`).

---

## 📡 Telegram Command Center
Use these commands to rule your house from anywhere:

### **🏠 Mission Scenes**
- `/tv` — **Cinematic Mode**: Warm Indigo lights + Quiet AC.
- `/home` — **Welcome Home**: Bright lights + Fast Cooling.
- `/away` — **Security Mode**: Everything OFF (Automatic on phone exit).
- `/lights tv` — **Only Lights**: Standard TV Bias lighting (No AC change).

### **🖥 Mac God-Build Control**
- `/system` — **Hub Health**: See Mac Battery, CPU Load, and Hub Uptime.
- `/lock` — **Security**: Instantly lock your Mac screen.
- `/sleep` — **Rest**: Put the Mac to sleep remotely.
- `/say [MSG]` — **Presence**: Make your Mac speak your message out loud! (Remote TTS).

### **⚡ Utility & Intelligence**
- `/pgvcl` — **Live Billing**: Check real-time usage and GERC tariff estimation.
- `/remember [FACT]` — **Cortex**: Save facts into Gravity's persistent memory.
- `[Raw Text]` — **Insights**: Gravity automatically archives your raw ideas into the `house_wishlist.md`.

---

## 🛠 Features v2.4 (New)
1. **The Battery Guardian**: Automatic Telegram alert if your Mac's battery hits 20%.
2. **Presence Awareness**: If you leave the house and forgot the lights, Gravity pings you to confirm shutoff.
3. **Raycast Native UI**: A professional Mission Control built into your Mac search.

---

## 🔐 Configuration
All your tokens and device IPs are stored in `config.json`.
- **Phone IP**: Used for ARP-based presence tracking (10x more reliable than ping).
- **PGVCL**: Scraped every 6 hours via Puppeteer.

---

Built for the God Build. 🪐🏆
