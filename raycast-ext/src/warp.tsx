import { List, ActionPanel, Action, Icon, Color, showToast, Toast, open } from "@raycast/api";
import { useState, useEffect } from "react";
import fetch from "node-fetch";

interface Project {
  name: string;
  path: string;
  lastModified: string;
}

export default function Command() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  async function load() {
    setIsLoading(true);
    try {
      const res = await fetch("http://localhost:3031/archive/warp/list");
      const data = await res.json() as Project[];
      setProjects(data.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()));
    } catch (e) {
      showToast({ title: "Warp Drive Offline", style: Toast.Style.Failure });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Warp to Project (Developer/)...">
      {projects.map((p) => (
        <List.Item
          key={p.path}
          title={p.name}
          subtitle={p.path}
          icon={Icon.Folder}
          accessories={[
            { text: new Date(p.lastModified).toLocaleDateString(), icon: Icon.Clock }
          ]}
          actions={
            <ActionPanel>
              <Action title="Open in VSCode" icon={Icon.Code} onAction={() => open(p.path, "com.microsoft.VSCode")} />
              <Action.ShowInFinder title="Show in Finder" path={p.path} />
              <Action.OpenInTerminal title="Open in Terminal" path={p.path} />
              <Action.CopyToClipboard title="Copy Path" content={p.path} />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
