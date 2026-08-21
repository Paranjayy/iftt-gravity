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
| `button.gravity_hub_movie_mode_gravity` | Button | Movie Mode | press to trigger |
| `button.gravity_hub_sleep_mode_gravity` | Button | Sleep Mode | press to trigger |
| `button.gravity_hub_tv_gravity` | Button | TV | press to trigger |
| `button.gravity_hub_focus_gravity` | Button | Focus | press to trigger |
| `button.gravity_hub_chill_gravity` | Button | Chill | press to trigger |
| `button.gravity_hub_home_gravity` | Button | Home | press to trigger |
| `button.gravity_hub_morning_brief_gravity` | Button | Morning Brief | press to trigger |

### Verified Working (end-to-end)
- ✅ WiZ bulb ON via MQTT command path (HA-side publish → UDP → bulb state confirmed)
- ✅ Scene trigger from HA button (`button.press` → MQTT → bot logs confirm execution)

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

- [x] ~~Fix Telegram command menu (reduce to <100 commands)~~ — fixed 2026-08-22 (priority list + dedupe + cap at 100)
- [x] ~~Add Gravity Hub scenes as HA scene entities~~ — done as buttons (HA MQTT has no scene domain)
- [ ] Configure Raycast HA extension with URL + token
- [ ] Set up HA Companion App on phone
- [ ] Add HA HomeKit bridge for Apple Home
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

---

## Portfolio Audit Notes (2026-08-22)

### Stats
- 237 total projects (161 GitHub + 76 local-only)
- TypeScript 53%, JavaScript 23%, Swift 6%
- Standout: saptak, OmniWM, iftt-gravity, ipl-2026-engine, COD-Fable, sift, limn

### Docker Assessment
**Only Gravity Hub needs Docker.** Everything else runs fine with `bun run dev`.

| Project | Docker needed? | Why |
|---------|---------------|-----|
| iftt-gravity | ✅ Yes | HA + MQTT containers |
| saptak | ❌ No | Static browser app |
| OmniWM | ❌ No | Native Swift app |
| ipl-2026-engine | ❌ No | Bun server |
| COD-Fable | ❌ No | Static browser game |
| All other web apps | ❌ No | `bun run dev` is fine |

### Local Repos Worth Pushing
- iftt (Gravity Hub) — already pushed
- stats, writing stats, mythology
- COD Fable, chess
- Image-Search

### Local Repos Safe to Delete
- temp_policy, temp_migrations, temp_corruption* (temp files)
- new folder, src (empty/scratch)
- chatgpt json convert (data dump)
- media hub variants (consolidate into one)

### Recommendations
1. Add 1-liner descriptions to repos without them (~60% have none)
2. Consolidate media hub variants (cc, sol, terra, website) into one
3. Push the good local experiments before they rot
4. Write "Building tools I actually use" blog post — strong pattern
