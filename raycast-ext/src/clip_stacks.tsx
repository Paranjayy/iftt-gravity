import { ActionPanel, Action, Icon, List, LocalStorage, showToast, Toast, Color } from "@raycast/api";
import { useState, useEffect, useMemo } from "react";
import { readdir, readFile, open } from "node:fs/promises";
import path from "node:path";

const ARCHIVE_DIR = "/Users/paranjay/Developer/iftt/gravity-archive";
type Bucket = "throwaway" | "important" | "thoughts";
const BUCKETS: Record<Bucket, { title: string; icon: Icon; tint: string }> = {
  throwaway: { title: "Throwaway", icon: Icon.Trash, tint: "#8a8a99" },
  important: { title: "Important", icon: Icon.Star, tint: "#FFB432" },
  thoughts: { title: "Thoughts", icon: Icon.LightBulb, tint: "#3CC8F0" },
};

interface IdxEntry {
  o: number;
  n: number;
  ts: string;
  kind: string;
  len: number;
  w: number;
  day: string;
  prev: string;
  s: string;
  code: boolean;
  link: boolean;
}

let jsonlPath = "";

async function latestIdx(): Promise<IdxEntry[] | null> {
  try {
    const files = (await readdir(ARCHIVE_DIR)).filter((f) => f.startsWith("rayconfig-clips-") && f.endsWith(".idx.json")).sort();
    if (!files.length) return null;
    jsonlPath = path.join(ARCHIVE_DIR, files[files.length - 1].replace(/\.idx\.json$/, ".jsonl"));
    const idx = JSON.parse(await readFile(path.join(ARCHIVE_DIR, files[files.length - 1]), "utf8"));
    return idx.entries as IdxEntry[];
  } catch {
    return null;
  }
}

// Slice one clip body from disk — the index stays tiny so we never OOM the heap.
async function readBody(e: IdxEntry): Promise<string | null> {
  try {
    const fh = await open(jsonlPath, "r");
    const buf = Buffer.alloc(e.n);
    await fh.read(buf, 0, e.n, e.o);
    await fh.close();
    const parsed = JSON.parse(buf.toString("utf8"));
    return typeof parsed.text === "string" ? parsed.text : null;
  } catch {
    return null;
  }
}

export default function Command() {
  const [clips, setClips] = useState<IdxEntry[] | null>(null);
  const [buckets, setBuckets] = useState<Record<string, Bucket>>({});
  const [bucketFilter, setBucketFilter] = useState("all");
  const [kindFilter, setKindFilter] = useState("all");
  const [activeClip, setActiveClip] = useState<IdxEntry | null>(null);
  const [activeBody, setActiveBody] = useState<string | null>(null);

  useEffect(() => {
    latestIdx().then(setClips);
    LocalStorage.getItem<string>("homepulse-clip-buckets").then((v) => {
      if (v) setBuckets(JSON.parse(v));
    });
  }, []);

  useEffect(() => {
    if (!activeClip) { setActiveBody(null); return; }
    let live = true;
    readBody(activeClip).then((b) => { if (live) setActiveBody(b); });
    return () => { live = false; };
  }, [activeClip]);

  async function setBucket(line: number, b: Bucket | null) {
    const next = { ...buckets };
    const key = `clip:${line}`;
    if (b) next[key] = b;
    else delete next[key];
    setBuckets(next);
    await LocalStorage.setItem("homepulse-clip-buckets", JSON.stringify(next));
    showToast({ title: b ? `Filed → ${BUCKETS[b].title}` : "Removed from bucket", style: Toast.Style.Success });
  }

  async function pasteOrCopy(e: IdxEntry, mode: "paste" | "copy") {
    const body = await readBody(e);
    if (!body) {
      showToast({ title: "Could not read clip body", style: Toast.Style.Failure });
      return null;
    }
    return body;
  }

  async function runBackupNow() {
    const toast = await showToast({ style: Toast.Style.Animated, title: "Running backup workflow…" });
    try {
      const { execFile } = await import("node:child_process");
      const { promisify } = await import("node:util");
      const execA = promisify(execFile);
      const script = "/Users/paranjay/Developer/iftt/raycast-ext/scripts/clipboard-vault-backup.sh";
      const { stdout } = await execA("bash", [script]);
      toast.style = Toast.Style.Success;
      toast.title = "Backup complete";
      toast.message = stdout.trim().slice(0, 100);
    } catch (e: any) {
      toast.style = Toast.Style.Failure;
      toast.title = "Backup failed";
      toast.message = String(e?.message || e).slice(0, 100);
    }
  }

  async function exportBucket(b: Bucket) {
    const toast = await showToast({ style: Toast.Style.Animated, title: `Exporting ${BUCKETS[b].title}…` });
    try {
      const { mkdir, writeFile } = await import("node:fs/promises");
      const { homedir } = await import("node:os");
      const dir = path.join(homedir(), "Developer", "clipboard-backup");
      await mkdir(dir, { recursive: true });
      const lines: string[] = [`# Clip Stacks — ${BUCKETS[b].title}`, "", `> Exported ${new Date().toISOString().slice(0, 19).replace("T", " ")}`, ""];
      let n = 0;
      for (let i = 0; i < (clips?.length ?? 0); i++) {
        if (buckets[`clip:${i}`] !== b) continue;
        const body = await readBody(clips![i]);
        if (!body) continue;
        n++;
        lines.push(`## ${clips![i].ts.slice(0, 16)} · ${clips![i].len.toLocaleString()} chars`, "", body, "");
      }
      const out = path.join(dir, `bucket-${b}-${Date.now()}.md`);
      await writeFile(out, lines.join("\n"));
      toast.style = Toast.Style.Success;
      toast.title = `Exported ${n} clips`;
      toast.message = out;
    } catch {
      toast.style = Toast.Style.Failure;
      toast.title = "Bucket export failed";
    }
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { throwaway: 0, important: 0, thoughts: 0 };
    Object.values(buckets).forEach((b) => c[b]++);
    return c;
  }, [buckets]);

  const filtered = useMemo(() => {
    if (!clips) return [];
    return clips.filter((c, i) => {
      if (bucketFilter !== "all" && buckets[`clip:${i}`] !== bucketFilter) return false;
      if (kindFilter === "code" && !c.code) return false;
      if (kindFilter === "links" && !c.link) return false;
      if (kindFilter === "big" && c.len < 2000) return false;
      if (kindFilter === "images" && c.kind !== "image") return false;
      return true;
    });
  }, [clips, buckets, bucketFilter, kindFilter]);

  return (
    <List
      isLoading={clips === null}
      isShowingDetail
      searchBarPlaceholder={`Search ${clips?.length ?? "…"} rescued clips (beyond Raycast's 3-month wall)…`}
      onSelectionChange={(id) => {
        if (!clips || !id || !id.startsWith("clip-")) return;
        const idx = parseInt(id.slice(5), 10);
        if (!isNaN(idx) && clips[idx]) setActiveClip(clips[idx]);
      }}
      searchBarAccessory={
        <List.Dropdown tooltip="Bucket" value={bucketFilter} onChange={setBucketFilter} storeValue>
          <List.Dropdown.Item title="All buckets" value="all" />
          <List.Dropdown.Item title={`🗑 Throwaway (${counts.throwaway})`} value="throwaway" />
          <List.Dropdown.Item title={`⭐ Important (${counts.important})`} value="important" />
          <List.Dropdown.Item title={`💡 Thoughts (${counts.thoughts})`} value="thoughts" />
        </List.Dropdown>
      }
    >
      <List.Section title="Filter">
        {(["all", "code", "links", "big", "images"] as const).map((k) => (
          <List.Item
            key={k}
            title={{ all: "All clips", code: "Code-looking", links: "Has links", big: "Big (>2k chars)", images: "Images" }[k]}
            icon={k === kindFilter ? Icon.Checkmark : Icon.Circle}
            actions={
              <ActionPanel>
                <Action title="Apply Filter" icon={Icon.Funnel} onAction={() => setKindFilter(k)} />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
      <List.Section title={`${filtered.length} clips`}>
        {filtered.slice(0, 500).map((c) => {
          const line = clips!.indexOf(c);
          const b = buckets[`clip:${line}`];
          return (
            <List.Item
              key={line}
              id={`clip-${line}`}
              title={c.prev}
              subtitle={`${c.ts.slice(0, 10)} · ${c.len.toLocaleString()} chars${c.code ? " · code" : ""}`}
              icon={b ? { source: BUCKETS[b].icon, tintColor: BUCKETS[b].tint } : c.kind === "image" ? Icon.Image : Icon.Text}
              accessories={b ? [{ tag: { value: BUCKETS[b].title, color: Color.SecondaryText } }] : []}
              keywords={[c.kind, c.s.split(" ").slice(0, 20).join(" "), b ?? ""]}
              detail={
                <List.Item.Detail
                  markdown={activeClip === c && activeBody ? `\`\`\`\n${activeBody.slice(0, 4000)}${activeBody.length > 4000 ? "\n\n… (truncated preview)" : ""}\n\`\`\`` : `\`\`\`\n${c.s}\n\`\`\``}
                  metadata={
                    <List.Item.Detail.Metadata>
                      <List.Item.Detail.Metadata.Label title="Copied" text={c.ts.replace("T", " ").slice(0, 19)} />
                      <List.Item.Detail.Metadata.Label title="Size" text={`${c.len.toLocaleString()} chars · ${c.w.toLocaleString()} words`} />
                      <List.Item.Detail.Metadata.TagList title="Bucket">
                        <List.Item.Detail.Metadata.TagList.Item text={b ? BUCKETS[b].title : "Unfiled"} color={b ? Color.Green : Color.SecondaryText} />
                      </List.Item.Detail.Metadata.TagList>
                      <List.Item.Detail.Metadata.Separator />
                      <List.Item.Detail.Metadata.Label title="Kind" text={c.kind} />
                      {c.code && <List.Item.Detail.Metadata.Label title="Flags" text="code-looking" />}
                      {c.link && <List.Item.Detail.Metadata.Label title="Flags" text="has links" />}
                      {c.len >= 2000 && <List.Item.Detail.Metadata.Label title="Flags" text="big clip" />}
                    </List.Item.Detail.Metadata>
                  }
                />
              }
              actions={
                <ActionPanel title="Clip">
                  {c.kind === "text" && (
                    <Action
                      title="Paste Clip"
                      icon={Icon.Terminal}
                      onAction={async () => {
                        const body = await pasteOrCopy(c, "paste");
                        if (body) {
                          const { Clipboard } = await import("@raycast/api");
                          await Clipboard.copy(body);
                          showToast({ title: "Copied — paste with ⌘V", style: Toast.Style.Success });
                        }
                      }}
                    />
                  )}
                  {c.kind === "text" && (
                    <Action
                      title="Copy Clip"
                      icon={Icon.Clipboard}
                      onAction={async () => {
                        const body = await pasteOrCopy(c, "copy");
                        if (body) {
                          const { Clipboard } = await import("@raycast/api");
                          await Clipboard.copy(body);
                          showToast({ title: "Copied to clipboard", style: Toast.Style.Success });
                        }
                      }}
                    />
                  )}
                  <ActionPanel.Section title="File into bucket">
                    {(Object.keys(BUCKETS) as Bucket[]).map((k) => (
                      <Action
                        key={k}
                        title={`File → ${BUCKETS[k].title}`}
                        icon={BUCKETS[k].icon}
                        onAction={() => setBucket(line, b === k ? null : k)}
                      />
                    ))}
                    {b && <Action title="Remove From Bucket" icon={Icon.Xmark} onAction={() => setBucket(line, null)} />}
                  </ActionPanel.Section>
                  <ActionPanel.Section title="Bucket tools">
                    <Action
                      title="Run Full Backup Workflow"
                      icon={Icon.HardDrive}
                      shortcut={{ modifiers: ["cmd", "shift"], key: "b" }}
                      onAction={runBackupNow}
                    />
                    {(Object.keys(BUCKETS) as Bucket[]).map((k) => (
                      <Action
                        key={`exp-${k}`}
                        title={`Export ${BUCKETS[k].title} bucket (${counts[k]})`}
                        icon={Icon.SaveDocument}
                        shortcut={{ modifiers: ["cmd", "shift"], key: "e" }}
                        onAction={() => exportBucket(k)}
                      />
                    ))}
                  </ActionPanel.Section>
                </ActionPanel>
              }
            />
          );
        })}
      </List.Section>
    </List>
  );
}
