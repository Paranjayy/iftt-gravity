import { ActionPanel, Action, Icon, Detail, confirmAlert, showToast, Toast, useNavigation, List, Color } from "@raycast/api";
import { useState, useEffect } from "react";
import { readdir, stat, rename, mkdir } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const DEVELOPER_DIR = path.join(process.env.HOME || "/Users/paranjay", "Developer");
const ARCHIVE_DIR = path.join(DEVELOPER_DIR, "_archive");
const ACTIVE_DIR = path.join(DEVELOPER_DIR, "_active");
const LEARNING_DIR = path.join(DEVELOPER_DIR, "_learning");
const CLIENT_DIR = path.join(DEVELOPER_DIR, "_clients");

type RepoInfo = {
  name: string;
  path: string;
  hasGit: boolean;
  hasRemote: boolean;
  remoteUrl: string | null;
  isOnGitHub: boolean;
  lastCommitDate: Date | null;
  lastCommitMsg: string | null;
  isDirty: boolean;
  branchCount: number;
  size: number;
};

function isGitHub(url: string | null): boolean {
  return url?.includes("github.com") ?? false;
}

function daysSince(d: Date | null): number | null {
  if (!d) return null;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function categorize(repo: RepoInfo): string {
  if (!repo.hasRemote && daysSince(repo.lastCommitDate) !== null && daysSince(repo.lastCommitDate)! > 180) return "archive";
  if (!repo.hasRemote && repo.isDirty) return "archive";
  if (repo.name.toLowerCase().includes("learning") || repo.name.toLowerCase().includes("oss")) return "learning";
  if (repo.name.toLowerCase().includes("client") || repo.name.toLowerCase().includes("praduman")) return "client";
  return "active";
}

function categoryColor(cat: string): Color {
  switch (cat) {
    case "archive": return Color.SecondaryText;
    case "learning": return Color.Blue;
    case "client": return Color.Purple;
    default: return Color.Green;
  }
}

function categoryIcon(cat: string): Icon {
  switch (cat) {
    case "archive": return Icon.Archive;
    case "learning": return Icon.Book;
    case "client": return Icon.Person;
    default: return Icon.Folder;
  }
}

async function scanRepos(): Promise<RepoInfo[]> {
  const entries = await readdir(DEVELOPER_DIR, { withFileTypes: true });
  const repos: RepoInfo[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const repoPath = path.join(DEVELOPER_DIR, entry.name);
    const gitDir = path.join(repoPath, ".git");
    const hasGit = (await stat(gitDir).catch(() => null)) !== null;
    if (!hasGit) continue;

    let remoteUrl: string | null = null;
    let isDirty = false;
    let lastCommitDate: Date | null = null;
    let lastCommitMsg: string | null = null;
    let branchCount = 0;

    try {
      const { stdout: remote } = await execFileAsync("git", ["-C", repoPath, "remote", "get-url", "origin"], { timeout: 5000 }).catch(() => ({ stdout: "" }));
      remoteUrl = remote.trim() || null;
    } catch {}

    try {
      const { stdout: status } = await execFileAsync("git", ["-C", repoPath, "status", "--porcelain"], { timeout: 5000 });
      isDirty = status.trim().length > 0;
    } catch {}

    try {
      const { stdout: log } = await execFileAsync("git", ["-C", repoPath, "log", "-1", "--format=%ci%n%s"], { timeout: 5000 });
      const lines = log.trim().split("\n");
      if (lines[0]) lastCommitDate = new Date(lines[0]);
      if (lines[1]) lastCommitMsg = lines[1];
    } catch {}

    try {
      const { stdout: branches } = await execFileAsync("git", ["-C", repoPath, "branch", "--list"], { timeout: 5000 });
      branchCount = branches.split("\n").filter((b) => b.trim()).length;
    } catch {}

    const repoStat = await stat(repoPath).catch(() => null);

    repos.push({
      name: entry.name,
      path: repoPath,
      hasGit,
      hasRemote: remoteUrl !== null,
      remoteUrl,
      isOnGitHub: isGitHub(remoteUrl),
      lastCommitDate,
      lastCommitMsg,
      isDirty,
      branchCount,
      size: repoStat?.blocks ? repoStat.blocks * 512 : 0,
    });
  }

  repos.sort((a, b) => (b.lastCommitDate?.getTime() || 0) - (a.lastCommitDate?.getTime() || 0));
  return repos;
}

function formatAge(d: Date | null): string {
  if (!d) return "unknown";
  const days = daysSince(d);
  if (days === null) return "unknown";
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function OrganizeView() {
  const [repos, setRepos] = useState<RepoInfo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState("all");
  const { push } = useNavigation();

  useEffect(() => {
    scanRepos().then((r) => {
      setRepos(r);
      setLoaded(true);
    });
  }, []);

  const categorized = repos.map((r) => ({ ...r, suggested: categorize(r) }));
  const filtered = filter === "all" ? categorized : categorized.filter((r) => r.suggested === filter);
  const counts = {
    all: categorized.length,
    active: categorized.filter((r) => r.suggested === "active").length,
    learning: categorized.filter((r) => r.suggested === "learning").length,
    client: categorized.filter((r) => r.suggested === "client").length,
    archive: categorized.filter((r) => r.suggested === "archive").length,
  };

  async function moveToCategory(cat: string, reposToMove: RepoInfo[]) {
    const dirs: Record<string, string> = {
      active: ACTIVE_DIR,
      learning: LEARNING_DIR,
      client: CLIENT_DIR,
      archive: ARCHIVE_DIR,
    };
    const dest = dirs[cat];
    if (!dest) return;

    if (
      !(await confirmAlert({
        title: `Move ${reposToMove.length} repo(s) to ${cat}?`,
        message: `Destination: ${dest}\n\n${reposToMove.map((r) => `• ${r.name}`).join("\n")}`,
        primaryAction: { title: "Move" },
      }))
    )
      return;

    await mkdir(dest, { recursive: true });
    let moved = 0;
    for (const repo of reposToMove) {
      try {
        await rename(repo.path, path.join(dest, repo.name));
        moved++;
      } catch (err) {
        showToast({ title: `Failed: ${repo.name}`, message: (err as Error).message, style: Toast.Style.Failure });
      }
    }
    showToast({ title: `Moved ${moved}/${reposToMove.length}`, style: Toast.Style.Success });
    scanRepos().then(setRepos);
  }

  return (
    <List isLoading={!loaded} searchBarPlaceholder="Filter repos…" searchBarAccessory={
      <List.Dropdown tooltip="Category" value={filter} onChange={setFilter} storeValue>
        <List.Dropdown.Item title={`All (${counts.all})`} value="all" />
        <List.Dropdown.Item title={`Active (${counts.active})`} value="active" />
        <List.Dropdown.Item title={`Learning (${counts.learning})`} value="learning" />
        <List.Dropdown.Item title={`Client (${counts.client})`} value="client" />
        <List.Dropdown.Item title={`Archive (${counts.archive})`} value="archive" />
      </List.Dropdown>
    }>
      <List.Section title={`${filtered.length} repos`}>
        {filtered.map((repo) => (
          <List.Item
            key={repo.path}
            title={repo.name}
            subtitle={repo.lastCommitMsg ? `${formatAge(repo.lastCommitDate)} — ${repo.lastCommitMsg.slice(0, 60)}` : formatAge(repo.lastCommitDate)}
            icon={{ source: categoryIcon(repo.suggested), tintColor: categoryColor(repo.suggested) }}
            accessories={[
              { text: repo.suggested, color: categoryColor(repo.suggested) },
              { text: repo.isOnGitHub ? "GitHub ✓" : repo.hasRemote ? "remote" : "local only", color: repo.isOnGitHub ? Color.Green : repo.hasRemote ? Color.Yellow : Color.SecondaryText },
              { text: repo.isDirty ? "● dirty" : "", color: repo.isDirty ? Color.Red : undefined },
            ]}
            actions={
              <ActionPanel>
                <Action title="Move to Active" icon={Icon.Folder} onAction={() => moveToCategory("active", [repo])} />
                <Action title="Move to Learning" icon={Icon.Book} onAction={() => moveToCategory("learning", [repo])} />
                <Action title="Move to Client" icon={Icon.Person} onAction={() => moveToCategory("client", [repo])} />
                <Action title="Move to Archive" icon={Icon.Archive} onAction={() => moveToCategory("archive", [repo])} />
                <Action title="Open in Finder" icon={Icon.Finder} onAction={() => {}} />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
    </List>
  );
}

export default function Command() {
  return <OrganizeView />;
}
