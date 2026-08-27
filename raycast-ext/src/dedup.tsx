import { ActionPanel, Action, Icon, Detail, confirmAlert, showToast, Toast, useNavigation, List } from "@raycast/api";
import { useState } from "react";
import { resolveScope, findDuplicates, dedupFiles, dedupMarkdown, formatSize } from "./fileops";
import { ScopePicker } from "./scope-picker";

function DedupView({ root }: { root: string }) {
  const [busy, setBusy] = useState(false);
  const { push } = useNavigation();

  async function preview() {
    setBusy(true);
    try {
      const groups = await findDuplicates(root, { recursive: true });
      const reclaim = groups.reduce((n, g) => n + g.size * (g.files.length - 1), 0);
      const lines = groups.slice(0, 60).map((g) => `- ${formatSize(g.size).padStart(8)} × ${g.files.length}  \`${g.files[0].replace(root, ".")}\``);
      push(
        <Detail
          markdown={`# Duplicates Preview\n\n**${groups.length}** duplicate sets · **${formatSize(reclaim)}** reclaimable (one copy kept per set)\n\n${lines.join("\n")}`}
        />
      );
    } finally {
      setBusy(false);
    }
  }

  async function run() {
    if (
      !(await confirmAlert({
        title: "Trash duplicates?",
        message: `${root}\nRedundant copies go to ~/.Trash; one copy of each file is kept.`,
        primaryAction: { title: "Trash Copies" },
      }))
    )
      return;
    setBusy(true);
    try {
      const groups = await findDuplicates(root, { recursive: true });
      const report = await dedupFiles(groups);
      showToast({ title: `Trashed ${report.trashed.length} copies`, style: Toast.Style.Success });
      push(<Detail markdown={dedupMarkdown(report)} />);
    } catch (e) {
      showToast({ title: "Failed", style: Toast.Style.Failure, message: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <List isLoading={busy}>
      <List.Item
        title="Find Duplicates"
        subtitle={root}
        icon={Icon.MagnifyingGlass}
        actions={<ActionPanel><Action title="Scan" icon={Icon.MagnifyingGlass} onAction={preview} /></ActionPanel>}
      />
      <List.Item
        title="Trash Redundant Copies"
        subtitle="keep one of each"
        icon={Icon.Trash}
        actions={<ActionPanel><Action title="Dedupe" icon={Icon.Trash} style={Action.Style.Destructive} onAction={run} /></ActionPanel>}
      />
    </List>
  );
}

export default function Command() {
  const { push } = useNavigation();
  return <ScopePicker title="Dedupe" icon={Icon.ArrowClockwise} onPick={(scope, root) => push(<DedupView root={resolveScope(scope)} />)} />;
}
