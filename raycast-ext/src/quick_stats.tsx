import { List, Icon, ActionPanel, Action, Detail } from "@raycast/api";
import { useState, useEffect } from "react";
import * as os from "os";
import * as fs from "fs";
import * as path from "path";

interface DiskInfo {
  total: number;
  used: number;
  free: number;
  mount: string;
}

interface FolderSize {
  name: string;
  path: string;
  size: number;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

async function getDirSize(dir: string): Promise<number> {
  let total = 0;
  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        total += await getDirSize(full);
      } else {
        const stat = await fs.promises.stat(full).catch(() => null);
        if (stat) total += stat.size;
      }
    }
  } catch { /* skip */ }
  return total;
}

export default function QuickStats() {
  const [disk, setDisk] = useState<DiskInfo | null>(null);
  const [folders, setFolders] = useState<FolderSize[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const stat = await fs.promises.statfs("/");
        const total = stat.blocks * stat.blksize;
        const free = stat.bavail * stat.blksize;
        if (active) setDisk({ total, used: total - free, free, mount: "/" });
      } catch { /* fallback */ }

      const home = os.homedir();
      const dirs = ["Desktop", "Downloads", "Documents", "Developer", "Library", ".Trash"];
      const results: FolderSize[] = [];
      for (const d of dirs) {
        const p = path.join(home, d);
        if (fs.existsSync(p)) {
          const size = await getDirSize(p);
          results.push({ name: d, path: p, size });
        }
      }
      results.sort((a, b) => b.size - a.size);
      if (active) {
        setFolders(results);
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  if (!disk) return <List isLoading />;

  const pct = Math.round((disk.used / disk.total) * 100);
  const barLen = 30;
  const filled = Math.round((pct / 100) * barLen);
  const bar = "█".repeat(filled) + "░".repeat(barLen - filled);

  return (
    <List isLoading={loading} searchBarPlaceholder="Disk usage breakdown">
      <List.Section title={`Disk — ${pct}% used`}>
        <List.Item
          title={`${formatSize(disk.used)} / ${formatSize(disk.total)}`}
          subtitle={`${formatSize(disk.free)} free`}
          icon={pct > 90 ? Icon.Warning : Icon.HardDrive}
          accessories={[{ text: `${bar} ${pct}%` }]}
        />
      </List.Section>

      <List.Section title="Home Folders">
        {folders.map((f) => (
          <List.Item
            key={f.name}
            title={f.name}
            subtitle={f.path}
            icon={Icon.Folder}
            accessories={[{ text: formatSize(f.size) }]}
            actions={
              <ActionPanel>
                <Action.OpenInBrowser title="Open in Finder" url={`file://${f.path}`} />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>

      <List.Section title="Quick Actions">
        <List.Item
          title="View Full Disk Analysis"
          subtitle="DISK_SPACE.md with cleanup suggestions"
          icon={Icon.Document}
          actions={
            <ActionPanel>
              <Action.OpenInBrowser title="Open DISK_SPACE.md" url="file:///Users/paranjay/Developer/iftt/raycast-ext/DISK_SPACE.md" />
            </ActionPanel>
          }
        />
        <List.Item
          title="View Operations Log"
          subtitle="All file operations recorded"
          icon={Icon.Text}
          actions={
            <ActionPanel>
              <Action.OpenInBrowser title="Open OPERATIONS_LOG.md" url="file:///Users/paranjay/Developer/iftt/raycast-ext/OPERATIONS_LOG.md" />
            </ActionPanel>
          }
        />
      </List.Section>
    </List>
  );
}
