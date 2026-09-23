// Builds gravity-archive/rayconfig-clips-<ts>.idx.json — a lightweight index over
// the full JSONL so Raycast commands (100MB heap) never load whole clip bodies.
// Each entry: byte offset + byte length + preview + search head. Bodies are
// sliced from disk on demand. Run after rayconfig-decrypt.ts.
import { readdir, open } from "node:fs/promises";

const files = (await readdir("gravity-archive")).filter((f) => f.startsWith("rayconfig-clips-") && f.endsWith(".jsonl")).sort();
if (!files.length) throw new Error("no rayconfig-clips JSONL in gravity-archive/");
const src = `gravity-archive/${files[files.length - 1]}`;

const fh = await open(src, "r");
const stat = await fh.stat();
const buf = Buffer.alloc(stat.size);
await fh.read(buf, 0, stat.size, 0);
await fh.close();

const entries: object[] = [];
let start = 0;
let line = 0;
for (let i = 0; i <= buf.length; i++) {
  if (i === buf.length || buf[i] === 0x0a) {
    if (i > start) {
      const raw = buf.subarray(start, i).toString("utf8");
      try {
        const e = JSON.parse(raw);
        const text: string = e.kind === "text" ? e.text : "";
        const norm = text.replace(/\s+/g, " ").trim();
        entries.push({
          o: start, n: i - start, ts: e.createdAt || "", kind: e.kind,
          len: text.length,
          prev: (e.kind === "text" ? norm.slice(0, 110) || "(empty)" : `[image] ${e.imagePath || ""}`.slice(0, 110)),
          s: norm.slice(0, 400),
          code: /```|function |const .*=|import .*from|def |class /.test(text),
          link: /https?:\/\//.test(text),
        });
      } catch { /* skip malformed line */ }
      line++;
    }
    start = i + 1;
  }
}

const outPath = src.replace(/\.jsonl$/, ".idx.json");
await Bun.write(outPath, JSON.stringify({ source: src.split("/").pop(), lines: line, entries }));
const kb = Math.round((await Bun.file(outPath).size) / 1024);
console.log(`indexed ${entries.length}/${line} entries -> ${outPath} (${kb} KB, bodies stay on disk)`);
