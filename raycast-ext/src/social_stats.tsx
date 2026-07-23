/**
 * Social Stats — fetch rich metadata for a URL.
 *
 * Pure stats: views, likes, score, comments, stars, forks, etc.
 * Supports YouTube, Reddit (limited — auth-walled), GitHub, Hacker News,
 * StackOverflow. Twitter/X, Instagram, TikTok are recognized but
 * return "no stats" (they all require auth).
 *
 * History stored in LocalStorage as `homepulse-social-stats`.
 */

import {
  List,
  ActionPanel,
  Action,
  Icon,
  Color,
  showToast,
  Toast,
  Form,
  Detail,
  useNavigation,
  LocalStorage,
  Clipboard,
} from "@raycast/api";
import { useState, useEffect } from "react";
import { fetchStatsForUrls, formatStatsMarkdown, RichResult } from "./social/providers";

// --- Storage ---

const STORAGE_KEY = "homepulse-social-stats";
const MAX_HISTORY = 100;

interface HistoryEntry {
  id: string;
  result: RichResult;
  timestamp: string;
}

async function loadHistory(): Promise<HistoryEntry[]> {
  const stored = await LocalStorage.getItem<string>(STORAGE_KEY);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored) as HistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveHistory(items: HistoryEntry[]) {
  await LocalStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_HISTORY)));
}

// --- Component ---

export default function Command() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadHistory().then((h) => {
      setHistory(h);
      setIsLoading(false);
    });
  }, []);

  async function persist(next: HistoryEntry[]) {
    setHistory(next);
    await saveHistory(next);
  }

  const q = search.trim().toLowerCase();
  const filtered = q
    ? history.filter(
        (h) =>
          h.result.title.toLowerCase().includes(q) ||
          h.result.url.toLowerCase().includes(q) ||
          h.result.platform.toLowerCase().includes(q),
      )
    : history;

  async function handleFetchOne(input: string) {
    const urls = extractUrls(input);
    if (urls.length === 0) {
      await showToast({
        style: Toast.Style.Failure,
        title: "No URLs in input",
        message: "Paste a URL or a block of URLs.",
      });
      return;
    }
    const toast = await showToast({
      style: Toast.Style.Animated,
      title: `Fetching stats for ${urls.length} URL${urls.length === 1 ? "" : "s"}…`,
    });
    const results = await fetchStatsForUrls(urls);
    const entries: HistoryEntry[] = results.map((r) => ({
      id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      result: r,
      timestamp: new Date().toISOString(),
    }));
    await persist([...entries, ...history]);
    const ok = results.filter((r) => r.status === "ok").length;
    const partial = results.filter((r) => r.status === "partial").length;
    const noStats = results.filter((r) => r.status === "no-stats").length;
    toast.style = Toast.Style.Success;
    toast.title = `Done: ${ok} ok · ${partial} partial · ${noStats} no-stats`;
    toast.message = `${results.length} URL${results.length === 1 ? "" : "s"} processed`;
  }

  async function handleFetchClipboard() {
    try {
      const text = await Clipboard.readText();
      if (!text || !text.trim()) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Clipboard empty",
          message: "Copy a URL first.",
        });
        return;
      }
      await handleFetchOne(text);
    } catch (e: any) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Clipboard read failed",
        message: String(e?.message || e),
      });
    }
  }

  async function handleRefresh(h: HistoryEntry) {
    const results = await fetchStatsForUrls([h.result.url]);
    if (results[0]) {
      const next: HistoryEntry[] = history.map((x) =>
        x.id === h.id ? { ...x, result: results[0], timestamp: new Date().toISOString() } : x,
      );
      await persist(next);
      await showToast({ style: Toast.Style.Success, title: "Refreshed" });
    }
  }

  async function handleDelete(id: string) {
    await persist(history.filter((h) => h.id !== id));
  }

  async function handleClearAll() {
    await persist([]);
    await showToast({ style: Toast.Style.Success, title: "Stats history cleared" });
  }

  return (
    <List
      isLoading={isLoading}
      onSearchTextChange={setSearch}
      searchBarPlaceholder="Paste a URL, or search history…"
      throttle
    >
      <List.Section title="Quick Actions">
        <List.Item
          title="Fetch Clipboard URL"
          subtitle="Read URL from clipboard, fetch stats, store in history"
          icon={{ source: Icon.Clipboard, tintColor: Color.Blue }}
          actions={
            <ActionPanel>
              <Action
                title="Fetch Stats"
                icon={Icon.Bolt}
                onAction={handleFetchClipboard}
              />
              <Action.Push
                title="Fetch Custom Input…"
                icon={Icon.TextInput}
                target={<FetchForm onSubmit={handleFetchOne} />}
              />
            </ActionPanel>
          }
        />
        <List.Item
          title="Fetch Custom Input"
          subtitle="Paste a URL or a block of URLs (multi-fetch parallel)"
          icon={{ source: Icon.TextInput, tintColor: Color.Purple }}
          actions={
            <ActionPanel>
              <Action.Push
                title="Open Form"
                icon={Icon.TextInput}
                target={<FetchForm onSubmit={handleFetchOne} />}
              />
            </ActionPanel>
          }
        />
        <List.Item
          title="Clear All History"
          subtitle={`Wipe ${history.length} entr${history.length === 1 ? "y" : "ies"} (irreversible)`}
          icon={{ source: Icon.Trash, tintColor: Color.Red }}
          actions={
            <ActionPanel>
              <Action
                title="Clear All History"
                icon={Icon.Trash}
                style={Action.Style.Destructive}
                onAction={handleClearAll}
              />
            </ActionPanel>
          }
        />
      </List.Section>

      {filtered.length === 0 && !isLoading ? (
        <List.Section title={q ? "No matches" : "History"}>
          <List.Item
            title={q ? "No stats entries match your search" : "No stats yet"}
            subtitle={q ? "Try a different query" : "Paste a URL or use Clipboard action above"}
            icon={q ? Icon.MagnifyingGlass : Icon.Star}
          />
        </List.Section>
      ) : null}

      {filtered.length > 0 && (
        <List.Section
          title={q ? `History (${filtered.length} match)` : `History (${filtered.length})`}
        >
          {filtered.map((h) => (
            <HistoryItem
              key={h.id}
              entry={h}
              onRefresh={handleRefresh}
              onDelete={handleDelete}
            />
          ))}
        </List.Section>
      )}
    </List>
  );
}

function HistoryItem({
  entry,
  onRefresh,
  onDelete,
}: {
  entry: HistoryEntry;
  onRefresh: (e: HistoryEntry) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const r = entry.result;
  return (
    <List.Item
      title={r.title.slice(0, 80)}
      subtitle={`${r.platform} · ${new Date(entry.timestamp).toLocaleString()}`}
      icon={{ source: platformIcon(r.platform), tintColor: statusColor(r.status) }}
      accessories={[
        { tag: { value: r.status, color: statusColor(r.status) } },
        { text: `${r.durationMs}ms` },
      ]}
      actions={
        <ActionPanel>
          <Action.Push
            title="View Stats"
            icon={Icon.Eye}
            target={<StatsDetail result={r} />}
          />
          <Action.CopyToClipboard
            title="Copy as Markdown"
            content={formatStatsMarkdown(r)}
            shortcut={{ modifiers: ["cmd"], key: "c" }}
          />
          <Action.CopyToClipboard
            title="Copy Title Only"
            content={r.title}
            shortcut={{ modifiers: ["cmd"], key: "t" }}
          />
          <Action
            title="Refresh"
            icon={Icon.Repeat}
            shortcut={{ modifiers: ["cmd"], key: "r" }}
            onAction={() => onRefresh(entry)}
          />
          <Action
            title="Delete Entry"
            icon={Icon.Trash}
            style={Action.Style.Destructive}
            shortcut={{ modifiers: ["cmd"], key: "delete" }}
            onAction={() => onDelete(entry.id)}
          />
        </ActionPanel>
      }
    />
  );
}

function platformIcon(p: RichResult["platform"]): Icon {
  switch (p) {
    case "youtube":
    case "vimeo":
      return Icon.Video;
    case "reddit":
      return Icon.Message;
    case "github":
      return Icon.Code;
    case "hackernews":
      return Icon.LightBulb;
    case "stackoverflow":
      return Icon.QuestionMark;
    case "twitter":
      return Icon.Bird;
    case "instagram":
    case "tiktok":
      return Icon.Image;
    case "soundcloud":
    case "spotify":
      return Icon.Music;
    default:
      return Icon.Link;
  }
}

function statusColor(s: RichResult["status"]): Color {
  switch (s) {
    case "ok":
      return Color.Green;
    case "partial":
      return Color.Yellow;
    case "no-stats":
      return Color.Orange;
    case "unknown":
      return Color.Red;
  }
}

function FetchForm({ onSubmit }: { onSubmit: (input: string) => Promise<void> }) {
  const { pop } = useNavigation();
  const [text, setText] = useState("");

  async function handleSubmit() {
    if (!text.trim()) {
      await showToast({ style: Toast.Style.Failure, title: "Empty input" });
      return;
    }
    await onSubmit(text);
    pop();
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Fetch Stats" icon={Icon.Bolt} onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Description text="Paste one URL or many. Each will be auto-detected and stats fetched in parallel." />
      <Form.TextArea
        id="input"
        title="URLs (one or many)"
        placeholder="https://github.com/raycast/extensions&#10;https://www.youtube.com/watch?v=..."
        value={text}
        onChange={setText}
        autoFocus
        enableMarkdown
      />
    </Form>
  );
}

function formatNum(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}K`;
  if (n < 1_000_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  return `${(n / 1_000_000_000).toFixed(1)}B`;
}

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}

function StatsDetail({ result }: { result: RichResult }) {
  const r = result;
  const s = r.stats;
  const mdLines: string[] = [];

  mdLines.push(`# ${r.title}`);
  mdLines.push("");
  mdLines.push(`**Platform:** ${r.platform} · **Status:** ${r.status}${r.error ? " · " + r.error : ""}`);
  mdLines.push(`**URL:** ${r.url}`);
  mdLines.push(`**Fetched:** ${new Date(r.fetchedAt).toLocaleString()} (${r.durationMs}ms)`);
  mdLines.push("");

  // Build a "key stats" hero table
  const hero: [string, string][] = [];
  if (r.platform === "youtube") {
    if (s.views !== undefined) hero.push(["👁 Views", formatNum(s.views)]);
    if (s.likes !== undefined) hero.push(["👍 Likes", formatNum(s.likes)]);
    if (s.commentCount !== undefined) hero.push(["💬 Comments", formatNum(s.commentCount)]);
    if (s.durationSec !== undefined) hero.push(["⏱ Duration", formatDuration(s.durationSec)]);
    if (s.isLive) hero.push(["🔴 Status", "LIVE"]);
  } else if (r.platform === "reddit") {
    if (s.subreddit) hero.push(["📂 Subreddit", `r/${s.subreddit}`]);
    if (s.score !== undefined) hero.push(["⬆ Score", formatNum(s.score)]);
    if (s.upvoteRatio !== undefined) hero.push(["👍 Ratio", `${(s.upvoteRatio * 100).toFixed(0)}%`]);
    if (s.commentCount !== undefined) hero.push(["💬 Comments", formatNum(s.commentCount)]);
    if (s.nsfw) hero.push(["🔞", "NSFW"]);
  } else if (r.platform === "github") {
    if (s.stars !== undefined) hero.push(["⭐ Stars", formatNum(s.stars)]);
    if (s.forks !== undefined) hero.push(["🍴 Forks", formatNum(s.forks)]);
    if (s.openIssues !== undefined) hero.push(["📋 Issues", formatNum(s.openIssues)]);
    if (s.language) hero.push(["💻 Language", s.language]);
  } else if (r.platform === "hackernews") {
    if (s.score !== undefined) hero.push(["⬆ Points", formatNum(s.score)]);
    if (s.commentCount !== undefined) hero.push(["💬 Comments", formatNum(s.commentCount)]);
  } else if (r.platform === "stackoverflow") {
    if (s.score !== undefined) hero.push(["⬆ Score", formatNum(s.score)]);
    if (s.answers !== undefined)
      hero.push(["💬 Answers", `${s.answers}${s.isAnswered ? " ✓" : ""}`]);
    if (s.views !== undefined) hero.push(["👁 Views", formatNum(s.views)]);
  }
  if (hero.length) {
    mdLines.push("## Key Stats");
    mdLines.push("");
    mdLines.push("| Metric | Value |");
    mdLines.push("|---|---|");
    for (const [k, v] of hero) mdLines.push(`| ${k} | ${v} |`);
    mdLines.push("");
  }

  // Author
  if (s.author) {
    mdLines.push(`**By:** ${s.authorUrl ? `[${s.author}](${s.authorUrl})` : s.author}`);
  }

  // Description
  if (s.description) {
    mdLines.push("");
    mdLines.push(`> ${s.description}`);
  }

  // Topics / tags
  if (s.topics && s.topics.length) {
    mdLines.push("");
    mdLines.push("**Topics:** " + s.topics.slice(0, 8).map((t) => `\`${t}\``).join(", "));
  }
  if (s.tags && s.tags.length) {
    mdLines.push("");
    mdLines.push("**Tags:** " + s.tags.slice(0, 8).map((t) => `\`${t}\``).join(", "));
  }

  // Thumbnail
  if (s.thumbnailUrl) {
    mdLines.push("");
    mdLines.push(`![thumbnail](${s.thumbnailUrl})`);
  }

  if (r.status === "no-stats" && r.error) {
    mdLines.push("");
    mdLines.push(`> ⚠️ ${r.error}`);
  }

  return (
    <Detail
      markdown={mdLines.join("\n")}
      actions={
        <ActionPanel>
          <Action.CopyToClipboard
            title="Copy as Markdown"
            content={formatStatsMarkdown(r)}
            shortcut={{ modifiers: ["cmd"], key: "c" }}
          />
          <Action.OpenInBrowser title="Open in Browser" url={r.url} />
          <Action.CopyToClipboard title="Copy URL" content={r.url} />
        </ActionPanel>
      }
    />
  );
}

const URL_RE = /https?:\/\/[^\s<>"')]+/g;
function extractUrls(text: string): string[] {
  const matches = text.match(URL_RE) || [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of matches) {
    const clean = u.replace(/[.,;:!?)]+$/, "");
    if (!seen.has(clean)) {
      seen.add(clean);
      out.push(clean);
    }
  }
  return out;
}
