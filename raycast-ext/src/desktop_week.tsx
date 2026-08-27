import { ActionPanel, Action, Icon, Detail, confirmAlert, showToast, Toast, useNavigation, List } from "@raycast/api";
import { useState } from "react";
import { resolveScope, flattenDir, flattenMarkdown } from "./fileops";
import { ScopePicker } from "./scope-picker";

function WeekView({ root }: { root: string }) {
  const [busy, setBusy] = useState(false);
  const { push } = useNavigation();

  async function run() {
    if (
      !(await confirmAlert({
        title: "Sort by Week?",
        message: `${root}\nTop-level files are moved into YYYY-Www week folders (non-recursive).`,
        primaryAction: { title: "Sort" },
      }))
    )
      return;
    setBusy(true);
    try {
      const report = await flattenDir(root, "week", { recursive: false });
      showToast({ title: `Sorted ${report.moved.length} files`, style: Toast.Style.Success });
      push(<Detail markdown={flattenMarkdown("week", report)} />);
    } catch (e) {
      showToast({ title: "Failed", style: Toast.Style.Failure, message: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <List isLoading={busy}>
      <List.Item
        title="Sort Files by Week"
        subtitle={root}
        icon={Icon.Calendar}
        accessories={[{ text: "YYYY-Www folders" }]}
        actions={<ActionPanel><Action title="Sort by Week" icon={Icon.Calendar} onAction={run} /></ActionPanel>}
      />
    </List>
  );
}

export default function Command() {
  const { push } = useNavigation();
  return <ScopePicker title="Week Sort" icon={Icon.Calendar} onPick={(scope, root) => push(<WeekView root={resolveScope(scope)} />)} />;
}
