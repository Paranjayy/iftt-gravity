import { ActionPanel, Action, Icon, Detail, showToast, Toast, useNavigation, List, getPreferenceValues } from "@raycast/api";
import { useState, useEffect } from "react";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const CLIPBOARD_DIR = "/Users/paranjay/Library/Application Support/com.raycast.macos/clipboard";

type EntryType = "text" | "html" | "image" | "file" | "other";

interface ClipboardEntry {
  filename: string;
  type: EntryType;
  content: string | null;
  size: number;
  modified: Date;
  index: number;
  charCount: number;
  wordCount: number;
  firstLine: string;
}

function classifyEntry(filename: string): EntryType {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".txt") return "text";
  if (ext === ".html" || ext === ".htm") return "html";
  if ([".png", ".jpg", ".jpeg", ".gif", ".tiff", ".webp", ".heic"].includes(ext)) return "image";
  if ([".pdf", ".doc", ".docx", ".zip", ".json", ".csv"].includes(ext)) return "file";
  return "other";
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max) + "…";
}

function wordCount(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}

function relativeTime(d: Date): string {
  const now = Date.now();
  const diff = now - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

async function loadClipboardEntries(): Promise<ClipboardEntry[]> {
  let files: string[];
  try {
    files = await readdir(CLIPBOARD_DIR);
  } catch {
    return [];
  }

  const entries: ClipboardEntry[] = [];
  for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    const filePath = path.join(CLIPBOARD_DIR, filename);
    const fileStat = await stat(filePath).catch(() => null);
    if (!fileStat) continue;
    const type = classifyEntry(filename);

    let content: string | null = null;
    if (type === "text" || type === "html") {
      try {
        content = await readFile(filePath, "utf8");
      } catch { content = null; }
    }

    const text = content || "";
    entries.push({
      filename,
      type,
      content,
      size: fileStat.size,
      modified: fileStat.mtime,
      index: i + 1,
      charCount: text.length,
      wordCount: wordCount(text),
      firstLine: text.split("\n")[0]?.trim() || filename,
    });
  }

  entries.sort((a, b) => b.modified.getTime() - a.modified.getTime());
  return entries;
}

function generateTextExport(entries: ClipboardEntry[], label: string): string {
  const lines: string[] = [
    `# Clipboard Export — ${label}`,
    "",
    `> Exported: ${new Date().toISOString().replace("T", " ").slice(0, 19)}`,
    `> Total entries: ${entries.length}`,
    `> Total text: ${entries.reduce((s, e) => s + e.charCount, 0).toLocaleString()} chars`,
    "",
    "═══════════════════════════════════════════════════════════════",
    "",
  ];

  for (const e of entries) {
    const ts = e.modified.toISOString().replace("T", " ").slice(0, 19);
    const rel = relativeTime(e.modified);

    if (e.type === "text" || e.type === "html") {
      lines.push(`[#${e.index}] ${ts} (${rel})`);
      lines.push(`    ${e.charCount} chars · ${e.wordCount} words · ${formatSize(e.size)}`);
      lines.push("");
      if (e.content) {
        const indented = e.content.split("\n").map((l) => `    ${l}`).join("\n");
        lines.push(indented);
      }
      lines.push("");
      lines.push("───────────────────────────────────────────────────────────────");
      lines.push("");
    } else {
      // files, images, etc — just mention the path
      lines.push(`[#${e.index}] ${ts} (${rel})`);
      lines.push(`    [${e.type}] ${e.filename} · ${formatSize(e.size)}`);
      lines.push("");
      lines.push("───────────────────────────────────────────────────────────────");
      lines.push("");
    }
  }

  return lines.join("\n");
}

function generateJsonExport(entries: ClipboardEntry[], label: string): string {
  // Only include first 200 entries and truncate content to avoid 100MB heap limit
  const limited = entries.slice(0, 200).map((e) => ({
    index: e.index,
    type: e.type,
    timestamp: e.modified.toISOString(),
    filename: e.filename,
    charCount: e.charCount,
    wordCount: e.wordCount,
    sizeBytes: e.size,
    firstLine: e.firstLine,
    contentPreview: e.content ? truncate(e.content, 500) : null,
    note: entries.length > 200 ? `... ${entries.length - 200} more entries truncated` : undefined,
  }));
  return JSON.stringify({ exported: new Date().toISOString(), count: entries.length, entries: limited, totalEntries: entries.length }, null, 2);
}

function ExportView() {
  const [entries, setEntries] = useState<ClipboardEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState("all");
  const [exportFormat, setExportFormat] = useState("text");
  const { push } = useNavigation();

  useEffect(() => {
    loadClipboardEntries().then((r) => {
      setEntries(r);
      setLoaded(true);
    });
  }, []);

  const textEntries = entries.filter((e) => e.type === "text" || e.type === "html");
  const imageEntries = entries.filter((e) => e.type === "image");
  const fileEntries = entries.filter((e) => e.type === "file" || e.type === "other");

  const filtered =
    filter === "text" ? textEntries :
    filter === "image" ? imageEntries :
    filter === "file" ? fileEntries :
    entries;

  const outDir = path.join(os.homedir(), "Developer", "clipboard-backup");

  async function doExport(entriesToExport: ClipboardEntry[], label: string) {
    const { mkdir, writeFile } = await import("node:fs/promises");
    await mkdir(outDir, { recursive: true });

    if (exportFormat === "json") {
      const json = generateJsonExport(entriesToExport, label);
      const outPath = path.join(outDir, `clipboard-${label}-${Date.now()}.json`);
      await writeFile(outPath, json);
      showToast({ title: `Exported ${entriesToExport.length} entries`, message: outPath, style: Toast.Style.Success });
    } else {
      const md = generateTextExport(entriesToExport, label);
      const outPath = path.join(outDir, `clipboard-${label}-${Date.now()}.md`);
      await writeFile(outPath, md);
      showToast({ title: `Exported ${entriesToExport.length} entries`, message: outPath, style: Toast.Style.Success });
    }
  }

  async function exportAll() { await doExport(entries, "all"); }
  async function exportTextOnly() { await doExport(textEntries, "text"); }
  async function exportRecent() { await doExport(textEntries.slice(0, 20), "recent-20"); }

  async function exportFullJson() {
    // Streams entry-by-entry: the store can be ~1GB, so building one giant
    // string would blow Raycast's heap. Images/files export metadata only.
    const { mkdir } = await import("node:fs/promises");
    const { createWriteStream } = await import("node:fs");
    await mkdir(outDir, { recursive: true });
    const outPath = path.join(outDir, `clipboard-full-${Date.now()}.json`);
    const stream = createWriteStream(outPath, { encoding: "utf8" });
    const drain = () => new Promise<void>((r) => stream.once("drain", () => r()));
    stream.write(`{"exported":"${new Date().toISOString()}","count":${entries.length},"entries":[`);
    let first = true;
    for (const e of entries) {
      if (!first) stream.write(",");
      first = false;
      const ok = stream.write(
        JSON.stringify({
          index: e.index,
          type: e.type,
          timestamp: e.modified.toISOString(),
          filename: e.filename,
          charCount: e.charCount,
          wordCount: e.wordCount,
          sizeBytes: e.size,
          firstLine: e.firstLine,
          content: e.content,
        }),
      );
      if (!ok) await drain();
    }
    stream.write("]}");
    await new Promise<void>((resolve, reject) => {
      stream.on("error", reject);
      stream.end(() => resolve());
    });
    showToast({ title: `Exported ${entries.length} entries (full content)`, message: outPath, style: Toast.Style.Success });
  }

  return (
    <List
      isLoading={!loaded}
      searchBarPlaceholder="Search clipboard…"
      searchBarAccessory={
        <List.Dropdown tooltip="Filter" value={filter} onChange={setFilter} storeValue>
          <List.Dropdown.Item title={`All (${entries.length})`} value="all" />
          <List.Dropdown.Item title={`Text (${textEntries.length})`} value="text" />
          <List.Dropdown.Item title={`Images (${imageEntries.length})`} value="image" />
          <List.Dropdown.Item title={`Files (${fileEntries.length})`} value="file" />
        </List.Dropdown>
      }
    >
      <List.Section title="Export">
        <List.Item
          title="▶ Export Text Only (Recommended)"
          subtitle={`${textEntries.length} text entries — clean, no images`}
          icon={Icon.Text}
          accessories={[{ text: exportFormat === "json" ? "JSON" : "Markdown" }]}
          actions={
            <ActionPanel>
              <Action title="Export Text" icon={Icon.Text} onAction={exportTextOnly} />
              <Action title="Export All (incl. file refs)" icon={Icon.SaveDocument} onAction={exportAll} />
              <Action title="Export Recent 20" icon={Icon.Clock} onAction={exportRecent} />
              <Action title="Export Full JSON (complete content + metadata)" icon={Icon.Code} onAction={exportFullJson} />
              <Action
                title={`Format: ${exportFormat === "json" ? "Switch to Markdown" : "Switch to JSON"}`}
                icon={Icon.Switch}
                onAction={() => setExportFormat(exportFormat === "json" ? "text" : "json")}
              />
            </ActionPanel>
          }
        />
      </List.Section>

      <List.Section title={`${filtered.length} entries`}>
        {filtered.map((e) => (
          <List.Item
            key={e.filename}
            title={truncate(e.firstLine, 60)}
            subtitle={e.type === "text" || e.type === "html"
              ? `${e.charCount} chars · ${e.wordCount} words`
              : `[${e.type}] ${e.filename}`
            }
            icon={e.type === "text" ? Icon.Text : e.type === "image" ? Icon.Image : Icon.Document}
            accessories={[
              { text: formatSize(e.size) },
              { text: relativeTime(e.modified) },
            ]}
          />
        ))}
      </List.Section>
    </List>
  );
}

export default function Command() {
  return <ExportView />;
}
