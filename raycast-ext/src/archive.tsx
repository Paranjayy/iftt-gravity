import { List, ActionPanel, Action, Icon, Color, Detail, showToast, Toast, open, Image, useNavigation, Form } from "@raycast/api";
import { useState, useEffect } from "react";
import fetch from "node-fetch";

interface ArchiveItem {
  id: string;
  text: string;
  timestamp: string;
  isBookmarked: boolean;
  label?: string;
  source?: string;
  url?: string;
  meta: {
    words: number;
    lines: number;
    chars: number;
    tokens?: number;
    type: "text" | "link" | "code" | "jot" | "image" | "file" | "app";
    ogTitle?: string;
    ogImage?: string;
    ogDescription?: string;
    favicon?: string;
    dupes?: number;
  };
}

export default function Command() {
  const [clips, setClips] = useState<ArchiveItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [filter, setFilter] = useState<"all" | "today" | "jot" | "bookmarks" | "code" | "link">("all");

  async function fetchArchive() {
    try {
      const res = await fetch("http://localhost:3031/archive");
      const data = await res.json() as ArchiveItem[];
      setClips(data);
    } catch (e) {
      showToast({ title: "Failed to connect to Gravity Archive", style: Toast.Style.Failure });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchArchive();
    const interval = setInterval(fetchArchive, 5000); // Pulse every 5s
    return () => clearInterval(interval);
  }, [searchText, filter]);

  async function toggleBookmark(id: string) {
    await fetch(`http://localhost:3031/archive/bookmark/${id}`);
    fetchArchive();
  }

  async function deleteClip(id: string) {
    await fetch(`http://localhost:3031/archive/delete/${id}`);
    fetchArchive();
  }

  const filteredClips = clips.filter((item) => {
    const searchMatch = item.text.toLowerCase().includes(searchText.toLowerCase()) || 
                      (item.label || "").toLowerCase().includes(searchText.toLowerCase());
    
    if (!searchMatch) return false;
    if (filter === "all") return true;
    if (filter === "bookmarks") return item.isBookmarked;
    if (filter === "today") {
       const today = new Date().toDateString();
       return new Date(item.timestamp).toDateString() === today;
    }
    if (filter === "jot") return item.meta.type === "jot";
    if (filter === "code") return item.meta.type === "code";
    if (filter === "link") return item.meta.type === "link";
    return true;
  });

  const getIcon = (item: ArchiveItem) => {
    if (item.isBookmarked) return { source: Icon.Star, color: Color.Yellow };
    
    // Favicon Priority for Browser Content
    if (item.meta?.favicon) return { source: item.meta.favicon, mask: Image.Mask.RoundedRectangle };

    // App Origin Icon (v9.4.0 High-Fidelity)
    if (item.source && item.source !== "System" && item.source !== "Unknown") {
       return { source: { fileIcon: `/Applications/${item.source}.app` } };
    }
    
    // Type-specific icons
    const type = item.meta?.type || 'text';
    switch (type) {
      case 'link': 
        return { source: Icon.Link, color: Color.Blue };
      case 'image':
      case 'design':
        return { source: Icon.Image, color: Color.Purple };
      case 'code':
        return { source: Icon.Terminal, color: Color.Orange };
      case 'jot':
        return { source: Icon.Pencil, color: Color.Green };
      case 'file':
      case 'app':
        return { source: Icon.Folder, color: Color.SecondaryText };
      default:
        if (item.text.match(/^#(?:[0-9a-fA-F]{3}){1,2}$/)) return { source: Icon.CircleFilled, color: item.text };
        return { source: Icon.Clipboard, color: Color.Blue };
    }
  };

  const getPreviewMarkdown = (item: ArchiveItem) => {
    if (item.meta.type === 'image' || item.meta.type === 'link') {
       if (item.meta.ogImage) return `![OG Image](${item.meta.ogImage})\n\n### ${item.meta.ogTitle || 'Linked Item'}\n${item.meta.ogDescription || item.text}`;
    }
    
    // Default Code/Text Preview
    const lang = item.meta?.type === 'code' ? 'typescript' : 'text';
    const originText = item.url ? `**URL:** ${item.url}` : `**Origin:** ${item.source || 'Unknown'}`;
    return `#### Content Preview\n\`\`\`${lang}\n${item.text}\n\`\`\`\n\n---\n${originText}`;
  };

  const renderItem = (item: ArchiveItem) => (
    <List.Item
        key={item.id}
        icon={getIcon(item)}
        title={item.label || item.text.trim().split('\n')[0].substring(0, 70)}
        subtitle={item.label ? item.text.substring(0, 30).trim() : ""}
        detail={
          !item ? null : (
          <List.Item.Detail
            markdown={getPreviewMarkdown(item)}
            metadata={
              <List.Item.Detail.Metadata>
                <List.Item.Detail.Metadata.Label title="Origin App" text={item.source || "System"} icon={{ fileIcon: `/Applications/${item.source}.app` }} />
                {item.url && (
                  <List.Item.Detail.Metadata.Link 
                    title="Source URL" 
                    text={item.url.substring(0, 40) + "..."} 
                    target={item.url} 
                    icon={item.meta?.favicon ? { source: item.meta.favicon, mask: Image.Mask.Circle } : Icon.Globe}
                  />
                )}
                <List.Item.Detail.Metadata.Label title="Format" text={item.meta?.type?.toUpperCase() || "TEXT"} />
                <List.Item.Detail.Metadata.Label title="Captured" text={new Date(item.timestamp).toLocaleString()} icon={Icon.Clock} />
                <List.Item.Detail.Metadata.Separator />
                <List.Item.Detail.Metadata.Label title="Characters" text={String(item.meta?.chars || item.text.length)} />
                <List.Item.Detail.Metadata.Label title="Words" text={String(item.meta?.words || 0)} />
                <List.Item.Detail.Metadata.Label title="Lines" text={String(item.meta?.lines || 0)} />
                <List.Item.Detail.Metadata.Label title="Token Count" text={String(item.meta?.tokens || 0)} />
                {(item.meta?.dupes || 0) > 0 && <List.Item.Detail.Metadata.Label title="Duplicates" text={String(item.meta.dupes)} icon={Icon.Repeat} />}
                <List.Item.Detail.Metadata.Label title="Status" icon={item.isBookmarked ? Icon.Pin : Icon.Circle} text={item.isBookmarked ? "Pinned" : "Active"} />
              </List.Item.Detail.Metadata>
            }
          />
          )
        }
      actions={
        <ActionPanel>
          <Action.CopyToClipboard title="Hoard Record" content={item.text} />
          <Action title={item.isBookmarked ? "Unpin" : "Pin Record"} icon={Icon.Pin} onAction={() => toggleBookmark(item.id)} />
          <Action.Push title="Identify Record" icon={Icon.Tag} target={<LabelForm id={item.id} onComplete={fetchArchive} />} />
          <Action.Push title="Edit Note" icon={Icon.Pencil} target={<EditForm item={item} onUpdate={fetchArchive} />} />
          <ActionPanel.Section title="Sovereign Control">
             <Action icon={Icon.Trash} title="Purge Record" style={Action.Style.Destructive} onAction={() => deleteClip(item.id)} />
             <Action icon={Icon.Globe} title="Open Source URL" onAction={() => item.url && open(item.url)} />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );

  // Grouping Logic (v9.8.0 Intelligence)
  const groupedItems = filteredClips.reduce((acc, item) => {
    const source = item.source || 'Unknown';
    if (!acc[source]) acc[source] = [];
    acc[source].push(item);
    return acc;
  }, {} as Record<string, ArchiveItem[]>);

  return (
    <List
      isLoading={isLoading}
      searchText={searchText}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder={`Search ${clips.length} fragments in vault...`}
      isShowingDetail={clips.length > 0}
      searchBarAccessory={
        <List.Dropdown
          tooltip="Filter Intelligence"
          storeValue={true}
          onChange={(newValue) => setFilter(newValue as any)}
        >
          <List.Dropdown.Item title="All History" value="all" icon={Icon.Bullseye} />
          <List.Dropdown.Item title="Pinned Records" value="bookmarks" icon={Icon.Pin} />
          <List.Dropdown.Item title="Today's Hoards" value="today" icon={Icon.Clock} />
          <List.Dropdown.Item title="Quick Jots" value="jot" icon={Icon.Pencil} />
          <List.Dropdown.Item title="Code Vault" value="code" icon={Icon.Terminal} />
          <List.Dropdown.Item title="Intelligence Links" value="link" icon={Icon.Globe} />
        </List.Dropdown>
      }
    >
      {Object.entries(groupedItems).map(([source, items]) => (
        <List.Section key={source} title={source} subtitle={`${items.length} items`}>
          {items.map(renderItem)}
        </List.Section>
      ))}
      
      {clips.length === 0 && !isLoading && (
        <List.EmptyView title="No fragments found in the void." description="Start hoarding intelligence to populate the vault." icon={Icon.Tray} />
      )}
    </List>
  );
}

function LabelForm(props: { id: string; onComplete: () => void }) {
  const { pop } = useNavigation();

  async function handleSubmit(values: { label: string }) {
    await fetch(`http://localhost:3031/archive/label/${props.id}?label=${encodeURIComponent(values.label)}`);
    showToast({ title: "Identified", style: Toast.Style.Success });
    props.onComplete();
    pop();
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Identify Clip" icon={Icon.Check} onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField id="label" title="Custom Label" placeholder="e.g. My SSH Key" />
    </Form>
  );
}

function EditForm({ item, onUpdate }: { item: ArchiveItem, onUpdate: () => void }) {
  const { pop } = useNavigation();
  async function handleSubmit(values: { text: string }) {
    await fetch(`http://localhost:3031/archive/update/${item.id}?text=${encodeURIComponent(values.text)}`);
    onUpdate();
    pop();
    showToast({ title: "Updated Note", style: Toast.Style.Success });
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save Note" onSubmit={handleSubmit} icon={Icon.Check} />
        </ActionPanel>
      }
    >
      <Form.TextArea id="text" title="Note Content" defaultValue={item.text} />
    </Form>
  );
}
