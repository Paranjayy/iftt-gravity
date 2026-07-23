/**
 * YouTube stats provider.
 *
 * Strategy:
 * 1. Try oEmbed for the title (already proven, no API key)
 * 2. Fetch the public video page and extract stats from
 *    `ytInitialPlayerResponse` JSON (which is in the page source)
 * 3. Fall back to og:title / twitter:title for the title
 *
 * No API key required. Works for public videos. Private/age-restricted
 * videos will return partial data.
 */

import {
  Provider,
  RichResult,
  ProviderOptions,
  DEFAULT_UA,
} from "./types";

const YT_OEMBED = "https://www.youtube.com/oembed";
const YT_DOMAINS = ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"];

function isYouTube(url: string): boolean {
  try {
    const u = new URL(url);
    return YT_DOMAINS.includes(u.hostname);
  } catch {
    return false;
  }
}

function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
    if (u.pathname.startsWith("/watch")) return u.searchParams.get("v");
    if (u.pathname.startsWith("/shorts/")) return u.pathname.split("/")[2] || null;
    if (u.pathname.startsWith("/embed/")) return u.pathname.split("/")[2] || null;
    return null;
  } catch {
    return null;
  }
}

async function fetchOembedTitle(url: string, timeoutMs: number, ua: string) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(`${YT_OEMBED}?url=${encodeURIComponent(url)}&format=json`, {
      signal: ac.signal,
      headers: { "User-Agent": ua },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return (await res.json()) as { title?: string; author_name?: string; author_url?: string };
  } catch {
    clearTimeout(timer);
    return null;
  }
}

async function fetchPageStats(url: string, timeoutMs: number, ua: string) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ac.signal,
      headers: { "User-Agent": ua, "Accept-Language": "en-US,en;q=0.9" },
      redirect: "follow",
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const html = await res.text();
    // The player response is a JSON blob embedded in the page.
    // Look for ytInitialPlayerResponse = {...}; or ytInitialData = {...};
    const m = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});/);
    if (!m?.[1]) return null;
    let blob: any;
    try {
      blob = JSON.parse(m[1]);
    } catch {
      return null;
    }
    const details = blob?.videoDetails;
    if (!details) return null;
    return {
      title: details.title as string | undefined,
      author: details.author as string | undefined,
      authorUrl:
        typeof details.authorUrl === "string"
          ? details.authorUrl.startsWith("http")
            ? details.authorUrl
            : `https://www.youtube.com${details.authorUrl}`
          : undefined,
      lengthSeconds: typeof details.lengthSeconds === "string" ? parseInt(details.lengthSeconds, 10) : undefined,
      viewCount: typeof details.viewCount === "string" ? parseInt(details.viewCount, 10) : undefined,
      likes: blob?.microformat?.playerMicroformatRenderer?.likeCount
        ? parseInt(blob.microformat.playerMicroformatRenderer.likeCount, 10)
        : undefined,
      isLive: details.isLiveContent === true || details.isLive === true,
      isLiveBroadcast:
        blob?.microformat?.playerMicroformatRenderer?.isLiveBroadcast === true,
      thumbnail:
        typeof details.thumbnail?.thumbnails?.[details.thumbnail.thumbnails.length - 1]?.url === "string"
          ? details.thumbnail.thumbnails[details.thumbnail.thumbnails.length - 1].url
          : undefined,
    };
  } catch {
    clearTimeout(timer);
    return null;
  }
}

export const youtubeProvider: Provider = {
  name: "YouTube",
  platform: "youtube",
  match: isYouTube,
  async fetchStats(url: string, opts: ProviderOptions = {}): Promise<RichResult> {
    const t0 = Date.now();
    const timeoutMs = opts.timeoutMs ?? 10000;
    const ua = opts.userAgent ?? DEFAULT_UA;
    const videoId = extractVideoId(url);

    // 1. Try page stats (richer)
    const page = await fetchPageStats(url, timeoutMs, ua);
    if (page) {
      const stats = {
        author: page.author,
        authorUrl: page.authorUrl,
        views: page.viewCount,
        likes: page.likes,
        durationSec: page.lengthSeconds,
        thumbnailUrl: page.thumbnail,
        isLive: page.isLive,
      };
      return {
        url,
        title: page.title || "(no title)",
        platform: "youtube",
        status: page.viewCount !== undefined ? "ok" : "partial",
        stats,
        fetchedAt: new Date().toISOString(),
        durationMs: Date.now() - t0,
        error: page.viewCount === undefined ? "Page loaded but no view count" : undefined,
      };
    }

    // 2. Fallback: oEmbed (just title)
    const oe = await fetchOembedTitle(url, timeoutMs, ua);
    if (oe) {
      return {
        url,
        title: oe.title || "(no title)",
        platform: "youtube",
        status: "partial",
        stats: {
          author: oe.author_name,
          authorUrl: oe.author_url,
        },
        fetchedAt: new Date().toISOString(),
        durationMs: Date.now() - t0,
        error: videoId
          ? "YouTube page didn't expose stats JSON (private or age-restricted?)"
          : "Invalid YouTube URL",
      };
    }

    return {
      url,
      title: "(no title)",
      platform: "youtube",
      status: "no-stats",
      stats: {},
      fetchedAt: new Date().toISOString(),
      durationMs: Date.now() - t0,
      error: "Both oEmbed and page scrape failed",
    };
  },
};
