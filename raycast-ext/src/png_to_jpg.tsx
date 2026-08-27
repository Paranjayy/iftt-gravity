import { ActionPanel, Action, Icon, Detail, confirmAlert, showToast, Toast, useNavigation, List } from "@raycast/api";
import { useState } from "react";
import { convertPngToJpg, convertMarkdown, resolveScope } from "./fileops";
import { ScopePicker } from "./scope-picker";

function ConvertView({ root }: { root: string }) {
  const [quality, setQuality] = useState("80");
  const [busy, setBusy] = useState(false);
  const { push } = useNavigation();

  async function run() {
    if (
      !(await confirmAlert({
        title: "Convert PNG → JPG?",
        message: `${root}\nRecursive. Originals are deleted only after a successful conversion; errors keep their PNG.`,
        primaryAction: { title: "Convert" },
      }))
    )
      return;
    setBusy(true);
    try {
      const report = await convertPngToJpg(root, { recursive: true, quality: parseInt(quality, 10) });
      showToast({ title: `Converted ${report.converted.length} PNGs`, style: Toast.Style.Success });
      push(<Detail markdown={convertMarkdown(report)} />);
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
        <List.Dropdown tooltip="JPG Quality" value={quality} onChange={setQuality} storeValue>
          <List.Dropdown.Item title="High (90)" value="90" />
          <List.Dropdown.Item title="Balanced (80)" value="80" />
          <List.Dropdown.Item title="Small (60)" value="60" />
          <List.Dropdown.Item title="Tiny (40)" value="40" />
        </List.Dropdown>
      }
    >
      <List.Item
        title="Convert PNG → JPG"
        subtitle={root}
        icon={Icon.Image}
        accessories={[{ text: `quality ${quality}` }]}
        actions={
          <ActionPanel>
            <Action title="Convert" icon={Icon.Wand} onAction={run} />
          </ActionPanel>
        }
      />
    </List>
  );
}

export default function Command() {
  const { push } = useNavigation();
  return <ScopePicker title="Convert" icon={Icon.Image} onPick={(scope, root) => push(<ConvertView root={resolveScope(scope)} />)} />;
}
