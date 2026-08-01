import { Action, ActionPanel, Color, Icon, List, showToast, Toast } from "@raycast/api";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { useEffect, useMemo, useState } from "react";

const execFileAsync = promisify(execFile);
const vaultPath = "/Users/paranjay/Developer/personal-wiki-vault";
const syncScript = "/Users/paranjay/Developer/iftt/raycast-ext/scripts/clipboard-vault-sync.ts";
const backupScript = "/Users/paranjay/Developer/iftt/raycast-ext/scripts/clipboard-vault-backup.sh";

type Transcript = { category: string; channel: string; file: string; modified: string; sourceType: "raycast-clipboard" | "social-companion-download"; title: string; url: string | null };
type VaultStats = { generatedAt: string; sourceFileCount: number; transcriptCount: number; uniqueUrlCount: number; categoryCounts: Record<string, number>; transcripts: Transcript[] };

export default function ClipboardVault() {
  const [stats, setStats] = useState<VaultStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [category, setCategory] = useState("all");

  async function load() {
    try {
      const content = await readFile(path.join(vaultPath, "generated", "stats.json"), "utf8");
      setStats(JSON.parse(content) as VaultStats);
    } catch {
      setStats(null);
    } finally {
      setLoading(false);
    }
  }

  async function sync() {
    setSyncing(true);
    const toast = await showToast({ style: Toast.Style.Animated, title: "Syncing Clipboard Vault…" });
    try {
      const { stdout } = await execFileAsync("bun", [syncScript]);
      toast.style = Toast.Style.Success;
      toast.title = "Clipboard Vault synced";
      toast.message = stdout.trim();
      await load();
    } catch (error) {
      toast.style = Toast.Style.Failure;
      toast.title = "Clipboard Vault sync failed";
      toast.message = error instanceof Error ? error.message : "Unknown error";
    } finally {
      setSyncing(false);
    }
  }

  async function backup() {
    setSyncing(true);
    const toast = await showToast({ style: Toast.Style.Animated, title: "Backing up Clipboard Vault…" });
    try {
      const { stdout } = await execFileAsync(backupScript);
      toast.style = Toast.Style.Success;
      toast.title = "Clipboard Vault backed up";
      toast.message = stdout.trim();
      await load();
    } catch (error) {
      toast.style = Toast.Style.Failure;
      toast.title = "Clipboard Vault backup failed";
      toast.message = error instanceof Error ? error.message : "Unknown error";
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => { load(); }, []);
  const items = useMemo(
    () => (stats?.transcripts || []).filter((item) => category === "all" || item.category === category),
    [category, stats],
  );

  return (
    <List
      isLoading={loading || syncing}
      searchBarPlaceholder="Search transcript title, channel, or category…"
      navigationTitle="Clipboard Vault"
      searchBarAccessory={
        <List.Dropdown tooltip="Filter by category" onChange={setCategory} value={category}>
          <List.Dropdown.Item title="All Categories" value="all" />
          {Object.keys(stats?.categoryCounts || {}).map((category) => <List.Dropdown.Item key={category} title={category} value={category} />)}
        </List.Dropdown>
      }
    >
      {stats && <List.Section title="Vault Stats">
        <List.Item
          icon={Icon.BarChart}
          title={`${stats.transcriptCount} transcripts · ${stats.uniqueUrlCount} unique URLs`}
          subtitle={`${stats.sourceFileCount} cache files scanned · latest capture ${new Date(stats.generatedAt).toLocaleString()}`}
          actions={<ActionPanel><Action title="Sync Clipboard Vault" icon={Icon.Repeat} onAction={sync} /><Action title="Sync, Commit & Push Vault" icon={Icon.Upload} onAction={backup} /><Action.ShowInFinder title="Open Vault Folder" path={vaultPath} /></ActionPanel>}
        />
      </List.Section>}
      <List.Section title={category === "all" ? "All Transcripts" : category}>
      {items.map((item) => (
        <List.Item
          key={item.file}
          icon={{ source: Icon.Document, tintColor: Color.Green }}
          title={item.title}
          subtitle={item.channel}
          accessories={[{ tag: item.category }, { tag: item.sourceType === "social-companion-download" ? "Social Companion" : "Raycast" }, { date: new Date(item.modified) }]}
          actions={<ActionPanel>
            <Action.Open title="Open Markdown" target={path.join(vaultPath, item.file)} />
            <Action.ShowInFinder path={path.join(vaultPath, item.file)} />
            {item.url && <Action.OpenInBrowser url={item.url} />}
            <Action title="Sync Clipboard Vault" icon={Icon.Repeat} onAction={sync} />
            <Action title="Sync, Commit & Push Vault" icon={Icon.Upload} onAction={backup} />
            <Action.ShowInFinder title="Open Vault Folder" path={vaultPath} />
          </ActionPanel>}
        />
      ))}
      </List.Section>
      {!loading && !stats && <List.EmptyView title="Clipboard Vault not synced yet" description="Press ⏎ to create the first local-only vault snapshot." actions={<ActionPanel><Action title="Sync Clipboard Vault" onAction={sync} /><Action title="Sync, Commit & Push Vault" icon={Icon.Upload} onAction={backup} /></ActionPanel>} />}
    </List>
  );
}
