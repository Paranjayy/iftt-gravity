# Home Assistant Integration

## Overview

Gravity Hub connects to Home Assistant bidirectionally:
- **HA → Gravity**: Control HA entities (lights, climate, switches, covers, media players, sensors) from Telegram, Raycast, or web dashboard
- **Gravity → HA**: Gravity Hub devices (MirAie AC, WiZ bulbs, scenes) appear as native HA entities via MQTT auto-discovery

---

## Setup

### 1. Install Home Assistant

**Docker (recommended):**
```bash
docker run -d --name homeassistant \
  --restart unless-stopped \
  -v /Users/paranjay/ha-config:/config \
  -p 8123:8123 \
  ghcr.io/home-assistant/home-assistant:stable
```

Open `http://localhost:8123` → create admin account.

**Alternative: Raspberry Pi**
- Flash HA OS to SD card: https://www.home-assistant.io/installation/
- Boot → follow on-screen setup

### 2. Get Long-Lived Access Token

1. Open HA → click profile (bottom left)
2. Scroll to **Long-Lived Access Tokens** → Create Token
3. Copy token

### 3. Install MQTT Broker

```bash
docker run -d --name mosquitto \
  --restart unless-stopped \
  -p 1883:1883 \
  eclipse-mosquitto
```

### 4. Configure Gravity Hub

Edit `config.json`:

```json
{
  "homeAssistant": {
    "url": "http://localhost:8123",
    "token": "your_long_lived_access_token",
    "mqtt": {
      "host": "localhost",
      "port": 1883,
      "username": "",
      "password": ""
    },
    "exposeToHA": true,
    "discoveryPrefix": "homeassistant",
    "enabled": true
  }
}
```

### 5. Restart Bot

```bash
bun src/lib/bot.ts
```

Verify: `🏠 HA: Connected (X entities)` in logs.

---

## Telegram Commands

| Command | Description |
|---------|-------------|
| `/ha` | Entity overview (count by domain) |
| `/ha_lights` | List HA lights |
| `/ha_light <name> on/off/toggle/0-100` | Control light |
| `/ha_ac` | List climate entities |
| `/ha_ac <name> on/off/<temp>/cool/heat/auto` | Control AC |
| `/ha_switch` | List switches |
| `/ha_switch <name> [on/off]` | Toggle switch |
| `/ha_cover` | List covers |
| `/ha_cover <name> open/close/stop/0-100` | Control cover |
| `/ha_media` | List media players |
| `/ha_media <name> on/off/play/next/0-100` | Control player |
| `/ha_sensors` | Show all sensor readings |
| `/ha_sync` | Force re-sync entities |
| `/ha_status` | Connection status |
| `/ha_help` | Commands help |

---

## Clients

### Telegram (primary)
- `@if2opensource_bot` — all `/ha_*` commands
- Works on phone, desktop, web

### HA Companion App (iOS / Android) — FREE
- Install from App Store / Play Store
- Connect to HA URL
- Full dashboard with all Gravity Hub devices
- Add widgets, shortcuts, Siri/Google Assistant

### Raycast (Mac) — FREE
- Install "Home Assistant" extension by Michael Aigner (26k+ installs)
- Commands: All Entities, Custom Entities, Covers, Fans, Lights, Persons, etc.
- Also use existing Gravity Hub Raycast extension

### Web Dashboard
- `localhost:3000` — Gravity Hub dashboard
- HA entities visible in `/status` and `/controls`

### Apple Home (HomeKit) — FREE
- HA has built-in HomeKit bridge
- Settings → Integrations → HomeKit Bridge → Add
- Gravity Hub devices appear in Apple Home app
- Siri, scenes, automations all work

### Google Home / Alexa
- With Nabu Casa ($6.50/mo): one-click setup
- Without: manual setup via HA integrations

---

## Remote Access (Free)

### Option A: Cloudflare Tunnel (FREE)
```bash
cloudflared tunnel --url http://localhost:8123
```
Gives you a `https://xxx.trycloudflare.com` URL. Access HA from anywhere.

### Option B: Tailscale (FREE)
```bash
brew install tailscale
tailscale up
```
Access HA at `http://<tailscale-ip>:8123` from any device on your tailnet.

### Option C: Nabu Casa ($6.50/mo)
- One-click remote access
- Cloud backups
- Supports HA development
- Google/Alexa integration included

---

## Cost Summary

| Service | Cost |
|---------|------|
| Home Assistant | Free |
| Docker | Free |
| Mosquitto MQTT | Free |
| HA Companion App | Free |
| HA + HomeKit Bridge | Free |
| HA Raycast Extension | Free |
| Cloudflare Tunnel | Free |
| Tailscale | Free |
| Nabu Casa (optional) | $6.50/mo |

---

## Architecture

```
┌─────────────────────────────────────────┐
│             Gravity Hub                  │
│                                          │
│  homeassistant.ts  ←→  Entity Store      │
│       ↕ REST + WS           ↕            │
│  ha-mqtt.ts (publish)    bot.ts          │
│       ↕                    ↕             │
│  MQTT Broker         Telegram Bot        │
└─────────────────────────────────────────┘
         ↕                    ↕
┌─────────────────┐  ┌─────────────────┐
│  Home Assistant  │  │  Telegram API   │
│  REST + WS :8123 │  │  @if2opensource │
└─────────────────┘  └─────────────────┘
```

---

## Files

| File | Purpose |
|------|---------|
| `src/lib/adapters/homeassistant.ts` | Main adapter — REST, WebSocket, entity mapping |
| `src/lib/adapters/ha-mqtt.ts` | MQTT auto-discovery publisher |
| `src/lib/ha-commands.ts` | Telegram /ha_* command handlers |
| `src/lib/entities.ts` | Extended with cover, media_player domains |
| `src/lib/bot.ts` | HA adapter init + command registration |
| `config.json` | `homeAssistant` config section |
