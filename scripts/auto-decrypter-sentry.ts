// Background watcher daemon: watches ~/Downloads for new .rayconfig backups,
// auto-decrypts them, re-indexes, and regenerates the HTML stats report.
// Run manually: bun scripts/auto-decrypter-sentry.ts
// Or via launchd: com.iftt.rayconfig-sentry (see ~/Library/LaunchAgents).
// Passphrase: RAYCONFIG_PASS env, or fallback ~/.rayconfig_pass (one line, chmod 600).

import { watch, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execA = promisify(execFile);
const HOME = process.env.HOME || "";
const BUN = join(HOME, ".bun", "bin", "bun");
const DOWNLOADS = join(HOME, "Downloads");
const REPO = "/Users/paranjay/Developer/iftt";
const PASS_FILE = join(HOME, ".rayconfig_pass");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function resolvePass(): string | null {
  if (process.env.RAYCONFIG_PASS) return process.env.RAYCONFIG_PASS;
  try {
    if (existsSync(PASS_FILE)) return readFileSync(PASS_FILE, "utf8").trim() || null;
  } catch {
    /* fall through */
  }
  return null;
}

const pass = resolvePass();
console.log(
  `[Sentry] Watching ${DOWNLOADS} for .rayconfig drops… (decrypt ${pass ? "armed" : "DISABLED — no passphrase"})`,
);

let busy = false;
watch(DOWNLOADS, async (_eventType, filename) => {
  if (!filename || !filename.endsWith(".rayconfig") || busy) return;
  busy = true;
  const filePath = join(DOWNLOADS, filename);
  console.log(`[Sentry] Detected new rayconfig: ${filename}`);
  try {
    if (!pass) {
      console.log(`[Sentry] Skipping decrypt: no passphrase (${PASS_FILE} or RAYCONFIG_PASS).`);
      return;
    }
    await sleep(2000); // let the file finish writing (cp/browser saves fire mid-write)
    console.log(`[Sentry] Decrypting…`);
    await execA(BUN, ["scripts/rayconfig-decrypt.ts", filePath], {
      cwd: REPO,
      env: { ...process.env, RAYCONFIG_PASS: pass },
    });
    console.log(`[Sentry] Re-indexing…`);
    await execA(BUN, ["scripts/clipboard-index.ts"], { cwd: REPO });
    console.log(`[Sentry] Regenerating HTML report…`);
    await execA(BUN, ["scripts/clipboard-report.ts"], { cwd: REPO });
    console.log(`[Sentry] Workflow complete for ${filename}.`);
  } catch (err: any) {
    console.error(`[Sentry] Workflow failed for ${filename}: ${err.message}`);
  } finally {
    busy = false;
  }
});
