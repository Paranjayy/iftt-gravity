import { ActionPanel, Action, Icon, Detail, confirmAlert, showToast, Toast, useNavigation, List } from "@raycast/api";
import { useState, useEffect } from "react";
import { findDevJunk, purgeJunk, purgeMarkdown, formatSize, JunkItem, resolveScope } from "./fileops";
import { ScopePicker } from "./scope-picker";
import { useSelection, selAccessory } from "./selector";
import { LiveProgress } from "./live-progress";

function PurgeView({ root }: { root: string }) {
  const [items, setItems] = useState<JunkItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const { selected, toggle, count } = useSelection();
  const { push } = useNavigation();

  useEffect(() => {
    setLoaded(false);
    findDevJunk(root).then((r) => {
      setItems(r);
      setLoaded(true);
    });
  }, [root]);

  const targets = () => (count > 0 ? items.filter((i) => selected.has(i.path)) : items);

  async function apply() {
    const list = targets();
    if (list.length === 0) return;
    if (
      !(await confirmAlert({
        title: `Trash ${list.length} item${list.length > 1 ? "s" : ""}?`,
        message: `${root}\nMoved to ~/.Trash (recoverable) — nothing deleted forever.`,
        primaryAction: { title: "Trash Junk" },
      }))
    )
      return;
    setBusy(true);
    try {
      push(
        <LiveProgress
          title="Purging dev junk"
          icon="🧹"
          task={async (onP) => {
            const r = await purgeJunk(list, onP);
            showToast({ title: `Trashed ${r.trashed.length}`, style: Toast.Style.Success });
            return purgeMarkdown(r);
          }}
        />
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <List isLoading={!loaded || busy}>
      <List.Item
        title={count > 0 ? `▶ Trash ${count} selected` : `▶ Trash all ${items.length}`}
        icon={Icon.Trash}
        actions={<ActionPanel><Action title="Purge" icon={Icon.Trash} style={Action.Style.Destructive} onAction={apply} /></ActionPanel>}
      />
      {items.map((i) => (
        <List.Item
          key={i.path}
          title={i.path.replace(root, ".")}
          icon={Icon.Folder}
          accessories={[{ text: formatSize(i.size) }, selAccessory(selected.has(i.path))]}
          actions={
            <ActionPanel>
              <Action
                title={selected.has(i.path) ? "Deselect" : "Select"}
                icon={Icon.Checkmark}
                onAction={() => toggle(i.path)}
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
  return <ScopePicker title="Purge" icon={Icon.Trash} onPick={(scope, root) => push(<PurgeView root={resolveScope(scope)} />)} />;
}
