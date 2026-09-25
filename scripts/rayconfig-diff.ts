// Compares two .rayconfig or decrypted jsonl backups to find deltas/missing clips.
import { readFile } from "node:fs/promises";

export interface DiffReport {
  fileA: string;
  fileB: string;
  countA: number;
  countB: number;
  onlyInA: number;
  onlyInB: number;
  shared: number;
}

export async function diffJsonlFiles(pathA: string, pathB: string): Promise<DiffReport> {
  const contentA = (await readFile(pathA, "utf8")).trim().split("\n");
  const contentB = (await readFile(pathB, "utf8")).trim().split("\n");

  const setA = new Set(contentA.map((l) => {
    try { return JSON.parse(l).text || JSON.parse(l).imagePath || l; } catch { return l; }
  }));
  const setB = new Set(contentB.map((l) => {
    try { return JSON.parse(l).text || JSON.parse(l).imagePath || l; } catch { return l; }
  }));

  let shared = 0;
  let onlyInA = 0;
  let onlyInB = 0;

  for (const item of setA) {
    if (setB.has(item)) shared++;
    else onlyInA++;
  }
  for (const item of setB) {
    if (!setA.has(item)) onlyInB++;
  }

  return {
    fileA: pathA.split("/").pop() || pathA,
    fileB: pathB.split("/").pop() || pathB,
    countA: setA.size,
    countB: setB.size,
    onlyInA,
    onlyInB,
    shared,
  };
}

if (import.meta.main) {
  const [a, b] = process.argv.slice(2);
  if (!a || !b) {
    console.error("usage: bun scripts/rayconfig-diff.ts <fileA.jsonl> <fileB.jsonl>");
    process.exit(1);
  }
  const report = await diffJsonlFiles(a, b);
  console.log(
    [
      `Time Machine diff`,
      `  A: ${report.fileA} (${report.countA.toLocaleString()} entries)`,
      `  B: ${report.fileB} (${report.countB.toLocaleString()} entries)`,
      ``,
      `  shared:  ${report.shared.toLocaleString()}`,
      `  only in A (lost in B): ${report.onlyInA.toLocaleString()}`,
      `  only in B (new):       ${report.onlyInB.toLocaleString()}`,
    ].join("\n"),
  );
}
