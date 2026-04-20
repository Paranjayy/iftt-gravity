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
    >
      {items.length === 0 ? (
        <List.EmptyView title="Nothing found" description="Try a different search or copy something new!" icon={Icon.MagnifyingGlass} />
      ) : (
        items.map((item) => (
          <List.Item
            key={item.id}
            icon={{ source: Icon.Clipboard, color: Color.Blue }}
            title={item.text.length > 100 ? `${item.text.substring(0, 100)}...` : item.text}
            subtitle={new Date(item.timestamp).toLocaleTimeString()}
            actions={
              <ActionPanel>
                <Action.CopyToClipboard title="Copy to Clipboard" content={item.text} />
                <Action.Paste title="Paste into Active App" content={item.text} />
              </ActionPanel>
            }
          />
        ))
      )}
    </List>
  );
}
