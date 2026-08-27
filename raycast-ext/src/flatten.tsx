import { ActionPanel, Action, Icon, Detail, confirmAlert, showToast, Toast, useNavigation, List } from "@raycast/api";
import { useState } from "react";
import { flattenDir, flattenMarkdown, FlattenBy, resolveScope } from "./fileops";
import { ScopePicker } from "./scope-picker";

const MODES: { value: FlattenBy; title: string; hint: string }[] = [
  { value: "ext", title: "By Extension", hint: "*.png, *.pdf, *.zip…" },
  { value: "type", title: "By Type", hint: "Images, Code, Documents…" },
  { value: "date", title: "By Date", hint: "2026-08-27" },
  { value: "day", title: "By Day", hint: "same as date" },
  { value: "week", title: "By Week", hint: "2026-W35" },
];

function FlattenView({ root }: { root: string }) {
  const [by, setBy] = useState<FlattenBy>("type");
  const [busy, setBusy] = useState(false);
  const { push } = useNavigation();

  async function run() {
    if (
      !(await confirmAlert({
        title: `Flatten by ${by}?`,
        message: `${root}\nFiles are moved into category folders (recursive). Nothing is deleted.`,
        primaryAction: { title: "Flatten" },
      }))
    )
      return;
    setBusy(true);
    try {
      const report = await flattenDir(root, by, { recursive: true });
      showToast({ title: `Moved ${report.moved.length} files`, style: Toast.Style.Success });
      push(<Detail markdown={flattenMarkdown(by, report)} />);
    } catch (e) {
      showToast({ title: "Failed", style: Toast.Style.Failure, message: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <List
      isLoading={busy}
      searchBarAccessory={
        <List.Dropdown tooltip="Categorize by" value={by} onChange={(v) => setBy(v as FlattenBy)} storeValue>
          {MODES.map((m) => (
            <List.Dropdown.Item key={m.value} title={m.title} value={m.value} />
          ))}
        </List.Dropdown>
      }
    >
      <List.Item
        title="Flatten / Categorize Files"
        subtitle={root}
        icon={Icon.Folder}
        accessories={[{ text: MODES.find((m) => m.value === by)?.hint ?? "" }]}
        actions={
          <ActionPanel>
            <Action title={`Flatten by ${by}`} icon={Icon.Folder} onAction={run} />
          </ActionPanel>
        }
      />
    </List>
  );
}

export default function Command() {
  const { push } = useNavigation();
  return <ScopePicker title="Flatten" icon={Icon.Folder} onPick={(scope, root) => push(<FlattenView root={resolveScope(scope)} />)} />;
}
