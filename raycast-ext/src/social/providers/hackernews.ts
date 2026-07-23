/**
 * Hacker News stats provider.
 *
 * Uses the public Firebase API. The URL formats are:
 *   https://news.ycombinator.com/item?id=12345  → fetch /item/12345.json
 *   https://news.ycombinator.com/news          → fetch top stories
 *
 * Returns: title, score, descendants (comment count), by (author), time.
 */

import { Provider, RichResult, ProviderOptions, DEFAULT_UA } from "./types";

const HN_HOSTS = ["news.ycombinator.com"];

function isHN(url: string): boolean {
  try {
    const u = new URL(url);
    return HN_HOSTS.includes(u.hostname);
  } catch {
    return false;
  }
}

function extractItemId(url: string): string | null {
  try {
    const u = new URL(url);
    const id = u.searchParams.get("id");
    if (id) return id;
    const m = u.pathname.match(/\/item\/(\d+)/);
    if (m) return m[1];
    return null;
  } catch {
    return null;
  }
}

export const hackernewsProvider: Provider = {
  name: "Hacker News",
  platform: "hackernews",
  match: isHN,
  async fetchStats(url: string, opts: ProviderOptions = {}): Promise<RichResult> {
    const t0 = Date.now();
    const timeoutMs = opts.timeoutMs ?? 8000;
    const ua = opts.userAgent ?? DEFAULT_UA;
    const id = extractItemId(url);
    if (!id) {
      return {
        url,
        title: "(no item id in URL)",
        platform: "hackernews",
        status: "no-stats",
        stats: {},
        fetchedAt: new Date().toISOString(),
        durationMs: Date.now() - t0,
        error: "Expected ?id=N or /item/N",
      };
    }
    const apiUrl = `https://hacker-news.firebaseio.com/v0/item/${id}.json`;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(apiUrl, { signal: ac.signal, headers: { "User-Agent": ua } });
      clearTimeout(timer);
      if (!res.ok) {
        return {
          url,
          title: `(item ${id})`,
          platform: "hackernews",
          status: "no-stats",
          stats: {},
          fetchedAt: new Date().toISOString(),
          durationMs: Date.now() - t0,
          error: `HTTP ${res.status}`,
        };
      }
      const data = (await res.json()) as any;
      if (!data) {
        return {
          url,
          title: `(item ${id})`,
          platform: "hackernews",
          status: "no-stats",
          stats: {},
          fetchedAt: new Date().toISOString(),
          durationMs: Date.now() - t0,
          error: "Item not found or deleted",
        };
      }
      const stats = {
        author: data.by as string | undefined,
        authorUrl: data.by ? `https://news.ycombinator.com/user?id=${data.by}` : undefined,
        score: typeof data.score === "number" ? data.score : undefined,
        points: typeof data.score === "number" ? data.score : undefined,
        commentCount: typeof data.descendants === "number" ? data.descendants : undefined,
        createdAt: data.time ? new Date(data.time * 1000).toISOString() : undefined,
      };
      return {
        url,
        title: data.title || data.text || `(item ${id})`,
        platform: "hackernews",
        status: "ok",
        stats,
        fetchedAt: new Date().toISOString(),
        durationMs: Date.now() - t0,
      };
    } catch (e: any) {
      clearTimeout(timer);
      return {
        url,
        title: `(item ${id})`,
        platform: "hackernews",
        status: "no-stats",
        stats: {},
        fetchedAt: new Date().toISOString(),
        durationMs: Date.now() - t0,
        error: String(e?.message || e),
      };
    }
  },
};
