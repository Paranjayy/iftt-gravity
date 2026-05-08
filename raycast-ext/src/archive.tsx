import { List, ActionPanel, Action, Icon, Color, showToast, Toast, confirmAlert, Detail } from "@raycast/api";
import { useState, useEffect } from "react";
import fetch from "node-fetch";

// Casting to any to fix React 18 type mismatch in Raycast environment
const L: any = List;
const LI: any = List.Item;
const LD: any = List.Dropdown;
const LDI: any = List.Dropdown.Item;
const LDS: any = List.Dropdown.Section;
const AP: any = ActionPanel;
const A: any = Action;
const D: any = Detail;

interface ArchiveItem {
  id: number;
  content: string;
  type: string;
  source_app: string;
  labels: string;
  token_count: number;
  is_bookmarked: boolean;
  created_at: string;
}

export default function Command() {
  const [items, setItems] = useState<ArchiveItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [filter, setFilter] = useState("all");

  async function fetchItems() {
    if (filter === "demo") {
      setItems([
        { id: 999, content: "SELECT * FROM universe WHERE life = 'good';", type: "snippet", source_app: "VS Code", labels: "SQL, DB", token_count: 42, is_bookmarked: true, created_at: new Date().toISOString() },
        { id: 998, content: "https://github.com/paranjayy/gravity-hub", type: "url", source_app: "Arc", labels: "GitHub", token_count: 12, is_bookmarked: false, created_at: new Date().toISOString() },
        { id: 997, content: "{\n  \"status\": \"success\",\n  \"message\": \"Gravity God Build active\"\n}", type: "snippet", source_app: "Postman", labels: "JSON, API", token_count: 85, is_bookmarked: false, created_at: new Date().toISOString() }
      ]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const query = searchText ? `?q=${encodeURIComponent(searchText)}` : "";
      
      let res;
      try {
        res = await fetch(`http://localhost:3031/archive/${searchText ? "search" : "list"}${query}`);
      } catch (e) {
        res = await fetch(`http://localhost:3030/archive/${searchText ? "search" : "list"}${query}`);
      }
      
      if (!res.ok) throw new Error("Offline");
      const data = await res.json();
      setItems(data as ArchiveItem[]);
    } catch (e) {
      showToast({ style: Toast.Style.Failure, title: "Offline", message: "Run ./scripts/archive-runner.sh start" });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(fetchItems, searchText ? 300 : 0);
    return () => clearTimeout(timer);
  }, [searchText, filter]);

  async function toggleBookmark(item: ArchiveItem) {
    try {
      try {
        await fetch(`http://localhost:3031/archive/bookmark/${item.id}`);
      } catch (e) {
        await fetch(`http://localhost:3030/archive/bookmark/${item.id}`);
      }
      showToast({ title: item.is_bookmarked ? "Unpinned" : "Pinned to Top" });
      fetchItems();
    } catch (e) {
      showToast({ style: Toast.Style.Failure, title: "Action Failed" });
    }
  }

  async function promoteToVault(item: ArchiveItem) {
    try {
      let res;
      try {
        res = await fetch(`http://localhost:3031/archive/promote/${item.id}`);
      } catch (e) {
        res = await fetch(`http://localhost:3030/archive/promote/${item.id}`);
      }
      if (res.ok) {
        showToast({ style: Toast.Style.Success, title: "Promoted!", message: "Added to prompt_vault.md" });
      } else {
        throw new Error();
      }
    } catch (e) {
      showToast({ style: Toast.Style.Failure, title: "Promotion Failed" });
    }
  }

  async function deleteItem(item: ArchiveItem) {
    if (await confirmAlert({ title: "Delete Item?", message: "This cannot be undone." })) {
      try {
        try {
          await fetch(`http://localhost:3031/archive/delete/${item.id}`);
        } catch (e) {
          await fetch(`http://localhost:3030/archive/delete/${item.id}`);
        }
        showToast({ title: "Item Deleted" });
        fetchItems();
      } catch (e) {
        showToast({ style: Toast.Style.Failure, title: "Action Failed" });
      }
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "url": return { source: Icon.Link, color: Color.Blue };
      case "email": return { source: Icon.Envelope, color: Color.Yellow };
      case "snippet": return { source: Icon.Code, color: Color.Magenta };
      default: return { source: Icon.Text, color: Color.SecondaryText };
    }
  };

  const filteredItems = items.filter(item => {
    if (filter === "all" || filter === "pinned") return true;
    return item.type === filter || item.labels?.includes(filter) || item.source_app === filter;
  });

  const pinned = filteredItems.filter(i => i.is_bookmarked);
  const others = filteredItems.filter(i => !i.is_bookmarked);

  // Get unique source apps for the dropdown
  const sourceApps = Array.from(new Set(items.map(i => i.source_app))).filter(Boolean);

  return (
    <L
      isLoading={isLoading}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search your infinite history..."
      throttle
      searchBarAccessory={
        <LD
          tooltip="Filter History"
          onChange={(newValue: string) => setFilter(newValue)}
        >
          <LDI title="All Activity" value="all" icon={Icon.List} />
          <LDI title="Pinned Only" value="pinned" icon={Icon.Pin} />
          <LDI title="✨ UI Demo Mode" value="demo" icon={Icon.Sparkles} />
          <LDS title="Content Categories">
            <LDI title="DOM Elements" value="DOM" icon={Icon.Globe} />
            <LDI title="Large Data" value="Huge" icon={Icon.Box} />
            <LDI title="Log History" value="Logs" icon={Icon.Terminal} />
            <LDI title="Structured JSON" value="Data" icon={Icon.Code} />
          </LDS>
          <LDS title="Captured From">
            {sourceApps.map(app => (
              <LDI key={app} title={app} value={app} icon={Icon.AppWindow} />
            ))}
          </LDS>
        </LD>
      }
    >
      {pinned.length > 0 && (
        <LDS title="Pinned Clips" subtitle={`${pinned.length} items`}>
          {pinned.map((item) => (
            <ArchiveListItem 
              key={item.id} 
              item={item} 
              getTypeIcon={getTypeIcon} 
              toggleBookmark={toggleBookmark} 
              promoteToVault={promoteToVault} 
              deleteItem={deleteItem} 
            />
          ))}
        </LDS>
      )}

      <LDS title={pinned.length > 0 ? "Recent Clips" : "Clipboard History"} subtitle={`${others.length} items`}>
        {others.map((item) => (
          <ArchiveListItem 
            key={item.id} 
            item={item} 
            getTypeIcon={getTypeIcon} 
            toggleBookmark={toggleBookmark} 
            promoteToVault={promoteToVault} 
            deleteItem={deleteItem} 
          />
        ))}
      </LDS>
    </L>
  );
}

function ArchiveListItem({ item, getTypeIcon, toggleBookmark, promoteToVault, deleteItem }: any) {
  return (
    <LI
      key={item.id}
      icon={getTypeIcon(item.type)}
      title={item.content.trim().split("\n")[0]}
      subtitle={item.source_app}
      accessories={[
        ...(item.labels ? item.labels.split(", ").map((l: string) => ({ tag: { value: l, color: Color.Blue } })) : []),
        { text: `🪙 ${item.token_count || 0}` },
        { text: new Date(item.created_at).toLocaleDateString() },
        item.is_bookmarked ? { icon: { source: Icon.Pin, tintColor: Color.Yellow } } : {},
      ]}
      actions={
        <AP>
          <A.CopyToClipboard title="Copy to Clipboard" content={item.content} />
          <A
            title={item.is_bookmarked ? "Unpin from Top" : "Pin to Top"}
            icon={Icon.Pin}
            onAction={() => toggleBookmark(item)}
            shortcut={{ modifiers: ["cmd"], key: "p" }}
          />
          <A
            title="Promote to Prompt Vault"
            icon={Icon.HardDrive}
            onAction={() => promoteToVault(item)}
            shortcut={{ modifiers: ["cmd", "shift"], key: "v" }}
          />
          <A.Push
            title="View Details"
            icon={Icon.Eye}
            target={<DetailContent item={item} />}
          />
          <A
            title="Delete Permanently"
            icon={Icon.Trash}
            style={A.Style.Destructive}
            onAction={() => deleteItem(item)}
            shortcut={{ modifiers: ["ctrl"], key: "x" }}
          />
        </AP>
      }
    />
  );
}

function DetailContent({ item }: { item: ArchiveItem }) {
  let displayContent = item.content;
  let language = "";

  if (item.content.trim().startsWith("{") || item.content.trim().startsWith("[")) {
    try {
      displayContent = JSON.stringify(JSON.parse(item.content), null, 2);
      language = "json";
    } catch (e) {}
  } else if (item.type === "snippet") {
    language = "typescript";
  }

  const markdown = `
### 📎 Content
\`\`\`${language}
${displayContent}
\`\`\`

---
#### ℹ️ Metadata
- **Source App**: \`${item.source_app}\`
- **Auto Labels**: \`${item.labels || "None"}\`
- **Tokens**: \`${item.token_count || 0}\`
- **Captured**: ${new Date(item.created_at).toLocaleString()}
- **Database ID**: \`#${item.id}\`
  `;

  return (
    <D
      markdown={markdown}
      actions={
        <AP>
          <A.CopyToClipboard content={item.content} />
          {item.type === "url" && <A.OpenInBrowser url={item.content} />}
        </AP>
      }
    />
  );
}
