import { ActionPanel, Action, Icon, Detail, showToast, Toast, useNavigation, List } from "@raycast/api";
import { useState, useEffect } from "react";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const CLIPBOARD_DIR = "/Users/paranjay/Library/Application Support/com.raycast.macos/clipboard";
const BACKUP_DIR = "/Users/paranjay/Developer/developer/clipboard-backup";

type ClipboardEntry = {
  filename: string;
  type: "text" | "image" | "file" | "html" | "other";
  content: string | null;
  size: number;
  modified: Date;
  index: number;
};

function classifyEntry(filename: string): ClipboardEntry["type"] {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".txt") return "text";
  if (ext === ".html" || ext === ".htm") return "html";
  if ([".png", ".jpg", ".jpeg", ".gif", ".tiff", ".webp", ".heic"].includes(ext)) return "image";
  if ([".pdf", ".doc", ".docx", ".zip", ".json", ".csv"].includes(ext)) return "file";
  return "other";
}

async function loadClipboardEntries(): Promise<ClipboardEntry[]> {
  const files = await readdir(CLIPBOARD_DIR);
  const entries: ClipboardEntry[] = [];

  for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    const filePath = path.join(CLIPBOARD_DIR, filename);
    const fileStat = await stat(filePath);
    const type = classifyEntry(filename);

    let content: string | null = null;
    if (type === "text" || type === "html") {
      try {
        content = await readFile(filePath, "utf8");
      } catch {
        content = null;
      }
    }

    entries.push({
      filename,
      type,
      content,
      size: fileStat.size,
      modified: fileStat.mtime,
      index: i + 1,
    });
  }

  entries.sort((a, b) => b.modified.getTime() - a.modified.getTime());
  return entries;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function truncate(content: string, maxLen: number): string {
  if (content.length <= maxLen) return content;
  return content.slice(0, maxLen) + "…";
}

function generateMarkdown(entries: ClipboardEntry[], typeFilter?: string): string {
  const filtered = typeFilter ? entries.filter((e) => e.type === typeFilter) : entries;
  const textEntries = filtered.filter((e) => e.type === "text" || e.type === "html");
  const imageEntries = filtered.filter((e) => e.type === "image");
  const fileEntries = filtered.filter((e) => e.type === "file" || e.type === "other");

  const lines: string[] = [
    "# Clipboard Backup",
    "",
    `> Exported ${new Date().toISOString().slice(0, 19)}`,
    `> Total: ${entries.length} entries (${textEntries.length} text, ${imageEntries.length} images, ${fileEntries.length} files)`,
    "",
    "---",
    "",
  ];

  if (typeFilter) {
    lines.push(`**Filtered by:** ${typeFilter}`, "");
  }

  lines.push("## Text Entries", "");
  for (const entry of textEntries) {
    lines.push(`### #${entry.index} — ${entry.modified.toISOString().slice(0, 16)}`);
    lines.push(`*${formatSize(entry.size)} · ${entry.filename}*`);
    lines.push("");
    if (entry.content) {
      lines.push(truncate(entry.content, 2000));
    }
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  if (imageEntries.length > 0) {
    lines.push("## Image Entries", "");
    for (const entry of imageEntries) {
      lines.push(`- #${entry.index} — ${entry.modified.toISOString().slice(0, 16)} · ${formatSize(entry.size)} · \`${entry.filename}\``);
    }
    lines.push("");
  }

  if (fileEntries.length > 0) {
    lines.push("## File Entries", "");
    for (const entry of fileEntries) {
      lines.push(`- #${entry.index} — ${entry.modified.toISOString().slice(0, 16)} · ${formatSize(entry.size)} · \`${entry.filename}\``);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function BackupView() {
  const [entries, setEntries] = useState<ClipboardEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const { push } = useNavigation();

  useEffect(() => {
    loadClipboardEntries().then((r) => {
      setEntries(r);
      setLoaded(true);
    });
  }, []);

  const textCount = entries.filter((e) => e.type === "text" || e.type === "html").length;
  const imageCount = entries.filter((e) => e.type === "image").length;
  const fileCount = entries.filter((e) => e.type === "file" || e.type === "other").length;
  const totalSize = entries.reduce((sum, e) => sum + e.size, 0);

  async function backupAll() {
    const md = generateMarkdown(entries);
    const outPath = path.join(BACKUP_DIR, `clipboard-backup-${new Date().toISOString().slice(0, 10)}.md`);
    const { mkdir, writeFile } = await import("node:fs/promises");
    await mkdir(BACKUP_DIR, { recursive: true });
    await writeFile(outPath, md);
    showToast({ title: `Backed up ${entries.length} entries`, message: outPath, style: Toast.Style.Success });
  }

  async function backupTextOnly() {
    const md = generateMarkdown(entries, "text");
    const outPath = path.join(BACKUP_DIR, `clipboard-text-${new Date().toISOString().slice(0, 10)}.md`);
    const { mkdir, writeFile } = await import("node:fs/promises");
    await mkdir(BACKUP_DIR, { recursive: true });
    await writeFile(outPath, md);
    showToast({ title: `Backed up ${textCount} text entries`, message: outPath, style: Toast.Style.Success });
  }

  const filtered = filter === "all" ? entries : entries.filter((e) => e.type === filter);

  return (
    <List isLoading={!loaded} searchBarPlaceholder="Filter clipboard…" searchBarAccessory={
      <List.Dropdown tooltip="Filter" value={filter} onChange={setFilter} storeValue>
        <List.Dropdown.Item title={`All (${entries.length})`} value="all" />
        <List.Dropdown.Item title={`Text (${textCount})`} value="text" />
        <List.Dropdown.Item title={`Images (${imageCount})`} value="image" />
        <List.Dropdown.Item title={`Files (${fileCount})`} value="file" />
      </List.Dropdown>
    }>
      <List.Section title={`Clipboard — ${formatSize(totalSize)}`}>
        <List.Item
          title="▶ Backup all entries"
          subtitle={`${entries.length} entries · ${formatSize(totalSize)}`}
          icon={Icon.SaveDocument}
          actions={
            <ActionPanel>
              <Action title="Backup All" icon={Icon.SaveDocument} onAction={backupAll} />
              <Action title="Backup Text Only" icon={Icon.Text} onAction={backupTextOnly} />
            </ActionPanel>
          }
        />
      </List.Section>
      <List.Section title={`${filtered.length} entries`}>
        {filtered.map((entry) => (
          <List.Item
            key={entry.filename}
            title={`#${entry.index} — ${entry.type}`}
            subtitle={entry.content ? truncate(entry.content, 80) : entry.filename}
            icon={entry.type === "image" ? Icon.Image : entry.type === "text" ? Icon.Text : Icon.Document}
            accessories={[
              { text: formatSize(entry.size) },
              { text: entry.modified.toISOString().slice(0, 16) },
            ]}
          />
        ))}
      </List.Section>
    </List>
  );
}

export default function Command() {
  return <BackupView />;
}
