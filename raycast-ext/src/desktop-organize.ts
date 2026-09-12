import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export const DESKTOP = path.join(os.homedir(), "Desktop");
export const DOWNLOADS = path.join(os.homedir(), "Downloads");

export type CalendarGrain = "week" | "month" | "day" | "ymd" | "ymw" | "ymwd" | "named" | "verbose";

export const DESKTOP_SCREENSHOT_BREAK = 48;
export const DESKTOP_MOVE_BATCH = 32;
export const STRAY_WARNING_NAME = "DESKTOP-STRAY-WARNING.md";

const UNDO_PATH = path.join(os.homedir(), "Developer", "iftt", "raycast-ext", "desktop_undo_history.json");
const LOG_PATH = path.join(os.homedir(), "Developer", "iftt", "raycast-ext", "OPERATIONS_LOG.md");

export function isScreenshotName(name: string): boolean {
  return (
    name.startsWith("Screenshot") ||
    name.startsWith("Screen Shot") ||
    name.startsWith("scr_") ||
    name.startsWith("SCR-")
  );
}

export function captureDateFromName(name: string): Date | null {
  const m = name.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return new Date(year, month - 1, day);
}

export function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(((d.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function titleMonth(i: number): string {
  const n = MONTHS[i];
  return n.charAt(0).toUpperCase() + n.slice(1);
}

export function calendarRelPath(date: Date, grain: CalendarGrain): string {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const weekPart = isoWeekKey(date).split("-")[1];
  const weekday = WEEKDAYS[date.getDay()];
  const monthName = MONTHS[date.getMonth()];
  switch (grain) {
    case "month":
      return `${year}/${month}`;
    case "day":
      return `${year}-${month}-${day}`;
    case "ymd":
      return `${year}/${month}/${day}`;
    case "ymw":
      return `${year}/${month}/${weekPart}`;
    case "ymwd":
      return `${year}/${month}/${weekPart}/${day}`;
    case "named":
      return `${year}/${month}-${titleMonth(date.getMonth())}/${weekday}/${day}`;
    case "verbose":
      return `year(${year})/month(${month}-${monthName})/weekday(${weekday})/day(${day})`;
    case "week":
    default:
      return isoWeekKey(date);
  }
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
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

function isReservedDesktopName(name: string): boolean {
  return name.startsWith(".") || name.startsWith("Organised") || name === STRAY_WARNING_NAME;
}

function fileDate(file: string, name: string): Date {
  return captureDateFromName(name) ?? fs.statSync(file).mtime;
}

export interface OrganizeReport {
  moved: { from: string; to: string }[];
  failed: { file: string; reason: string }[];
}

export async function organizeDesktop(
  root: string,
  opts: {
    grain?: CalendarGrain;
    skipLog?: boolean;
    undoPath?: string;
    screenshotsOnly?: boolean;
    batchSize?: number;
    batchDelayMs?: number;
    onProgress?: (done: number, total: number, name: string) => void;
  } = {},
): Promise<OrganizeReport> {
  const grain = opts.grain ?? "week";
  const screenshotsOnly = opts.screenshotsOnly ?? true;
  const batchSize = Math.max(1, opts.batchSize ?? DESKTOP_MOVE_BATCH);
  const batchDelayMs = opts.batchDelayMs ?? 0;
  const undoPath = opts.undoPath ?? UNDO_PATH;
  const screenshotRoot = path.join(root, "Organised Screenshots");
  const report: OrganizeReport = { moved: [], failed: [] };
  await fs.promises.mkdir(screenshotRoot, { recursive: true });

  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(root, { withFileTypes: true });
  } catch (err) {
    report.failed.push({ file: root, reason: (err as Error).message.slice(0, 120) });
    return report;
  }

  const files = entries.filter((e) => e.isFile() && !isReservedDesktopName(e.name));
  const targets = screenshotsOnly ? files.filter((e) => isScreenshotName(e.name)) : files;
  let done = 0;
  for (const entry of targets) {
    const file = path.join(root, entry.name);
    try {
      const destDir = path.join(screenshotRoot, calendarRelPath(fileDate(file, entry.name), grain));
      await fs.promises.mkdir(destDir, { recursive: true });
      const dest = uniqueDest(path.join(destDir, entry.name));
      await fs.promises.rename(file, dest);
      report.moved.push({ from: file, to: dest });
    } catch (err) {
      report.failed.push({ file, reason: (err as Error).message.slice(0, 120) });
    }
    done++;
    if (done === 1 || done === targets.length || done % batchSize === 0) {
      opts.onProgress?.(done, targets.length, entry.name);
    }
    if (done % batchSize === 0 && batchDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, batchDelayMs));
    }
  }

  try {
    await fs.promises.mkdir(path.dirname(undoPath), { recursive: true });
    await fs.promises.writeFile(undoPath, JSON.stringify(report.moved, null, 2));
  } catch {
    /* ignore */
  }

  if (!opts.skipLog && report.moved.length > 0) {
    try {
      const line = `- **[${new Date().toISOString().replace("T", " ").slice(0, 19)}]** Desktop organize (${grain}): **${report.moved.length}** moved\n`;
      await fs.promises.appendFile(LOG_PATH, line);
    } catch {
      /* ignore */
    }
  }

  return report;
}

export interface DesktopStray {
  name: string;
  path: string;
  size: number;
  mtime: string;
}

export interface GuardReport {
  screenshots: number;
  strays: DesktopStray[];
  overBreak: boolean;
  swept: OrganizeReport | null;
  warningPaths: string[];
}

function strayMarkdown(root: string, strays: DesktopStray[], screenshots: number, swept: number): string {
  const lines = [
    `# Desktop stray warning`,
    "",
    `_Generated ${new Date().toISOString().replace("T", " ").slice(0, 19)}_`,
    "",
    `Loose screenshots seen: **${screenshots}**. Swept this run: **${swept}**.`,
    "",
    "Only macOS screenshots were moved. Other files were left on the Desktop.",
    "",
    "## Left on Desktop",
    "",
  ];
  for (const s of strays) {
    lines.push(`- \`${s.name}\` — ${formatSize(s.size)} — mtime ${s.mtime}`);
    lines.push(`  \`${s.path}\``);
  }
  lines.push("", `Break: **${DESKTOP_SCREENSHOT_BREAK}** screenshots. Root: \`${root}\``, "");
  return lines.join("\n");
}

export async function guardDesktop(
  root: string,
  opts: {
    downloadsDir: string;
    threshold?: number;
    force?: boolean;
    grain?: CalendarGrain;
    skipLog?: boolean;
    undoPath?: string;
    batchSize?: number;
    batchDelayMs?: number;
    onProgress?: (done: number, total: number, name: string) => void;
  },
): Promise<GuardReport> {
  const threshold = opts.threshold ?? DESKTOP_SCREENSHOT_BREAK;
  const grain = opts.grain ?? "week";
  let entries: fs.Dirent[] = [];
  try {
    entries = await fs.promises.readdir(root, { withFileTypes: true });
  } catch {
    return { screenshots: 0, strays: [], overBreak: false, swept: null, warningPaths: [] };
  }

  const files = entries.filter((e) => e.isFile() && !isReservedDesktopName(e.name));
  const shots = files.filter((e) => isScreenshotName(e.name));
  const strayEntries = files.filter((e) => !isScreenshotName(e.name));
  const strays: DesktopStray[] = [];
  for (const e of strayEntries) {
    const full = path.join(root, e.name);
    try {
      const st = await fs.promises.stat(full);
      strays.push({
        name: e.name,
        path: full,
        size: st.size,
        mtime: st.mtime.toISOString().replace("T", " ").slice(0, 19),
      });
    } catch {
      strays.push({ name: e.name, path: full, size: 0, mtime: "unknown" });
    }
  }

  const overBreak = shots.length >= threshold;
  let swept: OrganizeReport | null = null;
  if (opts.force || overBreak) {
    swept = await organizeDesktop(root, {
      grain,
      screenshotsOnly: true,
      skipLog: opts.skipLog,
      undoPath: opts.undoPath,
      batchSize: opts.batchSize,
      batchDelayMs: opts.batchDelayMs ?? 15,
      onProgress: opts.onProgress,
    });
  }

  const warningPaths: string[] = [];
  if (strays.length > 0) {
    const body = strayMarkdown(root, strays, shots.length, swept?.moved.length ?? 0);
    for (const dir of [root, opts.downloadsDir]) {
      try {
        await fs.promises.mkdir(dir, { recursive: true });
        const dest = path.join(dir, STRAY_WARNING_NAME);
        await fs.promises.writeFile(dest, body, "utf-8");
        warningPaths.push(dest);
      } catch {
        /* ignore */
      }
    }
  }

  return { screenshots: shots.length, strays, overBreak, swept, warningPaths };
}

export async function undoDesktopOrganize(
  opts: { undoPath?: string } = {},
): Promise<{ count: number; failed: { file: string; reason: string }[] }> {
  const undoPath = opts.undoPath ?? UNDO_PATH;
  const failed: { file: string; reason: string }[] = [];
  let moves: { from: string; to: string }[] = [];
  try {
    moves = JSON.parse(await fs.promises.readFile(undoPath, "utf-8"));
  } catch {
    return { count: 0, failed };
  }

  let count = 0;
  for (const move of [...moves].reverse()) {
    try {
      if (!fs.existsSync(move.from) && fs.existsSync(move.to)) {
        await fs.promises.mkdir(path.dirname(move.from), { recursive: true });
        await fs.promises.rename(move.to, move.from);
        count++;
      }
    } catch (err) {
      failed.push({ file: move.from, reason: (err as Error).message.slice(0, 120) });
    }
  }
  try {
    await fs.promises.writeFile(undoPath, "[]");
  } catch {
    /* ignore */
  }
  return { count, failed };
}

async function collectFilesRecursive(root: string): Promise<string[]> {
  const out: string[] = [];
  const walk = async (dir: string) => {
    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith(".")) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) await walk(full);
      else if (e.isFile()) out.push(full);
    }
  };
  await walk(root);
  return out;
}

async function pruneEmptyDirs(root: string): Promise<void> {
  const walk = async (dir: string) => {
    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (!e.isDirectory() || e.name.startsWith(".")) continue;
      await walk(path.join(dir, e.name));
    }
    if (path.resolve(dir) === path.resolve(root)) return;
    try {
      const left = await fs.promises.readdir(dir);
      if (left.filter((n) => n !== ".DS_Store").length === 0) {
        await fs.promises.rm(dir, { recursive: true, force: true });
      }
    } catch {
      /* ignore */
    }
  };
  await walk(root);
}

/** Re-bucket files already inside Organised Screenshots. Does not touch the live Desktop. */
export async function reshapeOrganisedScreenshots(
  libraryRoot: string,
  grain: CalendarGrain,
  opts: { skipLog?: boolean; onProgress?: (done: number, total: number, name: string) => void } = {},
): Promise<OrganizeReport> {
  await fs.promises.mkdir(libraryRoot, { recursive: true });
  const report: OrganizeReport = { moved: [], failed: [] };
  const files = await collectFilesRecursive(libraryRoot);
  let done = 0;
  for (const file of files) {
    const name = path.basename(file);
    try {
      const destDir = path.join(libraryRoot, calendarRelPath(fileDate(file, name), grain));
      await fs.promises.mkdir(destDir, { recursive: true });
      const dest = uniqueDest(path.join(destDir, name));
      if (path.resolve(dest) !== path.resolve(file)) {
        await fs.promises.rename(file, dest);
        report.moved.push({ from: file, to: dest });
      }
    } catch (err) {
      report.failed.push({ file, reason: (err as Error).message.slice(0, 120) });
    }
    done++;
    if (done === 1 || done === files.length || done % DESKTOP_MOVE_BATCH === 0) {
      opts.onProgress?.(done, files.length, name);
    }
  }
  await pruneEmptyDirs(libraryRoot);
  return report;
}

export function organizeMarkdown(grain: CalendarGrain, r: OrganizeReport): string {
  return [
    `# Desktop organize (${grain})`,
    "",
    `- Moved: **${r.moved.length}**`,
    `- Failed: **${r.failed.length}**`,
    r.failed.length > 0 ? "\n## Failures\n" + r.failed.map((f) => `- \`${f.file}\`: ${f.reason}`).join("\n") : "",
  ]
    .filter(Boolean)
    .join("\n");
}
