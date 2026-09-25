// Background watcher daemon script: watches Downloads/archive for new .rayconfig files,
// auto-decrypts them, updates index and triggers HTML stats regeneration.

import { watch } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execA = promisify(execFile);
const DOWNLOADS = join(process.env.HOME || "", "Downloads");
const ARCHIVE = join(process.cwd(), "gravity-archive");

console.log(`[Sentry] Watching for new .rayconfig backups in ${DOWNLOADS}...`);

watch(DOWNLOADS, async (eventType, filename) => {
  if (!filename || !filename.endsWith(".rayconfig")) return;
  console.log(`[Sentry] Detected new rayconfig: ${filename}`);
  const pass = process.env.RAYCONFIG_PASS;
  if (!pass) {
    console.log(`[Sentry] Skipping auto-decrypt: RAYCONFIG_PASS env not set.`);
    return;
  }

  const filePath = join(DOWNLOADS, filename);
  try {
    console.log(`[Sentry] Decrypting ${filePath}...`);
    await execA("bun", ["scripts/rayconfig-decrypt.ts", filePath]);
    console.log(`[Sentry] Re-indexing...`);
    await execA("bun", ["scripts/clipboard-index.ts"]);
    console.log(`[Sentry] Regenerating HTML report...`);
    await execA("bun", ["scripts/clipboard-report.ts"]);
    console.log(`[Sentry] Sentry workflow complete!`);
  } catch (err: any) {
    console.error(`[Sentry] Decrypt failed: ${err.message}`);
  }
});
