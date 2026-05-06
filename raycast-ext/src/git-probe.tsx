import { List, ActionPanel, Action, Icon, Color, showToast, Toast, open } from "@raycast/api";
import { useState, useEffect } from "react";
import fetch from "node-fetch";

interface GitRepo {
  name: string;
  path: string;
  remote?: string;
  isPublic?: boolean;
  hasPush?: boolean;
}

export default function Command() {
  const [repos, setRepos] = useState<GitRepo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "github" | "local">("all");

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
    return true;
  });

  return (
    <List 
      isLoading={isLoading} 
      searchBarPlaceholder="Probe Git Repositories..."
      searchBarAccessory={
        <List.Dropdown tooltip="VCS Intelligence" onChange={(v) => setFilter(v as any)} storeValue>
          <List.Dropdown.Item title="All Repos" value="all" icon={Icon.List} />
          <List.Dropdown.Item title="GitHub Synced" value="github" icon={Icon.Globe} />
          <List.Dropdown.Item title="Sovereign (Local Only)" value="local" icon={Icon.HardDrive} />
        </List.Dropdown>
      }
    >
      <List.Section title="Sovereign Repositories" subtitle={`${filtered.length} projects found`}>
        {filtered.map((repo) => (
          <List.Item
            key={repo.path}
            title={repo.name}
            subtitle={repo.path.replace(process.env.HOME || "", "~")}
            icon={repo.remote ? Icon.Globe : Icon.HardDrive}
            accessories={[
               { text: repo.remote?.includes("github.com") ? "GitHub" : repo.remote ? "Remote" : "Local", icon: repo.remote ? Icon.Link : Icon.Lock },
               { tag: { value: repo.isPublic ? "Public" : "Private", color: repo.isPublic ? Color.Green : Color.Orange } }
            ]}
            actions={
              <ActionPanel title={repo.name}>
                <Action.Open title="Open in VSCode" target={repo.path} icon={Icon.Code} />
                <Action.Open title="Open in Terminal" target={repo.path} icon={Icon.Terminal} />
                <Action.ShowInFinder title="Show in Finder" path={repo.path} />
                {repo.remote && <Action.OpenInBrowser title="Open on Remote" url={repo.remote.replace("git@", "https://").replace(":", "/").replace(".git", "")} />}
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
    </List>
  );
}
