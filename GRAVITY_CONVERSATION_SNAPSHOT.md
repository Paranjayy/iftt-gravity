# Gravity — product memory snapshot

_Updated: 2026-08-01_

## Product stance

Gravity remains the primary local automation system. Telegram and Raycast are
first-class, fast clients; the web app is becoming a reliable visual cockpit,
not a separate source of truth.

## Near-term work

- Stabilize multi-device scenes, especially TV mode (AC + the configured WiZ
  lights) and surface useful per-device health instead of generic “offline”.
- Keep WiZ local-first. Store multiple bulbs by MAC + IP so the system works
  without a short-lived WiZ mobile-app link export.
- Make the web flow canvas real: save flows, invoke them through webhooks, and
  add execution history, retry/error state, conditions, and fan-out actions.
- Add portable flow/integration export and import. Secrets must be excluded or
  explicitly encrypted—never silently exported.

## Product inspirations, not dependencies

- **Home Assistant:** borrow its local-first entity model, integration health,
  and device capability vocabulary. Do not adopt it as a required runtime yet;
  Gravity should remain the seamless layer already used through Raycast and
  Telegram.
- **n8n:** borrow composable visual flows, webhooks, reusable action nodes,
  and run history.
- **Homey:** borrow approachable flows, cards, device grouping, variables, and
  Insights-style timelines without reproducing its subscription constraints.

## Future integrations

- Spotify, Google Home, motion sensors and motion-triggered
  lighting.
- **SolisCloud:** add a real API-backed integration (credentials, read-only
  telemetry first, then generation/battery history and health/error status).
- **SmartThings:** move beyond PAT storage to proper location discovery,
  capability sync, device command cards, scene execution, per-device health,
  and clear token-expiry/error recovery.
- A documented local API for external agents/bots (for example Hermesbot),
  secured by a hub token for non-local callers.
- Browser/Chrome capture or extension only after the hub API and export format
  are stable.

## Current architecture

```
Raycast ─┐
Telegram ├── Gravity Hub (:3030) ── WiZ / MirAie / SmartThings
Web UI ──┘          │
                     └── local flow webhooks: /zapit/<trigger>
```

The web UI talks through same-origin Next API bridges; it must not infer that
the hub is offline simply because a live status payload takes a few seconds.
