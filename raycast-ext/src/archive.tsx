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
  const [filter, setFilter] = useState("recent");

  useEffect(() => {
    async function fetchArchive() {
      setIsLoading(true);
      try {
        const url = `http://localhost:3030/archive/search?q=${encodeURIComponent(searchText)}&filter=${filter}`;
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
  }, [searchText, filter]);

  return (
    <List 
      isLoading={isLoading} 
      searchBarPlaceholder="Search infinite clipboard history..."
      onSearchTextChange={setSearchText}
      isShowingDetail={true}
      searchBarAccessory={
        <List.Dropdown
          tooltip="Filter Search Range"
          storeValue={true}
          onChange={(newValue) => setFilter(newValue)}
        >
          <List.Dropdown.Item title="Recent Clips" value="recent" icon={Icon.Clock} />
          <List.Dropdown.Item title="Today Only" value="today" icon={Icon.Calendar} />
          <List.Dropdown.Item title="Deep History" value="all" icon={Icon.List} />
        </List.Dropdown>
      }
    >
      {items.length === 0 ? (
        <List.EmptyView title="Nothing found" description="Try a different search or copy something new!" icon={Icon.MagnifyingGlass} />
      ) : (
        items.map((item) => (
          <List.Item
            key={item.id}
            icon={{ source: Icon.Clipboard, color: Color.Blue }}
            title={item.text.trim().split('\n')[0].substring(0, 50)}
            accessories={[{ text: new Date(item.timestamp).toLocaleTimeString(), icon: Icon.Clock }]}
            detail={
              <List.Item.Detail
                markdown={`#### Content\n\`\`\`\n${item.text}\n\`\`\`\n\n---\n**Captured:** ${new Date(item.timestamp).toLocaleString()}`}
                metadata={
                  <List.Item.Detail.Metadata>
                    <List.Item.Detail.Metadata.Label title="Length" text={`${item.text.length} chars`} />
                    <List.Item.Detail.Metadata.Separator />
                    <List.Item.Detail.Metadata.Label title="Source" icon={Icon.RaycastLogo} text="Gravity Archive" />
                  </List.Item.Detail.Metadata>
                }
              />
            }
            actions={
              <ActionPanel>
                <ActionPanel.Section>
                  <Action.CopyToClipboard title="Copy to Clipboard" content={item.text} />
                  <Action.Paste title="Paste into App" content={item.text} />
                </ActionPanel.Section>
              </ActionPanel>
            }
          />
        ))
      )}
    </List>
  );
}
