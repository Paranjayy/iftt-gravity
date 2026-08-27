import { ActionPanel, Action, Icon, Detail, confirmAlert, showToast, Toast, useNavigation, List } from "@raycast/api";
import { useState, useEffect } from "react";
import { planFlatten, flattenDir, flattenMarkdown, formatSize, FlattenBy, resolveScope } from "./fileops";
import { ScopePicker } from "./scope-picker";
import { useSelection, selAccessory } from "./selector";
import { LiveProgress } from "./live-progress";

const MODES: { value: FlattenBy; title: string; hint: string }[] = [
  { value: "ext", title: "By Extension", hint: "*.png, *.pdf, *.zip…" },
  { value: "type", title: "By Type", hint: "Images, Code, Documents…" },
  { value: "date", title: "By Date", hint: "2026-08-27" },
  { value: "day", title: "By Day", hint: "same as date" },
  { value: "week", title: "By Week", hint: "2026-W35" },
];

function FlattenView({ root }: { root: string }) {
  const [by, setBy] = useState<FlattenBy>("type");
  const [plan, setPlan] = useState<{ file: string; target: string }[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const { selected, toggle, count } = useSelection();
  const { push } = useNavigation();

  useEffect(() => {
    setLoaded(false);
    planFlatten(root, by, true).then((r) => {
      setPlan(r);
      setLoaded(true);
    });
  }, [root, by]);

  const targets = () => (count > 0 ? plan.filter((p) => selected.has(p.file)) : plan);

  async function apply() {
    const list = targets();
    if (list.length === 0) return;
    if (
      !(await confirmAlert({
        title: `Flatten ${list.length} file${list.length > 1 ? "s" : ""} by ${by}?`,
        message: `${root}\nMoved into category folders (recursive). Nothing deleted.`,
        primaryAction: { title: "Flatten" },
      }))
    )
      return;
    setBusy(true);
    try {
      push(
        <LiveProgress
          title={`Flattening by ${by}`}
          icon="📂"
          task={async (onP) => {
            const r = await flattenDir(root, by, { files: list.map((p) => p.file), onProgress: onP });
            showToast({ title: `Moved ${r.moved.length}`, style: Toast.Style.Success });
            return flattenMarkdown(by, r);
          }}
        />
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <List
      isLoading={!loaded || busy}
      searchBarAccessory={
        <List.Dropdown tooltip="Categorize by" value={by} onChange={(v) => setBy(v as FlattenBy)} storeValue>
          {MODES.map((m) => (
            <List.Dropdown.Item key={m.value} title={m.title} value={m.value} />
          ))}
        </List.Dropdown>
      }
    >
      <List.Item
        title={count > 0 ? `▶ Flatten ${count} selected` : `▶ Flatten all ${plan.length}`}
        icon={Icon.Folder}
        actions={<ActionPanel><Action title={`Flatten by ${by}`} icon={Icon.Folder} onAction={apply} /></ActionPanel>}
      />
      {plan.map((p) => (
        <List.Item
          key={p.file}
          title={p.target.replace(root, ".").replace(/^\//, "")}
          subtitle={p.file.replace(root, ".")}
          icon={Icon.Dot}
          accessories={[selAccessory(selected.has(p.file))]}
          actions={
            <ActionPanel>
              <Action
                title={selected.has(p.file) ? "Deselect" : "Select"}
                icon={Icon.Checkmark}
                onAction={() => toggle(p.file)}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}

export default function Command() {
  const { push } = useNavigation();
  return <ScopePicker title="Flatten" icon={Icon.Folder} onPick={(scope, root) => push(<FlattenView root={resolveScope(scope)} />)} />;
}
