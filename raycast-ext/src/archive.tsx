import { List, ActionPanel, Action, Icon, Color } from "@raycast/api";
import { useState, useEffect } from "react";
import fetch from "node-fetch";

interface ArchiveItem {
  id: string;
  text: string;
  timestamp: string;
  isBookmarked?: boolean;
  label?: string;
  meta?: {
    words: number;
    lines: number;
    type: string;
  };
}

export default function Command() {
  const [items, setItems] = useState<ArchiveItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [filter, setFilter] = useState("recent");

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

  useEffect(() => {
    fetchArchive();
  }, [searchText, filter]);

  async function toggleBookmark(id: string) {
    await fetch(`http://localhost:3030/archive/bookmark/${id}`);
    await fetchArchive();
  }

  async function addLabel(id: string) {
    const label = await showInput({ title: "Custom Label", placeholder: "e.g. My SSH Key" });
    if (label !== undefined) {
      await fetch(`http://localhost:3030/archive/label/${id}?label=${encodeURIComponent(label)}`);
      await fetchArchive();
    }
  }

  async function promote(id: string) {
    await fetch(`http://localhost:3030/archive/promote/${id}`);
    await showToast({ title: "Promoted to Manifest", style: Toast.Style.Success });
  }

  async function deleteItem(id: string) {
    await fetch(`http://localhost:3030/archive/delete/${id}`);
    await fetchArchive();
  }

  const pinned = items.filter(i => i.isBookmarked);
  const others = items.filter(i => !i.isBookmarked);

  // 🕰️ Temporal Grouping Logic
  const now = new Date();
  const today = others.filter(i => new Date(i.timestamp).toDateString() === now.toDateString());
  const yesterday = others.filter(i => {
    const d = new Date(i.timestamp);
    const yest = new Date();
    yest.setDate(now.getDate() - 1);
    return d.toDateString() === yest.toDateString();
  });
  const earlier = others.filter(i => {
    const d = new Date(i.timestamp);
    const yest = new Date();
    yest.setDate(now.getDate() - 1);
    return d < yest && d.toDateString() !== yest.toDateString();
  });

  const [stack, setStack] = useState<ArchiveItem[]>([]);

  function addToStack(item: ArchiveItem) {
    setStack([...stack, item]);
    showToast({ title: "Added to Stack", description: `${stack.length + 1} items queued` });
  }

  const renderItem = (item: ArchiveItem) => (
    <List.Item
      key={item.id}
      icon={{ source: item.isBookmarked ? Icon.Star : Icon.Clipboard, color: item.isBookmarked ? Color.Yellow : Color.Blue }}
      title={item.label || item.text.trim().split('\n')[0].substring(0, 50)}
      subtitle={item.label ? item.text.substring(0, 30).trim() : ""}
      accessories={[
         { text: item.meta?.type?.toUpperCase() || "TEXT", icon: item.meta?.type === 'code' ? Icon.Code : Icon.Text },
         { text: new Date(item.timestamp).toLocaleTimeString(), icon: Icon.Clock }
      ]}
      detail={
        <List.Item.Detail
          markdown={`#### Preview\n\`\`\`${item.meta?.type || 'text'}\n${item.text}\n\`\`\`\n\n---\n**Capture Date:** ${new Date(item.timestamp).toLocaleString()}`}
          metadata={
            <List.Item.Detail.Metadata>
              <List.Item.Detail.Metadata.Label title="Identifier" text={item.label || "No Label"} />
              <List.Item.Detail.Metadata.Label title="Format" text={item.meta?.type?.toUpperCase() || "TEXT"} />
              <List.Item.Detail.Metadata.Separator />
              <List.Item.Detail.Metadata.Label title="Tokens (AI)" text={String(item.meta?.tokens || 0)} />
              <List.Item.Detail.Metadata.Label title="Words" text={String(item.meta?.words || 0)} />
              <List.Item.Detail.Metadata.Label title="Lines" text={String(item.meta?.lines || 0)} />
              <List.Item.Detail.Metadata.Separator />
              <List.Item.Detail.Metadata.Label title="Status" icon={item.isBookmarked ? Icon.Pin : Icon.Circle} text={item.isBookmarked ? "Pinned to Vault" : "Active History"} />
            </List.Item.Detail.Metadata>
          }
        />
      }
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            <Action.CopyToClipboard title="Copy and Close" content={item.text} />
            <Action.Paste title="Direct Paste" content={item.text} />
            <Action 
              title="Add to Paste Stack" 
              icon={Icon.Layers} 
              onAction={() => addToStack(item)} 
              shortcut={{ modifiers: ["cmd"], key: "s" }}
            />
          </ActionPanel.Section>
          <ActionPanel.Section title="Management">
            <Action 
              title={item.isBookmarked ? "Unpin from Top" : "Pin to Top"} 
              icon={Icon.Star} 
              onAction={() => toggleBookmark(item.id)} 
              shortcut={{ modifiers: ["cmd"], key: "b" }}
            />
            <Action 
              title="Assign Label" 
              icon={Icon.Pencil} 
              onAction={() => addLabel(item.id)} 
              shortcut={{ modifiers: ["cmd"], key: "l" }}
            />
             <Action 
              title="Promote to Manifest" 
              icon={Icon.Rocket} 
              onAction={() => promote(item.id)} 
              shortcut={{ modifiers: ["cmd"], key: "p" }}
            />
          </ActionPanel.Section>
          <ActionPanel.Section title="Cleanup">
            <Action 
              title="Delete Forever" 
              icon={Icon.Trash} 
              style={Action.Style.Destructive}
              onAction={() => deleteItem(item.id)} 
              shortcut={{ modifiers: ["ctrl"], key: "x" }}
            />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );

  return (
    <List 
      isLoading={isLoading} 
      searchBarPlaceholder="Search infinite clipboard history..."
      onSearchTextChange={setSearchText}
      isShowingDetail={true}
      searchBarAccessory={
        <List.Dropdown
          tooltip="Filter Archive"
          storeValue={true}
          onChange={(newValue) => setFilter(newValue)}
        >
          <List.Dropdown.Item title="All History" value="all" icon={Icon.List} />
          <List.Dropdown.Item title="Today's Work" value="today" icon={Icon.Calendar} />
          <List.Dropdown.Item title="Pinned Items" value="bookmarks" icon={Icon.Star} />
          <List.Dropdown.Item title="Code Snippets" value="code" icon={Icon.Code} />
          <List.Dropdown.Item title="Links Only" value="link" icon={Icon.Link} />
        </List.Dropdown>
      }
    >
      {pinned.length > 0 && <List.Section title="Pinned">{pinned.map(renderItem)}</List.Section>}
      {today.length > 0 && <List.Section title="Today">{today.map(renderItem)}</List.Section>}
      {yesterday.length > 0 && <List.Section title="Yesterday">{yesterday.map(renderItem)}</List.Section>}
      {earlier.length > 0 && <List.Section title="Earlier History">{earlier.map(renderItem)}</List.Section>}
    </List>
  );
}
