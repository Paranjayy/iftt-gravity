import { List, ActionPanel, Action, Icon, Color, Detail, showToast, Toast, useNavigation, Form, LocalStorage, ConfirmAlert, Alert, open } from "@raycast/api";
import { useState, useEffect } from "react";
import fetch from "node-fetch";
import path from "path";
import MissionControl from "./stats";

interface NoteFile {
  name: string;
  lastModified: string;
  size: number;
}

interface NoteEntry {
  id: number;
  raw: string;
  time: string;
  body: string;
  section?: string;
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
    showToast({ title: "Organizing Desktop...", style: Toast.Style.Animated });
    const res = await fetch("http://localhost:3031/archive/desktop/organize");
    const data = await res.json() as { movedCount: number };
    showToast({ title: "Desktop Purified", message: `${data.movedCount} files grouped into folders`, style: Toast.Style.Success });
  }

  async function undoDesktop() {
    const res = await fetch("http://localhost:3031/archive/desktop/undo");
    const data = await res.json() as { count: number };
    if (data.count > 0) showToast({ title: "Organization Reversed", message: `${data.count} files restored`, style: Toast.Style.Success });
    else showToast({ title: "Nothing to Undo", style: Toast.Style.Failure });
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
              <Action.Push title="View as Markdown" icon={Icon.TextDocument} target={<MarkdownViewer name={dailyNoteName} />} />
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
      </List.Section>
    </List>
  );
}

function UniversalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ExternalFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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

  const getFileIcon = (file: ExternalFile) => {
    if (file.isDir) return Icon.Folder;
    const ext = path.extname(file.path).toLowerCase();
    if (ext === '.md' || ext === '.txt') return Icon.Pencil;
    if (['.png', '.jpg', '.jpeg', '.gif', '.svg'].includes(ext)) return Icon.Image;
    if (['.mp4', '.mov', '.avi'].includes(ext)) return Icon.Video;
    if (['.pdf', '.docx', '.xlsx'].includes(ext)) return Icon.Document;
    return Icon.Document;
  };

  return (
    <List isLoading={isLoading} isShowingDetail={results.length > 0} onSearchTextChange={setQuery} searchBarPlaceholder="Search any file/folder (Spotlight)...">
      {results.map(file => (
        <List.Item
          key={file.path}
          title={file.name}
          subtitle={file.path}
          icon={getFileIcon(file)}
          detail={
            <List.Item.Detail 
              markdown={`### ${file.name}\n\n**Kind:** ${file.isDir ? "Folder" : "File"}\n**Size:** ${(file.size / 1024).toFixed(1)} KB\n\n---\n\n![Preview](https://placehold.co/600x400?text=${encodeURIComponent(file.name)})`} 
              metadata={
                 <List.Item.Detail.Metadata>
                    <List.Item.Detail.Metadata.Label title="Name" text={file.name} />
                    <List.Item.Detail.Metadata.Label title="Where" text={file.path.replace(process.env.HOME || "", "~")} />
                    <List.Item.Detail.Metadata.Separator />
                    <List.Item.Detail.Metadata.Label title="Type" text={file.isDir ? "Folder" : (path.extname(file.path).toUpperCase().slice(1) + " Image" || "Document")} />
                    <List.Item.Detail.Metadata.Label title="Size" text={`${(file.size / 1024).toFixed(1)} KB`} />
                 </List.Item.Detail.Metadata>
              }
            />
          }
          actions={
            <ActionPanel title={file.name}>
              <ActionPanel.Section>
                {!file.isDir && <Action.Push title="Read & Edit Content" icon={Icon.Pencil} target={<ExternalFileDetail file={file} />} />}
                <Action.Open title="Open" target={file.path} />
                <Action.ShowInFinder title="Show in Finder" path={file.path} />
                <Action.OpenWith title="Open With..." path={file.path} />
              </ActionPanel.Section>

              <ActionPanel.Section title="Identity & Location">
                 <Action.CopyToClipboard title="Copy Path" content={file.path} shortcut={{ modifiers: ["cmd", "shift"], key: "c" }} />
                 <Action.CopyToClipboard title="Copy Name" content={file.name} shortcut={{ modifiers: ["cmd", "opt"], key: "c" }} />
                 <Action.Push title="Rename" icon={Icon.Text} shortcut={{ modifiers: ["cmd"], key: "r" }} target={<RenameFile file={file} onUpdate={load} />} />
                 <Action title="Enclosing Folder" icon={Icon.Folder} shortcut={{ modifiers: ["cmd"], key: "arrowUp" }} onAction={() => open(path.dirname(file.path))} />
              </ActionPanel.Section>

              <ActionPanel.Section title="Destruction">
                <Action title="Move to Trash" icon={Icon.Trash} style={Action.Style.Destructive} shortcut={{ modifiers: ["cmd"], key: "delete" }} onAction={async () => {
                  if (await ConfirmAlert({ title: "Move to Trash?", message: "This will relocate the file to your system trash." })) {
                    await fetch("http://localhost:3031/archive/files/delete", {
                      method: "POST",
                      body: JSON.stringify({ path: file.path }),
                      headers: { "Content-Type": "application/json" }
                    });
                    showToast({ title: "Relocated to Trash" });
                    load();
                  }
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
             <Action.Push title="Add Search as Note Fragment" icon={Icon.Plus} target={<EntryAction name="" type="append" onUpdate={() => {}} initialText={query} />} />
          </ActionPanel>
        ) : undefined}
      />
    </List>
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
        // Simple heuristic for grouping: Look for headings in body
        setEntries(data.reverse());
      }
    } catch (e) {
      showToast({ title: "Failed to load entries", style: Toast.Style.Failure });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // Organize entries by section (if any)
  const grouped: Record<string, NoteEntry[]> = { "Main Feed": [] };
  entries.forEach(e => {
    // If the body starts with a heading or contains one, we could group, 
    // but the backend handles sections now.
    // For now, let's look for sections in the metadata if we added them.
    grouped["Main Feed"].push(e);
  });

  return (
    <List isLoading={isLoading} navigationTitle={name} searchBarPlaceholder="Search entries...">
      {Object.entries(grouped).map(([section, items]) => (
        <List.Section key={section} title={section}>
          {items.map((entry) => (
            <List.Item
              key={entry.id}
              title={entry.body.split('\n')[0].substring(0, 100)}
              subtitle={entry.time}
              icon={Icon.Clock}
              detail={<List.Item.Detail markdown={entry.raw} />}
              actions={
                <ActionPanel>
                  <Action.Push title="Edit Entry" icon={Icon.Pencil} shortcut={{ modifiers: ["cmd"], key: "e" }} target={<EditEntry name={name} entry={entry} onUpdate={() => { load(); onUpdate(); }} />} />
                  <Action.Push title="Append New" icon={Icon.Plus} shortcut={{ modifiers: ["cmd"], key: "n" }} target={<EntryAction name={name} type="append" onUpdate={() => { load(); onUpdate(); }} />} />
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      ))}
    </List>
  );
}

function MarkdownViewer({ name }: { name: string }) {
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch(`http://localhost:3031/archive/files/read?path=${encodeURIComponent('gravity-notes/' + name)}`)
      .then(res => res.text())
      .then(text => { setContent(text); setIsLoading(false); });
  }, []);

  return <Detail isLoading={isLoading} markdown={content} navigationTitle={name} />;
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
              <Action.Push title="Edit This Entry" icon={Icon.Pencil} target={<EditEntry name={res.fileName} entry={{ id: res.entryId, body: res.body, time: res.time, raw: "" }} onUpdate={onUpdate} />} />
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
