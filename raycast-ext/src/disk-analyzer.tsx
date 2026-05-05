import { List, ActionPanel, Action, Icon, Color, Detail, showToast, Toast, useNavigation, Clipboard, ConfirmAlert } from "@raycast/api";
import { useState, useEffect } from "react";
import fetch from "node-fetch";

interface DiskItem {
  name: string;
  path: string;
  size: number;
  isDir: boolean;
}

export default function Command() {
  return <DiskList path="" />;
}

function DiskList({ path: initialPath }: { path: string }) {
  const [items, setItems] = useState<DiskItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const currentPath = initialPath || (process.env.HOME || "");

  async function load() {
    setIsLoading(true);
    try {
      const res = await fetch(`http://localhost:3031/archive/disk/scan?path=${encodeURIComponent(currentPath)}`);
      const data = await res.json() as DiskItem[];
      setItems(data);
    } catch (e) {
      showToast({ title: "Scan Failed", style: Toast.Style.Failure });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { load(); }, [currentPath]);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const copySummary = () => {
    let summary = `### 💿 Storage Analysis: ${currentPath}\n\n`;
    summary += `| Item | Size | Type |\n| :--- | :--- | :--- |\n`;
    items.slice(0, 15).forEach(item => {
      summary += `| ${item.name} | ${formatSize(item.size)} | ${item.isDir ? "Folder" : "File"} |\n`;
    });
    summary += `\n*Generated via Gravity Disk Forge*`;
    Clipboard.copy(summary);
    showToast({ title: "Summary Hoarded", message: "Copied top 15 items to clipboard" });
  };

  return (
    <List 
      isLoading={isLoading} 
      searchBarPlaceholder={`Analyzing ${currentPath}...`}
      navigationTitle={currentPath.replace(process.env.HOME || "", "~")}
    >
      {items.map((item) => (
        <List.Item
          key={item.path}
          title={item.name}
          subtitle={formatSize(item.size)}
          icon={item.isDir ? Icon.Folder : Icon.Document}
          accessories={[{ text: item.isDir ? "Drill Down" : "", icon: item.isDir ? Icon.ChevronRight : undefined }]}
          actions={
            <ActionPanel title={item.name}>
              <ActionPanel.Section>
                {item.isDir && (
                  <Action.Push title="Drill Down" icon={Icon.ChevronRight} target={<DiskList path={item.path} />} />
                )}
                <Action.Open title="Open" target={item.path} />
                <Action.ShowInFinder title="Show in Finder" path={item.path} />
              </ActionPanel.Section>
              
              <ActionPanel.Section title="Purge & Archive">
                 <Action title="Move to Trash" icon={Icon.Trash} style={Action.Style.Destructive} shortcut={{ modifiers: ["cmd"], key: "delete" }} onAction={async () => {
                    if (await ConfirmAlert({ title: "Sovereign Purge?", message: `Are you sure you want to evict ${item.name} to the trash?` })) {
                       await fetch("http://localhost:3031/archive/files/delete", {
                          method: "POST",
                          body: JSON.stringify({ path: item.path }),
                          headers: { "Content-Type": "application/json" }
                       });
                       showToast({ title: "Item Evicted" });
                       load();
                    }
                 }} />
                 <Action.Push title="Add to Daily Note" icon={Icon.Plus} target={<EntryAction name="" type="append" onUpdate={() => {}} initialText={`Large Asset: ${item.path} (${formatSize(item.size)})`} />} />
              </ActionPanel.Section>

              <ActionPanel.Section title="Forensics">
                 <Action title="Copy AI Summary" icon={Icon.CopyClipboard} shortcut={{ modifiers: ["cmd", "shift"], key: "c" }} onAction={copySummary} />
                 <Action.CopyToClipboard title="Copy Full Path" content={item.path} shortcut={{ modifiers: ["cmd", "opt"], key: "c" }} />
              </ActionPanel.Section>
            </ActionPanel>
          }
        />
      ))}
      <List.EmptyView title="This void is truly empty." description="No accessible files or folders found here." />
    </List>
  );
}

// Re-using EntryAction from notes.tsx or similar
function EntryAction({ name, type, onUpdate, initialText = "" }: { name: string; type: "append" | "prepend"; onUpdate: () => void, initialText?: string }) {
  const { pop } = useNavigation();
  const dailyNoteName = `Daily Note ${new Date().toISOString().split('T')[0]}.md`;
  const targetName = name || dailyNoteName;

  return (
    <List // Dummy list just to have an action panel if needed, but Form is better.
      actions={
        <ActionPanel>
          <Action.Push title="Open Form" target={
            <DiskForm name={targetName} type={type} onUpdate={onUpdate} initialText={initialText} pop={pop} />
          } />
        </ActionPanel>
      }
    />
  );
}

import { Form } from "@raycast/api";

function DiskForm({ name, type, onUpdate, initialText, pop }: any) {
  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Seal Fragment" icon={Icon.Check} onSubmit={async (values: { text: string }) => {
            await fetch(`http://localhost:3031/archive/notes/${type}`, {
              method: "POST",
              body: JSON.stringify({ name, text: values.text }),
              headers: { "Content-Type": "application/json" }
            });
            showToast({ title: "Fragment Saved", style: Toast.Style.Success });
            onUpdate();
            pop();
          }} />
        </ActionPanel>
      }
    >
      <Form.TextArea id="text" title="Fragment" defaultValue={initialText} autoFocus enableMarkdown />
    </Form>
  );
}
