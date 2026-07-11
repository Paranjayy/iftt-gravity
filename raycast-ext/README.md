# HomePilot — Raycast Mission Control for your Smart Home

> Local-first. One-keyword. For power users who already run a home
> automation backend.

![Hub Pulse — your whole home at a glance](./metadata/hub-pulse.png)

---

## What is this?

HomePilot is a [Raycast](https://raycast.com) extension that gives you
keyboard-driven mission control over your smart home. It talks to a
**Hub backend that you run** (a single HTTP service) and gives you
fast access to every device, scene, schedule, and piece of energy data
— no phone required.

Built for the "I have 4 lights, an AC, a solar inverter, and a Telegram
bot" crowd. If your setup is more elaborate (Home Assistant, Hubitat,
etc.), this extension probably isn't the right tool — those have their
own native apps.

## How does it work?

```
┌─────────────────┐    HTTP     ┌──────────────────┐
│  Raycast ext    │ ──────────► │  Your hub bot    │
│  (this code)    │             │  (you run this)  │
└─────────────────┘             └────────┬─────────┘
                                         │
                                         ▼
                              ┌──────────────────────┐
                              │  Your devices:       │
                              │  • AC (Panasonic)    │
                              │  • WiZ smart bulb    │
                              │  • SmartThings       │
                              │  • SolisCloud solar  │
                              │  • Anything HTTP-able│
                              └──────────────────────┘
```

The extension is a thin UI layer. All the device control logic lives in
the bot you run. A reference bot implementation is
[linked below](#reference-bot).

## How to set up

1. **Install this extension** from the Raycast Store.
2. **Run a hub bot** somewhere reachable (your Mac, a Raspberry Pi, a
   VPS). See [Reference Bot](#reference-bot) for a starter.
3. **Open Raycast → Extension Preferences** and set the **Hub URL**
   (default `http://127.0.0.1:3030` if the bot is on your Mac).
4. **Optional**: paste a SmartThings PAT, SolisCloud API key, etc. for
   the integrations you want. Sections you don't configure are hidden.
5. **Try a command**: open Raycast, type "Control House" → "AC → Toggle".
   You should see your AC change state within 2 seconds.

That's it. No accounts, no telemetry, no cloud.

## Commands

### Core
| Command | What it does |
|---------|--------------|
| **Control House** | One-stop dashboard: AC + lights + scenes + schedules |
| **Hub Pulse** | All-in-one status view: AC, bulb, SmartThings, solar, energy |
| **Hub Dashboard** | Energy & system health detail |
| **Quick Scene** | Activate any scene with one keyword search |

### Devices
| Command | What it does |
|---------|--------------|
| **AC Controller** | Full AC control: power, temp, mode, swing, powerful, custom timer |
| **Bulb Controller** | Full bulb control: power, brightness, color temp, scene picker |
| **SmartThings** | Browse devices, scenes, location modes |

### Schedules & Automation
| Command | What it does |
|---------|--------------|
| **Schedule Presets** | One-tap add common routines (7am safety, 11pm sleep, etc.) |
| **Recent Hub Activity** | Tail the last 20 entries from your hub log |
| **Mood Presets** | Multi-step scene combos (Movie, Focus, Dinner, Bedtime…) |

### Insights
| Command | What it does |
|---------|--------------|
| **View Logs** | Latest house activity |
| **Hub Diagnostic** | Probe all hub endpoints in parallel; spot what's down |
| **Sun Position** | Sunrise/sunset countdown + lighting suggestions |

### Utilities
| Command | What it does |
|---------|--------------|
| **Search Clipboard Archive** | Infinite history of your copies and cuts |
| **Gravity Notes** | Mission control for notes and file probe |
| **Toggle Media Aura** | One-tap toggle music-light sync |

## Configuration

All optional. The extension works out of the box against a local bot.

### Hub URL
Default: `http://127.0.0.1:3030`. Set to any URL where your hub bot is
reachable. Examples:
- `http://192.168.1.50:3030` — bot on a home server
- `https://hub.example.com` — bot behind a reverse proxy
- `http://127.0.0.1:3030` — bot on your Mac (default)

### SmartThings (optional)
- **PAT** — Personal access token from
  [account.smartthings.com/tokens](https://account.smartthings.com/tokens)
- **Location ID** — UUID of the location to browse

### Other integrations
Each section is hidden until you configure the relevant preference.
See the extension's Preferences pane in Raycast for the full list.

## Reference Bot

A minimal Node/Bun bot that implements the endpoints this extension
talks to lives in the
[`iftt-public-bot`](https://github.com/yourname/iftt-public-bot)
repo. Clone it, customize for your devices, deploy it, point the
extension at it.

Required endpoints (the extension only uses these):

```
GET  /status                                 — health + uptime
GET  /control/ac/{on,off}                    — power toggle
GET  /control/ac/temp?dir=up|down            — temp step
GET  /control/ac/mode?mode=cool|heat|fan     — mode
GET  /control/ac/timer?mins=N|at=HH:MM      — auto-off
GET  /control/bulb/{on,off}                  — power toggle
GET  /control/bulb/brightness?dir=up|down    — brightness
GET  /control/bulb/color?temp=2700-6500      — color temperature
GET  /scene/<name>                           — activate scene
GET  /control/schedule/list                  — list routines
POST /control/schedule/add                   — add routine
POST /control/schedule/remove                — remove one
GET  /control/schedule/clear                 — wipe all
GET  /system/lock                            — lock Mac screen
```

Everything else (SmartThings, Solis, PGVCL bill scraper) is optional
and only used if you wire it up.

## Privacy

- The extension makes outbound HTTP requests to **the Hub URL you
  configure**. Nothing else.
- It does **not** collect analytics, telemetry, or usage data.
- It does **not** send any data to Raycast beyond what every extension
  sends (extension name + version, for crash reporting).
- Your SmartThings PAT and any other tokens are stored locally by
  Raycast and used only to authenticate against the relevant service.
  They are never sent to anywhere else.

Full privacy policy: [link to your gist / webpage]

## FAQ

**Q: Does this work without a hub bot?**
A: No. The extension is a UI for a bot you run. If you don't have one,
the offline-error pages will guide you.

**Q: Can I use it with Home Assistant?**
A: Not directly. You'd need a thin adapter bot that translates the
endpoints above into Home Assistant calls. The reference bot has a
similar adapter for the Panasonic AC + WiZ bulb if you want a starting
point.

**Q: Is the source available?**
A: Yes. The extension code is in this repo. The reference bot is in
a separate repo. Both are MIT licensed.

**Q: Can I add my own device?**
A: Yes, by adding endpoints to your bot. The extension doesn't need
to change as long as your endpoint follows the existing patterns
(`/control/<device>/<action>`).

**Q: How do I update?**
A: Raycast handles auto-updates for store-installed extensions. For
dev-mode installs, run `bun run dev` in the extension directory.

## License

MIT. See [LICENSE](./LICENSE).

## Attribution

- Master icon: hand-drawn orbital icon
- Per-command icons: tinted variants of the master
- Built with [@raycast/api](https://github.com/raycast/extensions)
