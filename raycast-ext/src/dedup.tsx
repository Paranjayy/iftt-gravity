import { ActionPanel, Action, Icon, Detail, confirmAlert, showToast, Toast, useNavigation, List } from "@raycast/api";
import { useState, useEffect } from "react";
import { findDuplicates, dedupFiles, dedupMarkdown, formatSize, DupGroup, resolveScope } from "./fileops";
import { ScopePicker } from "./scope-picker";
import { useSelection, selAccessory } from "./selector";
import { LiveProgress } from "./live-progress";

function DedupView({ root }: { root: string }) {
  const [groups, setGroups] = useState<DupGroup[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const { selected, toggle, count } = useSelection();
  const { push } = useNavigation();

  useEffect(() => {
    setLoaded(false);
    findDuplicates(root, { recursive: true }).then((r) => {
      setGroups(r);
      setLoaded(true);
    });
  }, [root]);

  const targets = () => (count > 0 ? groups.filter((g) => selected.has(g.hash)) : groups);

  async function apply() {
    const list = targets();
    if (list.length === 0) return;
    const copies = list.reduce((n, g) => n + g.files.length - 1, 0);
    if (
      !(await confirmAlert({
        title: `Trash ${copies} duplicate cop${copies > 1 ? "ies" : "y"}?`,
        message: `${root}\nOne copy of each file is kept; redundant copies go to ~/.Trash.`,
        primaryAction: { title: "Trash Copies" },
      }))
    )
      return;
    setBusy(true);
    try {
      push(
        <LiveProgress
          title="Trashing duplicates"
          icon="♻️"
          task={async (onP) => {
            const r = await dedupFiles(list, onP);
            showToast({ title: `Trashed ${r.trashed.length}`, style: Toast.Style.Success });
            return dedupMarkdown(r);
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
        title={count > 0 ? `▶ Trash ${count} selected sets` : `▶ Trash all ${groups.length} sets`}
        icon={Icon.Trash}
        actions={<ActionPanel><Action title="Dedupe" icon={Icon.Trash} style={Action.Style.Destructive} onAction={apply} /></ActionPanel>}
      />
      {groups.map((g) => (
        <List.Item
          key={g.hash}
          title={`${g.files.length}×  ${g.files[0].replace(root, ".")}`}
          subtitle={`${formatSize(g.size)} each · ${g.files.length - 1} redundant`}
          icon={Icon.ArrowClockwise}
          accessories={[selAccessory(selected.has(g.hash))]}
          actions={
            <ActionPanel>
              <Action
                title={selected.has(g.hash) ? "Deselect" : "Select"}
                icon={Icon.Checkmark}
                onAction={() => toggle(g.hash)}
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
  return <ScopePicker title="Dedupe" icon={Icon.ArrowClockwise} onPick={(scope, root) => push(<DedupView root={resolveScope(scope)} />)} />;
}
