import { List, ActionPanel, Action, Icon, Typography } from "@raycast/api";
import { useState, useEffect } from "react";
import fetch from "node-fetch";

interface VaultItem {
  id: string;
  text: string;
  timestamp: string;
  type: "clipboard" | "note";
}

export default function Command() {
  const [items, setItems] = useState<VaultItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchArchive() {
      try {
        const response = await fetch("http://localhost:3030/status");
        const data: any = await response.json();
        // Assuming the hub provides a list of archived items
        setItems(data?.stats?.vault || []);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    }
    fetchArchive();
  }, []);

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search your Gravity Archive...">
      {items.length === 0 ? (
        <List.EmptyView title="No items found" description="Clipboard history will appear here once Gravity starts tracking." icon={Icon.Box} />
      ) : (
        items.map((item) => (
          <List.Item
            key={item.id}
            icon={item.type === "clipboard" ? Icon.Clipboard : Icon.Text}
            title={item.text}
            subtitle={new Date(item.timestamp).toLocaleString()}
            actions={
              <ActionPanel>
                <Action.CopyToClipboard content={item.text} />
                <Action.Paste content={item.text} />
              </ActionPanel>
            }
          />
        ))
      )}
    </List>
  );
}
