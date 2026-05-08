import { List, ActionPanel, Action, Icon, Color, Detail, showToast, Toast, useNavigation, Form, LocalStorage, ConfirmAlert, Alert, open } from "@raycast/api";
import { useState, useEffect } from "react";
import fetch from "node-fetch";
import path from "path";
import MissionControl from "./stats";
import GitProbe from "./git-probe";
import NodeReaper from "./node-reaper";
import Scaffolder from "./project-scaffolder";
import ExtensionAuditor from "./extension-auditor";
import WarpDrive from "./warp";

interface NoteFile {
  name: string;
  lastModified: string;
  size: number;
}

interface NoteEntry {
  id: number;
  fileName: string;
  entryId: number;
  time: string;
  body: string;
  snippet: string;
  heading?: string;
  raw: string;
}

interface SearchResult {
  fileName: string;
  entryId: number;
  time: string;
  body: string;
  snippet: string;
}

interface ExternalFile {
  name: string;
  path: string;
  size: number;
  isDir: boolean;
  kind: string;
}

function MarkdownViewer({ file }: { file: NoteFile | ExternalFile }) {
  const [content, setContent] = useState("");
  useEffect(() => {
    fetch(`http://localhost:3031/archive/files/read?path=${encodeURIComponent(file.path)}`)
      .then(r => r.text())
      .then(setContent);
  }, [file.path]);

  return (
    <Detail
      navigationTitle={file.name}
      markdown={content}
      actions={
        <ActionPanel>
          <Action.CopyToClipboard title="Copy Markdown" content={content} />
          <Action.ShowInFinder title="Show in Finder" path={file.path} />
        </ActionPanel>
      }
    />
  );
}

export default function Command() {
  const [notes, setNotes] = useState<NoteFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  async function fetchNotes() {
    try {
      const res = await fetch("http://localhost:3031/archive/notes/list");
      const data = await res.json() as NoteFile[];
      setNotes(data.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()));
    } catch (e) {
      showToast({ title: "Hub Offline", style: Toast.Style.Failure });
    } finally {
      setIsLoading(false);
    }
  }

  async function organizeDesktop() {
    const toast = await showToast({ title: "Organizing Desktop...", style: Toast.Style.Animated });
    try {
      const res = await fetch("http://localhost:3031/archive/desktop/organize");
      const data = await res.json() as { moved: number };
      toast.style = Toast.Style.Success;
      toast.title = "Desktop Purified";
      toast.message = `${data.moved} files grouped into folders`;
    } catch(e) {
      toast.style = Toast.Style.Failure;
      toast.title = "Failed to organize desktop";
    }
  }

  async function undoDesktop() {
    const toast = await showToast({ title: "Undoing...", style: Toast.Style.Animated });
    try {
      const res = await fetch("http://localhost:3031/archive/desktop/undo");
      const data = await res.json() as { count: number };
      if (data.count > 0) {
        toast.style = Toast.Style.Success;
        toast.title = "Organization Reversed";
        toast.message = `${data.count} files restored`;
      } else {
        toast.style = Toast.Style.Failure;
        toast.title = "Nothing to Undo";
      }
    } catch(e) {
      toast.style = Toast.Style.Failure;
      toast.title = "Failed to undo";
    }
  }

  useEffect(() => {
    fetchNotes();
  }, []);

  const dailyNoteName = `Daily Note ${new Date().toISOString().split('T')[0]}.md`;
  const now = new Date().getTime();
  const recentThreshold = 24 * 60 * 60 * 1000; 

  const recentNotes = notes.filter(n => (now - new Date(n.lastModified).getTime()) < recentThreshold);
  const olderNotes = notes.filter(n => (now - new Date(n.lastModified).getTime()) >= recentThreshold);

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search notes or create new...">
      <List.Section title="Sovereign Intelligence">
        <List.Item
          title="Mission Control"
          subtitle="Vault Stats & System Pulse"
          icon={{ source: Icon.BarChart, color: Color.Blue }}
          actions={
            <ActionPanel>
              <Action.Push title="Open Dashboard" target={<MissionControl />} />
            </ActionPanel>
          }
        />
        <List.Item
          title="Universal File Probe"
          subtitle="Spotlight Search & Hard Management"
          icon={Icon.MagnifyingGlass}
          actions={
            <ActionPanel>
              <Action.Push title="Open Universal Search" target={<UniversalSearch />} />
            </ActionPanel>
          }
        />
        <List.Item
          title="Global Vault Search"
          subtitle="Grep through your fragments"
          icon={Icon.Bullseye}
          actions={
            <ActionPanel>
              <Action.Push title="Open Global Search" target={<GlobalSearch onUpdate={fetchNotes} />} />
            </ActionPanel>
          }
        />
        <List.Item
          title="Daily Note"
          subtitle={dailyNoteName}
          icon={Icon.Calendar}
          actions={
            <ActionPanel>
              <Action.Push title="Open Entries" target={<EntryList name={dailyNoteName} onUpdate={fetchNotes} />} />
              <Action.Push title="Quick Append" shortcut={{ modifiers: ["cmd"], key: "n" }} target={<EntryAction name={dailyNoteName} type="append" onUpdate={fetchNotes} />} />
              <Action.Push title="View as Markdown" icon={Icon.TextDocument} target={<MarkdownViewer file={{ name: dailyNoteName, path: path.join('gravity-notes', dailyNoteName) } as any} />} />
            </ActionPanel>
          }
        />
      </List.Section>

      <List.Section title="Recent Vault Fragments">
        {recentNotes.map((note) => (
          <NoteItem key={note.name} note={note} fetchNotes={fetchNotes} />
        ))}
      </List.Section>

      <List.Section title="Vault Archives">
        {olderNotes.map((note) => (
          <NoteItem key={note.name} note={note} fetchNotes={fetchNotes} />
        ))}
      </List.Section>

      <List.Section title="System Orchestration">
         <List.Item
          title="Clean & Group Desktop"
          subtitle="Screenshots -> Folders | Purify Workspace"
          icon={Icon.Desktop}
          actions={
            <ActionPanel>
              <Action title="Organize Now" icon={Icon.Checkmark} onAction={organizeDesktop} />
              <Action title="Undo Last Organize" icon={Icon.RotateAntiClockwise} onAction={undoDesktop} />
            </ActionPanel>
          }
        />
        <List.Item
          title="Git Project Probe"
          subtitle="VCS Intelligence & Sync Status"
          icon={Icon.Globe}
          actions={
            <ActionPanel>
              <Action.Push title="Open Probe" target={<GitProbe />} />
            </ActionPanel>
          }
        />
        <List.Item
          title="Node Modules Reaper"
          subtitle="Mass Storage Recovery & Purge"
          icon={Icon.Box}
          actions={
            <ActionPanel>
              <Action.Push title="Open Reaper" target={<NodeReaper />} />
            </ActionPanel>
          }
        />
        <List.Item
          title="Workspace Scaffolder"
          subtitle="Rapid Environment Hardening"
          icon={Icon.Hammer}
          actions={
            <ActionPanel>
              <Action.Push title="Open Scaffolder" target={<Scaffolder />} />
            </ActionPanel>
          }
        />
        <List.Item
          title="Extension Auditor"
          subtitle="Curate Raycast Bloat & Extension Usage"
          icon={Icon.Eye}
          actions={
            <ActionPanel>
              <Action.Push title="Open Auditor" target={<ExtensionAuditor />} />
            </ActionPanel>
          }
        />
        <List.Item
          title="Gravity Warp"
          subtitle="Instant Jumper for Developer Projects"
          icon={Icon.Airplane}
          actions={
            <ActionPanel>
              <Action.Push title="Open Warp Drive" target={<WarpDrive />} />
            </ActionPanel>
          }
        />
      </List.Section>
    </List>
  );
}

function UniversalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ExternalFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [category, setCategory] = useState<"all" | "media" | "docs" | "dev">("all");

  async function load() {
    setIsLoading(true);
    try {
      const res = await fetch(`http://localhost:3031/archive/files/search?q=${encodeURIComponent(query)}`);
      const data = await res.json() as ExternalFile[];
      setResults(data);
    } catch(e) {}
    setIsLoading(false);
  }

  useEffect(() => {
    if (query.length < 3) {
      setResults([]);
      return;
    }
    const timer = setTimeout(load, 500);
    return () => clearTimeout(timer);
  }, [query]);

  const filteredResults = results.filter(file => {
     if (category === "all") return true;
     const ext = path.extname(file.path).toLowerCase();
     if (category === "media") return ['.png', '.jpg', '.jpeg', '.gif', '.mov', '.mp4', '.webp'].includes(ext);
     if (category === "docs") return ['.pdf', '.doc', '.docx', '.txt', '.pages', '.md'].includes(ext);
     if (category === "dev") return ['.js', '.py', '.ts', '.sh', '.json', '.swift', '.html', '.css'].includes(ext);
     return true;
  });

  return (
    <List 
      isLoading={isLoading} 
      isShowingDetail={filteredResults.length > 0} 
      onSearchTextChange={setQuery} 
      searchBarPlaceholder="Search any file/folder (Spotlight)..."
      searchBarAccessory={
        <List.Dropdown tooltip="Category Filter" onChange={(v) => setCategory(v as any)} storeValue>
          <List.Dropdown.Item title="All Files" value="all" icon={Icon.List} />
          <List.Dropdown.Item title="Media Assets" value="media" icon={Icon.Image} />
          <List.Dropdown.Item title="Documents" value="docs" icon={Icon.TextDocument} />
          <List.Dropdown.Item title="Developer / Code" value="dev" icon={Icon.Code} />
        </List.Dropdown>
      }
    >
      {filteredResults.map(file => (
        <List.Item
          key={file.path}
          title={file.name}
          subtitle={file.path}
          icon={{ fileIcon: file.path }}
          detail={
            <List.Item.Detail 
              markdown={`#### ${file.name}\n\n**Kind:** ${file.kind}\n**Size:** ${file.size}\n\n---\n\n![Preview](file://${file.path})`} 
              metadata={
                <List.Item.Detail.Metadata>
                  <List.Item.Detail.Metadata.Label title="Name" text={file.name} />
                  <List.Item.Detail.Metadata.Label title="Where" text={file.path.replace(process.env.HOME || "", "~")} />
                  <List.Item.Detail.Metadata.Label title="Type" text={file.kind} icon={Icon.Document} />
                  <List.Item.Detail.Metadata.Label title="Size" text={file.size.toString()} icon={Icon.Box} />
                  <List.Item.Detail.Metadata.Separator />
                  <List.Item.Detail.Metadata.Label title="Identity" text="Sovereign" icon={Icon.Shield} />
                </List.Item.Detail.Metadata>
              }
            />
          }
          actions={
            <ActionPanel title={file.name}>
              <ActionPanel.Section>
                {!file.isDir && isMediaFile(file) && (
                   <Action.Push title="Quick Look" icon={Icon.Eye} shortcut={{ modifiers: ["cmd"], key: "y" }} target={<FullImageDetail file={file} />} />
                )}
                {!file.isDir && <Action.Push title="Read & Edit Content" icon={Icon.Pencil} target={<ExternalFileDetail file={file} />} />}
                <Action.Push title="Render Markdown" icon={Icon.BlankDocument} shortcut={{ modifiers: ["cmd", "shift"], key: "v" }} target={<MarkdownViewer file={file} />} />
                <Action.Open title="Open" target={file.path} />
                <Action.ShowInFinder title="Show in Finder" path={file.path} />
              </ActionPanel.Section>

              <ActionPanel.Section title="Sovereign Management">
                 {file.isDir && (
                    <Action title="Deep Purge / Clean Folder" icon={Icon.Desktop} onAction={async () => {
                       const res = await fetch("http://localhost:3031/archive/files/clean", {
                          method: "POST",
                          body: JSON.stringify({ path: file.path }),
                          headers: { "Content-Type": "application/json" }
                       });
                       const data = await res.json() as { moved: number };
                       showToast({ title: "Folder Purified", message: `${data.moved} files grouped.` });
                    }} />
                 )}
                 <Action title="Clone / Duplicate" icon={Icon.CopyClipboard} shortcut={{ modifiers: ["cmd", "shift"], key: "c" }} onAction={async () => {
                    const newPath = path.join(path.dirname(file.path), `Copy of ${file.name}`);
                    await fetch("http://localhost:3031/archive/files/copy", {
                       method: "POST",
                       body: JSON.stringify({ from: file.path, to: newPath }),
                       headers: { "Content-Type": "application/json" }
                    });
                    showToast({ title: "Resource Cloned", message: `New instance: ${path.basename(newPath)}` });
                    load();
                 }} />
                 <Action.ShowInFinder title="Reveal in Finder" path={file.path} shortcut={{ modifiers: ["cmd", "shift"], key: "r" }} />
                 <Action.CopyToClipboard title="Copy File Path" content={file.path} shortcut={{ modifiers: ["cmd", "shift"], key: "p" }} />
                 <Action.Push title="Sovereign Rename" icon={Icon.Pencil} shortcut={{ modifiers: ["cmd"], key: "m" }} target={
                    <Form actions={<ActionPanel><Action.SubmitForm title="Execute Rename" onSubmit={async (v: { p: string }) => {
                       await fetch("http://localhost:3031/archive/files/rename", {
                          method: "POST",
                          body: JSON.stringify({ from: file.path, to: v.p }),
                          headers: { "Content-Type": "application/json" }
                       });
                       showToast({ title: "Manifest Updated", message: `Renamed to ${path.basename(v.p)}` });
                       load();
                    }} /></ActionPanel>}>
                       <Form.TextField id="p" title="Full Target Path" defaultValue={file.path} />
                    </Form>
                 } />
                 <Action icon={Icon.Trash} title="Move to Trash" style={Action.Style.Destructive} onAction={async () => {
                    await fetch("http://localhost:3031/archive/files/delete", {
                       method: "POST",
                       body: JSON.stringify({ path: file.path }),
                       headers: { "Content-Type": "application/json" }
                    });
                    showToast({ title: "Evicted to Trash" });
                    load();
                 }} />
              </ActionPanel.Section>

              <ActionPanel.Section title="Note Integration">
                 <Action.Push title="Add to Daily Note" icon={Icon.Plus} target={<EntryAction name="" type="append" onUpdate={() => {}} initialText={`File Link: ${file.path}`} />} />
              </ActionPanel.Section>
            </ActionPanel>
          }
        />
      ))}
      <List.EmptyView 
        title={query.length < 3 ? "Probe Mac Filesystem" : "Nothing Found"} 
        actions={query.length >= 3 ? (
          <ActionPanel>
             <Action.Push title="Create New Fragment/Resource" icon={Icon.Plus} target={<CreateResourceForm initialRoot={query.startsWith('/') ? query : (process.env.HOME || "/Users/paranjay")} onUpdate={() => setQuery("")} />} />
             <Action.Push title="Add Search as Note Fragment" icon={Icon.Plus} target={<EntryAction name="" type="append" onUpdate={() => {}} initialText={query} />} />
          </ActionPanel>
        ) : undefined}
      />
    </List>
  );
}

function isMediaFile(file: ExternalFile) {
  const ext = path.extname(file.path).toLowerCase();
  return ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.mp4', '.mov', '.avi', '.webp'].includes(ext);
}

function FullImageDetail({ file }: { file: ExternalFile }) {
  const isVideo = ['.mp4', '.mov', '.avi'].includes(path.extname(file.path).toLowerCase());
  return (
    <Detail
      navigationTitle={file.name}
      markdown={isVideo ? `### 🎥 Video Media Detected\n\n> [!NOTE]\n> Native video playback is best handled via **Cmd+O** (Open).\n\n**Path:** \`${file.path}\`` : `![Full Preview](file://${file.path})`}
      actions={
        <ActionPanel>
          <Action.Open title="Open in System Player" target={file.path} />
          <Action.ShowInFinder title="Show in Finder" path={file.path} />
          <Action.CopyToClipboard title="Copy File" content={{ file: file.path }} />
        </ActionPanel>
      }
    />
  );
}

function EntryList({ name, onUpdate }: { name: string; onUpdate: () => void }) {
  const [entries, setEntries] = useState<NoteEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  async function load() {
    setIsLoading(true);
    try {
      const res = await fetch(`http://localhost:3031/archive/notes/entries?name=${encodeURIComponent(name)}`);
      if (res.ok) {
        const data = await res.json() as NoteEntry[];
        setEntries(data.reverse());
      }
    } catch (e) {
      showToast({ title: "Failed to load entries", style: Toast.Style.Failure });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const cleanBody = (text: string) => {
    return text.replace(/.*(?:Words:|📝).*(?:Chars:|📄).*(?:Read Time:|⏱).*\n?/g, "").replace(/^> \[!.*\]\n/gm, "").trim();
  };

  const groupedEntries = entries.reduce((acc, entry) => {
     const body = entry.body;
     const headingMatch = body.match(/^#+ (.*)/m);
     const groupKey = headingMatch ? headingMatch[1] : "Fragments";
     if (!acc[groupKey]) acc[groupKey] = [];
     acc[groupKey].push(entry);
     return acc;
  }, {} as Record<string, NoteEntry[]>);

  return (
    <List 
      isLoading={isLoading} 
      searchBarPlaceholder="Search entries..." 
      navigationTitle={name}
      actions={
        <ActionPanel>
          <Action.Push title="Add New Fragment" icon={Icon.Plus} shortcut={{ modifiers: ["cmd"], key: "n" }} target={<AddEntry name={name} onUpdate={() => { load(); onUpdate(); }} />} />
          <Action.Open title="Open in Default Editor" target={`/Users/paranjay/Developer/iftt/gravity-notes/${name}`} shortcut={{ modifiers: ["cmd", "shift"], key: "o" }} />
        </ActionPanel>
      }
    >
      {Object.entries(groupedEntries).map(([heading, items]) => (
        <List.Section key={heading} title={heading}>
          {items.map((entry) => (
            <List.Item
              key={`${entry.fileName}-${entry.entryId}`}
              icon={Icon.Clock}
              title={cleanBody(entry.body).split('\n')[0].substring(0, 60)}
              subtitle={entry.time}
              actions={
                <ActionPanel>
                  <Action.Push title="Add New Fragment" icon={Icon.Plus} shortcut={{ modifiers: ["cmd"], key: "n" }} target={<AddEntry name={name} onUpdate={() => { load(); onUpdate(); }} />} />
                  <Action.Push title="Edit Entry" icon={Icon.Pencil} target={<EditEntry name={name} entry={entry} onUpdate={() => { load(); onUpdate(); }} />} />
                  <Action.CopyToClipboard title="Copy Content" content={cleanBody(entry.body)} />
                  <Action.Push title="Render Markdown" icon={Icon.BlankDocument} shortcut={{ modifiers: ["cmd", "shift"], key: "v" }} target={<MarkdownViewer file={{ name, path: path.join('gravity-notes', name) } as any} />} />
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      ))}
    </List>
  );
}

function CreateResourceForm({ initialRoot, onUpdate }: { initialRoot: string, onUpdate: () => void }) {
  const [root, setRoot] = useState(initialRoot);
  const home = process.env.HOME || "/Users/paranjay";
  const favorites = [
    { title: "🏠 Home", value: home },
    { title: "📥 Downloads", value: path.join(home, "Downloads") },
    { title: "🖥️ Desktop", value: path.join(home, "Desktop") },
    { title: "💻 Developer", value: path.join(home, "Developer") },
    { title: "📦 Gravity Notes", value: path.join(home, "Developer/iftt/gravity-notes") },
  ];

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Build Resource"
            onSubmit={async (v: { name: string, type: string, root: string }) => {
              await fetch("http://localhost:3031/archive/files/create", {
                method: "POST",
                body: JSON.stringify({ path: v.root, name: v.name, type: v.type }),
                headers: { "Content-Type": "application/json" }
              });
              showToast({ title: "Resource Manifested", message: `Built ${v.name}` });
              onUpdate();
            }}
          />
        </ActionPanel>
      }
    >
      <Form.Dropdown id="root" title="Target Root" value={root} onChange={setRoot}>
        {favorites.map(f => <Form.Dropdown.Item key={f.value} title={f.title} value={f.value} />)}
        {!favorites.find(f => f.value === root) && <Form.Dropdown.Item title={`📍 Current: ${root}`} value={root} />}
      </Form.Dropdown>
      <Form.TextField id="name" title="Resource Name" placeholder="e.g. workspace.md or drafts" />
      <Form.Dropdown id="type" title="Kind">
        <Form.Dropdown.Item title="File" value="file" icon={Icon.Document} />
        <Form.Dropdown.Item title="Folder" value="folder" icon={Icon.Folder} />
      </Form.Dropdown>
    </Form>
  );
}

function ExternalFileDetail({ file }: { file: ExternalFile }) {
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  async function load() {
    try {
      const res = await fetch(`http://localhost:3031/archive/files/read?path=${encodeURIComponent(file.path)}`);
      setContent(await res.text());
    } catch(e) {}
    setIsLoading(false);
  }

  useEffect(() => { load(); }, []);

  return (
    <Detail
      isLoading={isLoading}
      markdown={content}
      navigationTitle={file.name}
      actions={
        <ActionPanel>
          <Action.Push title="Full Edit" icon={Icon.Pencil} target={<ExternalFileEdit file={file} content={content} onUpdate={load} />} />
        </ActionPanel>
      }
    />
  );
}

function ExternalFileEdit({ file, content, onUpdate }: { file: ExternalFile, content: string, onUpdate: () => void }) {
  const { pop } = useNavigation();
  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save File" icon={Icon.Check} onSubmit={async (values: { text: string }) => {
            await fetch("http://localhost:3031/archive/files/write", {
              method: "POST",
              body: JSON.stringify({ path: file.path, text: values.text }),
              headers: { "Content-Type": "application/json" }
            });
            showToast({ title: "File Hardened", style: Toast.Style.Success });
            onUpdate();
            pop();
          }} />
        </ActionPanel>
      }
    >
      <Form.TextArea id="text" title="Content" defaultValue={content} autoFocus enableMarkdown />
    </Form>
  );
}

function RenameFile({ file, onUpdate }: { file: ExternalFile, onUpdate: () => void }) {
  const { pop } = useNavigation();
  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Confirm Identity Shift" icon={Icon.Check} onSubmit={async (values: { name: string }) => {
             await fetch("http://localhost:3031/archive/files/rename", {
               method: "POST",
               body: JSON.stringify({ oldPath: file.path, newName: values.name }),
               headers: { "Content-Type": "application/json" }
             });
             showToast({ title: "Identity Re-indexed" });
             onUpdate();
             pop();
          }} />
        </ActionPanel>
      }
    >
      <Form.TextField id="name" title="New Name" defaultValue={file.name} />
    </Form>
  );
}

function GlobalSearch({ onUpdate }: { onUpdate: () => void }) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`http://localhost:3031/archive/notes/search?q=${encodeURIComponent(query)}`);
        const data = await res.json() as SearchResult[];
        setResults(data);
      } catch(e) {}
      setIsLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search vault content..." onSearchTextChange={setQuery}>
      {results.map((res, idx) => (
        <List.Item
          key={`${res.fileName}-${res.entryId}-${idx}`}
          title={res.body.substring(0, 80)}
          subtitle={`${res.fileName} • ${res.time}`}
          icon={Icon.Text}
          actions={
            <ActionPanel>
              <Action.Push title="Edit This Entry" icon={Icon.Pencil} target={<EditEntry name={res.fileName} entry={{ id: res.entryId, body: res.body, time: res.time, raw: "" } as any} onUpdate={onUpdate} />} />
              <Action.Push title="Open Note" icon={Icon.Folder} target={<EntryList name={res.fileName} onUpdate={onUpdate} />} />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}

function NoteItem({ note, fetchNotes }: { note: NoteFile, fetchNotes: () => void }) {
  return (
    <List.Item
      title={note.name.replace('.md', '').replace('.txt', '')}
      subtitle={new Date(note.lastModified).toLocaleDateString()}
      icon={Icon.TextDocument}
      accessories={[{ text: `${(note.size / 1024).toFixed(1)} KB`, icon: Icon.Document }]}
      actions={
        <ActionPanel>
          <Action.Push title="Open Entries" target={<EntryList name={note.name} onUpdate={fetchNotes} />} />
          <Action.Push title="Append Entry" shortcut={{ modifiers: ["cmd"], key: "n" }} target={<EntryAction name={note.name} type="append" onUpdate={fetchNotes} />} />
          <Action.Push title="View as Markdown" icon={Icon.TextDocument} target={<MarkdownViewer name={note.name} />} />
        </ActionPanel>
      }
    />
  );
}

function AddEntry({ name, onUpdate }: { name: string; onUpdate: () => void }) {
  const { pop } = useNavigation();
  const [heading, setHeading] = useState("");
  const [content, setContent] = useState("");

  async function handleSubmit() {
    if (!content.trim()) return;
    
    const finalContent = heading.trim() ? `## ${heading.trim()}\n\n${content}` : content;
    
    try {
      await fetch("http://localhost:3031/archive/notes/append", {
        method: "POST",
        body: JSON.stringify({ name, text: finalContent }),
        headers: { "Content-Type": "application/json" }
      });
      showToast({ title: "Fragment Added", style: Toast.Style.Success });
      onUpdate();
      pop();
    } catch (e) {
      showToast({ title: "Failed to Add", style: Toast.Style.Failure });
    }
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save Fragment" icon={Icon.Check} onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField id="heading" title="Heading (Optional)" placeholder="e.g. Ideas, Tasks, Meeting Notes" value={heading} onChange={setHeading} />
      <Form.TextArea id="content" title="Content" value={content} onChange={setContent} autoFocus enableMarkdown />
    </Form>
  );
}

function EditEntry({ name, entry, onUpdate }: { name: string; entry: NoteEntry; onUpdate: () => void }) {
  const { pop } = useNavigation();
  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Update Entry" icon={Icon.Check} onSubmit={async (values: { text: string }) => {
            await fetch("http://localhost:3031/archive/notes/entry/update", {
              method: "POST",
              body: JSON.stringify({ name, id: entry.id, text: values.text }),
              headers: { "Content-Type": "application/json" }
            });
            showToast({ title: "Entry Hardened", style: Toast.Style.Success });
            onUpdate();
            pop();
          }} />
        </ActionPanel>
      }
    >
      <Form.TextArea id="text" title="Content" defaultValue={entry.body} autoFocus enableMarkdown />
    </Form>
  );
}

function EntryAction({ name, type, onUpdate, initialText = "" }: { name: string; type: "append" | "prepend"; onUpdate: () => void, initialText?: string }) {
  const { pop } = useNavigation();
  const dailyNoteName = `Daily Note ${new Date().toISOString().split('T')[0]}.md`;
  const targetName = name || dailyNoteName;

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Seal Fragment" icon={Icon.Check} onSubmit={async (values: { text: string, section: string, parseHeadings: boolean }) => {
            await fetch(`http://localhost:3031/archive/notes/${type}`, {
              method: "POST",
              body: JSON.stringify({ name: targetName, text: values.text, section: values.section, parseHeadings: values.parseHeadings }),
              headers: { "Content-Type": "application/json" }
            });
            showToast({ title: "Fragment Saved", style: Toast.Style.Success });
            onUpdate();
            pop();
          }} />
        </ActionPanel>
      }
    >
      <Form.Description text={`Target: ${targetName}`} />
      <Form.TextField id="section" title="Section/Heading" placeholder="e.g. Journal, Reference (optional)" />
      <Form.Checkbox id="parseHeadings" label="Auto-Split Headings into Fragments" defaultValue={false} />
      <Form.TextArea id="text" title="Fragment" defaultValue={initialText} placeholder="Type your thoughts..." autoFocus enableMarkdown />
    </Form>
  );
}
