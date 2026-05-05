import { List, ActionPanel, Action, Icon, Color, Detail, showToast, Toast, useNavigation, Form, LocalStorage } from "@raycast/api";
import { useState, useEffect } from "react";
import fetch from "node-fetch";

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

  useEffect(() => {
    fetchNotes();
  }, []);

  const dailyNoteName = `Daily Note ${new Date().toISOString().split('T')[0]}.md`;

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search notes or create new...">
      <List.Section title="Sovereign Intelligence">
        <List.Item
          title="Universal File Probe"
          subtitle="Search & Edit any file on Mac"
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
            </ActionPanel>
          }
        />
      </List.Section>
      
      <List.Section title="Recent Vault Fragments">
        {notes.map((note) => (
          <List.Item
            key={note.name}
            title={note.name.replace('.md', '').replace('.txt', '')}
            subtitle={new Date(note.lastModified).toLocaleDateString()}
            icon={Icon.TextDocument}
            accessories={[{ text: `${(note.size / 1024).toFixed(1)} KB`, icon: Icon.Document }]}
            actions={
              <ActionPanel>
                <Action.Push title="Open Entries" target={<EntryList name={note.name} onUpdate={fetchNotes} />} />
                <Action.Push title="Append Entry" shortcut={{ modifiers: ["cmd"], key: "n" }} target={<EntryAction name={note.name} type="append" onUpdate={fetchNotes} />} />
                <Action.Push title="Create New Note" icon={Icon.Plus} target={<CreateNote onUpdate={fetchNotes} />} />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
    </List>
  );
}

function UniversalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ExternalFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (query.length < 3) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`http://localhost:3031/archive/files/search?q=${encodeURIComponent(query)}`);
        const data = await res.json() as ExternalFile[];
        setResults(data);
      } catch(e) {}
      setIsLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <List isLoading={isLoading} onSearchTextChange={setQuery} searchBarPlaceholder="Search any file (Spotlight)...">
      {results.map(file => (
        <List.Item
          key={file.path}
          title={file.name}
          subtitle={file.path}
          icon={Icon.Document}
          actions={
            <ActionPanel>
              <Action.Push title="Read & Edit" icon={Icon.Pencil} target={<ExternalFileDetail file={file} />} />
              <Action.Open title="Open in Finder" target={file.path} />
            </ActionPanel>
          }
        />
      ))}
    </List>
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

  return (
    <List isLoading={isLoading} navigationTitle={name} searchBarPlaceholder="Search entries...">
      {entries.map((entry) => (
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
    </List>
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

function EntryAction({ name, type, onUpdate }: { name: string; type: "append" | "prepend"; onUpdate: () => void }) {
  const { pop } = useNavigation();
  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Seal Fragment" icon={Icon.Check} onSubmit={async (values: { text: string, section: string }) => {
            await fetch(`http://localhost:3031/archive/notes/${type}`, {
              method: "POST",
              body: JSON.stringify({ name, text: values.text, section: values.section }),
              headers: { "Content-Type": "application/json" }
            });
            showToast({ title: "Fragment Saved", style: Toast.Style.Success });
            onUpdate();
            pop();
          }} />
        </ActionPanel>
      }
    >
      <Form.TextField id="section" title="Section/Heading" placeholder="e.g. Journal, Reference (optional)" />
      <Form.TextArea id="text" title="Fragment" placeholder="Type your thoughts..." autoFocus enableMarkdown />
    </Form>
  );
}

function CreateNote({ onUpdate }: { onUpdate: () => void }) {
  const { pop } = useNavigation();
  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Initialize Note" icon={Icon.Plus} onSubmit={async (values: { name: string, text: string }) => {
            const fileName = values.name.endsWith('.md') ? values.name : `${values.name}.md`;
            await fetch("http://localhost:3031/archive/notes/append", {
              method: "POST",
              body: JSON.stringify({ name: fileName, text: values.text, timestamp: false }),
              headers: { "Content-Type": "application/json" }
            });
            showToast({ title: "Note Created", style: Toast.Style.Success });
            onUpdate();
            pop();
          }} />
        </ActionPanel>
      }
    >
      <Form.TextField id="name" title="Note Name" placeholder="e.g. Project X, Meeting Notes" />
      <Form.TextArea id="text" title="Initial Content" placeholder="Optional starter text..." />
    </Form>
  );
}
