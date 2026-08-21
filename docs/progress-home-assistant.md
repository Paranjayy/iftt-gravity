# Gravity Hub — Home Assistant Integration Progress

**Date:** 2026-08-21
**Status:** Working — devices visible in HA, bidirectional control via MQTT

---

## What Was Built

### New Files
- `src/lib/adapters/homeassistant.ts` — Main adapter: REST API commands, WebSocket state sync, entity mapping
- `src/lib/adapters/ha-mqtt.ts` — MQTT auto-discovery publisher: exposes Gravity Hub devices to HA
- `src/lib/ha-commands.ts` — 10 Telegram `/ha_*` commands
- `docs/home-assistant-setup.md` — Full setup guide

### Modified Files
- `src/lib/bot.ts` — HA adapter init, MQTT publisher wiring, command registration
- `src/lib/entities.ts` — Extended domain types with `cover` and `media_player`
- `src/lib/manager.ts` — Added HA adapter import
- `config.json` — Added `homeAssistant` section

---

## Architecture

```
Gravity Hub ──REST/WS──► Home Assistant (localhost:8123)
Gravity Hub ──MQTT──────► Mosquitto (localhost:1883) ◄── Home Assistant
```

### Bidirectional Flow
- **HA → Gravity:** HA entities synced via REST + WebSocket state subscription
- **Gravity → HA:** MirAie ACs and WiZ bulbs published via MQTT auto-discovery

---

## Current Setup

### Docker Containers
```bash
docker ps
# homeassistant  — ghcr.io/home-assistant/home-assistant:stable  — :8123
# mosquitto      — eclipse-mosquitto                             — :1883
```

### Config (config.json → homeAssistant)
```json
{
  "url": "http://localhost:8123",
  "token": "<long-lived-access-token>",
  "mqtt": { "host": "localhost", "port": 1883 },
  "exposeToHA": true,
  "discoveryPrefix": "homeassistant",
  "enabled": true
}
```

### HA Credentials
- Username: `paranjay`
- Password: `gravity2026`
- URL: `http://localhost:8123`

---

## Devices in HA

| Entity ID | Type | Name | State |
|-----------|------|------|-------|
| `climate.panasonic_ac_panasonic_ac` | Climate | Panasonic AC | auto |
| `climate.panasonic_ac_panasonic_ac_2` | Climate | Panasonic AC (2nd) | unknown |
| `light.bedroom_light_bedroom_light` | Light | Bedroom Light | off |

### How They Get There
1. Bot starts → `HaMqttPublisher.connect()` connects to Mosquitto
2. Publishes MQTT auto-discovery config to `homeassistant/climate/gravity_hub_*/config`
3. HA receives config → creates native entity
4. State updates published to `gravity/miraie_*/state` topics
5. Commands from HA arrive on `gravity/miraie_*/set` → forwarded to actual device

---

## Telegram Commands

| Command | What it does |
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

| Client | How | Status |
|--------|-----|--------|
| **Telegram Bot** | `@if2opensource_bot` | ✅ All `/ha_*` commands work |
| **HA Dashboard** | `http://localhost:8123` | ✅ Devices visible |
| **Raycast HA Extension** | Install from store | ⏳ Needs URL + token input |
| **HA Companion App** | iOS/Android | ⏳ Needs HA URL + token |
| **Apple Home** | HA HomeKit bridge | ⏳ Not configured yet |

---

## Known Issues

1. **`setMyCommands` Telegram error** — Too many slash commands (>100 limit). Doesn't affect functionality, just the command menu.
2. **Duplicate entities on restart** — MQTT discovery creates new entities if naming changes. Cleaned up manually.
3. **WebSocket reconnection loop** — Fixed (auth message was getting an `id` field which HA rejects).
4. **HA config entry not persisting** — Config entries created via API lost on container restart. Need to use UI or proper YAML.

---

## Next Steps

- [ ] Configure Raycast HA extension with URL + token
- [ ] Set up HA Companion App on phone
- [ ] Add HA HomeKit bridge for Apple Home
- [ ] Fix Telegram command menu (reduce to <100 commands)
- [ ] Add Gravity Hub scenes as HA scene entities
- [ ] Add Pomodoro/Hydration/Posture states as HA sensors
- [ ] Set up remote access (Cloudflare Tunnel or Tailscale)
- [ ] Add automations: HA triggers → Gravity Hub actions
- [ ] Fix entity naming (cleaner IDs without duplication)

---

## Raycast Scripts

Three scripts in `~/.raycast/scripts/`:

| Script | What it does |
|--------|-------------|
| `gravity-hub.sh` | Start everything (Docker + HA + MQTT + Bot) |
| `gravity-status.sh` | Quick status check (compact output) |
| `gravity-restart.sh` | Restart all services |

Search in Raycast: "Start Gravity Hub", "Gravity Hub Status", "Restart Gravity Hub"

### Docker Auto-Start
Docker Desktop is set to start on login (`defaults write com.docker.docker LaunchAtLogin -bool true`). Containers have `--restart unless-stopped` so they auto-start when Docker is ready.

---

## Git History

```
197b0ab  feat: Home Assistant adapter — bidirectional integration
cc52d10  docs: Home Assistant setup guide
7045546  fix: HA WebSocket auth + MQTT device publishing
```

---

## How to Restart Everything

**Option 1: Raycast (easiest)**
Open Raycast → search:
- `Start Gravity Hub` — starts Docker + HA + MQTT + Bot
- `Gravity Hub Status` — quick status check
- `Restart Gravity Hub` — restart everything

**Option 2: Terminal**
```bash
# Start Docker (auto-starts on login now)
docker start homeassistant mosquitto

# Start Gravity Bot
cd /Users/paranjay/Developer/iftt
bun src/lib/bot.ts &
```

**Option 3: Full rebuild**
```bash
docker start homeassistant mosquitto
cd /Users/paranjay/Developer/iftt && bun src/lib/bot.ts &
```
