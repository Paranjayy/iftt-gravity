import { List, ActionPanel, Action, Icon, Color, showInput, showToast, Toast, Form, useNavigation, Clipboard, Image } from "@raycast/api";
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
    tokens: number;
    type: string;
    ogTitle?: string;
    ogImage?: string;
    favicon?: string;
  };
  source?: string;
}

export default function Command() {
  const [items, setItems] = useState<ArchiveItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [filter, setFilter] = useState("recent");
  const [totalCount, setTotalCount] = useState(0);

  async function fetchArchive() {
    setIsLoading(true);
    try {
      const url = `http://localhost:3031/archive/search?q=${encodeURIComponent(searchText)}&filter=${filter}`;
      const response = await fetch(url);
      const total = response.headers.get('X-Total-Count');
      if (total) setTotalCount(parseInt(total));
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
    await fetch(`http://localhost:3031/archive/bookmark/${id}`);
    await fetchArchive();
  }

  async function addLabel(id: string) {
    push(<LabelForm id={id} onComplete={fetchArchive} />);
  }

  async function promote(id: string) {
    await fetch(`http://localhost:3031/archive/promote/${id}`);
    await showToast({ title: "Promoted to Manifest", style: Toast.Style.Success });
  }

  async function deleteItem(id: string) {
    await fetch(`http://localhost:3031/archive/delete/${id}`);
    await fetchArchive();
  }

  async function editContent(item: ArchiveItem) {
    push(<EditForm item={item} onUpdate={fetchArchive} />);
  }

  const { push } = useNavigation();

  // 🕰️ Temporal Grouping Logic
  const pinned = items.filter(i => i.isBookmarked);
  const others = items.filter(i => !i.isBookmarked);
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

  const getIcon = (item: ArchiveItem) => {
    if (item.isBookmarked) return { source: Icon.Star, color: Color.Yellow };
    
    // Type-specific icons
    const type = item.meta?.type || 'text';
    switch (type) {
      case 'link': 
        if (item.meta?.favicon) return { source: item.meta.favicon, mask: Image.Mask.RoundedRectangle };
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
        // Live Color Check
        if (item.text.match(/^#(?:[0-9a-fA-F]{3}){1,2}$/)) return { source: Icon.CircleFilled, color: item.text };
        return { source: Icon.Clipboard, color: Color.Blue };
    }
  };

  const getPreviewMarkdown = (item: ArchiveItem) => {
    const isImage = item.meta?.type === 'image' || item.meta?.type === 'design';
    const isColor = item.text.match(/^#(?:[0-9a-fA-F]{3}){1,2}$/);
    const isLink = item.meta?.type === 'link';

    if (isImage) {
      return `![Asset Preview](file://${item.text})\n\n---\n**Local Path:** \`${item.text}\``;
    }

    if (isColor) {
      return `## Color: ${item.text.toUpperCase()}\n![Swatch](https://singlecolorimage.com/get/${item.text.replace('#', '')}/400x120)`;
    }

    if (isLink) {
       const banner = item.meta?.ogImage ? `![](${item.meta.ogImage})` : ``;
       const description = item.meta?.ogDescription ? `\n\n> ${item.meta.ogDescription}` : '';
       return `${banner}\n# ${item.meta?.ogTitle || item.text}\n${description}\n\n---\n\`${item.text}\``;
    }

    // Default Code/Text Preview
    const lang = item.meta?.type === 'code' ? 'typescript' : 'text';
    return `#### Content Preview\n\`\`\`${lang}\n${item.text}\n\`\`\`\n\n---\n**Origin:** ${item.source || 'Unknown'}`;
  };

  const renderItem = (item: ArchiveItem) => {
    return (
      <List.Item
        key={item.id}
        icon={getIcon(item)}
        title={item.label || item.text.trim().split('\n')[0].substring(0, 70)}
        subtitle={item.label ? item.text.substring(0, 30).trim() : ""}
        detail={
          <List.Item.Detail
            markdown={getPreviewMarkdown(item)}
            metadata={
              <List.Item.Detail.Metadata>
                <List.Item.Detail.Metadata.Label title="Origin App" text={item.source || "System"} icon={Icon.AppWindow} />
                <List.Item.Detail.Metadata.Label title="Format" text={item.meta?.type?.toUpperCase() || "TEXT"} />
                <List.Item.Detail.Metadata.Label title="Captured" text={new Date(item.timestamp).toLocaleString()} icon={Icon.Clock} />
                <List.Item.Detail.Metadata.Separator />
                <List.Item.Detail.Metadata.Label title="Token Count" text={String(item.meta?.tokens || 0)} />
                <List.Item.Detail.Metadata.Label title="Status" icon={item.isBookmarked ? Icon.Pin : Icon.Circle} text={item.isBookmarked ? "Pinned" : "Active"} />
              </List.Item.Detail.Metadata>
            }
          />
        }
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            <Action.CopyToClipboard title="Copy Content" content={item.text} />
            <Action.Paste title="Paste into Active" content={item.text} />
            {(item.meta?.type === 'image' || item.meta?.type === 'file') && (
              <Action.Open title="Quick Look / Open" target={item.text} icon={Icon.Eye} shortcut={{ modifiers: ["cmd"], key: "y" }} />
            )}
            {item.meta?.type === 'link' && <Action.OpenInBrowser url={item.text} title="Open in Browser" icon={Icon.Globe} />}
            {item.text.match(/^#(?:[0-9a-fA-F]{3}){1,2}$/) && (
               <Action title="IoT: Cast Color" icon={Icon.LightBulb} onAction={() => fetch(`http://localhost:3031/lights/color?hex=${item.text.replace('#', '')}`).then(() => showToast({ title: "Color Casted!" }))} />
            )}
            <Action 
              title="Add to Stack" 
              icon={Icon.Layers} 
              onAction={() => fetch(`http://localhost:3031/archive/stack/add/${item.id}`).then(() => showToast({ title: "Added to Stack" }))} 
              shortcut={{ modifiers: ["cmd"], key: "s" }}
            />
          </ActionPanel.Section>
          <ActionPanel.Section title="Management">
            <ActionPanel.Submenu title="Alchemy: Transform" icon={Icon.BullsEye} shortcut={{ modifiers: ["cmd"], key: "t" }}>
              <Action title="JSON: Prettify" icon={Icon.Code} onAction={() => fetch(`http://localhost:3031/archive/alchemy/${item.id}?action=prettify`).then(() => fetchArchive())} />
              <Action title="String: snake_case" icon={Icon.Text} onAction={() => fetch(`http://localhost:3031/archive/alchemy/${item.id}?action=snake`).then(() => fetchArchive())} />
              <Action title="String: camelCase" icon={Icon.Text} onAction={() => fetch(`http://localhost:3031/archive/alchemy/${item.id}?action=camel`).then(() => fetchArchive())} />
              <Action title="String: Strip Space" icon={Icon.Eraser} onAction={() => fetch(`http://localhost:3031/archive/alchemy/${item.id}?action=strip`).then(() => fetchArchive())} />
            </ActionPanel.Submenu>
            <Action title="Edit Content" icon={Icon.Pencil} onAction={() => editContent(item)} shortcut={{ modifiers: ["cmd"], key: "e" }} />
            <Action title={item.isBookmarked ? "Unpin" : "Pin to Vault"} icon={Icon.Star} onAction={() => toggleBookmark(item.id)} shortcut={{ modifiers: ["cmd"], key: "b" }} />
            <Action title="Assign Label" icon={Icon.Tag} onAction={() => addLabel(item.id)} shortcut={{ modifiers: ["cmd"], key: "l" }} />
          </ActionPanel.Section>
          <ActionPanel.Section title="Vault Operations">
            <Action.ShowInFinder title="Show Vault in Finder" path="/Users/paranjay/Developer/iftt/gravity-archive" shortcut={{ modifiers: ["cmd", "shift"], key: "f" }} />
            <Action.OpenInBrowser title="Vault: Export MD" icon={Icon.Download} url="http://localhost:3031/archive/export/md" shortcut={{ modifiers: ["cmd", "shift"], key: "m" }} />
            <Action.OpenInBrowser title="Vault: Export JSON" icon={Icon.Download} url="http://localhost:3031/archive/export" shortcut={{ modifiers: ["cmd", "shift"], key: "e" }} />
            <Action title="Clear Search" icon={Icon.XMarkCircle} onAction={() => setSearchText("")} />
          </ActionPanel.Section>
          <ActionPanel.Section title="Cleanup">
            <Action 
              title="Sovereign Wipe: Reset Vault" 
              icon={Icon.Stop} 
              style={Action.Style.Destructive} 
              onAction={async () => {
                const confirmed = await showToast({ title: "Nuclear Reset?", message: "This clears everything. Proceed?", style: Toast.Style.Failure });
                await fetch(`http://localhost:3031/archive/nuclear/reset`);
                fetchArchive();
              }}
              shortcut={{ modifiers: ["cmd", "shift"], key: "del" }}
            />
            <Action title="Delete Forever" icon={Icon.Trash} style={Action.Style.Destructive} onAction={() => deleteItem(item.id)} shortcut={{ modifiers: ["ctrl"], key: "x" }} />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
    );
  };

  return (
    <List 
      isLoading={isLoading} 
      searchBarPlaceholder={`Search ${totalCount.toLocaleString()} clips in sovereign vault...`}
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
          <List.Dropdown.Item title="Manual Jots" value="jot" icon={Icon.Pencil} />
          <List.Dropdown.Item title="Pinned Items" value="bookmarks" icon={Icon.Star} />
          <List.Dropdown.Item title="Code Snippets" value="code" icon={Icon.Code} />
          <List.Dropdown.Item title="Files Only" value="file" icon={Icon.Folder} />
          <List.Dropdown.Item title="Apps Only" value="app" icon={Icon.AppWindow} />
          <List.Dropdown.Item title="Links Only" value="link" icon={Icon.Link} />
          <List.Dropdown.Item title="Colors Only" value="color" icon={Icon.Circle} />
          <List.Dropdown.Item title="DOM Only" value="dom" icon={Icon.Globe} />
          <List.Dropdown.Item title="Images Only" value="image" icon={Icon.Image} />
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

function LabelForm(props: { id: string; onComplete: () => void }) {
  const { pop } = useNavigation();

  async function handleSubmit(values: { label: string }) {
    await fetch(`http://localhost:3030/archive/label/${props.id}?label=${encodeURIComponent(values.label)}`);
    props.onComplete();
    pop();
    showToast({ title: "Identified", style: Toast.Style.Success });
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
    await fetch(`http://localhost:3030/archive/update/${item.id}?text=${encodeURIComponent(values.text)}`);
    onUpdate();
    pop();
    showToast({ title: "Updated", style: Toast.Style.Success });
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
