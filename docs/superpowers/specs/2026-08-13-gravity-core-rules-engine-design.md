# Gravity Core — Entity Store + Rules Engine (Home Assistant Alternative)

**Date:** 2026-08-13
**Status:** Approved (user chose "Full batch now")

## 1. Vision

Gravity is becoming our own Home Assistant. The core that makes Home Assistant what it is: an
**entity state store** (what exists, what's its current state) + a **rules engine** (when → if →
then) with integrations layered on top. Surfaces (Telegram, Raycast, web dashboard) are consumers,
not the core.

This spec builds the core + four user-facing features in one pass:

- #7 **Rules engine** (the core itself — scenes and schedules become rules)
- #4 **Scene cost meter** (₹/hr per scene)
- #5 **Missed-automation sentry** (flash + ping when a scheduled rule silently fails)
- #8 **Wind-down ramp** (opt-in evening cooldown curve)
- 🍅 **Pomodoro × AC+bulb** (opt-in focus/break driver)

## 2. Current architecture (what we're building on)

- `src/lib/bot.ts` (6761 lines) — monolith: Telegram bot + Bun HTTP server on :3030.
  - `GravityScheduler` class (`bot.ts:275`): reads `config.scheduler` jobs, fires when `job.time === current IST HH:MM`, supports `days` filter + `once` jobs. `lastRun` guard per job.
  - `triggerScene(sceneId, extra)` (`bot.ts:1944`): giant switch statement of scenes (TV/TV_TIME, FOCUS, AWAY, HOME, CHILL, MATRIX, POWER_NAP…), each pushing actions to `wiz`/`miraie` then `Promise.all`.
  - Scheduler action map (`bot.ts:472`): `ac_on`, `ac_off`, `bulb_on`, `bulb_off`, `bulb_dim`, `scene`, `speak`, `sleep_curve`.
  - HTTP `/scene/:name`, `/trigger/:hook` → `triggerScene`. Auth: localhost bypass, else `config.hubToken`.
  - `/control/schedule/*` endpoints + `/schedule_add` etc. Telegram commands.
- `config.json` — single source of truth. `scheduler: []`, `stats` (acMinutes, lightMinutes, history, dailyLog), `wiz`, `miraie`, `habits`.
- `src/lib/engine.ts` + `src/lib/manager.ts` + `src/lib/scenes.ts` — **vestigial** (never wired into bot.ts). Types exist (`Trigger`, `Action`, `Adapter`, `Automation`) but the engine was never connected. We reuse the *concepts* but build fresh.
- Adapters: `wiz`, `wiz-registry`, `miraie`, `telegram`, `smartthings`, `homey`, `pc`. Energy model already in `bot.ts`: AC 1.65 kWh/h, bulb 0.012 kWh/h (`bot.ts:2040`), `calculatePgvclBill()`.

## 3. Design

### 3.1 Entity Store (`src/lib/entities.ts`)

Normalizes every device into a uniform entity that rules + surfaces can query.

```ts
interface Entity {
  id: string;            // 'wiz:philips-a70' | 'mir:panasonic-ac' | 'sensor:phone-home'
  name: string;
  domain: 'light' | 'ac' | 'tv' | 'switch' | 'sensor';
  state: string;         // 'on' | 'off' | '23' | 'home' | 'away'
  attributes: Record<string, any>;  // dimming, temp, mode, lastSeen…
  lastUpdated: number;   // epoch ms
}
```

- In-memory `Map<string, Entity>` + a `getEntity()/setEntity()` API.
- **Adapters report into the store** — the store doesn't own the network. Wiz/Miraie adapters already poll/get state; we add a thin `syncEntities()` called on bot tick that updates store entries from adapter state (bulb online/dimming, AC temp/mode).
- Persistence: last-known state persisted in `config.json` under `config.entities` on shutdown/periodic save so restarts show sane defaults.
- Also registers **virtual entities** derived from existing config: `sensor:phone-home` (from router DHCP presence — stub now, real later), `sensor:ac-hours-today` (from `stats.acMinutes`).

### 3.2 Rules Engine (`src/lib/rules/`)

The centerpiece. Uniform model that replaces hardcoded scenes + scheduler jobs.

```ts
interface Rule {
  id: string;                    // nanoid
  name: string;                  // 'TV Time'
  enabled: boolean;
  mode: 'time' | 'state' | 'manual';
  // time mode
  time?: string;                 // '22:30' IST
  days?: 'daily' | 'weekdays' | 'weekends' | 'monday,tuesday,…';
  // state mode
  trigger?: { entity: string; op: 'eq' | 'ne' | 'gt' | 'lt'; value: string | number };
  // manual mode
  scene?: string;                // legacy scene name to invoke (back-compat)
  actions: Array<Action>;        // same shape triggerScene uses
  conditions?: Array<{ entity: string; op: 'eq'|'ne'|'gt'|'lt'; value: string|number }>;
  // bookkeeping — feeds the sentry
  lastRun?: number;              // epoch ms
  lastStatus?: 'ok' | 'error';
  lastError?: string;
}
```

- Stored in `config.json` under `config.rules: Rule[]`.
- **Evaluation tick**: on the bot's existing interval, `rulesEngine.check()` evaluates:
  - `time` rules — when `now IST HH:MM === rule.time`, day-filter passes, and `lastRun` is not this minute → fire.
  - `state` rules — when entity state changed and `conditions` pass → fire (debounced).
  - `manual` rules — fired on demand (legacy scene bridge).
- **`fire(rule)`** executes each action with per-action try/catch (so one failing action doesn't kill the scene), records `lastRun`, `lastStatus`, `lastError`, and emits events for the sentry + cost meter.
- **Migration (back-compat):** `triggerScene` gets a final fallback case that looks up `config.rules` by name and fires it. Existing scheduler jobs remain supported via `GravityScheduler` for now — the rules engine is additive; we do **not** rip out the scheduler switch in this pass (YAGNI on migration risk), but new routines created via `/rule` go into `config.rules`. Actually — migration cost is low and it removes the two-systems problem, so: `GravityScheduler.check()` is refactored to iterate `config.rules` with `mode: 'time'` instead of `config.scheduler`. The `/schedule_add` command writes a `mode:'time'` rule. Old `config.scheduler` entries are migrated once at boot into `config.rules`.

- **Commands** (Telegram):
  - `/rules` — list all rules (name, mode, enabled, lastRun, lastStatus ✅/❌)
  - `/rule add <name> <time> <action>` — shorthand (`/rule add "AC off" 23:00 ac_off`)
  - `/rule toggle <id|name>` — enable/disable
  - `/rule rm <id|name>` — delete
  - `/rule scene <name>` — fire a manual rule now
- **HTTP** (on :3030):
  - `GET /control/rules` — list
  - `POST /control/rules` — create `{ name, mode, time, days, actions }`
  - `PATCH /control/rules/:id` — toggle/update
  - `DELETE /control/rules/:id`
  - `POST /control/rules/:id/run` — fire now (used by Raycast + sentry test)
- **Canonical action shape** — one shape, three kinds:

```ts
type RuleAction =
  | { kind: 'named'; name: 'ac_on' | 'ac_off' | 'bulb_on' | 'bulb_off' | 'bulb_dim' | 'speak' } // resolves via existing scheduler action map
  | { kind: 'scene'; scene: string }      // e.g. 'TV_TIME' — routes to triggerScene
  | { kind: 'device'; deviceId: string; type: 'control'; payload: any }; // raw adapter action via engine.handleAction
```

  `fire()` dispatches by kind. No other action shapes are allowed — the create endpoint validates this.

### 3.3 Scene Cost Meter (`src/lib/energy.ts`)

- Reuses the existing energy model: AC 1.65 kW, bulb 0.012 kW (`bot.ts:2040`), `calculatePgvclBill()`.
- `sceneCostEstimate(sceneId | ruleName)` → builds a per-action duration assumption (scenes are indefinite, so we report **₹/hr** — and a "runtime so far" using stats) and returns a human line.
- Wired into:
  - `/scene cost <name>` Telegram command + `triggerScene` log line ("TV_TIME ≈ ₹1.1/hr").
  - Raycast: add cost subtitle to scene items in `raycast-ext/src/control.tsx` via the existing `/control/wiz/control`-style HTTP or a new `GET /control/energy/scene?name=` endpoint.

### 3.4 Missed-Automation Sentry (`src/lib/rules/sentry.ts`)

- Reads `rule.lastRun`/`lastStatus`. If a `time` rule's scheduled slot passed (e.g. rule was due, but `lastRun` doesn't match today's expected slot) **or** `lastStatus === 'error'`, emit:
  - `pulseLight(100, 1500, { r: 255, g: 0, b: 0 })` — red flash (reuses `wiz-registry.pulseLight`).
  - Telegram ping to `config.telegram.chatId`: "⚠️ Rule 'X' missed its slot / failed: <error>".
- Debounced: per-rule alert once per 30 min (`config.stats.sentryLastAlert` map).
- Toggle: `/sentry on|off` (default on) → `config.sentry.enabled`.

### 3.5 Wind-Down Ramp (opt-in, never automatic)

- `config.windDown: { enabled: false, start: '22:00', steps: [{at: 30, temp: 24}, {at: 90, temp: 25}, {at: 150, temp: 26}] }` — minutes after `start`, AC temp bumps.
- Implementation: one internal `time` rule + a step counter; every step records AC temp via `miraie.controlDevice`.
- **Opt-in only**: `/winddown on|off`; default OFF. Does not self-enable. When enabled it uses *the AC you already have on* — never powers AC on by itself.
- If AC is off at a step time, skip silently (no nag).

### 3.6 Pomodoro × AC+bulb (`src/lib/pomodoro.ts`)

- Opt-in sessions, configurable focus/break lengths (defaults 25/5).
- `/pomodoro start [focus=25] [break=5]` | `/pomodoro stop` | `/pomodoro status`.
- Focus: AC on 24°C cool, bulb 6500K/100 (reuses FOCUS scene actions).
- Break: AC 26°C / bulb warm 2700K/40 (reuses CHILL-ish actions).
- Ticker via `setInterval` in-bot; on phase transitions, applies actions + Telegram card with phase, remaining time.
- Store session state in memory (`config.pomodoro`), not part of rules engine (it's a timer, not a rule). Won't survive restart — acceptable; `/pomodoro status` shows "no active session" after boot.

## 4. Data flow

```
Adapters (wiz/miraie/router)  →  Entity Store  (single source of live state)
                                        │
Rules Engine (config.rules) ────────────┼── evaluates on tick + on state change
   time mode / state mode / manual      │
        │ fire(rule) → actions          │
        ▼                               ▼
   adapters.executeAction          Cost meter (₹/hr)
        │                              │
   sentry (missed/error → flash+ping) ─┘
Surfaces: Telegram commands, HTTP :3030, Raycast extension
```

## 5. Error handling

- Per-action try/catch in `fire()` — one bad action logs, sets `lastStatus:'error'`, continues others, then sentry surfaces it. (Same philosophy as the WiZ self-heal work: resilience first, notify instead of silent fail.)
- Rules engine tick wrapped in try/catch so a rule bug never crashes the bot loop.
- Unknown entity/action in a rule → validation error at create-time (HTTP 400 / Telegram error), not at runtime.

## 6. Testing

- `bun test` unit tests in `src/lib/rules/rules.test.ts`:
  - time-match + day-filter logic (daily/weekdays/weekends/comma list).
  - state-trigger condition eval (eq/ne/gt/lt on entity values).
  - sentry detection (due-but-not-run, error status) with fake clock.
  - cost estimate math (given the AC/bulb constants).
- Pure logic only (no network); adapters mocked. Existing pattern: no test infra yet, but `bun test` is configured per AGENTS.md.

## 7. Out of scope (later sub-projects)

- Web dashboard rules editor on the Next.js app.
- Real presence (router DHCP → `sensor:phone-home` state wiring).
- Rule → DB migration beyond `config.json`.
- Full automation visual builder / IF-THEN string parser.