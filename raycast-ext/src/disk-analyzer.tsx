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
  const [targetPath, setTargetPath] = useState(process.env.HOME || "");
  const [sortBy, setSortBy] = useState<"size" | "name">("size");

  return (
    <DiskList 
      path={targetPath} 
      onPathChange={setTargetPath}
      sortBy={sortBy}
      searchBarAccessory={
        <List.Dropdown tooltip="Target Intelligence" onChange={(v) => {
           if (v.startsWith("sort:")) setSortBy(v.split(":")[1] as any);
           else setTargetPath(v);
        }} storeValue>
          <List.Dropdown.Section title="Sort Telemetry">
            <List.Dropdown.Item title="Sort by Size (Large First)" value="sort:size" icon={Icon.ChevronDown} />
            <List.Dropdown.Item title="Sort by Name" value="sort:name" icon={Icon.Text} />
          </List.Dropdown.Section>
          <List.Dropdown.Section title="Sovereign Scopes">
            <List.Dropdown.Item title="Home (~)" value={process.env.HOME || ""} icon={Icon.Home} />
            <List.Dropdown.Item title="This Mac (/)" value="/" icon={Icon.HardDrive} />
          </List.Dropdown.Section>
          <List.Dropdown.Section title="Forensic Templates">
            <List.Dropdown.Item title="Downloads" value={`${process.env.HOME}/Downloads`} icon={Icon.Download} />
            <List.Dropdown.Item title="Developer" value={`${process.env.HOME}/Developer`} icon={Icon.Code} />
            <List.Dropdown.Item title="Documents" value={`${process.env.HOME}/Documents`} icon={Icon.TextDocument} />
            <List.Dropdown.Item title="Library" value={`${process.env.HOME}/Library`} icon={Icon.Box} />
          </List.Dropdown.Section>
        </List.Dropdown>
      }
    />
  );
}

function DiskList({ path: initialPath, sortBy, onPathChange, searchBarAccessory }: { path: string; sortBy: "size" | "name", onPathChange?: (p: string) => void, searchBarAccessory?: any }) {
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

  const sorted = [...items].sort((a, b) => {
     if (sortBy === "size") return b.size - a.size;
     return a.name.localeCompare(b.name);
  });

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
    sorted.slice(0, 20).forEach(item => {
      summary += `| ${item.name} | ${formatSize(item.size)} | ${item.isDir ? "Folder" : "File"} |\n`;
    });
    summary += `\n*Generated via Gravity Disk Forge*`;
    Clipboard.copy(summary);
    showToast({ title: "Summary Hoarded", message: "Copied top 20 items to clipboard" });
  };

  const copyBatchList = () => {
     const list = sorted.map(i => i.path).join("\n");
     Clipboard.copy(list);
     showToast({ title: "Paths Hoarded", message: `Copied ${items.length} paths.` });
  };

  return (
    <List 
      isLoading={isLoading} 
      searchBarPlaceholder={`Analyzing ${currentPath}...`}
      navigationTitle={currentPath.replace(process.env.HOME || "", "~")}
      searchBarAccessory={searchBarAccessory}
    >
      {sorted.map((item) => (
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
                  <Action.Push title="Drill Down" icon={Icon.ChevronRight} target={<DiskList path={item.path} sortBy={sortBy} />} />
                )}
                <Action.Open title="Open" target={item.path} />
                <Action.ShowInFinder title="Show in Finder" path={item.path} />
              </ActionPanel.Section>
              
              <ActionPanel.Section title="Sovereign Control">
                 <Action title="Copy AI Summary" icon={Icon.CopyClipboard} shortcut={{ modifiers: ["cmd", "shift"], key: "c" }} onAction={copySummary} />
                 <Action title="Copy All Paths" icon={Icon.List} shortcut={{ modifiers: ["cmd", "opt"], key: "c" }} onAction={copyBatchList} />
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
              </ActionPanel.Section>
            </ActionPanel>
          }
        />
      ))}
      <List.EmptyView title="This void is truly empty." description="No accessible files or folders found here." />
    </List>
  );
}
