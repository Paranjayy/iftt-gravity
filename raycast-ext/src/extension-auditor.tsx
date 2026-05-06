import { List, ActionPanel, Action, Icon, Color, showToast, Toast } from "@raycast/api";
import { useState, useEffect } from "react";
import fetch from "node-fetch";

interface Extension {
  name: string;
  title: string;
  description: string;
  author: string;
  size: string;
  path: string;
}

export default function Command() {
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  async function load() {
    setIsLoading(true);
    try {
      const res = await fetch("http://localhost:3031/archive/extensions/list");
      const data = await res.json() as Extension[];
      setExtensions(data.sort((a, b) => {
         const sizeA = parseFloat(a.size);
         const sizeB = parseFloat(b.size);
         return sizeB - sizeA;
      }));
    } catch (e) {
      showToast({ title: "Auditor Offline", style: Toast.Style.Failure });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Audit Raycast Extensions Bloat...">
      {extensions.map((ext) => (
        <List.Item
          key={ext.path}
          title={ext.title || ext.name}
          subtitle={ext.description}
          icon={Icon.Box}
          accessories={[
            { text: ext.size, color: parseFloat(ext.size) > 10 ? Color.Red : Color.SecondaryText },
            { text: ext.author, icon: Icon.Person }
          ]}
          actions={
            <ActionPanel>
              <Action.ShowInFinder title="Show in Finder" path={ext.path} />
              <Action title="Refresh Audit" icon={Icon.RotateClockwise} onAction={load} />
              <Action.CopyToClipboard title="Copy Extension Path" content={ext.path} />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
