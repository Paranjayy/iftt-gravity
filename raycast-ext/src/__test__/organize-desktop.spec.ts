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
} from "../fileops";

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

  test("moves screenshots by capture week and other files by type, leaves folders", async () => {
    const report = await organizeDesktop(root, { grain: "week", skipLog: true, undoPath });
    expect(report.moved.length).toBe(2);
    expect(report.failed.length).toBe(0);
    const week = isoWeekKey(new Date(2026, 8, 9));
    expect(fs.existsSync(path.join(root, "Organised Screenshots", week, "Screenshot 2026-09-09 at 02.01.15.jpg"))).toBe(
      true,
    );
    expect(fs.existsSync(path.join(root, "Organised Folders", "Documents", "notes.pdf"))).toBe(true);
    expect(fs.existsSync(path.join(root, "keep-me", "inside.txt"))).toBe(true);
    expect(fs.existsSync(path.join(root, "Screenshot 2026-09-09 at 02.01.15.jpg"))).toBe(false);
  });

  test("ymd grain nests screenshots under year/month/day", async () => {
    const report = await organizeDesktop(root, { grain: "ymd", skipLog: true, undoPath });
    expect(report.moved.some((m) => m.to.includes(`${path.sep}2026${path.sep}09${path.sep}09${path.sep}`))).toBe(true);
    expect(fs.existsSync(path.join(root, "Screenshot 2026-09-09 at 02.01.15.jpg"))).toBe(false);
  });

  test("undo restores files to the desktop root", async () => {
    await organizeDesktop(root, { grain: "week", skipLog: true, undoPath });
    const undone = await undoDesktopOrganize({ undoPath });
    expect(undone.count).toBe(2);
    expect(fs.existsSync(path.join(root, "Screenshot 2026-09-09 at 02.01.15.jpg"))).toBe(true);
    expect(fs.existsSync(path.join(root, "notes.pdf"))).toBe(true);
  });
});
