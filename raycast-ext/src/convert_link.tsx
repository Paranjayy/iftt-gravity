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
  sources?: { url: string; source: TitleResult["source"]; sourceSite?: string }[]; // per-URL provenance (added later; older conversions may not have it)
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
  source: "oembed" | "og" | "twitter" | "title" | "domain" | "url";
  sourceSite?: string; // "YouTube", "Twitter/X", "Vimeo", etc.
  ms: number;
}

async function fetchTitle(url: string, timeoutMs = 8000): Promise<TitleResult> {
  const t0 = Date.now();
  // 0. Try oEmbed first for known providers (YouTube, Twitter/X, Vimeo, etc.)
  //    These are the sites where scraping fails most often.
  const oembed = await tryOembed(url, Math.min(timeoutMs, 6000));
  if (oembed) {
    return { url, title: oembed.title, source: "oembed", sourceSite: oembed.site, ms: Date.now() - t0 };
  }
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

// --- oEmbed providers (no API key required) ---
// These return real titles for sites that bot-block scraping.

interface OembedProvider {
  name: string;
  match: (host: string, path: string) => boolean;
  build: (url: string) => string;
  parse: (json: any) => string | null;
}

const OEMBED_PROVIDERS: OembedProvider[] = [
  {
    name: "YouTube",
    match: (host) => /(^|\.)youtube\.com$/.test(host) || /^youtu\.be$/.test(host),
    build: (url) => `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
    parse: (json) => (json && typeof json.title === "string" ? json.title : null),
  },
  {
    name: "Twitter/X",
    match: (host) => /(^|\.)twitter\.com$/.test(host) || /(^|\.)x\.com$/.test(host),
    build: (url) => `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}`,
    parse: (json) => {
      if (!json || typeof json.author_name !== "string") return null;
      // HTML is the tweet embed; parse a snippet of the text if present
      const html: string = json.html || "";
      const stripped = html
        .replace(/<br\s*\/?>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&[a-z]+;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      const tweet = stripped.length > 200 ? stripped.slice(0, 197) + "..." : stripped;
      return tweet ? `${json.author_name}: ${tweet}` : json.author_name;
    },
  },
  {
    name: "Vimeo",
    match: (host) => /(^|\.)vimeo\.com$/.test(host),
    build: (url) => `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`,
    parse: (json) => (json && typeof json.title === "string" ? json.title : null),
  },
  {
    name: "SoundCloud",
    match: (host) => /(^|\.)soundcloud\.com$/.test(host),
    build: (url) => `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(url)}`,
    parse: (json) => (json && typeof json.title === "string" ? json.title : null),
  },
  {
    name: "Spotify",
    match: (host) => /(^|\.)spotify\.com$/.test(host) || /(^|\.)spotify\.link$/.test(host),
    build: (url) => `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`,
    parse: (json) => (json && typeof json.title === "string" ? json.title : null),
  },
];

function findOembedProvider(url: string): OembedProvider | null {
  try {
    const u = new URL(url);
    for (const p of OEMBED_PROVIDERS) {
      if (p.match(u.hostname, u.pathname)) return p;
    }
  } catch {}
  return null;
}

async function tryOembed(url: string, timeoutMs = 6000): Promise<{ title: string; site: string } | null> {
  const provider = findOembedProvider(url);
  if (!provider) return null;
  const t0 = Date.now();
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    const res = await fetch(provider.build(url), {
      signal: ac.signal,
      headers: { "User-Agent": UA_HEADERS["User-Agent"] },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = (await res.json()) as any;
    const title = provider.parse(json);
    if (title && !isBotBlock(title)) {
      return { title: cleanTitle(title), site: provider.name };
    }
    return null;
  } catch {
    return null;
  }
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
      .filter(
        (p) =>
          // Skip pure-numeric and pure-hex/alnum IDs
          !/^\d+$/.test(p) &&
          !/^[a-f0-9]{6,}$/i.test(p) &&
          // Skip if starts with a digit (post IDs like "1re8r5w")
          !/^\d/.test(p) &&
          // Has at least one vowel OR looks like a Proper Noun
          (p.length >= 4 && /[aeiouy ]/i.test(p)),
      )
      // Strip file extension
      .map((p) => p.replace(/\.\w+$/, ""))
      // Snake/dash → space
      .map((p) => p.replace(/[-_]/g, " "))
      // Title-case
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
  const [groupMode, setGroupMode] = useState<"time" | "domain">("time");

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

  // --- Grouped view (time or domain) ---
  const grouped = groupMode === "time"
    ? [{ key: "Recent", items: filtered }]
    : groupByDomain(filtered);

  // --- Domain grouping (for the stats dashboard) ---
  const allUrls: { url: string; conv: Conversion }[] = history.flatMap((c) =>
    c.urls.map((u) => ({ url: u, conv: c })),
  );
  const domainCounts: Record<string, number> = {};
  for (const { url } of allUrls) {
    try {
      const host = new URL(url).hostname.replace(/^www\./, "");
      domainCounts[host] = (domainCounts[host] || 0) + 1;
    } catch {}
  }
  const topDomains = Object.entries(domainCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);
  const totalUrls = allUrls.length;
  const totalConversions = history.length;
  const totalDuplicates = totalUrls - totalConversions; // rough: extra URLs in multi-URL conversions

  // --- Source breakdown (would need to re-derive from output text, so just count conversions) ---
  // Per-URL source tracking isn't persisted in Conversion; that's fine, we have aggregate stats

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
      sources: results.map((r) => ({ url: r.url, source: r.source, sourceSite: r.sourceSite })),
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
      searchBarAccessory={
        <List.Dropdown
          tooltip="Group history by"
          value={groupMode}
          onChange={(v) => setGroupMode(v as "time" | "domain")}
        >
          <List.Dropdown.Item value="time" title="By time (newest first)" />
          <List.Dropdown.Item value="domain" title="By domain" />
        </List.Dropdown>
      }
    >
      {/* Stats dashboard at the very top */}
      {totalConversions > 0 && (
        <List.Section title="Stats">
          <List.Item
            title={`${totalConversions} conversion${totalConversions === 1 ? "" : "s"} · ${totalUrls} URL${totalUrls === 1 ? "" : "s"}`}
            subtitle={`${Object.keys(domainCounts).length} unique domain${Object.keys(domainCounts).length === 1 ? "" : "s"} · top: ${topDomains[0]?.[0] ?? "—"}`}
            icon={{ source: Icon.BarChart, tintColor: Color.Blue }}
            accessories={[
              { tag: { value: `${topDomains[0]?.[1] ?? 0}`, color: Color.Purple } },
            ]}
            actions={
              <ActionPanel>
                <Action.Push
                  title="Open Stats Dashboard"
                  icon={Icon.BarChart}
                  target={
                    <StatsDashboard
                      totalConversions={totalConversions}
                      totalUrls={totalUrls}
                      topDomains={topDomains}
                      history={history}
                    />
                  }
                />
              </ActionPanel>
            }
          />
        </List.Section>
      )}

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

      {filtered.length > 0 && grouped.map((group) => (
        <List.Section
          key={group.key}
          title={q ? `${group.key} (${group.items.length} match)` : `${group.key} (${group.items.length})`}
        >
          {group.items.map((c) => (
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
      ))}
    </List>
  );
}

function nowIso(): string {
  return new Date().toISOString();
}

function groupByDomain(items: Conversion[]): { key: string; items: Conversion[] }[] {
  const byDomain: Record<string, Conversion[]> = {};
  for (const c of items) {
    // Pick the first URL's domain as the conversion's domain.
    // If multiple domains, the conversion is "tagged" with all of them.
    let primary: string | null = null;
    for (const u of c.urls) {
      try {
        const host = new URL(u).hostname.replace(/^www\./, "");
        primary = primary || host;
      } catch {}
    }
    const key = primary || "(unknown)";
    (byDomain[key] = byDomain[key] || []).push(c);
  }
  // Sort domains by total URL count (most active first)
  return Object.entries(byDomain)
    .map(([key, items]) => {
      const totalUrls = items.reduce((s, c) => s + c.urls.length, 0);
      return { key: `${key} (${items.length} conversion${items.length === 1 ? "" : "s"}, ${totalUrls} URL${totalUrls === 1 ? "" : "s"})`, items };
    })
    .sort((a, b) => {
      const aUrls = a.items.reduce((s, c) => s + c.urls.length, 0);
      const bUrls = b.items.reduce((s, c) => s + c.urls.length, 0);
      return bUrls - aUrls;
    });
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

function sourceColor(s: TitleResult["source"]): Color {
  switch (s) {
    case "oembed":
      return Color.Green;
    case "og":
      return Color.Blue;
    case "twitter":
      return Color.Magenta;
    case "title":
      return Color.Yellow;
    case "domain":
      return Color.Orange;
    case "url":
      return Color.Red;
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

// --- Stats Dashboard ---

function StatsDashboard({
  totalConversions,
  totalUrls,
  topDomains,
  history,
}: {
  totalConversions: number;
  totalUrls: number;
  topDomains: [string, number][];
  history: Conversion[];
}) {
  // Format breakdown
  const fmtCount: Record<OutputFormat, number> = {
    numbered: 0, bullet: 0, bare: 0, timestamped: 0,
  };
  for (const c of history) fmtCount[c.format]++;
  const fmtRows = (Object.entries(fmtCount) as [OutputFormat, number][])
    .filter(([, n]) => n > 0)
    .sort(([, a], [, b]) => b - a);

  // Source breakdown (only for conversions that have per-URL source data)
  const sourceCount: Record<TitleResult["source"], number> = {
    oembed: 0, og: 0, twitter: 0, title: 0, domain: 0, url: 0,
  };
  let totalSourcedUrls = 0;
  for (const c of history) {
    if (!c.sources) continue;
    for (const s of c.sources) {
      sourceCount[s.source]++;
      totalSourcedUrls++;
    }
  }
  const sourceRows = (Object.entries(sourceCount) as [TitleResult["source"], number][])
    .filter(([, n]) => n > 0)
    .sort(([, a], [, b]) => b - a);
  const sourceShare = totalSourcedUrls > 0
    ? (s: TitleResult["source"]) => ` (${((sourceCount[s] / totalSourcedUrls) * 100).toFixed(0)}%)`
    : (_s: TitleResult["source"]) => "";

  // Site breakdown (for oembed hits, e.g. YouTube, Twitter)
  const siteCount: Record<string, number> = {};
  for (const c of history) {
    if (!c.sources) continue;
    for (const s of c.sources) {
      if (s.source === "oembed" && s.sourceSite) {
        siteCount[s.sourceSite] = (siteCount[s.sourceSite] || 0) + 1;
      }
    }
  }
  const siteRows = Object.entries(siteCount).sort(([, a], [, b]) => b - a);

  // Time breakdown (last 7 days, last 30 days, all time)
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const last7 = history.filter((c) => now - new Date(c.timestamp).getTime() < 7 * day).length;
  const last30 = history.filter((c) => now - new Date(c.timestamp).getTime() < 30 * day).length;

  // Average fetch time
  const avgMs = history.length
    ? Math.round(history.reduce((s, c) => s + c.durationMs, 0) / history.length)
    : 0;
  const totalUrlsAcrossConversions = history.reduce((s, c) => s + c.count, 0);
  const avgBatchSize = history.length
    ? (totalUrlsAcrossConversions / history.length).toFixed(1)
    : "0";

  // Unique domains
  const uniqueDomains = new Set<string>();
  for (const c of history) {
    for (const u of c.urls) {
      try {
        uniqueDomains.add(new URL(u).hostname.replace(/^www\./, ""));
      } catch {}
    }
  }

  // Most recent conversion
  const mostRecent = history[0];

  const md = `# 📊 URL Conversion Stats

## Headlines

| Metric | Value |
|---|---|
| Total conversions | **${totalConversions}** |
| Total URLs converted | **${totalUrls}** |
| Unique domains | **${uniqueDomains.size}** |
| Avg fetch time | **${avgMs}ms** per URL |
| Avg batch size | **${avgBatchSize}** URLs per conversion |
| Last 7 days | **${last7}** conversion${last7 === 1 ? "" : "s"} |
| Last 30 days | **${last30}** conversion${last30 === 1 ? "" : "s"} |

## Top Domains

${topDomains.length === 0 ? "_No data yet_" : topDomains.map(([domain, count], i) => `${i + 1}. **${domain}** — ${count} URL${count === 1 ? "" : "s"}`).join("\n")}

## Output Format Mix

${fmtRows.length === 0 ? "_No data yet_" : `| Format | Count | Share |\n|---|---|---|\n${fmtRows.map(([f, n]) => `| \`${f}\` | ${n} | ${((n / totalConversions) * 100).toFixed(0)}% |`).join("\n")}`}

## Title Source Breakdown${totalSourcedUrls > 0 ? ` · ${totalSourcedUrls} URLs sampled` : ""}

${sourceRows.length === 0
  ? "_Run a new conversion to see this (added in v1.3.0)_"
  : `| Source | Count | Share |\n|---|---|---|\n${sourceRows
      .map(([s, n]) => `| \`${s}\`${sourceShare(s)} | ${n} | ${totalSourcedUrls > 0 ? ((n / totalSourcedUrls) * 100).toFixed(0) : 0}% |`)
      .join("\n")}`}

${siteRows.length > 0
  ? `\n### oEmbed Hits by Site\n\n${siteRows
      .map(([site, n], i) => `${i + 1}. **${site}** — ${n} URL${n === 1 ? "" : "s"}`)
      .join("\n")}`
  : ""}

## Most Recent

${mostRecent ? `**${new Date(mostRecent.timestamp).toLocaleString()}**\n\n\`${mostRecent.format}\` · ${mostRecent.count} URL${mostRecent.count === 1 ? "" : "s"} · ${mostRecent.durationMs}ms\n\n\`\`\`\n${mostRecent.output.slice(0, 400)}${mostRecent.output.length > 400 ? "..." : ""}\n\`\`\`` : "_No data yet_"}

---

_Storage: LocalStorage \`homepulse-url-history\` · Max ${MAX_HISTORY} entries (LRU) · Per-URL source tracking since v1.3.0_
`;

  return (
    <Detail
      markdown={md}
      actions={
        <ActionPanel>
          <Action.CopyToClipboard
            title="Copy as Markdown"
            content={md}
            shortcut={{ modifiers: ["cmd"], key: "c" }}
          />
        </ActionPanel>
      }
    />
  );
}
