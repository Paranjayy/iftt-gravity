# Gravity Hub Design & Operating Etiquette

## Runtime contract

Gravity has one control-plane API: `127.0.0.1:3030`.

- `raycast-ext/start-gravity.sh` is the user-facing launcher.
- `start.sh` calls that same launcher before starting the dashboard.
- Native Bun starts first and Docker is an optional fallback.
- A healthy startup means an HTTP response from port 3030, not merely a live process or open socket.

The dashboard, archive service, and Raycast extension are secondary surfaces. They must not be used as proof that AC or WiZ control is healthy.

## Failure behavior

Device scenes are partial-failure tolerant:

- AC and WiZ requests are attempted independently.
- If MirAie rejects an expired MQTT session, the adapter refreshes its login once and retries.
- If one subsystem still fails, the other can complete and Raycast names the failing subsystem.
- API errors include a short request reference for finding the matching log line.

## Logging contract

- Launcher events: `/tmp/gravity-launcher.log`.
- API/control failures: `/tmp/gravity-api.log` and the process log.
- Logs may include timestamps, subsystem names, endpoint paths, safe field names, statuses, and request IDs.
- Logs must never include passwords, access tokens, full URLs with query strings, clipboard contents, or device secrets.
- Error messages should answer: what failed, which subsystem failed, whether anything else completed, and where to look next.

## Change etiquette

- Use Bun commands and keep the local-first path working without Docker.
- Do not commit `config.json`, credentials, `house_log.md`, archive data, generated operations logs, or undo history.
- Preserve unrelated user changes in a dirty worktree.
- For Raycast changes, bump `raycast-ext/package.json`, add a changelog Round, build the extension, and run the focused tests before commit/push.
