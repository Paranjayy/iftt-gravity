/**
 * URL → Markdown converter.
 *
 * - Convert single URL or paste a block of text containing many URLs
 * - Smart title extraction: og:title → twitter:title → <title> → domain + path slug
 * - History (LocalStorage) with re-copy, re-edit, delete, search
 * - Output format: numbered (default) / bullet / bare / with timestamp
 * - Auto-detects URLs in clipboard on open
 *
 * User's gotcha (paraphrased from chat): x.com / reddit.com return
 * JS-only SPAs to non-browser user agents. The og:title and twitter:title
 * meta tags are usually set server-side, so we prefer them over <title>
 * which often contains generic strings on SPAs.
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
  useNavigation,
  LocalStorage,
  Clipboard,
  Detail,
} from "@raycast/api";
import { useState, useEffect } from "react";
import fetch from "node-fetch";

// --- Storage ---

const STORAGE_KEY = "homepulse-url-history";
const MAX_HISTORY = 200;

type OutputFormat = "numbered" | "bullet" | "bare" | "timestamped";

interface Conversion {
  id: string;
  input: string; // raw URL(s) the user gave us
  output: string; // final markdown
  format: OutputFormat;
  urls: string[]; // parsed URLs
  count: number; // how many in the batch
  timestamp: string;
  durationMs: number;
}

async function loadHistory(): Promise<Conversion[]> {
  const stored = await LocalStorage.getItem<string>(STORAGE_KEY);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored) as Conversion[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveHistory(items: Conversion[]): Promise<void> {
  const trimmed = items.slice(0, MAX_HISTORY);
  await LocalStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

// --- URL extraction & title fetch ---

const URL_RE = /https?:\/\/[^\s<>"')]+/g;

function extractUrls(text: string): string[] {
  const matches = text.match(URL_RE) || [];
  // de-dupe, preserve order
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

const UA_HEADERS = {
  // Most sites serve full HTML to a real-browser UA. Bot-style UAs get SPAs.
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "en-US,en;q=0.9",
};

interface TitleResult {
  url: string;
  title: string;
  source: "og" | "twitter" | "title" | "domain" | "url";
  ms: number;
}

async function fetchTitle(url: string, timeoutMs = 8000): Promise<TitleResult> {
  const t0 = Date.now();
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    const res = await fetch(url, {
      headers: UA_HEADERS,
      signal: ac.signal,
      redirect: "follow",
    });
    clearTimeout(timer);
    const html = await res.text();
    // Order of preference: og:title → twitter:title → <title>
    const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
    if (og?.[1] && !isBotBlock(og[1])) {
      return { url, title: cleanTitle(og[1]), source: "og", ms: Date.now() - t0 };
    }
    const tw = html.match(/<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i);
    if (tw?.[1] && !isBotBlock(tw[1])) {
      return { url, title: cleanTitle(tw[1]), source: "twitter", ms: Date.now() - t0 };
    }
    const t = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (t?.[1] && !isBotBlock(t[1])) {
      return { url, title: cleanTitle(t[1]), source: "title", ms: Date.now() - t0 };
    }
    return { url, title: fallbackTitle(url), source: "domain", ms: Date.now() - t0 };
  } catch (e) {
    return { url, title: fallbackTitle(url), source: "url", ms: Date.now() - t0 };
  }
}

// Detect bot-block pages (Reddit, Twitter SPA, Cloudflare challenges) and
// fall back to URL-slug title instead of "Please wait for verification" etc.
function isBotBlock(title: string): boolean {
  const t = title.toLowerCase();
  const blocked = [
    "please wait",
    "just a moment",
    "verifying",
    "verification",
    "cloudflare",
    "attention required",
    "are you human",
    "checking your browser",
    "redirecting",
  ];
  return blocked.some((b) => t.includes(b));
}

function cleanTitle(raw: string): string {
  return raw
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+[|·•\-–—]\s+[A-Za-z0-9._-]+\s*$/, "") // strip " | SiteName" suffix
    .trim()
    .slice(0, 200);
}

function fallbackTitle(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    // Use path segments as title hint, joining the meaningful ones
    const parts = u.pathname.split("/").filter(Boolean);
    const meaningful = parts
      .filter((p) => p.length > 3 && !/^[a-f0-9]{6,}$/i.test(p) && !/^\d+$/.test(p))
      .map((p) => p.replace(/\.\w+$/, "").replace(/[-_]/g, " "))
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1));
    if (meaningful.length === 0) return host;
    return meaningful.slice(0, 3).join(" · ");
  } catch {
    return url;
  }
}

async function fetchTitlesParallel(urls: string[]): Promise<TitleResult[]> {
  return Promise.all(urls.map((u) => fetchTitle(u)));
}

// --- Output formatting ---

function formatOutput(results: TitleResult[], format: OutputFormat): string {
  const ts = new Date().toLocaleString("en-IN", { hour12: false }).replace(/[/:]/g, "-");
  return results
    .map((r, i) => {
      const link = `[${r.title}](${r.url})`;
      switch (format) {
        case "numbered":
          return `${i + 1}. ${link}`;
        case "bullet":
          return `- ${link}`;
        case "bare":
          return link;
        case "timestamped":
          return `- ${ts} ${link}`;
      }
    })
    .join("\n");
}

// --- Quick action helpers ---

async function copyWithToast(text: string, title: string) {
  await Clipboard.copy(text);
  await showToast({ style: Toast.Style.Success, title, message: "Copied to clipboard" });
}

// --- Component ---

export default function Command() {
  const [history, setHistory] = useState<Conversion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadHistory().then((h) => {
      setHistory(h);
      setIsLoading(false);
    });
  }, []);

  async function persist(next: Conversion[]) {
    setHistory(next);
    await saveHistory(next);
  }

  // --- Format option stored per-conversion ---
  const [defaultFormat, setDefaultFormat] = useState<OutputFormat>("numbered");

  // --- Filtered view ---
  const q = search.trim().toLowerCase();
  const filtered = q
    ? history.filter(
        (c) =>
          c.input.toLowerCase().includes(q) ||
          c.output.toLowerCase().includes(q),
      )
    : history;

  // --- Handlers ---

  async function handleNewConversion(input: string, format: OutputFormat) {
    const urls = extractUrls(input);
    if (urls.length === 0) {
      await showToast({
        style: Toast.Style.Failure,
        title: "No URLs found",
        message: "Paste a URL or a block of text containing URLs.",
      });
      return;
    }
    // Smart dedup: skip URLs already converted in the last 24h
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const recentUrls = new Set(
      history
        .filter((c) => new Date(c.timestamp).getTime() > cutoff)
        .flatMap((c) => c.urls),
    );
    const fresh = urls.filter((u) => !recentUrls.has(u));
    const skipped = urls.length - fresh.length;
    if (fresh.length === 0) {
      await showToast({
        style: Toast.Style.Failure,
        title: "All URLs already in history",
        message: `${urls.length} URL${urls.length === 1 ? "" : "s"} converted in the last 24h.`,
      });
      return;
    }
    const plural = fresh.length === 1 ? "URL" : "URLs";
    const toast = await showToast({
      style: Toast.Style.Animated,
      title: `Fetching ${fresh.length} ${plural}…`,
    });
    const t0 = Date.now();
    const results = await fetchTitlesParallel(fresh);
    const output = formatOutput(results, format);
    const newConv: Conversion = {
      id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      input,
      output,
      format,
      urls: fresh,
      count: fresh.length,
      timestamp: nowIso(),
      durationMs: Date.now() - t0,
    };
    await persist([newConv, ...history]);
    await Clipboard.copy(output);
    toast.style = Toast.Style.Success;
    const skipMsg = skipped > 0 ? ` (${skipped} already in history)` : "";
    toast.title = `Converted ${fresh.length} ${plural}${skipMsg}`;
    toast.message = `Copied to clipboard (${newConv.durationMs}ms)`;
  }

  async function handleConvertClipboard(format: OutputFormat) {
    try {
      const text = await Clipboard.readText();
      if (!text || !text.trim()) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Clipboard empty",
          message: "Copy a URL or block of URLs first, then run this command.",
        });
        return;
      }
      await handleNewConversion(text, format);
    } catch (e: any) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Clipboard read failed",
        message: String(e?.message || e),
      });
    }
  }

  async function handleReuse(input: string, format: OutputFormat) {
    await handleNewConversion(input, format);
  }

  async function handleDelete(id: string) {
    await persist(history.filter((c) => c.id !== id));
  }

  async function handleClearAll() {
    await persist([]);
    await showToast({ style: Toast.Style.Success, title: "History cleared" });
  }

  async function handleExportAll() {
    if (history.length === 0) {
      await showToast({ style: Toast.Style.Failure, title: "No history to export" });
      return;
    }
    // Group by date, ordered newest first
    const byDate: Record<string, Conversion[]> = {};
    for (const c of history) {
      const day = new Date(c.timestamp).toISOString().split("T")[0];
      (byDate[day] = byDate[day] || []).push(c);
    }
    const sections = Object.entries(byDate)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([day, items]) => {
        const body = items.map((i) => i.output).join("\n\n");
        return `## ${day}\n\n${body}\n`;
      });
    const header = `# URL Conversion History\n\n_Exported ${new Date().toLocaleString()} · ${history.length} conversion${history.length === 1 ? "" : "s"}_\n\n---\n\n`;
    const md = header + sections.join("\n");
    await Clipboard.copy(md);
    await showToast({
      style: Toast.Style.Success,
      title: "Exported to clipboard",
      message: `${history.length} conversions, ${md.length} chars`,
    });
  }

  return (
    <List
      isLoading={isLoading}
      onSearchTextChange={setSearch}
      searchBarPlaceholder="Search history or paste URLs to convert…"
      throttle
    >
      {/* Quick actions at the top so Cmd-R works on them */}
      <List.Section title="Quick Actions">
        <List.Item
          title="Convert Clipboard"
          subtitle="Read URLs from clipboard, fetch titles, copy markdown"
          icon={{ source: Icon.Clipboard, tintColor: Color.Blue }}
          actions={
            <ActionPanel>
              <Action
                title="Convert Clipboard (Numbered)"
                icon={Icon.Hashtag}
                onAction={() => handleConvertClipboard("numbered")}
              />
              <Action
                title="Convert Clipboard (Bulleted)"
                icon={Icon.Dot}
                onAction={() => handleConvertClipboard("bullet")}
              />
              <Action
                title="Convert Clipboard (Bare)"
                icon={Icon.Link}
                onAction={() => handleConvertClipboard("bare")}
              />
              <Action.Push
                title="Convert Custom Input…"
                icon={Icon.Text}
                target={<ConvertForm defaultFormat={defaultFormat} onSubmit={handleNewConversion} />}
              />
            </ActionPanel>
          }
        />
        <List.Item
          title="Convert Custom Input"
          subtitle="Paste a URL or a whole block — auto-detects multiple"
          icon={{ source: Icon.TextInput, tintColor: Color.Purple }}
          actions={
            <ActionPanel>
              <Action.Push
                title="Open Form"
                icon={Icon.Text}
                target={<ConvertForm defaultFormat={defaultFormat} onSubmit={handleNewConversion} />}
              />
            </ActionPanel>
          }
        />
        <List.Item
          title="Export Full History"
          subtitle={`${history.length} conversion${history.length === 1 ? "" : "s"} grouped by day, copy as markdown`}
          icon={{ source: Icon.Download, tintColor: Color.Green }}
          actions={
            <ActionPanel>
              <Action
                title="Export to Clipboard"
                icon={Icon.Clipboard}
                onAction={handleExportAll}
              />
            </ActionPanel>
          }
        />
        <List.Item
          title="Clear All History"
          subtitle="Wipe all conversions (irreversible)"
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
            title={q ? "No history entries match your search" : "No conversions yet"}
            subtitle={q ? "Try a different query" : "Run a quick action above to start"}
            icon={q ? Icon.MagnifyingGlass : Icon.Star}
          />
        </List.Section>
      ) : null}

      {filtered.length > 0 && (
        <List.Section
          title={q ? `History (${filtered.length} match)` : `History (${filtered.length})`}
        >
          {filtered.map((c) => (
            <HistoryItem
              key={c.id}
              conversion={c}
              onCopy={copyWithToast}
              onReuse={handleReuse}
              onDelete={handleDelete}
              onClearAll={handleClearAll}
            />
          ))}
        </List.Section>
      )}
    </List>
  );
}

function nowIso(): string {
  return new Date().toISOString();
}

function HistoryItem({
  conversion,
  onCopy,
  onReuse,
  onDelete,
  onClearAll,
}: {
  conversion: Conversion;
  onCopy: (text: string, title: string) => Promise<void>;
  onReuse: (input: string, format: OutputFormat) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClearAll: () => Promise<void>;
}) {
  const date = new Date(conversion.timestamp);
  const subtitle =
    conversion.count === 1
      ? `1 URL · ${date.toLocaleString()} · ${conversion.durationMs}ms`
      : `${conversion.count} URLs · ${date.toLocaleString()} · ${conversion.durationMs}ms`;
  return (
    <List.Item
      title={firstLine(conversion.output)}
      subtitle={subtitle}
      icon={{ source: Icon.Link, tintColor: Color.Green }}
      accessories={[
        { tag: { value: conversion.format, color: formatColor(conversion.format) } },
      ]}
      actions={
        <ActionPanel>
          <Action.CopyToClipboard
            title="Copy Markdown"
            content={conversion.output}
            shortcut={{ modifiers: ["cmd"], key: "c" }}
          />
          <Action.Push
            title="Preview"
            icon={Icon.Eye}
            shortcut={{ modifiers: ["cmd"], key: "p" }}
            target={
              <Detail
                markdown={`# Conversion · ${date.toLocaleString()}\n\n*Input:*\n\`\`\`\n${conversion.input}\n\`\`\`\n\n*Output (${conversion.format}):*\n\n${conversion.output}\n\n---\n\n*Stats:*\n- URLs: ${conversion.count}\n- Format: \`${conversion.format}\`\n- Fetched in: ${conversion.durationMs}ms`}
                actions={
                  <ActionPanel>
                    <Action.CopyToClipboard title="Copy Markdown" content={conversion.output} />
                  </ActionPanel>
                }
              />
            }
          />
          <Action
            title="Re-convert (refresh titles)"
            icon={Icon.Repeat}
            shortcut={{ modifiers: ["cmd"], key: "r" }}
            onAction={() => onReuse(conversion.urls.join("\n"), conversion.format)}
          />
          <Action
            title="Re-convert as Bulleted"
            icon={Icon.Dot}
            shortcut={{ modifiers: ["cmd", "shift"], key: "b" }}
            onAction={() => onReuse(conversion.urls.join("\n"), "bullet")}
          />
          <Action
            title="Re-convert as Bare"
            icon={Icon.Link}
            shortcut={{ modifiers: ["cmd", "shift"], key: "l" }}
            onAction={() => onReuse(conversion.urls.join("\n"), "bare")}
          />
          <Action.CopyToClipboard
            title="Copy Input (raw URLs)"
            content={conversion.urls.join("\n")}
            shortcut={{ modifiers: ["cmd", "shift"], key: "u" }}
          />
          <Action
            title="Delete Entry"
            icon={Icon.Trash}
            style={Action.Style.Destructive}
            shortcut={{ modifiers: ["cmd"], key: "delete" }}
            onAction={() => onDelete(conversion.id)}
          />
          <Action
            title="Clear All History"
            icon={Icon.Trash}
            style={Action.Style.Destructive}
            shortcut={{ modifiers: ["cmd", "shift"], key: "delete" }}
            onAction={onClearAll}
          />
        </ActionPanel>
      }
    />
  );
}

function firstLine(text: string): string {
  const first = text.split("\n")[0] || "";
  return first.length > 90 ? first.slice(0, 87) + "..." : first;
}

function formatColor(f: OutputFormat): Color {
  switch (f) {
    case "numbered":
      return Color.Blue;
    case "bullet":
      return Color.Purple;
    case "bare":
      return Color.SecondaryText;
    case "timestamped":
      return Color.Orange;
  }
}

function ConvertForm({
  defaultFormat,
  onSubmit,
}: {
  defaultFormat: OutputFormat;
  onSubmit: (input: string, format: OutputFormat) => Promise<void>;
}) {
  const { pop } = useNavigation();
  const [text, setText] = useState("");
  const [format, setFormat] = useState<OutputFormat>(defaultFormat);

  async function handleSubmit() {
    if (!text.trim()) {
      await showToast({ style: Toast.Style.Failure, title: "Empty input" });
      return;
    }
    await onSubmit(text, format);
    pop();
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Convert" icon={Icon.Checkmark} onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Description text="Paste one URL or many. The converter finds all URLs and fetches their titles." />
      <Form.TextArea
        id="input"
        title="URLs (one or many)"
        placeholder="https://example.com&#10;https://x.com/foo/status/123"
        value={text}
        onChange={setText}
        autoFocus
        enableMarkdown
      />
      <Form.Dropdown
        id="format"
        title="Output format"
        value={format}
        onChange={(v) => setFormat(v as OutputFormat)}
      >
        <Form.Dropdown.Item value="numbered" title="1. [Title](url) (default)" />
        <Form.Dropdown.Item value="bullet" title="- [Title](url)" />
        <Form.Dropdown.Item value="bare" title="[Title](url)" />
        <Form.Dropdown.Item value="timestamped" title="- 2026-07-23 22:00 [Title](url)" />
      </Form.Dropdown>
    </Form>
  );
}
