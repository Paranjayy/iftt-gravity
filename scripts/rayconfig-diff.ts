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
