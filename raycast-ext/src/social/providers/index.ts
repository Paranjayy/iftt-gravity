/**
 * Provider registry. Given a URL, picks the right provider and calls
 * fetchStats. Falls back to a "no-stats" RichResult for platforms that
 * don't have public data (Twitter/X, Instagram, TikTok) and a generic
 * "unknown" for URLs no provider recognizes.
 */

import { Provider, RichResult, Platform, ProviderOptions, Stats } from "./types";
import { youtubeProvider } from "./youtube";
import { redditProvider } from "./reddit";
import { githubProvider } from "./github";
import { hackernewsProvider } from "./hackernews";
import { stackoverflowProvider } from "./stackoverflow";

export * from "./types";

const ALL_PROVIDERS: Provider[] = [
  youtubeProvider,
  redditProvider,
  githubProvider,
  hackernewsProvider,
  stackoverflowProvider,
];

/** Platforms we explicitly recognize but have no public stats for. */
const NO_STATS_PLATFORMS: Record<string, { platform: Platform; message: string }> = {
  "twitter.com": { platform: "twitter", message: "Twitter/X requires login for view/like counts (oEmbed gives title + author)" },
  "x.com":        { platform: "twitter", message: "Twitter/X requires login for view/like counts (oEmbed gives title + author)" },
  "instagram.com":{ platform: "instagram", message: "Instagram requires login; no public stats API" },
  "tiktok.com":   { platform: "tiktok",    message: "TikTok requires login; no public stats API" },
  "facebook.com": { platform: "other",     message: "Facebook requires login; no public stats API" },
  "linkedin.com": { platform: "other",     message: "LinkedIn requires login; no public stats API" },
};

export function listProviders(): Provider[] {
  return [...ALL_PROVIDERS];
}

export function findProvider(url: string): Provider | null {
  for (const p of ALL_PROVIDERS) {
    if (p.match(url)) return p;
  }
  return null;
}

/**
 * Recognize a platform from URL even if we have no provider.
 * Used to give a friendly "no stats" message for Twitter/IG/TikTok.
 */
function recognizePlatform(url: string): { platform: Platform; message: string } | null {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return NO_STATS_PLATFORMS[host] || null;
  } catch {
    return null;
  }
}

export async function fetchStatsForUrl(
  url: string,
  opts: ProviderOptions = {},
): Promise<RichResult> {
  const t0 = Date.now();
  const provider = findProvider(url);
  if (provider) {
    return provider.fetchStats(url, opts);
  }
  // Recognized platform but no public stats
  const recognized = recognizePlatform(url);
  if (recognized) {
    return {
      url,
      title: "(no title)",
      platform: recognized.platform,
      status: "no-stats",
      stats: {},
      fetchedAt: new Date().toISOString(),
      durationMs: Date.now() - t0,
      error: recognized.message,
    };
  }
  return {
    url,
    title: "(unknown URL)",
    platform: "other",
    status: "unknown",
    stats: {},
    fetchedAt: new Date().toISOString(),
    durationMs: Date.now() - t0,
    error: "URL doesn't match any recognized platform",
  };
}

export async function fetchStatsForUrls(
  urls: string[],
  opts: ProviderOptions = {},
): Promise<RichResult[]> {
  return Promise.all(urls.map((u) => fetchStatsForUrl(u, opts)));
}

/**
 * Format RichResult as a markdown snippet. Used by the "Copy as
 * Shareable Markdown" action.
 */
export function formatStatsMarkdown(r: RichResult): string {
  const s = r.stats;
  const lines: string[] = [];
  lines.push(`### [${r.title}](${r.url})`);
  lines.push("");
  lines.push(`*Platform:* ${r.platform}`);
  if (s.author) {
    lines.push(`*By:* ${s.authorUrl ? `[${s.author}](${s.authorUrl})` : s.author}`);
  }
  switch (r.platform) {
    case "youtube":
      if (s.views !== undefined) lines.push(`*Views:* ${s.views.toLocaleString()}`);
      if (s.likes !== undefined) lines.push(`*Likes:* ${s.likes.toLocaleString()}`);
      if (s.commentCount !== undefined) lines.push(`*Comments:* ${s.commentCount.toLocaleString()}`);
      if (s.durationSec !== undefined) lines.push(`*Duration:* ${formatDuration(s.durationSec)}`);
      if (s.isLive) lines.push(`*🔴 LIVE*`);
      break;
    case "reddit":
      if (s.subreddit) lines.push(`*Subreddit:* r/${s.subreddit}`);
      if (s.score !== undefined) lines.push(`*Score:* ${s.score.toLocaleString()}`);
      if (s.commentCount !== undefined) lines.push(`*Comments:* ${s.commentCount.toLocaleString()}`);
      if (s.upvoteRatio !== undefined) lines.push(`*Upvote ratio:* ${(s.upvoteRatio * 100).toFixed(0)}%`);
      if (s.nsfw) lines.push(`*🔞 NSFW*`);
      break;
    case "github":
      if (s.stars !== undefined) lines.push(`*⭐ Stars:* ${s.stars.toLocaleString()}`);
      if (s.forks !== undefined) lines.push(`*🍴 Forks:* ${s.forks.toLocaleString()}`);
      if (s.openIssues !== undefined) lines.push(`*Issues:* ${s.openIssues.toLocaleString()}`);
      if (s.language) lines.push(`*Language:* ${s.language}`);
      if (s.description) lines.push(`*Description:* ${s.description}`);
      if (s.topics && s.topics.length) lines.push(`*Topics:* ${s.topics.slice(0, 5).map((t) => "`" + t + "`").join(", ")}`);
      break;
    case "hackernews":
      if (s.score !== undefined) lines.push(`*Points:* ${s.score}`);
      if (s.commentCount !== undefined) lines.push(`*Comments:* ${s.commentCount}`);
      break;
    case "stackoverflow":
      if (s.score !== undefined) lines.push(`*Score:* ${s.score}`);
      if (s.answers !== undefined) lines.push(`*Answers:* ${s.answers}${s.isAnswered ? " (✓ accepted)" : ""}`);
      if (s.views !== undefined) lines.push(`*Views:* ${s.views.toLocaleString()}`);
      if (s.tags && s.tags.length) lines.push(`*Tags:* ${s.tags.slice(0, 5).map((t) => "`" + t + "`").join(", ")}`);
      break;
  }
  if (r.status === "no-stats" && r.error) {
    lines.push(`*Note:* ${r.error}`);
  }
  return lines.join("\n");
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
