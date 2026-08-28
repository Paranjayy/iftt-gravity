import { ActionPanel, Action, Icon, Detail, confirmAlert, showToast, Toast, useNavigation, List, Color } from "@raycast/api";
import { useState, useEffect } from "react";
import { readdir, stat, rename, mkdir } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const HOME = process.env.HOME || "/Users/paranjay";
const DEVELOPER_DIR = path.join(HOME, "Developer");
const OUTSIDE_DIRS = [
  path.join(HOME, "Desktop"),
  path.join(HOME, "Documents"),
  path.join(HOME, "Downloads"),
  path.join(HOME, "Projects"),
  path.join(HOME, "Code"),
  path.join(HOME, "repos"),
  path.join(HOME, "work"),
];

type RepoInfo = {
  name: string;
  path: string;
  currentParent: string;
  hasGit: boolean;
  remoteUrl: string | null;
  isOnGitHub: boolean;
  lastCommitDate: Date | null;
  detectedType: string;
  isOutside: boolean;
};

const TYPE_DIRS: Record<string, string> = {
  raycast: path.join(DEVELOPER_DIR, "raycast"),
  "chrome-ext": path.join(DEVELOPER_DIR, "chrome-ext"),
  typescript: path.join(DEVELOPER_DIR, "typescript"),
  python: path.join(DEVELOPER_DIR, "python"),
  rust: path.join(DEVELOPER_DIR, "rust"),
  go: path.join(DEVELOPER_DIR, "go"),
  ios: path.join(DEVELOPER_DIR, "ios"),
  android: path.join(DEVELOPER_DIR, "android"),
  web: path.join(DEVELOPER_DIR, "web"),
  "home-assistant": path.join(DEVELOPER_DIR, "home-assistant"),
  smart: path.join(DEVELOPER_DIR, "smart-home"),
  media: path.join(DEVELOPER_DIR, "media"),
  discord: path.join(DEVELOPER_DIR, "discord"),
  telegram: path.join(DEVELOPER_DIR, "telegram"),
  ai: path.join(DEVELOPER_DIR, "ai"),
  tool: path.join(DEVELOPER_DIR, "tools"),
  archive: path.join(DEVELOPER_DIR, "_archive"),
  other: path.join(DEVELOPER_DIR, "other"),
};

function detectType(name: string, files: string[]): string {
  const lower = name.toLowerCase();
  const has = (ext: string) => files.some((f) => f.endsWith(ext));
  const hasDir = (dir: string) => files.includes(dir);

  if (has("package.json") && (has(".raycast") || has("raycast.env.d.ts") || lower.includes("raycast"))) return "raycast";
  if (has("manifest.json") && (has("background.js") || has("background.ts") || lower.includes("chrome") || lower.includes("extension"))) return "chrome-ext";
  if (has("tsconfig.json") && !has("package.json")) return "typescript";
  if (has("Cargo.toml")) return "rust";
  if (has("go.mod")) return "go";
  if (hasDir("Pods") || has("*.xcodeproj") || lower.includes("ios")) return "ios";
  if (has("build.gradle") || has("build.gradle.kts") || lower.includes("android")) return "android";
  if (has("requirements.txt") || has("pyproject.toml") || has("setup.py")) return "python";
  if (has("configuration.yaml") || has("automations.yaml") || lower.includes("home-assistant") || lower.includes("hass")) return "home-assistant";
  if (lower.includes("smart") || lower.includes("smartthings") || lower.includes("hubitat")) return "smart";
  if (lower.includes("discord")) return "discord";
  if (lower.includes("telegram")) return "telegram";
  if (lower.includes("media") || lower.includes("youtube") || lower.includes("spotify")) return "media";
  if (lower.includes("ai") || lower.includes("llm") || lower.includes("gpt") || lower.includes("claude")) return "ai";
  if (lower.includes("tool") || lower.includes("cli") || lower.includes("util")) return "tool";
  if (has("index.html") || has("next.config.js") || has("vite.config.ts")) return "web";
  return "other";
}

function typeColor(t: string): Color {
  const colors: Record<string, Color> = {
    raycast: Color.Blue,
    "chrome-ext": Color.Green,
    typescript: Color.Cyan,
    python: Color.Yellow,
    rust: Color.Orange,
    go: Color.SecondaryText,
    ios: Color.SecondaryText,
    android: Color.SecondaryText,
    web: Color.Purple,
    "home-assistant": Color.Red,
    smart: Color.Green,
    media: Color.Pink,
    discord: Color.Purple,
    telegram: Color.Blue,
    ai: Color.Magenta,
    tool: Color.SecondaryText,
    archive: Color.SecondaryText,
    other: Color.SecondaryText,
  };
  return colors[t] || Color.SecondaryText;
}

async function scanDir(dir: string, depth = 0, baseDir = DEVELOPER_DIR): Promise<RepoInfo[]> {
  if (depth > 2) return [];
  const repos: RepoInfo[] = [];
  const isOutside = !dir.startsWith(DEVELOPER_DIR);

  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const repoPath = path.join(dir, entry.name);
      const gitDir = path.join(repoPath, ".git");
      const hasGit = (await stat(gitDir).catch(() => null)) !== null;

      if (hasGit) {
        let remoteUrl: string | null = null;
        try {
          const { stdout } = await execFileAsync("git", ["-C", repoPath, "remote", "get-url", "origin"], { timeout: 3000 });
          remoteUrl = stdout.trim() || null;
        } catch {}

        let lastCommitDate: Date | null = null;
        try {
          const { stdout } = await execFileAsync("git", ["-C", repoPath, "log", "-1", "--format=%ci"], { timeout: 3000 });
          if (stdout.trim()) lastCommitDate = new Date(stdout.trim());
        } catch {}

        const files = await readdir(repoPath).catch(() => []);
        const detectedType = detectType(entry.name, files);

        repos.push({
          name: entry.name,
          path: repoPath,
          currentParent: dir,
          hasGit,
          remoteUrl,
          isOnGitHub: remoteUrl?.includes("github.com") ?? false,
          lastCommitDate,
          detectedType,
          isOutside,
        });
      } else {
        repos.push(...await scanDir(repoPath, depth + 1, baseDir));
      }
    }
  } catch {}

  return repos;
}

function formatAge(d: Date | null): string {
  if (!d) return "?";
  const days = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${Math.floor(days / 365)}y`;
}

function getStatus(repo: RepoInfo): string {
  if (!repo.hasRemote && repo.lastCommitDate) {
    const days = Math.floor((Date.now() - repo.lastCommitDate.getTime()) / (1000 * 60 * 60 * 24));
    if (days > 180) return "stale";
  }
  if (repo.hasRemote && repo.isOnGitHub) return "synced";
  if (repo.hasRemote && !repo.isOnGitHub) return "other-remote";
  return "local-only";
}

const STATUS_DIRS: Record<string, string> = {
  synced: path.join(DEVELOPER_DIR, "_synced"),
  "local-only": path.join(DEVELOPER_DIR, "_local-only"),
  "other-remote": path.join(DEVELOPER_DIR, "_other-remote"),
  stale: path.join(DEVELOPER_DIR, "_stale"),
};

const STATUS_LABELS: Record<string, string> = {
  synced: "Synced to GitHub",
  "local-only": "Local only (no remote)",
  "other-remote": "Remote (not GitHub)",
  stale: "Stale (6mo+ no commits)",
};

function OrganizeView() {
  const [repos, setRepos] = useState<RepoInfo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<"type" | "status">("type");
  const [filter, setFilter] = useState("all");
  const { push } = useNavigation();

  useEffect(() => {
    (async () => {
      const inside = await scanDir(DEVELOPER_DIR);
      const outside: RepoInfo[] = [];
      for (const dir of OUTSIDE_DIRS) {
        outside.push(...await scanDir(dir));
      }
      setRepos([...inside, ...outside]);
      setLoaded(true);
    })();
  }, []);

  const grouped = repos.reduce<Record<string, RepoInfo[]>>((acc, r) => {
    const key = view === "type" ? r.detectedType : getStatus(r);
    (acc[key] ||= []).push(r);
    return acc;
  }, {});

  const filtered = filter === "all" ? repos : repos.filter((r) => {
    const key = view === "type" ? r.detectedType : getStatus(r);
    return key === filter;
  });
  const groupCounts = Object.entries(grouped).sort(([, a], [, b]) => b.length - a.length);

  async function moveRepos(category: string, toMove: RepoInfo[]) {
    const dirs = view === "type" ? TYPE_DIRS : STATUS_DIRS;
    const dest = dirs[category] || path.join(DEVELOPER_DIR, category);
    if (
      !(await confirmAlert({
        title: `Move ${toMove.length} repo(s) to ${category}/?`,
        message: `Destination: ${dest}\n\n${toMove.map((r) => `• ${r.name}`).join("\n")}`,
        primaryAction: { title: "Move" },
      }))
    )
      return;

    await mkdir(dest, { recursive: true });
    let moved = 0;
    for (const repo of toMove) {
      try {
        await rename(repo.path, path.join(dest, repo.name));
        moved++;
      } catch (err) {
        showToast({ title: `Failed: ${repo.name}`, message: (err as Error).message, style: Toast.Style.Failure });
      }
    }
    showToast({ title: `Moved ${moved}/${toMove.length}`, style: Toast.Style.Success });
    scanDir(DEVELOPER_DIR).then(setRepos);
  }

  async function autoOrganize() {
    const dirs = view === "type" ? TYPE_DIRS : STATUS_DIRS;
    const moves = Object.entries(grouped).filter(([cat, list]) => {
      const dest = dirs[cat] || path.join(DEVELOPER_DIR, cat);
      return list.some((r) => !r.path.startsWith(dest));
    });

    if (moves.length === 0) {
      showToast({ title: "Already organized!", style: Toast.Style.Success });
      return;
    }

    const summary = moves.map(([cat, list]) => `• ${cat}: ${list.length} repos`).join("\n");
    if (
      !(await confirmAlert({
        title: `Auto-organize ${moves.length} categories?`,
        message: summary,
        primaryAction: { title: "Organize All" },
      }))
    )
      return;

    let total = 0;
    for (const [cat, list] of moves) {
      const dest = dirs[cat] || path.join(DEVELOPER_DIR, cat);
      await mkdir(dest, { recursive: true });
      for (const repo of list) {
        if (repo.path.startsWith(dest)) continue;
        try {
          await rename(repo.path, path.join(dest, repo.name));
          total++;
        } catch {}
      }
    }
    showToast({ title: `Organized ${total} repos`, style: Toast.Style.Success });
    scanDir(DEVELOPER_DIR).then(setRepos);
  }

  const filterDropdown = (
    <List.Dropdown tooltip="Filter" value={filter} onChange={setFilter} storeValue>
      <List.Dropdown.Item title={`All (${repos.length})`} value="all" />
      {groupCounts.map(([key, list]) => (
        <List.Dropdown.Item key={key} title={`${key} (${list.length})`} value={key} />
      ))}
    </List.Dropdown>
  );

  const viewDropdown = (
    <List.Dropdown tooltip="View" value={view} onChange={(v) => { setView(v as "type" | "status"); setFilter("all"); }}>
      <List.Dropdown.Item title="By Type" value="type" />
      <List.Dropdown.Item title="By Status" value="status" />
    </List.Dropdown>
  );

  return (
    <List
      isLoading={!loaded}
      searchBarPlaceholder="Filter repos…"
      searchBarAccessory={filterDropdown}
      toolbar={
        <List.Toolbar>
          <List.Toolbar.Item icon={Icon.Wand} tooltip="Auto-organize" onAction={autoOrganize} />
          {viewDropdown}
        </List.Toolbar>
      }
    >
      <List.Section title={`${view === "type" ? "Type" : "Status"} view — ${repos.length} repos`}>
        <List.Item
          title="▶ Auto-organize all repos"
          subtitle={`${repos.length} repos → ${view === "type" ? "type" : "status"}-based folders`}
          icon={Icon.Wand}
          actions={
            <ActionPanel>
              <Action title="Auto-organize" icon={Icon.Wand} onAction={autoOrganize} />
              <Action title="Switch to Type View" icon={Icon.TwoColumns} onAction={() => setView("type")} />
              <Action title="Switch to Status View" icon={Icon.List} onAction={() => setView("status")} />
            </ActionPanel>
          }
        />
      </List.Section>
      {repos.filter((r) => r.isOutside).length > 0 && (
        <List.Section title={`Outside ~/Developer (${repos.filter((r) => r.isOutside).length})`}>
          <List.Item
            title="▶ Bring all outside repos to Developer"
            subtitle={`${repos.filter((r) => r.isOutside).length} repos scattered outside ~/Developer/`}
            icon={Icon.ArrowRight}
            actions={
              <ActionPanel>
                <Action
                  title="Bring all outside repos"
                  icon={Icon.ArrowRight}
                  onAction={async () => {
                    const outside = repos.filter((r) => r.isOutside);
                    if (
                      !(await confirmAlert({
                        title: `Bring ${outside.length} repos to ~/Developer/?`,
                        message: outside.map((r) => `• ${r.name} (${r.path})`).join("\n"),
                        primaryAction: { title: "Bring All" },
                      }))
                    )
                      return;
                    let moved = 0;
                    for (const repo of outside) {
                      const dest = TYPE_DIRS[repo.detectedType] || path.join(DEVELOPER_DIR, repo.detectedType);
                      await mkdir(dest, { recursive: true });
                      try {
                        await rename(repo.path, path.join(dest, repo.name));
                        moved++;
                      } catch {}
                    }
                    showToast({ title: `Brought ${moved}/${outside.length} repos`, style: Toast.Style.Success });
                    (async () => {
                      const inside = await scanDir(DEVELOPER_DIR);
                      const outsideAfter: RepoInfo[] = [];
                      for (const dir of OUTSIDE_DIRS) outsideAfter.push(...await scanDir(dir));
                      setRepos([...inside, ...outsideAfter]);
                    })();
                  }}
                />
              </ActionPanel>
            }
          />
          {repos.filter((r) => r.isOutside).map((repo) => (
            <List.Item
              key={repo.path}
              title={repo.name}
              subtitle={repo.path}
              icon={{ source: Icon.Folder, tintColor: Color.Yellow }}
              accessories={[
                { text: repo.detectedType, color: typeColor(repo.detectedType) },
                { text: "outside", color: Color.Yellow },
              ]}
              actions={
                <ActionPanel>
                  <Action title="Bring to Developer" icon={Icon.ArrowRight} onAction={() => moveRepos(repo.detectedType, [repo])} />
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      )}
      {groupCounts.map(([cat, list]) => (
        <List.Section key={cat} title={`${cat} (${list.length})`}>
          {list.map((repo) => {
            const color = view === "type" ? typeColor(repo.detectedType) : Color.SecondaryText;
            const label = view === "type" ? repo.detectedType : getStatus(repo);
            return (
              <List.Item
                key={repo.path}
                title={repo.name}
                subtitle={`${formatAge(repo.lastCommitDate)} · ${repo.path.replace(DEVELOPER_DIR + "/", "")}`}
                icon={{ source: Icon.Folder, tintColor: color }}
                accessories={[
                  { text: label, color },
                  { text: repo.isOnGitHub ? "GitHub ✓" : repo.hasRemote ? "remote" : "local", color: repo.isOnGitHub ? Color.Green : Color.SecondaryText },
                ]}
                actions={
                  <ActionPanel>
                    {repo.isOutside && (
                      <Action title="Bring to Developer" icon={Icon.ArrowRight} onAction={() => moveRepos(repo.detectedType, [repo])} />
                    )}
                    {Object.keys(view === "type" ? TYPE_DIRS : STATUS_DIRS).filter((c) => c !== cat).map((c) => (
                      <Action key={c} title={`Move to ${c}`} icon={Icon.Folder} onAction={() => moveRepos(c, [repo])} />
                    ))}
                  </ActionPanel>
                }
              />
            );
          })}
        </List.Section>
      ))}
    </List>
  );
}

export default function Command() {
  return <OrganizeView />;
}
