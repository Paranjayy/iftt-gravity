import { List, ActionPanel, Action, Icon, Color, Detail, showToast, Toast, open, Image, useNavigation, Form, LocalStorage, Clipboard } from "@raycast/api";
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
  const [grouping, setGrouping] = useState<"app" | "date" | "none">("date");
  const [isLoading, setIsLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [filter, setFilter] = useState<"all" | "today" | "jot" | "bookmarks" | "code" | "link" | "image">("all");

  useEffect(() => {
    LocalStorage.getItem<string>("gravity-grouping").then(val => {
      if (val) setGrouping(val as any);
    });
  }, []);

  const persistGrouping = (val: "app" | "date" | "none") => {
    setGrouping(val);
    LocalStorage.setItem("gravity-grouping", val);
  };

  async function fetchArchive() {
    try {
      const res = await fetch("http://127.0.0.1:3031/archive");
      if (!res.ok) throw new Error();
      const data = await res.json() as ArchiveItem[];
      setClips(data);
    } catch (e) {
      showToast({ title: "Gravity Archive: Offline Pulse", style: Toast.Style.Failure });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchArchive();
    const interval = setInterval(fetchArchive, 5000); 
    return () => clearInterval(interval);
  }, [searchText, filter]);

  async function performAction(endpoint: string, successMsg: string) {
    try {
      await fetch(`http://127.0.0.1:3031/archive/${endpoint}`);
      showToast({ title: successMsg, style: Toast.Style.Success });
      fetchArchive();
    } catch (e) {
      showToast({ title: "Action Failed", style: Toast.Style.Failure });
    }
  }

  const filteredClips = clips.filter((item) => {
    const searchLower = searchText.toLowerCase();
    
    // 🧬 Intelligence: Search Shortcuts (e.g. "type:code" or "@arc")
    if (searchLower.startsWith("type:")) {
      const target = searchLower.split(":")[1];
      if (target && item.meta?.type !== target) return false;
    }
    if (searchLower.startsWith("@")) {
      const target = searchLower.substring(1);
      if (target && !item.source?.toLowerCase().includes(target)) return false;
    }

    const searchMatch = item.text.toLowerCase().includes(searchLower) || 
                      (item.label || "").toLowerCase().includes(searchLower) ||
                      (item.source || "").toLowerCase().includes(searchLower);
    
    if (!searchMatch) return false;
    if (filter === "all") return true;
    if (filter === "bookmarks") return item.isBookmarked;
    if (filter === "today") {
       const today = new Date().toDateString();
       return new Date(item.timestamp).toDateString() === today;
    }
    if (filter === "jot") return item.meta?.type === "jot";
    if (filter === "code") return item.meta?.type === "code";
    if (filter === "image") return item.meta?.type === "image" || item.meta?.type === "design" || item.text.match(/\.(png|jpg|jpeg|gif)$/i);
    if (filter === "link") return item.meta?.type === "link" || item.text.startsWith('http') || item.text.includes('www.') || item.url !== undefined;
    return true;
  });

  const getIcon = (item: ArchiveItem) => {
    if (item.isBookmarked) return { source: Icon.Star, color: Color.Yellow };
    if (item.meta?.favicon) return { source: item.meta.favicon, mask: Image.Mask.RoundedRectangle };
    if (item.source && item.source !== "System" && item.source !== "Unknown") {
       return { source: { fileIcon: `/Applications/${item.source}.app` } };
    }
    const type = item.meta?.type || 'text';
    switch (type) {
      case 'link': return { source: Icon.Link, color: Color.Blue };
      case 'image': return { source: Icon.Image, color: Color.Purple };
      case 'code': return { source: Icon.Terminal, color: Color.Orange };
      case 'jot': return { source: Icon.Pencil, color: Color.Green };
      default: return { source: Icon.Text, color: Color.SecondaryText };
    }
  };

  const getPreviewMarkdown = (item: ArchiveItem) => {
    // 🧬 Intelligence: Folder/File Path Resolution
    let text = item.text.replace('file://', '');
    
    // Auto-resolve Mac Screenshots if path is partial
    if (text.startsWith('Screenshot') && text.endsWith('.png')) {
       text = `/Users/paranjay/Desktop/${text}`;
    }

    // 🛡️ Native Quick Look (Local Files)
    const isLocalPath = text.startsWith('/');
    const isImageFile = text.match(/\.(png|jpg|jpeg|gif|webp)$/i);
    
    if (isLocalPath && isImageFile) {
       return `#### Native Visual Hord\n![Local Preview](file://${text})\n\n---\n**Location:** \`${text}\`\n**Captured:** ${new Date(item.timestamp).toLocaleString()}`;
    }

    // 🧬 Intelligence: Image URL Detection (CDN/Direct)
    const isImageUrl = item.text.match(/\.(png|jpg|jpeg|gif|webp|svg)(\?.*)?$/i) || 
                       item.text.includes("image/upload") || 
                       item.text.includes("img.hscicdn.com");
    
    if (isImageUrl) {
       return `#### Image Signal Peak\n![Remote Preview](${item.text})\n\n---\n**Source:** ${item.source || 'Direct Link'}\n**Captured:** ${new Date(item.timestamp).toLocaleString()}`;
    }

    if (item.meta?.type === 'image' || item.meta?.type === 'link') {
       if (item.meta?.ogImage) return `#### Media Intelligence\n![OG Image](${item.meta.ogImage})\n\n### ${item.meta.ogTitle || 'Linked Item'}\n${item.meta.ogDescription || item.text}`;
    }
    const lang = item.meta?.type === 'code' ? 'typescript' : 'text';
    return `#### Content Preview\n\`\`\`${lang}\n${item.text}\n\`\`\`\n\n---\n**Origin:** ${item.source || 'Unknown'}\n**Time:** ${new Date(item.timestamp).toLocaleString()}`;
  };

  // Advanced Grouping Logic
  const getGroupedItems = () => {
    if (grouping === "none") return { "All History": filteredClips };
    
    return filteredClips.reduce((acc, item) => {
      let key = "System";
      if (grouping === "app") key = item.source || "Unknown";
      else if (grouping === "date") {
        const d = new Date(item.timestamp).toDateString();
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        if (d === today) key = "Today";
        else if (d === yesterday) key = "Yesterday";
        else key = d;
      }
      
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {} as Record<string, ArchiveItem[]>);
  };

  const groupedItems = getGroupedItems();

  const copyAsMarkdownTable = () => {
    let table = "| Captured | Source | Content |\n| :--- | :--- | :--- |\n";
    filteredClips.slice(0, 50).forEach(item => {
      const cleanText = item.text.replace(/\n/g, ' ').substring(0, 100);
      table += `| ${new Date(item.timestamp).toLocaleDateString()} | ${item.source} | ${cleanText} |\n`;
    });
    Clipboard.copy(table);
    showToast({ title: "Table Hoarded", message: "Exported latest 50 fragments." });
  };

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
          <List.Dropdown.Item title="Visual Arts (Media)" value="image" icon={Icon.Image} />
          <List.Dropdown.Item title="Quick Jots" value="jot" icon={Icon.Pencil} />
          <List.Dropdown.Item title="Code Vault" value="code" icon={Icon.Terminal} />
          <List.Dropdown.Item title="Web Browser (DOM)" value="link" icon={Icon.Globe} />
        </List.Dropdown>
      }
    >
      {Object.entries(groupedItems).map(([title, items]) => (
        <List.Section key={title} title={title} subtitle={`${items.length} bits`}>
          {items.map((item) => (
            <List.Item
              key={item.id}
              icon={getIcon(item)}
              title={item.label || item.text.split('\n')[0].substring(0, 60)}
              subtitle={item.label ? item.text.substring(0, 40) : ""}
              accessories={[
                { icon: item.isBookmarked ? { source: Icon.Pin, color: Color.Yellow } : undefined },
                { text: grouping !== "app" ? item.source : "" },
                { text: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
              ]}
              detail={
                <List.Item.Detail
                  markdown={getPreviewMarkdown(item)}
                  metadata={
                    <List.Item.Detail.Metadata>
                      <List.Item.Detail.Metadata.Label title="Origin App" text={item.source || "System"} icon={{ fileIcon: `/Applications/${item.source}.app` }} />
                      {item.url && (
                        <List.Item.Detail.Metadata.Link 
                          title="Source URL" 
                          text={item.url.substring(0, 45) + "..."} 
                          target={item.url} 
                          icon={item.meta?.favicon ? { source: item.meta.favicon, mask: Image.Mask.Circle } : Icon.Globe}
                        />
                      )}
                      <List.Item.Detail.Metadata.Label title="Format" text={item.meta?.type?.toUpperCase() || "TEXT"} />
                      <List.Item.Detail.Metadata.Label title="Captured" text={new Date(item.timestamp).toLocaleString()} icon={Icon.Clock} />
                      <List.Item.Detail.Metadata.Label title="Status" icon={item.isBookmarked ? Icon.Pin : Icon.Circle} text={item.isBookmarked ? "Pinned" : "Active"} />
                      
                      {item.meta?.project && (
                        <List.Item.Detail.Metadata.Label title="Assigned Project" text={item.meta.project} icon={Icon.Folder} />
                      )}

                      <List.Item.Detail.Metadata.Separator />
                      <List.Item.Detail.Metadata.Label title="Confidence Meter" icon={Icon.BullsEye} text={`${Math.min(100, Math.ceil((item.text.length / 10) + (item.isBookmarked ? 30 : 0)))}%`} />
                      <List.Item.Detail.Metadata.Label 
                        title="Security Stance" 
                        icon={item.text.match(/(key|secret|password|passwd|token)/i) ? Icon.ExclamationMark : Icon.Checkmark} 
                        text={item.text.match(/(key|secret|password|passwd|token)/i) ? "Suspicious" : "Clean"} 
                        accentColor={item.text.match(/(key|secret|password|passwd|token)/i) ? Color.Red : Color.Green}
                      />
                      {item.meta?.dupes > 0 && (
                        <List.Item.Detail.Metadata.Label title="Duplicate Pulse" text={`Captured ${item.meta.dupes}x`} icon={Icon.Person} />
                      )}

                      <List.Item.Detail.Metadata.Separator />
                      <List.Item.Detail.Metadata.Label title="Characters" text={String(item.meta?.chars || item.text.length)} />
                      <List.Item.Detail.Metadata.Label title="Words" text={String(item.meta?.words || 0)} />
                      <List.Item.Detail.Metadata.Label title="Lines" text={String(item.meta?.lines || 0)} />
                      <List.Item.Detail.Metadata.Label title="Token Count" text={String(item.meta?.tokens || 0)} icon={Icon.Code} />
                    </List.Item.Detail.Metadata>
                  }
                />
              }
              actions={
                <ActionPanel>
                  <Action.CopyToClipboard title="Hoard Record" content={item.text} />
                  <Action.CopyToClipboard 
                    title="Copy Redacted (Safe Share)" 
                    icon={Icon.Shield}
                    shortcut={{ modifiers: ["cmd", "shift"], key: "r" }}
                    content={item.text.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[EMAIL REDACTED]").replace(/\b\d{10,12}\b/g, "[PHONE REDACTED]")} 
                  />
                  {(item.text.startsWith('/') || item.text.startsWith('file://')) && item.text.match(/\.(png|jpg|jpeg|gif|webp)$/i) && (
                    <Action.CopyToClipboard title="Copy Image File" icon={Icon.Image} content={{ file: item.text.replace('file://', '') }} />
                  )}
                  {item.meta?.ogImage && (
                    <Action.CopyToClipboard title="Copy Image URL" icon={Icon.Link} content={item.meta.ogImage} />
                  )}
                  <Action.CopyToClipboard 
                    title="Copy as Markdown Block" 
                    icon={Icon.TextDocument}
                    shortcut={{ modifiers: ["cmd", "shift"], key: "m" }}
                    content={`### ${item.label || item.source || 'Archive Fragment'}\n> Captured: ${new Date(item.timestamp).toLocaleString()}\n\n\`\`\`${item.meta?.type || 'text'}\n${item.text}\n\`\`\``} 
                  />
                  <Action title={item.isBookmarked ? "Unpin Fragment" : "Pin Fragment"} icon={Icon.Pin} shortcut={{ modifiers: ["cmd"], key: "p" }} onAction={() => performAction(`bookmark/${item.id}`, "Pulse: Pinned")} />
                  <Action.Push title="Label Fragment" icon={Icon.Tag} shortcut={{ modifiers: ["cmd"], key: "l" }} target={<LabelForm id={item.id} onComplete={fetchArchive} />} />
                  <Action.Push title="Edit Content" icon={Icon.Pencil} shortcut={{ modifiers: ["cmd"], key: "e" }} target={<EditForm item={item} onUpdate={fetchArchive} />} />
                  
                  <ActionPanel.Section title="Grouping Control">
                    <Action title="Group by App" icon={Icon.AppWindow} shortcut={{ modifiers: ["cmd", "shift"], key: "a" }} onAction={() => persistGrouping("app")} />
                    <Action title="Group by Date" icon={Icon.Calendar} shortcut={{ modifiers: ["cmd", "shift"], key: "d" }} onAction={() => persistGrouping("date")} />
                    <Action title="Flat History" icon={Icon.List} shortcut={{ modifiers: ["cmd", "shift"], key: "f" }} onAction={() => persistGrouping("none")} />
                  </ActionPanel.Section>

                  <ActionPanel.Section title="Sovereign Core">
                     <Action title="Copy as Markdown Table" icon={Icon.Table} onAction={copyAsMarkdownTable} />
                     <Action.CopyToClipboard title="Copy Metadata JSON" content={JSON.stringify(item.meta, null, 2)} icon={Icon.Code} shortcut={{ modifiers: ["cmd", "shift"], key: "j" }} />
                     <Action icon={Icon.Cloud} title="Sync to Cloud" onAction={() => performAction("sync", "Vault Synced to Cloud")} />
                     <Action icon={Icon.Trash} title="Purge Fragment" style={Action.Style.Destructive} onAction={() => performAction(`delete/${item.id}`, "Fragment Evicted")} />
                     <Action icon={Icon.ExclamationMark} title="Nuclear Reset Vault" style={Action.Style.Destructive} onAction={() => performAction("nuclear/reset", "Vault Purged")} />
                  </ActionPanel.Section>
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      ))}

      {clips.length === 0 && !isLoading && (
        <List.EmptyView 
          title="No fragments found in the void." 
          description="Sovereign Shortcuts:\nCmd+Shift+A/D/F: Group by App/Date/Flat\nCmd+P: Pin | Cmd+L: Label | Cmd+E: Edit\nCmd+Shift+R: Safe Redacted Share" 
          icon={Icon.Tray} 
        />
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
