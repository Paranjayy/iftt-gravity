import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  captureDateFromName,
  isScreenshotName,
  calendarRelPath,
  isoWeekKey,
  organizeDesktop,
  undoDesktopOrganize,
  guardDesktop,
  DESKTOP_SCREENSHOT_BREAK,
  STRAY_WARNING_NAME,
} from "../desktop-organize";

describe("screenshot naming", () => {
  test("detects macOS Screenshot prefixes including jpg conversions", () => {
    expect(isScreenshotName("Screenshot 2026-09-09 at 02.01.15.jpg")).toBe(true);
    expect(isScreenshotName("Screenshot 2026-09-05 at 08.25.36.png")).toBe(true);
    expect(isScreenshotName("Screen Shot 2024-01-01 at 1.00.00 PM.png")).toBe(true);
    expect(isScreenshotName("notes.pdf")).toBe(false);
    expect(isScreenshotName("wallpaper.jpg")).toBe(false);
  });

  test("reads capture date from filename, not mtime", () => {
    const d = captureDateFromName("Screenshot 2026-09-09 at 02.01.15.jpg");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(8);
    expect(d!.getDate()).toBe(9);
  });
});

describe("calendar grains", () => {
  const d = new Date(2026, 8, 9);

  test("ymd nests year/month/day", () => {
    expect(calendarRelPath(d, "ymd")).toBe("2026/09/09");
  });

  test("month nests year/month", () => {
    expect(calendarRelPath(d, "month")).toBe("2026/09");
  });

  test("day is a flat ISO date", () => {
    expect(calendarRelPath(d, "day")).toBe("2026-09-09");
  });

  test("week is ISO year-week", () => {
    expect(calendarRelPath(d, "week")).toBe(isoWeekKey(d));
    expect(isoWeekKey(d)).toMatch(/^2026-W\d{2}$/);
  });
});

describe("organizeDesktop", () => {
  let root: string;
  let undoPath: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "gravity-desk-"));
    undoPath = path.join(root, "undo.json");
    fs.writeFileSync(path.join(root, "Screenshot 2026-09-09 at 02.01.15.jpg"), "ss");
    fs.writeFileSync(path.join(root, "notes.pdf"), "pdf");
    fs.mkdirSync(path.join(root, "keep-me"));
    fs.writeFileSync(path.join(root, "keep-me", "inside.txt"), "no");
    fs.mkdirSync(path.join(root, "Organised Screenshots"));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  test("Clean & Group moves only screenshots into week folders and leaves other files", async () => {
    const report = await organizeDesktop(root, { grain: "week", skipLog: true, undoPath, screenshotsOnly: true });
    expect(report.moved.length).toBe(1);
    expect(report.failed.length).toBe(0);
    const week = isoWeekKey(new Date(2026, 8, 9));
    expect(fs.existsSync(path.join(root, "Organised Screenshots", week, "Screenshot 2026-09-09 at 02.01.15.jpg"))).toBe(
      true,
    );
    expect(fs.existsSync(path.join(root, "notes.pdf"))).toBe(true);
    expect(fs.existsSync(path.join(root, "keep-me", "inside.txt"))).toBe(true);
    expect(fs.existsSync(path.join(root, "Screenshot 2026-09-09 at 02.01.15.jpg"))).toBe(false);
  });

  test("ymd grain nests screenshots under year/month/day", async () => {
    const report = await organizeDesktop(root, { grain: "ymd", skipLog: true, undoPath });
    expect(report.moved.some((m) => m.to.includes(`${path.sep}2026${path.sep}09${path.sep}09${path.sep}`))).toBe(true);
    expect(fs.existsSync(path.join(root, "Screenshot 2026-09-09 at 02.01.15.jpg"))).toBe(false);
  });

  test("undo restores files to the desktop root", async () => {
    await organizeDesktop(root, { grain: "week", skipLog: true, undoPath, screenshotsOnly: true });
    const undone = await undoDesktopOrganize({ undoPath });
    expect(undone.count).toBe(1);
    expect(fs.existsSync(path.join(root, "Screenshot 2026-09-09 at 02.01.15.jpg"))).toBe(true);
    expect(fs.existsSync(path.join(root, "notes.pdf"))).toBe(true);
  });
});

describe("guardDesktop", () => {
  let root: string;
  let downloads: string;
  let undoPath: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "gravity-guard-"));
    downloads = fs.mkdtempSync(path.join(os.tmpdir(), "gravity-dl-"));
    undoPath = path.join(root, "undo.json");
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(downloads, { recursive: true, force: true });
  });

  test("below break and not forced: does not move screenshots", async () => {
    fs.writeFileSync(path.join(root, "Screenshot 2026-09-09 at 02.01.15.jpg"), "ss");
    const r = await guardDesktop(root, {
      downloadsDir: downloads,
      undoPath,
      skipLog: true,
      force: false,
      threshold: 48,
      batchDelayMs: 0,
    });
    expect(r.overBreak).toBe(false);
    expect(r.swept).toBeNull();
    expect(fs.existsSync(path.join(root, "Screenshot 2026-09-09 at 02.01.15.jpg"))).toBe(true);
  });

  test("over break auto-sweeps screenshots in week folders and never moves strays", async () => {
    const threshold = 3;
    for (let i = 0; i < 4; i++) {
      fs.writeFileSync(path.join(root, `Screenshot 2026-09-09 at 02.0${i}.00.jpg`), "ss");
    }
    fs.writeFileSync(path.join(root, "invoice.pdf"), "keep");
    fs.writeFileSync(path.join(root, "Dropbox.app.zip"), "keep");
    const r = await guardDesktop(root, {
      downloadsDir: downloads,
      undoPath,
      skipLog: true,
      force: false,
      threshold,
      batchSize: 2,
      batchDelayMs: 0,
    });
    expect(r.overBreak).toBe(true);
    expect(r.swept?.moved.length).toBe(4);
    expect(fs.existsSync(path.join(root, "invoice.pdf"))).toBe(true);
    expect(fs.existsSync(path.join(root, "Dropbox.app.zip"))).toBe(true);
    expect(r.strays.map((s) => s.name).sort()).toEqual(["Dropbox.app.zip", "invoice.pdf"]);
    expect(fs.existsSync(path.join(root, STRAY_WARNING_NAME))).toBe(true);
    expect(fs.existsSync(path.join(downloads, STRAY_WARNING_NAME))).toBe(true);
    const md = fs.readFileSync(path.join(downloads, STRAY_WARNING_NAME), "utf-8");
    expect(md).toContain("invoice.pdf");
    expect(md).toContain("Dropbox.app.zip");
  });

  test("force Clean & Group sweeps even below the break", async () => {
    fs.writeFileSync(path.join(root, "Screenshot 2026-09-09 at 02.01.15.jpg"), "ss");
    const r = await guardDesktop(root, {
      downloadsDir: downloads,
      undoPath,
      skipLog: true,
      force: true,
      threshold: DESKTOP_SCREENSHOT_BREAK,
      batchDelayMs: 0,
    });
    expect(r.swept?.moved.length).toBe(1);
    expect(fs.existsSync(path.join(root, "Screenshot 2026-09-09 at 02.01.15.jpg"))).toBe(false);
  });
});
