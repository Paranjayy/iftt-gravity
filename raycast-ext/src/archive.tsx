import { List, ActionPanel, Action, Icon, Color } from "@raycast/api";
import { useState, useEffect } from "react";
import fetch from "node-fetch";

interface ArchiveItem {
  id: string;
  text: string;
  timestamp: string;
}

export default function Command() {
  const [items, setItems] = useState<ArchiveItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    async function fetchArchive() {
      setIsLoading(true);
      try {
        const url = `http://localhost:3030/archive/search?q=${encodeURIComponent(searchText)}`;
        const response = await fetch(url);
        const data: any = await response.json();
        setItems(data || []);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    }
    fetchArchive();
  }, [searchText]);

  return (
    <List 
      isLoading={isLoading} 
      searchBarPlaceholder="Search infinite clipboard history..."
      onSearchTextChange={setSearchText}
      throttle
      isShowingDetail
    >
      {items.length === 0 ? (
        <List.EmptyView title="Nothing found" description="Try a different search or copy something new!" icon={Icon.MagnifyingGlass} />
      ) : (
        items.map((item) => (
          <List.Item
            key={item.id}
            icon={{ source: Icon.Clipboard, color: Color.Blue }}
            title={item.text.length > 50 ? `${item.text.substring(0, 50)}...` : item.text}
            subtitle={new Date(item.timestamp).toLocaleTimeString()}
            detail={
              <List.Item.Detail
                markdown={`### Content Preview\n\n\`\`\`\n${item.text}\n\`\`\`\n\n---\n**Captured:** ${new Date(item.timestamp).toLocaleString()}`}
                metadata={
                  <List.Item.Detail.Metadata>
                    <List.Item.Detail.Metadata.Label title="Characters" text={String(item.text.length)} />
                    <List.Item.Detail.Metadata.Label title="Source" icon={Icon.RaycastLogo} text="Gravity Sentry" />
                    <List.Item.Detail.Metadata.TagList title="Type">
                       <List.Item.Detail.Metadata.TagList.Item text="Clipboard" color={Color.Magenta} />
                    </List.Item.Detail.Metadata.TagList>
                  </List.Item.Detail.Metadata>
                }
              />
            }
            actions={
              <ActionPanel>
                <ActionPanel.Section>
                  <Action.CopyToClipboard title="Copy to Clipboard" content={item.text} shortcut={{ modifiers: ["cmd"], key: "." }} />
                  <Action.Paste title="Paste into Active App" content={item.text} shortcut={{ modifiers: ["cmd"], key: "enter" }} />
                </ActionPanel.Section>
              </ActionPanel>
            }
          />
        ))
      )}
    </List>
  );
}
