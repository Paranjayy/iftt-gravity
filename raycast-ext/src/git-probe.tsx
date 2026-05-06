import { List, ActionPanel, Action, Icon, Color, showToast, Toast, open, Clipboard } from "@raycast/api";
import { useState, useEffect } from "react";
import fetch from "node-fetch";

interface GitRepo {
  name: string;
  path: string;
  remote?: string;
  isPublic?: boolean;
  hasChanges?: boolean;
  size?: string;
  ahead?: number;
  behind?: number;
}

export default function Command() {
  const [repos, setRepos] = useState<GitRepo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "github" | "local" | "dirty" | "unpushed">("all");

  async function load() {
    setIsLoading(true);
    try {
      const res = await fetch("http://localhost:3031/archive/git/list");
      const data = await res.json() as GitRepo[];
      setRepos(data);
    } catch (e) {
      showToast({ title: "Git Hub Offline", style: Toast.Style.Failure });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = repos.filter(r => {
    if (filter === "github") return r.remote?.includes("github.com");
    if (filter === "local") return !r.remote;
    if (filter === "dirty") return r.hasChanges;
    if (filter === "unpushed") return (r.ahead || 0) > 0;
    return true;
  });

  return (
    <List 
      isLoading={isLoading} 
      searchBarPlaceholder="Probe Git Repositories..."
      searchBarAccessory={
        <List.Dropdown tooltip="VCS Intelligence" onChange={(v) => setFilter(v as any)} storeValue>
          <List.Dropdown.Section title="Sync Status">
            <List.Dropdown.Item title="All Repos" value="all" icon={Icon.List} />
            <List.Dropdown.Item title="Dirty (Uncommitted)" value="dirty" icon={Icon.Pencil} />
            <List.Dropdown.Item title="Unpushed Commits" value="unpushed" icon={Icon.Cloud} />
          </List.Dropdown.Section>
          <List.Dropdown.Section title="Visibility">
            <List.Dropdown.Item title="GitHub Synced" value="github" icon={Icon.Globe} />
            <List.Dropdown.Item title="Sovereign (Local Only)" value="local" icon={Icon.HardDrive} />
          </List.Dropdown.Section>
        </List.Dropdown>
      }
    >
      <List.Section title="Sovereign Repositories" subtitle={`${filtered.length} projects found`}>
        {filtered.map((repo) => (
          <List.Item
            key={repo.path}
            title={repo.name}
            subtitle={`${repo.size || ""} • ${repo.path.replace(process.env.HOME || "", "~")}`}
            icon={repo.remote ? Icon.Globe : Icon.HardDrive}
            accessories={[
               { text: repo.ahead ? `↑ ${repo.ahead}` : "", color: Color.Orange },
               { text: repo.behind ? `↓ ${repo.behind}` : "", color: Color.Blue },
               { icon: repo.hasChanges ? { source: Icon.Circle, color: Color.Yellow } : undefined, tooltip: "Uncommitted Changes" },
               { tag: { value: repo.isPublic ? "Public" : "Private", color: repo.isPublic ? Color.Green : Color.Orange } }
            ]}
            actions={
              <ActionPanel title={repo.name}>
                <Action.Open title="Open in VSCode" target={repo.path} icon={Icon.Code} />
                <Action.Open title="Open in Terminal" target={repo.path} icon={Icon.Terminal} />
                <Action.ShowInFinder title="Show in Finder" path={repo.path} />
                {repo.remote && <Action.OpenInBrowser title="Open on Remote" url={repo.remote.replace("git@", "https://").replace(":", "/").replace(".git", "")} />}
                <Action title="Copy Project Summary" icon={Icon.CopyClipboard} onAction={() => {
                   const summary = `### 🛰️ Git Project: ${repo.name}\n- **Path:** ${repo.path}\n- **Size:** ${repo.size}\n- **Sync:** ${repo.ahead} ahead, ${repo.behind} behind\n- **Status:** ${repo.hasChanges ? "Dirty" : "Clean"}`;
                   Clipboard.copy(summary);
                   showToast({ title: "Summary Hoarded" });
                }} />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
    </List>
  );
}
