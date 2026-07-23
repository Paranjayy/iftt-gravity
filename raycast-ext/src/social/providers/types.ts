/**
 * Social stats provider types.
 *
 * A Provider takes a URL and returns a RichResult (title + stats).
 * Providers are pure (no Raycast deps), so the same code can be used by
 * a Raycast extension, a CLI, or a web app.
 */

export type Platform =
  | "youtube"
  | "reddit"
  | "github"
  | "hackernews"
  | "stackoverflow"
  | "twitter"
  | "instagram"
  | "tiktok"
  | "vimeo"
  | "soundcloud"
  | "spotify"
  | "other";

/**
 * Platform-agnostic stats. Optional fields are filled when the platform
 * exposes that data publicly.
 */
export interface Stats {
  // Common
  author?: string;
  authorUrl?: string;
  createdAt?: string; // ISO 8601
  score?: number; // upvotes / likes / points (different per platform)
  commentCount?: number;

  // YouTube
  views?: number;
  likes?: number;
  durationSec?: number;
  thumbnailUrl?: string;
  isLive?: boolean;

  // Reddit
  subreddit?: string;
  upvoteRatio?: number;
  flair?: string;
  nsfw?: boolean;

  // GitHub
  stars?: number;
  forks?: number;
  openIssues?: number;
  language?: string;
  description?: string;
  topics?: string[]; // GitHub topics

  // Hacker News
  points?: number; // same as score, kept separate for clarity
  rank?: number; // position on the front page, if any

  // StackOverflow
  answers?: number;
  acceptedAnswerId?: number;
  tags?: string[];
  views?: number; // overlaps with YouTube; uses platform-agnostic key
  isAnswered?: boolean;
}

/**
 * Result of fetching stats for a URL. Returned by every Provider.
 */
export interface RichResult {
  url: string;
  title: string;
  platform: Platform;
  stats: Stats;
  /**
   * "ok" — provider recognized URL and returned data
   * "partial" — provider recognized URL but some fields are missing
   * "no-stats" — platform is recognized but no public stats available
   *            (e.g. Twitter/X, Instagram, TikTok — all require auth)
   * "unknown" — URL didn't match any provider
   */
  status: "ok" | "partial" | "no-stats" | "unknown";
  fetchedAt: string; // ISO 8601
  error?: string; // when status is "partial" or "no-stats", why
  durationMs: number;
}

/**
 * Provider interface. Each platform implements this.
 */
export interface Provider {
  /** Human-readable name, e.g. "YouTube" */
  name: string;
  /** Platform key */
  platform: Platform;
  /** Returns true if this provider handles the given URL */
  match(url: string): boolean;
  /** Fetch stats. Should never throw — return { status, error } instead. */
  fetchStats(url: string, opts?: ProviderOptions): Promise<RichResult>;
}

export interface ProviderOptions {
  /** Per-provider fetch timeout in ms. Default 8000. */
  timeoutMs?: number;
  /** Optional User-Agent override. */
  userAgent?: string;
}

export const DEFAULT_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
