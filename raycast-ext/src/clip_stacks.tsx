import { ActionPanel, Action, Icon, List, LocalStorage, showToast, Toast, Color } from "@raycast/api";
import { useState, useEffect, useMemo } from "react";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const ARCHIVE_DIR = "/Users/paranjay/Developer/iftt/gravity-archive";
type Bucket = "throwaway" | "important" | "thoughts";
const BUCKETS: Record<Bucket, { title: string; icon: Icon; tint: string }> = {
  throwaway: { title: "Throwaway", icon: Icon.Trash, tint: "#8a8a99" },
  important: { title: "Important", icon: Icon.Star, tint: "#FFB432" },
  thoughts: { title: "Thoughts", icon: Icon.LightBulb, tint: "#3CC8F0" },
};

interface Clip {
  line: number;
  createdAt: string;
  kind: string;
  preview: string;
  len: number;
  isCode: boolean;
  hasLink: boolean;
  full?: string;
}

async function latestJsonl(): Promise<string | null> {
  try {
    const files = (await readdir(ARCHIVE_DIR)).filter((f) => f.startsWith("rayconfig-clips-") && f.endsWith(".jsonl")).sort();
    return files.length ? path.join(ARCHIVE_DIR, files[files.length - 1]) : null;
  } catch {
    return null;
  }
}

async function loadClips(): Promise<Clip[]> {
  const file = await latestJsonl();
  if (!file) return [];
  const lines = (await readFile(file, "utf8")).trim().split("\n");
  return lines.map((l, i) => {
    const e = JSON.parse(l);
    const text: string = e.kind === "text" ? e.text : "";
    return {
      line: i,
      createdAt: e.createdAt || "",
      kind: e.kind,
      preview: e.kind === "text" ? text.replace(/\s+/g, " ").trim().slice(0, 110) || "(empty)" : `[image] ${e.imagePath || ""}`.slice(0, 110),
      len: text.length,
      isCode: /```|function |const .*=|import .*from|def |class /.test(text),
      hasLink: /https?:\/\//.test(text),
      full: e.kind === "text" ? text : undefined,
    };
  });
}

export default function Command() {
  const [clips, setClips] = useState<Clip[] | null>(null);
  const [buckets, setBuckets] = useState<Record<string, Bucket>>({});
  const [bucketFilter, setBucketFilter] = useState("all");
  const [kindFilter, setKindFilter] = useState("all");

  useEffect(() => {
    loadClips().then(setClips);
    LocalStorage.getItem<string>("homepulse-clip-buckets").then((v) => {
      if (v) setBuckets(JSON.parse(v));
    });
  }, []);

  async function setBucket(line: number, b: Bucket | null) {
    const next = { ...buckets };
    const key = `clip:${line}`;
    if (b) next[key] = b;
    else delete next[key];
    setBuckets(next);
    await LocalStorage.setItem("homepulse-clip-buckets", JSON.stringify(next));
    showToast({ title: b ? `Filed → ${BUCKETS[b].title}` : "Removed from bucket", style: Toast.Style.Success });
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { throwaway: 0, important: 0, thoughts: 0 };
    Object.values(buckets).forEach((b) => c[b]++);
    return c;
  }, [buckets]);

  const filtered = useMemo(() => {
    if (!clips) return [];
    return clips.filter((c) => {
      if (bucketFilter !== "all" && buckets[`clip:${c.line}`] !== bucketFilter) return false;
      if (kindFilter === "code" && !c.isCode) return false;
      if (kindFilter === "links" && !c.hasLink) return false;
      if (kindFilter === "big" && c.len < 2000) return false;
      if (kindFilter === "images" && c.kind !== "image") return false;
      return true;
    });
  }, [clips, buckets, bucketFilter, kindFilter]);

  return (
    <List
      isLoading={clips === null}
      searchBarPlaceholder={`Search ${clips?.length ?? "…"} rescued clips (beyond Raycast's 3-month wall)…`}
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
          const b = buckets[`clip:${c.line}`];
          return (
            <List.Item
              key={c.line}
              title={c.preview}
              subtitle={`${c.createdAt.slice(0, 10)} · ${c.len.toLocaleString()} chars${c.isCode ? " · code" : ""}`}
              icon={b ? { source: BUCKETS[b].icon, tintColor: BUCKETS[b].tint } : c.kind === "image" ? Icon.Image : Icon.Text}
              accessories={b ? [{ tag: { value: BUCKETS[b].title, color: Color.SecondaryText } }] : []}
              keywords={[c.kind, b ?? ""]}
              actions={
                <ActionPanel title="Clip">
                  {c.full && <Action.Paste title="Paste Clip" content={c.full} />}
                  {c.full && <Action.CopyToClipboard title="Copy Clip" content={c.full} />}
                  <ActionPanel.Section title="File into bucket">
                    {(Object.keys(BUCKETS) as Bucket[]).map((k) => (
                      <Action
                        key={k}
                        title={`File → ${BUCKETS[k].title}`}
                        icon={BUCKETS[k].icon}
                        onAction={() => setBucket(c.line, b === k ? null : k)}
                      />
                    ))}
                    {b && <Action title="Remove From Bucket" icon={Icon.Xmark} onAction={() => setBucket(c.line, null)} />}
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
