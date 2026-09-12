import { List, ActionPanel, Action, Icon, showToast, Toast, Form, useNavigation } from "@raycast/api";
import { useState, useEffect } from "react";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

interface DirEntry {
  name: string;
  fullPath: string;
  isDir: boolean;
  size?: number;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

const QUICK_DIRS = [
  { name: "Desktop", dir: path.join(os.homedir(), "Desktop") },
  { name: "Downloads", dir: path.join(os.homedir(), "Downloads") },
  { name: "Documents", dir: path.join(os.homedir(), "Documents") },
  { name: "Developer", dir: path.join(os.homedir(), "Developer") },
  { name: "Home", dir: os.homedir() },
];

export function DirBrowser({
  title,
  actionTitle,
  onPick,
  startDir,
}: {
  title: string;
  actionTitle?: string;
  onPick: (dirPath: string) => void;
  startDir?: string;
}) {
  const [cwd, setCwd] = useState(startDir || os.homedir());
  const [entries, setEntries] = useState<DirEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    setIsLoading(true);
    fs.readdir(cwd, { withFileTypes: true }, (err, dirents) => {
      if (err) {
        showToast({ title: "Cannot read folder", message: err.message, style: Toast.Style.Failure });
        setEntries([]);
        setIsLoading(false);
        return;
      }
      const dirs: DirEntry[] = [];
      const files: DirEntry[] = [];
      for (const d of dirents) {
        if (d.name.startsWith(".")) continue;
        const full = path.join(cwd, d.name);
        if (d.isDirectory()) {
          dirs.push({ name: d.name, fullPath: full, isDir: true });
        } else {
          try {
            const stat = fs.statSync(full);
            files.push({ name: d.name, fullPath: full, isDir: false, size: stat.size });
          } catch {
            files.push({ name: d.name, fullPath: full, isDir: false });
          }
        }
      }
      dirs.sort((a, b) => a.name.localeCompare(b.name));
      files.sort((a, b) => a.name.localeCompare(b.name));
      setEntries([...dirs, ...files]);
      setIsLoading(false);
    });
  }, [cwd]);

  function navigateInto(dirPath: string) {
    setHistory((h) => [...h, cwd]);
    setCwd(dirPath);
  }

  function goBack() {
    if (history.length > 0) {
      const prev = history[history.length - 1];
      setHistory((h) => h.slice(0, -1));
      setCwd(prev);
    }
  }

  function goUp() {
    const parent = path.dirname(cwd);
    if (parent !== cwd) {
      setHistory((h) => [...h, cwd]);
      setCwd(parent);
    }
  }

  const segments = cwd.replace(os.homedir(), "~").split(path.sep).filter(Boolean);
  const breadcrumb = segments.join(" / ");
  const dirs = entries.filter((e) => e.isDir);
  const fileCount = entries.length - dirs.length;

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder={breadcrumb}
      throttle
    >
      <List.Section title={breadcrumb}>
        {history.length > 0 && (
          <List.Item
            title=".."
            subtitle="Back"
            icon={Icon.ArrowLeft}
            actions={
              <ActionPanel>
                <Action title="Go Back" icon={Icon.ArrowLeft} onAction={goBack} />
                <Action title="Select This Folder" icon={Icon.Checkmark} onAction={() => onPick(cwd)} />
              </ActionPanel>
            }
          />
        )}
        {path.dirname(cwd) !== cwd && (
          <List.Item
            title=".."
            subtitle="Up one level"
            icon={Icon.ArrowUp}
            actions={
              <ActionPanel>
                <Action title="Go Up" icon={Icon.ArrowUp} onAction={goUp} />
                <Action title="Select This Folder" icon={Icon.Checkmark} onAction={() => onPick(cwd)} />
              </ActionPanel>
            }
          />
        )}
        <List.Item
          title={`Select "${path.basename(cwd) || cwd}"`}
          subtitle={cwd}
          icon={Icon.Checkmark}
          actions={
            <ActionPanel>
              <Action title={actionTitle || `Use ${title}`} icon={Icon.Checkmark} onAction={() => onPick(cwd)} />
              {QUICK_DIRS.map((q) => (
                <Action
                  key={q.dir}
                  title={`Jump to ${q.name}`}
                  icon={Icon.Folder}
                  onAction={() => { setHistory((h) => [...h, cwd]); setCwd(q.dir); }}
                />
              ))}
            </ActionPanel>
          }
        />
      </List.Section>

      {dirs.length > 0 && (
        <List.Section title={`${dirs.length} folder${dirs.length !== 1 ? "s" : ""}`}>
          {dirs.map((d) => (
            <List.Item
              key={d.fullPath}
              title={d.name}
              subtitle={d.fullPath}
              icon={Icon.Folder}
              actions={
                <ActionPanel>
                  <Action title="Open" icon={Icon.ArrowRight} onAction={() => navigateInto(d.fullPath)} />
                  <Action title={actionTitle || `Use ${title}`} icon={Icon.Checkmark} onAction={() => onPick(d.fullPath)} />
                  <Action title="Open in Finder" icon={Icon.ExternalLink} onAction={() => {
                    import("child_process").then(({ exec }) => exec(`open "${d.fullPath}"`));
                  }} />
                  {QUICK_DIRS.map((q) => (
                    <Action
                      key={q.dir}
                      title={`Jump to ${q.name}`}
                      icon={Icon.Folder}
                      onAction={() => { setHistory((h) => [...h, cwd]); setCwd(q.dir); }}
                    />
                  ))}
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      )}

      {fileCount > 0 && (
        <List.Section title={`${fileCount} file${fileCount !== 1 ? "s" : ""}`}>
          {entries.filter((e) => !e.isDir).map((f) => (
            <List.Item
              key={f.fullPath}
              title={f.name}
              subtitle={f.size != null ? formatSize(f.size) : ""}
              icon={Icon.Document}
              actions={
                <ActionPanel>
                  <Action title="Select This Folder" icon={Icon.Checkmark} onAction={() => onPick(cwd)} />
                  <Action title="Open in Finder" icon={Icon.ExternalLink} onAction={() => {
                    import("child_process").then(({ exec }) => exec(`open "${cwd}"`));
                  }} />
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      )}
    </List>
  );
}
