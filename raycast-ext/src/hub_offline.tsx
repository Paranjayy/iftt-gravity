import { Detail, ActionPanel, Action, Icon, Color } from "@raycast/api";
import { getHubUrl } from "./config";

/**
 * Shared "Hub Offline" Detail component.
 * Use this in any view where the bot is unreachable so the user always has
 * a one-tap path to restart the Gravity Hub without leaving Raycast.
 *
 * The "Restart" actions use `Action.Open` with the launcher script and
 * `application: "Terminal"`. macOS Terminal.app opens .sh files in a new
 * window and (by default) executes them. The preload shim is already
 * baked into iftt-clone.sh so the bot won't crash on startup.
 *
 * Why not shell://? That URL scheme is not registered as a global handler
 * on macOS — only telnet:// and ssh:// are. Action.Open with a target path
 * + application bundle name is the safe, portable path.
 *
 * @param context Short human label for what was being attempted
 *                (e.g. "schedule list", "smartthings sync")
 * @param onRetry Optional callback for a "Try Again" action
 */
export default function HubOfflineDetail({ context, onRetry }: { context?: string; onRetry?: () => void }) {
  const LAUNCHER = "/Users/paranjay/Developer/developer/iftt/iftt-clone.sh";

  const heading = context ? `❌ Hub Offline — ${context}` : "❌ Hub Offline";
  const markdown = `# ${heading}

The Gravity Hub is not responding on \`${getHubUrl()}\`.

**Quick fix:** Use the **Restart Full Hub Stack** action below to relaunch the bot in a new Terminal window. \`iftt-clone.sh\` already loads the preload shim so the bot won't crash on startup.

If the bot dies again right after starting, check \`/tmp/gravity-bot.log\` for the last error line.

---

### Common causes
- Mac just woke from sleep and the bot was killed
- \`bun\` upgraded and the preload path changed
- Port 3030 is held by another process — run \`lsof -i :3030\`

### Manual restart
\`\`\`bash
cd /Users/paranjay/Developer/developer/iftt && ./iftt-clone.sh
\`\`\`
`;

  return (
    <Detail
      markdown={markdown}
      actions={
        <ActionPanel title="Hub Offline">
          <Action.Open
            icon={{ source: Icon.Power, tintColor: Color.Orange }}
            title="Restart Full Hub Stack"
            target={LAUNCHER}
            application="Terminal"
            shortcut={{ modifiers: ["cmd"], key: "r" }}
          />
          <Action.Open
            icon={{ source: Icon.Hammer, tintColor: Color.Yellow }}
            title="Restart Bot Only (fast)"
            target={LAUNCHER}
            application="Terminal"
            shortcut={{ modifiers: ["cmd", "shift"], key: "r" }}
          />
          {onRetry ? (
            <Action
              icon={Icon.Repeat}
              title="Try Again"
              onAction={onRetry}
              shortcut={{ modifiers: ["cmd"], key: "t" }}
            />
          ) : null}
          <Action.Open
            icon={{ source: Icon.Terminal, tintColor: Color.Blue }}
            title="Open Repo in Finder"
            target="/Users/paranjay/Developer/developer/iftt"
            application="Finder"
          />
          <Action.CopyToClipboard
            title="Copy Restart Command"
            content="cd /Users/paranjay/Developer/developer/iftt && ./iftt-clone.sh"
            shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
          />
        </ActionPanel>
      }
    />
  );
}
