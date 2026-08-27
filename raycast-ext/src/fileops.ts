import { execFile } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { createHash } from "crypto";

const execFileAsync = promisify(execFile);

export const SCOPES: Record<string, string> = {
  desktop: path.join(os.homedir(), "Desktop"),
  downloads: path.join(os.homedir(), "Downloads"),
  documents: path.join(os.homedir(), "Documents"),
  developer: path.join(os.homedir(), "Developer"),
  home: os.homedir(),
};

export function resolveScope(scope: string): string {
  if (SCOPES[scope]) return SCOPES[scope];
  return path.resolve(scope.replace(/^~/, os.homedir()));
}

export function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

const TRASH_DIR = path.join(os.homedir(), ".Trash");

export async function trashPath(absPath: string): Promise<string> {
  await fs.promises.mkdir(TRASH_DIR, { recursive: true });
  const base = path.basename(absPath);
  let dest = path.join(TRASH_DIR, base);
  let n = 1;
  while (fs.existsSync(dest)) {
    dest = path.join(TRASH_DIR, `${base}-${n++}`);
  }
  await fs.promises.rename(absPath, dest);
  return dest;
}

/* --------------------------- macOS screenshot --------------------------- */

export async function setScreenshotFormat(format: "jpg" | "png"): Promise<void> {
  await execFileAsync("defaults", ["write", "com.apple.screencapture", "type", format], { timeout: 10000 });
  await execFileAsync("killall", ["SystemUIServer"], { timeout: 10000 }).catch(() => {});
}

export async function setScreenshotNoShadow(on: boolean): Promise<void> {
  await execFileAsync("defaults", ["write", "com.apple.screencapture", "disable-shadow", "-bool", on ? "true" : "false"], {
    timeout: 10000,
  });
  await execFileAsync("killall", ["SystemUIServer"], { timeout: 10000 }).catch(() => {});
}

/* ----------------------------- PNG → JPG ----------------------------- */

export interface ConvertReport {
  total: number;
  converted: string[];
  failed: { file: string; reason: string }[];
  savedBytes: number;
}

export interface FileInfo {
  path: string;
  name: string;
  size: number;
}

export async function listPngs(root: string, recursive = true): Promise<FileInfo[]> {
  const pngs = await collectPngs(root, recursive);
  return Promise.all(
    pngs.map(async (p) => ({ path: p, name: path.basename(p), size: (await fs.promises.stat(p)).size }))
  );
}

async function collectPngs(root: string, recursive: boolean): Promise<string[]> {
  const out: string[] = [];
  const walk = async (dir: string, depth: number) => {
    let entries;
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === ".git" || entry.name.startsWith(".")) continue;
        if (recursive) await walk(full, depth + 1);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".png")) {
        out.push(full);
      }
    }
  };
  await walk(root, 0);
  return out;
}

export async function convertPngToJpg(
  root: string,
  opts: { recursive?: boolean; quality?: number; files?: string[]; keepOriginals?: boolean; onProgress?: (done: number, total: number, name: string) => void } = {}
): Promise<ConvertReport> {
  const recursive = opts.recursive ?? true;
  const quality = Math.max(0, Math.min(100, opts.quality ?? 80));
  const keep = opts.keepOriginals ?? false;
  const pngs = opts.files
    ? opts.files.filter((p) => p.toLowerCase().endsWith(".png"))
    : await collectPngs(root, recursive);
  const report: ConvertReport = { total: pngs.length, converted: [], failed: [], savedBytes: 0 };
  let done = 0;
  for (const png of pngs) {
    const dir = path.dirname(png);
    const base = path.basename(png, path.extname(png));
    const jpg = path.join(dir, `${base}.jpg`);
    if (fs.existsSync(jpg) && jpg !== png) {
      done++;
      opts.onProgress?.(done, pngs.length, path.basename(png));
      continue;
    }
    try {
      await execFileAsync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", String(quality), png, "--out", jpg], {
        timeout: 30000,
      });
      const pngStat = await fs.promises.stat(png).catch(() => null);
      const jpgStat = await fs.promises.stat(jpg).catch(() => null);
      if (!jpgStat || jpgStat.size === 0) throw new Error("empty output");
      report.converted.push(jpg);
      if (keep) {
        report.savedBytes += 0;
      } else {
        await trashPath(png);
        report.savedBytes += pngStat ? pngStat.size - jpgStat.size : 0;
      }
    } catch (err) {
      report.failed.push({ file: png, reason: (err as Error).message.slice(0, 120) });
      try {
        const j = await fs.promises.stat(jpg).catch(() => null);
        if (j && j.size === 0) await fs.promises.rm(jpg, { force: true });
      } catch {
        /* ignore */
      }
    }
    done++;
    opts.onProgress?.(done, pngs.length, path.basename(png));
  }
  return report;
}

export async function estimatePngJpg(pngPath: string, quality: number): Promise<number | null> {
  const tmp = path.join(os.tmpdir(), `sift-est-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`);
  try {
    await execFileAsync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", String(quality), pngPath, "--out", tmp], {
      timeout: 30000,
    });
    const st = await fs.promises.stat(tmp).catch(() => null);
    return st ? st.size : null;
  } catch {
    return null;
  } finally {
    await fs.promises.rm(tmp, { force: true });
  }
}

/* ------------------------------ Flatten ------------------------------ */

export type FlattenBy = "ext" | "type" | "date" | "day" | "week";

const SMART_CATEGORIES: Record<string, string[]> = {
  Screenshots: ["Screenshot", "SCR-", "Screen Shot"],
  Wallpapers: [".heic", ".heif"],
  Images: [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".svg", ".webp", ".ico", ".tiff", ".tif"],
  Video: [".mp4", ".mov", ".avi", ".mkv", ".webm", ".flv", ".wmv", ".m4v"],
  Audio: [".mp3", ".wav", ".flac", ".aac", ".ogg", ".m4a", ".opus", ".wma"],
  Documents: [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".rtf", ".odt", ".pages", ".numbers", ".keynote"],
  Code: [".js", ".ts", ".jsx", ".tsx", ".py", ".go", ".rs", ".java", ".c", ".cpp", ".h", ".rb", ".php", ".swift", ".kt", ".css", ".html"],
  Archives: [".zip", ".rar", ".7z", ".tar", ".gz", ".bz2", ".xz", ".tgz"],
  Fonts: [".ttf", ".otf", ".woff", ".woff2", ".eot"],
  Data: [".json", ".xml", ".yaml", ".yml", ".csv", ".sql", ".db", ".sqlite"],
  "Disk Images": [".dmg", ".iso", ".img"],
};

function smartCategory(name: string, ext: string): string {
  if (name.startsWith("Screenshot") || name.startsWith("SCR-") || name.startsWith("Screen Shot")) return "Screenshots";
  if (/^Screenshot \d{4}-\d{2}-\d{2} at/.test(name)) return "Screenshots";
  if (/^SCR-\d{8}/.test(name)) return "Screenshots";
  for (const [cat, exts] of Object.entries(SMART_CATEGORIES)) {
    if (exts.includes(ext)) return cat;
  }
  return "Other";
}

function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function bucketFor(file: string, by: FlattenBy): string {
  const name = path.basename(file);
  const ext = path.extname(file).toLowerCase();
  const stat = fs.statSync(file);
  switch (by) {
    case "ext":
      return ext ? ext.slice(1) : "no-extension";
    case "type":
      return smartCategory(name, ext);
    case "date":
    case "day":
      return stat.mtime.toISOString().slice(0, 10);
    case "week":
      return isoWeekKey(stat.mtime);
    default:
      return "other";
  }
}

export interface FlattenReport {
  total: number;
  moved: { from: string; to: string }[];
  failed: { file: string; reason: string }[];
}

export async function planFlatten(
  root: string,
  by: FlattenBy,
  recursive = true
): Promise<{ file: string; target: string }[]> {
  const files = await collectFiles(root, recursive);
  return files.map((f) => ({ file: f, target: path.join(root, bucketFor(f, by), path.basename(f)) }));
}

async function collectFiles(root: string, recursive: boolean): Promise<string[]> {
  const out: string[] = [];
  const walk = async (dir: string, depth: number) => {
    let entries;
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === ".git" || entry.name.startsWith(".")) continue;
        if (recursive) await walk(full, depth + 1);
      } else if (entry.isFile()) {
        out.push(full);
      }
    }
  };
  await walk(root, 0);
  return out;
}

function uniqueDest(target: string): string {
  if (!fs.existsSync(target)) return target;
  const dir = path.dirname(target);
  const ext = path.extname(target);
  const base = path.basename(target, ext);
  let n = 1;
  let candidate = path.join(dir, `${base}-${n}${ext}`);
  while (fs.existsSync(candidate)) {
    n++;
    candidate = path.join(dir, `${base}-${n}${ext}`);
  }
  return candidate;
}

export async function flattenDir(
  root: string,
  by: FlattenBy,
  opts: { recursive?: boolean; files?: string[]; onProgress?: (done: number, total: number, name: string) => void } = {}
): Promise<FlattenReport> {
  const recursive = opts.recursive ?? true;
  const files = opts.files ?? (await collectFiles(root, recursive));
  const report: FlattenReport = { total: files.length, moved: [], failed: [] };
  let done = 0;
  for (const file of files) {
    let bucket: string;
    try {
      bucket = bucketFor(file, by);
    } catch (err) {
      report.failed.push({ file, reason: (err as Error).message.slice(0, 120) });
      continue;
    }
    const destDir = path.join(root, bucket);
    const dest = uniqueDest(path.join(destDir, path.basename(file)));
    if (path.resolve(dest) === path.resolve(file)) continue;
    try {
      await fs.promises.mkdir(destDir, { recursive: true });
      await fs.promises.rename(file, dest);
      report.moved.push({ from: file, to: dest });
    } catch (err) {
      report.failed.push({ file, reason: (err as Error).message.slice(0, 120) });
    }
    done++;
    opts.onProgress?.(done, files.length, path.basename(file));
  }
  return report;
}

/* ------------------------------ Dev Purge ----------------------------- */

export interface JunkItem {
  path: string;
  size: number;
  kind: "dir" | "file";
}

const JUNK_DIRS = new Set([
  "node_modules", "dist", "build", "out", ".next", ".turbo", ".cache", ".parcel-cache",
  ".eslintcache", "coverage", ".svelte-kit", ".docusaurus", ".vite", ".output", ".vercel",
  ".idea", ".gradle", ".terraform", "__pycache__", ".pytest_cache", ".mypy_cache",
  ".ruff_cache", ".tox", "venv", ".venv", "env", "target",
]);
const JUNK_FILE_GLOB = /\.(tsbuildinfo|pyc|o|obj|class)$/;

async function dirSize(dirPath: string): Promise<number> {
  let total = 0;
  const queue = [dirPath];
  while (queue.length > 0) {
    const current = queue.shift()!;
    let entries;
    try {
      entries = await fs.promises.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      try {
        if (entry.isDirectory()) queue.push(full);
        else if (entry.isFile()) total += (await fs.promises.stat(full)).size;
      } catch {
        /* ignore */
      }
    }
  }
  return total;
}

export async function findDevJunk(root: string, maxDepth = 8): Promise<JunkItem[]> {
  const items: JunkItem[] = [];
  const rootStat = await fs.promises.stat(root).catch(() => null);
  if (!rootStat?.isDirectory()) return items;
  const walk = async (dir: string, depth: number) => {
    if (depth > maxDepth) return;
    let entries;
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.name.startsWith(".")) {
        if (JUNK_DIRS.has(entry.name) && entry.isDirectory()) {
          items.push({ path: full, size: await dirSize(full), kind: "dir" });
        } else if (entry.isFile() && JUNK_FILE_GLOB.test(entry.name)) {
          try {
            items.push({ path: full, size: (await fs.promises.stat(full)).size, kind: "file" });
          } catch {
            /* ignore */
          }
        }
        continue;
      }
      if (entry.isDirectory()) {
        if (JUNK_DIRS.has(entry.name)) {
          items.push({ path: full, size: await dirSize(full), kind: "dir" });
        } else {
          await walk(full, depth + 1);
        }
      } else if (entry.isFile() && JUNK_FILE_GLOB.test(entry.name)) {
        try {
          items.push({ path: full, size: (await fs.promises.stat(full)).size, kind: "file" });
        } catch {
          /* ignore */
        }
      }
    }
  };
  await walk(root, 0);
  return items.sort((a, b) => b.size - a.size);
}

export interface PurgeReport {
  items: JunkItem[];
  trashed: { path: string; to: string }[];
  failed: { path: string; reason: string }[];
  reclaimed: number;
}

export async function purgeJunk(
  items: JunkItem[],
  onProgress?: (done: number, total: number, name: string) => void
): Promise<PurgeReport> {
  const report: PurgeReport = { items, trashed: [], failed: [], reclaimed: 0 };
  let done = 0;
  for (const item of items) {
    try {
      const to = await trashPath(item.path);
      report.trashed.push({ path: item.path, to });
      report.reclaimed += item.size;
    } catch (err) {
      report.failed.push({ path: item.path, reason: (err as Error).message.slice(0, 120) });
    }
    done++;
    onProgress?.(done, items.length, path.basename(item.path));
  }
  return report;
}

/* ------------------------------- Dedup ------------------------------- */

export interface DupGroup {
  hash: string;
  size: number;
  files: string[];
}

function hashFile(file: string): string {
  return createHash("sha1").update(fs.readFileSync(file)).digest("hex");
}

export async function findDuplicates(root: string, opts: { recursive?: boolean; minSize?: number } = {}): Promise<DupGroup[]> {
  const recursive = opts.recursive ?? true;
  const minSize = opts.minSize ?? 0;
  const files = await collectFiles(root, recursive);
  const byHash = new Map<string, DupGroup>();
  for (const file of files) {
    try {
      const stat = await fs.promises.stat(file);
      if (stat.size < minSize) continue;
      const hash = hashFile(file);
      const existing = byHash.get(hash);
      if (existing) existing.files.push(file);
      else byHash.set(hash, { hash, size: stat.size, files: [file] });
    } catch {
      /* ignore */
    }
  }
  return Array.from(byHash.values())
    .filter((g) => g.files.length > 1)
    .sort((a, b) => b.size * b.files.length - a.size * a.files.length);
}

export interface DedupReport {
  groups: DupGroup[];
  trashed: { path: string; to: string }[];
  failed: { path: string; reason: string }[];
  reclaimed: number;
}

export async function dedupFiles(
  groups: DupGroup[],
  onProgress?: (done: number, total: number, name: string) => void
): Promise<DedupReport> {
  const report: DedupReport = { groups, trashed: [], failed: [], reclaimed: 0 };
  let done = 0;
  const total = groups.reduce((n, g) => n + g.files.length - 1, 0);
  for (const group of groups) {
    const keep = group.files[0];
    for (const dup of group.files.slice(1)) {
      try {
        const to = await trashPath(dup);
        report.trashed.push({ path: dup, to });
        report.reclaimed += group.size;
      } catch (err) {
        report.failed.push({ path: dup, reason: (err as Error).message.slice(0, 120) });
      }
      done++;
      onProgress?.(done, total, path.basename(dup));
    }
  }
  return report;
}

/* ------------------------------ GitHub ------------------------------- */

export interface RepoSyncResult {
  name: string;
  status: "pushed" | "created" | "failed";
  detail: string;
}

export async function findGitRepos(root: string, maxDepth = 6): Promise<string[]> {
  const { stdout } = await execFileAsync("find", [root, "-name", ".git", "-maxdepth", String(maxDepth), "-type", "d"], {
    timeout: 60000,
  }).catch(() => ({ stdout: "" }));
  return stdout
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => path.dirname(l));
}

async function runGit(cwd: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync("git", args, { cwd, timeout: 30000 });
    return stdout.trim();
  } catch {
    return "";
  }
}

export async function syncToGithub(root: string): Promise<RepoSyncResult[]> {
  const ghAvailable = await execFileAsync("gh", ["auth", "status"], { timeout: 10000 }).then(
    () => true,
    () => false
  );
  if (!ghAvailable) {
    return [{ name: "(all)", status: "failed", detail: "gh CLI not authenticated — run `gh auth login`" }];
  }
  const repos = await findGitRepos(root);
  const results: RepoSyncResult[] = [];
  for (const repoPath of repos) {
    const name = path.basename(repoPath);
    const remote = await runGit(repoPath, ["remote", "get-url", "origin"]);
    try {
      if (remote) {
        await execFileAsync("git", ["push", "--all"], { cwd: repoPath, timeout: 120000 });
        try {
          await execFileAsync("git", ["push", "--tags"], { cwd: repoPath, timeout: 120000 });
        } catch {
          /* no tags */
        }
        results.push({ name, status: "pushed", detail: remote });
      } else {
        await execFileAsync("gh", ["repo", "create", name, "--private", "--source", repoPath, "--remote", "origin"], {
          timeout: 120000,
        });
        await execFileAsync("git", ["push", "--all"], { cwd: repoPath, timeout: 120000 });
        await execFileAsync("git", ["push", "--tags"], { cwd: repoPath, timeout: 120000 }).catch(() => {});
        results.push({ name, status: "created", detail: `https://github.com/${name}` });
      }
    } catch (err) {
      results.push({ name, status: "failed", detail: (err as Error).message.slice(0, 120) });
    }
  }
  return results;
}

/* ----------------------- Repo deep-scan + backup ----------------------- */

export interface RepoBranch {
  name: string;
  current: boolean;
  ahead: number;
  behind: number;
  hasUpstream: boolean;
}

export interface RepoDeep {
  name: string;
  path: string;
  hasRemote: boolean;
  remoteUrl: string | null;
  remoteIsGitHub: boolean;
  dirty: boolean;
  branches: RepoBranch[];
  lastCommit: string | null;
}

export async function inspectReposDeep(root: string, maxDepth = 7): Promise<RepoDeep[]> {
  const paths = await findGitRepos(root, maxDepth);
  const repos: RepoDeep[] = [];
  for (const p of paths) {
    const name = path.basename(p);
    const remoteUrl = (await runGit(p, ["remote", "get-url", "origin"])) || null;
    const status = await runGit(p, ["status", "--porcelain"]);
    const dirty = status.trim().length > 0;
    const branchOut = await runGit(p, ["branch", "-vv"]);
    const branches: RepoBranch[] = [];
    for (const line of branchOut.split("\n")) {
      const m = line.match(/^[\s*]*(\S+)\s+\S+(?:\s+\[(.*?)\])?/);
      if (!m) continue;
      const meta = m[2] || "";
      const up = meta.match(/ahead (\d+)/);
      const down = meta.match(/behind (\d+)/);
      branches.push({
        name: m[1],
        current: line.trimStart().startsWith("*"),
        ahead: up ? parseInt(up[1], 10) : 0,
        behind: down ? parseInt(down[1], 10) : 0,
        hasUpstream: meta.length > 0,
      });
    }
    repos.push({
      name,
      path: p,
      hasRemote: Boolean(remoteUrl),
      remoteUrl,
      remoteIsGitHub: remoteUrl ? /github\.com|git@github\.com/.test(remoteUrl) : false,
      dirty,
      branches,
      lastCommit: (await runGit(p, ["log", "-1", "--format=%cr"])) || null,
    });
  }
  return repos.sort((a, b) => a.name.localeCompare(b.name));
}

export interface RepoBackupResult {
  name: string;
  status: "backed-up" | "created" | "failed" | "clean";
  detail: string;
}

function ts(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

async function captureWorkingState(repoPath: string): Promise<string | null> {
  const hasCommits = await runGit(repoPath, ["rev-parse", "--verify", "HEAD"]);
  const status = await runGit(repoPath, ["status", "--porcelain"]);
  if (!status.trim() && hasCommits) return null;
  const stamp = ts();
  const branchName = `backup/auto-${stamp}`;
  if (!hasCommits) {
    try {
      await execFileAsync("git", ["add", "-A"], { cwd: repoPath });
      await execFileAsync("git", ["commit", "-m", `sift auto-backup ${stamp}`], { cwd: repoPath });
      return branchName;
    } catch {
      return null;
    }
  }
  let sha = await runGit(repoPath, ["stash", "create", "-u"]);
  if (!sha) sha = await runGit(repoPath, ["stash", "create"]);
  if (!sha) return null;
  try {
    await execFileAsync("git", ["branch", branchName, sha], { cwd: repoPath });
    return branchName;
  } catch {
    return null;
  }
}

async function pushAll(repoPath: string, remote: string): Promise<void> {
  const push = async (args: string[]) => {
    try {
      await execFileAsync("git", ["push", ...args], { cwd: repoPath, timeout: 120000 });
    } catch {
      await execFileAsync("git", ["push", "--force-with-lease", ...args], { cwd: repoPath, timeout: 120000 });
    }
  };
  await push(["-u", remote, "HEAD"]);
  await push([remote, "--all"]);
  await push([remote, "--tags"]);
}

export async function backupRepoToGithub(
  repo: RepoDeep,
  opts: { createPrivate: boolean; onProgress?: (done: number, total: number, name: string) => void; index?: number; total?: number } = { createPrivate: true }
): Promise<RepoBackupResult> {
  const done = opts.index ?? 0;
  const total = opts.total ?? 1;
  try {
    const backupBranch = await captureWorkingState(repo.path);
    let remote = "origin";
    let created = false;
    if (!repo.hasRemote) {
      await execFileAsync("gh", ["repo", "create", repo.name, opts.createPrivate ? "--private" : "--public", "--source", repo.path, "--remote", "origin"], {
        timeout: 120000,
      });
      created = true;
    } else if (!repo.remoteIsGitHub) {
      await execFileAsync("gh", ["repo", "create", repo.name, opts.createPrivate ? "--private" : "--public", "--source", repo.path, "--remote", "github"], {
        timeout: 120000,
      }).catch(() => {});
      remote = "github";
      created = true;
    }
    await pushAll(repo.path, remote);
    if (backupBranch) {
      await runGit(repo.path, ["branch", "-D", backupBranch]);
    }
    opts.onProgress?.(done + 1, total, repo.name);
    return {
      name: repo.name,
      status: created ? "created" : "backed-up",
      detail: `${remote} · ${backupBranch ? "working state saved" : "clean"}`,
    };
  } catch (err) {
    opts.onProgress?.(done + 1, total, repo.name);
    return { name: repo.name, status: "failed", detail: (err as Error).message.slice(0, 120) };
  }
}

export function repoBackupMarkdown(results: RepoBackupResult[]): string {
  const ok = results.filter((r) => r.status !== "failed").length;
  const lines = ["# GitHub Backup", "", `- Backed up: **${ok}/${results.length}** repo(s)`, ""];
  for (const r of results) {
    const mark = r.status === "failed" ? "✗" : "✓";
    lines.push(`- ${mark} **${r.name}** — ${r.status} — ${r.detail}`);
  }
  return lines.join("\n");
}

/* --------------------------- Markdown reports --------------------------- */

export function convertMarkdown(r: ConvertReport, keepOriginals = false): string {
  const lines = [
    "# PNG → JPG",
    "",
    `- Scanned: **${r.total}** PNG file(s)`,
    `- Converted: **${r.converted.length}** → JPG${keepOriginals ? " (originals kept)" : " (originals deleted)"}`,
    `- Kept (errors): **${r.failed.length}** PNG left in place`,
    `- Saved: **${formatSize(Math.max(0, r.savedBytes))}**`,
  ];
  if (r.failed.length > 0) {
    lines.push("", "## Kept due to errors", "");
    for (const f of r.failed.slice(0, 20)) lines.push(`- \`${path.basename(f.file)}\` — ${f.reason}`);
  }
  return lines.join("\n");
}

export function flattenMarkdown(by: FlattenBy, r: FlattenReport): string {
  const lines = [
    `# Flatten by ${by}`,
    "",
    `- Scanned: **${r.total}** file(s)`,
    `- Moved: **${r.moved.length}** into category folders`,
    `- Failed: **${r.failed.length}**`,
  ];
  if (r.failed.length > 0) {
    lines.push("", "## Errors", "");
    for (const f of r.failed.slice(0, 20)) lines.push(`- \`${path.basename(f.file)}\` — ${f.reason}`);
  }
  return lines.join("\n");
}

export function purgeMarkdown(r: PurgeReport): string {
  const lines = [
    "# Dev Purge (trash-safe)",
    "",
    `- Found: **${r.items.length}** junk item(s)`,
    `- Reclaimed: **${formatSize(r.reclaimed)}**`,
    `- Trashed: **${r.trashed.length}**`,
    `- Failed: **${r.failed.length}**`,
    "",
    "## Top candidates",
  ];
  for (const item of r.items.slice(0, 25)) {
    lines.push(`- ${formatSize(item.size).padStart(8)}  \`${item.path.replace(os.homedir(), "~")}\``);
  }
  return lines.join("\n");
}

export function dedupMarkdown(r: DedupReport): string {
  const dupCount = r.groups.reduce((n, g) => n + g.files.length - 1, 0);
  const lines = [
    "# Duplicate Finder",
    "",
    `- Groups: **${r.groups.length}** sets of identical files`,
    `- Redundant copies trashed: **${dupCount}**`,
    `- Reclaimed: **${formatSize(r.reclaimed)}**`,
    `- Failed: **${r.failed.length}**`,
    "",
    "## Largest duplicate sets",
  ];
  for (const g of r.groups.slice(0, 15)) {
    lines.push(`- ${formatSize(g.size).padStart(8)} × ${g.files.length}  \`${g.files[0].replace(os.homedir(), "~")}\``);
  }
  return lines.join("\n");
}

export function ghMarkdown(results: RepoSyncResult[]): string {
  const ok = results.filter((r) => r.status !== "failed").length;
  const lines = ["# GitHub Sync", "", `- Synced: **${ok}/${results.length}** repo(s)`, ""];
  for (const r of results) {
    const mark = r.status === "failed" ? "✗" : "✓";
    lines.push(`- ${mark} **${r.name}** — ${r.status} — ${r.detail}`);
  }
  return lines.join("\n");
}
