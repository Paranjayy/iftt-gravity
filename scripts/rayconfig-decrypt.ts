// Decrypts a Raycast `.rayconfig` backup (RAYCFG3) and extracts clipboard history.
// Port of tinycast's RaycastDecoder (AGPL-3.0, github.com/abue-ammar/tinycast)
// to Bun. Spec: docs/features/raycast-import.md in that repo.
//
//   RAYCONFIG_PASS='<passphrase>' bun scripts/rayconfig-decrypt.ts <file.rayconfig> [--summary-only]
//
// - Passphrase comes from the env ONLY: never commit it, never log it.
// - `--summary-only` prints counts (safe to share). Default also writes
//   clipboard entries as JSONL to ./gravity-archive/rayconfig-clips-<ts>.jsonl
//   (gitignored dir — your clips never touch git).
// - Read-only on the backup file. Nothing is imported into any app.

import { scryptSync, createDecipheriv } from "node:crypto";
import { gunzipSync } from "node:zlib";

const MAGIC = "RAYCFG3\n";
const MAX_HEADER = 1024 * 1024;
const MAX_PAYLOAD = 512 * 1024 * 1024;

function fail(msg: string): never {
  console.error(`rayconfig-decrypt: ${msg}`);
  process.exit(1);
}

const [file, ...rest] = Bun.argv.slice(2);
if (!file) fail("usage: RAYCONFIG_PASS=<pw> bun scripts/rayconfig-decrypt.ts <file> [--summary-only]");
const summaryOnly = rest.includes("--summary-only");
const pass = process.env.RAYCONFIG_PASS;
if (!pass) fail("set RAYCONFIG_PASS env (never commit it)");

const raw = await Bun.file(file).arrayBuffer().then((b) => Buffer.from(b));
if (raw.subarray(0, 8).toString() !== MAGIC) fail("not a RAYCFG3 export");
if (raw.length < 12) fail("truncated file");
const headerLen = raw.readUInt32LE(8);
if (headerLen <= 0 || headerLen > MAX_HEADER || 12 + headerLen > raw.length) fail("corrupt header");
const header = JSON.parse(gunzipSync(raw.subarray(12, 12 + headerLen), { maxOutputLength: MAX_HEADER }).toString());
if (header.schemaVersion !== 3) fail(`unsupported schemaVersion ${header.schemaVersion}`);
const iv = Buffer.from(header.encryption.iv, "hex");
const salt = Buffer.from(header.encryption.salt, "hex");
if (iv.length !== 16 || salt.length !== 16) fail("corrupt encryption header");

const key = scryptSync(pass, salt, 32, { N: 16384, r: 8, p: 1 });
const ctEnd = raw.length - 16;
let payloadGzip: Buffer;
try {
  const d = createDecipheriv("aes-256-gcm", key, iv);
  d.setAuthTag(raw.subarray(ctEnd));
  payloadGzip = Buffer.concat([d.update(raw.subarray(12 + headerLen, ctEnd)), d.final()]);
} catch {
  fail("incorrect passphrase (auth tag mismatch)");
  throw new Error("unreachable");
}
const payload = JSON.parse(gunzipSync(payloadGzip, { maxOutputLength: MAX_PAYLOAD }).toString());

const keys = Object.keys(payload);
const entries: any[] = payload?.clipboardHistory?.clipboardEntries ?? [];
let text = 0;
let images = 0;
let missing = 0;
let skipped = 0;
let oldest = "";
let newest = "";
const out: string[] = [];
for (const e of entries) {
  const ts: string = e.createdAt ?? "";
  if (!oldest || ts < oldest) oldest = ts;
  if (!newest || ts > newest) newest = ts;
  const reps: any[] = (e.items ?? []).flatMap((i: any) => i.representations ?? []);
  const t = reps.find((r) => typeof r.mimeType === "string" && r.mimeType.startsWith("text/plain"));
  if (typeof t?.content === "string" && t.content.length > 0) {
    text++;
    if (!summaryOnly) out.push(JSON.stringify({ createdAt: ts, kind: "text", text: t.content }));
    continue;
  }
  const img = reps.find((r) => typeof r.mimeType === "string" && r.mimeType.startsWith("image/") && r.contentType === "url");
  if (typeof img?.content === "string") {
    if (Bun.file(img.content).size >= 0 && (await Bun.file(img.content).exists())) {
      images++;
      if (!summaryOnly) out.push(JSON.stringify({ createdAt: ts, kind: "image", imagePath: img.content }));
    } else {
      missing++;
    }
    continue;
  }
  skipped++;
}

console.log(`payload keys: ${keys.join(", ")}`);
console.log(`clipboard entries: ${entries.length} (text=${text} images=${images} missing-files=${missing} skipped=${skipped})`);
console.log(`range: ${oldest} .. ${newest}`);
if (!summaryOnly) {
  const { mkdir, writeFile } = await import("node:fs/promises");
  await mkdir("gravity-archive", { recursive: true });
  const outPath = `gravity-archive/rayconfig-clips-${Date.now()}.jsonl`;
  await writeFile(outPath, out.join("\n") + "\n");
  console.log(`wrote ${outPath}`);
}
