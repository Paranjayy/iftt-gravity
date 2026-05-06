import { List, ActionPanel, Action, Icon, Color, showToast, Toast, ConfirmAlert } from "@raycast/api";
import { useState, useEffect } from "react";
import fetch from "node-fetch";

interface NodeModule {
  path: string;
  project: string;
  size: string;
  bytes: number;
}

export default function Command() {
  const [modules, setModules] = useState<NodeModule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());

  async function load() {
    setIsLoading(true);
    try {
      const res = await fetch("http://localhost:3031/archive/system/node-modules/scan");
      const data = await res.json() as NodeModule[];
      setModules(data.sort((a, b) => b.bytes - a.bytes));
    } catch (e) {
      showToast({ title: "Scanner Offline", style: Toast.Style.Failure });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function purge(paths: string[]) {
     const toast = await showToast({ title: "Purging Dependencies...", style: Toast.Style.Animated });
     try {
        await fetch("http://localhost:3031/archive/system/node-modules/purge", {
           method: "POST",
           body: JSON.stringify({ paths }),
           headers: { "Content-Type": "application/json" }
        });
        toast.style = Toast.Style.Success;
        toast.title = "Space Reclaimed";
        load();
        setSelectedPaths(new Set());
     } catch (e) {
        toast.style = Toast.Style.Failure;
        toast.title = "Purge Failed";
     }
  }

  const totalBytes = modules.reduce((sum, m) => sum + m.bytes, 0);
  const totalSizeStr = totalBytes > 1024 * 1024 * 1024 
     ? `${(totalBytes / (1024**3)).toFixed(1)} GB` 
     : `${(totalBytes / (1024**2)).toFixed(1)} MB`;

  return (
    <List 
      isLoading={isLoading} 
      searchBarPlaceholder="Reclaim Disk Space (Purge node_modules)..."
      navigationTitle={`Node Reaper - ${totalSizeStr} bloat detected`}
    >
      {modules.map((m) => (
        <List.Item
          key={m.path}
          title={m.project}
          subtitle={m.path.replace(process.env.HOME || "", "~")}
          icon={Icon.Box}
          accessories={[
             { text: m.size, color: m.bytes > 500 * 1024 * 1024 ? Color.Red : Color.SecondaryText }
          ]}
          actions={
            <ActionPanel title={m.project}>
              <ActionPanel.Section>
                <Action title="Purge This Module" icon={Icon.Trash} style={Action.Style.Destructive} onAction={async () => {
                   if (await ConfirmAlert({ title: "Evict Dependencies?", message: `Purge node_modules for ${m.project}?` })) {
                      purge([m.path]);
                   }
                }} />
                <Action title="Purge ALL Detected" icon={Icon.Bomb} style={Action.Style.Destructive} shortcut={{ modifiers: ["cmd", "shift"], key: "delete" }} onAction={async () => {
                   if (await ConfirmAlert({ title: "TOTAL EVACUATION?", message: `Purge ALL ${modules.length} modules (${totalSizeStr})?` })) {
                      purge(modules.map(i => i.path));
                   }
                }} />
              </ActionPanel.Section>
              <ActionPanel.Section title="Forensics">
                 <Action.ShowInFinder title="Show in Finder" path={m.path} />
                 <Action.Open title="Open Project" target={path.dirname(m.path)} />
              </ActionPanel.Section>
            </ActionPanel>
          }
        />
      ))}
      <List.EmptyView title="Pure Nirvana" description="No node_modules found in your developer scopes." icon={Icon.Checkmark} />
    </List>
  );
}

import path from "path";
