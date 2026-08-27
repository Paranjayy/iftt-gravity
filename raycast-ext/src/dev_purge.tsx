import { ActionPanel, Action, Icon, Detail, confirmAlert, showToast, Toast, useNavigation, List } from "@raycast/api";
import { useState } from "react";
import { resolveScope, findDevJunk, purgeJunk, purgeMarkdown, formatSize } from "./fileops";
import { ScopePicker } from "./scope-picker";

function PurgeView({ root }: { root: string }) {
  const [busy, setBusy] = useState(false);
  const { push } = useNavigation();

  async function preview() {
    setBusy(true);
    try {
      const items = await findDevJunk(root);
      const total = items.reduce((n, i) => n + i.size, 0);
      const lines = items.slice(0, 60).map((i) => `- ${formatSize(i.size).padStart(8)}  \`${i.path.replace(root, ".")}\``);
      push(
        <Detail
          markdown={`# Dev Junk Preview\n\nFound **${items.length}** items · reclaimable **${formatSize(total)}** (moved to ~/.Trash)\n\n${lines.join("\n")}`}
        />
      );
    } finally {
      setBusy(false);
    }
  }

  async function run() {
    if (
      !(await confirmAlert({
        title: "Purge dev junk?",
        message: `${root}\nJunk is moved to ~/.Trash (recoverable) — nothing deleted forever.`,
        primaryAction: { title: "Trash Junk" },
      }))
    )
      return;
    setBusy(true);
    try {
      const items = await findDevJunk(root);
      const report = await purgeJunk(items);
      showToast({ title: `Trashed ${report.trashed.length} items`, style: Toast.Style.Success });
      push(<Detail markdown={purgeMarkdown(report)} />);
    } catch (e) {
      showToast({ title: "Failed", style: Toast.Style.Failure, message: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <List isLoading={busy}>
      <List.Item
        title="Scan & Preview Junk"
        subtitle={root}
        icon={Icon.MagnifyingGlass}
        actions={<ActionPanel><Action title="Scan" icon={Icon.MagnifyingGlass} onAction={preview} /></ActionPanel>}
      />
      <List.Item
        title="Purge to Trash"
        subtitle="node_modules, dist, .next, build…"
        icon={Icon.Trash}
        actions={<ActionPanel><Action title="Purge" icon={Icon.Trash} style={Action.Style.Destructive} onAction={run} /></ActionPanel>}
      />
    </List>
  );
}

export default function Command() {
  const { push } = useNavigation();
  return <ScopePicker title="Purge" icon={Icon.Trash} onPick={(scope, root) => push(<PurgeView root={resolveScope(scope)} />)} />;
}
